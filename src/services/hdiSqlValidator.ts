/**
 * HDI SQL Pattern Validator
 *
 * Validates that generated SQL conforms to HDI platform patterns:
 * - CTE structure (ONT, DEMOG, PRED_*)
 * - Proper ontology joins
 * - Standard predicate output columns
 * - Correct date functions for dialect
 */

import type { SQLGenerationConfig } from '../types/hdiDataModels';

// ============================================================================
// Validation Result Types
// ============================================================================

export interface SQLValidationResult {
  valid: boolean;
  score: number; // 0-100 compliance score
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: string[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  line?: number;
  suggestion?: string;
}

// ============================================================================
// Pattern Definitions
// ============================================================================

const HDI_PATTERNS = {
  // Required CTEs
  REQUIRED_CTES: ['ONT', 'DEMOG'],

  // Predicate naming pattern
  PREDICATE_PREFIX: /^PRED_[A-Z0-9_]+$/,

  // Required ontology exclusions
  ONT_EXCLUSIONS: [
    "population_id not like '%SNAPSHOT%'",
    "population_id not like '%ARCHIVE%'",
  ],

  // Standard predicate output columns
  PREDICATE_COLUMNS: [
    'population_id',
    'empi_id',
    'data_model',
    'identifier',
    'clinical_start_date',
    'clinical_end_date',
    'description',
  ],

  // Required table references
  HDI_TABLES: [
    'ph_d_ontology',
    'ph_d_person',
  ],

  // Synapse/T-SQL date patterns
  SYNAPSE_DATE_FUNCS: [
    'DATEDIFF',
    'DATEADD',
    'GETDATE\\(\\)',
    "FORMAT\\(.*'MMdd'\\)",
  ],
};

// ============================================================================
// Main Validator
// ============================================================================

export function validateHDISQL(
  sql: string,
  config: SQLGenerationConfig
): SQLValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const suggestions: string[] = [];

  // 1. Check for required CTEs
  validateRequiredCTEs(sql, errors, warnings);

  // 2. Check CTE structure
  validateCTEStructure(sql, errors, warnings);

  // 3. Check predicate naming conventions
  validatePredicateNaming(sql, errors, warnings, suggestions);

  // 4. Check predicate output columns
  validatePredicateColumns(sql, errors, warnings);

  // 5. Check dialect-specific date functions
  validateDialectFunctions(sql, config.dialect, errors, warnings);

  // 6. Check for population_id parameter
  validatePopulationId(sql, config.populationId, errors, warnings);

  // 7. Check for proper ontology joins
  validateOntologyJoins(sql, errors, warnings);

  // 8. Check for SQL injection vulnerabilities
  validateSQLSafety(sql, errors, warnings);

  // 9. Check for balanced parentheses and quotes
  validateSyntax(sql, errors);

  // Calculate compliance score
  const errorPenalty = errors.length * 10;
  const warningPenalty = warnings.length * 3;
  const score = Math.max(0, 100 - errorPenalty - warningPenalty);

  return {
    valid: errors.length === 0,
    score,
    errors,
    warnings,
    suggestions,
  };
}

// ============================================================================
// Individual Validators
// ============================================================================

function validateRequiredCTEs(
  sql: string,
  errors: ValidationIssue[],
  _warnings: ValidationIssue[]
): void {
  for (const cte of HDI_PATTERNS.REQUIRED_CTES) {
    const pattern = new RegExp(`\\b${cte}\\s+as\\s*\\(`, 'i');
    if (!pattern.test(sql)) {
      errors.push({
        severity: 'error',
        code: 'MISSING_REQUIRED_CTE',
        message: `Missing required CTE: ${cte}`,
        suggestion: `Add the ${cte} CTE following HDI patterns`,
      });
    }
  }
}

