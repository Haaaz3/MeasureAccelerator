/**
 * Referential Integrity Check Utility
 *
 * Validates consistency between measureStore and componentLibraryStore data.
 * Used for testing and debugging data synchronization issues.
 */

import type { UniversalMeasureSpec, DataElement, LogicalClause } from '../types/ums';
import type { LibraryComponent } from '../types/componentLibrary';

export interface IntegrityMismatch {
  type: 'orphaned_reference' | 'missing_usage' | 'stale_usage' | 'count_mismatch';
  description: string;
  measureId?: string;
  componentId?: string;
  elementId?: string;
  expected?: any;
  actual?: any;
}

/**
 * Collects all libraryComponentId references from a measure's population criteria trees.
 */
function collectMeasureReferences(measure: UniversalMeasureSpec): Array<{ elementId: string; componentId: string }> {
  const refs: Array<{ elementId: string; componentId: string }> = [];

  const walk = (node: LogicalClause | DataElement | null): void => {
    if (!node) return;

    // LogicalClause
    if ('operator' in node && 'children' in node) {
      (node as LogicalClause).children.forEach(walk);
      return;
    }

    // DataElement
    const element = node as DataElement;
    if (element.libraryComponentId && element.libraryComponentId !== '__ZERO_CODES__') {
      refs.push({ elementId: element.id, componentId: element.libraryComponentId });
    }
  };

  for (const pop of measure.populations) {
    if (pop.criteria) {
      walk(pop.criteria as LogicalClause | DataElement);
    }
  }

  return refs;
}

/**
 * Validates referential integrity between measures and components.
 *
 * Checks:
 * 1. Every libraryComponentId in measures points to an existing component
 * 2. Every component's usage.measureIds matches actual measure references
 * 3. Usage counts are accurate
 *
 * @param measures - All measures from measureStore
 * @param components - All components from componentLibraryStore
 * @returns Array of mismatches (empty if data is consistent)
 */
export function validateReferentialIntegrity(
  measures: UniversalMeasureSpec[],
  components: LibraryComponent[]
): IntegrityMismatch[] {
  const mismatches: IntegrityMismatch[] = [];

  // Build component lookup map
  const componentMap = new Map<string, LibraryComponent>();
  for (const comp of components) {
    componentMap.set(comp.id, comp);
  }

  // Build actual usage from measures: componentId -> Set<measureId>
  const actualUsage = new Map<string, Set<string>>();

  for (const measure of measures) {
    // Use measure.id (internal store ID) to match rebuildUsageIndex behavior
    const measureId = measure.id;
    const refs = collectMeasureReferences(measure);

    for (const { elementId, componentId } of refs) {
      // Check 1: Does the referenced component exist?
      if (!componentMap.has(componentId)) {
        mismatches.push({
          type: 'orphaned_reference',
          description: `DataElement references non-existent component`,
          measureId,
          componentId,
          elementId,
        });
      }

      // Track actual usage
      if (!actualUsage.has(componentId)) {
        actualUsage.set(componentId, new Set());
      }
      actualUsage.get(componentId)!.add(measureId);
    }
  }

  // Check 2 & 3: Compare component's usage data against actual usage
  for (const comp of components) {
    const claimedMeasureIds = new Set(comp.usage.measureIds);
    const actualMeasureIds = actualUsage.get(comp.id) || new Set<string>();

    // Check for stale usage (component claims usage that doesn't exist in measures)
    for (const measureId of claimedMeasureIds) {
      if (!actualMeasureIds.has(measureId)) {
        mismatches.push({
          type: 'stale_usage',
          description: `Component claims usage in measure that doesn't reference it`,
          componentId: comp.id,
          measureId,
          expected: 'No reference in measure',
          actual: `Component lists ${measureId} in usage.measureIds`,
        });
      }
    }

    // Check for missing usage (measure references component but component doesn't track it)
    for (const measureId of actualMeasureIds) {
      if (!claimedMeasureIds.has(measureId)) {
        mismatches.push({
          type: 'missing_usage',
          description: `Component is referenced by measure but doesn't track it in usage`,
          componentId: comp.id,
          measureId,
          expected: `${measureId} should be in usage.measureIds`,
          actual: `Component has: [${comp.usage.measureIds.join(', ')}]`,
        });
      }
    }

    // Check usage count
    if (comp.usage.usageCount !== actualMeasureIds.size) {
      mismatches.push({
        type: 'count_mismatch',
        description: `Component's usageCount doesn't match actual reference count`,
        componentId: comp.id,
        expected: actualMeasureIds.size,
        actual: comp.usage.usageCount,
      });
    }
  }

  return mismatches;
}

/**
 * Formats integrity mismatches for logging/display.
 */
export function formatMismatches(mismatches: IntegrityMismatch[]): string {
  if (mismatches.length === 0) {
    return 'No integrity issues found.';
  }

  const lines = [`Found ${mismatches.length} integrity issue(s):\n`];

  for (const m of mismatches) {
    lines.push(`[${m.type.toUpperCase()}] ${m.description}`);
    if (m.measureId) lines.push(`  Measure: ${m.measureId}`);
    if (m.componentId) lines.push(`  Component: ${m.componentId}`);
    if (m.elementId) lines.push(`  Element: ${m.elementId}`);
    if (m.expected !== undefined) lines.push(`  Expected: ${JSON.stringify(m.expected)}`);
    if (m.actual !== undefined) lines.push(`  Actual: ${JSON.stringify(m.actual)}`);
    lines.push('');
  }

  return lines.join('\n');
}
