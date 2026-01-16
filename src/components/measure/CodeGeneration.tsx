import { useState } from 'react';
import { Code, Copy, Check, Download, RefreshCw, FileCode, Database, Sparkles, Library, ChevronRight } from 'lucide-react';
import { useMeasureStore, type CodeOutputFormat } from '../../stores/measureStore';

export function CodeGeneration() {
  const { getActiveMeasure, selectedCodeFormat, setSelectedCodeFormat, setActiveTab } = useMeasureStore();
  const measure = getActiveMeasure();
  const format = selectedCodeFormat;
  const setFormat = setSelectedCodeFormat;
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!measure) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center">
            <Code className="w-8 h-8 text-[var(--text-dim)]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No Measure Selected</h2>
          <p className="text-[var(--text-muted)] mb-6">
            Select a measure from the library to generate CQL, SQL, or Synapse code.
          </p>
          <button
            onClick={() => setActiveTab('library')}
            className="px-6 py-3 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors inline-flex items-center gap-2"
          >
            <Library className="w-4 h-4" />
            Go to Measure Library
          </button>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    const code = getGeneratedCode(measure, format);
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 1500);
  };

  const reviewProgress = measure.reviewProgress;
  const canGenerate = reviewProgress.approved === reviewProgress.total;
  const approvalPercent = Math.round((reviewProgress.approved / reviewProgress.total) * 100);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-4">
          <button
            onClick={() => setActiveTab('library')}
            className="text-[var(--text-muted)] hover:text-cyan-400 transition-colors"
          >
            Measure Library
          </button>
          <ChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
          <span className="text-[var(--text-muted)]">{measure.metadata.measureId}</span>
          <ChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
          <span className="text-[var(--text)]">Code Generation</span>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[var(--text)]">Code Generation</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Generate executable code from the approved Universal Measure Spec
          </p>
        </div>

        {/* Approval status */}
        {!canGenerate && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-400">Review Required</h3>
                <p className="text-sm text-amber-300/80 mt-1">
                  All measure components must be approved before generating production code.
                  Currently {approvalPercent}% approved ({reviewProgress.approved}/{reviewProgress.total} components).
                </p>
                <button
                  onClick={() => useMeasureStore.getState().setActiveTab('editor')}
                  className="mt-3 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors"
                >
                  Continue Review
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Format selector */}
        <div className="flex items-center gap-4 mb-6">
          <span className="text-sm text-[var(--text-muted)]">Output Format:</span>
          <div className="flex gap-2">
            {[
              { id: 'cql' as const, label: 'CQL', icon: FileCode },
              { id: 'synapse' as const, label: 'Synapse SQL', icon: Database },
              { id: 'sql' as const, label: 'Standard SQL', icon: Code },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  format === f.id
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]'
                }`}
              >
                <f.icon className="w-4 h-4" />
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Code preview */}
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm font-medium text-[var(--text)]">
                {measure.metadata.measureId}_{format.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] text-[var(--text)] rounded-lg flex items-center gap-2 hover:bg-[var(--bg)] transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button className="px-3 py-1.5 text-sm bg-cyan-500/15 text-cyan-400 rounded-lg flex items-center gap-2 hover:bg-cyan-500/25 transition-colors">
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>

          {/* Code content */}
          <div className="relative">
            {isGenerating && (
              <div className="absolute inset-0 bg-[var(--bg-secondary)]/80 flex items-center justify-center z-10">
                <div className="flex items-center gap-3 text-cyan-400">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Generating {format.toUpperCase()}...</span>
                </div>
              </div>
            )}
            <pre className="p-4 text-sm font-mono overflow-auto max-h-[600px] text-[var(--text)]">
              <code className={!canGenerate ? 'opacity-50' : ''}>
                {getGeneratedCode(measure, format)}
              </code>
            </pre>
          </div>
        </div>

        {/* Generation notes */}
        <div className="mt-6 p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)]">
          <h3 className="text-sm font-medium text-[var(--text)] mb-2">Generation Notes</h3>
          <ul className="space-y-1 text-sm text-[var(--text-muted)]">
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">•</span>
              Code generated from UMS version {measure.metadata.version}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">•</span>
              {measure.populations.length} population definitions included
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">•</span>
              {measure.valueSets.length} value set references linked
            </li>
            {!canGenerate && (
              <li className="flex items-start gap-2 text-amber-400">
                <span className="mt-0.5">⚠</span>
                Preview only - complete review to generate production code
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Helper to extract age range from population data elements
// Uses UMS schema: DataElement.thresholds.ageMin/ageMax (canonical source)
function extractAgeRange(populations: any[]): { min: number; max: number } | null {
  const findAgeConstraints = (node: any): { min?: number; max?: number } | null => {
    if (!node) return null;

    // PRIMARY: Check UMS thresholds (canonical schema)
    if (node.thresholds) {
      const t = node.thresholds;
      if (t.ageMin !== undefined || t.ageMax !== undefined) {
        return { min: t.ageMin, max: t.ageMax };
      }
    }

    // FALLBACK: Check legacy constraints field (for backwards compatibility)
    if (node.constraints) {
      const c = node.constraints;
      if (c.ageMin !== undefined || c.ageMax !== undefined) {
        return { min: c.ageMin, max: c.ageMax };
      }
      if (c.minAge !== undefined || c.maxAge !== undefined) {
        return { min: c.minAge, max: c.maxAge };
      }
    }

    // Recursively check children
    if (node.children) {
      for (const child of node.children) {
        const result = findAgeConstraints(child);
        if (result) return result;
      }
    }

    // Check nested criteria
    if (node.criteria) {
      return findAgeConstraints(node.criteria);
    }

    return null;
  };

  // Search through populations for age constraints
  for (const pop of populations) {
    const constraints = findAgeConstraints(pop);
    if (constraints && (constraints.min !== undefined || constraints.max !== undefined)) {
      return {
        min: constraints.min ?? 0,
        max: constraints.max ?? 999
      };
    }
  }

  // Fallback: look for age patterns in text descriptions
  for (const pop of populations) {
    const searchText = JSON.stringify(pop);
    const match = searchText.match(/(?:age[d]?\s*)?(\d+)\s*[-–to]+\s*(\d+)/i);
    if (match) {
      return { min: parseInt(match[1]), max: parseInt(match[2]) };
    }
  }

  return null;
}

// Helper to collect all data elements from populations
function collectDataElements(populations: any[]): any[] {
  const elements: any[] = [];

  const traverse = (node: any) => {
    if (!node) return;
    if (node.type && ['diagnosis', 'encounter', 'procedure', 'observation', 'medication', 'demographic', 'assessment'].includes(node.type)) {
      elements.push(node);
    }
    if (node.criteria) traverse(node.criteria);
    if (node.children) node.children.forEach(traverse);
  };

  populations.forEach(traverse);
  return elements;
}

// Helper to get population by type
function getPopulation(populations: any[], type: string): any | null {
  return populations.find(p => p.type === type) || null;
}

function getGeneratedCode(measure: any, format: CodeOutputFormat): string {
  // Use globalConstraints as primary source (single source of truth), fallback to population extraction
  const ageRange = measure.globalConstraints?.ageRange ||
                   extractAgeRange(measure.populations) ||
                   { min: 18, max: 85 };
  const dataElements = collectDataElements(measure.populations);
  const ipPop = getPopulation(measure.populations, 'initial_population');
  const denomPop = getPopulation(measure.populations, 'denominator');
  const exclPop = getPopulation(measure.populations, 'denominator_exclusion');
  const numPop = getPopulation(measure.populations, 'numerator');

  // Build value set declarations from actual measure value sets
  const valueSetDeclarations = measure.valueSets.map((vs: any) => {
    const oid = vs.oid || `urn:oid:2.16.840.1.113883.3.XXX.${vs.id}`;
    return `valueset "${vs.name}": '${oid}'`;
  }).join('\n');

  // Build code lists for SQL
  const buildCodeList = (vs: any) => {
    if (!vs?.codes?.length) return '/* No codes defined */';
    return vs.codes.map((c: any) => `'${c.code}'`).join(', ');
  };

  if (format === 'cql') {
    // Build population criteria from actual data
    const ipCriteria = ipPop?.narrative || 'Patients meeting initial population criteria';
    const denomCriteria = denomPop?.narrative || 'Initial Population';
    const exclCriteria = exclPop?.narrative || 'Patients with exclusion criteria';
    const numCriteria = numPop?.narrative || 'Patients meeting numerator criteria';

    return `/*
 * ${measure.metadata.title}
 * Measure ID: ${measure.metadata.measureId}
 * Version: ${measure.metadata.version}
 * Generated: ${new Date().toISOString()}
 *
 * THIS CODE WAS AUTO-GENERATED FROM UMS
 * Review status: ${measure.reviewProgress.approved}/${measure.reviewProgress.total} approved
 */

