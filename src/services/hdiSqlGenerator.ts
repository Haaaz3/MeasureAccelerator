/**
 * HDI SQL Generator Service
 *
 * Converts Universal Measure Specifications (UMS) into production-ready SQL
 * queries following the HDI (HealtheIntent) platform patterns.
 *
 * This service outputs SQL with:
 * - CTE-based structure (ONT, DEMOG, PRED_*)
 * - Ontology joins for terminology resolution
 * - Predicate-based patient filtering
 * - INTERSECT/UNION/EXCEPT for population logic
 */

import type {
  UniversalMeasureSpec,
  DataElement,
  LogicalClause,
  PopulationDefinition,
  ValueSetReference,
} from '../types/ums';

import type {
  SQLGenerationConfig,
  SQLGenerationResult,
  MeasureSQLMapping,
  DataModelPredicate,
  DemographicsPredicate,
  ConditionPredicate,
  ResultPredicate,
  ProcedurePredicate,
  MedicationPredicate,
  ImmunizationPredicate,
  EncounterPredicate,
  PredicateGroup,
} from '../types/hdiDataModels';

import {
  generateDemographicsPredicateCTE,
  generateConditionPredicateCTE,
  generateResultPredicateCTE,
  generateProcedurePredicateCTE,
  generateMedicationPredicateCTE,
  generateImmunizationPredicateCTE,
  generateEncounterPredicateCTE,
  generateFullSQL,
  generateIPSDCTE,
  generateMedCoverageCTE,
  generateCumulativeDaysSupplyCTE,
} from './hdiSqlTemplates';

// Re-export for external use (e.g., building custom measure SQL mappings)
export { generateIPSDCTE, generateMedCoverageCTE, generateCumulativeDaysSupplyCTE };

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_HDI_CONFIG: SQLGenerationConfig = {
  populationId: '${POPULATION_ID}', // Placeholder for parameterization
  ontologyContexts: ['HEALTHE INTENT Demographics'],
  excludeSnapshotsAndArchives: true,
  dialect: 'snowflake',
  includeComments: true,
};

// ============================================================================
// Main SQL Generation Function
// ============================================================================

/**
 * Generate production-ready HDI SQL from a Universal Measure Specification
 */
