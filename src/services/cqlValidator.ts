/**
 * CQL Validation Service
 *
 * Provides comprehensive validation for CQL (Clinical Quality Language) code.
 * Supports both local syntax checking and remote CQL-to-ELM translation.
 *
 * Key features:
 * - Local syntax validation (fast, offline)
 * - Remote ELM translation via CQL Services API
 * - Expression-level validation
 * - Detailed error reporting with line/column info
 * - Library structure validation
 */

// ============================================================================
// Types
// ============================================================================

export interface CQLValidationResult {
  valid: boolean;
  errors: CQLValidationError[];
  warnings: CQLValidationWarning[];
  elm?: string;
  metadata?: {
    libraryName?: string;
    version?: string;
    definitionCount?: number;
    valueSetCount?: number;
  };
}

export interface CQLValidationError {
  severity: 'error';
  code: CQLErrorCode;
  message: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  context?: string;
  suggestion?: string;
}

export interface CQLValidationWarning {
  severity: 'warning';
  code: CQLWarningCode;
  message: string;
  line?: number;
  column?: number;
  context?: string;
}

export type CQLErrorCode =
  | 'SYNTAX_ERROR'
  | 'UNBALANCED_QUOTES'
  | 'UNBALANCED_PARENS'
  | 'UNBALANCED_BRACKETS'
  | 'INVALID_IDENTIFIER'
  | 'MISSING_LIBRARY'
  | 'MISSING_USING'
  | 'MISSING_CONTEXT'
  | 'INVALID_EXPRESSION'
  | 'UNDEFINED_REFERENCE'
  | 'TYPE_MISMATCH'
  | 'TRANSLATION_ERROR'
  | 'SERVICE_UNAVAILABLE';

export type CQLWarningCode =
  | 'EMPTY_DEFINITION'
  | 'UNUSED_VALUESET'
  | 'DEPRECATED_SYNTAX'
  | 'MISSING_DESCRIPTION'
  | 'PERFORMANCE_CONCERN';

export interface CQLValidatorOptions {
  serviceUrl?: string;
  timeout?: number;
  skipRemoteValidation?: boolean;
  strictMode?: boolean;
}

// ============================================================================
// Local Syntax Validation
// ============================================================================

/**
 * Perform local syntax validation on CQL code.
 * This is fast and doesn't require external services.
 */
export function validateCQLSyntax(cql: string): CQLValidationResult {
  const errors: CQLValidationError[] = [];
  const warnings: CQLValidationWarning[] = [];
  const lines = cql.split('\n');

  // Check for balanced delimiters
  const delimiterErrors = checkBalancedDelimiters(cql);
  errors.push(...delimiterErrors);

  // Check for required library structure
  const structureErrors = checkLibraryStructure(cql, lines);
  errors.push(...structureErrors);

  // Check for common syntax issues
  const syntaxErrors = checkCommonSyntaxIssues(cql, lines);
  errors.push(...syntaxErrors);

  // Check for potential issues (warnings)
  const potentialWarnings = checkPotentialIssues(cql, lines);
  warnings.push(...potentialWarnings);

  // Extract metadata
  const metadata = extractCQLMetadata(cql);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata,
  };
}

/**
 * Check for balanced delimiters (quotes, parentheses, brackets)
 */
