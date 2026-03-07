# Insight Forge Technical Specifications

## Overview

Insight Forge is a comprehensive clinical quality measure development platform built with React, TypeScript, and Vite. It enables healthcare organizations to accelerate the creation, validation, and deployment of clinical quality measures (CQMs) through AI-assisted workflows, reusable component libraries, and multi-format code generation.

## Technology Stack

### Frontend
- **React 18** - UI framework with functional components and hooks
- **TypeScript** - Type-safe development with strict mode
- **Vite** - Build tool and dev server with HMR
- **Zustand** - Lightweight state management with persist middleware
- **Tailwind CSS** - Utility-first styling with custom CSS variables for theming
- **Lucide React** - Icon library

### Key Dependencies
- **PDF.js** - PDF document parsing for measure specification ingestion
- **xlsx** - Excel file parsing for value set imports
- **uuid** - Unique identifier generation
- **date-fns** - Date manipulation utilities

## Architecture

### Application Structure

```
src/
├── components/           # React UI components
│   ├── layout/          # App shell (Sidebar)
│   ├── library/         # Component Library UI
│   ├── measure/         # Measure editing components
│   ├── ingestion/       # Document ingestion UI (CatalogueConfirmationChip)
│   ├── validation/      # Validation and testing UI
│   ├── valueset/        # Value set management
│   └── settings/        # Application settings
├── services/            # Business logic and generators
├── stores/              # Zustand state stores
├── types/               # TypeScript type definitions
├── constants/           # Static data (code systems, value sets)
├── data/                # Sample/seed data
└── utils/               # Utility functions
```

### State Management

The application uses **Zustand** with persist middleware for state management:

#### measureStore.ts
Primary store for measure data and UI state.

```typescript
interface MeasureState {
  measures: UniversalMeasureSpec[];
  selectedMeasureId: string | null;
  activeTab: TabType;
  corrections: ValueSetCorrection[];
  // ... actions
}
```

**Key Actions:**
- `addMeasure(measure)` - Add new measure to library
- `updateMeasure(id, updates)` - Update measure properties
- `deleteMeasure(id)` - Remove measure
- `setSelectedMeasure(id)` - Select measure for editing
- `addCodeToValueSet(measureId, valueSetId, code)` - Add code to value set
- `removeCodeFromValueSet(measureId, valueSetId, code)` - Remove code
- `saveTimingOverride(measureId, elementId, timing)` - Override timing

#### componentLibraryStore.ts
Store for reusable component library.

```typescript
interface ComponentLibraryState {
  components: LibraryComponent[];
  selectedComponentId: ComponentId | null;
  editingComponentId: ComponentId | null;
  filters: LibraryBrowserFilters;
  // ... actions
}
```

**Key Actions:**
- `addComponent(component)` - Add to library
- `updateComponent(id, updates)` - Update component
- `approve(id, approvedBy)` - Approve component
- `mergeComponents(ids, name, description, valueSets)` - Merge multiple components
- `linkMeasureComponents(measureId, populations)` - Auto-link measure elements to library
- `recalculateUsage(measures)` - Update usage statistics

#### settingsStore.ts
Application configuration and preferences.

```typescript
interface SettingsState {
  selectedProvider: 'anthropic' | 'openai' | 'google' | 'custom';
  selectedModel: string;
  apiKeys: Record<string, string>;
  customLlmBaseUrl: string;
  customLlmModelName: string;
}
```

#### feedbackStore.js
Extraction feedback capture and prompt injection system.

```typescript
interface FeedbackState {
  corrections: Correction[];
  feedbackEnabled: boolean;
  feedbackInjectionEnabled: boolean;
}

interface Correction {
  id: string;
  timestamp: string;
  measureId: string;
  measureContext: { measureId: string; measureType: string; program: string };
  fieldPath: string;
  originalValue: any;
  correctedValue: any;
  correctionType: CorrectionType;
  pattern: PatternType;
  severity: 'high' | 'medium' | 'low';
}
```

