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

import { useState, useEffect } from 'react';
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
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings2,
} from 'lucide-react';

import { ComponentCodeViewer } from './ComponentCodeViewer';
import { TimingBadge, TimingEditorPanel, TimingWindowLabel, TimingWindowEditor } from './TimingEditor';
import { useComponentCodeStore, getStoreKey } from '../../stores/componentCodeStore';
import { formatNoteTimestamp, getAllNotesForComponent } from '../../types/componentCode';
import { validateOID } from '../../services/oidValidator';

// Simple OID format validation for VSAC OIDs
const OID_PATTERN = /^2\.16\.840\.1\.113883(\.\d+)+$/;

function validateOidFormat(oid) {
  if (!oid || typeof oid !== 'string') return { valid: false, reason: 'OID is empty' };
  const trimmed = oid.trim();
  if (trimmed.startsWith('urn:oid:')) {
    return {
      valid: false,
      reason: 'Remove the "urn:oid:" prefix — use the bare OID only',
      suggestion: trimmed.replace('urn:oid:', ''),
    };
  }
  if (!OID_PATTERN.test(trimmed)) {
    return {
      valid: false,
      reason: 'OID must start with 2.16.840.1.113883 and contain only digits and dots',
    };
  }
  return { valid: true };
}

// ============================================================================
// Sub-Components
// ============================================================================

