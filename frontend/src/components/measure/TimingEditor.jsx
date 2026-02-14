/**
 * TimingEditor - Components for editing timing constraints
 *
 * Exports:
 * - MeasurePeriodBar: Display/edit measurement period dates
 * - TimingBadge: Display timing constraint with resolved dates
 * - TimingEditorPanel: Full timing constraint editor
 * - TimingWindowLabel: Display timing window ("From X through Y")
 * - TimingWindowEditor: Editor for timing windows
 */

import { useState, useCallback, useMemo } from 'react';
import { Clock, X, RotateCcw } from 'lucide-react';

// ============================================================================
// Constants
// ============================================================================

const TIMING_OPERATORS = [
  'during',
  'before end of',
  'after start of',
  'within',
  'same day as',
  'before',
  'after',
];

const TIME_UNITS = [
  'day(s)',
  'week(s)',
  'month(s)',
  'year(s)',
];

const TIMING_ANCHORS = [
  'Measurement Period',
  'Measurement Period Start',
  'Measurement Period End',
  'index encounter',
  'qualifying encounter',
];

const TIMING_WINDOW_ANCHORS = [
  'MP Start',
  'MP End',
  'index encounter',
  'birth date',
];

// ============================================================================
// Helper Functions
// ============================================================================

function getEffectiveTiming(timing) {
  if (!timing) return null;
  return timing.modified || timing.original;
}

function isTimingModified(timing) {
  return timing?.modified !== null && timing?.modified !== undefined;
}

function getEffectiveWindow(window) {
  if (!window) return null;
  return window.modified || window.original;
}

function isWindowModified(window) {
  return window?.modified !== null && window?.modified !== undefined;
}

function formatTimingExpression(timing) {
  if (!timing) return '';

  let expr = timing.operator || 'during';

  if (timing.value && timing.unit) {
    expr += ` ${timing.value} ${timing.unit}`;
  }

  if (timing.anchor) {
    expr += ` ${timing.anchor}`;
  }

  return expr;
}

function formatDate(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;
  return date.toISOString().split('T')[0];
}

function toISODate(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;
  return date.toISOString().split('T')[0];
}

function resolveTimingWindow(timing, mpStart, mpEnd) {
  if (!timing) return null;

  const start = new Date(mpStart + 'T00:00:00');
  const end = new Date(mpEnd + 'T23:59:59');

  // Simple resolution for common patterns
  if (timing.operator === 'during' && timing.anchor?.includes('Measurement Period')) {
    return { from: start, to: end };
  }

  // Return measurement period as fallback
  return { from: start, to: end };
}

function formatTimingWindow(window) {
  if (!window) return '';

  const startAnchor = window.start?.anchor || 'MP Start';
  const endAnchor = window.end?.anchor || 'MP End';

  let startStr = startAnchor;
  if (window.start?.offsetValue) {
    startStr += ` ${window.start.offsetDirection === 'after' ? '+' : '-'}${window.start.offsetValue} ${window.start.offsetUnit}`;
  }

  let endStr = endAnchor;
  if (window.end?.offsetValue) {
    endStr += ` ${window.end.offsetDirection === 'after' ? '+' : '-'}${window.end.offsetValue} ${window.end.offsetUnit}`;
  }

  return `From ${startStr} through ${endStr}`;
}

function formatWindowResolved(window, mpStart, mpEnd) {
  if (!window) return '';

  const start = new Date(mpStart + 'T00:00:00');
  const end = new Date(mpEnd + 'T23:59:59');

  return `${formatDate(start)} → ${formatDate(end)}`;
}

// ============================================================================
// MeasurePeriodBar
// ============================================================================

export function MeasurePeriodBar({
  mpStart,
  mpEnd,
  onStartChange,
  onEndChange,
}) {
  const start = new Date(mpStart + 'T00:00:00');
  const end = new Date(mpEnd + 'T00:00:00');
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4 mb-4 flex items-center gap-5 flex-wrap">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-sm bg-[var(--accent)]" />
        <span className="text-xs font-semibold text-[var(--text)] uppercase tracking-wide">
          Measurement Period
        </span>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wide">
          Start
        </label>
        <input
          type="date"
          value={mpStart}
          onChange={(e) => onStartChange(e.target.value)}
          className="px-2 py-1.5 border border-[var(--accent)]/30 rounded text-sm font-mono text-[var(--accent)] bg-[var(--accent-light)]"
        />
      </div>

      <span className="text-[var(--text-dim)]">→</span>

      <div className="flex items-center gap-2">
        <label className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wide">
          End
        </label>
        <input
          type="date"
          value={mpEnd}
          onChange={(e) => onEndChange(e.target.value)}
          className="px-2 py-1.5 border border-[var(--accent)]/30 rounded text-sm font-mono text-[var(--accent)] bg-[var(--accent-light)]"
        />
      </div>

      <div className="px-3 py-1 bg-[var(--accent-light)] rounded-full text-xs font-mono text-[var(--accent)] font-semibold">
        {diffDays} days
      </div>
    </div>
  );
}

