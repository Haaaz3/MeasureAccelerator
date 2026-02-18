/**
 * ComponentCodeViewer
 *
 * A code viewer and editor component that:
 * - Displays generated code for a single component in multiple formats
 * - Allows manual code overrides with mandatory notes
 * - Shows edit history with timestamps
 * - Integrates with component library and UMS editor
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Code2,
  Edit3,
  RotateCcw,
  MessageSquare,
  Clock,
  AlertTriangle,
  Lock,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  GitCompare,
} from 'lucide-react';
import { diffLines, type Change } from 'diff';

import type { DataElement } from '../../types/ums';
import type {
  CodeOutputFormat,
  CodeEditNote,
  ComponentCodeState,
} from '../../types/componentCode';

import {
  formatNoteTimestamp,
  getAllNotesForComponent,
  getFormatLabel,
} from '../../types/componentCode';

import { generateComponentCode } from '../../services/componentCodeGenerator';
import { useComponentCodeStore, getStoreKey } from '../../stores/componentCodeStore';
import { validateCQLSyntax, type CQLValidationResult } from '../../services/cqlValidator';

// ============================================================================
// Sub-Components
// ============================================================================

interface FormatSelectorProps {
  selectedFormat: CodeOutputFormat;
  onChange: (format: CodeOutputFormat) => void;
  disabled?: boolean;
}

const FormatSelector = ({
  selectedFormat,
  onChange,
  disabled,
}: FormatSelectorProps) => {
  const formats: { value: CodeOutputFormat; label: string }[] = [
    { value: 'cql', label: 'CQL' },
    { value: 'synapse-sql', label: 'Synapse SQL' },
  ];

  return (
    <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-lg p-1">
      {formats.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          disabled={disabled}
          className={`
            px-3 py-1.5 text-xs font-medium rounded-md transition-all
            ${selectedFormat === value
              ? 'bg-[var(--primary)] text-white'
              : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)]'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

interface CodeNoteListInternalProps {
  notes: CodeEditNote[];
  maxVisible?: number;
}

const CodeNoteListInternal = ({ notes, maxVisible = 3 }: CodeNoteListInternalProps) => {
  const [expanded, setExpanded] = useState(false);

  if (notes.length === 0) return null;

  const visibleNotes = expanded ? notes : notes.slice(0, maxVisible);
  const hasMore = notes.length > maxVisible;

  return (
    <div className="border-t border-[var(--border)] pt-3 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare size={14} className="text-[var(--text-muted)]" />
        <span className="text-xs font-medium text-[var(--text-muted)]">
          Edit Notes ({notes.length})
        </span>
      </div>

      <div className="space-y-2">
        {visibleNotes.map((note) => (
          <div
            key={note.id}
            className="bg-[var(--bg-secondary)] rounded-lg p-3 text-sm"
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] rounded font-medium">
                {getFormatLabel(note.format)}
              </span>
              <Clock size={12} className="text-[var(--text-dim)]" />
              <span className="text-xs text-[var(--text-dim)]">
                {formatNoteTimestamp(note.timestamp)}
              </span>
              {note.changeType && (
                <span className="px-1.5 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] rounded">
                  {note.changeType}
                </span>
              )}
            </div>
            <p className="text-[var(--text)]">{note.content}</p>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-[var(--primary)] hover:underline"
        >
          {expanded ? 'Show less' : `Show ${notes.length - maxVisible} more`}
        </button>
      )}
    </div>
  );
};

interface NoteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder?: string;
}

const NoteInput = ({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder = 'Describe your changes (required)...',
}: NoteInputProps) => {
  const isValid = value.trim().length >= 10;

  return (
    <div className="border-t border-[var(--border)] pt-3 mt-3">
      <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
        Edit Note <span className="text-red-400">*</span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className={`
          w-full px-3 py-2 text-sm rounded-lg border
          bg-[var(--bg)] text-[var(--text)]
          placeholder:text-[var(--text-dim)]
          focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50
          ${!isValid && value.length > 0 ? 'border-amber-500' : 'border-[var(--border)]'}
        `}
      />
      {!isValid && value.length > 0 && (
        <p className="mt-1 text-xs text-amber-500">
          Note must be at least 10 characters
        </p>
      )}

      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!isValid}
          className={`
            px-4 py-1.5 text-sm font-medium rounded-lg
            ${isValid
              ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-dim)] cursor-not-allowed'
            }
          `}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export interface ComponentCodeViewerProps {
  element: DataElement;
  /** The measure ID - required for scoping overrides to the correct measure */
  measureId: string;
  codeState: ComponentCodeState;
  onCodeStateChange: (state: ComponentCodeState) => void;
  populationId?: string;
  isLibraryLinked?: boolean;
  className?: string;
}

