# AlgoAccelerator - Data Flow Guide

This document maps exactly how data flows through the application for every major operation.

## Store Relationships

```
┌─────────────────────┐     passes data     ┌─────────────────────────┐
│   measureStore      │◄───────────────────►│  componentLibraryStore  │
│                     │     via components   │                         │
│ • measures[]        │                      │ • components[]          │
│ • selectedMeasureId │                      │ • selectedComponentId   │
│ • validationTraces  │                      │ • filters               │
└─────────────────────┘                      └─────────────────────────┘
         │                                              │
         │ reads/writes                                 │ reads
         ▼                                              ▼
┌─────────────────────┐                      ┌─────────────────────────┐
│  componentCodeStore │                      │     settingsStore       │
│                     │                      │                         │
│ • codeStates{}      │                      │ • selectedProvider      │
│ • defaultFormat     │                      │ • apiKeys               │
└─────────────────────┘                      └─────────────────────────┘
```

## Flow 1: Import Measure from PDF

**Trigger:** User uploads PDF in MeasureLibrary

```
MeasureLibrary.tsx
    │ handleFilesSelected(files)
    ▼
documentLoader.ts::extractFromFiles()
    │ Uses PDF.js to parse document
    ▼
measureIngestion.ts::ingestMeasureFiles()
    │
    ├──▶ aiExtractor.ts::extractMeasureWithAI()
    │         │ Calls LLM API (Anthropic/OpenAI)
    │         │ Returns structured populations, value sets
    │         ▼
    │    parsedContent = { populations, valueSets, metadata }
    │
    ▼
UMS Created from parsed content
    │
    ▼
measureStore.addMeasure(measure)
    │ Persists to localStorage
    ▼
componentLibraryStore.linkMeasureComponents(measureId, populations)
    │
    ├──▶ For each DataElement:
    │       ├──▶ parseDataElementToComponent() → creates identity hash
    │       ├──▶ findExactMatch() → searches library
    │       │
    │       ├──▶ If match found:
    │       │       • Set element.libraryComponentId
    │       │       • Add to component.usage.measureIds
    │       │       • Sync codes if element has codes and component doesn't
    │       │
    │       └──▶ If no match + has codes:
    │               • Create new AtomicComponent
    │               • Link element to new component
    │
    └──▶ recalculateUsage(measures)
    │
    ▼
UI: Measure appears in library, components linked
```

## Flow 2: Edit Value Set Codes

**Trigger:** User adds/removes code in ValueSetManager or ComponentDetailPanel

```
User clicks "Add Code" or "Remove"
    │
    ▼
ValueSetManager.tsx OR ComponentDetailPanel.tsx
    │ handleAddCode() / handleRemoveCode()
    ▼
measureStore.addCodeToValueSet(measureId, valueSetId, code)
    │
    ├──▶ Find value set in measure.valueSets[]
    ├──▶ Add code to valueSet.codes[]
    ├──▶ Create correction record for audit
    │       { correctionType: 'code_added', originalValue, correctedValue }
    └──▶ Update measure.updatedAt
    │
    ▼
If element is linked to library component:
    │
    ▼
componentLibraryStore.syncComponentToMeasures(componentId)
    │
    ├──▶ Get all measures using this component
    ├──▶ For each measure:
    │       Update DataElement.valueSet.codes
    │
    ▼
UI: Code appears/disappears in list, correction logged
```

## Flow 3: Toggle Logical Operator (AND/OR)

**Trigger:** User clicks operator badge in LogicTreeEditor

```
LogicTreeEditor.tsx
    │ onClick operator badge
    │ calls onToggleOperator(clauseId)
    ▼
UMSEditor.tsx::handleToggleOperator(clauseId)
    │
    ▼
measureStore.toggleLogicalOperator(measureId, clauseId)
    │
    ├──▶ Recursively walk populations tree
    ├──▶ Find clause matching clauseId
    ├──▶ Cycle: AND → OR → NOT → AND
    └──▶ Return updated clause
    │
    ▼
State Updates:
    • populations[i].criteria.operator: new value
    • measure.updatedAt: timestamp
    │
    ▼
UI: Operator badge updates, tree re-renders
```

