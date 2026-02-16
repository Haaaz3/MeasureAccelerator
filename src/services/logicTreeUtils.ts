/**
 * Logic Tree Utilities (3.A - Rich Logic Trees)
 *
 * Provides utilities for working with LogicalClause trees in UMS.
 * Addresses the "A AND (B OR C)" problem by providing proper tree manipulation.
 *
 * Key features:
 * - Logic tree validation
 * - Flat/tree conversion
 * - Natural language generation
 * - CQL expression generation
 * - Tree manipulation utilities
 */

import type {
  DataElement,
  LogicalClause,
  LogicalOperator,
  PopulationDefinition,
  SiblingConnection,
} from '../types/ums';

// ============================================================================
// Types
// ============================================================================

/**
 * Simplified logic node for display/editing
 * This is the "flat" representation mentioned in the audit
 */
export interface FlatLogicItem {
  id: string;
  type: 'criterion' | 'group';
  /** For criteria: the DataElement ID */
  criterionId?: string;
  /** For groups: the operator */
  operator?: LogicalOperator;
  /** Display label */
  label: string;
  /** Nesting depth (for indentation) */
  depth: number;
  /** Parent group ID (null for root) */
  parentId: string | null;
  /** Original reference */
  originalNode: DataElement | LogicalClause;
}

/**
 * Logic tree validation result
 */
export interface LogicTreeValidation {
  valid: boolean;
  errors: LogicTreeError[];
  warnings: LogicTreeWarning[];
  stats: {
    totalNodes: number;
    maxDepth: number;
    criteriaCount: number;
    groupCount: number;
  };
}

export interface LogicTreeError {
  code: LogicTreeErrorCode;
  message: string;
  nodeId?: string;
  path?: string;
}

export interface LogicTreeWarning {
  code: LogicTreeWarningCode;
  message: string;
  nodeId?: string;
}

export type LogicTreeErrorCode =
  | 'EMPTY_TREE'
  | 'EMPTY_GROUP'
  | 'NOT_WITH_MULTIPLE_CHILDREN'
  | 'ORPHAN_CRITERION'
  | 'CIRCULAR_REFERENCE'
  | 'INVALID_OPERATOR';

export type LogicTreeWarningCode =
  | 'SINGLE_CHILD_GROUP'
  | 'DEEPLY_NESTED'
  | 'MIXED_OPERATORS';

// ============================================================================
// Tree Traversal
// ============================================================================

/**
 * Walk all nodes in a logic tree (depth-first)
 */
export function* walkLogicTree(
  clause: LogicalClause,
  depth: number = 0,
  path: string = 'root'
): Generator<{ node: DataElement | LogicalClause; depth: number; path: string; isClause: boolean }> {
  yield { node: clause, depth, path, isClause: true };

  for (let i = 0; i < clause.children.length; i++) {
    const child = clause.children[i];
    const childPath = `${path}.children[${i}]`;

    if (isLogicalClause(child)) {
      yield* walkLogicTree(child, depth + 1, childPath);
    } else {
      yield { node: child, depth: depth + 1, path: childPath, isClause: false };
    }
  }
}

/**
 * Get all DataElements from a logic tree
 */
export function getAllCriteria(clause: LogicalClause): DataElement[] {
  const criteria: DataElement[] = [];

  for (const { node, isClause } of walkLogicTree(clause)) {
    if (!isClause) {
      criteria.push(node as DataElement);
    }
  }

  return criteria;
}

/**
 * Get all groups (LogicalClauses) from a tree
 */
export function getAllGroups(clause: LogicalClause): LogicalClause[] {
  const groups: LogicalClause[] = [];

  for (const { node, isClause } of walkLogicTree(clause)) {
    if (isClause) {
      groups.push(node as LogicalClause);
    }
  }

  return groups;
}

/**
 * Calculate tree depth
 */
