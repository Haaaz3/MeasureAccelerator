# AlgoAccelerator Wiring Manifest

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
| measureStore | `src/stores/measureStore.ts` | Measures, corrections, active tab | `measure-storage` |
| componentLibraryStore | `src/stores/componentLibraryStore.ts` | Reusable components | `component-library-storage` |
| settingsStore | `src/stores/settingsStore.ts` | User preferences, API keys | `settings-storage` |
| componentCodeStore | `src/stores/componentCodeStore.ts` | Code generation state | `component-code-storage` |

---

### Component Subscriptions

#### UMSEditor.tsx (Heaviest Store User)
**File:** `src/components/measure/UMSEditor.tsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `measures`, `selectedMeasureId`, `activeTab`, `corrections` | `updateMeasure`, `setActiveTab`, `addCodeToValueSet`, `removeCodeFromValueSet`, `saveTimingOverride`, `toggleLogicalOperator`, `setOperatorBetweenSiblings`, `approveElement`, `flagElement`, `clearReviewStatus`, `addCorrection`, `clearCorrections` |
| componentLibraryStore | `components`, `selectedComponentId` | `getComponent`, `linkMeasureComponents`, `mergeComponents`, `syncComponentToMeasures`, `recalculateUsage`, `addComponent`, `updateComponent` |
| componentCodeStore | `codeStates` | `getCodeState`, `setCodeFormat`, `addOverride`, `addEditNote` |
| settingsStore | `apiKeys`, `aiProvider` | - |

**Total Actions:** 22

---

#### MeasureLibrary.tsx
**File:** `src/components/measure/MeasureLibrary.tsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `measures`, `selectedMeasureId`, `activeTab` | `addMeasure`, `updateMeasure`, `deleteMeasure`, `setSelectedMeasure`, `duplicateMeasure`, `exportMeasure`, `setActiveTab` |
| componentLibraryStore | `components` | `linkMeasureComponents`, `recalculateUsage`, `initializeWithSampleData` |
| settingsStore | `apiKeys`, `aiProvider` | - |

**Total Actions:** 14

---

#### LibraryBrowser.tsx
**File:** `src/components/library/LibraryBrowser.tsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| componentLibraryStore | `components`, `selectedComponentId`, `editingComponentId`, `filters` | `setSelectedComponent`, `setEditingComponent`, `setFilters`, `deleteComponent`, `recalculateUsage`, `initializeWithSampleData` |
| measureStore | `measures` | - |

**Total Actions:** 6

---

#### ComponentEditor.tsx
**File:** `src/components/library/ComponentEditor.tsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| componentLibraryStore | `components`, `editingComponentId` | `addComponent`, `updateComponent`, `getComponent`, `syncComponentToMeasures`, `handleSharedEdit`, `recalculateUsage`, `setEditingComponent` |
| measureStore | `measures` | `updateMeasure` |

**Total Actions:** 8

---

#### ComponentDetail.tsx
**File:** `src/components/library/ComponentDetail.tsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| componentLibraryStore | `components`, `selectedComponentId` | `approve`, `archive`, `getComponent`, `updateComponent` |
| componentCodeStore | `codeStates` | `getCodeState` |

**Total Actions:** 5

---

#### CodeGeneration.tsx
**File:** `src/components/measure/CodeGeneration.tsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `measures`, `selectedMeasureId`, `selectedCodeFormat` | `setSelectedCodeFormat` |

**Total Actions:** 1

---

#### ValueSetManager.tsx
**File:** `src/components/valueset/ValueSetManager.tsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `measures`, `selectedMeasureId` | `addCodeToValueSet`, `removeCodeFromValueSet`, `updateValueSet` |

**Total Actions:** 3

---

#### ValidationView.tsx
**File:** `src/components/validation/ValidationView.tsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `measures`, `selectedMeasureId` | - |

**Total Actions:** 0 (read-only)

---

