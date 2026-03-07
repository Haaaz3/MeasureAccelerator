# Insight Forge - Technical Architecture

## Overview

Insight Forge is a full-stack application with a React frontend and Spring Boot backend. It uses a hybrid persistence architecture: primary data storage in a PostgreSQL/H2 database with client-side caching in localStorage for performance and offline capability.

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
│   ├── copilot/              # AND/OR.ai Co-Pilot
│   │   └── CopilotPanel.jsx  # Floating chat interface with proposals
│   ├── ingestion/            # Document ingestion UI
│   │   └── CatalogueConfirmationChip.jsx  # Catalogue type confirmation
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
│   │   ├── MeasureCodeEditor.jsx # Intuitive code editor with diffs
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
│   ├── copilotService.ts     # AI AND/OR.ai Co-Pilot context and messaging
│   ├── copilotProviders.ts   # Modular LLM provider architecture
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
│   ├── catalogueClassifier.js # Document catalogue type detection
│   ├── constraintSync.ts     # Timing sync utilities
│   ├── inferCategory.ts      # Auto-category assignment
│   ├── integrityCheck.ts     # Data validation
│   ├── measureMigration.ts   # Schema migrations
│   ├── measureValidator.ts   # UMS validation
│   ├── specParser.ts         # Spec text parsing
│   └── timingResolver.ts     # Timing calculation
│
├── api/                      # Backend API integration
│   ├── measures.ts           # Measure API calls
│   ├── components.ts         # Component API calls
│   ├── import.ts             # Import API calls
│   ├── classifierFeedback.js # Classifier feedback API
│   └── transformers.ts       # DTO ↔ UMS transformers
│
└── data/                     # Sample data
    ├── sampleMeasures.ts     # Example measures
    └── sampleLibraryData.ts  # Example components
```

## State Management

### Zustand Stores

The application uses four Zustand stores with hybrid persistence (localStorage + backend API):

#### measureStore.ts
**Persistence Key:** `insight-forge-storage`

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
- `setLastGeneratedCode(cql, sql, measureId)` - Store generated code for AND/OR.ai Co-Pilot
- `saveMeasureCodeOverride(measureId, format, code, note)` - Save code customization
- `revertMeasureCodeOverride(measureId, format)` - Revert to generated code

#### componentLibraryStore.ts
**Persistence Key:** `insight-forge-component-library`

Stores reusable component library with backend sync.

```typescript
interface ComponentLibraryState {
  components: LibraryComponent[];
  selectedComponentId: ComponentId | null;
  editingComponentId: ComponentId | null;
  filters: LibraryBrowserFilters;
  initialized: boolean;
  // API sync state
  isLoadingFromApi: boolean;
  apiError: string | null;
  lastLoadedAt: string | null;
}
```

**Key Actions:**
- `loadFromApi` - Fetch from backend, **merge** with local (preserves local-only)
- `addComponent/deleteComponent` - CRUD with backend persistence
- `linkMeasureComponents` - Auto-link measure to library, persist new components
- `mergeComponents` - Combine components
- `syncComponentToMeasures` - Propagate changes
- `recalculateUsage` - Update usage counts
- `approve/archive` - Status management

**Important:** `loadFromApi()` **merges** API components with local state rather than replacing. This prevents loss of locally created components that haven't been synced to the backend yet.

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
**Persistence Key:** `insight-forge-settings`

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
    ↓
catalogueClassifier.js::classifyDocument()
    ↓ (Signal-based catalogue type detection)
    ↓
    ├── If high confidence: proceed automatically
    │
    └── If medium/low confidence: show CatalogueConfirmationChip
            ↓
            User confirms/overrides → recordClassifierFeedback()
            ↓
measureIngestion.ts::ingestMeasureFiles()
    ↓
extractionService.ts::extractMeasure()
    ↓
    ├── If frontend API key available:
    │       llmClient.ts::callLLM() (direct to LLM provider)
    │
    └── Else: backend proxy
            POST /api/llm/extract → LlmService.java
    ↓
UMS Created (with unique IDs for all entities)
    ↓
componentLibraryStore.linkMeasureComponents()
    ↓ (creates local components, persists async)
measureStore.importMeasure()
    ↓
Backend ImportService.java
    ↓
    ├── Save measure with populations to database
    └── Auto-create AtomicComponents from data element value sets
```

**Extraction Service Features:**
- Direct LLM API calls when frontend API key is configured (faster, no timeout issues)
- Unique ID generation with random component (prevents duplicate entity errors)
- Structured JSON response parsing with validation

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

## Backend Architecture

The `backend/` directory contains a Spring Boot 3.2 application providing:
- RESTful API for measures and components
- Database persistence (H2/PostgreSQL)
- LLM API proxying with timeout management
- Auto-creation of components from measure data elements

```
backend/
├── src/main/java/com/algoaccel/
│   ├── AlgoAccelApplication.java   # Main entry point
│   ├── config/
│   │   ├── WebClientConfig.java    # LLM API client with timeouts
│   │   └── CorsConfig.java         # CORS configuration
│   ├── controller/
│   │   ├── MeasureController.java  # /api/measures endpoints
│   │   ├── ComponentController.java # /api/components endpoints
│   │   ├── ImportController.java   # /api/import endpoint
│   │   └── LlmController.java      # /api/llm/extract endpoint
│   ├── service/
│   │   ├── MeasureService.java     # Measure business logic
│   │   ├── ComponentService.java   # Component business logic
│   │   ├── ImportService.java      # Import with auto-component creation
│   │   └── LlmService.java         # LLM API integration
│   ├── model/
│   │   ├── measure/                # Measure JPA entities
│   │   └── component/              # Component JPA entities
│   ├── repository/                 # Spring Data JPA repositories
│   └── dto/                        # Request/Response DTOs
├── src/main/resources/
│   ├── application.yml             # Spring configuration
│   └── db/migration/               # Flyway migrations
└── pom.xml                         # Maven build
```

### Key Backend Services

**ImportService.java**
- Imports measures from frontend export format
- Auto-creates AtomicComponents from data element value sets
- Skips component import if array is empty (preserves existing)
- Category inference from element type

**WebClientConfig.java**
- Custom connection provider for LLM API calls
- 5-minute response timeout for long extractions
- Connection pooling with proper lifecycle management

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/measures` | GET | List all measures |
| `/api/measures/full` | GET | Full measures with populations |
| `/api/measures/{id}` | GET/PUT/DELETE | Measure CRUD |
| `/api/components` | GET | List all components |
| `/api/components/{id}` | GET/PUT/DELETE | Component CRUD |
| `/api/import` | POST | Import measures + auto-create components |
| `/api/llm/extract` | POST | Proxy LLM extraction requests |
| `/api/classifier/feedback` | POST | Record catalogue classification feedback |

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
