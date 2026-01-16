/**
 * Universal Measure Spec (UMS) Schema
 *
 * A canonical, machine-readable representation of clinical quality measure logic.
 * ALIGNED WITH FHIR R4 Measure Resource and CQL Standards.
 *
 * Key alignments:
 * - Population types use FHIR measure-population CodeSystem
 * - Value sets reference VSAC OIDs with FHIR canonical URLs
 * - Criteria can be expressed as CQL or structured logic
 * - Code systems use standard FHIR URIs
 *
 * References:
 * - FHIR Measure: https://hl7.org/fhir/R4/measure.html
 * - CQL: https://cql.hl7.org/
 * - QI-Core: https://hl7.org/fhir/us/qicore/
 */

import type {
  FHIRMeasure,
  MeasurePopulationType,
  Expression,
  CodeableConcept,
  Coding,
  Period,
  Identifier,
  QICoreResourceType,
  MeasureScoringType,
  ImprovementNotation,
} from './fhir-measure';

// Re-export FHIR types for convenience
export type {
  FHIRMeasure,
  MeasurePopulationType,
  Expression,
  CodeableConcept,
  Coding,
  Period,
  Identifier,
  QICoreResourceType,
};

// ============================================================================
// Core Types
// ============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ReviewStatus = 'pending' | 'approved' | 'needs_revision' | 'flagged';
export type MeasureStatus = 'in_progress' | 'published';
export type MeasureType = 'process' | 'outcome' | 'structure' | 'patient_experience';

/** FHIR-aligned population types (using kebab-case as per FHIR spec) */
export type PopulationType =
  | 'initial-population'
  | 'denominator'
  | 'denominator-exclusion'
  | 'denominator-exception'
  | 'numerator'
  | 'numerator-exclusion'
  // Legacy underscore versions for backwards compatibility
  | 'initial_population'
  | 'denominator_exclusion'
  | 'denominator_exception'
  | 'numerator_exclusion';

export type LogicalOperator = 'AND' | 'OR' | 'NOT';
export type TemporalOperator = 'during' | 'before' | 'after' | 'overlaps' | 'starts' | 'ends' | 'within';

/** Standard code systems with FHIR URIs */
export type CodeSystem =
  | 'ICD10'        // http://hl7.org/fhir/sid/icd-10-cm
  | 'ICD10CM'
  | 'ICD10PCS'
  | 'SNOMED'       // http://snomed.info/sct
  | 'CPT'          // http://www.ama-assn.org/go/cpt
  | 'HCPCS'        // https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets
  | 'LOINC'        // http://loinc.org
  | 'RxNorm'       // http://www.nlm.nih.gov/research/umls/rxnorm
  | 'CVX'          // http://hl7.org/fhir/sid/cvx
  | 'NDC';         // http://hl7.org/fhir/sid/ndc

// ============================================================================
// Value Sets & Codes (FHIR-aligned)
// ============================================================================

export interface CodeReference {
  code: string;
  display: string;
  system: CodeSystem;
  /** FHIR canonical URL for the code system */
  systemUri?: string;
  /** Version of the code system */
  version?: string;
}

export interface ValueSetReference {
  /** Internal ID */
  id: string;
  /** VSAC OID (e.g., "2.16.840.1.113883.3.464.1003.101.12.1001") */
  oid?: string;
  /** FHIR canonical URL (e.g., "http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.101.12.1001") */
  url?: string;
  name: string;
  version?: string;
  /** Actual codes in the value set - critical for review */
  codes: CodeReference[];
  /** Total code count if codes array is truncated */
  totalCodeCount?: number;
  confidence: ConfidenceLevel;
  source?: string;
  /** Whether codes have been verified against VSAC or terminology service */
  verified?: boolean;
  /** Steward/publisher of the value set */
  publisher?: string;
  /** Purpose/description of the value set */
  purpose?: string;
}

// ============================================================================
// Timing Requirements (CQL-aligned)
// ============================================================================

