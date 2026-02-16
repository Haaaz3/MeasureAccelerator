/**
 * Integration Tests: Measure-Component Wiring
 *
 * Tests the wiring between measureStore and componentLibraryStore,
 * including rebuildUsageIndex, batchUpdateMeasures, mergeComponents,
 * and validateReferentialIntegrity.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useMeasureStore } from '../../stores/measureStore';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore';
import { validateReferentialIntegrity } from '../../utils/integrityCheck';
import {
  createTestMeasure,
  createTestComponent,
  resetIdCounter,
} from '../fixtures/testMeasure';

describe('Measure-Component Wiring', () => {
  beforeEach(() => {
    // Reset stores to initial state
    useMeasureStore.setState({
      measures: [],
      activeMeasureId: null,
      activeTab: 'library',
      editorSection: null,
      isUploading: false,
      uploadProgress: 0,
      selectedCodeFormat: 'cql',
      validationTraces: [],
      activeTraceId: null,
    });

    useComponentLibraryStore.setState({
      components: [],
      initialized: true,
      selectedComponentId: null,
      filters: { showArchived: true },
      editingComponentId: null,
      importMatcherState: null,
      mergeMode: false,
      selectedForMerge: new Set(),
    });

    resetIdCounter();
  });

  describe('rebuildUsageIndex', () => {
    it('adding a measure and calling rebuildUsageIndex updates usage counts on all linked components', () => {
      // Create test data
      const { measure, components } = createTestMeasure({ withComponents: true });

      // Add components to library store
      for (const comp of components) {
        useComponentLibraryStore.getState().addComponent(comp);
      }

      // Add measure to store
      useMeasureStore.getState().addMeasure(measure);

      // Get current state
      const measures = useMeasureStore.getState().measures;

      // Rebuild usage index
      useComponentLibraryStore.getState().rebuildUsageIndex(measures);

      // Verify usage counts are updated
      const libraryComponents = useComponentLibraryStore.getState().components;

      // Find components that should have usage
      const linkedComponentIds = new Set<string>();
      for (const pop of measure.populations) {
        if (pop.criteria && 'children' in pop.criteria) {
          for (const child of pop.criteria.children) {
            if ('libraryComponentId' in child && child.libraryComponentId) {
              linkedComponentIds.add(child.libraryComponentId);
            }
          }
        }
      }

      // Check that linked components have usage count > 0
      // Note: rebuildUsageIndex uses measure.id (internal ID), not metadata.measureId (display ID)
      for (const comp of libraryComponents) {
        if (linkedComponentIds.has(comp.id)) {
          expect(comp.usage.usageCount).toBeGreaterThan(0);
          expect(comp.usage.measureIds).toContain(measure.id);
        }
      }
    });

    it('deleting a measure and calling rebuildUsageIndex removes usage references from all components', () => {
      // Create test data
      const { measure, components } = createTestMeasure({ withComponents: true });

      // Add components with initial usage
      for (const comp of components) {
        const withUsage = {
          ...comp,
          usage: {
            ...comp.usage,
            measureIds: [measure.metadata.measureId],
            usageCount: 1,
          },
        };
        useComponentLibraryStore.getState().addComponent(withUsage);
      }

      // Add then delete measure
      useMeasureStore.getState().addMeasure(measure);
      useMeasureStore.getState().deleteMeasure(measure.id);

      // Rebuild usage index with empty measures
      const measures = useMeasureStore.getState().measures;
      useComponentLibraryStore.getState().rebuildUsageIndex(measures);

      // Verify all components have zero usage
      const libraryComponents = useComponentLibraryStore.getState().components;
      for (const comp of libraryComponents) {
        expect(comp.usage.usageCount).toBe(0);
        expect(comp.usage.measureIds).toHaveLength(0);
      }
    });
  });

  describe('mergeComponents', () => {
    it('returns error when fewer than 2 components selected', () => {
      const comp = createTestComponent({ id: 'comp-1' });
      useComponentLibraryStore.getState().addComponent(comp);

      const result = useComponentLibraryStore.getState().mergeComponents(
        ['comp-1'],
        'Merged Component'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least 2 components');
    });

    it('returns error when a component ID does not exist', () => {
      const comp = createTestComponent({ id: 'comp-1' });
      useComponentLibraryStore.getState().addComponent(comp);

      const result = useComponentLibraryStore.getState().mergeComponents(
        ['comp-1', 'comp-nonexistent'],
        'Merged Component'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error when a component is already archived', () => {
      const comp1 = createTestComponent({ id: 'comp-1' });
      const comp2 = createTestComponent({
        id: 'comp-2',
        versionInfo: {
          versionId: '1.0',
          versionHistory: [],
          status: 'archived',
        },
      });

      useComponentLibraryStore.getState().addComponent(comp1);
      useComponentLibraryStore.getState().addComponent(comp2);

      const result = useComponentLibraryStore.getState().mergeComponents(
        ['comp-1', 'comp-2'],
        'Merged Component'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('archived');
    });

    it('archives original components and creates new merged component', () => {
      const comp1 = createTestComponent({ id: 'comp-1', name: 'Component 1' });
      const comp2 = createTestComponent({ id: 'comp-2', name: 'Component 2' });

      useComponentLibraryStore.getState().addComponent(comp1);
      useComponentLibraryStore.getState().addComponent(comp2);

      const result = useComponentLibraryStore.getState().mergeComponents(
        ['comp-1', 'comp-2'],
        'Merged Component'
      );

      expect(result.success).toBe(true);
      expect(result.component).toBeDefined();
      expect(result.component?.name).toBe('Merged Component');

      // Check original components are archived
      const components = useComponentLibraryStore.getState().components;
      const original1 = components.find(c => c.id === 'comp-1');
      const original2 = components.find(c => c.id === 'comp-2');

      expect(original1?.versionInfo.status).toBe('archived');
      expect(original2?.versionInfo.status).toBe('archived');

      // Check merged component exists (note: merged components start as 'draft')
      const merged = components.find(c => c.id === result.component?.id);
      expect(merged).toBeDefined();
      expect(merged?.versionInfo.status).toBe('draft');
    });

    it('after merge, rebuildUsageIndex correctly counts usage for the merged component', () => {
      // Create measure and components
      const { measure, components } = createTestMeasure({ withComponents: true });

      // Add components
      for (const comp of components) {
        useComponentLibraryStore.getState().addComponent(comp);
      }

      // Add measure
      useMeasureStore.getState().addMeasure(measure);

      // Get first two component IDs for merging
      const [comp1, comp2] = components.slice(0, 2);

      // Merge components
      const mergeResult = useComponentLibraryStore.getState().mergeComponents(
        [comp1.id, comp2.id],
        'Merged Test Component'
      );

      expect(mergeResult.success).toBe(true);
      const mergedId = mergeResult.component!.id;

      // Update measure to reference the merged component
      const measures = useMeasureStore.getState().measures;
      const updatedMeasure = { ...measures[0] };

      // Update data elements to point to merged component
      for (const pop of updatedMeasure.populations) {
        if (pop.criteria && 'children' in pop.criteria) {
          for (const child of pop.criteria.children) {
            if ('libraryComponentId' in child) {
              if (child.libraryComponentId === comp1.id || child.libraryComponentId === comp2.id) {
                (child as any).libraryComponentId = mergedId;
              }
            }
          }
        }
      }

      useMeasureStore.getState().updateMeasure(updatedMeasure.id, updatedMeasure);

      // Rebuild usage index
      const updatedMeasures = useMeasureStore.getState().measures;
      useComponentLibraryStore.getState().rebuildUsageIndex(updatedMeasures);

      // Verify merged component has usage
      const mergedComp = useComponentLibraryStore.getState().getComponent(mergedId);
      expect(mergedComp?.usage.usageCount).toBeGreaterThan(0);
    });
  });

  describe('batchUpdateMeasures', () => {
    it('rejects entire batch if any measure ID does not exist', () => {
      const { measure } = createTestMeasure();
      useMeasureStore.getState().addMeasure(measure);

      const result = useMeasureStore.getState().batchUpdateMeasures([
        { id: measure.id, updates: { status: 'published' } },
        { id: 'nonexistent-id', updates: { status: 'published' } },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('nonexistent-id');

      // Verify original measure was NOT updated (atomic rollback)
      const measures = useMeasureStore.getState().measures;
      const originalMeasure = measures.find(m => m.id === measure.id);
      expect(originalMeasure?.status).toBe('in_progress');
    });

    it('applies all updates atomically in one state transition', () => {
      const { measure: measure1 } = createTestMeasure({ measureId: 'measure-1' });
      const { measure: measure2 } = createTestMeasure({ measureId: 'measure-2' });

      useMeasureStore.getState().addMeasure(measure1);
      useMeasureStore.getState().addMeasure(measure2);

      const result = useMeasureStore.getState().batchUpdateMeasures([
        { id: measure1.id, updates: { status: 'published' } },
        { id: measure2.id, updates: { status: 'published' } },
      ]);

      expect(result.success).toBe(true);

      const measures = useMeasureStore.getState().measures;
      const updated1 = measures.find(m => m.id === measure1.id);
      const updated2 = measures.find(m => m.id === measure2.id);

      expect(updated1?.status).toBe('published');
      expect(updated2?.status).toBe('published');
    });
  });

  describe('validateReferentialIntegrity', () => {
    it('returns zero mismatches after add measure, link, merge, delete sequence', () => {
      // Step 1: Create and add measure with components
      const { measure, components } = createTestMeasure({ withComponents: true });

      for (const comp of components) {
        useComponentLibraryStore.getState().addComponent(comp);
      }

      useMeasureStore.getState().addMeasure(measure);

      // Step 2: Rebuild usage index (link)
      let measures = useMeasureStore.getState().measures;
      useComponentLibraryStore.getState().rebuildUsageIndex(measures);

      // Verify no mismatches after linking
      let libraryComponents = useComponentLibraryStore.getState().components;
      let mismatches = validateReferentialIntegrity(measures, libraryComponents);
      expect(mismatches).toHaveLength(0);

      // Step 3: Merge two components
      const [comp1, comp2] = components.slice(0, 2);
      const mergeResult = useComponentLibraryStore.getState().mergeComponents(
        [comp1.id, comp2.id],
        'Merged Component'
      );
      expect(mergeResult.success).toBe(true);

      // Update measure references to point to merged component
      const mergedId = mergeResult.component!.id;
      measures = useMeasureStore.getState().measures;

      const updatedMeasure = JSON.parse(JSON.stringify(measures[0]));
      for (const pop of updatedMeasure.populations) {
        if (pop.criteria && 'children' in pop.criteria) {
          for (const child of pop.criteria.children) {
            if ('libraryComponentId' in child) {
              if (child.libraryComponentId === comp1.id || child.libraryComponentId === comp2.id) {
                child.libraryComponentId = mergedId;
              }
            }
          }
        }
      }

      useMeasureStore.getState().updateMeasure(updatedMeasure.id, updatedMeasure);

      // Rebuild usage index after merge
      measures = useMeasureStore.getState().measures;
      useComponentLibraryStore.getState().rebuildUsageIndex(measures);

      // Verify no mismatches after merge
      libraryComponents = useComponentLibraryStore.getState().components;
      mismatches = validateReferentialIntegrity(measures, libraryComponents);
      expect(mismatches).toHaveLength(0);

      // Step 4: Delete the measure
      useMeasureStore.getState().deleteMeasure(updatedMeasure.id);

      // Rebuild usage index after delete
      measures = useMeasureStore.getState().measures;
      useComponentLibraryStore.getState().rebuildUsageIndex(measures);

      // Final verification - no mismatches
      libraryComponents = useComponentLibraryStore.getState().components;
      mismatches = validateReferentialIntegrity(measures, libraryComponents);
      expect(mismatches).toHaveLength(0);
    });
  });
});