## Flow 4: Save Timing Override

**Trigger:** User modifies timing in TimingEditor

```
TimingEditor.tsx
    │ User changes operator/value/unit/anchor
    │ clicks "Save"
    ▼
UMSEditor.tsx::handleTimingSaveWithWarning(elementId, constraint)
    │
    ├──▶ Check if element linked to shared component
    │       componentLibraryStore.getComponent(libraryComponentId)
    │       If usage.usageCount > 1:
    │           └──▶ Show SharedEditWarning modal
    │               User chooses: Update All / Create Copy / Cancel
    │
    ▼ (After user choice or if not shared)
    │
measureStore.updateTimingOverride(measureId, elementId, modified)
    │
    ├──▶ Walk populations to find element by ID
    └──▶ Set element.timingOverride = {
             original: <unchanged>,
             modified: <new constraint>,
             modifiedAt: now,
             modifiedBy: 'user'
         }
    │
    ▼
If "Update All" chosen:
    componentLibraryStore.syncComponentToMeasures(componentId)
    │
    ▼
UI: Timing badge shows warning color, reset button appears
```

## Flow 5: Generate CQL Code

**Trigger:** User navigates to Code Generation tab, selects CQL

```
CodeGeneration.tsx
    │ selectedFormat = 'cql'
    ▼
cqlGenerator.ts::generateCQL(measure)
    │
    ├──▶ generateHeader()
    │       Library name, version, using QICore
    │
    ├──▶ generateValueSetDeclarations()
    │       For each unique value set OID
    │
    ├──▶ generateParameters()
    │       Measurement Period parameter
    │
    ├──▶ generatePopulationDefinitions()
    │       For each population:
    │         └──▶ Walk criteria tree
    │             ├──▶ DataElement → resource query
    │             └──▶ LogicalClause → combine with and/or
    │
    └──▶ Return CQLGenerationResult
    │
    ▼
componentCodeStore checks for overrides
    │
    ├──▶ For each component, check codeStates[storeKey]
    ├──▶ If override exists for 'cql': use override.code
    └──▶ Otherwise: use generated code
    │
    ▼
UI: CQL displayed with syntax highlighting
    Copy/Download buttons available
```

## Flow 6: Approve/Flag Component in Review

**Trigger:** User clicks Approve or Flag button

```
LogicTreeEditor.tsx OR ComponentDetailPanel.tsx
    │ handleApprove(elementId) / handleFlag(elementId)
    ▼
measureStore.approveElement(measureId, elementId)
    │
    ├──▶ Walk populations to find element
    ├──▶ Set element.reviewStatus = 'approved'
    └──▶ Recalculate measure.reviewProgress
    │
    ▼
UI: Status badge turns green, progress bar updates
```

## Flow 7: Merge Selected Components

**Trigger:** User selects 2+ components, clicks "Merge"

```
UMSEditor.tsx Deep Edit Mode
    │ User checks components, clicks "Merge X Selected"
    ▼
Merge Dialog opens
    │ User enters merged name
    │ clicks "Merge Components"
    ▼
componentLibraryStore.mergeComponents(ids, name, description, valueSets)
    │
    ├──▶ Collect value sets from all selected components
    ├──▶ Deduplicate codes across value sets
    ├──▶ Create new CompositeComponent with:
    │       operator: 'OR'
    │       children: references to original components
    │
    ├──▶ Archive original components (status → 'archived')
    │
    └──▶ Link merged component to all affected DataElements
    │
    ▼
State Updates:
    • New merged component in components[]
    • Original components: status = 'archived'
    • Affected measures: elements now link to merged component
    │
    ▼
UI: Merged component appears, originals greyed out
```

## Flow 8: Component Library Code Override

**Trigger:** User edits code in ComponentCodeViewer

