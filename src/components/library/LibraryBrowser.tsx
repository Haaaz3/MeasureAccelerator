import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  Filter,
  Plus,
  Layers,
  ChevronRight,
  Package,
  Atom,
  GitBranch,
  Tag,
  CheckCircle,
  Clock,
  FileEdit,
  Archive,
  Users,
  ChevronDown,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
} from 'lucide-react';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore';
import { useMeasureStore } from '../../stores/measureStore';
import { getComplexityColor, getComplexityDots } from '../../services/complexityCalculator';
import type {
  ComponentCategory,
  ApprovalStatus,
  ComplexityLevel,
  LibraryComponent,
  LibrarySortField,
  MeasureProgram,
} from '../../types/componentLibrary';
import { ComponentDetail } from './ComponentDetail';
import ComponentEditor from './ComponentEditor';
import { ErrorBoundary } from '../shared/ErrorBoundary';

const CATEGORIES: { key: ComponentCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All Components' },
  { key: 'demographics', label: 'Demographics' },
  { key: 'encounters', label: 'Encounters' },
  { key: 'conditions', label: 'Conditions' },
  { key: 'procedures', label: 'Procedures' },
  { key: 'medications', label: 'Medications' },
  { key: 'assessments', label: 'Assessments' },
  { key: 'laboratory', label: 'Laboratory' },
  { key: 'clinical-observations', label: 'Clinical Observations' },
  { key: 'exclusions', label: 'Exclusions' },
];

const STATUS_OPTIONS: { value: ApprovalStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'archived', label: 'Archived' },
];

const COMPLEXITY_OPTIONS: { value: ComplexityLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const SORT_OPTIONS: { value: LibrarySortField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'complexity', label: 'Complexity' },
  { value: 'usage', label: 'Usage Count' },
  { value: 'status', label: 'Status' },
  { value: 'date', label: 'Date Added' },
];

const PROGRAM_OPTIONS: { value: MeasureProgram; label: string }[] = [
  { value: 'MIPS_CQM', label: 'MIPS CQM' },
  { value: 'eCQM', label: 'eCQM' },
  { value: 'HEDIS', label: 'HEDIS' },
  { value: 'QOF', label: 'QOF' },
  { value: 'Registry', label: 'Registry' },
  { value: 'Custom', label: 'Custom' },
];


function getStatusBadge(status: ApprovalStatus) {
  switch (status) {
    case 'approved':
      return {
        color: 'bg-[var(--success-light)] text-[var(--success)]',
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'Approved',
      };
    case 'pending_review':
      return {
        color: 'bg-[var(--warning-light)] text-[var(--warning)]',
        icon: <Clock className="w-3 h-3" />,
        label: 'Pending',
      };
    case 'draft':
      return {
        color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
        icon: <FileEdit className="w-3 h-3" />,
        label: 'Draft',
      };
    case 'archived':
      return {
        color: 'bg-[var(--bg-tertiary)] text-[var(--text-dim)]',
        icon: <Archive className="w-3 h-3" />,
        label: 'Archived',
      };
    default:
      return {
        color: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
        icon: null,
        label: status,
      };
  }
}

