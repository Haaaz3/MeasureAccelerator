/**
 * Measure Diff Service
 *
 * Compares two versions of a measure (e.g., year-over-year) and produces
 * a structured diff showing:
 * - Added/removed/modified data elements
 * - Value set changes (OID changes, code additions/removals)
 * - Population logic changes
 * - Metadata changes
 */

import type { UniversalMeasureSpec, DataElement, ValueSetReference, Population, LogicalClause } from '../types/ums';
import { diffLines, type Change } from 'diff';

// ============================================================================
// Types
// ============================================================================

export type DiffChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface ElementDiff {
  changeType: DiffChangeType;
  oldElement?: DataElement;
  newElement?: DataElement;
  changes: string[];
  valueSetDiff?: ValueSetDiff;
}

export interface ValueSetDiff {
  changeType: DiffChangeType;
  nameChanged: boolean;
  oidChanged: boolean;
  oldOid?: string;
  newOid?: string;
  codesAdded: number;
  codesRemoved: number;
  codesChanged: number;
}

export interface PopulationDiff {
  changeType: DiffChangeType;
  populationType: string;
  oldDescription?: string;
  newDescription?: string;
  elementChanges: {
    added: number;
    removed: number;
    modified: number;
  };
}

export interface MetadataDiff {
  field: string;
  oldValue: string | undefined;
  newValue: string | undefined;
  changeType: DiffChangeType;
}

export interface MeasureDiffResult {
  oldMeasureId: string;
  newMeasureId: string;
  oldMeasureName: string;
  newMeasureName: string;
  oldVersion: string;
  newVersion: string;

  summary: {
    totalChanges: number;
    elementsAdded: number;
    elementsRemoved: number;
    elementsModified: number;
    valueSetsChanged: number;
    populationsChanged: number;
    metadataChanged: number;
  };

  metadataChanges: MetadataDiff[];
  populationChanges: PopulationDiff[];
  elementChanges: ElementDiff[];