const SectionHeader = ({
  title,
  icon,
  isExpanded,
  onToggle,
  badge,
}                    ) => (
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

const ValueSetDisplay = ({
  valueSet,
  maxCodes = 10,
}                      ) => {
  const [showAllCodes, setShowAllCodes] = useState(false);
  const [copied, setCopied] = useState(false);
  const [oidValidation, setOidValidation] = useState                            (null);
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  const codes = valueSet.codes || [];
  const visibleCodes = showAllCodes ? codes : codes.slice(0, maxCodes);
  const hasMore = codes.length > maxCodes;

  // Validate OID on mount/change
  useEffect(() => {
    if (valueSet.oid) {
      const result = validateOID(valueSet.oid, valueSet.name);
      setOidValidation(result);
    } else {
      setOidValidation(null);
    }
  }, [valueSet.oid, valueSet.name]);

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
          {valueSet.oid && (() => {
            const formatValidation = validateOidFormat(valueSet.oid);
            return (
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyOid}
                    className="flex items-center gap-1 text-xs text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                  >
                    <span className={`font-mono ${!formatValidation.valid ? 'text-amber-400' : ''}`}>
                      {valueSet.oid}
                    </span>
                    {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                  </button>

                  {/* OID Validation Indicator */}
                  {oidValidation && formatValidation.valid && (
                    <button
                      onClick={() => setShowValidationDetails(!showValidationDetails)}
                      className={`
                        flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium
                        ${oidValidation.valid && oidValidation.warnings.length === 0
                          ? 'bg-green-500/10 text-green-500'
                          : oidValidation.valid && oidValidation.warnings.length > 0
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-red-500/10 text-red-500'
                        }
                      `}
                      title={oidValidation.valid ? 'Click for details' : 'Click to see validation errors'}
                    >
                      {oidValidation.valid && oidValidation.warnings.length === 0 ? (
                        <>
                          <CheckCircle size={10} />
                          Valid
                        </>
                      ) : oidValidation.valid && oidValidation.warnings.length > 0 ? (
                        <>
                          <AlertTriangle size={10} />
                          Warnings
                        </>
                      ) : (
                        <>
                          <XCircle size={10} />
                          Invalid
                        </>
                      )}
                    </button>
                  )}
                </div>
                {!formatValidation.valid && (
                  <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-300 space-y-0.5">
                      <div>{formatValidation.reason}</div>
                      {formatValidation.suggestion && (
                        <div className="font-mono text-amber-200">
                          Suggested: {formatValidation.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* OID Validation Details */}
          {showValidationDetails && oidValidation && (
            <div className={`
              mt-2 p-2 rounded-lg text-xs
              ${oidValidation.valid
                ? oidValidation.warnings.length > 0
                  ? 'bg-amber-500/10 border border-amber-500/30'
                  : 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-500/10 border border-red-500/30'
              }
            `}>
              {/* Catalogue match info */}
              {oidValidation.catalogMatch && (
                <div className="mb-2">
                  <span className="text-green-500 font-medium">Catalogue Match:</span>{' '}
                  <span className="text-[var(--text)]">{oidValidation.catalogMatch.name}</span>
                  {oidValidation.catalogMatch.steward && (
                    <span className="text-[var(--text-dim)]"> ({oidValidation.catalogMatch.steward})</span>
                  )}
                </div>
              )}

              {/* Errors */}
              {oidValidation.errors.length > 0 && (
                <div className="space-y-1">
                  {oidValidation.errors.map((error, i) => (
                    <div key={i} className="flex items-start gap-1 text-red-400">
                      <XCircle size={12} className="flex-shrink-0 mt-0.5" />
                      <span>{error.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {oidValidation.warnings.length > 0 && (
                <div className="space-y-1 mt-1">
                  {oidValidation.warnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-1 text-amber-400">
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      <span>{warning.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
};

const NotesHistory = ({ notes }                   ) => {
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
              {note.format.toUpperCase()}
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
};

// ============================================================================
// Main Component
// ============================================================================

/** Strip standalone AND/OR/NOT operators from descriptions */
function cleanDescription(desc                    )         {
  if (!desc) return '';
  return desc
    .replace(/\n\s*(AND|OR|NOT)\s*\n/gi, ' ')
    .replace(/\n\s*(AND|OR|NOT)\s*$/gi, '')
    .replace(/^\s*(AND|OR|NOT)\s*\n/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const ComponentDetailPanel = ({
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
  onSaveElementField,
}                           ) => {
  // Section visibility state
  const [expandedSections, setExpandedSections] = useState({
    details: true,
    valueSet: true,
    code: true,
    notes: false,
    status: true,
  });

  // Timing editor state
  const [isEditingTiming, setIsEditingTiming] = useState(false);
  const [isEditingTimingWindow, setIsEditingTimingWindow] = useState(false);

  // Code regeneration key (increment to force re-render of code viewer)
  const [codeRegenerationKey, setCodeRegenerationKey] = useState(0);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Handle code regeneration
  const handleRegenerateCode = () => {
    setIsRegenerating(true);
    // Force ComponentCodeViewer to remount and regenerate by changing key
    setCodeRegenerationKey(prev => prev + 1);
    // Brief animation delay
    setTimeout(() => setIsRegenerating(false), 500);
  };

  // Code state from store - use compound key (measureId::elementId) for isolation
  const storeKey = getStoreKey(measureId, element.id);
  const codeState = useComponentCodeStore((state) => state.codeStates[storeKey]);
  const defaultFormat = useComponentCodeStore((state) => state.defaultFormat);
  const setSelectedFormat = useComponentCodeStore((state) => state.setSelectedFormat);

  // Derive notes - only from actual overrides for THIS component
  const allNotes = codeState ? getAllNotesForComponent(codeState.overrides) : [];
  const hasOverride = codeState ? Object.values(codeState.overrides).some(o => o?.isLocked) : false;

  const toggleSection = (section                               ) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Handle code state changes - use compound key for store operations
  const handleCodeStateChange = (newState                    ) => {
    const currentFormat = codeState?.selectedFormat ?? defaultFormat;
    if (newState.selectedFormat !== currentFormat) {
      setSelectedFormat(storeKey, newState.selectedFormat);
    }
  };

  // Create effective code state for the viewer - use storeKey as componentId
  const effectiveCodeState                     = codeState ?? {
    componentId: storeKey,
    overrides: {},
    selectedFormat: defaultFormat,
    isEditing: false,
    pendingNote: '',
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
                onClick={() => onNavigateToLibrary?.(element.libraryComponentId )}
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

        {/* Status / Intent section - only for relevant types */}
        {['encounter', 'observation', 'assessment', 'medication'].includes(element.type) && (
          <div className="border-b border-[var(--border)]">
            <SectionHeader
              title="FHIR Status Filter"
              icon={<Settings2 size={16} />}
              isExpanded={expandedSections.status ?? true}
              onToggle={() => toggleSection('status')}
            />
            {(expandedSections.status ?? true) && (
              <div className="px-4 py-3 space-y-3">

                {/* Encounter status */}
                {element.type === 'encounter' && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                      Encounter Status
                    </label>
                    <select
                      value={element.encounterStatus || 'finished'}
                      onChange={(e) => onSaveElementField?.(element.id, 'encounterStatus', e.target.value)}
                      className="w-full text-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    >
                      <option value="finished">finished (eCQM standard)</option>
                      <option value="in-progress">in-progress</option>
                      <option value="cancelled">cancelled</option>
                      <option value="entered-in-error">entered-in-error</option>
                    </select>
                    <p className="text-xs text-[var(--text-dim)] mt-1">
                      Filters to encounters with this status. Default: finished.
                    </p>
                  </div>
                )}

                {/* Observation / assessment status */}
                {(element.type === 'observation' || element.type === 'assessment') && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
                      Observation Status (select all that apply)
                    </label>
                    {(['final', 'amended', 'corrected', 'preliminary', 'registered']).map((status) => (
                      <label key={status} className="flex items-center gap-2 mb-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(element.observationStatus || ['final', 'amended', 'corrected']).includes(status)}
                          onChange={(e) => {
                            const current = element.observationStatus || ['final', 'amended', 'corrected'];
                            const updated = e.target.checked
                              ? [...current, status]
                              : current.filter(s => s !== status);
                            onSaveElementField?.(element.id, 'observationStatus', updated);
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-[var(--text)]">{status}</span>
                        {status === 'final' || status === 'amended' || status === 'corrected'
                          ? <span className="text-xs text-[var(--text-dim)]">(eCQM standard)</span>
                          : null}
                      </label>
                    ))}
                  </div>
                )}

                {/* Medication intent */}
                {element.type === 'medication' && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                      MedicationRequest Intent
                    </label>
                    <select
                      value={element.medicationIntent || 'order'}
                      onChange={(e) => onSaveElementField?.(element.id, 'medicationIntent', e.target.value)}
                      className="w-full text-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    >
                      <option value="order">order (eCQM standard)</option>
                      <option value="original-order">original-order</option>
                      <option value="reflex-order">reflex-order</option>
                      <option value="filler-order">filler-order</option>
                      <option value="instance-order">instance-order</option>
                      <option value="plan">plan</option>
                      <option value="proposal">proposal</option>
                    </select>
                    <p className="text-xs text-[var(--text-dim)] mt-1">
                      Filters to medication requests with this intent. Default: order.
                    </p>
                  </div>
                )}
              </div>
            )}
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
                element.valueSet?.oid && !validateOidFormat(element.valueSet.oid).valid ? (
                  <span className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-400 rounded-full flex items-center gap-1">
                    <AlertTriangle size={10} />
                    Invalid OID
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs bg-[var(--bg-tertiary)] rounded-full">
                    {element.valueSet.codes?.length || 0}
                  </span>
                )
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
            {/* Regenerate button */}
            <div className="flex justify-end mb-3">
              <button
                onClick={handleRegenerateCode}
                disabled={isRegenerating}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                  border border-[var(--border)]
                  ${isRegenerating
                    ? 'text-[var(--text-dim)] cursor-not-allowed'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-secondary)]'
                  }
                  transition-colors
                `}
                title="Regenerate code from current component state"
              >
                <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
                {isRegenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>

            <ComponentCodeViewer
              key={`${element.id}-${codeRegenerationKey}`}  // Force remount on regenerate
              element={element}
              measureId={measureId}
              codeState={effectiveCodeState}
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
};

export default ComponentDetailPanel;
