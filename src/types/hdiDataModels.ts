/**
 * HDI (HealtheIntent) Data Model Type Definitions
 *
 * These interfaces define the structure for generating production-ready SQL
 * queries that follow the HDI platform patterns with CTEs, ontology joins,
 * and predicate-based filtering.
 */

// ============================================================================
// Core SQL Generation Configuration
// ============================================================================

export interface SQLGenerationConfig {
  /** HDI population_id for the target environment */
  populationId: string;
  /** Ontology context names to include (e.g., 'HEALTHE INTENT Demographics') */
  ontologyContexts: string[];
  /** Whether to exclude SNAPSHOT and ARCHIVE populations */
  excludeSnapshotsAndArchives: boolean;
  /** SQL dialect for output (snowflake, standard) */
  dialect: 'snowflake' | 'standard';
  /** Include inline comments in generated SQL */
  includeComments: boolean;
  /** Measurement period for temporal calculations */
  measurementPeriod?: {
    start: string; // ISO date
    end: string;   // ISO date
  };
  /** Intake period (for HEDIS measures like AMM) */
  intakePeriod?: {
    start: string; // ISO date
    end: string;   // ISO date
  };
}

// ============================================================================
// Ontology / Terminology Models
// ============================================================================

export interface OntologyReference {
  /** The context name in ph_d_ontology (e.g., 'HEALTHE INTENT Demographics') */
  contextName: string;
  /** The concept class name for filtering (e.g., 'Gender', 'Race', 'Ethnicity') */
  conceptClassName: string;
  /** Optional pattern for concept name matching (e.g., '%FHIR%') */
  conceptNamePattern?: string;
}

export interface TerminologyBinding {
  /** Code system identifier */
  codeSystemId: string;
  /** Code OID or value */
  codeOid: string;
  /** Human-readable concept name */
  conceptName?: string;
}

// ============================================================================
// Demographics Data Model
// ============================================================================

export interface DemographicsPredicate {
  type: 'demographics';
  alias: string;
  description?: string;

  /** Age constraints */
  age?: {
    min?: number;
    max?: number;
    /** Reference date for age calculation (defaults to current_date()) */
    referenceDate?: string;
    /** Calculate age relative to an index event instead of current_date() */
    indexEvent?: IndexEventTiming;
  };

  /** Gender/sex constraints using FHIR concept names */
  gender?: {
    include?: string[];
    exclude?: string[];
  };

  /** Birth sex constraints */
  birthSex?: {
    include?: string[];
    exclude?: string[];
  };

  /** Deceased status filter */
  deceased?: boolean | null; // null = any

  /** Geographic constraints */
  geography?: {
    postalCodes?: string[];
    states?: string[];
    countries?: string[];
  };

  /** Marital status constraints */
  maritalStatus?: {
    include?: string[];
    exclude?: string[];
  };

  /** Ethnicity constraints */
  ethnicity?: {
    include?: string[];
    exclude?: string[];
  };

  /** Race constraints */
  race?: {
    include?: string[];
    exclude?: string[];
  };

  /** Religion constraints */
  religion?: {
    include?: string[];
    exclude?: string[];
  };
}

// ============================================================================
// Condition Data Model
// ============================================================================

export interface ConditionPredicate {
  type: 'condition';
  alias: string;
  description?: string;

  /** Condition code constraints (ICD-10, SNOMED, etc.) */
  codes?: {
    valueSetOid?: string;
    valueSetName?: string;
    explicitCodes?: CodeReference[];
  };

  /** Condition type (diagnosis, problem) */
  conditionType?: 'diagnosis' | 'problem' | 'any';

  /** Clinical status constraints */
  status?: {
    include?: string[];
    exclude?: string[];
  };

  /** Temporal constraints */
  timing?: {
    /** Effective date must be within this period */
    effectiveDateRange?: DateRange;
    /** Service date of associated encounter */
    serviceDateRange?: DateRange;
    /** Lookback period from reference date */
    lookbackDays?: number;
    lookbackYears?: number;
    /** Timing relative to an index event (replaces current_date() lookbacks) */
    indexEvent?: IndexEventTiming;
  };

  /** Associated encounter constraints */
  encounter?: {
    types?: string[];
    excludeTypes?: string[];
  };

  /** Whether condition must be claim-sourced */
  requireClaimSource?: boolean;
}

