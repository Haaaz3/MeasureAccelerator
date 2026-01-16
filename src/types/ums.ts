/**
 * Universal Measure Spec (UMS) Schema
 *
 * A canonical, machine-readable representation of clinical quality measure logic.
 * Normalizes rules, value sets, temporal relationships, and attribution across programs.
 */

// ============================================================================
// Core Types
// ============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ReviewStatus = 'pending' | 'approved' | 'needs_revision' | 'flagged';
export type MeasureStatus = 'in_progress' | 'published';
export type MeasureType = 'process' | 'outcome' | 'structure' | 'patient_experience';
export type PopulationType = 'initial_population' | 'denominator' | 'denominator_exclusion' | 'denominator_exception' | 'numerator' | 'numerator_exclusion';
export type LogicalOperator = 'AND' | 'OR' | 'NOT';
export type TemporalOperator = 'during' | 'before' | 'after' | 'overlaps' | 'starts' | 'ends' | 'within';
export type CodeSystem = 'ICD10' | 'SNOMED' | 'CPT' | 'HCPCS' | 'LOINC' | 'RxNorm' | 'CVX';

// ============================================================================
// Value Sets & Codes
// ============================================================================

export interface CodeReference {
  code: string;
  display: string;
  system: CodeSystem;
}

export interface ValueSetReference {
  id: string;
  oid?: string;
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
}

// ============================================================================
// Timing Requirements (when data must occur relative to measurement period)
// ============================================================================

export interface TimingRequirement {
  /** Human-readable description like "During measurement period" or "Within 6 months before MP start" */
  description: string;
  /** The reference point for timing */
  relativeTo: 'measurement_period' | 'encounter_date' | 'diagnosis_onset' | 'procedure_date' | string;
  /** Optional lookback/forward window */
  window?: {
    value: number;
    unit: 'days' | 'weeks' | 'months' | 'years';
    direction: 'before' | 'after' | 'within';
  };
  confidence: ConfidenceLevel;
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
// Criteria & Clauses
// ============================================================================

export interface DataElement {
  id: string;
  type: 'diagnosis' | 'encounter' | 'procedure' | 'observation' | 'medication' | 'demographic' | 'assessment' | 'immunization';
  description: string;
  valueSet?: ValueSetReference;
  directCodes?: CodeReference[];
  /** Numeric thresholds for demographics (age), observations (lab values), etc. */
  thresholds?: {
    ageMin?: number;
    ageMax?: number;
    valueMin?: number;
    valueMax?: number;
    unit?: string;
    comparator?: '>' | '>=' | '<' | '<=' | '=' | '!=';
  };
  /** When must this data element occur? (e.g., "During measurement period") */
  timingRequirements?: TimingRequirement[];
  /** @deprecated Use timingRequirements instead */
  temporalConstraints?: TemporalConstraint[];
  /** Additional logic requirements in plain English */
  additionalRequirements?: string[];
  /** @deprecated Use additionalRequirements instead */
  additionalConstraints?: string[];
  confidence: ConfidenceLevel;
  source?: string;
  reviewStatus: ReviewStatus;
  /** AI conversation history for this component */
  aiConversation?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

export interface LogicalClause {
  id: string;
  operator: LogicalOperator;
  description: string;
  children: (DataElement | LogicalClause)[];
  confidence: ConfidenceLevel;
  reviewStatus: ReviewStatus;
  cqlSnippet?: string;
}

// ============================================================================
// Population Definitions
// ============================================================================

export interface PopulationDefinition {
  id: string;
  type: PopulationType;
  description: string;
  narrative: string;
  criteria: LogicalClause;
  confidence: ConfidenceLevel;
  reviewStatus: ReviewStatus;
  reviewNotes?: string;
  cqlDefinition?: string;
}

// ============================================================================
// Stratification & Supplemental Data
// ============================================================================

export interface Stratifier {
  id: string;
  description: string;
  criteria: LogicalClause;
  confidence: ConfidenceLevel;
  reviewStatus: ReviewStatus;
}

export interface SupplementalData {
  id: string;
  name: string;
  description: string;
  dataElement: DataElement;
}

// ============================================================================
// Attribution (for future cross-program support)
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
 * When modified, these values propagate to all relevant places
 * (descriptions, thresholds, population criteria).
 */
export interface GlobalConstraints {
  /** Age range for the measure's target population */
  ageRange?: {
    min: number;
    max: number;
  };
  /** Gender requirement (if any) */
  gender?: 'male' | 'female' | 'all';
  /** Whether age is calculated at start, end, or during measurement period */
  ageCalculation?: 'at_start' | 'at_end' | 'during' | 'turns_during';
}

// ============================================================================
// Main UMS Document
// ============================================================================

export interface MeasureMetadata {
  measureId: string;
  title: string;
  version: string;
  cbeNumber?: string;
  steward: string;
  program: 'MIPS_CQM' | 'eCQM' | 'HEDIS' | 'QOF' | 'Registry' | 'Custom';
  measureType: MeasureType;
  description: string;
  rationale?: string;
  clinicalRecommendation?: string;
  submissionFrequency?: string;
  improvementNotation?: 'increase' | 'decrease';
  measurementPeriod: DateRange;
  lastUpdated: string;
  sourceDocuments?: string[];
}

export interface UniversalMeasureSpec {
  id: string;
  metadata: MeasureMetadata;
  populations: PopulationDefinition[];
  valueSets: ValueSetReference[];
  stratifiers?: Stratifier[];
  supplementalData?: SupplementalData[];
  attribution?: AttributionRule;

  /** Centralized constraints - single source of truth for age, gender, etc. */
  globalConstraints?: GlobalConstraints;

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

  // Lock for publish - prevents further edits
  lockedAt?: string;
  lockedBy?: string;

  // Generated artifacts
  generatedCql?: string;
  generatedSql?: string;

  // Training feedback - corrections made by users to AI-generated content
  corrections?: MeasureCorrection[];
}

// ============================================================================
// Training Feedback Types (for AI improvement)
// ============================================================================

export type CorrectionType =
  | 'code_added'           // User added a code the AI missed
  | 'code_removed'         // User removed an incorrect code
  | 'code_system_changed'  // User corrected the code system
  | 'timing_changed'       // User modified timing requirements
  | 'logic_changed'        // User changed AND/OR logic
  | 'description_changed'  // User refined the description
  | 'threshold_changed'    // User adjusted numeric thresholds
  | 'population_reassigned' // User moved element to different population
  | 'element_added'        // User added an element AI missed
  | 'element_removed';     // User removed an incorrect element

export interface MeasureCorrection {
  id: string;
  timestamp: string;
  correctionType: CorrectionType;
  componentId: string;           // ID of the UMS component that was corrected
  componentPath: string;         // e.g., "populations[0].criteria.children[1]"

  // What the AI originally generated
  originalValue: any;

  // What the user changed it to
  correctedValue: any;

  // Optional context
  userNotes?: string;            // Why the user made this change
  sourceReference?: string;      // Reference to spec document (e.g., "Page 12, Section 3.2")

  // For training purposes
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
