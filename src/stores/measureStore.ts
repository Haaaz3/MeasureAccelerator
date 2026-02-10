import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

export type CodeOutputFormat = 'cql' | 'synapse';

interface MeasureState {
  // Measures library
  measures: UniversalMeasureSpec[];
  activeMeasureId: string | null;

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

  // Actions
  addMeasure: (measure: UniversalMeasureSpec) => void;
  updateMeasure: (id: string, updates: Partial<UniversalMeasureSpec>) => void;
  batchUpdateMeasures: (updates: Array<{ id: string; updates: Partial<UniversalMeasureSpec> }>) => { success: boolean; error?: string };
  deleteMeasure: (id: string) => void;
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
  persist(
    (set, get) => ({
      measures: [],
      activeMeasureId: null,
      activeTab: 'library',
      editorSection: null,
      isUploading: false,
      uploadProgress: 0,
      selectedCodeFormat: 'cql',
      validationTraces: [],
      activeTraceId: null,

      addMeasure: (measure) =>
        set((state) => {
          // If measure already has resourceType, it's already formatted - don't migrate
          // This preserves copied measures exactly as they are
          const fhirMeasure = measure.resourceType === 'Measure'
            ? measure
            : needsMigration(measure)
              ? migrateMeasure(measure)
              : { ...measure, resourceType: 'Measure' as const };

          return {
            measures: [...state.measures, fhirMeasure],
            activeMeasureId: fhirMeasure.id,
            activeTab: 'editor',
          };
        }),

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

      deleteMeasure: (id) =>
        set((state) => ({
          measures: state.measures.filter((m) => m.id !== id),
          activeMeasureId: state.activeMeasureId === id ? null : state.activeMeasureId,
        })),

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
    }),
    {
      name: 'algo-accelerator-storage',
      partialize: (state) => ({
        measures: state.measures,
        validationTraces: state.validationTraces,
      }),
      // Auto-migrate measures on load from storage
      onRehydrateStorage: () => (state) => {
        if (state?.measures) {
          const migratedMeasures = state.measures.map((measure) => {
            if (needsMigration(measure)) {
              console.log(`Migrating measure ${measure.id} to FHIR-aligned schema`);
              return migrateMeasure(measure);
            }
            return measure;
          });
          state.measures = migratedMeasures;
        }
      },
    }
  )
);