library ${measure.metadata.measureId.replace(/[^a-zA-Z0-9]/g, '')} version '${measure.metadata.version}'

using QDM version '5.6'

include MATGlobalCommonFunctionsQDM version '8.0.000' called Global

// Value Sets from UMS
${valueSetDeclarations}

parameter "Measurement Period" Interval<DateTime>

context Patient

/*
 * Initial Population
 * ${ipCriteria}
 */
define "Initial Population":
  AgeInYearsAt(date from end of "Measurement Period") in Interval[${ageRange.min}, ${ageRange.max}]
${dataElements.filter(e => e.type === 'diagnosis').map(e => `    and exists "${e.valueSet?.name || 'Qualifying Condition'}"`).join('\n')}
${dataElements.filter(e => e.type === 'encounter').map(e => `    and exists "${e.valueSet?.name || 'Qualifying Encounter'}"`).join('\n')}

/*
 * Denominator
 * ${denomCriteria}
 */
define "Denominator":
  "Initial Population"

/*
 * Denominator Exclusions
 * ${exclCriteria}
 */
define "Denominator Exclusions":
${dataElements.filter(e => exclPop?.criteria && JSON.stringify(exclPop.criteria).includes(e.id)).map(e => `  exists "${e.valueSet?.name || 'Exclusion Condition'}"`).join('\n    or ') || '  false /* No exclusions defined */'}

