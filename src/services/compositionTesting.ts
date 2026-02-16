/**
 * Composition Testing Utilities
 *
 * Provides utilities for testing full measure compilation pipelines.
 * Tests the complete flow: UMS → CQL generation → validation → SQL generation.
 *
 * Key features:
 * - Test fixtures for common measure types
 * - Full pipeline testing utilities
 * - Output comparison and diffing
 * - Regression testing support
 */

import type { UniversalMeasureSpec, PopulationDefinition, LogicalClause, DataElement } from '../types/ums';
import { generateCQL, type CQLGenerationResult } from './cqlGenerator';
import { generateHDISQL, type SQLGenerationConfig } from './hdiSqlGenerator';
import { validateCQLSyntax, type CQLValidationResult } from './cqlValidator';

// ============================================================================
// Types
// ============================================================================

export interface CompositionTestResult {
  measureId: string;
  success: boolean;
  cqlResult: CQLGenerationResult;
  cqlValidation: CQLValidationResult;
  sqlResult: ReturnType<typeof generateHDISQL>;
  timings: {
    cqlGenerationMs: number;
    cqlValidationMs: number;
    sqlGenerationMs: number;
    totalMs: number;
  };
  errors: string[];
  warnings: string[];
}

export interface CompositionTestSuite {
  name: string;
  fixtures: MeasureTestFixture[];
  results: CompositionTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
}

export interface MeasureTestFixture {
  name: string;
  description: string;
  measure: UniversalMeasureSpec;
  expectedCQL?: ExpectedOutputPattern;
  expectedSQL?: ExpectedOutputPattern;
  tags?: string[];
}

export interface ExpectedOutputPattern {
  contains?: string[];
  notContains?: string[];
  matchesRegex?: string[];
  minLines?: number;
  maxLines?: number;
}

export interface OutputComparison {
  matches: boolean;
  differences: OutputDifference[];
}

export interface OutputDifference {
  type: 'missing' | 'unexpected' | 'regex_mismatch' | 'line_count';
  message: string;
  expected?: string;
  actual?: string;
}

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Standard test fixtures for common measure patterns
 */
export const TEST_FIXTURES: MeasureTestFixture[] = [
  // Fixture 1: Simple demographic-only measure
  {
    name: 'Demographics Only',
    description: 'Tests age and gender filtering with no clinical criteria',
    measure: createDemographicsOnlyMeasure(),
    expectedCQL: {
      contains: [
        'library DemographicsTest',
        'using FHIR',
        'context Patient',
        'define "Initial Population"',
        'AgeInYearsAt',
      ],
    },
    expectedSQL: {
      contains: [
        'DEMOG as (',
        'age_in_years',
        'gender_concept_name',
      ],
    },
    tags: ['demographics', 'simple'],
  },

  // Fixture 2: Condition-based measure (like CMS130 CRC Screening)
  {
    name: 'Condition Based',
    description: 'Tests condition/diagnosis criteria with exclusions',
    measure: createConditionBasedMeasure(),
    expectedCQL: {
      contains: [
        'library ConditionTest',
        '[Condition:',
        'clinicalStatus',
        'define "Denominator Exclusion"',
      ],
    },
    expectedSQL: {
      contains: [
        'ph_f_condition',
        'condition_code',
        'valueset_codes VS',
      ],
    },
    tags: ['conditions', 'exclusions'],
  },

  // Fixture 3: Procedure-based measure
  {
    name: 'Procedure Based',
    description: 'Tests procedure criteria with timing requirements',
    measure: createProcedureBasedMeasure(),
    expectedCQL: {
      contains: [
        '[Procedure:',
        'status = \'completed\'',
        'performed',
      ],
    },
    expectedSQL: {
      contains: [
        'ph_f_procedure',
        'procedure_code',
        'performed_date',
      ],
    },
    tags: ['procedures', 'timing'],
  },

  // Fixture 4: Observation/Result-based measure
  {
    name: 'Observation Based',
    description: 'Tests observation/result criteria with value constraints',
    measure: createObservationBasedMeasure(),
    expectedCQL: {
      contains: [
        '[Observation:',
        'value is not null',
        'status in {',
      ],
    },
    expectedSQL: {
      contains: [
        'ph_f_result',
        'result_code',
        'numeric_value',
      ],
    },
    tags: ['observations', 'values'],
  },

  // Fixture 5: Multi-population measure
  {
    name: 'Multi Population',
    description: 'Tests measure with all population types',
    measure: createMultiPopulationMeasure(),
    expectedCQL: {
      contains: [
        'define "Initial Population"',
        'define "Denominator"',
        'define "Denominator Exclusion"',
        'define "Numerator"',
      ],
    },
    expectedSQL: {
      contains: [
        'INITIAL_POPULATION',
        'DENOMINATOR',
        'DENOM_EXCLUSION',
        'NUMERATOR',
      ],
    },
    tags: ['populations', 'complex'],
  },
];