  // Raw text diff of generated code (CQL)
  codeDiff?: Change[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Collect all data elements from a measure (flattens all populations)
 */
function collectAllElements(measure: UniversalMeasureSpec): DataElement[] {
  const elements: DataElement[] = [];

  const traverse = (node: DataElement | LogicalClause) => {
    if ('type' in node && !('operator' in node)) {
      elements.push(node as DataElement);
    }
    if ('children' in node) {
      for (const child of (node as LogicalClause).children) {
        traverse(child as DataElement | LogicalClause);
      }
    }
  };

  for (const population of measure.populations || []) {
    if (population.criteria) {
      traverse(population.criteria);
    }
  }

  return elements;
}

/**
 * Create a key for matching elements between versions
 */
function getElementKey(element: DataElement): string {
  // Try to match by value set OID first (most stable), then by description
  if (element.valueSet?.oid) {
    return `oid:${element.valueSet.oid}`;
  }
  // Fallback to normalized description
  const normalizedDesc = (element.description || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `desc:${element.type}:${normalizedDesc}`;
}

/**
 * Compare two value sets
 */
function compareValueSets(
  oldVs: ValueSetReference | undefined,
  newVs: ValueSetReference | undefined
): ValueSetDiff | undefined {
  if (!oldVs && !newVs) return undefined;

  if (!oldVs && newVs) {
    return {
      changeType: 'added',
      nameChanged: true,
      oidChanged: true,
      newOid: newVs.oid,
      codesAdded: newVs.codes?.length || 0,
      codesRemoved: 0,
      codesChanged: 0,
    };
  }

  if (oldVs && !newVs) {
    return {
      changeType: 'removed',
      nameChanged: true,
      oidChanged: true,
      oldOid: oldVs.oid,
      codesAdded: 0,
      codesRemoved: oldVs.codes?.length || 0,
      codesChanged: 0,
    };
  }

  // Both exist - compare them
  const nameChanged = oldVs!.name !== newVs!.name;
  const oidChanged = oldVs!.oid !== newVs!.oid;

  // Compare codes
  const oldCodes = new Set((oldVs!.codes || []).map(c => `${c.system}|${c.code}`));
  const newCodes = new Set((newVs!.codes || []).map(c => `${c.system}|${c.code}`));

  let codesAdded = 0;
  let codesRemoved = 0;

  for (const code of newCodes) {
    if (!oldCodes.has(code)) codesAdded++;
  }
  for (const code of oldCodes) {
    if (!newCodes.has(code)) codesRemoved++;
  }

  if (!nameChanged && !oidChanged && codesAdded === 0 && codesRemoved === 0) {
    return undefined; // No changes
  }

  return {
    changeType: 'modified',
    nameChanged,
    oidChanged,
    oldOid: oldVs!.oid,
    newOid: newVs!.oid,
    codesAdded,
    codesRemoved,
    codesChanged: 0, // We don't track individual code modifications
  };
}

/**
 * Compare two data elements
 */
function compareElements(
  oldEl: DataElement | undefined,
  newEl: DataElement | undefined
): ElementDiff {
  if (!oldEl && newEl) {
    return {
      changeType: 'added',
      newElement: newEl,
      changes: ['Element added'],
      valueSetDiff: compareValueSets(undefined, newEl.valueSet),
    };
  }

  if (oldEl && !newEl) {
    return {
      changeType: 'removed',
      oldElement: oldEl,
      changes: ['Element removed'],
      valueSetDiff: compareValueSets(oldEl.valueSet, undefined),
    };
  }

  // Both exist - compare them
  const changes: string[] = [];

  if (oldEl!.type !== newEl!.type) {
    changes.push(`Type changed: ${oldEl!.type} → ${newEl!.type}`);
  }

  if (oldEl!.description !== newEl!.description) {
    changes.push('Description changed');
  }

  if (oldEl!.negation !== newEl!.negation) {
    changes.push(`Negation changed: ${oldEl!.negation} → ${newEl!.negation}`);
  }

  const valueSetDiff = compareValueSets(oldEl!.valueSet, newEl!.valueSet);
  if (valueSetDiff) {
    if (valueSetDiff.oidChanged) {
      changes.push(`Value set OID changed: ${valueSetDiff.oldOid} → ${valueSetDiff.newOid}`);
    }
    if (valueSetDiff.codesAdded > 0) {
      changes.push(`${valueSetDiff.codesAdded} codes added`);
    }
    if (valueSetDiff.codesRemoved > 0) {
      changes.push(`${valueSetDiff.codesRemoved} codes removed`);
    }
  }

  return {
    changeType: changes.length > 0 ? 'modified' : 'unchanged',
    oldElement: oldEl,
    newElement: newEl,
    changes,
    valueSetDiff,
  };
}

// ============================================================================
// Main Diff Function
// ============================================================================

/**
 * Compare two versions of a measure
 */
export function compareMeasures(
  oldMeasure: UniversalMeasureSpec,
  newMeasure: UniversalMeasureSpec,
  oldCql?: string,
  newCql?: string
): MeasureDiffResult {
  // Collect all elements
  const oldElements = collectAllElements(oldMeasure);
  const newElements = collectAllElements(newMeasure);

  // Create maps keyed by element identifier
  const oldElementMap = new Map<string, DataElement>();
  const newElementMap = new Map<string, DataElement>();

  for (const el of oldElements) {
    oldElementMap.set(getElementKey(el), el);
  }
  for (const el of newElements) {
    newElementMap.set(getElementKey(el), el);
  }

  // Find all unique keys
  const allKeys = new Set([...oldElementMap.keys(), ...newElementMap.keys()]);

  // Compare elements
  const elementChanges: ElementDiff[] = [];
  let elementsAdded = 0;
  let elementsRemoved = 0;
  let elementsModified = 0;
  let valueSetsChanged = 0;

  for (const key of allKeys) {
    const oldEl = oldElementMap.get(key);
    const newEl = newElementMap.get(key);
    const diff = compareElements(oldEl, newEl);

    if (diff.changeType !== 'unchanged') {
      elementChanges.push(diff);

      if (diff.changeType === 'added') elementsAdded++;
      else if (diff.changeType === 'removed') elementsRemoved++;
      else if (diff.changeType === 'modified') elementsModified++;

      if (diff.valueSetDiff) valueSetsChanged++;
    }
  }

  // Compare metadata
  const metadataChanges: MetadataDiff[] = [];
  const metadataFields = ['measureId', 'title', 'version', 'status', 'description'];

  for (const field of metadataFields) {
    const oldVal = (oldMeasure.metadata as Record<string, unknown>)?.[field] as string | undefined;
    const newVal = (newMeasure.metadata as Record<string, unknown>)?.[field] as string | undefined;

    if (oldVal !== newVal) {
      metadataChanges.push({
        field,
        oldValue: oldVal,
        newValue: newVal,
        changeType: !oldVal ? 'added' : !newVal ? 'removed' : 'modified',
      });
    }
  }

  // Compare populations
  const populationChanges: PopulationDiff[] = [];
  const oldPops = oldMeasure.populations || [];
  const newPops = newMeasure.populations || [];

  // Simple population comparison by type
  const oldPopMap = new Map(oldPops.map(p => [p.type, p]));
  const newPopMap = new Map(newPops.map(p => [p.type, p]));
  const allPopTypes = new Set([...oldPopMap.keys(), ...newPopMap.keys()]);

  for (const popType of allPopTypes) {
    const oldPop = oldPopMap.get(popType);
    const newPop = newPopMap.get(popType);

    if (!oldPop && newPop) {
      populationChanges.push({
        changeType: 'added',
        populationType: popType,
        newDescription: newPop.description,
        elementChanges: { added: 1, removed: 0, modified: 0 },
      });
    } else if (oldPop && !newPop) {
      populationChanges.push({
        changeType: 'removed',
        populationType: popType,
        oldDescription: oldPop.description,
        elementChanges: { added: 0, removed: 1, modified: 0 },
      });
    } else if (oldPop && newPop) {
      if (oldPop.description !== newPop.description) {
        populationChanges.push({
          changeType: 'modified',
          populationType: popType,
          oldDescription: oldPop.description,
          newDescription: newPop.description,
          elementChanges: { added: 0, removed: 0, modified: 1 },
        });
      }
    }
  }

  // Code diff (if CQL provided)
  let codeDiff: Change[] | undefined;
  if (oldCql && newCql) {
    codeDiff = diffLines(oldCql, newCql);
  }

  return {
    oldMeasureId: oldMeasure.id,
    newMeasureId: newMeasure.id,
    oldMeasureName: oldMeasure.metadata?.title || oldMeasure.id,
    newMeasureName: newMeasure.metadata?.title || newMeasure.id,
    oldVersion: oldMeasure.metadata?.version || 'unknown',
    newVersion: newMeasure.metadata?.version || 'unknown',

    summary: {
      totalChanges: elementChanges.length + metadataChanges.length + populationChanges.length,
      elementsAdded,
      elementsRemoved,
      elementsModified,
      valueSetsChanged,
      populationsChanged: populationChanges.length,
      metadataChanged: metadataChanges.length,
    },

    metadataChanges,
    populationChanges,
    elementChanges,
    codeDiff,
  };
}

/**
 * Generate a human-readable summary of the diff
 */
export function generateDiffSummary(diff: MeasureDiffResult): string {
  const lines: string[] = [];

  lines.push(`Measure Comparison: ${diff.oldMeasureName} (${diff.oldVersion}) → ${diff.newMeasureName} (${diff.newVersion})`);
  lines.push('');
  lines.push('Summary:');
  lines.push(`  Total Changes: ${diff.summary.totalChanges}`);
  lines.push(`  Elements Added: ${diff.summary.elementsAdded}`);
  lines.push(`  Elements Removed: ${diff.summary.elementsRemoved}`);
  lines.push(`  Elements Modified: ${diff.summary.elementsModified}`);
  lines.push(`  Value Sets Changed: ${diff.summary.valueSetsChanged}`);
  lines.push(`  Populations Changed: ${diff.summary.populationsChanged}`);
  lines.push(`  Metadata Changed: ${diff.summary.metadataChanged}`);

  if (diff.metadataChanges.length > 0) {
    lines.push('');
    lines.push('Metadata Changes:');
    for (const change of diff.metadataChanges) {
      lines.push(`  ${change.field}: "${change.oldValue || '(none)'}" → "${change.newValue || '(none)'}"`);
    }
  }

  if (diff.elementChanges.length > 0) {
    lines.push('');
    lines.push('Element Changes:');
    for (const change of diff.elementChanges) {
      const el = change.newElement || change.oldElement;
      const desc = el?.description?.substring(0, 50) || 'Unknown';
      lines.push(`  [${change.changeType.toUpperCase()}] ${desc}${desc.length >= 50 ? '...' : ''}`);
      for (const detail of change.changes) {
        lines.push(`    - ${detail}`);
      }
    }
  }

  return lines.join('\n');
}
