# MeasureAccelerator Technical Specifications

## Overview

MeasureAccelerator is a comprehensive clinical quality measure development platform built with React, TypeScript, and Vite. It enables healthcare organizations to accelerate the creation, validation, and deployment of clinical quality measures (CQMs) through AI-assisted workflows, reusable component libraries, and multi-format code generation.

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
  theme: 'dark' | 'light' | 'system';
  codeGenTarget: 'cql' | 'hdi-sql' | 'fhir';
  aiProvider: 'anthropic' | 'openai';
  apiKeys: Record<string, string>;
}
```

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

### componentLibraryService.ts
CRUD operations for library components.

**Functions:**
- `createAtomicComponent(params)` - Create new atomic
- `createCompositeComponent(params)` - Create composite
- `createNewVersion(component, changes)` - Version management
- `approveComponent(component, approvedBy)` - Approval workflow
- `searchComponents(components, filters)` - Query library

### complexityCalculator.ts
Calculates complexity scores for components and measures.

**Factors:**
- Timing clauses (+1 each)
- Negations (+1 each)
- AND operators (+1 each)
- Nesting depth (+1 per level)
- Zero-code warnings

## UI Components

### UMSEditor.tsx
Main measure editing interface with:
- Population hierarchy tree view
- Drag-and-drop reordering
- Deep edit mode for component management
- Component merge functionality
- Value set editing
- Timing overrides
- Review workflow (approve/flag)

**Key Features:**
- **Deep Edit Mode**: Advanced editing with component merging
- **Component Merge**: Select 2+ components, merge with OR logic, preserve separate value sets
- **Per-Sibling Operators**: Individual AND/OR control between siblings
- **Timing Editor**: Visual timing constraint editor with calendar preview

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

**Atomic Component Fields:**
- Name, description
- Value set (OID, version, name)
- Timing expression
- Negation flag
- Category and tags

**Composite Component Fields:**
- Name, description
- Operator (AND/OR)
- Child component selection
- Category and tags

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
Multi-format code generation interface.

**Outputs:**
- CQL (Clinical Quality Language)
- HDI SQL (BigQuery)
- FHIR Measure resource
- Component-level code snippets

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

### MeasureCreator.tsx
New measure creation wizard.

## API Integration

### External Services
- **VSAC API** - Value set lookup and validation
- **FHIR Terminology Server** - Code system validation
- **AI Providers** - Claude (Anthropic) or GPT (OpenAI)

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

## Future Enhancements

1. **Server-side persistence** - Database storage for measures and components
2. **Collaboration** - Multi-user editing with conflict resolution
3. **VSAC direct integration** - Real-time value set lookup
4. **CQL execution engine** - In-browser CQL evaluation
5. **FHIR Measure import** - Parse existing FHIR measures
6. **Audit logging** - Track changes and approvals
7. **Export formats** - MAT XML, HQMF, additional SQL dialects
