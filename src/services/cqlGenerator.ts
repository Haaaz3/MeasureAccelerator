/**
 * CQL Generator Service
 *
 * Generates Clinical Quality Language (CQL) from Universal Measure Spec (UMS).
 * Supports FHIR R4, QI-Core profiles, and eCQM standards.
 *
 * Features:
 * - Full CQL library generation with proper structure
 * - Value set declarations with VSAC OIDs
 * - Population definitions (IP, Denominator, Exclusions, Numerator)
 * - Helper definitions for common patterns
 * - CQL validation via CQL Services API (optional)
 */

import type {
  UniversalMeasureSpec,
  PopulationDefinition,
  LogicalClause,
  DataElement,
  ValueSetReference,
  TimingRequirement,
} from '../types/ums';

// ============================================================================
// Types
// ============================================================================

export interface CQLGenerationResult {
  success: boolean;
  cql: string;
  errors?: string[];
  warnings?: string[];
  metadata: {
    libraryName: string;
    version: string;
    populationCount: number;
    valueSetCount: number;
    definitionCount: number;
  };
}

export interface CQLValidationResult {
  valid: boolean;
  errors: CQLValidationError[];
  warnings: CQLValidationWarning[];
  elm?: string; // Compiled ELM JSON if successful
}

export interface CQLValidationError {
  severity: 'error';
  message: string;
  line?: number;
  column?: number;
  errorType?: string;
}

export interface CQLValidationWarning {
  severity: 'warning';
  message: string;
  line?: number;
  column?: number;
}

// ============================================================================
// Main CQL Generation
// ============================================================================

/**
 * Generate complete CQL library from a UMS measure
 */
export function generateCQL(measure: UniversalMeasureSpec): CQLGenerationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Validate minimum requirements
    if (!measure.metadata.measureId) {
      errors.push('Measure ID is required');
    }
    if (!measure.populations || measure.populations.length === 0) {
      errors.push('At least one population definition is required');
    }

    if (errors.length > 0) {
      return {
        success: false,
        cql: '',
        errors,
        warnings,
        metadata: {
          libraryName: '',
          version: '',
          populationCount: 0,
          valueSetCount: 0,
          definitionCount: 0,
        },
      };
    }

    // Generate library name from measure ID
    const libraryName = sanitizeLibraryName(measure.metadata.measureId);
    const version = measure.metadata.version || '1.0.0';

    // Generate CQL sections
    const header = generateHeader(measure, libraryName, version);
    const valueSets = generateValueSetDeclarations(measure.valueSets, warnings);
    const parameters = generateParameters(measure);
    const helperDefinitions = generateHelperDefinitions(measure);
    const populationDefinitions = generatePopulationDefinitions(measure);
    const supplementalData = generateSupplementalData(measure);

    // Assemble complete CQL
    const cql = [
      header,
      valueSets,
      parameters,
      'context Patient\n',
      helperDefinitions,
      populationDefinitions,
      supplementalData,
    ]
      .filter(Boolean)
      .join('\n');

    // Count definitions
    const definitionCount = (cql.match(/^define\s+"/gm) || []).length;

    return {
      success: true,
      cql,
      warnings,
      metadata: {
        libraryName,
        version,
        populationCount: measure.populations?.length ?? 0,
        valueSetCount: measure.valueSets?.length ?? 0,
        definitionCount,
      },
    };
  } catch (err) {
    return {
      success: false,
      cql: '',
      errors: [err instanceof Error ? err.message : 'Unknown error during CQL generation'],
      warnings,
      metadata: {
        libraryName: '',
        version: '',
        populationCount: 0,
        valueSetCount: 0,
        definitionCount: 0,
      },
    };
  }
}

/**
 * Generate CQL library header
 */
