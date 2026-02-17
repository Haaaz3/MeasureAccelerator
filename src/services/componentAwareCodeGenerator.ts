/**
 * Component-Aware Code Generator Service
 *
 * Generates code for measures by pulling from library component code when available,
 * falling back to fresh generation only when necessary.
 *
 * This implements the "code composition" pattern from the audit:
 * - For each DataElement in the UMS, lookup the linked library component
 * - If the component has generatedCode or codeOverrides, use that code
 * - Compose component-level code into population definitions
 * - Only generate fresh code if there's no linked component
 */

import type { UniversalMeasureSpec, DataElement, LogicalClause, PopulationDefinition } from '../types/ums';
import type { LibraryComponent, AtomicComponent, GeneratedComponentCode } from '../types/componentLibrary';
import type { CodeOutputFormat } from '../types/componentCode';
import { useComponentLibraryStore } from '../stores/componentLibraryStore';
import { useComponentCodeStore, getStoreKey } from '../stores/componentCodeStore';
import { generateLibraryComponentCode } from './componentCodeGenerator';

// ============================================================================
// Types
// ============================================================================

export interface ComponentCodeLookupResult {
  /** The DataElement ID */
  elementId: string;
  /** The linked library component (if found) */
  linkedComponent?: LibraryComponent;
  /** The code to use (from component or freshly generated) */
  cql: string;
  sql: string;
  /** Whether this code came from a library component */
  fromComponent: boolean;
  /** Whether an override was applied */
  hasOverride: boolean;
  /** Whether the override is from measure-scoped store (vs library-level) */
  isMeasureScopedOverride?: boolean;
  /** Notes explaining any overrides */
  overrideNotes?: string[];
}

export interface ComposedPopulationCode {
  populationType: string;
  cql: string;
  sql: string;
  componentCodes: ComponentCodeLookupResult[];
}

export interface ComposedMeasureCode {
  cql: string;
  sql: string;
  populations: ComposedPopulationCode[];
  componentCount: number;
  componentFromLibraryCount: number;
  overrideCount: number;
  /** Count of overrides from measure-scoped store (subset of overrideCount) */
  measureScopedOverrideCount: number;
  warnings: string[];
}

// ============================================================================
// Component Code Lookup
// ============================================================================

/**
 * Look up the library component linked to a DataElement and get its code
 *
 * Priority order for code:
 * 1. Measure-scoped overrides (componentCodeStore) - highest priority
 * 2. Library component overrides (component.codeOverrides)
 * 3. Library component generated code (component.generatedCode)
 * 4. Fresh generation (fallback)
 */
export function getComponentCodeForElement(
  element: DataElement,
  allComponents: LibraryComponent[],
  measureId?: string
): ComponentCodeLookupResult {
  // PRIORITY 1: Check for measure-scoped overrides in componentCodeStore
  if (measureId) {
    const measureScopedOverride = getMeasureScopedOverride(measureId, element.id);
    if (measureScopedOverride) {
      return {
        elementId: element.id,
        cql: measureScopedOverride.cql,
        sql: measureScopedOverride.sql,
        fromComponent: false, // Override is measure-scoped, not from library
        hasOverride: true,
        isMeasureScopedOverride: true,
        overrideNotes: measureScopedOverride.notes,
      };
    }
  }

  // Try to find a linked component by:
  // 1. Direct linkedComponentId on the DataElement
  // 2. Matching by value set OID
  // 3. Matching by name similarity

  let linkedComponent: LibraryComponent | undefined;

  // Method 1: Direct link
  if (element.linkedComponentId) {
    linkedComponent = allComponents.find(c => c.id === element.linkedComponentId);
  }

  // Method 2: Value set OID match
  if (!linkedComponent && element.valueSet?.oid) {
    linkedComponent = allComponents.find(c => {
      if (c.type !== 'atomic') return false;
      const atomic = c as AtomicComponent;
      return atomic.valueSet?.oid === element.valueSet?.oid;
    });
  }

  // Method 3: Value set name match
  if (!linkedComponent && element.valueSet?.name) {
    const normalizedName = element.valueSet.name.toLowerCase().trim();
    linkedComponent = allComponents.find(c => {
      if (c.type !== 'atomic') return false;
      const atomic = c as AtomicComponent;
      const componentName = atomic.valueSet?.name?.toLowerCase().trim();
      return componentName === normalizedName;
    });
  }

  // PRIORITY 2 & 3: If we found a linked component, use its code (with library-level overrides)
  if (linkedComponent) {
    const code = getEffectiveComponentCode(linkedComponent, allComponents);
    return {
      elementId: element.id,
      linkedComponent,
      cql: code.cql,
      sql: code.sql,
      fromComponent: true,
      hasOverride: code.hasOverride,
      overrideNotes: code.overrideNotes,
    };
  }

  // PRIORITY 4: No linked component - generate fresh code for this element
  const freshCode = generateFreshElementCode(element);
  return {
    elementId: element.id,
    cql: freshCode.cql,
    sql: freshCode.sql,
    fromComponent: false,
    hasOverride: false,
  };
}