function validateCTEStructure(
  sql: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  // Check if SQL starts with WITH
  if (!sql.trim().toLowerCase().startsWith('with') &&
      !sql.trim().startsWith('--')) {
    // Allow comments at the start
    const firstCodeLine = sql.split('\n').find(l =>
      l.trim() && !l.trim().startsWith('--')
    );
    if (firstCodeLine && !firstCodeLine.toLowerCase().includes('with')) {
      errors.push({
        severity: 'error',
        code: 'INVALID_CTE_STRUCTURE',
        message: 'SQL must use CTE structure starting with WITH clause',
        suggestion: 'Restructure query to use "with CTEName as (...)" pattern',
      });
    }
  }

  // Check CTE order: ONT should come before DEMOG
  const ontMatch = sql.match(/\bONT\s+as\s*\(/i);
  const demogMatch = sql.match(/\bDEMOG\s+as\s*\(/i);

  if (ontMatch && demogMatch) {
    const ontIndex = ontMatch.index || 0;
    const demogIndex = demogMatch.index || 0;

    if (demogIndex < ontIndex) {
      warnings.push({
        severity: 'warning',
        code: 'CTE_ORDER',
        message: 'ONT CTE should be defined before DEMOG CTE',
        suggestion: 'Reorder CTEs: ONT -> DEMOG -> PRED_*',
      });
    }
  }
}

function validatePredicateNaming(
  sql: string,
  _errors: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: string[]
): void {
  // Find all CTEs
  const cteMatches = sql.matchAll(/\b([A-Z_][A-Z0-9_]*)\s+as\s*\(/gi);

  let predicateCount = 0;
  for (const match of cteMatches) {
    const cteName = match[1].toUpperCase();

    // Skip known system CTEs
    if (['ONT', 'DEMOG', 'MEASURE_RESULT', 'INITIAL_POPULATION',
         'DENOMINATOR', 'NUMERATOR', 'DENOM_EXCLUSION', 'NUM_EXCLUSION'].includes(cteName)) {
      continue;
    }

    // Check if it follows PRED_ naming convention
    if (!cteName.startsWith('PRED_')) {
      warnings.push({
        severity: 'warning',
        code: 'PREDICATE_NAMING',
        message: `CTE "${cteName}" does not follow PRED_ naming convention`,
        suggestion: `Rename to PRED_${cteName} for consistency`,
      });
    } else {
      predicateCount++;
    }
  }

  if (predicateCount === 0) {
    suggestions.push('Consider adding PRED_* CTEs for clinical criteria');
  }
}

function validatePredicateColumns(
  sql: string,
  _errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  // Find predicate CTEs
  const predMatches = sql.matchAll(/\bPRED_[A-Z0-9_]+\s+as\s*\(\s*select([\s\S]*?)from/gi);

  for (const match of predMatches) {
    const selectClause = match[1].toLowerCase();

    // Check for required columns
    const requiredCols = ['population_id', 'empi_id', 'data_model'];
    for (const col of requiredCols) {
      if (!selectClause.includes(col)) {
        warnings.push({
          severity: 'warning',
          code: 'MISSING_PREDICATE_COLUMN',
          message: `Predicate may be missing required column: ${col}`,
          suggestion: `Ensure predicate SELECT includes ${col}`,
        });
      }
    }
  }
}

function validateDialectFunctions(
  sql: string,
  dialect: 'synapse',
  _errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  // Check for non-Synapse/T-SQL patterns
  if (sql.includes("interval '") || sql.includes('AGE(') || sql.includes('current_date()')) {
    warnings.push({
      severity: 'warning',
      code: 'DIALECT_MISMATCH',
      message: 'SQL contains non-Synapse syntax',
      suggestion: 'Use Synapse/T-SQL functions: DATEDIFF(), DATEADD(), GETDATE()',
    });
  }

  // Check for correct T-SQL date function usage
  if (sql.includes('current_date') && !sql.includes('GETDATE()')) {
    warnings.push({
      severity: 'warning',
      code: 'SYNAPSE_SYNTAX',
      message: 'Use GETDATE() instead of current_date for T-SQL compatibility',
      suggestion: 'Change "current_date" to "GETDATE()"',
    });
  }
}

function validatePopulationId(
  sql: string,
  populationId: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  // Check if population_id is used
  if (!sql.toLowerCase().includes('population_id')) {
    errors.push({
      severity: 'error',
      code: 'MISSING_POPULATION_FILTER',
      message: 'SQL does not filter by population_id',
      suggestion: 'Add population_id filter to all CTEs for data isolation',
    });
    return;
  }

  // Check if it's parameterized or hardcoded
  if (populationId.includes('${') || populationId.includes('POPULATION_ID')) {
    // Parameterized - good
    return;
  }

  // Check if the configured population_id is used
  if (!sql.includes(populationId)) {
    warnings.push({
      severity: 'warning',
      code: 'POPULATION_ID_MISMATCH',
      message: 'Configured population_id not found in generated SQL',
      suggestion: 'Verify population_id filter matches configuration',
    });
  }
}

function validateOntologyJoins(
  sql: string,
  _errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  // Check for DEMOG -> ONT joins
  const demogSection = sql.match(/DEMOG\s+as\s*\(([\s\S]*?)\)\s*,?/i);
  if (demogSection) {
    const demogBody = demogSection[1];

    // Should have left joins to ONT for concept resolution
    if (!demogBody.toLowerCase().includes('left join ont')) {
      warnings.push({
        severity: 'warning',
        code: 'MISSING_ONT_JOINS',
        message: 'DEMOG CTE should include LEFT JOINs to ONT for concept resolution',
        suggestion: 'Add LEFT JOIN ONT aliases (GENDO, STATEO, etc.) for terminology normalization',
      });
    }

    // Check for concept_name columns
    if (!demogBody.toLowerCase().includes('concept_name')) {
      warnings.push({
        severity: 'warning',
        code: 'MISSING_CONCEPT_NAMES',
        message: 'DEMOG CTE should select concept_name columns for normalized terminology',
        suggestion: 'Include columns like gender_concept_name, state_concept_name, etc.',
      });
    }
  }
}

function validateSQLSafety(
  sql: string,
  errors: ValidationIssue[],
  _warnings: ValidationIssue[]
): void {
  // Check for potential SQL injection patterns
  const dangerousPatterns = [
    /;\s*drop\s+/i,
    /;\s*delete\s+/i,
    /;\s*update\s+/i,
    /;\s*insert\s+/i,
    /--.*drop/i,
    /\/\*.*drop.*\*\//i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sql)) {
      errors.push({
        severity: 'error',
        code: 'POTENTIAL_SQL_INJECTION',
        message: 'SQL contains potentially dangerous patterns',
        suggestion: 'Review SQL for injection vulnerabilities',
      });
      break;
    }
  }

  // Check for unescaped user input indicators
  if (/\$\{[^}]*\}/.test(sql) && !/'\$\{[^}]*\}'/.test(sql)) {
    _warnings.push({
      severity: 'warning',
      code: 'UNQUOTED_PARAMETER',
      message: 'Template parameters should be properly quoted',
      suggestion: 'Ensure string parameters are wrapped in single quotes',
    });
  }
}

function validateSyntax(
  sql: string,
  errors: ValidationIssue[]
): void {
  // Check balanced parentheses
  let parenCount = 0;
  let line = 1;
  for (let i = 0; i < sql.length; i++) {
    if (sql[i] === '(') parenCount++;
    if (sql[i] === ')') parenCount--;
    if (sql[i] === '\n') line++;

    if (parenCount < 0) {
      errors.push({
        severity: 'error',
        code: 'UNBALANCED_PARENS',
        message: 'Unexpected closing parenthesis',
        line,
      });
      break;
    }
  }

  if (parenCount > 0) {
    errors.push({
      severity: 'error',
      code: 'UNBALANCED_PARENS',
      message: `${parenCount} unclosed parenthesis(es)`,
    });
  }

  // Check balanced single quotes (simple check - not handling escaped quotes)
  const singleQuotes = (sql.match(/'/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    errors.push({
      severity: 'error',
      code: 'UNBALANCED_QUOTES',
      message: 'Unbalanced single quotes detected',
      suggestion: 'Check for unclosed string literals',
    });
  }
}

// ============================================================================
// Detailed Validator for Production Use
// ============================================================================

export function validateHDISQLDetailed(
  sql: string,
  config: SQLGenerationConfig
): {
  result: SQLValidationResult;
  cteAnalysis: CTEAnalysis;
  columnAnalysis: ColumnAnalysis;
} {
  const result = validateHDISQL(sql, config);
  const cteAnalysis = analyzeCTEs(sql);
  const columnAnalysis = analyzeColumns(sql);

  return {
    result,
    cteAnalysis,
    columnAnalysis,
  };
}

interface CTEAnalysis {
  total: number;
  names: string[];
  predicates: string[];
  populations: string[];
  dependencies: Record<string, string[]>;
}

interface ColumnAnalysis {
  selectColumns: Record<string, string[]>;
  joinConditions: string[];
  filterConditions: string[];
}

function analyzeCTEs(sql: string): CTEAnalysis {
  const names: string[] = [];
  const predicates: string[] = [];
  const populations: string[] = [];
  const dependencies: Record<string, string[]> = {};

  // Extract all CTE names
  const cteMatches = sql.matchAll(/\b([A-Z_][A-Z0-9_]*)\s+as\s*\(/gi);
  for (const match of cteMatches) {
    const name = match[1].toUpperCase();
    names.push(name);

    if (name.startsWith('PRED_')) {
      predicates.push(name);
    } else if (['INITIAL_POPULATION', 'DENOMINATOR', 'NUMERATOR',
                'DENOM_EXCLUSION', 'NUM_EXCLUSION'].includes(name)) {
      populations.push(name);
    }

    // Find dependencies (other CTEs referenced in this CTE's body)
    const cteBodyMatch = sql.match(new RegExp(`${name}\\s+as\\s*\\(([\\s\\S]*?)\\)\\s*[,)]`, 'i'));
    if (cteBodyMatch) {
      const body = cteBodyMatch[1];
      const deps = names.filter(n => n !== name && body.toUpperCase().includes(n));
      dependencies[name] = deps;
    }
  }

  return {
    total: names.length,
    names,
    predicates,
    populations,
    dependencies,
  };
}

function analyzeColumns(sql: string): ColumnAnalysis {
  const selectColumns: Record<string, string[]> = {};
  const joinConditions: string[] = [];
  const filterConditions: string[] = [];

  // Extract SELECT columns for each CTE
  const cteMatches = sql.matchAll(/\b([A-Z_][A-Z0-9_]*)\s+as\s*\(\s*select([\s\S]*?)from/gi);
  for (const match of cteMatches) {
    const cteName = match[1].toUpperCase();
    const selectClause = match[2];

    // Parse column list (simplified)
    const columns = selectClause
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0)
      .map(c => {
        // Extract alias if present
        const aliasMatch = c.match(/as\s+([a-z_][a-z0-9_]*)\s*$/i);
        return aliasMatch ? aliasMatch[1] : c.split('.').pop() || c;
      });

    selectColumns[cteName] = columns;
  }

  // Extract JOIN conditions
  const joinMatches = sql.matchAll(/\bon\s+([\s\S]*?)(?=\bleft join|\binner join|\bright join|\bwhere|\bgroup by|$)/gi);
  for (const match of joinMatches) {
    joinConditions.push(match[1].trim());
  }

  // Extract WHERE conditions
  const whereMatches = sql.matchAll(/\bwhere\s+([\s\S]*?)(?=\bgroup by|\border by|\bunion|\bintersect|\bexcept|\))/gi);
  for (const match of whereMatches) {
    filterConditions.push(match[1].trim());
  }

  return {
    selectColumns,
    joinConditions,
    filterConditions,
  };
}