**Pattern Types:**
- `component_hallucination` - LLM extracted component that doesn't belong
- `component_missing` - User added component LLM missed
- `value_set_wrong` - Incorrect value set OID or codes
- `description_inaccurate` - Description text was wrong
- `timing_wrong` - Timing expression incorrect
- `resource_type_wrong` - Wrong QI-Core resource type
- `logical_operator_error` - AND/OR logic incorrect
- `code_wrong` - Individual codes added/removed
- `naming_error` - Component naming issues

**Key Actions:**
- `recordCorrection(correction)` - Capture a user correction with auto-classification
- `generateExtractionGuidance(catalogueType)` - Build prompt injection text from past corrections
- `getFilteredCorrections(filters)` - Query corrections with filters
- `getPatternStats()` - Get correction breakdown by pattern
- `getAccuracyMetrics()` - Calculate extraction accuracy stats

**Prompt Injection:**
The `generateExtractionGuidance()` function:
1. Filters corrections by catalogue type (e.g., MIPS, HEDIS)
2. Prioritizes by severity and recency
3. Groups by pattern type
4. Builds actionable guidance sections
5. Caps output at ~2000 characters to avoid prompt bloat

## Data Models

### Universal Measure Spec (UMS)

The core data model representing a clinical quality measure, aligned with FHIR R4 and CQL standards.

```typescript
interface UniversalMeasureSpec {
  // Identification
  id: string;
  measureId: string;
  title: string;
  version: string;
  status: MeasureStatus;

  // FHIR alignment
  url?: string;           // Canonical URL
  identifier?: Identifier[];
  effectivePeriod?: Period;
  scoring?: MeasureScoringType;
  improvementNotation?: ImprovementNotation;

  // Description
  clinicalFocus: string;
  rationale?: string;
  clinicalRecommendation?: string;

  // Populations
  populations: Population[];

  // Value Sets
  valueSets: ValueSetReference[];

  // Metadata
  steward?: string;
  developer?: string;
  endorser?: string;
  measurementPeriod?: { start: string; end: string };
}
```

### Population Structure

```typescript
interface Population {
  type: PopulationType;  // 'initial-population' | 'denominator' | 'numerator' | etc.
  description: string;
  criteria: LogicalClause | DataElement | null;
  confidence?: ConfidenceLevel;
  cqlExpression?: string;
}
```

### Criteria Hierarchy

```typescript
// Logical grouping (AND/OR)
interface LogicalClause {
  id: string;
  operator: LogicalOperator;  // 'AND' | 'OR' | 'NOT'
  children: (LogicalClause | DataElement)[];
  siblingConnections?: SiblingConnection[];  // Per-sibling operator overrides
}

// Atomic data element
interface DataElement {
  id: string;
  type: QICoreResourceType;  // 'Encounter' | 'Condition' | 'Procedure' | etc.
  description: string;
  valueSet?: ValueSetReference;
  valueSets?: ValueSetReference[];  // Multiple value sets for merged components
  timingRequirements?: TimingRequirement[];
  timingOverride?: TimingExpression;
  thresholds?: { ageMin?: number; ageMax?: number; valueMin?: number; };
  libraryComponentId?: string;  // Link to component library
  reviewStatus?: ReviewStatus;
}
```

### Component Library Types

```typescript
// Atomic component - single value set + timing
interface AtomicComponent {
  type: 'atomic';
  id: ComponentId;
  name: string;
  description?: string;
  valueSet: ComponentValueSet;
  valueSets?: ComponentValueSet[];  // Multiple value sets
  timing: TimingExpression;
  negation: boolean;
  complexity: ComponentComplexity;
  versionInfo: ComponentVersionInfo;
  usage: ComponentUsage;
  metadata: ComponentMetadata;
}

// Composite component - collection with logic
interface CompositeComponent {
  type: 'composite';
  id: ComponentId;
  name: string;
  description?: string;
  operator: LogicalOperator;
  children: ComponentReference[];
  complexity: ComponentComplexity;
  versionInfo: ComponentVersionInfo;
  usage: ComponentUsage;
  metadata: ComponentMetadata;
}
```

### Value Set Reference