/**
 * Get measure-scoped override from componentCodeStore
 */
function getMeasureScopedOverride(
  measureId: string,
  elementId: string
): { cql: string; sql: string; notes: string[] } | null {
  const store = useComponentCodeStore.getState();
  const storeKey = getStoreKey(measureId, elementId);
  const codeState = store.codeStates[storeKey];

  if (!codeState) return null;

  const cqlOverride = codeState.overrides['cql'];
  const sqlOverride = codeState.overrides['synapse-sql'];

  // At least one override must be locked
  if (!cqlOverride?.isLocked && !sqlOverride?.isLocked) {
    return null;
  }

  const notes: string[] = [];
  if (cqlOverride?.isLocked) {
    cqlOverride.notes.forEach(n => notes.push(`CQL: ${n.content}`));
  }
  if (sqlOverride?.isLocked) {
    sqlOverride.notes.forEach(n => notes.push(`SQL: ${n.content}`));
  }

  return {
    cql: cqlOverride?.isLocked ? cqlOverride.code : '',
    sql: sqlOverride?.isLocked ? sqlOverride.code : '',
    notes,
  };
}

/**
 * Get the effective code for a component, respecting overrides
 */
function getEffectiveComponentCode(
  component: LibraryComponent,
  allComponents: LibraryComponent[]
): { cql: string; sql: string; hasOverride: boolean; overrideNotes?: string[] } {
  // Check for code overrides first
  if (component.codeOverrides?.cql?.code || component.codeOverrides?.sql?.code) {
    const cqlCode = component.codeOverrides.cql?.code || component.generatedCode?.cql || '';
    const sqlCode = component.codeOverrides.sql?.code || component.generatedCode?.sql || '';

    const notes: string[] = [];
    if (component.codeOverrides.cql) {
      notes.push(`CQL override by ${component.codeOverrides.cql.author}: ${component.codeOverrides.cql.note}`);
    }
    if (component.codeOverrides.sql) {
      notes.push(`SQL override by ${component.codeOverrides.sql.author}: ${component.codeOverrides.sql.note}`);
    }

    return {
      cql: cqlCode,
      sql: sqlCode,
      hasOverride: true,
      overrideNotes: notes,
    };
  }

  // Use generated code if available
  if (component.generatedCode) {
    return {
      cql: component.generatedCode.cql,
      sql: component.generatedCode.sql,
      hasOverride: false,
    };
  }

  // Generate code on-the-fly if not already generated
  const result = generateLibraryComponentCode(component, allComponents);
  return {
    cql: result.cql,
    sql: result.sql,
    hasOverride: false,
  };
}

/**
 * Generate fresh code for a DataElement (when no linked component exists)
 */
function generateFreshElementCode(element: DataElement): { cql: string; sql: string } {
  const vsName = element.valueSet?.name || element.description || 'Value Set';
  const vsOid = element.valueSet?.oid || 'UNKNOWN_OID';

  // Generate simple CQL exists query
  let cql: string;
  let sql: string;

  const resourceType = mapElementTypeToResource(element.type);
  const alias = resourceType.charAt(0);

  if (element.type === 'demographic') {
    cql = '"Patient Age Valid"';
    sql = `-- Demographic: ${element.description}\nSELECT patient_id FROM DEMOG`;
  } else {
    cql = `exists ([${resourceType}: "${vsName}"] ${alias}
    where ${alias}.performed during "Measurement Period")`;

    sql = `-- ${element.description || vsName}
SELECT DISTINCT patient_id
FROM FACT_${resourceType.toUpperCase()} dm
INNER JOIN ONT ont ON dm.code = ont.code
WHERE ont.concept_set_name = '${vsName}'`;
  }

  // Apply negation
  if (element.negation) {
    cql = `not ${cql}`;
    sql = `-- NEGATED\nSELECT patient_id FROM DEMOG\nEXCEPT\n${sql}`;
  }

  return { cql, sql };
}

/**
 * Map DataElement type to FHIR resource type
 */
function mapElementTypeToResource(type: string): string {
  const map: Record<string, string> = {
    diagnosis: 'Condition',
    encounter: 'Encounter',
    procedure: 'Procedure',
    observation: 'Observation',
    medication: 'MedicationRequest',
    immunization: 'Immunization',
    assessment: 'Observation',
    demographic: 'Patient',
  };
  return map[type] || 'Observation';
}

