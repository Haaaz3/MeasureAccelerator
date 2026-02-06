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
import {
  parseDataElementToComponent,
  findExactMatch,
  findExactMatchPrioritizeApproved,
  validateMeasureComponents,
  type ComponentValidationResult,
} from '../services/componentMatcher';
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

  // Merge mode state
  mergeMode: boolean;
  selectedForMerge: Set<string>;

  // Merge mode actions
  setMergeMode: (enabled: boolean) => void;
  toggleMergeSelection: (componentId: string) => void;
  clearMergeSelection: () => void;

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

  // Validate measure component usage against library
  validateMeasureComponentUsage: (populations: Array<{ criteria?: LogicalClause | null; type: string }>) => ComponentValidationResult;

  // Merge multiple components into one with combined value sets
  mergeComponents: (
    componentIds: ComponentId[],
    mergedName: string,
    mergedDescription?: string,
  ) => LibraryComponent | null;

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
      filters: { showArchived: true },
      editingComponentId: null,
      importMatcherState: null,
      mergeMode: false,
      selectedForMerge: new Set(),

      // Merge mode actions
      setMergeMode: (enabled) => {
        set({ mergeMode: enabled });
        if (!enabled) {
          set({ selectedForMerge: new Set() });
        }
      },
      toggleMergeSelection: (componentId) => {
        const current = get().selectedForMerge;
        const newSet = new Set(current);
        if (newSet.has(componentId)) {
          newSet.delete(componentId);
        } else {
          newSet.add(componentId);
        }
        set({ selectedForMerge: newSet });
      },
      clearMergeSelection: () => {
        set({ selectedForMerge: new Set() });
      },

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

        // Collect all OR/AND clauses whose children are all DataElements (composite candidates)
        const collectClausesWithElements = (node: LogicalClause | DataElement): LogicalClause[] => {
          if (!('operator' in node && 'children' in node)) return [];
          const clause = node as LogicalClause;
          const results: LogicalClause[] = [];
          // Check if ALL children are DataElements (not nested clauses)
          const allDataElements = clause.children.every(
            (c) => !('operator' in c && 'children' in c)
          );
          if (allDataElements && clause.children.length >= 2) {
            results.push(clause);
          }
          // Also recurse into nested clauses
          for (const child of clause.children) {
            if ('operator' in child && 'children' in child) {
              results.push(...collectClausesWithElements(child as LogicalClause));
            }
          }
          return results;
        };

        const allElements: DataElement[] = [];
        const allClauses: LogicalClause[] = [];
        for (const pop of populations) {
          if (pop.criteria) {
            allElements.push(...collectElements(pop.criteria as LogicalClause | DataElement));
            allClauses.push(...collectClausesWithElements(pop.criteria as LogicalClause | DataElement));
          }
        }

        const newComponents: LibraryComponent[] = [];
        const updatedComponents: LibraryComponent[] = [];

        // Step 1: Match individual data elements (atomics) - prioritize approved components
        for (const element of allElements) {
          const parsed = parseDataElementToComponent(element);
          if (!parsed) continue; // Skip elements without value sets

          // Try exact match against library, prioritizing approved components
          const { match, isApproved, alternateApproved } = findExactMatchPrioritizeApproved(parsed, libraryRecord);

          // If there's an approved alternative but we matched a draft, use the approved one
          const effectiveMatch = alternateApproved || match;

          if (effectiveMatch) {
            // Link to existing component (prefer approved)
            linkMap[element.id] = effectiveMatch.id;

            if (alternateApproved && match && !isApproved) {
              console.log(`[Component Library] Linked "${element.description}" to approved component "${alternateApproved.name}" instead of draft "${match.name}"`);
            }

            // Sync codes: if the matched component has no codes but the element does, update it
            const elementCodes = element.valueSet?.codes || element.directCodes || [];
            const matchCodes = (effectiveMatch.type === 'atomic' && (effectiveMatch as AtomicComponent).valueSet.codes) || [];
            let componentToUpdate = effectiveMatch;
            if (elementCodes.length > 0 && matchCodes.length === 0 && effectiveMatch.type === 'atomic') {
              componentToUpdate = {
                ...effectiveMatch,
                valueSet: { ...(effectiveMatch as AtomicComponent).valueSet, codes: elementCodes },
              } as AtomicComponent;
              libraryRecord[effectiveMatch.id] = componentToUpdate;
            }

            // Add usage if not already tracked
            if (!componentToUpdate.usage.measureIds.includes(measureId)) {
              const updated = addUsageReference(componentToUpdate, measureId);
              updatedComponents.push(updated);
              libraryRecord[effectiveMatch.id] = updated;
            } else if (componentToUpdate !== effectiveMatch) {
              // Codes were updated but usage was already tracked — still need to push the update
              updatedComponents.push(componentToUpdate);
            }
          } else {
            // Check if the element has any codes before creating a component
            const hasCodes = (element.valueSet?.codes?.length ?? 0) > 0 ||
                             (element.directCodes?.length ?? 0) > 0;

            if (!hasCodes) {
              // Zero codes — do NOT create a component. Mark with sentinel for warning.
              linkMap[element.id] = '__ZERO_CODES__';
              continue;
            }

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
            const elementCodes = element.valueSet?.codes || element.directCodes || [];
            const newComp = createAtomicComponent({
              name: vsName,
              description: element.description,
              valueSet: {
                oid: vsOid,
                version: vsOid,
                name: vsName,
                codes: elementCodes,
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

        // Step 2: Match composite patterns (OR/AND clauses of data elements against library composites)
        for (const clause of allClauses) {
          const childElements = clause.children as DataElement[];
          const childParsed = childElements
            .map((el) => parseDataElementToComponent(el))
            .filter((p): p is NonNullable<typeof p> => p !== null);

          if (childParsed.length < 2) continue;

          // Build a composite ParsedComponent to match against library composites
          const compositeParsed = {
            name: clause.description || 'Composite',
            children: childParsed,
            operator: clause.operator as 'AND' | 'OR',
          };

          const compositeMatch = findExactMatch(compositeParsed, libraryRecord);
          if (compositeMatch) {
            // Link the clause ID to the composite
            linkMap[clause.id] = compositeMatch.id;
            if (!compositeMatch.usage.measureIds.includes(measureId)) {
              const updated = addUsageReference(compositeMatch, measureId);
              updatedComponents.push(updated);
              libraryRecord[compositeMatch.id] = updated;
            }
            console.log(`Composite match: "${compositeMatch.name}" linked to measure ${measureId}`);
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

        // Helper to collect clauses whose children are all DataElements (composite candidates)
        const collectClausesWithElements = (node: LogicalClause | DataElement): LogicalClause[] => {
          if (!('operator' in node && 'children' in node)) return [];
          const clause = node as LogicalClause;
          const results: LogicalClause[] = [];
          const allDataElements = clause.children.every(
            (c) => !('operator' in c && 'children' in c)
          );
          if (allDataElements && clause.children.length >= 2) {
            results.push(clause);
          }
          for (const child of clause.children) {
            if ('operator' in child && 'children' in child) {
              results.push(...collectClausesWithElements(child as LogicalClause));
            }
          }
          return results;
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

            // Match individual data elements (atomics)
            const elements = collectElements(pop.criteria as LogicalClause | DataElement);
            for (const element of elements) {
              let componentId = element.libraryComponentId;

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

            // Match composite patterns (OR/AND clauses against library composites)
            const clauses = collectClausesWithElements(pop.criteria as LogicalClause | DataElement);
            for (const clause of clauses) {
              const childElements = clause.children as DataElement[];
              const childParsed = childElements
                .map((el) => parseDataElementToComponent(el))
                .filter((p): p is NonNullable<typeof p> => p !== null);
              if (childParsed.length < 2) continue;

              const compositeParsed = {
                name: clause.description || 'Composite',
                children: childParsed,
                operator: clause.operator as 'AND' | 'OR',
              };
              const compositeMatch = findExactMatch(compositeParsed, libraryRecord);
              if (compositeMatch) {
                if (!usageMap.has(compositeMatch.id)) {
                  usageMap.set(compositeMatch.id, new Set());
                }
                usageMap.get(compositeMatch.id)!.add(measureId);
              }
            }
          }
        }

        // Reset all components' usage, rebuild from usageMap, and auto-archive/unarchive
        const updatedComponents = state.components.map((c) => {
          const measureIds = usageMap.has(c.id) ? Array.from(usageMap.get(c.id)!) : [];
          const hasUsage = measureIds.length > 0;

          // Auto-archive if no usage (and not already archived)
          // Un-archive if it gained usage (restore to approved or draft)
          let newStatus = c.versionInfo.status;
          if (!hasUsage && c.versionInfo.status !== 'archived') {
            newStatus = 'archived';
          } else if (hasUsage && c.versionInfo.status === 'archived') {
            // Restore: find the last non-archived status from history, default to 'approved'
            const lastNonArchived = [...c.versionInfo.versionHistory]
              .reverse()
              .find((v) => v.status !== 'archived');
            newStatus = lastNonArchived?.status || 'approved';
          }

          return {
            ...c,
            usage: {
              ...c.usage,
              measureIds,
              usageCount: measureIds.length,
              lastUsedAt: hasUsage ? new Date().toISOString() : c.usage.lastUsedAt,
            },
            versionInfo: {
              ...c.versionInfo,
              status: newStatus,
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
              // Sync codes to the DataElement's valueSet
              if (changes.codes && updated.valueSet) {
                updated.valueSet = {
                  ...updated.valueSet,
                  codes: changes.codes,
                  totalCodeCount: changes.codes.length,
                };
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

      // Validate measure component usage against library
      validateMeasureComponentUsage: (populations) => {
        const state = get();

        // Build library lookup
        const libraryRecord: Record<string, LibraryComponent> = {};
        state.components.forEach((c) => { libraryRecord[c.id] = c; });

        // Collect all data elements
        const collectElements = (node: LogicalClause | DataElement): DataElement[] => {
          if ('operator' in node && 'children' in node) {
            return (node as LogicalClause).children.flatMap(collectElements);
          }
          return [node as DataElement];
        };

        const allElements: DataElement[] = [];
        for (const pop of populations) {
          if (pop.criteria) {
            allElements.push(...collectElements(pop.criteria as LogicalClause | DataElement));
          }
        }

        return validateMeasureComponents(allElements, libraryRecord);
      },

      // Merge multiple components into one with combined value sets
      mergeComponents: (componentIds, mergedName, mergedDescription) => {
        const state = get();

        // Get all components to merge
        const componentsToMerge = componentIds
          .map(id => state.components.find(c => c.id === id))
          .filter((c): c is AtomicComponent => c !== undefined && c.type === 'atomic');

        if (componentsToMerge.length < 2) {
          console.warn('Need at least 2 atomic components to merge');
          return null;
        }

        // Collect all value sets from all components
        const allValueSets: Array<{ oid: string; version: string; name: string; codes?: import('../types/ums').CodeReference[] }> = [];
        const seenOids = new Set<string>();

        for (const comp of componentsToMerge) {
          // Add from valueSets array if present
          const valueSetsToAdd = comp.valueSets || [comp.valueSet];
          for (const vs of valueSetsToAdd) {
            if (!seenOids.has(vs.oid)) {
              seenOids.add(vs.oid);
              allValueSets.push(vs);
            }
          }
        }

        // Use the first component as base for timing, category, etc.
        const baseComponent = componentsToMerge[0];

        // Combine all measure IDs from all components being merged
        const allMeasureIds = new Set<string>();
        for (const comp of componentsToMerge) {
          for (const measureId of comp.usage.measureIds) {
            allMeasureIds.add(measureId);
          }
        }

        // Create the merged component
        const now = new Date().toISOString();
        const mergedId = `merged-${Date.now()}`;

        const mergedComponent: AtomicComponent = {
          type: 'atomic',
          id: mergedId,
          name: mergedName,
          description: mergedDescription || `Combined component: ${componentsToMerge.map(c => c.name).join(' + ')}`,
          valueSet: allValueSets[0], // Primary value set for backward compatibility
          valueSets: allValueSets,   // All value sets
          timing: baseComponent.timing,
          negation: baseComponent.negation,
          complexity: baseComponent.complexity, // Will be recalculated
          versionInfo: {
            versionId: '1.0',
            versionHistory: [{
              versionId: '1.0',
              status: 'draft',
              createdAt: now,
              createdBy: 'merge',
              changeDescription: `Merged from: ${componentsToMerge.map(c => c.name).join(', ')}`,
            }],
            status: 'draft',
          },
          usage: {
            measureIds: Array.from(allMeasureIds),
            usageCount: allMeasureIds.size,
            lastUsedAt: now,
          },
          metadata: {
            ...baseComponent.metadata,
            createdAt: now,
            updatedAt: now,
            tags: [...new Set(componentsToMerge.flatMap(c => c.metadata.tags))],
          },
        };

        // Update store: add merged component, archive old ones
        set((s) => {
          const updatedComponents = s.components.map(c => {
            if (componentIds.includes(c.id)) {
              // Archive the merged components
              return {
                ...c,
                versionInfo: {
                  ...c.versionInfo,
                  status: 'archived' as const,
                },
              };
            }
            return c;
          });

          return {
            components: [...updatedComponents, mergedComponent],
          };
        });

        console.log(`Merged ${componentsToMerge.length} components into "${mergedName}" with ${allValueSets.length} value sets`);
        return mergedComponent;
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
