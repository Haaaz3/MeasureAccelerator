import { useState, useCallback, useMemo } from 'react';
import { Clock, X, RotateCcw } from 'lucide-react';
import type {
  TimingConstraint,
  TimingOverride,
  TimingOperator,
  TimeUnit,
  TimingAnchor,
  TimingWindow,
  TimingWindowOverride,
  TimingBoundary,
  OffsetUnit,
} from '../../types/ums';
import {
  TIMING_OPERATORS,
  TIME_UNITS,
  TIMING_ANCHORS,
  TIMING_WINDOW_ANCHORS,
  getEffectiveTiming,
  isTimingModified,
  getEffectiveWindow,
  isWindowModified,
} from '../../types/ums';
import {
  resolveTimingWindow,
  reverseCalcTiming,
  toISODate,
  formatDate,
  formatTimingExpression,
  formatTimingWindow,
  formatWindowResolved,
} from '../../utils/timingResolver';

interface MeasurePeriodBarProps {
  mpStart: string;
  mpEnd: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
}

export function MeasurePeriodBar({
  mpStart,
  mpEnd,
  onStartChange,
  onEndChange,
}: MeasurePeriodBarProps) {
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

interface TimingBadgeProps {
  timing: TimingOverride | null;
  mpStart: string;
  mpEnd: string;
  onClick: () => void;
}

export function TimingBadge({ timing, mpStart, mpEnd, onClick }: TimingBadgeProps) {
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

interface TimingEditorPanelProps {
  timing: TimingOverride;
  mpStart: string;
  mpEnd: string;
  onSave: (modified: TimingConstraint) => void;
  onCancel: () => void;
  onReset: () => void;
}

export function TimingEditorPanel({
  timing,
  mpStart,
  mpEnd,
  onSave,
  onCancel,
  onReset,
}: TimingEditorPanelProps) {
  const effective = getEffectiveTiming(timing)!;
  const [draft, setDraft] = useState<TimingConstraint>({ ...effective });
  const [editMode, setEditMode] = useState<'structured' | 'dates'>('structured');

  const needsValue =
    draft.operator === 'within' ||
    draft.operator === 'before end of' ||
    draft.operator === 'after start of';

  const previewWindow = useMemo(
    () => resolveTimingWindow(draft, mpStart, mpEnd),
    [draft, mpStart, mpEnd]
  );

  const handleDateChange = useCallback(
    (field: 'from' | 'to', dateStr: string) => {
      if (!previewWindow) return;
      const currentFrom = toISODate(previewWindow.from);
      const currentTo = toISODate(previewWindow.to);
      const newFrom = field === 'from' ? dateStr : currentFrom;
      const newTo = field === 'to' ? dateStr : currentTo;
      const newTiming = reverseCalcTiming(newFrom, newTo, draft, mpStart, mpEnd);
      setDraft(newTiming);
    },
    [draft, mpStart, mpEnd, previewWindow]
  );

  const handleOperatorChange = (op: TimingOperator) => {
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
        {(['structured', 'dates'] as const).map((mode) => (
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
              onChange={(e) => handleOperatorChange(e.target.value as TimingOperator)}
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
                  onChange={(e) => setDraft({ ...draft, unit: e.target.value as TimeUnit })}
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
              onChange={(e) => setDraft({ ...draft, anchor: e.target.value as TimingAnchor })}
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
              onChange={(e) => handleDateChange('from', e.target.value)}
              className="px-3 py-2 border border-[var(--accent)]/30 rounded text-sm font-mono text-[var(--accent)] bg-[var(--accent-light)] min-w-[150px]"
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
              onChange={(e) => handleDateChange('to', e.target.value)}
              className="px-3 py-2 border border-[var(--accent)]/30 rounded text-sm font-mono text-[var(--accent)] bg-[var(--accent-light)] min-w-[150px]"
            />
          </div>

          {/* Shows what it resolved to */}
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

// ============================================================
// Timing Window Components (for "From X through Y" patterns)
// ============================================================

interface TimingWindowLabelProps {
  window: TimingWindowOverride;
  mpStart: string;
  mpEnd: string;
  onClick: () => void;
}

export function TimingWindowLabel({
  window,
  mpStart,
  mpEnd,
  onClick,
}: TimingWindowLabelProps) {
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

interface BoundaryEditorProps {
  boundary: TimingBoundary;
  onChange: (boundary: TimingBoundary) => void;
  label: string;
}

function BoundaryEditor({ boundary, onChange, label }: BoundaryEditorProps) {
  const hasOffset = boundary.offsetValue !== null;

  const handleAnchorChange = (anchor: TimingAnchor) => {
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

  const handleOffsetValueChange = (value: number) => {
    onChange({ ...boundary, offsetValue: value });
  };

  const handleOffsetUnitChange = (unit: OffsetUnit) => {
    onChange({ ...boundary, offsetUnit: unit });
  };

  const handleOffsetDirectionChange = (direction: 'before' | 'after') => {
    onChange({ ...boundary, offsetDirection: direction });
  };

  return (
    <div className="inline-flex items-center gap-2">
      {/* Anchor dropdown */}
      <select
        value={boundary.anchor}
        onChange={(e) => handleAnchorChange(e.target.value as TimingAnchor)}
        className="px-2 py-1.5 border border-[var(--border)] rounded text-sm font-mono bg-[var(--bg)] text-[var(--text)] min-w-[100px]"
      >
        {TIMING_WINDOW_ANCHORS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      {/* Offset controls */}
      {hasOffset ? (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          {/* Direction toggle */}
          <button
            onClick={() => handleOffsetDirectionChange(boundary.offsetDirection === 'after' ? 'before' : 'after')}
            className={`px-1.5 py-0.5 text-xs font-bold rounded transition-colors ${
              boundary.offsetDirection === 'after'
                ? 'bg-[var(--success-light)] text-[var(--success)]'
                : 'bg-[var(--danger-light)] text-[var(--danger)]'
            }`}
            title="Toggle before/after"
          >
            {boundary.offsetDirection === 'after' ? '+' : '−'}
          </button>

          {/* Value input */}
          <input
            type="number"
            min={1}
            value={boundary.offsetValue || ''}
            onChange={(e) => handleOffsetValueChange(parseInt(e.target.value) || 1)}
            className="w-14 px-2 py-0.5 border border-[var(--border)] rounded text-sm font-mono bg-[var(--bg)] text-[var(--text)] text-center"
          />

          {/* Unit dropdown */}
          <select
            value={boundary.offsetUnit || 'day(s)'}
            onChange={(e) => handleOffsetUnitChange(e.target.value as OffsetUnit)}
            className="px-1.5 py-0.5 border border-[var(--border)] rounded text-xs font-mono bg-[var(--bg)] text-[var(--text)]"
          >
            <option value="day(s)">days</option>
            <option value="month(s)">months</option>
            <option value="year(s)">years</option>
          </select>

          {/* Remove offset */}
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

interface TimingWindowEditorProps {
  window: TimingWindowOverride;
  mpStart: string;
  mpEnd: string;
  onSave: (modified: TimingWindow) => void;
  onCancel: () => void;
  onReset: () => void;
}

export function TimingWindowEditor({
  window,
  mpStart,
  mpEnd,
  onSave,
  onCancel,
  onReset,
}: TimingWindowEditorProps) {
  const effective = getEffectiveWindow(window)!;
  const [draft, setDraft] = useState<TimingWindow>({ ...effective });

  const handleStartChange = (boundary: TimingBoundary) => {
    setDraft({ ...draft, start: boundary });
  };

  const handleEndChange = (boundary: TimingBoundary) => {
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