```typescript
interface ValueSetReference {
  id: string;
  oid?: string;          // VSAC OID
  url?: string;          // FHIR canonical URL
  name: string;
  version?: string;
  codes: CodeReference[];
  totalCodeCount?: number;
  confidence: ConfidenceLevel;
  verified?: boolean;
  publisher?: string;
}

interface CodeReference {
  code: string;
  display: string;
  system: CodeSystem;    // 'ICD10' | 'SNOMED' | 'CPT' | etc.
  systemUri?: string;    // FHIR URI
  version?: string;
}
```

## Services

### measureIngestion.ts
Parses measure specification documents (PDF, Word, Excel) and extracts structured data using AI.

**Key Functions:**
- `ingestMeasureDocument(file)` - Parse document and create UMS
- `extractPopulations(text)` - Extract population criteria
- `extractValueSets(text)` - Identify value sets
- `resolveOIDs(valueSets)` - Look up VSAC OIDs

### aiExtractor.ts
AI-powered extraction of measure logic from natural language specifications.

**Capabilities:**
- Population criteria extraction
- Value set identification
- Timing requirement parsing
- Confidence scoring

### extractionService.js
Orchestrates measure extraction with feedback integration.

**Feedback Integration:**
- Imports `useFeedbackStore` to access correction history
- Calls `generateExtractionGuidance(catalogueType)` before extraction
- Injects guidance into system prompt: `EXTRACTION_SYSTEM_PROMPT + feedbackGuidance`
- Catalogue type derived from `skeleton.metadata.program`

**Key Functions:**
- `extractMeasure(skeleton, documentText, settings)` - Single-pass extraction with feedback injection
- `extractMeasureMultiPass(skeleton, documentText, settings)` - Multi-pass extraction with feedback injection

### cqlGenerator.ts
Generates Clinical Quality Language (CQL) from UMS.

**Output:**
- Library definition with version
- Value set definitions
- Population expressions
- Helper functions

```cql
library MeasureXYZ version '1.0.0'
using QICore version '4.1.1'

valueset "Office Visit": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.101.12.1001'

define "Initial Population":
  exists "Qualifying Encounters"
    and "Patient Age 18 or Older"
```

### hdiSqlGenerator.ts
Generates Health Data Intelligence (HDI) SQL queries from UMS for data warehouse execution.

**Features:**
- BigQuery SQL dialect
- Optimized CTEs
- FHIR resource mapping
- Code system URI handling

### componentCodeGenerator.ts
Generates reusable code snippets for individual components.

### testPatientGenerator.ts
Creates synthetic test patients for measure validation.

**Patient Categories:**
- Numerator-positive (should pass)
- Denominator-only (should fail numerator)
- Exclusion cases
- Edge cases

### measureEvaluator.ts
Evaluates measures against test patients with detailed trace output.

**Features:**
- Step-by-step evaluation trace
- Resource matching details
- Timing validation
- Population categorization

### componentMatcher.ts
Matches measure data elements to library components.

**Matching Strategies:**
- Exact OID match
- Fuzzy name matching
- Timing compatibility check
- Confidence scoring

### copilotService.ts
AI AND/OR.ai Co-Pilot context building and message handling.

**Functions:**
- `buildCopilotContext(params)` - Build context from measure, components, generated code
- `buildCopilotSystemPrompt(context)` - Generate system prompt with measure structure
- `sendCopilotMessage(history, context, settings)` - Send message to LLM provider

**Context Includes:**
- Measure metadata and populations
- Generated CQL and SQL code
- Library component information
- Active tab and UI state

### copilotProviders.ts
Modular LLM provider architecture for AND/OR.ai Co-Pilot.

**Providers:**
- Anthropic Claude (default)
- OpenAI GPT
- Backend proxy (fallback)

**Features:**
- Streaming support
- Error handling with user-friendly messages
- Provider-specific optimizations

### componentLibraryService.ts
CRUD operations for library components.

**Functions:**
- `createAtomicComponent(params)` - Create new atomic (generates `comp-` prefixed ID)
- `createCompositeComponent(params)` - Create composite (generates `composite-` prefixed ID)
- `createNewVersion(component, changes)` - Version management
- `approveComponent(component, approvedBy)` - Approval workflow
- `searchComponents(components, filters)` - Query library

