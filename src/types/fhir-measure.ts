/**
 * FHIR R4 Measure Resource Types
 *
 * Based on: https://hl7.org/fhir/R4/measure.html
 * QI-Core: https://hl7.org/fhir/us/qicore/
 * CQL: https://cql.hl7.org/
 *
 * This file defines types that align with FHIR standards for
 * clinical quality measures, enabling interoperability with
 * EHR systems, measure repositories, and CQL engines.
 */

// ============================================================================
// FHIR Core Types
// ============================================================================

export interface Identifier {
  system?: string;
  value: string;
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
}

export interface Coding {
  system: string;
  code: string;
  display?: string;
  version?: string;
}

export interface CodeableConcept {
  coding: Coding[];
  text?: string;
}

export interface Period {
  start?: string; // ISO date
  end?: string;   // ISO date
}

export interface Reference {
  reference?: string;
  type?: string;
  display?: string;
}

// ============================================================================
// FHIR Measure Population Codes (from measure-population CodeSystem)
// ============================================================================

export type MeasurePopulationType =
  | 'initial-population'
  | 'numerator'
  | 'numerator-exclusion'
  | 'denominator'
  | 'denominator-exclusion'
  | 'denominator-exception'
  | 'measure-population'
  | 'measure-population-exclusion'
  | 'measure-observation';

// Standard FHIR population codes
export const POPULATION_CODES: Record<MeasurePopulationType, Coding> = {
  'initial-population': {
    system: 'http://terminology.hl7.org/CodeSystem/measure-population',
    code: 'initial-population',
    display: 'Initial Population'
  },
  'numerator': {
    system: 'http://terminology.hl7.org/CodeSystem/measure-population',
    code: 'numerator',
    display: 'Numerator'
  },
  'numerator-exclusion': {
    system: 'http://terminology.hl7.org/CodeSystem/measure-population',
    code: 'numerator-exclusion',
    display: 'Numerator Exclusion'
  },
  'denominator': {
    system: 'http://terminology.hl7.org/CodeSystem/measure-population',
    code: 'denominator',
    display: 'Denominator'
  },
  'denominator-exclusion': {
    system: 'http://terminology.hl7.org/CodeSystem/measure-population',
    code: 'denominator-exclusion',
    display: 'Denominator Exclusion'
  },
  'denominator-exception': {
    system: 'http://terminology.hl7.org/CodeSystem/measure-population',
    code: 'denominator-exception',
    display: 'Denominator Exception'
  },
  'measure-population': {
    system: 'http://terminology.hl7.org/CodeSystem/measure-population',
    code: 'measure-population',
    display: 'Measure Population'
  },
  'measure-population-exclusion': {
    system: 'http://terminology.hl7.org/CodeSystem/measure-population',
    code: 'measure-population-exclusion',
    display: 'Measure Population Exclusion'
  },
  'measure-observation': {
    system: 'http://terminology.hl7.org/CodeSystem/measure-population',
    code: 'measure-observation',
    display: 'Measure Observation'
  }
};

// ============================================================================
// CQL Expression Types
// ============================================================================

export interface Expression {
  /** Expression language - typically 'text/cql-identifier' or 'text/cql' */
  language: 'text/cql' | 'text/cql-identifier' | 'text/fhirpath' | 'application/elm+json';
  /** The expression text or reference to a CQL definition */
  expression: string;
  /** Optional reference to the CQL library containing this expression */
  reference?: string;
}

// ============================================================================
// FHIR Measure Resource Components
// ============================================================================

/** A single population within a measure group */
export interface MeasurePopulation {
  /** Unique identifier for this population */
  id?: string;
  /** Type of population (initial-population, numerator, etc.) */
  code: CodeableConcept;
  /** Human-readable description */
  description?: string;
  /** CQL criteria that defines this population */
  criteria: Expression;
}

/** Stratifier for breaking down measure results */
export interface MeasureStratifier {
  id?: string;
  code?: CodeableConcept;
  description?: string;
  criteria?: Expression;
  component?: Array<{
    code: CodeableConcept;
    description?: string;
    criteria: Expression;
  }>;
}

/** A group of populations within a measure (most measures have one group) */
export interface MeasureGroup {
  id?: string;
  code?: CodeableConcept;
  description?: string;
  population: MeasurePopulation[];
  stratifier?: MeasureStratifier[];
}

/** Supplemental data element */
export interface MeasureSupplementalData {
  id?: string;
  code?: CodeableConcept;
  usage?: CodeableConcept[];
  description?: string;
  criteria: Expression;
}

// ============================================================================
// QI-Core Data Element Types (for structured criteria)
// ============================================================================

export type QICoreResourceType =
  | 'Patient'
  | 'Condition'
  | 'Encounter'
  | 'Procedure'
  | 'Observation'
  | 'MedicationRequest'
  | 'MedicationAdministration'
  | 'MedicationDispense'
  | 'MedicationStatement'
  | 'Immunization'
  | 'DiagnosticReport'
  | 'ServiceRequest'
  | 'Coverage'
  | 'AllergyIntolerance'
  | 'AdverseEvent'
  | 'DeviceRequest'
  | 'Communication'
  | 'Goal';