function checkBalancedDelimiters(cql: string): CQLValidationError[] {
  const errors: CQLValidationError[] = [];

  // Track delimiter positions for better error reporting
  let inString = false;
  let inComment = false;
  let stringChar = '';
  let parenCount = 0;
  let bracketCount = 0;
  let lineNum = 1;
  let colNum = 1;

  const parenStack: Array<{ line: number; col: number }> = [];
  const bracketStack: Array<{ line: number; col: number }> = [];

  for (let i = 0; i < cql.length; i++) {
    const char = cql[i];
    const nextChar = cql[i + 1];

    // Track position
    if (char === '\n') {
      lineNum++;
      colNum = 1;
      inComment = false; // Single-line comment ends
      continue;
    }
    colNum++;

    // Handle comments
    if (!inString) {
      if (char === '/' && nextChar === '/') {
        inComment = true;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        // Find end of block comment
        const endIdx = cql.indexOf('*/', i + 2);
        if (endIdx === -1) {
          errors.push({
            severity: 'error',
            code: 'SYNTAX_ERROR',
            message: 'Unclosed block comment',
            line: lineNum,
            column: colNum,
          });
        }
        i = endIdx + 1;
        continue;
      }
    }

    if (inComment) continue;

    // Handle strings
    if ((char === '"' || char === "'") && cql[i - 1] !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (inString) continue;

    // Track parentheses
    if (char === '(') {
      parenStack.push({ line: lineNum, col: colNum });
      parenCount++;
    } else if (char === ')') {
      if (parenStack.length === 0) {
        errors.push({
          severity: 'error',
          code: 'UNBALANCED_PARENS',
          message: 'Unexpected closing parenthesis',
          line: lineNum,
          column: colNum,
        });
      } else {
        parenStack.pop();
      }
      parenCount--;
    }

    // Track brackets
    if (char === '[') {
      bracketStack.push({ line: lineNum, col: colNum });
      bracketCount++;
    } else if (char === ']') {
      if (bracketStack.length === 0) {
        errors.push({
          severity: 'error',
          code: 'UNBALANCED_BRACKETS',
          message: 'Unexpected closing bracket',
          line: lineNum,
          column: colNum,
        });
      } else {
        bracketStack.pop();
      }
      bracketCount--;
    }
  }

  // Check for unclosed strings
  if (inString) {
    errors.push({
      severity: 'error',
      code: 'UNBALANCED_QUOTES',
      message: `Unclosed string literal (started with ${stringChar})`,
    });
  }

  // Check for unclosed parentheses
  for (const pos of parenStack) {
    errors.push({
      severity: 'error',
      code: 'UNBALANCED_PARENS',
      message: 'Unclosed parenthesis',
      line: pos.line,
      column: pos.col,
    });
  }

  // Check for unclosed brackets
  for (const pos of bracketStack) {
    errors.push({
      severity: 'error',
      code: 'UNBALANCED_BRACKETS',
      message: 'Unclosed bracket',
      line: pos.line,
      column: pos.col,
    });
  }

  return errors;
}

/**
 * Check for required CQL library structure
 */
function checkLibraryStructure(cql: string, lines: string[]): CQLValidationError[] {
  const errors: CQLValidationError[] = [];

  // Check for library declaration
  const libraryMatch = cql.match(/library\s+(\w+)(\s+version\s+'[^']+')?\s*/);
  if (!libraryMatch) {
    errors.push({
      severity: 'error',
      code: 'MISSING_LIBRARY',
      message: 'Missing library declaration',
      suggestion: "Add 'library LibraryName version '1.0.0'' at the start of your CQL",
    });
  }

  // Check for FHIR using declaration
  const usingMatch = cql.match(/using\s+FHIR\s+version\s+'[^']+'/);
  if (!usingMatch) {
    errors.push({
      severity: 'error',
      code: 'MISSING_USING',
      message: 'Missing FHIR using declaration',
      suggestion: "Add 'using FHIR version '4.0.1'' after the library declaration",
    });
  }

  // Check for context declaration
  const contextMatch = cql.match(/context\s+(Patient|Unfiltered|Population)/);
  if (!contextMatch) {
    errors.push({
      severity: 'error',
      code: 'MISSING_CONTEXT',
      message: 'Missing context declaration',
      suggestion: "Add 'context Patient' before your definitions",
    });
  }

  return errors;
}

/**
 * Check for common syntax issues
 */
function checkCommonSyntaxIssues(cql: string, lines: string[]): CQLValidationError[] {
  const errors: CQLValidationError[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) {
      continue;
    }

    // Check for empty quoted identifiers
    if (line.includes('""')) {
      const col = line.indexOf('""') + 1;
      errors.push({
        severity: 'error',
        code: 'INVALID_IDENTIFIER',
        message: 'Empty quoted identifier',
        line: lineNum,
        column: col,
        context: line.trim(),
      });
    }

    // Check for missing colons after define
    const defineMatch = line.match(/^\s*define\s+"[^"]+"\s*$/);
    if (defineMatch && i < lines.length - 1) {
      const nextLine = lines[i + 1].trim();
      if (!nextLine.startsWith(':') && !line.includes(':')) {
        errors.push({
          severity: 'error',
          code: 'SYNTAX_ERROR',
          message: 'Missing colon after define statement',
          line: lineNum,
          suggestion: 'Add a colon after the definition name',
        });
      }
    }

    // Check for common typos
    const typoPatterns: Array<{ pattern: RegExp; message: string; suggestion: string }> = [
      { pattern: /\bexsits\b/i, message: "Typo: 'exsits'", suggestion: "Did you mean 'exists'?" },
      { pattern: /\bwehre\b/i, message: "Typo: 'wehre'", suggestion: "Did you mean 'where'?" },
      { pattern: /\binteval\b/i, message: "Typo: 'inteval'", suggestion: "Did you mean 'Interval'?" },
      { pattern: /\bpatinet\b/i, message: "Typo: 'patinet'", suggestion: "Did you mean 'Patient'?" },
    ];

    for (const { pattern, message, suggestion } of typoPatterns) {
      const match = line.match(pattern);
      if (match) {
        errors.push({
          severity: 'error',
          code: 'SYNTAX_ERROR',
          message,
          line: lineNum,
          column: (match.index || 0) + 1,
          suggestion,
          context: line.trim(),
        });
      }
    }
  }

  return errors;
}

/**
 * Check for potential issues (warnings)
 */
function checkPotentialIssues(cql: string, lines: string[]): CQLValidationWarning[] {
  const warnings: CQLValidationWarning[] = [];

  // Check for empty definitions
  const defineRegex = /define\s+"([^"]+)":\s*\n\s*true\s*$/gm;
  let match;
  while ((match = defineRegex.exec(cql)) !== null) {
    const line = cql.substring(0, match.index).split('\n').length;
    warnings.push({
      severity: 'warning',
      code: 'EMPTY_DEFINITION',
      message: `Definition "${match[1]}" always returns true - may be a placeholder`,
      line,
    });
  }

  // Check for unused value sets
  const valueSetDecls = cql.match(/valueset\s+"([^"]+)":/g) || [];
  for (const decl of valueSetDecls) {
    const vsName = decl.match(/valueset\s+"([^"]+)":/)?.[1];
    if (vsName) {
      // Count references (exclude the declaration itself)
      const references = (cql.match(new RegExp(`"${vsName}"`, 'g')) || []).length;
      if (references <= 1) {
        warnings.push({
          severity: 'warning',
          code: 'UNUSED_VALUESET',
          message: `Value set "${vsName}" is declared but never referenced`,
        });
      }
    }
  }

  return warnings;
}