// ============================================================================
// TimingBadge
// ============================================================================

export function TimingBadge({ timing, mpStart, mpEnd, onClick }) {
  if (!timing) return null;

  const effective = getEffectiveTiming(timing);
  if (!effective) return null;

  const modified = isTimingModified(timing);
  const window = resolveTimingWindow(effective, mpStart, mpEnd);
  const display = formatTimingExpression(effective);

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border cursor-pointer transition-all hover:ring-2 hover:ring-white/20 ${
          modified
            ? 'bg-[var(--warning-light)] border-[var(--warning)] text-[var(--warning)]'
            : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-muted)]'
        }`}
        title="Click to edit timing constraint"
      >
        <Clock className="w-3 h-3" />
        {display}
        {modified && <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)]" />}
      </button>
      {window && (
        <span className="text-[11px] font-mono text-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 rounded whitespace-nowrap">
          {formatDate(window.from)} → {formatDate(window.to)}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// TimingEditorPanel
// ============================================================================

export function TimingEditorPanel({
  timing,
  mpStart,
  mpEnd,
  onSave,
  onCancel,
  onReset,
}) {
  const effective = getEffectiveTiming(timing);
  const [draft, setDraft] = useState({ ...effective });
  const [editMode, setEditMode] = useState('structured');

  const needsValue =
    draft.operator === 'within' ||
    draft.operator === 'before end of' ||
    draft.operator === 'after start of';

  const previewWindow = useMemo(
    () => resolveTimingWindow(draft, mpStart, mpEnd),
    [draft, mpStart, mpEnd]
  );

  const handleOperatorChange = (op) => {
    const needsVal =
      op === 'within' || op === 'before end of' || op === 'after start of';
    setDraft({
      ...draft,
      operator: op,
      value: needsVal ? draft.value || 1 : null,
      unit: needsVal ? draft.unit || 'year(s)' : null,
    });
  };

  return (
    <div className="bg-[var(--bg)] border-2 border-[var(--accent)] rounded-lg p-5 mt-2 shadow-lg">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-semibold text-[var(--text)] uppercase tracking-wide">
          Edit Timing — {draft.concept}
        </span>
        {timing.original && (
          <span className="text-[11px] text-[var(--text-dim)] font-mono">
            Original: {formatTimingExpression(timing.original)}
          </span>
        )}
      </div>

      {/* Mode toggle */}
      <div className="inline-flex bg-[var(--bg-secondary)] rounded-lg p-1 mb-4">
        {['structured', 'dates'].map((mode) => (
          <button
            key={mode}
            onClick={() => setEditMode(mode)}
            className={`px-4 py-1.5 text-xs font-medium rounded transition-all ${
              editMode === mode
                ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {mode === 'structured' ? 'Structured' : 'Date Range'}
          </button>
        ))}
      </div>

      {/* Structured editing mode */}
      {editMode === 'structured' && (
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Operator
            </label>
            <select
              value={draft.operator}
              onChange={(e) => handleOperatorChange(e.target.value)}
              className="px-3 py-2 border border-[var(--border)] rounded text-sm font-mono bg-[var(--bg)] text-[var(--text)] min-w-[140px]"
            >
              {TIMING_OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>

          {needsValue && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                  Value
                </label>
                <input
                  type="number"
                  min={1}
                  value={draft.value || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, value: parseInt(e.target.value) || null })
                  }
                  className="px-3 py-2 border border-[var(--border)] rounded text-sm font-mono bg-[var(--bg)] text-[var(--text)] w-20"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                  Unit
                </label>
                <select
                  value={draft.unit || 'year(s)'}
                  onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  className="px-3 py-2 border border-[var(--border)] rounded text-sm font-mono bg-[var(--bg)] text-[var(--text)]"
                >
                  {TIME_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Anchor
            </label>
            <select
              value={draft.anchor}
              onChange={(e) => setDraft({ ...draft, anchor: e.target.value })}
              className="px-3 py-2 border border-[var(--border)] rounded text-sm font-mono bg-[var(--bg)] text-[var(--text)] min-w-[180px]"
            >
              {TIMING_ANCHORS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Date range editing mode */}
      {editMode === 'dates' && (
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Window Start
            </label>
            <input
              type="date"
              value={previewWindow ? toISODate(previewWindow.from) : ''}
              className="px-3 py-2 border border-[var(--accent)]/30 rounded text-sm font-mono text-[var(--accent)] bg-[var(--accent-light)] min-w-[150px]"
              readOnly
            />
          </div>

          <span className="text-[var(--text-dim)] text-lg pb-2">→</span>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Window End
            </label>
            <input
              type="date"
              value={previewWindow ? toISODate(previewWindow.to) : ''}
              className="px-3 py-2 border border-[var(--accent)]/30 rounded text-sm font-mono text-[var(--accent)] bg-[var(--accent-light)] min-w-[150px]"
              readOnly
            />
          </div>

          <div className="px-3 py-2 bg-[var(--bg-secondary)] rounded border border-[var(--border)] text-[11px] font-mono text-[var(--text-muted)]">
            <span className="text-[var(--text-dim)]">resolves to: </span>
            <span className="text-[var(--text)] font-medium">
              {formatTimingExpression(draft)}
            </span>
          </div>
        </div>
      )}

      {/* Live resolved date preview */}
      <div className="mt-4 p-3 bg-[var(--accent-light)] rounded-lg border border-[var(--accent)]/30 flex items-center gap-3">
        <span className="text-xs font-semibold text-[var(--accent)]">
          Resolved Window:
        </span>
        {previewWindow ? (
          <span className="text-sm font-mono text-[var(--accent)] font-medium">
            {formatDate(previewWindow.from)} → {formatDate(previewWindow.to)}
          </span>
        ) : (
          <span className="text-xs text-[var(--text-dim)] italic">
            Cannot resolve — anchor not tied to measurement period
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onSave(draft)}
          className="px-5 py-2 bg-[var(--accent)] text-white rounded font-medium text-sm hover:opacity-90 transition-all"
        >
          Apply
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-transparent text-[var(--text-muted)] border border-[var(--border)] rounded font-medium text-sm hover:bg-[var(--bg-secondary)] transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onReset}
          className="ml-auto px-4 py-2 bg-transparent text-[var(--text-dim)] border border-dashed border-[var(--border)] rounded font-medium text-xs hover:text-[var(--text-muted)] transition-all flex items-center gap-1.5"
        >
          <RotateCcw className="w-3 h-3" />
          Reset to Original
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// TimingWindowLabel
// ============================================================================

export function TimingWindowLabel({
  window,
  mpStart,
  mpEnd,
  onClick,
}) {
  const effective = getEffectiveWindow(window);
  if (!effective) return null;

  const modified = isWindowModified(window);
  const displayText = formatTimingWindow(effective);
  const resolvedText = formatWindowResolved(effective, mpStart, mpEnd);

  return (
    <div className="inline-flex items-center gap-3 flex-wrap">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-mono rounded border cursor-pointer transition-all hover:ring-2 hover:ring-white/20 ${
          modified
            ? 'bg-[var(--warning-light)] border-[var(--warning)] text-[var(--warning)]'
            : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text)]'
        }`}
        title="Click to edit timing window"
      >
        <Clock className="w-3.5 h-3.5" />
        <span>{displayText}</span>
        {modified && <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)]" />}
      </button>
      <span className="text-xs font-mono text-[var(--accent)] bg-[var(--accent-light)] px-2.5 py-1 rounded whitespace-nowrap">
        {resolvedText}
      </span>
    </div>
  );
}

// ============================================================================
// BoundaryEditor (internal)
// ============================================================================

function BoundaryEditor({ boundary, onChange, label }) {
  const hasOffset = boundary.offsetValue !== null;

  const handleAnchorChange = (anchor) => {
    onChange({ ...boundary, anchor });
  };

  const handleAddOffset = () => {
    onChange({
      ...boundary,
      offsetValue: 1,
      offsetUnit: 'day(s)',
      offsetDirection: 'after',
    });
  };

  const handleRemoveOffset = () => {
    onChange({
      ...boundary,
      offsetValue: null,
      offsetUnit: null,
      offsetDirection: null,
    });
  };

  return (
    <div className="inline-flex items-center gap-2">
      <select
        value={boundary.anchor}
        onChange={(e) => handleAnchorChange(e.target.value)}
        className="px-2 py-1.5 border border-[var(--border)] rounded text-sm font-mono bg-[var(--bg)] text-[var(--text)] min-w-[100px]"
      >
        {TIMING_WINDOW_ANCHORS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      {hasOffset ? (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <button
            onClick={() => onChange({
              ...boundary,
              offsetDirection: boundary.offsetDirection === 'after' ? 'before' : 'after'
            })}
            className={`px-1.5 py-0.5 text-xs font-bold rounded transition-colors ${
              boundary.offsetDirection === 'after'
                ? 'bg-[var(--success-light)] text-[var(--success)]'
                : 'bg-[var(--danger-light)] text-[var(--danger)]'
            }`}
            title="Toggle before/after"
          >
            {boundary.offsetDirection === 'after' ? '+' : '−'}
          </button>

          <input
            type="number"
            min={1}
            value={boundary.offsetValue || ''}
            onChange={(e) => onChange({ ...boundary, offsetValue: parseInt(e.target.value) || 1 })}
            className="w-14 px-2 py-0.5 border border-[var(--border)] rounded text-sm font-mono bg-[var(--bg)] text-[var(--text)] text-center"
          />

          <select
            value={boundary.offsetUnit || 'day(s)'}
            onChange={(e) => onChange({ ...boundary, offsetUnit: e.target.value })}
            className="px-1.5 py-0.5 border border-[var(--border)] rounded text-xs font-mono bg-[var(--bg)] text-[var(--text)]"
          >
            <option value="day(s)">days</option>
            <option value="month(s)">months</option>
            <option value="year(s)">years</option>
          </select>

          <button
            onClick={handleRemoveOffset}
            className="text-[var(--text-dim)] hover:text-[var(--danger)] transition-colors"
            title="Remove offset"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={handleAddOffset}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          + add offset
        </button>
      )}
    </div>
  );
}

// ============================================================================
// TimingWindowEditor
// ============================================================================

export function TimingWindowEditor({
  window,
  mpStart,
  mpEnd,
  onSave,
  onCancel,
  onReset,
}) {
  const effective = getEffectiveWindow(window);
  const [draft, setDraft] = useState({ ...effective });

  const handleStartChange = (boundary) => {
    setDraft({ ...draft, start: boundary });
  };

  const handleEndChange = (boundary) => {
    setDraft({ ...draft, end: boundary });
  };

  const resolvedPreview = formatWindowResolved(draft, mpStart, mpEnd);

  return (
    <div className="bg-[var(--bg)] border-2 border-[var(--accent)] rounded-lg p-4 mt-2 shadow-lg">
      {/* Original reference */}
      {window.sourceText && (
        <div className="text-[11px] text-[var(--text-dim)] font-mono mb-3">
          Original: "{window.sourceText}"
        </div>
      )}

      {/* Inline sentence editor */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-[var(--text-muted)]">From</span>
        <BoundaryEditor
          boundary={draft.start}
          onChange={handleStartChange}
          label="start"
        />
        <span className="text-sm font-medium text-[var(--text-muted)]">through</span>
        <BoundaryEditor
          boundary={draft.end}
          onChange={handleEndChange}
          label="end"
        />
      </div>

      {/* Live resolved preview */}
      <div className="mt-3 p-2 bg-[var(--accent-light)] rounded border border-[var(--accent)]/30 inline-flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--accent)]">Resolves to:</span>
        <span className="text-sm font-mono text-[var(--accent)] font-medium">
          {resolvedPreview}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onSave(draft)}
          className="px-4 py-1.5 bg-[var(--accent)] text-white rounded font-medium text-sm hover:opacity-90 transition-all"
        >
          Apply
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-transparent text-[var(--text-muted)] border border-[var(--border)] rounded font-medium text-sm hover:bg-[var(--bg-secondary)] transition-all"
        >
          Cancel
        </button>
        {isWindowModified(window) && (
          <button
            onClick={onReset}
            className="ml-auto px-3 py-1.5 bg-transparent text-[var(--text-dim)] border border-dashed border-[var(--border)] rounded font-medium text-xs hover:text-[var(--text-muted)] transition-all flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