/** Mapping from our internal types to QI-Core resource types */
export const DATA_ELEMENT_TO_QICORE: Record<string, QICoreResourceType> = {
  'diagnosis': 'Condition',
  'encounter': 'Encounter',
  'procedure': 'Procedure',
  'observation': 'Observation',
  'medication': 'MedicationRequest',
  'demographic': 'Patient',
  'assessment': 'Observation',
  'immunization': 'Immunization',
  'lab': 'Observation',
  'device': 'DeviceRequest',
  'communication': 'Communication',
};

// ============================================================================
// Standard Code Systems
// ============================================================================

export const CODE_SYSTEMS = {
  // Terminology
  SNOMED: 'http://snomed.info/sct',
  ICD10CM: 'http://hl7.org/fhir/sid/icd-10-cm',
  ICD10PCS: 'http://www.cms.gov/Medicare/Coding/ICD10',
  CPT: 'http://www.ama-assn.org/go/cpt',
  HCPCS: 'https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets',
  LOINC: 'http://loinc.org',
  RXNORM: 'http://www.nlm.nih.gov/research/umls/rxnorm',
  CVX: 'http://hl7.org/fhir/sid/cvx',
  NDC: 'http://hl7.org/fhir/sid/ndc',

  // Value Set OID prefix
  VSAC: 'http://cts.nlm.nih.gov/fhir/ValueSet/',

  // Measure-specific
  MEASURE_POPULATION: 'http://terminology.hl7.org/CodeSystem/measure-population',
  MEASURE_TYPE: 'http://terminology.hl7.org/CodeSystem/measure-type',
  MEASURE_SCORING: 'http://terminology.hl7.org/CodeSystem/measure-scoring',
  MEASURE_IMPROVEMENT_NOTATION: 'http://terminology.hl7.org/CodeSystem/measure-improvement-notation',
} as const;

// ============================================================================
// FHIR Measure Resource (R4)
// ============================================================================

export type MeasureStatus = 'draft' | 'active' | 'retired' | 'unknown';
export type PublicationStatus = 'draft' | 'active' | 'retired' | 'unknown';

export type MeasureScoringType = 'proportion' | 'ratio' | 'continuous-variable' | 'cohort' | 'composite';
export type MeasureType = 'process' | 'outcome' | 'structure' | 'patient-reported-outcome' | 'composite';
export type ImprovementNotation = 'increase' | 'decrease';

/**
 * FHIR R4 Measure Resource
 *
 * This is the core structure for representing clinical quality measures
 * in a standards-compliant way.
 */
export interface FHIRMeasure {
  resourceType: 'Measure';

  // Identity
  id?: string;
  url?: string;
  identifier?: Identifier[];
  version?: string;
  name?: string;
  title?: string;

  // Status
  status: PublicationStatus;
  experimental?: boolean;
  date?: string;
  publisher?: string;

  // Description
  description?: string;
  purpose?: string;
  usage?: string;
  copyright?: string;

  // Effective period
  effectivePeriod?: Period;

  // Classification
  topic?: CodeableConcept[];
  author?: Array<{ name?: string }>;

  // Measure-specific
  subtitle?: string;
  subjectCodeableConcept?: CodeableConcept;
  basis?: string; // e.g., 'boolean' for proportion measures

  // Scoring and type
  scoring?: CodeableConcept;
  scoringUnit?: CodeableConcept;
  type?: CodeableConcept[];
  improvementNotation?: CodeableConcept;

  // Clinical recommendation and rationale
  rationale?: string;
  clinicalRecommendationStatement?: string;

  // Related artifacts (CQL libraries, value sets)
  library?: string[];
  relatedArtifact?: Array<{
    type: 'documentation' | 'justification' | 'citation' | 'predecessor' | 'successor' | 'derived-from' | 'depends-on' | 'composed-of';
    display?: string;
    url?: string;
    resource?: string;
  }>;

  // Measure content
  group?: MeasureGroup[];
  supplementalData?: MeasureSupplementalData[];

  // Risk adjustment
  riskAdjustment?: string;
  rateAggregation?: string;

  // Guidance
  guidance?: string;

  // Extensions (for program-specific data)
  extension?: Array<{
    url: string;
    valueString?: string;
    valueCode?: string;
    valueBoolean?: boolean;
    valueInteger?: number;
    valueCoding?: Coding;
  }>;
}

// ============================================================================
// CQL Library Types
// ============================================================================

/**
 * Represents a CQL library that contains measure logic
 */
