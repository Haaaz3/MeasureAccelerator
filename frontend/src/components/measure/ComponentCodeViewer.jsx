/**
 * ComponentCodeViewer
 *
 * A code viewer and editor component that:
 * - Displays generated code for a single component in multiple formats
 * - Allows manual code overrides with mandatory notes
 * - Shows edit history with timestamps
 * - Integrates with component library and UMS editor
 */

import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';

// ============================================================================
// Helper Functions
// ============================================================================

function formatNoteTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getFormatLabel(format) {
  switch (format) {
    case 'cql': return 'CQL';
    case 'synapse-sql': return 'Synapse SQL';
    default: return format?.toUpperCase() || '';
  }
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

function generateComponentCode(element, format, override, populationId) {
  // If there's an override, use it
  if (override?.code) {
    return { code: override.code, warnings: [] };
  }

  // Generate simple code based on element type
  const warnings = [];
  let code = '';

  if (format === 'cql') {
    const resourceType = element.type === 'diagnosis' ? 'Condition' :
                        element.type === 'procedure' ? 'Procedure' :
                        element.type === 'medication' ? 'MedicationRequest' :
                        element.type === 'observation' ? 'Observation' :
                        element.type === 'encounter' ? 'Encounter' :
                        element.type === 'immunization' ? 'Immunization' :
                        'Resource';

    const vsName = element.valueSet?.name || 'ValueSet';

    code = `// ${element.description || 'Component'}\n`;
    code += `define "${element.description || 'Component'}":\n`;
    code += `  [${resourceType}: "${vsName}"]\n`;
    code += `    where ${resourceType.toLowerCase()}.performed during "Measurement Period"`;

    if (!element.valueSet) {
      warnings.push('No value set specified - using placeholder');
    }
  } else if (format === 'synapse-sql') {
    const tableName = element.type === 'diagnosis' ? 'Conditions' :
                     element.type === 'procedure' ? 'Procedures' :
                     element.type === 'medication' ? 'MedicationRequests' :
                     element.type === 'observation' ? 'Observations' :
                     element.type === 'encounter' ? 'Encounters' :
                     element.type === 'immunization' ? 'Immunizations' :
                     'Resources';

    code = `-- ${element.description || 'Component'}\n`;
    code += `SELECT DISTINCT PatientId\n`;
    code += `FROM ${tableName}\n`;
    code += `WHERE PerformedDate BETWEEN @MeasurementPeriodStart AND @MeasurementPeriodEnd`;

    if (element.valueSet?.oid) {
      code += `\n  AND ValueSetOid = '${element.valueSet.oid}'`;
    } else {
      warnings.push('No value set OID - filter may be incomplete');
    }
  }

  return { code, warnings };
}

// ============================================================================
// Sub-Components
// ============================================================================

function FormatSelector({ selectedFormat, onChange, disabled }) {
  const formats = [
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
}

function CodeNoteListInternal({ notes, maxVisible = 3 }) {
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
}

function NoteInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder = 'Describe your changes (required)...',
}) {
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
}

// ============================================================================
// Main Component
// ============================================================================

export function ComponentCodeViewer({
  element,
  measureId,
  codeState,
  onCodeStateChange,
  populationId,
  isLibraryLinked,
  className = '',
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [copied, setCopied] = useState(false);

  const currentOverride = codeState?.overrides?.[codeState?.selectedFormat || 'cql'];

  // Generate code for current format
  const generatedResult = useMemo(() => {
    return generateComponentCode(
      element,
      codeState?.selectedFormat || 'cql',
      currentOverride,
      populationId
    );
  }, [element, codeState?.selectedFormat, currentOverride, populationId]);

  // Get all notes across all formats
  const allNotes = useMemo(() => {
    return getAllNotesForComponent(codeState?.overrides);
  }, [codeState?.overrides]);

  // Initialize edited code when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditedCode(currentOverride?.code || generatedResult.code);
    }
  }, [isEditing]);

  const handleFormatChange = (format) => {
    onCodeStateChange?.({
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

    // Create new override
    const newNote = {
      id: `note-${Date.now()}`,
      content: noteContent,
      timestamp: new Date().toISOString(),
      format: codeState?.selectedFormat || 'cql',
      changeType: 'other',
    };

    const newOverride = {
      code: editedCode,
      isLocked: true,
      notes: [...(currentOverride?.notes || []), newNote],
    };

    const newOverrides = {
      ...codeState?.overrides,
      [codeState?.selectedFormat || 'cql']: newOverride,
    };

    onCodeStateChange?.({
      ...codeState,
      overrides: newOverrides,
    });

    setIsEditing(false);
    setEditedCode('');
    setNoteContent('');
  };

  const handleRevertToGenerated = () => {
    if (!currentOverride) return;

    const newOverrides = { ...codeState?.overrides };
    delete newOverrides[codeState?.selectedFormat || 'cql'];

    onCodeStateChange?.({
      ...codeState,
      overrides: newOverrides,
    });
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
              {getFormatLabel(codeState?.selectedFormat)} Override
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
          selectedFormat={codeState?.selectedFormat || 'cql'}
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
        ) : (
          <pre className="
            p-4 font-mono text-sm overflow-x-auto
            bg-[var(--bg-secondary)] text-[var(--text)]
            max-h-[400px] overflow-y-auto
          ">
            <code>{generatedResult.code}</code>
          </pre>
        )}

        {/* Copy button (when not editing) */}
        {!isEditing && (
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
          <NoteInput
            value={noteContent}
            onChange={setNoteContent}
            onSubmit={handleSaveCode}
            onCancel={handleCancelEditing}
          />
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
}

export default ComponentCodeViewer;
