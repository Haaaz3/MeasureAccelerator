/**
 * Category Inference Utility
 *
 * Determines the most appropriate category for a component based on its properties.
 * Used for auto-categorization when creating new components.
 */

import type {
  AtomicComponent,
  CompositeComponent,
  LibraryComponent,
  ComponentCategory,
  ComponentValueSet,
} from '../types/componentLibrary';

// Common LOINC lab code prefixes and keywords
const LAB_KEYWORDS = [
  'hba1c', 'hemoglobin a1c', 'glycated', 'glucose', 'cholesterol', 'ldl', 'hdl',
  'triglyceride', 'creatinine', 'egfr', 'bun', 'blood urea', 'potassium', 'sodium',
  'calcium', 'magnesium', 'albumin', 'bilirubin', 'ast', 'alt', 'alkaline phosphatase',
  'tsh', 'thyroid', 't3', 't4', 'hemoglobin', 'hematocrit', 'platelet', 'wbc', 'rbc',
  'inr', 'pt', 'ptt', 'blood count', 'cbc', 'metabolic panel', 'lipid panel',
  'urinalysis', 'urine', 'serum', 'plasma', 'laboratory', 'lab result',
];

// Common assessment/screening keywords
const ASSESSMENT_KEYWORDS = [
  'phq', 'gad', 'audit', 'dast', 'screening', 'survey', 'questionnaire', 'assessment',
  'score', 'scale', 'index', 'fall risk', 'depression', 'anxiety', 'substance',
  'cognitive', 'functional', 'adl', 'iadl', 'pain', 'quality of life', 'frailty',
  'nutrition', 'social determinant', 'sdoh', 'tobacco', 'alcohol', 'readiness',
];

// Common exclusion keywords
const EXCLUSION_KEYWORDS = [
  'hospice', 'palliative', 'end of life', 'end-of-life', 'terminal', 'exclusion',
  'exception', 'advanced illness', 'frailty', 'dementia', 'nursing facility',
  'long-term care', 'skilled nursing',
];

// Encounter keywords
const ENCOUNTER_KEYWORDS = [
  'visit', 'encounter', 'office', 'outpatient', 'inpatient', 'emergency', 'telehealth',
  'home health', 'preventive', 'wellness',
];

// Medication keywords
const MEDICATION_KEYWORDS = [
  'medication', 'drug', 'prescription', 'rx', 'pharmacy', 'therapeutic', 'dose',
];

// Procedure keywords
const PROCEDURE_KEYWORDS = [
  'procedure', 'surgery', 'surgical', 'operation', 'screening', 'colonoscopy',
  'mammogram', 'mammography', 'biopsy', 'imaging', 'endoscopy', 'injection',
];

// Condition/diagnosis keywords
const CONDITION_KEYWORDS = [
  'diagnosis', 'condition', 'disease', 'disorder', 'syndrome', 'infection',
];

/**
 * Check if text contains any keywords from a list
 */
