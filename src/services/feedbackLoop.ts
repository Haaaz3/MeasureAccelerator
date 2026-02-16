/**
 * Feedback Loop Service
 *
 * Captures corrections made by users to improve future extractions.
 * Implements both component-level feedback (5.A) and code-level feedback (5.B).
 *
 * Key features:
 * - Structured capture of before/after states
 * - Diff calculation for changes
 * - Persistent storage via localStorage/IndexedDB
 * - Few-shot learning prompt generation
 * - Pattern analysis for systematic issues
 */

import type { DataElement, TimingRequirement } from '../types/ums';

// ============================================================================
// Types - Component Feedback (5.A)
// ============================================================================

export interface ComponentFeedback {
  id: string;
  componentId: string;
  measureId: string;
  timestamp: string;

  // What the LLM originally extracted
  original: ComponentSnapshot;

  // What the human corrected it to
  corrected: ComponentSnapshot;

  // Detailed changes
  changes: ComponentChange[];

  // The original spec text this component came from (for audit)
  sourceText?: string;

  // User's notes
  userNotes?: string;
}

export interface ComponentSnapshot {
  description?: string;
  oid?: string;
  valueSetName?: string;
  timing?: TimingRequirement[];
  negation?: boolean;
  dataType?: string;
  thresholds?: {
    ageMin?: number;
    ageMax?: number;
    valueMin?: number;
    valueMax?: number;
  };
}

export interface ComponentChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: ComponentChangeType;
  reason?: string;
}

export type ComponentChangeType =
  | 'oid_correction'
  | 'timing_correction'
  | 'negation_correction'
  | 'data_type_correction'
  | 'description_correction'
  | 'threshold_correction'
  | 'value_set_name_correction'
  | 'other';

// ============================================================================
// Types - Code Feedback (5.B)
// ============================================================================

export interface CodeFeedback {
  id: string;
  componentId?: string;
  measureId: string;
  timestamp: string;

  // What the generator produced
  generatedCode: string;

  // What the user changed it to
  correctedCode: string;

  // Format of the code
  format: 'cql' | 'sql' | 'hdi_sql';

  // Structured diff
  diff: CodeDiff;

  // User's explanation
  editNote: string;
}

export interface CodeDiff {
  type: CodeDiffType;
  detail: string;
  linesChanged: number;
  addedLines?: string[];
  removedLines?: string[];
}

export type CodeDiffType =
  | 'syntax_fix'
  | 'logic_fix'
  | 'schema_fix'
  | 'timing_fix'
  | 'value_set_fix'
  | 'pattern_fix'
  | 'performance_fix'
  | 'other';

// ============================================================================
// Types - Analysis
// ============================================================================

export interface FeedbackAnalysis {
  totalComponentFeedback: number;
  totalCodeFeedback: number;
  commonComponentIssues: IssuePattern[];
  commonCodeIssues: IssuePattern[];
  recentFeedback: Array<ComponentFeedback | CodeFeedback>;
}

export interface IssuePattern {
  pattern: string;
  occurrences: number;
  examples: string[];
  recommendation: string;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  componentFeedback: 'algoAccel_componentFeedback',
  codeFeedback: 'algoAccel_codeFeedback',
};

// ============================================================================
// Component Feedback Functions (5.A)
// ============================================================================

/**
 * Calculate changes between two component states
 */
export function calculateComponentChanges(
  original: ComponentSnapshot,
  corrected: ComponentSnapshot
): ComponentChange[] {
  const changes: ComponentChange[] = [];

  // OID change
  if (original.oid !== corrected.oid) {
    changes.push({
      field: 'oid',
      oldValue: original.oid,
      newValue: corrected.oid,
      changeType: 'oid_correction',
    });
  }

  // Value set name change
  if (original.valueSetName !== corrected.valueSetName) {
    changes.push({
      field: 'valueSetName',
      oldValue: original.valueSetName,
      newValue: corrected.valueSetName,
      changeType: 'value_set_name_correction',
    });
  }

  // Data type change
  if (original.dataType !== corrected.dataType) {
    changes.push({
      field: 'dataType',
      oldValue: original.dataType,
      newValue: corrected.dataType,
      changeType: 'data_type_correction',
    });
  }

  // Negation change
  if (original.negation !== corrected.negation) {
    changes.push({
      field: 'negation',
      oldValue: original.negation,
      newValue: corrected.negation,
      changeType: 'negation_correction',
    });
  }

  // Description change
  if (original.description !== corrected.description) {
    changes.push({
      field: 'description',
      oldValue: original.description,
      newValue: corrected.description,
      changeType: 'description_correction',
    });
  }

  // Timing changes
  const timingChanged = JSON.stringify(original.timing) !== JSON.stringify(corrected.timing);
  if (timingChanged) {
    changes.push({
      field: 'timing',
      oldValue: original.timing,
      newValue: corrected.timing,
      changeType: 'timing_correction',
    });
  }

  // Threshold changes
  const thresholdsChanged = JSON.stringify(original.thresholds) !== JSON.stringify(corrected.thresholds);
  if (thresholdsChanged) {
    changes.push({
      field: 'thresholds',
      oldValue: original.thresholds,
      newValue: corrected.thresholds,
      changeType: 'threshold_correction',
    });
  }

  return changes;
}

