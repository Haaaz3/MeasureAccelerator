/**
 * Measure Migration Utilities
 *
 * Migrates existing measures to FHIR-aligned UMS schema.
 * Handles backwards compatibility and data normalization.
 */

import type {
  UniversalMeasureSpec,
  PopulationDefinition,
  LogicalClause,
  DataElement,
  PopulationType,
  DataElementType,
} from '../types/ums';
import { normalizePopulationType } from '../types/ums';
import { DATA_ELEMENT_TO_QICORE, getCodeSystemUrl } from '../types/fhir-measure';

/**
 * Migrate a measure to the latest FHIR-aligned schema
 */
export function migrateMeasure(measure: UniversalMeasureSpec): UniversalMeasureSpec {
  const migrated = JSON.parse(JSON.stringify(measure)) as UniversalMeasureSpec;

  // Add resourceType marker
  migrated.resourceType = 'Measure';

  // Migrate populations
  migrated.populations = migrated.populations.map(migratePopulation);

  // Migrate value sets
  migrated.valueSets = migrated.valueSets.map(vs => ({
    ...vs,
    // Add FHIR canonical URL if OID exists
    url: vs.url || (vs.oid ? `http://cts.nlm.nih.gov/fhir/ValueSet/${vs.oid}` : undefined),
    // Add system URIs to codes
    codes: vs.codes.map(code => ({
      ...code,
      systemUri: code.systemUri || getCodeSystemUrl(code.system),
    })),
  }));

  // Ensure globalConstraints exists
  if (!migrated.globalConstraints) {
    migrated.globalConstraints = extractGlobalConstraints(migrated);
  }

  // Add FHIR metadata fields if missing
  if (!migrated.metadata.url) {
    migrated.metadata.url = `urn:uuid:${migrated.id}`;
  }
  if (!migrated.metadata.scoring) {
    migrated.metadata.scoring = 'proportion';
  }

  // Set updatedAt
  migrated.updatedAt = new Date().toISOString();

  return migrated;
}

/**
 * Migrate a population definition
 */
function migratePopulation(pop: PopulationDefinition): PopulationDefinition {
  return {
    ...pop,
    // Normalize population type to FHIR kebab-case
    type: normalizePopulationType(pop.type) as PopulationType,
    // Add CQL definition name if missing
    cqlDefinitionName: pop.cqlDefinitionName || getCQLDefinitionName(pop.type),
    // Add expression if missing
    expression: pop.expression || {
      language: 'text/cql-identifier',
      expression: getCQLDefinitionName(pop.type),
    },
    // Migrate criteria
    criteria: migrateClause(pop.criteria),
  };
}

/**
 * Migrate a logical clause
 */
function migrateClause(clause: LogicalClause): LogicalClause {
  return {
    ...clause,
    children: clause.children.map(child => {
      if ('operator' in child) {
        return migrateClause(child as LogicalClause);
      } else {
        return migrateDataElement(child as DataElement);
      }
    }),
  };
}

/**
 * Migrate a data element
 */
function migrateDataElement(element: DataElement): DataElement {
  const migrated: DataElement = {
    ...element,
    // Add QI-Core resource type
    resourceType: DATA_ELEMENT_TO_QICORE[element.type],
  };

  // Migrate deprecated constraints to thresholds
  if ((element as any).constraints && !element.thresholds) {
    const constraints = (element as any).constraints;
    migrated.thresholds = {
      ageMin: constraints.ageMin ?? constraints.minAge,
      ageMax: constraints.ageMax ?? constraints.maxAge,
      valueMin: constraints.valueMin ?? constraints.minValue,
      valueMax: constraints.valueMax ?? constraints.maxValue,
      unit: constraints.unit,
      comparator: constraints.comparator,
    };
    delete (migrated as any).constraints;
  }

  // Migrate deprecated temporalConstraints to timingRequirements
  if ((element as any).temporalConstraints && !element.timingRequirements) {
    migrated.timingRequirements = (element as any).temporalConstraints.map((tc: any) => ({
      description: tc.description || `${tc.operator} ${tc.reference}`,
      operator: tc.operator,
      relativeTo: tc.reference === 'measurement_period' ? 'Measurement Period' : tc.reference,
      window: tc.offset,
      confidence: tc.confidence,
    }));
    delete (migrated as any).temporalConstraints;
  }

  // Migrate deprecated additionalConstraints to additionalRequirements
  if ((element as any).additionalConstraints && !element.additionalRequirements) {
    migrated.additionalRequirements = (element as any).additionalConstraints;
    delete (migrated as any).additionalConstraints;
  }

  // Add system URIs to value set codes
  if (migrated.valueSet?.codes) {
    migrated.valueSet.codes = migrated.valueSet.codes.map(code => ({
      ...code,
      systemUri: code.systemUri || getCodeSystemUrl(code.system),
    }));
  }

  // Add system URIs to direct codes
  if (migrated.directCodes) {
    migrated.directCodes = migrated.directCodes.map(code => ({
      ...code,
      systemUri: code.systemUri || getCodeSystemUrl(code.system),
    }));
  }

  return migrated;
}

/**
 * Get the standard CQL definition name for a population type
 */
