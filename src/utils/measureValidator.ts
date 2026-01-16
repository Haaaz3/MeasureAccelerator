/**
 * Measure Validation Utilities
 *
 * Validates that measure data conforms to the UMS schema and
 * ensures consistency across all data paths.
 */

import type {
  UniversalMeasureSpec,
  PopulationDefinition,
  LogicalClause,
  DataElement,
} from '../types/ums';

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  path: string;
  message: string;
  fix?: string;
}

/**
 * Validate a measure against the UMS schema and detect common issues
 */
export function validateMeasure(measure: UniversalMeasureSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Required fields
  if (!measure.id) {
    issues.push({ severity: 'error', path: 'id', message: 'Measure ID is required' });
  }
  if (!measure.metadata?.measureId) {
    issues.push({ severity: 'error', path: 'metadata.measureId', message: 'Measure ID in metadata is required' });
  }
  if (!measure.metadata?.title) {
    issues.push({ severity: 'error', path: 'metadata.title', message: 'Measure title is required' });
  }

  // 2. Populations validation
  if (!measure.populations || measure.populations.length === 0) {
    issues.push({ severity: 'error', path: 'populations', message: 'At least one population is required' });
  } else {
    // Check for required population types
    const hasInitialPop = measure.populations.some(p => p.type === 'initial_population');
    const hasDenominator = measure.populations.some(p => p.type === 'denominator');
    const hasNumerator = measure.populations.some(p => p.type === 'numerator');

    if (!hasInitialPop) {
      issues.push({ severity: 'warning', path: 'populations', message: 'Missing Initial Population definition' });
    }
    if (!hasDenominator) {
      issues.push({ severity: 'info', path: 'populations', message: 'Missing Denominator definition (will default to Initial Population)' });
    }
    if (!hasNumerator) {
      issues.push({ severity: 'warning', path: 'populations', message: 'Missing Numerator definition' });
    }

    // Validate each population
    measure.populations.forEach((pop, i) => {
      validatePopulation(pop, `populations[${i}]`, issues);
    });
  }

  // 3. Age constraint consistency
  const ageIssues = validateAgeConsistency(measure);
  issues.push(...ageIssues);

  // 4. Value sets validation
  if (measure.valueSets) {
    measure.valueSets.forEach((vs, i) => {
      if (!vs.name) {
        issues.push({ severity: 'error', path: `valueSets[${i}]`, message: 'Value set name is required' });
      }
      if (!vs.codes || vs.codes.length === 0) {
        issues.push({ severity: 'warning', path: `valueSets[${i}]`, message: `Value set "${vs.name}" has no codes` });
      }
    });
  }

  // 5. Review progress consistency
  if (measure.reviewProgress) {
    const { total, approved, pending, flagged } = measure.reviewProgress;
    if (approved + pending + flagged !== total) {
      issues.push({
        severity: 'warning',
        path: 'reviewProgress',
        message: `Review counts don't sum to total: ${approved} + ${pending} + ${flagged} ≠ ${total}`,
        fix: 'Recalculate review progress'
      });
    }
  }

  return issues;
}

/**
 * Validate a single population definition
 */
function validatePopulation(pop: PopulationDefinition, path: string, issues: ValidationIssue[]): void {
  if (!pop.id) {
    issues.push({ severity: 'error', path: `${path}.id`, message: 'Population ID is required' });
  }
  if (!pop.type) {
    issues.push({ severity: 'error', path: `${path}.type`, message: 'Population type is required' });
  }
  if (!pop.criteria) {
    issues.push({ severity: 'warning', path: `${path}.criteria`, message: 'Population has no criteria defined' });
  } else {
    validateClause(pop.criteria, `${path}.criteria`, issues);
  }
}

/**
 * Validate a logical clause and its children
 */
function validateClause(clause: LogicalClause, path: string, issues: ValidationIssue[]): void {
  if (!clause.id) {
    issues.push({ severity: 'error', path: `${path}.id`, message: 'Clause ID is required' });
  }
  if (!clause.operator) {
    issues.push({ severity: 'warning', path: `${path}.operator`, message: 'Clause has no operator (defaulting to AND)' });
  }
  if (!clause.children || clause.children.length === 0) {
    issues.push({ severity: 'warning', path: `${path}.children`, message: 'Clause has no children' });
  } else {
    clause.children.forEach((child, i) => {
      if ('operator' in child) {
        validateClause(child as LogicalClause, `${path}.children[${i}]`, issues);
      } else {
        validateDataElement(child as DataElement, `${path}.children[${i}]`, issues);
      }
    });
  }
}