function generateHeader(
  measure: UniversalMeasureSpec,
  libraryName: string,
  version: string
): string {
  const lines: string[] = [
    '/*',
    ` * Library: ${libraryName}`,
    ` * Title: ${measure.metadata.title}`,
    ` * Measure ID: ${measure.metadata.measureId}`,
    ` * Version: ${version}`,
    ` * Steward: ${measure.metadata.steward || 'Not specified'}`,
    ` * Type: ${measure.metadata.measureType || 'process'}`,
    ` * Scoring: ${measure.metadata.scoring || 'proportion'}`,
    ` *`,
    ` * Description: ${measure.metadata.description || 'No description provided'}`,
    ` *`,
    ` * Generated: ${new Date().toISOString()}`,
    ` * Generator: AlgoAccelerator CQL Generator v1.0`,
    ' */',
    '',
    `library ${libraryName} version '${version}'`,
    '',
    "using FHIR version '4.0.1'",
    '',
    "include FHIRHelpers version '4.0.1' called FHIRHelpers",
    "include QICoreCommon version '2.0.0' called QICoreCommon",
    "include MATGlobalCommonFunctions version '7.0.000' called Global",
    "include SupplementalDataElements version '3.4.000' called SDE",
    "include Hospice version '6.9.000' called Hospice",
    '',
    '// Code Systems',
    'codesystem "LOINC": \'http://loinc.org\'',
    'codesystem "SNOMEDCT": \'http://snomed.info/sct\'',
    'codesystem "ICD10CM": \'http://hl7.org/fhir/sid/icd-10-cm\'',
    'codesystem "CPT": \'http://www.ama-assn.org/go/cpt\'',
    'codesystem "HCPCS": \'https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets\'',
    'codesystem "RxNorm": \'http://www.nlm.nih.gov/research/umls/rxnorm\'',
    'codesystem "CVX": \'http://hl7.org/fhir/sid/cvx\'',
    '',
  ];

  return lines.join('\n');
}

/**
 * Generate value set declarations
 * @param valueSets - Value sets to declare
 * @param warnings - Array to collect warnings about value sets with no codes
 */