**ID Generation:**
- New atomic components use `comp-` prefix (e.g., `comp-1772138703824-1`)
- Composite components use `composite-` prefix
- The `component.type` field (`'atomic'` or `'composite'`) is the authoritative type indicator
- Existing `atomic-` prefixed IDs remain unchanged for backwards compatibility

**Integrity Safeguards:**
- `deleteComponent(id)` - Blocks deletion if component is in use by measures; returns `{ success: false, error, measureIds }` if blocked
- `archiveComponentVersion(id)` - Blocks archiving if component is in use; returns error with affected measure list

**Sync Status Tracking:**
The store tracks components that fail to sync to the backend, preventing ghost components and providing visibility into sync state.

State:
- `pendingSync: Map<componentId, { operation, retryCount, lastError, timestamp }>` - Failed operations
- `isSyncing: boolean` - Retry in progress indicator

Actions:
- `getSyncStatus()` - Returns `{ isSynced, pendingCount, pendingIds, isSyncing }`
- `markPendingSync(id, operation, error)` - Mark component as failed to sync
- `clearPendingSync(id)` - Clear on successful sync
- `retryPendingSync()` - Retry all pending operations (max 3 retries per component)

All CRUD operations (`addComponent`, `updateComponent`, `deleteComponent`) automatically track sync failures and clear status on success.

### vsacService.ts
VSAC API integration for value set fetching.

**Functions:**
- `fetchValueSetExpansion(oid, apiKey)` - Fetch codes from VSAC by OID
- Returns `{ codes, valueSetName, version }`

### vsacCodeCache.ts
Local cache of VSAC value set codes for offline hydration.

**Features:**
- Pre-populated with codes from public FHIR packages (eCQI, THO)
- Supports offline code lookup without VSAC API key
- Used to hydrate sample data and component library
- Cache keyed by OID with codes array

**Functions:**
- `getCodesForOid(oid)` - Get cached codes for an OID
- `hasCodesForOid(oid)` - Check if OID is in cache

### complexityCalculator.ts
Calculates complexity scores for components and measures.

**Factors:**
- Timing clauses (+1 each)
- Negations (+1 each)
- AND operators (+1 each)
- Nesting depth (+1 per level)
- Zero-code warnings

### catalogueClassifier.js
Signal-based document classifier for auto-detecting catalogue types during ingestion.

**Supported Catalogue Types:**
- `eCQM` - Electronic Clinical Quality Measures
- `MIPS_CQM` - Merit-based Incentive Payment System measures
- `HEDIS` - Healthcare Effectiveness Data and Information Set
- `QOF` - Quality and Outcomes Framework (UK)
- `Clinical_Standard` - General clinical standards

**Classification Process:**
1. Extracts text from uploaded document
2. Scans for catalogue-specific signals (keywords, patterns)
3. Calculates raw scores based on signal counts
4. Determines confidence level:
   - **High**: ≥3 signals AND score ≥2× second-highest
   - **Medium**: ≥2 signals OR score ≥1.5× second-highest
   - **Low**: Otherwise

**Key Functions:**
- `classifyDocument(text)` - Returns `{ detected, confidence, signals, rawScores }`

### classifierFeedback.js (API Client)
Fire-and-forget API client for recording user classifier feedback.

**Functions:**
- `recordClassifierFeedback(feedback)` - POST to `/api/classifier/feedback`
- `recordClassifierFeedbackAsync(feedback)` - Non-blocking wrapper that catches errors

## UI Components

### UMSEditor.tsx
Main measure editing interface with:
- Population hierarchy tree view
- Drag-and-drop reordering
- Deep edit mode for component management
- Component merge functionality
- Full value set editing (OID, name, codes)
- Shared TimingSection with smart presets
- Review workflow (approve/flag)

**Key Features:**
- **Deep Edit Mode**: Advanced editing with component merging
- **Component Merge**: Select 2+ components, merge with OR logic, preserve separate value sets
- **Per-Sibling Operators**: Individual AND/OR control between siblings
- **TimingSection Integration**: Shared timing component with presets (During MP, Lookback, Anytime)
- **NodeDetailPanel**: Full value set editing parity with ComponentEditor:
  - Editable OID and VS Name fields
  - Inline codes table with add/delete buttons
  - VsacFetchButton for direct VSAC fetching
  - Bidirectional sync to linked library component
