# AlgoAccelerator - Design Decisions

This document explains the key architectural and design decisions made in AlgoAccelerator, including the reasoning behind each choice.

## State Management

### Decision: Zustand over Redux

**Choice:** Zustand with persist middleware

**Reasoning:**
- Simpler API than Redux - no action creators, reducers, or middleware boilerplate
- Built-in persistence via middleware
- Excellent TypeScript support
- Small bundle size (~1KB vs Redux's ~7KB)
- Direct state mutations in actions (immer-like syntax optional)

**Trade-offs:**
- Less ecosystem tooling than Redux (DevTools exist but less mature)
- No built-in time-travel debugging
- Smaller community for troubleshooting

### Decision: Browser localStorage for Persistence

**Choice:** All data stored in browser localStorage

**Reasoning:**
- Zero server infrastructure required
- Works offline
- No authentication complexity for MVP
- Instant save/load without network latency
- Easy to export/backup as JSON

**Trade-offs:**
- ~5-10MB storage limit per origin
- Data isolated per browser/device
- No multi-user collaboration
- User must manually backup important data

**Mitigation:**
- Export functionality for measure backup
- Plan for server-side storage in future versions

## Data Model

### Decision: Universal Measure Spec (UMS) as Canonical Format

**Choice:** Custom internal format aligned with FHIR R4 but not strictly FHIR

**Reasoning:**
- FHIR Measure is too verbose for internal manipulation
- Need additional fields (reviewStatus, confidence, libraryComponentId)
- Easier tree manipulation for criteria editing
- Can export to pure FHIR when needed

**The UMS Format:**
```typescript
{
  id: string,
  metadata: MeasureMetadata,
  populations: PopulationDefinition[],  // Simpler than FHIR groups
  valueSets: ValueSetReference[],       // Flattened for easy access
  globalConstraints: GlobalConstraints, // Single source of truth
}
```

### Decision: Criteria as Recursive Tree (LogicalClause)

**Choice:** Recursive `LogicalClause` with `children: (DataElement | LogicalClause)[]`

**Reasoning:**
- Natural representation of boolean logic (AND, OR, NOT)
- Easy to render as visual tree
- CQL generation maps directly to tree structure
- Supports arbitrary nesting depth

**Example:**
```
Initial Population
├── AND
│   ├── Age >= 18 (DataElement)
│   └── OR (LogicalClause)
│       ├── Office Visit (DataElement)
│       └── Telehealth Visit (DataElement)
```

### Decision: Per-Sibling Operator Overrides

**Choice:** `siblingConnections` array for operator overrides between specific siblings

**Reasoning:**
- Default: all siblings use clause's operator
- Override: specific pairs can have different operators
- Enables complex logic like: `A AND B OR C`

**Implementation:**
```typescript
interface SiblingConnection {
  fromIndex: number;
  toIndex: number;
  operator: LogicalOperator;
}
```

## Component Library

### Decision: Hash-Based Identity Matching

**Choice:** Components matched by identity hash (OID + timing + negation), not by name

**Reasoning:**
- Two components with same name but different timing are different
- OID-based matching is reliable (value sets have unique OIDs)
- Prevents accidental merging of similar-but-different components

**Hash Calculation:**
```typescript
const identityHash = `${normalizeOid(oid)}|${normalizeTiming(timing)}|${negation}`;
```

**Fallback:**
- If OID match fails, fall back to normalized name comparison
- Still requires timing + negation match

### Decision: Bidirectional Code Sync

**Choice:** Codes stored on both LibraryComponent AND DataElement

**Reasoning:**
- Library is "master" for shared components
- Measures need local copies for editing
- Changes in library propagate to all linked measures
- Import can enrich library from measure data

**Trade-off:**
- Potential desync if sync fails
- More complex update logic

**Mitigation:**
- `syncComponentToMeasures()` always called after library edits
- `recalculateUsage()` repairs broken links

### Decision: Shared Edit Warning Modal

**Choice:** Prompt user before editing component used in multiple measures

**Reasoning:**
- Prevent unintended cascading changes
- Give user explicit control: Update All vs Create Copy
- Transparency about impact of edits

## Code Generation

### Decision: Measure-Scoped Code Overrides

**Choice:** Store key pattern `measureId::elementId` for code overrides

**Reasoning:**
- Same component can have different overrides in different measures
- Library has separate override scope (`library::componentId`)
- Prevents state bleed between contexts

**Implementation:**
```typescript
function getStoreKey(measureId: string, elementId: string): string {
  return `${measureId}::${elementId}`;
}
```

### Decision: Multiple Output Formats

**Choice:** CQL + Standard SQL + Synapse SQL

**Reasoning:**
- CQL: Industry standard for quality measures
- Standard SQL: Broad database compatibility
- Synapse SQL: Microsoft Azure cloud analytics (specific customer need)

**Each generator is independent:**
```
cqlGenerator.ts       → CQL output
hdiSqlGenerator.ts    → Standard SQL + Synapse SQL
```

### Decision: Code Override Persistence

**Choice:** User can edit generated code, override is saved and applied on future regeneration

**Reasoning:**
- Generated code may need manual tweaks
- Regeneration shouldn't lose manual edits
- Override includes note for audit trail

**Override Structure:**
```typescript
interface CodeOverride {
  code: string;
  note: string;
  timestamp: string;
  language: 'cql' | 'synapse-sql';
}
```

## UI Patterns

### Decision: React Key for Component Reset

**Choice:** Use `key={element.id}` to force component remount on selection change

**Reasoning:**
- ComponentCodeViewer has local state (isEditing, pendingCode)
- Switching elements should reset this state
- React's reconciler keeps old state if same component type
- Key change triggers unmount/remount, resetting all state

```tsx
<ComponentCodeViewer
  key={element.id}  // Forces fresh instance per element
  element={element}
  measureId={measureId}
/>
```

### Decision: Zustand Selector Pattern over useMemo

**Choice:** Use `useStore((state) => state.value)` instead of `useMemo(() => store.getState().value)`

**Reasoning:**
- Selector triggers re-render when slice changes
- useMemo with getState() doesn't subscribe to changes
- This caused the "SQL toggle not working" bug

**Correct Pattern:**
```typescript
// Good - subscribes to changes
const codeState = useComponentCodeStore((state) => state.codeStates[storeKey]);

// Bad - doesn't re-render on changes
const codeState = useMemo(() => store.getState().codeStates[storeKey], [storeKey]);
```

### Decision: Tab-Based Navigation

**Choice:** Single-page app with tab-based navigation instead of routes

**Reasoning:**
- Simpler state management (no URL sync)
- Selected measure persists across tabs
- Faster switching (no component unmounting)
- All tabs share same measure context

## Validation & Testing

### Decision: Pre-loaded Synthetic Test Patients

**Choice:** Hard-coded test patients rather than dynamic generation

**Reasoning:**
- Consistent testing across sessions
- Known expected outcomes for each patient
- Covers edge cases (exclusions, near-misses)
- No dependency on external data

**Patient Categories:**
- Numerator-positive (should pass)
- Denominator-only (should fail numerator)
- Excluded (hospice, terminal illness)
- Edge cases (boundary ages, timing)

### Decision: Evaluation Trace Output

**Choice:** Return detailed step-by-step trace, not just pass/fail

**Reasoning:**
- Debugging: see exactly why patient failed
- Education: understand measure logic
- "How close" analysis: what was missing

**Trace Structure:**
```typescript
interface PatientValidationTrace {
  patientId: string;
  populations: {
    initialPopulation: { met: boolean; nodes: ValidationNode[] };
    denominator: { met: boolean; nodes: ValidationNode[] };
    exclusions: { met: boolean; nodes: ValidationNode[] };
    numerator: { met: boolean; nodes: ValidationNode[] };
  };
  finalOutcome: 'in_numerator' | 'not_in_numerator' | 'excluded' | 'not_in_population';
  howClose?: string[];  // What was missing
}
```

## AI Integration

### Decision: LLM Provider Flexibility

**Choice:** Support multiple LLM providers (Anthropic, OpenAI, Google, Custom)

**Reasoning:**
- Different organizations have different vendor relationships
- API pricing varies
- Self-hosted LLMs for security-sensitive environments

**Implementation:**
- Provider-agnostic `callLLM()` function
- Adapter pattern for different APIs
- API keys stored in settingsStore

### Decision: Client-Side AI Calls (with Backend Option)

**Choice:** Direct browser → LLM API, with optional backend proxy

**Reasoning:**
- Simpler deployment (no server required)
- User controls their own API keys
- Backend proxy available for CORS issues or key management

**Trade-off:**
- API key exposed in browser
- Some APIs don't allow browser CORS

**Mitigation:**
- Backend API available in `server/`
- Toggle in settings: `useBackendApi`

## Error Handling

### Decision: ErrorBoundary per Tab

**Choice:** Wrap each major tab in React ErrorBoundary

**Reasoning:**
- Error in one tab doesn't crash entire app
- User can navigate to other tabs
- Error message indicates which component failed

```tsx
<ErrorBoundary fallbackName="Measure Editor">
  <UMSEditor />
</ErrorBoundary>
```

## Future Considerations

### Planned: Server-Side Persistence
- PostgreSQL for measures and components
- User authentication
- Multi-user collaboration
- Version history with rollback

### Planned: Real-Time Collaboration
- WebSocket or CRDT-based sync
- Conflict resolution strategy
- User presence indicators

### Planned: CQL Execution Engine
- In-browser CQL evaluation
- Real patient data testing
- Performance profiling
