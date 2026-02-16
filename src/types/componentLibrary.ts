/**
 * Component Library Type Definitions
 *
 * Defines the structure for reusable measure logic blocks with:
 * - Atomic components (value set + timing)
 * - Composite components (collections with AND/OR logic)
 * - Versioning and approval workflow
 * - Complexity scoring
 */

// ============================================================================
// Core Identifiers
// ============================================================================

/** Unique identifier for a component (UUID) */
export type ComponentId = string;

/** Version identifier (semver-like: "1.0", "1.1", "2.0") */
export type VersionId = string;

/** Value Set OID (e.g., "2.16.840.1.113883.3.464.1003.101.12.1001") */
export type ValueSetOid = string;

// ============================================================================
// Complexity Scoring
// ============================================================================

export type ComplexityLevel = 'low' | 'medium' | 'high';

export interface ComplexityFactors {
  /** Base score (always 1 for atomics) */
  base: number;
  /** Number of timing clauses */
  timingClauses: number;
  /** Number of negations ("without", "absence of") */
  negations: number;
  /** For composites: sum of children complexity scores */
  childrenSum?: number;
  /** For composites: AND operators add +1 each */
  andOperators?: number;
  /** For composites: nesting depth beyond 1 level */
  nestingDepth?: number;
  /** Component has zero codes — requires manual review */
  zeroCodes?: boolean;
}

export interface ComponentComplexity {
  /** Overall complexity level */
  level: ComplexityLevel;
  /** Numeric score (for sorting/comparison) */
  score: number;
  /** Breakdown of contributing factors */
  factors: ComplexityFactors;
}

// ============================================================================
// Timing Expressions
// ============================================================================

export type TimingOperator =
  | 'during'
  | 'before'
  | 'after'
  | 'starts during'
  | 'ends during'
  | 'starts before'
  | 'starts after'
  | 'ends before'
  | 'ends after'
  | 'within'
  | 'overlaps';

export interface TimingExpression {
  /** The timing operator */
  operator: TimingOperator;
  /** Quantity for "within X years/days" expressions */
  quantity?: number;
  /** Unit for quantity */
  unit?: 'years' | 'months' | 'days' | 'hours';
  /** Position modifier (before/after end of) */
  position?: 'before start of' | 'before end of' | 'after start of' | 'after end of';
  /** Reference period or event */
  reference: 'Measurement Period' | 'encounter' | 'diagnosis' | string;
  /** Raw expression string for display */
  displayExpression: string;
}

// ============================================================================
// OID Validation Status
// ============================================================================

export type OIDValidationStatusType = 'valid' | 'invalid' | 'unknown';

export interface OIDValidationStatus {
  /** Overall validation status */
  status: OIDValidationStatusType;
  /** Validation error messages (only if invalid) */
  errors?: string[];
  /** Validation warning messages */
  warnings?: string[];
  /** Whether OID was found in the known catalog */
  inCatalog?: boolean;
  /** Expected name from catalog (if OID found) */
  catalogName?: string;
  /** Validated at timestamp */
  validatedAt?: string;
}

// ============================================================================
// Atomic Component
// ============================================================================

/** Value set definition within a component */
export interface ComponentValueSet {
  oid: ValueSetOid;
  version: string;
  name: string;
  codes?: import('./ums').CodeReference[];
}

export interface AtomicComponent {
  type: 'atomic';

  /** Unique identifier */
  id: ComponentId;

  /** Human-readable name */
  name: string;

  /** Detailed description */
  description?: string;

  /**
   * Primary value set reference (for backward compatibility)
   * @deprecated Use valueSets array for new components
   */
  valueSet: ComponentValueSet;

  /**
   * Multiple value sets combined in this component (OR logic)
   * E.g., "Hospice or Palliative Care Services" combines hospice + palliative care value sets
   * All codes from all value sets are included in this component
   */
  valueSets?: ComponentValueSet[];

  /** Timing constraint */
  timing: TimingExpression;

  /** Whether this is a negation (absence of, without) */
  negation: boolean;

  /**
   * QI-Core resource type this component targets (e.g., 'Patient' for demographics)
   * Used by inferCategory() and code generators to determine the FHIR resource
   */
  resourceType?: import('./fhir-measure').QICoreResourceType;

  /**
   * For Patient sex components: the gender value to check
   * Maps to FHIR Patient.gender with values 'male' or 'female'
   */
  genderValue?: 'male' | 'female';

  /** Auto-calculated complexity */
  complexity: ComponentComplexity;

  /** OID validation result (valid/invalid/unknown + warnings) */
  oidValidation?: OIDValidationStatus;