export const ComponentCodeViewer = ({
  element,
  measureId,
  codeState,
  onCodeStateChange,
  populationId,
  isLibraryLinked,
  className = '',
}: ComponentCodeViewerProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [copied, setCopied] = useState(false);

  // CQL syntax validation state
  const [syntaxValidation, setSyntaxValidation] = useState<CQLValidationResult | null>(null);
  const [showSyntaxWarnings, setShowSyntaxWarnings] = useState(false);
  const syntaxCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Diff view state
  const [showDiff, setShowDiff] = useState(false);

  // Compound store key for measure-scoped isolation
  const storeKey = getStoreKey(measureId, element.id);

  const currentOverride = codeState.overrides[codeState.selectedFormat];

  // Generate code for current format
  const generatedResult = useMemo(() => {
    return generateComponentCode(
      element,
      codeState.selectedFormat,
      currentOverride,
      populationId
    );
  }, [element, codeState.selectedFormat, currentOverride, populationId]);

  // Get all notes across all formats
  const allNotes = useMemo(() => {
    return getAllNotesForComponent(codeState.overrides);
  }, [codeState.overrides]);

  // Compute diff when override is active
  const diffResult = useMemo(() => {
    if (!currentOverride?.isLocked || !currentOverride.originalGeneratedCode) {
      return null;
    }
    return diffLines(currentOverride.originalGeneratedCode, currentOverride.code);
  }, [currentOverride]);

  // Initialize edited code when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditedCode(currentOverride?.code || generatedResult.code);
      setSyntaxValidation(null);
      setShowSyntaxWarnings(false);
    }
  }, [isEditing]);

  // Debounced syntax validation as user types (for CQL only)
  useEffect(() => {
    if (!isEditing || codeState.selectedFormat !== 'cql') {
      setSyntaxValidation(null);
      return;
    }

    // Clear previous timeout
    if (syntaxCheckTimeoutRef.current) {
      clearTimeout(syntaxCheckTimeoutRef.current);
    }

    // Debounce: validate after 800ms of no typing
    syntaxCheckTimeoutRef.current = setTimeout(() => {
      const result = validateCQLSyntax(editedCode);
      setSyntaxValidation(result);
    }, 800);

    return () => {
      if (syntaxCheckTimeoutRef.current) {
        clearTimeout(syntaxCheckTimeoutRef.current);
      }
    };
  }, [editedCode, isEditing, codeState.selectedFormat]);

  const handleFormatChange = (format: CodeOutputFormat) => {
    onCodeStateChange({
      ...codeState,
      selectedFormat: format,
    });
  };

  const handleStartEditing = () => {
    setIsEditing(true);
    setEditedCode(currentOverride?.code || generatedResult.code);
    setNoteContent('');
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setEditedCode('');
    setNoteContent('');
  };

  const handleSaveCode = () => {
    if (noteContent.trim().length < 10) return;

    // For CQL, check syntax before saving
    if (codeState.selectedFormat === 'cql') {
      const syntaxCheck = validateCQLSyntax(editedCode);
      if (!syntaxCheck.valid && syntaxCheck.errors.length > 0) {
        // Show warnings and require explicit acknowledgement
        setSyntaxValidation(syntaxCheck);
        setShowSyntaxWarnings(true);
        return;
      }
    }

    // Proceed with save
    performSave();
  };

  const handleSaveAnyway = () => {
    // User acknowledged warnings, proceed with save
    performSave();
  };

  const performSave = () => {
    // CRITICAL: Use compound storeKey (measureId::elementId) for isolation
    // This ensures overrides are scoped to the specific measure
    const store = useComponentCodeStore.getState();
    store.saveCodeOverride(
      storeKey,  // Use compound key for measure-scoped isolation
      codeState.selectedFormat,
      editedCode,
      noteContent,
      currentOverride?.code || generatedResult.code,
      'other'
    );

    setIsEditing(false);
    setEditedCode('');
    setNoteContent('');
    setSyntaxValidation(null);
    setShowSyntaxWarnings(false);
  };

  const handleRevertToGenerated = () => {
    if (!currentOverride) return;

    // CRITICAL: Use compound storeKey for measure-scoped isolation
    const store = useComponentCodeStore.getState();
    store.revertToGenerated(storeKey, codeState.selectedFormat);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedResult.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className={`bg-[var(--bg)] rounded-xl border border-[var(--border)] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <Code2 size={18} className="text-[var(--primary)]" />
          <span className="font-medium text-[var(--text)]">
            Component Code
          </span>

          {currentOverride?.isLocked && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-500 text-xs rounded-full">
              <Lock size={10} />
              {getFormatLabel(codeState.selectedFormat)} Override
            </span>
          )}

          {allNotes.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">
              <MessageSquare size={10} />
              {allNotes.length} note{allNotes.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <FormatSelector
          selectedFormat={codeState.selectedFormat}
          onChange={handleFormatChange}
          disabled={isEditing}
        />
      </div>

      {/* Warnings */}
      {generatedResult.warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
          {generatedResult.warnings.map((warning, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-amber-500">
              <AlertTriangle size={14} />
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* Syntax Indicator (when editing CQL) */}
      {isEditing && codeState.selectedFormat === 'cql' && (
        <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-2">
          {syntaxValidation === null ? (
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
              Checking syntax...
            </span>
          ) : syntaxValidation.valid ? (
            <span className="flex items-center gap-1.5 text-xs text-green-500">
              <CheckCircle size={14} />
              Valid CQL syntax
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-amber-500">
              <AlertTriangle size={14} />
              {syntaxValidation.errors.length} syntax issue{syntaxValidation.errors.length !== 1 ? 's' : ''} found
            </span>
          )}
        </div>
      )}

      {/* Diff View Toggle (only when override is active) */}
      {!isEditing && currentOverride?.isLocked && diffResult && (
        <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-4">
          <button
            onClick={() => setShowDiff(false)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all
              ${!showDiff
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)]'
              }
            `}
          >
            <Code2 size={14} />
            Code
          </button>
          <button
            onClick={() => setShowDiff(true)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all
              ${showDiff
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)]'
              }
            `}
          >
            <GitCompare size={14} />
            Diff
          </button>
        </div>
      )}

      {/* Code Display */}
      <div className="relative">
        {isEditing ? (
          <textarea
            value={editedCode}
            onChange={(e) => setEditedCode(e.target.value)}
            className="
              w-full min-h-[200px] p-4 font-mono text-sm
              bg-[var(--bg-secondary)] text-[var(--text)]
              border-none outline-none resize-y
            "
            spellCheck={false}
          />
        ) : showDiff && diffResult ? (
          /* Diff View */
          <div className="p-4 font-mono text-sm bg-[var(--bg-secondary)] max-h-[400px] overflow-y-auto">
            {/* Override notes above diff */}
            {currentOverride?.notes && currentOverride.notes.length > 0 && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={14} className="text-blue-400" />
                  <span className="text-xs font-medium text-blue-400">Override Notes</span>
                </div>
                <div className="space-y-1">
                  {currentOverride.notes.map((note) => (
                    <p key={note.id} className="text-xs text-blue-300">{note.content}</p>
                  ))}
                </div>
              </div>
            )}
            {/* Diff output */}
            {diffResult.map((part, index) => (
              <div
                key={index}
                className={`
                  ${part.added ? 'bg-green-500/20 text-green-400' : ''}
                  ${part.removed ? 'bg-red-500/20 text-red-400' : ''}
                  ${!part.added && !part.removed ? 'text-[var(--text-dim)]' : ''}
                `}
              >
                {part.value.split('\n').map((line, lineIndex, lines) => (
                  // Skip the last empty line from split
                  lineIndex === lines.length - 1 && line === '' ? null : (
                    <div key={lineIndex} className="flex">
                      <span className="w-6 flex-shrink-0 text-right pr-2 opacity-50 select-none">
                        {part.added ? '+' : part.removed ? '-' : ' '}
                      </span>
                      <span className="flex-1 whitespace-pre">{line}</span>
                    </div>
                  )
                ))}
              </div>
            ))}
          </div>
        ) : (
          <pre className="
            p-4 font-mono text-sm overflow-x-auto
            bg-[var(--bg-secondary)] text-[var(--text)]
            max-h-[400px] overflow-y-auto
          ">
            <code>{generatedResult.code}</code>
          </pre>
        )}

        {/* Copy button (when not editing and not in diff view) */}
        {!isEditing && !showDiff && (
          <button
            onClick={handleCopyCode}
            className="
              absolute top-2 right-2 p-2 rounded-lg
              bg-[var(--bg-tertiary)] text-[var(--text-muted)]
              hover:text-[var(--text)] hover:bg-[var(--bg)]
              transition-colors
            "
            title="Copy code"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          </button>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="px-4 py-3 border-t border-[var(--border)]">
        {isEditing ? (
          <>
            {/* Syntax Warnings Display */}
            {showSyntaxWarnings && syntaxValidation && !syntaxValidation.valid && (
              <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span className="text-sm font-medium text-amber-500">
                    CQL Syntax Warnings ({syntaxValidation.errors.length})
                  </span>
                </div>
                <div className="space-y-1 mb-3">
                  {syntaxValidation.errors.slice(0, 3).map((error, i) => (
                    <div key={i} className="text-xs text-amber-500 flex items-start gap-1">
                      <span className="flex-shrink-0">•</span>
                      <span>
                        {error.line && <span className="font-mono">Line {error.line}: </span>}
                        {error.message}
                      </span>
                    </div>
                  ))}
                  {syntaxValidation.errors.length > 3 && (
                    <div className="text-xs text-[var(--text-dim)]">
                      ... and {syntaxValidation.errors.length - 3} more
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowSyntaxWarnings(false)}
                    className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    Fix Issues
                  </button>
                  <button
                    onClick={handleSaveAnyway}
                    className="px-3 py-1.5 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                  >
                    Save Anyway
                  </button>
                </div>
              </div>
            )}

            <NoteInput
              value={noteContent}
              onChange={setNoteContent}
              onSubmit={handleSaveCode}
              onCancel={handleCancelEditing}
            />
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isLibraryLinked && (
                <span className="text-xs text-[var(--text-dim)]">
                  Linked to component library
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentOverride?.isLocked && (
                <button
                  onClick={handleRevertToGenerated}
                  className="
                    flex items-center gap-1.5 px-3 py-1.5 text-sm
                    text-[var(--text-muted)] hover:text-[var(--text)]
                    rounded-lg hover:bg-[var(--bg-secondary)]
                  "
                >
                  <RotateCcw size={14} />
                  Revert to Generated
                </button>
              )}

              <button
                onClick={handleStartEditing}
                className="
                  flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium
                  bg-[var(--primary)] text-white rounded-lg
                  hover:bg-[var(--primary-hover)]
                "
              >
                <Edit3 size={14} />
                Edit Code
              </button>
            </div>
          </div>
        )}

        {/* Notes List (when not editing) */}
        {!isEditing && allNotes.length > 0 && (
          <CodeNoteListInternal notes={allNotes} />
        )}
      </div>
    </div>
  );
};

export default ComponentCodeViewer;
