/**
 * Component Code Generator Service
 *
 * Generates code for individual UMS components (DataElements) in multiple formats:
 * - CQL (Clinical Quality Language)
 * - Synapse SQL (T-SQL compatible)
 *
 * Supports code overrides with mandatory notes that appear in generated output.
 */

import type { DataElement, LogicalClause } from '../types/ums';
import type {
  CodeOutputFormat,
  ComponentCodeResult,
  CodeOverride,
  CodeEditNote,
} from '../types/componentCode';
import { formatNoteForCodeComment } from '../types/componentCode';
import type {
  AtomicComponent,
  CompositeComponent,
  LibraryComponent,
  GeneratedComponentCode,
  TimingExpression,
} from '../types/componentLibrary';

// ============================================================================
// Generator Version
// ============================================================================

const GENERATOR_VERSION = '1.0.0';

// ============================================================================
// Lookback Period Configuration
// ============================================================================

const PROCEDURE_LOOKBACKS: Record<string, { years?: number; days?: number }> = {
  colonoscopy: { years: 10 },
  'flexible sigmoidoscopy': { years: 5 },
  sigmoidoscopy: { years: 5 },
  'ct colonography': { years: 5 },
  'fit-dna': { years: 3 },
  'fit dna': { years: 3 },
  cologuard: { years: 3 },
  fobt: { years: 1 },
  'fecal occult': { years: 1 },
  fit: { years: 1 },
  'fecal immunochemical': { years: 1 },
  'pap test': { years: 3 },
  'pap smear': { years: 3 },
  'hpv test': { years: 5 },
  mammography: { years: 2 },
  mammogram: { years: 2 },
};

function detectLookbackPeriod(description: string, valueSetName?: string): { years?: number; days?: number } | null {
  const searchText = `${description} ${valueSetName || ''}`.toLowerCase();

  for (const [keyword, lookback] of Object.entries(PROCEDURE_LOOKBACKS)) {
    if (searchText.includes(keyword)) {
      return lookback;
    }
  }

  return null;
}

// ============================================================================
// CQL Code Generation
// ============================================================================

function generateCQLForDataElement(
  element: DataElement,
  measurementPeriodRef: string = '"Measurement Period"'
): string {
  const vsName = element.valueSet?.name || element.description || 'Value Set';
  const vsRef = `"${vsName}"`;

  // Detect lookback period
  const lookback = detectLookbackPeriod(element.description, element.valueSet?.name);

  let timingClause = `during ${measurementPeriodRef}`;
  if (lookback?.years) {
    timingClause = `${lookback.years} years or less before end of ${measurementPeriodRef}`;
  } else if (lookback?.days) {
    timingClause = `${lookback.days} days or less before end of ${measurementPeriodRef}`;
  } else if (element.timingRequirements?.length) {
    const timing = element.timingRequirements[0];
    if (timing.window) {
      const unit = timing.window.unit;
      timingClause = `${timing.window.value} ${unit} or less ${timing.window.direction} end of ${measurementPeriodRef}`;
    }
  }

  switch (element.type) {
    case 'procedure':
      return `["Procedure": ${vsRef}] P where P.performed.toInterval() ends ${timingClause}`;

    case 'diagnosis':
      if (element.negation) {
        return `not exists ["Condition": ${vsRef}] C where C.prevalenceInterval() overlaps ${measurementPeriodRef}`;
      }
      return `exists ["Condition": ${vsRef}] C where C.prevalenceInterval() overlaps ${measurementPeriodRef}`;

    case 'encounter':
      return `["Encounter": ${vsRef}] E where E.period during ${measurementPeriodRef}`;

    case 'observation':
      return `["Observation": ${vsRef}] O where O.effective.toInterval() ${timingClause}`;

    case 'medication':
      return `["MedicationRequest": ${vsRef}] M where M.authoredOn during ${measurementPeriodRef}`;

    case 'immunization':
      return `["Immunization": ${vsRef}] I where I.occurrence.toInterval() ${timingClause}`;

    case 'assessment':
      return `["Observation": ${vsRef}] A where A.effective.toInterval() during ${measurementPeriodRef}`;

    case 'demographic':
      if (element.thresholds?.ageMin !== undefined || element.thresholds?.ageMax !== undefined) {
        const min = element.thresholds.ageMin ?? 0;
        const max = element.thresholds.ageMax ?? 150;
        return `AgeInYearsAt(date from end of ${measurementPeriodRef}) in Interval[${min}, ${max}]`;
      }
      return `// Demographic: ${element.description}`;

    default:
      return `// ${element.type}: ${element.description}`;
  }
}

