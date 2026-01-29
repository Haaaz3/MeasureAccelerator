/**
 * Complexity Calculator Service
 *
 * Calculates complexity scores for component library items based on:
 * - Atomic: base(1) + timing clauses + negation penalty
 * - Composite: sum of children + AND operator penalty + nesting depth penalty
 *
 * Thresholds: Low (1-3), Medium (4-7), High (8+)
 */

import type {
  AtomicComponent,
  CompositeComponent,
  LibraryComponent,
  ComponentComplexity,
  ComplexityLevel,
  ComplexityFactors,
  TimingExpression,
} from '../types/componentLibrary';

// ============================================================================
// Complexity Level
// ============================================================================

/**
 * Determines complexity level from a numeric score.
 *   Low:    1-3
 *   Medium: 4-7
 *   High:   8+
 */
export function getComplexityLevel(score: number): ComplexityLevel {
  if (score <= 3) return 'low';
  if (score <= 7) return 'medium';
  return 'high';
}

// ============================================================================
// Timing Clause Counter
// ============================================================================

/**
 * Counts the number of timing clauses in a TimingExpression.
 *
 * - Simple operators ('during', 'before', 'after', 'overlaps'): 1 clause
 * - Operators with quantity ('within' + quantity): 2 clauses
 * - Operators with position ('starts before' + position): 2 clauses
 * - Both quantity and position: 2 clauses (capped at 2)
 */
export function countTimingClauses(timing: TimingExpression): number {
  let count = 1; // Every timing expression has at least 1 clause

  const hasQuantity = timing.quantity != null;
  const hasPosition = timing.position != null;

  if (hasQuantity || hasPosition) {
    count = 2;
  }

  return count;
}

// ============================================================================
// Atomic Complexity
// ============================================================================

/**
 * Calculates complexity for an atomic component.
 *
 * Score = base(1) + timingClauses + negation(2 if true)
 */
export function calculateAtomicComplexity(
  component: Omit<AtomicComponent, 'complexity'>
): ComponentComplexity {
  const base = 1;
  const timingClauses = countTimingClauses(component.timing);
  const negations = component.negation ? 1 : 0;
  const negationScore = component.negation ? 2 : 0;

  const score = base + timingClauses + negationScore;

  const factors: ComplexityFactors = {
    base,
    timingClauses,
    negations,
  };

  return {
    level: getComplexityLevel(score),
    score,
    factors,
  };
}

// ============================================================================
// Composite Complexity
// ============================================================================

/**
 * Calculates complexity for a composite component.
 *
 * Score = sum of children's scores
 *       + AND penalty (children.length - 1 for AND operator)
 *       + nesting depth penalty (+2 per level beyond 1)
 *
 * The resolveChild callback looks up child components by ID so their
 * complexity scores can be summed.
 */
export function calculateCompositeComplexity(
  composite: Omit<CompositeComponent, 'complexity'>,
  resolveChild: (id: string) => LibraryComponent | null
): ComponentComplexity {
  let childrenSum = 0;
  let maxChildNestingDepth = 0;

  for (const childRef of composite.children) {
    const child = resolveChild(childRef.componentId);
    if (child) {
      childrenSum += child.complexity.score;

      // Track nesting depth: composites contribute depth
      if (child.type === 'composite') {
        const childNesting = child.complexity.factors.nestingDepth ?? 0;
        maxChildNestingDepth = Math.max(maxChildNestingDepth, childNesting + 1);
      }
    }
  }

  // AND operator adds +1 per connection (children.length - 1)
  const andOperators =
    composite.operator === 'AND' && composite.children.length > 1
      ? composite.children.length - 1
      : 0;

  // Nesting depth beyond 1 adds +2 per additional level
  const nestingDepth = maxChildNestingDepth;
  const nestingPenalty = nestingDepth > 0 ? nestingDepth * 2 : 0;

  const score = childrenSum + andOperators + nestingPenalty;

  const factors: ComplexityFactors = {
    base: 0,
    timingClauses: 0,
    negations: 0,
    childrenSum,
    andOperators,
    nestingDepth,
  };

  return {
    level: getComplexityLevel(score),
    score,
    factors,
  };
}