// ============================================================================
// Result/Observation Data Model
// ============================================================================

export interface ResultPredicate {
  type: 'result';
  alias: string;
  description?: string;

  /** Result code constraints (LOINC, etc.) */
  codes?: {
    valueSetOid?: string;
    valueSetName?: string;
    explicitCodes?: CodeReference[];
  };

  /** Result value constraints */
  value?: {
    /** Numeric value constraints */
    numeric?: {
      min?: number;
      max?: number;
      operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
    };
    /** Codified value constraints */
    codified?: {
      include?: string[];
      exclude?: string[];
    };
    /** Text value pattern */
    textPattern?: string;
  };

  /** Unit of measure constraints */
  unitOfMeasure?: string[];

  /** Result status */
  status?: string[];

  /** Temporal constraints */
  timing?: {
    serviceDateRange?: DateRange;
    lookbackDays?: number;
    lookbackYears?: number;
    /** Timing relative to an index event */
    indexEvent?: IndexEventTiming;
  };
}

// ============================================================================
// Encounter Data Model
// ============================================================================

export interface EncounterPredicate {
  type: 'encounter';
  alias: string;
  description?: string;

  /** Encounter type/class constraints */
  encounterType?: {
    include?: string[];
    exclude?: string[];
  };

  /** Temporal constraints */
  timing?: {
    serviceDateRange?: DateRange;
    lookbackDays?: number;
    /** Timing relative to an index event */
    indexEvent?: IndexEventTiming;
  };

  /** Facility type constraints */
  facilityType?: string[];
}

// ============================================================================
// Procedure Data Model
// ============================================================================

export interface ProcedurePredicate {
  type: 'procedure';
  alias: string;
  description?: string;

  /** Procedure code constraints (CPT, HCPCS, ICD-10-PCS) */
  codes?: {
    valueSetOid?: string;
    valueSetName?: string;
    explicitCodes?: CodeReference[];
  };

  /** Temporal constraints */
  timing?: {
    performedDateRange?: DateRange;
    lookbackDays?: number;
    lookbackYears?: number;
    /** Timing relative to an index event */
    indexEvent?: IndexEventTiming;
  };

  /** Associated encounter constraints */
  encounter?: {
    types?: string[];
  };
}

// ============================================================================
// Medication Data Model
// ============================================================================

export interface MedicationPredicate {
  type: 'medication';
  alias: string;
  description?: string;

  /** Medication code constraints (RxNorm, NDC) */
  codes?: {
    valueSetOid?: string;
    valueSetName?: string;
    explicitCodes?: CodeReference[];
  };

  /** Medication status */
  status?: 'active' | 'completed' | 'stopped' | 'any';

  /** Temporal constraints */
  timing?: {
    effectiveDateRange?: DateRange;
    lookbackDays?: number;
    /** Timing relative to an index event */
    indexEvent?: IndexEventTiming;
  };

  /** Cumulative days supply calculation (for AMM-style measures) */
  cumulativeDaysSupply?: CumulativeDaysSupplyConfig;
}

// ============================================================================
// Immunization Data Model
// ============================================================================

export interface ImmunizationPredicate {
  type: 'immunization';
  alias: string;
  description?: string;

  /** Immunization code constraints (CVX) */
  codes?: {
    valueSetOid?: string;
    valueSetName?: string;
    explicitCodes?: CodeReference[];
  };

  /** Temporal constraints */
  timing?: {
    administrationDateRange?: DateRange;
    lookbackDays?: number;
    lookbackYears?: number;
  };
}

// ============================================================================
// Composite Types
// ============================================================================

export type DataModelPredicate =
  | DemographicsPredicate
  | ConditionPredicate
  | ResultPredicate
  | EncounterPredicate
  | ProcedurePredicate
  | MedicationPredicate
  | ImmunizationPredicate;

export interface CodeReference {
  code: string;
  system: 'ICD10' | 'ICD10CM' | 'ICD10PCS' | 'CPT' | 'HCPCS' | 'SNOMED' | 'LOINC' | 'CVX' | 'RxNorm' | 'NDC';
  display?: string;
}

export interface DateRange {
  start?: string; // ISO date
  end?: string;   // ISO date
}

// ============================================================================
// Index Event Timing (e.g., IPSD-relative lookbacks)
// ============================================================================

