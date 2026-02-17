import { create } from 'zustand';
import type {
  UniversalMeasureSpec,
  ReviewStatus,
  MeasureStatus,
  PatientValidationTrace,
  MeasureCorrection,
  CorrectionType,
  CodeReference,
  CorrectionExport,
  TimingConstraint,
  TimingOverride,
  TimingWindow,
} from '../types/ums';
import { setOperatorBetween } from '../types/ums';
import type { LogicalOperator } from '../types/ums';
import { syncAgeConstraints } from '../utils/constraintSync';
import { calculateDataElementComplexity } from '../services/complexityCalculator';
import { migrateMeasure, needsMigration } from '../utils/measureMigration';
import { getMeasuresFull, importMeasures } from '../api/measures';
import { transformMeasureDto } from '../api/transformers';

export type CodeOutputFormat = 'cql' | 'synapse';

interface MeasureState {
  // Measures library
  measures: UniversalMeasureSpec[];
  activeMeasureId: string | null;

  // API loading state
  isLoadingFromApi: boolean;
  apiError: string | null;
  lastLoadedAt: string | null;

  // UI state
  activeTab: 'library' | 'editor' | 'validation' | 'codegen' | 'valuesets' | 'settings' | 'components';
  editorSection: string | null;
  isUploading: boolean;
  uploadProgress: number;

  // Code generation
  selectedCodeFormat: CodeOutputFormat;

  // Validation
  validationTraces: PatientValidationTrace[];
  activeTraceId: string | null;

  // API Actions
  loadFromApi: () => Promise<void>;
  importMeasure: (measure: UniversalMeasureSpec) => Promise<{ success: boolean; error?: string }>;

  // Actions
  addMeasure: (measure: UniversalMeasureSpec) => void;
  updateMeasure: (id: string, updates: Partial<UniversalMeasureSpec>) => void;
  batchUpdateMeasures: (updates: Array<{ id: string; updates: Partial<UniversalMeasureSpec> }>) => { success: boolean; error?: string };
  deleteMeasure: (id: string) => Promise<void>;
  setActiveMeasure: (id: string | null) => void;
  setActiveTab: (tab: MeasureState['activeTab']) => void;
  setEditorSection: (section: string | null) => void;
  setUploadProgress: (progress: number) => void;
  setIsUploading: (uploading: boolean) => void;
  setSelectedCodeFormat: (format: CodeOutputFormat) => void;

  // Review actions
  updateReviewStatus: (measureId: string, componentId: string, status: ReviewStatus, notes?: string) => void;
  approveAllLowComplexity: (measureId: string) => void;

  // Lock/unlock for publish
  lockMeasure: (measureId: string) => void;
  unlockMeasure: (measureId: string) => void;
  isMeasureLocked: (measureId: string) => boolean;

  // Status management
  setMeasureStatus: (measureId: string, status: MeasureStatus) => void;

  // Validation actions
  addValidationTrace: (trace: PatientValidationTrace) => void;
  setActiveTrace: (id: string | null) => void;

  // Value set & data element editing (with correction tracking)
  addCodeToValueSet: (measureId: string, valueSetId: string, code: CodeReference, userNotes?: string) => void;
  removeCodeFromValueSet: (measureId: string, valueSetId: string, codeValue: string, userNotes?: string) => void;
  updateDataElement: (measureId: string, componentId: string, updates: Record<string, any>, correctionType: CorrectionType, userNotes?: string) => void;

  // Global constraint synchronization
  syncAgeRange: (measureId: string, minAge: number, maxAge: number) => void;

  // Component builder actions
  addComponentToPopulation: (measureId: string, populationId: string, component: import('../types/ums').DataElement, logicOperator?: 'AND' | 'OR') => void;
  deleteComponentFromPopulation: (measureId: string, populationId: string, componentId: string) => void;
  addValueSet: (measureId: string, valueSet: import('../types/ums').ValueSetReference) => void;

  // Advanced logic building actions
  toggleLogicalOperator: (measureId: string, clauseId: string) => void;
  reorderComponent: (measureId: string, parentClauseId: string, componentId: string, direction: 'up' | 'down') => void;
  moveComponentToIndex: (measureId: string, parentClauseId: string, componentId: string, targetIndex: number) => void;
  setOperatorBetweenSiblings: (measureId: string, clauseId: string, index1: number, index2: number, operator: LogicalOperator) => void;
  deleteComponent: (measureId: string, componentId: string) => void;

  // Timing override actions
  updateTimingOverride: (measureId: string, componentId: string, modified: TimingConstraint | null) => void;
  updateTimingWindow: (measureId: string, componentId: string, modified: TimingWindow | null) => void;
  updateMeasurementPeriod: (measureId: string, start: string, end: string) => void;

  // Correction management
  addCorrection: (measureId: string, correction: Omit<MeasureCorrection, 'id' | 'timestamp'>) => void;
  exportCorrections: (measureId: string) => CorrectionExport | null;

  // Computed
  getActiveMeasure: () => UniversalMeasureSpec | null;
  getReviewProgress: (measureId: string) => { total: number; approved: number; pending: number; flagged: number };
  getCorrections: (measureId: string) => MeasureCorrection[];
}

