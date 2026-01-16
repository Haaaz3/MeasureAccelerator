/**
 * Constraint Synchronization Utilities
 *
 * Ensures that age ranges and other global constraints are consistent
 * throughout the entire measure specification.
 */

import type {
  UniversalMeasureSpec,
  PopulationDefinition,
  LogicalClause,
  DataElement,
  GlobalConstraints
} from '../types/ums';

/**
 * Update age range throughout the entire measure.
 * This is the single function to call when age constraints change.
 */
export function syncAgeConstraints(
  measure: UniversalMeasureSpec,
  newMin: number,
  newMax: number
): UniversalMeasureSpec {
  // Deep clone to avoid mutations
  const updated = JSON.parse(JSON.stringify(measure)) as UniversalMeasureSpec;

  // 1. Update global constraints (single source of truth)
  updated.globalConstraints = {
    ...updated.globalConstraints,
    ageRange: { min: newMin, max: newMax }
  };

  // 2. Update measure description
  updated.metadata.description = updateAgeInText(
    updated.metadata.description,
    newMin,
    newMax
  );

  // 3. Update all populations
  for (const population of updated.populations) {
    // Update population description
    population.description = updateAgeInText(population.description, newMin, newMax);
    population.narrative = updateAgeInText(population.narrative, newMin, newMax);

    // Update criteria recursively
    syncClauseAgeConstraints(population.criteria, newMin, newMax);
  }

  // 4. Update timestamp
  updated.updatedAt = new Date().toISOString();

  return updated;
}

/**
 * Recursively update age constraints in a logical clause and its children
 */
function syncClauseAgeConstraints(
  clause: LogicalClause,
  newMin: number,
  newMax: number
): void {
  // Update clause description
  clause.description = updateAgeInText(clause.description, newMin, newMax);

  for (const child of clause.children) {
    if ('operator' in child) {
      // It's a nested LogicalClause
      syncClauseAgeConstraints(child as LogicalClause, newMin, newMax);
    } else {
      // It's a DataElement
      const element = child as DataElement;

      // Update description
      element.description = updateAgeInText(element.description, newMin, newMax);

      // Update thresholds if this is a demographic/age element
      if (element.type === 'demographic' || isAgeRelatedElement(element)) {
        if (element.thresholds) {
          element.thresholds.ageMin = newMin;
          element.thresholds.ageMax = newMax;
        } else {
          element.thresholds = { ageMin: newMin, ageMax: newMax };
        }
      }

      // Update additionalRequirements
      if (element.additionalRequirements) {
        element.additionalRequirements = element.additionalRequirements.map(
          req => updateAgeInText(req, newMin, newMax)
        );
      }
    }
  }
}

/**
 * Check if a data element is related to age requirements
 */
function isAgeRelatedElement(element: DataElement): boolean {
  const desc = element.description.toLowerCase();
  return (
    element.type === 'demographic' ||
    desc.includes('age') ||
    desc.includes('years old') ||
    desc.includes('year old') ||
    (element.thresholds?.ageMin !== undefined) ||
    (element.thresholds?.ageMax !== undefined)
  );
}

/**
 * Update age range patterns in text
 * Handles various formats:
 * - "21-64 years"
 * - "age 21 to 64"
 * - "aged 21-64"
 * - "between 21 and 64 years"
 * - "21 through 64"
 */
function updateAgeInText(text: string, newMin: number, newMax: number): string {
  if (!text) return text;

  let result = text;

  // Pattern 1: "XX-YY" or "XX–YY" (with years, age, etc. nearby)
  result = result.replace(
    /(\b(?:age[ds]?|women|men|patients?|individuals?|persons?)\s*)(\d{1,3})\s*[-–to]+\s*(\d{1,3})(\s*(?:years?|yrs?)?\s*(?:old|of age)?)/gi,
    `$1${newMin}-${newMax}$4`
  );

  // Pattern 2: "between XX and YY"
  result = result.replace(
    /between\s+(\d{1,3})\s+and\s+(\d{1,3})\s*(years?|yrs?)?/gi,
    `between ${newMin} and ${newMax} $3`
  );

  // Pattern 3: "XX through YY years"
  result = result.replace(
    /(\d{1,3})\s+through\s+(\d{1,3})\s*(years?|yrs?)/gi,
    `${newMin} through ${newMax} $3`
  );

  // Pattern 4: "Age XX to YY"
  result = result.replace(
    /(age[ds]?\s*)(\d{1,3})\s*to\s*(\d{1,3})/gi,
    `$1${newMin} to ${newMax}`
  );

  // Pattern 5: Simple "XX-YY" when preceded by age context
  result = result.replace(
    /(\bage\s*)(\d{1,3})\s*-\s*(\d{1,3})\b/gi,
    `$1${newMin}-${newMax}`
  );

  return result;
}

