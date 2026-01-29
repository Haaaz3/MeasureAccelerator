import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore';
import { useMeasureStore } from '../../stores/measureStore';
import { getComplexityColor, getComplexityDots } from '../../services/complexityCalculator';
import type {
  ComponentCategory,
  ApprovalStatus,
  ComplexityLevel,
  LibraryComponent,
} from '../../types/componentLibrary';
import { ComponentDetail } from './ComponentDetail';
import ComponentEditor from './ComponentEditor';

const CATEGORIES: { key: ComponentCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All Components' },
  { key: 'demographics', label: 'Demographics' },
  { key: 'encounters', label: 'Encounters' },
  { key: 'conditions', label: 'Conditions' },
  { key: 'procedures', label: 'Procedures' },
  { key: 'medications', label: 'Medications' },
  { key: 'observations', label: 'Observations' },
  { key: 'exclusions', label: 'Exclusions' },
  { key: 'other', label: 'Other' },
];

const STATUS_OPTIONS: { value: ApprovalStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'archived', label: 'Archived' },
];

const COMPLEXITY_OPTIONS: { value: ComplexityLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'All Complexity' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
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
    recalculateUsage,
  } = useComponentLibraryStore();
  const { measures } = useMeasureStore();

  const [selectedCategory, setSelectedCategory] = useState<ComponentCategory | 'all'>('all');

  // Seed sample data on mount if store is empty, then recalculate usage from actual measures
  useEffect(() => {
    if (components.length === 0) {
      initializeWithSampleData();
    }
    // Always recalculate usage from actual measures to keep counts accurate
    recalculateUsage(measures);
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

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ApprovalStatus | 'all';
    setFilters({ status: value === 'all' ? undefined : value });
  };

  const handleComplexityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ComplexityLevel | 'all';
    setFilters({ complexity: value === 'all' ? undefined : value });
  };

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
          <div className="flex-shrink-0 px-6 py-3 bg-[var(--bg)] border-b border-[var(--border)] flex items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
              <input
                type="text"
                placeholder="Search components..."
                value={filters.searchQuery ?? ''}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            {/* Status Dropdown */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-dim)] pointer-events-none" />
              <select
                value={filters.status ?? 'all'}
                onChange={handleStatusChange}
                className="pl-8 pr-8 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] appearance-none cursor-pointer focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Complexity Dropdown */}
            <div className="relative">
              <select
                value={filters.complexity ?? 'all'}
                onChange={handleComplexityChange}
                className="pl-4 pr-8 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] appearance-none cursor-pointer focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                {COMPLEXITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Result Count */}
            <span className="text-xs text-[var(--text-dim)] ml-auto">
              {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Component Grid + Detail Panel */}
          <div className="flex-1 flex overflow-hidden">
            {/* Cards Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredComponents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredComponents.map((component) => (
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
                        setFilters({ searchQuery: '', status: undefined, complexity: undefined, category: undefined });
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
              <div className="w-[420px] flex-shrink-0 border-l border-[var(--border)] bg-[var(--bg-secondary)] overflow-y-auto animate-slide-in-right">
                <ComponentDetail
                  componentId={selectedComponentId}
                  onClose={handleCloseDetail}
                  onEdit={(id) => setEditingComponent(id)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      {editingComponentId && (
        <ComponentEditor
          componentId={editingComponentId === 'new' ? undefined : editingComponentId}
          onSave={handleCloseEditor}
          onClose={handleCloseEditor}
        />
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

  return (
    <div
      onClick={onClick}
      className={`bg-[var(--bg-elevated,var(--bg))] border rounded-xl p-4 cursor-pointer transition-all group hover:shadow-md ${
        isSelected
          ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/30'
          : 'border-[var(--border)] hover:border-[var(--accent)]/40'
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