/**
 * Describes timing relative to an index event (e.g., IPSD).
 * Instead of lookback from current_date(), the predicate joins to an
 * index-event CTE and computes date offsets from that event date.
 */
export interface IndexEventTiming {
  /** CTE alias that provides the index event date (e.g., "IPSD") */
  cteAlias: string;
  /** Column name on the CTE that holds the event date */
  dateColumn: string;
  /** Offset in days BEFORE the index event (positive number) */
  daysBefore?: number;
  /** Offset in days AFTER the index event (positive number) */
  daysAfter?: number;
}

/**
 * For medication measures that require cumulative days-supply calculation
 * (e.g., AMM acute/continuation phase).
 */
export interface CumulativeDaysSupplyConfig {
  /** Value set OID for the medication */
  valueSetOid: string;
  /** Index event CTE alias (e.g., "IPSD") */
  indexEventCte: string;
  /** Index event date column */
  indexEventDateColumn: string;
  /** Treatment window in days from index event */
  windowDays: number;
  /** Minimum cumulative days supply required */
  requiredDaysSupply: number;
  /** Human-readable label for this rate */
  rateLabel: string;
}

// ============================================================================
// Predicate Combination Logic
// ============================================================================

export type PredicateOperator = 'AND' | 'OR' | 'NOT' | 'INTERSECT' | 'EXCEPT' | 'UNION';

export interface PredicateGroup {
  operator: PredicateOperator;
  children: (string | PredicateGroup)[]; // string = predicate alias reference
}

// ============================================================================
// SQL Generation Output
// ============================================================================

export interface SQLGenerationResult {
  success: boolean;
  sql: string;
  errors: string[];
  warnings: string[];
  metadata: {
    predicateCount: number;
    dataModelsUsed: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    generatedAt: string;
  };
}

// ============================================================================
// Measure-to-SQL Mapping
// ============================================================================

export interface MeasureSQLMapping {
  /** The source UMS measure ID */
  measureId: string;

  /** Configuration for SQL generation */
  config: SQLGenerationConfig;

  /** Predicates extracted from measure logic */
  predicates: DataModelPredicate[];

  /** How predicates combine to form populations */
  populations: {
    initialPopulation?: PredicateGroup;
    denominator?: PredicateGroup;
    denominatorExclusion?: PredicateGroup;
    denominatorException?: PredicateGroup;
    numerator?: PredicateGroup;
    numeratorExclusion?: PredicateGroup;
  };

  /** Additional named numerators for multi-rate measures (e.g., AMM acute + continuation) */
  additionalNumerators?: {
    alias: string;
    label: string;
    group: PredicateGroup;
  }[];

  /** Index event CTEs that must be generated before predicates (e.g., IPSD) */
  indexEventCTEs?: IndexEventCTEConfig[];

  /** Auxiliary CTEs injected between predicates and populations (e.g., MED_COVERAGE) */
  auxiliaryCTEs?: string[];
}

export interface IndexEventCTEConfig {
  /** CTE alias (e.g., "IPSD") */
  alias: string;
  /** The raw SQL for this CTE */
  sql: string;
}

// ============================================================================
// HDI Table Schema References
// ============================================================================

export const HDI_TABLES = {
  // Core person tables
  PERSON: 'ph_d_person',
  PERSON_DEMOGRAPHICS: 'ph_d_person_demographics',
  PERSON_RACE: 'ph_d_person_race',

  // Ontology
  ONTOLOGY: 'ph_d_ontology',

  // Clinical fact tables
  CONDITION: 'ph_f_condition',
  RESULT: 'ph_f_result',
  ENCOUNTER: 'ph_f_encounter',
  ENCOUNTER_TYPE: 'ph_f_encounter_type',
  PROCEDURE: 'ph_f_procedure',
  MEDICATION: 'ph_f_medication',
  IMMUNIZATION: 'ph_f_immunization',

  // Supporting tables
  CLAIM: 'ph_f_claim',
} as const;

export const HDI_COMMON_COLUMNS = {
  /** Standard predicate output columns */
  PREDICATE_OUTPUT: [
    'population_id',
    'empi_id',
    'data_model',
    'identifier',
    'clinical_start_date',
    'clinical_end_date',
    'description'
  ],

  /** Required join columns */
  JOIN_KEYS: ['population_id', 'empi_id'],
} as const;
