# MeasureAccelerator Technical Specification

**Version:** 1.1
**Last Updated:** January 29, 2026
**Purpose:** Developer handoff documentation for MeasureAccelerator platform

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Core Data Models](#core-data-models) (incl. Component Library data model)
5. [Key Services](#key-services) (incl. Complexity Calculator, Component Matcher, Library Service)
6. [Component Reference](#component-reference) (incl. Library UI components, Batch Upload)
7. [State Management](#state-management) (incl. componentLibraryStore)
8. [API Integration](#api-integration)
9. [Validation Engine](#validation-engine)
10. [CQL Generation](#cql-generation)
11. [Deployment](#deployment)
12. [Future Enhancements](#future-enhancements)

---

## Project Overview

MeasureAccelerator is a healthcare quality measure development platform that enables measure stewards to:

- **Ingest** measure specifications (PDFs, Word documents) using AI-powered extraction
- **Edit** measures using a structured Universal Measure Specification (UMS) format
- **Validate** measure logic against synthetic test patients
- **Export** measures as CQL (Clinical Quality Language) or FHIR resources

### Business Context

Healthcare quality measures (like CMS130 - Colorectal Cancer Screening) define how to calculate provider performance. These measures traditionally require manual translation from PDF specifications into executable code. MeasureAccelerator automates this process.

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 19.x |
| Language | TypeScript | 5.x |
| Build Tool | Vite | 7.x |
| State Management | Zustand | 5.x |
| Styling | Tailwind CSS | 4.x |
| Icons | Lucide React | - |
| AI Integration | OpenAI API | GPT-4o |
| Hosting | Vercel | - |
| Version Control | GitHub | - |

### Project Structure

```
src/
├── components/
│   ├── measure/           # Measure creation/editing components
│   │   ├── MeasureCreator.tsx    # Wizard for creating measures
│   │   ├── MeasureLibrary.tsx    # Measure list, upload, and batch queue
│   │   └── UMSEditor.tsx         # Full measure editor + library integration
│   ├── library/           # Component library UI
│   │   ├── LibraryBrowser.tsx    # Library browser with filters and search
│   │   ├── ComponentDetail.tsx   # Component detail panel
│   │   ├── ComponentEditor.tsx   # Component editor with shared edit warning
│   │   ├── SharedEditWarning.tsx # Modal for shared component edits
│   │   ├── ImportMatcher.tsx     # Import matching panel
│   │   └── index.ts              # Barrel export
│   ├── validation/        # Test validation components
│   │   └── ValidationTraceViewer.tsx  # Validation results display
│   ├── settings/          # Application settings
│   └── layout/            # Navigation, headers
├── services/
│   ├── measureEvaluator.ts       # Core validation engine
│   ├── openaiService.ts          # AI extraction service
│   ├── cqlGenerator.ts           # CQL code generation
│   ├── complexityCalculator.ts   # Component complexity scoring
│   ├── componentMatcher.ts       # Exact match and similarity detection
│   └── componentLibraryService.ts # Component CRUD operations
├── stores/
│   ├── measureStore.ts           # Measure state management
│   ├── componentLibraryStore.ts  # Component library state management
│   ├── patientStore.ts           # Test patient state
│   └── settingsStore.ts          # App settings state
├── data/
│   └── sampleLibraryData.ts      # Sample component library data
├── types/
│   ├── measure.ts                # Core UMS TypeScript interfaces
│   └── componentLibrary.ts       # Component library type definitions
└── utils/
    └── valueSetUtils.ts          # Value set helpers
```

---

## Core Data Models

### Universal Measure Specification (UMS)

The UMS is the canonical JSON format for representing quality measures. Located in `src/types/measure.ts`.

```typescript
interface UniversalMeasureSpec {
  metadata: MeasureMetadata;
  populations: Population[];
  globalConstraints?: GlobalConstraints;
  valueSets: ValueSet[];
}
```

#### Metadata

```typescript
interface MeasureMetadata {
  title: string;              // e.g., "Colorectal Cancer Screening"
  measureId?: string;         // e.g., "CMS130v12"
  version?: string;           // e.g., "12.0.0"
  description?: string;       // Plain-text description
  measureType?: 'proportion' | 'continuous' | 'ratio';
  improvementNotation?: 'increase' | 'decrease';
  rationale?: string;         // Clinical rationale
  clinicalRecommendation?: string;
  measureSteward?: string;    // e.g., "NCQA"
  measurementPeriod?: {
    start: string;            // ISO date
    end: string;
  };
}
```

#### Populations

```typescript
interface Population {
  id: string;
  type: 'initial_population' | 'denominator' | 'denominator_exclusion' |
        'denominator_exception' | 'numerator' | 'numerator_exclusion';
  description?: string;
  narrative?: string;         // Human-readable criteria
  criteria?: CriteriaGroup;   // Logical grouping of data elements
}
```

#### Criteria Groups

```typescript
interface CriteriaGroup {
  operator: 'AND' | 'OR';
  children: (DataElement | CriteriaGroup)[];
}
```

#### Data Elements

```typescript
interface DataElement {
  id: string;
  type: 'condition' | 'procedure' | 'medication' | 'observation' |
        'encounter' | 'allergy' | 'immunization' | 'assessment' |
        'device' | 'laboratory';
  description?: string;
  valueSet?: ValueSetReference;
  timingRequirements?: TimingRequirement[];
  status?: string;
  negation?: boolean;         // True = absence of element
}
```

#### Value Sets

```typescript
interface ValueSet {
  id: string;
  oid?: string;               // e.g., "2.16.840.1.113883.3.464.1003.108.12.1001"
  name: string;               // e.g., "Colonoscopy"
  version?: string;
  codes: CodeEntry[];
}

interface CodeEntry {
  code: string;               // e.g., "45378"
  display: string;            // e.g., "Colonoscopy, diagnostic"
  system: 'ICD10' | 'CPT' | 'SNOMED' | 'LOINC' | 'CVX' | 'HCPCS' | 'RxNorm';
}
```

#### Global Constraints

```typescript
interface GlobalConstraints {
  ageRange?: {
    min?: number;
    max?: number;
    unit: 'years' | 'months' | 'days';
  };
  gender?: 'male' | 'female' | 'all';
}
```

### Test Patient Model

```typescript
interface TestPatient {
  id: string;
  name: string;
  demographics: {
    birthDate: string;        // ISO date
    gender: 'male' | 'female';
  };
  conditions: PatientCondition[];
  procedures: PatientProcedure[];
  medications: PatientMedication[];
  observations: PatientObservation[];
  encounters: PatientEncounter[];
  immunizations: PatientImmunization[];
  expectedOutcome?: {
    inInitialPopulation: boolean;
    inDenominator: boolean;
    inDenominatorExclusion: boolean;
    inNumerator: boolean;
  };
}
```

### Component Library Data Model

Located in `src/types/componentLibrary.ts`. Defines the reusable component library system.

#### Core Types

```typescript
type ComponentId = string;     // UUID
type VersionId = string;       // Semver-like: "1.0", "1.1", "2.0"
type ValueSetOid = string;     // e.g., "2.16.840.1.113883.3.464.1003.101.12.1001"
type ComplexityLevel = 'low' | 'medium' | 'high';
type ApprovalStatus = 'draft' | 'pending_review' | 'approved' | 'archived';
type LogicalOperator = 'AND' | 'OR';
type MatchType = 'exact' | 'similar' | 'none';
type EditAction = 'update_all' | 'create_version';
type ComponentCategory = 'demographics' | 'encounters' | 'conditions' | 'procedures'
  | 'medications' | 'observations' | 'exclusions' | 'other';
```

#### Atomic Component

```typescript
interface AtomicComponent {
  type: 'atomic';
  id: ComponentId;
  name: string;
  description?: string;
  valueSet: { oid: ValueSetOid; version: string; name: string; };
  timing: TimingExpression;
  negation: boolean;
  complexity: ComponentComplexity;
  versionInfo: ComponentVersionInfo;
  usage: ComponentUsage;
  metadata: ComponentMetadata;
}
```

#### Composite Component

```typescript
interface CompositeComponent {
  type: 'composite';
  id: ComponentId;
  name: string;
  operator: LogicalOperator;
  children: ComponentReference[];  // Locked to specific versions
  complexity: ComponentComplexity;
  versionInfo: ComponentVersionInfo;
  usage: ComponentUsage;
  metadata: ComponentMetadata;
}
```

#### Complexity Scoring

```typescript
interface ComponentComplexity {
  level: ComplexityLevel;
  score: number;
  factors: ComplexityFactors;
}

interface ComplexityFactors {
  base: number;             // Always 1 for atomics
  timingClauses: number;    // +1 per clause
  negations: number;        // +2 per negation
  childrenSum?: number;     // For composites: sum of children
  andOperators?: number;    // +1 per AND
  nestingDepth?: number;    // +2 per level beyond 1
}
```

#### Usage Tracking & Versioning

```typescript
interface ComponentUsage {
  measureIds: string[];
  usageCount: number;
  lastUsedAt?: string;
  parentCompositeIds?: ComponentId[];
}

interface ComponentVersionInfo {
  versionId: VersionId;
  versionHistory: VersionHistoryEntry[];
  status: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
}
```

#### Import Matching

```typescript
interface ComponentMatch {
  incomingComponent: ParsedComponent;
  matchType: MatchType;
  matchedComponent?: LibraryComponent;
  similarity?: number;
  differences?: ComponentDiff[];
}

interface ParsedComponent {
  name: string;
  valueSetOid?: ValueSetOid;
  valueSetName?: string;
  timing?: TimingExpression;
  negation?: boolean;
  children?: ParsedComponent[];
  operator?: LogicalOperator;
}
```

---

## Key Services

### 1. Measure Evaluator (`src/services/measureEvaluator.ts`)

The validation engine that evaluates test patients against measure logic.

#### Main Entry Point

```typescript
export function evaluatePatient(
  patient: TestPatient,
  measure: UniversalMeasureSpec,
  measurementPeriod?: { start: string; end: string }
): PatientValidationTrace
```

#### Validation Flow

1. **Pre-checks** (always evaluated, never short-circuit):
   - Gender requirement check
   - Age requirement check

2. **Population Evaluation**:
   - Initial Population (IP) criteria
   - Denominator Exclusions
   - Numerator (only if IP met and not excluded)

#### Key Helper Functions

| Function | Purpose |
|----------|---------|
| `checkGenderRequirement()` | Validates patient gender against measure requirements |
| `checkAgeRequirement()` | Validates patient age during measurement period |
| `evaluatePopulation()` | Evaluates criteria groups recursively |
| `evaluateCriteriaGroup()` | Handles AND/OR logic for criteria |
| `evaluateDataElement()` | Matches patient data against single criterion |
| `generateCqlSnippet()` | Generates CQL representation of data element |
| `isScreeningMeasure()` | Detects screening measures for OR logic |

#### Validation Trace Output

```typescript
interface PatientValidationTrace {
  patientId: string;
  patientName: string;
  measureId: string;
  measureTitle: string;
  timestamp: string;
  populations: {
    initialPopulation: PopulationResult;
    denominator: PopulationResult;
    exclusions: PopulationResult;
    numerator: PopulationResult;
  };
  finalResult: 'numerator' | 'denominator_only' | 'excluded' | 'not_in_population';
  howClose?: string[];        // Reasons for failure (for debugging)
}

interface PopulationResult {
  met: boolean;
  nodes: ValidationNode[];
}

interface ValidationNode {
  id: string;
  title: string;
  type: 'decision' | 'condition' | 'procedure' | 'medication' | etc.;
  description: string;
  status: 'pass' | 'fail' | 'not_evaluated';
  cqlSnippet?: string;
  facts: FactMatch[];
}
```

### 2. OpenAI Service (`src/services/openaiService.ts`)

Handles AI-powered measure extraction from documents.

```typescript
export async function extractMeasureWithAI(
  content: string,
  apiKey: string
): Promise<UniversalMeasureSpec>
```

#### Process Flow

1. Document text extracted (PDF/DOCX parsing)
2. Text sent to GPT-4o with structured prompt
3. AI returns JSON matching UMS schema
4. Response validated and stored

### 3. CQL Generator (`src/services/cqlGenerator.ts`)

Generates CQL code from UMS.

```typescript
export function generateCQL(measure: UniversalMeasureSpec): string
```

#### Output Structure

```cql
library MeasureName version '1.0.0'

using QDM version '5.6'

valueset "Colonoscopy": 'urn:oid:2.16.840.1.113883.3.464.1003.108.12.1020'

parameter "Measurement Period" Interval<DateTime>

context Patient

define "Initial Population":
  AgeInYearsAt(date from end of "Measurement Period") >= 45
    and AgeInYearsAt(date from end of "Measurement Period") < 76

define "Denominator":
  "Initial Population"

define "Numerator":
  exists ["Procedure": "Colonoscopy"] P
    where P.relevantPeriod ends 10 years or less before end of "Measurement Period"
```

### 4. Complexity Calculator (`src/services/complexityCalculator.ts`)

Calculates objective complexity scores for library components.

**Atomic Scoring:**

| Factor | Weight |
|--------|--------|
| Base | 1 |
| Each timing clause | +1 |
| Negation ("without", "absence of") | +2 |

**Composite Scoring:**

| Factor | Weight |
|--------|--------|
| Sum of children's scores | (total) |
| AND operator | +1 per AND |
| OR operator | +0 |
| Nesting depth beyond 1 | +2 per level |

**Thresholds:** Low (1-3), Medium (4-7), High (8+)

```typescript
export function calculateAtomicComplexity(component: AtomicComponent): ComponentComplexity
export function calculateCompositeComplexity(
  component: CompositeComponent, library: ComponentLibrary
): ComponentComplexity
export function countTimingClauses(timing: TimingExpression): number
export function calculateNestingDepth(
  composite: CompositeComponent, library: ComponentLibrary
): number
```

### 5. Component Matcher (`src/services/componentMatcher.ts`)

Handles exact matching and similarity detection for component reuse.

**Matching Rules:**
- Atomic identity: Value Set OID + Version + Timing Expression + Negation (all must be 100% identical)
- Composite identity: Operator + exact same child component IDs/versions (order-independent for OR, order-dependent for AND)
- Similar matching (suggestions only): Same OID but different timing

```typescript
export function generateComponentHash(component: LibraryComponent): string
export function findExactMatch(
  incoming: ParsedComponent, library: ComponentLibrary
): LibraryComponent | null
export function findSimilarComponents(
  incoming: ParsedComponent, library: ComponentLibrary, threshold: number
): ComponentMatch[]
export function computeComponentDiff(
  a: LibraryComponent, b: ParsedComponent
): ComponentDiff[]
export function areComponentsIdentical(
  a: LibraryComponent, b: LibraryComponent
): boolean
```

**Note:** `findExactMatch` searches ALL components regardless of status (including archived), enabling import matching to detect pre-existing components even if they were auto-archived due to zero usage.

### 6. Component Library Service (`src/services/componentLibraryService.ts`)

CRUD operations for library components.

```typescript
// Creation
export function createAtomicComponent(params: CreateAtomicParams): AtomicComponent
export function createCompositeComponent(params: CreateCompositeParams): CompositeComponent

// Versioning
export function createNewVersion(
  componentId: ComponentId, changes: ComponentChanges, updatedBy: string
): VersionId
export function archiveVersion(
  componentId: ComponentId, versionId: VersionId, supersededBy: VersionId
): void

// Usage Tracking
export function getComponentUsage(componentId: ComponentId): MeasureReference[]
export function addUsageReference(componentId: ComponentId, measureRef: MeasureReference): void
export function removeUsageReference(componentId: ComponentId, measureId: string): void

// Queries
export function getComponentById(id: ComponentId): LibraryComponent | null
export function getComponentsByCategory(category: ComponentCategory): LibraryComponent[]
export function searchComponents(query: string): LibraryComponent[]
```

---

## Component Reference

### MeasureCreator (`src/components/measure/MeasureCreator.tsx`)

**Purpose:** Multi-step wizard for creating new measures

**Wizard Steps:**

| Step | ID | Description |
|------|----|-------------|
| 1 | `start` | Choose manual or AI-assisted creation |
| 2 | `ai_input` | Paste document text for AI extraction |
| 3 | `metadata` | Enter measure title, ID, description |
| 4 | `initial_pop` | Define denominator criteria (labeled "Denominator") |
| 5 | `numerator` | Define numerator criteria |
| 6 | `exclusions` | Define exclusion criteria |
| 7 | `review` | Review and create measure |

**Key State:**

```typescript
const [step, setStep] = useState<WizardStep>('start');
const [measure, setMeasure] = useState<Partial<UniversalMeasureSpec>>({});
```

### MeasureLibrary (`src/components/measure/MeasureLibrary.tsx`)

**Purpose:** Display measure list, handle file uploads with batch queue

**Key Features:**
- Drag-and-drop file upload
- AI extraction (always enabled)
- Measure card grid display
- Delete functionality
- Batch upload queue

**Batch Upload Queue:**

Uses ref-based state management to avoid stale closures in async processing loops:

```typescript
// Ref-based queue to prevent stale closure issues
const batchQueueRef = useRef<QueuedMeasure[]>([]);
const processingRef = useRef(false);
const batchCounterRef = useRef({ index: 0, total: 0 });

// Recursive processor - pops from ref queue, processes, calls itself
function processNext() {
  if (batchQueueRef.current.length === 0) {
    processingRef.current = false;
    return;
  }
  const next = batchQueueRef.current.shift();
  // ... process via ingestMeasureFiles, then recursively call processNext()
}
```

While a measure is processing, the UI shows:
- Progress indicator with "[2/3] Processing..." format
- List of queued items with remove buttons
- Drop zone at bottom for adding more files to queue

### UMSEditor (`src/components/measure/UMSEditor.tsx`)

**Purpose:** Full measure editing interface with component library integration

**Tabs:**
1. **Populations** - Edit IP, Denominator, Numerator, Exclusions
2. **Value Sets** - Manage code sets
3. **Test Patients** - Create/edit synthetic patients
4. **Validation** - Run validation harness
5. **Code Generation** - View/export CQL

**Component Library Integration:**

On mount, the editor:
1. Calls `linkMeasureComponents()` to connect measure DataElements to library components
2. Calls `recalculateUsage(measures)` with all measures to rebuild accurate usage counts
3. Auto-archives components with zero usage, auto-restores archived components that gain usage

```typescript
// Library integration in useEffect
useEffect(() => {
  if (measure) {
    linkMeasureComponents(measure);
    recalculateUsage(measures);
  }
}, [measure?.metadata?.measureId, measures.length]);
```

Each logic block displays:
- Library link indicator (linked or local)
- Complexity dots (○, ●●, or ●●●)
- "Used in X measures" badge for shared components

**Key Pattern - Population Display:**

```typescript
// Initial Population displayed as "Denominator"
const getPopulationLabel = (type: string) => {
  switch (type) {
    case 'initial_population': return 'Denominator';
    // ... other cases
  }
};
```

### ValidationTraceViewer (`src/components/validation/ValidationTraceViewer.tsx`)

**Purpose:** Display validation results with visual indicators

**Key Components:**

1. **SummaryPill** - Quick status indicators at top
2. **ValidationSection** - Container for population criteria
3. **ValidationNodeCard** - Individual criterion card

**Visual Status Indicators:**

```typescript
// Section-level status
<div className={`rounded-xl border p-5 ${
  resultPositive
    ? 'bg-[var(--success)]/5 border-[var(--success)]/30'  // Green
    : 'bg-[var(--bg-secondary)] border-[var(--border-light)]'  // Neutral
}`}>

// Header with icon
{resultPositive ? (
  <CheckCircle className="w-5 h-5 text-[var(--success)]" />
) : (
  <XCircle className="w-5 h-5 text-[var(--danger)]" />
)}
```

**Screening Measure Detection:**

```typescript
function isScreeningMeasure(measureTitle: string, measureId: string): boolean {
  const title = measureTitle.toLowerCase();
  const id = measureId?.toUpperCase() || '';

  // CMS130 - Colorectal Cancer Screening
  if (title.includes('colorectal') || id.includes('CMS130')) return true;
  // CMS124 - Cervical Cancer Screening
  if (title.includes('cervical') || id.includes('CMS124')) return true;
  // CMS125 - Breast Cancer Screening
  if (title.includes('breast') && title.includes('screen') || id.includes('CMS125')) return true;

  return false;
}
```

### LibraryBrowser (`src/components/library/LibraryBrowser.tsx`)

**Purpose:** Browse and filter reusable components in the library

**Key Features:**
- Category sidebar navigation
- Search input + status/complexity/archived filters
- Component card grid with complexity dots, status badges, usage counts
- Archived components rendered with `opacity-50 grayscale` CSS classes
- Calls `recalculateUsage(measures)` on mount to ensure accurate usage counts

### ComponentEditor (`src/components/library/ComponentEditor.tsx`)

**Purpose:** Edit atomic or composite components with shared edit protection

**Shared Edit Flow:**
```typescript
function handleSave() {
  // Check if component is shared
  if (existingComponent.usage.usageCount > 1) {
    setPendingChanges(changes);
    setShowSharedWarning(true);  // Show SharedEditWarning modal
    return;
  }
  // Direct save for single-use components
  saveComponent(changes);
}
```

When "Update All" is chosen:
1. `handleSharedEdit()` updates the component in the library store
2. `syncComponentToMeasures()` walks all affected measures' criteria trees
3. Finds DataElements with matching `libraryComponentId`
4. Updates description, timing, negation on each matched element
5. `recalculateUsage()` refreshes all usage counts

### SharedEditWarning (`src/components/library/SharedEditWarning.tsx`)

**Purpose:** Modal warning when editing a component used in multiple measures

**Props:**
- `component: LibraryComponent` - the component being edited
- `affectedMeasures: MeasureReference[]` - list of affected measures
- `onUpdateAll: () => void` - update all measures handler
- `onCreateCopy: () => void` - create new version handler
- `onCancel: () => void` - cancel handler

### ImportMatcher (`src/components/library/ImportMatcher.tsx`)

**Purpose:** Panel shown during measure import to match parsed components against library

**Sections:**
1. **Library Matches Found** - Exact matches and similar components with link/keep-new actions
2. **New Components** - Unmatched components with category selector and add-to-library option

---

## State Management

### Zustand Stores

#### measureStore (`src/stores/measureStore.ts`)

```typescript
interface MeasureStore {
  measures: UniversalMeasureSpec[];
  selectedMeasureId: string | null;

  // Actions
  addMeasure: (measure: UniversalMeasureSpec) => void;
  updateMeasure: (id: string, updates: Partial<UniversalMeasureSpec>) => void;
  deleteMeasure: (id: string) => void;
  selectMeasure: (id: string | null) => void;
}
```

#### patientStore (`src/stores/patientStore.ts`)

```typescript
interface PatientStore {
  patients: Record<string, TestPatient[]>;  // Keyed by measure ID

  // Actions
  addPatient: (measureId: string, patient: TestPatient) => void;
  updatePatient: (measureId: string, patientId: string, updates: Partial<TestPatient>) => void;
  deletePatient: (measureId: string, patientId: string) => void;
}
```

#### componentLibraryStore (`src/stores/componentLibraryStore.ts`)

```typescript
interface ComponentLibraryStore {
  components: Record<ComponentId, LibraryComponent>;
  categories: CategoryGroup[];
  filters: LibraryBrowserFilters;
  selectedComponentId: ComponentId | null;
  editingComponent: LibraryComponent | null;
  importState: ImportMatcherState | null;

  // Actions
  loadLibrary: () => void;
  saveLibrary: () => void;
  addComponent: (payload: AddComponentPayload) => ComponentId;
  updateComponent: (payload: UpdateComponentPayload) => void;
  archiveComponent: (payload: ArchiveComponentPayload) => void;
  setFilters: (filters: Partial<LibraryBrowserFilters>) => void;
  selectComponent: (id: ComponentId | null) => void;
  handleSharedEdit: (decision: EditDecision) => void;

  // Cross-store operations
  recalculateUsage: (measures: UniversalMeasureSpec[]) => void;
  syncComponentToMeasures: (
    componentId: ComponentId,
    changes: ComponentChanges,
    measures: UniversalMeasureSpec[],
    updateMeasure: (id: string, updates: Partial<UniversalMeasureSpec>) => void
  ) => void;

  // Selectors
  getFilteredComponents: () => LibraryComponent[];
  getComponentsByStatus: (status: ApprovalStatus) => LibraryComponent[];
  getUsageCount: (componentId: ComponentId) => number;
}
```

**Key Operations:**

`recalculateUsage(measures)`:
1. Resets ALL component usage to `{ measureIds: [], usageCount: 0 }`
2. Walks every measure's populations → criteria tree → data elements
3. For each element with `libraryComponentId`, adds that measure's ID to the component's usage
4. Auto-archives components with `usageCount === 0`
5. Auto-restores archived components that gain usage (reverts to previous non-archived status)

`syncComponentToMeasures(componentId, changes, measures, updateMeasure)`:
1. Finds all measures with DataElements whose `libraryComponentId` matches
2. Updates those DataElements with new description, timing, negation values
3. Calls `updateMeasure()` on each affected measure

**Persistence:** `localStorage` key `ums-component-library`, loaded on initialization, saved after each mutation.

**Default Filters:** `showArchived: true` (archived components visible but greyed out).

#### settingsStore (`src/stores/settingsStore.ts`)

```typescript
interface SettingsStore {
  openAIKey: string | null;
  theme: 'light' | 'dark' | 'system';

  // Actions
  setOpenAIKey: (key: string | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}
```

### Persistence

All stores use Zustand's `persist` middleware with `localStorage`:

```typescript
export const useMeasureStore = create<MeasureStore>()(
  persist(
    (set) => ({
      // ... state and actions
    }),
    { name: 'measure-storage' }
  )
);
```

---

## API Integration

### OpenAI API

**Endpoint:** `https://api.openai.com/v1/chat/completions`

**Model:** `gpt-4o`

**Request Format:**

```typescript
{
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: EXTRACTION_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: `Extract the quality measure from this document:\n\n${documentText}`
    }
  ],
  response_format: { type: 'json_object' }
}
```

**Authentication:** API key stored in settingsStore, passed in Authorization header.

---

## Validation Engine Details

### CQL Snippet Generation with Lookback Periods

The validation engine generates accurate CQL snippets that reflect clinical guidelines:

| Procedure Type | Lookback Period |
|---------------|-----------------|
| Colonoscopy | 10 years |
| Flexible Sigmoidoscopy | 5 years |
| CT Colonography | 5 years |
| FIT-DNA (Cologuard) | 3 years |
| FOBT / FIT | 1 year |
| Pap Test | 3 years |
| HPV Test | 5 years |
| Mammography | 2 years |

**Implementation:**

```typescript
function generateCqlSnippet(element: DataElement): string {
  const vsName = element.valueSet?.name || 'Value Set';
  let timingClause = 'during "Measurement Period"';

  // Detect screening procedure types
  const descLower = element.description?.toLowerCase() || '';
  const vsLower = vsName.toLowerCase();

  if (vsLower.includes('colonoscopy') || descLower.includes('colonoscopy')) {
    timingClause = '10 years or less before end of "Measurement Period"';
  }
  // ... other procedure types

  return `["Procedure": "${vsName}"] P where P.performed ${timingClause}`;
}
```

### Pre-check Evaluation (No Early Return)

The validation engine always evaluates ALL criteria to provide complete visibility:

```typescript
// OLD (problematic - early return hides criteria)
if (!genderCheck.met) {
  return { met: false, nodes: [genderNode] };  // Hides age check!
}

// NEW (correct - collect all, then combine)
const ipPreCheckNodes: ValidationNode[] = [];
let ipPreChecksPassed = true;

// Gender check
const genderCheck = checkGenderRequirement(patient, measure);
if (genderCheck.hasGenderRequirement) {
  ipPreCheckNodes.push(genderNode);
  if (!genderCheck.met) ipPreChecksPassed = false;
}

// Age check (ALWAYS evaluated)
const ageCheck = checkAgeRequirement(patient, measure, mpStart, mpEnd);
if (ageReqs || ageCheck.ageInfo) {
  ipPreCheckNodes.push(ageNode);
  if (!ageCheck.met) ipPreChecksPassed = false;
}

// Combine all nodes
return {
  met: ipPreChecksPassed && ipMeasureCriteria.met,
  nodes: [...ipPreCheckNodes, ...ipMeasureCriteria.nodes]
};
```

---

## CQL Generation

### CQL Generator Service (`src/services/cqlGenerator.ts`)

**Purpose**: Generate Clinical Quality Language (CQL) from Universal Measure Spec (UMS)

**Main Function**:

```typescript
export function generateCQL(measure: UniversalMeasureSpec): CQLGenerationResult {
  // Returns { success, cql, errors, warnings, metadata }
}
```

**Features**:

| Feature | Description |
|---------|-------------|
| Full Library Structure | FHIR R4, QI-Core, eCQM aligned |
| Value Set Declarations | VSAC canonical URLs with OIDs |
| Population Definitions | IP, Denominator, Exclusions, Numerator |
| Measure-Specific Helpers | CRC, Cervical, Breast cancer screening |
| CQL Validation | Integration with CQL Services API |

**Generated CQL Structure**:

```cql
library MeasureName version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers
include QICoreCommon version '2.0.0' called QICoreCommon
include MATGlobalCommonFunctions version '7.0.000' called Global

// Value Sets
valueset "Colonoscopy": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.108.12.1020'

parameter "Measurement Period" Interval<DateTime>

context Patient

define "Initial Population":
  AgeInYearsAt(date from end of "Measurement Period") in Interval[45, 75]

define "Denominator":
  "Initial Population"

define "Denominator Exclusion":
  "Has Hospice Services"
    or "Has Colorectal Cancer"
    or "Has Total Colectomy"

define "Numerator":
  exists "Colonoscopy Performed"
    or exists "Fecal Occult Blood Test Performed"
    ...
```

**CQL Validation**:

```typescript
// Validate CQL syntax via CQL Services API
export async function validateCQL(
  cql: string,
  serviceUrl: string = 'http://localhost:8080'
): Promise<CQLValidationResult>

// Check if CQL Services is available
export async function isCQLServiceAvailable(
  serviceUrl: string = 'http://localhost:8080'
): Promise<boolean>
```

**Running CQL Services Locally**:

```bash
docker run -p 8080:8080 cqframework/cql-translation-service
```

---

## Deployment

### Vercel Configuration

**Production URL:** https://measure-accelerator.vercel.app/

**Build Command:** `npm run build`

**Output Directory:** `dist`

**Environment Variables:**
- None required (API keys stored client-side)

### GitHub Repository

**URL:** https://github.com/Haaaz3/MeasureAccelerator

**Branch Strategy:**
- `main` - Production branch, auto-deploys to Vercel

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Future Enhancements

### 1. CQL Validation via CQL Services API

**Priority:** High (recommended next feature)

**Description:** Integrate CQL-to-ELM translation service to validate generated CQL syntax before export.

**Implementation Approach:**

1. Deploy CQL Services via Docker:
   ```bash
   docker run -p 8080:8080 cqframework/cql-translation-service
   ```

2. Add validation endpoint call:
   ```typescript
   async function validateCQL(cqlCode: string): Promise<ValidationResult> {
     const response = await fetch('http://localhost:8080/cql/translator', {
       method: 'POST',
       headers: { 'Content-Type': 'application/cql' },
       body: cqlCode
     });
     return response.json();
   }
   ```

3. Display validation errors in UI before allowing export.

**Estimated Effort:** 1-2 days

### 2. FHIR Export

**Description:** Export measures as FHIR Measure resources for interoperability.

### 3. Batch Patient Validation

**Description:** Upload CSV of test patients and run bulk validation.

### 4. Measure Versioning

**Description:** Track changes to measures over time with diff view.

### 5. Value Set Import from VSAC

**Description:** Direct integration with Value Set Authority Center for code set import.

---

## Appendix: Code Location Reference

| Feature | Primary File | Key Functions/Components |
|---------|-------------|-------------------------|
| Measure validation | `src/services/measureEvaluator.ts` | `evaluatePatient()`, `evaluatePopulation()` |
| AI extraction | `src/services/openaiService.ts` | `extractMeasureWithAI()` |
| CQL generation | `src/services/cqlGenerator.ts` | `generateCQL()` |
| Complexity scoring | `src/services/complexityCalculator.ts` | `calculateAtomicComplexity()`, `calculateCompositeComplexity()` |
| Component matching | `src/services/componentMatcher.ts` | `findExactMatch()`, `generateComponentHash()` |
| Component CRUD | `src/services/componentLibraryService.ts` | `createAtomicComponent()`, `createNewVersion()` |
| Measure creation wizard | `src/components/measure/MeasureCreator.tsx` | `MeasureCreator` component |
| Measure editing + library | `src/components/measure/UMSEditor.tsx` | `UMSEditor` component |
| Measure list + batch upload | `src/components/measure/MeasureLibrary.tsx` | `MeasureLibrary` component |
| Library browser | `src/components/library/LibraryBrowser.tsx` | `LibraryBrowser` component |
| Component editing | `src/components/library/ComponentEditor.tsx` | `ComponentEditor` component |
| Shared edit warning | `src/components/library/SharedEditWarning.tsx` | `SharedEditWarning` modal |
| Import matching | `src/components/library/ImportMatcher.tsx` | `ImportMatcher` component |
| Validation display | `src/components/validation/ValidationTraceViewer.tsx` | `ValidationTraceViewer`, `ValidationSection` |
| Measure state | `src/stores/measureStore.ts` | Zustand store |
| Component library state | `src/stores/componentLibraryStore.ts` | `recalculateUsage()`, `syncComponentToMeasures()` |
| UMS types | `src/types/measure.ts` | Core TypeScript interfaces |
| Library types | `src/types/componentLibrary.ts` | Component library interfaces |
| Sample library data | `src/data/sampleLibraryData.ts` | Pre-seeded component data |

---

## Contact

For questions about this specification, contact the product team or refer to the [Product Specification](./PRODUCT_SPECIFICATION.md) for business context.