#### MeasureCreator.tsx
**File:** `src/components/measure/MeasureCreator.tsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | - | `addMeasure` |
| settingsStore | `apiKeys`, `aiProvider` | - |

**Total Actions:** 1

---

#### Settings.tsx
**File:** `src/components/settings/Settings.tsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| settingsStore | `theme`, `codeGenTarget`, `aiProvider`, `apiKeys` | `setTheme`, `setCodeGenTarget`, `setAIProvider`, `setApiKey` |

**Total Actions:** 4

---

#### Sidebar.tsx
**File:** `src/components/layout/Sidebar.tsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| measureStore | `activeTab`, `selectedMeasureId` | `setActiveTab` |
| settingsStore | `theme` | - |

**Total Actions:** 1

---

#### ComponentDetailPanel.tsx
**File:** `src/components/measure/ComponentDetailPanel.tsx`

| Store | State Values Read | Actions Called |
|-------|-------------------|----------------|
| componentCodeStore | `codeStates` | `getCodeState`, `setCodeFormat`, `addOverride`, `addEditNote` |

**Total Actions:** 4

---

### Store Action Usage Summary

| Store | Total Actions | Used By Components |
|-------|---------------|-------------------|
| measureStore | 18 actions | 10 components |
| componentLibraryStore | 15 actions | 5 components |
| componentCodeStore | 6 actions | 3 components |
| settingsStore | 4 actions | 2 components |

---

## 2. Service Call Graph

### Service Files Overview

| Service | Primary Purpose | Key Exports |
|---------|-----------------|-------------|
| `measureIngestion.ts` | Document parsing & measure creation | `ingestMeasureFiles`, `parsePDFDocument` |
| `aiExtractor.ts` | AI-powered data extraction | `extractMeasureWithAI`, `extractPopulations` |
| `documentLoader.ts` | File loading & text extraction | `extractFromFiles`, `extractFromPDF` |
| `cqlGenerator.ts` | CQL code generation | `generateCQL`, `validateCQL` |
| `hdiSqlGenerator.ts` | HDI SQL generation | `generateHDISQL`, `validateHDISQLDetailed` |
| `componentLibraryService.ts` | Component CRUD operations | `createAtomicComponent`, `createCompositeComponent`, `approveComponent` |
| `componentMatcher.ts` | Library matching | `findExactMatch`, `parseDataElementToComponent` |
| `componentCodeGenerator.ts` | Per-component code | `generateComponentCode`, `generateDataElementCode` |
| `testPatientGenerator.ts` | Test patient creation | `generateTestPatients`, `generatePatientBundle` |
| `measureEvaluator.ts` | Measure evaluation | `evaluateMeasure`, `evaluatePopulation` |
| `complexityCalculator.ts` | Complexity scoring | `calculateDataElementComplexity`, `calculateCompositeComplexity` |
| `api.ts` | External API calls | `fetchVSACValueSet`, `callLLM` |

---

### Call Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INGESTION PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MeasureCreator.tsx                                                          │
│         │                                                                    │
│         ▼                                                                    │
│  measureIngestion.ts::ingestMeasureFiles()                                   │
│         │                                                                    │
│         ├──▶ documentLoader.ts::extractFromFiles()                           │
│         │         │                                                          │
│         │         └──▶ extractFromPDF() ──▶ pdf.js library                   │
│         │                                                                    │
│         └──▶ aiExtractor.ts::extractMeasureWithAI()                          │
│                   │                                                          │
│                   ├──▶ extractPopulations()                                  │
│                   ├──▶ extractValueSets()                                    │
│                   └──▶ api.ts::callLLM() ──▶ Anthropic/OpenAI API            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        CODE GENERATION PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CodeGeneration.tsx                                                          │
│         │                                                                    │
│         ├──▶ cqlGenerator.ts::generateCQL()                                  │
│         │         │                                                          │
│         │         ├──▶ generateHeader()                                      │
│         │         ├──▶ generateValueSetDeclarations()                        │
│         │         ├──▶ generatePopulationDefinitions()                       │
│         │         └──▶ validateCQL() ──▶ (external CQL translator)           │
│         │                                                                    │
│         └──▶ hdiSqlGenerator.ts::generateHDISQL()                            │
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
│  ComponentEditor.tsx / UMSEditor.tsx                                         │
│         │                                                                    │
│         ▼                                                                    │
│  componentLibraryStore.ts                                                    │
│         │                                                                    │
│         ├──▶ componentLibraryService.ts::createAtomicComponent()             │
│         │                                                                    │
│         ├──▶ componentLibraryService.ts::createCompositeComponent()          │
│         │                                                                    │
│         ├──▶ componentMatcher.ts::findExactMatch()                           │
│         │         │                                                          │
│         │         └──▶ parseDataElementToComponent()                         │
│         │                                                                    │
│         ├──▶ componentLibraryService.ts::approveComponent()                  │
│         │                                                                    │
│         └──▶ complexityCalculator.ts::calculateDataElementComplexity()       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         VALIDATION PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ValidationView.tsx                                                          │
│         │                                                                    │
│         ├──▶ testPatientGenerator.ts::generateTestPatients()                 │
│         │         │                                                          │
│         │         └──▶ generatePatientBundle()                               │
│         │                                                                    │
│         └──▶ measureEvaluator.ts::evaluateMeasure()                          │
│                   │                                                          │
│                   ├──▶ evaluatePopulation()                                  │
│                   ├──▶ matchResourcesToElement()                             │
│                   └──▶ generateEvaluationTrace()                             │
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

---

## 3. Event and Data Flow Sequences

### Flow 1: Import a Measure from PDF

```
User Action: Upload PDF in MeasureCreator modal
    │
    ▼