/**
 * Create a snapshot from a DataElement
 */
export function snapshotFromDataElement(element: DataElement): ComponentSnapshot {
  return {
    description: element.description,
    oid: element.valueSet?.oid,
    valueSetName: element.valueSet?.name,
    timing: element.timingRequirements,
    negation: element.negation,
    dataType: element.type,
    thresholds: element.thresholds,
  };
}

/**
 * Record component feedback
 */
export function recordComponentFeedback(
  componentId: string,
  measureId: string,
  original: ComponentSnapshot,
  corrected: ComponentSnapshot,
  options?: {
    sourceText?: string;
    userNotes?: string;
  }
): ComponentFeedback {
  const feedback: ComponentFeedback = {
    id: `cf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    componentId,
    measureId,
    timestamp: new Date().toISOString(),
    original,
    corrected,
    changes: calculateComponentChanges(original, corrected),
    sourceText: options?.sourceText,
    userNotes: options?.userNotes,
  };

  // Save to storage
  const existing = getComponentFeedback();
  existing.push(feedback);
  saveComponentFeedback(existing);

  return feedback;
}

/**
 * Get all component feedback
 */
export function getComponentFeedback(): ComponentFeedback[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.componentFeedback);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save component feedback
 */
function saveComponentFeedback(feedback: ComponentFeedback[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.componentFeedback, JSON.stringify(feedback));
  } catch (e) {
    console.error('Failed to save component feedback:', e);
  }
}

// ============================================================================
// Code Feedback Functions (5.B)
// ============================================================================

/**
 * Calculate code diff
 */
export function calculateCodeDiff(
  generated: string,
  corrected: string
): CodeDiff {
  const generatedLines = generated.split('\n');
  const correctedLines = corrected.split('\n');

  const addedLines: string[] = [];
  const removedLines: string[] = [];

  // Simple line-by-line diff
  const generatedSet = new Set(generatedLines);
  const correctedSet = new Set(correctedLines);

  for (const line of correctedLines) {
    if (!generatedSet.has(line) && line.trim()) {
      addedLines.push(line);
    }
  }

  for (const line of generatedLines) {
    if (!correctedSet.has(line) && line.trim()) {
      removedLines.push(line);
    }
  }

  // Detect diff type based on changes
  const diffType = detectDiffType(removedLines, addedLines);

  return {
    type: diffType,
    detail: generateDiffDetail(diffType, removedLines, addedLines),
    linesChanged: addedLines.length + removedLines.length,
    addedLines,
    removedLines,
  };
}

/**
 * Detect the type of code change
 */
function detectDiffType(removed: string[], added: string[]): CodeDiffType {
  const allChanges = [...removed, ...added].join('\n').toLowerCase();

  // Check for timing-related changes
  if (
    allChanges.includes('dateadd') ||
    allChanges.includes('datediff') ||
    allChanges.includes('interval') ||
    allChanges.includes('during') ||
    allChanges.includes('before') ||
    allChanges.includes('after')
  ) {
    return 'timing_fix';
  }

  // Check for value set changes
  if (
    allChanges.includes('valueset') ||
    allChanges.includes('oid') ||
    allChanges.includes('2.16.840')
  ) {
    return 'value_set_fix';
  }

  // Check for schema changes
  if (
    allChanges.includes('_id') ||
    allChanges.includes('_code') ||
    allChanges.includes('_date') ||
    allChanges.includes('ph_f_') ||
    allChanges.includes('ph_d_')
  ) {
    return 'schema_fix';
  }

  // Check for logic changes
  if (
    allChanges.includes('and') ||
    allChanges.includes('or') ||
    allChanges.includes('not') ||
    allChanges.includes('exists') ||
    allChanges.includes('intersect') ||
    allChanges.includes('union') ||
    allChanges.includes('except')
  ) {
    return 'logic_fix';
  }

  // Check for syntax fixes
  if (
    removed.some(l => l.includes('syntax')) ||
    added.some(l => l.includes('syntax')) ||
    removed.length <= 2
  ) {
    return 'syntax_fix';
  }

  return 'other';
}

/**
 * Generate a human-readable diff detail
 */
function generateDiffDetail(type: CodeDiffType, removed: string[], added: string[]): string {
  const descriptions: Record<CodeDiffType, string> = {
    syntax_fix: 'Fixed syntax error',
    logic_fix: 'Corrected logic/boolean expression',
    schema_fix: 'Fixed table/column reference',
    timing_fix: 'Corrected timing/date expression',
    value_set_fix: 'Fixed value set reference',
    pattern_fix: 'Changed code pattern/structure',
    performance_fix: 'Optimized for performance',
    other: 'General code change',
  };

  const base = descriptions[type];
  const stats = `(${removed.length} lines removed, ${added.length} lines added)`;

  return `${base} ${stats}`;
}

/**
 * Record code feedback
 */
export function recordCodeFeedback(
  measureId: string,
  generatedCode: string,
  correctedCode: string,
  format: 'cql' | 'sql' | 'hdi_sql',
  editNote: string,
  componentId?: string
): CodeFeedback {
  const feedback: CodeFeedback = {
    id: `cdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    componentId,
    measureId,
    timestamp: new Date().toISOString(),
    generatedCode,
    correctedCode,
    format,
    diff: calculateCodeDiff(generatedCode, correctedCode),
    editNote,
  };

  // Save to storage
  const existing = getCodeFeedback();
  existing.push(feedback);
  saveCodeFeedback(existing);

  return feedback;
}