/**
 * Validate a data element
 */
function validateDataElement(element: DataElement, path: string, issues: ValidationIssue[]): void {
  if (!element.id) {
    issues.push({ severity: 'error', path: `${path}.id`, message: 'Data element ID is required' });
  }
  if (!element.type) {
    issues.push({ severity: 'warning', path: `${path}.type`, message: 'Data element has no type' });
  }
  if (!element.description) {
    issues.push({ severity: 'warning', path: `${path}.description`, message: 'Data element has no description' });
  }

  // Check for deprecated field usage
  if ((element as any).constraints) {
    issues.push({
      severity: 'warning',
      path: `${path}.constraints`,
      message: 'Using deprecated "constraints" field, should use "thresholds"',
      fix: 'Migrate constraints to thresholds: { ageMin, ageMax, valueMin, valueMax }'
    });
  }
  if ((element as any).temporalConstraints) {
    issues.push({
      severity: 'info',
      path: `${path}.temporalConstraints`,
      message: 'Using deprecated "temporalConstraints", should use "timingRequirements"'
    });
  }
}

/**
 * Check for age constraint consistency across the measure
 */
function validateAgeConsistency(measure: UniversalMeasureSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const foundAges: Array<{ path: string; min?: number; max?: number }> = [];

  // Check globalConstraints
  if (measure.globalConstraints?.ageRange) {
    foundAges.push({
      path: 'globalConstraints.ageRange',
      min: measure.globalConstraints.ageRange.min,
      max: measure.globalConstraints.ageRange.max
    });
  }

  // Find ages in populations
  const findAges = (node: any, path: string) => {
    if (!node) return;

    // Check thresholds (canonical)
    if (node.thresholds?.ageMin !== undefined || node.thresholds?.ageMax !== undefined) {
      foundAges.push({
        path: `${path}.thresholds`,
        min: node.thresholds.ageMin,
        max: node.thresholds.ageMax
      });
    }

    // Check deprecated constraints
    if (node.constraints?.ageMin !== undefined || node.constraints?.ageMax !== undefined) {
      foundAges.push({
        path: `${path}.constraints (deprecated)`,
        min: node.constraints.ageMin,
        max: node.constraints.ageMax
      });
    }

    // Recurse
    if (node.criteria) findAges(node.criteria, `${path}.criteria`);
    if (node.children) {
      node.children.forEach((child: any, i: number) => findAges(child, `${path}.children[${i}]`));
    }
  };

  measure.populations.forEach((pop, i) => findAges(pop, `populations[${i}]`));

  // Check for inconsistencies
  if (foundAges.length > 1) {
    const baseline = foundAges[0];
    for (let i = 1; i < foundAges.length; i++) {
      const current = foundAges[i];
      if (current.min !== baseline.min || current.max !== baseline.max) {
        issues.push({
          severity: 'warning',
          path: current.path,
          message: `Age mismatch: ${baseline.path} has ${baseline.min}-${baseline.max}, but ${current.path} has ${current.min}-${current.max}`,
          fix: 'Use syncAgeRange() to synchronize age constraints'
        });
      }
    }
  }

  // Extract ages from description text and compare
  const descMatch = measure.metadata.description.match(/(\d+)\s*[-–to]+\s*(\d+)\s*(?:years?|yrs?)/i);
  if (descMatch && foundAges.length > 0) {
    const descMin = parseInt(descMatch[1]);
    const descMax = parseInt(descMatch[2]);
    const baseline = foundAges[0];
    if (descMin !== baseline.min || descMax !== baseline.max) {
      issues.push({
        severity: 'warning',
        path: 'metadata.description',
        message: `Description says ${descMin}-${descMax} but constraints say ${baseline.min}-${baseline.max}`,
        fix: 'Update description or use syncAgeRange() to synchronize'
      });
    }
  }

  return issues;
}

/**
 * Get a summary of validation results
 */
export function getValidationSummary(issues: ValidationIssue[]): {
  errors: number;
  warnings: number;
  info: number;
  isValid: boolean;
} {
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const info = issues.filter(i => i.severity === 'info').length;

  return {
    errors,
    warnings,
    info,
    isValid: errors === 0
  };
}
