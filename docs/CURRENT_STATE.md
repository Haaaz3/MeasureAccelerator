# AlgoAccelerator - Current State

This document captures the current implementation state as of February 2026.

## Feature Completion Status

### Fully Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Measure Library | Complete | Import, list, duplicate, delete, lock/publish |
| PDF/Document Ingestion | Complete | PDF.js integration, AI extraction |
| UMS Editor | Complete | Full criteria tree editing |
| AND/OR/NOT Toggle | Complete | Clickable operators at all levels |
| Per-Sibling Operators | Complete | Individual operator overrides |
| Deep Edit Mode | Complete | Selection, reorder, delete, merge |
| Component Library | Complete | Atomic + composite, version management |
| Library Linking | Complete | Hash-based + name fallback matching |
| Shared Edit Warning | Complete | Update All vs Create Copy |
| Value Set Management | Complete | Add/remove codes, bulk import |
| Timing Editor | Complete | Constraint + window-based timing |
| Timing Overrides | Complete | Original preserved, modified tracked |
| Code Generation - CQL | Complete | Full measure and per-component |
| Code Generation - SQL | Complete | Standard + Synapse SQL |
| Code Overrides | Complete | Per-measure, per-component isolation |
| Test Validation | Complete | Pre-loaded patients, detailed traces |
| Review Workflow | Complete | Approve/flag, complexity scoring |
| Settings | Complete | LLM provider, API keys, theme |

### Recent Fixes (Last Session)

1. **Language Tag on Code Overrides** - Fixed SQL overrides showing as CQL
2. **Code Search Navigation** - Fixed offset calculation in CodeGeneration
3. **Override Isolation Bug** - Fixed same-ID override bleed between measures
4. **Component Library Sync** - Full bidirectional code sync working
5. **Editable Measure Metadata** - Inline editing of title, ID, version, steward
6. **Library Filters** - Status/type filters for Measure Library
7. **Library Navigation** - Click component usage → navigate to measure
8. **Synapse SQL Toggle** - Fixed Zustand subscription pattern
9. **State Bleed Between Components** - Added React key props

### Known Issues

None currently tracked.

## File Counts

```
src/components/   14 files
src/services/     15 files
src/stores/        4 files
src/types/         5 files
src/utils/         5 files
src/constants/     2 files
src/data/          2 files
src/__tests__/     6 files
```

## Store State Summary

### measureStore
- `measures[]` - All imported/created measures
- `selectedMeasureId` - Currently editing measure
- `activeTab` - Current navigation tab
- `validationTraces{}` - Cached validation results
- Persistence key: `algo-accelerator-storage`

### componentLibraryStore
- `components[]` - All library components
- `selectedComponentId` - Selected in library browser
- `editingComponentId` - Being edited
- `filters` - Library browser filters
- Persistence key: `algo-accelerator-component-library`

### componentCodeStore
- `codeStates{}` - Keyed by `measureId::elementId`
- `defaultFormat` - Global default (CQL)
- Persistence key: `component-code-storage`

### settingsStore
- `selectedProvider` - LLM provider
- `selectedModel` - Model name
- `apiKeys{}` - API keys by provider
- `useBackendApi` - Whether to use server proxy
- Persistence key: `algo-accelerator-settings`

## Critical Code Paths

### Measure Import
```
MeasureLibrary.tsx → measureIngestion.ts → aiExtractor.ts
    → measureStore.addMeasure()
    → componentLibraryStore.linkMeasureComponents()
```

### Component Library Linking
```
componentLibraryStore.linkMeasureComponents()
    → componentMatcher.parseDataElementToComponent()
    → componentMatcher.findExactMatch()
    → Create or link component
    → recalculateUsage()
```

### Code Generation
```
CodeGeneration.tsx
    → cqlGenerator.ts or hdiSqlGenerator.ts
    → componentCodeStore.getOrCreateCodeState()
    → Apply overrides if present
    → Display with syntax highlighting
```

### Timing Override Flow
```
TimingEditor.tsx → UMSEditor.handleTimingSaveWithWarning()
    → Check if shared component
    → If shared: show SharedEditWarning
    → measureStore.updateTimingOverride()
    → Optional: syncComponentToMeasures()
```

## UI Component Hierarchy

```
App.tsx
├── Sidebar.tsx (navigation)
└── Main content (based on activeTab):
    ├── MeasureLibrary.tsx
    │   └── MeasureCreator.tsx (modal)
    ├── UMSEditor.tsx
    │   ├── LogicTreeEditor.tsx
    │   │   └── Recursive tree nodes
    │   ├── ComponentDetailPanel.tsx
    │   │   └── ComponentCodeViewer.tsx
    │   ├── TimingEditor.tsx
    │   └── SharedEditWarning.tsx (modal)
    ├── LibraryBrowser.tsx
    │   ├── ComponentDetail.tsx
    │   │   └── ComponentCodeViewer.tsx
    │   └── ComponentEditor.tsx (modal)
    ├── CodeGeneration.tsx
    │   └── ComponentCodeViewer.tsx (per component)
    ├── ValidationTraceViewer.tsx
    ├── ValueSetManager.tsx
    └── SettingsPage.tsx
```

## Testing Status

### Existing Tests
- `measure-component-wiring.test.ts` - Component linking
- `code-generation.test.ts` - CQL/SQL generation
- `code-overrides.test.ts` - Override persistence
- `value-set-operations.test.ts` - Code CRUD

### Run Tests
```bash
npm run test          # Single run
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Performance Characteristics

| Operation | Typical Time |
|-----------|--------------|
| App load | ~2 seconds |
| AI extraction | 5-30 seconds (depends on document) |
| Patient evaluation | 10-50 ms |
| Code generation | ~500 ms |
| Library linking | <100 ms for typical measure |

## Storage Usage

Typical localStorage usage:
- Empty app: ~50 KB
- 10 measures: ~500 KB
- 100 components: ~200 KB
- With overrides: +10 KB per override

Limit: ~5-10 MB per origin (browser dependent)

## External Dependencies

### Required at Runtime
- Browser with localStorage
- PDF.js worker (loaded from CDN or bundled)

### Optional
- LLM API (Anthropic, OpenAI, Google) for AI extraction
- VSAC API for value set lookup
- Backend server for API proxying

## Build Output

```bash
npm run build
# Output in dist/
# - index.html (0.5 KB)
# - assets/index-*.css (~75 KB)
# - assets/index-*.js (~1.3 MB)
# - assets/pdf.worker.min-*.mjs (~1 MB)
```

Total production bundle: ~2.5 MB

## Environment Variables

### Frontend (.env)
```
VITE_BACKEND_URL=http://localhost:3001  # Optional backend
```

### Backend (server/.env)
```
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5174
VSAC_API_KEY=your-key
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

## Deployment Checklist

- [ ] Update version in package.json
- [ ] Run `npm run build`
- [ ] Verify build output in dist/
- [ ] Test production build with `npm run preview`
- [ ] Deploy static files to hosting
- [ ] (Optional) Deploy backend to server
- [ ] Verify LLM API keys configured

## Next Development Priorities

Based on product roadmap:

1. **Server-Side Storage** - PostgreSQL backend
2. **User Authentication** - Login/logout, user sessions
3. **Multi-User Collaboration** - Real-time sync
4. **CQL Execution Engine** - In-browser CQL evaluation
5. **FHIR Measure Import** - Parse existing FHIR measures
6. **Audit Logging** - Track all changes for compliance