function generateCQLForClause(
  clause: LogicalClause,
  indent: number = 0
): string {
  const indentStr = '  '.repeat(indent);
  const lines: string[] = [];

  const operator = clause.operator === 'OR' ? 'or' : 'and';

  clause.children.forEach((child, index) => {
    if ('operator' in child && 'children' in child) {
      // Nested clause
      const nestedClause = child as LogicalClause;
      lines.push(`${indentStr}(`);
      lines.push(generateCQLForClause(nestedClause, indent + 1));
      lines.push(`${indentStr})`);
    } else {
      // Data element
      const element = child as DataElement;
      const cql = generateCQLForDataElement(element);
      lines.push(`${indentStr}${cql}`);
    }

    if (index < clause.children.length - 1) {
      lines.push(`${indentStr}  ${operator}`);
    }
  });

  return lines.join('\n');
}

// ============================================================================
// SQL Code Generation (Synapse SQL / T-SQL)
// ============================================================================

function generateSynapseSQLForDataElement(
  element: DataElement,
  populationId: string = '${POPULATION_ID}'
): string {
  const vsName = element.valueSet?.name || element.description || 'ValueSet';
  const vsOid = element.valueSet?.oid || 'UNKNOWN_OID';
  const alias = element.type.toUpperCase().substring(0, 4);

  const lookback = detectLookbackPeriod(element.description, element.valueSet?.name);

  // T-SQL/Synapse uses DATEADD function
  let dateClause = '';
  if (lookback?.years) {
    dateClause = `AND ${alias}.effective_date >= DATEADD(YEAR, -${lookback.years}, GETDATE())`;
  } else if (lookback?.days) {
    dateClause = `AND ${alias}.effective_date >= DATEADD(DAY, -${lookback.days}, GETDATE())`;
  }

  switch (element.type) {
    case 'procedure':
      return `-- ${vsName}
SELECT DISTINCT ${alias}.empi_id
FROM ph_f_procedure ${alias}
WHERE ${alias}.population_id = '${populationId}'
  AND EXISTS (
    SELECT 1 FROM valueset_codes VS
    WHERE VS.valueset_oid = '${vsOid}'
      AND VS.code = ${alias}.procedure_code
  )
  ${dateClause ? dateClause.replace('effective_date', 'performed_date') : ''}`;

    case 'diagnosis':
      return `-- ${vsName}
SELECT DISTINCT ${alias}.empi_id
FROM ph_f_condition ${alias}
WHERE ${alias}.population_id = '${populationId}'
  AND ${element.negation ? 'NOT ' : ''}EXISTS (
    SELECT 1 FROM valueset_codes VS
    WHERE VS.valueset_oid = '${vsOid}'
      AND VS.code = ${alias}.condition_code
  )
  ${dateClause}`;

    case 'encounter':
      return `-- ${vsName}
SELECT DISTINCT ${alias}.empi_id
FROM ph_f_encounter ${alias}
WHERE ${alias}.population_id = '${populationId}'
  AND EXISTS (
    SELECT 1 FROM valueset_codes VS
    WHERE VS.valueset_oid = '${vsOid}'
      AND VS.code = ${alias}.encounter_type_code
  )`;

    case 'observation':
      return `-- ${vsName}
SELECT DISTINCT ${alias}.empi_id
FROM ph_f_result ${alias}
WHERE ${alias}.population_id = '${populationId}'
  AND EXISTS (
    SELECT 1 FROM valueset_codes VS
    WHERE VS.valueset_oid = '${vsOid}'
      AND VS.code = ${alias}.result_code
  )
  ${dateClause ? dateClause.replace('effective_date', 'service_date') : ''}`;

    case 'demographic':
      if (element.thresholds?.ageMin !== undefined || element.thresholds?.ageMax !== undefined) {
        const min = element.thresholds.ageMin ?? 0;
        const max = element.thresholds.ageMax ?? 150;
        return `-- Age ${min}-${max}
SELECT DISTINCT empi_id
FROM DEMOG
WHERE age_in_years >= ${min}
  AND age_in_years <= ${max}`;
      }
      return `-- Demographic: ${element.description}`;

    default:
      return `-- ${element.type}: ${element.description}`;
  }
}

