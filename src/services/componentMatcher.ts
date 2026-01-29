/**
 * Component Matcher Service
 *
 * Handles exact matching, similarity scoring, and diffing for the component library.
 *
 * Key design principle: Components match ONLY when 100% identical.
 * No fuzzy matching for reuse. Similar matching is only for suggestions.
 */

import type {
  AtomicComponent,
  CompositeComponent,
  LibraryComponent,
  ParsedComponent,
  ComponentMatch,
  ComponentDiff,
  ComponentIdentity,
  TimingExpression,
  TimingOperator,
  ComponentLibrary,
} from '../types/componentLibrary';
import type { DataElement } from '../types/ums';

// ============================================================================
// Hash Utilities
// ============================================================================

/**
 * djb2 string hash - simple, fast, deterministic.
 * Returns a hex string for readability.
 */
function djb2Hash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    // hash * 33 + charCode
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  // Convert to unsigned 32-bit then to hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Build a normalized identity object for an atomic component.
 * Only fields that define "what this component IS" are included.
 * Name, description, metadata, usage, etc. are excluded.
 */
function buildAtomicIdentityKey(component: {
  valueSetOid?: string;
  oid?: string;
  timing?: TimingExpression;
  negation?: boolean;
  valueSet?: { oid: string };
}): Record<string, unknown> {
  const oid =
    (component as AtomicComponent).valueSet?.oid ??
    (component as ParsedComponent & { valueSetOid?: string }).valueSetOid ??
    '';

  const timing = component.timing;

  return {
    oid,
    timingOperator: timing?.operator ?? null,
    timingQuantity: timing?.quantity ?? null,
    timingUnit: timing?.unit ?? null,
    timingPosition: timing?.position ?? null,
    timingReference: timing?.reference ?? null,
    negation: component.negation ?? false,
  };
}

/**
 * Build a normalized identity object for a composite component.
 * Identity = sorted child IDs + operator.
 */
function buildCompositeIdentityKey(component: CompositeComponent): Record<string, unknown> {
  const sortedChildIds = component.children
    .map((c) => `${c.componentId}@${c.versionId}`)
    .sort();
  return {
    operator: component.operator,
    children: sortedChildIds,
  };
}

/**
 * Build identity key for a parsed composite (import candidate).
 * Since parsed composites don't have resolved IDs, we recursively hash children.
 */
function buildParsedCompositeIdentityKey(parsed: ParsedComponent): Record<string, unknown> {
  const childHashes = (parsed.children ?? [])
    .map((child) => generateParsedComponentHash(child))
    .sort();
  return {
    operator: parsed.operator ?? 'AND',
    children: childHashes,
  };
}

// ============================================================================
// Public API: Hash Generation
// ============================================================================

/**
 * Generate a deterministic hash for a library component's identity.
 *
 * For atomics: hash of (OID + timing operator + quantity + unit + position + reference + negation)
 * For composites: hash of (sorted child IDs + operator)
 */
export function generateComponentHash(component: LibraryComponent): string {
  let identityKey: Record<string, unknown>;

  if (component.type === 'atomic') {
    identityKey = buildAtomicIdentityKey(component);
  } else {
    identityKey = buildCompositeIdentityKey(component);
  }

  const normalized = JSON.stringify(identityKey);
  return djb2Hash(normalized);
}

/**
 * Generate a hash from a parsed component (import candidate).
 *
 * Follows the same normalization rules as generateComponentHash
 * so that identical components produce identical hashes regardless
 * of whether they come from the library or from import parsing.
 */
export function generateParsedComponentHash(parsed: ParsedComponent): string {
  let identityKey: Record<string, unknown>;

  if (parsed.children && parsed.children.length > 0) {
    // Composite
    identityKey = buildParsedCompositeIdentityKey(parsed);
  } else {
    // Atomic
    identityKey = buildAtomicIdentityKey({
      valueSetOid: parsed.valueSetOid,
      timing: parsed.timing,
      negation: parsed.negation,
    });
  }

  const normalized = JSON.stringify(identityKey);
  return djb2Hash(normalized);
}

