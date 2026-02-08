import { useState, useRef, useEffect, Fragment } from 'react';
import { ChevronRight, ChevronDown, CheckCircle, AlertTriangle, HelpCircle, X, Code, Sparkles, Send, Bot, User, ExternalLink, Plus, Trash2, Download, History, Edit3, Save, XCircle, Settings2, ArrowUp, ArrowDown, Search, Library as LibraryIcon, Import, FileText, Link, ShieldCheck, GripVertical, Loader2, Combine, Square, CheckSquare } from 'lucide-react';
import { InlineErrorBanner, InlineSuccessBanner } from '../shared/ErrorBoundary';
import { validateReferentialIntegrity, formatMismatches } from '../../utils/integrityCheck';
import { useMeasureStore } from '../../stores/measureStore';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore';
import { useComponentCodeStore } from '../../stores/componentCodeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { ComponentBuilder } from './ComponentBuilder';
import { ComponentDetailPanel } from './ComponentDetailPanel';
import type { PopulationDefinition, LogicalClause, DataElement, ConfidenceLevel, ReviewStatus, ValueSetReference, CodeReference, CodeSystem, LogicalOperator, TimingConstraint, TimingOverride, TimingWindow } from '../../types/ums';
import { getOperatorBetween } from '../../types/ums';
import { MeasurePeriodBar, TimingBadge, TimingEditorPanel, TimingWindowLabel, TimingWindowEditor } from './TimingEditor';
import { parseTimingText } from '../../utils/timingResolver';
import type { ComplexityLevel, LibraryComponent } from '../../types/componentLibrary';
import { getComplexityColor, getComplexityDots, getComplexityLevel, calculateDataElementComplexity, calculatePopulationComplexity, calculateMeasureComplexity } from '../../services/complexityCalculator';
import { getAllStandardValueSets, searchStandardValueSets, type StandardValueSet } from '../../constants/standardValueSets';
import { handleAIAssistantRequest, buildAssistantContext, applyAIChanges, formatChangesForDisplay, type AIAssistantResponse } from '../../services/aiAssistant';
import SharedEditWarning from '../library/SharedEditWarning';

// Program/catalogue options for measure metadata
const MEASURE_PROGRAMS = [
  { value: 'MIPS_CQM', label: 'MIPS CQM' },
  { value: 'eCQM', label: 'eCQM' },
  { value: 'HEDIS', label: 'HEDIS' },
  { value: 'QOF', label: 'QOF' },
  { value: 'Registry', label: 'Registry' },
  { value: 'Custom', label: 'Custom' },
] as const;