/**
 * Timing requirement aligned with CQL temporal operators
 *
 * CQL examples:
 * - "during Measurement Period"
 * - "3 months or less before start of Measurement Period"
 * - "starts during Measurement Period"
 */
export interface TimingRequirement {
  /** Human-readable description */
  description: string;
  /** CQL temporal operator */
  operator?: 'during' | 'includes' | 'included in' | 'before' | 'after' | 'meets' | 'overlaps' | 'starts' | 'ends';
  /** The reference point for timing */
  relativeTo: 'Measurement Period' | 'encounter' | 'diagnosis onset' | 'procedure date' | string;
  /** Optional lookback/forward window */
  window?: {
    value: number;
    unit: 'days' | 'weeks' | 'months' | 'years';
    direction: 'before' | 'after' | 'before or after';
  };
  confidence: ConfidenceLevel;
  /** CQL expression for this timing constraint */
  cqlExpression?: string;
}

/** @deprecated Use TimingRequirement instead */
export interface TemporalConstraint {
  operator: TemporalOperator;
  reference: 'measurement_period' | 'encounter' | 'diagnosis_start' | 'procedure_date' | string;
  offset?: {
    value: number;
    unit: 'days' | 'weeks' | 'months' | 'years';
    direction: 'before' | 'after';
  };
  confidence: ConfidenceLevel;
}

export interface DateRange {
  start?: string; // ISO date or relative reference
  end?: string;
  inclusive: boolean;
}

// ============================================================================
// Data Elements (QI-Core aligned)
// ============================================================================

/**
 * Data element types aligned with QI-Core resource types
 *
 * Mapping:
 * - diagnosis -> Condition
 * - encounter -> Encounter
 * - procedure -> Procedure
 * - observation -> Observation (labs, vitals, assessments)
 * - medication -> MedicationRequest/MedicationAdministration
 * - demographic -> Patient
 * - immunization -> Immunization
 */
export type DataElementType =
  | 'diagnosis'     // QI-Core Condition
  | 'encounter'     // QI-Core Encounter
  | 'procedure'     // QI-Core Procedure
  | 'observation'   // QI-Core Observation
  | 'medication'    // QI-Core MedicationRequest
  | 'demographic'   // QI-Core Patient
  | 'assessment'    // QI-Core Observation (assessment)
  | 'immunization'  // QI-Core Immunization
  | 'device'        // QI-Core DeviceRequest
  | 'communication' // QI-Core Communication
  | 'allergy'       // QI-Core AllergyIntolerance
  | 'goal';         // QI-Core Goal

export interface DataElement {
  id: string;
  /** QI-Core aligned data element type */
  type: DataElementType;
  /** QI-Core resource type (derived from type) */
  resourceType?: QICoreResourceType;
  description: string;

  /** Value set that defines valid codes for this element */
  valueSet?: ValueSetReference;
  /** Direct codes (when not using a value set) */
  directCodes?: CodeReference[];

  /**
   * Thresholds for demographics (age), observations (lab values), etc.
   * This is the canonical location for numeric constraints.
   */
  thresholds?: {
    ageMin?: number;
    ageMax?: number;
    valueMin?: number;
    valueMax?: number;
    unit?: string;
    comparator?: '>' | '>=' | '<' | '<=' | '=' | '!=';
  };

  /** When must this data element occur? */
  timingRequirements?: TimingRequirement[];
  /** @deprecated Use timingRequirements instead */
  temporalConstraints?: TemporalConstraint[];

  /** Additional logic requirements in plain English */
  additionalRequirements?: string[];
  /** @deprecated Use additionalRequirements instead */
  additionalConstraints?: string[];

  /** Negation - true if this checks for ABSENCE of the data element */
  negation?: boolean;
  /** Negation rationale (for denominator exceptions) */
  negationRationale?: string;

  confidence: ConfidenceLevel;
  source?: string;
  reviewStatus: ReviewStatus;

