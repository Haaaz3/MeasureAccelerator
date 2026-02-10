# AlgoAccelerator - Rebuild Guide

This guide provides step-by-step instructions for rebuilding AlgoAccelerator from scratch, useful for new developers or major refactoring.

## Prerequisites

- Node.js 18+
- npm 9+
- Git
- Code editor (VS Code recommended)

## Step 1: Project Setup

### Initialize Vite + React + TypeScript

```bash
npm create vite@latest algoaccelerator -- --template react-ts
cd algoaccelerator
npm install
```

### Install Core Dependencies

```bash
# State management
npm install zustand

# Routing (optional - current version uses tabs)
npm install react-router-dom

# UI icons
npm install lucide-react

# PDF parsing
npm install pdfjs-dist

# Excel parsing
npm install xlsx

# Unique IDs
npm install uuid

# Types
npm install -D @types/uuid
```

### Configure Tailwind CSS

```bash
npm install -D tailwindcss @tailwindcss/vite
```

Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Create `src/index.css` with Tailwind import and CSS variables (see existing file).

## Step 2: Create Directory Structure

```bash
mkdir -p src/{components/{layout,library,measure,validation,valueset,settings,shared},services,stores,types,constants,utils,data}
```

## Step 3: Define Type System

### Priority Order

1. **`src/types/fhir-measure.ts`** - FHIR base types
2. **`src/types/ums.ts`** - Universal Measure Spec (imports from fhir-measure)
3. **`src/types/componentLibrary.ts`** - Component library types
4. **`src/types/componentCode.ts`** - Code generation state types

### Key Types to Implement First

```typescript
// fhir-measure.ts
export type QICoreResourceType = 'Encounter' | 'Condition' | 'Procedure' | ...
export type MeasurePopulationType = 'initial-population' | 'denominator' | ...
export interface CodeableConcept { ... }
export interface Identifier { ... }

// ums.ts
export interface UniversalMeasureSpec { ... }
export interface PopulationDefinition { ... }
export interface LogicalClause { ... }
export interface DataElement { ... }
export interface ValueSetReference { ... }
export interface TimingConstraint { ... }

// componentLibrary.ts
export type LibraryComponent = AtomicComponent | CompositeComponent;
export interface AtomicComponent { ... }
export interface CompositeComponent { ... }
```

## Step 4: Create Zustand Stores

### Order of Creation

1. **`settingsStore.ts`** - No dependencies
2. **`measureStore.ts`** - Core measure state
3. **`componentLibraryStore.ts`** - Component library
4. **`componentCodeStore.ts`** - Code generation state

### Store Template

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoreState {
  // State
  items: Item[];
  selectedId: string | null;

  // Actions
  addItem: (item: Item) => void;
  setSelected: (id: string | null) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      items: [],
      selectedId: null,

      addItem: (item) => set((state) => ({
        items: [...state.items, item],
      })),

      setSelected: (id) => set({ selectedId: id }),
    }),
    {
      name: 'store-key',
      partialize: (state) => ({
        items: state.items,
      }),
    }
  )
);
```

## Step 5: Implement Services

### Order of Implementation

1. **Simple utilities first:**
   - `complexityCalculator.ts` - Pure functions, no dependencies
   - `codeOverrideHelper.ts` - Store key utilities

2. **Document processing:**
   - `documentLoader.ts` - PDF.js integration
   - `aiExtractor.ts` - LLM API calls
   - `measureIngestion.ts` - Combines above

3. **Code generation:**
   - `componentCodeGenerator.ts` - Per-component code
   - `cqlGenerator.ts` - Full CQL generation
   - `hdiSqlGenerator.ts` - SQL generation

4. **Component library:**
   - `componentMatcher.ts` - Matching logic
   - `componentLibraryService.ts` - CRUD helpers

5. **Validation:**
   - `testPatientGenerator.ts` - Test data
   - `measureEvaluator.ts` - Evaluation engine

## Step 6: Build UI Components

### Order of Implementation

1. **Layout:**
   - `Sidebar.tsx` - Navigation
   - `App.tsx` - Tab routing

2. **Settings (simple start):**
   - `SettingsPage.tsx`

3. **Measure Library:**
   - `MeasureLibrary.tsx` - List view
   - `MeasureCreator.tsx` - Creation wizard

4. **UMS Editor (core):**
   - `UMSEditor.tsx` - Main editor container
   - `LogicTreeEditor.tsx` - Criteria tree
   - `ComponentDetailPanel.tsx` - Selection panel
   - `TimingEditor.tsx` - Timing editing

5. **Component Library:**
   - `LibraryBrowser.tsx` - Browse components
   - `ComponentDetail.tsx` - Component details
   - `ComponentEditor.tsx` - Create/edit
   - `SharedEditWarning.tsx` - Multi-use warning

6. **Code Generation:**
   - `CodeGeneration.tsx` - Code export view
   - `ComponentCodeViewer.tsx` - Per-component code

7. **Validation:**
   - `ValidationTraceViewer.tsx` - Test patients

8. **Value Sets:**
   - `ValueSetManager.tsx`

## Step 7: Wire Components to Stores

### Pattern for Store Usage

```typescript
import { useMeasureStore } from '../stores/measureStore';
import { useComponentLibraryStore } from '../stores/componentLibraryStore';