// ============================================================================
// Fixture Factory Functions
// ============================================================================

function createDemographicsOnlyMeasure(): UniversalMeasureSpec {
  return {
    metadata: {
      measureId: 'DemographicsTest',
      title: 'Demographics Only Test Measure',
      version: '1.0.0',
      measureType: 'process',
      scoring: 'proportion',
    },
    globalConstraints: {
      ageRange: { min: 18, max: 75 },
      gender: 'all',
    },
    valueSets: [],
    populations: [
      {
        type: 'initial_population',
        narrative: 'Patients aged 18-75',
        criteria: {
          operator: 'AND',
          children: [
            {
              id: 'age-check',
              type: 'demographic',
              description: 'Age between 18 and 75',
              thresholds: { ageMin: 18, ageMax: 75 },
            } as DataElement,
          ],
        },
      },
    ],
  };
}

function createConditionBasedMeasure(): UniversalMeasureSpec {
  return {
    metadata: {
      measureId: 'ConditionTest',
      title: 'Condition Based Test Measure',
      version: '1.0.0',
      measureType: 'process',
      scoring: 'proportion',
    },
    globalConstraints: {
      ageRange: { min: 50, max: 75 },
    },
    valueSets: [
      {
        id: 'vs-diabetes',
        name: 'Diabetes Mellitus',
        oid: '2.16.840.1.113883.3.464.1003.103.12.1001',
        codes: [
          { code: 'E11', system: 'ICD10CM', display: 'Type 2 diabetes mellitus' },
        ],
      },
      {
        id: 'vs-cancer',
        name: 'Malignant Neoplasm',
        oid: '2.16.840.1.113883.3.464.1003.108.12.1001',
        codes: [],
      },
    ],
    populations: [
      {
        type: 'initial_population',
        narrative: 'Patients with diabetes',
        criteria: {
          operator: 'AND',
          children: [
            {
              id: 'diabetes-dx',
              type: 'diagnosis',
              description: 'Diabetes diagnosis',
              valueSet: { id: 'vs-diabetes', name: 'Diabetes Mellitus' },
            } as DataElement,
          ],
        },
      },
      {
        type: 'denominator_exclusion',
        narrative: 'Patients with cancer',
        criteria: {
          operator: 'OR',
          children: [
            {
              id: 'cancer-dx',
              type: 'diagnosis',
              description: 'Cancer diagnosis',
              valueSet: { id: 'vs-cancer', name: 'Malignant Neoplasm' },
            } as DataElement,
          ],
        },
      },
    ],
  };
}

function createProcedureBasedMeasure(): UniversalMeasureSpec {
  return {
    metadata: {
      measureId: 'ProcedureTest',
      title: 'Procedure Based Test Measure',
      version: '1.0.0',
      measureType: 'process',
      scoring: 'proportion',
    },
    globalConstraints: {
      ageRange: { min: 50, max: 75 },
    },
    valueSets: [
      {
        id: 'vs-colonoscopy',
        name: 'Colonoscopy',
        oid: '2.16.840.1.113883.3.464.1003.108.12.1020',
        codes: [
          { code: '44388', system: 'CPT', display: 'Colonoscopy' },
        ],
      },
    ],
    populations: [
      {
        type: 'initial_population',
        narrative: 'Patients aged 50-75',
        criteria: {
          operator: 'AND',
          children: [
            {
              id: 'age-check',
              type: 'demographic',
              thresholds: { ageMin: 50, ageMax: 75 },
            } as DataElement,
          ],
        },
      },
      {
        type: 'numerator',
        narrative: 'Patients with colonoscopy in past 10 years',
        criteria: {
          operator: 'AND',
          children: [
            {
              id: 'colonoscopy',
              type: 'procedure',
              description: 'Colonoscopy performed',
              valueSet: { id: 'vs-colonoscopy', name: 'Colonoscopy' },
              timingRequirements: [
                {
                  description: 'Within 10 years',
                  window: { value: 10, unit: 'years', direction: 'before' },
                },
              ],
            } as DataElement,
          ],
        },
      },
    ],
  };
}