  /** CQL definition name for this element */
  cqlDefinitionName?: string;
  /** Full CQL expression for this element */
  cqlExpression?: string;

  /** AI conversation history for this component */
  aiConversation?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

// ============================================================================
// Logical Clauses (CQL expression trees)
// ============================================================================

export interface LogicalClause {
  id: string;
  /** Logical operator: AND (conjunction), OR (disjunction), NOT (negation) */
  operator: LogicalOperator;
  description: string;
  children: (DataElement | LogicalClause)[];
  confidence: ConfidenceLevel;
  reviewStatus: ReviewStatus;
  /** CQL snippet for this clause */
  cqlSnippet?: string;
  /** CQL definition name */
  cqlDefinitionName?: string;
}

// ============================================================================
// Population Definitions (FHIR Measure.group.population aligned)
// ============================================================================

export interface PopulationDefinition {
  id: string;
  /** FHIR population type (use kebab-case: 'initial-population', 'denominator', etc.) */
  type: PopulationType;
  /** Human-readable description */
  description: string;
  /** Narrative explanation of the population logic */
  narrative: string;
  /** Structured criteria tree */
  criteria: LogicalClause;
  /** FHIR Expression reference to CQL definition */
  expression?: Expression;
  confidence: ConfidenceLevel;
  reviewStatus: ReviewStatus;
  reviewNotes?: string;
  /** CQL definition for this population */
  cqlDefinition?: string;
  /** CQL definition name (e.g., "Initial Population", "Denominator") */
  cqlDefinitionName?: string;
}

// ============================================================================
// Stratification & Supplemental Data (FHIR-aligned)
// ============================================================================

export interface Stratifier {
  id: string;
  /** Code that identifies this stratifier */
  code?: CodeableConcept;
  description: string;
  criteria: LogicalClause;
  /** CQL expression for stratification */
  expression?: Expression;
  confidence: ConfidenceLevel;
  reviewStatus: ReviewStatus;
}

export interface SupplementalData {
  id: string;
  /** Code that identifies this supplemental data element */
  code?: CodeableConcept;
  name: string;
  description: string;
  /** Usage (e.g., risk-adjustment-factor, supplemental-data) */
  usage?: string[];
  dataElement: DataElement;
  /** CQL expression for this supplemental data */
  expression?: Expression;
}

// ============================================================================
// Attribution (for cross-program support)
// ============================================================================

export interface AttributionRule {
  id: string;
  type: 'provider' | 'organization' | 'payer';
  description: string;
  lookbackPeriod?: {
    value: number;
    unit: 'days' | 'months' | 'years';
  };
  confidence: ConfidenceLevel;
  reviewStatus: ReviewStatus;
}

// ============================================================================
// Global Constraints (Single Source of Truth)
// ============================================================================

/**
 * Centralized constraints that apply across the entire measure.
 * When modified, these values propagate to all relevant places.
 */
export interface GlobalConstraints {
  /** Age range for the measure's target population */
  ageRange?: {
    min: number;
    max: number;
  };
  /** Gender requirement (if any) */
  gender?: 'male' | 'female' | 'all';
  /** How age is calculated */
  ageCalculation?: 'at_start' | 'at_end' | 'during' | 'turns_during';
  /** Product line (for HEDIS measures) */
  productLine?: string[];
  /** Continuous enrollment requirement */
  continuousEnrollment?: {
    days: number;
    allowedGap?: number;
  };
}

// ============================================================================
// Measure Metadata (FHIR Measure resource fields)
// ============================================================================

export interface MeasureMetadata {
  /** eCQM identifier (e.g., "CMS130v11") */
  measureId: string;
  /** Human-readable title */
  title: string;
  /** Version string */
  version: string;
  /** CBE/NQF number */
  cbeNumber?: string;
  /** Measure steward/publisher */
  steward: string;
  /** Program type */
  program: 'MIPS_CQM' | 'eCQM' | 'HEDIS' | 'QOF' | 'Registry' | 'Custom';
  /** FHIR measure type */
  measureType: MeasureType;
  /** Description */
  description: string;
  /** Clinical rationale */
  rationale?: string;
  /** Clinical recommendation statement */
  clinicalRecommendation?: string;
  /** Submission frequency */
  submissionFrequency?: string;
  /** Improvement notation (increase = higher is better) */
  improvementNotation?: ImprovementNotation;
  /** Measurement period */
  measurementPeriod: DateRange;
  /** Last updated timestamp */
  lastUpdated: string;
  /** Source document references */
  sourceDocuments?: string[];