/** Strip standalone AND/OR/NOT operators that appear as line separators in descriptions */
function cleanDescription(desc: string | undefined): string {
  if (!desc) return '';
  return desc
    .replace(/\n\s*(AND|OR|NOT)\s*\n/gi, ' ')
    .replace(/\n\s*(AND|OR|NOT)\s*$/gi, '')
    .replace(/^\s*(AND|OR|NOT)\s*\n/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function UMSEditor() {
  const { getActiveMeasure, updateReviewStatus, approveAllLowComplexity, measures, exportCorrections, getCorrections, addComponentToPopulation, addValueSet, toggleLogicalOperator, reorderComponent, moveComponentToIndex, setOperatorBetweenSiblings, deleteComponent, setActiveTab, syncAgeRange, updateTimingOverride, updateTimingWindow, updateMeasurementPeriod } = useMeasureStore();
  const measure = getActiveMeasure();
  const {
    components: libraryComponents,
    linkMeasureComponents,
    initializeWithSampleData,
    getComponent,
    addComponent,
    rebuildUsageIndex,
    syncComponentToMeasures,
    mergeComponents,
    updateMeasureReferencesAfterMerge,
  } = useComponentLibraryStore();
  const { updateMeasure, batchUpdateMeasures } = useMeasureStore();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['ip', 'den', 'ex', 'num']));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeValueSet, setActiveValueSet] = useState<ValueSetReference | null>(null);
  const [builderTarget, setBuilderTarget] = useState<{ populationId: string; populationType: string } | null>(null);
  const [deepMode, setDeepMode] = useState(false);
  const [showValueSetBrowser, setShowValueSetBrowser] = useState(false);
  const [componentLinkMap, setComponentLinkMap] = useState<Record<string, string>>({});
  const [detailPanelMode, setDetailPanelMode] = useState<'edit' | 'code'>('edit');
  const [dragState, setDragState] = useState<{ draggedId: string | null; dragOverId: string | null; dragOverPosition: 'before' | 'after' | 'merge' | null }>({ draggedId: null, dragOverId: null, dragOverPosition: null });
  const [editingTimingId, setEditingTimingId] = useState<string | null>(null);

  // Component merge state (checkbox selection in deep mode)
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());

  // Error and success state for inline banners
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Metadata editing state
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedMeasureId, setEditedMeasureId] = useState('');
  const [editedProgram, setEditedProgram] = useState<string>('');
  const [editedDescription, setEditedDescription] = useState('');
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Shared edit warning state
  const [showSharedEditWarning, setShowSharedEditWarning] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<{
    componentId: string;
    elementId: string;
    type: 'timing' | 'timingWindow';
    value: TimingConstraint | TimingWindow | null;
    libraryComponent: LibraryComponent;
  } | null>(null);

  // Listen for inspectingComponentId from CodeGeneration's "View in UMS Editor" button
  const inspectingComponentId = useComponentCodeStore((state) => state.inspectingComponentId);
  const setInspectingComponent = useComponentCodeStore((state) => state.setInspectingComponent);

  // When inspectingComponentId changes, select that node and clear the inspection state
  useEffect(() => {
    if (inspectingComponentId) {
      setSelectedNode(inspectingComponentId);
      // Clear the inspecting state so it doesn't persist
      setInspectingComponent(null);
    }
  }, [inspectingComponentId, setInspectingComponent]);

  // Toggle merge selection for a component
  const toggleMergeSelection = (componentId: string) => {
    setSelectedForMerge(prev => {
      const next = new Set(prev);
      if (next.has(componentId)) {
        next.delete(componentId);
      } else {
        next.add(componentId);
      }
      return next;
    });
  };

  // Clear merge selection when exiting deep mode
  const handleDeepModeToggle = () => {
    if (deepMode) {
      setSelectedForMerge(new Set());
    }
    setDeepMode(!deepMode);
  };

  // Helper to find a DataElement by ID in the measure
  const findElementById = (elementId: string): DataElement | null => {
    if (!measure) return null;
    const searchInClause = (clause: LogicalClause | DataElement | null): DataElement | null => {
      if (!clause) return null;
      if ('type' in clause && clause.id === elementId) return clause as DataElement;
      if ('children' in clause) {
        for (const child of clause.children) {
          const found = searchInClause(child as LogicalClause | DataElement);
          if (found) return found;
        }
      }
      return null;
    };
    for (const pop of measure.populations) {
      const found = searchInClause(pop.criteria);
      if (found) return found;
    }
    return null;
  };

  // TODO: Wire SharedEditWarning for value set changes, not just timing edits.
  // Currently SharedEditWarning is only shown for timing edits. Value set code
  // changes (addCodeToValueSet, removeCodeFromValueSet) should also check if the
  // affected DataElements link to shared library components and prompt the user.

  // Wrapped timing save that checks for shared components
  const handleTimingSaveWithWarning = (componentId: string, modified: TimingConstraint) => {
    const element = findElementById(componentId);
    if (!element?.libraryComponentId) {
      // Not library-linked, proceed directly
      updateTimingOverride(measure!.id, componentId, modified);
      return;
    }

    const libraryComponent = getComponent(element.libraryComponentId);
    if (!libraryComponent || libraryComponent.usage.usageCount <= 1) {
      // Only used in this measure, proceed directly
      updateTimingOverride(measure!.id, componentId, modified);
      return;
    }

    // Shared component - show warning
    setPendingEdit({
      componentId: libraryComponent.id,
      elementId: componentId,
      type: 'timing',
      value: modified,
      libraryComponent,
    });
    setShowSharedEditWarning(true);
  };

  // Wrapped timing window save that checks for shared components
  const handleTimingWindowSaveWithWarning = (componentId: string, modified: TimingWindow) => {
    const element = findElementById(componentId);
    if (!element?.libraryComponentId) {
      updateTimingWindow(measure!.id, componentId, modified);
      return;
    }

    const libraryComponent = getComponent(element.libraryComponentId);
    if (!libraryComponent || libraryComponent.usage.usageCount <= 1) {
      updateTimingWindow(measure!.id, componentId, modified);
      return;
    }

    // Shared component - show warning
    setPendingEdit({
      componentId: libraryComponent.id,
      elementId: componentId,
      type: 'timingWindow',
      value: modified,
      libraryComponent,
    });
    setShowSharedEditWarning(true);
  };

  // Handle "Update All" from SharedEditWarning
  const handleSharedEditUpdateAll = () => {
    if (!pendingEdit || !measure) return;

    // Apply the edit to this measure's element
    if (pendingEdit.type === 'timing') {
      updateTimingOverride(measure.id, pendingEdit.elementId, pendingEdit.value as TimingConstraint | null);
    } else {
      updateTimingWindow(measure.id, pendingEdit.elementId, pendingEdit.value as TimingWindow | null);
    }

    // Sync the change to all measures using this library component
    // Note: Timing changes are applied locally via updateTimingOverride above
    // The syncComponentToMeasures updates the library component metadata
    const changes = {
      changeDescription: `Timing updated across all measures (${pendingEdit.type})`,
    };

    const syncResult = syncComponentToMeasures(pendingEdit.componentId, changes, measures, batchUpdateMeasures);
    if (!syncResult.success) {
      setError(`Failed to sync changes: ${syncResult.error}`);
    }
    rebuildUsageIndex(measures);

    setShowSharedEditWarning(false);
    setPendingEdit(null);
    setSuccess(`Updated "${pendingEdit.libraryComponent.name}" across ${pendingEdit.libraryComponent.usage.usageCount} measures`);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Handle "Create New Version" from SharedEditWarning
  const handleSharedEditCreateVersion = () => {
    if (!pendingEdit || !measure) return;

    const originalComponent = pendingEdit.libraryComponent;

    // 1. Create a NEW library component (forked from original)
    const newComponentId = `${originalComponent.id}-fork-${Date.now()}`;
    const forkedComponent: LibraryComponent = {
      ...originalComponent,
      id: newComponentId,
      name: `${originalComponent.name} (${measure.metadata.measureId})`,
      usage: {
        measureIds: [measure.metadata.measureId],
        usageCount: 1,
        lastUsedAt: new Date().toISOString(),
      },
      versionInfo: {
        ...originalComponent.versionInfo,
        versionId: `${originalComponent.versionInfo.versionId}-fork`,
        status: 'draft' as const,
        versionHistory: [
          ...originalComponent.versionInfo.versionHistory,
          {
            versionId: `${originalComponent.versionInfo.versionId}-fork`,
            status: 'draft' as const,
            createdAt: new Date().toISOString(),
            createdBy: 'user',
            changeDescription: `Forked from "${originalComponent.name}" for ${measure.metadata.measureId}`,
          },
        ],
      },
      metadata: {
        ...originalComponent.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    // 2. Add the forked component to the library
    addComponent(forkedComponent);

    // 3. Apply the edit to this measure's element
    if (pendingEdit.type === 'timing') {
      updateTimingOverride(measure.id, pendingEdit.elementId, pendingEdit.value as TimingConstraint | null);
    } else {
      updateTimingWindow(measure.id, pendingEdit.elementId, pendingEdit.value as TimingWindow | null);
    }

    // 4. Update the DataElement to link to the NEW component
    const updateLibraryLink = (node: any): any => {
      if (!node) return node;
      if (node.id === pendingEdit.elementId) {
        return { ...node, libraryComponentId: newComponentId };
      }
      if (node.children) {
        return { ...node, children: node.children.map(updateLibraryLink) };
      }
      if (node.criteria) {
        return { ...node, criteria: updateLibraryLink(node.criteria) };
      }
      return node;
    };

    const updatedPopulations = measure.populations.map(updateLibraryLink);
    updateMeasure(measure.id, { populations: updatedPopulations });

    // 5. Rebuild usage index to reflect the change
    rebuildUsageIndex(measures);

    setShowSharedEditWarning(false);
    setPendingEdit(null);
    setSuccess(`Created new library component "${forkedComponent.name}" for this measure`);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Metadata editing handlers
  const handleStartEditingMetadata = () => {
    if (!measure) return;
    setEditedTitle(measure.metadata.title);
    setEditedMeasureId(measure.metadata.measureId);
    setEditedProgram(measure.metadata.program || '');
    setEditedDescription(measure.metadata.description || '');
    setIsEditingMetadata(true);
  };

  const handleSaveMetadata = () => {
    if (!measure) return;
    updateMeasure(measure.id, {
      metadata: {
        ...measure.metadata,
        title: editedTitle.trim() || measure.metadata.title,
        measureId: editedMeasureId.trim() || measure.metadata.measureId,
        program: (editedProgram as typeof measure.metadata.program) || measure.metadata.program,
        description: editedDescription.trim(),
      },
    });
    setIsEditingMetadata(false);
    setSuccess('Measure metadata updated');
    setTimeout(() => setSuccess(null), 2000);
  };

  const handleCancelEditingMetadata = () => {
    setIsEditingMetadata(false);
    setEditedTitle('');
    setEditedMeasureId('');
    setEditedProgram('');
    setEditedDescription('');
  };

  const handleDragStart = (id: string) => {
    setDragState({ draggedId: id, dragOverId: null, dragOverPosition: null });
  };
  const handleDragEnd = () => {
    setDragState({ draggedId: null, dragOverId: null, dragOverPosition: null });
  };
  const handleDragOver = (e: React.DragEvent, id: string, canMerge: boolean = false) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id === dragState.draggedId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const height = rect.height;
    const relativeY = e.clientY - rect.top;

    // In deep mode with mergeable components: top 25% = before, middle 50% = merge, bottom 25% = after
    // Otherwise: top 50% = before, bottom 50% = after
    let position: 'before' | 'after' | 'merge';
    if (deepMode && canMerge) {
      if (relativeY < height * 0.25) {
        position = 'before';
      } else if (relativeY > height * 0.75) {
        position = 'after';
      } else {
        position = 'merge';
      }
    } else {
      position = relativeY < height * 0.5 ? 'before' : 'after';
    }
    setDragState(prev => ({ ...prev, dragOverId: id, dragOverPosition: position }));
  };
  const handleDrop = (e: React.DragEvent, targetId: string, targetIndex: number, targetParentId: string | null, canMerge: boolean = false) => {
    e.preventDefault();
    const draggedId = dragState.draggedId;
    const position = dragState.dragOverPosition;

    if (!draggedId || !measure || draggedId === targetId) {
      handleDragEnd();
      return;
    }

    // Handle merge in deep mode - add both to selection and show dialog
    if (deepMode && position === 'merge' && canMerge) {
      // Get the library component IDs for both elements
      const findElement = (node: any, id: string): any => {
        if (!node) return null;
        if (node.id === id) return node;
        if ('children' in node) {
          for (const child of node.children) {
            const found = findElement(child, id);
            if (found) return found;
          }
        }
        return null;
      };

      let draggedElement: any = null;
      let targetElement: any = null;
      for (const pop of measure.populations) {
        if (pop.criteria) {
          if (!draggedElement) draggedElement = findElement(pop.criteria, draggedId);
          if (!targetElement) targetElement = findElement(pop.criteria, targetId);
        }
      }

      const sourceCompId = draggedElement?.libraryComponentId;
      const targetCompId = targetElement?.libraryComponentId;

      if (sourceCompId && targetCompId && sourceCompId !== targetCompId) {
        // Both have library components - select them for merge and show dialog
        const sourceComp = getComponent(sourceCompId);
        const targetComp = getComponent(targetCompId);
        if (sourceComp && targetComp) {
          setSelectedForMerge(new Set([sourceCompId, targetCompId]));
          setMergeName(`${targetComp.name} (Combined)`);
          setShowMergeDialog(true);
        }
      }
      handleDragEnd();
      return;
    }

    // Normal reorder
    if (!targetParentId) {
      handleDragEnd();
      return;
    }
    const adjustedIndex = position === 'after' ? targetIndex + 1 : targetIndex;
    moveComponentToIndex(measure.id, targetParentId, draggedId, adjustedIndex);
    handleDragEnd();
  };

  // Initialize component library and link measure components
  useEffect(() => {
    initializeWithSampleData();
  }, []);

  useEffect(() => {
    if (measure && measure.populations.length > 0) {
      const linkMap = linkMeasureComponents(
        measure.metadata.measureId,
        measure.populations,
      );
      setComponentLinkMap(linkMap);
      // Rebuild usage index from all actual measures
      rebuildUsageIndex(measures);
    }
  }, [measure?.id, measures.length]);

  // Force re-render when measures change (for progress bar)
  const [, forceUpdate] = useState({});
  useEffect(() => {
    forceUpdate({});
  }, [measures]);

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

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedSections(next);
  };

  // Returns empty string - icons removed for cleaner professional appearance
  const getPopulationIcon = (_type: string) => '';

  const getPopulationLabel = (type: string) => {
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
  };

  // Recalculate review progress from current measure state
  const reviewProgress = useMeasureStore.getState().getReviewProgress(measure.id);
  const progressPercent = reviewProgress.total > 0 ? Math.round((reviewProgress.approved / reviewProgress.total) * 100) : 0;

  // Get corrections count
  const corrections = getCorrections(measure.id);

  // Export corrections as JSON file
  const handleExportCorrections = () => {
    const exportData = exportCorrections(measure.id);
    if (!exportData) {
      alert('No corrections to export yet.');
      return;
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${measure.metadata.measureId}-corrections-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
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
            <span className="text-[var(--text)]">{measure.metadata.measureId}</span>
          </nav>

          {/* Header */}
          <div className="mb-6">
            {isEditingMetadata ? (
              <div className="w-full space-y-4">
                {/* Row 1: Programme + Measure ID + Action Buttons */}
                <div className="flex items-end gap-4">
                  {/* Programme */}
                  <div className="w-48">
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Program / Catalogue</label>
                    <select
                      value={editedProgram}
                      onChange={(e) => setEditedProgram(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                    >
                      <option value="">Select...</option>
                      {MEASURE_PROGRAMS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Measure ID */}
                  <div className="w-48">
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Measure ID</label>
                    <input
                      type="text"
                      value={editedMeasureId}
                      onChange={(e) => setEditedMeasureId(e.target.value)}
                      placeholder="CMS128v13"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                    />
                  </div>

                  {/* Spacer pushes buttons right */}
                  <div className="flex-1" />

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('components')}
                      className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)]"
                      title="Browse the Component Library"
                    >
                      <LibraryIcon className="w-4 h-4" />
                      Browse Library
                    </button>
                    <button
                      onClick={handleDeepModeToggle}
                      className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                        deepMode ? 'bg-purple-500/15 text-purple-400' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                      title="Enable advanced logic editing: reorder, delete, merge components"
                    >
                      <Settings2 className="w-4 h-4" />
                      Deep Edit Mode
                    </button>
                    <button
                      onClick={() => approveAllLowComplexity(measure.id)}
                      className="px-3 py-2 bg-[var(--success-light)] text-[var(--success)] rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-80 transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      Auto-approve
                    </button>
                    {corrections.length > 0 && (
                      <button
                        onClick={handleExportCorrections}
                        className="px-3 py-2 bg-purple-500/15 text-purple-400 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-purple-500/25 transition-colors"
                        title="Export corrections for AI training"
                      >
                        <Download className="w-4 h-4" />
                        Export ({corrections.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2: Measure Name — full width */}
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Measure Name</label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder="e.g., Cervical Cancer Screening"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                  />
                </div>

                {/* Row 3: Description — full width textarea */}
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Description</label>
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    rows={3}
                    placeholder="Measure description..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                  />
                </div>

                {/* Row 4: Save / Cancel */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveMetadata}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={handleCancelEditingMetadata}
                    className="px-4 py-2 rounded-lg text-[var(--text-muted)] text-sm hover:text-[var(--text)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                {/* Left side: Metadata (clickable to edit) */}
                <div className="flex-1 group cursor-pointer" onClick={handleStartEditingMetadata}>
                  {/* Row 1: Badges */}
                  <div className="flex items-center gap-3 mb-2">
                    {measure.metadata.program && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-purple-500/15 text-purple-400 rounded">
                        {MEASURE_PROGRAMS.find(p => p.value === measure.metadata.program)?.label || measure.metadata.program}
                      </span>
                    )}
                    <span className="px-2 py-1 text-sm font-medium bg-[var(--accent-light)] text-[var(--accent)] rounded">
                      {measure.metadata.measureId}
                    </span>
                    <ComplexityBadge level={calculateMeasureComplexity(measure.populations)} />
                    <span className="opacity-0 group-hover:opacity-100 text-xs text-[var(--text-muted)] flex items-center gap-1 transition-opacity">
                      <Edit3 className="w-3 h-3" />
                      Click to edit
                    </span>
                  </div>

                  {/* Measure Name */}
                  <h1 className="text-xl font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                    {measure.metadata.title}
                  </h1>

                  {/* Description with show more/less */}
                  {measure.metadata.description && (
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                      <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-3xl">
                        {showFullDescription || measure.metadata.description.length <= 150
                          ? measure.metadata.description
                          : `${measure.metadata.description.slice(0, 150)}...`
                        }
                      </p>
                      {measure.metadata.description.length > 150 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFullDescription(prev => !prev);
                          }}
                          className="text-xs text-[var(--accent)] mt-1 hover:underline"
                        >
                          {showFullDescription ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Right side: Action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setActiveTab('components')}
                    className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)]"
                    title="Browse the Component Library"
                  >
                    <LibraryIcon className="w-4 h-4" />
                    Browse Library
                  </button>
                  <button
                    onClick={handleDeepModeToggle}
                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                      deepMode ? 'bg-purple-500/15 text-purple-400' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                    title="Enable advanced logic editing: reorder, delete, merge components"
                  >
                    <Settings2 className="w-4 h-4" />
                    Deep Edit Mode
                  </button>
                  <button
                    onClick={() => approveAllLowComplexity(measure.id)}
                    className="px-3 py-2 bg-[var(--success-light)] text-[var(--success)] rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-80 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    Auto-approve Low Complexity
                  </button>
                  {corrections.length > 0 && (
                    <button
                      onClick={handleExportCorrections}
                      className="px-3 py-2 bg-purple-500/15 text-purple-400 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-purple-500/25 transition-colors"
                      title="Export corrections for AI training"
                    >
                      <Download className="w-4 h-4" />
                      Export ({corrections.length})
                    </button>
                  )}
                </div>
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
              {reviewProgress.flagged > 0 && (
                <p className="text-xs text-[var(--warning)] mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {reviewProgress.flagged} component{reviewProgress.flagged !== 1 ? 's' : ''} need revision
                </p>
              )}
              {progressPercent === 100 && (
                <p className="text-xs text-[var(--success)] mt-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  All components approved — ready for code generation
                </p>
              )}
            </div>
          </div>

          {/* Measurement Period Bar */}
          <MeasurePeriodBar
            mpStart={measure.metadata.measurementPeriod?.start || '2024-01-01'}
            mpEnd={measure.metadata.measurementPeriod?.end || '2024-12-31'}
            onStartChange={(date) => updateMeasurementPeriod(measure.id, date, measure.metadata.measurementPeriod?.end || '2024-12-31')}
            onEndChange={(date) => updateMeasurementPeriod(measure.id, measure.metadata.measurementPeriod?.start || '2024-01-01', date)}
          />

          {/* Population sections - IP is merged into Denominator for cleaner display */}
          <div className="space-y-4">
            {measure.populations
              .filter((population) => {
                // Hide denominator if it only references IP (shown under Denominator label via IP)
                if (population.type === 'denominator') {
                  const desc = population.description?.toLowerCase() || '';
                  const narrative = population.narrative?.toLowerCase() || '';
                  if ((desc.includes('equals initial') || desc.includes('= initial') || narrative.includes('equals initial')) &&
                      (!population.criteria?.children || population.criteria.children.length === 0)) {
                    return false;
                  }
                }
                return true;
              })
              .map((population) => (
              <PopulationSection
                key={population.id}
                population={population}
                measureId={measure.id}
                isExpanded={expandedSections.has(population.type === 'initial_population' ? 'denominator' : population.type.split('_')[0])}
                onToggle={() => toggleSection(population.type === 'initial_population' ? 'denominator' : population.type.split('_')[0])}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
                onSelectValueSet={setActiveValueSet}
                onAddComponent={() => setBuilderTarget({ populationId: population.id, populationType: population.type })}
                icon={getPopulationIcon(population.type)}
                label={getPopulationLabel(population.type)}
                updateReviewStatus={updateReviewStatus}
                allValueSets={measure.valueSets}
                deepMode={deepMode}
                onToggleOperator={(clauseId) => toggleLogicalOperator(measure.id, clauseId)}
                onReorder={(parentId, childId, dir) => reorderComponent(measure.id, parentId, childId, dir)}
                onDeleteComponent={(componentId) => deleteComponent(measure.id, componentId)}
                onSetOperatorBetween={(clauseId, i1, i2, op) => setOperatorBetweenSiblings(measure.id, clauseId, i1, i2, op)}
                dragState={dragState}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                mpStart={measure.metadata.measurementPeriod?.start || '2024-01-01'}
                mpEnd={measure.metadata.measurementPeriod?.end || '2024-12-31'}
                editingTimingId={editingTimingId}
                onEditTiming={setEditingTimingId}
                onSaveTiming={(componentId, modified) => {
                  handleTimingSaveWithWarning(componentId, modified);
                  setEditingTimingId(null);
                }}
                onResetTiming={(componentId) => {
                  // Reset doesn't trigger shared edit warning - it reverts to default
                  updateTimingOverride(measure.id, componentId, null);
                  setEditingTimingId(null);
                }}
                selectedForMerge={selectedForMerge}
                onToggleMergeSelection={toggleMergeSelection}
              />
            ))}
          </div>

          {/* Value Sets Section */}
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
                <span className="text-lg">📚</span>
                <span className="font-medium text-[var(--text)]">Value Sets</span>
                <span className="text-sm text-[var(--text-muted)]">({measure.valueSets.length})</span>
              </button>

              {expandedSections.has('valueSets') && (
                <div className="px-4 pb-4 space-y-2">
                  {/* Browse Standard Value Sets button */}
                  <button
                    onClick={() => setShowValueSetBrowser(true)}
                    className="w-full p-3 border-2 border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50 transition-colors flex items-center justify-center gap-2"
                  >
                    <LibraryIcon className="w-4 h-4" />
                    Browse Standard Value Sets (VSAC)
                  </button>
                  {measure.valueSets.map((vs) => (
                    <button
                      key={vs.id}
                      onClick={() => setActiveValueSet(vs)}
                      className="w-full p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)] hover:border-[var(--accent)]/50 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-[var(--text)] flex items-center gap-2">
                            {vs.name}
                            <ExternalLink className="w-3 h-3 text-[var(--text-dim)]" />
                          </div>
                          {vs.oid && (
                            <code className="text-xs text-[var(--text-dim)] mt-1 block">{vs.oid}</code>
                          )}
                          <div className="text-xs text-[var(--accent)] mt-1">
                            {vs.codes?.length || 0} codes {vs.totalCodeCount && vs.totalCodeCount > (vs.codes?.length || 0) ? `(${vs.totalCodeCount} total)` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {vs.verified && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-[var(--success-light)] text-[var(--success)] rounded">VSAC Verified</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail panel for selected node */}
      {selectedNode && (
        <div className="flex flex-col border-l border-[var(--border)]">
          {/* Panel mode toggle */}
          <div className="flex border-b border-[var(--border)] bg-[var(--bg-secondary)]">
            <button
              onClick={() => setDetailPanelMode('edit')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                detailPanelMode === 'edit'
                  ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--bg)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setDetailPanelMode('code')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                detailPanelMode === 'code'
                  ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--bg)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Code & Details
            </button>
          </div>

          {detailPanelMode === 'edit' ? (
            <NodeDetailPanel
              measureId={measure.id}
              nodeId={selectedNode}
              allValueSets={measure.valueSets}
              onClose={() => setSelectedNode(null)}
              onSelectValueSet={setActiveValueSet}
              updateReviewStatus={updateReviewStatus}
              mpStart={measure.metadata.measurementPeriod?.start || '2024-01-01'}
              mpEnd={measure.metadata.measurementPeriod?.end || '2024-12-31'}
              onSaveTimingWindow={(componentId, modified) => {
                updateTimingWindow(measure.id, componentId, modified);
              }}
              onResetTimingWindow={(componentId) => {
                updateTimingWindow(measure.id, componentId, null);
              }}
            />
          ) : (
            <SelectedComponentDetailPanel
              measureId={measure.id}
              nodeId={selectedNode}
              onClose={() => setSelectedNode(null)}
              onNavigateToLibrary={(id) => {
                setActiveTab('components');
              }}
              onSaveTiming={(componentId, modified) => {
                handleTimingSaveWithWarning(componentId, modified);
              }}
              onResetTiming={(componentId) => {
                updateTimingOverride(measure.id, componentId, null);
              }}
              onSaveTimingWindow={(componentId, modified) => {
                handleTimingWindowSaveWithWarning(componentId, modified);
              }}
              onResetTimingWindow={(componentId) => {
                updateTimingWindow(measure.id, componentId, null);
              }}
            />
          )}
        </div>
      )}

      {/* Value Set detail modal */}
      {activeValueSet && measure && (
        <ValueSetModal
          valueSet={activeValueSet}
          measureId={measure.id}
          onClose={() => setActiveValueSet(null)}
        />
      )}

      {/* Component Builder modal */}
      {builderTarget && measure && (
        <ComponentBuilder
          measureId={measure.id}
          populationId={builderTarget.populationId}
          populationType={builderTarget.populationType}
          existingValueSets={measure.valueSets}
          onSave={(component, newValueSet, logicOperator) => {
            // Add new value set if created
            if (newValueSet) {
              addValueSet(measure.id, newValueSet);
            }
            // Add component to population with specified logic
            addComponentToPopulation(measure.id, builderTarget.populationId, component, logicOperator);
            setBuilderTarget(null);
          }}
          onClose={() => setBuilderTarget(null)}
        />
      )}

      {/* Standard Value Set Browser modal */}
      {showValueSetBrowser && measure && (
        <StandardValueSetBrowser
          measureId={measure.id}
          existingOids={new Set(measure.valueSets.map(vs => vs.oid).filter(Boolean) as string[])}
          onImport={(standardVS) => {
            // Convert StandardValueSet to ValueSetReference and add to measure
            const vsRef: ValueSetReference = {
              id: `vs-${Date.now()}`,
              name: standardVS.name,
              oid: standardVS.oid,
              version: standardVS.version,
              confidence: 'high',
              source: 'VSAC Standard Library',
              verified: true,
              codes: standardVS.codes.map(c => ({
                code: c.code,
                display: c.display,
                system: mapCodeSystemFromUri(c.system),
              })),
              totalCodeCount: standardVS.codes.length,
            };
            addValueSet(measure.id, vsRef);
          }}
          onClose={() => setShowValueSetBrowser(false)}
        />
      )}

      {/* Component Merge Dialog - checkbox selection in deep mode */}
      {showMergeDialog && selectedForMerge.size >= 2 && measure && (() => {
        // Find selected elements from the measure
        const findElements = (node: any): any[] => {
          if (!node) return [];
          if ('operator' in node && 'children' in node) {
            return node.children.flatMap(findElements);
          }
          return [node];
        };
        const allElements = measure.populations.flatMap(pop => pop.criteria ? findElements(pop.criteria) : []);
        const selectedElements = allElements.filter((el: any) => selectedForMerge.has(el.id));

        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border)] w-[500px] max-h-[80vh] overflow-hidden shadow-xl">
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <h3 className="font-semibold text-[var(--text)] flex items-center gap-2">
                  <Combine className="w-5 h-5 text-purple-400" />
                  Merge {selectedForMerge.size} Components
                </h3>
                <button
                  onClick={() => {
                    setShowMergeDialog(false);
                    setMergeName('');
                  }}
                  className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
                >
                  <X className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Merged Component Name</label>
                  <input
                    type="text"
                    value={mergeName}
                    onChange={(e) => setMergeName(e.target.value)}
                    placeholder="e.g., Hospice or Palliative Care Services"
                    className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Components to Merge ({selectedElements.length})</label>
                  <div className="space-y-2 max-h-[200px] overflow-auto">
                    {selectedElements.map((el: any) => {
                      // Look up code count from measure.valueSets for accurate count
                      const elementVsRefs = el.valueSets || (el.valueSet ? [el.valueSet] : []);
                      let codeCount = 0;
                      for (const vsRef of elementVsRefs) {
                        const fullVs = measure.valueSets.find(
                          mvs => mvs.id === vsRef.id || mvs.oid === vsRef.oid
                        );
                        codeCount += fullVs?.codes?.length || vsRef.codes?.length || 0;
                      }
                      if (codeCount === 0) {
                        codeCount = el.directCodes?.length || 0;
                      }
                      return (
                        <div key={el.id} className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                            <Combine className="w-4 h-4 text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--text)] truncate">{el.description}</p>
                            <p className="text-xs text-[var(--text-dim)]">
                              {codeCount} codes • {el.type}
                            </p>
                          </div>
                          <button
                            onClick={() => toggleMergeSelection(el.id)}
                            className="p-1 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-dim)] hover:text-[var(--danger)]"
                            title="Remove from merge"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <p className="text-xs text-purple-400">
                    Components will be combined using OR logic. Each value set remains separate with its codes preserved. Duplicate codes across value sets are removed.
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-[var(--border)] flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowMergeDialog(false);
                    setMergeName('');
                  }}
                  className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!mergeName.trim() || selectedElements.length < 2) return;

                    // Clear any previous messages
                    setError(null);
                    setSuccess(null);

                    try {
                      // Collect all value sets from selected elements (keep them separate)
                      // Look up full value set data including codes from measure.valueSets
                      const allValueSets: any[] = [];
                      const seenOids = new Set<string>();
                      const allCodeKeys = new Set<string>(); // Track all codes for deduplication

                      for (const el of selectedElements) {
                        // Get value set references from element
                        const elementVsRefs = el.valueSets || (el.valueSet ? [el.valueSet] : []);

                        for (const vsRef of elementVsRefs) {
                          const key = vsRef.oid || vsRef.id || vsRef.name;
                          if (key && !seenOids.has(key)) {
                            seenOids.add(key);

                            // Look up the full value set with codes from measure.valueSets
                            const fullVs = measure.valueSets.find(
                              mvs => mvs.id === vsRef.id || mvs.oid === vsRef.oid
                            );

                            if (fullVs) {
                              // Deduplicate codes across value sets
                              const dedupedCodes = (fullVs.codes || []).filter(code => {
                                const codeKey = `${code.system}|${code.code}`;
                                if (allCodeKeys.has(codeKey)) {
                                  return false; // Skip duplicate
                                }
                                allCodeKeys.add(codeKey);
                                return true;
                              });

                              allValueSets.push({
                                ...fullVs,
                                codes: dedupedCodes,
                              });
                            } else if (vsRef.codes && vsRef.codes.length > 0) {
                              // Use element's value set if it has codes directly
                              const dedupedCodes = vsRef.codes.filter((code: any) => {
                                const codeKey = `${code.system}|${code.code}`;
                                if (allCodeKeys.has(codeKey)) {
                                  return false;
                                }
                                allCodeKeys.add(codeKey);
                                return true;
                              });

                              allValueSets.push({
                                ...vsRef,
                                codes: dedupedCodes,
                              });
                            } else {
                              // Fallback: use the reference as-is
                              allValueSets.push(vsRef);
                            }
                          }
                        }
                      }

                      // Create merged library component - pass the value sets with codes
                      const componentIds = selectedElements.map((el: any) => el.libraryComponentId).filter(Boolean);
                      const mergeResult = mergeComponents(
                        componentIds,
                        mergeName.trim(),
                        undefined, // description
                        allValueSets // Pass value sets with codes for accurate data
                      );

                      // Check for merge failure - don't proceed if failed
                      if (!mergeResult.success || !mergeResult.component) {
                        console.error('[UMSEditor] Merge failed:', mergeResult.error);
                        setError(`Merge failed: ${mergeResult.error || 'Unknown error'}`);
                        // Don't clear selection on error - let user retry
                        return;
                      }

                      const mergedComp = mergeResult.component;

                      // Keep the first element, remove the rest, update the first to point to merged component
                      const firstElementId = selectedElements[0].id;
                      const otherElementIds = new Set(selectedElements.slice(1).map((el: any) => el.id));

                      const updateNode = (node: any): any => {
                        if (!node) return node;
                        if ('operator' in node && 'children' in node) {
                          // Filter out the other merged elements and recurse
                          const filteredChildren = node.children
                            .filter((child: any) => !otherElementIds.has(child.id))
                            .map(updateNode);
                          return { ...node, children: filteredChildren };
                        }
                        // Update the first element to have merged description and all value sets
                        if (node.id === firstElementId) {
                          return {
                            ...node,
                            description: mergeName.trim(),
                            libraryComponentId: mergedComp.id,
                            // Keep first value set for backward compatibility
                            valueSet: allValueSets.length > 0 ? allValueSets[0] : node.valueSet,
                            // Always store all value sets for consistency (even if just 1)
                            valueSets: allValueSets.length > 0 ? allValueSets : undefined,
                          };
                        }
                        return node;
                      };

                      const updatedPopulations = measure.populations.map(pop => ({
                        ...pop,
                        criteria: pop.criteria ? updateNode(pop.criteria) : pop.criteria,
                      }));
                      updateMeasure(measure.id, { populations: updatedPopulations });

                      // Update references in OTHER measures that still point to archived components
                      const archivedIds = componentIds;
                      const otherMeasures = measures.filter(m => m.id !== measure.id);
                      const refResult = updateMeasureReferencesAfterMerge(archivedIds, mergedComp.id, otherMeasures, batchUpdateMeasures);
                      if (!refResult.success) {
                        console.error('[UMSEditor] Failed to update measure references after merge:', refResult.error);
                        // This is a partial success - component merged but references not fully updated
                        setError(`Merge succeeded but failed to update some references: ${refResult.error}`);
                      }

                      // Rebuild usage index after merge to ensure consistency
                      rebuildUsageIndex(measures);

                      // Validate referential integrity and log any issues
                      const mismatches = validateReferentialIntegrity(measures, libraryComponents);
                      if (mismatches.length > 0) {
                        console.warn('[UMSEditor] Referential integrity issues after merge:');
                        console.warn(formatMismatches(mismatches));
                      }

                      // Success! Clear dialog and selection, show success message
                      setShowMergeDialog(false);
                      setSelectedForMerge(new Set());
                      setMergeName('');
                      setSuccess(`Successfully merged ${selectedElements.length} components into "${mergedComp.name}"`);
                    } catch (err) {
                      console.error('[UMSEditor] Merge failed:', err);
                      setError(`Merge failed: ${err instanceof Error ? err.message : String(err)}`);
                      // Don't clear selection on error - let user retry
                    }
                  }}
                  disabled={!mergeName.trim() || selectedElements.length < 2}
                  className="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Merge Components
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Merge Button - always visible when items selected in deep mode */}
      {deepMode && selectedForMerge.size >= 2 && !showMergeDialog && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
          <button
            onClick={() => {
              setMergeName('Combined Component');
              setShowMergeDialog(true);
            }}
            className="px-6 py-3 bg-purple-500 text-white rounded-full text-sm font-medium flex items-center gap-2 hover:bg-purple-600 transition-all shadow-lg shadow-purple-500/25 animate-pulse"
          >
            <Combine className="w-5 h-5" />
            Merge {selectedForMerge.size} Selected Components
          </button>
        </div>
      )}

      {/* Shared Edit Warning Modal */}
      {showSharedEditWarning && pendingEdit && (
        <SharedEditWarning
          componentName={pendingEdit.libraryComponent.name}
          usageCount={pendingEdit.libraryComponent.usage.usageCount}
          measureIds={pendingEdit.libraryComponent.usage.measureIds}
          onUpdateAll={handleSharedEditUpdateAll}
          onCreateCopy={handleSharedEditCreateVersion}
          onCancel={() => {
            setShowSharedEditWarning(false);
            setPendingEdit(null);
          }}
        />
      )}
    </div>
  );
}

// Helper to convert URI to short code system name
function mapCodeSystemFromUri(uri: string): CodeSystem {
  const uriMap: Record<string, CodeSystem> = {
    'http://hl7.org/fhir/sid/icd-10-cm': 'ICD10',
    'http://snomed.info/sct': 'SNOMED',
    'http://www.ama-assn.org/go/cpt': 'CPT',
    'https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets': 'HCPCS',
    'http://loinc.org': 'LOINC',
    'http://www.nlm.nih.gov/research/umls/rxnorm': 'RxNorm',
    'http://hl7.org/fhir/sid/cvx': 'CVX',
  };
  return uriMap[uri] || 'CPT';
}

function PopulationSection({
  population,
  measureId,
  isExpanded,
  onToggle,
  selectedNode,
  onSelectNode,
  onSelectValueSet,
  onAddComponent,
  icon,
  label,
  updateReviewStatus,
  allValueSets,
  deepMode,
  onToggleOperator,
  onReorder,
  onDeleteComponent,
  onSetOperatorBetween,
  dragState,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  mpStart,
  mpEnd,
  editingTimingId,
  onEditTiming,
  onSaveTiming,
  onResetTiming,
  selectedForMerge,
  onToggleMergeSelection,
}: {
  population: PopulationDefinition;
  measureId: string;
  isExpanded: boolean;
  onToggle: () => void;
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectValueSet: (vs: ValueSetReference) => void;
  onAddComponent: () => void;
  icon: string;
  label: string;
  updateReviewStatus: (measureId: string, componentId: string, status: ReviewStatus, notes?: string) => void;
  allValueSets: ValueSetReference[];
  deepMode: boolean;
  onToggleOperator: (clauseId: string) => void;
  onReorder: (parentId: string, childId: string, direction: 'up' | 'down') => void;
  onDeleteComponent: (componentId: string) => void;
  onSetOperatorBetween: (clauseId: string, index1: number, index2: number, operator: LogicalOperator) => void;
  dragState: { draggedId: string | null; dragOverId: string | null; dragOverPosition: 'before' | 'after' | 'merge' | null };
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, id: string, canMerge?: boolean) => void;
  onDrop: (e: React.DragEvent, targetId: string, targetIndex: number, targetParentId: string | null, canMerge?: boolean) => void;
  mpStart: string;
  mpEnd: string;
  editingTimingId: string | null;
  onEditTiming: (id: string | null) => void;
  onSaveTiming: (componentId: string, modified: TimingConstraint) => void;
  onResetTiming: (componentId: string) => void;
  selectedForMerge: Set<string>;
  onToggleMergeSelection: (componentId: string) => void;
}) {
  // Compute effective status based on children's status
  const computeEffectiveStatus = (pop: PopulationDefinition): ReviewStatus => {
    const statuses: ReviewStatus[] = [pop.reviewStatus];

    const collectStatuses = (node: LogicalClause | DataElement) => {
      statuses.push(node.reviewStatus);
      if ('children' in node && node.children) {
        node.children.forEach(collectStatuses);
      }
    };

    if (pop.criteria) {
      collectStatuses(pop.criteria);
    }

    // If any are flagged, show flagged
    if (statuses.some(s => s === 'flagged')) return 'flagged';
    // If any are needs_revision, show needs_revision
    if (statuses.some(s => s === 'needs_revision')) return 'needs_revision';
    // If all are approved, show approved
    if (statuses.every(s => s === 'approved')) return 'approved';
    // Otherwise pending
    return 'pending';
  };

  const effectiveStatus = computeEffectiveStatus(population);

  return (
    <div className={`rounded-xl overflow-hidden transition-colors bg-[var(--bg-secondary)] ${
      effectiveStatus === 'approved'
        ? 'border-2 border-[var(--success)]/60'
        : effectiveStatus === 'needs_revision' || effectiveStatus === 'flagged'
          ? 'border-2 border-amber-400/60'
          : 'border border-[var(--border)]'
    }`}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-tertiary)]/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        )}
        <span className="text-lg">{icon}</span>
        <span className="font-medium text-[var(--text)]">{label}</span>
        <ComplexityBadge level={calculatePopulationComplexity(population)} size="sm" />
        {/* Status indicator - visual only */}
        {effectiveStatus === 'approved' && (
          <CheckCircle className="w-4 h-4 text-green-500 fill-green-500/20" />
        )}
        {(effectiveStatus === 'needs_revision' || effectiveStatus === 'flagged') && (
          <AlertTriangle className="w-4 h-4 text-amber-500 fill-amber-500/20" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-sm text-[var(--text-muted)] ml-7">{population.narrative}</p>

          {/* Criteria tree */}
          {population.criteria && (
            <CriteriaNode
              node={population.criteria}
              parentId={null}
              measureId={measureId}
              depth={0}
              index={0}
              totalSiblings={1}
              selectedNode={selectedNode}
              onSelectNode={onSelectNode}
              onSelectValueSet={onSelectValueSet}
              updateReviewStatus={updateReviewStatus}
              allValueSets={allValueSets}
              deepMode={deepMode}
              onToggleOperator={onToggleOperator}
              onReorder={onReorder}
              onDeleteComponent={onDeleteComponent}
              onSetOperatorBetween={onSetOperatorBetween}
              dragState={dragState}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDrop={onDrop}
              mpStart={mpStart}
              mpEnd={mpEnd}
              editingTimingId={editingTimingId}
              onEditTiming={onEditTiming}
              onSaveTiming={onSaveTiming}
              onResetTiming={onResetTiming}
              selectedForMerge={selectedForMerge}
              onToggleMergeSelection={onToggleMergeSelection}
            />
          )}

          {/* Add Component Button - only visible in Deep Edit Mode */}
          {deepMode && (
            <button
              onClick={onAddComponent}
              className="ml-7 mt-3 px-4 py-2 border-2 border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Component
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CriteriaNode({
  node,
  parentId,
  measureId,
  depth,
  index,
  totalSiblings,
  selectedNode,
  onSelectNode,
  onSelectValueSet,
  updateReviewStatus,
  allValueSets,
  deepMode,
  onToggleOperator,
  onReorder,
  onDeleteComponent,
  onSetOperatorBetween,
  dragState,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  mpStart,
  mpEnd,
  editingTimingId,
  onEditTiming,
  onSaveTiming,
  onResetTiming,
  selectedForMerge,
  onToggleMergeSelection,
}: {
  node: LogicalClause | DataElement;
  parentId: string | null;
  measureId: string;
  depth: number;
  index: number;
  totalSiblings: number;
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectValueSet: (vs: ValueSetReference) => void;
  updateReviewStatus: (measureId: string, componentId: string, status: ReviewStatus, notes?: string) => void;
  allValueSets: ValueSetReference[];
  deepMode: boolean;
  onToggleOperator: (clauseId: string) => void;
  onReorder: (parentId: string, childId: string, direction: 'up' | 'down') => void;
  onDeleteComponent: (componentId: string) => void;
  onSetOperatorBetween: (clauseId: string, index1: number, index2: number, operator: LogicalOperator) => void;
  dragState: { draggedId: string | null; dragOverId: string | null; dragOverPosition: 'before' | 'after' | 'merge' | null };
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, id: string, canMerge?: boolean) => void;
  onDrop: (e: React.DragEvent, targetId: string, targetIndex: number, targetParentId: string | null, canMerge?: boolean) => void;
  mpStart: string;
  mpEnd: string;
  editingTimingId: string | null;
  onEditTiming: (id: string | null) => void;
  onSaveTiming: (componentId: string, modified: TimingConstraint) => void;
  onResetTiming: (componentId: string) => void;
  selectedForMerge: Set<string>;
  onToggleMergeSelection: (componentId: string) => void;
}) {
  const isClause = 'operator' in node;
  const isSelected = selectedNode === node.id;
  const canMoveUp = index > 0;
  const canMoveDown = index < totalSiblings - 1;

  if (isClause) {
    const clause = node as LogicalClause;
    return (
      <div className="ml-7 space-y-2">
        {/* Clause header - description only, no operator badge (operators only appear between siblings) */}
        <div className="flex items-center gap-2 text-sm group">
          <span className="text-[var(--text-muted)] flex-1">{cleanDescription(clause.description)}</span>

          {/* Deep mode controls for clause */}
          {deepMode && parentId && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onReorder(parentId, clause.id, 'up')}
                disabled={!canMoveUp}
                className={`p-1 rounded ${canMoveUp ? 'hover:bg-[var(--bg-tertiary)] text-[var(--text-dim)] hover:text-[var(--text)]' : 'text-[var(--bg-tertiary)] cursor-not-allowed'}`}
                title="Move up"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onReorder(parentId, clause.id, 'down')}
                disabled={!canMoveDown}
                className={`p-1 rounded ${canMoveDown ? 'hover:bg-[var(--bg-tertiary)] text-[var(--text-dim)] hover:text-[var(--text)]' : 'text-[var(--bg-tertiary)] cursor-not-allowed'}`}
                title="Move down"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (confirm('Delete this logic group and all its children?')) {
                    onDeleteComponent(clause.id);
                  }
                }}
                className="p-1 rounded hover:bg-[var(--danger-light)] text-[var(--text-dim)] hover:text-[var(--danger)]"
                title="Delete group"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        {clause.children.map((child, idx) => {
          const siblingOp = idx > 0 ? getOperatorBetween(clause, idx - 1, idx) : clause.operator;
          const isOverride = idx > 0 && siblingOp !== clause.operator;

          return (
            <Fragment key={child.id}>
              {idx > 0 && (
                <div className={`flex items-center gap-2 ${isOverride ? 'ml-8' : 'ml-4'}`}>
                  <div className="w-px h-3 bg-[var(--border)]" />
                  <button
                    onClick={() => {
                      const newOp = siblingOp === 'AND' ? 'OR' : 'AND';
                      onSetOperatorBetween(clause.id, idx - 1, idx, newOp);
                    }}
                    className={`px-2 py-0.5 rounded font-mono text-[10px] cursor-pointer hover:ring-2 hover:ring-white/20 hover:opacity-80 transition-all ${
                      siblingOp === 'AND' ? 'bg-[var(--success-light)] text-[var(--success)]' :
                      siblingOp === 'OR' ? 'bg-[var(--warning-light)] text-[var(--warning)]' :
                      'bg-[var(--danger-light)] text-[var(--danger)]'
                    } ${isOverride ? 'ring-1 ring-[var(--accent)]/30' : ''}`}
                    title={`Click to toggle between AND / OR (currently ${siblingOp})`}
                  >
                    {siblingOp}
                  </button>
                  <div className="w-px h-3 bg-[var(--border)]" />
                  {isOverride && (
                    <span className="text-[9px] text-[var(--text-dim)] italic">override</span>
                  )}
                </div>
              )}
              <div className={isOverride ? 'ml-4 pl-3 border-l-2 border-[var(--accent)]/20' : ''}>
                <CriteriaNode
                  node={child}
                  parentId={clause.id}
                  measureId={measureId}
                  depth={depth + 1}
                  index={idx}
                  totalSiblings={clause.children.length}
                  selectedNode={selectedNode}
                  onSelectNode={onSelectNode}
                  onSelectValueSet={onSelectValueSet}
                  updateReviewStatus={updateReviewStatus}
                  allValueSets={allValueSets}
                  deepMode={deepMode}
                  onToggleOperator={onToggleOperator}
                  onReorder={onReorder}
                  onDeleteComponent={onDeleteComponent}
                  onSetOperatorBetween={onSetOperatorBetween}
                  dragState={dragState}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  mpStart={mpStart}
                  mpEnd={mpEnd}
                  editingTimingId={editingTimingId}
                  onEditTiming={onEditTiming}
                  onSaveTiming={onSaveTiming}
                  onResetTiming={onResetTiming}
                  selectedForMerge={selectedForMerge}
                  onToggleMergeSelection={onToggleMergeSelection}
                />
              </div>
            </Fragment>
          );
        })}
      </div>
    );
  }

  const element = node as DataElement;

  // Look up linked library component for status badge
  const { getComponent } = useComponentLibraryStore();
  const linkedComponent = element.libraryComponentId ? getComponent(element.libraryComponentId) ?? undefined : undefined;

  // Find all value sets - support multiple value sets for merged components
  // Prioritize element's own value sets (with codes) over looked-up versions
  const elementValueSets = element.valueSets || (element.valueSet ? [element.valueSet] : []);
  const fullValueSets = elementValueSets.map(vs => {
    // If the value set already has codes embedded, use it directly
    if (vs.codes && vs.codes.length > 0) {
      return vs;
    }
    // Otherwise look up from allValueSets
    return allValueSets.find(avs => avs.id === vs.id || avs.oid === vs.oid) || vs;
  }).filter(Boolean);
  // Keep legacy single value set for backwards compatibility
  const fullValueSet = fullValueSets.length > 0 ? fullValueSets[0] : undefined;

  const isDraggedOver = dragState.dragOverId === element.id && dragState.draggedId !== element.id;
  const isDragging = dragState.draggedId === element.id;
  const isMergeTarget = isDraggedOver && dragState.dragOverPosition === 'merge';
  // Use element.id for merge selection (all components can be merged)
  const isSelectedForMerge = selectedForMerge.has(element.id);

  return (
    <div
      className={`relative ml-7 ${isDraggedOver && dragState.dragOverPosition === 'before' ? 'pt-1' : ''} ${isDraggedOver && dragState.dragOverPosition === 'after' ? 'pb-1' : ''}`}
      onDragOver={(e) => onDragOver(e, element.id, true)}
      onDrop={(e) => onDrop(e, element.id, index, parentId, true)}
      onDragLeave={() => {}}
    >
      {/* Drop indicator - before */}
      {isDraggedOver && dragState.dragOverPosition === 'before' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-full z-10" />
      )}
      {/* Merge indicator - center */}
      {isMergeTarget && (
        <div className="absolute inset-0 border-2 border-dashed border-purple-500 rounded-lg bg-purple-500/10 z-10 flex items-center justify-center pointer-events-none">
          <span className="px-3 py-1.5 bg-purple-500 text-white text-xs font-medium rounded-full shadow-lg">
            Drop to Merge (OR logic)
          </span>
        </div>
      )}

      <div
        onClick={() => onSelectNode(isSelected ? null : element.id)}
        className={`p-3 rounded-lg cursor-pointer transition-all ${
          isDragging ? 'opacity-40' :
          isSelectedForMerge
            ? 'border-2 bg-purple-500/5 border-purple-500/50 ring-2 ring-purple-500/20'
            : isSelected
              ? 'border bg-[var(--accent-light)] border-[var(--accent)]/50'
              : element.reviewStatus === 'approved'
                ? 'border-2 bg-[var(--bg-tertiary)] border-[var(--success)]/60 hover:border-[var(--success)]/80'
                : element.reviewStatus === 'needs_revision'
                  ? 'border-2 bg-[var(--bg-tertiary)] border-amber-400/60 hover:border-amber-400/80'
                  : 'border bg-[var(--bg-tertiary)] border-[var(--border)] hover:border-[var(--text-dim)]'
        }`}
      >
      <div className="flex items-start justify-between gap-3">
        {/* Merge checkbox - visible in deep mode for all components */}
        {deepMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMergeSelection(element.id);
            }}
            className={`flex-shrink-0 p-1.5 mt-0.5 rounded transition-colors ${
              isSelectedForMerge
                ? 'bg-purple-500/20 text-purple-400'
                : 'text-[var(--text-dim)] hover:text-purple-400 hover:bg-purple-500/10'
            }`}
            title={isSelectedForMerge ? 'Deselect for merge' : 'Select for merge'}
          >
            {isSelectedForMerge ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
        )}
        {/* Drag handle */}
        {parentId && (
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', element.id);
              onDragStart(element.id);
            }}
            onDragEnd={onDragEnd}
            className="flex-shrink-0 p-1 mt-0.5 rounded cursor-grab text-[var(--text-dim)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-dim)] uppercase">
              {element.type}
            </span>
            <ComplexityBadge level={calculateDataElementComplexity(element)} size="sm" />
          </div>
          <p className="text-sm text-[var(--text)]">{cleanDescription(element.description)}</p>

          {/* Library Connection Indicator */}
          {linkedComponent && (
            <ComponentLibraryIndicator component={linkedComponent} />
          )}

          {/* Zero-code ingestion warning */}
          {element.ingestionWarning && (
            <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-xs font-medium text-red-400">
                {element.ingestionWarning}
              </span>
            </div>
          )}

          {/* Thresholds for demographics (age) and observations */}
          {element.thresholds && (element.thresholds.ageMin !== undefined || element.thresholds.valueMin !== undefined) && (
            <div className="mt-2 flex items-center gap-2">
              {element.thresholds.ageMin !== undefined && (
                <span className="text-xs px-2 py-1 bg-[var(--success-light)] text-[var(--success)] rounded-lg flex items-center gap-1">
                  <span className="font-medium">Age:</span>
                  <span className="font-bold">{element.thresholds.ageMin}</span>
                  <span>-</span>
                  <span className="font-bold">{element.thresholds.ageMax ?? 150}</span>
                  <span>years</span>
                </span>
              )}
              {element.thresholds.valueMin !== undefined && (
                <span className="text-xs px-2 py-1 bg-[var(--warning-light)] text-[var(--warning)] rounded-lg">
                  {element.thresholds.comparator || '>='} {element.thresholds.valueMin}
                  {element.thresholds.valueMax !== undefined && ` - ${element.thresholds.valueMax}`}
                  {element.thresholds.unit && ` ${element.thresholds.unit}`}
                </span>
              )}
            </div>
          )}

          {/* Value Sets - clickable, support multiple */}
          {fullValueSets.length > 0 && (
            <div className="mt-2 space-y-1">
              {fullValueSets.length > 1 && (
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                  Combined Value Sets ({fullValueSets.length})
                </span>
              )}
              <div className={fullValueSets.length > 1 ? "flex flex-wrap gap-2" : ""}>
                {fullValueSets.map((vs, vsIdx) => (
                  <button
                    key={vs.id || vsIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectValueSet(vs);
                    }}
                    className={`text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1 group ${
                      fullValueSets.length > 1
                        ? 'px-2 py-1 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20 hover:bg-[var(--accent)]/10'
                        : ''
                    }`}
                  >
                    {fullValueSets.length === 1 && <span>Value Set: </span>}
                    <span>{vs.name}</span>
                    <span className="text-[var(--text-dim)]">({vs.codes?.length || 0})</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timing Override - structured timing editor */}
          {element.timingOverride && (
            <div className="mt-2">
              <TimingBadge
                timing={element.timingOverride}
                mpStart={mpStart}
                mpEnd={mpEnd}
                onClick={() => onEditTiming(editingTimingId === element.id ? null : element.id)}
              />
            </div>
          )}

          {/* Timing Requirements - legacy display for backwards compatibility */}
          {!element.timingOverride && element.timingRequirements && element.timingRequirements.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {element.timingRequirements.map((tr, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-[var(--accent-light)] text-[var(--accent)] rounded">
                  {tr.description}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Deep mode controls for elements */}
          {deepMode && parentId && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReorder(parentId, element.id, 'up');
                }}
                disabled={!canMoveUp}
                className={`p-1.5 rounded ${canMoveUp ? 'hover:bg-[var(--bg-secondary)] text-[var(--text-dim)] hover:text-[var(--text)]' : 'text-[var(--bg-tertiary)] cursor-not-allowed'}`}
                title="Move up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReorder(parentId, element.id, 'down');
                }}
                disabled={!canMoveDown}
                className={`p-1.5 rounded ${canMoveDown ? 'hover:bg-[var(--bg-secondary)] text-[var(--text-dim)] hover:text-[var(--text)]' : 'text-[var(--bg-tertiary)] cursor-not-allowed'}`}
                title="Move down"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-[var(--border)] mx-1" />
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateReviewStatus(measureId, element.id, element.reviewStatus === 'approved' ? 'pending' : 'approved');
            }}
            className={`p-1.5 rounded transition-colors ${
              element.reviewStatus === 'approved'
                ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                : 'hover:bg-[var(--success-light)] text-[var(--text-dim)] hover:text-[var(--success)]'
            }`}
            title={element.reviewStatus === 'approved' ? 'Approved (click to unapprove)' : 'Approve'}
          >
            <CheckCircle className={`w-4 h-4 ${element.reviewStatus === 'approved' ? 'fill-green-500/30' : ''}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateReviewStatus(measureId, element.id, element.reviewStatus === 'needs_revision' ? 'pending' : 'needs_revision');
            }}
            className={`p-1.5 rounded transition-colors ${
              element.reviewStatus === 'needs_revision'
                ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30'
                : 'hover:bg-[var(--warning-light)] text-[var(--text-dim)] hover:text-[var(--warning)]'
            }`}
            title={element.reviewStatus === 'needs_revision' ? 'Flagged (click to clear)' : 'Flag for revision'}
          >
            <AlertTriangle className={`w-4 h-4 ${element.reviewStatus === 'needs_revision' ? 'fill-amber-500/30' : ''}`} />
          </button>
          {/* Delete button in deep mode */}
          {deepMode && parentId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete this component?')) {
                  onDeleteComponent(element.id);
                }
              }}
              className="p-1.5 rounded hover:bg-[var(--danger-light)] text-[var(--text-dim)] hover:text-[var(--danger)] transition-colors"
              title="Delete component"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      </div>

      {/* Timing Editor Panel - appears when editing timing */}
      {editingTimingId === element.id && element.timingOverride && (
        <TimingEditorPanel
          timing={element.timingOverride}
          mpStart={mpStart}
          mpEnd={mpEnd}
          onSave={(modified) => onSaveTiming(element.id, modified)}
          onCancel={() => onEditTiming(null)}
          onReset={() => onResetTiming(element.id)}
        />
      )}

      {/* Drop indicator - after */}
      {isDraggedOver && dragState.dragOverPosition === 'after' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-full z-10" />
      )}
    </div>
  );
}

function SelectedComponentDetailPanel({
  measureId,
  nodeId,
  onClose,
  onNavigateToLibrary,
  onSaveTiming,
  onResetTiming,
  onSaveTimingWindow,
  onResetTimingWindow,
}: {
  measureId: string;
  nodeId: string;
  onClose: () => void;
  onNavigateToLibrary: (id: string) => void;
  onSaveTiming: (componentId: string, modified: TimingConstraint) => void;
  onResetTiming: (componentId: string) => void;
  onSaveTimingWindow: (componentId: string, modified: TimingWindow) => void;
  onResetTimingWindow: (componentId: string) => void;
}) {
  const { measures } = useMeasureStore();
  const currentMeasure = measures.find(m => m.id === measureId);

  // Find the DataElement in the criteria tree
  const findElement = (obj: any): DataElement | null => {
    if (obj?.id === nodeId && obj?.type && !obj?.children) return obj;
    if (obj?.criteria) {
      const found = findElement(obj.criteria);
      if (found) return found;
    }
    if (obj?.children) {
      for (const child of obj.children) {
        const found = findElement(child);
        if (found) return found;
      }
    }
    return null;
  };

  let element: DataElement | null = null;
  if (currentMeasure) {
    for (const pop of currentMeasure.populations) {
      element = findElement(pop);
      if (element) break;
    }
  }

  if (!element) {
    return (
      <div className="w-[450px] flex items-center justify-center p-8 text-[var(--text-muted)] text-sm">
        Component not found. Select a data element to view code details.
      </div>
    );
  }

  // Get measurement period from measure
  const mpStart = currentMeasure?.metadata.measurementPeriod?.start || '2024-01-01';
  const mpEnd = currentMeasure?.metadata.measurementPeriod?.end || '2024-12-31';

  return (
    <ComponentDetailPanel
      element={element}
      measureId={measureId}
      onClose={onClose}
      onNavigateToLibrary={onNavigateToLibrary}
      className="w-[450px]"
      mpStart={mpStart}
      mpEnd={mpEnd}
      onSaveTiming={onSaveTiming}
      onResetTiming={onResetTiming}
      onSaveTimingWindow={onSaveTimingWindow}
      onResetTimingWindow={onResetTimingWindow}
    />
  );
}

function NodeDetailPanel({
  measureId,
  nodeId,
  allValueSets,
  onClose,
  onSelectValueSet,
  updateReviewStatus,
  mpStart,
  mpEnd,
  onSaveTimingWindow,
  onResetTimingWindow,
}: {
  measureId: string;
  nodeId: string;
  allValueSets: ValueSetReference[];
  onClose: () => void;
  onSelectValueSet: (vs: ValueSetReference) => void;
  updateReviewStatus: (measureId: string, componentId: string, status: ReviewStatus, notes?: string) => void;
  mpStart: string;
  mpEnd: string;
  onSaveTimingWindow: (componentId: string, modified: TimingWindow) => void;
  onResetTimingWindow: (componentId: string) => void;
}) {
  const { updateDataElement, measures, syncAgeRange } = useMeasureStore();
  const { getComponent } = useComponentLibraryStore();
  const { selectedProvider, selectedModel, getActiveApiKey, getCustomLlmConfig } = useSettingsStore();
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    action?: string;
    pendingEdit?: {
      changes: NonNullable<AIAssistantResponse['changes']>;
      explanation?: string;
    };
  }>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editTimingIdx, setEditTimingIdx] = useState<number | null>(null);
  const [editReqIdx, setEditReqIdx] = useState<number | null>(null);
  const [editingTimingWindow, setEditingTimingWindow] = useState(false);

  // Find the node in the tree (re-fetch from measures to get live updates)
  const findNode = (obj: any): DataElement | null => {
    if (obj?.id === nodeId) return obj;
    if (obj?.criteria) {
      const found = findNode(obj.criteria);
      if (found) return found;
    }
    if (obj?.children) {
      for (const child of obj.children) {
        const found = findNode(child);
        if (found) return found;
      }
    }
    return null;
  };

  // Get fresh data from store
  const currentMeasure = measures.find(m => m.id === measureId);
  let node: DataElement | null = null;
  let nodePopulation: PopulationDefinition | null = null;
  if (currentMeasure) {
    for (const pop of currentMeasure.populations) {
      node = findNode(pop);
      if (node) {
        nodePopulation = pop;
        break;
      }
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Clear chat when component changes
  useEffect(() => {
    setChatHistory([]);
  }, [nodeId]);

  if (!node) return null;

  // Support multiple value sets for merged components
  // Prioritize the node's own value sets (which have accurate codes) over looked-up versions
  const nodeValueSetRefs = node.valueSets || (node.valueSet ? [node.valueSet] : []);
  const fullValueSets = nodeValueSetRefs.map(vsRef => {
    // If the reference already has codes embedded, use it directly
    if (vsRef.codes && vsRef.codes.length > 0) {
      return vsRef;
    }
    // Otherwise try to look up from measure or global value sets
    const lookedUp = currentMeasure?.valueSets.find(vs => vs.id === vsRef.id || vs.oid === vsRef.oid)
      || allValueSets.find(vs => vs.id === vsRef.id || vs.oid === vsRef.oid);
    return lookedUp || vsRef;
  }).filter(Boolean);
  // Keep single value set for backward compatibility
  const fullValueSet = fullValueSets.length > 0 ? fullValueSets[0] : undefined;

  // Helper to detect "X or older" pattern in text — returns true if open-ended upper bound
  const isOpenEndedAge = (text: string): boolean => {
    return /(\d+)\s*(?:or|and)\s*older/i.test(text) || /(\d+)\s*\+/.test(text) || /(\d+)\s*years\s*of\s*age\s*(?:or|and)\s*older/i.test(text);
  };

  // Helper to extract age range from description or additionalRequirements
  const parseAgeRange = (): { min: number; max: number; source: 'description' | 'additionalRequirements' | 'thresholds'; index?: number } | null => {
    // Check if description indicates open-ended age (e.g., "18 or older")
    const descIsOpenEnded = isOpenEndedAge(node.description);

    // First check thresholds (most authoritative)
    if (node.thresholds?.ageMin !== undefined || node.thresholds?.ageMax !== undefined) {
      let max = node.thresholds.ageMax ?? 150;
      // If thresholds has ageMin == ageMax AND description says "or older", fix to 150
      if (descIsOpenEnded && (max === node.thresholds.ageMin || max === undefined)) {
        max = 150;
      }
      return {
        min: node.thresholds.ageMin ?? 0,
        max,
        source: 'thresholds'
      };
    }

    // Then check description for range (e.g., "age 45-75")
    const descMatch = node.description.match(/(?:age[d]?\s*)?(\d+)\s*[-–to]+\s*(\d+)/i);
    if (descMatch) {
      return { min: parseInt(descMatch[1]), max: parseInt(descMatch[2]), source: 'description' };
    }

    // Check for "X or older" / "X and older" / "X+" patterns (upper bound = 150)
    const olderMatch = node.description.match(/(?:age[d]?\s*)?(\d+)\s*(?:or|and)\s*older/i) ||
                       node.description.match(/(\d+)\s*\+/) ||
                       node.description.match(/(\d+)\s*years\s*of\s*age\s*(?:or|and)\s*older/i);
    if (olderMatch) {
      return { min: parseInt(olderMatch[1]), max: 150, source: 'description' };
    }

    // Check for "X or younger" / "under X" patterns (no lower bound)
    const youngerMatch = node.description.match(/(?:age[d]?\s*)?(\d+)\s*(?:or|and)\s*younger/i) ||
                         node.description.match(/under\s*(\d+)/i);
    if (youngerMatch) {
      return { min: 0, max: parseInt(youngerMatch[1]), source: 'description' };
    }

    // Fallback: "age X at end" or "turns X" patterns
    const turnsMatch = node.description.match(/(?:turns?|age)\s*(\d+)/i);
    if (turnsMatch) {
      const age = parseInt(turnsMatch[1]);
      return { min: age, max: age, source: 'description' };
    }

    // Finally check additionalRequirements
    if (node.additionalRequirements) {
      for (let i = 0; i < node.additionalRequirements.length; i++) {
        const req = node.additionalRequirements[i];
        const reqMatch = req.match(/(?:age[d]?\s*)?(\d+)\s*[-–to]+\s*(\d+)/i);
        if (reqMatch) {
          return { min: parseInt(reqMatch[1]), max: parseInt(reqMatch[2]), source: 'additionalRequirements', index: i };
        }
        // Check "X or older" in requirements
        if (isOpenEndedAge(req)) {
          const reqOlderMatch = req.match(/(\d+)/);
          if (reqOlderMatch) {
            return { min: parseInt(reqOlderMatch[1]), max: 150, source: 'additionalRequirements', index: i };
          }
        }
        // Fallback single age in requirements
        const singleAgeMatch = req.match(/(?:turns?|age)\s*(\d+)/i);
        if (singleAgeMatch) {
          const age = parseInt(singleAgeMatch[1]);
          return { min: age, max: age, source: 'additionalRequirements', index: i };
        }
      }
    }

    return null;
  };

  const ageRange = parseAgeRange();

  // Save handlers
  const saveDescription = () => {
    if (editValue.trim() && editValue !== node?.description) {
      updateDataElement(measureId, nodeId, { description: editValue.trim() }, 'description_changed', 'Edited via inline edit');
    }
    setEditingField(null);
    setEditValue('');
  };

  const saveAgeRange = (min: number, max: number) => {
    if (!ageRange) return;

    // Use global sync to update ALL age references throughout the measure
    // This ensures the measure description, population descriptions, thresholds,
    // and all other age references are kept in sync
    syncAgeRange(measureId, min, max);
    setEditingField(null);
  };

  const saveTiming = (idx: number, newValue: string) => {
    if (!node?.timingRequirements) return;
    const updatedTimings = [...node.timingRequirements];
    updatedTimings[idx] = { ...updatedTimings[idx], description: newValue };
    updateDataElement(measureId, nodeId, { timingRequirements: updatedTimings }, 'timing_changed', 'Edited timing via inline edit');
    setEditTimingIdx(null);
    setEditValue('');
  };

  const saveRequirement = (idx: number, newValue: string) => {
    if (!node?.additionalRequirements) return;
    const updated = [...node.additionalRequirements];
    updated[idx] = newValue;
    updateDataElement(measureId, nodeId, { additionalRequirements: updated }, 'description_changed', 'Edited requirement via inline edit');
    setEditReqIdx(null);
    setEditValue('');
  };

  const removeRequirement = (idx: number) => {
    if (!node?.additionalRequirements) return;
    const updated = node.additionalRequirements.filter((_, i) => i !== idx);
    updateDataElement(measureId, nodeId, { additionalRequirements: updated }, 'element_removed', 'Removed requirement');
  };

  const addRequirement = () => {
    const updated = [...(node?.additionalRequirements || []), 'New requirement'];
    updateDataElement(measureId, nodeId, { additionalRequirements: updated }, 'element_added', 'Added new requirement');
  };

  // Apply pending AI edit
  const handleApplyEdit = (messageIndex: number) => {
    const message = chatHistory[messageIndex];
    if (!message?.pendingEdit?.changes || !node) return;

    const updates = applyAIChanges(node, message.pendingEdit.changes);

    // Handle value set changes separately (need to look up from measure's value sets)
    if (message.pendingEdit.changes.valueSet) {
      const vsChange = message.pendingEdit.changes.valueSet;
      const matchingVS = currentMeasure?.valueSets.find(
        vs => vs.name.toLowerCase() === vsChange.name.toLowerCase() ||
              (vsChange.oid && vs.oid === vsChange.oid)
      );
      if (matchingVS) {
        updates.valueSet = {
          id: matchingVS.id,
          name: matchingVS.name,
          oid: matchingVS.oid,
          codes: matchingVS.codes,
          confidence: matchingVS.confidence,
          totalCodeCount: matchingVS.totalCodeCount,
        };
      }
    }

    updateDataElement(measureId, nodeId, updates, 'description_changed', message.pendingEdit.explanation || 'AI-assisted edit');

    // Mark the edit as applied
    setChatHistory(prev => prev.map((msg, idx) =>
      idx === messageIndex
        ? { ...msg, pendingEdit: undefined, action: 'applied', content: `✓ Changes applied: ${message.pendingEdit?.explanation || 'Edit complete'}` }
        : msg
    ));
  };

  // Dismiss pending AI edit
  const handleDismissEdit = (messageIndex: number) => {
    setChatHistory(prev => prev.map((msg, idx) =>
      idx === messageIndex
        ? { ...msg, pendingEdit: undefined, content: 'Edit dismissed.' }
        : msg
    ));
  };

  // Chat command handling - now with real AI integration
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !node || !nodePopulation || !currentMeasure) return;
    const userMessage = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    // Handle quick commands locally
    const lowerMsg = userMessage.toLowerCase();
    if (lowerMsg === 'help') {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `**AI Assistant Commands:**\n\n• Ask questions about this component\n• Request changes: "Change the age range to 50-75"\n• "Set timing to within 3 years of measurement period end"\n• "Switch to the Preventive Care value set"\n• \`approve\` - Mark as approved\n• \`flag\` - Flag for review\n\nI have full context of the measure and can help edit any field.`
      }]);
      setIsTyping(false);
      return;
    }
    if (lowerMsg.match(/^approve(\s+this)?$/)) {
      updateReviewStatus(measureId, nodeId, 'approved');
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Marked as **approved**.', action: 'approved' }]);
      setIsTyping(false);
      return;
    }
    if (lowerMsg.match(/^flag(\s+.*)?$/)) {
      updateReviewStatus(measureId, nodeId, 'flagged');
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Flagged for engineering review.', action: 'flagged' }]);
      setIsTyping(false);
      return;
    }

    // Build context for AI
    const conversationHistory = chatHistory
      .filter(msg => !msg.pendingEdit && !msg.action)
      .map(msg => ({ role: msg.role, content: msg.content }));

    // Adapt measure to expected type with default measurementPeriod
    const measureForContext = {
      id: currentMeasure.id,
      metadata: {
        measureId: currentMeasure.metadata.measureId,
        title: currentMeasure.metadata.title,
        measurementPeriod: {
          start: currentMeasure.metadata.measurementPeriod?.start || mpStart,
          end: currentMeasure.metadata.measurementPeriod?.end || mpEnd,
        },
      },
      populations: currentMeasure.populations,
      valueSets: currentMeasure.valueSets,
    };

    const context = buildAssistantContext(node, nodePopulation, measureForContext, conversationHistory);

    // Get API configuration
    const apiKey = getActiveApiKey();
    const customConfig = selectedProvider === 'custom' ? getCustomLlmConfig() : undefined;

    try {
      // Call AI
      const response = await handleAIAssistantRequest(
        userMessage,
        context,
        selectedProvider,
        apiKey,
        selectedModel,
        customConfig
      );

      setIsTyping(false);

      if (response.action === 'error') {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ ${response.error}`
        }]);
        return;
      }

      if (response.action === 'edit' && response.changes) {
        // Show edit proposal with Apply/Dismiss buttons
        const changes = response.changes;
        const displayChanges = formatChangesForDisplay(context.currentComponent, changes, mpStart, mpEnd);
        const changesText = displayChanges.map(c => `• **${c.field}:** ${c.from} → ${c.to}`).join('\n');

        setChatHistory(prev => [...prev, {
          role: 'assistant' as const,
          content: `**Proposed changes:**\n\n${changesText}${response.explanation ? `\n\n${response.explanation}` : ''}`,
          pendingEdit: {
            changes: changes as NonNullable<AIAssistantResponse['changes']>,
            explanation: response.explanation,
          }
        }]);
      } else {
        // Answer or clarification
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: response.response || 'I couldn\'t process that request.'
        }]);
      }
    } catch (err) {
      setIsTyping(false);
      console.error('[UMSEditor] AI request failed:', err);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Request failed: ${err instanceof Error ? err.message : String(err)}`
      }]);
    }
  };

  return (
    <div className="w-[450px] border-l border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden">
      <div className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--border)] p-4 flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text)]">Edit Component</h3>
        <button onClick={onClose} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
          <X className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Type & Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] uppercase">
            {node.type}
          </span>
          <ComplexityBadge level={calculateDataElementComplexity(node)} />
          {node.libraryComponentId && (
            <LibraryStatusBadge component={getComponent(node.libraryComponentId) ?? undefined} size="md" />
          )}
        </div>

        {/* Editable Description */}
        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Description</h4>
            {editingField !== 'description' && (
              <button
                onClick={() => { setEditingField('description'); setEditValue(node?.description || ''); }}
                className="p-1 hover:bg-[var(--bg-secondary)] rounded text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {editingField === 'description' ? (
            <div className="space-y-2">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--accent)]/50 rounded-lg text-sm text-[var(--text)] focus:outline-none resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingField(null)} className="px-3 py-1.5 text-xs bg-[var(--bg-secondary)] text-[var(--text-muted)] rounded hover:text-[var(--text)]">
                  Cancel
                </button>
                <button onClick={saveDescription} className="px-3 py-1.5 text-xs bg-[var(--primary)] text-white rounded hover:bg-[var(--primary-hover)]">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text)]">{node.description}</p>
          )}
        </div>

        {/* Editable Age Range (if detected) */}
        {ageRange && (
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Age Range</h4>
              {editingField !== 'ageRange' && (
                <button
                  onClick={() => setEditingField('ageRange')}
                  className="p-1 hover:bg-[var(--bg-secondary)] rounded text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {editingField === 'ageRange' ? (
              <AgeRangeEditor
                min={ageRange.min}
                max={ageRange.max}
                onSave={saveAgeRange}
                onCancel={() => setEditingField(null)}
              />
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-[var(--accent)]">{ageRange.min}</span>
                <span className="text-[var(--text-muted)]">to</span>
                <span className="text-2xl font-bold text-[var(--accent)]">{ageRange.max}</span>
                <span className="text-sm text-[var(--text-muted)]">years old</span>
              </div>
            )}
          </div>
        )}

        {/* Value Sets - clickable, supports multiple */}
        {fullValueSets.length > 0 && (
          <div>
            <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
              {fullValueSets.length > 1 ? `Value Sets (${fullValueSets.length})` : 'Value Set'}
            </h4>
            <div className="space-y-2">
              {fullValueSets.map((vs, idx) => (
                <button
                  key={vs.id || vs.oid || idx}
                  onClick={() => onSelectValueSet(vs)}
                  className="w-full p-3 bg-[var(--bg-tertiary)] rounded-lg hover:border-[var(--accent)]/50 border border-[var(--border)] text-left transition-colors"
                >
                  <div className="font-medium text-[var(--text)] flex items-center gap-2">
                    {vs.name}
                    <ExternalLink className="w-3 h-3 text-[var(--accent)]" />
                  </div>
                  {vs.oid && (
                    <code className="text-xs text-[var(--text-dim)] block mt-1">{vs.oid}</code>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-[var(--accent)]">{vs.codes?.length || 0} codes</span>
                    <span className="text-xs text-[var(--text-dim)]">• Click to edit codes</span>
                  </div>
                </button>
              ))}
            </div>
            {fullValueSets.length > 1 && (
              <div className="mt-2 pt-2 border-t border-[var(--border)]/50 flex justify-between text-xs text-[var(--text-dim)]">
                <span>Total across all value sets</span>
                <span className="text-[var(--accent)]">
                  {fullValueSets.reduce((sum, vs) => sum + (vs.codes?.length || 0), 0)} codes
                </span>
              </div>
            )}
          </div>
        )}

        {/* Structured Timing Requirements */}
        {(() => {
          // Get structured timing window, or try to parse from text
          const timingWindow = node.timingWindow;
          const timingText = node.timingRequirements?.[0]?.description;
          const parsedWindow = timingText ? parseTimingText(timingText) : null;

          // Create a TimingWindowOverride if we only have parsed text
          const effectiveOverride: typeof timingWindow | undefined = timingWindow ?? (parsedWindow ? {
            original: parsedWindow,
            modified: null,
            sourceText: timingText || '',
            modifiedAt: null,
            modifiedBy: null,
          } : undefined);

          if (!effectiveOverride && !timingText) return null;

          return (
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]">
              <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Timing Requirements</h4>

              {editingTimingWindow && effectiveOverride ? (
                <TimingWindowEditor
                  window={effectiveOverride}
                  mpStart={mpStart}
                  mpEnd={mpEnd}
                  onSave={(modified) => {
                    onSaveTimingWindow(node.id, modified);
                    setEditingTimingWindow(false);
                  }}
                  onCancel={() => setEditingTimingWindow(false)}
                  onReset={() => {
                    onResetTimingWindow(node.id);
                    setEditingTimingWindow(false);
                  }}
                />
              ) : effectiveOverride ? (
                <div className="p-2 bg-[var(--bg-secondary)] rounded">
                  <TimingWindowLabel
                    window={effectiveOverride}
                    mpStart={mpStart}
                    mpEnd={mpEnd}
                    onClick={() => setEditingTimingWindow(true)}
                  />
                </div>
              ) : timingText ? (
                <div className="p-2 bg-[var(--bg-secondary)] rounded">
                  <span className="text-sm text-[var(--text-muted)] italic">
                    {timingText}
                  </span>
                  <div className="text-xs text-[var(--text-dim)] mt-1">
                    Unable to parse timing - showing original text
                  </div>
                </div>
              ) : null}
            </div>
          );
        })()}

        {/* Editable Additional Requirements */}
        {(node.additionalRequirements && node.additionalRequirements.length > 0) && (
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Additional Requirements</h4>
              <button
                onClick={addRequirement}
                className="p-1 hover:bg-[var(--bg-secondary)] rounded text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
                title="Add requirement"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <ul className="space-y-2">
              {node.additionalRequirements.map((req, i) => (
                <li key={i} className="group">
                  {editReqIdx === i ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--accent)]/50 rounded-lg text-sm text-[var(--text)] focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && saveRequirement(i, editValue)}
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditReqIdx(null)} className="px-3 py-1.5 text-xs bg-[var(--bg-secondary)] text-[var(--text-muted)] rounded">Cancel</button>
                        <button onClick={() => saveRequirement(i, editValue)} className="px-3 py-1.5 text-xs bg-[var(--primary)] text-white rounded">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 p-2 bg-[var(--bg-secondary)] rounded group">
                      <span className="text-[var(--accent)] mt-0.5">•</span>
                      <span className="flex-1 text-sm text-[var(--text-muted)]">{req}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditReqIdx(i); setEditValue(req); }}
                          className="p-1 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-dim)] hover:text-[var(--accent)]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeRequirement(i)}
                          className="p-1 hover:bg-[var(--danger-light)] rounded text-[var(--text-dim)] hover:text-[var(--danger)]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => updateReviewStatus(measureId, node!.id, node.reviewStatus === 'approved' ? 'pending' : 'approved')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              node.reviewStatus === 'approved'
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-[var(--success-light)] text-[var(--success)] hover:opacity-80'
            }`}
          >
            <CheckCircle className={`w-4 h-4 ${node.reviewStatus === 'approved' ? 'fill-white/30' : ''}`} />
            {node.reviewStatus === 'approved' ? 'Approved' : 'Approve'}
          </button>
          <button
            onClick={() => updateReviewStatus(measureId, node!.id, node.reviewStatus === 'needs_revision' ? 'pending' : 'needs_revision')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              node.reviewStatus === 'needs_revision'
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-[var(--warning-light)] text-[var(--warning)] hover:opacity-80'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${node.reviewStatus === 'needs_revision' ? 'fill-white/30' : ''}`} />
            {node.reviewStatus === 'needs_revision' ? 'Flagged' : 'Flag'}
          </button>
        </div>
      </div>

      {/* AI Chat Section */}
      <div className="border-t border-[var(--border)] bg-[var(--bg-tertiary)]">
        <div className="p-3 border-b border-[var(--border)]">
          <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Bot className="w-3.5 h-3.5" />
            Ask questions, or request component changes
          </h4>
        </div>

        {/* Chat messages */}
        <div className="h-48 overflow-auto p-3 space-y-3">
          {chatHistory.length === 0 && (
            <p className="text-xs text-[var(--text-dim)] text-center py-4">
              Type <span className="text-[var(--accent)] font-mono">help</span> for commands, or ask a question.
            </p>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.action === 'applied' ? 'bg-[var(--success-light)]' :
                  msg.pendingEdit ? 'bg-[var(--warning-light)]' :
                  msg.action ? 'bg-[var(--success-light)]' : 'bg-[var(--accent-light)]'
                }`}>
                  {msg.action === 'applied' ? (
                    <CheckCircle className="w-3.5 h-3.5 text-[var(--success)]" />
                  ) : msg.pendingEdit ? (
                    <Sparkles className="w-3.5 h-3.5 text-[var(--warning)]" />
                  ) : msg.action ? (
                    <CheckCircle className="w-3.5 h-3.5 text-[var(--success)]" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-[var(--accent)]" />
                  )}
                </div>
              )}
              <div className={`max-w-[85%] p-2 rounded-lg text-sm ${
                msg.role === 'user'
                  ? 'bg-[var(--accent-light)] text-[var(--text)]'
                  : msg.pendingEdit
                    ? 'bg-[var(--warning-light)] border border-[var(--warning)]/30 text-[var(--text)]'
                    : msg.action
                      ? 'bg-[var(--success-light)] border border-[var(--success)]/20 text-[var(--text)]'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.pendingEdit && (
                  <div className="flex gap-2 mt-2 pt-2 border-t border-[var(--warning)]/20">
                    <button
                      onClick={() => handleApplyEdit(i)}
                      className="flex-1 px-3 py-1.5 bg-[var(--success)] text-white text-xs font-medium rounded hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Apply Changes
                    </button>
                    <button
                      onClick={() => handleDismissEdit(i)}
                      className="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs font-medium rounded hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                {msg.action && !msg.pendingEdit && (
                  <p className="text-[10px] text-[var(--success)] mt-1 flex items-center gap-1">
                    <History className="w-3 h-3" /> {msg.action === 'applied' ? 'Changes applied' : 'Tracked for AI training'}
                  </p>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-[var(--accent-light)] flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 text-[var(--accent)] animate-spin" />
              </div>
              <div className="bg-[var(--bg-secondary)] p-2 rounded-lg">
                <span className="text-sm text-[var(--text-muted)]">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="p-3 border-t border-[var(--border)]">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask a question or describe a change..."
              className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]/50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || isTyping}
              className="px-3 py-2 bg-[var(--accent-light)] text-[var(--accent)] rounded-lg hover:bg-[var(--accent)]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ValueSetModal({ valueSet, measureId, onClose }: { valueSet: ValueSetReference; measureId: string; onClose: () => void }) {
  const { addCodeToValueSet, removeCodeFromValueSet, getCorrections, updateMeasure, measures } = useMeasureStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState({ code: '', display: '', system: 'ICD10' as CodeSystem });
  const [showHistory, setShowHistory] = useState(false);
  const [editingCodeIdx, setEditingCodeIdx] = useState<number | null>(null);
  const [editCode, setEditCode] = useState({ code: '', display: '', system: 'ICD10' as CodeSystem });

  // Get corrections related to this value set
  const corrections = getCorrections(measureId).filter(c => c.componentId === valueSet.id);

  // Re-fetch the value set from the store to get updated codes
  const measure = measures.find(m => m.id === measureId);
  const currentValueSet = measure?.valueSets.find(vs => vs.id === valueSet.id) || valueSet;

  const handleAddCode = () => {
    if (!newCode.code.trim() || !newCode.display.trim()) return;

    addCodeToValueSet(measureId, valueSet.id, {
      code: newCode.code.trim(),
      display: newCode.display.trim(),
      system: newCode.system,
    }, 'User added code manually');

    setNewCode({ code: '', display: '', system: 'ICD10' });
    setShowAddForm(false);
  };

  const handleRemoveCode = (codeValue: string) => {
    if (confirm(`Remove code "${codeValue}" from this value set?`)) {
      removeCodeFromValueSet(measureId, valueSet.id, codeValue, 'User removed code manually');
    }
  };

  const handleEditCode = (idx: number) => {
    const code = currentValueSet.codes?.[idx];
    if (code) {
      setEditingCodeIdx(idx);
      setEditCode({ code: code.code, display: code.display, system: code.system });
    }
  };

  const handleSaveEditCode = () => {
    if (editingCodeIdx === null || !measure) return;

    const updatedCodes = [...(currentValueSet.codes || [])];
    updatedCodes[editingCodeIdx] = {
      code: editCode.code.trim(),
      display: editCode.display.trim(),
      system: editCode.system,
    };

    // Update the value set in the measure
    const updatedValueSets = measure.valueSets.map(vs =>
      vs.id === valueSet.id ? { ...vs, codes: updatedCodes } : vs
    );

    updateMeasure(measureId, { valueSets: updatedValueSets });
    setEditingCodeIdx(null);
    setEditCode({ code: '', display: '', system: 'ICD10' });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[min(900px,90vw)] max-h-[85vh] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-[var(--text)]">{currentValueSet.name}</h2>
              {currentValueSet.verified && (
                <span className="px-2 py-0.5 text-xs bg-[var(--success-light)] text-[var(--success)] rounded">VSAC Verified</span>
              )}
              {corrections.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-purple-500/15 text-purple-400 rounded flex items-center gap-1">
                  <History className="w-3 h-3" />
                  {corrections.length} edit{corrections.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {currentValueSet.oid && (
              <code className="text-sm text-[var(--text-muted)]">{currentValueSet.oid}</code>
            )}
            <div className="text-xs text-[var(--text-dim)] mt-1">
              {currentValueSet.source} {currentValueSet.version && `• Version ${currentValueSet.version}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {corrections.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-purple-500/15 text-purple-400' : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}
                title="View edit history"
              >
                <History className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        {/* Edit history panel */}
        {showHistory && corrections.length > 0 && (
          <div className="p-4 bg-purple-500/5 border-b border-purple-500/20">
            <h3 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-2">
              <History className="w-4 h-4" />
              Edit History (for AI training)
            </h3>
            <div className="space-y-2 max-h-32 overflow-auto">
              {corrections.map((c) => (
                <div key={c.id} className="text-xs p-2 bg-[var(--bg-tertiary)] rounded flex items-start justify-between">
                  <div>
                    <span className={`font-medium ${c.correctionType === 'code_added' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                      {c.correctionType === 'code_added' ? '+ Added' : '- Removed'}
                    </span>
                    <span className="text-[var(--text-muted)] ml-2">
                      {c.correctionType === 'code_added'
                        ? `${(c.correctedValue as CodeReference[])?.slice(-1)[0]?.code || 'code'}`
                        : `${(c.originalValue as CodeReference)?.code || 'code'}`
                      }
                    </span>
                  </div>
                  <span className="text-[var(--text-dim)]">{new Date(c.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add code form */}
        {showAddForm && (
          <div className="p-4 bg-[var(--accent-light)] border-b border-[var(--accent)]/20">
            <h3 className="text-sm font-medium text-[var(--accent)] mb-3">Add New Code</h3>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs text-[var(--text-muted)] block mb-1">Code</label>
                <input
                  type="text"
                  value={newCode.code}
                  onChange={(e) => setNewCode({ ...newCode, code: e.target.value })}
                  placeholder="e.g., I10.1"
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]/50"
                />
              </div>
              <div className="flex-[2]">
                <label className="text-xs text-[var(--text-muted)] block mb-1">Display Name</label>
                <input
                  type="text"
                  value={newCode.display}
                  onChange={(e) => setNewCode({ ...newCode, display: e.target.value })}
                  placeholder="e.g., Benign essential hypertension"
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]/50"
                />
              </div>
              <div className="w-32">
                <label className="text-xs text-[var(--text-muted)] block mb-1">System</label>
                <select
                  value={newCode.system}
                  onChange={(e) => setNewCode({ ...newCode, system: e.target.value as CodeSystem })}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]/50"
                >
                  <option value="ICD10">ICD-10</option>
                  <option value="SNOMED">SNOMED</option>
                  <option value="CPT">CPT</option>
                  <option value="HCPCS">HCPCS</option>
                  <option value="LOINC">LOINC</option>
                  <option value="RxNorm">RxNorm</option>
                  <option value="CVX">CVX</option>
                </select>
              </div>
              <button
                onClick={handleAddCode}
                disabled={!newCode.code.trim() || !newCode.display.trim()}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded-lg text-sm hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-tertiary)]">
          <div className="text-sm text-[var(--text-muted)]">
            {currentValueSet.codes?.length || 0} codes
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-lg text-sm font-medium hover:bg-[var(--accent)]/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Code
          </button>
        </div>

        {/* Codes table */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--bg-secondary)]">
              <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="pb-2 pr-4 font-medium">Code</th>
                <th className="pb-2 pr-4 font-medium">Display Name</th>
                <th className="pb-2 pr-4 font-medium">System</th>
                <th className="pb-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {currentValueSet.codes && currentValueSet.codes.length > 0 ? (
                currentValueSet.codes.map((code, i) => (
                  editingCodeIdx === i ? (
                    <tr key={`edit-${i}`} className="border-b border-[var(--accent)]/30 bg-[var(--accent-light)]">
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={editCode.code}
                          onChange={(e) => setEditCode({ ...editCode, code: e.target.value })}
                          className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--accent)]/50 rounded text-sm text-[var(--accent)] font-mono focus:outline-none"
                          autoFocus
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={editCode.display}
                          onChange={(e) => setEditCode({ ...editCode, display: e.target.value })}
                          className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--accent)]/50 rounded text-sm text-[var(--text)] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          value={editCode.system}
                          onChange={(e) => setEditCode({ ...editCode, system: e.target.value as CodeSystem })}
                          className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--accent)]/50 rounded text-sm text-[var(--text)] focus:outline-none"
                        >
                          <option value="ICD10">ICD-10</option>
                          <option value="SNOMED">SNOMED</option>
                          <option value="CPT">CPT</option>
                          <option value="HCPCS">HCPCS</option>
                          <option value="LOINC">LOINC</option>
                          <option value="RxNorm">RxNorm</option>
                          <option value="CVX">CVX</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={handleSaveEditCode}
                            className="p-1.5 text-[var(--success)] hover:bg-[var(--success-light)] rounded"
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingCodeIdx(null)}
                            className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)] rounded"
                            title="Cancel"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={`${code.code}-${i}`} className="border-b border-[var(--border-light)] group hover:bg-[var(--bg-tertiary)]">
                      <td className="py-2 pr-4">
                        <code className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--accent)]">
                          {code.code}
                        </code>
                      </td>
                      <td className="py-2 pr-4 text-[var(--text)]">{code.display}</td>
                      <td className="py-2 pr-4 text-[var(--text-muted)]">{code.system}</td>
                      <td className="py-2">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => handleEditCode(i)}
                            className="p-1.5 text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] rounded"
                            title="Edit code"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveCode(code.code)}
                            className="p-1.5 text-[var(--text-dim)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] rounded"
                            title="Remove code"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[var(--text-muted)]">
                    No codes in this value set. Click "Add Code" to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {currentValueSet.totalCodeCount && currentValueSet.codes && currentValueSet.totalCodeCount > currentValueSet.codes.length && (
            <p className="mt-4 text-sm text-[var(--text-muted)] text-center">
              Showing {currentValueSet.codes.length} of {currentValueSet.totalCodeCount} codes.
              <button className="text-[var(--accent)] hover:underline ml-1">Load all codes</button>
            </p>
          )}
        </div>

        {/* Footer with training info */}
        <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-tertiary)] text-xs text-[var(--text-dim)] flex items-center justify-between">
          <span>All edits are tracked for AI training feedback</span>
          {corrections.length > 0 && (
            <button className="flex items-center gap-1 text-purple-400 hover:text-purple-300">
              <Download className="w-3 h-3" />
              Export corrections
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Standard Value Set Browser modal
function StandardValueSetBrowser({
  measureId: _measureId,
  existingOids,
  onImport,
  onClose,
}: {
  measureId: string;
  existingOids: Set<string>;
  onImport: (vs: StandardValueSet) => void;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVS, setSelectedVS] = useState<StandardValueSet | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'screening' | 'exclusion'>('all');

  const allValueSets = getAllStandardValueSets();

  // Filter value sets
  const filteredValueSets = searchQuery
    ? searchStandardValueSets(searchQuery)
    : allValueSets.filter(vs => {
        if (categoryFilter === 'all') return true;
        if (categoryFilter === 'screening') {
          return ['colonoscopy', 'fobt', 'fit-dna', 'flexible-sigmoidoscopy', 'ct-colonography'].includes(vs.id);
        }
        if (categoryFilter === 'exclusion') {
          return ['colorectal-cancer', 'total-colectomy', 'hospice-care', 'frailty', 'dementia'].includes(vs.id);
        }
        return true;
      });

  const handleImport = (vs: StandardValueSet) => {
    onImport(vs);
    // Keep modal open for more imports
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[min(1100px,95vw)] h-[85vh] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
              <LibraryIcon className="w-5 h-5 text-[var(--accent)]" />
              Standard Value Set Library
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Browse and import VSAC-published value sets with complete code lists
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Search and filters */}
        <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, OID, or code..."
                className="w-full pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  categoryFilter === 'all'
                    ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setCategoryFilter('screening')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  categoryFilter === 'screening'
                    ? 'bg-[var(--success-light)] text-[var(--success)]'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Screening
              </button>
              <button
                onClick={() => setCategoryFilter('exclusion')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  categoryFilter === 'exclusion'
                    ? 'bg-[var(--danger-light)] text-[var(--danger)]'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Exclusions
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Value set list */}
          <div className="w-1/2 border-r border-[var(--border)] overflow-auto p-4 space-y-2">
            {filteredValueSets.map((vs) => {
              const isImported = existingOids.has(vs.oid);
              return (
                <button
                  key={vs.id}
                  onClick={() => setSelectedVS(vs)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    selectedVS?.id === vs.id
                      ? 'bg-[var(--accent-light)] border-[var(--accent)]/50'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border)] hover:border-[var(--text-dim)]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text)] flex items-center gap-2">
                        {vs.name}
                        {isImported && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-[var(--success-light)] text-[var(--success)] rounded">
                            Imported
                          </span>
                        )}
                      </div>
                      <code className="text-xs text-[var(--text-dim)] mt-1 block">{vs.oid}</code>
                      <div className="text-xs text-[var(--accent)] mt-1">
                        {vs.codes.length} codes
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredValueSets.length === 0 && (
              <div className="text-center py-8 text-[var(--text-muted)]">
                No value sets found matching your search.
              </div>
            )}
          </div>

          {/* Value set detail */}
          <div className="w-1/2 overflow-auto">
            {selectedVS ? (
              <div className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text)]">{selectedVS.name}</h3>
                    <code className="text-sm text-[var(--text-muted)]">{selectedVS.oid}</code>
                  </div>
                  <button
                    onClick={() => handleImport(selectedVS)}
                    disabled={existingOids.has(selectedVS.oid)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                      existingOids.has(selectedVS.oid)
                        ? 'bg-[var(--success-light)] text-[var(--success)] cursor-not-allowed'
                        : 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                    }`}
                  >
                    {existingOids.has(selectedVS.oid) ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Already Imported
                      </>
                    ) : (
                      <>
                        <Import className="w-4 h-4" />
                        Import to Measure
                      </>
                    )}
                  </button>
                </div>

                <div className="mb-4 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Codes by System</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(
                      selectedVS.codes.reduce((acc, c) => {
                        const system = c.system.split('/').pop() || c.system;
                        acc[system] = (acc[system] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([system, count]) => (
                      <span key={system} className="px-2 py-1 text-xs bg-[var(--bg-secondary)] text-[var(--text-muted)] rounded">
                        {system}: {count}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Code list */}
                <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--bg-tertiary)]">
                      <tr className="text-left text-[var(--text-muted)]">
                        <th className="px-3 py-2 font-medium">Code</th>
                        <th className="px-3 py-2 font-medium">Display</th>
                        <th className="px-3 py-2 font-medium">System</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVS.codes.map((code, i) => (
                        <tr key={i} className="border-t border-[var(--border-light)]">
                          <td className="px-3 py-2">
                            <code className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--accent)] text-xs">
                              {code.code}
                            </code>
                          </td>
                          <td className="px-3 py-2 text-[var(--text)]">{code.display}</td>
                          <td className="px-3 py-2 text-[var(--text-muted)] text-xs">
                            {code.system.split('/').pop()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                <div className="text-center">
                  <LibraryIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Select a value set to view its codes</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-tertiary)] text-xs text-[var(--text-dim)]">
          Standard value sets sourced from VSAC (Value Set Authority Center). OIDs reference authoritative published definitions.
        </div>
      </div>
    </div>
  );
}

// Age range editor with number inputs
function AgeRangeEditor({ min, max, onSave, onCancel }: { min: number; max: number; onSave: (min: number, max: number) => void; onCancel: () => void }) {
  const [minAge, setMinAge] = useState(min);
  const [maxAge, setMaxAge] = useState(max);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs text-[var(--text-muted)] block mb-1">Min Age</label>
          <input
            type="number"
            value={minAge}
            onChange={(e) => setMinAge(parseInt(e.target.value) || 0)}
            min={0}
            max={120}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--accent)]/50 rounded-lg text-lg font-bold text-[var(--accent)] focus:outline-none text-center"
          />
        </div>
        <span className="text-[var(--text-muted)] mt-5">to</span>
        <div className="flex-1">
          <label className="text-xs text-[var(--text-muted)] block mb-1">Max Age</label>
          <input
            type="number"
            value={maxAge}
            onChange={(e) => setMaxAge(parseInt(e.target.value) || 0)}
            min={0}
            max={120}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--accent)]/50 rounded-lg text-lg font-bold text-[var(--accent)] focus:outline-none text-center"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs bg-[var(--bg-secondary)] text-[var(--text-muted)] rounded hover:text-[var(--text)]">
          Cancel
        </button>
        <button onClick={() => onSave(minAge, maxAge)} className="px-3 py-1.5 text-xs bg-[var(--primary)] text-white rounded hover:bg-[var(--primary-hover)]">
          Save
        </button>
      </div>
    </div>
  );
}

function ComplexityBadge({ level, size = 'md' }: { level: ComplexityLevel; size?: 'sm' | 'md' }) {
  const colors: Record<ComplexityLevel, string> = {
    low: 'bg-[var(--success-light)] text-[var(--success)] border-[var(--success)]/30',
    medium: 'bg-[var(--warning-light)] text-[var(--warning)] border-[var(--warning)]/30',
    high: 'bg-[var(--danger-light)] text-[var(--danger)] border-[var(--danger)]/30',
  };

  const dots: Record<ComplexityLevel, string> = {
    low: '\u25CB',
    medium: '\u25CF\u25CF',
    high: '\u25CF\u25CF\u25CF',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${colors[level]} ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>
      <span>{dots[level]}</span>
      {level}
    </span>
  );
}

function LibraryStatusBadge({ component, size = 'sm' }: { component: LibraryComponent | undefined; size?: 'sm' | 'md' }) {
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  if (!component) {
    // Fallback: linked but component not found in library
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${textSize} bg-[var(--accent-light)] text-[var(--accent)] border-[var(--accent)]/30`} title="Linked to component library">
        <Link className={iconSize} />
        Library
      </span>
    );
  }

  const isApproved = component.versionInfo.status === 'approved';
  const usageCount = component.usage?.usageCount ?? component.usage?.measureIds?.length ?? 0;
  const isWidelyUsed = usageCount >= 3;

  if (isApproved && isWidelyUsed) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${textSize} bg-[var(--success-light)] text-[var(--success)] border-[var(--success)]/30`}
        title={`${component.name} — Approved and used in ${usageCount} measures`}
      >
        <ShieldCheck className={iconSize} />
        Verified · Used in {usageCount} measures
      </span>
    );
  }

  if (isApproved) {
    const usageLabel = usageCount === 1 ? '1 measure' : `${usageCount} measures`;
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${textSize} bg-[var(--accent-light)] text-[var(--accent)] border-[var(--accent)]/30`}
        title={`${component.name} — Approved, used in ${usageLabel}`}
      >
        <CheckCircle className={iconSize} />
        Approved · Used in {usageLabel}
      </span>
    );
  }

  // Draft or pending
  const statusLabel = component.versionInfo.status === 'pending_review' ? 'Pending' : 'Draft';
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${textSize} bg-[var(--bg-tertiary)] text-[var(--text-dim)] border-[var(--border)]`}
      title={`${component.name} — ${statusLabel}`}
    >
      <Link className={iconSize} />
      Library · {statusLabel}
    </span>
  );
}

function ComponentLibraryIndicator({ component }: { component: LibraryComponent }) {
  const isApproved = component.versionInfo.status === 'approved';
  const usageCount = component.usage?.usageCount ?? component.usage?.measureIds?.length ?? 0;
  const isShared = usageCount > 1;

  // Get value sets info for atomic components
  const valueSets = component.type === 'atomic'
    ? (component.valueSets || [component.valueSet])
    : [];
  const hasMultipleValueSets = valueSets.length > 1;
  const totalCodes = valueSets.reduce((sum, vs) => sum + (vs.codes?.length || 0), 0);

  // Don't show if not linked to library
  if (!component) return null;

  return (
    <div
      className={`mt-2 px-2.5 py-2 rounded-lg border transition-all ${
        isApproved
          ? 'bg-[var(--success)]/5 border-[var(--success)]/20'
          : 'bg-[var(--bg-secondary)] border-[var(--border)]'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Library link icon */}
        <div className={`flex-shrink-0 p-1.5 rounded-full ${
          isApproved ? 'bg-[var(--success)]/10' : 'bg-[var(--bg-tertiary)]'
        }`}>
          {isApproved ? (
            <ShieldCheck className={`w-4 h-4 ${isApproved ? 'text-[var(--success)]' : 'text-[var(--text-dim)]'}`} />
          ) : (
            <Link className="w-4 h-4 text-[var(--text-dim)]" />
          )}
        </div>

        {/* Component info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${isApproved ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
              {isApproved ? 'Approved Component' : 'Draft Component'}
            </span>
            {isShared && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
                Shared
              </span>
            )}
            {hasMultipleValueSets && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">
                {valueSets.length} Value Sets
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-dim)] truncate" title={component.name}>
            {component.name}
          </p>
        </div>

        {/* Usage count */}
        {usageCount > 0 && (
          <div className="flex-shrink-0 text-right">
            <div className={`text-sm font-semibold ${isShared ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
              {usageCount}
            </div>
            <div className="text-[10px] text-[var(--text-dim)]">
              {usageCount === 1 ? 'measure' : 'measures'}
            </div>
          </div>
        )}
      </div>

      {/* Multiple value sets detail */}
      {hasMultipleValueSets && (
        <div className="mt-2 pt-2 border-t border-[var(--border)]/50">
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Combined Value Sets</div>
          <div className="flex flex-wrap gap-1">
            {valueSets.map((vs, i) => (
              <span
                key={vs.oid || i}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                title={vs.oid}
              >
                {vs.name} ({vs.codes?.length || 0})
              </span>
            ))}
          </div>
          <div className="mt-1 text-[10px] text-[var(--text-dim)]">
            Total: {totalCodes} codes
          </div>
        </div>
      )}
    </div>
  );
}
