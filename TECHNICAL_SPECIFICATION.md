# MeasureAccelerator Technical Specification

**Version:** 2.0
**Last Updated:** January 30, 2026
**Purpose:** Developer handoff documentation for MeasureAccelerator platform

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Core Data Models](#core-data-models) (incl. Component Library, ValidationNode tree)
5. [Key Services](#key-services) (incl. Complexity Calculator, Component Matcher, AI Extractor, Library Service)
6. [Component Reference](#component-reference) (incl. Library UI, Batch Upload, Operator Badges, Logic Selector)
7. [State Management](#state-management) (incl. componentLibraryStore, measureStore)
8. [API Integration](#api-integration)
9. [Validation Engine](#validation-engine) (incl. nested group nodes, operator separators)
10. [CQL Generation](#cql-generation)
11. [Deployment](#deployment)
12. [Future Enhancements](#future-enhancements)

---

## Project Overview

MeasureAccelerator is a healthcare quality measure development platform that enables measure stewards to:

- **Ingest** measure specifications (PDFs, Word documents) using AI-powered extraction with automatic AND/OR logic grouping
- **Edit** measures using a structured Universal Measure Specification (UMS) format with interactive operator badges
- **Validate** measure logic against synthetic test patients with nested validation tree views
- **Export** measures as CQL (Clinical Quality Language) or FHIR resources
- **Reuse** components via a shared library with bidirectional code synchronization

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
│   │   ├── UMSEditor.tsx         # Full measure editor + library integration + operator badges
│   │   └── ComponentBuilder.tsx  # Add component dialog with logic operator selector
│   ├── library/           # Component library UI
│   │   ├── LibraryBrowser.tsx    # Library browser with filters and search
│   │   ├── ComponentDetail.tsx   # Component detail panel with codes table
│   │   ├── ComponentEditor.tsx   # Component editor with shared edit warning + codes editing
│   │   ├── SharedEditWarning.tsx # Modal for shared component edits
│   │   ├── ImportMatcher.tsx     # Import matching panel
│   │   └── index.ts              # Barrel export
│   ├── validation/        # Test validation components
│   │   └── ValidationTraceViewer.tsx  # Nested validation tree with operator separators
│   ├── settings/          # Application settings
│   └── layout/            # Navigation, headers
├── services/
│   ├── measureEvaluator.ts       # Core validation engine (nested group nodes)
│   ├── aiExtractor.ts            # AI extraction with AND/OR post-processing
│   ├── openaiService.ts          # AI extraction service (OpenAI API)
│   ├── cqlGenerator.ts           # CQL code generation
│   ├── complexityCalculator.ts   # Component complexity scoring (zero-codes penalty)
│   ├── componentMatcher.ts       # Exact match + name-based fallback matching
│   └── componentLibraryService.ts # Component CRUD with codes support
├── stores/
│   ├── measureStore.ts           # Measure state + addComponentToPopulation with operator
│   ├── componentLibraryStore.ts  # Component library state + code sync
│   ├── patientStore.ts           # Test patient state
│   └── settingsStore.ts          # App settings state
├── data/
│   └── sampleLibraryData.ts      # Sample component library data
├── types/
│   ├── ums.ts                    # Core UMS types (ValidationNode with children/operator)
│   ├── fhir-measure.ts           # FHIR R4 Measure resource types
│   └── componentLibrary.ts       # Component library type definitions
└── utils/
    ├── valueSetUtils.ts          # Value set helpers
    ├── constraintSync.ts         # Age constraint synchronization
    └── measureMigration.ts       # Measure schema migration
```

---

## Core Data Models

### Universal Measure Specification (UMS)

Located in `src/types/ums.ts`. FHIR R4 and QI-Core aligned.

```typescript
interface UniversalMeasureSpec {
  id: string;
  resourceType?: 'Measure';
  metadata: MeasureMetadata;
  populations: PopulationDefinition[];
  valueSets: ValueSetReference[];
  stratifiers?: Stratifier[];
  supplementalData?: SupplementalData[];
  attribution?: AttributionRule;
  globalConstraints?: GlobalConstraints;
  cqlLibrary?: EmbeddedCQLLibrary;
  status: MeasureStatus;
  overallConfidence: ConfidenceLevel;
  reviewProgress: { total: number; approved: number; pending: number; flagged: number };
  // Audit trail, lock, generated artifacts, corrections...
}
```

#### Population Definitions

```typescript
interface PopulationDefinition {
  id: string;
  type: PopulationType;
  description: string;
  narrative: string;
  criteria: LogicalClause;        // Structured criteria tree
  expression?: Expression;         // FHIR Expression reference
  confidence: ConfidenceLevel;
  reviewStatus: ReviewStatus;
}
```

#### Logical Clauses (Criteria Tree)

```typescript
interface LogicalClause {
  id: string;
  operator: LogicalOperator;       // 'AND' | 'OR' | 'NOT'
  description: string;
  children: (DataElement | LogicalClause)[];  // Recursive nesting
  confidence: ConfidenceLevel;
  reviewStatus: ReviewStatus;
  cqlSnippet?: string;
}
```

#### Data Elements

```typescript
interface DataElement {
  id: string;
  type: DataElementType;           // 'diagnosis' | 'encounter' | 'procedure' | ...
  resourceType?: QICoreResourceType;
  description: string;

  valueSet?: ValueSetReference;    // Value set with codes
  directCodes?: CodeReference[];   // Direct codes (no value set)

  thresholds?: {                   // Age, lab values, etc.
    ageMin?: number; ageMax?: number;
    valueMin?: number; valueMax?: number;
    unit?: string; comparator?: string;
  };

  timingRequirements?: TimingRequirement[];
  additionalRequirements?: string[];
  negation?: boolean;
  negationRationale?: string;

  confidence: ConfidenceLevel;
  reviewStatus: ReviewStatus;

  libraryComponentId?: string;     // Link to component library
  ingestionWarning?: string;       // Warning from ingestion (e.g., zero codes)
}
```

#### Value Sets and Codes

```typescript
interface ValueSetReference {
  id: string;
  oid?: string;                    // VSAC OID
  url?: string;                    // FHIR canonical URL
  name: string;
  version?: string;
  codes: CodeReference[];          // Actual codes in the value set
  totalCodeCount?: number;
  confidence: ConfidenceLevel;
  verified?: boolean;
}

interface CodeReference {
  code: string;                    // e.g., "45378"
  display: string;                 // e.g., "Colonoscopy, diagnostic"
  system: CodeSystem;              // 'ICD10' | 'CPT' | 'SNOMED' | etc.
  systemUri?: string;              // FHIR canonical URL
  version?: string;
}
```

#### Validation Types

```typescript
interface ValidationNode {
  id: string;
  title: string;
  type: PopulationType | 'decision' | 'collector';
  description: string;
  status: 'pass' | 'fail' | 'not_applicable' | 'partial';
  facts: ValidationFact[];
  cqlSnippet?: string;
  source?: string;
  children?: ValidationNode[];     // For group nodes: nested children
  operator?: LogicalOperator;      // For group nodes: connecting operator
}

interface PatientValidationTrace {
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
```

### Component Library Data Model

Located in `src/types/componentLibrary.ts`.

#### Core Types

```typescript
type ComponentId = string;
type VersionId = string;
type ValueSetOid = string;
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
  valueSet: {
    oid: ValueSetOid;
    version: string;
    name: string;
    codes?: CodeReference[];       // Codes stored directly on component
  };
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
  base: number;
  timingClauses: number;
  negations: number;
  zeroCodes?: boolean;             // True if component has no codes (forces medium+)
  childrenSum?: number;
  andOperators?: number;
  nestingDepth?: number;
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

---

## Key Services

### 1. Measure Evaluator (`src/services/measureEvaluator.ts`)

The validation engine that evaluates test patients against measure logic. Produces a nested ValidationNode tree that mirrors the UMS criteria structure.

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

#### Nested Clause Evaluation

The `evaluateClause` function preserves the criteria tree structure by producing group `ValidationNode` objects for nested `LogicalClause` children:

```typescript
function evaluateClause(
  patient: TestPatient,
  clause: LogicalClause,
  measure: UniversalMeasureSpec,
  mpStart: string,
  mpEnd: string
): { met: boolean; childNodes: ValidationNode[]; matchCount?: { met: number; total: number } }
```

When encountering a nested `LogicalClause` child, instead of flattening (`childNodes.push(...nestedNodes)`), the evaluator creates a group node:

```typescript
if ('operator' in child) {
  const nestedClause = child as LogicalClause;
  const { met, childNodes: nestedNodes, matchCount } = evaluateClause(
    patient, nestedClause, measure, mpStart, mpEnd
  );
  const groupNode: ValidationNode = {
    id: nestedClause.id,
    title: nestedClause.description || `${nestedClause.operator} Group`,
    type: 'collector',
    description: nestedClause.description || '',
    status: met ? 'pass' : matchCount?.met > 0 ? 'partial' : 'fail',
    facts: matchCount ? [{ code: 'GROUP_MATCH', display: `${matchCount.met} of ${matchCount.total} criteria met` }] : [],
    children: nestedNodes,
    operator: nestedClause.operator,
  };
  childNodes.push(groupNode);
}
```

This ensures the validation viewer can render the same AND/OR tree structure as the UMS editor.

#### Key Helper Functions

| Function | Purpose |
|----------|---------|
| `checkGenderRequirement()` | Validates patient gender against measure requirements |
| `checkAgeRequirement()` | Validates patient age during measurement period |
| `evaluatePopulation()` | Evaluates criteria groups recursively |
| `evaluateClause()` | Handles AND/OR/NOT logic with nested group nodes |
| `evaluateDataElement()` | Matches patient data against single criterion |
| `generateCqlSnippet()` | Generates CQL representation of data element |

#### Pre-check Evaluation (No Early Return)

The validation engine always evaluates ALL criteria to provide complete visibility:

```typescript
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

### 2. AI Extractor (`src/services/aiExtractor.ts`)

Handles AI-powered measure extraction from documents with automatic AND/OR logic post-processing.

#### AND/OR Auto-Grouping

After AI extraction, the extractor post-processes criteria to correctly group encounter elements:

```typescript
// Post-process: group sibling encounter elements into OR subclause
// When 3+ encounter-type elements are siblings in an AND clause, they are almost
// certainly alternatives (Office Visit OR Annual Wellness OR Preventive Care), not
// requirements (patient does NOT need every encounter type).
const topOperator = (pop.logicOperator || 'AND') as LogicalOperator;

if (topOperator === 'AND') {
  const encounterChildren = children.filter(c => c.type === 'encounter');
  const nonEncounterChildren = children.filter(c => c.type !== 'encounter');

  if (encounterChildren.length >= 3) {
    const orClause: LogicalClause = {
      id: `${popType}-enc-or-${idx}`,
      operator: 'OR',
      description: 'Qualifying Encounters',
      confidence: 'high',
      reviewStatus: 'approved',
      children: encounterChildren,
    };
    finalChildren = [...nonEncounterChildren, orClause];
  }
}
```

Also handles AI-provided `nestedGroups` with explicit `groupOperator` and `criteriaIndices`.

### 3. OpenAI Service (`src/services/openaiService.ts`)

Handles the OpenAI API call for extraction.

```typescript
export async function extractMeasureWithAI(
  content: string,
  apiKey: string
): Promise<UniversalMeasureSpec>
```

**Process:** Document text → GPT-4o with structured prompt → JSON UMS response → Validation → Post-processing (AND/OR grouping).

### 4. CQL Generator (`src/services/cqlGenerator.ts`)

Generates CQL code from UMS.

```typescript
export function generateCQL(measure: UniversalMeasureSpec): CQLGenerationResult
// Returns { success, cql, errors, warnings, metadata }
```

**Generated CQL Structure:**

```cql
library MeasureName version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers
include QICoreCommon version '2.0.0' called QICoreCommon
include MATGlobalCommonFunctions version '7.0.000' called Global

valueset "Colonoscopy": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.108.12.1020'

parameter "Measurement Period" Interval<DateTime>
context Patient

define "Initial Population":
  AgeInYearsAt(date from end of "Measurement Period") in Interval[45, 75]

define "Denominator":
  "Initial Population"

define "Denominator Exclusion":
  "Has Hospice Services" or "Has Colorectal Cancer" or "Has Total Colectomy"

define "Numerator":
  exists "Colonoscopy Performed" or exists "Fecal Occult Blood Test Performed"
```

**CQL Validation:**

```typescript
export async function validateCQL(cql: string, serviceUrl?: string): Promise<CQLValidationResult>
export async function isCQLServiceAvailable(serviceUrl?: string): Promise<boolean>
```

### 5. Complexity Calculator (`src/services/complexityCalculator.ts`)

Calculates objective complexity scores for library components.

**Atomic Scoring:**

| Factor | Weight |
|--------|--------|
| Base | 1 |
| Each timing clause | +1 |
| Negation | +2 |
| **Zero codes penalty** | **Floor at 4 (medium)** |

**Zero-Codes Protection:** Components with zero codes cannot be scored as low complexity. The score is floored at 4 (medium), preventing auto-approval. Demographics are exempt.

```typescript
export function calculateAtomicComplexity(
  component: Omit<AtomicComponent, 'complexity'>
): ComponentComplexity {
  const base = 1;
  const timingClauses = countTimingClauses(component.timing);
  const negationScore = component.negation ? 2 : 0;

  // Zero codes → floor at medium
  const codeCount = component.valueSet?.codes?.length ?? 0;
  const zeroCodes = codeCount === 0;
  const zeroCodesPenalty = zeroCodes ? 4 : 0;

  const score = Math.max(base + timingClauses + negationScore, zeroCodesPenalty);
  // ...
}
```

**DataElement-level complexity** also applies the zero-codes penalty:

```typescript
export function calculateDataElementComplexity(element: DataElement): ComponentComplexity {
  // ...
  const codeCount = (element.valueSet?.codes?.length ?? 0) + (element.directCodes?.length ?? 0);
  if (codeCount === 0 && element.type !== 'demographic') {
    score = Math.max(score, 4);  // Floor at medium
  }
}
```

**Composite Scoring:**

| Factor | Weight |
|--------|--------|
| Sum of children's scores | (total) |
| AND operator | +1 per AND connection |
| OR operator | +0 |
| Nesting depth beyond 1 | +2 per level |

**Thresholds:** Low (1-3), Medium (4-7), High (8+)

### 6. Component Matcher (`src/services/componentMatcher.ts`)

Handles exact matching and similarity detection for component reuse. Uses a two-tier matching strategy.

**Tier 1 - Hash-Based Exact Match:**

- Atomic identity: Value Set OID + Timing Expression + Negation → djb2 hash
- Composite identity: Sorted child component IDs + operator → djb2 hash
- 100% identical hash required

**Tier 2 - Name-Based Fallback Match:**

When OID-based matching fails (different OID or no OID from AI extractor), falls back to name matching:

```typescript
export function findNameMatch(
  incoming: ParsedComponent,
  library: Record<string, LibraryComponent>
): LibraryComponent | null {
  // Only for atomic components
  // Compares: normalized value set name + timing operator + timing reference + negation
}
```

Name normalization: lowercase, trim, strip " value set" suffix, collapse whitespace.

```typescript
function normalizeValueSetName(name: string): string {
  return name.toLowerCase().trim()
    .replace(/\s+value\s*set$/i, '')
    .replace(/\s+/g, ' ');
}
```

**`findExactMatch` flow:**

1. Generate hash for incoming parsed component
2. Compare against all library component hashes
3. For composites: resolve library children and compare atomic identity hashes
4. **Fallback:** call `findNameMatch()` if no hash match found

**Note:** `findExactMatch` searches ALL components regardless of status (including archived), enabling import matching to detect pre-existing components even if auto-archived.

### 7. Component Library Service (`src/services/componentLibraryService.ts`)

CRUD operations for library components with codes support.

```typescript
export interface CreateAtomicParams {
  name: string;
  description?: string;
  valueSet: {
    oid: string;
    version: string;
    name: string;
    codes?: CodeReference[];       // Codes passed at creation time
  };
  timing: TimingExpression;
  negation: boolean;
  category: ComponentCategory;
  tags?: string[];
}

export function createAtomicComponent(params: CreateAtomicParams): AtomicComponent
export function createCompositeComponent(params: CreateCompositeParams): CompositeComponent
export function createNewVersion(componentId: ComponentId, changes: ComponentChanges, updatedBy: string): VersionId
export function getComponentUsage(componentId: ComponentId): MeasureReference[]
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
const batchQueueRef = useRef<QueuedMeasure[]>([]);
const processingRef = useRef(false);
const batchCounterRef = useRef({ index: 0, total: 0 });

function processNext() {
  if (batchQueueRef.current.length === 0) {
    processingRef.current = false;
    return;
  }
  const next = batchQueueRef.current.shift();
  // ... process via ingestMeasureFiles, then recursively call processNext()
}
```

### UMSEditor (`src/components/measure/UMSEditor.tsx`)

**Purpose:** Full measure editing interface with component library integration, interactive operator badges, and description cleaning.

**Tabs:**
1. **Populations** - Edit IP, Denominator, Numerator, Exclusions
2. **Value Sets** - Manage code sets
3. **Test Patients** - Create/edit synthetic patients
4. **Validation** - Run validation harness
5. **Code Generation** - View/export CQL

**Component Library Integration:**

On mount, the editor:
1. Calls `linkMeasureComponents()` to connect measure DataElements to library components
2. Calls `recalculateUsage(measures)` to rebuild accurate usage counts
3. Auto-archives components with zero usage, auto-restores archived components that gain usage

Each logic block displays:
- Library link indicator (linked or local)
- Complexity dots
- "Used in X measures" badge for shared components

**Operator Badges (Inter-Sibling):**

Between each pair of sibling elements in a clause, the editor renders a clickable operator badge showing the parent clause's operator:

```tsx
{clause.children.map((child, i) => (
  <Fragment key={child.id}>
    {renderChild(child)}
    {i < clause.children.length - 1 && (
      <div className="flex justify-center my-1">
        <button onClick={() => toggleLogicalOperator(measureId, clause.id)}
                className={`px-2 py-0.5 rounded font-mono text-[10px] ...`}>
          {clause.operator}
        </button>
      </div>
    )}
  </Fragment>
))}
```

Clicking any operator badge toggles the parent clause between AND and OR.

**Description Cleaning:**

A `cleanDescription()` helper strips standalone AND/OR/NOT line separators from element descriptions before rendering:

```typescript
function cleanDescription(desc: string | undefined): string {
  if (!desc) return '';
  return desc
    .replace(/\n\s*(AND|OR|NOT)\s*\n/gi, ' ')
    .replace(/\n\s*(AND|OR|NOT)\s*$/gi, '')
    .replace(/^\s*(AND|OR|NOT)\s*\n/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
```

This prevents descriptions like "Women with mammograms OR Women with mammogram screening" from displaying the raw logical operator text.

### ComponentBuilder (`src/components/measure/ComponentBuilder.tsx`)

**Purpose:** Dialog for adding new components to a population, with logic operator selection.

**Logic Operator Selector:**

When adding a component, the user must choose how it connects logically:

```typescript
const [logicOperator, setLogicOperator] = useState<'AND' | 'OR'>('AND');

// UI: AND/OR button group
<div className="flex gap-2">
  <button onClick={() => setLogicOperator('AND')}
          className={logicOperator === 'AND' ? 'active' : ''}>AND</button>
  <button onClick={() => setLogicOperator('OR')}
          className={logicOperator === 'OR' ? 'active' : ''}>OR</button>
</div>

// On save:
onSave(component, newValueSet, logicOperator);
```

### ValidationTraceViewer (`src/components/validation/ValidationTraceViewer.tsx`)

**Purpose:** Display validation results with nested tree structure that mirrors the UMS editor.

**Key Components:**

1. **SummaryPill** - Quick status indicators at top
2. **ValidationSection** - Container for population criteria, uses recursive `ValidationNodeList`
3. **ValidationNodeList** - Recursive renderer for `ValidationNode[]` with operator separators
4. **OperatorSeparator** - Visual AND/OR badge between sibling validation nodes
5. **ValidationNodeCard** - Individual criterion card

**OperatorSeparator:**

```typescript
function OperatorSeparator({ operator }: { operator: 'AND' | 'OR' | string }) {
  return (
    <div className="flex items-center gap-2 ml-4 my-1">
      <div className="w-px h-3 bg-[var(--border)]" />
      <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${
        operator === 'OR'
          ? 'bg-blue-500/15 text-blue-400'
          : 'bg-amber-500/15 text-amber-400'
      }`}>{operator}</span>
      <div className="w-px h-3 bg-[var(--border)]" />
    </div>
  );
}
```

**Recursive ValidationNodeList:**

Handles both leaf nodes and group nodes (those with `children`):

```typescript
function ValidationNodeList({ nodes, operator, onInspect }: {
  nodes?: ValidationNode[];
  operator: string;
  onInspect?: (node: ValidationNode) => void;
}) {
  return nodes?.map((node, i) => (
    <Fragment key={node.id}>
      {node.children ? (
        // Group node — render header + recursive children
        <div className="...">
          <h4>{cleanDescription(node.title)}</h4>
          <ValidationNodeList nodes={node.children} operator={node.operator || 'AND'} />
        </div>
      ) : (
        // Leaf node — render card
        <ValidationNodeCard node={node} />
      )}
      {i < nodes.length - 1 && <OperatorSeparator operator={operator} />}
    </Fragment>
  ));
}
```

**Description Cleaning:** Same `cleanDescription()` helper is applied to all `node.title` and `node.description` renders.

### LibraryBrowser (`src/components/library/LibraryBrowser.tsx`)

**Purpose:** Browse and filter reusable components in the library

**Key Features:**
- Category sidebar navigation
- Search input + status/complexity/archived filters
- Component card grid with complexity dots, status badges, usage counts
- Archived components rendered with `opacity-50 grayscale` CSS classes
- Calls `recalculateUsage(measures)` on mount

### ComponentDetail (`src/components/library/ComponentDetail.tsx`)

**Purpose:** Component detail panel with codes table

**Codes Display (Atomic Components):**
- Header: "Codes (N)" with count
- Table: Code | Display | System columns
- Zero codes: red warning "No codes defined for this component"
- 10+ codes: first 10 shown with "Show all (N)" toggle

### ComponentEditor (`src/components/library/ComponentEditor.tsx`)

**Purpose:** Edit atomic or composite components with shared edit protection and codes editing

**Codes Editing:**
- Table of existing codes (code, display, system) with delete button per row
- "Add Code" button adds empty editable row
- System dropdown: CPT, ICD10, SNOMED, HCPCS, LOINC, RxNorm, CVX
- Saves include codes in the component update
- When saving, codes sync to all linked measures via `syncComponentToMeasures`

**Shared Edit Flow:**

```typescript
function handleSave() {
  if (existingComponent.usage.usageCount > 1) {
    setPendingChanges(changes);
    setShowSharedWarning(true);  // Show SharedEditWarning modal
    return;
  }
  saveComponent(changes);
}
```

When "Update All" is chosen:
1. `handleSharedEdit()` updates the component in the library store
2. `syncComponentToMeasures()` walks all affected measures' criteria trees
3. Finds DataElements with matching `libraryComponentId`
4. Updates description, timing, negation, and **codes** on each matched element

### SharedEditWarning (`src/components/library/SharedEditWarning.tsx`)

**Purpose:** Modal warning when editing a component used in multiple measures

### ImportMatcher (`src/components/library/ImportMatcher.tsx`)

**Purpose:** Panel shown during measure import to match parsed components against library

---

## State Management

### Zustand Stores

#### measureStore (`src/stores/measureStore.ts`)

```typescript
interface MeasureState {
  measures: UniversalMeasureSpec[];
  activeMeasureId: string | null;
  activeTab: 'library' | 'editor' | 'validation' | 'codegen' | 'valuesets' | 'settings' | 'components';
  editorSection: string | null;
  isUploading: boolean;
  uploadProgress: number;
  selectedCodeFormat: CodeOutputFormat;
  validationTraces: PatientValidationTrace[];

  // Actions
  addMeasure: (measure: UniversalMeasureSpec) => void;
  updateMeasure: (id: string, updates: Partial<UniversalMeasureSpec>) => void;
  deleteMeasure: (id: string) => void;
  setActiveMeasure: (id: string | null) => void;

  // Component building
  addComponentToPopulation: (
    measureId: string,
    populationId: string,
    component: DataElement,
    logicOperator?: 'AND' | 'OR'    // Determines how component connects
  ) => void;
  deleteComponentFromPopulation: (measureId: string, populationId: string, componentId: string) => void;

  // Logic building
  toggleLogicalOperator: (measureId: string, clauseId: string) => void;
  reorderComponent: (measureId: string, parentClauseId: string, componentId: string, direction: 'up' | 'down') => void;

  // Review, lock, validation, correction actions...
}
```

**`addComponentToPopulation` Logic:**

Smart insertion based on `logicOperator` parameter:

```typescript
addComponentToPopulation: (measureId, populationId, component, logicOperator) => {
  const criteria = pop.criteria;

  // No criteria yet → create a new clause with chosen operator
  if (!pop.criteria) {
    return { criteria: { operator: logicOperator || 'AND', children: [component] } };
  }

  // Operator matches top-level → append directly
  if (!logicOperator || criteria.operator === logicOperator) {
    return { criteria: { ...criteria, children: [...criteria.children, component] } };
  }

  // Operator differs → find/create matching subclause
  // Creates nested AND or OR clause to maintain correct logical grouping
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

  // Cross-store operations
  linkMeasureComponents: (measure: UniversalMeasureSpec) => void;
  recalculateUsage: (measures: UniversalMeasureSpec[]) => void;
  syncComponentToMeasures: (...) => void;
}
```

**`linkMeasureComponents` — Code Sync on Match:**

When linking measure elements to library components:
1. Walks measure criteria tree to find DataElements
2. For each element, calls `findExactMatch` (hash + name fallback)
3. **If match found with zero codes but element has codes:** syncs codes to the library component
4. **If no match and element has zero codes:** sets `ingestionWarning` instead of creating component
5. **If no match and element has codes:** creates new component with codes

```typescript
if (match) {
  linkMap[element.id] = match.id;
  const elementCodes = element.valueSet?.codes || element.directCodes || [];
  const matchCodes = match.type === 'atomic' ? (match as AtomicComponent).valueSet.codes || [] : [];

  // Sync codes from element to library if library has none
  if (elementCodes.length > 0 && matchCodes.length === 0 && match.type === 'atomic') {
    libraryRecord[match.id] = {
      ...match,
      valueSet: { ...(match as AtomicComponent).valueSet, codes: elementCodes },
    };
  }
}
```

**`syncComponentToMeasures` — Bidirectional Code Sync:**

When a component is edited in the library, codes propagate to all linked measures:

```typescript
syncComponentToMeasures(componentId, changes, measures, updateMeasure) {
  // Finds DataElements with matching libraryComponentId
  // Updates description, timing, negation
  // Syncs codes:
  if (atomicComp.valueSet.codes && updated.valueSet) {
    updated.valueSet = { ...updated.valueSet, codes: atomicComp.valueSet.codes };
  }
}
```

**`recalculateUsage`:**
1. Resets ALL component usage to `{ measureIds: [], usageCount: 0 }`
2. Walks every measure's criteria tree
3. For each element with `libraryComponentId`, adds measure ID to usage
4. Auto-archives components with `usageCount === 0`
5. Auto-restores archived components that gain usage

**Persistence:** `localStorage` key `ums-component-library`, loaded on initialization, saved after each mutation.

#### patientStore (`src/stores/patientStore.ts`)

```typescript
interface PatientStore {
  patients: Record<string, TestPatient[]>;  // Keyed by measure ID

  addPatient: (measureId: string, patient: TestPatient) => void;
  updatePatient: (measureId: string, patientId: string, updates: Partial<TestPatient>) => void;
  deletePatient: (measureId: string, patientId: string) => void;
}
```

#### settingsStore (`src/stores/settingsStore.ts`)

```typescript
interface SettingsStore {
  openAIKey: string | null;
  theme: 'light' | 'dark' | 'system';

  setOpenAIKey: (key: string | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}
```

### Persistence

All stores use Zustand's `persist` middleware with `localStorage`:

```typescript
export const useMeasureStore = create<MeasureState>()(
  persist(
    (set, get) => ({
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
    { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
    { role: 'user', content: `Extract the quality measure...\n\n${documentText}` }
  ],
  response_format: { type: 'json_object' }
}
```

**Authentication:** API key stored in settingsStore, passed in Authorization header.

**Post-Processing:** After extraction, the AI response undergoes automatic AND/OR grouping (see AI Extractor service above).

---

## Validation Engine Details

### CQL Snippet Generation with Lookback Periods

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

### Nested Validation Tree

The validation engine now produces a nested tree that mirrors the UMS criteria structure:

- **Leaf nodes:** Individual DataElement evaluations with pass/fail/partial status
- **Group nodes:** Nested LogicalClause evaluations with `children` and `operator`
- **Operator separators:** Rendered between sibling nodes in the validation viewer

This structure enables the `ValidationTraceViewer` to render the same AND/OR tree as the UMS editor, with matching operator badges between siblings.

---

## CQL Generation

### CQL Generator Service (`src/services/cqlGenerator.ts`)

**Features:**

| Feature | Description |
|---------|-------------|
| Full Library Structure | FHIR R4, QI-Core, eCQM aligned |
| Value Set Declarations | VSAC canonical URLs with OIDs |
| Population Definitions | IP, Denominator, Exclusions, Numerator |
| Measure-Specific Helpers | CRC, Cervical, Breast cancer screening |
| CQL Validation | Integration with CQL Services API |

**Running CQL Services Locally:**

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

### 1. FHIR Export

**Description:** Export measures as FHIR Measure resources for interoperability with EHR systems and registries.

### 2. Batch Patient Validation

**Description:** Upload CSV of test patients and run bulk validation with summary reporting.

### 3. Measure Versioning

**Description:** Track changes to measures over time with diff view and version history.

### 4. Value Set Import from VSAC

**Description:** Direct integration with Value Set Authority Center for code set import, enabling automatic code population for components.

### 5. Multi-User Collaboration

**Description:** Support for concurrent editing with role-based access control and audit logging.

---

## Appendix: Code Location Reference

| Feature | Primary File | Key Functions/Components |
|---------|-------------|-------------------------|
| Measure validation | `src/services/measureEvaluator.ts` | `evaluatePatient()`, `evaluateClause()` (nested groups) |
| AI extraction + AND/OR | `src/services/aiExtractor.ts` | Encounter auto-grouping, nested group support |
| OpenAI API | `src/services/openaiService.ts` | `extractMeasureWithAI()` |
| CQL generation | `src/services/cqlGenerator.ts` | `generateCQL()` |
| Complexity scoring | `src/services/complexityCalculator.ts` | `calculateAtomicComplexity()` (zero-codes penalty) |
| Component matching | `src/services/componentMatcher.ts` | `findExactMatch()`, `findNameMatch()` (name fallback) |
| Component CRUD | `src/services/componentLibraryService.ts` | `createAtomicComponent()` (with codes) |
| Measure creation wizard | `src/components/measure/MeasureCreator.tsx` | `MeasureCreator` component |
| Measure editing + operators | `src/components/measure/UMSEditor.tsx` | Operator badges, `cleanDescription()` |
| Component builder + logic | `src/components/measure/ComponentBuilder.tsx` | AND/OR logic selector |
| Measure list + batch upload | `src/components/measure/MeasureLibrary.tsx` | `MeasureLibrary` component |
| Library browser | `src/components/library/LibraryBrowser.tsx` | `LibraryBrowser` component |
| Component detail + codes | `src/components/library/ComponentDetail.tsx` | Codes table display |
| Component editing + codes | `src/components/library/ComponentEditor.tsx` | Codes editing, shared edit sync |
| Shared edit warning | `src/components/library/SharedEditWarning.tsx` | `SharedEditWarning` modal |
| Import matching | `src/components/library/ImportMatcher.tsx` | `ImportMatcher` component |
| Validation tree viewer | `src/components/validation/ValidationTraceViewer.tsx` | `ValidationNodeList`, `OperatorSeparator` |
| Measure state + operators | `src/stores/measureStore.ts` | `addComponentToPopulation()` with `logicOperator` |
| Library state + code sync | `src/stores/componentLibraryStore.ts` | `linkMeasureComponents()`, `syncComponentToMeasures()` |
| UMS types | `src/types/ums.ts` | `ValidationNode` (children/operator), `DataElement.ingestionWarning` |
| Library types | `src/types/componentLibrary.ts` | `ComplexityFactors.zeroCodes` |

---

## Contact

For questions about this specification, contact the product team or refer to the [Product Specification](./PRODUCT_SPECIFICATION.md) for business context.
