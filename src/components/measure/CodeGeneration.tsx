import { useState, useEffect } from 'react';
import { Code, Copy, Check, Download, RefreshCw, FileCode, Database, Sparkles, Library, ChevronRight, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useMeasureStore, type CodeOutputFormat } from '../../stores/measureStore';
import { generateCQL, validateCQL, isCQLServiceAvailable, type CQLGenerationResult, type CQLValidationResult } from '../../services/cqlGenerator';

export function CodeGeneration() {
  const { getActiveMeasure, selectedCodeFormat, setSelectedCodeFormat, setActiveTab } = useMeasureStore();
  const measure = getActiveMeasure();
  const format = selectedCodeFormat;
  const setFormat = setSelectedCodeFormat;
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cqlServiceAvailable, setCqlServiceAvailable] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<CQLValidationResult | null>(null);
  const [generationResult, setGenerationResult] = useState<CQLGenerationResult | null>(null);

  // Check CQL service availability on mount
  useEffect(() => {
    isCQLServiceAvailable().then(setCqlServiceAvailable);
  }, []);

  // Update generation result when measure changes
  useEffect(() => {
    if (measure && format === 'cql') {
      const result = generateCQL(measure);
      setGenerationResult(result);
      setValidationResult(null); // Reset validation when measure changes
    }
  }, [measure, format]);

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
            className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors inline-flex items-center gap-2"
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
    if (measure && format === 'cql') {
      const result = generateCQL(measure);
      setGenerationResult(result);
      setValidationResult(null);
    }
    setTimeout(() => setIsGenerating(false), 500);
  };

  const handleValidateCQL = async () => {
    if (!generationResult?.cql || format !== 'cql') return;

    setIsValidating(true);
    try {
      const result = await validateCQL(generationResult.cql);
      setValidationResult(result);
    } catch (err) {
      setValidationResult({
        valid: false,
        errors: [{ severity: 'error', message: err instanceof Error ? err.message : 'Validation failed' }],
        warnings: [],
      });
    } finally {
      setIsValidating(false);
    }
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
            className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
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
          <div className="mb-6 p-4 bg-[var(--warning-light)] border border-[var(--warning)]/30 rounded-xl">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-[var(--warning)]">Review Required</h3>
                <p className="text-sm text-[var(--warning)] opacity-80 mt-1">
                  All measure components must be approved before generating production code.
                  Currently {approvalPercent}% approved ({reviewProgress.approved}/{reviewProgress.total} components).
                </p>
                <button
                  onClick={() => useMeasureStore.getState().setActiveTab('editor')}
                  className="mt-3 px-3 py-1.5 bg-[var(--warning-light)] text-[var(--warning)] rounded-lg text-sm font-medium hover:opacity-80 transition-all border border-[var(--warning)]/20"
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
                    ? 'bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]/30'
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
              {format === 'cql' && (
                <button
                  onClick={handleValidateCQL}
                  disabled={isValidating || !generationResult?.success}
                  className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] text-[var(--text)] rounded-lg flex items-center gap-2 hover:bg-[var(--bg)] transition-colors disabled:opacity-50"
                  title={cqlServiceAvailable === false ? 'CQL Services not available - run Docker container' : 'Validate CQL syntax'}
                >
                  {isValidating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : validationResult?.valid ? (
                    <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                  ) : validationResult ? (
                    <XCircle className="w-4 h-4 text-[var(--danger)]" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {isValidating ? 'Validating...' : validationResult?.valid ? 'Valid' : 'Validate CQL'}
                </button>
              )}
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] text-[var(--text)] rounded-lg flex items-center gap-2 hover:bg-[var(--bg)] transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-[var(--success)]" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button className="px-3 py-1.5 text-sm bg-[var(--accent-light)] text-[var(--accent)] rounded-lg flex items-center gap-2 hover:bg-[var(--accent)]/20 transition-colors">
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>

          {/* Code content */}
          <div className="relative">
            {isGenerating && (
              <div className="absolute inset-0 bg-[var(--bg-secondary)]/80 flex items-center justify-center z-10">
                <div className="flex items-center gap-3 text-[var(--accent)]">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Generating {format.toUpperCase()}...</span>
                </div>
              </div>
            )}
            <pre className="p-4 text-sm font-mono overflow-auto max-h-[600px] text-[var(--text)]">
              <code className={!canGenerate ? 'opacity-50' : ''}>
                {format === 'cql' && generationResult?.cql
                  ? generationResult.cql
                  : getGeneratedCode(measure, format)}
              </code>
            </pre>
          </div>
        </div>

        {/* Validation Results */}
        {format === 'cql' && validationResult && (
          <div className={`mt-6 p-4 rounded-xl border ${
            validationResult.valid
              ? 'bg-[var(--success)]/5 border-[var(--success)]/30'
              : 'bg-[var(--danger)]/5 border-[var(--danger)]/30'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {validationResult.valid ? (
                <>
                  <CheckCircle className="w-5 h-5 text-[var(--success)]" />
                  <h3 className="text-sm font-medium text-[var(--success)]">CQL Validation Passed</h3>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-[var(--danger)]" />
                  <h3 className="text-sm font-medium text-[var(--danger)]">CQL Validation Failed</h3>
                </>
              )}
            </div>

            {validationResult.errors.length > 0 && (
              <div className="space-y-2 mb-3">
                <h4 className="text-xs font-medium text-[var(--danger)] uppercase tracking-wider">Errors ({validationResult.errors.length})</h4>
                {validationResult.errors.map((error, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-[var(--danger)]">
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <span>{error.message}</span>
                      {error.line && (
                        <span className="text-[var(--text-dim)] ml-2">
                          (Line {error.line}{error.column ? `:${error.column}` : ''})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {validationResult.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-[var(--warning)] uppercase tracking-wider">Warnings ({validationResult.warnings.length})</h4>
                {validationResult.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-[var(--warning)]">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <span>{warning.message}</span>
                      {warning.line && (
                        <span className="text-[var(--text-dim)] ml-2">
                          (Line {warning.line}{warning.column ? `:${warning.column}` : ''})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {validationResult.valid && validationResult.elm && (
              <p className="text-sm text-[var(--success)]">
                ELM (Expression Logical Model) compiled successfully. Ready for execution.
              </p>
            )}
          </div>
        )}

        {/* CQL Service Status */}
        {format === 'cql' && cqlServiceAvailable === false && !validationResult && (
          <div className="mt-6 p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-[var(--warning)]">CQL Validation Service Not Available</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  To validate CQL syntax, start the CQL Services Docker container:
                </p>
                <code className="block mt-2 p-2 bg-[var(--bg-tertiary)] rounded text-xs font-mono text-[var(--text-dim)]">
                  docker run -p 8080:8080 cqframework/cql-translation-service
                </code>
              </div>
            </div>
          </div>
        )}

        {/* Generation notes */}
        <div className="mt-6 p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)]">
          <h3 className="text-sm font-medium text-[var(--text)] mb-2">Generation Notes</h3>
          <ul className="space-y-1 text-sm text-[var(--text-muted)]">
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent)] mt-0.5">•</span>
              Code generated from UMS version {measure.metadata.version}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent)] mt-0.5">•</span>
              {measure.populations.length} population definitions included
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent)] mt-0.5">•</span>
              {measure.valueSets.length} value set references linked
            </li>
            {format === 'cql' && generationResult && (
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">•</span>
                {generationResult.metadata.definitionCount} CQL definitions generated
              </li>
            )}
            {!canGenerate && (
              <li className="flex items-start gap-2 text-[var(--warning)]">
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

// Helper to get population by type - supports both FHIR kebab-case and legacy underscore
function getPopulation(populations: any[], type: string): any | null {
  // Map between FHIR kebab-case and legacy underscore formats
  const typeVariants: Record<string, string[]> = {
    'initial-population': ['initial-population', 'initial_population'],
    'initial_population': ['initial-population', 'initial_population'],
    'denominator': ['denominator'],
    'denominator-exclusion': ['denominator-exclusion', 'denominator_exclusion'],
    'denominator_exclusion': ['denominator-exclusion', 'denominator_exclusion'],
    'denominator-exception': ['denominator-exception', 'denominator_exception'],
    'denominator_exception': ['denominator-exception', 'denominator_exception'],
    'numerator': ['numerator'],
    'numerator-exclusion': ['numerator-exclusion', 'numerator_exclusion'],
    'numerator_exclusion': ['numerator-exclusion', 'numerator_exclusion'],
  };

  const variants = typeVariants[type] || [type];
  return populations.find(p => variants.includes(p.type)) || null;
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

  // Build value set declarations from actual measure value sets with FHIR canonical URLs
  const valueSetDeclarations = measure.valueSets.map((vs: any) => {
    // Use FHIR canonical URL (VSAC format) if OID exists, otherwise use urn:oid
    const url = vs.url || (vs.oid ? `http://cts.nlm.nih.gov/fhir/ValueSet/${vs.oid}` : `urn:oid:2.16.840.1.113883.3.XXX.${vs.id}`);
    return `valueset "${vs.name}": '${url}'`;
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

    // Use CQL definition names from populations (FHIR alignment)
    const ipDefName = ipPop?.cqlDefinitionName || 'Initial Population';
    const denomDefName = denomPop?.cqlDefinitionName || 'Denominator';
    const exclDefName = exclPop?.cqlDefinitionName || 'Denominator Exclusion';
    const numDefName = numPop?.cqlDefinitionName || 'Numerator';

    // Library name from measure ID (FHIR canonical format)
    const libraryName = measure.metadata.measureId.replace(/[^a-zA-Z0-9]/g, '');
    const libraryUrl = measure.metadata.url || `urn:uuid:${measure.id}`;

    return `/*
 * ${measure.metadata.title}
 * Measure ID: ${measure.metadata.measureId}
 * Version: ${measure.metadata.version}
 * Scoring: ${measure.metadata.scoring || 'proportion'}
 * Generated: ${new Date().toISOString()}
 *
 * FHIR R4 / QI-Core aligned CQL
 * Library URL: ${libraryUrl}
 *
 * THIS CODE WAS AUTO-GENERATED FROM UMS (FHIR-aligned)
 * Review status: ${measure.reviewProgress.approved}/${measure.reviewProgress.total} approved
 */

library ${libraryName} version '${measure.metadata.version}'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers
include QICoreCommon version '2.0.0' called QICoreCommon

codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMEDCT": 'http://snomed.info/sct'
codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "CPT": 'http://www.ama-assn.org/go/cpt'

// Value Sets from UMS (VSAC canonical URLs)
${valueSetDeclarations}

parameter "Measurement Period" Interval<DateTime>
  default Interval[@${measure.metadata.measurementPeriod?.start || '2025-01-01'}T00:00:00.0, @${measure.metadata.measurementPeriod?.end || '2025-12-31'}T23:59:59.999]

context Patient

/*
 * ${ipDefName}
 * ${ipCriteria}
 */
define "${ipDefName}":
  AgeInYearsAt(date from end of "Measurement Period") in Interval[${ageRange.min}, ${ageRange.max}]
${dataElements.filter(e => e.type === 'diagnosis').map(e => `    and exists "${e.valueSet?.name || 'Qualifying Condition'}"`).join('\n')}
${dataElements.filter(e => e.type === 'encounter').map(e => `    and exists "${e.valueSet?.name || 'Qualifying Encounter'}"`).join('\n')}

/*
 * ${denomDefName}
 * ${denomCriteria}
 */
define "${denomDefName}":
  "${ipDefName}"

/*
 * ${exclDefName}
 * ${exclCriteria}
 */
define "${exclDefName}":
${dataElements.filter(e => exclPop?.criteria && JSON.stringify(exclPop.criteria).includes(e.id)).map(e => `  exists "${e.valueSet?.name || 'Exclusion Condition'}"`).join('\n    or ') || '  false /* No exclusions defined */'}

/*
 * ${numDefName}
 * ${numCriteria}
 */
define "${numDefName}":
${dataElements.filter(e => numPop?.criteria && JSON.stringify(numPop.criteria).includes(e.id)).map(e => `  exists "${e.valueSet?.name || 'Numerator Action'}"`).join('\n    and ') || '  true /* Define numerator criteria */'}

// QI-Core Data Element Definitions
${measure.valueSets.map((vs: any) => {
  const relatedElement = dataElements.find(e => e.valueSet?.id === vs.id);
  const elemType = relatedElement?.type || 'diagnosis';
  // QI-Core resource types (FHIR alignment)
  const qicoreType = elemType === 'diagnosis' ? 'Condition' :
                     elemType === 'encounter' ? 'Encounter' :
                     elemType === 'procedure' ? 'Procedure' :
                     elemType === 'observation' ? 'Observation' :
                     elemType === 'medication' ? 'MedicationRequest' :
                     elemType === 'assessment' ? 'Observation' : 'Condition';
  const timing = relatedElement?.timingRequirements?.[0]?.description || 'During Measurement Period';

  return `define "${vs.name}":
  [${qicoreType}: "${vs.name}"] R
    where R.clinicalStatus ~ QICoreCommon."active"
      and (R.onset as Period) overlaps "Measurement Period"
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
