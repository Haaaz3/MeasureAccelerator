/**
 * Code Override Helper Service
 *
 * Provides utilities to apply code overrides from componentCodeStore
 * to generated code output. This bridges the gap between individual
 * component overrides and full measure code generation.
 */

import { useComponentCodeStore } from '../stores/componentCodeStore';
import type { UniversalMeasureSpec, DataElement, LogicalClause } from '../types/ums';
import type { CodeOutputFormat, CodeEditNote, CodeOverride } from '../types/componentCode';
import { formatNoteForCodeComment } from '../types/componentCode';

// ============================================================================
// Types
// ============================================================================

export interface OverrideInfo {
  componentId: string;
  componentDescription: string;
  format: CodeOutputFormat;
  override: CodeOverride;
}

export interface OverrideSummary {
  totalOverrides: number;
  overridesByFormat: Record<CodeOutputFormat, number>;
  overrideInfos: OverrideInfo[];
  allNotes: CodeEditNote[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Collect all DataElement IDs from a measure's populations
 */
function collectDataElementIds(measure: UniversalMeasureSpec): Set<string> {
  const ids = new Set<string>();

  const traverse = (node: DataElement | LogicalClause) => {
    if (!node) return;

    if ('type' in node && node.id && !('children' in node)) {
      // It's a DataElement
      ids.add(node.id);
    }

    if ('children' in node && node.children) {
      for (const child of node.children) {
        traverse(child as DataElement | LogicalClause);
      }
    }
  };

  for (const population of measure.populations) {
    if (population.criteria) {
      traverse(population.criteria);
    }
  }

  return ids;
}

/**
 * Get all overrides that apply to a measure's components
 */
export function getOverridesForMeasure(
  measure: UniversalMeasureSpec,
  format?: CodeOutputFormat
): OverrideSummary {
  const store = useComponentCodeStore.getState();
  const componentIds = collectDataElementIds(measure);

  const overrideInfos: OverrideInfo[] = [];
  const allNotes: CodeEditNote[] = [];
  const overridesByFormat: Record<CodeOutputFormat, number> = {
    'cql': 0,
    'synapse-sql': 0,
  };

  for (const componentId of componentIds) {
    const codeState = store.codeStates[componentId];
    if (!codeState) continue;

    for (const [fmt, override] of Object.entries(codeState.overrides)) {
      if (!override?.isLocked) continue;

      // If format filter is specified, only include that format
      if (format && fmt !== format) continue;

      // Find component description
      let description = componentId;
      for (const population of measure.populations) {
        if (population.criteria) {
          const found = findDataElementById(population.criteria, componentId);
          if (found) {
            description = found.description || found.valueSet?.name || componentId;
            break;
          }
        }
      }

      overrideInfos.push({
        componentId,
        componentDescription: description,
        format: fmt as CodeOutputFormat,
        override,
      });

      overridesByFormat[fmt as CodeOutputFormat]++;
      allNotes.push(...override.notes);
    }
  }

  // Sort notes by timestamp (newest first)
  allNotes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    totalOverrides: overrideInfos.length,
    overridesByFormat,
    overrideInfos,
    allNotes,
  };
}

/**
 * Find a DataElement by ID within a criteria tree
 */
function findDataElementById(
  node: DataElement | LogicalClause,
  targetId: string
): DataElement | null {
  if ('type' in node && node.id === targetId && !('children' in node)) {
    return node as DataElement;
  }

  if ('children' in node && node.children) {
    for (const child of node.children) {
      const found = findDataElementById(child as DataElement | LogicalClause, targetId);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Get override for a specific component and format
 */
export function getComponentOverride(
  componentId: string,
  format: CodeOutputFormat
): CodeOverride | null {
  const store = useComponentCodeStore.getState();
  const codeState = store.codeStates[componentId];

  if (!codeState) return null;

  const override = codeState.overrides[format];
  return override?.isLocked ? override : null;
}

/**
 * Check if any component in the measure has an override for the given format
 */
export function hasAnyOverrides(
  measure: UniversalMeasureSpec,
  format?: CodeOutputFormat
): boolean {
  const summary = getOverridesForMeasure(measure, format);
  return summary.totalOverrides > 0;
}

/**
 * Generate override header comments for inclusion in generated code
 */
export function generateOverrideHeader(
  measure: UniversalMeasureSpec,
  format: CodeOutputFormat
): string {
  const summary = getOverridesForMeasure(measure, format);

  if (summary.totalOverrides === 0) return '';

  const commentPrefix = format === 'cql' ? '//' : '--';
  const lines: string[] = [];

  lines.push(`${commentPrefix} ========================================`);
  lines.push(`${commentPrefix} MANUAL OVERRIDES APPLIED: ${summary.totalOverrides} component(s)`);
  lines.push(`${commentPrefix} ========================================`);

  for (const info of summary.overrideInfos) {
    lines.push(`${commentPrefix}`);
    lines.push(`${commentPrefix} [OVERRIDE] ${info.componentDescription}`);

    for (const note of info.override.notes) {
      lines.push(formatNoteForCodeComment(note, format));
    }
  }

  lines.push(`${commentPrefix} ========================================`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Apply overrides to generated CQL code
 * This injects override code and notes into the appropriate sections
 */
export function applyCQLOverrides(
  generatedCQL: string,
  measure: UniversalMeasureSpec
): { code: string; overrideCount: number } {
  const summary = getOverridesForMeasure(measure, 'cql');

  if (summary.totalOverrides === 0) {
    return { code: generatedCQL, overrideCount: 0 };
  }

  let modifiedCode = generatedCQL;
  let replacementsMade = 0;

  // For each override, try to replace the corresponding define statement
  for (const info of summary.overrideInfos) {
    const override = info.override;
    const componentDesc = info.componentDescription;

    // Build the override block with notes as comments
    const noteComments = override.notes
      .map(note => formatNoteForCodeComment(note, 'cql'))
      .join('\n');

    const overrideBlock = noteComments
      ? `${noteComments}\n// [OVERRIDDEN]\n${override.code}`
      : `// [OVERRIDDEN]\n${override.code}`;

    // Try to find and replace the define statement for this component
    // Look for: define "ComponentName":
    const definePattern = new RegExp(
      `(define\\s+"${escapeRegExp(componentDesc)}"\\s*:\\s*)(.*?)(?=\\n\\s*\\n|\\ndefine\\s|$)`,
      's'
    );

    if (definePattern.test(modifiedCode)) {
      modifiedCode = modifiedCode.replace(definePattern, overrideBlock);
      replacementsMade++;
    } else {
      // If we can't find the exact define, append override to the end
      // with a clear marker
      modifiedCode += `\n\n// ========================================\n`;
      modifiedCode += `// OVERRIDE for: ${componentDesc}\n`;
      modifiedCode += `// ========================================\n`;
      modifiedCode += overrideBlock;
      replacementsMade++;
    }
  }

  // Prepend summary header if any overrides were applied
  if (replacementsMade > 0) {
    const header = generateOverrideHeader(measure, 'cql');
    modifiedCode = header + modifiedCode;
  }

  return { code: modifiedCode, overrideCount: summary.totalOverrides };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Apply overrides to generated SQL code
 */
export function applySQLOverrides(
  generatedSQL: string,
  measure: UniversalMeasureSpec,
  format: 'synapse-sql' | 'hdi'
): { code: string; overrideCount: number } {
  // Map 'hdi' to synapse-sql for lookup (both use Synapse/T-SQL style)
  const lookupFormat: CodeOutputFormat = 'synapse-sql';
  const summary = getOverridesForMeasure(measure, lookupFormat);

  if (summary.totalOverrides === 0) {
    return { code: generatedSQL, overrideCount: 0 };
  }

  let modifiedCode = generatedSQL;
  let replacementsMade = 0;

  // For each override, try to replace the corresponding CTE or section
  for (const info of summary.overrideInfos) {
    const override = info.override;
    const componentDesc = info.componentDescription;

    // Build the override block with notes as comments
    const noteComments = override.notes
      .map(note => formatNoteForCodeComment(note, lookupFormat))
      .join('\n');

    const overrideBlock = noteComments
      ? `${noteComments}\n-- [OVERRIDDEN]\n${override.code}`
      : `-- [OVERRIDDEN]\n${override.code}`;

    // Try to find and replace a CTE or predicate block for this component
    // Look for patterns like: PRED_* as ( or -- ComponentName
    const ctePattern = new RegExp(
      `(--\\s*${escapeRegExp(componentDesc)}\\s*\\n[^)]*as\\s*\\([^)]*\\))`,
      'si'
    );

    if (ctePattern.test(modifiedCode)) {
      modifiedCode = modifiedCode.replace(ctePattern, overrideBlock);
      replacementsMade++;
    } else {
      // Append override section at end
      modifiedCode += `\n\n-- ========================================\n`;
      modifiedCode += `-- OVERRIDE for: ${componentDesc}\n`;
      modifiedCode += `-- ========================================\n`;
      modifiedCode += overrideBlock;
      replacementsMade++;
    }
  }

  // Prepend summary header if any overrides were applied
  if (replacementsMade > 0) {
    const header = generateOverrideHeader(measure, lookupFormat);
    modifiedCode = header + modifiedCode;
  }

  return { code: modifiedCode, overrideCount: summary.totalOverrides };
}

/**
 * Get the count of overrides for a measure (for display in UI)
 */
export function getOverrideCountForMeasure(
  measure: UniversalMeasureSpec,
  format?: CodeOutputFormat
): number {
  const summary = getOverridesForMeasure(measure, format);
  return summary.totalOverrides;
}

/**
 * Format all notes as code comments for a specific format
 */
export function formatAllNotesAsComments(
  notes: CodeEditNote[],
  format: CodeOutputFormat
): string {
  if (notes.length === 0) return '';

  return notes.map(note => formatNoteForCodeComment(note, format)).join('\n');
}