// ============================================================================
// Data Element Complexity (for UMS Editor)
// ============================================================================

/**
 * Calculates complexity level for a UMS DataElement based on its structure.
 *
 * Score = base(1) + timing clauses + negation(2 if true)
 *
 * Simple demographics (gender, age) with no timing = score 1 (low)
 * Elements with timing = score 2-3 (low)
 * Elements with negation = score 4+ (medium)
 */
export function calculateDataElementComplexity(element: {
  type?: string;
  description?: string;
  negation?: boolean;
  timingRequirements?: Array<{
    description?: string;
    window?: { value: number; unit: string; direction: string };
  }>;
  valueSet?: { oid?: string };
}): ComplexityLevel {
  let score = 1; // base

  // Count timing clauses
  if (element.timingRequirements && element.timingRequirements.length > 0) {
    for (const tr of element.timingRequirements) {
      score += 1; // each timing requirement adds 1
      if (tr.window) {
        score += 1; // windowed timing is more complex
      }
    }
  }

  // Negation adds +2
  const desc = element.description?.toLowerCase() || '';
  if (element.negation || desc.includes('absence of') || desc.includes('without')) {
    score += 2;
  }

  return getComplexityLevel(score);
}

/**
 * Calculates complexity for a population section by summing all
 * data element complexities in its criteria tree.
 */
export function calculatePopulationComplexity(population: {
  criteria?: {
    operator?: string;
    children?: Array<any>;
  };
}): ComplexityLevel {
  if (!population.criteria?.children) return 'low';

  const score = sumCriteriaScore(population.criteria);
  return getComplexityLevel(score);
}

/**
 * Recursively sums complexity scores through a criteria tree
 * (LogicalClause and DataElement nodes).
 */
function sumCriteriaScore(node: any): number {
  if (!node) return 0;

  // If it's a logical clause (has operator + children)
  if (node.operator && node.children) {
    let childSum = 0;
    for (const child of node.children) {
      childSum += sumCriteriaScore(child);
    }
    // AND operator adds +1 per connection
    if (node.operator === 'AND' && node.children.length > 1) {
      childSum += node.children.length - 1;
    }
    return childSum;
  }

  // It's a data element — calculate its individual score
  return calculateDataElementScore(node);
}

/**
 * Returns numeric score for a single data element.
 */
function calculateDataElementScore(element: {
  description?: string;
  negation?: boolean;
  timingRequirements?: Array<{
    window?: { value: number; unit: string; direction: string };
  }>;
}): number {
  let score = 1; // base

  if (element.timingRequirements && element.timingRequirements.length > 0) {
    for (const tr of element.timingRequirements) {
      score += 1;
      if (tr.window) {
        score += 1;
      }
    }
  }

  const desc = element.description?.toLowerCase() || '';
  if (element.negation || desc.includes('absence of') || desc.includes('without')) {
    score += 2;
  }

  return score;
}

/**
 * Calculates overall measure complexity by summing all population scores.
 */
export function calculateMeasureComplexity(populations: Array<{
  criteria?: {
    operator?: string;
    children?: Array<any>;
  };
}>): ComplexityLevel {
  let totalScore = 0;
  for (const pop of populations) {
    if (pop.criteria) {
      totalScore += sumCriteriaScore(pop.criteria);
    }
  }
  return getComplexityLevel(totalScore);
}

// ============================================================================
// UI Helpers
// ============================================================================

/**
 * Returns a Tailwind-compatible color string for a complexity level.
 */
export function getComplexityColor(level: ComplexityLevel): string {
  switch (level) {
    case 'low':
      return 'text-green-600';
    case 'medium':
      return 'text-yellow-600';
    case 'high':
      return 'text-red-600';
  }
}

/**
 * Returns a dot indicator string for visual complexity display.
 */
export function getComplexityDots(level: ComplexityLevel): string {
  switch (level) {
    case 'low':
      return '\u25CF';
    case 'medium':
      return '\u25CF\u25CF';
    case 'high':
      return '\u25CF\u25CF\u25CF';
  }
}
