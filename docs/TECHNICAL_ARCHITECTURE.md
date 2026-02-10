# AlgoAccelerator - Technical Architecture

## Overview

AlgoAccelerator is a React-based single-page application with optional Express.js backend. It uses a client-first architecture with browser localStorage persistence, enabling offline-capable operation.

## Directory Structure

```
src/
├── App.tsx                    # Root component, tab routing
├── main.tsx                   # Entry point
├── index.css                  # Global styles, CSS variables
│
├── components/                # React UI components
│   ├── layout/               # App shell
│   │   └── Sidebar.tsx       # Navigation sidebar
│   ├── library/              # Component Library UI
│   │   ├── LibraryBrowser.tsx
│   │   ├── ComponentDetail.tsx
│   │   ├── ComponentEditor.tsx
│   │   ├── SharedEditWarning.tsx
│   │   └── ImportMatcher.tsx
│   ├── measure/              # Measure editing
│   │   ├── UMSEditor.tsx         # Main measure editor
│   │   ├── MeasureLibrary.tsx    # Measure list/import
│   │   ├── MeasureCreator.tsx    # Wizard for new measures
│   │   ├── LogicTreeEditor.tsx   # Criteria tree UI
│   │   ├── ComponentDetailPanel.tsx  # Selected component details
│   │   ├── ComponentCodeViewer.tsx   # Code view/edit
│   │   ├── CodeGeneration.tsx    # Code export view
│   │   ├── TimingEditor.tsx      # Timing constraint editor
│   │   ├── ComponentBuilder.tsx  # Add component form
│   │   └── CriteriaBlockBuilder.tsx
│   ├── validation/           # Testing UI
│   │   └── ValidationTraceViewer.tsx
│   ├── valueset/             # Value set management
│   │   └── ValueSetManager.tsx
│   ├── settings/             # Configuration
│   │   └── SettingsPage.tsx
│   └── shared/               # Shared components
│       └── ErrorBoundary.tsx
│
├── services/                 # Business logic
│   ├── aiAssistant.ts        # AI chat for component editing
│   ├── aiExtractor.ts        # AI-powered spec extraction
│   ├── cqlGenerator.ts       # CQL code generation
│   ├── hdiSqlGenerator.ts    # SQL code generation
│   ├── componentCodeGenerator.ts  # Per-component code
│   ├── codeOverrideHelper.ts # Code override utilities
│   ├── componentLibraryService.ts  # Component CRUD
│   ├── componentMatcher.ts   # Library matching logic
│   ├── complexityCalculator.ts    # Complexity scoring
│   ├── documentLoader.ts     # PDF/document parsing
│   ├── measureIngestion.ts   # Document → UMS pipeline
│   ├── measureEvaluator.ts   # Test patient evaluation
│   └── testPatientGenerator.ts    # Synthetic patients
│
├── stores/                   # Zustand state stores
│   ├── measureStore.ts       # Measures, corrections
│   ├── componentLibraryStore.ts  # Reusable components
│   ├── componentCodeStore.ts # Code generation state
│   └── settingsStore.ts      # User preferences
│
├── types/                    # TypeScript definitions
│   ├── ums.ts                # Universal Measure Spec
│   ├── componentLibrary.ts   # Library component types
│   ├── componentCode.ts      # Code state types
│   ├── fhir-measure.ts       # FHIR Measure types
│   └── hdiDataModels.ts      # SQL data models
│
├── constants/                # Static data
│   ├── fhirCodeSystems.ts    # FHIR code system URIs
│   └── standardValueSets.ts  # Built-in value sets
│
├── utils/                    # Utility functions
│   ├── constraintSync.ts     # Timing sync utilities
│   ├── integrityCheck.ts     # Data validation
│   ├── measureMigration.ts   # Schema migrations
│   ├── measureValidator.ts   # UMS validation
│   ├── specParser.ts         # Spec text parsing
│   └── timingResolver.ts     # Timing calculation
│
└── data/                     # Sample data
    ├── sampleMeasures.ts     # Example measures
    └── sampleLibraryData.ts  # Example components
```

## State Management

### Zustand Stores

The application uses four Zustand stores with localStorage persistence:

#### measureStore.ts
**Persistence Key:** `algo-accelerator-storage`

Primary store for measure data and application state.

```typescript
interface MeasureState {
  measures: UniversalMeasureSpec[];
  selectedMeasureId: string | null;
  activeTab: TabType;
  validationTraces: Record<string, PatientValidationTrace[]>;
  corrections: MeasureCorrection[];
}
```

**Key Actions:**
- `addMeasure(measure)` - Add new measure
- `updateMeasure(id, updates)` - Update measure
- `deleteMeasure(id)` - Remove measure
- `setSelectedMeasure(id)` - Select for editing
- `addCodeToValueSet/removeCodeFromValueSet` - Code management
- `updateTimingOverride` - Timing modifications
- `toggleLogicalOperator` - AND/OR toggling
- `approveElement/flagElement` - Review workflow

#### componentLibraryStore.ts
**Persistence Key:** `algo-accelerator-component-library`

Stores reusable component library.

```typescript
interface ComponentLibraryState {
  components: LibraryComponent[];
  selectedComponentId: ComponentId | null;
  editingComponentId: ComponentId | null;
  filters: LibraryBrowserFilters;
  initialized: boolean;
}
```

**Key Actions:**
- `addComponent/updateComponent` - CRUD
- `linkMeasureComponents` - Auto-link measure to library
- `mergeComponents` - Combine components
- `syncComponentToMeasures` - Propagate changes
- `recalculateUsage` - Update usage counts
- `approve/archive` - Status management