  /** Version and approval info */
  versionInfo: ComponentVersionInfo;

  /** Usage tracking */
  usage: ComponentUsage;

  /** Metadata */
  metadata: ComponentMetadata;
}

// ============================================================================
// Composite Component
// ============================================================================

export type LogicalOperator = 'AND' | 'OR';

export interface CompositeComponent {
  type: 'composite';

  /** Unique identifier */
  id: ComponentId;

  /** Human-readable name (generic, e.g., "Qualifying Encounter") */
  name: string;

  /** Detailed description */
  description?: string;

  /** Logical operator combining children */
  operator: LogicalOperator;

  /**
   * Child component references
   * Each entry is componentId + versionId to lock to specific versions
   */
  children: ComponentReference[];

  /** Auto-calculated complexity */
  complexity: ComponentComplexity;

  /** Version and approval info */
  versionInfo: ComponentVersionInfo;

  /** Usage tracking */
  usage: ComponentUsage;

  /** Metadata */
  metadata: ComponentMetadata;
}

export interface ComponentReference {
  /** Reference to component */
  componentId: ComponentId;
  /** Specific version (composites lock to versions, not "latest") */
  versionId: VersionId;
  /** Cached name for display (denormalized) */
  displayName: string;
}

// ============================================================================
// Union Type
// ============================================================================

export type LibraryComponent = AtomicComponent | CompositeComponent;

// ============================================================================
// Versioning
// ============================================================================

export type ApprovalStatus = 'draft' | 'pending_review' | 'approved' | 'archived';

export interface ComponentVersionInfo {
  /** Current version identifier */
  versionId: VersionId;

  /** All versions of this component */
  versionHistory: VersionHistoryEntry[];

  /** Current approval status */
  status: ApprovalStatus;

  /** Who approved (if approved) */
  approvedBy?: string;

  /** When approved */
  approvedAt?: string;

  /** Review notes */
  reviewNotes?: string;
}

export interface VersionHistoryEntry {
  versionId: VersionId;
  status: ApprovalStatus;
  createdAt: string;
  createdBy: string;
  changeDescription: string;
  /** If archived, what version superseded this */
  supersededBy?: VersionId;
}

// ============================================================================
// Usage Tracking
// ============================================================================

export interface ComponentUsage {
  /** Measures using this component (by measure ID) */
  measureIds: string[];

  /** Total usage count */
  usageCount: number;

  /** Last time this component was used in a measure */
  lastUsedAt?: string;

  /** For composites: which parent composites include this */
  parentCompositeIds?: ComponentId[];
}

export interface MeasureReference {
  measureId: string;
  measureName: string;
  populationType: string;
}

// ============================================================================
// Metadata
// ============================================================================

export interface ComponentMetadata {
  /** When created */
  createdAt: string;

  /** Who created */
  createdBy: string;

  /** Last modified */
  updatedAt: string;

  /** Who last modified */
  updatedBy: string;

  /** Category for organization */
  category: ComponentCategory;

  /** Tags for search/filtering */
  tags: string[];

  /** Source of this component */
  source: ComponentSource;

  /**
   * True if category was auto-assigned by inferCategory(); false if manually set.
   * When true, category may be re-inferred on component edit.
   * When false (manual override), category is never re-inferred.
   */
  categoryAutoAssigned?: boolean;
}

export type ComponentCategory =
  | 'demographics'
  | 'encounters'
  | 'conditions'
  | 'procedures'
  | 'medications'
  | 'assessments'           // Screenings, surveys, questionnaires (e.g., PHQ-9)
  | 'laboratory'            // Lab tests and results (e.g., HbA1c, LDL)
  | 'clinical-observations' // Vitals, BMI, social determinants (fallback for Observation)
  | 'exclusions';

export interface ComponentSource {
  /** Where this originated */
  origin: 'ecqi' | 'custom' | 'imported';
  /** Reference to original (e.g., eCQI URL) */
  originReference?: string;
  /** Original measure this was extracted from */
  originalMeasureId?: string;
}

// ============================================================================
// Component Library
// ============================================================================

export interface ComponentLibrary {
  /** All components indexed by ID */
  components: Record<ComponentId, LibraryComponent>;

  /** Categories with their component IDs for navigation */
  categories: CategoryGroup[];

  /** Library metadata */
  metadata: LibraryMetadata;
}

export interface CategoryGroup {
  category: ComponentCategory;
  displayName: string;
  componentIds: ComponentId[];
  sortOrder: number;
}