  // FHIR-specific fields
  /** FHIR canonical URL */
  url?: string;
  /** Identifiers (CMS, NQF, etc.) */
  identifier?: Identifier[];
  /** FHIR scoring type */
  scoring?: MeasureScoringType;
  /** Related CQL library references */
  library?: string[];
  /** Guidance text */
  guidance?: string;
}

// ============================================================================
// CQL Library (embedded or referenced)
// ============================================================================

export interface EmbeddedCQLLibrary {
  /** Library name */
  name: string;
  /** Library version */
  version: string;
  /** FHIR version (e.g., "4.0.1") */
  fhirVersion?: string;
  /** QI-Core version */
  qicoreVersion?: string;
  /** Raw CQL text */
  cql: string;
  /** Compiled ELM (JSON) */
  elm?: string;
}

// ============================================================================
// Main UMS Document
// ============================================================================

export interface UniversalMeasureSpec {
  /** Internal unique ID */
  id: string;

  /** FHIR resource type marker */
  resourceType?: 'Measure';

  /** Measure metadata */
  metadata: MeasureMetadata;

  /** Population definitions (FHIR Measure.group.population) */
  populations: PopulationDefinition[];

  /** Value sets (FHIR ValueSet references) */
  valueSets: ValueSetReference[];

  /** Stratifiers (FHIR Measure.group.stratifier) */
  stratifiers?: Stratifier[];

  /** Supplemental data (FHIR Measure.supplementalData) */
  supplementalData?: SupplementalData[];

  /** Attribution rules */
  attribution?: AttributionRule;

  /** Centralized constraints - single source of truth */
  globalConstraints?: GlobalConstraints;

  /** Embedded CQL library */
  cqlLibrary?: EmbeddedCQLLibrary;

  // Workflow status
  status: MeasureStatus;

  // Confidence & Review Summary
  overallConfidence: ConfidenceLevel;
  reviewProgress: {
    total: number;
    approved: number;
    pending: number;
    flagged: number;
  };

  // Audit trail
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;

  // Lock for publish
  lockedAt?: string;
  lockedBy?: string;

  // Generated artifacts
  generatedCql?: string;
  generatedSql?: string;
  generatedElm?: string;

