/**
 * CQL Template System
 *
 * Provides validated, composable CQL templates with type safety.
 * Replaces error-prone string concatenation with tested patterns.
 *
 * Key features:
 * - Type-safe template parameters
 * - Built-in identifier escaping
 * - Validated CQL syntax patterns
 * - Composable building blocks
 */

// ============================================================================
// Types
// ============================================================================

export interface CQLIdentifier {
  raw: string;
  escaped: string;
}

export interface CQLInterval {
  start: string;
  end: string;
  type: 'DateTime' | 'Date' | 'Integer' | 'Decimal';
}

export interface CQLTimingWindow {
  value: number;
  unit: 'year' | 'years' | 'month' | 'months' | 'day' | 'days' | 'week' | 'weeks';
  direction: 'before' | 'after';
  reference: 'start' | 'end';
  period: string;
}

export type CQLOperator = 'and' | 'or';

export interface CQLResourceQuery {
  resourceType: CQLResourceType;
  valueSet: string;
  alias: string;
  statusCheck?: string;
  timingExpression?: string;
  additionalCriteria?: string[];
}

export type CQLResourceType =
  | 'Condition'
  | 'Encounter'
  | 'Procedure'
  | 'Observation'
  | 'MedicationRequest'
  | 'MedicationAdministration'
  | 'Immunization'
  | 'DiagnosticReport'
  | 'ServiceRequest'
  | 'CarePlan'
  | 'Goal'
  | 'AllergyIntolerance'
  | 'FamilyMemberHistory';

export interface CQLDefinition {
  name: string;
  expression: string;
  comment?: string;
}

export interface CQLLibraryHeader {
  name: string;
  version: string;
  fhirVersion: string;
  includes: CQLInclude[];
  codeSystems: CQLCodeSystem[];
  parameters: CQLParameter[];
}

export interface CQLInclude {
  library: string;
  version: string;
  alias: string;
}

export interface CQLCodeSystem {
  name: string;
  uri: string;
}

export interface CQLParameter {
  name: string;
  type: string;
  default?: string;
}

export interface CQLValueSetDeclaration {
  name: string;
  url: string;
  warning?: string;
}

// ============================================================================
// Identifier Escaping and Validation
// ============================================================================

/**
 * Escape a string for use as a CQL identifier (within double quotes)
 * CQL identifiers in quotes need escaped backslashes and quotes
 */
export function escapeIdentifier(name: string): CQLIdentifier {
  if (!name || typeof name !== 'string') {
    throw new CQLTemplateError('Identifier cannot be empty or non-string');
  }

  const escaped = name
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/"/g, '\\"')     // Escape double quotes
    .trim();

  return {
    raw: name,
    escaped,
  };
}

/**
 * Escape a string for use in a CQL string literal (within single quotes)
 */
export function escapeStringLiteral(value: string): string {
  if (typeof value !== 'string') {
    throw new CQLTemplateError('String literal must be a string');
  }

  return value
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/'/g, "\\'");    // Escape single quotes
}

/**
 * Validate a CQL library name (must be valid identifier)
 */
export function validateLibraryName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new CQLTemplateError('Library name cannot be empty');
  }

  // CQL library names must start with letter or underscore
  // and contain only alphanumeric characters and underscores
  const sanitized = name
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/^(\d)/, '_$1');

  if (!sanitized) {
    throw new CQLTemplateError(`Invalid library name: ${name}`);
  }

  return sanitized;
}

/**
 * Validate a version string (semver-like)
 */
export function validateVersion(version: string): string {
  if (!version || typeof version !== 'string') {
    return '1.0.0';
  }

  // Allow formats like "1.0.0", "1.0", "1"
  const match = version.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!match) {
    throw new CQLTemplateError(`Invalid version format: ${version}`);
  }

  return version;
}

// ============================================================================
// Template Functions - Building Blocks
// ============================================================================

/**
 * Generate a CQL interval expression
 */
export function intervalTemplate(interval: CQLInterval): string {
  const { start, end, type } = interval;

  switch (type) {
    case 'DateTime':
      return `Interval[@${start}T00:00:00.0, @${end}T23:59:59.999]`;
    case 'Date':
      return `Interval[@${start}, @${end}]`;
    case 'Integer':
    case 'Decimal':
      return `Interval[${start}, ${end}]`;
    default:
      throw new CQLTemplateError(`Unknown interval type: ${type}`);
  }
}

/**
 * Generate a timing expression (e.g., "ends 10 years or less before end of")
 */
