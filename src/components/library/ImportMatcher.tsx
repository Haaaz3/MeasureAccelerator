import { useState, useMemo, useCallback } from 'react';
import {
  X,
  Upload,
  CheckCircle,
  AlertCircle,
  Plus,
  Library,
  ArrowRight,
  Search,
  Sparkles,
  Package,
} from 'lucide-react';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore';
import type { ComponentCategory, ComponentMatch } from '../../types/componentLibrary';

// ============================================================================
// Types
// ============================================================================

interface ImportMatcherProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface NewComponentDecision {
  addToLibrary: boolean;
  category: ComponentCategory;
}

const CATEGORIES: { value: ComponentCategory; label: string }[] = [
  { value: 'demographics', label: 'Demographics' },
  { value: 'encounters', label: 'Encounters' },
  { value: 'conditions', label: 'Conditions' },
  { value: 'procedures', label: 'Procedures' },
  { value: 'medications', label: 'Medications' },
  { value: 'assessments', label: 'Assessments' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'clinical-observations', label: 'Clinical Observations' },
  { value: 'exclusions', label: 'Exclusions' },
];

// ============================================================================
// Component
// ============================================================================

export default function ImportMatcher({ onComplete, onCancel }: ImportMatcherProps) {
  const { importMatcherState, setImportMatcherState } = useComponentLibraryStore();

  // --------------------------------------------------------------------------
  // Derived data
  // --------------------------------------------------------------------------
  const matches = importMatcherState?.matches ?? [];

  const exactMatches = useMemo(
    () => matches.filter((m) => m.matchType === 'exact'),
    [matches]
  );
  const similarMatches = useMemo(
    () => matches.filter((m) => m.matchType === 'similar'),
    [matches]
  );
  const newComponents = useMemo(
    () => matches.filter((m) => m.matchType === 'none'),
    [matches]
  );

  const libraryMatches = useMemo(
    () => [...exactMatches, ...similarMatches],
    [exactMatches, similarMatches]
  );

  // --------------------------------------------------------------------------
  // State: Decisions for matched components ('link' = use library, 'create' = keep new)
  // --------------------------------------------------------------------------
  const [matchDecisions, setMatchDecisions] = useState<Record<string, 'link' | 'create'>>(() => {
    const initial: Record<string, 'link' | 'create'> = {};
    for (const match of libraryMatches) {
      initial[match.incomingComponent.name] = 'link';
    }
    return initial;
  });

  // --------------------------------------------------------------------------
  // State: Decisions for new components
  // --------------------------------------------------------------------------
  const [newDecisions, setNewDecisions] = useState<Record<string, NewComponentDecision>>(() => {
    const initial: Record<string, NewComponentDecision> = {};
    for (const match of newComponents) {
      initial[match.incomingComponent.name] = {
        addToLibrary: true,
        category: 'clinical-observations',
      };
    }
    return initial;
  });

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------
  const setMatchDecision = useCallback((name: string, decision: 'link' | 'create') => {
    setMatchDecisions((prev) => ({ ...prev, [name]: decision }));
  }, []);

  const toggleAddToLibrary = useCallback((name: string) => {
    setNewDecisions((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        addToLibrary: !prev[name]?.addToLibrary,
      },
    }));
  }, []);

  const setNewCategory = useCallback((name: string, category: ComponentCategory) => {
    setNewDecisions((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        category,
      },
    }));
  }, []);

  const handleImport = useCallback(() => {
    if (!importMatcherState) return;

    // Build the decisions map for the store
    const decisions: Record<string, 'link' | 'create'> = {};

    for (const [name, decision] of Object.entries(matchDecisions)) {
      decisions[name] = decision;
    }
    for (const [name, decision] of Object.entries(newDecisions)) {
      decisions[name] = decision.addToLibrary ? 'create' : 'create';
    }

    setImportMatcherState({
      ...importMatcherState,
      decisions,
      status: 'importing',
    });

    // Simulate import completion
    setTimeout(() => {
      setImportMatcherState({
        ...importMatcherState,
        decisions,
        status: 'complete',
      });
      onComplete();
    }, 500);
  }, [importMatcherState, matchDecisions, newDecisions, setImportMatcherState, onComplete]);

  // --------------------------------------------------------------------------
  // Summary stats
  // --------------------------------------------------------------------------
  const libraryLinked = Object.values(matchDecisions).filter((d) => d === 'link').length;
  const newToAdd = Object.values(newDecisions).filter((d) => d.addToLibrary).length;

  // --------------------------------------------------------------------------
  // Guard: No import state
  // --------------------------------------------------------------------------
  if (!importMatcherState) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div
          className="rounded-xl shadow-2xl border w-full max-w-lg p-8 text-center"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
          }}
        >
          <AlertCircle size={40} className="mx-auto mb-4" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No import data available. Please start an import first.
          </p>
          <button
            onClick={onCancel}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium border hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="rounded-xl shadow-2xl border w-full max-w-3xl max-h-[90vh] flex flex-col"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Header                                                          */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              <Search size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                Import Analysis
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Review detected components against the library
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Summary Stats                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="grid grid-cols-3 gap-3 px-6 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg border"
            style={{
              borderColor: 'rgba(34,197,94,0.3)',
              backgroundColor: 'rgba(34,197,94,0.06)',
            }}
          >
            <CheckCircle size={18} className="text-green-400 shrink-0" />
            <div>
              <div className="text-lg font-bold text-green-400">{exactMatches.length}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Exact Matches
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg border"
            style={{
              borderColor: 'rgba(234,179,8,0.3)',
              backgroundColor: 'rgba(234,179,8,0.06)',
            }}
          >
            <Sparkles size={18} className="text-yellow-400 shrink-0" />
            <div>
              <div className="text-lg font-bold text-yellow-400">{similarMatches.length}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Similar
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg border"
            style={{
              borderColor: 'rgba(99,102,241,0.3)',
              backgroundColor: 'rgba(99,102,241,0.06)',
            }}
          >
            <Plus size={18} className="text-indigo-400 shrink-0" />
            <div>
              <div className="text-lg font-bold text-indigo-400">{newComponents.length}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                New
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Scrollable Body                                                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Section 1: Library Matches */}
          {libraryMatches.length > 0 && (
            <div>
              <h3
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide mb-3"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Library size={14} />
                Library Matches Found ({libraryMatches.length})
              </h3>

              <div
                className="border rounded-lg divide-y"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--bg-primary)',
                }}
              >
                {libraryMatches.map((match) => (
                  <MatchedComponentRow
                    key={match.incomingComponent.name}
                    match={match}
                    decision={matchDecisions[match.incomingComponent.name] ?? 'link'}
                    onDecisionChange={(d) => setMatchDecision(match.incomingComponent.name, d)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section 2: New Components */}
          {newComponents.length > 0 && (
            <div>
              <h3
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide mb-3"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Package size={14} />
                New Components ({newComponents.length})
              </h3>

              <div
                className="border rounded-lg divide-y"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--bg-primary)',
                }}
              >
                {newComponents.map((match) => {
                  const decision = newDecisions[match.incomingComponent.name];
                  return (
                    <NewComponentRow
                      key={match.incomingComponent.name}
                      match={match}
                      addToLibrary={decision?.addToLibrary ?? true}
                      category={decision?.category ?? 'clinical-observations'}
                      onToggleLibrary={() => toggleAddToLibrary(match.incomingComponent.name)}
                      onCategoryChange={(cat) => setNewCategory(match.incomingComponent.name, cat)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {matches.length === 0 && (
            <div className="text-center py-12">
              <Search size={40} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No components detected in the import.
              </p>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Footer                                                           */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {libraryLinked} linked from library &middot; {newToAdd} new to add
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors border hover:opacity-80"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importMatcherState.status === 'importing'}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              style={{
                backgroundColor:
                  importMatcherState.status === 'importing' ? 'var(--border)' : 'var(--accent)',
                color:
                  importMatcherState.status === 'importing' ? 'var(--text-secondary)' : '#fff',
                cursor:
                  importMatcherState.status === 'importing' ? 'not-allowed' : 'pointer',
              }}
            >
              <Upload size={14} />
              {importMatcherState.status === 'importing' ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

interface MatchedComponentRowProps {
  match: ComponentMatch;
  decision: 'link' | 'create';
  onDecisionChange: (decision: 'link' | 'create') => void;
}

function MatchedComponentRow({ match, decision, onDecisionChange }: MatchedComponentRowProps) {
  const isExact = match.matchType === 'exact';

  return (
    <div className="px-4 py-3" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: Component Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
              {match.incomingComponent.name}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: isExact ? 'var(--success-light)' : 'var(--warning-light)',
                color: isExact ? 'var(--success)' : 'var(--warning)',
              }}
            >
              {isExact ? 'Exact Match' : 'Similar'}
            </span>
          </div>

          {match.matchedComponent && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <Library size={11} />
              <span>
                {match.matchedComponent.name} &middot; v{match.matchedComponent.versionInfo.versionId}
              </span>
            </div>
          )}

          {match.similarity != null && match.matchType === 'similar' && (
            <div className="mt-1.5">
              <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(match.similarity * 100)}%`,
                    backgroundColor: match.similarity > 0.8 ? 'var(--success)' : 'var(--warning)',
                  }}
                />
              </div>
              <span className="text-[10px] mt-0.5 block" style={{ color: 'var(--text-secondary)' }}>
                {Math.round(match.similarity * 100)}% match
              </span>
            </div>
          )}

          {match.differences && match.differences.length > 0 && (
            <div className="mt-2 space-y-1">
              {match.differences.map((diff, idx) => (
                <div
                  key={idx}
                  className="text-[11px] px-2 py-1 rounded"
                  style={{
                    backgroundColor: 'rgba(234,179,8,0.06)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span className="font-medium">{diff.field}:</span> {diff.description}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => onDecisionChange('link')}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all border flex items-center gap-1.5"
            style={{
              backgroundColor: decision === 'link' ? 'var(--accent)' : 'transparent',
              borderColor: decision === 'link' ? 'var(--accent)' : 'var(--border)',
              color: decision === 'link' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <Library size={11} />
            Use Library Version
          </button>
          <button
            onClick={() => onDecisionChange('create')}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all border flex items-center gap-1.5"
            style={{
              backgroundColor: decision === 'create' ? 'var(--accent)' : 'transparent',
              borderColor: decision === 'create' ? 'var(--accent)' : 'var(--border)',
              color: decision === 'create' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <Plus size={11} />
            Keep as New
          </button>
        </div>
      </div>
    </div>
  );
}

interface NewComponentRowProps {
  match: ComponentMatch;
  addToLibrary: boolean;
  category: ComponentCategory;
  onToggleLibrary: () => void;
  onCategoryChange: (category: ComponentCategory) => void;
}

function NewComponentRow({
  match,
  addToLibrary,
  category,
  onToggleLibrary,
  onCategoryChange,
}: NewComponentRowProps) {
  return (
    <div className="px-4 py-3" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between gap-3">
        {/* Left: Component Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
              {match.incomingComponent.name}
            </span>
            {match.incomingComponent.valueSetOid && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
              >
                {match.incomingComponent.valueSetOid}
              </span>
            )}
          </div>
          {match.incomingComponent.valueSetName && (
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {match.incomingComponent.valueSetName}
            </div>
          )}
        </div>

        {/* Right: Add to Library + Category */}
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={addToLibrary}
              onChange={onToggleLibrary}
              className="rounded accent-indigo-500"
            />
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Add to Library
            </span>
          </label>

          {addToLibrary && (
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value as ComponentCategory)}
              className="px-2 py-1 rounded-md border text-xs outline-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
