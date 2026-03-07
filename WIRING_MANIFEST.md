# Insight Forge Wiring Manifest

A comprehensive map of how components, stores, and services connect and communicate throughout the application.

---

## Table of Contents

1. [Store-to-Component Map](#1-store-to-component-map)
2. [Service Call Graph](#2-service-call-graph)
3. [Event and Data Flow Sequences](#3-event-and-data-flow-sequences)
4. [Orphan Report](#4-orphan-report)
5. [Cross-Store Dependencies](#5-cross-store-dependencies)

---

## 1. Store-to-Component Map

### Store Overview

| Store | File | Purpose | Persistence Key |
|-------|------|---------|-----------------|
| measureStore | `src/stores/measureStore.js` | Measures, corrections, active tab | `measure-storage` |
| componentLibraryStore | `src/stores/componentLibraryStore.js` | Reusable components | `component-library-storage` |
| settingsStore | `src/stores/settingsStore.js` | User preferences, API keys | `settings-storage` |
| componentCodeStore | `src/stores/componentCodeStore.js` | Code generation state | `component-code-storage` |
| feedbackStore | `src/stores/feedbackStore.js` | Extraction corrections, feedback settings | `feedback-storage` |

---

### Component Subscriptions

#### UMSEditor.jsx (Heaviest Store User)
**File:** `src/components/measure/UMSEditor.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `measures`, `selectedMeasureId`, `activeTab`, `corrections` | `updateMeasure`, `setActiveTab`, `addCodeToValueSet`, `removeCodeFromValueSet`, `saveTimingOverride`, `toggleLogicalOperator`, `setOperatorBetweenSiblings`, `approveElement`, `flagElement`, `clearReviewStatus`, `addCorrection`, `clearCorrections`, `updateDataElement`, `syncAgeRange`, `updateTimingWindow`, `deleteComponent`, `addComponentToPopulation` |
| componentLibraryStore | `components`, `selectedComponentId` | `getComponent`, `linkMeasureComponents`, `mergeComponents`, `syncComponentToMeasures`, `recalculateUsage`, `addComponent`, `updateComponent` |
| componentCodeStore | `codeStates` | `getCodeState`, `setCodeFormat`, `addOverride`, `addEditNote` |
| settingsStore | `apiKeys`, `aiProvider`, `vsacApiKey` | - |

**Total Actions:** 27

**Feedback Capture Points (via measureStore actions):**
- `updateDataElement` → captures inline field edits
- `deleteComponent` → captures `component_hallucination` pattern
- `addComponentToPopulation` → captures `component_missing` pattern
- `toggleLogicalOperator` → captures `logical_operator_error` pattern
- `setOperatorBetweenSiblings` → captures operator changes
- `addCodeToValueSet` / `removeCodeFromValueSet` → captures `code_wrong` pattern

**NodeDetailPanel Sub-component:**
- Uses `updateComponent` for bidirectional library sync
- Uses `vsacApiKey` from settingsStore for inline VSAC fetching
- VsacFetchButton calls `fetchValueSetExpansion` from vsacService

---

#### MeasureLibrary.jsx
**File:** `src/components/measure/MeasureLibrary.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `measures`, `selectedMeasureId`, `activeTab` | `addMeasure`, `updateMeasure`, `deleteMeasure`, `setSelectedMeasure`, `duplicateMeasure`, `exportMeasure`, `setActiveTab` |
| componentLibraryStore | `components` | `linkMeasureComponents`, `recalculateUsage`, `initializeWithSampleData` |
| settingsStore | `apiKeys`, `aiProvider` | - |

**Total Actions:** 14

---

#### LibraryBrowser.jsx
**File:** `src/components/library/LibraryBrowser.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| componentLibraryStore | `components`, `selectedComponentId`, `editingComponentId`, `filters`, `pendingSync`, `isSyncing` | `setSelectedComponent`, `setEditingComponent`, `setFilters`, `deleteComponent`, `recalculateUsage`, `initializeWithSampleData`, `getSyncStatus`, `retryPendingSync` |
| measureStore | `measures` | - |

**Total Actions:** 8

**Sync Status:** Can display pending sync indicator and trigger retry via `getSyncStatus()` and `retryPendingSync()`

---

#### ComponentEditor.jsx
**File:** `src/components/library/ComponentEditor.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| componentLibraryStore | `components`, `editingComponentId` | `addComponent`, `updateComponent`, `getComponent`, `syncComponentToMeasures`, `handleSharedEdit`, `recalculateUsage`, `setEditingComponent` |
| measureStore | `measures` | `updateMeasure` |

**Total Actions:** 8

---

#### ComponentDetail.jsx
**File:** `src/components/library/ComponentDetail.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| componentLibraryStore | `components`, `selectedComponentId` | `approve`, `archive`, `getComponent`, `updateComponent` |
| componentCodeStore | `codeStates` | `getCodeState` |

**Total Actions:** 5

---

#### CodeGeneration.jsx
**File:** `src/components/measure/CodeGeneration.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `measures`, `selectedMeasureId`, `selectedCodeFormat`, `measureCodeOverrides` | `setSelectedCodeFormat`, `setLastGeneratedCode`, `saveMeasureCodeOverride`, `revertMeasureCodeOverride`, `getMeasureCodeOverride` |
| componentLibraryStore | `components` | - |
| componentCodeStore | `codeStates` | - |

**Total Actions:** 5

**Note:** Subscribes to componentLibraryStore.components and componentCodeStore.codeStates for reactive code regeneration when library components or code overrides change.

---

#### MeasureCodeEditor.jsx
**File:** `src/components/measure/MeasureCodeEditor.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `measureCodeOverrides` (via props) | `saveMeasureCodeOverride`, `revertMeasureCodeOverride` (via callbacks) |

**Total Actions:** 2 (via parent)

**Features:**
- Intuitive code editor for non-technical users
- Edit history with clickable per-edit diffs
- Required notes for audit trail
- Visual diff viewer (before/after)

---

#### CopilotPanel.jsx
**File:** `src/components/copilot/CopilotPanel.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `measures`, `selectedMeasureId`, `lastGeneratedCode`, `measureCodeOverrides` | `saveMeasureCodeOverride` |
| componentLibraryStore | `components` | - |
| settingsStore | `apiKeys`, `selectedProvider`, `selectedModel` | - |

**Total Actions:** 1

**Features:**
- Floating chat interface with measure context
- Structured proposal system (field edits, code fixes)
- Visual diff display for code proposals
- Applied proposals logged to edit history

---

#### ValueSetManager.jsx
**File:** `src/components/valueset/ValueSetManager.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `measures`, `selectedMeasureId` | `addCodeToValueSet`, `removeCodeFromValueSet`, `updateValueSet` |

**Total Actions:** 3

---

#### ValidationView.jsx
**File:** `src/components/validation/ValidationView.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `measures`, `selectedMeasureId` | - |

**Total Actions:** 0 (read-only)

---

#### MeasureCreator.jsx
**File:** `src/components/measure/MeasureCreator.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | - | `addMeasure` |
| settingsStore | `apiKeys`, `aiProvider` | - |

**Total Actions:** 1

---

#### SettingsPage.jsx
**File:** `src/components/settings/SettingsPage.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| settingsStore | `theme`, `codeGenTarget`, `aiProvider`, `apiKeys` | `setTheme`, `setCodeGenTarget`, `setAIProvider`, `setApiKey` |
| feedbackStore | `feedbackEnabled`, `feedbackInjectionEnabled`, `corrections` | `setFeedbackEnabled`, `setFeedbackInjectionEnabled`, `getFilteredCorrections`, `getPatternStats`, `getAccuracyMetrics`, `clearCorrections` |

**Total Actions:** 10

**Extraction Feedback Tab Features:**
- Toggle for feedback capture (feedbackEnabled)
- Toggle for prompt injection (feedbackInjectionEnabled)
- Stats dashboard: total corrections, measures reviewed, avg per measure
- Pattern breakdown chart (bar chart by pattern type)
- Filterable correction log with severity badges and strikethrough diffs

---

#### Sidebar.jsx
**File:** `src/components/layout/Sidebar.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `activeTab`, `selectedMeasureId` | `setActiveTab` |
| componentLibraryStore | `selectedCategory` | `setSelectedCategory` |
| settingsStore | `theme` | - |

**Total Actions:** 2

**Features:**
- Component Library category submenu nested under Components tab
- Categories: Demographics, Encounters, Conditions, Procedures, etc.

---

#### ComponentDetailPanel.jsx
**File:** `src/components/measure/ComponentDetailPanel.jsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| componentCodeStore | `codeStates` | `getCodeState`, `setCodeFormat`, `addOverride`, `addEditNote` |

**Total Actions:** 4

---

### Store Action Usage Summary

| Store | Total Actions | Used By Components |
|-------|---------------|-------------------|
| measureStore | 25 actions | 12 components |
| componentLibraryStore | 19 actions | 6 components |
| feedbackStore | 8 actions | 3 components |
| componentCodeStore | 6 actions | 3 components |
| settingsStore | 4 actions | 3 components |

---

## 2. Service Call Graph

### Service Files Overview

| Service | Primary Purpose | Key Exports |
|---------|-----------------|-------------|
| `measureIngestion.js` | Document parsing & measure creation | `ingestMeasureFiles`, `parsePDFDocument` |
| `aiExtractor.js` | AI-powered data extraction | `extractMeasureWithAI`, `extractPopulations` |
| `extractionService.js` | Extraction orchestration with feedback | `extractMeasure`, `extractMeasureMultiPass` |
| `documentLoader.js` | File loading & text extraction | `extractFromFiles`, `extractFromPDF` |
| `cqlGenerator.js` | CQL code generation | `generateCQL`, `validateCQL` |
| `hdiSqlGenerator.js` | HDI SQL generation | `generateHDISQL`, `validateHDISQLDetailed` |
| `componentLibraryService.js` | Component CRUD operations | `createAtomicComponent`, `createCompositeComponent`, `approveComponent` |
| `componentMatcher.js` | Library matching | `findExactMatch`, `parseDataElementToComponent` |
| `componentCodeGenerator.js` | Per-component code | `generateComponentCode`, `generateDataElementCode` |
| `testPatientGenerator.js` | Test patient creation | `generateTestPatients`, `generatePatientBundle` |
| `measureEvaluator.js` | Measure evaluation | `evaluateMeasure`, `evaluatePopulation` |
| `complexityCalculator.js` | Complexity scoring | `calculateDataElementComplexity`, `calculateCompositeComplexity` |
| `copilotService.js` | AI AND/OR.ai Co-Pilot context & messaging | `buildCopilotContext`, `buildCopilotSystemPrompt`, `sendCopilotMessage` |
| `copilotProviders.js` | Modular LLM provider architecture | `AnthropicProvider`, `OpenAIProvider`, `getProvider` |
| `vsacService.js` | VSAC API integration | `fetchValueSetExpansion` |
| `vsacCodeCache.js` | Local VSAC code cache | `getCodesForOid`, `hasCodesForOid` |
| `catalogueClassifier.js` | Document catalogue type detection | `classifyDocument` |
| `classifierFeedback.js` | Classifier feedback API client | `recordClassifierFeedback`, `recordClassifierFeedbackAsync` |
| `api.js` | External API calls | `fetchVSACValueSet`, `callLLM` |

---

### Call Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INGESTION PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MeasureCreator.jsx                                                          │
│         │                                                                    │
│         ▼                                                                    │
│  measureIngestion.js::ingestMeasureFiles()                                   │
│         │                                                                    │
│         ├──▶ documentLoader.js::extractFromFiles()                           │
│         │         │                                                          │
│         │         └──▶ extractFromPDF() ──▶ pdf.js library                   │
│         │                                                                    │
│         └──▶ aiExtractor.js::extractMeasureWithAI()                          │
│                   │                                                          │
│                   ├──▶ extractPopulations()                                  │
│                   ├──▶ extractValueSets()                                    │
│                   └──▶ api.js::callLLM() ──▶ Anthropic/OpenAI API            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      EXTRACTION FEEDBACK PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  extractionService.js::extractMeasure()                                      │
│         │                                                                    │
│         ├──▶ feedbackStore.generateExtractionGuidance(catalogueType)         │
│         │         │                                                          │
│         │         ├──▶ Filter corrections by catalogue type                  │
│         │         ├──▶ Prioritize by severity + recency                      │
│         │         ├──▶ Group by pattern type                                 │
│         │         └──▶ Build guidance text (max ~2000 chars)                 │
│         │                                                                    │
│         └──▶ Inject into system prompt: EXTRACTION_PROMPT + feedbackGuidance │
│                   │                                                          │
│                   └──▶ LLM API call with enhanced prompt                     │
│                                                                              │
│  Feedback Capture (triggered by user edits in UMSEditor):                    │
│         │                                                                    │
│         ├──▶ measureStore.updateDataElement() → feedbackStore.recordCorrection()
│         ├──▶ measureStore.deleteComponent() → records 'component_hallucination'
│         ├──▶ measureStore.addComponentToPopulation() → records 'component_missing'
│         ├──▶ measureStore.toggleLogicalOperator() → records 'logical_operator_error'
│         └──▶ measureStore.addCodeToValueSet() → records 'code_wrong'         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        CODE GENERATION PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CodeGeneration.jsx                                                          │
│         │                                                                    │
│         ├──▶ cqlGenerator.js::generateCQL()                                  │
│         │         │                                                          │
│         │         ├──▶ generateHeader()                                      │
│         │         ├──▶ generateValueSetDeclarations()                        │
│         │         ├──▶ generatePopulationDefinitions()                       │
│         │         └──▶ validateCQL() ──▶ (external CQL translator)           │
│         │                                                                    │
│         └──▶ hdiSqlGenerator.js::generateHDISQL()                            │
│                   │                                                          │
│                   ├──▶ extractPredicatesFromUMS()                            │
│                   ├──▶ generatePredicateCTEs()                               │
│                   │         ├──▶ generateDemographicsPredicateCTE()          │
│                   │         ├──▶ generateConditionPredicateCTE()             │
│                   │         ├──▶ generateEncounterPredicateCTE()             │
│                   │         └──▶ generateProcedurePredicateCTE()             │
│                   ├──▶ generatePopulationLogic()                             │
│                   └──▶ validateHDISQLDetailed()                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     COMPONENT LIBRARY MANAGEMENT                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ComponentEditor.jsx / UMSEditor.jsx                                         │
│         │                                                                    │
│         ▼                                                                    │
│  componentLibraryStore.js                                                    │
│         │                                                                    │
│         ├──▶ componentLibraryService.js::createAtomicComponent()             │
│         │                                                                    │
│         ├──▶ componentLibraryService.js::createCompositeComponent()          │
│         │                                                                    │
│         ├──▶ componentMatcher.js::findExactMatch()                           │
│         │         │                                                          │
│         │         └──▶ parseDataElementToComponent()                         │
│         │                                                                    │
│         ├──▶ componentLibraryService.js::approveComponent()                  │
│         │                                                                    │
│         └──▶ complexityCalculator.js::calculateDataElementComplexity()       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         VALIDATION PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ValidationView.jsx                                                          │
│         │                                                                    │
│         ├──▶ testPatientGenerator.js::generateTestPatients()                 │
│         │         │                                                          │
│         │         └──▶ generatePatientBundle()                               │
│         │                                                                    │
│         └──▶ measureEvaluator.js::evaluateMeasure()                          │
│                   │                                                          │
│                   ├──▶ evaluatePopulation()                                  │
│                   ├──▶ matchResourcesToElement()                             │
│                   └──▶ generateEvaluationTrace()                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI CO-PILOT PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CopilotPanel.jsx                                                            │
│         │                                                                    │
│         ├──▶ copilotService.js::buildCopilotContext()                        │
│         │         │                                                          │
│         │         ├──▶ Read measureStore.lastGeneratedCode                   │
│         │         ├──▶ Read componentLibraryStore.components                 │
│         │         └──▶ Build measure structure context                       │
│         │                                                                    │
│         ├──▶ copilotService.js::buildCopilotSystemPrompt()                   │
│         │         │                                                          │
│         │         └──▶ Generate CQL/FHIR domain-aware system prompt          │
│         │                                                                    │
│         └──▶ copilotService.js::sendCopilotMessage()                         │
│                   │                                                          │
│                   └──▶ copilotProviders.js::getProvider()                    │
│                             │                                                │
│                             ├──▶ AnthropicProvider → Anthropic API           │
│                             └──▶ OpenAIProvider → OpenAI API                 │
│                                                                              │
│  Proposal Flow:                                                              │
│         │                                                                    │
│         └──▶ CopilotPanel.jsx::handleApplyProposal()                         │
│                   │                                                          │
│                   └──▶ measureStore.saveMeasureCodeOverride()                │
│                             │                                                │
│                             └──▶ Logs to edit history with "AND/OR.ai Co-Pilot fix:"   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         CODE CUSTOMIZATION PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CodeGeneration.jsx                                                          │
│         │                                                                    │
│         ├──▶ Generate CQL/SQL                                                │
│         │         │                                                          │
│         │         └──▶ measureStore.setLastGeneratedCode()                   │
│         │                   (stores for AND/OR.ai Co-Pilot context)                    │
│         │                                                                    │
│         └──▶ MeasureCodeEditor.jsx                                           │
│                   │                                                          │
│                   ├──▶ User edits code                                       │
│                   ├──▶ Requires note (audit trail)                           │
│                   ├──▶ measureStore.saveMeasureCodeOverride()                │
│                   │         │                                                │
│                   │         ├──▶ Stores codeBefore/codeAfter per edit        │
│                   │         └──▶ Appends to edit history                     │
│                   │                                                          │
│                   └──▶ measureStore.revertMeasureCodeOverride()              │
│                             │                                                │
│                             └──▶ Clears override, returns to generated       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Service Dependencies Matrix

| Caller Service | Calls To | Purpose |
|----------------|----------|---------|
| measureIngestion | documentLoader | PDF/Word parsing |
| measureIngestion | aiExtractor | AI-based extraction |
| aiExtractor | api | LLM API calls |
| hdiSqlGenerator | complexityCalculator | Complexity assessment |
| componentLibraryStore | componentLibraryService | CRUD operations |
| componentLibraryStore | componentMatcher | Library matching |
| componentLibraryStore | complexityCalculator | Complexity scoring |
| testPatientGenerator | (standalone) | Patient generation |
| measureEvaluator | (standalone) | Measure evaluation |
| copilotService | copilotProviders | LLM provider selection |
| copilotService | measureStore | Context building (lastGeneratedCode) |
| copilotService | componentLibraryStore | Component context |
| CopilotPanel | copilotService | Message handling |
| CopilotPanel | measureStore | Apply proposals |
| extractionService | feedbackStore | Prompt injection guidance |
| measureStore | feedbackStore | Correction capture on edits |
| SettingsPage | feedbackStore | Feedback dashboard display |
| MeasureLibrary | catalogueClassifier | Document classification before ingestion |
| MeasureLibrary | classifierFeedback | Record user confirmation/override |
| CatalogueConfirmationChip | classifierFeedback | Fire-and-forget feedback recording |

---

## 3. Event and Data Flow Sequences

### Flow 1: Import a Measure from PDF

```
User Action: Upload PDF in MeasureCreator modal
    │
    ▼
MeasureCreator.jsx (lines 88-124)
    │ captures file upload
    ▼
documentLoader.js::extractFromFiles()
    │
    ▼
documentLoader.js::extractFromPDF() (lines 127-193)
    │ uses pdf.js to parse pages
    ▼
measureIngestion.js::ingestMeasureFiles()
    │
    ├──▶ aiExtractor.js::extractMeasureWithAI()
    │         │
    │         └──▶ api.js::callLLM() → Anthropic/OpenAI
    │
    ▼
Component State Updates:
    • uploadedFiles
    • extractedDocuments
    • extractedContent
    │
    ▼
measureStore.addMeasure(measure)
    │
    ▼
componentLibraryStore.linkMeasureComponents()
    │
    ▼
UI: Measure appears in library, components linked
```

---

### Flow 2: Create a New Component in the Library

```
User Action: Click "New Component" in LibraryBrowser
    │
    ▼
LibraryBrowser.jsx (lines 159-161)
    │ handleNewComponent()
    ▼
ComponentEditor.jsx opens (lines 78-340)
    │ form creation with type selection
    ▼
User fills form, clicks Save
    │
    ▼
ComponentEditor.jsx::handleSave() (lines 219-250)
    │
    ├──▶ componentLibraryService::createAtomicComponent()
    │    OR
    └──▶ componentLibraryService::createCompositeComponent()
    │
    ▼
componentLibraryStore.addComponent(component)
    │
    ▼
State Changes:
    • components: [...components, newComponent]
    • selectedComponentId: newComponent.id
    • editingComponentId: null
    │
    ▼
UI: Component appears in list with "Draft" badge
```

---

### Flow 3: Merge Selected Components in UMS Editor

```
User Action: Select components via checkboxes → Click "Merge"
    │
    ▼
UMSEditor.jsx::toggleMergeSelection() (lines 59-69)
    │ manages Set of selected IDs
    ▼
UMSEditor.jsx merge dialog (lines 788-810)
    │ user enters merged component name
    ▼
componentLibraryStore.mergeComponents() (lines 714-822)
    │
    ├──▶ Collect value sets from all selected components
    ├──▶ Deduplicate codes across value sets
    ├──▶ Create new composite component with OR logic
    └──▶ Archive original components (status = 'archived')
    │
    ▼
State Changes:
    • New merged component added to components[]
    • Original components: status → 'archived'
    • selectedForMerge: cleared
    │
    ▼
UI: Merged component appears, originals show "Archived"
```

---

### Flow 4: Edit a Value Set Code

```
User Action: Select value set → Add/Remove code
    │
    ▼
ValueSetManager.jsx (lines 18-180)
    │ inline code editing
    ▼
measureStore.addCodeToValueSet() (lines 325-408)
  OR measureStore.removeCodeFromValueSet()
    │
    ├──▶ Creates MeasureCorrection record
    │       correctionType: 'code_added' | 'code_removed'
    └──▶ Updates valueSets[i].codes array
    │
    ▼
State Changes:
    • measure.valueSets[i].codes: updated
    • measure.corrections: [..., newCorrection]
    • measure.updatedAt: timestamp
    │
    ▼
UI: Code count updates, correction indicator shows
```

---

### Flow 5: Generate CQL Code

```
User Action: Navigate to Code Gen tab → Select CQL format
    │
    ▼
CodeGeneration.jsx (lines 35-41)
    │ useEffect triggers on format change
    ▼
cqlGenerator.js::generateCQL(measure) (lines 71-155)
    │
    ├──▶ generateHeader()
    ├──▶ generateValueSetDeclarations()
    ├──▶ generateParameters()
    ├──▶ generateHelperDefinitions()
    ├──▶ generatePopulationDefinitions()
    └──▶ generateSupplementalData()
    │
    ▼
Component State:
    • generationResult: CQLGenerationResult
    • format: 'cql'
    │
    ▼
UI: CQL displays in syntax-highlighted editor
    Copy/Validate/Download buttons enabled
```

---

### Flow 6: Generate HDI SQL Code

```
User Action: Navigate to Code Gen → Select HDI SQL button
    │
    ▼
CodeGeneration.jsx (lines 43-63)
    │ useEffect calls generateHDISQL()
    ▼
hdiSqlGenerator.js::generateHDISQL(measure, config) (lines 73-150)
    │
    ├──▶ extractPredicatesFromUMS() (lines 159-203)
    │       walks clause tree, maps data elements
    │
    ├──▶ Generate CTEs:
    │       • generateDemographicsPredicateCTE()
    │       • generateConditionPredicateCTE()
    │       • generateResultPredicateCTE()
    │       • generateProcedurePredicateCTE()
    │       • generateMedicationPredicateCTE()
    │       • generateEncounterPredicateCTE()
    │
    ├──▶ generatePopulationLogic()
    └──▶ generateFullSQL()
    │
    ▼
Component State:
    • hdiResult: SQLGenerationResult
    • format: 'hdi'
    │
    ▼
UI: BigQuery SQL displays with CTEs and comments
```

---

### Flow 7: Link a Data Element to a Library Component

```
Trigger: Measure loads or "Link Component" clicked
    │
    ▼
UMSEditor.jsx (lines 170-185)
    │ useEffect on mount
    ▼
componentLibraryStore.linkMeasureComponents(measureId, populations)
    │ (lines 302-491)
    ▼
Process:
    ├──▶ Collect all data elements from populations
    ├──▶ For each element:
    │       ├──▶ componentMatcher::parseDataElementToComponent()
    │       ├──▶ componentMatcher::findExactMatchPrioritizeApproved()
    │       ├──▶ If match: link, sync codes, add usage
    │       ├──▶ If no match + has codes: create new atomic
    │       └──▶ If no codes: mark '__ZERO_CODES__'
    └──▶ For each clause: try composite matching
    │
    ▼
State Changes:
    • element.libraryComponentId: set
    • component.usage.measureIds: updated
    • component.usage.usageCount: incremented
    │
    ▼
UI: Data element shows linked badge, usage counts update
```

---

### Flow 8: Approve a Library Component

```
User Action: Click "Approve" in ComponentDetail panel
    │
    ▼
ComponentDetail.jsx (lines 81-83)
    │ handleApprove() callback
    ▼
componentLibraryStore.approve(componentId, 'current-user')
    │ (lines 247-255)
    ▼
componentLibraryService::approveComponent(component, approvedBy)
    │
    ├──▶ Creates new version entry in versionHistory
    ├──▶ Sets versionInfo.status = 'approved'
    └──▶ Sets approvedAt, approvedBy
    │
    ▼
State Changes:
    • versionInfo.status: 'approved'
    • versionInfo.versionHistory: [..., approvalEntry]
    • versionInfo.approvedAt: ISO timestamp
    • versionInfo.approvedBy: 'current-user'
    │
    ▼
UI: Status badge → "Approved" (green), version history updated
```

---

### Flow 9: Toggle an Operator (AND/OR) in the Criteria Tree

```
User Action: Click operator button on logical clause
    │
    ▼
LogicTreeEditor.jsx
    │ receives onToggleOperator callback from UMSEditor
    ▼
measureStore.toggleLogicalOperator(measureId, clauseId)
    │ (lines 623-651)
    ▼
Process:
    ├──▶ Recursively walk populations tree
    ├──▶ Find clause matching clauseId
    ├──▶ Cycle operator: AND → OR → NOT → AND
    └──▶ Return updated clause
    │
    ▼
State Changes:
    • populations[i].criteria.operator: cycled
    • measure.updatedAt: timestamp
    │
    ▼
UI: Operator button text/color changes, tree updates
```

---

### Flow 10: Save Timing Override on a Data Element

```
User Action: Click timing badge → Edit → Save
    │
    ▼
TimingEditor.jsx::TimingBadge (lines 100-135)
    │ onClick opens editor
    ▼
TimingEditorPanel (lines 146-190)
    │ user modifies operator/quantity/unit
    ▼
User clicks "Save"
    │
    ▼
measureStore.updateTimingOverride(measureId, componentId, modified)
    │ (lines 798-836)
    ▼
Process:
    ├──▶ Walk populations to find component by ID
    └──▶ Update timingOverride: { modified, modifiedAt, modifiedBy }
    │
    ▼
State Changes:
    • timingOverride.modified: new TimingConstraint
    • timingOverride.modifiedAt: ISO timestamp
    • timingOverride.modifiedBy: 'user'
    • measure.updatedAt: timestamp
    │
    ▼
UI: Panel closes, badge shows warning color, reset button appears
```

---

### Flow 11: Ask AND/OR.ai Co-Pilot a Question

```
User Action: Opens AND/OR.ai Co-Pilot panel → Types question → Send
    │
    ▼
CopilotPanel.jsx (lines 180-220)
    │ handleSend() captures message
    ▼
copilotService.js::buildCopilotContext()
    │
    ├──▶ Reads measureStore.lastGeneratedCode (CQL + SQL)
    ├──▶ Reads componentLibraryStore.components
    ├──▶ Reads measure populations and value sets
    └──▶ Returns structured context object
    │
    ▼
copilotService.js::buildCopilotSystemPrompt(context)
    │
    ├──▶ Generates CQL/FHIR domain-aware instructions
    ├──▶ Includes measure structure in prompt
    └──▶ Defines proposal JSON response format
    │
    ▼
copilotService.js::sendCopilotMessage(history, context, settings)
    │
    └──▶ copilotProviders.js::getProvider(settings.provider)
              │
              ├──▶ AnthropicProvider.chat() → Anthropic API
              └──▶ OpenAIProvider.chat() → OpenAI API
    │
    ▼
State Changes:
    • conversationHistory: [...history, userMsg, assistantMsg]
    • isLoading: false
    │
    ▼
UI: Response displays, may include ProposalCard if structured proposal
```

---

### Flow 12: Apply AND/OR.ai Co-Pilot Code Fix Proposal

```
User Action: Clicks "Apply" on ProposalCard
    │
    ▼
CopilotPanel.jsx::handleApplyProposal(messageId, proposal)
    │
    ├──▶ Extracts proposal.action === 'propose_code_fix'
    ├──▶ Gets current code from measureStore.lastGeneratedCode
    ├──▶ Applies proposal.code_snippet (new code)
    │
    ▼
measureStore.saveMeasureCodeOverride(measureId, format, code, note, originalCode)
    │
    ├──▶ Creates note entry with "AND/OR.ai Co-Pilot fix: {description}"
    ├──▶ Stores codeBefore (original) and codeAfter (fixed)
    └──▶ Appends to measureCodeOverrides[key].notes[]
    │
    ▼
State Changes:
    • measureCodeOverrides[measureId::format].code: updated
    • measureCodeOverrides[measureId::format].notes: [..., newNote]
    • proposal.applied: true
    │
    ▼
UI: ProposalCard shows "Applied" badge, edit history updated
```

---

### Flow 13: Customize Code in MeasureCodeEditor

```
User Action: Clicks "Customize Code" → Edits → Adds note → Save
    │
    ▼
MeasureCodeEditor.jsx (lines 85-120)
    │ Opens edit mode
    ▼
User modifies code in textarea
    │
    ▼
User enters required note (min 10 chars)
    │
    ▼
MeasureCodeEditor.jsx::handleSave()
    │
    └──▶ Parent callback → CodeGeneration.jsx::handleSaveCodeOverride()
              │
              └──▶ measureStore.saveMeasureCodeOverride(measureId, format, code, note, originalCode)
                        │
                        ├──▶ Calculates codeBefore from previous state
                        ├──▶ Creates note entry with timestamp
                        └──▶ Updates override state
    │
    ▼
State Changes:
    • measureCodeOverrides[key].code: new code
    • measureCodeOverrides[key].notes: [..., { codeBefore, codeAfter, content, timestamp }]
    • measureCodeOverrides[key].lastModifiedAt: ISO timestamp
    │
    ▼
UI: "Custom Override" badge appears, edit history shows entry
     Click history entry → expands to show per-edit diff
```

---

### Flow 14: Revert Code to Generated

```
User Action: Clicks "Revert to Original" in MeasureCodeEditor
    │
    ▼
MeasureCodeEditor.jsx::handleRevert()
    │
    └──▶ Parent callback → CodeGeneration.jsx::handleRevertCodeOverride()
              │
              └──▶ measureStore.revertMeasureCodeOverride(measureId, format)
                        │
                        └──▶ Deletes measureCodeOverrides[key]
    │
    ▼
State Changes:
    • measureCodeOverrides[key]: deleted
    │
    ▼
UI: Code reverts to generated, "Custom Override" badge removed
     Edit history cleared
```

---

### Flow 15: Edit Value Set in UMS Editor NodeDetailPanel

```
User Action: Click "Edit" on value set section in NodeDetailPanel
    │
    ▼
NodeDetailPanel (UMSEditor.jsx)
    │ setEditingValueSet(true)
    ▼
User modifies OID or VS Name
    │
    ▼
onBlur triggers saveValueSetChanges({ oid/name })
    │
    ├──▶ measureStore.updateDataElement(measureId, nodeId, { valueSet: updated })
    │
    └──▶ componentLibraryStore.updateComponent(libraryComponentId, { valueSet: updated })
              │ (bidirectional sync if linked)
    │
    ▼
State Changes:
    • node.valueSet.oid/name: updated
    • linkedComponent.valueSet.oid/name: synced
    │
    ▼
UI: Value set fields show new values, library component updated
```

---

### Flow 16: Fetch Codes from VSAC in NodeDetailPanel

```
User Action: Click "Fetch from VSAC" button (VsacFetchButton)
    │
    ▼
VsacFetchButton::handleFetch()
    │
    ├──▶ Check vsacApiKey from settingsStore
    │
    └──▶ vsacService.js::fetchValueSetExpansion(oid, apiKey)
              │
              └──▶ VSAC API → returns { codes, valueSetName, version }
    │
    ▼
onCodesReceived callback:
    │
    ├──▶ Merge with existing codes (deduplicate by system|code)
    ├──▶ setLocalCodes(merged)
    └──▶ saveValueSetChanges({ codes: merged, name?: fetchedName })
              │
              ├──▶ measureStore.updateDataElement()
              └──▶ componentLibraryStore.updateComponent()
    │
    ▼
State Changes:
    • localCodes: merged codes array
    • node.valueSet.codes: updated
    • linkedComponent.valueSet.codes: synced
    │
    ▼
UI: Codes table populates, "Fetched X codes" success message
```

---

### Flow 17: Add Code Manually in NodeDetailPanel

```
User Action: Click "+ Add Code" → Fill form → Click "Add"
    │
    ▼
NodeDetailPanel (UMSEditor.jsx)
    │ showAddCodeForm = true
    ▼
User enters: code, display, system (dropdown)
    │
    ▼
Click "Add" button:
    │
    ├──▶ const updated = [...localCodes, { code, display, system }]
    ├──▶ setLocalCodes(updated)
    └──▶ saveValueSetChanges({ codes: updated })
              │
              ├──▶ measureStore.updateDataElement()
              └──▶ componentLibraryStore.updateComponent()
    │
    ▼
State Changes:
    • localCodes: [..., newCode]
    • node.valueSet.codes: updated
    • linkedComponent.valueSet.codes: synced
    │
    ▼
UI: New code appears in table, form resets
```

---

### Flow 18: Add Component from Library Modal

```
User Action: Click "+" on population clause → Select from Library tab
    │
    ▼
AddComponentModal.jsx opens
    │
    ├──▶ Load componentLibraryStore.components
    ├──▶ Filter by category (dropdown)
    └──▶ Search by name/description/OID
    │
    ▼
User clicks component → clicks "Add to Measure"
    │
    ▼
measureStore.addComponentToPopulation(measureId, populationId, component)
    │
    ├──▶ Create new DataElement from component
    ├──▶ Set libraryComponentId link
    ├──▶ Copy valueSet, timing from component
    └──▶ Insert into population criteria
    │
    ▼
componentLibraryStore.addUsageReference(componentId, measureId)
    │
    ▼
State Changes:
    • population.criteria.children: [..., newElement]
    • component.usage.measureIds: [..., measureId]
    • component.usage.usageCount: incremented
    │
    ▼
UI: Component appears in population tree, linked to library
```

---

### Flow 21: Retry Pending Backend Sync

```
Trigger: User clicks "Retry Sync" or app calls retryPendingSync()
    │
    ▼
componentLibraryStore.retryPendingSync()
    │
    ├──▶ Check if already syncing (isSyncing) → return early if true
    ├──▶ Check if pendingSync.size === 0 → return early if nothing to sync
    │
    ├──▶ set({ isSyncing: true })
    │
    └──▶ For each [componentId, syncInfo] in pendingSync:
              │
              ├──▶ Skip if retryCount >= 3 (max retries exceeded)
              │
              ├──▶ If operation === 'create':
              │         └──▶ api/components::createAtomicComponent()
              │
              ├──▶ If operation === 'update':
              │         └──▶ api/components::updateComponent()
              │
              └──▶ If operation === 'delete':
                        └──▶ api/components::deleteComponent()
              │
              ├──▶ On success: clearPendingSync(componentId)
              └──▶ On failure: markPendingSync() with incremented retryCount
    │
    ▼
set({ isSyncing: false })
    │
    ▼
Return: { succeeded: N, failed: M }
```

---

### Flow 19: Capture Feedback on Component Deletion

```
User Action: Delete component in UMS Editor (Deep Edit mode)
    │
    ▼
UMSEditor.jsx::handleDeleteComponent()
    │
    ▼
measureStore.deleteComponent(measureId, componentId)
    │ (src/stores/measureStore.js)
    │
    ├──▶ Find element in population tree
    ├──▶ Compare with _originalExtraction snapshot
    ├──▶ If element existed in original extraction:
    │         │
    │         └──▶ feedbackStore.recordCorrection({
    │                   correctionType: 'element_deleted',
    │                   pattern: 'component_hallucination',
    │                   originalValue: deleted element data,
    │                   correctedValue: null,
    │                   severity: 'high'
    │               })
    │
    └──▶ Remove element from population criteria
    │
    ▼
State Changes:
    • population.criteria.children: element removed
    • feedbackStore.corrections: [..., newCorrection]
    │
    ▼
UI: Component removed from tree, feedback captured silently
```

---

### Flow 20: Inject Feedback into Extraction

```
Trigger: User imports new measure document
    │
    ▼
MeasureCreator.jsx / MeasureLibrary.jsx
    │
    ▼
extractionService.js::extractMeasure(skeleton, text, settings)
    │
    ├──▶ const catalogueType = skeleton.metadata?.program?.toLowerCase()
    │
    ├──▶ feedbackStore.generateExtractionGuidance(catalogueType)
    │         │
    │         ├──▶ Filter: corrections for same catalogue (MIPS, HEDIS, etc.)
    │         ├──▶ Sort: high severity first, then recent
    │         ├──▶ Group by pattern type
    │         ├──▶ Build sections:
    │         │       "COMMON EXTRACTION ERRORS TO AVOID:"
    │         │       "- Hallucinations: [examples from corrections]"
    │         │       "- Missing Components: [examples]"
    │         │       "- Value Set Errors: [examples]"
    │         └──▶ Truncate to ~2000 chars
    │
    ├──▶ const enhancedPrompt = EXTRACTION_SYSTEM_PROMPT + feedbackGuidance
    │
    └──▶ LLM API call with enhancedPrompt
              │
              └──▶ Returns improved extraction based on past mistakes
    │
    ▼
Result: Extraction quality improves over time as corrections accumulate
```

---

### Flow 22: Catalogue Auto-Detection During Import

```
User Action: Upload document(s) in MeasureLibrary import flow
    │
    ▼
MeasureLibrary.jsx::processNext() (lines 180-240)
    │
    ├──▶ documentLoader.js::extractFromFiles()
    │         │
    │         └──▶ Extract raw text from PDF/Word document
    │
    ├──▶ catalogueClassifier.js::classifyDocument(rawText)
    │         │
    │         ├──▶ Scan for eCQM signals (CMS, QDM, FHIR patterns)
    │         ├──▶ Scan for MIPS_CQM signals (MIPS, QPP patterns)
    │         ├──▶ Scan for HEDIS signals (HEDIS, NCQA patterns)
    │         ├──▶ Scan for QOF signals (QOF, NHS patterns)
    │         ├──▶ Scan for Clinical_Standard signals
    │         │
    │         ├──▶ Calculate raw scores per catalogue type
    │         └──▶ Determine confidence: high/medium/low
    │
    ▼
Decision Branch:
    │
    ├──▶ If confidence === 'high':
    │         │
    │         └──▶ continueIngestion() directly with detected type
    │
    └──▶ If confidence === 'medium' or 'low':
              │
              └──▶ Show CatalogueConfirmationChip
                        │
                        ├──▶ Display detected type + confidence
                        ├──▶ Show override dropdown
                        │
                        └──▶ Wait for user action
                                  │
                                  ├──▶ On Confirm:
                                  │         │
                                  │         ├──▶ classifierFeedback.js::recordClassifierFeedbackAsync()
                                  │         │         │
                                  │         │         └──▶ POST /api/classifier/feedback
                                  │         │                   │
                                  │         │                   └──▶ Backend stores feedback for training
                                  │         │
                                  │         └──▶ continueIngestion(confirmedType)
                                  │
                                  └──▶ On Cancel:
                                            │
                                            └──▶ processQueue.cancel()
    │
    ▼
continueIngestion() (MeasureLibrary.jsx)
    │
    ├──▶ measureIngestion.js::ingestMeasureFiles()
    │         │
    │         └──▶ Uses detected/confirmed catalogue type for extraction
    │
    └──▶ componentLibraryStore.linkMeasureComponents()
    │
    ▼
UI: Measure appears in library with correct catalogue type
```

**State Management:**

```
pendingConfirmation: {
  files: File[],
  classification: ClassificationResult,
  queueItemId: string
} | null
```

**Ref Pattern (Stale Closure Fix):**
```javascript
const continueIngestionRef = useRef(null);

// In processNext:
if (continueIngestionRef.current) {
  await continueIngestionRef.current(files, catalogueType, queueItemId);
}

// After continueIngestion definition:
useEffect(() => {
  continueIngestionRef.current = continueIngestion;
}, [continueIngestion]);
```

---

## 4. Orphan Report

### Summary

| Category | Count | Severity |
|----------|-------|----------|
| Unused service functions | 19 | Medium |
| Unused convenience wrappers | 4 | Low |
| Unused VSAC API functions | 4 | Medium |
| Unused types | 3+ | Low |
| Unreachable code paths | 2 | Low |
| **Total** | **32+** | - |

---

### Unused Service Exports

#### componentLibraryService.js
| Line | Export | Reason |
|------|--------|--------|
| 334 | `getApprovedComponents()` | Not imported anywhere |
| 338 | `getAffectedMeasures()` | Not imported anywhere |

#### hdiSqlGenerator.js
| Line | Export | Reason |
|------|--------|--------|
| 827 | `generateHDISQLWithContexts()` | Wrapper never called |
| 841 | `generatePopulationSQL()` | Specialized filter never used |
| 766 | `validateHDISQLBasic()` | Superseded by `validateHDISQLDetailed()` |
| 804 | `formatHDISQL()` | SQL formatter never called |

#### cqlGenerator.js
| Line | Export | Reason |
|------|--------|--------|
| 980 | `generateAndValidateCQL()` | Convenience wrapper never used |

#### testPatientGenerator.js
| Line | Export | Reason |
|------|--------|--------|
| 1591 | `getTestPatientById()` | Accessor never called |
| 1598 | `getAllTestPatients()` | Batch accessor never called |

#### api.js
| Line | Export | Reason |
|------|--------|--------|
| 58 | `searchVSAC()` | VSAC search never imported |
| 83 | `getVSACValueSet()` | VSAC metadata never called |
| 104 | `expandVSACValueSet()` | Value set expansion never used |
| 131 | `validateCodeInVSAC()` | Code validation never called |
| 174 | `extractWithLLM()` | Proxy never called (uses aiExtractor directly) |
| 206 | `chatWithLLM()` | Chat proxy never called |
| 238 | `getLLMModels()` | Model listing never used |

#### componentCodeGenerator.js
| Line | Export | Reason |
|------|--------|--------|
| 393 | `generateClauseCode()` | Only internal recursive calls |
| 423 | `generateCQLDefinitionName()` | Never called externally |
| 434 | `generateSQLAlias()` | Never called externally |

#### measureIngestion.js
| Line | Export | Reason |
|------|--------|--------|
| 46 | `ingestMeasureFilesDirect()` | Alternative implementation never used |
| 478 | `previewDocuments()` | Preview function never imported |

---

### Unreachable Code Paths

#### hdiSqlGenerator.js (Lines 917-929)
```typescript
if (typeof child === 'string') {
  return `  select empi_id from ${child}`;
} else {
  return `  select empi_id from ${outputAlias}_nested_${i}`;  // NEVER REACHED
}
```
**Issue:** Nested predicates already converted to strings by line 907

#### cqlGenerator.js (Line 598)
```typescript
lines.push('  true // TODO: Define numerator criteria');
```
**Issue:** Placeholder for undefined numerator (never triggered in normal flow)

---

### Cleanup Recommendations

1. **Remove completely:**
   - All VSAC API functions in `api.js`
   - Both LLM proxy functions in `api.js`
   - componentLibraryService: `getApprovedComponents`, `getAffectedMeasures`
   - testPatientGenerator: `getTestPatientById`, `getAllTestPatients`

2. **Convert to private (remove export):**
   - componentCodeGenerator: `generateClauseCode`, `generateCQLDefinitionName`, `generateSQLAlias`
   - hdiSqlGenerator: `generateHDISQLWithContexts`, `generatePopulationSQL`

3. **Remove convenience wrappers:**
   - `cqlGenerator.generateAndValidateCQL`
   - `measureIngestion.ingestMeasureFilesDirect`

---

## 5. Cross-Store Dependencies

### Direct Store-to-Store Calls

**Finding:** There are **NO direct cross-store `getState()` calls**. Stores communicate exclusively through components passing data between actions.

Internal `get()` calls within measureStore:
- Line 304: `isMeasureLocked()` → `get().measures`
- Line 915: `getActiveMeasure()` → `get()`
- Line 947: `getReviewProgress()` → `get()`
- Line 969: `getCorrections()` → `get()`

---

### Multi-Store Subscriptions

| Component | Stores Used | Integration Point |
|-----------|-------------|-------------------|
| UMSEditor.jsx | 4 stores | Links measures to library, syncs components, captures feedback |
| ComponentEditor.jsx | 2 stores | Updates measures when components change |
| LibraryBrowser.jsx | 2 stores | Recalculates usage from measures |
| MeasureLibrary.jsx | 3 stores | Links components on import |
| ComponentDetail.jsx | 2 stores | Displays code state for components |
| CopilotPanel.jsx | 3 stores | Builds context, applies proposals to measures |
| CodeGeneration.jsx | 1 store | Generates code, manages overrides |
| SettingsPage.jsx | 2 stores | Settings + feedback dashboard |
| extractionService.js | 1 store | Reads feedbackStore for prompt injection |

---

### Cascading Update Sequences

#### Sequence A: Measure Import → Usage Update
```
MeasureLibrary.jsx
    │
    └──▶ measureStore.addMeasure()
              │
              └──▶ componentLibraryStore.linkMeasureComponents()
                        │
                        ├──▶ Match/create components
                        └──▶ addUsageReference()
                                  │
                                  └──▶ componentLibraryStore.recalculateUsage()
```

#### Sequence B: Component Edit → Measure Sync
```
ComponentEditor.jsx
    │
    └──▶ componentLibraryStore.syncComponentToMeasures()
              │
              ├──▶ Get all measures using component
              ├──▶ Update DataElements in each measure
              └──▶ measureStore.updateMeasure() (for each)
```

#### Sequence C: Code Generation → Display
```
CodeGeneration.jsx
    │
    ├──▶ measureStore.selectedCodeFormat
    ├──▶ measureStore.activeMeasure
    ├──▶ generateCQL() / generateHDISQL()
    └──▶ componentCodeStore.getCodeState()
              │
              └──▶ Apply overrides → Display
```

---

### Data Consistency Risks

| Risk | Locations | Issue | Mitigation |
|------|-----------|-------|------------|
| Reference Desync | `component.usage.measureIds` vs `element.libraryComponentId` | Same data in two places | Call `recalculateUsage()` explicitly |
| Override Orphaning | `componentCodeStore.overrides` | Component ID changes orphan overrides | None - ID changes break overrides |
| Settings Staleness | `settingsStore` → `CodeGeneration.jsx` | Code doesn't regenerate on provider change | Manual regenerate required |
| Sample Data Race | `initializeWithSampleData()` | Multiple tabs could overwrite | Single `initialized` flag check |

---

### Implicit Dependencies

| Dependency | Location | Risk |
|------------|----------|------|
| Library lookup for DataElement | UMSEditor.jsx lines 122-149 | `getComponent()` can return null |
| Measure ID mismatch | measureStore vs componentLibraryStore | `measureId` vs `measure.id` confusion |
| Value set code sync | ValueSetManager → Library | Manual sync required, not enforced |
| Complexity calculations | complexityCalculator.js | Different scores at different times |

---

### Dependency Diagram

```
┌─────────────────────┐     passes data     ┌─────────────────────────┐
│   measureStore      │◄───────────────────►│  componentLibraryStore  │
│                     │     via components   │                         │
│ • measures[]        │                      │ • components[]          │
│ • selectedMeasureId │                      │ • selectedComponentId   │
│ • corrections[]     │                      │ • filters               │
└─────────────────────┘                      └─────────────────────────┘
         │                                              │
         │ reads/writes                                 │ reads
         ▼                                              ▼
┌─────────────────────┐                      ┌─────────────────────────┐
│  componentCodeStore │                      │     settingsStore       │
│                     │                      │                         │
│ • codeStates{}      │                      │ • theme                 │
│ • overrides         │                      │ • aiProvider            │
│ • editNotes         │                      │ • apiKeys               │
└─────────────────────┘                      └─────────────────────────┘
         │                                              │
         │                                              │
         ▼                                              ▼
┌─────────────────────┐                      ┌─────────────────────────┐
│    feedbackStore    │◄─────────────────────│   extractionService     │
│                     │  generates guidance  │                         │
│ • corrections[]     │                      │ • injects feedback into │
│ • feedbackEnabled   │                      │   extraction prompts    │
│ • injectionEnabled  │                      │                         │
└─────────────────────┘                      └─────────────────────────┘
         ▲
         │ records corrections
         │
┌─────────────────────┐
│    measureStore     │
│  (edit actions)     │
└─────────────────────┘

                    ┌─────────────────────────────┐
                    │   Components that bridge    │
                    │   multiple stores:          │
                    │                             │
                    │ • UMSEditor (4 stores)      │
                    │ • MeasureLibrary (3 stores) │
                    │ • ComponentEditor (2 stores)│
                    │ • LibraryBrowser (2 stores) │
                    └─────────────────────────────┘
```

---

### Recommendations

1. **Implement Event Bus:** Create cross-store events (e.g., `MeasureDeleted`) to trigger dependent updates

2. **Use Store Watchers:** Add subscriptions that automatically call `recalculateUsage()` when measures change

3. **Unify IDs:** Consistently use `measure.id` (UUID) instead of `measure.metadata.measureId`

4. **Add Cascade Deletion:** When measure deleted, remove from all component `usage.measureIds`

5. **Validate References:** Before using component, check if referenced library component exists

6. **Atomic Sync Pattern:** Never partially update measures; always atomically sync entire populations

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 2026 | AI-assisted | Initial manifest creation |
| 1.1 | Feb 2026 | AI-assisted | Added AND/OR.ai Co-Pilot pipeline, MeasureCodeEditor, code customization flows |
| 1.2 | Feb 2026 | AI-assisted | Added vsacService, vsacCodeCache to services; Sidebar category submenu; NodeDetailPanel value set editing flows (15-17); AddComponentModal flow (18) |
| 1.3 | Feb 2026 | AI-assisted | Added feedbackStore, extraction feedback pipeline, feedback capture flows (19-20), updated cross-store dependencies |
| 1.4 | Feb 2026 | AI-assisted | Added sync status tracking (pendingSync, retryPendingSync), Flow 21 for sync retry |
| 1.5 | Mar 2026 | AI-assisted | Added catalogue auto-detection: catalogueClassifier, classifierFeedback, CatalogueConfirmationChip, Flow 22 |
