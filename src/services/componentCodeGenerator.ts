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