/**
 * Extract metadata from CQL
 */
function extractCQLMetadata(cql: string): CQLValidationResult['metadata'] {
  const libraryMatch = cql.match(/library\s+(\w+)(?:\s+version\s+'([^']+)')?/);
  const definitionCount = (cql.match(/^define\s+"/gm) || []).length;
  const valueSetCount = (cql.match(/^valueset\s+"/gm) || []).length;

  return {
    libraryName: libraryMatch?.[1],
    version: libraryMatch?.[2],
    definitionCount,
    valueSetCount,
  };
}

// ============================================================================
// Remote ELM Translation
// ============================================================================

/**
 * Validate CQL via CQL Services API (translates to ELM)
 */
export async function validateCQLRemote(
  cql: string,
  options: CQLValidatorOptions = {}
): Promise<CQLValidationResult> {
  const {
    serviceUrl = 'http://localhost:8080',
    timeout = 30000,
    skipRemoteValidation = false,
  } = options;

  // First do local validation
  const localResult = validateCQLSyntax(cql);

  // If local validation failed or remote is disabled, return local result
  if (!localResult.valid || skipRemoteValidation) {
    return localResult;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${serviceUrl}/cql/translator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/cql',
        Accept: 'application/elm+json',
      },
      body: cql,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        return {
          ...localResult,
          valid: false,
          errors: [
            ...localResult.errors,
            ...parseTranslatorErrors(errorData),
          ],
          warnings: [
            ...localResult.warnings,
            ...parseTranslatorWarnings(errorData),
          ],
        };
      } catch {
        return {
          ...localResult,
          valid: false,
          errors: [
            ...localResult.errors,
            {
              severity: 'error',
              code: 'TRANSLATION_ERROR',
              message: `Translation failed: ${errorText}`,
            },
          ],
        };
      }
    }

    const elm = await response.text();
    const elmJson = JSON.parse(elm);

    // Check for annotation errors/warnings in ELM
    const annotations = elmJson?.library?.annotation || [];
    const elmErrors = parseELMAnnotations(annotations, 'error');
    const elmWarnings = parseELMAnnotations(annotations, 'warning');

    return {
      valid: elmErrors.length === 0 && localResult.errors.length === 0,
      errors: [...localResult.errors, ...elmErrors],
      warnings: [...localResult.warnings, ...elmWarnings],
      elm: elmErrors.length === 0 ? elm : undefined,
      metadata: localResult.metadata,
    };
  } catch (err) {
    // Handle network/timeout errors
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ...localResult,
        valid: false,
        errors: [
          ...localResult.errors,
          {
            severity: 'error',
            code: 'SERVICE_UNAVAILABLE',
            message: `CQL Services request timed out after ${timeout}ms`,
          },
        ],
      };
    }

    if (err instanceof TypeError && err.message.includes('fetch')) {
      return {
        ...localResult,
        warnings: [
          ...localResult.warnings,
          {
            severity: 'warning',
            code: 'PERFORMANCE_CONCERN',
            message: `CQL Services unavailable at ${serviceUrl}. Using local validation only.`,
          },
        ],
      };
    }

    return {
      ...localResult,
      valid: false,
      errors: [
        ...localResult.errors,
        {
          severity: 'error',
          code: 'TRANSLATION_ERROR',
          message: err instanceof Error ? err.message : 'Unknown validation error',
        },
      ],
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${serviceUrl}/cql/translator`, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.status !== 404;
  } catch {
    return false;
  }
}

// ============================================================================
// Expression Validation
// ============================================================================

/**
 * Validate a single CQL expression (not a full library)
 */
export function validateCQLExpression(expression: string): CQLValidationResult {
  const errors: CQLValidationError[] = [];
  const warnings: CQLValidationWarning[] = [];

  // Check for balanced delimiters
  const delimiterErrors = checkBalancedDelimiters(expression);
  errors.push(...delimiterErrors);

  // Check for empty expression
  if (!expression.trim()) {
    errors.push({
      severity: 'error',
      code: 'INVALID_EXPRESSION',
      message: 'Expression cannot be empty',
    });
  }

  // Check for basic syntax patterns
  const validPatterns = [
    /^exists\s*\(/,
    /^\[.+\]/,
    /^".+"$/,
    /^true$/i,
    /^false$/i,
    /^null$/i,
    /^\d+$/,
    /^Patient\./,
    /^AgeIn/,
    /^\(/,
  ];

  const trimmed = expression.trim();
  const startsWithValid = validPatterns.some(p => p.test(trimmed));

  if (!startsWithValid && errors.length === 0) {
    // Check if it looks like a reference to a definition
    if (!/^"[^"]+"$/.test(trimmed) && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      warnings.push({
        severity: 'warning',
        code: 'DEPRECATED_SYNTAX',
        message: 'Expression may not be valid CQL syntax',
        context: trimmed.substring(0, 50),
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseTranslatorErrors(data: unknown): CQLValidationError[] {
  if (Array.isArray(data)) {
    return data
      .filter((item: any) => item.severity === 'error')
      .map((item: any) => ({
        severity: 'error' as const,
        code: 'TRANSLATION_ERROR' as CQLErrorCode,
        message: item.message || 'Unknown error',
        line: item.line,
        column: item.column,
      }));
  }

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, any>;
    if (obj.errorExceptions) {
      return obj.errorExceptions.map((e: any) => ({
        severity: 'error' as const,
        code: 'TRANSLATION_ERROR' as CQLErrorCode,
        message: e.message || 'Translation error',
        line: e.startLine,
        column: e.startChar,
      }));
    }

    if (obj.message) {
      return [{
        severity: 'error',
        code: 'TRANSLATION_ERROR',
        message: obj.message,
      }];
    }
  }

  return [];
}

function parseTranslatorWarnings(data: unknown): CQLValidationWarning[] {
  if (Array.isArray(data)) {
    return data
      .filter((item: any) => item.severity === 'warning')
      .map((item: any) => ({
        severity: 'warning' as const,
        code: 'DEPRECATED_SYNTAX' as CQLWarningCode,
        message: item.message || 'Warning',
        line: item.line,
        column: item.column,
      }));
  }

  return [];
}

function parseELMAnnotations(
  annotations: any[],
  severity: 'error' | 'warning'
): Array<CQLValidationError | CQLValidationWarning> {
  return annotations
    .filter((a: any) => a.errorSeverity === severity)
    .map((a: any) => ({
      severity,
      code: severity === 'error' ? 'TRANSLATION_ERROR' as CQLErrorCode : 'DEPRECATED_SYNTAX' as CQLWarningCode,
      message: a.message,
      line: a.locator?.start?.line,
      column: a.locator?.start?.column,
      endLine: a.locator?.end?.line,
      endColumn: a.locator?.end?.column,
    }));
}

// ============================================================================
// Validation Report Generation
// ============================================================================

export interface CQLValidationReport {
  summary: {
    valid: boolean;
    errorCount: number;
    warningCount: number;
    libraryName?: string;
  };
  errors: string[];
  warnings: string[];
  details: CQLValidationResult;
}

/**
 * Generate a human-readable validation report
 */
export function generateValidationReport(result: CQLValidationResult): CQLValidationReport {
  const errors = result.errors.map(e => {
    let msg = e.message;
    if (e.line) {
      msg = `Line ${e.line}${e.column ? `:${e.column}` : ''}: ${msg}`;
    }
    if (e.suggestion) {
      msg += ` (${e.suggestion})`;
    }
    return msg;
  });

  const warnings = result.warnings.map(w => {
    let msg = w.message;
    if (w.line) {
      msg = `Line ${w.line}${w.column ? `:${w.column}` : ''}: ${msg}`;
    }
    return msg;
  });

  return {
    summary: {
      valid: result.valid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      libraryName: result.metadata?.libraryName,
    },
    errors,
    warnings,
    details: result,
  };
}

// ============================================================================
// Full Validation Pipeline
// ============================================================================

/**
 * Run full validation pipeline (local + remote if available)
 */
export async function validateCQL(
  cql: string,
  options: CQLValidatorOptions = {}
): Promise<CQLValidationResult> {
  // If strict mode, always try remote validation
  if (options.strictMode) {
    return validateCQLRemote(cql, options);
  }

  // Check if service is available
  const serviceAvailable = options.serviceUrl
    ? await isCQLServiceAvailable(options.serviceUrl)
    : await isCQLServiceAvailable();

  if (serviceAvailable) {
    return validateCQLRemote(cql, options);
  }

  // Fall back to local validation
  return validateCQLSyntax(cql);
}