  // Training feedback
  corrections?: MeasureCorrection[];
}

// ============================================================================
// Training Feedback Types
// ============================================================================

export type CorrectionType =
  | 'code_added'
  | 'code_removed'
  | 'code_system_changed'
  | 'timing_changed'
  | 'logic_changed'
  | 'description_changed'
  | 'threshold_changed'
  | 'population_reassigned'
  | 'element_added'
  | 'element_removed';

export interface MeasureCorrection {
  id: string;
  timestamp: string;
  correctionType: CorrectionType;
  componentId: string;
  componentPath: string;
  originalValue: any;
  correctedValue: any;
  userNotes?: string;
  sourceReference?: string;
  measureContext: {
    measureId: string;
    measureType: string;
    program: string;
    populationType?: string;
  };
}

export interface CorrectionExport {
  exportedAt: string;
  measureId: string;
  measureTitle: string;
  totalCorrections: number;
  corrections: MeasureCorrection[];
  summary: {
    byType: Record<CorrectionType, number>;
    byPopulation: Record<string, number>;
  };
}

// ============================================================================
// Parsing & Ingestion Types
// ============================================================================

export interface ParsedSection {
  type: 'metadata' | 'denominator' | 'numerator' | 'exclusion' | 'exception' | 'value_set' | 'rationale' | 'unknown';
  rawText: string;
  parsedContent: Partial<PopulationDefinition> | Partial<MeasureMetadata> | ValueSetReference[];
  confidence: ConfidenceLevel;
  warnings?: string[];
}

export interface IngestionResult {
  success: boolean;
  ums?: UniversalMeasureSpec;
  sections: ParsedSection[];
  errors?: string[];
  warnings?: string[];
  parsingNotes?: string[];
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationFact {
  code: string;
  display: string;
  rawCode?: string;
  rawDisplay?: string;
  date?: string;
  source?: string;
}

export interface ValidationNode {
  id: string;
  title: string;
  type: PopulationType | 'decision' | 'collector';
  description: string;
  status: 'pass' | 'fail' | 'not_applicable' | 'partial';
  facts: ValidationFact[];
  cqlSnippet?: string;
  source?: string;
}

export interface PatientValidationTrace {
  patientId: string;
  patientName?: string;
  narrative: string;
  populations: {
    initialPopulation: { met: boolean; nodes: ValidationNode[] };
    denominator: { met: boolean; nodes: ValidationNode[] };
    exclusions: { met: boolean; nodes: ValidationNode[] };
    numerator: { met: boolean; nodes: ValidationNode[] };
  };
  finalOutcome: 'in_numerator' | 'not_in_numerator' | 'excluded' | 'not_in_population';
  howClose?: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize population type to FHIR kebab-case format
 */
export function normalizePopulationType(type: string): PopulationType {
  const mapping: Record<string, PopulationType> = {
    'initial_population': 'initial-population',
    'initial-population': 'initial-population',
    'denominator': 'denominator',
    'denominator_exclusion': 'denominator-exclusion',
    'denominator-exclusion': 'denominator-exclusion',
    'denominator_exception': 'denominator-exception',
    'denominator-exception': 'denominator-exception',
    'numerator': 'numerator',
    'numerator_exclusion': 'numerator-exclusion',
    'numerator-exclusion': 'numerator-exclusion',
  };
  return mapping[type] || type as PopulationType;
}

/**
 * Convert UMS to FHIR Measure resource
 */
export function toFHIRMeasure(ums: UniversalMeasureSpec): FHIRMeasure {
  return {
    resourceType: 'Measure',
    id: ums.id,
    url: ums.metadata.url,
    identifier: ums.metadata.identifier,
    version: ums.metadata.version,
    name: ums.metadata.measureId,
    title: ums.metadata.title,
    status: ums.status === 'published' ? 'active' : 'draft',
    description: ums.metadata.description,
    rationale: ums.metadata.rationale,
    clinicalRecommendationStatement: ums.metadata.clinicalRecommendation,
    improvementNotation: ums.metadata.improvementNotation ? {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/measure-improvement-notation',
        code: ums.metadata.improvementNotation,
        display: ums.metadata.improvementNotation === 'increase' ? 'Increased score indicates improvement' : 'Decreased score indicates improvement'
      }]
    } : undefined,
    library: ums.metadata.library,
    group: [{
      population: ums.populations.map(pop => ({
        id: pop.id,
        code: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/measure-population',
            code: normalizePopulationType(pop.type).replace('_', '-'),
            display: pop.description
          }]
        },
        description: pop.narrative,
        criteria: pop.expression || {
          language: 'text/cql-identifier',
          expression: pop.cqlDefinitionName || pop.type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        }
      })),
      stratifier: ums.stratifiers?.map(s => ({
        id: s.id,
        description: s.description,
        criteria: s.expression || {
          language: 'text/cql-identifier',
          expression: s.description
        }
      }))
    }],
    supplementalData: ums.supplementalData?.map(sd => ({
      id: sd.id,
      description: sd.description,
      criteria: sd.expression || {
        language: 'text/cql-identifier',
        expression: sd.name
      }
    }))
  };
}
