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
  valueSetName?: string;
  oid?: string;
  timing?: TimingExpression;
  negation?: boolean;
  valueSet?: { oid?: string; name?: string };
}): Record<string, unknown> {
  const oid =
    (component as AtomicComponent).valueSet?.oid ??
    (component as ParsedComponent & { valueSetOid?: string }).valueSetOid ??
    '';

  // Use valueSetName as fallback identifier when OID is missing
  const name =
    (component as AtomicComponent).valueSet?.name ??
    (component as ParsedComponent & { valueSetName?: string }).valueSetName ??
    '';

  const timing = component.timing;

  return {
    // Primary identifier is OID, fallback to name when OID is missing
    oid: oid || name,
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
 *
 * For composite incoming components, also checks library composites by resolving
 * their child component references to atomic identity hashes.
 */
export function findExactMatch(
  incoming: ParsedComponent,
  library: Record<string, LibraryComponent>
): LibraryComponent | null {
  const incomingHash = generateParsedComponentHash(incoming);
  const isComposite = incoming.children && incoming.children.length > 0;

  for (const component of Object.values(library)) {
    // Standard hash comparison works for atomics
    const libraryHash = generateComponentHash(component);
    if (libraryHash === incomingHash) {
      return component;
    }

    // For composite incoming vs composite library: resolve children and compare
    if (isComposite && component.type === 'composite') {
      const match = matchCompositeByChildren(incoming, component, library);
      if (match) return component;
    }
  }

  // Fallback: try matching by normalized value set name + timing + negation
  return findNameMatch(incoming, library);
}

/**
 * Normalize a value set name for fallback matching.
 * Lowercases, trims whitespace, and strips common suffixes.
 */
function normalizeValueSetName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+value\s*set$/i, '')
    .replace(/\s+/g, ' ');
}

/**
 * Fallback matching by normalized value set name + timing + negation.
 *
 * Only used when OID-based hash matching fails. Matches if:
 *   1. Normalized value set names are equal
 *   2. Timing operator and reference match
 *   3. Negation matches
 */
export function findNameMatch(
  incoming: ParsedComponent,
  library: Record<string, LibraryComponent>
): LibraryComponent | null {
  // Only works for atomic incoming components with a name
  if (incoming.children && incoming.children.length > 0) return null;

  const incomingName = incoming.valueSetName || incoming.name;
  if (!incomingName) return null;

  const normalizedIncoming = normalizeValueSetName(incomingName);
  if (!normalizedIncoming) return null;

  const incomingTimingOp = incoming.timing?.operator ?? 'during';
  const incomingTimingRef = incoming.timing?.reference ?? 'Measurement Period';
  const incomingNegation = incoming.negation ?? false;

  for (const component of Object.values(library)) {
    if (component.type !== 'atomic') continue;

    const normalizedLib = normalizeValueSetName(component.valueSet.name);
    if (normalizedLib !== normalizedIncoming) continue;

    // Also check timing operator, reference, and negation match
    const libTimingOp = component.timing?.operator ?? 'during';
    const libTimingRef = component.timing?.reference ?? 'Measurement Period';
    const libNegation = component.negation ?? false;

    if (libTimingOp === incomingTimingOp &&
        libTimingRef === incomingTimingRef &&
        libNegation === incomingNegation) {
      return component;
    }
  }

  return null;
}

/**
 * Match a parsed composite against a library composite by resolving the library
 * composite's child references to their atomic identities and comparing.
 *
 * This bridges the gap between:
 *   - Parsed composites (children are inline ParsedComponents with OID+timing)
 *   - Library composites (children are { componentId, versionId } references)
 */