```
ComponentCodeViewer.tsx (in Library or Measure)
    │ User clicks "Edit Code"
    │ Modifies code, adds note
    │ clicks "Save"
    ▼
componentCodeStore.addOverride(storeKey, format, override)
    │
    │ storeKey = getStoreKey(measureId, elementId)
    │   For library: "library::component-id"
    │   For measure: "measure-id::element-id"
    │
    ├──▶ codeStates[storeKey].overrides[format] = {
    │       code: <modified code>,
    │       note: <user note>,
    │       timestamp: now,
    │       language: 'cql' | 'synapse-sql'
    │   }
    │
    ▼
UI: Override badge appears, "Revert" button enabled
```

## Flow 9: Test Patient Validation

**Trigger:** User selects patient in ValidationTraceViewer

```
ValidationTraceViewer.tsx
    │ User selects patient
    ▼
measureEvaluator.ts::evaluateMeasure(measure, patient)
    │
    ├──▶ evaluatePopulation('initial-population')
    │       For each criteria in population:
    │         └──▶ matchResourceToElement(patient.resources, element)
    │             ├──▶ Check if patient has matching resource
    │             ├──▶ Validate codes match value set
    │             └──▶ Check timing constraints
    │
    ├──▶ evaluatePopulation('denominator')
    │       (Similar process)
    │
    ├──▶ evaluatePopulation('denominator-exclusion')
    │
    └──▶ evaluatePopulation('numerator')
    │
    ▼
PatientValidationTrace created:
    { patientId, populations, finalOutcome, howClose }
    │
    ▼
measureStore.saveValidationTrace(measureId, trace)
    │
    ▼
UI: Trace displayed with pass/fail indicators per population
```

## Flow 10: Link Measure to Component Library

**Trigger:** Automatic on measure load, or manual "Link Components"

```
UMSEditor.tsx useEffect on mount
    │
    ▼
componentLibraryStore.linkMeasureComponents(measureId, populations)
    │
    ▼
For each DataElement in populations:
    │
    ├──▶ componentMatcher.parseDataElementToComponent(element)
    │       Creates identity hash from:
    │         • Value set OID
    │         • Timing expression
    │         • Negation flag
    │
    ├──▶ componentMatcher.findExactMatchPrioritizeApproved(parsed, components)
    │       1. Exact hash match
    │       2. Fallback: normalized name matching
    │
    ├──▶ If match found:
    │       element.libraryComponentId = component.id
    │       component.usage.measureIds.add(measureId)
    │       component.usage.usageCount++
    │
    └──▶ If no match AND element has codes:
            Create new AtomicComponent from element
            Link element to new component
    │
    ▼
State Updates:
    • DataElements have libraryComponentId set
    • Components have updated usage counts
    │
    ▼
UI: Linked badges appear on elements
```

## Cross-Store Update Sequences

### Sequence A: Measure Import → Usage Update
```
measureStore.addMeasure()
    ↓
componentLibraryStore.linkMeasureComponents()
    ↓
componentLibraryStore.recalculateUsage()
```

### Sequence B: Component Edit → Measure Sync
```
componentLibraryStore.updateComponent()
    ↓
componentLibraryStore.syncComponentToMeasures()
    ↓
measureStore.updateMeasure() (for each affected measure)
```

### Sequence C: Code Generation → Override Application
```
cqlGenerator.generateCQL()
    ↓
componentCodeStore.getOrCreateCodeState()
    ↓
Apply override if exists
    ↓
Display final code
```

## Data Consistency Rules

1. **Component usage.measureIds must match DataElement.libraryComponentId**
   - Call `recalculateUsage()` after linking changes

2. **Code overrides are measure-scoped**
   - Key pattern: `measureId::elementId`
   - Library overrides use: `library::componentId`

3. **Value set codes sync bidirectionally**
   - Library → Measures: via `syncComponentToMeasures()`
   - Measures → Library: via import matching

4. **Timing modifications don't auto-propagate**
   - Requires explicit "Update All" user choice
   - Creates version if "Create Copy" chosen