export function getTreeDepth(clause: LogicalClause): number {
  let maxDepth = 0;

  for (const { depth } of walkLogicTree(clause)) {
    if (depth > maxDepth) {
      maxDepth = depth;
    }
  }

  return maxDepth;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a node is a LogicalClause
 */
export function isLogicalClause(node: DataElement | LogicalClause): node is LogicalClause {
  return 'operator' in node && 'children' in node && Array.isArray((node as LogicalClause).children);
}

/**
 * Check if a node is a DataElement
 */
export function isDataElement(node: DataElement | LogicalClause): node is DataElement {
  return 'type' in node && !('children' in node);
}

// ============================================================================
// Tree Validation
// ============================================================================

/**
 * Validate a logic tree for structural correctness
 */
export function validateLogicTree(clause: LogicalClause | null | undefined): LogicTreeValidation {
  const errors: LogicTreeError[] = [];
  const warnings: LogicTreeWarning[] = [];
  let criteriaCount = 0;
  let groupCount = 0;
  let maxDepth = 0;

  if (!clause) {
    return {
      valid: false,
      errors: [{ code: 'EMPTY_TREE', message: 'Logic tree is empty or undefined' }],
      warnings: [],
      stats: { totalNodes: 0, maxDepth: 0, criteriaCount: 0, groupCount: 0 },
    };
  }

  const seenIds = new Set<string>();

  for (const { node, depth, path, isClause } of walkLogicTree(clause)) {
    if (depth > maxDepth) maxDepth = depth;

    // Track IDs for circular reference check
    if (node.id) {
      if (seenIds.has(node.id)) {
        errors.push({
          code: 'CIRCULAR_REFERENCE',
          message: `Duplicate node ID detected: ${node.id}`,
          nodeId: node.id,
          path,
        });
      }
      seenIds.add(node.id);
    }

    if (isClause) {
      const clauseNode = node as LogicalClause;
      groupCount++;

      // Check for empty groups
      if (!clauseNode.children || clauseNode.children.length === 0) {
        errors.push({
          code: 'EMPTY_GROUP',
          message: 'Group has no children',
          nodeId: clauseNode.id,
          path,
        });
      }

      // Check for NOT with multiple children
      if (clauseNode.operator === 'NOT' && clauseNode.children && clauseNode.children.length > 1) {
        errors.push({
          code: 'NOT_WITH_MULTIPLE_CHILDREN',
          message: 'NOT operator should have exactly one child',
          nodeId: clauseNode.id,
          path,
        });
      }

      // Warning: single child group
      if (clauseNode.children && clauseNode.children.length === 1 && clauseNode.operator !== 'NOT') {
        warnings.push({
          code: 'SINGLE_CHILD_GROUP',
          message: 'Group has only one child - consider flattening',
          nodeId: clauseNode.id,
        });
      }

      // Check for valid operator
      if (!['AND', 'OR', 'NOT'].includes(clauseNode.operator)) {
        errors.push({
          code: 'INVALID_OPERATOR',
          message: `Invalid operator: ${clauseNode.operator}`,
          nodeId: clauseNode.id,
          path,
        });
      }
    } else {
      criteriaCount++;
    }
  }

  // Warning: deeply nested
  if (maxDepth > 4) {
    warnings.push({
      code: 'DEEPLY_NESTED',
      message: `Tree is deeply nested (depth: ${maxDepth}). Consider simplifying.`,
    });
  }

  // Warning: mixed operators at same level
  for (const group of getAllGroups(clause)) {
    if (group.siblingConnections && group.siblingConnections.length > 0) {
      warnings.push({
        code: 'MIXED_OPERATORS',
        message: `Group "${group.description || group.id}" has mixed operators between siblings`,
        nodeId: group.id,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalNodes: criteriaCount + groupCount,
      maxDepth,
      criteriaCount,
      groupCount,
    },
  };
}

// ============================================================================
// Flat/Tree Conversion
// ============================================================================

/**
 * Convert a logic tree to a flat list for display
 */
export function treeToFlat(clause: LogicalClause): FlatLogicItem[] {
  const items: FlatLogicItem[] = [];

  function visit(node: DataElement | LogicalClause, depth: number, parentId: string | null): void {
    if (isLogicalClause(node)) {
      items.push({
        id: node.id,
        type: 'group',
        operator: node.operator,
        label: node.description || `${node.operator} group`,
        depth,
        parentId,
        originalNode: node,
      });

      for (const child of node.children) {
        visit(child, depth + 1, node.id);
      }
    } else {
      items.push({
        id: node.id,
        type: 'criterion',
        criterionId: node.id,
        label: node.description || `${node.type} criterion`,
        depth,
        parentId,
        originalNode: node,
      });
    }
  }

  visit(clause, 0, null);
  return items;
}

/**
 * Convert a flat list back to a tree
 * Note: This requires the flat list to maintain proper parent references
 */
export function flatToTree(
  items: FlatLogicItem[],
  criteria: Map<string, DataElement>
): LogicalClause | null {
  if (items.length === 0) return null;

  const nodeMap = new Map<string, LogicalClause>();

  // First pass: create all group nodes
  for (const item of items) {
    if (item.type === 'group') {
      nodeMap.set(item.id, {
        id: item.id,
        operator: item.operator || 'AND',
        description: item.label,
        children: [],
        confidence: 'high',
        reviewStatus: 'pending',
      });
    }
  }

  // Second pass: build tree structure
  let root: LogicalClause | null = null;

  for (const item of items) {
    if (item.type === 'group') {
      const node = nodeMap.get(item.id)!;

      if (item.parentId === null) {
        root = node;
      } else {
        const parent = nodeMap.get(item.parentId);
        if (parent) {
          parent.children.push(node);
        }
      }
    } else if (item.type === 'criterion' && item.criterionId) {
      const criterion = criteria.get(item.criterionId);
      if (criterion && item.parentId) {
        const parent = nodeMap.get(item.parentId);
        if (parent) {
          parent.children.push(criterion);
        }
      }
    }
  }

  return root;
}

// ============================================================================
// Natural Language Generation
// ============================================================================

/**
 * Generate natural language description of a logic tree
 */
export function generateNaturalLanguage(clause: LogicalClause): string {
  function describe(node: DataElement | LogicalClause, depth: number = 0): string {
    if (isDataElement(node)) {
      return node.description || `[${node.type}]`;
    }

    const clauseNode = node as LogicalClause;

    if (clauseNode.operator === 'NOT') {
      const child = clauseNode.children[0];
      return `NOT (${describe(child, depth + 1)})`;
    }

    const childDescriptions = clauseNode.children.map(c => describe(c, depth + 1));

    if (childDescriptions.length === 1) {
      return childDescriptions[0];
    }

    // Handle sibling connections for mixed operators
    if (clauseNode.siblingConnections && clauseNode.siblingConnections.length > 0) {
      return buildMixedOperatorDescription(clauseNode, childDescriptions);
    }

    const connector = clauseNode.operator === 'AND' ? ' AND ' : ' OR ';
    const joined = childDescriptions.join(connector);

    // Wrap in parentheses if nested
    return depth > 0 ? `(${joined})` : joined;
  }

  return describe(clause);
}

/**
 * Build description for mixed operators
 */
function buildMixedOperatorDescription(
  clause: LogicalClause,
  childDescriptions: string[]
): string {
  const parts: string[] = [];
  let currentOp: LogicalOperator = clause.operator;

  for (let i = 0; i < childDescriptions.length; i++) {
    parts.push(childDescriptions[i]);

    if (i < childDescriptions.length - 1) {
      const nextOp = getOperatorBetween(clause, i, i + 1);
      parts.push(` ${nextOp} `);
      currentOp = nextOp;
    }
  }

  return parts.join('');
}

/**
 * Get operator between two siblings
 */
function getOperatorBetween(
  clause: LogicalClause,
  index1: number,
  index2: number
): LogicalOperator {
  if (clause.siblingConnections) {
    const connection = clause.siblingConnections.find(
      c =>
        (c.fromIndex === index1 && c.toIndex === index2) ||
        (c.fromIndex === index2 && c.toIndex === index1)
    );
    if (connection) {
      return connection.operator;
    }
  }
  return clause.operator;
}

// ============================================================================
// CQL Expression Generation
// ============================================================================

/**
 * Generate CQL expression from a logic tree
 */
export function generateCQLFromTree(
  clause: LogicalClause,
  getCriterionCQL: (element: DataElement) => string
): string {
  function generate(node: DataElement | LogicalClause): string {
    if (isDataElement(node)) {
      return getCriterionCQL(node);
    }

    const clauseNode = node as LogicalClause;

    if (clauseNode.operator === 'NOT') {
      const child = clauseNode.children[0];
      return `not (${generate(child)})`;
    }

    const childExprs = clauseNode.children.map(c => generate(c));

    if (childExprs.length === 1) {
      return childExprs[0];
    }

    // Handle mixed operators
    if (clauseNode.siblingConnections && clauseNode.siblingConnections.length > 0) {
      return buildMixedOperatorCQL(clauseNode, childExprs);
    }

    const connector = clauseNode.operator === 'AND' ? '\n    and ' : '\n    or ';
    return `(${childExprs.join(connector)})`;
  }

  return generate(clause);
}

/**
 * Build CQL for mixed operators
 */
function buildMixedOperatorCQL(
  clause: LogicalClause,
  childExprs: string[]
): string {
  const parts: string[] = [];

  for (let i = 0; i < childExprs.length; i++) {
    if (i > 0) {
      const op = getOperatorBetween(clause, i - 1, i);
      parts.push(op === 'AND' ? '\n    and ' : '\n    or ');
    }
    parts.push(childExprs[i]);
  }

  return `(${parts.join('')})`;
}

// ============================================================================
// Tree Manipulation
// ============================================================================

/**
 * Create a new logical group
 */
export function createGroup(
  operator: LogicalOperator,
  children: (DataElement | LogicalClause)[],
  description?: string
): LogicalClause {
  return {
    id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    operator,
    description: description || `${operator} group`,
    children,
    confidence: 'high',
    reviewStatus: 'pending',
  };
}

/**
 * Wrap criteria in a group
 */
export function wrapInGroup(
  criteria: (DataElement | LogicalClause)[],
  operator: LogicalOperator
): LogicalClause {
  return createGroup(operator, criteria, `${operator} group`);
}

/**
 * Add a child to a group (immutable)
 */
export function addChild(
  clause: LogicalClause,
  child: DataElement | LogicalClause
): LogicalClause {
  return {
    ...clause,
    children: [...clause.children, child],
  };
}

/**
 * Remove a child from a group (immutable)
 */
export function removeChild(
  clause: LogicalClause,
  childId: string
): LogicalClause {
  return {
    ...clause,
    children: clause.children.filter(c => c.id !== childId),
    // Also remove any sibling connections involving this child
    siblingConnections: clause.siblingConnections?.filter(
      sc => {
        const removedIndex = clause.children.findIndex(c => c.id === childId);
        return sc.fromIndex !== removedIndex && sc.toIndex !== removedIndex;
      }
    ),
  };
}

/**
 * Replace a child in a group (immutable)
 */
export function replaceChild(
  clause: LogicalClause,
  oldChildId: string,
  newChild: DataElement | LogicalClause
): LogicalClause {
  return {
    ...clause,
    children: clause.children.map(c => (c.id === oldChildId ? newChild : c)),
  };
}

/**
 * Change the operator of a group (immutable)
 */
export function changeOperator(
  clause: LogicalClause,
  newOperator: LogicalOperator
): LogicalClause {
  return {
    ...clause,
    operator: newOperator,
    // Clear sibling connections when changing main operator
    siblingConnections: undefined,
  };
}

/**
 * Set operator between specific siblings (immutable)
 */
export function setOperatorBetweenSiblings(
  clause: LogicalClause,
  index1: number,
  index2: number,
  operator: LogicalOperator
): LogicalClause {
  const connections = clause.siblingConnections || [];

  // Remove existing connection
  const filtered = connections.filter(
    c =>
      !((c.fromIndex === index1 && c.toIndex === index2) ||
        (c.fromIndex === index2 && c.toIndex === index1))
  );

  // Add new connection if different from default
  if (operator !== clause.operator) {
    filtered.push({
      fromIndex: Math.min(index1, index2),
      toIndex: Math.max(index1, index2),
      operator,
    });
  }

  return {
    ...clause,
    siblingConnections: filtered.length > 0 ? filtered : undefined,
  };
}

/**
 * Flatten unnecessary nesting (single-child groups)
 */
export function flattenTree(clause: LogicalClause): LogicalClause {
  const flattenedChildren = clause.children.map(child => {
    if (isLogicalClause(child)) {
      const flattened = flattenTree(child);

      // If single-child group with same operator, unwrap
      if (
        flattened.children.length === 1 &&
        flattened.operator !== 'NOT'
      ) {
        return flattened.children[0];
      }

      return flattened;
    }
    return child;
  });

  return {
    ...clause,
    children: flattenedChildren,
  };
}

// ============================================================================
// Population Logic Helpers
// ============================================================================

/**
 * Extract the logic tree from a population definition
 */
export function getPopulationLogicTree(pop: PopulationDefinition): LogicalClause | null {
  return pop.criteria || null;
}

/**
 * Check if a population has valid criteria
 */
export function hasValidCriteria(pop: PopulationDefinition): boolean {
  const validation = validateLogicTree(pop.criteria);
  return validation.valid && validation.stats.criteriaCount > 0;
}

/**
 * Get a summary of a population's logic
 */
export function getPopulationLogicSummary(pop: PopulationDefinition): {
  criteriaCount: number;
  hasNesting: boolean;
  operators: LogicalOperator[];
  naturalLanguage: string;
} {
  if (!pop.criteria) {
    return {
      criteriaCount: 0,
      hasNesting: false,
      operators: [],
      naturalLanguage: 'No criteria defined',
    };
  }

  const validation = validateLogicTree(pop.criteria);
  const groups = getAllGroups(pop.criteria);
  const operators = [...new Set(groups.map(g => g.operator))];

  return {
    criteriaCount: validation.stats.criteriaCount,
    hasNesting: validation.stats.maxDepth > 1,
    operators,
    naturalLanguage: generateNaturalLanguage(pop.criteria),
  };
}

// ============================================================================
// Tree Comparison
// ============================================================================

/**
 * Compare two logic trees for structural equality
 */
export function areTreesEqual(
  tree1: LogicalClause | null,
  tree2: LogicalClause | null
): boolean {
  if (!tree1 && !tree2) return true;
  if (!tree1 || !tree2) return false;

  if (tree1.operator !== tree2.operator) return false;
  if (tree1.children.length !== tree2.children.length) return false;

  for (let i = 0; i < tree1.children.length; i++) {
    const child1 = tree1.children[i];
    const child2 = tree2.children[i];

    const isClause1 = isLogicalClause(child1);
    const isClause2 = isLogicalClause(child2);

    if (isClause1 !== isClause2) return false;

    if (isClause1 && isClause2) {
      if (!areTreesEqual(child1 as LogicalClause, child2 as LogicalClause)) {
        return false;
      }
    } else {
      if ((child1 as DataElement).id !== (child2 as DataElement).id) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Calculate a diff between two trees
 */
export interface TreeDiff {
  added: string[];
  removed: string[];
  operatorChanges: Array<{ nodeId: string; from: LogicalOperator; to: LogicalOperator }>;
}

export function diffTrees(
  tree1: LogicalClause | null,
  tree2: LogicalClause | null
): TreeDiff {
  const criteria1 = tree1 ? getAllCriteria(tree1).map(c => c.id) : [];
  const criteria2 = tree2 ? getAllCriteria(tree2).map(c => c.id) : [];

  const set1 = new Set(criteria1);
  const set2 = new Set(criteria2);

  const added = criteria2.filter(id => !set1.has(id));
  const removed = criteria1.filter(id => !set2.has(id));

  const operatorChanges: TreeDiff['operatorChanges'] = [];

  if (tree1 && tree2) {
    const groups1 = new Map(getAllGroups(tree1).map(g => [g.id, g]));
    const groups2 = new Map(getAllGroups(tree2).map(g => [g.id, g]));

    for (const [id, g2] of groups2) {
      const g1 = groups1.get(id);
      if (g1 && g1.operator !== g2.operator) {
        operatorChanges.push({ nodeId: id, from: g1.operator, to: g2.operator });
      }
    }
  }

  return { added, removed, operatorChanges };
}