// ============================================================================
// Public API: Exact Matching
// ============================================================================

/**
 * Find an exact match in the library by comparing hashes.
 *
 * Returns the matching library component, or null if no exact match exists.
 * Exact match = 100% identical identity fields. No fuzzy tolerance.
 */
export function findExactMatch(
  incoming: ParsedComponent,
  library: Record<string, LibraryComponent>
): LibraryComponent | null {
  const incomingHash = generateParsedComponentHash(incoming);

  for (const component of Object.values(library)) {
    const libraryHash = generateComponentHash(component);
    if (libraryHash === incomingHash) {
      return component;
    }
  }

  return null;
}

// ============================================================================
// Public API: Similarity Scoring
// ============================================================================

/**
 * Compute similarity score between an incoming parsed component and a library component.
 *
 * Scoring rules:
 *   - Same OID = 0.7 base similarity
 *   - Same timing operator = +0.15
 *   - Same reference period = +0.15
 *   - Different OID = 0 (completely different concept, not similar at all)
 *
 * Only atomic components are scored for similarity.
 * Composites with different structures are not considered similar.
 */
function computeSimilarity(incoming: ParsedComponent, existing: LibraryComponent): number {
  // Only score atomics against atomics
  if (existing.type !== 'atomic') {
    return 0;
  }

  // Composites (parsed as having children) are not similar to atomics
  if (incoming.children && incoming.children.length > 0) {
    return 0;
  }

  const incomingOid = incoming.valueSetOid ?? '';
  const existingOid = existing.valueSet.oid;

  // Different OID = completely different concept = 0 similarity
  if (!incomingOid || !existingOid || incomingOid !== existingOid) {
    return 0;
  }

  // Same OID: base score of 0.7
  let score = 0.7;

  // Same timing operator: +0.15
  if (
    incoming.timing?.operator &&
    existing.timing?.operator &&
    incoming.timing.operator === existing.timing.operator
  ) {
    score += 0.15;
  }

  // Same reference period: +0.15
  if (
    incoming.timing?.reference &&
    existing.timing?.reference &&
    incoming.timing.reference === existing.timing.reference
  ) {
    score += 0.15;
  }

  return score;
}

/**
 * Find similar components in the library.
 *
 * Returns matches sorted by similarity score (descending).
 * Only returns results above the threshold (default 0.5).
 *
 * Important: This skips exact matches (score = 1.0) since those
 * should be handled by findExactMatch. Similar matching is only
 * for suggestions, not for reuse.
 */
export function findSimilarComponents(
  incoming: ParsedComponent,
  library: Record<string, LibraryComponent>,
  threshold: number = 0.5
): ComponentMatch[] {
  const incomingHash = generateParsedComponentHash(incoming);
  const matches: ComponentMatch[] = [];

  for (const component of Object.values(library)) {
    // Skip exact matches - those are handled by findExactMatch
    const libraryHash = generateComponentHash(component);
    if (libraryHash === incomingHash) {
      continue;
    }

    const similarity = computeSimilarity(incoming, component);

    if (similarity >= threshold) {
      const differences = computeComponentDiff(component, incoming);

      matches.push({
        incomingComponent: incoming,
        matchType: 'similar',
        matchedComponent: component,
        similarity,
        differences,
      });
    }
  }

  // Sort by similarity descending
  matches.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

  return matches;
}

// ============================================================================
// Public API: Diffing
// ============================================================================

/**
 * Compute field-level diff between an existing library component and an incoming parsed component.
 *
 * Returns an array of differences. Empty array means the components are identical
 * in their identity-relevant fields.
 */
