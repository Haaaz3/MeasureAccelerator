/**
 * Component Code Types
 *
 * Types for code viewing, editing, and override tracking with mandatory notes.
 * Supports CQL and Synapse SQL output formats.
 */

// ============================================================================
// Code Output Formats
// ============================================================================

export type CodeOutputFormat = 'cql' | 'synapse-sql';

export const CODE_OUTPUT_FORMATS: { value: CodeOutputFormat; label: string }[] = [
  { value: 'cql', label: 'CQL' },
  { value: 'synapse-sql', label: 'Synapse SQL' },
];

/**
 * Get the display label for a code output format
 */
export function getFormatLabel(format: CodeOutputFormat): string {
  return CODE_OUTPUT_FORMATS.find(f => f.value === format)?.label ?? format;
}

// ============================================================================
// Code Edit Notes (Git-style comments)
// ============================================================================

export interface CodeEditNote {
  id: string;
  /** ISO timestamp when the note was created */
  timestamp: string;
  /** The user/author of the note (can be username or "System") */
  author: string;
  /** The note content describing the change */
  content: string;
  /** Which output format this note applies to */
  format: CodeOutputFormat;
  /** Optional: what was changed (for diff display) */
  changeType?: 'logic' | 'timing' | 'codes' | 'syntax' | 'other';
  /** Optional: the previous code (for diff comparison) */
  previousCode?: string;
}

// ============================================================================
// Code Override - Per Format
// ============================================================================

export interface CodeOverride {
  /** The output format this override applies to */
  format: CodeOutputFormat;
  /** The manually edited code that replaces generated code */
  code: string;
  /** Whether this override is active (locked) */
  isLocked: boolean;
  /** ISO timestamp when the override was created */
  createdAt: string;
  /** ISO timestamp when the override was last modified */
  updatedAt: string;
  /** All notes associated with this override (required for edits) */
  notes: CodeEditNote[];
  /** The auto-generated code at time of override (for reference/diff) */
  originalGeneratedCode: string;
}

// ============================================================================
// Component Code State
// ============================================================================

export interface ComponentCodeState {
  /** Component/DataElement ID this state belongs to */
  componentId: string;
  /** Code overrides keyed by format */
  overrides: Partial<Record<CodeOutputFormat, CodeOverride>>;
  /** Currently selected output format for viewing */
  selectedFormat: CodeOutputFormat;
  /** Whether the code editor is in edit mode */
  isEditing: boolean;
  /** Pending note content (while editing) */
  pendingNote: string;
}

// ============================================================================
// Code Generation Result (per component)
// ============================================================================

export interface ComponentCodeResult {
  /** The component ID */
  componentId: string;
  /** Generated or overridden code */
  code: string;
  /** Whether this is manually overridden */
  isOverridden: boolean;
  /** Notes to include in generated output */
  notes: CodeEditNote[];
  /** Any warnings about the generated code */
  warnings: string[];
}

// ============================================================================
// Full Measure Code Result (with component breakdown)
// ============================================================================

export interface MeasureCodeResult {
  /** The output format */
  format: CodeOutputFormat;
  /** Full assembled code for the measure */
  fullCode: string;
  /** Individual component code results */
  components: ComponentCodeResult[];
  /** Whether any components have overrides */
  hasOverrides: boolean;
  /** Total notes across all components */
  allNotes: CodeEditNote[];
  /** Generation metadata */
  metadata: {
    generatedAt: string;
    measureId: string;
    measureTitle: string;
  };
}

// ============================================================================
// Code Viewer Props
// ============================================================================

export interface ComponentCodeViewerProps {
  /** The component/DataElement being viewed */
  componentId: string;
  /** The component description for display */
  componentDescription: string;
  /** Current code state */
  codeState: ComponentCodeState;
  /** Callback when format changes */
  onFormatChange: (format: CodeOutputFormat) => void;
  /** Callback when code is edited and saved */
  onCodeSave: (code: string, note: string) => void;
  /** Callback when edit mode is toggled */
  onEditToggle: (isEditing: boolean) => void;
  /** Callback to revert to generated code */
  onRevertToGenerated: () => void;
  /** Whether the component is linked to the library */
  isLibraryLinked?: boolean;
  /** Library component ID if linked */
  libraryComponentId?: string;
}

// ============================================================================
// Note Display Props
// ============================================================================

export interface CodeNoteBadgeProps {
  /** Notes to display */
  notes: CodeEditNote[];
  /** Whether to show in compact mode (just count) */
  compact?: boolean;
  /** Callback when badge is clicked */
  onClick?: () => void;
}

export interface CodeNoteListProps {
  /** Notes to display */
  notes: CodeEditNote[];
  /** Whether notes can be edited/deleted */
  editable?: boolean;
  /** Callback when a note is deleted */
  onDelete?: (noteId: string) => void;
  /** Callback when a note is edited */
  onEdit?: (noteId: string, newContent: string) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createCodeEditNote(
  content: string,
  format: CodeOutputFormat,
  author: string = 'User',
  changeType?: CodeEditNote['changeType'],
  previousCode?: string
): CodeEditNote {
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    author,
    content,
    format,
    changeType,
    previousCode,
  };
}

export function createCodeOverride(
  format: CodeOutputFormat,
  code: string,
  originalGeneratedCode: string,
  note: CodeEditNote
): CodeOverride {
  return {
    format,
    code,
    isLocked: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: [note],
    originalGeneratedCode,
  };
}

export function formatNoteTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNoteForCodeComment(note: CodeEditNote, format: CodeOutputFormat): string {
  const timestamp = formatNoteTimestamp(note.timestamp);
  // CQL uses // comments, SQL uses -- comments
  const prefix = format === 'cql' ? '//' : '--';
  const changeTypeLabel = note.changeType ? ` [${note.changeType}]` : '';

  return `${prefix} EDIT NOTE${changeTypeLabel} (${timestamp}): ${note.content}`;
}

export function getAllNotesForComponent(
  overrides: Partial<Record<CodeOutputFormat, CodeOverride>>
): CodeEditNote[] {
  const allNotes: CodeEditNote[] = [];

  for (const override of Object.values(overrides)) {
    if (override?.notes) {
      allNotes.push(...override.notes);
    }
  }

  // Sort by timestamp, newest first
  return allNotes.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ============================================================================
// Default State Factory
// ============================================================================

export function createDefaultComponentCodeState(componentId: string): ComponentCodeState {
  return {
    componentId,
    overrides: {},
    selectedFormat: 'cql',
    isEditing: false,
    pendingNote: '',
  };
}
