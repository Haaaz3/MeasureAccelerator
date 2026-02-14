/**
 * ComponentDetailPanel
 *
 * A comprehensive detail panel for viewing and editing a selected component.
 * Shows:
 * - Component metadata (type, description, value set)
 * - Code viewer with format toggle
 * - Edit notes history
 * - Library linking status
 *
 * Used in the UMS Editor sidebar when a component is selected.
 */

import { useState, useMemo } from 'react';
import {
  X,
  Code2,
  FileText,
  Link2,
  Unlink,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Bookmark,
} from 'lucide-react';

import { ComponentCodeViewer } from './ComponentCodeViewer';
import { TimingBadge, TimingEditorPanel, TimingWindowLabel, TimingWindowEditor } from './TimingEditor';

// ============================================================================
// Helper Functions
// ============================================================================

function formatNoteTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getAllNotesForComponent(overrides) {
  if (!overrides) return [];
  const notes = [];
  Object.values(overrides).forEach(override => {
    if (override?.notes) {
      notes.push(...override.notes);
    }
  });
  return notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function cleanDescription(desc) {
  if (!desc) return '';
  return desc
    .replace(/\n\s*(AND|OR|NOT)\s*\n/gi, ' ')
    .replace(/\n\s*(AND|OR|NOT)\s*$/gi, '')
    .replace(/^\s*(AND|OR|NOT)\s*\n/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ============================================================================
// Sub-Components
// ============================================================================

function SectionHeader({ title, icon, isExpanded, onToggle, badge }) {
  return (
    <button
      onClick={onToggle}
      className="
        w-full flex items-center gap-2 px-4 py-3
        text-left text-sm font-medium text-[var(--text)]
        hover:bg-[var(--bg-secondary)] transition-colors
        border-b border-[var(--border)]
      "
    >
      <span className="text-[var(--text-dim)]">
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </span>
      <span className="text-[var(--primary)]">{icon}</span>
      <span className="flex-1">{title}</span>
      {badge}
    </button>
  );
}

function ValueSetDisplay({ valueSet, maxCodes = 10 }) {
  const [showAllCodes, setShowAllCodes] = useState(false);
  const [copied, setCopied] = useState(false);

  const codes = valueSet.codes || [];
  const visibleCodes = showAllCodes ? codes : codes.slice(0, maxCodes);
  const hasMore = codes.length > maxCodes;

  const handleCopyOid = async () => {
    if (valueSet.oid) {
      await navigator.clipboard.writeText(valueSet.oid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      {/* Value set header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-medium text-[var(--text)]">
            {valueSet.name}
          </h4>
          {valueSet.oid && (
            <button
              onClick={handleCopyOid}
              className="
                flex items-center gap-1 mt-1 text-xs text-[var(--text-dim)]
                hover:text-[var(--text-muted)]
              "
            >
              <span className="font-mono">{valueSet.oid}</span>
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>
          )}
        </div>

        <span className="
          px-2 py-0.5 text-xs rounded-full
          bg-[var(--primary)]/10 text-[var(--primary)]
        ">
          {codes.length} codes
        </span>
      </div>

      {/* Codes table */}
      {codes.length > 0 ? (
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[var(--bg-secondary)]">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">Code</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">Display</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">System</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visibleCodes.map((code, i) => (
                <tr key={`${code.code}-${i}`} className="hover:bg-[var(--bg-secondary)]">
                  <td className="px-3 py-2 font-mono text-[var(--text)]">{code.code}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)] truncate max-w-[200px]">{code.display}</td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-[10px]">
                      {code.system}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasMore && (
            <button
              onClick={() => setShowAllCodes(!showAllCodes)}
              className="
                w-full px-3 py-2 text-xs text-[var(--primary)]
                hover:bg-[var(--bg-secondary)] border-t border-[var(--border)]
              "
            >
              {showAllCodes ? 'Show less' : `Show all ${codes.length} codes`}
            </button>
          )}
        </div>
      ) : (
        <div className="
          flex items-center gap-2 px-3 py-2
          bg-red-500/10 text-red-400 rounded-lg text-sm
        ">
          <AlertTriangle size={14} />
          No codes defined for this value set
        </div>
      )}
    </div>
  );
}

function NotesHistory({ notes }) {
  if (notes.length === 0) {
    return (
      <div className="text-sm text-[var(--text-dim)] text-center py-4">
        No edit notes yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <div
          key={note.id}
          className="p-3 bg-[var(--bg-secondary)] rounded-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} className="text-[var(--text-dim)]" />
            <span className="text-xs text-[var(--text-dim)]">
              {formatNoteTimestamp(note.timestamp)}
            </span>
            <span className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] text-[10px] rounded">
              {note.format?.toUpperCase() || 'CODE'}
            </span>
            {note.changeType && (
              <span className="px-1.5 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] rounded">
                {note.changeType}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text)]">{note.content}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ComponentDetailPanel({
  element,
  measureId,
  onClose,
  onNavigateToLibrary,
  className = '',
  mpStart = '2024-01-01',
  mpEnd = '2024-12-31',
  onSaveTiming,
  onResetTiming,
  onSaveTimingWindow,
  onResetTimingWindow,
}) {
  // Section visibility state
  const [expandedSections, setExpandedSections] = useState({
    details: true,
    valueSet: true,
    code: true,
    notes: false,
  });

  // Timing editor state
  const [isEditingTiming, setIsEditingTiming] = useState(false);
  const [isEditingTimingWindow, setIsEditingTimingWindow] = useState(false);

  // Code state (local for now - could be connected to store)
  const [codeState, setCodeState] = useState({
    componentId: element.id,
    overrides: {},
    selectedFormat: 'cql',
    isEditing: false,
    pendingNote: '',
  });

  // Derive notes from code state
  const allNotes = useMemo(() => getAllNotesForComponent(codeState.overrides), [codeState.overrides]);
  const hasOverride = Object.values(codeState.overrides).some(o => o?.isLocked);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleCodeStateChange = (newState) => {
    setCodeState(newState);
  };

  return (
    <div className={`
      flex flex-col h-full bg-[var(--bg)]
      border-l border-[var(--border)]
      ${className}
    `}>
      {/* Panel Header */}
      <div className="
        flex items-center justify-between px-4 py-3
        border-b border-[var(--border)]
      ">
        <div className="flex items-center gap-2">
          <Bookmark size={18} className="text-[var(--primary)]" />
          <span className="font-semibold text-[var(--text)]">
            Component Details
          </span>
        </div>

        <button
          onClick={onClose}
          className="
            p-1.5 rounded-lg
            text-[var(--text-dim)] hover:text-[var(--text)]
            hover:bg-[var(--bg-secondary)]
          "
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Component Type & Status */}
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`
              px-2 py-0.5 text-xs font-medium rounded uppercase
              ${element.type === 'procedure' ? 'bg-purple-100 text-purple-700' :
                element.type === 'diagnosis' ? 'bg-red-100 text-red-700' :
                element.type === 'encounter' ? 'bg-[var(--success-light)] text-[var(--success)]' :
                element.type === 'observation' ? 'bg-cyan-100 text-cyan-700' :
                element.type === 'medication' ? 'bg-orange-100 text-orange-700' :
                'bg-gray-100 text-gray-600'}
            `}>
              {element.type}
            </span>

            {element.libraryComponentId ? (
              <button
                onClick={() => onNavigateToLibrary?.(element.libraryComponentId)}
                className="
                  flex items-center gap-1 px-2 py-0.5
                  bg-[var(--success-light)] text-[var(--success)] text-xs rounded-full
                  hover:opacity-80
                "
              >
                <Link2 size={10} />
                Library Linked
                <ExternalLink size={10} />
              </button>
            ) : (
              <span className="
                flex items-center gap-1 px-2 py-0.5
                bg-gray-100 text-gray-600 text-xs rounded-full
              ">
                <Unlink size={10} />
                Local
              </span>
            )}

            {hasOverride && (
              <span className="
                flex items-center gap-1 px-2 py-0.5
                bg-amber-500/10 text-amber-400 text-xs rounded-full
              ">
                <Code2 size={10} />
                Code Override
              </span>
            )}
          </div>

          <h3 className="text-lg font-medium text-[var(--text)]">
            {cleanDescription(element.description)}
          </h3>
        </div>

        {/* Details Section */}
        <SectionHeader
          title="Details"
          icon={<FileText size={16} />}
          isExpanded={expandedSections.details}
          onToggle={() => toggleSection('details')}
        />
        {expandedSections.details && (
          <div className="px-4 py-3 space-y-3 border-b border-[var(--border)]">
            {/* Timing Window editor (for "From X through Y" patterns) */}
            {element.timingWindow && (
              <div>
                <label className="text-xs text-[var(--text-dim)] mb-2 block">
                  Timing Window
                </label>
                <TimingWindowLabel
                  window={element.timingWindow}
                  mpStart={mpStart}
                  mpEnd={mpEnd}
                  onClick={() => setIsEditingTimingWindow(!isEditingTimingWindow)}
                />
                {isEditingTimingWindow && onSaveTimingWindow && onResetTimingWindow && (
                  <TimingWindowEditor
                    window={element.timingWindow}
                    mpStart={mpStart}
                    mpEnd={mpEnd}
                    onSave={(modified) => {
                      onSaveTimingWindow(element.id, modified);
                      setIsEditingTimingWindow(false);
                    }}
                    onCancel={() => setIsEditingTimingWindow(false)}
                    onReset={() => {
                      onResetTimingWindow(element.id);
                      setIsEditingTimingWindow(false);
                    }}
                  />
                )}
              </div>
            )}

            {/* Structured timing with badge and resolved dates (for single-point timing) */}
            {!element.timingWindow && element.timingOverride && (
              <div>
                <label className="text-xs text-[var(--text-dim)] mb-2 block">
                  Timing Constraint
                </label>
                <TimingBadge
                  timing={element.timingOverride}
                  mpStart={mpStart}
                  mpEnd={mpEnd}
                  onClick={() => setIsEditingTiming(!isEditingTiming)}
                />
                {isEditingTiming && onSaveTiming && onResetTiming && (
                  <TimingEditorPanel
                    timing={element.timingOverride}
                    mpStart={mpStart}
                    mpEnd={mpEnd}
                    onSave={(modified) => {
                      onSaveTiming(element.id, modified);
                      setIsEditingTiming(false);
                    }}
                    onCancel={() => setIsEditingTiming(false)}
                    onReset={() => {
                      onResetTiming(element.id);
                      setIsEditingTiming(false);
                    }}
                  />
                )}
              </div>
            )}

            {/* Legacy timing requirements display - only if no structured timing */}
            {!element.timingWindow && !element.timingOverride && element.timingRequirements?.length ? (
              <div>
                <label className="text-xs text-[var(--text-dim)]">
                  Timing
                </label>
                <div className="mt-1 space-y-1">
                  {element.timingRequirements.map((timing, i) => (
                    <div
                      key={i}
                      className="text-sm text-[var(--text)] font-mono bg-[var(--bg-secondary)] px-2 py-1 rounded"
                    >
                      {timing.description || `${timing.operator} ${timing.relativeTo}`}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {element.negation && (
              <div className="flex items-center gap-2 text-sm text-amber-400">
                <AlertTriangle size={14} />
                Negated (absence check)
              </div>
            )}

            {element.additionalRequirements?.length ? (
              <div>
                <label className="text-xs text-[var(--text-dim)]">
                  Additional Requirements
                </label>
                <ul className="mt-1 text-sm text-[var(--text-muted)] list-disc list-inside">
                  {element.additionalRequirements.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {/* Value Set Section */}
        {element.valueSet && (
          <>
            <SectionHeader
              title="Value Set"
              icon={<FileText size={16} />}
              isExpanded={expandedSections.valueSet}
              onToggle={() => toggleSection('valueSet')}
              badge={
                <span className="px-2 py-0.5 text-xs bg-[var(--bg-tertiary)] rounded-full">
                  {element.valueSet.codes?.length || 0}
                </span>
              }
            />
            {expandedSections.valueSet && (
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <ValueSetDisplay valueSet={element.valueSet} />
              </div>
            )}
          </>
        )}

        {/* Code Section */}
        <SectionHeader
          title="Generated Code"
          icon={<Code2 size={16} />}
          isExpanded={expandedSections.code}
          onToggle={() => toggleSection('code')}
          badge={
            hasOverride ? (
              <span className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-400 rounded-full">
                Override
              </span>
            ) : null
          }
        />
        {expandedSections.code && (
          <div className="p-4 border-b border-[var(--border)]">
            <ComponentCodeViewer
              key={element.id}
              element={element}
              measureId={measureId}
              codeState={codeState}
              onCodeStateChange={handleCodeStateChange}
            />
          </div>
        )}

        {/* Notes History Section */}
        <SectionHeader
          title="Edit Notes"
          icon={<MessageSquare size={16} />}
          isExpanded={expandedSections.notes}
          onToggle={() => toggleSection('notes')}
          badge={
            allNotes.length > 0 ? (
              <span className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded-full">
                {allNotes.length}
              </span>
            ) : null
          }
        />
        {expandedSections.notes && (
          <div className="px-4 py-3">
            <NotesHistory notes={allNotes} />
          </div>
        )}
      </div>
    </div>
  );
}

export default ComponentDetailPanel;