/*
 * Numerator
 * ${numCriteria}
 */
define "Numerator":
${dataElements.filter(e => numPop?.criteria && JSON.stringify(numPop.criteria).includes(e.id)).map(e => `  exists "${e.valueSet?.name || 'Numerator Action'}"`).join('\n    and ') || '  true /* Define numerator criteria */'}

// Data Element Definitions
${measure.valueSets.map((vs: any) => {
  const relatedElement = dataElements.find(e => e.valueSet?.id === vs.id);
  const elemType = relatedElement?.type || 'diagnosis';
  const qdmType = elemType === 'diagnosis' ? 'Diagnosis' :
                  elemType === 'encounter' ? 'Encounter, Performed' :
                  elemType === 'procedure' ? 'Procedure, Performed' :
                  elemType === 'observation' ? 'Laboratory Test, Performed' :
                  elemType === 'medication' ? 'Medication, Active' :
                  elemType === 'assessment' ? 'Assessment, Performed' : 'Diagnosis';
  const timing = relatedElement?.timingRequirements?.[0]?.description || 'During Measurement Period';

  return `define "${vs.name}":
  ["${qdmType}": "${vs.name}"] Item
    where Item.relevantPeriod overlaps "Measurement Period"
    /* Timing: ${timing} */`;
}).join('\n\n')}
`;
  }

  if (format === 'synapse') {
    const measureName = measure.metadata.measureId.replace(/[^a-zA-Z0-9]/g, '_');

    // Build actual code IN clauses from value sets
    const diagnosisVS = measure.valueSets.find((vs: any) =>
      dataElements.some(e => e.type === 'diagnosis' && e.valueSet?.id === vs.id)
    );
    const encounterVS = measure.valueSets.find((vs: any) =>
      dataElements.some(e => e.type === 'encounter' && e.valueSet?.id === vs.id)
    );
    const exclusionVS = measure.valueSets.find((vs: any) =>
      vs.name.toLowerCase().includes('hospice') || vs.name.toLowerCase().includes('exclusion')
    );
    const numeratorVS = measure.valueSets.find((vs: any) =>
      dataElements.some(e => numPop?.criteria && JSON.stringify(numPop.criteria).includes(e.id) && e.valueSet?.id === vs.id)
    );

    return `/*
 * ${measure.metadata.title}
 * Measure ID: ${measure.metadata.measureId}
 * Target: Azure Synapse Analytics
 * Generated: ${new Date().toISOString()}
 *
 * Age Range: ${ageRange.min}-${ageRange.max}
 * Value Sets: ${measure.valueSets.length}
 */