export function computeComponentDiff(
  existing: LibraryComponent,
  incoming: ParsedComponent
): ComponentDiff[] {
  const diffs: ComponentDiff[] = [];

  if (existing.type === 'atomic') {
    // Compare value set OID
    const incomingOid = incoming.valueSetOid ?? '';
    if (existing.valueSet.oid !== incomingOid) {
      diffs.push({
        field: 'valueSet',
        expected: existing.valueSet.oid,
        actual: incomingOid,
        description: `Value set OID differs: library has "${existing.valueSet.oid}", incoming has "${incomingOid}"`,
      });
    }

    // Compare timing operator
    const existingOp = existing.timing?.operator ?? '';
    const incomingOp = incoming.timing?.operator ?? '';
    if (existingOp !== incomingOp) {
      diffs.push({
        field: 'timing',
        expected: existingOp,
        actual: incomingOp,
        description: `Timing operator differs: library has "${existingOp}", incoming has "${incomingOp}"`,
      });
    }

    // Compare timing quantity
    const existingQty = existing.timing?.quantity;
    const incomingQty = incoming.timing?.quantity;
    if (existingQty !== incomingQty) {
      diffs.push({
        field: 'timing',
        expected: existingQty != null ? String(existingQty) : 'none',
        actual: incomingQty != null ? String(incomingQty) : 'none',
        description: `Timing quantity differs: library has ${existingQty ?? 'none'}, incoming has ${incomingQty ?? 'none'}`,
      });
    }

    // Compare timing unit
    const existingUnit = existing.timing?.unit ?? '';
    const incomingUnit = incoming.timing?.unit ?? '';
    if (existingUnit !== incomingUnit) {
      diffs.push({
        field: 'timing',
        expected: existingUnit || 'none',
        actual: incomingUnit || 'none',
        description: `Timing unit differs: library has "${existingUnit || 'none'}", incoming has "${incomingUnit || 'none'}"`,
      });
    }

    // Compare timing position
    const existingPos = existing.timing?.position ?? '';
    const incomingPos = incoming.timing?.position ?? '';
    if (existingPos !== incomingPos) {
      diffs.push({
        field: 'timing',
        expected: existingPos || 'none',
        actual: incomingPos || 'none',
        description: `Timing position differs: library has "${existingPos || 'none'}", incoming has "${incomingPos || 'none'}"`,
      });
    }

    // Compare timing reference
    const existingRef = existing.timing?.reference ?? '';
    const incomingRef = incoming.timing?.reference ?? '';
    if (existingRef !== incomingRef) {
      diffs.push({
        field: 'timing',
        expected: existingRef || 'none',
        actual: incomingRef || 'none',
        description: `Timing reference differs: library has "${existingRef || 'none'}", incoming has "${incomingRef || 'none'}"`,
      });
    }

    // Compare negation
    const existingNeg = existing.negation ?? false;
    const incomingNeg = incoming.negation ?? false;
    if (existingNeg !== incomingNeg) {
      diffs.push({
        field: 'negation',
        expected: String(existingNeg),
        actual: String(incomingNeg),
        description: `Negation differs: library has ${existingNeg}, incoming has ${incomingNeg}`,
      });
    }
  } else {
    // Composite comparison
    const existingOp = existing.operator;
    const incomingOp = incoming.operator ?? 'AND';
    if (existingOp !== incomingOp) {
      diffs.push({
        field: 'operator',
        expected: existingOp,
        actual: incomingOp,
        description: `Logical operator differs: library has "${existingOp}", incoming has "${incomingOp}"`,
      });
    }

    // Compare children count
    const existingChildCount = existing.children.length;
    const incomingChildCount = incoming.children?.length ?? 0;
    if (existingChildCount !== incomingChildCount) {
      diffs.push({
        field: 'children',
        expected: String(existingChildCount),
        actual: String(incomingChildCount),
        description: `Child count differs: library has ${existingChildCount} children, incoming has ${incomingChildCount}`,
      });
    }
  }

  return diffs;
}

// ============================================================================
// Public API: Identity Comparison
// ============================================================================

/**
 * Check if two library components are identical.
 *
 * Uses hash comparison for fast equality check.
 * Two components are identical if and only if their identity hashes match.
 */
export function areComponentsIdentical(a: LibraryComponent, b: LibraryComponent): boolean {
  return generateComponentHash(a) === generateComponentHash(b);
}