function createObservationBasedMeasure(): UniversalMeasureSpec {
  return {
    metadata: {
      measureId: 'ObservationTest',
      title: 'Observation Based Test Measure',
      version: '1.0.0',
      measureType: 'outcome',
      scoring: 'proportion',
    },
    globalConstraints: {
      ageRange: { min: 18, max: 85 },
    },
    valueSets: [
      {
        id: 'vs-hba1c',
        name: 'HbA1c Lab Test',
        oid: '2.16.840.1.113883.3.464.1003.198.12.1013',
        codes: [
          { code: '4548-4', system: 'LOINC', display: 'HbA1c' },
        ],
      },
    ],
    populations: [
      {
        type: 'initial_population',
        narrative: 'Adults with HbA1c test',
        criteria: {
          operator: 'AND',
          children: [],
        },
      },
      {
        type: 'numerator',
        narrative: 'Patients with HbA1c under control',
        criteria: {
          operator: 'AND',
          children: [
            {
              id: 'hba1c-test',
              type: 'observation',
              description: 'HbA1c test result',
              valueSet: { id: 'vs-hba1c', name: 'HbA1c Lab Test' },
            } as DataElement,
          ],
        },
      },
    ],
  };
}

function createMultiPopulationMeasure(): UniversalMeasureSpec {
  return {
    metadata: {
      measureId: 'MultiPopTest',
      title: 'Multi Population Test Measure',
      version: '1.0.0',
      measureType: 'process',
      scoring: 'proportion',
    },
    globalConstraints: {
      ageRange: { min: 21, max: 64 },
      gender: 'female',
    },
    valueSets: [
      {
        id: 'vs-pap',
        name: 'Pap Test',
        oid: '2.16.840.1.113883.3.464.1003.108.12.1017',
        codes: [],
      },
      {
        id: 'vs-hysterectomy',
        name: 'Hysterectomy',
        oid: '2.16.840.1.113883.3.464.1003.198.12.1014',
        codes: [],
      },
    ],
    populations: [
      {
        type: 'initial_population',
        narrative: 'Women aged 21-64',
        criteria: {
          operator: 'AND',
          children: [
            {
              id: 'female-check',
              type: 'demographic',
              genderValue: 'female',
            } as DataElement,
            {
              id: 'age-check',
              type: 'demographic',
              thresholds: { ageMin: 21, ageMax: 64 },
            } as DataElement,
          ],
        },
      },
      {
        type: 'denominator',
        narrative: 'Equals initial population',
        criteria: { operator: 'AND', children: [] },
      },
      {
        type: 'denominator_exclusion',
        narrative: 'Women with hysterectomy',
        criteria: {
          operator: 'OR',
          children: [
            {
              id: 'hysterectomy',
              type: 'procedure',
              description: 'Prior hysterectomy',
              valueSet: { id: 'vs-hysterectomy', name: 'Hysterectomy' },
            } as DataElement,
          ],
        },
      },
      {
        type: 'numerator',
        narrative: 'Women with Pap test in past 3 years',
        criteria: {
          operator: 'AND',
          children: [
            {
              id: 'pap-test',
              type: 'observation',
              description: 'Pap test performed',
              valueSet: { id: 'vs-pap', name: 'Pap Test' },
              timingRequirements: [
                {
                  description: 'Within 3 years',
                  window: { value: 3, unit: 'years', direction: 'before' },
                },
              ],
            } as DataElement,
          ],
        },
      },
    ],
  };
}

// ============================================================================
// Test Execution
// ============================================================================

/**
 * Run a single composition test
 */