// ============================================================================
// Population Code Composition
// ============================================================================

/**
 * Compose code for a single population using component codes
 */
export function composePopulationCode(
  population: PopulationDefinition,
  allComponents: LibraryComponent[],
  measureId?: string
): ComposedPopulationCode {
  const componentCodes: ComponentCodeLookupResult[] = [];

  if (!population.criteria || !population.criteria.children) {
    return {
      populationType: population.type,
      cql: 'true /* No criteria defined */',
      sql: 'SELECT patient_id FROM DEMOG /* No criteria defined */',
      componentCodes: [],
    };
  }

  // Recursively collect code for all elements in the criteria tree
  const { cql, sql, codes } = composeClauseCode(population.criteria, allComponents, measureId);
  componentCodes.push(...codes);

  return {
    populationType: population.type,
    cql,
    sql,
    componentCodes,
  };
}

/**
 * Compose code for a logical clause (recursive)
 */
function composeClauseCode(
  clause: LogicalClause,
  allComponents: LibraryComponent[],
  measureId?: string
): { cql: string; sql: string; codes: ComponentCodeLookupResult[] } {
  const codes: ComponentCodeLookupResult[] = [];
  const cqlParts: string[] = [];
  const sqlParts: string[] = [];

  if (!clause.children || clause.children.length === 0) {
    return { cql: 'true', sql: 'SELECT patient_id FROM DEMOG', codes: [] };
  }

  for (const child of clause.children) {
    if ('operator' in child && 'children' in child) {
      // Nested clause
      const nestedClause = child as LogicalClause;
      const nested = composeClauseCode(nestedClause, allComponents, measureId);
      cqlParts.push(`(${nested.cql})`);
      sqlParts.push(`(${nested.sql})`);
      codes.push(...nested.codes);
    } else {
      // DataElement
      const element = child as DataElement;
      const componentCode = getComponentCodeForElement(element, allComponents, measureId);
      codes.push(componentCode);
      cqlParts.push(componentCode.cql);
      sqlParts.push(componentCode.sql);
    }
  }

  const cqlOperator = clause.operator === 'OR' ? '\n  or ' : '\n  and ';
  const sqlOperator = clause.operator === 'OR' ? '\nUNION\n' : '\nINTERSECT\n';

  return {
    cql: cqlParts.join(cqlOperator),
    sql: sqlParts.join(sqlOperator),
    codes,
  };
}

// ============================================================================
// Full Measure Code Composition
// ============================================================================

/**
 * Generate complete measure code using component library code
 */
export function generateComponentAwareMeasureCode(
  measure: UniversalMeasureSpec
): ComposedMeasureCode {
  const store = useComponentLibraryStore.getState();
  const allComponents = store.components;
  const warnings: string[] = [];

  // Get the measure ID for looking up measure-scoped overrides
  const measureId = measure.id || measure.metadata?.measureId || '';

  // Compose code for each population
  const populations: ComposedPopulationCode[] = [];
  let componentCount = 0;
  let componentFromLibraryCount = 0;
  let overrideCount = 0;
  let measureScopedOverrideCount = 0;

  for (const pop of measure.populations) {
    const composedPop = composePopulationCode(pop, allComponents, measureId);
    populations.push(composedPop);

    for (const code of composedPop.componentCodes) {
      componentCount++;
      if (code.fromComponent) componentFromLibraryCount++;
      if (code.hasOverride) {
        overrideCount++;
        if (code.isMeasureScopedOverride) measureScopedOverrideCount++;
      }

      if (!code.fromComponent && !code.isMeasureScopedOverride) {
        warnings.push(`No linked component for "${code.elementId}" - using fresh generation`);
      }
    }
  }

  // Assemble full CQL
  const cql = assembleCQL(measure, populations);

  // Assemble full SQL
  const sql = assembleSQL(measure, populations);

  return {
    cql,
    sql,
    populations,
    componentCount,
    componentFromLibraryCount,
    overrideCount,
    measureScopedOverrideCount,
    warnings,
  };
}

/**
 * Assemble full CQL from composed populations
 */
