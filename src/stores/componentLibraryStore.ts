/**
 * Component Library Store
 *
 * Zustand store for managing the reusable component library.
 * Follows the same pattern as measureStore.ts with persist middleware.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  LibraryComponent,
  AtomicComponent,
  CompositeComponent,
  ComponentId,
  LibraryBrowserFilters,
  ImportMatcherState,
  ComponentCategory,
  ApprovalStatus,
  ComponentChanges,
  EditAction,
  TimingExpression,
} from '../types/componentLibrary';
import { calculateAtomicComplexity, calculateCompositeComplexity } from '../services/complexityCalculator';
import {
  createNewVersion,
  archiveVersion,
  approveComponent,
  addUsageReference,
  removeUsageReference,
  searchComponents,
  createAtomicComponent,
} from '../services/componentLibraryService';
import { parseDataElementToComponent, findExactMatch } from '../services/componentMatcher';
import { sampleAtomics, sampleComposites, sampleCategories } from '../data/sampleLibraryData';
import type { DataElement, LogicalClause, UniversalMeasureSpec } from '../types/ums';

// ============================================================================
// State Interface
// ============================================================================

interface ComponentLibraryState {
  // Data
  components: LibraryComponent[];
  initialized: boolean;

  // UI State
  selectedComponentId: ComponentId | null;
  filters: LibraryBrowserFilters;
  editingComponentId: ComponentId | null;
  importMatcherState: ImportMatcherState | null;

  // Actions
  initializeWithSampleData: () => void;
  addComponent: (component: LibraryComponent) => void;
  updateComponent: (id: ComponentId, updates: Partial<LibraryComponent>) => void;
  deleteComponent: (id: ComponentId) => void;
  setSelectedComponent: (id: ComponentId | null) => void;
  setFilters: (filters: Partial<LibraryBrowserFilters>) => void;
  setEditingComponent: (id: ComponentId | null) => void;
  setImportMatcherState: (state: ImportMatcherState | null) => void;

  // Versioning actions
  createVersion: (id: ComponentId, changes: ComponentChanges, updatedBy: string) => void;
  archiveComponentVersion: (id: ComponentId, supersededBy: string) => void;
  approve: (id: ComponentId, approvedBy: string) => void;

  // Usage actions
  addUsage: (componentId: ComponentId, measureId: string) => void;
  removeUsage: (componentId: ComponentId, measureId: string) => void;

  // Edit workflow
  handleSharedEdit: (
    id: ComponentId,
    changes: ComponentChanges,
    action: EditAction,
    updatedBy: string,
  ) => void;

  // Measure linking
  linkMeasureComponents: (measureId: string, populations: Array<{ criteria?: LogicalClause | null; type: string }>) => Record<string, string>;

  // Usage recalculation from actual measures
  recalculateUsage: (measures: UniversalMeasureSpec[]) => void;

  // Sync component edits to measures
  syncComponentToMeasures: (
    componentId: ComponentId,
    changes: ComponentChanges,
    measures: UniversalMeasureSpec[],
    updateMeasure: (id: string, updates: Partial<UniversalMeasureSpec>) => void,
  ) => void;

  // Computed / Selectors
  getComponent: (id: ComponentId) => LibraryComponent | null;
  getFilteredComponents: () => LibraryComponent[];
  getComponentsByCategory: (category: ComponentCategory) => LibraryComponent[];
  getComponentsByStatus: (status: ApprovalStatus) => LibraryComponent[];
  getCategoryCounts: () => Record<ComponentCategory, number>;
}

// ============================================================================
// Store
// ============================================================================

export const useComponentLibraryStore = create<ComponentLibraryState>()(
  persist(
    (set, get) => ({
      // Initial state
      components: [],
      initialized: false,
      selectedComponentId: null,
      filters: { showArchived: false },
      editingComponentId: null,
      importMatcherState: null,

      // Initialize with sample data
      initializeWithSampleData: () => {
        if (get().initialized) return;

        // Hydrate atomics with complexity scores
        const hydratedAtomics: AtomicComponent[] = sampleAtomics.map((atomic) => ({
          ...atomic,
          complexity: calculateAtomicComplexity(atomic),
        }));

        // Build component lookup for composite complexity resolution
        const componentMap = new Map<string, LibraryComponent>();
        hydratedAtomics.forEach((a) => componentMap.set(a.id, a));

        // Hydrate composites with complexity scores
        const hydratedComposites: CompositeComponent[] = sampleComposites.map((composite) => ({
          ...composite,
          complexity: calculateCompositeComplexity(
            composite,
            (id) => componentMap.get(id) || null,
          ),
        }));

        set({
          components: [...hydratedAtomics, ...hydratedComposites],
          initialized: true,
        });
      },

      // CRUD Actions
      addComponent: (component) =>
        set((state) => ({
          components: [...state.components, component],
        })),

      updateComponent: (id, updates) =>
        set((state) => ({
          components: state.components.map((c) =>
            c.id === id ? ({ ...c, ...updates } as LibraryComponent) : c
          ),
        })),

      deleteComponent: (id) =>
        set((state) => ({
          components: state.components.filter((c) => c.id !== id),
          selectedComponentId: state.selectedComponentId === id ? null : state.selectedComponentId,
          editingComponentId: state.editingComponentId === id ? null : state.editingComponentId,
        })),

      // UI State
      setSelectedComponent: (id) => set({ selectedComponentId: id }),

      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

      setEditingComponent: (id) => set({ editingComponentId: id }),

      setImportMatcherState: (importState) => set({ importMatcherState: importState }),

      // Versioning
      createVersion: (id, changes, updatedBy) =>
        set((state) => {
          const component = state.components.find((c) => c.id === id);
          if (!component) return state;
          const updated = createNewVersion(component, changes, updatedBy);
          return {
            components: state.components.map((c) => (c.id === id ? updated : c)),
          };
        }),

      archiveComponentVersion: (id, supersededBy) =>
        set((state) => {
          const component = state.components.find((c) => c.id === id);
          if (!component) return state;
          const archived = archiveVersion(component, supersededBy);
          return {
            components: state.components.map((c) => (c.id === id ? archived : c)),
          };
        }),

      approve: (id, approvedBy) =>
        set((state) => {
          const component = state.components.find((c) => c.id === id);
          if (!component) return state;
          const approved = approveComponent(component, approvedBy);
          return {
            components: state.components.map((c) => (c.id === id ? approved : c)),
          };
        }),

      // Usage
      addUsage: (componentId, measureId) =>
        set((state) => {
          const component = state.components.find((c) => c.id === componentId);
          if (!component) return state;
          const updated = addUsageReference(component, measureId);
          return {
            components: state.components.map((c) => (c.id === componentId ? updated : c)),
          };
        }),

      removeUsage: (componentId, measureId) =>
        set((state) => {
          const component = state.components.find((c) => c.id === componentId);
          if (!component) return state;
          const updated = removeUsageReference(component, measureId);
          return {
            components: state.components.map((c) => (c.id === componentId ? updated : c)),
          };
        }),

      // Shared edit workflow
      handleSharedEdit: (id, changes, action, updatedBy) => {
        const state = get();
        const component = state.components.find((c) => c.id === id);
        if (!component) return;

        if (action === 'update_all') {
          // Create new version, archive old one
          const updated = createNewVersion(component, changes, updatedBy);
          set({
            components: state.components.map((c) => (c.id === id ? updated : c)),
          });
        } else {
          // create_version: duplicate the component with changes for this measure only
          const duplicated = createNewVersion(component, changes, updatedBy);
          const newId = `${id}-v${Date.now()}`;
          const duplicatedWithNewId = { ...duplicated, id: newId } as LibraryComponent;
          set({
            components: [...state.components, duplicatedWithNewId],
          });
        }
      },

      // Measure linking - extract data elements and match/create in library
      linkMeasureComponents: (measureId, populations) => {
        const state = get();
        const linkMap: Record<string, string> = {}; // dataElementId -> componentId

        // Build library lookup from current components
        const libraryRecord: Record<string, LibraryComponent> = {};
        state.components.forEach((c) => { libraryRecord[c.id] = c; });

        // Collect all data elements from all populations
        const collectElements = (node: LogicalClause | DataElement): DataElement[] => {
          if ('operator' in node && 'children' in node) {
            // It's a LogicalClause
            const clause = node as LogicalClause;
            return clause.children.flatMap(collectElements);
          }
          // It's a DataElement
          return [node as DataElement];
        };

        const allElements: DataElement[] = [];
        for (const pop of populations) {
          if (pop.criteria) {
            allElements.push(...collectElements(pop.criteria as LogicalClause | DataElement));
          }
        }

        const newComponents: LibraryComponent[] = [];
        const updatedComponents: LibraryComponent[] = [];

        for (const element of allElements) {
          const parsed = parseDataElementToComponent(element);
          if (!parsed) continue; // Skip elements without value sets

          // Try exact match against library
          const match = findExactMatch(parsed, libraryRecord);

          if (match) {
            // Link to existing component
            linkMap[element.id] = match.id;
            // Add usage if not already tracked
            if (!match.usage.measureIds.includes(measureId)) {
              const updated = addUsageReference(match, measureId);
              updatedComponents.push(updated);
              libraryRecord[match.id] = updated;
            }
          } else {
            // Create new atomic component from this element
            const categoryMap: Record<string, ComponentCategory> = {
              demographic: 'demographics',
              encounter: 'encounters',
              diagnosis: 'conditions',
              procedure: 'procedures',
              medication: 'medications',
              observation: 'observations',
            };
            const category: ComponentCategory = categoryMap[element.type] || 'other';

            const vsOid = element.valueSet?.oid || '';
            const vsName = element.valueSet?.name || element.description;
            const newComp = createAtomicComponent({
              name: vsName,
              description: element.description,
              valueSet: {
                oid: vsOid,
                version: vsOid,
                name: vsName,
              },
              timing: parsed.timing || {
                operator: 'during',
                reference: 'Measurement Period',
                displayExpression: 'during Measurement Period',
              },
              negation: parsed.negation || false,
              category,
              tags: [element.type],
              createdBy: 'auto-import',
            });

            // Add usage
            const withUsage = addUsageReference(newComp, measureId);
            newComponents.push(withUsage);
            libraryRecord[withUsage.id] = withUsage;
            linkMap[element.id] = withUsage.id;
          }
        }

        // Update store
        if (newComponents.length > 0 || updatedComponents.length > 0) {
          set((s) => {
            let components = [...s.components];
            // Update existing components with new usage
            for (const updated of updatedComponents) {
              components = components.map((c) => c.id === updated.id ? updated : c);
            }
            // Add new components
            components = [...components, ...newComponents];
            return { components, initialized: true };
          });
        }

        return linkMap;
      },

      // Recalculate usage from actual measures (resets all counts, rebuilds from scratch)
      recalculateUsage: (measures) => {
        const state = get();

        // Helper to collect all data elements from a criteria tree
        const collectElements = (node: LogicalClause | DataElement): DataElement[] => {
          if ('operator' in node && 'children' in node) {
            return (node as LogicalClause).children.flatMap(collectElements);
          }
          return [node as DataElement];
        };

        // Build a set of (componentId -> Set<measureId>) from actual measures
        const usageMap = new Map<string, Set<string>>();

        // Also build a library lookup for matching
        const libraryRecord: Record<string, LibraryComponent> = {};
        state.components.forEach((c) => { libraryRecord[c.id] = c; });

        for (const measure of measures) {
          const measureId = measure.metadata.measureId;
          for (const pop of measure.populations) {
            if (!pop.criteria) continue;
            const elements = collectElements(pop.criteria as LogicalClause | DataElement);
            for (const element of elements) {
              // Check if element is linked to a library component
              let componentId = element.libraryComponentId;

              // If not linked, try to match
              if (!componentId) {
                const parsed = parseDataElementToComponent(element);
                if (parsed) {
                  const match = findExactMatch(parsed, libraryRecord);
                  if (match) {
                    componentId = match.id;
                  }
                }
              }

              if (componentId && libraryRecord[componentId]) {
                if (!usageMap.has(componentId)) {
                  usageMap.set(componentId, new Set());
                }
                usageMap.get(componentId)!.add(measureId);
              }
            }
          }
        }

        // Reset all components' usage and rebuild from usageMap
        const updatedComponents = state.components.map((c) => {
          const measureIds = usageMap.has(c.id) ? Array.from(usageMap.get(c.id)!) : [];
          return {
            ...c,
            usage: {
              ...c.usage,
              measureIds,
              usageCount: measureIds.length,
              lastUsedAt: measureIds.length > 0 ? new Date().toISOString() : c.usage.lastUsedAt,
            },
          } as LibraryComponent;
        });

        set({ components: updatedComponents });
      },

      // Sync component changes to all measures that use it
      syncComponentToMeasures: (componentId, changes, measures, updateMeasure) => {
        const component = get().components.find((c) => c.id === componentId);
        if (!component) return;

        const affectedMeasureIds = component.usage.measureIds;

        // Helper to walk criteria tree and update matching data elements
        const updateCriteria = (node: any): any => {
          if (!node) return node;

          // LogicalClause
          if ('operator' in node && 'children' in node) {
            return {
              ...node,
              children: node.children.map(updateCriteria),
            };
          }

          // DataElement — check if it's linked to this component
          if (node.libraryComponentId === componentId) {
            const updated = { ...node };
            if (changes.name) {
              updated.description = changes.name;
            }
            if (component.type === 'atomic') {
              const atomicComp = component as AtomicComponent;
              if (changes.timing) {
                updated.timingRequirements = [{
                  description: changes.timing.displayExpression,
                  window: changes.timing.quantity ? {
                    value: changes.timing.quantity,
                    unit: changes.timing.unit || 'years',
                    direction: changes.timing.position || 'before end of',
                  } : undefined,
                }];
              }
              if (changes.negation !== undefined) {
                updated.negation = changes.negation;
              }
            }
            return updated;
          }

          return node;
        };

        for (const measure of measures) {
          if (!affectedMeasureIds.includes(measure.metadata.measureId)) continue;

          const updatedPopulations = measure.populations.map((pop) => ({
            ...pop,
            criteria: pop.criteria ? updateCriteria(pop.criteria) : pop.criteria,
          }));

          updateMeasure(measure.id, { populations: updatedPopulations });
        }
      },

      // Selectors
      getComponent: (id) => {
        return get().components.find((c) => c.id === id) || null;
      },

      getFilteredComponents: () => {
        const state = get();
        return searchComponents(state.components, state.filters);
      },

      getComponentsByCategory: (category) => {
        return get().components.filter((c) => c.metadata.category === category);
      },

      getComponentsByStatus: (status) => {
        return get().components.filter((c) => c.versionInfo.status === status);
      },

      getCategoryCounts: () => {
        const components = get().components.filter(
          (c) => c.versionInfo.status !== 'archived'
        );
        const counts: Record<string, number> = {};
        for (const c of components) {
          counts[c.metadata.category] = (counts[c.metadata.category] || 0) + 1;
        }
        return counts as Record<ComponentCategory, number>;
      },
    }),
    {
      name: 'measure-accelerator-component-library',
      partialize: (state) => ({
        components: state.components,
        initialized: state.initialized,
      }),
    }
  )
);