function generateValueSetDeclarations(valueSets: ValueSetReference[], warnings: string[] = []): string {
  if (!valueSets || valueSets.length === 0) {
    return '// No value sets defined\n';
  }

  const lines: string[] = ['// Value Sets'];

  for (const vs of valueSets) {
    if (!vs) continue; // Skip null/undefined entries

    const url = vs.url || (vs.oid ? `http://cts.nlm.nih.gov/fhir/ValueSet/${vs.oid}` : null);
    if (url) {
      // Check if value set has no codes defined
      const hasCodes = vs.codes && vs.codes.length > 0;
      if (!hasCodes) {
        lines.push(`valueset "${sanitizeIdentifier(vs.name)}": '${url}'`);
        lines.push(`  /* WARNING: Value set "${vs.name}" has no codes defined - may need expansion */`);
        warnings.push(`Value set "${vs.name}" has no codes defined`);
      } else {
        lines.push(`valueset "${sanitizeIdentifier(vs.name)}": '${url}'`);
      }
    } else {
      lines.push(`// valueset "${sanitizeIdentifier(vs.name)}": 'OID_NOT_SPECIFIED'`);
      warnings.push(`Value set "${vs.name}" has no OID or URL specified`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Generate parameters section
 */
function generateParameters(measure: UniversalMeasureSpec): string {
  const mpStart = measure.metadata.measurementPeriod?.start || '2025-01-01';
  const mpEnd = measure.metadata.measurementPeriod?.end || '2025-12-31';

  return `// Parameters
parameter "Measurement Period" Interval<DateTime>
  default Interval[@${mpStart}T00:00:00.0, @${mpEnd}T23:59:59.999]

`;
}

/**
 * Generate helper definitions used across populations
 */
function generateHelperDefinitions(measure: UniversalMeasureSpec): string {
  const lines: string[] = ['// Helper Definitions'];

  // Age calculation
  const ageRange = measure.globalConstraints?.ageRange;
  if (ageRange) {
    lines.push(`
define "Age at End of Measurement Period":
  AgeInYearsAt(date from end of "Measurement Period")

define "Patient Age Valid":
  "Age at End of Measurement Period" in Interval[${ageRange.min}, ${ageRange.max}]`);
  }

  // Gender requirement
  const gender = measure.globalConstraints?.gender;
  if (gender && gender !== 'all') {
    lines.push(`
define "Patient Gender Valid":
  Patient.gender = '${gender}'`);
  }

  // Qualifying encounters helper
  const hasEncounterCriteria = measure.populations?.some(pop =>
    pop.criteria && hasDataElementType(pop.criteria, 'encounter')
  ) ?? false;
  if (hasEncounterCriteria) {
    lines.push(`
define "Qualifying Encounter During Measurement Period":
  ( [Encounter: "Office Visit"]
    union [Encounter: "Annual Wellness Visit"]
    union [Encounter: "Preventive Care Services Established Office Visit, 18 and Up"]
    union [Encounter: "Home Healthcare Services"]
    union [Encounter: "Online Assessments"]
    union [Encounter: "Telephone Visits"]
  ) Encounter
    where Encounter.status = 'finished'
      and Encounter.period during "Measurement Period"`);
  }

  // Hospice check (common exclusion)
  lines.push(`
define "Has Hospice Services":
  Hospice."Has Hospice Services"`);

  // Detect measure type and add specific helpers
  const title = measure.metadata.title?.toLowerCase() || '';
  const measureId = measure.metadata.measureId?.toUpperCase() || '';

  // Colorectal cancer screening helpers
  if (title.includes('colorectal') || measureId.includes('CMS130')) {
    lines.push(generateCRCHelpers());
  }

  // Cervical cancer screening helpers
  if (title.includes('cervical') || measureId.includes('CMS124')) {
    lines.push(generateCervicalHelpers());
  }

  // Breast cancer screening helpers
  if (title.includes('breast') && title.includes('screen') || measureId.includes('CMS125')) {
    lines.push(generateBreastCancerHelpers());
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Generate colorectal cancer screening specific helpers
 */
function generateCRCHelpers(): string {
  return `
// Colorectal Cancer Screening Helpers
define "Colonoscopy Performed":
  [Procedure: "Colonoscopy"] Colonoscopy
    where Colonoscopy.status = 'completed'
      and Colonoscopy.performed ends 10 years or less before end of "Measurement Period"

define "Fecal Occult Blood Test Performed":
  [Observation: "Fecal Occult Blood Test (FOBT)"] FOBT
    where FOBT.status in { 'final', 'amended', 'corrected' }
      and FOBT.effective ends 1 year or less before end of "Measurement Period"
      and FOBT.value is not null

define "Flexible Sigmoidoscopy Performed":
  [Procedure: "Flexible Sigmoidoscopy"] Sigmoidoscopy
    where Sigmoidoscopy.status = 'completed'
      and Sigmoidoscopy.performed ends 5 years or less before end of "Measurement Period"

define "FIT DNA Test Performed":
  [Observation: "FIT DNA"] FITTest
    where FITTest.status in { 'final', 'amended', 'corrected' }
      and FITTest.effective ends 3 years or less before end of "Measurement Period"
      and FITTest.value is not null

define "CT Colonography Performed":
  [Procedure: "CT Colonography"] CTCol
    where CTCol.status = 'completed'
      and CTCol.performed ends 5 years or less before end of "Measurement Period"

define "Has Colorectal Cancer":
  exists ([Condition: "Malignant Neoplasm of Colon"] Cancer
    where Cancer.clinicalStatus ~ QICoreCommon."active")

define "Has Total Colectomy":
  exists ([Procedure: "Total Colectomy"] Colectomy
    where Colectomy.status = 'completed'
      and Colectomy.performed starts before end of "Measurement Period")`;
}

/**
 * Generate cervical cancer screening specific helpers
 */
function generateCervicalHelpers(): string {
  return `
// Cervical Cancer Screening Helpers
define "Cervical Cytology Within 3 Years":
  [Observation: "Pap Test"] Pap
    where Pap.status in { 'final', 'amended', 'corrected' }
      and Pap.effective ends 3 years or less before end of "Measurement Period"
      and Pap.value is not null

define "HPV Test Within 5 Years":
  [Observation: "HPV Test"] HPV
    where HPV.status in { 'final', 'amended', 'corrected' }
      and HPV.effective ends 5 years or less before end of "Measurement Period"
      and HPV.value is not null

define "Has Hysterectomy":
  exists ([Procedure: "Hysterectomy with No Residual Cervix"] Hyst
    where Hyst.status = 'completed'
      and Hyst.performed starts before end of "Measurement Period")

define "Absence of Cervix Diagnosis":
  exists ([Condition: "Congenital or Acquired Absence of Cervix"] Absence
    where Absence.clinicalStatus ~ QICoreCommon."active")`;
}

/**
 * Generate breast cancer screening specific helpers
 */
function generateBreastCancerHelpers(): string {
  return `
// Breast Cancer Screening Helpers
define "Mammography Within 27 Months":
  [DiagnosticReport: "Mammography"] Mammogram
    where Mammogram.status in { 'final', 'amended', 'corrected' }
      and Mammogram.effective ends 27 months or less before end of "Measurement Period"

define "Has Bilateral Mastectomy":
  exists ([Procedure: "Bilateral Mastectomy"] Mastectomy
    where Mastectomy.status = 'completed'
      and Mastectomy.performed starts before end of "Measurement Period")

define "Has Unilateral Mastectomy Left":
  exists ([Procedure: "Unilateral Mastectomy Left"] LeftMastectomy
    where LeftMastectomy.status = 'completed')

define "Has Unilateral Mastectomy Right":
  exists ([Procedure: "Unilateral Mastectomy Right"] RightMastectomy
    where RightMastectomy.status = 'completed')`;
}

/**
 * Generate population definitions
 */
function generatePopulationDefinitions(measure: UniversalMeasureSpec): string {
  const lines: string[] = ['// Population Definitions'];

  // Initial Population
  const ipPop = findPopulation(measure.populations, 'initial_population');
  if (ipPop) {
    lines.push(generatePopulationDefinition(ipPop, 'Initial Population', measure));
  }

  // Denominator
  const denomPop = findPopulation(measure.populations, 'denominator');
  lines.push(generateDenominatorDefinition(denomPop, measure));

  // Denominator Exclusions
  const exclPop = findPopulation(measure.populations, 'denominator_exclusion');
  lines.push(generateExclusionDefinition(exclPop, measure));

  // Denominator Exceptions
  const excepPop = findPopulation(measure.populations, 'denominator_exception');
  if (excepPop) {
    lines.push(generatePopulationDefinition(excepPop, 'Denominator Exception', measure));
  }

  // Numerator
  const numPop = findPopulation(measure.populations, 'numerator');
  lines.push(generateNumeratorDefinition(numPop, measure));

  // Numerator Exclusions
  const numExclPop = findPopulation(measure.populations, 'numerator_exclusion');
  if (numExclPop) {
    lines.push(generatePopulationDefinition(numExclPop, 'Numerator Exclusion', measure));
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Generate a single population definition
 */
function generatePopulationDefinition(
  pop: PopulationDefinition,
  name: string,
  measure: UniversalMeasureSpec
): string {
  const lines: string[] = [];

  // Add narrative as comment
  if (pop.narrative) {
    lines.push(`
/*
 * ${name}
 * ${pop.narrative.substring(0, 200)}${pop.narrative.length > 200 ? '...' : ''}
 */`);
  }

  // Generate criteria expression
  const criteriaExpr = generateCriteriaExpression(pop.criteria, measure);

  lines.push(`define "${name}":
  ${criteriaExpr}`);

  return lines.join('\n');
}

/**
 * Generate denominator definition (typically equals IP)
 */
function generateDenominatorDefinition(
  pop: PopulationDefinition | null,
  measure: UniversalMeasureSpec
): string {
  if (pop && pop.criteria && pop.criteria.children && pop.criteria.children.length > 0) {
    // Has explicit denominator criteria
    return generatePopulationDefinition(pop, 'Denominator', measure);
  }

  // Default: Denominator equals Initial Population
  return `
/*
 * Denominator
 * Equals Initial Population
 */
define "Denominator":
  "Initial Population"`;
}

/**
 * Generate exclusion definition with common patterns
 */
function generateExclusionDefinition(
  pop: PopulationDefinition | null,
  measure: UniversalMeasureSpec
): string {
  const lines: string[] = [
    `
/*
 * Denominator Exclusion
 * ${pop?.narrative || 'Patients meeting exclusion criteria'}
 */
define "Denominator Exclusion":`,
  ];

  const exclusionCriteria: string[] = [];

  // Always include hospice
  exclusionCriteria.push('"Has Hospice Services"');

  // Add measure-specific exclusions
  const title = measure.metadata.title?.toLowerCase() || '';
  const measureId = measure.metadata.measureId?.toUpperCase() || '';

  if (title.includes('colorectal') || measureId.includes('CMS130')) {
    exclusionCriteria.push('"Has Colorectal Cancer"');
    exclusionCriteria.push('"Has Total Colectomy"');
  }

  if (title.includes('cervical') || measureId.includes('CMS124')) {
    exclusionCriteria.push('"Has Hysterectomy"');
    exclusionCriteria.push('"Absence of Cervix Diagnosis"');
  }

  if (title.includes('breast') && title.includes('screen') || measureId.includes('CMS125')) {
    exclusionCriteria.push('"Has Bilateral Mastectomy"');
    exclusionCriteria.push('("Has Unilateral Mastectomy Left" and "Has Unilateral Mastectomy Right")');
  }

  // Add custom exclusions from population criteria
  if (pop && pop.criteria && pop.criteria.children && pop.criteria.children.length > 0) {
    const customExpr = generateCriteriaExpression(pop.criteria, measure);
    if (customExpr !== 'true' && customExpr !== 'false') {
      exclusionCriteria.push(`(${customExpr})`);
    }
  }

  lines.push('  ' + exclusionCriteria.join('\n    or '));

  return lines.join('\n');
}

/**
 * Generate numerator definition
 */
function generateNumeratorDefinition(
  pop: PopulationDefinition | null,
  measure: UniversalMeasureSpec
): string {
  const title = measure.metadata.title?.toLowerCase() || '';
  const measureId = measure.metadata.measureId?.toUpperCase() || '';

  const lines: string[] = [
    `
/*
 * Numerator
 * ${pop?.narrative || 'Patients meeting numerator criteria'}
 */
define "Numerator":`,
  ];

  // Measure-specific numerator logic
  if (title.includes('colorectal') || measureId.includes('CMS130')) {
    lines.push(`  exists "Colonoscopy Performed"
    or exists "Fecal Occult Blood Test Performed"
    or exists "Flexible Sigmoidoscopy Performed"
    or exists "FIT DNA Test Performed"
    or exists "CT Colonography Performed"`);
    return lines.join('\n');
  }

  if (title.includes('cervical') || measureId.includes('CMS124')) {
    lines.push(`  exists "Cervical Cytology Within 3 Years"
    or (AgeInYearsAt(date from end of "Measurement Period") >= 30
        and exists "HPV Test Within 5 Years")`);
    return lines.join('\n');
  }

  if (title.includes('breast') && title.includes('screen') || measureId.includes('CMS125')) {
    lines.push('  exists "Mammography Within 27 Months"');
    return lines.join('\n');
  }

  // Generic numerator from criteria
  if (pop && pop.criteria) {
    const criteriaExpr = generateCriteriaExpression(pop.criteria, measure);
    lines.push('  ' + criteriaExpr);
  } else {
    // No numerator criteria defined - generate placeholder with warning comment
    lines.push('  /* WARNING: No numerator criteria defined in measure specification */');
    lines.push('  true');
  }

  return lines.join('\n');
}

/**
 * Generate supplemental data definitions
 */
function generateSupplementalData(measure: UniversalMeasureSpec): string {
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
 * Generate CQL expression from criteria
 */
function generateCriteriaExpression(
  criteria: LogicalClause,
  measure: UniversalMeasureSpec,
  indent: number = 0
): string {
  if (!criteria || !criteria.children || criteria.children.length === 0) {
    return 'true';
  }

  const expressions: string[] = [];
  const indentStr = '  '.repeat(indent);

  for (const child of criteria.children) {
    if ('operator' in child) {
      // Nested clause
      const nested = generateCriteriaExpression(child as LogicalClause, measure, indent + 1);
      expressions.push(`(${nested})`);
    } else {
      // Data element
      const expr = generateDataElementExpression(child as DataElement, measure);
      expressions.push(expr);
    }
  }

  if (expressions.length === 0) {
    return 'true';
  }

  const operator = criteria.operator === 'OR' ? '\n    or ' : '\n    and ';
  return expressions.join(operator);
}

/**
 * Generate CQL expression for a data element
 */
function generateDataElementExpression(
  element: DataElement,
  measure: UniversalMeasureSpec
): string {
  if (!element) {
    return '/* WARNING: Null data element encountered */\n  true';
  }

  // Handle missing valueSet gracefully
  const hasValueSet = element.valueSet?.name || element.valueSet?.id;
  if (!hasValueSet && element.type !== 'demographic') {
    // No value set specified for a non-demographic element
    const desc = element.description || `${element.type} criterion`;
    return `/* WARNING: No value set defined for "${desc}" */\n  true`;
  }

  const vsName = element.valueSet?.name
    ? sanitizeIdentifier(element.valueSet.name)
    : 'Unspecified Value Set';

  const timing = generateTimingExpression(element.timingRequirements);

  switch (element.type) {
    case 'demographic':
      return generateDemographicExpression(element);

    case 'diagnosis':
      return `exists ([Condition: "${vsName}"] C
      where C.clinicalStatus ~ QICoreCommon."active"${timing ? '\n        ' + timing : ''})`;

    case 'encounter':
      return `exists ([Encounter: "${vsName}"] E
      where E.status = 'finished'${timing ? '\n        ' + timing : ''})`;

    case 'procedure':
      return `exists ([Procedure: "${vsName}"] P
      where P.status = 'completed'${timing ? '\n        ' + timing : ''})`;

    case 'observation':
      return `exists ([Observation: "${vsName}"] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.value is not null${timing ? '\n        ' + timing : ''})`;

    case 'medication':
      return `exists ([MedicationRequest: "${vsName}"] M
      where M.status in { 'active', 'completed' }${timing ? '\n        ' + timing : ''})`;

    case 'immunization':
      return `exists ([Immunization: "${vsName}"] I
      where I.status = 'completed'${timing ? '\n        ' + timing : ''})`;

    default:
      return `// TODO: ${element.description || 'Unknown criterion'}`;
  }
}

/**
 * Generate demographic expression
 */
function generateDemographicExpression(element: DataElement): string {
  if (element.thresholds) {
    const { ageMin, ageMax } = element.thresholds;
    if (ageMin !== undefined || ageMax !== undefined) {
      const min = ageMin ?? 0;
      const max = ageMax ?? 999;
      return `AgeInYearsAt(date from end of "Measurement Period") in Interval[${min}, ${max}]`;
    }
  }

  return '"Patient Age Valid"';
}

/**
 * Generate timing expression from timing requirements
 */
function generateTimingExpression(timing?: TimingRequirement[]): string {
  if (!timing || timing.length === 0) {
    return 'and P.performed during "Measurement Period"';
  }

  const req = timing[0];
  const window = req.window;

  if (!window) {
    return 'and P.performed during "Measurement Period"';
  }

  const { value, unit, direction } = window;
  const unitPlural = value === 1 ? unit.replace(/s$/, '') : unit;

  if (direction === 'before') {
    return `and ends ${value} ${unitPlural} or less before end of "Measurement Period"`;
  } else if (direction === 'after') {
    return `and starts ${value} ${unitPlural} or less after start of "Measurement Period"`;
  } else {
    return 'and occurs during "Measurement Period"';
  }
}

// ============================================================================
// CQL Validation via CQL Services API
// ============================================================================

/**
 * Validate CQL syntax and translate to ELM
 *
 * Requires CQL Services API to be running (default: http://localhost:8080)
 *
 * @param cql - CQL code to validate
 * @param serviceUrl - URL of CQL Services API (defaults to localhost:8080)
 */
export async function validateCQL(
  cql: string,
  serviceUrl: string = 'http://localhost:8080'
): Promise<CQLValidationResult> {
  try {
    const response = await fetch(`${serviceUrl}/cql/translator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/cql',
        Accept: 'application/elm+json',
      },
      body: cql,
    });

    if (!response.ok) {
      // Parse error response
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        return {
          valid: false,
          errors: parseTranslatorErrors(errorData),
          warnings: parseTranslatorWarnings(errorData),
        };
      } catch {
        return {
          valid: false,
          errors: [{ severity: 'error', message: `Translation failed: ${errorText}` }],
          warnings: [],
        };
      }
    }

    const elm = await response.text();
    const elmJson = JSON.parse(elm);

    // Check for annotation errors/warnings in ELM
    const annotations = elmJson?.library?.annotation || [];
    const errors = annotations
      .filter((a: any) => a.errorSeverity === 'error')
      .map((a: any) => ({
        severity: 'error' as const,
        message: a.message,
        line: a.locator?.start?.line,
        column: a.locator?.start?.column,
        errorType: a.errorType,
      }));

    const warnings = annotations
      .filter((a: any) => a.errorSeverity === 'warning')
      .map((a: any) => ({
        severity: 'warning' as const,
        message: a.message,
        line: a.locator?.start?.line,
        column: a.locator?.start?.column,
      }));

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      elm: errors.length === 0 ? elm : undefined,
    };
  } catch (err) {
    // Handle connection errors
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return {
        valid: false,
        errors: [
          {
            severity: 'error',
            message: `Cannot connect to CQL Services at ${serviceUrl}. Ensure the service is running.`,
          },
        ],
        warnings: [],
      };
    }

    return {
      valid: false,
      errors: [
        {
          severity: 'error',
          message: err instanceof Error ? err.message : 'Unknown validation error',
        },
      ],
      warnings: [],
    };
  }
}

/**
 * Check if CQL Services API is available
 */
export async function isCQLServiceAvailable(
  serviceUrl: string = 'http://localhost:8080'
): Promise<boolean> {
  try {
    const response = await fetch(`${serviceUrl}/cql/translator`, {
      method: 'HEAD',
    });
    return response.status !== 404;
  } catch {
    return false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sanitize measure ID for use as CQL library name
 */
function sanitizeLibraryName(measureId: string): string {
  return measureId
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/^(\d)/, '_$1'); // CQL identifiers can't start with numbers
}

/**
 * Sanitize string for use as CQL identifier
 */
function sanitizeIdentifier(name: string): string {
  return name
    .replace(/"/g, '\\"')
    .trim();
}

/**
 * Find population by type (handles both kebab-case and underscore formats)
 */
function findPopulation(
  populations: PopulationDefinition[],
  type: string
): PopulationDefinition | null {
  const typeVariants: Record<string, string[]> = {
    initial_population: ['initial_population', 'initial-population'],
    denominator: ['denominator'],
    denominator_exclusion: ['denominator_exclusion', 'denominator-exclusion'],
    denominator_exception: ['denominator_exception', 'denominator-exception'],
    numerator: ['numerator'],
    numerator_exclusion: ['numerator_exclusion', 'numerator-exclusion'],
  };

  const variants = typeVariants[type] || [type];
  return populations.find(p => variants.includes(p.type)) || null;
}

/**
 * Check if criteria contains a specific data element type
 */
function hasDataElementType(criteria: LogicalClause, type: string): boolean {
  if (!criteria || !criteria.children) return false;

  for (const child of criteria.children) {
    if ('operator' in child) {
      if (hasDataElementType(child as LogicalClause, type)) return true;
    } else {
      if ((child as DataElement).type === type) return true;
    }
  }

  return false;
}

/**
 * Parse translator errors from response
 */
function parseTranslatorErrors(data: any): CQLValidationError[] {
  if (Array.isArray(data)) {
    return data
      .filter(item => item.severity === 'error')
      .map(item => ({
        severity: 'error' as const,
        message: item.message || 'Unknown error',
        line: item.line,
        column: item.column,
        errorType: item.errorType,
      }));
  }

  if (data.errorExceptions) {
    return data.errorExceptions.map((e: any) => ({
      severity: 'error' as const,
      message: e.message || 'Translation error',
      line: e.startLine,
      column: e.startChar,
    }));
  }

  return [{ severity: 'error', message: data.message || 'Unknown error' }];
}

/**
 * Parse translator warnings from response
 */
function parseTranslatorWarnings(data: any): CQLValidationWarning[] {
  if (Array.isArray(data)) {
    return data
      .filter(item => item.severity === 'warning')
      .map(item => ({
        severity: 'warning' as const,
        message: item.message || 'Warning',
        line: item.line,
        column: item.column,
      }));
  }

  return [];
}

