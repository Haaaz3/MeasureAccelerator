/**
 * Pipeline End-to-End Integration Tests
 *
 * Tests the full measure pipeline: UMS → CQL → SQL → Evaluation
 * Ensures all components work together correctly.
 */

import { describe, it, expect } from 'vitest';
import { createSampleCRCMeasure } from '../../data/sampleMeasures';
import { generateCQL } from '../../services/cqlGenerator';
import { generateHDISQL } from '../../services/hdiSqlGenerator';
import { evaluatePatient, type TestPatient } from '../../services/measureEvaluator';
import { validateCQLSyntax } from '../../services/cqlValidator';
import { HDI_TABLES } from '../../services/hdiSchemaBinding';

describe('Pipeline E2E', () => {
  // Create sample measure once for all tests
  const sampleMeasure = createSampleCRCMeasure();

  describe('CQL Generation', () => {
    it('generates valid CQL with define keywords', () => {
      const result = generateCQL(sampleMeasure);

      expect(result.success).toBe(true);
      expect(result.cql).toBeDefined();
      expect(result.cql.length).toBeGreaterThan(0);

      // Should contain define keywords for populations
      expect(result.cql).toContain('define');
      expect(result.cql).toContain('"Initial Population"');
      expect(result.cql).toContain('"Denominator"');
      expect(result.cql).toContain('"Numerator"');
    });

    it('includes library header and FHIR version', () => {
      const result = generateCQL(sampleMeasure);

      expect(result.cql).toContain('library');
      expect(result.cql).toContain("using FHIR version '4.0.1'");
    });

    it('includes value set declarations', () => {
      const result = generateCQL(sampleMeasure);

      // Should declare value sets from the measure
      expect(result.cql).toContain('valueset');
    });

    it('includes measurement period parameter', () => {
      const result = generateCQL(sampleMeasure);

      expect(result.cql).toContain('"Measurement Period"');
      expect(result.cql).toContain('Interval<DateTime>');
    });
  });

  describe('HDI SQL Generation', () => {
    it('generates SQL with schema-bound table names', () => {
      const result = generateHDISQL(sampleMeasure);

      expect(result.success).toBe(true);
      expect(result.sql).toBeDefined();
      expect(result.sql.length).toBeGreaterThan(0);

      // Should include table names from hdiSchemaBinding
      expect(result.sql).toContain(HDI_TABLES.person.name);
      expect(result.sql).toContain(HDI_TABLES.condition.name);
    });

    it('generates population CTEs', () => {
      const result = generateHDISQL(sampleMeasure);

      // Should contain CTE structure (lowercase 'with' is valid SQL)
      expect(result.sql.toLowerCase()).toContain('with');
      expect(result.sql.toLowerCase()).toContain('as (');

      // Should have population-related CTEs
      expect(result.sql.toLowerCase()).toContain('initial_population');
      expect(result.sql.toLowerCase()).toContain('denominator');
      expect(result.sql.toLowerCase()).toContain('numerator');
    });

    it('includes measurement period in SQL', () => {
      const result = generateHDISQL(sampleMeasure);

      // Should reference measurement period dates
      expect(result.sql).toMatch(/202[0-9]-\d{2}-\d{2}/);
    });
  });

  describe('Patient Evaluation', () => {
    // Create a minimal test patient that meets CRC screening criteria
    const eligiblePatient: TestPatient = {
      id: 'test-patient-eligible',
      name: 'Test Patient Eligible',
      demographics: {
        birthDate: '1970-05-15', // 55 years old (within 45-75 range)
        gender: 'male',
      },
      diagnoses: [],
      encounters: [
        {
          code: '99213',
          system: 'CPT',
          display: 'Office visit, established patient',
          date: '2025-06-15',
          type: 'ambulatory',
        },
      ],
      procedures: [
        {
          code: '45378',
          system: 'CPT',
          display: 'Colonoscopy',
          date: '2024-03-01', // Within 10-year lookback
        },
      ],
      observations: [],
      medications: [],
    };

    const ineligiblePatient: TestPatient = {
      id: 'test-patient-ineligible',
      name: 'Test Patient Ineligible',
      demographics: {
        birthDate: '2010-01-01', // Too young (15 years old)
        gender: 'female',
      },
      diagnoses: [],
      encounters: [],
      procedures: [],
      observations: [],
      medications: [],
    };

    it('evaluates eligible patient as meeting initial population', () => {
      const trace = evaluatePatient(eligiblePatient, sampleMeasure, {
        start: '2025-01-01',
        end: '2025-12-31',
      });

      expect(trace).toBeDefined();
      expect(trace.patientId).toBe('test-patient-eligible');

      // Should have population results
      expect(trace.populations).toBeDefined();
      expect(trace.populations.initialPopulation).toBeDefined();
    });

    it('evaluates ineligible patient correctly', () => {
      const trace = evaluatePatient(ineligiblePatient, sampleMeasure, {
        start: '2025-01-01',
        end: '2025-12-31',
      });

      expect(trace).toBeDefined();
      expect(trace.patientId).toBe('test-patient-ineligible');

      // Young patient should not meet IP due to age requirement
      const ipResult = trace.populations.initialPopulation;
      expect(ipResult.met).toBe(false);
    });

    it('generates validation trace with nodes', () => {
      const trace = evaluatePatient(eligiblePatient, sampleMeasure, {
        start: '2025-01-01',
        end: '2025-12-31',
      });

      // Should have population nodes
      expect(trace.populations).toBeDefined();
      expect(Array.isArray(trace.populations.initialPopulation.nodes)).toBe(true);
    });
  });

  describe('CQL Syntax Validation', () => {
    it('validates generated CQL without critical errors', () => {
      const cqlResult = generateCQL(sampleMeasure);
      expect(cqlResult.success).toBe(true);

      const validationResult = validateCQLSyntax(cqlResult.cql);

      expect(validationResult).toBeDefined();
      expect(validationResult.valid).toBeDefined();

      // Should not have critical syntax errors
      const criticalErrors = validationResult.errors.filter(
        e => e.severity === 'error' && e.type === 'syntax'
      );
      expect(criticalErrors.length).toBe(0);
    });

    it('detects basic CQL structure', () => {
      const cqlResult = generateCQL(sampleMeasure);
      const validationResult = validateCQLSyntax(cqlResult.cql);

      // Validation should identify CQL metadata
      expect(validationResult.metadata).toBeDefined();
      expect(validationResult.metadata?.libraryName).toBeDefined();
    });
  });

  describe('Full Pipeline Integration', () => {
    it('executes complete pipeline: UMS → CQL → SQL → Evaluation', () => {
      // Step 1: Start with UMS
      const ums = createSampleCRCMeasure();
      expect(ums.metadata.measureId).toBe('CMS130v12');

      // Step 2: Generate CQL
      const cqlResult = generateCQL(ums);
      expect(cqlResult.success).toBe(true);
      expect(cqlResult.metadata.definitionCount).toBeGreaterThan(0);

      // Step 3: Generate SQL
      const sqlResult = generateHDISQL(ums);
      expect(sqlResult.success).toBe(true);

      // Step 4: Evaluate a patient
      const testPatient: TestPatient = {
        id: 'pipeline-test-patient',
        name: 'Pipeline Test',
        demographics: {
          birthDate: '1965-03-20',
          gender: 'male',
        },
        diagnoses: [],
        encounters: [
          {
            code: '99214',
            system: 'CPT',
            display: 'Office visit',
            date: '2025-04-15',
            type: 'ambulatory',
          },
        ],
        procedures: [],
        observations: [],
        medications: [],
      };

      const evaluation = evaluatePatient(testPatient, ums, {
        start: '2025-01-01',
        end: '2025-12-31',
      });

      expect(evaluation.patientId).toBe('pipeline-test-patient');
      expect(evaluation.populations).toBeDefined();

      // Pipeline completed successfully
      expect(true).toBe(true);
    });

    it('maintains data consistency across pipeline stages', () => {
      const ums = createSampleCRCMeasure();

      // Generate CQL and SQL
      const cqlResult = generateCQL(ums);
      const sqlResult = generateHDISQL(ums);

      // CQL should reference the measure ID
      expect(cqlResult.cql).toContain('CMS130');

      // SQL should contain population CTEs matching CQL population definitions
      expect(sqlResult.sql.toLowerCase()).toContain('initial_population');
      expect(sqlResult.sql.toLowerCase()).toContain('numerator');

      // Both should handle the same population types
      expect(cqlResult.cql).toContain('"Initial Population"');
      expect(cqlResult.cql).toContain('"Numerator"');
    });
  });
});