DECLARE @MeasurementPeriodStart DATE = '${measure.metadata.measurementPeriod?.start || '2025-01-01'}';
DECLARE @MeasurementPeriodEnd DATE = '${measure.metadata.measurementPeriod?.end || '2025-12-31'}';

-- Value Set Reference Tables (populate from UMS)
${measure.valueSets.map((vs: any) => `-- ${vs.name}: ${vs.codes?.length || 0} codes
-- Codes: ${vs.codes?.slice(0, 5).map((c: any) => c.code).join(', ')}${vs.codes?.length > 5 ? '...' : ''}`).join('\n')}

-- Initial Population
-- ${ipPop?.narrative || 'Patients meeting initial criteria'}
CREATE OR ALTER VIEW [measure].[${measureName}_InitialPopulation]
AS
SELECT DISTINCT
    p.patient_id,
    p.date_of_birth,
    DATEDIFF(YEAR, p.date_of_birth, @MeasurementPeriodEnd) AS age_at_mp_end
FROM [clinical].[patients] p
INNER JOIN [clinical].[diagnoses] dx
    ON p.patient_id = dx.patient_id
    AND dx.diagnosis_code IN (${buildCodeList(diagnosisVS)})
    AND dx.onset_date <= @MeasurementPeriodEnd
    AND (dx.resolution_date IS NULL OR dx.resolution_date >= @MeasurementPeriodStart)
INNER JOIN [clinical].[encounters] enc
    ON p.patient_id = enc.patient_id
    AND enc.encounter_type_code IN (${buildCodeList(encounterVS)})
    AND enc.encounter_date BETWEEN @MeasurementPeriodStart AND @MeasurementPeriodEnd
WHERE DATEDIFF(YEAR, p.date_of_birth, @MeasurementPeriodEnd) BETWEEN ${ageRange.min} AND ${ageRange.max};
GO

-- Denominator Exclusions
-- ${exclPop?.narrative || 'Patients meeting exclusion criteria'}
CREATE OR ALTER VIEW [measure].[${measureName}_DenominatorExclusions]
AS
SELECT DISTINCT patient_id
FROM (
    SELECT patient_id
    FROM [clinical].[encounters]
    WHERE encounter_type_code IN (${buildCodeList(exclusionVS)})
    AND encounter_date BETWEEN @MeasurementPeriodStart AND @MeasurementPeriodEnd
) exclusions;
GO

-- Numerator
-- ${numPop?.narrative || 'Patients meeting numerator criteria'}
CREATE OR ALTER VIEW [measure].[${measureName}_Numerator]
AS
SELECT DISTINCT patient_id
FROM [clinical].[procedures]
WHERE procedure_code IN (${buildCodeList(numeratorVS)})
AND procedure_date BETWEEN @MeasurementPeriodStart AND @MeasurementPeriodEnd;
GO

-- Final Measure Calculation
CREATE OR ALTER VIEW [measure].[${measureName}_Results]
AS
SELECT
    ip.patient_id,
    ip.age_at_mp_end,
    CASE WHEN ex.patient_id IS NOT NULL THEN 1 ELSE 0 END AS is_excluded,
    CASE WHEN num.patient_id IS NOT NULL THEN 1 ELSE 0 END AS numerator_met,
    CASE
        WHEN ex.patient_id IS NOT NULL THEN 'Excluded'
        WHEN num.patient_id IS NOT NULL THEN 'Performance Met'
        ELSE 'Performance Not Met'
    END AS measure_status
FROM [measure].[${measureName}_InitialPopulation] ip
LEFT JOIN [measure].[${measureName}_DenominatorExclusions] ex
    ON ip.patient_id = ex.patient_id
LEFT JOIN [measure].[${measureName}_Numerator] num
    ON ip.patient_id = num.patient_id
    AND ex.patient_id IS NULL;