/**
 * Get all code feedback
 */
export function getCodeFeedback(): CodeFeedback[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.codeFeedback);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save code feedback
 */
function saveCodeFeedback(feedback: CodeFeedback[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.codeFeedback, JSON.stringify(feedback));
  } catch (e) {
    console.error('Failed to save code feedback:', e);
  }
}

// ============================================================================
// Feedback Analysis
// ============================================================================

/**
 * Analyze feedback to find systematic issues
 */
export function analyzeFeedback(): FeedbackAnalysis {
  const componentFeedback = getComponentFeedback();
  const codeFeedback = getCodeFeedback();

  return {
    totalComponentFeedback: componentFeedback.length,
    totalCodeFeedback: codeFeedback.length,
    commonComponentIssues: findCommonComponentIssues(componentFeedback),
    commonCodeIssues: findCommonCodeIssues(codeFeedback),
    recentFeedback: [
      ...componentFeedback.slice(-5),
      ...codeFeedback.slice(-5),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10),
  };
}

/**
 * Find common component issues
 */
function findCommonComponentIssues(feedback: ComponentFeedback[]): IssuePattern[] {
  const patterns: Map<string, { count: number; examples: ComponentFeedback[] }> = new Map();

  for (const fb of feedback) {
    for (const change of fb.changes) {
      const key = change.changeType;
      const existing = patterns.get(key) || { count: 0, examples: [] };
      existing.count++;
      if (existing.examples.length < 3) {
        existing.examples.push(fb);
      }
      patterns.set(key, existing);
    }
  }

  return Array.from(patterns.entries())
    .filter(([_, data]) => data.count >= 2)
    .map(([pattern, data]) => ({
      pattern,
      occurrences: data.count,
      examples: data.examples.map(ex =>
        `${ex.measureId}: ${ex.changes.find(c => c.changeType === pattern)?.field}`
      ),
      recommendation: generateComponentRecommendation(pattern as ComponentChangeType),
    }))
    .sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Find common code issues
 */
function findCommonCodeIssues(feedback: CodeFeedback[]): IssuePattern[] {
  const patterns: Map<string, { count: number; examples: CodeFeedback[] }> = new Map();

  for (const fb of feedback) {
    const key = `${fb.format}:${fb.diff.type}`;
    const existing = patterns.get(key) || { count: 0, examples: [] };
    existing.count++;
    if (existing.examples.length < 3) {
      existing.examples.push(fb);
    }
    patterns.set(key, existing);
  }

  return Array.from(patterns.entries())
    .filter(([_, data]) => data.count >= 2)
    .map(([pattern, data]) => ({
      pattern,
      occurrences: data.count,
      examples: data.examples.map(ex => ex.editNote.substring(0, 50)),
      recommendation: `Generator template for ${pattern.split(':')[0]} ${pattern.split(':')[1]} needs review`,
    }))
    .sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Generate recommendation based on change type
 */
function generateComponentRecommendation(changeType: ComponentChangeType): string {
  const recommendations: Record<ComponentChangeType, string> = {
    oid_correction: 'Improve OID extraction prompt or add to validation catalog',
    timing_correction: 'Review timing expression parsing in extraction prompt',
    negation_correction: 'Add explicit negation detection in extraction',
    data_type_correction: 'Review data type mapping logic',
    description_correction: 'Minor issue - descriptions are for display only',
    threshold_correction: 'Review numeric value extraction',
    value_set_name_correction: 'Improve value set name normalization',
    other: 'Review extraction prompt for this pattern',
  };

  return recommendations[changeType];
}

// ============================================================================
// Few-Shot Learning Prompt Generation
// ============================================================================

/**
 * Generate few-shot examples for extraction prompts
 */
export function generateFewShotExamples(
  measureType?: string,
  limit: number = 5
): string {
  const componentFeedback = getComponentFeedback();

  // Filter by measure type if provided
  let relevantFeedback = componentFeedback;
  if (measureType) {
    relevantFeedback = componentFeedback.filter(fb =>
      fb.measureId.toLowerCase().includes(measureType.toLowerCase())
    );
  }

  // Get most recent with significant changes
  const withSignificantChanges = relevantFeedback
    .filter(fb => fb.changes.length > 0)
    .slice(-limit * 2)
    .slice(0, limit);

  if (withSignificantChanges.length === 0) {
    return '';
  }

  const examples = withSignificantChanges.map(fb => {
    const changeDescriptions = fb.changes.map(c =>
      `- ${c.field}: "${c.oldValue}" → "${c.newValue}"`
    ).join('\n');

    return `Example correction (${fb.measureId}):
Original extraction: ${JSON.stringify(fb.original, null, 2)}
Corrected to: ${JSON.stringify(fb.corrected, null, 2)}
Changes made:
${changeDescriptions}
${fb.userNotes ? `Reason: ${fb.userNotes}` : ''}`;
  });

  return `
Here are common corrections our team has made to LLM extractions:

${examples.join('\n\n---\n\n')}

Please learn from these corrections to improve extraction accuracy.
`;
}

/**
 * Generate code correction examples for code generation prompts
 */
export function generateCodeCorrectionExamples(
  format: 'cql' | 'sql' | 'hdi_sql',
  limit: number = 3
): string {
  const codeFeedback = getCodeFeedback()
    .filter(fb => fb.format === format)
    .slice(-limit);

  if (codeFeedback.length === 0) {
    return '';
  }

  const examples = codeFeedback.map(fb => `
Correction (${fb.diff.type}):
Generated: ${fb.generatedCode.substring(0, 200)}...
Corrected: ${fb.correctedCode.substring(0, 200)}...
Note: ${fb.editNote}
`);

  return `
Common code corrections for ${format.toUpperCase()}:
${examples.join('\n---\n')}
`;
}

// ============================================================================
// Clear/Export Functions
// ============================================================================

/**
 * Clear all feedback (use with caution)
 */
export function clearAllFeedback(): void {
  localStorage.removeItem(STORAGE_KEYS.componentFeedback);
  localStorage.removeItem(STORAGE_KEYS.codeFeedback);
}

/**
 * Export feedback as JSON for backup/analysis
 */
export function exportFeedback(): string {
  return JSON.stringify({
    componentFeedback: getComponentFeedback(),
    codeFeedback: getCodeFeedback(),
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

/**
 * Import feedback from JSON
 */
export function importFeedback(json: string): { imported: number; errors: string[] } {
  const errors: string[] = [];
  let imported = 0;

  try {
    const data = JSON.parse(json);

    if (data.componentFeedback && Array.isArray(data.componentFeedback)) {
      const existing = getComponentFeedback();
      const existingIds = new Set(existing.map(f => f.id));

      for (const fb of data.componentFeedback) {
        if (!existingIds.has(fb.id)) {
          existing.push(fb);
          imported++;
        }
      }
      saveComponentFeedback(existing);
    }

    if (data.codeFeedback && Array.isArray(data.codeFeedback)) {
      const existing = getCodeFeedback();
      const existingIds = new Set(existing.map(f => f.id));

      for (const fb of data.codeFeedback) {
        if (!existingIds.has(fb.id)) {
          existing.push(fb);
          imported++;
        }
      }
      saveCodeFeedback(existing);
    }
  } catch (e) {
    errors.push(`Failed to parse feedback JSON: ${e}`);
  }

  return { imported, errors };
}

// ============================================================================
// Feedback Stats
// ============================================================================

export interface FeedbackStats {
  totalCorrections: number;
  componentCorrections: number;
  codeCorrections: number;
  mostCommonIssue?: string;
  lastCorrectionDate?: string;
}

/**
 * Get feedback statistics
 */
export function getFeedbackStats(): FeedbackStats {
  const componentFeedback = getComponentFeedback();
  const codeFeedback = getCodeFeedback();

  const analysis = analyzeFeedback();
  const mostCommonIssue =
    analysis.commonComponentIssues[0]?.pattern ||
    analysis.commonCodeIssues[0]?.pattern;

  const allFeedback = [...componentFeedback, ...codeFeedback];
  const lastCorrection = allFeedback.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];

  return {
    totalCorrections: componentFeedback.length + codeFeedback.length,
    componentCorrections: componentFeedback.length,
    codeCorrections: codeFeedback.length,
    mostCommonIssue,
    lastCorrectionDate: lastCorrection?.timestamp,
  };
}