// ============================================================================
// Public API: Readable Identity
// ============================================================================

/**
 * Generate a human-readable identity string for a component.
 *
 * Examples:
 *   Atomic: "Office Visit (2.16.840...1001) during Measurement Period"
 *   Atomic negated: "NOT Office Visit (2.16.840...1001) during Measurement Period"
 *   Composite: "AND(Qualifying Encounter, Diabetes Diagnosis)"
 */
export function getReadableIdentity(component: LibraryComponent): string {
  if (component.type === 'atomic') {
    const negPrefix = component.negation ? 'NOT ' : '';
    const vsName = component.valueSet.name;
    const oid = component.valueSet.oid;
    const timingStr = component.timing.displayExpression || formatTiming(component.timing);

    return `${negPrefix}${vsName} (${oid}) ${timingStr}`;
  } else {
    const childNames = component.children.map((c) => c.displayName).join(', ');
    return `${component.operator}(${childNames})`;
  }
}

/**
 * Format a timing expression into a readable string.
 * Used as fallback when displayExpression is not available.
 */
function formatTiming(timing: TimingExpression): string {
  const parts: string[] = [];

  if (timing.position) {
    parts.push(timing.position);
  }

  parts.push(timing.operator);

  if (timing.quantity != null && timing.unit) {
    parts.push(`${timing.quantity} ${timing.unit}`);
  }

  parts.push(timing.reference);

  return parts.join(' ');
}

// ============================================================================
// Public API: Parse DataElement to ParsedComponent
// ============================================================================

/**
 * Convert a UMS DataElement into a ParsedComponent for library matching.
 *
 * Extracts value set OID, timing expression, and negation from the element.
 * Returns null if the element has no value set (e.g., demographics without OID).
 */
export function parseDataElementToComponent(element: DataElement): ParsedComponent | null {
  // Skip elements without value sets (demographics, etc.)
  if (!element.valueSet?.oid || element.valueSet.oid === 'N/A') {
    return null;
  }

  // Build timing expression from timingRequirements
  let timing: TimingExpression | undefined;
  if (element.timingRequirements && element.timingRequirements.length > 0) {
    const tr = element.timingRequirements[0];
    const desc = tr.description?.toLowerCase() || '';

    // Parse timing from description and window
    let operator: TimingOperator = 'during';
    let quantity: number | undefined;
    let unit: 'years' | 'months' | 'days' | 'hours' | undefined;
    let position: TimingExpression['position'] | undefined;
    let reference: string = 'Measurement Period';

    if (tr.window) {
      // Has explicit window (e.g., "within 10 years before")
      operator = 'within';
      quantity = tr.window.value;
      unit = tr.window.unit as 'years' | 'months' | 'days' | 'hours';
      if (tr.window.direction === 'before') {
        position = 'before end of';
      } else if (tr.window.direction === 'after') {
        position = 'after start of';
      }
    } else if (desc.includes('during')) {
      operator = 'during';
    } else if (desc.includes('before')) {
      operator = 'before';
    } else if (desc.includes('after')) {
      operator = 'after';
    }

    if (tr.relativeTo === 'measurement_period_end') {
      reference = 'Measurement Period';
      if (!position && operator === 'within') {
        position = 'before end of';
      }
    } else if (tr.relativeTo === 'measurement_period') {
      reference = 'Measurement Period';
    }

    timing = {
      operator,
      quantity,
      unit,
      position,
      reference,
      displayExpression: tr.description || `${operator} ${reference}`,
    };
  } else {
    // Default: during measurement period
    timing = {
      operator: 'during',
      reference: 'Measurement Period',
      displayExpression: 'during Measurement Period',
    };
  }

  // Detect negation
  const desc = element.description?.toLowerCase() || '';
  const negation = element.negation || desc.includes('absence of') || desc.includes('without');

  return {
    name: element.description || element.valueSet.name,
    valueSetOid: element.valueSet.oid,
    valueSetName: element.valueSet.name,
    timing,
    negation,
  };
}