MeasureCreator.tsx (lines 88-124)
    │ captures file upload
    ▼
documentLoader.ts::extractFromFiles()
    │
    ▼
documentLoader.ts::extractFromPDF() (lines 127-193)
    │ uses pdf.js to parse pages
    ▼
measureIngestion.ts::ingestMeasureFiles()
    │
    ├──▶ aiExtractor.ts::extractMeasureWithAI()
    │         │
    │         └──▶ api.ts::callLLM() → Anthropic/OpenAI
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
LibraryBrowser.tsx (lines 159-161)
    │ handleNewComponent()
    ▼
ComponentEditor.tsx opens (lines 78-340)
    │ form creation with type selection
    ▼
User fills form, clicks Save
    │
    ▼
ComponentEditor.tsx::handleSave() (lines 219-250)
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
UMSEditor.tsx::toggleMergeSelection() (lines 59-69)
    │ manages Set of selected IDs
    ▼
UMSEditor.tsx merge dialog (lines 788-810)
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
ValueSetManager.tsx (lines 18-180)
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
CodeGeneration.tsx (lines 35-41)
    │ useEffect triggers on format change
    ▼
cqlGenerator.ts::generateCQL(measure) (lines 71-155)
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
CodeGeneration.tsx (lines 43-63)
    │ useEffect calls generateHDISQL()
    ▼
hdiSqlGenerator.ts::generateHDISQL(measure, config) (lines 73-150)
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
UMSEditor.tsx (lines 170-185)
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
ComponentDetail.tsx (lines 81-83)
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
LogicTreeEditor.tsx
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
TimingEditor.tsx::TimingBadge (lines 100-135)
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

#### componentLibraryService.ts
| Line | Export | Reason |
|------|--------|--------|
| 334 | `getApprovedComponents()` | Not imported anywhere |
| 338 | `getAffectedMeasures()` | Not imported anywhere |

#### hdiSqlGenerator.ts
| Line | Export | Reason |
|------|--------|--------|
| 827 | `generateHDISQLWithContexts()` | Wrapper never called |
| 841 | `generatePopulationSQL()` | Specialized filter never used |
| 766 | `validateHDISQLBasic()` | Superseded by `validateHDISQLDetailed()` |
| 804 | `formatHDISQL()` | SQL formatter never called |