/**
 * Extract the current age range from a measure
 * Returns the global constraints if set, otherwise tries to detect from content
 */
export function extractAgeRange(measure: UniversalMeasureSpec): { min: number; max: number } | null {
  // 1. Check global constraints first (authoritative)
  if (measure.globalConstraints?.ageRange) {
    return measure.globalConstraints.ageRange;
  }

  // 2. Try to find from initial population demographic elements
  const ipPop = measure.populations.find(p => p.type === 'initial_population');
  if (ipPop) {
    const ageElement = findAgeElement(ipPop.criteria);
    if (ageElement?.thresholds?.ageMin !== undefined && ageElement?.thresholds?.ageMax !== undefined) {
      return { min: ageElement.thresholds.ageMin, max: ageElement.thresholds.ageMax };
    }
  }

  // 3. Try to extract from measure description
  const descMatch = measure.metadata.description.match(/(\d{1,3})\s*[-–to]+\s*(\d{1,3})\s*(?:years?|yrs?)/i);
  if (descMatch) {
    return { min: parseInt(descMatch[1]), max: parseInt(descMatch[2]) };
  }

  return null;
}

/**
 * Find the age-related data element in a clause
 */
function findAgeElement(clause: LogicalClause): DataElement | null {
  for (const child of clause.children) {
    if ('operator' in child) {
      const found = findAgeElement(child as LogicalClause);
      if (found) return found;
    } else {
      const element = child as DataElement;
      if (isAgeRelatedElement(element)) {
        return element;
      }
    }
  }
  return null;
}

/**
 * Detect inconsistencies in age constraints throughout a measure
 */
export function detectAgeInconsistencies(measure: UniversalMeasureSpec): string[] {
  const issues: string[] = [];
  const ageRanges: Array<{ source: string; min: number; max: number }> = [];

  // Check global constraints
  if (measure.globalConstraints?.ageRange) {
    ageRanges.push({
      source: 'Global Constraints',
      min: measure.globalConstraints.ageRange.min,
      max: measure.globalConstraints.ageRange.max
    });
  }

  // Check measure description
  const descMatch = measure.metadata.description.match(/(\d{1,3})\s*[-–to]+\s*(\d{1,3})\s*(?:years?|yrs?)/i);
  if (descMatch) {
    ageRanges.push({
      source: 'Measure Description',
      min: parseInt(descMatch[1]),
      max: parseInt(descMatch[2])
    });
  }

  // Check each population
  for (const pop of measure.populations) {
    const popMatch = pop.description.match(/(\d{1,3})\s*[-–to]+\s*(\d{1,3})\s*(?:years?|yrs?)/i);
    if (popMatch) {
      ageRanges.push({
        source: `${pop.type} description`,
        min: parseInt(popMatch[1]),
        max: parseInt(popMatch[2])
      });
    }

    // Check data elements
    checkClauseForAgeRanges(pop.criteria, ageRanges, pop.type);
  }

  // Compare all found ranges
  if (ageRanges.length > 1) {
    const baseline = ageRanges[0];
    for (let i = 1; i < ageRanges.length; i++) {
      const current = ageRanges[i];
      if (current.min !== baseline.min || current.max !== baseline.max) {
        issues.push(
          `Age mismatch: ${baseline.source} has ${baseline.min}-${baseline.max}, ` +
          `but ${current.source} has ${current.min}-${current.max}`
        );
      }
    }
  }

  return issues;
}

function checkClauseForAgeRanges(
  clause: LogicalClause,
  ageRanges: Array<{ source: string; min: number; max: number }>,
  populationType: string
): void {
  for (const child of clause.children) {
    if ('operator' in child) {
      checkClauseForAgeRanges(child as LogicalClause, ageRanges, populationType);
    } else {
      const element = child as DataElement;
      if (isAgeRelatedElement(element) && element.thresholds) {
        if (element.thresholds.ageMin !== undefined && element.thresholds.ageMax !== undefined) {
          ageRanges.push({
            source: `${populationType} > ${element.description.substring(0, 30)}...`,
            min: element.thresholds.ageMin,
            max: element.thresholds.ageMax
          });
        }
      }

      // Also check description for age patterns
      const descMatch = element.description.match(/(\d{1,3})\s*[-–to]+\s*(\d{1,3})\s*(?:years?|yrs?)/i);
      if (descMatch) {
        const min = parseInt(descMatch[1]);
        const max = parseInt(descMatch[2]);
        // Only add if different from thresholds
        if (!element.thresholds || element.thresholds.ageMin !== min || element.thresholds.ageMax !== max) {
          ageRanges.push({
            source: `${populationType} element description`,
            min,
            max
          });
        }
      }
    }
  }
}