export const useMeasureStore = create<MeasureState>()(
    (set, get) => ({
      measures: [],
      activeMeasureId: null,
      isLoadingFromApi: false,
      apiError: null,
      lastLoadedAt: null,
      activeTab: 'library',
      editorSection: null,
      isUploading: false,
      uploadProgress: 0,
      selectedCodeFormat: 'cql',
      validationTraces: [],
      activeTraceId: null,

      // Load measures from backend API
      loadFromApi: async () => {
        // Skip if already loading
        if (get().isLoadingFromApi) return;

        set({ isLoadingFromApi: true, apiError: null });

        try {
          // Fetch all measures with full details in a single request (avoids N+1)
          const measureDtos = await getMeasuresFull();

          // Transform DTOs and apply migrations
          const validMeasures = measureDtos
            .map(dto => {
              try {
                return transformMeasureDto(dto);
              } catch (err) {
                console.error(`Failed to transform measure ${dto.id}:`, err);
                return null;
              }
            })
            .filter((m): m is UniversalMeasureSpec => m !== null)
            .map((measure) => {
              if (needsMigration(measure)) {
                console.log(`Migrating measure ${measure.id} to FHIR-aligned schema`);
                return migrateMeasure(measure);
              }
              return measure;
            });

          set({
            measures: validMeasures,
            isLoadingFromApi: false,
            lastLoadedAt: new Date().toISOString(),
          });

          console.log(`Loaded ${validMeasures.length} measures from API`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load measures';
          console.error('Failed to load measures from API:', error);
          set({
            isLoadingFromApi: false,
            apiError: errorMessage,
          });
        }
      },

      // Import a measure to the backend and add to local state
      importMeasure: async (measure) => {
        try {
          // Convert UMS to import format expected by backend
          const converted = convertUmsToImportFormat(measure);

          // Debug: Log what we're sending
          console.log('[importMeasure] UMS populations:', measure.populations.map(p => ({
            id: p.id,
            type: p.type,
            hasCriteria: !!p.criteria,
            criteriaChildren: p.criteria?.children?.length || 0,
          })));
          console.log('[importMeasure] Converted populations:', (converted.populations as any[])?.map((p: any) => ({
            id: p.id,
            type: p.populationType,
            hasRootClause: !!p.rootClause,
            dataElements: p.rootClause?.dataElements?.length || 0,
            childClauses: p.rootClause?.children?.length || 0,
          })));

          const importRequest = {
            measures: [converted],
            components: [],
            validationTraces: [],
            codeStates: {},
            version: 1,
            exportedAt: new Date().toISOString(),
          };

          const result = await importMeasures(importRequest);

          if (result.success) {
            // Add to local state with FHIR alignment
            let fhirMeasure = measure.resourceType === 'Measure'
              ? measure
              : needsMigration(measure)
                ? migrateMeasure(measure)
                : { ...measure, resourceType: 'Measure' as const };

            // Link data elements to component library
            // This creates new components or links to existing ones based on value set matching
            try {
              const { useComponentLibraryStore } = await import('./componentLibraryStore');
              const componentStore = useComponentLibraryStore.getState();
              const linkMap = componentStore.linkMeasureComponents(
                fhirMeasure.id,
                fhirMeasure.populations
              );

              // Update the measure's data elements with their libraryComponentIds
              if (Object.keys(linkMap).length > 0) {
                const updateElementLinks = (node: any): any => {
                  if (!node) return node;
                  if ('operator' in node && 'children' in node) {
                    return {
                      ...node,
                      children: node.children.map(updateElementLinks),
                    };
                  }
                  // It's a DataElement - update libraryComponentId if we have a link
                  if (linkMap[node.id] && linkMap[node.id] !== '__ZERO_CODES__') {
                    return { ...node, libraryComponentId: linkMap[node.id] };
                  }
                  return node;
                };

                fhirMeasure = {
                  ...fhirMeasure,
                  populations: fhirMeasure.populations.map((pop) => ({
                    ...pop,
                    criteria: pop.criteria ? updateElementLinks(pop.criteria) : pop.criteria,
                  })),
                };

                console.log(`[importMeasure] Linked ${Object.keys(linkMap).length} data elements to component library`);
              }
            } catch (linkError) {
              console.error('[importMeasure] Failed to link components:', linkError);
              // Continue without linking - not a fatal error
            }

            set((state) => ({
              measures: [...state.measures, fhirMeasure],
              activeMeasureId: fhirMeasure.id,
              activeTab: 'editor',
            }));

            console.log(`Imported measure ${measure.metadata.measureId} to backend`);
            return { success: true };
          } else {
            console.error('Import failed:', result.message);
            return { success: false, error: result.message };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Import failed';
          console.error('Failed to import measure:', error);
          return { success: false, error: errorMessage };
        }
      },

      addMeasure: (measure) => {
        // If measure already has resourceType, it's already formatted - don't migrate
        // This preserves copied measures exactly as they are
        let fhirMeasure = measure.resourceType === 'Measure'
          ? measure
          : needsMigration(measure)
            ? migrateMeasure(measure)
            : { ...measure, resourceType: 'Measure' as const };

        // Link data elements to component library (async, non-blocking for initial add)
        // Import the store dynamically to avoid circular dependency
        import('./componentLibraryStore').then(({ useComponentLibraryStore }) => {
          const componentStore = useComponentLibraryStore.getState();
          const linkMap = componentStore.linkMeasureComponents(
            fhirMeasure.id,
            fhirMeasure.populations
          );

          // Update the measure's data elements with their libraryComponentIds
          if (Object.keys(linkMap).length > 0) {
            const updateElementLinks = (node: any): any => {
              if (!node) return node;
              if ('operator' in node && 'children' in node) {
                return {
                  ...node,
                  children: node.children.map(updateElementLinks),
                };
              }
              // It's a DataElement - update libraryComponentId if we have a link
              if (linkMap[node.id] && linkMap[node.id] !== '__ZERO_CODES__') {
                return { ...node, libraryComponentId: linkMap[node.id] };
              }
              return node;
            };

            // Update the measure in state with linked components
            set((state) => ({
              measures: state.measures.map((m) =>
                m.id === fhirMeasure.id
                  ? {
                      ...m,
                      populations: m.populations.map((pop) => ({
                        ...pop,
                        criteria: pop.criteria ? updateElementLinks(pop.criteria) : pop.criteria,
                      })),
                    }
                  : m
              ),
            }));

            console.log(`[addMeasure] Linked ${Object.keys(linkMap).length} data elements to component library`);
          }
        }).catch((err) => {
          console.error('[addMeasure] Failed to link components:', err);
        });

        set((state) => ({
          measures: [...state.measures, fhirMeasure],
          activeMeasureId: fhirMeasure.id,
          activeTab: 'editor',
        }));
      },

      updateMeasure: (id, updates) =>
        set((state) => ({
          measures: state.measures.map((m) =>
            m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
          ),
        })),

      batchUpdateMeasures: (updates) => {
        const state = get();
        const now = new Date().toISOString();

        // Validate all measure IDs exist before applying any updates
        const missingIds: string[] = [];
        for (const update of updates) {
          if (!state.measures.some((m) => m.id === update.id)) {
            missingIds.push(update.id);
          }
        }

        if (missingIds.length > 0) {
          const error = `Batch update rejected: measure IDs not found: ${missingIds.join(', ')}`;
          console.error(error);
          return { success: false, error };
        }

        // Build a map of updates for efficient lookup
        const updateMap = new Map<string, Partial<UniversalMeasureSpec>>();
        for (const update of updates) {
          updateMap.set(update.id, update.updates);
        }

        // Apply all updates in a single state transition
        set((s) => ({
          measures: s.measures.map((m) => {
            const measureUpdates = updateMap.get(m.id);
            if (measureUpdates) {
              return { ...m, ...measureUpdates, updatedAt: now };
            }
            return m;
          }),
        }));

        return { success: true };
      },

      deleteMeasure: async (id) => {
        // Get the measure before deleting to update component usage
        const measure = get().measures.find((m) => m.id === id);

        try {
          // Delete from backend first
          const { deleteMeasure: deleteMeasureApi } = await import('../api/measures');
          await deleteMeasureApi(id);
          console.log(`Deleted measure ${id} from backend`);
        } catch (error) {
          console.error('Failed to delete measure from backend:', error);
          // Continue with local delete even if backend fails
        }

        // Update component usage - remove this measure from all components that reference it
        // IMPORTANT: Components are NOT deleted, only their usage count is decremented
        if (measure) {
          try {
            const { useComponentLibraryStore } = await import('./componentLibraryStore');
            const componentStore = useComponentLibraryStore.getState();

            // Collect all libraryComponentIds from the measure
            const collectComponentIds = (node: any): string[] => {
              if (!node) return [];
              if ('operator' in node && 'children' in node) {
                return node.children.flatMap(collectComponentIds);
              }
              // It's a DataElement - check for libraryComponentId
              return node.libraryComponentId ? [node.libraryComponentId] : [];
            };

            const componentIds = new Set<string>();
            for (const pop of measure.populations) {
              if (pop.criteria) {
                const ids = collectComponentIds(pop.criteria);
                ids.forEach((cid) => componentIds.add(cid));
              }
            }

            // Remove usage for each component (decrement, don't delete)
            for (const componentId of componentIds) {
              componentStore.removeUsage(componentId, id);
            }

            console.log(`Updated usage for ${componentIds.size} components after deleting measure ${id}`);
          } catch (error) {
            console.error('Failed to update component usage after measure delete:', error);
          }
        }

        // Always update local state
        set((state) => ({
          measures: state.measures.filter((m) => m.id !== id),
          activeMeasureId: state.activeMeasureId === id ? null : state.activeMeasureId,
        }));
      },

      setActiveMeasure: (id) => set({ activeMeasureId: id, activeTab: id ? 'editor' : 'library' }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setEditorSection: (section) => set({ editorSection: section }),
      setUploadProgress: (progress) => set({ uploadProgress: progress }),
      setIsUploading: (uploading) => set({ isUploading: uploading }),
      setSelectedCodeFormat: (format) => set({ selectedCodeFormat: format }),

      updateReviewStatus: (measureId, componentId, status, notes) =>
        set((state) => {
          // First pass: update the specific component
          const updateComponent = (obj: any): any => {
            if (!obj) return obj;
            if (obj.id === componentId) {
              return { ...obj, reviewStatus: status, reviewNotes: notes };
            }
            if (obj.criteria) {
              return { ...obj, criteria: updateComponent(obj.criteria) };
            }
            if (obj.children) {
              return { ...obj, children: obj.children.map(updateComponent) };
            }
            return obj;
          };

          // Second pass: auto-approve parents if all children are approved
          const autoApproveParents = (obj: any): any => {
            if (!obj) return obj;

            // First, recursively process children
            let updated = obj;
            if (updated.criteria) {
              updated = { ...updated, criteria: autoApproveParents(updated.criteria) };
            }
            if (updated.children) {
              updated = { ...updated, children: updated.children.map(autoApproveParents) };
            }

            // Check if this node has children and all are approved
            const children = updated.children || (updated.criteria ? [updated.criteria] : []);
            if (children.length > 0) {
              const allChildrenApproved = children.every((child: any) => {
                if (!child) return true;
                // Check the child's status
                if (child.reviewStatus !== 'approved') return false;
                // Also check nested children recursively
                const nestedChildren = child.children || (child.criteria ? [child.criteria] : []);
                return nestedChildren.length === 0 || nestedChildren.every((nc: any) => nc?.reviewStatus === 'approved');
              });

              // If all children are approved, auto-approve this parent (if not already)
              if (allChildrenApproved && updated.reviewStatus === 'pending') {
                updated = { ...updated, reviewStatus: 'approved' as ReviewStatus };
              }
            }

            return updated;
          };

          return {
            measures: state.measures.map((m) => {
              if (m.id !== measureId) return m;
              // First update the component, then auto-approve parents
              const updatedPops = m.populations.map(updateComponent);
              const finalPops = updatedPops.map(autoApproveParents);
              return {
                ...m,
                populations: finalPops,
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      approveAllLowComplexity: (measureId) =>
        set((state) => {
          const approveLowComplexity = (obj: any): any => {
            if (!obj) return obj;
            // For data elements (leaf nodes with type), check complexity
            const isDataElement = obj.type && !obj.operator;
            let updated = obj;
            if (isDataElement && obj.reviewStatus === 'pending') {
              const complexity = calculateDataElementComplexity(obj);
              if (complexity === 'low') {
                updated = { ...obj, reviewStatus: 'approved' as ReviewStatus };
              }
            }
            if (updated.criteria) {
              return { ...updated, criteria: approveLowComplexity(updated.criteria) };
            }
            if (updated.children) {
              return { ...updated, children: updated.children.map(approveLowComplexity) };
            }
            return updated;
          };

          // Auto-approve parents if all children are approved
          const autoApproveParents = (obj: any): any => {
            if (!obj) return obj;

            let updated = obj;
            if (updated.criteria) {
              updated = { ...updated, criteria: autoApproveParents(updated.criteria) };
            }
            if (updated.children) {
              updated = { ...updated, children: updated.children.map(autoApproveParents) };
            }

            const children = updated.children || (updated.criteria ? [updated.criteria] : []);
            if (children.length > 0) {
              const allChildrenApproved = children.every((child: any) => {
                if (!child) return true;
                if (child.reviewStatus !== 'approved') return false;
                const nestedChildren = child.children || (child.criteria ? [child.criteria] : []);
                return nestedChildren.length === 0 || nestedChildren.every((nc: any) => nc?.reviewStatus === 'approved');
              });

              if (allChildrenApproved && updated.reviewStatus === 'pending') {
                updated = { ...updated, reviewStatus: 'approved' as ReviewStatus };
              }
            }

            return updated;
          };

          return {
            measures: state.measures.map((m) => {
              if (m.id !== measureId) return m;
              const approvedPops = m.populations.map(approveLowComplexity);
              const finalPops = approvedPops.map(autoApproveParents);
              return {
                ...m,
                populations: finalPops,
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      lockMeasure: (measureId) =>
        set((state) => ({
          measures: state.measures.map((m) =>
            m.id === measureId
              ? { ...m, lockedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
              : m
          ),
        })),

      unlockMeasure: (measureId) =>
        set((state) => ({
          measures: state.measures.map((m) =>
            m.id === measureId
              ? { ...m, lockedAt: undefined, lockedBy: undefined, updatedAt: new Date().toISOString() }
              : m
          ),
        })),

      isMeasureLocked: (measureId) => {
        const measure = get().measures.find((m) => m.id === measureId);
        return !!measure?.lockedAt;
      },

      setMeasureStatus: (measureId, status) =>
        set((state) => ({
          measures: state.measures.map((m) =>
            m.id === measureId
              ? { ...m, status, updatedAt: new Date().toISOString() }
              : m
          ),
        })),

      addValidationTrace: (trace) =>
        set((state) => ({
          validationTraces: [...state.validationTraces, trace],
        })),

      setActiveTrace: (id) => set({ activeTraceId: id }),

      // Value set editing with correction tracking
      addCodeToValueSet: (measureId, valueSetId, code, userNotes) =>
        set((state) => {
          const measure = state.measures.find((m) => m.id === measureId);
          if (!measure) return state;

          const valueSet = measure.valueSets.find((vs) => vs.id === valueSetId);
          const originalCodes = valueSet?.codes ? [...valueSet.codes] : [];

          // Create correction record
          const correction: MeasureCorrection = {
            id: `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            correctionType: 'code_added',
            componentId: valueSetId,
            componentPath: `valueSets[${measure.valueSets.findIndex((vs) => vs.id === valueSetId)}].codes`,
            originalValue: originalCodes,
            correctedValue: [...originalCodes, code],
            userNotes,
            measureContext: {
              measureId: measure.metadata.measureId,
              measureType: measure.metadata.measureType,
              program: measure.metadata.program,
            },
          };

          return {
            measures: state.measures.map((m) => {
              if (m.id !== measureId) return m;
              return {
                ...m,
                valueSets: m.valueSets.map((vs) =>
                  vs.id === valueSetId
                    ? { ...vs, codes: [...(vs.codes || []), code] }
                    : vs
                ),
                corrections: [...(m.corrections || []), correction],
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      removeCodeFromValueSet: (measureId, valueSetId, codeValue, userNotes) =>
        set((state) => {
          const measure = state.measures.find((m) => m.id === measureId);
          if (!measure) return state;

          const valueSet = measure.valueSets.find((vs) => vs.id === valueSetId);
          const originalCodes = valueSet?.codes ? [...valueSet.codes] : [];
          const removedCode = originalCodes.find((c) => c.code === codeValue);
          const newCodes = originalCodes.filter((c) => c.code !== codeValue);

          const correction: MeasureCorrection = {
            id: `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            correctionType: 'code_removed',
            componentId: valueSetId,
            componentPath: `valueSets[${measure.valueSets.findIndex((vs) => vs.id === valueSetId)}].codes`,
            originalValue: removedCode,
            correctedValue: null,
            userNotes,
            measureContext: {
              measureId: measure.metadata.measureId,
              measureType: measure.metadata.measureType,
              program: measure.metadata.program,
            },
          };

          return {
            measures: state.measures.map((m) => {
              if (m.id !== measureId) return m;
              return {
                ...m,
                valueSets: m.valueSets.map((vs) =>
                  vs.id === valueSetId
                    ? { ...vs, codes: newCodes }
                    : vs
                ),
                corrections: [...(m.corrections || []), correction],
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      updateDataElement: (measureId, componentId, updates, correctionType, userNotes) =>
        set((state) => {
          const measure = state.measures.find((m) => m.id === measureId);
          if (!measure) return state;

          // Find and capture original value
          let originalValue: any = null;
          let componentPath = '';

          const findAndCapture = (obj: any, path: string): boolean => {
            if (obj?.id === componentId) {
              originalValue = { ...obj };
              componentPath = path;
              return true;
            }
            if (obj?.criteria) {
              if (findAndCapture(obj.criteria, `${path}.criteria`)) return true;
            }
            if (obj?.children) {
              for (let i = 0; i < obj.children.length; i++) {
                if (findAndCapture(obj.children[i], `${path}.children[${i}]`)) return true;
              }
            }
            return false;
          };

          for (let i = 0; i < measure.populations.length; i++) {
            if (findAndCapture(measure.populations[i], `populations[${i}]`)) break;
          }

          const correction: MeasureCorrection = {
            id: `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            correctionType,
            componentId,
            componentPath,
            originalValue,
            correctedValue: { ...originalValue, ...updates },
            userNotes,
            measureContext: {
              measureId: measure.metadata.measureId,
              measureType: measure.metadata.measureType,
              program: measure.metadata.program,
            },
          };

          const updateComponent = (obj: any): any => {
            if (!obj) return obj;
            if (obj.id === componentId) {
              return { ...obj, ...updates };
            }
            if (obj.criteria) {
              return { ...obj, criteria: updateComponent(obj.criteria) };
            }
            if (obj.children) {
              return { ...obj, children: obj.children.map(updateComponent) };
            }
            return obj;
          };

          return {
            measures: state.measures.map((m) => {
              if (m.id !== measureId) return m;
              return {
                ...m,
                populations: m.populations.map(updateComponent),
                corrections: [...(m.corrections || []), correction],
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      // Global constraint synchronization - updates age everywhere in the measure
      syncAgeRange: (measureId, minAge, maxAge) =>
        set((state) => {
          const measure = state.measures.find((m) => m.id === measureId);
          if (!measure) return state;

          // Use the centralized sync utility to update all age references
          const syncedMeasure = syncAgeConstraints(measure, minAge, maxAge);

          return {
            measures: state.measures.map((m) =>
              m.id === measureId ? syncedMeasure : m
            ),
          };
        }),

      // Component builder: add a new component to a population's criteria
      addComponentToPopulation: (measureId, populationId, component, logicOperator) =>
        set((state) => ({
          measures: state.measures.map((m) => {
            if (m.id !== measureId) return m;
            return {
              ...m,
              populations: m.populations.map((pop) => {
                if (pop.id !== populationId) return pop;

                if (!pop.criteria) {
                  // No criteria yet — create a new clause with the chosen operator
                  return {
                    ...pop,
                    criteria: {
                      id: `${pop.type}-criteria-new`,
                      operator: (logicOperator || 'AND') as 'AND' | 'OR',
                      description: 'Criteria',
                      confidence: 'high' as const,
                      reviewStatus: 'pending' as const,
                      children: [component],
                    },
                  };
                }

                const criteria = pop.criteria;

                // If chosen operator matches the top-level, just append
                if (!logicOperator || criteria.operator === logicOperator) {
                  return {
                    ...pop,
                    criteria: {
                      ...criteria,
                      children: [...(criteria.children || []), component],
                    },
                  };
                }

                // Operator differs — find or create a subclause with the chosen operator
                const existingSubclause = criteria.children.find(
                  (c: any) => 'operator' in c && c.operator === logicOperator
                );

                if (existingSubclause && 'children' in existingSubclause) {
                  // Append to the existing subclause
                  return {
                    ...pop,
                    criteria: {
                      ...criteria,
                      children: criteria.children.map((c: any) =>
                        c.id === existingSubclause.id
                          ? { ...c, children: [...(c as any).children, component] }
                          : c
                      ),
                    },
                  };
                }

                // Create a new subclause with the chosen operator
                const newSubclause = {
                  id: `${pop.type}-${logicOperator.toLowerCase()}-${Date.now()}`,
                  operator: logicOperator as 'AND' | 'OR',
                  description: logicOperator === 'OR' ? 'Alternative Criteria' : 'Additional Criteria',
                  confidence: 'high' as const,
                  reviewStatus: 'pending' as const,
                  children: [component],
                };

                return {
                  ...pop,
                  criteria: {
                    ...criteria,
                    children: [...criteria.children, newSubclause],
                  },
                };
              }),
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      // Component builder: delete a component from a population
      deleteComponentFromPopulation: (measureId, populationId, componentId) =>
        set((state) => ({
          measures: state.measures.map((m) => {
            if (m.id !== measureId) return m;

            const removeComponent = (children: any[]): any[] =>
              children.filter((c) => c.id !== componentId).map((c) => ({
                ...c,
                children: c.children ? removeComponent(c.children) : undefined,
              }));

            return {
              ...m,
              populations: m.populations.map((pop) => {
                if (pop.id !== populationId || !pop.criteria) return pop;
                return {
                  ...pop,
                  criteria: {
                    ...pop.criteria,
                    children: removeComponent(pop.criteria.children || []),
                  },
                };
              }),
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      // Component builder: add a new value set to the measure
      addValueSet: (measureId, valueSet) =>
        set((state) => ({
          measures: state.measures.map((m) => {
            if (m.id !== measureId) return m;
            return {
              ...m,
              valueSets: [...m.valueSets, valueSet],
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      // Toggle AND/OR/NOT logical operator
      toggleLogicalOperator: (measureId, clauseId) =>
        set((state) => {
          const toggleOperator = (obj: any): any => {
            if (!obj) return obj;
            if (obj.id === clauseId && 'operator' in obj) {
              // Cycle through: AND -> OR -> NOT -> AND
              const newOperator = obj.operator === 'AND' ? 'OR' : obj.operator === 'OR' ? 'NOT' : 'AND';
              return { ...obj, operator: newOperator };
            }
            if (obj.criteria) {
              return { ...obj, criteria: toggleOperator(obj.criteria) };
            }
            if (obj.children) {
              return { ...obj, children: obj.children.map(toggleOperator) };
            }
            return obj;
          };

          return {
            measures: state.measures.map((m) => {
              if (m.id !== measureId) return m;
              return {
                ...m,
                populations: m.populations.map(toggleOperator),
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      // Reorder a component within its parent (move up/down)
      reorderComponent: (measureId, parentClauseId, componentId, direction) =>
        set((state) => {
          const reorder = (obj: any): any => {
            if (!obj) return obj;

            // Check if this is the parent clause
            if (obj.id === parentClauseId && obj.children) {
              const children = [...obj.children];
              const idx = children.findIndex((c: any) => c.id === componentId);
              if (idx === -1) return obj;

              const newIdx = direction === 'up' ? idx - 1 : idx + 1;
              if (newIdx < 0 || newIdx >= children.length) return obj;

              // Swap elements
              [children[idx], children[newIdx]] = [children[newIdx], children[idx]];
              return { ...obj, children };
            }

            if (obj.criteria) {
              return { ...obj, criteria: reorder(obj.criteria) };
            }
            if (obj.children) {
              return { ...obj, children: obj.children.map(reorder) };
            }
            return obj;
          };

          return {
            measures: state.measures.map((m) => {
              if (m.id !== measureId) return m;
              return {
                ...m,
                populations: m.populations.map(reorder),
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      // Move a component to a specific index within its parent clause (for drag-and-drop)
      moveComponentToIndex: (measureId, parentClauseId, componentId, targetIndex) =>
        set((state) => {
          const moveInTree = (obj: any): any => {
            if (!obj) return obj;

            if (obj.id === parentClauseId && obj.children) {
              const children = [...obj.children];
              const fromIdx = children.findIndex((c: any) => c.id === componentId);
              if (fromIdx === -1 || fromIdx === targetIndex) return obj;

              const [moved] = children.splice(fromIdx, 1);
              children.splice(targetIndex, 0, moved);
              return { ...obj, children };
            }

            if (obj.criteria) {
              return { ...obj, criteria: moveInTree(obj.criteria) };
            }
            if (obj.children) {
              return { ...obj, children: obj.children.map(moveInTree) };
            }
            return obj;
          };

          return {
            measures: state.measures.map((m) => {
              if (m.id !== measureId) return m;
              return {
                ...m,
                populations: m.populations.map(moveInTree),
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      // Set operator between two specific siblings in a clause
      setOperatorBetweenSiblings: (measureId, clauseId, index1, index2, operator) =>
        set((state) => {
          const updateClause = (obj: any): any => {
            if (!obj) return obj;

            if (obj.id === clauseId && 'operator' in obj && 'children' in obj) {
              return setOperatorBetween(obj, index1, index2, operator);
            }

            if (obj.criteria) {
              return { ...obj, criteria: updateClause(obj.criteria) };
            }
            if (obj.children) {
              return { ...obj, children: obj.children.map(updateClause) };
            }
            return obj;
          };

          return {
            measures: state.measures.map((m) => {
              if (m.id !== measureId) return m;
              return {
                ...m,
                populations: m.populations.map(updateClause),
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      // Delete a component from anywhere in the tree
      deleteComponent: (measureId, componentId) =>
        set((state) => {
          const removeFromTree = (obj: any): any => {
            if (!obj) return obj;

            if (obj.criteria) {
              // If criteria is the component to delete, set to null
              if (obj.criteria.id === componentId) {
                return { ...obj, criteria: null };
              }
              return { ...obj, criteria: removeFromTree(obj.criteria) };
            }

            if (obj.children) {
              const filteredChildren = obj.children
                .filter((c: any) => c.id !== componentId)
                .map(removeFromTree);
              return { ...obj, children: filteredChildren };
            }

            return obj;
          };

          return {
            measures: state.measures.map((m) => {
              if (m.id !== measureId) return m;
              return {
                ...m,
                populations: m.populations.map(removeFromTree),
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      updateTimingOverride: (measureId, componentId, modified) =>
        set((state) => {
          const updateComponent = (obj: any): any => {
            if (!obj) return obj;
            if (obj.id === componentId) {
              // If the component has a timingOverride, update it
              if (obj.timingOverride) {
                return {
                  ...obj,
                  timingOverride: {
                    ...obj.timingOverride,
                    modified,
                    modifiedAt: modified ? new Date().toISOString() : null,
                    modifiedBy: modified ? 'user' : null,
                  },
                };
              }
              return obj;
            }
            if (obj.criteria) {
              return { ...obj, criteria: updateComponent(obj.criteria) };
            }
            if (obj.children) {
              return { ...obj, children: obj.children.map(updateComponent) };
            }
            return obj;
          };

          return {
            measures: state.measures.map((m) => {
              if (m.id !== measureId) return m;
              return {
                ...m,
                populations: m.populations.map(updateComponent),
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      updateTimingWindow: (measureId, componentId, modified) =>
        set((state) => {
          const updateComponent = (obj: any): any => {
            if (!obj) return obj;
            if (obj.id === componentId) {
              // If the component has a timingWindow, update it
              if (obj.timingWindow) {
                return {
                  ...obj,
                  timingWindow: {
                    ...obj.timingWindow,
                    modified,
                    modifiedAt: modified ? new Date().toISOString() : null,
                    modifiedBy: modified ? 'user' : null,
                  },
                };
              }
              return obj;
            }
            if (obj.criteria) {
              return { ...obj, criteria: updateComponent(obj.criteria) };
            }
            if (obj.children) {
              return { ...obj, children: obj.children.map(updateComponent) };
            }
            return obj;
          };

          return {
            measures: state.measures.map((m) => {
              if (m.id !== measureId) return m;
              return {
                ...m,
                populations: m.populations.map(updateComponent),
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      updateMeasurementPeriod: (measureId, start, end) =>
        set((state) => ({
          measures: state.measures.map((m) => {
            if (m.id !== measureId) return m;
            return {
              ...m,
              metadata: {
                ...m.metadata,
                measurementPeriod: {
                  ...m.metadata.measurementPeriod,
                  start,
                  end,
                },
              },
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      addCorrection: (measureId, correction) =>
        set((state) => ({
          measures: state.measures.map((m) => {
            if (m.id !== measureId) return m;
            const fullCorrection: MeasureCorrection = {
              ...correction,
              id: `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
            };
            return {
              ...m,
              corrections: [...(m.corrections || []), fullCorrection],
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      exportCorrections: (measureId) => {
        const measure = get().measures.find((m) => m.id === measureId);
        if (!measure || !measure.corrections?.length) return null;

        const byType: Record<string, number> = {};
        const byPopulation: Record<string, number> = {};

        measure.corrections.forEach((c) => {
          byType[c.correctionType] = (byType[c.correctionType] || 0) + 1;
          if (c.measureContext.populationType) {
            byPopulation[c.measureContext.populationType] = (byPopulation[c.measureContext.populationType] || 0) + 1;
          }
        });

        return {
          exportedAt: new Date().toISOString(),
          measureId: measure.metadata.measureId,
          measureTitle: measure.metadata.title,
          totalCorrections: measure.corrections.length,
          corrections: measure.corrections,
          summary: {
            byType: byType as Record<CorrectionType, number>,
            byPopulation,
          },
        };
      },

      getActiveMeasure: () => {
        const state = get();
        return state.measures.find((m) => m.id === state.activeMeasureId) || null;
      },

      getReviewProgress: (measureId) => {
        const measure = get().measures.find((m) => m.id === measureId);
        if (!measure) return { total: 0, approved: 0, pending: 0, flagged: 0 };

        let total = 0, approved = 0, pending = 0, flagged = 0;

        const countStatus = (obj: any) => {
          if (!obj) return;
          if (obj.reviewStatus) {
            total++;
            if (obj.reviewStatus === 'approved') approved++;
            else if (obj.reviewStatus === 'pending') pending++;
            else if (obj.reviewStatus === 'flagged' || obj.reviewStatus === 'needs_revision') flagged++;
          }
          if (obj.criteria) countStatus(obj.criteria);
          if (obj.children) obj.children.forEach(countStatus);
        };

        measure.populations.forEach(countStatus);
        return { total, approved, pending, flagged };
      },

      getCorrections: (measureId) => {
        const measure = get().measures.find((m) => m.id === measureId);
        return measure?.corrections || [];
      },
    })
);

/**
 * Convert UMS format to the import format expected by the backend.
 * Backend expects a specific structure for populations with rootClause instead of criteria.
 */
function convertUmsToImportFormat(ums: UniversalMeasureSpec): Record<string, unknown> {
  const mapPopulationType = (type: string): string => {
    const mapping: Record<string, string> = {
      'initial-population': 'INITIAL_POPULATION',
      'denominator': 'DENOMINATOR',
      'denominator-exclusion': 'DENOMINATOR_EXCLUSION',
      'denominator-exception': 'DENOMINATOR_EXCEPTION',
      'numerator': 'NUMERATOR',
      'numerator-exclusion': 'NUMERATOR_EXCLUSION',
      'measure-population': 'MEASURE_POPULATION',
      'measure-observation': 'MEASURE_OBSERVATION',
    };
    return mapping[type] || type.toUpperCase().replace(/-/g, '_');
  };

  const mapElementType = (type: string): string => {
    const mapping: Record<string, string> = {
      'diagnosis': 'DIAGNOSIS',
      'encounter': 'ENCOUNTER',
      'procedure': 'PROCEDURE',
      'observation': 'OBSERVATION',
      'medication': 'MEDICATION',
      'immunization': 'IMMUNIZATION',
      'demographic': 'DEMOGRAPHIC',
      'device': 'DEVICE',
      'assessment': 'ASSESSMENT',
      'allergy': 'ALLERGY',
    };
    return mapping[type] || type.toUpperCase();
  };

  const convertClause = (clause: import('../types/ums').LogicalClause): Record<string, unknown> => {
    const dataElements: Record<string, unknown>[] = [];
    const childClauses: Record<string, unknown>[] = [];

    if (clause.children) {
      clause.children.forEach((child, idx) => {
        if ('operator' in child) {
          // Nested clause
          childClauses.push(convertClause(child as import('../types/ums').LogicalClause));
        } else {
          // Data element
          const de = child as import('../types/ums').DataElement;
          dataElements.push({
            id: de.id,
            elementType: mapElementType(de.type),
            resourceType: de.type,
            description: de.description || '',
            libraryComponentId: de.libraryComponentId || null,
            negation: de.negation || false,
            negationRationale: de.negationRationale || null,
            confidence: (de.confidence || 'MEDIUM').toUpperCase(),
            reviewStatus: (de.reviewStatus || 'PENDING').toUpperCase(),
            displayOrder: idx,
            thresholds: de.thresholds || null,
          });
        }
      });
    }

    return {
      id: clause.id,
      operator: clause.operator || 'AND',
      description: clause.description || '',
      displayOrder: 0,
      children: childClauses,
      dataElements,
    };
  };

  return {
    id: ums.id,
    measureId: ums.metadata.measureId,
    title: ums.metadata.title,
    version: ums.metadata.version || '1.0',
    steward: ums.metadata.steward || '',
    program: ums.metadata.program || 'Custom',
    measureType: ums.metadata.measureType || 'process',
    description: ums.metadata.description || '',
    rationale: ums.metadata.rationale || '',
    clinicalRecommendation: ums.metadata.clinicalRecommendation || '',
    periodStart: ums.metadata.measurementPeriod?.start || `${new Date().getFullYear()}-01-01`,
    periodEnd: ums.metadata.measurementPeriod?.end || `${new Date().getFullYear()}-12-31`,
    globalConstraints: ums.globalConstraints ? {
      ageMin: ums.globalConstraints.ageRange?.min ?? null,
      ageMax: ums.globalConstraints.ageRange?.max ?? null,
      gender: ums.globalConstraints.gender || 'any',
    } : null,
    status: (ums.status || 'in_progress').toUpperCase().replace(/_/g, '_'),
    overallConfidence: (ums.overallConfidence || 'MEDIUM').toUpperCase(),
    populations: ums.populations.map((pop, idx) => ({
      id: pop.id,
      populationType: mapPopulationType(pop.type),
      description: pop.description || '',
      narrative: pop.narrative || '',
      displayOrder: idx,
      confidence: (pop.confidence || 'MEDIUM').toUpperCase(),
      reviewStatus: (pop.reviewStatus || 'PENDING').toUpperCase(),
      rootClause: pop.criteria ? convertClause(pop.criteria) : null,
    })),
    valueSets: ums.valueSets.map(vs => ({
      id: vs.id,
      oid: vs.oid || '',
      name: vs.name,
      version: vs.version || '',
      publisher: vs.publisher || '',
      purpose: vs.purpose || '',
      verified: vs.verified || false,
      codes: (vs.codes || []).map(c => ({
        code: c.code,
        system: c.system || 'SNOMED',
        display: c.display || '',
      })),
    })),
    corrections: [],
  };
}