#### cqlGenerator.ts
| Line | Export | Reason |
|------|--------|--------|
| 980 | `generateAndValidateCQL()` | Convenience wrapper never used |

#### testPatientGenerator.ts
| Line | Export | Reason |
|------|--------|--------|
| 1591 | `getTestPatientById()` | Accessor never called |
| 1598 | `getAllTestPatients()` | Batch accessor never called |

#### api.ts
| Line | Export | Reason |
|------|--------|--------|
| 58 | `searchVSAC()` | VSAC search never imported |
| 83 | `getVSACValueSet()` | VSAC metadata never called |
| 104 | `expandVSACValueSet()` | Value set expansion never used |
| 131 | `validateCodeInVSAC()` | Code validation never called |
| 174 | `extractWithLLM()` | Proxy never called (uses aiExtractor directly) |
| 206 | `chatWithLLM()` | Chat proxy never called |
| 238 | `getLLMModels()` | Model listing never used |

#### componentCodeGenerator.ts
| Line | Export | Reason |
|------|--------|--------|
| 393 | `generateClauseCode()` | Only internal recursive calls |
| 423 | `generateCQLDefinitionName()` | Never called externally |
| 434 | `generateSQLAlias()` | Never called externally |

#### measureIngestion.ts
| Line | Export | Reason |
|------|--------|--------|
| 46 | `ingestMeasureFilesDirect()` | Alternative implementation never used |
| 478 | `previewDocuments()` | Preview function never imported |

---

### Unreachable Code Paths

#### hdiSqlGenerator.ts (Lines 917-929)
```typescript
if (typeof child === 'string') {
  return `  select empi_id from ${child}`;
} else {
  return `  select empi_id from ${outputAlias}_nested_${i}`;  // NEVER REACHED
}
```
**Issue:** Nested predicates already converted to strings by line 907

#### cqlGenerator.ts (Line 598)
```typescript
lines.push('  true // TODO: Define numerator criteria');
```
**Issue:** Placeholder for undefined numerator (never triggered in normal flow)

---

### Cleanup Recommendations

1. **Remove completely:**
   - All VSAC API functions in `api.ts`
   - Both LLM proxy functions in `api.ts`
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
| UMSEditor.tsx | 4 stores | Links measures to library, syncs components |
| ComponentEditor.tsx | 2 stores | Updates measures when components change |
| LibraryBrowser.tsx | 2 stores | Recalculates usage from measures |
| MeasureLibrary.tsx | 3 stores | Links components on import |
| ComponentDetail.tsx | 2 stores | Displays code state for components |

---

### Cascading Update Sequences

#### Sequence A: Measure Import → Usage Update
```
MeasureLibrary.tsx
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
ComponentEditor.tsx
    │
    └──▶ componentLibraryStore.syncComponentToMeasures()
              │
              ├──▶ Get all measures using component
              ├──▶ Update DataElements in each measure
              └──▶ measureStore.updateMeasure() (for each)
```

#### Sequence C: Code Generation → Display
```
CodeGeneration.tsx
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
| Settings Staleness | `settingsStore` → `CodeGeneration.tsx` | Code doesn't regenerate on provider change | Manual regenerate required |
| Sample Data Race | `initializeWithSampleData()` | Multiple tabs could overwrite | Single `initialized` flag check |

---

### Implicit Dependencies

| Dependency | Location | Risk |
|------------|----------|------|
| Library lookup for DataElement | UMSEditor.tsx lines 122-149 | `getComponent()` can return null |
| Measure ID mismatch | measureStore vs componentLibraryStore | `measureId` vs `measure.id` confusion |
| Value set code sync | ValueSetManager → Library | Manual sync required, not enforced |
| Complexity calculations | complexityCalculator.ts | Different scores at different times |

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
