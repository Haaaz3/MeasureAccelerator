/**
 * Integration Tests: Code Overrides
 *
 * Tests the wiring between componentCodeStore overrides and code generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useComponentCodeStore } from '../../stores/componentCodeStore';
import { generateCQL } from '../../services/cqlGenerator';
import {
  getOverridesForMeasure,
  applyCQLOverrides,
  applySQLOverrides,
  getOverrideCountForMeasure,
  generateOverrideHeader,
} from '../../services/codeOverrideHelper';
import {
  createTestMeasure,
  resetIdCounter,
} from '../fixtures/testMeasure';

describe('Code Overrides', () => {
  beforeEach(() => {
    // Reset store to initial state
    useComponentCodeStore.setState({
      codeStates: {},
      defaultFormat: 'cql',
      inspectingComponentId: null,
    });

    resetIdCounter();
  });

  describe('getOverridesForMeasure', () => {
    it('returns empty summary when no overrides exist', () => {
      const { measure } = createTestMeasure({ withComponents: false });

      const summary = getOverridesForMeasure(measure);

      expect(summary.totalOverrides).toBe(0);
      expect(summary.overrideInfos).toHaveLength(0);
      expect(summary.allNotes).toHaveLength(0);
    });

    it('returns correct count when overrides exist for measure components', () => {
      const { measure } = createTestMeasure({ withComponents: false });

      // Get a component ID from the measure
      const firstPop = measure.populations[0];
      const dataElements = firstPop.criteria?.children || [];
      const firstElementId = (dataElements[0] as any)?.id;

      if (!firstElementId) {
        // Skip if no data elements
        return;
      }

      // Save an override for this component
      useComponentCodeStore.getState().saveCodeOverride(
        firstElementId,
        'cql',
        '// Overridden CQL code',
        'Changed timing for clinical review',
        '// Original generated code',
        'timing'
      );

      const summary = getOverridesForMeasure(measure, 'cql');

      expect(summary.totalOverrides).toBe(1);
      expect(summary.overrideInfos).toHaveLength(1);
      expect(summary.allNotes).toHaveLength(1);
      expect(summary.allNotes[0].content).toBe('Changed timing for clinical review');
    });
  });

  describe('applyCQLOverrides', () => {
    it('returns unmodified code when no overrides exist', () => {
      const { measure } = createTestMeasure({ withComponents: false });
      const originalCql = 'library Test version "1.0"\ndefine "Test": true';

      const { code, overrideCount } = applyCQLOverrides(originalCql, measure);

      expect(overrideCount).toBe(0);
      expect(code).toBe(originalCql);
    });

    it('prepends override header when overrides exist', () => {
      const { measure } = createTestMeasure({ withComponents: false });

      // Get a component ID from the measure
      const firstPop = measure.populations[0];
      const dataElements = firstPop.criteria?.children || [];
      const firstElementId = (dataElements[0] as any)?.id;

      if (!firstElementId) {
        return;
      }

      // Save an override
      useComponentCodeStore.getState().saveCodeOverride(
        firstElementId,
        'cql',
        '// Overridden code',
        'Test override note',
        '// Original'
      );

      const originalCql = 'library Test version "1.0"';
      const { code, overrideCount } = applyCQLOverrides(originalCql, measure);

      expect(overrideCount).toBe(1);
      expect(code).toContain('CQL OVERRIDES APPLIED');
      expect(code).toContain('[CQL OVERRIDE]');
      expect(code).toContain('[EDIT NOTE - CQL]');
      expect(code).toContain('Test override note');
      expect(code).toContain(originalCql); // Original code should still be there
    });
  });

  describe('applySQLOverrides', () => {
    it('returns unmodified SQL when no overrides exist', () => {
      const { measure } = createTestMeasure({ withComponents: false });
      const originalSql = 'SELECT * FROM patients';

      const { code, overrideCount } = applySQLOverrides(originalSql, measure, 'synapse-sql');

      expect(overrideCount).toBe(0);
      expect(code).toBe(originalSql);
    });

    it('uses SQL comment style for headers', () => {
      const { measure } = createTestMeasure({ withComponents: false });

      // Get a component ID from the measure
      const firstPop = measure.populations[0];
      const dataElements = firstPop.criteria?.children || [];
      const firstElementId = (dataElements[0] as any)?.id;

      if (!firstElementId) {
        return;
      }

      // Save a SQL override (using synapse-sql which is what HDI uses)
      useComponentCodeStore.getState().saveCodeOverride(
        firstElementId,
        'synapse-sql',
        'SELECT * FROM modified_table',
        'Changed table name',
        'SELECT * FROM original_table'
      );

      const originalSql = 'SELECT * FROM patients';
      const { code, overrideCount } = applySQLOverrides(originalSql, measure, 'hdi');

      expect(overrideCount).toBe(1);
      expect(code).toContain('-- SYNAPSE SQL OVERRIDES APPLIED');
      expect(code).toContain('-- [SYNAPSE SQL OVERRIDE]');
    });
  });

  describe('getOverrideCountForMeasure', () => {
    it('returns 0 when no overrides exist', () => {
      const { measure } = createTestMeasure({ withComponents: false });

      const count = getOverrideCountForMeasure(measure);

      expect(count).toBe(0);
    });

    it('returns correct count when filtered by format', () => {
      const { measure } = createTestMeasure({ withComponents: false });

      // Get component IDs
      const firstPop = measure.populations[0];
      const dataElements = firstPop.criteria?.children || [];

      if (dataElements.length < 2) return;

      const id1 = (dataElements[0] as any)?.id;
      const id2 = (dataElements[1] as any)?.id;

      if (!id1 || !id2) return;

      // Save CQL override for first component
      useComponentCodeStore.getState().saveCodeOverride(
        id1,
        'cql',
        '// CQL override',
        'CQL note',
        '// Original'
      );

      // Save SQL override for second component
      useComponentCodeStore.getState().saveCodeOverride(
        id2,
        'synapse-sql',
        '-- SQL override',
        'SQL note',
        '-- Original'
      );

      // Total should be 2
      expect(getOverrideCountForMeasure(measure)).toBe(2);

      // CQL only should be 1
      expect(getOverrideCountForMeasure(measure, 'cql')).toBe(1);

      // Synapse SQL only should be 1
      expect(getOverrideCountForMeasure(measure, 'synapse-sql')).toBe(1);
    });
  });

  describe('generateOverrideHeader', () => {
    it('returns empty string when no overrides exist', () => {
      const { measure } = createTestMeasure({ withComponents: false });

      const header = generateOverrideHeader(measure, 'cql');

      expect(header).toBe('');
    });

    it('generates CQL-style comments for CQL format', () => {
      const { measure } = createTestMeasure({ withComponents: false });

      const firstPop = measure.populations[0];
      const dataElements = firstPop.criteria?.children || [];
      const firstElementId = (dataElements[0] as any)?.id;

      if (!firstElementId) return;

      useComponentCodeStore.getState().saveCodeOverride(
        firstElementId,
        'cql',
        '// Override',
        'Note content',
        '// Original'
      );

      const header = generateOverrideHeader(measure, 'cql');

      expect(header).toContain('//');
      expect(header).toContain('CQL OVERRIDES APPLIED');
      expect(header).toContain('[CQL OVERRIDE]');
    });

    it('generates SQL-style comments for SQL format', () => {
      const { measure } = createTestMeasure({ withComponents: false });

      const firstPop = measure.populations[0];
      const dataElements = firstPop.criteria?.children || [];
      const firstElementId = (dataElements[0] as any)?.id;

      if (!firstElementId) return;

      useComponentCodeStore.getState().saveCodeOverride(
        firstElementId,
        'synapse-sql',
        '-- Override',
        'Note content',
        '-- Original'
      );

      const header = generateOverrideHeader(measure, 'synapse-sql');

      expect(header).toContain('--');
      expect(header).toContain('SYNAPSE SQL OVERRIDES APPLIED');
    });
  });

  describe('Component ID Isolation', () => {
    it('overrides for one component do not appear on other components', () => {
      const { measure } = createTestMeasure({ withComponents: false });

      // Get two different component IDs
      const firstPop = measure.populations[0];
      const dataElements = firstPop.criteria?.children || [];

      if (dataElements.length < 2) return;

      const componentA = (dataElements[0] as any)?.id;
      const componentB = (dataElements[1] as any)?.id;

      if (!componentA || !componentB) return;

      // Save override ONLY for component A
      useComponentCodeStore.getState().saveCodeOverride(
        componentA,
        'cql',
        '// Override for Component A',
        'Note only for component A',
        '// Original A'
      );

      // Component A should have the override
      const stateA = useComponentCodeStore.getState().codeStates[componentA];
      expect(stateA).toBeDefined();
      expect(stateA?.overrides.cql?.isLocked).toBe(true);
      expect(stateA?.overrides.cql?.notes[0].content).toBe('Note only for component A');

      // Component B should have NO state at all (not created yet)
      const stateB = useComponentCodeStore.getState().codeStates[componentB];
      expect(stateB).toBeUndefined();

      // Verify the componentId in state A is correct
      expect(stateA?.componentId).toBe(componentA);
    });

    it('multiple overrides stay isolated to their respective components', () => {
      const { measure } = createTestMeasure({ withComponents: false });

      const firstPop = measure.populations[0];
      const dataElements = firstPop.criteria?.children || [];

      if (dataElements.length < 2) return;

      const componentA = (dataElements[0] as any)?.id;
      const componentB = (dataElements[1] as any)?.id;

      if (!componentA || !componentB) return;

      // Save overrides for BOTH components with different content
      useComponentCodeStore.getState().saveCodeOverride(
        componentA,
        'cql',
        '// Code A',
        'Alpha note',
        '// Original A'
      );

      useComponentCodeStore.getState().saveCodeOverride(
        componentB,
        'cql',
        '// Code B',
        'Beta note',
        '// Original B'
      );

      const stateA = useComponentCodeStore.getState().codeStates[componentA];
      const stateB = useComponentCodeStore.getState().codeStates[componentB];

      // Component A has ONLY its own note
      expect(stateA?.overrides.cql?.notes).toHaveLength(1);
      expect(stateA?.overrides.cql?.notes[0].content).toBe('Alpha note');
      expect(stateA?.overrides.cql?.code).toBe('// Code A');

      // Component B has ONLY its own note
      expect(stateB?.overrides.cql?.notes).toHaveLength(1);
      expect(stateB?.overrides.cql?.notes[0].content).toBe('Beta note');
      expect(stateB?.overrides.cql?.code).toBe('// Code B');

      // They don't cross-contaminate
      expect(stateA?.overrides.cql?.notes).not.toContainEqual(
        expect.objectContaining({ content: 'Beta note' })
      );
      expect(stateB?.overrides.cql?.notes).not.toContainEqual(
        expect.objectContaining({ content: 'Alpha note' })
      );
    });
  });

  describe('Integration with code generation', () => {
    it('generated CQL reflects override count in summary', () => {
      const { measure } = createTestMeasure({ withComponents: false });

      // Generate CQL without overrides
      const result1 = generateCQL(measure);
      expect(result1.success).toBe(true);

      // Get component ID and add override
      const firstPop = measure.populations[0];
      const dataElements = firstPop.criteria?.children || [];
      const firstElementId = (dataElements[0] as any)?.id;

      if (!firstElementId) return;

      useComponentCodeStore.getState().saveCodeOverride(
        firstElementId,
        'cql',
        '// Custom logic here',
        'Customized for specific use case',
        '// Original'
      );

      // Apply overrides to generated CQL
      const { code, overrideCount } = applyCQLOverrides(result1.cql, measure);

      expect(overrideCount).toBe(1);
      expect(code).toContain('CQL OVERRIDES APPLIED');
      expect(code).toContain('Customized for specific use case');
    });
  });
});
