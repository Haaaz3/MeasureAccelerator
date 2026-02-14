import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import {
  ChevronRight,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Plus,
  Download,
  Edit3,
  Save,
  Settings2,
  Library as LibraryIcon,
  Sparkles,
  FileText,
  GripVertical,
  Trash2,
  Code2,
  MessageSquare,
  Link2,
  Unlink,
} from 'lucide-react';
import { InlineErrorBanner, InlineSuccessBanner } from '../shared/ErrorBoundary.jsx';
import { useMeasureStore } from '../../stores/measureStore.js';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore.js';
import { ComponentBuilder } from './ComponentBuilder.jsx';
import { ComponentDetailPanel } from './ComponentDetailPanel.jsx';

// ============================================================================
// Constants
// ============================================================================

const MEASURE_PROGRAMS = [
  { value: 'MIPS_CQM', label: 'MIPS CQM' },
  { value: 'eCQM', label: 'eCQM' },
  { value: 'HEDIS', label: 'HEDIS' },
  { value: 'QOF', label: 'QOF' },
  { value: 'Registry', label: 'Registry' },
  { value: 'Custom', label: 'Custom' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function cleanDescription(desc) {
  if (!desc) return '';
  return desc
    .replace(/\n\s*(AND|OR|NOT)\s*\n/gi, ' ')
    .replace(/\n\s*(AND|OR|NOT)\s*$/gi, '')
    .replace(/^\s*(AND|OR|NOT)\s*\n/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getPopulationLabel(type) {
  switch (type) {
    case 'initial-population':
    case 'initial_population': return 'Initial Population';
    case 'denominator': return 'Denominator';
    case 'denominator-exclusion':
    case 'denominator_exclusion': return 'Denominator Exclusions';
    case 'denominator-exception':
    case 'denominator_exception': return 'Denominator Exceptions';
    case 'numerator': return 'Numerator';
    case 'numerator-exclusion':
    case 'numerator_exclusion': return 'Numerator Exclusions';
    default: return type.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}

function getComplexityLevel(score) {
  if (score <= 2) return { level: 'low', color: 'text-green-400' };
  if (score <= 4) return { level: 'medium', color: 'text-yellow-400' };
  return { level: 'high', color: 'text-red-400' };
}

// ============================================================================
// Data Element Node Component
// ============================================================================

function DataElementNode({ element, isSelected, onSelect, onDelete, deepMode }) {
  const hasZeroCodes = (element.valueSet?.codes?.length ?? 0) === 0 &&
                       (element.directCodes?.length ?? 0) === 0 &&
                       element.type !== 'demographic';

  return (
    <div
      onClick={() => onSelect(element.id)}
      className={`
        relative flex items-start gap-3 p-3 rounded-lg border cursor-pointer
        transition-all group
        ${isSelected
          ? 'bg-[var(--accent-light)] border-[var(--accent)]/50'
          : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:border-[var(--text-dim)]'
        }
      `}
    >
      {/* Drag handle in deep mode */}
      {deepMode && (
        <div className="flex-shrink-0 p-1 rounded cursor-grab text-[var(--text-dim)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]">
          <GripVertical size={16} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Type badge and description */}
        <div className="flex items-start gap-2">
          <span className={`
            flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded uppercase
            ${element.type === 'procedure' ? 'bg-purple-100 text-purple-700' :
              element.type === 'diagnosis' ? 'bg-red-100 text-red-700' :
              element.type === 'encounter' ? 'bg-[var(--success-light)] text-[var(--success)]' :
              element.type === 'observation' ? 'bg-cyan-100 text-cyan-700' :
              element.type === 'medication' ? 'bg-orange-100 text-orange-700' :
              'bg-gray-100 text-gray-600'}
          `}>
            {element.type}
          </span>

          <p className="text-sm text-[var(--text)] line-clamp-2">
            {cleanDescription(element.description)}
          </p>
        </div>

        {/* Value set info */}
        {element.valueSet && (
          <p className="mt-1 text-xs text-[var(--text-dim)] truncate">
            {element.valueSet.name}
            {element.valueSet.codes?.length ? ` (${element.valueSet.codes.length} codes)` : ''}
          </p>
        )}

        {/* Warnings and badges */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {hasZeroCodes && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] rounded-full">
              <AlertTriangle size={10} />
              No codes
            </span>
          )}

          {element.libraryComponentId ? (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-[var(--success-light)] text-[var(--success)] text-[10px] rounded-full">
              <Link2 size={10} />
              Linked
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">
              <Unlink size={10} />
              Local
            </span>
          )}

          {/* Review status badge */}
          {element.reviewStatus === 'approved' && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-[10px] rounded-full">
              <CheckCircle size={10} />
              Approved
            </span>
          )}
        </div>
      </div>

      {/* Delete button in deep mode */}
      {deepMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(element.id);
          }}
          className="flex-shrink-0 p-1.5 rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Logic Clause Component
// ============================================================================

function LogicClause({ clause, depth, selectedNode, onSelectNode, onDelete, deepMode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!clause || !clause.children) {
    return null;
  }

  const indentClass = depth === 0 ? '' : 'ml-6';
  const borderClass = depth > 0 ? 'border-l-2 border-[var(--border)] pl-4' : '';

  return (
    <div className={`${indentClass} ${borderClass}`}>
      {/* Clause header */}
      {depth > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-0.5 rounded text-[var(--text-dim)] hover:text-[var(--text)]"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>

          <span className={`
            px-2 py-0.5 text-[10px] font-semibold rounded
            ${clause.operator === 'OR' ? 'bg-[var(--warning-light)] text-[var(--warning)]' : 'bg-[var(--success-light)] text-[var(--success)]'}
          `}>
            {clause.operator} Group
          </span>

          <span className="text-xs text-[var(--text-dim)]">
            {clause.children.length} items
          </span>
        </div>
      )}

      {/* Children */}
      {!isCollapsed && (
        <div className="space-y-1">
          {clause.children.map((child, index) => (
            <Fragment key={child.id}>
              {'operator' in child && 'children' in child ? (
                <LogicClause
                  clause={child}
                  depth={depth + 1}
                  selectedNode={selectedNode}
                  onSelectNode={onSelectNode}
                  onDelete={onDelete}
                  deepMode={deepMode}
                />
              ) : (
                <DataElementNode
                  element={child}
                  isSelected={selectedNode === child.id}
                  onSelect={onSelectNode}
                  onDelete={onDelete}
                  deepMode={deepMode}
                />
              )}

              {/* Operator badge between siblings */}
              {index < clause.children.length - 1 && (
                <div className="flex items-center justify-center py-1">
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className={`
                    px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md
                    ${clause.operator === 'OR' ? 'bg-[var(--warning-light)] text-[var(--warning)]' : 'bg-[var(--success-light)] text-[var(--success)]'}
                  `}>
                    {clause.operator}
                  </span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Population Section Component
// ============================================================================

function PopulationSection({
  population,
  isExpanded,
  onToggle,
  selectedNode,
  onSelectNode,
  onAddComponent,
  deepMode,
  onDelete,
}) {
  const label = getPopulationLabel(population.type);
  const childCount = population.criteria?.children?.length || 0;

  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        )}
        <span className="font-medium text-[var(--text)]">{label}</span>
        <span className="text-sm text-[var(--text-muted)]">({childCount})</span>

        {/* Root operator */}
        {population.criteria?.operator && (
          <span className={`
            ml-auto px-2 py-0.5 text-xs font-semibold rounded
            ${population.criteria.operator === 'OR' ? 'bg-[var(--warning-light)] text-[var(--warning)]' : 'bg-[var(--success-light)] text-[var(--success)]'}
          `}>
            {population.criteria.operator}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* Criteria tree */}
          {population.criteria && (
            <LogicClause
              clause={population.criteria}
              depth={0}
              selectedNode={selectedNode}
              onSelectNode={onSelectNode}
              onDelete={onDelete}
              deepMode={deepMode}
            />
          )}

          {/* Add component button */}
          <button
            onClick={onAddComponent}
            className="w-full py-2 border-2 border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--text-dim)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)] flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={16} />
            Add Component
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Function: Find Element by ID
// ============================================================================

function findElementById(measure, targetId) {
  if (!measure || !targetId) return null;

  const findInNode = (node) => {
    if (!node) return null;
    if (node.id === targetId) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findInNode(child);
        if (found) return found;
      }
    }
    return null;
  };

  for (const pop of measure.populations || []) {
    const element = findInNode(pop.criteria);
    if (element) return element;
  }
  return null;
}

// ============================================================================
// Main UMSEditor Component
// ============================================================================

export function UMSEditor() {
  const {
    getActiveMeasure,
    updateMeasure,
    setActiveTab,
    addComponentToPopulation,
    addValueSet,
    deleteComponent,
    getReviewProgress,
    approveAllLowComplexity,
    exportCorrections,
    getCorrections,
  } = useMeasureStore();

  const {
    components: libraryComponents,
    linkMeasureComponents,
    initializeWithSampleData,
    rebuildUsageIndex,
  } = useComponentLibraryStore();

  const { measures } = useMeasureStore();

  const measure = getActiveMeasure();

  // State
  const [expandedSections, setExpandedSections] = useState(new Set(['ip', 'den', 'ex', 'num', 'initial_population', 'denominator', 'denominator_exclusion', 'numerator']));
  const [selectedNode, setSelectedNode] = useState(null);
  const [builderTarget, setBuilderTarget] = useState(null);
  const [deepMode, setDeepMode] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Metadata editing state
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedMeasureId, setEditedMeasureId] = useState('');
  const [editedProgram, setEditedProgram] = useState('');
  const [editedDescription, setEditedDescription] = useState('');

  // Detail panel width
  const [detailPanelWidth, setDetailPanelWidth] = useState(400);
  const containerRef = useRef(null);

  // Initialize component library
  useEffect(() => {
    initializeWithSampleData();
  }, [initializeWithSampleData]);

  // Link measure components when measure changes
  useEffect(() => {
    if (measure && measure.populations?.length > 0) {
      linkMeasureComponents(
        measure.metadata?.measureId || measure.id,
        measure.populations
      );
      rebuildUsageIndex(measures);
    }
  }, [measure?.id, measures.length, linkMeasureComponents, rebuildUsageIndex]);

  // Metadata editing handlers
  const handleStartEditingMetadata = () => {
    if (!measure) return;
    setEditedTitle(measure.metadata?.title || '');
    setEditedMeasureId(measure.metadata?.measureId || '');
    setEditedProgram(measure.metadata?.program || '');
    setEditedDescription(measure.metadata?.description || '');
    setIsEditingMetadata(true);
  };

  const handleSaveMetadata = () => {
    if (!measure) return;
    updateMeasure(measure.id, {
      metadata: {
        ...measure.metadata,
        title: editedTitle.trim() || measure.metadata?.title,
        measureId: editedMeasureId.trim() || measure.metadata?.measureId,
        program: editedProgram || measure.metadata?.program,
        description: editedDescription.trim(),
      },
    });
    setIsEditingMetadata(false);
    setSuccess('Measure metadata updated');
    setTimeout(() => setSuccess(null), 2000);
  };

  const handleCancelEditingMetadata = () => {
    setIsEditingMetadata(false);
  };

  const toggleSection = (id) => {
    const next = new Set(expandedSections);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedSections(next);
  };

  const handleDelete = (componentId) => {
    if (!measure) return;
    deleteComponent(measure.id, componentId);
  };

  // Export corrections
  const handleExportCorrections = () => {
    if (!measure) return;
    const exportData = exportCorrections(measure.id);
    if (!exportData) {
      alert('No corrections to export yet.');
      return;
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${measure.metadata?.measureId || measure.id}-corrections-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Empty state
  if (!measure) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center">
            <FileText className="w-8 h-8 text-[var(--text-dim)]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No Measure Selected</h2>
          <p className="text-[var(--text-muted)] mb-6">
            Select a measure from the library to view and edit its Universal Measure Specification.
          </p>
          <button
            onClick={() => setActiveTab('library')}
            className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors inline-flex items-center gap-2"
          >
            <LibraryIcon className="w-4 h-4" />
            Go to Measure Library
          </button>
        </div>
      </div>
    );
  }

  // Get review progress
  const reviewProgress = getReviewProgress(measure.id);
  const progressPercent = reviewProgress.total > 0 ? Math.round((reviewProgress.approved / reviewProgress.total) * 100) : 0;
  const corrections = getCorrections(measure.id);

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden">
      {/* Main editor panel */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Success/Error Banners */}
          {success && (
            <InlineSuccessBanner message={success} onDismiss={() => setSuccess(null)} />
          )}
          {error && (
            <InlineErrorBanner message={error} onDismiss={() => setError(null)} />
          )}

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-4">
            <button
              onClick={() => setActiveTab('library')}
              className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            >
              Measure Library
            </button>
            <ChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
            <span className="text-[var(--text)]">{measure.metadata?.measureId || measure.id}</span>
          </nav>

          {/* Header */}
          <div className="mb-6">
            {isEditingMetadata ? (
              <div className="w-full space-y-4">
                {/* Programme + Measure ID */}
                <div className="flex items-end gap-4">
                  <div className="w-48">
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Program</label>
                    <select
                      value={editedProgram}
                      onChange={(e) => setEditedProgram(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm"
                    >
                      <option value="">Select...</option>
                      {MEASURE_PROGRAMS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-48">
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Measure ID</label>
                    <input
                      type="text"
                      value={editedMeasureId}
                      onChange={(e) => setEditedMeasureId(e.target.value)}
                      placeholder="CMS128v13"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm"
                    />
                  </div>
                </div>

                {/* Measure Name */}
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Measure Name</label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder="e.g., Cervical Cancer Screening"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-lg font-semibold"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Description</label>
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    rows={3}
                    placeholder="Measure description..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm resize-y"
                  />
                </div>

                {/* Save / Cancel */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveMetadata}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={handleCancelEditingMetadata}
                    className="px-4 py-2 rounded-lg text-[var(--text-muted)] text-sm hover:text-[var(--text)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full">
                {/* Badges and Title */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 group cursor-pointer" onClick={handleStartEditingMetadata}>
                    <div className="flex items-center gap-3 mb-2">
                      {measure.metadata?.program && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-500/15 text-purple-400 rounded">
                          {MEASURE_PROGRAMS.find(p => p.value === measure.metadata.program)?.label || measure.metadata.program}
                        </span>
                      )}
                      <span className="px-2 py-1 text-sm font-medium bg-[var(--accent-light)] text-[var(--accent)] rounded">
                        {measure.metadata?.measureId || measure.id}
                      </span>
                      <span className="opacity-0 group-hover:opacity-100 text-xs text-[var(--text-muted)] flex items-center gap-1 transition-opacity">
                        <Edit3 className="w-3 h-3" />
                        Click to edit
                      </span>
                    </div>

                    <h1 className="text-xl font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                      {measure.metadata?.title || 'Untitled Measure'}
                    </h1>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setActiveTab('components')}
                      className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--accent)]"
                    >
                      <LibraryIcon className="w-4 h-4" />
                      Browse Library
                    </button>
                    <button
                      onClick={() => setDeepMode(!deepMode)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                        deepMode ? 'bg-purple-500/15 text-purple-400' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                      }`}
                    >
                      <Settings2 className="w-4 h-4" />
                      Deep Edit
                    </button>
                    <button
                      onClick={() => approveAllLowComplexity(measure.id)}
                      className="px-3 py-2 bg-[var(--success-light)] text-[var(--success)] rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Auto-approve
                    </button>
                    {corrections.length > 0 && (
                      <button
                        onClick={handleExportCorrections}
                        className="px-3 py-2 bg-purple-500/15 text-purple-400 rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Export ({corrections.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                {measure.metadata?.description && (
                  <p className="mt-3 text-sm text-[var(--text-muted)] cursor-pointer" onClick={handleStartEditingMetadata}>
                    {measure.metadata.description}
                  </p>
                )}
              </div>
            )}

            {/* Progress bar */}
            <div className="mt-4 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--text-muted)]">Review Progress</span>
                <span className="text-sm font-medium text-[var(--text)]">
                  {reviewProgress.approved} / {reviewProgress.total} approved ({progressPercent}%)
                </span>
              </div>
              <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-[var(--success)] transition-all duration-300"
                  style={{ width: `${(reviewProgress.approved / Math.max(reviewProgress.total, 1)) * 100}%` }}
                />
                <div
                  className="h-full bg-[var(--warning)] transition-all duration-300"
                  style={{ width: `${(reviewProgress.flagged / Math.max(reviewProgress.total, 1)) * 100}%` }}
                />
              </div>
              {progressPercent === 100 && (
                <p className="text-xs text-[var(--success)] mt-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  All components approved — ready for code generation
                </p>
              )}
            </div>
          </div>

          {/* Population sections */}
          <div className="space-y-4">
            {(measure.populations || []).map((population) => (
              <PopulationSection
                key={population.id}
                population={population}
                isExpanded={expandedSections.has(population.type)}
                onToggle={() => toggleSection(population.type)}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
                onAddComponent={() => setBuilderTarget({ populationId: population.id, populationType: population.type })}
                deepMode={deepMode}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Value Sets Section */}
          {measure.valueSets && measure.valueSets.length > 0 && (
            <div className="mt-6">
              <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] overflow-hidden">
                <button
                  onClick={() => toggleSection('valueSets')}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  {expandedSections.has('valueSets') ? (
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                  <span className="font-medium text-[var(--text)]">Value Sets</span>
                  <span className="text-sm text-[var(--text-muted)]">({measure.valueSets.length})</span>
                </button>

                {expandedSections.has('valueSets') && (
                  <div className="px-4 pb-4 space-y-2">
                    {measure.valueSets.map((vs) => (
                      <div
                        key={vs.id}
                        className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-[var(--text)]">{vs.name}</p>
                            {vs.oid && (
                              <p className="text-xs text-[var(--text-dim)] font-mono mt-1">{vs.oid}</p>
                            )}
                            <p className="text-xs text-[var(--accent)] mt-1">
                              {vs.codes?.length || 0} codes
                            </p>
                          </div>
                          {vs.verified && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-[var(--success-light)] text-[var(--success)] rounded">
                              VSAC Verified
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedNode && (() => {
        const selectedElement = findElementById(measure, selectedNode);
        if (!selectedElement) {
          return (
            <div
              style={{ width: detailPanelWidth }}
              className="flex-shrink-0 border-l border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center"
            >
              <p className="text-[var(--text-muted)]">Element not found</p>
            </div>
          );
        }
        return (
          <div
            style={{ width: detailPanelWidth }}
            className="flex-shrink-0"
          >
            <ComponentDetailPanel
              element={selectedElement}
              measureId={measure.id}
              onClose={() => setSelectedNode(null)}
              onNavigateToLibrary={(libraryId) => {
                setActiveTab('components');
                // Could also set selected component in library store if needed
              }}
              mpStart={measure.measurementPeriod?.start || '2024-01-01'}
              mpEnd={measure.measurementPeriod?.end || '2024-12-31'}
            />
          </div>
        );
      })()}

      {/* Component Builder modal */}
      {builderTarget && measure && (
        <ComponentBuilder
          measureId={measure.id}
          populationId={builderTarget.populationId}
          populationType={builderTarget.populationType}
          existingValueSets={measure.valueSets || []}
          onSave={(component, newValueSet, logicOperator) => {
            if (newValueSet) {
              addValueSet(measure.id, newValueSet);
            }
            addComponentToPopulation(measure.id, builderTarget.populationId, component, logicOperator);
            setBuilderTarget(null);
          }}
          onClose={() => setBuilderTarget(null)}
        />
      )}
    </div>
  );
}

export default UMSEditor;