- **Add Component Modal**: Library-first component selection with search and category filters

### LibraryBrowser.tsx
Component library management interface.

**Features:**
- Category filtering (Demographics, Encounters, Conditions, etc.)
- Status filtering (Draft, Pending, Approved, Archived)
- Complexity filtering
- Search across names, descriptions, tags, OIDs
- Usage statistics
- Component detail view
- Inline editing

### ComponentEditor.tsx
Form for creating/editing library components.

**Component Fields:**
- Name, description
- Value set (OID, version, name) with inline code editing
- Timing configuration via shared TimingSection
- Patient sex restriction (male/female/any)
- Category and tags
- Due Date (T-Days) for outreach timing

**Note**: The atomic/composite toggle has been removed. Components are created as atomic by default; composites are created via the merge flow.

### CreateComponentWizard.jsx
4-step guided wizard for creating new components.

**Steps:**
1. **Category Selection**: Choose clinical category and subcategory
2. **Component Details**: Name, description, OID, timing, patient sex
3. **Code Configuration**: VSAC fetch or manual code entry
4. **Review**: Preview component and generated code

### TimingSection.jsx
Shared timing configuration component used in both ComponentEditor and NodeDetailPanel.

**Features:**
- Smart presets: During MP, Lookback from MP End/Start, Anytime, Advanced
- Real-time resolved date preview based on measurement period
- Due Date (T-Days) calculation with manual override
- Age Evaluation Reference for demographic components
- Compact mode for inline editing

### AddComponentModal.jsx
Library-first modal for adding components to measures.

**Features:**
- Two tabs: Library (browse existing) and Create New
- Category filter dropdown
- Search by name, description, OID
- Preview selected component before adding

### ComponentDetail.tsx
Detailed view of a library component showing:
- Version history
- Approval status
- Usage across measures
- Value sets with code tables
- Timing configuration
- Complexity breakdown

### ValidationTraceViewer.tsx
Test patient validation interface.

**Features:**
- Test patient generation
- Step-by-step evaluation trace
- Population results
- Resource matching details
- Pass/fail visualization

### CodeGeneration.tsx
Code generation interface.

**Outputs:**
- CQL (Clinical Quality Language)
- Synapse SQL (Azure Synapse Analytics)
- Component-level code snippets

**Integrated Features:**
- MeasureCodeEditor for inline code customization
- Override detection and display
- Edit history with visual diffs

### CopilotPanel.jsx
Floating AI AND/OR.ai Co-Pilot chat interface.

**Features:**
- Measure-aware context
- Structured proposal system for edits
- Visual diff display for code fixes
- Applied proposals logged to edit history
- Modular provider architecture

**Proposal Types:**
- `propose_field_edit` - Change component field values
- `propose_code_fix` - Fix CQL/SQL code snippets

### MeasureCodeEditor.jsx
Intuitive code editing experience for non-technical users.

**Features:**
- Click-to-edit flow with guidance
- Required notes for audit trail
- Visual diff view (before/after)
- Clickable edit history with per-entry diffs
- One-click revert to generated code
- Override indicator badge

**Components:**
- `EditGuidance` - Contextual help for first-time editors
- `NoteInputCard` - Note input with validation
- `EditHistoryPanel` - Expandable history with clickable diffs
- `HistoryEntryDiff` - Per-edit diff visualization
- `DiffViewer` - Line-by-line diff display

### ValueSetManager.tsx
Value set management and editing.

**Features:**
- Value set browser
- Code search and add
- Bulk import (CSV, Excel)
- Version management
- VSAC integration

### MeasureLibrary.tsx
Measure library view with:
- List of all measures
- Status indicators
- Quick actions
- Import new measures
- **Catalogue auto-detection during import with confirmation flow**

### CatalogueConfirmationChip.jsx
Inline confirmation UI for catalogue type detection during ingestion.