export function timingTemplate(timing: CQLTimingWindow): string {
  const { value, unit, direction, reference, period } = timing;

  // Normalize unit (singular if value is 1)
  const normalizedUnit = value === 1 ? unit.replace(/s$/, '') : unit;

  const verb = direction === 'before' ? 'ends' : 'starts';
  const prep = direction === 'before' ? 'before' : 'after';
  const ref = reference === 'start' ? 'start' : 'end';

  return `${verb} ${value} ${normalizedUnit} or less ${prep} ${ref} of "${escapeIdentifier(period).escaped}"`;
}

/**
 * Generate a measurement period timing check
 */
export function duringMeasurementPeriodTemplate(
  attribute: 'performed' | 'effective' | 'period' | 'onset' | 'occurrence' = 'performed'
): string {
  return `and ${attribute} during "Measurement Period"`;
}

/**
 * Generate a status check expression for a resource type
 */
export function statusCheckTemplate(
  resourceType: CQLResourceType,
  alias: string
): string {
  const checks: Record<CQLResourceType, string> = {
    Condition: `${alias}.clinicalStatus ~ QICoreCommon."active"`,
    Encounter: `${alias}.status = 'finished'`,
    Procedure: `${alias}.status = 'completed'`,
    Observation: `${alias}.status in { 'final', 'amended', 'corrected' }`,
    MedicationRequest: `${alias}.status in { 'active', 'completed' }`,
    MedicationAdministration: `${alias}.status = 'completed'`,
    Immunization: `${alias}.status = 'completed'`,
    DiagnosticReport: `${alias}.status in { 'final', 'amended', 'corrected' }`,
    ServiceRequest: `${alias}.status in { 'active', 'completed' }`,
    CarePlan: `${alias}.status in { 'active', 'completed' }`,
    Goal: `${alias}.lifecycleStatus in { 'active', 'completed' }`,
    AllergyIntolerance: `${alias}.clinicalStatus ~ QICoreCommon."active"`,
    FamilyMemberHistory: `${alias}.status = 'completed'`,
  };

  return checks[resourceType] || `${alias}.status = 'completed'`;
}

// ============================================================================
// Template Functions - Resource Queries
// ============================================================================

/**
 * Generate a FHIR resource query with value set
 */
export function resourceQueryTemplate(query: CQLResourceQuery): string {
  const { resourceType, valueSet, alias, statusCheck, timingExpression, additionalCriteria } = query;

  const vsId = escapeIdentifier(valueSet);
  const aliasId = escapeIdentifier(alias);

  const parts: string[] = [
    `[${resourceType}: "${vsId.escaped}"] ${aliasId.escaped}`,
  ];

  const whereClauses: string[] = [];

  // Add status check
  if (statusCheck !== undefined) {
    whereClauses.push(statusCheck);
  } else {
    whereClauses.push(statusCheckTemplate(resourceType, aliasId.escaped));
  }

  // Add timing expression
  if (timingExpression) {
    whereClauses.push(timingExpression);
  }

  // Add additional criteria
  if (additionalCriteria && additionalCriteria.length > 0) {
    whereClauses.push(...additionalCriteria);
  }

  if (whereClauses.length > 0) {
    parts.push(`  where ${whereClauses.join('\n    and ')}`);
  }

  return parts.join('\n');
}

/**
 * Generate an exists expression for a resource query
 */
export function existsQueryTemplate(query: CQLResourceQuery): string {
  return `exists (${resourceQueryTemplate(query)})`;
}

/**
 * Generate a union of resource queries
 */
export function unionQueriesTemplate(queries: CQLResourceQuery[]): string {
  if (queries.length === 0) {
    throw new CQLTemplateError('Union requires at least one query');
  }

  if (queries.length === 1) {
    return resourceQueryTemplate(queries[0]);
  }

  const parts = queries.map(q => `(${resourceQueryTemplate(q)})`);
  return parts.join('\n  union ');
}

// ============================================================================
// Template Functions - Definitions
// ============================================================================

/**
 * Generate a CQL define statement
 */
export function defineTemplate(def: CQLDefinition): string {
  const nameId = escapeIdentifier(def.name);
  const lines: string[] = [];

  if (def.comment) {
    lines.push(`/*`);
    lines.push(` * ${def.comment}`);
    lines.push(` */`);
  }

  lines.push(`define "${nameId.escaped}":`);
  lines.push(`  ${def.expression}`);

  return lines.join('\n');
}

/**
 * Generate a boolean combination of expressions
 */