function assembleCQL(
  measure: UniversalMeasureSpec,
  populations: ComposedPopulationCode[]
): string {
  const libraryName = (measure.metadata.measureId || 'Measure').replace(/[^a-zA-Z0-9]/g, '');
  const version = measure.metadata.version || '1.0.0';

  // Build value set declarations
  const valueSetDeclarations = measure.valueSets.map(vs => {
    const url = vs.url || (vs.oid ? `http://cts.nlm.nih.gov/fhir/ValueSet/${vs.oid}` : `urn:oid:unknown`);
    return `valueset "${vs.name}": '${url}'`;
  }).join('\n');

  // Build population definitions
  const populationDefs = populations.map(pop => {
    const defName = formatPopulationDefName(pop.populationType);
    return `/*
 * ${defName}
 */
define "${defName}":
  ${pop.cql}`;
  }).join('\n\n');

  return `/*
 * ${measure.metadata.title}
 * Measure ID: ${measure.metadata.measureId}
 * Version: ${version}
 * Generated: ${new Date().toISOString()}
 *
 * Code composed from library components
 */

library ${libraryName} version '${version}'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers
include QICoreCommon version '2.0.0' called QICoreCommon

// Value Sets
${valueSetDeclarations}

parameter "Measurement Period" Interval<DateTime>
  default Interval[@${measure.metadata.measurementPeriod?.start || '2025-01-01'}T00:00:00.0, @${measure.metadata.measurementPeriod?.end || '2025-12-31'}T23:59:59.999]

context Patient

// Population Definitions (composed from library components)
${populationDefs}
`;
}

/**
 * Assemble full SQL from composed populations
 */
function assembleSQL(
  measure: UniversalMeasureSpec,
  populations: ComposedPopulationCode[]
): string {
  const measureName = (measure.metadata.measureId || 'measure').replace(/[^a-zA-Z0-9]/g, '_');

  // Build population CTEs
  const populationCTEs = populations.map(pop => {
    const cteName = formatPopulationCTEName(pop.populationType);
    return `-- ${formatPopulationDefName(pop.populationType)}
${cteName} AS (
  ${pop.sql.split('\n').join('\n  ')}
)`;
  }).join(',\n\n');

  return `/*
 * ${measure.metadata.title}
 * Measure ID: ${measure.metadata.measureId}
 * Generated: ${new Date().toISOString()}
 *
 * Code composed from library components
 */

DECLARE @MP_START DATE = '${measure.metadata.measurementPeriod?.start || '2025-01-01'}';
DECLARE @MP_END DATE = '${measure.metadata.measurementPeriod?.end || '2025-12-31'}';

WITH
-- Population CTEs (composed from library components)
${populationCTEs}

-- Final Results
SELECT
  ip.patient_id,
  CASE WHEN de.patient_id IS NOT NULL THEN 1 ELSE 0 END AS excluded,
  CASE WHEN num.patient_id IS NOT NULL THEN 1 ELSE 0 END AS numerator_met
FROM IP ip
LEFT JOIN DE de ON ip.patient_id = de.patient_id
LEFT JOIN NUM num ON ip.patient_id = num.patient_id AND de.patient_id IS NULL;
`;
}

/**
 * Format population type to CQL definition name
 */
function formatPopulationDefName(type: string): string {
  const nameMap: Record<string, string> = {
    'initial-population': 'Initial Population',
    'initial_population': 'Initial Population',
    'denominator': 'Denominator',
    'denominator-exclusion': 'Denominator Exclusion',
    'denominator_exclusion': 'Denominator Exclusion',
    'denominator-exception': 'Denominator Exception',
    'denominator_exception': 'Denominator Exception',
    'numerator': 'Numerator',
    'numerator-exclusion': 'Numerator Exclusion',
    'numerator_exclusion': 'Numerator Exclusion',
  };
  return nameMap[type] || type;
}

/**
 * Format population type to SQL CTE name
 */
function formatPopulationCTEName(type: string): string {
  const nameMap: Record<string, string> = {
    'initial-population': 'IP',
    'initial_population': 'IP',
    'denominator': 'DENOM',
    'denominator-exclusion': 'DE',
    'denominator_exclusion': 'DE',
    'denominator-exception': 'DEXCEP',
    'denominator_exception': 'DEXCEP',
    'numerator': 'NUM',
    'numerator-exclusion': 'NE',
    'numerator_exclusion': 'NE',
  };
  return nameMap[type] || 'POP';
}

// ============================================================================
// Integration Helpers
// ============================================================================

/**
 * Get code for a specific population, composed from component code
 */
export function getComposedPopulationCQL(
  population: PopulationDefinition,
  allComponents?: LibraryComponent[]
): string {
  const components = allComponents || useComponentLibraryStore.getState().components;
  const composed = composePopulationCode(population, components);
  return composed.cql;
}

/**
 * Get code for a specific population, composed from component code
 */
export function getComposedPopulationSQL(
  population: PopulationDefinition,
  allComponents?: LibraryComponent[]
): string {
  const components = allComponents || useComponentLibraryStore.getState().components;
  const composed = composePopulationCode(population, components);
  return composed.sql;
}