export function LibraryBrowser() {
  const {
    components,
    selectedComponentId,
    editingComponentId,
    filters,
    setSelectedComponent,
    setEditingComponent,
    setFilters,
    getCategoryCounts,
    getFilteredComponents,
    initializeWithSampleData,
    rebuildUsageIndex,
  } = useComponentLibraryStore();
  const { measures } = useMeasureStore();

  const [selectedCategory, setSelectedCategory] = useState<ComponentCategory | 'all'>('all');

  // Seed sample data on mount if store is empty, then rebuild usage index from actual measures
  useEffect(() => {
    if (components.length === 0) {
      initializeWithSampleData();
    }
    // Always rebuild usage index from actual measures to keep counts accurate
    rebuildUsageIndex(measures);
  }, [measures.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync category selection into filters
  useEffect(() => {
    setFilters({
      category: selectedCategory === 'all' ? undefined : selectedCategory,
    });
  }, [selectedCategory, setFilters]);

  const categoryCounts = useMemo(() => getCategoryCounts(), [components, getCategoryCounts]);
  const filteredComponents = useMemo(() => getFilteredComponents(), [components, filters, getFilteredComponents]);

  const totalCount = components.length;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ searchQuery: e.target.value });
  };

  const handleStatusToggle = (status: ApprovalStatus) => {
    const current = filters.statuses ?? [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    setFilters({ statuses: next.length > 0 ? next : undefined });
  };

  const handleComplexityToggle = (level: ComplexityLevel) => {
    const current = filters.complexities ?? [];
    const next = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    setFilters({ complexities: next.length > 0 ? next : undefined });
  };

  const handleUsageSortToggle = () => {
    const current = filters.usageSort;
    // Cycle: none → desc → asc → none
    const next = current === undefined ? 'desc' : current === 'desc' ? 'asc' : undefined;
    setFilters({ usageSort: next });
  };

  const handleSortByChange = (sortBy: LibrarySortField) => {
    setFilters({ sortBy, usageSort: undefined }); // Clear legacy usageSort when using new sort
  };

  const handleSortDirectionToggle = () => {
    const current = filters.sortDirection ?? 'asc';
    setFilters({ sortDirection: current === 'asc' ? 'desc' : 'asc' });
  };

  const handleProgramToggle = (program: MeasureProgram) => {
    const current = filters.programs ?? [];
    const next = current.includes(program)
      ? current.filter((p) => p !== program)
      : [...current, program];
    setFilters({ programs: next.length > 0 ? next : undefined });
  };

  // Compute available programs from actual measures
  const availablePrograms = useMemo(() => {
    const programs = new Set<MeasureProgram>();
    measures.forEach((m) => {
      if (m.metadata.program) {
        programs.add(m.metadata.program as MeasureProgram);
      }
    });
    return Array.from(programs).sort();
  }, [measures]);

  // Apply program filter locally since it requires measure lookup
  const programFilteredComponents = useMemo(() => {
    if (!filters.programs || filters.programs.length === 0) {
      return filteredComponents;
    }
    const measureMap = new Map(measures.map(m => [m.id, m]));
    return filteredComponents.filter((c) => {
      const componentPrograms = c.usage.measureIds
        .map(id => measureMap.get(id)?.metadata?.program)
        .filter(Boolean);
      return componentPrograms.some(prog => filters.programs!.includes(prog as MeasureProgram));
    });
  }, [filteredComponents, filters.programs, measures]);

  const handleNewComponent = () => {
    setEditingComponent('new');
  };

  const handleCardClick = (componentId: string) => {
    setSelectedComponent(componentId);
  };

  const handleCloseDetail = () => {
    setSelectedComponent(null);
  };

  const handleCloseEditor = () => {
    setEditingComponent(null);
  };

  // Resizable panel state
  const [detailPanelWidth, setDetailPanelWidth] = useState(420);
  const isResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      setDetailPanelWidth(Math.min(Math.max(newWidth, 300), 600));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border)] px-6 py-5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text)] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--accent)]" />
              Component Library
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Reusable measure logic blocks
            </p>
          </div>
          <button
            onClick={handleNewComponent}
            className="h-10 px-4 bg-[var(--primary)] text-white rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Component
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Category Sidebar */}
        <div className="w-56 flex-shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border)] overflow-y-auto">
          <div className="p-3">
            <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider px-3 py-2">
              Categories
            </p>
            <nav className="space-y-0.5">
              {CATEGORIES.map(({ key, label }) => {
                const count =
                  key === 'all'
                    ? totalCount
                    : categoryCounts[key as ComponentCategory] ?? 0;
                const isActive = selectedCategory === key;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-[var(--accent-light)] text-[var(--accent)] font-medium'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    <span
                      className={`ml-2 flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-dim)]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter Bar */}
          <div className="flex-shrink-0 px-6 py-3 bg-[var(--bg)] border-b border-[var(--border)] flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
              <input
                type="text"
                placeholder="Search components..."
                value={filters.searchQuery ?? ''}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            {/* Status Multiselect */}
            <MultiSelectDropdown
              icon={<Filter className="w-3.5 h-3.5" />}
              label="Status"
              options={STATUS_OPTIONS}
              selected={filters.statuses ?? []}
              onToggle={handleStatusToggle}
            />

            {/* Complexity Multiselect */}
            <MultiSelectDropdown
              icon={null}
              label="Complexity"
              options={COMPLEXITY_OPTIONS}
              selected={filters.complexities ?? []}
              onToggle={handleComplexityToggle}
            />

            {/* Program/Catalogue Multiselect */}
            {availablePrograms.length > 0 && (
              <MultiSelectDropdown
                icon={<Building2 className="w-3.5 h-3.5" />}
                label="Program"
                options={PROGRAM_OPTIONS.filter(p => availablePrograms.includes(p.value))}
                selected={filters.programs ?? []}
                onToggle={handleProgramToggle}
              />
            )}

            {/* Sort By Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-dim)]">Sort:</span>
              <select
                value={filters.sortBy ?? 'name'}
                onChange={(e) => handleSortByChange(e.target.value as LibrarySortField)}
                className="px-2 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSortDirectionToggle}
                className="p-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                title={filters.sortDirection === 'desc' ? 'Descending' : 'Ascending'}
              >
                {filters.sortDirection === 'desc' ? (
                  <ArrowDown className="w-4 h-4" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Result Count */}
            <span className="text-xs text-[var(--text-dim)] ml-auto">
              {programFilteredComponents.length} component{programFilteredComponents.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Component Grid + Detail Panel */}
          <div ref={containerRef} className="flex-1 flex overflow-hidden">
            {/* Cards Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {programFilteredComponents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {programFilteredComponents.map((component) => (
                    <ComponentCard
                      key={component.id}
                      component={component}
                      isSelected={selectedComponentId === component.id}
                      onClick={() => handleCardClick(component.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Package className="w-16 h-16 text-[var(--text-dim)] opacity-30 mb-4" />
                  <p className="text-[var(--text-muted)] font-medium">
                    No components found
                  </p>
                  <p className="text-sm text-[var(--text-dim)] mt-1">
                    {components.length > 0
                      ? 'Try adjusting your search or filters'
                      : 'Create a new component to get started'}
                  </p>
                  {components.length === 0 && (
                    <button
                      onClick={handleNewComponent}
                      className="mt-4 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create Component
                    </button>
                  )}
                  {components.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedCategory('all');
                        setFilters({ searchQuery: '', statuses: undefined, complexities: undefined, usageSort: undefined, category: undefined, programs: undefined, sortBy: undefined, sortDirection: undefined });
                      }}
                      className="mt-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Detail Panel (slide in from right) */}
            {selectedComponentId && (
              <>
                {/* Resize handle */}
                <div
                  onMouseDown={handleResizeStart}
                  className="w-1.5 bg-[var(--border)] hover:bg-[var(--accent)] active:bg-[var(--accent)] cursor-col-resize transition-colors flex-shrink-0"
                />
                <div style={{ width: detailPanelWidth }} className="flex-shrink-0 border-l border-[var(--border)] bg-[var(--bg-secondary)] overflow-y-auto">
                  <ErrorBoundary fallbackName="Component Detail">
                    <ComponentDetail
                      componentId={selectedComponentId}
                      onClose={handleCloseDetail}
                      onEdit={(id) => setEditingComponent(id)}
                    />
                  </ErrorBoundary>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      {editingComponentId && (
        <ErrorBoundary fallbackName="Component Editor">
          <ComponentEditor
            componentId={editingComponentId === 'new' ? undefined : editingComponentId}
            onSave={handleCloseEditor}
            onClose={handleCloseEditor}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ComponentCard
// ---------------------------------------------------------------------------

function ComponentCard({
  component,
  isSelected,
  onClick,
}: {
  component: LibraryComponent;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusBadge = getStatusBadge(component.versionInfo.status);
  const complexityColor = getComplexityColor(component.complexity.level);
  const complexityDots = getComplexityDots(component.complexity.level);
  const isComposite = component.type === 'composite';
  const isArchived = component.versionInfo.status === 'archived';

  return (
    <div
      onClick={onClick}
      className={`border rounded-xl p-4 cursor-pointer transition-all group ${
        isArchived
          ? 'bg-[var(--bg-secondary)] border-[var(--border)] opacity-50 grayscale'
          : isSelected
            ? 'bg-[var(--bg-elevated,var(--bg))] border-[var(--accent)] ring-1 ring-[var(--accent)]/30'
            : 'bg-[var(--bg-elevated,var(--bg))] border-[var(--border)] hover:border-[var(--accent)]/40 hover:shadow-md'
      }`}
    >
      {/* Header: Name + Type Badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-[var(--text)] truncate group-hover:text-[var(--accent)] transition-colors">
          {component.name}
        </h3>
        <span
          className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
            isComposite
              ? 'bg-purple-500/10 text-purple-400'
              : 'bg-sky-500/10 text-sky-400'
          }`}
        >
          {isComposite ? (
            <GitBranch className="w-3 h-3" />
          ) : (
            <Atom className="w-3 h-3" />
          )}
          {isComposite ? 'Composite' : 'Atomic'}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-3 min-h-[2rem]">
        {component.description || 'No description provided'}
      </p>

      {/* Complexity */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-[var(--text-dim)]">Complexity</span>
        <span className={`text-sm ${complexityColor}`} title={`Score: ${component.complexity.score}`}>
          {complexityDots}
        </span>
        <span className={`text-xs font-medium capitalize ${complexityColor}`}>
          {component.complexity.level}
        </span>
      </div>

      {/* Footer: Usage + Status */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
        <span className="text-xs text-[var(--text-dim)] flex items-center gap-1">
          <Tag className="w-3 h-3" />
          Used in {component.usage.usageCount} measure{component.usage.usageCount !== 1 ? 's' : ''}
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge.color}`}
        >
          {statusBadge.icon}
          {statusBadge.label}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MultiSelectDropdown
// ---------------------------------------------------------------------------

function MultiSelectDropdown<T extends string>({
  icon,
  label,
  options,
  selected,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasSelection = selected.length > 0;
  const displayLabel =
    selected.length === 0
      ? `All ${label}`
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? label
        : `${selected.length} ${label}`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm cursor-pointer transition-colors focus:outline-none ${
          hasSelection
            ? 'bg-[var(--accent-light)] border-[var(--accent)]/40 text-[var(--accent)]'
            : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text)]'
        }`}
      >
        {icon && <span className="text-[var(--text-dim)]">{icon}</span>}
        <span className="whitespace-nowrap">{displayLabel}</span>
        {hasSelection ? (
          <X
            className="w-3.5 h-3.5 ml-0.5 hover:text-[var(--text)]"
            onClick={(e) => {
              e.stopPropagation();
              // Clear all selections
              selected.forEach((s) => onToggle(s));
            }}
          />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--bg-elevated,var(--bg))] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[160px]">
          {options.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggle(opt.value)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
                  isSelected
                    ? 'text-[var(--accent)] bg-[var(--accent-light)]'
                    : 'text-[var(--text)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    isSelected
                      ? 'bg-[var(--accent)] border-[var(--accent)]'
                      : 'border-[var(--border)]'
                  }`}
                >
                  {isSelected && (
                    <CheckCircle className="w-3 h-3 text-white" />
                  )}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