GO
`;
  }

  // Standard SQL
  // Build actual code IN clauses from value sets
  const diagnosisVS = measure.valueSets.find((vs: any) =>
    dataElements.some(e => e.type === 'diagnosis' && e.valueSet?.id === vs.id)
  );
  const encounterVS = measure.valueSets.find((vs: any) =>
    dataElements.some(e => e.type === 'encounter' && e.valueSet?.id === vs.id)
  );
  const exclusionVS = measure.valueSets.find((vs: any) =>
    vs.name.toLowerCase().includes('hospice') || vs.name.toLowerCase().includes('exclusion')
  );
  const numeratorVS = measure.valueSets.find((vs: any) =>
    dataElements.some(e => numPop?.criteria && JSON.stringify(numPop.criteria).includes(e.id) && e.valueSet?.id === vs.id)
  );

  return `/*
 * ${measure.metadata.title}
 * Measure ID: ${measure.metadata.measureId}
 * Target: Standard SQL (PostgreSQL/MySQL compatible)
 * Generated: ${new Date().toISOString()}
 *
 * Age Range: ${ageRange.min}-${ageRange.max}
 * Value Sets: ${measure.valueSets.length}
 */

-- Parameters
SET @measurement_period_start = '${measure.metadata.measurementPeriod?.start || '2025-01-01'}';
SET @measurement_period_end = '${measure.metadata.measurementPeriod?.end || '2025-12-31'}';

-- Value Sets from UMS:
${measure.valueSets.map((vs: any) => `-- ${vs.name}: ${vs.codes?.map((c: any) => c.code).join(', ') || 'No codes'}`).join('\n')}

-- Initial Population
-- ${ipPop?.narrative || 'Patients meeting initial criteria'}
WITH initial_population AS (
    SELECT DISTINCT
        p.patient_id,
        p.date_of_birth,
        TIMESTAMPDIFF(YEAR, p.date_of_birth, @measurement_period_end) AS age
    FROM patients p
    INNER JOIN diagnoses dx ON p.patient_id = dx.patient_id
    INNER JOIN encounters enc ON p.patient_id = enc.patient_id
    WHERE
        -- Age criteria: ${ageRange.min}-${ageRange.max} years
        TIMESTAMPDIFF(YEAR, p.date_of_birth, @measurement_period_end) BETWEEN ${ageRange.min} AND ${ageRange.max}
        -- Diagnosis criteria
        AND dx.diagnosis_code IN (${buildCodeList(diagnosisVS)})
        AND dx.onset_date <= @measurement_period_end
        -- Encounter criteria
        AND enc.encounter_date BETWEEN @measurement_period_start AND @measurement_period_end
        AND enc.encounter_type IN (${buildCodeList(encounterVS)})
),

-- Denominator Exclusions
-- ${exclPop?.narrative || 'Patients with exclusion criteria'}
exclusions AS (
    SELECT DISTINCT patient_id
    FROM encounters
    WHERE encounter_type IN (${buildCodeList(exclusionVS)})
    AND encounter_date BETWEEN @measurement_period_start AND @measurement_period_end
),

-- Numerator
-- ${numPop?.narrative || 'Patients meeting numerator criteria'}
numerator AS (
    SELECT DISTINCT patient_id
    FROM procedures
    WHERE procedure_code IN (${buildCodeList(numeratorVS)})
    AND procedure_date BETWEEN @measurement_period_start AND @measurement_period_end
)

-- Final Results
SELECT
    ip.patient_id,
    ip.age,
    CASE WHEN ex.patient_id IS NOT NULL THEN TRUE ELSE FALSE END AS excluded,
    CASE WHEN num.patient_id IS NOT NULL THEN TRUE ELSE FALSE END AS numerator_met,
    CASE
        WHEN ex.patient_id IS NOT NULL THEN 'Excluded'
        WHEN num.patient_id IS NOT NULL THEN 'Performance Met'
        ELSE 'Performance Not Met'
    END AS outcome
FROM initial_population ip
LEFT JOIN exclusions ex ON ip.patient_id = ex.patient_id
LEFT JOIN numerator num ON ip.patient_id = num.patient_id;
`;
}