export interface CQLLibrary {
  /** Library name (used in CQL: library MyLibrary version '1.0.0') */
  name: string;
  /** Library version */
  version: string;
  /** Using declarations (e.g., FHIR version) */
  usings: Array<{
    name: string;    // e.g., 'FHIR'
    version: string; // e.g., '4.0.1'
  }>;
  /** Include declarations (referenced libraries) */
  includes: Array<{
    name: string;
    version?: string;
    alias: string;
  }>;
  /** Value set declarations */
  valueSets: Array<{
    name: string;
    id: string; // OID or canonical URL
  }>;
  /** Code declarations */
  codes: Array<{
    name: string;
    id: string;
    system: string;
    display?: string;
  }>;
  /** Code system declarations */
  codeSystems: Array<{
    name: string;
    id: string;
  }>;
  /** Parameter declarations */
  parameters: Array<{
    name: string;
    type: string;
    default?: string;
  }>;
  /** Context declaration (typically 'Patient') */
  context: 'Patient' | 'Practitioner' | 'Unfiltered';
  /** Define statements (the actual logic) */
  definitions: Array<{
    name: string;
    context?: string;
    accessLevel?: 'Public' | 'Private';
    expression: string;
    annotation?: string;
  }>;
  /** Function definitions */
  functions: Array<{
    name: string;
    parameters: Array<{ name: string; type: string }>;
    returnType: string;
    expression: string;
  }>;
}

// ============================================================================
// Value Set Types (FHIR R4)
// ============================================================================

export interface FHIRValueSet {
  resourceType: 'ValueSet';
  id?: string;
  url?: string;
  identifier?: Identifier[];
  version?: string;
  name?: string;
  title?: string;
  status: PublicationStatus;
  experimental?: boolean;
  date?: string;
  publisher?: string;
  description?: string;

  /** Codes included in the value set */
  compose?: {
    inactive?: boolean;
    include: Array<{
      system?: string;
      version?: string;
      concept?: Array<{
        code: string;
        display?: string;
        designation?: Array<{
          language?: string;
          use?: Coding;
          value: string;
        }>;
      }>;
      filter?: Array<{
        property: string;
        op: 'is-a' | 'descendent-of' | 'is-not-a' | 'regex' | 'in' | 'not-in' | 'generalizes' | 'exists';
        value: string;
      }>;
      valueSet?: string[];
    }>;
    exclude?: Array<{
      system?: string;
      concept?: Array<{ code: string }>;
    }>;
  };

  /** Expanded codes (for display/validation) */
  expansion?: {
    identifier?: string;
    timestamp: string;
    total?: number;
    offset?: number;
    contains?: Array<{
      system?: string;
      abstract?: boolean;
      inactive?: boolean;
      version?: string;
      code?: string;
      display?: string;
    }>;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert internal population type to FHIR population type
 */
export function toFHIRPopulationType(type: string): MeasurePopulationType {
  const mapping: Record<string, MeasurePopulationType> = {
    'initial_population': 'initial-population',
    'denominator': 'denominator',
    'denominator_exclusion': 'denominator-exclusion',
    'denominator_exception': 'denominator-exception',
    'numerator': 'numerator',
    'numerator_exclusion': 'numerator-exclusion',
  };
  return mapping[type] || 'initial-population';
}

/**
 * Convert FHIR population type to internal type
 */
export function fromFHIRPopulationType(type: MeasurePopulationType): string {
  const mapping: Record<MeasurePopulationType, string> = {
    'initial-population': 'initial_population',
    'denominator': 'denominator',
    'denominator-exclusion': 'denominator_exclusion',
    'denominator-exception': 'denominator_exception',
    'numerator': 'numerator',
    'numerator-exclusion': 'numerator_exclusion',
    'measure-population': 'measure_population',
    'measure-population-exclusion': 'measure_population_exclusion',
    'measure-observation': 'measure_observation',
  };
  return mapping[type] || 'initial_population';
}

/**
 * Get the CodeableConcept for a population type
 */
export function getPopulationCode(type: MeasurePopulationType): CodeableConcept {
  return {
    coding: [POPULATION_CODES[type]],
    text: POPULATION_CODES[type].display
  };
}

/**
 * Create a CQL expression reference
 */
export function cqlExpression(definitionName: string, libraryName?: string): Expression {
  return {
    language: 'text/cql-identifier',
    expression: definitionName,
    reference: libraryName ? `Library/${libraryName}` : undefined
  };
}

/**
 * Get the standard code system URL for a code system abbreviation
 */
export function getCodeSystemUrl(system: string): string {
  const systemMap: Record<string, string> = {
    'ICD10': CODE_SYSTEMS.ICD10CM,
    'ICD10CM': CODE_SYSTEMS.ICD10CM,
    'ICD10PCS': CODE_SYSTEMS.ICD10PCS,
    'SNOMED': CODE_SYSTEMS.SNOMED,
    'CPT': CODE_SYSTEMS.CPT,
    'HCPCS': CODE_SYSTEMS.HCPCS,
    'LOINC': CODE_SYSTEMS.LOINC,
    'RxNorm': CODE_SYSTEMS.RXNORM,
    'RXNORM': CODE_SYSTEMS.RXNORM,
    'CVX': CODE_SYSTEMS.CVX,
    'NDC': CODE_SYSTEMS.NDC,
  };
  return systemMap[system] || system;
}