export interface LibraryMetadata {
  /** Library version for migrations */
  schemaVersion: string;
  /** Last updated */
  lastUpdatedAt: string;
  /** Total component count */
  totalComponents: number;
  /** Counts by status */
  statusCounts: Record<ApprovalStatus, number>;
}

// ============================================================================
// Component Matching (for Import)
// ============================================================================

export type MatchType = 'exact' | 'similar' | 'none';

export interface ComponentMatch {
  /** The incoming component being matched */
  incomingComponent: ParsedComponent;

  /** Match result */
  matchType: MatchType;

  /** Matched library component (if exact or similar) */
  matchedComponent?: LibraryComponent;

  /** Similarity score (0-1, only for 'similar') */
  similarity?: number;

  /** Differences found (only for 'similar') */
  differences?: ComponentDiff[];
}

/** Parsed component from import (before full hydration) */
export interface ParsedComponent {
  name: string;
  valueSetOid?: ValueSetOid;
  valueSetName?: string;
  timing?: TimingExpression;
  negation?: boolean;
  children?: ParsedComponent[];
  operator?: LogicalOperator;
}

export interface ComponentDiff {
  field: 'timing' | 'valueSet' | 'negation' | 'children' | 'operator';
  expected: string;
  actual: string;
  description: string;
}

// ============================================================================
// Edit Workflow
// ============================================================================

export type EditAction = 'update_all' | 'create_version';

export interface EditDecision {
  /** The component being edited */
  componentId: ComponentId;

  /** Original version before edit */
  originalVersionId: VersionId;

  /** What the user chose */
  action: EditAction;

  /** The changes being made */
  changes: ComponentChanges;

  /** Measures that will be affected */
  affectedMeasures: MeasureReference[];
}

export interface ComponentChanges {
  /** New name (if changed) */
  name?: string;

  /** New timing (if changed) - for atomics */
  timing?: TimingExpression;

  /** New negation value (if changed) - for atomics */
  negation?: boolean;

  /** New codes (if changed) - for atomics */
  codes?: import('./ums').CodeReference[];

  /** New children (if changed) - for composites */
  children?: ComponentReference[];

  /** New operator (if changed) - for composites */
  operator?: LogicalOperator;

  /** Description of what changed */
  changeDescription: string;
}

// ============================================================================
// Component Identity (for hashing/matching)
// ============================================================================

export interface ComponentIdentity {
  /** Hash string for fast comparison */
  hash: string;

  /** Human-readable identity string */
  readableIdentity: string;
}

// ============================================================================
// Store Actions
// ============================================================================

export interface AddComponentPayload {
  component: Omit<LibraryComponent, 'id' | 'complexity' | 'usage' | 'versionInfo'>;
  createdBy: string;
}

export interface UpdateComponentPayload {
  componentId: ComponentId;
  changes: ComponentChanges;
  editAction: EditAction;
  updatedBy: string;
}

export interface ArchiveComponentPayload {
  componentId: ComponentId;
  versionId: VersionId;
  supersededBy: VersionId;
  archivedBy: string;
}

// ============================================================================
// UI State
// ============================================================================

/** Sort field options for library browser */
export type LibrarySortField = 'name' | 'complexity' | 'usage' | 'status' | 'date';

/** Measure program types (same as MeasureMetadata.program) */
export type MeasureProgram = 'MIPS_CQM' | 'eCQM' | 'HEDIS' | 'QOF' | 'Registry' | 'Custom';

export interface LibraryBrowserFilters {
  category?: ComponentCategory;
  /** Multiple statuses can be selected at once */
  statuses?: ApprovalStatus[];
  /** Multiple complexity levels can be selected at once */
  complexities?: ComplexityLevel[];
  /** Sort by usage count: 'desc' = most shared first, 'asc' = least shared first */
  usageSort?: 'asc' | 'desc';
  searchQuery?: string;
  showArchived: boolean;
  /** Sort field for the component list */
  sortBy?: LibrarySortField;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Filter by measure programs (catalogue) - shows components used in measures with these programs */
  programs?: MeasureProgram[];
  /** @deprecated Use statuses[] instead */
  status?: ApprovalStatus;
  /** @deprecated Use complexities[] instead */
  complexity?: ComplexityLevel;
}

export interface ImportMatcherState {
  /** Components detected from import */
  parsedComponents: ParsedComponent[];

  /** Match results for each */
  matches: ComponentMatch[];

  /** User decisions */
  decisions: Record<string, 'link' | 'create'>;

  /** Import progress */
  status: 'analyzing' | 'ready' | 'importing' | 'complete';
}