function matchCompositeByChildren(
  incoming: ParsedComponent,
  libraryComposite: CompositeComponent,
  library: Record<string, LibraryComponent>
): boolean {
  // Operators must match
  const incomingOp = incoming.operator ?? 'AND';
  if (incomingOp !== libraryComposite.operator) return false;

  const incomingChildren = incoming.children ?? [];
  if (incomingChildren.length !== libraryComposite.children.length) return false;

  // Build sorted hashes from incoming children (atomic identity hashes)
  const incomingChildHashes = incomingChildren
    .map((child) => generateParsedComponentHash(child))
    .sort();

  // Resolve library composite children to their atomic components, then hash
  const libraryChildHashes: string[] = [];
  for (const childRef of libraryComposite.children) {
    const childComponent = library[childRef.componentId];
    if (!childComponent || childComponent.type !== 'atomic') return false;
    // Hash the atomic using the same identity key as parsed components
    const identityKey = buildAtomicIdentityKey(childComponent);
    const hash = djb2Hash(JSON.stringify(identityKey));
    libraryChildHashes.push(hash);
  }
  libraryChildHashes.sort();

  // Compare sorted hash arrays
  if (incomingChildHashes.length !== libraryChildHashes.length) return false;
  return incomingChildHashes.every((h, i) => h === libraryChildHashes[i]);
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
  // Skip elements without ANY value set information (no oid, no name, no codes)
  // Accept elements with: OID, or name, or codes
  const hasValueSetInfo = !!(element.valueSet?.oid && element.valueSet.oid !== 'N/A') ||
                          !!(element.valueSet?.name) ||
                          (element.valueSet?.codes?.length ?? 0) > 0 ||
                          (element.directCodes?.length ?? 0) > 0;

  if (!hasValueSetInfo) {
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

  // Get value set info with fallbacks
  const vsOid = element.valueSet?.oid || '';
  const vsName = element.valueSet?.name || element.description || '';

  return {
    name: element.description || vsName,
    valueSetOid: vsOid,
    valueSetName: vsName,
    timing,
    negation,
  };
}

// ============================================================================
// Public API: Approved Component Matching
// ============================================================================

/**
 * Validation result for component usage in a measure.
 */
export interface ComponentValidationResult {
  isValid: boolean;
  totalElements: number;
  linkedToApproved: number;
  linkedToDraft: number;
  unlinked: number;
  warnings: ComponentValidationWarning[];
}

export interface ComponentValidationWarning {
  elementId: string;
  elementDescription: string;
  type: 'unapproved_component' | 'no_library_match' | 'approved_available';
  message: string;
  suggestedComponentId?: string;
  suggestedComponentName?: string;
}

/**
 * Find an exact match in the library, prioritizing approved components.
 *
 * Returns the approved component if one matches, otherwise returns any match.
 * This ensures we use vetted components when available.
 */
export function findExactMatchPrioritizeApproved(
  incoming: ParsedComponent,
  library: Record<string, LibraryComponent>
): { match: LibraryComponent | null; isApproved: boolean; alternateApproved?: LibraryComponent } {
  const incomingHash = generateParsedComponentHash(incoming);
  const isComposite = incoming.children && incoming.children.length > 0;

  let approvedMatch: LibraryComponent | null = null;
  let anyMatch: LibraryComponent | null = null;

  for (const component of Object.values(library)) {
    const libraryHash = generateComponentHash(component);

    if (libraryHash === incomingHash) {
      if (component.versionInfo.status === 'approved') {
        approvedMatch = component;
        break; // Approved match found, use it
      }
      if (!anyMatch) {
        anyMatch = component;
      }
    }

    // For composite incoming vs composite library
    if (isComposite && component.type === 'composite') {
      const match = matchCompositeByChildren(incoming, component, library);
      if (match) {
        if (component.versionInfo.status === 'approved') {
          approvedMatch = component;
          break;
        }
        if (!anyMatch) {
          anyMatch = component;
        }
      }
    }
  }

  // If we have an approved match, use it
  if (approvedMatch) {
    return { match: approvedMatch, isApproved: true };
  }

  // If we have a non-approved match, also check if there's a similar approved one
  if (anyMatch) {
    // Look for an approved component with the same value set OID
    const alternateApproved = findApprovedAlternative(incoming, library);
    return { match: anyMatch, isApproved: false, alternateApproved };
  }

  // Fallback to name matching
  const nameMatch = findNameMatch(incoming, library);
  if (nameMatch) {
    return {
      match: nameMatch,
      isApproved: nameMatch.versionInfo.status === 'approved',
    };
  }

  return { match: null, isApproved: false };
}

/**
 * Find an approved component alternative for a parsed component.
 * Looks for approved components with the same value set OID.
 */
function findApprovedAlternative(
  incoming: ParsedComponent,
  library: Record<string, LibraryComponent>
): LibraryComponent | undefined {
  if (!incoming.valueSetOid) return undefined;

  for (const component of Object.values(library)) {
    if (component.type !== 'atomic') continue;
    if (component.versionInfo.status !== 'approved') continue;
    if (component.valueSet.oid === incoming.valueSetOid) {
      return component;
    }
  }

  return undefined;
}

/**
 * Validate component usage for a measure's data elements.
 *
 * Checks that:
 * 1. Elements are linked to library components where possible
 * 2. Linked components are approved when approved versions exist
 * 3. Reports warnings for unapproved or unlinked components
 */
export function validateMeasureComponents(
  elements: Array<{ id: string; description: string; libraryComponentId?: string; valueSet?: { oid?: string; name?: string } }>,
  library: Record<string, LibraryComponent>
): ComponentValidationResult {
  const warnings: ComponentValidationWarning[] = [];
  let linkedToApproved = 0;
  let linkedToDraft = 0;
  let unlinked = 0;

  for (const element of elements) {
    if (!element.valueSet?.oid || element.valueSet.oid === 'N/A') {
      // Skip elements without value sets (demographics, etc.)
      continue;
    }

    if (element.libraryComponentId && element.libraryComponentId !== '__ZERO_CODES__') {
      const component = library[element.libraryComponentId];
      if (component) {
        if (component.versionInfo.status === 'approved') {
          linkedToApproved++;
        } else {
          linkedToDraft++;
          // Check if there's an approved alternative
          const approvedAlt = Object.values(library).find(
            c => c.type === 'atomic' &&
                 c.versionInfo.status === 'approved' &&
                 (c as AtomicComponent).valueSet.oid === element.valueSet?.oid
          );

          if (approvedAlt) {
            warnings.push({
              elementId: element.id,
              elementDescription: element.description,
              type: 'approved_available',
              message: `Linked to draft component, but approved component "${approvedAlt.name}" is available`,
              suggestedComponentId: approvedAlt.id,
              suggestedComponentName: approvedAlt.name,
            });
          } else {
            warnings.push({
              elementId: element.id,
              elementDescription: element.description,
              type: 'unapproved_component',
              message: `Linked to unapproved component (status: ${component.versionInfo.status})`,
            });
          }
        }
      } else {
        unlinked++;
        warnings.push({
          elementId: element.id,
          elementDescription: element.description,
          type: 'no_library_match',
          message: 'Component reference not found in library',
        });
      }
    } else {
      unlinked++;
      // Check if there's an approved component that should be used
      const approvedMatch = Object.values(library).find(
        c => c.type === 'atomic' &&
             c.versionInfo.status === 'approved' &&
             (c as AtomicComponent).valueSet.oid === element.valueSet?.oid
      );

      if (approvedMatch) {
        warnings.push({
          elementId: element.id,
          elementDescription: element.description,
          type: 'approved_available',
          message: `No library link, but approved component "${approvedMatch.name}" is available`,
          suggestedComponentId: approvedMatch.id,
          suggestedComponentName: approvedMatch.name,
        });
      }
    }
  }

  const totalElements = elements.filter(e => e.valueSet?.oid && e.valueSet.oid !== 'N/A').length;
  const isValid = warnings.filter(w => w.type === 'approved_available').length === 0;

  return {
    isValid,
    totalElements,
    linkedToApproved,
    linkedToDraft,
    unlinked,
    warnings,
  };
}