export function runCompositionTest(
  fixture: MeasureTestFixture,
  sqlConfig?: Partial<SQLGenerationConfig>
): CompositionTestResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const timings = {
    cqlGenerationMs: 0,
    cqlValidationMs: 0,
    sqlGenerationMs: 0,
    totalMs: 0,
  };

  const startTotal = performance.now();

  // Step 1: Generate CQL
  const startCQL = performance.now();
  const cqlResult = generateCQL(fixture.measure);
  timings.cqlGenerationMs = performance.now() - startCQL;

  if (!cqlResult.success) {
    errors.push(...(cqlResult.errors || []));
  }
  warnings.push(...(cqlResult.warnings || []));

  // Step 2: Validate CQL
  const startValidation = performance.now();
  const cqlValidation = cqlResult.success
    ? validateCQLSyntax(cqlResult.cql)
    : { valid: false, errors: [], warnings: [] };
  timings.cqlValidationMs = performance.now() - startValidation;

  if (!cqlValidation.valid) {
    errors.push(...cqlValidation.errors.map(e => e.message));
  }
  warnings.push(...cqlValidation.warnings.map(w => w.message));

  // Step 3: Generate SQL
  const startSQL = performance.now();
  const sqlResult = generateHDISQL(fixture.measure, sqlConfig);
  timings.sqlGenerationMs = performance.now() - startSQL;

  if (!sqlResult.success) {
    errors.push(...(sqlResult.errors || []));
  }
  warnings.push(...(sqlResult.warnings || []));

  // Step 4: Check expected patterns
  if (fixture.expectedCQL && cqlResult.success) {
    const cqlComparison = compareOutput(cqlResult.cql, fixture.expectedCQL);
    if (!cqlComparison.matches) {
      errors.push(...cqlComparison.differences.map(d => `CQL: ${d.message}`));
    }
  }

  if (fixture.expectedSQL && sqlResult.success) {
    const sqlComparison = compareOutput(sqlResult.sql, fixture.expectedSQL);
    if (!sqlComparison.matches) {
      errors.push(...sqlComparison.differences.map(d => `SQL: ${d.message}`));
    }
  }

  timings.totalMs = performance.now() - startTotal;

  return {
    measureId: fixture.measure.metadata.measureId || 'unknown',
    success: errors.length === 0,
    cqlResult,
    cqlValidation,
    sqlResult,
    timings,
    errors,
    warnings,
  };
}

/**
 * Run all composition tests
 */
export function runCompositionTestSuite(
  fixtures: MeasureTestFixture[] = TEST_FIXTURES,
  sqlConfig?: Partial<SQLGenerationConfig>
): CompositionTestSuite {
  const results = fixtures.map(fixture => runCompositionTest(fixture, sqlConfig));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    name: 'Composition Test Suite',
    fixtures,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      passRate: results.length > 0 ? (passed / results.length) * 100 : 0,
    },
  };
}

/**
 * Run tests matching specific tags
 */
export function runCompositionTestsByTag(
  tags: string[],
  sqlConfig?: Partial<SQLGenerationConfig>
): CompositionTestSuite {
  const filtered = TEST_FIXTURES.filter(fixture =>
    fixture.tags?.some(t => tags.includes(t))
  );

  return runCompositionTestSuite(filtered, sqlConfig);
}

// ============================================================================
// Output Comparison
// ============================================================================

/**
 * Compare output against expected patterns
 */
