/**
 * Component Library CRUD Service
 *
 * Handles creation, updating, versioning, deletion, and querying
 * of library components (atomic and composite).
 */

import type {
  AtomicComponent,
  CompositeComponent,
  LibraryComponent,
  ComponentId,
  VersionId,
  ComponentComplexity,
  ComponentVersionInfo,
  ComponentUsage,
  ComponentMetadata,
  ComponentCategory,
  ComponentChanges,
  ComponentReference,
  LibraryBrowserFilters,
  MeasureReference,
  TimingExpression,
  LogicalOperator,
  OIDValidationStatus,
} from '../types/componentLibrary';
import { calculateAtomicComplexity, calculateCompositeComplexity } from './complexityCalculator';
import { validateOID, type OIDValidationResult } from './oidValidator';

// ============================================================================
// ID Generation
// ============================================================================

let idCounter = 0;

function generateId(prefix: string): ComponentId {
  idCounter++;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

// ============================================================================
// OID Validation Helper
// ============================================================================

/**
 * Convert OIDValidationResult to OIDValidationStatus for component storage
 */
export function buildOIDValidationStatus(oid: string, name?: string): OIDValidationStatus {
  if (!oid || oid === 'N/A') {
    return {
      status: 'unknown',
      warnings: ['No OID provided'],
      inCatalog: false,
      validatedAt: new Date().toISOString(),
    };
  }

  const result = validateOID(oid, name);

  // Determine status
  let status: OIDValidationStatus['status'];
  if (!result.valid) {
    status = 'invalid';
  } else if (result.catalogMatch) {
    status = 'valid';
  } else {
    status = 'unknown'; // Valid format but not in catalog
  }

  return {
    status,
    errors: result.errors.length > 0 ? result.errors.map(e => e.message) : undefined,
    warnings: result.warnings.length > 0 ? result.warnings.map(w => w.message) : undefined,
    inCatalog: !!result.catalogMatch,
    catalogName: result.catalogMatch?.name,
    validatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Creation
// ============================================================================

export interface ComponentValueSetInput {
  oid: string;
  version: string;
  name: string;
  codes?: import('../types/ums').CodeReference[];
}

export interface CreateAtomicParams {
  name: string;
  description?: string;
  /** Primary value set (required for backward compatibility) */
  valueSet: ComponentValueSetInput;
  /** Additional value sets to combine (optional) */
  additionalValueSets?: ComponentValueSetInput[];
  timing: TimingExpression;
  negation: boolean;
  category: ComponentCategory;
  tags?: string[];
  createdBy?: string;
}

export function createAtomicComponent(params: CreateAtomicParams): AtomicComponent {
  const now = new Date().toISOString();
  const id = generateId('atomic');

  // Combine all value sets if additional ones provided
  const allValueSets = params.additionalValueSets
    ? [params.valueSet, ...params.additionalValueSets]
    : undefined;

  // Validate OID for primary value set
  const oidValidation = buildOIDValidationStatus(params.valueSet.oid, params.valueSet.name);

  const base: Omit<AtomicComponent, 'complexity'> = {
    type: 'atomic',
    id,
    name: params.name,
    description: params.description,
    valueSet: params.valueSet,
    valueSets: allValueSets,
    timing: params.timing,
    negation: params.negation,
    oidValidation,
    versionInfo: createInitialVersionInfo(params.createdBy || 'user', now),
    usage: createInitialUsage(),
    metadata: createInitialMetadata(params.category, params.tags || [], params.createdBy || 'user', now),
  };

  const complexity = calculateAtomicComplexity(base);

  return { ...base, complexity };
}

export interface CreateCompositeParams {
  name: string;
  description?: string;
  operator: LogicalOperator;
  children: ComponentReference[];
  category: ComponentCategory;
  tags?: string[];
  createdBy?: string;
  resolveChild: (id: string) => LibraryComponent | null;
}

export function createCompositeComponent(params: CreateCompositeParams): CompositeComponent {
  const now = new Date().toISOString();
  const id = generateId('composite');

  const base: Omit<CompositeComponent, 'complexity'> = {
    type: 'composite',
    id,
    name: params.name,
    description: params.description,
    operator: params.operator,
    children: params.children,
    versionInfo: createInitialVersionInfo(params.createdBy || 'user', now),
    usage: createInitialUsage(),
    metadata: createInitialMetadata(params.category, params.tags || [], params.createdBy || 'user', now),
  };

  const complexity = calculateCompositeComplexity(base, params.resolveChild);

  return { ...base, complexity };
}

// ============================================================================
// Versioning
// ============================================================================

export function createNewVersion(
  component: LibraryComponent,
  changes: ComponentChanges,
  updatedBy: string,
): LibraryComponent {
  const now = new Date().toISOString();
  const currentVersion = parseFloat(component.versionInfo.versionId);
  const newVersionId = (currentVersion + 0.1).toFixed(1);

  const newVersionInfo: ComponentVersionInfo = {
    versionId: newVersionId,
    versionHistory: [
      ...component.versionInfo.versionHistory,
      {
        versionId: newVersionId,
        status: 'draft',
        createdAt: now,
        createdBy: updatedBy,
        changeDescription: changes.changeDescription,
      },
    ],
    status: 'draft',
  };

  const updatedMetadata: ComponentMetadata = {
    ...component.metadata,
    updatedAt: now,
    updatedBy,
  };

  if (component.type === 'atomic') {
    return {
      ...component,
      name: changes.name ?? component.name,
      timing: changes.timing ?? component.timing,
      negation: changes.negation ?? component.negation,
      versionInfo: newVersionInfo,
      metadata: updatedMetadata,
    };
  } else {
    return {
      ...component,
      name: changes.name ?? component.name,
      operator: changes.operator ?? component.operator,
      children: changes.children ?? component.children,
      versionInfo: newVersionInfo,
      metadata: updatedMetadata,
    };
  }
}

export function archiveVersion(
  component: LibraryComponent,
  supersededBy: VersionId,
): LibraryComponent {
  const now = new Date().toISOString();
  return {
    ...component,
    versionInfo: {
      ...component.versionInfo,
      status: 'archived',
      versionHistory: component.versionInfo.versionHistory.map((entry) =>
        entry.versionId === component.versionInfo.versionId
          ? { ...entry, status: 'archived' as const, supersededBy }
          : entry
      ),
    },
    metadata: {
      ...component.metadata,
      updatedAt: now,
    },
  };
}

export function approveComponent(
  component: LibraryComponent,
  approvedBy: string,
): LibraryComponent {
  const now = new Date().toISOString();
  return {
    ...component,
    versionInfo: {
      ...component.versionInfo,
      status: 'approved',
      approvedBy,
      approvedAt: now,
      versionHistory: component.versionInfo.versionHistory.map((entry) =>
        entry.versionId === component.versionInfo.versionId
          ? { ...entry, status: 'approved' as const }
          : entry
      ),
    },
    metadata: {
      ...component.metadata,
      updatedAt: now,
      updatedBy: approvedBy,
    },
  };
}

// ============================================================================
// Usage Tracking
// ============================================================================

export function addUsageReference(
  component: LibraryComponent,
  measureId: string,
): LibraryComponent {
  if (component.usage.measureIds.includes(measureId)) return component;
  return {
    ...component,
    usage: {
      ...component.usage,
      measureIds: [...component.usage.measureIds, measureId],
      usageCount: component.usage.usageCount + 1,
      lastUsedAt: new Date().toISOString(),
    },
  };
}

export function removeUsageReference(
  component: LibraryComponent,
  measureId: string,
): LibraryComponent {
  return {
    ...component,
    usage: {
      ...component.usage,
      measureIds: component.usage.measureIds.filter((id) => id !== measureId),
      usageCount: Math.max(0, component.usage.usageCount - 1),
    },
  };
}

// ============================================================================
// Queries
// ============================================================================

export function searchComponents(
  components: LibraryComponent[],
  filters: LibraryBrowserFilters,
  measureLookup?: (measureId: string) => { program?: string } | undefined,
): LibraryComponent[] {
  let result = [...components];

  // Category filter
  if (filters.category) {
    result = result.filter((c) => c.metadata.category === filters.category);
  }

  // Status filter (multiselect)
  if (filters.statuses && filters.statuses.length > 0) {
    result = result.filter((c) => filters.statuses!.includes(c.versionInfo.status));
  } else if (filters.status) {
    // Legacy single-select fallback
    result = result.filter((c) => c.versionInfo.status === filters.status);
  }

  // Complexity filter (multiselect)
  if (filters.complexities && filters.complexities.length > 0) {
    result = result.filter((c) => filters.complexities!.includes(c.complexity.level));
  } else if (filters.complexity) {
    // Legacy single-select fallback
    result = result.filter((c) => c.complexity.level === filters.complexity);
  }

  // Archived filter
  if (!filters.showArchived) {
    result = result.filter((c) => c.versionInfo.status !== 'archived');
  }

  // Program filter (filter by measures' programs)
  if (filters.programs && filters.programs.length > 0 && measureLookup) {
    result = result.filter((c) => {
      const componentPrograms = c.usage.measureIds
        .map(id => measureLookup(id)?.program)
        .filter(Boolean);
      return componentPrograms.some(prog => filters.programs!.includes(prog as any));
    });
  }

  // Search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.description?.toLowerCase().includes(query) ?? false) ||
        c.metadata.tags.some((t) => t.toLowerCase().includes(query)) ||
        (c.type === 'atomic' && c.valueSet.oid.includes(query)) ||
        (c.type === 'atomic' && c.valueSet.name.toLowerCase().includes(query))
    );
  }

  // Sort: archived always at bottom, then by the selected sort criteria
  const sortBy = filters.sortBy ?? 'name';
  const sortDir = filters.sortDirection ?? 'asc';
  const dirMultiplier = sortDir === 'desc' ? -1 : 1;

  result.sort((a, b) => {
    const aArchived = a.versionInfo.status === 'archived' ? 1 : 0;
    const bArchived = b.versionInfo.status === 'archived' ? 1 : 0;
    if (aArchived !== bArchived) return aArchived - bArchived;

    // Legacy usageSort takes precedence if set (for backwards compatibility)
    if (filters.usageSort) {
      const diff = a.usage.usageCount - b.usage.usageCount;
      return filters.usageSort === 'desc' ? -diff : diff;
    }

    // New sortBy field
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'complexity':
        comparison = a.complexity.score - b.complexity.score;
        break;
      case 'usage':
        comparison = a.usage.usageCount - b.usage.usageCount;
        break;
      case 'status':
        comparison = a.versionInfo.status.localeCompare(b.versionInfo.status);
        break;
      case 'date':
        comparison = new Date(a.metadata.createdAt).getTime() - new Date(b.metadata.createdAt).getTime();
        break;
    }
    return comparison * dirMultiplier;
  });

  return result;
}