// ============================================================================
// Main Generation Functions
// ============================================================================

/**
 * Generate code for a single DataElement in the specified format
 */
export function generateComponentCode(
  element: DataElement,
  format: CodeOutputFormat,
  override?: CodeOverride,
  populationId?: string
): ComponentCodeResult {
  const warnings: string[] = [];

  // Check for zero codes
  const codeCount = (element.valueSet?.codes?.length ?? 0) + (element.directCodes?.length ?? 0);
  if (codeCount === 0 && element.type !== 'demographic') {
    warnings.push('Component has no codes defined');
  }

  // If override exists and is locked, use it
  if (override?.isLocked) {
    const noteComments = override.notes
      .map(note => formatNoteForCodeComment(note, format))
      .join('\n');

    const codeWithNotes = noteComments
      ? `${noteComments}\n${override.code}`
      : override.code;

    return {
      componentId: element.id,
      code: codeWithNotes,
      isOverridden: true,
      notes: override.notes,
      warnings,
    };
  }

  // Generate code based on format
  let code: string;
  switch (format) {
    case 'cql':
      code = generateCQLForDataElement(element);
      break;
    case 'synapse-sql':
      code = generateSynapseSQLForDataElement(element, populationId);
      break;
    default:
      code = `// Unsupported format: ${format}`;
      warnings.push(`Unsupported code format: ${format}`);
  }

  return {
    componentId: element.id,
    code,
    isOverridden: false,
    notes: [],
    warnings,
  };
}

/**
 * Generate code for a LogicalClause (group of elements) in CQL format
 */
export function generateClauseCode(
  clause: LogicalClause,
  format: CodeOutputFormat,
  overrides?: Map<string, CodeOverride>,
  populationId?: string
): string {
  if (format === 'cql') {
    return generateCQLForClause(clause);
  }

  // For SQL, generate each component and combine with set operations
  const setOperator = clause.operator === 'OR' ? 'UNION' : 'INTERSECT';

  const componentSQLs = clause.children.map(child => {
    if ('operator' in child && 'children' in child) {
      return `(\n${generateClauseCode(child as LogicalClause, format, overrides, populationId)}\n)`;
    } else {
      const element = child as DataElement;
      const override = overrides?.get(element.id);
      const result = generateComponentCode(element, format, override, populationId);
      return result.code;
    }
  });

  return componentSQLs.join(`\n${setOperator}\n`);
}

/**
 * Generate a definition name for CQL from element description
 */