export function combineExpressionsTemplate(
  expressions: string[],
  operator: CQLOperator,
  indent: number = 0
): string {
  if (expressions.length === 0) {
    return 'true';
  }

  if (expressions.length === 1) {
    return expressions[0];
  }

  const indentStr = '  '.repeat(indent);
  const sep = operator === 'or' ? `\n${indentStr}  or ` : `\n${indentStr}  and `;

  return expressions.join(sep);
}

// ============================================================================
// Template Functions - Library Structure
// ============================================================================

/**
 * Generate CQL library header
 */
export function libraryHeaderTemplate(header: CQLLibraryHeader): string {
  const lines: string[] = [];

  // Library declaration
  lines.push(`library ${validateLibraryName(header.name)} version '${validateVersion(header.version)}'`);
  lines.push('');

  // FHIR using declaration
  lines.push(`using FHIR version '${header.fhirVersion}'`);
  lines.push('');

  // Includes
  if (header.includes.length > 0) {
    for (const inc of header.includes) {
      lines.push(`include ${inc.library} version '${inc.version}' called ${inc.alias}`);
    }
    lines.push('');
  }

  // Code systems
  if (header.codeSystems.length > 0) {
    lines.push('// Code Systems');
    for (const cs of header.codeSystems) {
      const csName = escapeIdentifier(cs.name);
      lines.push(`codesystem "${csName.escaped}": '${escapeStringLiteral(cs.uri)}'`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate value set declarations
 */
export function valueSetDeclarationsTemplate(valueSets: CQLValueSetDeclaration[]): string {
  if (valueSets.length === 0) {
    return '// No value sets defined\n';
  }

  const lines: string[] = ['// Value Sets'];

  for (const vs of valueSets) {
    const vsName = escapeIdentifier(vs.name);
    lines.push(`valueset "${vsName.escaped}": '${escapeStringLiteral(vs.url)}'`);

    if (vs.warning) {
      lines.push(`  /* WARNING: ${vs.warning} */`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Generate parameter declarations
 */
export function parametersTemplate(params: CQLParameter[]): string {
  if (params.length === 0) {
    return '';
  }

  const lines: string[] = ['// Parameters'];

  for (const param of params) {
    const paramName = escapeIdentifier(param.name);
    if (param.default) {
      lines.push(`parameter "${paramName.escaped}" ${param.type}`);
      lines.push(`  default ${param.default}`);
    } else {
      lines.push(`parameter "${paramName.escaped}" ${param.type}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

// ============================================================================
// Pre-built Templates for Common Patterns
// ============================================================================

/**
 * Standard eCQM includes (QI-Core, FHIRHelpers, etc.)
 */
export const STANDARD_INCLUDES: CQLInclude[] = [
  { library: 'FHIRHelpers', version: '4.0.1', alias: 'FHIRHelpers' },
  { library: 'QICoreCommon', version: '2.0.0', alias: 'QICoreCommon' },
  { library: 'MATGlobalCommonFunctions', version: '7.0.000', alias: 'Global' },
  { library: 'SupplementalDataElements', version: '3.4.000', alias: 'SDE' },
  { library: 'Hospice', version: '6.9.000', alias: 'Hospice' },
];

/**
 * Standard code systems for eCQM
 */
export const STANDARD_CODE_SYSTEMS: CQLCodeSystem[] = [
  { name: 'LOINC', uri: 'http://loinc.org' },
  { name: 'SNOMEDCT', uri: 'http://snomed.info/sct' },
  { name: 'ICD10CM', uri: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { name: 'CPT', uri: 'http://www.ama-assn.org/go/cpt' },
  { name: 'HCPCS', uri: 'https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets' },
  { name: 'RxNorm', uri: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
  { name: 'CVX', uri: 'http://hl7.org/fhir/sid/cvx' },
];

/**
 * Age at end of measurement period template
 */
export function ageAtEndOfMPTemplate(): CQLDefinition {
  return {
    name: 'Age at End of Measurement Period',
    expression: 'AgeInYearsAt(date from end of "Measurement Period")',
    comment: 'Patient age calculated at the end of the measurement period',
  };
}

/**
 * Age range check template
 */
export function ageRangeCheckTemplate(min: number, max: number): CQLDefinition {
  return {
    name: 'Patient Age Valid',
    expression: `"Age at End of Measurement Period" in Interval[${min}, ${max}]`,
    comment: `Patient age must be between ${min} and ${max} years`,
  };
}

/**
 * Gender check template
 */
export function genderCheckTemplate(gender: 'male' | 'female'): CQLDefinition {
  return {
    name: 'Patient Gender Valid',
    expression: `Patient.gender = '${gender}'`,
    comment: `Patient gender must be ${gender}`,
  };
}

/**
 * Hospice services check template
 */
export function hospiceCheckTemplate(): CQLDefinition {
  return {
    name: 'Has Hospice Services',
    expression: 'Hospice."Has Hospice Services"',
    comment: 'Check for hospice services using standard Hospice library',
  };
}

/**
 * Supplemental data elements template
 */
export function supplementalDataTemplate(): string {
  return `
// Supplemental Data Elements
define "SDE Ethnicity":
  SDE."SDE Ethnicity"

define "SDE Payer":
  SDE."SDE Payer"

define "SDE Race":
  SDE."SDE Race"

define "SDE Sex":
  SDE."SDE Sex"
`;
}

/**
 * Qualifying encounters template (common pattern)
 */
export function qualifyingEncountersTemplate(
  encounterValueSets: string[],
  measurementPeriod: string = 'Measurement Period'
): CQLDefinition {
  const queries = encounterValueSets.map(vs => ({
    resourceType: 'Encounter' as CQLResourceType,
    valueSet: vs,
    alias: 'Encounter',
    timingExpression: `Encounter.period during "${measurementPeriod}"`,
  }));

  return {
    name: 'Qualifying Encounter During Measurement Period',
    expression: unionQueriesTemplate(queries),
    comment: 'Encounters that qualify the patient for the measure',
  };
}

// ============================================================================
// Measure-Specific Templates
// ============================================================================

/**
 * Colorectal cancer screening helpers
 */
export function crcScreeningTemplates(): CQLDefinition[] {
  return [
    {
      name: 'Colonoscopy Performed',
      expression: existsQueryTemplate({
        resourceType: 'Procedure',
        valueSet: 'Colonoscopy',
        alias: 'Colonoscopy',
        timingExpression: 'Colonoscopy.performed ends 10 years or less before end of "Measurement Period"',
      }),
    },
    {
      name: 'Fecal Occult Blood Test Performed',
      expression: existsQueryTemplate({
        resourceType: 'Observation',
        valueSet: 'Fecal Occult Blood Test (FOBT)',
        alias: 'FOBT',
        additionalCriteria: [
          'FOBT.value is not null',
        ],
        timingExpression: 'FOBT.effective ends 1 year or less before end of "Measurement Period"',
      }),
    },
    {
      name: 'Flexible Sigmoidoscopy Performed',
      expression: existsQueryTemplate({
        resourceType: 'Procedure',
        valueSet: 'Flexible Sigmoidoscopy',
        alias: 'Sigmoidoscopy',
        timingExpression: 'Sigmoidoscopy.performed ends 5 years or less before end of "Measurement Period"',
      }),
    },
    {
      name: 'FIT DNA Test Performed',
      expression: existsQueryTemplate({
        resourceType: 'Observation',
        valueSet: 'FIT DNA',
        alias: 'FITTest',
        additionalCriteria: [
          'FITTest.value is not null',
        ],
        timingExpression: 'FITTest.effective ends 3 years or less before end of "Measurement Period"',
      }),
    },
    {
      name: 'CT Colonography Performed',
      expression: existsQueryTemplate({
        resourceType: 'Procedure',
        valueSet: 'CT Colonography',
        alias: 'CTCol',
        timingExpression: 'CTCol.performed ends 5 years or less before end of "Measurement Period"',
      }),
    },
    {
      name: 'Has Colorectal Cancer',
      expression: existsQueryTemplate({
        resourceType: 'Condition',
        valueSet: 'Malignant Neoplasm of Colon',
        alias: 'Cancer',
      }),
    },
    {
      name: 'Has Total Colectomy',
      expression: existsQueryTemplate({
        resourceType: 'Procedure',
        valueSet: 'Total Colectomy',
        alias: 'Colectomy',
        timingExpression: 'Colectomy.performed starts before end of "Measurement Period"',
      }),
    },
  ];
}

/**
 * Cervical cancer screening helpers
 */
export function cervicalScreeningTemplates(): CQLDefinition[] {
  return [
    {
      name: 'Cervical Cytology Within 3 Years',
      expression: existsQueryTemplate({
        resourceType: 'Observation',
        valueSet: 'Pap Test',
        alias: 'Pap',
        additionalCriteria: [
          'Pap.value is not null',
        ],
        timingExpression: 'Pap.effective ends 3 years or less before end of "Measurement Period"',
      }),
    },
    {
      name: 'HPV Test Within 5 Years',
      expression: existsQueryTemplate({
        resourceType: 'Observation',
        valueSet: 'HPV Test',
        alias: 'HPV',
        additionalCriteria: [
          'HPV.value is not null',
        ],
        timingExpression: 'HPV.effective ends 5 years or less before end of "Measurement Period"',
      }),
    },
    {
      name: 'Has Hysterectomy',
      expression: existsQueryTemplate({
        resourceType: 'Procedure',
        valueSet: 'Hysterectomy with No Residual Cervix',
        alias: 'Hyst',
        timingExpression: 'Hyst.performed starts before end of "Measurement Period"',
      }),
    },
    {
      name: 'Absence of Cervix Diagnosis',
      expression: existsQueryTemplate({
        resourceType: 'Condition',
        valueSet: 'Congenital or Acquired Absence of Cervix',
        alias: 'Absence',
      }),
    },
  ];
}

/**
 * Breast cancer screening helpers
 */
export function breastScreeningTemplates(): CQLDefinition[] {
  return [
    {
      name: 'Mammography Within 27 Months',
      expression: existsQueryTemplate({
        resourceType: 'DiagnosticReport',
        valueSet: 'Mammography',
        alias: 'Mammogram',
        timingExpression: 'Mammogram.effective ends 27 months or less before end of "Measurement Period"',
      }),
    },
    {
      name: 'Has Bilateral Mastectomy',
      expression: existsQueryTemplate({
        resourceType: 'Procedure',
        valueSet: 'Bilateral Mastectomy',
        alias: 'Mastectomy',
        timingExpression: 'Mastectomy.performed starts before end of "Measurement Period"',
      }),
    },
    {
      name: 'Has Unilateral Mastectomy Left',
      expression: existsQueryTemplate({
        resourceType: 'Procedure',
        valueSet: 'Unilateral Mastectomy Left',
        alias: 'LeftMastectomy',
      }),
    },
    {
      name: 'Has Unilateral Mastectomy Right',
      expression: existsQueryTemplate({
        resourceType: 'Procedure',
        valueSet: 'Unilateral Mastectomy Right',
        alias: 'RightMastectomy',
      }),
    },
  ];
}

// ============================================================================
// Error Handling
// ============================================================================

export class CQLTemplateError extends Error {
  constructor(message: string) {
    super(`CQL Template Error: ${message}`);
    this.name = 'CQLTemplateError';
  }
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate a complete CQL expression for common syntax issues
 * This is a basic syntactic check, not a full CQL parser
 */
export function validateCQLExpression(expression: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for balanced quotes
  const doubleQuotes = (expression.match(/"/g) || []).length;
  const singleQuotes = (expression.match(/'/g) || []).length;

  if (doubleQuotes % 2 !== 0) {
    errors.push('Unbalanced double quotes');
  }
  if (singleQuotes % 2 !== 0) {
    errors.push('Unbalanced single quotes');
  }

  // Check for balanced parentheses
  let parenCount = 0;
  for (const char of expression) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (parenCount < 0) {
      errors.push('Unbalanced parentheses');
      break;
    }
  }
  if (parenCount !== 0) {
    errors.push('Unbalanced parentheses');
  }

  // Check for balanced brackets
  let bracketCount = 0;
  for (const char of expression) {
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
    if (bracketCount < 0) {
      errors.push('Unbalanced brackets');
      break;
    }
  }
  if (bracketCount !== 0) {
    errors.push('Unbalanced brackets');
  }

  // Check for empty identifiers
  if (expression.includes('""')) {
    errors.push('Empty identifier found');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Build a complete CQL library from templates
 */
export interface CQLLibraryBuilder {
  header: CQLLibraryHeader;
  valueSets: CQLValueSetDeclaration[];
  definitions: CQLDefinition[];
}

export function buildCQLLibrary(builder: CQLLibraryBuilder): string {
  const parts: string[] = [];

  // Header
  parts.push(libraryHeaderTemplate(builder.header));

  // Value sets
  parts.push(valueSetDeclarationsTemplate(builder.valueSets));

  // Parameters (measurement period is standard)
  const mpStart = '2025-01-01';
  const mpEnd = '2025-12-31';
  parts.push(parametersTemplate([
    {
      name: 'Measurement Period',
      type: 'Interval<DateTime>',
      default: intervalTemplate({ start: mpStart, end: mpEnd, type: 'DateTime' }),
    },
  ]));

  // Context
  parts.push('context Patient\n');

  // Definitions
  for (const def of builder.definitions) {
    parts.push(defineTemplate(def));
    parts.push('');
  }

  return parts.join('\n');
}