**Features:**
- Displays detected catalogue type with confidence styling
- Color-coded confidence indicators (green=high, yellow=medium, red=low)
- Override dropdown for selecting alternative catalogue type
- Confirm/Cancel buttons for user decision
- Records feedback to backend for classifier improvement

**Props:**
- `classification` - Detection result from catalogueClassifier
- `onConfirm(detectedType, overrideType)` - Called on confirmation
- `onCancel()` - Called on cancellation
- `documentName` - Display name for context

### MeasureCreator.tsx
New measure creation wizard.

## API Integration

### External Services
- **VSAC API** - Value set lookup and validation
- **FHIR Terminology Server** - Code system validation
- **AI Providers** - Claude (Anthropic) or GPT (OpenAI)

### Backend Classifier Feedback Endpoint
Records user confirmation/override decisions for catalogue classification to improve future detection.

**Endpoint:** `POST /api/classifier/feedback`

**Request Body:**
```json
{
  "documentName": "measure-spec.pdf",
  "detectedType": "eCQM",
  "confirmedType": "MIPS_CQM",
  "confidence": "medium",
  "wasOverride": true,
  "signals": ["cms qualifier", "quality measure"]
}
```

**Response:** `{ "recorded": true }`

**Backend Components:**
- `ClassifierFeedback.java` - JPA entity
- `ClassifierFeedbackRepository.java` - Spring Data repository
- `ClassifierFeedbackController.java` - REST controller
- `V21__create_classifier_feedback_table.sql` - Flyway migration

### API Configuration (settingsStore)
```typescript
{
  aiProvider: 'anthropic' | 'openai',
  apiKeys: {
    anthropic: 'sk-ant-...',
    openai: 'sk-...',
    vsac: '...'
  },
  endpoints: {
    vsac: 'https://vsac.nlm.nih.gov/vsac',
    fhirTerminology: 'https://tx.fhir.org/r4'
  }
}
```

## Data Persistence

All data is persisted to browser localStorage using Zustand's persist middleware:

- `measure-storage` - Measures and corrections
- `component-library-storage` - Library components
- `settings-storage` - User preferences
- `feedback-storage` - Extraction corrections and feedback settings

**Storage Considerations:**
- ~5MB localStorage limit per origin
- Large measures may need server-side storage
- Export/import functionality for backup

## Theming

CSS variables support light/dark themes:

```css
:root {
  --bg-primary: #0f0f0f;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #242424;
  --text: #ffffff;
  --text-muted: #a0a0a0;
  --text-dim: #666666;
  --accent: #3b82f6;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  --border: #333333;
}
```

## Performance Optimizations

- **React.memo** for expensive component renders
- **useMemo/useCallback** for computed values and callbacks
- **Virtualization** for long lists (value sets, codes)
- **Lazy loading** for PDF.js worker
- **Code splitting** potential for large services

## Security Considerations

- API keys stored in localStorage (consider secure storage for production)
- No server-side data storage (client-only)
- CORS considerations for external API calls
- Input sanitization for AI-generated content

### Sidebar.jsx
Application navigation with nested category support.

**Features:**
- Main navigation tabs (Measures, Editor, Components, Value Sets, etc.)
- Component Library category submenu nested under Components tab
- Active tab highlighting
- Measure selection indicator

## Future Enhancements

1. **Server-side persistence** - Database storage for measures and components
2. **Collaboration** - Multi-user editing with conflict resolution
3. ~~**VSAC direct integration**~~ - ✅ Implemented: Real-time value set lookup via VSAC API
4. **CQL execution engine** - In-browser CQL evaluation
5. **FHIR Measure import** - Parse existing FHIR measures
6. **Audit logging** - Track changes and approvals
7. **Export formats** - MAT XML, HQMF, additional SQL dialects
8. ~~**Due Date tracking**~~ - ✅ Implemented: T-Days calculation for patient outreach
9. ~~**Extraction feedback loop**~~ - ✅ Implemented: Correction capture and prompt injection
10. ~~**Catalogue auto-detection**~~ - ✅ Implemented: Signal-based classifier with confirmation chip