export function compareOutput(
  output: string,
  expected: ExpectedOutputPattern
): OutputComparison {
  const differences: OutputDifference[] = [];

  // Check contains patterns
  if (expected.contains) {
    for (const pattern of expected.contains) {
      if (!output.includes(pattern)) {
        differences.push({
          type: 'missing',
          message: `Expected pattern not found: "${pattern}"`,
          expected: pattern,
        });
      }
    }
  }

  // Check notContains patterns
  if (expected.notContains) {
    for (const pattern of expected.notContains) {
      if (output.includes(pattern)) {
        differences.push({
          type: 'unexpected',
          message: `Unexpected pattern found: "${pattern}"`,
          actual: pattern,
        });
      }
    }
  }

  // Check regex patterns
  if (expected.matchesRegex) {
    for (const pattern of expected.matchesRegex) {
      const regex = new RegExp(pattern, 'm');
      if (!regex.test(output)) {
        differences.push({
          type: 'regex_mismatch',
          message: `Regex pattern not matched: ${pattern}`,
          expected: pattern,
        });
      }
    }
  }

  // Check line count
  const lineCount = output.split('\n').length;

  if (expected.minLines !== undefined && lineCount < expected.minLines) {
    differences.push({
      type: 'line_count',
      message: `Output has ${lineCount} lines, expected at least ${expected.minLines}`,
      expected: String(expected.minLines),
      actual: String(lineCount),
    });
  }

  if (expected.maxLines !== undefined && lineCount > expected.maxLines) {
    differences.push({
      type: 'line_count',
      message: `Output has ${lineCount} lines, expected at most ${expected.maxLines}`,
      expected: String(expected.maxLines),
      actual: String(lineCount),
    });
  }

  return {
    matches: differences.length === 0,
    differences,
  };
}

// ============================================================================
// Report Generation
// ============================================================================

export interface TestReport {
  timestamp: string;
  summary: CompositionTestSuite['summary'];
  results: Array<{
    name: string;
    measureId: string;
    success: boolean;
    timings: CompositionTestResult['timings'];
    errors: string[];
    warnings: string[];
  }>;
}

/**
 * Generate a test report from suite results
 */
export function generateTestReport(suite: CompositionTestSuite): TestReport {
  return {
    timestamp: new Date().toISOString(),
    summary: suite.summary,
    results: suite.results.map((result, index) => ({
      name: suite.fixtures[index]?.name || `Test ${index + 1}`,
      measureId: result.measureId,
      success: result.success,
      timings: result.timings,
      errors: result.errors,
      warnings: result.warnings,
    })),
  };
}

/**
 * Format test report as string for console output
 */
export function formatTestReport(report: TestReport): string {
  const lines: string[] = [
    '='.repeat(60),
    'COMPOSITION TEST REPORT',
    '='.repeat(60),
    `Timestamp: ${report.timestamp}`,
    '',
    'SUMMARY',
    '-'.repeat(40),
    `Total: ${report.summary.total}`,
    `Passed: ${report.summary.passed}`,
    `Failed: ${report.summary.failed}`,
    `Pass Rate: ${report.summary.passRate.toFixed(1)}%`,
    '',
    'RESULTS',
    '-'.repeat(40),
  ];

  for (const result of report.results) {
    const status = result.success ? 'PASS' : 'FAIL';
    lines.push(`[${status}] ${result.name} (${result.measureId})`);
    lines.push(`       Timings: CQL=${result.timings.cqlGenerationMs.toFixed(1)}ms, `
      + `Validation=${result.timings.cqlValidationMs.toFixed(1)}ms, `
      + `SQL=${result.timings.sqlGenerationMs.toFixed(1)}ms`);

    if (result.errors.length > 0) {
      lines.push('       Errors:');
      for (const error of result.errors) {
        lines.push(`         - ${error}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('       Warnings:');
      for (const warning of result.warnings) {
        lines.push(`         - ${warning}`);
      }
    }

    lines.push('');
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}

// ============================================================================
// Utility for Custom Fixtures
// ============================================================================

/**
 * Create a custom test fixture from a measure
 */
export function createTestFixture(
  name: string,
  measure: UniversalMeasureSpec,
  options?: {
    description?: string;
    expectedCQL?: ExpectedOutputPattern;
    expectedSQL?: ExpectedOutputPattern;
    tags?: string[];
  }
): MeasureTestFixture {
  return {
    name,
    description: options?.description || `Test for ${measure.metadata.measureId}`,
    measure,
    expectedCQL: options?.expectedCQL,
    expectedSQL: options?.expectedSQL,
    tags: options?.tags,
  };
}

/**
 * Quick test a measure (useful for development)
 */
export function quickTestMeasure(measure: UniversalMeasureSpec): {
  success: boolean;
  cql: string;
  sql: string;
  errors: string[];
} {
  const result = runCompositionTest(createTestFixture('Quick Test', measure));

  return {
    success: result.success,
    cql: result.cqlResult.cql || '',
    sql: result.sqlResult.sql || '',
    errors: result.errors,
  };
}