#### componentCodeStore.ts
**Persistence Key:** `component-code-storage`

Manages code generation state and overrides.

```typescript
interface ComponentCodeState {
  componentId: string;  // Actually storeKey: measureId::elementId
  overrides: Record<CodeFormat, CodeOverride | null>;
  selectedFormat: CodeFormat;
  isEditing: boolean;
  pendingNote: string;
}
```

**Key Actions:**
- `getOrCreateCodeState(key)` - Get/create state
- `setSelectedFormat` - Toggle CQL/SQL
- `addOverride` - Save code override
- `clearOverride` - Revert to generated

#### settingsStore.ts
**Persistence Key:** `algo-accelerator-settings`

User preferences and API configuration.

```typescript
interface SettingsState {
  selectedProvider: 'anthropic' | 'openai' | 'google' | 'custom';
  selectedModel: string;
  apiKeys: Record<string, string>;
  useBackendApi: boolean;
}
```

## Core Data Models

### Universal Measure Spec (UMS)

The canonical representation of a clinical quality measure, aligned with FHIR R4.

```typescript
interface UniversalMeasureSpec {
  id: string;
  metadata: MeasureMetadata;
  populations: PopulationDefinition[];
  valueSets: ValueSetReference[];
  globalConstraints?: GlobalConstraints;
  status: MeasureStatus;
  // ... audit fields
}
```

### Population Definition

```typescript
interface PopulationDefinition {
  id: string;
  type: PopulationType;  // 'initial-population', 'denominator', etc.
  description: string;
  criteria: LogicalClause;
  reviewStatus: ReviewStatus;
}
```

### Logical Clause (Criteria Tree)

```typescript
interface LogicalClause {
  id: string;
  operator: 'AND' | 'OR' | 'NOT';
  children: (DataElement | LogicalClause)[];
  siblingConnections?: SiblingConnection[];  // Per-sibling operators
}
```

### Data Element

```typescript
interface DataElement {
  id: string;
  type: DataElementType;  // 'diagnosis', 'encounter', 'procedure', etc.
  description: string;
  valueSet?: ValueSetReference;
  valueSets?: ValueSetReference[];
  timingOverride?: TimingOverride;
  timingWindow?: TimingWindowOverride;
  negation?: boolean;
  libraryComponentId?: string;
  reviewStatus: ReviewStatus;
  ingestionWarning?: string;
}
```

### Library Component Types

```typescript
// Atomic: Single value set + timing
interface AtomicComponent {
  type: 'atomic';
  id: ComponentId;
  name: string;
  valueSet: ComponentValueSet;
  metadata: ComponentMetadata;
  versionInfo: ComponentVersionInfo;
  usage: ComponentUsage;
}

// Composite: Collection with logic
interface CompositeComponent {
  type: 'composite';
  id: ComponentId;
  name: string;
  operator: 'AND' | 'OR';
  children: ComponentReference[];
  // ... same metadata
}
```

## Service Layer

### Ingestion Pipeline

```
Document Upload
    ↓
documentLoader.ts::extractFromFiles()
    ↓ (PDF.js for PDFs)
measureIngestion.ts::ingestMeasureFiles()
    ↓
aiExtractor.ts::extractMeasureWithAI()
    ↓ (LLM API call)
UMS Created
    ↓
componentLibraryStore.linkMeasureComponents()
```

### Code Generation Pipeline

```
Measure Selected
    ↓
cqlGenerator.ts::generateCQL()
  OR
hdiSqlGenerator.ts::generateHDISQL()
    ↓
componentCodeGenerator.ts (per-component)
    ↓
componentCodeStore applies overrides
    ↓
Final Code Displayed
```

### Component Matching

```
DataElement from Measure
    ↓
componentMatcher.ts::parseDataElementToComponent()
    ↓
componentMatcher.ts::findExactMatch()
    ↓ (hash-based identity matching)
    ↓ Falls back to name-based matching
    ↓
Link or Create New Component
```

## Key Patterns

### Store Key Pattern (Code Overrides)

Code states are keyed by `measureId::elementId` for per-measure isolation:
```typescript
const storeKey = getStoreKey(measureId, elementId);
// Returns: "measure-123::element-456"
// Library uses: "library::component-789"
```

### Timing Override Pattern

Original timing is preserved, modifications stored separately:
```typescript
interface TimingOverride {
  original: TimingConstraint;  // Immutable
  modified: TimingConstraint | null;  // User changes
  modifiedAt: string | null;
  modifiedBy: string | null;
}
```

### Shared Edit Warning

When editing a component used in multiple measures:
1. Check `component.usage.usageCount`
2. If > 1, show SharedEditWarning modal
3. User chooses: Update All or Create New Version

### Component React Key Pattern

Force component remount on selection change:
```tsx
<ComponentCodeViewer
  key={element.id}  // Resets state when switching
  element={element}
  measureId={measureId}
/>
```

## Backend (Optional)

The `server/` directory contains an Express.js API for:
- VSAC API proxying
- LLM API proxying (avoids CORS)
- Future: Authentication, database storage

```
server/
├── index.js          # Express app
├── routes/
│   ├── vsac.js       # VSAC endpoints
│   └── llm.js        # LLM endpoints
└── .env.example      # Environment template
```

## Testing

```bash
npm run test          # Run tests once
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Tests are in `src/__tests__/`:
- `integration/` - Full flow tests
- `fixtures/` - Test data

## Build & Deploy

```bash
npm run build   # Production build → dist/
npm run preview # Preview production build
```

Output is static files deployable to any host.