export function generateHDISQL(
  measure: UniversalMeasureSpec,
  config: Partial<SQLGenerationConfig> = {}
): SQLGenerationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Merge with defaults
  const fullConfig: SQLGenerationConfig = {
    ...DEFAULT_HDI_CONFIG,
    ...config,
    measurementPeriod: config.measurementPeriod || (measure.metadata.measurementPeriod ? {
      start: measure.metadata.measurementPeriod.start || '',
      end: measure.metadata.measurementPeriod.end || '',
    } : undefined),
  };

  try {
    // Step 1: Extract predicates from UMS
    const mapping = extractPredicatesFromUMS(measure, fullConfig);

    if (mapping.predicates.length === 0) {
      warnings.push('No clinical criteria found - generating demographics-only query');
    }

    // Step 2: Generate CTE for each predicate
    const predicateCTEs = mapping.predicates.map(pred => {
      try {
        return generatePredicateCTE(pred, fullConfig);
      } catch (err) {
        errors.push(`Failed to generate CTE for predicate ${pred.alias}: ${err}`);
        return `-- ERROR: Failed to generate ${pred.alias}`;
      }
    });

    // Step 3: Auto-configure ONT contexts based on data models actually used
    const dataModelsUsed = [...new Set(mapping.predicates.map(p => p.type))];
    const autoContexts = deriveOntologyContexts(dataModelsUsed);
    if (autoContexts.length > 0) {
      fullConfig.ontologyContexts = autoContexts;
    }

    // Step 4: Generate population combination logic
    const populationSQL = generatePopulationLogic(mapping, fullConfig);

    // Step 5: Assemble full SQL (include index event + auxiliary CTEs)
    const sql = generateFullSQL(predicateCTEs, populationSQL, fullConfig, {
      indexEventCTEs: mapping.indexEventCTEs?.map(ie => ie.sql),
      auxiliaryCTEs: mapping.auxiliaryCTEs,
    });

    return {
      success: errors.length === 0,
      sql,
      errors,
      warnings,
      metadata: {
        predicateCount: mapping.predicates.length,
        dataModelsUsed,
        estimatedComplexity: estimateComplexity(mapping),
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return {
      success: false,
      sql: '',
      errors: [`SQL generation failed: ${err}`],
      warnings,
      metadata: {
        predicateCount: 0,
        dataModelsUsed: [],
        estimatedComplexity: 'low',
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

// ============================================================================
// UMS to Predicate Extraction
// ============================================================================

/**
 * Extract SQL predicates from UMS populations and criteria
 */
function extractPredicatesFromUMS(
  measure: UniversalMeasureSpec,
  config: SQLGenerationConfig
): MeasureSQLMapping {
  const predicates: DataModelPredicate[] = [];
  const populations: MeasureSQLMapping['populations'] = {};

  let predicateCounter = 0;
  const generateAlias = (prefix: string) => `PRED_${prefix}_${++predicateCounter}`;

  // Extract global demographic constraints
  if (measure.globalConstraints) {
    const demoPred = extractDemographicPredicate(
      measure.globalConstraints,
      generateAlias('DEMOG')
    );
    if (demoPred) {
      predicates.push(demoPred);
    }
  }

  // Process each population
  for (const population of measure.populations) {
    const popPredicates: string[] = [];

    if (population.criteria) {
      const extracted = extractFromLogicalClause(
        population.criteria,
        generateAlias,
        measure.valueSets
      );
      predicates.push(...extracted.predicates);
      popPredicates.push(...extracted.predicateAliases);
    }

    // Map to population type
    const operator = population.criteria?.operator === 'OR' ? 'OR' : 'AND';
    const group: PredicateGroup = {
      operator: operator === 'OR' ? 'UNION' : 'INTERSECT',
      children: popPredicates,
    };

    // Map FHIR kebab-case and legacy underscore population types
    const popType = population.type;
    switch (popType) {
      case 'initial-population':
      case 'initial_population':
        populations.initialPopulation = group;
        break;
      case 'denominator':
        populations.denominator = group;
        break;
      case 'denominator-exclusion':
      case 'denominator_exclusion':
        populations.denominatorExclusion = group;
        break;
      case 'denominator-exception':
      case 'denominator_exception':
        populations.denominatorException = group;
        break;
      case 'numerator':
        populations.numerator = group;
        break;
      case 'numerator-exclusion':
      case 'numerator_exclusion':
        populations.numeratorExclusion = group;
        break;
    }
  }

  return {
    measureId: measure.metadata.measureId || 'unknown',
    config,
    predicates,
    populations,
  };
}

/**
 * Extract demographic predicate from global constraints
 */
function extractDemographicPredicate(
  constraints: NonNullable<UniversalMeasureSpec['globalConstraints']>,
  alias: string
): DemographicsPredicate | null {
  const hasConstraints = constraints.ageRange || constraints.gender;
  if (!hasConstraints) return null;

  const predicate: DemographicsPredicate = {
    type: 'demographics',
    alias,
    description: 'Global demographic constraints',
  };

  if (constraints.ageRange) {
    predicate.age = {
      min: constraints.ageRange.min,
      max: constraints.ageRange.max,
    };
  }

  if (constraints.gender && constraints.gender !== 'all') {
    const genderMap: Record<string, string[]> = {
      male: ['FHIR Male', 'FHIR Male Gender Identity'],
      female: ['FHIR Female', 'FHIR Female Gender Identity'],
    };
    predicate.gender = {
      include: genderMap[constraints.gender] || [],
    };
  }

  return predicate;
}

/**
 * Recursively extract predicates from LogicalClause (criteria tree)
 */
function extractFromLogicalClause(
  clause: LogicalClause,
  generateAlias: (prefix: string) => string,
  valueSets: ValueSetReference[]
): { predicates: DataModelPredicate[]; predicateAliases: string[] } {
  const predicates: DataModelPredicate[] = [];
  const predicateAliases: string[] = [];

  for (const child of clause.children) {
    if ('operator' in child && 'children' in child && !('type' in child)) {
      // Nested LogicalClause (has operator + children, but no DataElement 'type')
      const nested = extractFromLogicalClause(child as LogicalClause, generateAlias, valueSets);
      predicates.push(...nested.predicates);
      predicateAliases.push(...nested.predicateAliases);
    } else {
      // DataElement
      const element = child as DataElement;
      const pred = dataElementToPredicate(element, generateAlias, valueSets);
      if (pred) {
        predicates.push(pred);
        predicateAliases.push(pred.alias);
      }
    }
  }

  return { predicates, predicateAliases };
}

/**
 * Convert a UMS DataElement to an HDI SQL predicate
 */
function dataElementToPredicate(
  element: DataElement,
  generateAlias: (prefix: string) => string,
  valueSets: ValueSetReference[]
): DataModelPredicate | null {
  // Find value set if referenced
  const valueSet = element.valueSet?.id
    ? valueSets.find(vs => vs.id === element.valueSet?.id)
    : undefined;

  const valueSetOid = valueSet?.oid;
  const valueSetName = valueSet?.name || element.valueSet?.name;

  // Build codes object if we have value set info
  const codes = valueSetOid || valueSetName
    ? { valueSetOid, valueSetName }
    : undefined;

  switch (element.type) {
    // UMS uses 'diagnosis' which maps to HDI 'condition' data model
    case 'diagnosis':
      return {
        type: 'condition',
        alias: generateAlias('COND'),
        description: element.description || valueSetName,
        codes,
        timing: extractTimingFromElement(element),
      } as ConditionPredicate;

    case 'procedure':
      return {
        type: 'procedure',
        alias: generateAlias('PROC'),
        description: element.description || valueSetName,
        codes,
        timing: extractTimingFromElement(element),
      } as ProcedurePredicate;

    case 'medication':
      return {
        type: 'medication',
        alias: generateAlias('MED'),
        description: element.description || valueSetName,
        codes,
        timing: extractTimingFromElement(element),
      } as MedicationPredicate;

    case 'observation':
    case 'assessment':
      return {
        type: 'result',
        alias: generateAlias('RESULT'),
        description: element.description || valueSetName,
        codes,
        timing: extractTimingFromElement(element),
      } as ResultPredicate;

    case 'immunization':
      return {
        type: 'immunization',
        alias: generateAlias('IMMUN'),
        description: element.description || valueSetName,
        codes,
        timing: extractTimingFromElement(element),
      } as ImmunizationPredicate;

    case 'encounter':
      return {
        type: 'encounter',
        alias: generateAlias('ENC'),
        description: element.description || valueSetName || 'Encounter requirement',
        codes,
        timing: extractTimingFromElement(element),
      } as EncounterPredicate & { codes?: any; timing?: any };

    case 'demographic':
      return {
        type: 'demographics',
        alias: generateAlias('DEMOG'),
        description: element.description || 'Demographic constraint',
        age: element.thresholds ? {
          min: element.thresholds.ageMin,
          max: element.thresholds.ageMax,
        } : undefined,
      } as DemographicsPredicate;

    default:
      console.warn(`Unsupported data element type for HDI SQL: ${element.type}`);
      return null;
  }
}

/**
 * Extract timing requirements from a data element.
 * Detects both simple lookback timing (from current_date) and index-event-relative
 * timing (e.g., "within 60 days of IPSD", "105 days prior to index prescription").
 */
function extractTimingFromElement(element: DataElement): {
  lookbackYears?: number;
  lookbackDays?: number;
  indexEvent?: import('../types/hdiDataModels').IndexEventTiming;
} | undefined {
  if (!element.timingRequirements || element.timingRequirements.length === 0) {
    return undefined;
  }

  const timing: {
    lookbackYears?: number;
    lookbackDays?: number;
    indexEvent?: import('../types/hdiDataModels').IndexEventTiming;
  } = {};

  for (const req of element.timingRequirements) {
    const lowerDesc = req.description?.toLowerCase() || '';

    // Detect index-event-relative timing (IPSD, index prescription, index event)
    const isIndexRelative = /\b(ipsd|index\s*(prescription|event|date)|prior\s+to\s+ipsd|of\s+ipsd)\b/i.test(lowerDesc);

    if (isIndexRelative) {
      const dayMatch = lowerDesc.match(/(\d+)\s*day/);
      const days = dayMatch ? parseInt(dayMatch[1], 10) : undefined;
      const isBefore = /\b(prior|before)\b/.test(lowerDesc);
      const isAfter = /\b(after|following)\b/.test(lowerDesc);

      timing.indexEvent = {
        cteAlias: 'IPSD',
        dateColumn: 'index_prescription_start_date',
        daysBefore: (isBefore && days) ? days : (!isBefore && !isAfter && days) ? days : undefined,
        daysAfter: (isAfter && days) ? days : (!isBefore && !isAfter && days) ? days : undefined,
      };
      continue;
    }

    // Use the structured window if available
    if (req.window) {
      if (req.window.unit === 'years') {
        timing.lookbackYears = req.window.value;
      } else if (req.window.unit === 'days') {
        timing.lookbackDays = req.window.value;
      } else if (req.window.unit === 'months') {
        timing.lookbackDays = req.window.value * 30; // Approximate
      }
      continue;
    }

    // Fall back to parsing the description string

    // Detect year-based lookbacks
    const yearMatch = lowerDesc.match(/(\d+)\s*year/);
    if (yearMatch) {
      timing.lookbackYears = parseInt(yearMatch[1], 10);
    }

    // Detect day-based lookbacks
    const dayMatch = lowerDesc.match(/(\d+)\s*day/);
    if (dayMatch) {
      timing.lookbackDays = parseInt(dayMatch[1], 10);
    }

    // Detect month-based lookbacks
    const monthMatch = lowerDesc.match(/(\d+)\s*month/);
    if (monthMatch) {
      timing.lookbackDays = parseInt(monthMatch[1], 10) * 30;
    }
  }

  return Object.keys(timing).length > 0 ? timing : undefined;
}

// ============================================================================
// Predicate CTE Generation
// ============================================================================

/**
 * Generate CTE SQL for a predicate based on its type
 */
function generatePredicateCTE(
  predicate: DataModelPredicate,
  config: SQLGenerationConfig
): string {
  switch (predicate.type) {
    case 'demographics':
      return generateDemographicsPredicateCTE(predicate as DemographicsPredicate, config);
    case 'condition':
      return generateConditionPredicateCTE(predicate as ConditionPredicate, config);
    case 'result':
      return generateResultPredicateCTE(predicate as ResultPredicate, config);
    case 'procedure':
      return generateProcedurePredicateCTE(predicate as ProcedurePredicate, config);
    case 'medication':
      return generateMedicationPredicateCTE(predicate as MedicationPredicate, config);
    case 'immunization':
      return generateImmunizationPredicateCTE(predicate as ImmunizationPredicate, config);
    case 'encounter':
      return generateEncounterPredicateCTE(predicate as EncounterPredicate, config);
    default:
      throw new Error(`Unknown predicate type: ${(predicate as any).type}`);
  }
}

// ============================================================================
// Population Logic Generation
// ============================================================================

/**
 * Generate the final SQL that combines predicates into measure populations
 */
function generatePopulationLogic(
  mapping: MeasureSQLMapping,
  _config: SQLGenerationConfig
): string {
  const sections: string[] = [];

  // Initial Population
  if (mapping.populations.initialPopulation) {
    sections.push(generatePopulationSection(
      'INITIAL_POPULATION',
      mapping.populations.initialPopulation,
      'Initial Population: Patients meeting all baseline criteria'
    ));
  }

  const hasIP = !!mapping.populations.initialPopulation;

  // Denominator (typically same as IP or references IP)
  if (mapping.populations.denominator) {
    sections.push(generatePopulationSection(
      'DENOMINATOR',
      mapping.populations.denominator,
      'Denominator: Patients eligible for the measure',
      hasIP
    ));
  } else if (mapping.populations.initialPopulation) {
    // Default: denominator = initial population
    sections.push(`-- Denominator: Equals Initial Population
DENOMINATOR as (
  select empi_id from INITIAL_POPULATION
)`);
  }

  // Denominator Exclusions
  if (mapping.populations.denominatorExclusion) {
    sections.push(generatePopulationSection(
      'DENOM_EXCLUSION',
      mapping.populations.denominatorExclusion,
      'Denominator Exclusions: Patients to exclude from calculation'
    ));
  }

  // Denominator Exceptions
  if (mapping.populations.denominatorException) {
    sections.push(generatePopulationSection(
      'DENOM_EXCEPTION',
      mapping.populations.denominatorException,
      'Denominator Exceptions: Patients with valid exceptions'
    ));
  }

  // Numerator
  if (mapping.populations.numerator) {
    sections.push(generatePopulationSection(
      'NUMERATOR',
      mapping.populations.numerator,
      'Numerator: Patients meeting the measure criteria'
    ));
  }

  // Numerator Exclusions
  if (mapping.populations.numeratorExclusion) {
    sections.push(generatePopulationSection(
      'NUM_EXCLUSION',
      mapping.populations.numeratorExclusion,
      'Numerator Exclusions: Patients excluded from numerator'
    ));
  }

  // Additional numerators for multi-rate measures (e.g., AMM acute + continuation)
  if (mapping.additionalNumerators) {
    for (const addNum of mapping.additionalNumerators) {
      sections.push(generatePopulationSection(
        addNum.alias,
        addNum.group,
        `${addNum.label}`
      ));
    }
  }

  // Final calculation
  sections.push(generateFinalCalculation(mapping));

  return sections.join(',\n--\n');
}

/**
 * Generate SQL for a single population section
 */
function generatePopulationSection(
  alias: string,
  group: PredicateGroup,
  comment: string,
  hasInitialPopulation: boolean = false
): string {
  if (group.children.length === 0) {
    // If this is the DENOMINATOR and we have an INITIAL_POPULATION, reference it
    const fallbackSource = (alias === 'DENOMINATOR' && hasInitialPopulation)
      ? 'INITIAL_POPULATION'
      : 'DEMOG';
    return `-- ${comment}
${alias} as (
  select distinct empi_id from ${fallbackSource}
)`;
  }

  const setOp = group.operator === 'UNION' ? 'union' : 'intersect';
  const selects = group.children
    .filter((c): c is string => typeof c === 'string')
    .map(childAlias => `  select empi_id from ${childAlias}`);

  if (selects.length === 0) {
    const fallbackSource = (alias === 'DENOMINATOR' && hasInitialPopulation)
      ? 'INITIAL_POPULATION'
      : 'DEMOG';
    return `-- ${comment}
${alias} as (
  select distinct empi_id from ${fallbackSource}
)`;
  }

  if (selects.length === 1) {
    return `-- ${comment}
${alias} as (
${selects[0]}
)`;
  }

  return `-- ${comment}
${alias} as (
${selects.join(`\n  ${setOp}\n`)}
)`;
}

/**
 * Generate the final measure calculation SQL
 */
function generateFinalCalculation(mapping: MeasureSQLMapping): string {
  const hasExclusions = mapping.populations.denominatorExclusion &&
    (mapping.populations.denominatorExclusion.children.length > 0);
  const hasExceptions = mapping.populations.denominatorException &&
    (mapping.populations.denominatorException.children.length > 0);

  let sql = `-- Final Measure Calculation
MEASURE_RESULT as (
  select
    'Initial Population' as population_type
    , count(distinct empi_id) as patient_count
  from INITIAL_POPULATION
  union all
  select
    'Denominator' as population_type
    , count(distinct empi_id) as patient_count
  from DENOMINATOR`;

  if (hasExclusions) {
    sql += `
  union all
  select
    'Denominator Exclusion' as population_type
    , count(distinct empi_id) as patient_count
  from DENOM_EXCLUSION`;
  }

  if (hasExceptions) {
    sql += `
  union all
  select
    'Denominator Exception' as population_type
    , count(distinct empi_id) as patient_count
  from DENOM_EXCEPTION`;
  }

  if (mapping.populations.numerator) {
    sql += `
  union all
  select
    'Numerator' as population_type
    , count(distinct empi_id) as patient_count
  from NUMERATOR`;
  }

  // Additional numerators for multi-rate measures
  if (mapping.additionalNumerators) {
    for (const addNum of mapping.additionalNumerators) {
      sql += `
  union all
  select
    '${addNum.label}' as population_type
    , count(distinct empi_id) as patient_count
  from ${addNum.alias}`;
    }
  }

  sql += `
)
select * from MEASURE_RESULT`;

  return sql;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Derive which ONT contexts are actually needed based on data models used.
 * Avoids including unused contexts like Procedures or Results when the measure
 * doesn't reference them.
 */
function deriveOntologyContexts(dataModelsUsed: string[]): string[] {
  const contexts = new Set<string>();
  // Demographics is always needed (for gender, race, etc.)
  contexts.add('HEALTHE INTENT Demographics');

  const modelToContext: Record<string, string> = {
    encounter: 'HEALTHE INTENT Encounters',
    condition: 'HEALTHE INTENT Conditions',
    procedure: 'HEALTHE INTENT Procedures',
    result: 'HEALTHE INTENT Results',
    medication: 'HEALTHE INTENT Medications',
    immunization: 'HEALTHE INTENT Immunizations',
  };

  for (const model of dataModelsUsed) {
    if (modelToContext[model]) {
      contexts.add(modelToContext[model]);
    }
  }

  return [...contexts];
}

/**
 * Estimate query complexity based on predicates
 */
function estimateComplexity(mapping: MeasureSQLMapping): 'low' | 'medium' | 'high' {
  const predicateCount = mapping.predicates.length;
  const dataModelCount = new Set(mapping.predicates.map(p => p.type)).size;

  if (predicateCount <= 3 && dataModelCount <= 2) return 'low';
  if (predicateCount <= 8 && dataModelCount <= 4) return 'medium';
  return 'high';
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate generated SQL syntax (basic checks)
 */
export function validateHDISQLBasic(sql: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for balanced parentheses
  const openParens = (sql.match(/\(/g) || []).length;
  const closeParens = (sql.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
  }

  // Check for unclosed quotes
  const singleQuotes = (sql.match(/'/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    errors.push('Unclosed single quote detected');
  }

  // Check for required CTEs
  if (!sql.includes('ONT as')) {
    errors.push('Missing ONT (Ontology) CTE');
  }
  if (!sql.includes('DEMOG as')) {
    errors.push('Missing DEMOG (Demographics) CTE');
  }

  // Check for SELECT statement
  if (!/select\s+/i.test(sql)) {
    errors.push('No SELECT statement found');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format SQL for readability
 */
export function formatHDISQL(sql: string): string {
  let formatted = sql
    .replace(/\bselect\b/gi, '\nSELECT')
    .replace(/\bfrom\b/gi, '\nFROM')
    .replace(/\bwhere\b/gi, '\nWHERE')
    .replace(/\band\b/gi, '\n  AND')
    .replace(/\bor\b/gi, '\n  OR')
    .replace(/\bleft join\b/gi, '\nLEFT JOIN')
    .replace(/\binner join\b/gi, '\nINNER JOIN')
    .replace(/\bunion\b/gi, '\nUNION')
    .replace(/\bintersect\b/gi, '\nINTERSECT')
    .replace(/\bexcept\b/gi, '\nEXCEPT');

  return formatted.trim();
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Generate SQL with custom ontology contexts
 */
export function generateHDISQLWithContexts(
  measure: UniversalMeasureSpec,
  ontologyContexts: string[],
  populationId: string
): SQLGenerationResult {
  return generateHDISQL(measure, {
    ontologyContexts,
    populationId,
  });
}

/**
 * Generate SQL for a specific population only
 */
export function generatePopulationSQL(
  measure: UniversalMeasureSpec,
  populationType: 'initial-population' | 'denominator' | 'numerator',
  config: Partial<SQLGenerationConfig> = {}
): SQLGenerationResult {
  const filteredMeasure: UniversalMeasureSpec = {
    ...measure,
    populations: measure.populations.filter(p => p.type === populationType),
  };

  return generateHDISQL(filteredMeasure, config);
}