function getCQLDefinitionName(type: string): string {
  const mapping: Record<string, string> = {
    'initial_population': 'Initial Population',
    'initial-population': 'Initial Population',
    'denominator': 'Denominator',
    'denominator_exclusion': 'Denominator Exclusion',
    'denominator-exclusion': 'Denominator Exclusion',
    'denominator_exception': 'Denominator Exception',
    'denominator-exception': 'Denominator Exception',
    'numerator': 'Numerator',
    'numerator_exclusion': 'Numerator Exclusion',
    'numerator-exclusion': 'Numerator Exclusion',
  };
  return mapping[type] || type.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Extract global constraints from population criteria
 */
function extractGlobalConstraints(measure: UniversalMeasureSpec): UniversalMeasureSpec['globalConstraints'] {
  const constraints: UniversalMeasureSpec['globalConstraints'] = {};

  // Find age constraints
  const findAge = (node: any): { min?: number; max?: number } | null => {
    if (!node) return null;
    if (node.thresholds?.ageMin !== undefined || node.thresholds?.ageMax !== undefined) {
      return { min: node.thresholds.ageMin, max: node.thresholds.ageMax };
    }
    if (node.children) {
      for (const child of node.children) {
        const result = findAge(child);
        if (result) return result;
      }
    }
    if (node.criteria) return findAge(node.criteria);
    return null;
  };

  for (const pop of measure.populations) {
    const age = findAge(pop);
    if (age && (age.min !== undefined || age.max !== undefined)) {
      constraints.ageRange = {
        min: age.min ?? 0,
        max: age.max ?? 999,
      };
      break;
    }
  }

  // Only extract gender constraint for measures that are explicitly gender-specific
  // based on measure title/ID, NOT from population descriptions (which often say "men and women")
  const title = measure.metadata.title?.toLowerCase() || '';
  const measureId = measure.metadata.measureId?.toUpperCase() || '';

  // Female-only measures
  if (title.includes('cervical') || title.includes('cervix') ||
      title.includes('breast cancer screen') || title.includes('mammogram') ||
      measureId.includes('CMS124') || measureId.includes('CMS125')) {
    constraints.gender = 'female';
  }
  // Male-only measures
  else if (title.includes('prostate') || measureId.includes('CMS129')) {
    constraints.gender = 'male';
  }
  // Do NOT extract gender from descriptions - colorectal cancer says "men and women"
  // which would incorrectly trigger a female-only constraint

  return Object.keys(constraints).length > 0 ? constraints : undefined;
}

/**
 * Check if a measure needs migration
 */
export function needsMigration(measure: UniversalMeasureSpec): boolean {
  // Check for missing FHIR markers
  if (!measure.resourceType) return true;

  // Check for legacy population types (underscore instead of kebab-case)
  const hasLegacyPopTypes = measure.populations.some(p =>
    p.type.includes('_') && p.type !== 'denominator' && p.type !== 'numerator'
  );
  if (hasLegacyPopTypes) return true;

  // Check for deprecated fields
  const checkDeprecated = (node: any): boolean => {
    if (!node) return false;
    if (node.constraints) return true;
    if (node.temporalConstraints) return true;
    if (node.additionalConstraints) return true;
    if (node.children) {
      for (const child of node.children) {
        if (checkDeprecated(child)) return true;
      }
    }
    if (node.criteria && checkDeprecated(node.criteria)) return true;
    return false;
  };

  for (const pop of measure.populations) {
    if (checkDeprecated(pop)) return true;
  }

  return false;
}

/**
 * Get migration report for a measure
 */
export function getMigrationReport(measure: UniversalMeasureSpec): string[] {
  const issues: string[] = [];

  if (!measure.resourceType) {
    issues.push('Missing resourceType marker');
  }

  measure.populations.forEach((pop, i) => {
    if (pop.type.includes('_') && !['denominator', 'numerator'].includes(pop.type)) {
      issues.push(`Population ${i}: Using legacy type "${pop.type}" instead of FHIR kebab-case`);
    }
    if (!pop.expression) {
      issues.push(`Population ${i}: Missing FHIR expression reference`);
    }
    if (!pop.cqlDefinitionName) {
      issues.push(`Population ${i}: Missing CQL definition name`);
    }
  });

  const checkNode = (node: any, path: string) => {
    if (!node) return;
    if (node.constraints) {
      issues.push(`${path}: Using deprecated "constraints" field`);
    }
    if (node.temporalConstraints) {
      issues.push(`${path}: Using deprecated "temporalConstraints" field`);
    }
    if (node.children) {
      node.children.forEach((child: any, i: number) => checkNode(child, `${path}.children[${i}]`));
    }
    if (node.criteria) checkNode(node.criteria, `${path}.criteria`);
  };

  measure.populations.forEach((pop, i) => checkNode(pop, `populations[${i}]`));

  if (!measure.globalConstraints) {
    issues.push('Missing globalConstraints (single source of truth for age/gender)');
  }

  measure.valueSets.forEach((vs, i) => {
    if (vs.oid && !vs.url) {
      issues.push(`ValueSet ${i} (${vs.name}): Missing FHIR canonical URL`);
    }
    vs.codes.forEach((code, j) => {
      if (!code.systemUri) {
        issues.push(`ValueSet ${i}.codes[${j}]: Missing FHIR system URI`);
      }
    });
  });

  return issues;
}