export function getComponentsByCategory(
  components: LibraryComponent[],
  category: ComponentCategory,
): LibraryComponent[] {
  return components.filter((c) => c.metadata.category === category);
}

export function getApprovedComponents(components: LibraryComponent[]): LibraryComponent[] {
  return components.filter((c) => c.versionInfo.status === 'approved');
}

export function getAffectedMeasures(component: LibraryComponent): MeasureReference[] {
  return component.usage.measureIds.map((measureId) => ({
    measureId,
    measureName: measureId, // In a real app, would look up the measure name
    populationType: 'unknown',
  }));
}

// ============================================================================
// Helpers
// ============================================================================

function createInitialVersionInfo(createdBy: string, createdAt: string): ComponentVersionInfo {
  return {
    versionId: '1.0',
    versionHistory: [
      {
        versionId: '1.0',
        status: 'draft',
        createdAt,
        createdBy,
        changeDescription: 'Initial version',
      },
    ],
    status: 'draft',
  };
}

function createInitialUsage(): ComponentUsage {
  return {
    measureIds: [],
    usageCount: 0,
  };
}

function createInitialMetadata(
  category: ComponentCategory,
  tags: string[],
  createdBy: string,
  createdAt: string,
): ComponentMetadata {
  return {
    createdAt,
    createdBy,
    updatedAt: createdAt,
    updatedBy: createdBy,
    category,
    tags,
    source: { origin: 'custom' },
  };
}