export function generateCQLDefinitionName(description: string): string {
  return description
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Generate a CTE alias for SQL from element description
 */
export function generateSQLAlias(description: string, index: number): string {
  const prefix = description
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .substring(0, 6);

  return `PRED_${prefix}_${index}`;
}

// ============================================================================
// Library Component Code Generation
// ============================================================================

// Map component categories to FHIR resource types
const CATEGORY_TO_RESOURCE: Record<string, string> = {
  encounters: 'Encounter',
  conditions: 'Condition',
  procedures: 'Procedure',
  medications: 'MedicationRequest',
  laboratory: 'Observation',
  assessments: 'Observation',
  'clinical-observations': 'Observation',
  immunizations: 'Immunization',
};

// Map resource types to timing attributes
const RESOURCE_TIMING_ATTR: Record<string, string> = {
  Encounter: 'period',
  Condition: 'onset',
  Procedure: 'performed',
  MedicationRequest: 'authoredOn',
  Observation: 'effective',
  Immunization: 'occurrence',
  DiagnosticReport: 'effective',
};

/**
 * Result of generating code for a library component
 */
export interface LibraryComponentCodeResult {
  cql: string;
  sql: string;
  success: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Generate code for any library component (atomic or composite)
 */
export function generateLibraryComponentCode(
  component: LibraryComponent,
  allComponents?: LibraryComponent[]
): LibraryComponentCodeResult {
  if (component.type === 'atomic') {
    return generateAtomicComponentCode(component);
  } else {
    return generateCompositeComponentCode(component, allComponents || []);
  }
}

/**
 * Generate CQL and SQL for an atomic component
 */
export function generateAtomicComponentCode(component: AtomicComponent): LibraryComponentCodeResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Handle demographic components (age, gender)
    if (component.resourceType === 'Patient' || component.metadata?.category === 'demographics') {
      return generateDemographicComponentCode(component);
    }

    // Determine resource type from category or resourceType field
    const resourceType = getComponentResourceType(component);
    if (!resourceType) {
      errors.push(`Cannot determine resource type for component: ${component.name}`);
      return {
        cql: `// ERROR: Unknown resource type for ${component.name}`,
        sql: `-- ERROR: Unknown resource type for ${component.name}`,
        success: false,
        errors,
      };
    }

    // Get value set info
    const valueSetName = component.valueSet?.name || 'Unspecified Value Set';
    const valueSetOid = component.valueSet?.oid;

    if (!valueSetOid && !component.valueSet?.name) {
      warnings.push(`No value set defined for ${component.name}`);
    }

    // Generate CQL
    const cql = generateAtomicComponentCQL(component, resourceType, valueSetName);

    // Generate SQL
    const sql = generateAtomicComponentSQL(component, resourceType, valueSetOid, valueSetName);

    return {
      cql,
      sql,
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err) {
    return {
      cql: `// ERROR: ${err instanceof Error ? err.message : 'Unknown error'}`,
      sql: `-- ERROR: ${err instanceof Error ? err.message : 'Unknown error'}`,
      success: false,
      errors: [err instanceof Error ? err.message : 'Unknown error'],
    };
  }
}

/**
 * Generate CQL and SQL for a composite component
 */
export function generateCompositeComponentCode(
  component: CompositeComponent,
  allComponents: LibraryComponent[]
): LibraryComponentCodeResult {
  const warnings: string[] = [];

  try {
    // Get child components
    const childCodes: { cql: string; sql: string }[] = [];

    for (const childRef of component.children) {
      const child = allComponents.find(c => c.id === childRef.componentId);
      if (!child) {
        warnings.push(`Child component not found: ${childRef.displayName}`);
        childCodes.push({
          cql: `/* MISSING: ${childRef.displayName} */\n  true`,
          sql: `-- MISSING: ${childRef.displayName}`,
        });
        continue;
      }

      // Recursively generate code for children
      const childResult = generateLibraryComponentCode(child, allComponents);
      if (childResult.warnings) {
        warnings.push(...childResult.warnings);
      }
      childCodes.push({
        cql: childResult.cql,
        sql: childResult.sql,
      });
    }

    // Combine with operator
    const cqlOperator = component.operator === 'OR' ? 'or' : 'and';
    const sqlOperator = component.operator === 'OR' ? 'UNION' : 'INTERSECT';

    // CQL: combine expressions
    const cqlExpressions = childCodes.map(c => `(${c.cql})`);
    const cql = cqlExpressions.join(`\n  ${cqlOperator} `);

    // SQL: combine with set operations
    const sqlParts = childCodes.map((c, i) => {
      return `-- Child: ${component.children[i]?.displayName || `Component ${i + 1}`}\n${c.sql}`;
    });
    const sql = sqlParts.join(`\n${sqlOperator}\n`);

    return {
      cql,
      sql,
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err) {
    return {
      cql: `// ERROR: ${err instanceof Error ? err.message : 'Unknown error'}`,
      sql: `-- ERROR: ${err instanceof Error ? err.message : 'Unknown error'}`,
      success: false,
      errors: [err instanceof Error ? err.message : 'Unknown error'],
    };
  }
}

/**
 * Generate CQL for an atomic component
 */
function generateAtomicComponentCQL(
  component: AtomicComponent,
  resourceType: string,
  valueSetName: string
): string {
  const alias = resourceType.charAt(0); // E for Encounter, P for Procedure, etc.
  const timing = generateComponentCQLTiming(component.timing, alias, resourceType);
  const vsRef = `"${valueSetName}"`;

  // Build the exists query
  let query: string;
  if (resourceType === 'Observation') {
    query = `exists ([${resourceType}: ${vsRef}] ${alias}
    where ${alias}.value is not null
      and ${timing})`;
  } else {
    query = `exists ([${resourceType}: ${vsRef}] ${alias}
    where ${timing})`;
  }

  // Apply negation if needed
  if (component.negation) {
    return `not ${query}`;
  }

  return query;
}

/**
 * Generate CQL timing expression for a component
 */
function generateComponentCQLTiming(
  timing: TimingExpression | undefined,
  alias: string,
  resourceType: string
): string {
  const timingAttr = RESOURCE_TIMING_ATTR[resourceType] || 'performed';
  const attr = `${alias}.${timingAttr}`;

  if (!timing) {
    return `${attr} during "Measurement Period"`;
  }

  const { operator, quantity, unit, reference } = timing;

  // Handle "within X years/days before end of MP" patterns
  if (operator === 'within' && quantity && unit) {
    const unitStr = quantity === 1 ? unit.replace(/s$/, '') : unit;
    return `${attr} ends ${quantity} ${unitStr} or less before end of "Measurement Period"`;
  }

  // Handle "during" operator
  if (operator === 'during') {
    if (reference === 'Measurement Period') {
      return `${attr} during "Measurement Period"`;
    }
    return `${attr} during "${reference}"`;
  }

  // Handle other operators
  switch (operator) {
    case 'before':
      return `${attr} ends before end of "Measurement Period"`;
    case 'after':
      return `${attr} starts after start of "Measurement Period"`;
    case 'starts during':
      return `${attr} starts during "Measurement Period"`;
    case 'ends during':
      return `${attr} ends during "Measurement Period"`;
    default:
      return `${attr} during "Measurement Period"`;
  }
}

/**
 * Generate code for demographic components
 */
function generateDemographicComponentCode(component: AtomicComponent): LibraryComponentCodeResult {
  // Handle gender check
  if (component.genderValue) {
    const cql = `Patient.gender = '${component.genderValue}'`;
    const sql = `-- Gender check: ${component.genderValue}\nSELECT patient_id FROM DEMOG WHERE gender = '${component.genderValue.toUpperCase()}'`;
    return { cql, sql, success: true };
  }

  // Default demographic placeholder
  const cql = '"Patient Age Valid"';
  const sql = `-- Demographic: ${component.name}\nSELECT patient_id FROM DEMOG`;
  return { cql, sql, success: true };
}

/**
 * Generate SQL for an atomic component
 */
function generateAtomicComponentSQL(
  component: AtomicComponent,
  resourceType: string,
  valueSetOid: string | undefined,
  valueSetName: string
): string {
  const dataModel = getDataModelFromResource(resourceType);
  const alias = component.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const tableName = getSQLTableName(dataModel);
  const timingClause = generateComponentSQLTiming(component.timing, dataModel);

  // Build CTE with ontology join
  const lines: string[] = [
    `-- Component: ${component.name}`,
    `-- Value Set: ${valueSetName}${valueSetOid ? ` (${valueSetOid})` : ''}`,
    `${alias} AS (`,
    `  SELECT DISTINCT dm.patient_id`,
    `  FROM ${tableName} dm`,
    `  INNER JOIN ONT ont ON dm.code = ont.code AND dm.code_system = ont.code_system`,
    `  WHERE ont.concept_set_name = '${escapeSQLString(valueSetName)}'`,
  ];

  if (timingClause) {
    lines.push(`    AND ${timingClause}`);
  }

  // Add status check
  const statusCheck = getSQLStatusCheck(dataModel);
  if (statusCheck) {
    lines.push(`    AND ${statusCheck}`);
  }

  lines.push(')');

  const cteSql = lines.join('\n');

  // If negated, wrap in EXCEPT
  if (component.negation) {
    return `-- NEGATED: Patients WITHOUT ${component.name}\nSELECT patient_id FROM DEMOG\nEXCEPT\nSELECT patient_id FROM ${alias}`;
  }

  return cteSql;
}

/**
 * Generate SQL timing clause for a component
 */
function generateComponentSQLTiming(timing: TimingExpression | undefined, dataModel: string): string | null {
  const dateColumn = getSQLDateColumn(dataModel);
  if (!dateColumn) return null;

  if (!timing) {
    return `${dateColumn} >= @MP_START AND ${dateColumn} <= @MP_END`;
  }

  const { operator, quantity, unit } = timing;

  if (operator === 'within' && quantity && unit) {
    const interval = convertToSQLInterval(quantity, unit);
    return `${dateColumn} >= DATEADD(${interval.unit}, -${interval.value}, @MP_END) AND ${dateColumn} <= @MP_END`;
  }

  if (operator === 'during') {
    return `${dateColumn} >= @MP_START AND ${dateColumn} <= @MP_END`;
  }

  // Default to measurement period
  return `${dateColumn} >= @MP_START AND ${dateColumn} <= @MP_END`;
}

/**
 * Get data model name from FHIR resource type
 */
function getDataModelFromResource(resourceType: string): string {
  const models: Record<string, string> = {
    Encounter: 'ENCOUNTER',
    Condition: 'CONDITION',
    Procedure: 'PROCEDURE',
    MedicationRequest: 'MEDICATION',
    Observation: 'RESULT',
    Immunization: 'IMMUNIZATION',
    DiagnosticReport: 'RESULT',
  };
  return models[resourceType] || 'RESULT';
}

/**
 * Get table name for data model
 */
function getSQLTableName(dataModel: string): string {
  const tables: Record<string, string> = {
    ENCOUNTER: 'FACT_ENCOUNTER',
    CONDITION: 'FACT_CONDITION',
    PROCEDURE: 'FACT_PROCEDURE',
    MEDICATION: 'FACT_MEDICATION',
    RESULT: 'FACT_RESULT',
    IMMUNIZATION: 'FACT_IMMUNIZATION',
  };
  return tables[dataModel] || 'FACT_CLINICAL';
}

/**
 * Get date column for data model
 */
function getSQLDateColumn(dataModel: string): string {
  const columns: Record<string, string> = {
    ENCOUNTER: 'encounter_start_date',
    CONDITION: 'onset_date',
    PROCEDURE: 'procedure_date',
    MEDICATION: 'order_date',
    RESULT: 'result_date',
    IMMUNIZATION: 'administration_date',
  };
  return columns[dataModel] || 'event_date';
}

/**
 * Get status check for data model
 */
function getSQLStatusCheck(dataModel: string): string | null {
  const checks: Record<string, string> = {
    ENCOUNTER: "status = 'completed'",
    CONDITION: "clinical_status = 'active'",
    PROCEDURE: "status = 'completed'",
    MEDICATION: "status IN ('active', 'completed')",
    RESULT: "status IN ('final', 'amended')",
    IMMUNIZATION: "status = 'completed'",
  };
  return checks[dataModel] || null;
}

/**
 * Convert timing units to SQL interval
 */
function convertToSQLInterval(quantity: number, unit: string): { value: number; unit: string } {
  const unitMap: Record<string, string> = {
    years: 'YEAR',
    year: 'YEAR',
    months: 'MONTH',
    month: 'MONTH',
    days: 'DAY',
    day: 'DAY',
    hours: 'HOUR',
    hour: 'HOUR',
  };
  return {
    value: quantity,
    unit: unitMap[unit.toLowerCase()] || 'DAY',
  };
}

/**
 * Escape string for SQL
 */
function escapeSQLString(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Determine the FHIR resource type for a component
 */
function getComponentResourceType(component: AtomicComponent): string | null {
  // First check explicit resourceType
  if (component.resourceType) {
    return component.resourceType as string;
  }

  // Then check category
  const category = component.metadata?.category;
  if (category && CATEGORY_TO_RESOURCE[category]) {
    return CATEGORY_TO_RESOURCE[category];
  }

  // Infer from value set name patterns
  const vsName = component.valueSet?.name?.toLowerCase() || '';
  if (vsName.includes('encounter') || vsName.includes('visit')) return 'Encounter';
  if (vsName.includes('diagnosis') || vsName.includes('condition')) return 'Condition';
  if (vsName.includes('procedure') || vsName.includes('surgery')) return 'Procedure';
  if (vsName.includes('medication') || vsName.includes('drug')) return 'MedicationRequest';
  if (vsName.includes('lab') || vsName.includes('test') || vsName.includes('result')) return 'Observation';
  if (vsName.includes('immunization') || vsName.includes('vaccine')) return 'Immunization';

  return null;
}

// ============================================================================
// GeneratedComponentCode Creation
// ============================================================================

/**
 * Create a GeneratedComponentCode object from generation result
 */
export function createGeneratedCode(result: LibraryComponentCodeResult): GeneratedComponentCode {
  return {
    cql: result.cql,
    sql: result.sql,
    generatedAt: new Date().toISOString(),
    generatorVersion: GENERATOR_VERSION,
  };
}

/**
 * Generate code for a component and return as GeneratedComponentCode
 * This is the main entry point for auto-generating code on component creation
 */
export function generateAndPackageCode(
  component: LibraryComponent,
  allComponents?: LibraryComponent[]
): GeneratedComponentCode {
  const result = generateLibraryComponentCode(component, allComponents);
  return createGeneratedCode(result);
}