export function MyComponent() {
  // Subscribe to specific slices
  const measures = useMeasureStore((state) => state.measures);
  const selectedId = useMeasureStore((state) => state.selectedMeasureId);

  // Get actions
  const { addMeasure, setSelectedMeasure } = useMeasureStore();

  // Use in handlers
  const handleSelect = (id: string) => {
    setSelectedMeasure(id);
  };

  return (/* UI */);
}
```

## Step 8: Implement Cross-Store Coordination

### Example: Linking Measures to Components

```typescript
// In MeasureLibrary.tsx after adding measure
const handleMeasureCreated = (measure: UniversalMeasureSpec) => {
  // 1. Add to measure store
  addMeasure(measure);

  // 2. Link to component library
  linkMeasureComponents(measure.id, measure.populations);

  // 3. Recalculate usage
  recalculateUsage(measures);
};
```

## Step 9: Add Tests

### Setup Vitest

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Create `vite.config.ts` test config:
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

### Test Structure

```
src/__tests__/
├── setup.ts                    # Test setup
├── fixtures/
│   └── testMeasure.ts          # Test data
└── integration/
    ├── measure-component-wiring.test.ts
    ├── code-generation.test.ts
    └── value-set-operations.test.ts
```

## Step 10: Common Gotchas

### 1. Zustand Subscription Pattern

**Wrong:**
```typescript
const value = useMemo(() => store.getState().value, [dep]);
```

**Right:**
```typescript
const value = useStore((state) => state.value);
```

### 2. Component Key for State Reset

When component should reset on parent change:
```tsx
<ChildComponent key={parentId} {...props} />
```

### 3. Store Key Pattern for Scoped State

```typescript
// Measure-scoped keys
const storeKey = `${measureId}::${elementId}`;

// Library-scoped keys
const storeKey = `library::${componentId}`;
```

### 4. Immutable Updates in Stores

```typescript
// Good
set((state) => ({
  items: state.items.map(item =>
    item.id === id ? { ...item, ...updates } : item
  ),
}));

// Bad - mutates state
set((state) => {
  const item = state.items.find(i => i.id === id);
  item.value = newValue; // Mutation!
  return state;
});
```

### 5. Tree Walking with Recursion

```typescript
function walkTree(node: LogicalClause | DataElement): void {
  if ('children' in node) {
    // LogicalClause
    for (const child of node.children) {
      walkTree(child);
    }
  } else {
    // DataElement
    processElement(node);
  }
}
```

## Step 11: Build and Deploy

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
# Output in dist/
```

### Preview Production
```bash
npm run preview
```

### Deploy
Static files in `dist/` can be deployed to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting

## Incremental Rebuild Strategy

If rebuilding incrementally:

1. **Week 1:** Types, stores, settings
2. **Week 2:** Measure library, basic editor
3. **Week 3:** Logic tree, component detail
4. **Week 4:** Component library linking
5. **Week 5:** Code generation
6. **Week 6:** Validation, polish

## Key Files to Reference

When stuck, reference these files for patterns:

- **State management:** `src/stores/measureStore.ts`
- **Complex component:** `src/components/measure/UMSEditor.tsx`
- **Store subscription:** `src/components/library/ComponentDetail.tsx`
- **Service pattern:** `src/services/cqlGenerator.ts`
- **Type definitions:** `src/types/ums.ts`