function containsKeywords(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Check if a value set appears to be lab-related
 */
function isLabValueSet(valueSet: ComponentValueSet): boolean {
  const name = valueSet.name.toLowerCase();
  const oid = valueSet.oid.toLowerCase();

  // Check name for lab keywords
  if (containsKeywords(name, LAB_KEYWORDS)) {
    return true;
  }

  // Check codes for LOINC (common in labs)
  if (valueSet.codes && valueSet.codes.length > 0) {
    const loincCodes = valueSet.codes.filter(
      c => c.system?.toLowerCase().includes('loinc')
    );
    // If most codes are LOINC, likely a lab
    if (loincCodes.length > valueSet.codes.length / 2) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a value set appears to be assessment-related
 */
function isAssessmentValueSet(valueSet: ComponentValueSet): boolean {
  const name = valueSet.name.toLowerCase();
  return containsKeywords(name, ASSESSMENT_KEYWORDS);
}

/**
 * Check if a component is an exclusion component
 */
function isExclusionComponent(component: LibraryComponent): boolean {
  const name = component.name.toLowerCase();
  const desc = (component.description || '').toLowerCase();
  const text = name + ' ' + desc;
  return containsKeywords(text, EXCLUSION_KEYWORDS);
}

/**
 * Check if a component is age-related (demographics)
 */
function isAgeComponent(component: AtomicComponent): boolean {
  const name = component.name.toLowerCase();
  const desc = (component.description || '').toLowerCase();
  const text = name + ' ' + desc;
  return text.includes('age') || text.includes('years old') || text.includes('years of age');
}

/**
 * Infer category from value set name patterns
 */
function inferFromValueSet(valueSet: ComponentValueSet): ComponentCategory | null {
  const name = valueSet.name.toLowerCase();

  // Check for encounter patterns
  if (containsKeywords(name, ENCOUNTER_KEYWORDS)) return 'encounters';

  // Check for medication patterns
  if (containsKeywords(name, MEDICATION_KEYWORDS)) return 'medications';

  // Check for procedure patterns
  if (containsKeywords(name, PROCEDURE_KEYWORDS)) return 'procedures';

  // Check for condition patterns
  if (containsKeywords(name, CONDITION_KEYWORDS)) return 'conditions';

  // Check for lab patterns
  if (containsKeywords(name, LAB_KEYWORDS)) return 'laboratory';

  // Check for assessment patterns
  if (containsKeywords(name, ASSESSMENT_KEYWORDS)) return 'assessments';

  return null;
}

/**
 * Infer the most appropriate category for a component based on its properties.
 *
 * Priority order:
 * 1. Exclusion detection (keywords in name/description)
 * 2. Patient resource type or genderValue → Demographics
 * 3. Age-related components → Demographics
 * 4. Resource type mapping (Encounter, Condition, Procedure, etc.)
 * 5. Value set analysis (LOINC codes, keywords)
 * 6. Value set name patterns
 * 7. Default: clinical-observations
 */
export function inferCategory(component: AtomicComponent | CompositeComponent): ComponentCategory {
  // 1. Check for exclusion keywords first (applies to both atomic and composite)
  if (isExclusionComponent(component)) {
    return 'exclusions';
  }

  // 2. For atomic components, use resourceType and other indicators
  if (component.type === 'atomic') {
    const atomic = component as AtomicComponent;

    // Patient resource type or genderValue → Demographics
    if (atomic.resourceType === 'Patient' || atomic.genderValue) {
      return 'demographics';
    }

    // Age-related components → Demographics
    if (isAgeComponent(atomic)) {
      return 'demographics';
    }

    // Resource type mapping (if resourceType field exists on component)
    if (atomic.resourceType) {
      switch (atomic.resourceType) {
        case 'Encounter':
          return 'encounters';
        case 'Condition':
          return 'conditions';
        case 'Procedure':
          return 'procedures';
        case 'MedicationRequest':
        case 'MedicationDispense':
        case 'MedicationAdministration':
        case 'MedicationStatement':
          return 'medications';
        case 'Immunization':
          return 'medications'; // Immunizations grouped under medications
        case 'Observation':
        case 'DiagnosticReport':
          // Check if lab or assessment based on value set
          if (isLabValueSet(atomic.valueSet)) return 'laboratory';
          if (isAssessmentValueSet(atomic.valueSet)) return 'assessments';
          return 'clinical-observations';
      }
    }

    // Fallback: infer from value set name patterns
    const vsCategory = inferFromValueSet(atomic.valueSet);
    if (vsCategory) {
      return vsCategory;
    }
  }

  // 3. For composite components, check keywords in name/description
  if (component.type === 'composite') {
    const name = component.name.toLowerCase();
    const desc = (component.description || '').toLowerCase();
    const text = name + ' ' + desc;

    if (containsKeywords(text, ['encounter', 'visit'])) return 'encounters';
    if (containsKeywords(text, ['medication', 'drug'])) return 'medications';
    if (containsKeywords(text, ['procedure'])) return 'procedures';
    if (containsKeywords(text, ['condition', 'diagnosis'])) return 'conditions';
    if (containsKeywords(text, ['age', 'demographic'])) return 'demographics';
    if (containsKeywords(text, LAB_KEYWORDS)) return 'laboratory';
    if (containsKeywords(text, ASSESSMENT_KEYWORDS)) return 'assessments';
  }

  // 4. Default fallback
  return 'clinical-observations';
}

/**
 * Get a human-readable label for a category
 */
export function getCategoryLabel(category: ComponentCategory): string {
  const labels: Record<ComponentCategory, string> = {
    'demographics': 'Demographics',
    'encounters': 'Encounters',
    'conditions': 'Conditions',
    'procedures': 'Procedures',
    'medications': 'Medications',
    'assessments': 'Assessments',
    'laboratory': 'Laboratory',
    'clinical-observations': 'Clinical Observations',
    'exclusions': 'Exclusions',
  };
  return labels[category] || category;
}
