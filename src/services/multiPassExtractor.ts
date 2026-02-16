/**
 * Multi-Pass Extraction Service (1.B)
 *
 * Implements a three-pass extraction pipeline to improve accuracy:
 * - Pass 1 (SKELETON): Extract structure and population names
 * - Pass 2 (DETAIL): One call per population for focused extraction
 * - Pass 3 (VALIDATION): Cross-reference to catch omissions/hallucinations
 *
 * This replaces single-shot extraction with iterative refinement.
 */

import { callLLM, type LLMRequestOptions } from './llmClient';
import { validateOID, type OIDValidationResult } from './oidValidator';
import { generateFewShotExamples } from './feedbackLoop';
import type {
  UniversalMeasureSpec,
  PopulationDefinition,
  PopulationType,
  DataElement,
  ValueSetReference,
  LogicalClause,
  MeasureMetadata,
  ConfidenceLevel,
} from '../types/ums';

// ============================================================================
// Types
// ============================================================================

export interface ExtractionOptions {
  apiKey: string;
  provider?: 'anthropic' | 'openai' | 'google' | 'custom';
  model?: string;
  useBackendProxy?: boolean;
  includeFewShotExamples?: boolean;
  skipValidationPass?: boolean;
  onProgress?: (progress: ExtractionProgress) => void;
}

export interface ExtractionProgress {
  phase: 'skeleton' | 'populations' | 'validation' | 'complete';
  currentStep: number;
  totalSteps: number;
  message: string;
  details?: string;
}

export interface ExtractionResult {
  success: boolean;
  ums?: UniversalMeasureSpec;
  skeleton?: MeasureSkeleton;
  populationResults?: PopulationExtractionResult[];
  validationResult?: CrossReferenceResult;
  errors: string[];
  warnings: string[];
  timings: {
    skeletonMs: number;
    populationsMs: number;
    validationMs: number;
    totalMs: number;
  };
}

export interface MeasureSkeleton {
  measureId: string;
  title: string;
  version?: string;
  programType: 'eCQM' | 'MIPS_CQM' | 'HEDIS' | 'Custom';
  measureType: 'process' | 'outcome' | 'structure';
  scoring: 'proportion' | 'ratio' | 'continuous-variable';
  steward?: string;
  description?: string;
  populations: PopulationSkeleton[];
  measurementPeriod?: {
    start: string;
    end: string;
    type: 'calendar_year' | 'rolling' | 'custom';
  };
  confidence: ConfidenceLevel;
}

export interface PopulationSkeleton {
  type: PopulationType;
  name: string;
  briefDescription: string;
  specSection?: string;
  estimatedCriteriaCount: number;
}

export interface PopulationExtractionResult {
  populationType: PopulationType;
  success: boolean;
  population?: PopulationDefinition;
  valueSets?: ValueSetReference[];
  oidValidations?: OIDValidationResult[];
  errors: string[];
  warnings: string[];
}

export interface CrossReferenceResult {
  valid: boolean;
  missingPopulations: string[];
  missingCriteria: MissingCriterion[];
  possibleHallucinations: PossibleHallucination[];
  suggestions: string[];
}

export interface MissingCriterion {
  specText: string;
  populationType: string;
  confidence: ConfidenceLevel;
}

export interface PossibleHallucination {
  criterionDescription: string;
  populationType: string;
  reason: string;
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract measure data using multi-pass approach
 */
export async function extractWithMultiPass(
  documentText: string,
  options: ExtractionOptions
): Promise<ExtractionResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const timings = { skeletonMs: 0, populationsMs: 0, validationMs: 0, totalMs: 0 };
  const startTotal = performance.now();

  const progress = options.onProgress || (() => {});

  try {
    // =========================================================================
    // PASS 1: SKELETON EXTRACTION
    // =========================================================================
    progress({
      phase: 'skeleton',
      currentStep: 1,
      totalSteps: 3,
      message: 'Extracting measure structure...',
    });

    const startSkeleton = performance.now();
    const skeleton = await extractSkeleton(documentText, options);
    timings.skeletonMs = performance.now() - startSkeleton;

    if (!skeleton) {
      return {
        success: false,
        errors: ['Failed to extract measure skeleton'],
        warnings,
        timings: { ...timings, totalMs: performance.now() - startTotal },
      };
    }

    // =========================================================================
    // PASS 2: POPULATION DETAIL EXTRACTION
    // =========================================================================
    const populationResults: PopulationExtractionResult[] = [];
    const allValueSets: ValueSetReference[] = [];

    const startPop = performance.now();

    for (let i = 0; i < skeleton.populations.length; i++) {
      const popSkeleton = skeleton.populations[i];

      progress({
        phase: 'populations',
        currentStep: i + 1,
        totalSteps: skeleton.populations.length,
        message: `Extracting ${popSkeleton.name}...`,
        details: popSkeleton.briefDescription,
      });

      const popResult = await extractPopulationDetail(
        documentText,
        skeleton,
        popSkeleton,
        options
      );

      populationResults.push(popResult);

      if (popResult.valueSets) {
        allValueSets.push(...popResult.valueSets);
      }

      if (!popResult.success) {
        errors.push(`Failed to extract ${popSkeleton.type}: ${popResult.errors.join(', ')}`);
      }
      if (popResult.warnings.length > 0) {
        warnings.push(...popResult.warnings);
      }
    }

    timings.populationsMs = performance.now() - startPop;

    // =========================================================================
    // PASS 3: CROSS-REFERENCE VALIDATION
    // =========================================================================
    let validationResult: CrossReferenceResult | undefined;

    if (!options.skipValidationPass) {
      progress({
        phase: 'validation',
        currentStep: 1,
        totalSteps: 1,
        message: 'Validating extraction completeness...',
      });

      const startValidation = performance.now();
      validationResult = await crossReferenceValidation(
        documentText,
        skeleton,
        populationResults,
        options
      );
      timings.validationMs = performance.now() - startValidation;

      if (!validationResult.valid) {
        warnings.push(`Validation found potential issues: ${validationResult.suggestions.join('; ')}`);
      }
    }

    // =========================================================================
    // ASSEMBLE UMS
    // =========================================================================
    progress({
      phase: 'complete',
      currentStep: 1,
      totalSteps: 1,
      message: 'Assembling measure specification...',
    });

    const ums = assembleUMS(skeleton, populationResults, allValueSets);

    timings.totalMs = performance.now() - startTotal;

    return {
      success: errors.length === 0,
      ums,
      skeleton,
      populationResults,
      validationResult,
      errors,
      warnings,
      timings,
    };
  } catch (err) {
    return {
      success: false,
      errors: [err instanceof Error ? err.message : 'Unknown extraction error'],
      warnings,
      timings: { ...timings, totalMs: performance.now() - startTotal },
    };
  }
}

// ============================================================================
// Pass 1: Skeleton Extraction
// ============================================================================

const SKELETON_SYSTEM_PROMPT = `You are a clinical quality measure expert. Extract ONLY the structural overview of this measure specification.

DO NOT extract detailed criteria yet - just identify the structure.

Return a JSON object with this exact structure:
{
  "measureId": "CMS123v10",
  "title": "Measure Title",
  "version": "10.0.0",
  "programType": "eCQM",
  "measureType": "process",
  "scoring": "proportion",
  "steward": "Organization Name",
  "description": "Brief description",
  "measurementPeriod": {
    "start": "2025-01-01",
    "end": "2025-12-31",
    "type": "calendar_year"
  },
  "populations": [
    {
      "type": "initial-population",
      "name": "Initial Population",
      "briefDescription": "Patients aged 18-75 with diabetes",
      "specSection": "Page 5, Section 2.1",
      "estimatedCriteriaCount": 3
    },
    // ... other populations
  ],
  "confidence": "high"
}

Population types must be one of:
- initial-population
- denominator
- denominator-exclusion
- denominator-exception
- numerator
- numerator-exclusion

Only include populations that are explicitly defined in the spec.`;

async function extractSkeleton(
  documentText: string,
  options: ExtractionOptions
): Promise<MeasureSkeleton | null> {
  const llmOptions: LLMRequestOptions = {
    provider: options.provider || 'anthropic',
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt: SKELETON_SYSTEM_PROMPT,
    userPrompt: `Extract the structural overview from this measure specification:\n\n${documentText.substring(0, 50000)}`,
    maxTokens: 4000,
    useBackendProxy: options.useBackendProxy,
  };

  const response = await callLLM(llmOptions);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in skeleton response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as MeasureSkeleton;
  } catch (err) {
    console.error('Failed to parse skeleton:', err);
    return null;
  }
}

// ============================================================================
// Pass 2: Population Detail Extraction
// ============================================================================

function getPopulationDetailPrompt(skeleton: MeasureSkeleton, popSkeleton: PopulationSkeleton): string {
  return `You are extracting DETAILED criteria for the ${popSkeleton.type} population of measure ${skeleton.measureId}.

Context:
- Measure: ${skeleton.title}
- Population: ${popSkeleton.name}
- Brief description: ${popSkeleton.briefDescription}
${popSkeleton.specSection ? `- Spec location: ${popSkeleton.specSection}` : ''}

Extract ALL criteria for this specific population. For each criterion:
1. Identify the clinical data type (diagnosis, procedure, medication, observation, encounter, demographic, immunization)
2. Extract the EXACT value set OID if present (format: 2.16.840.1.113883.x.x.x)
3. Extract timing requirements precisely
4. Note any negation (absence of condition, no procedure, etc.)

Return JSON:
{
  "populationType": "${popSkeleton.type}",
  "criteria": {
    "operator": "AND",
    "children": [
      {
        "id": "crit_1",
        "type": "diagnosis",
        "description": "Diabetes diagnosis",
        "valueSet": {
          "name": "Diabetes",
          "oid": "2.16.840.1.113883.3.464.1003.103.12.1001"
        },
        "timingRequirements": [{
          "description": "Active during measurement period",
          "relativeTo": "Measurement Period",
          "operator": "during",
          "confidence": "high"
        }],
        "negation": false,
        "confidence": "high"
      }
    ],
    "confidence": "high"
  },
  "valueSets": [
    {
      "id": "vs_1",
      "name": "Diabetes",
      "oid": "2.16.840.1.113883.3.464.1003.103.12.1001",
      "codes": []
    }
  ],
  "narrative": "Natural language description of this population",
  "warnings": []
}

IMPORTANT:
- Extract OIDs EXACTLY as written in the spec - do not guess or invent OIDs
- If an OID is not clearly stated, set oid to null and add a warning
- Use proper nesting for complex logic (A AND (B OR C))`;
}

async function extractPopulationDetail(
  documentText: string,
  skeleton: MeasureSkeleton,
  popSkeleton: PopulationSkeleton,
  options: ExtractionOptions
): Promise<PopulationExtractionResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Include few-shot examples if enabled
  let systemPrompt = getPopulationDetailPrompt(skeleton, popSkeleton);
  if (options.includeFewShotExamples) {
    const examples = generateFewShotExamples(skeleton.programType);
    if (examples) {
      systemPrompt += `\n\n${examples}`;
    }
  }

  const llmOptions: LLMRequestOptions = {
    provider: options.provider || 'anthropic',
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt,
    userPrompt: `Extract detailed criteria for the ${popSkeleton.type} population from this spec:\n\n${documentText.substring(0, 40000)}`,
    maxTokens: 8000,
    useBackendProxy: options.useBackendProxy,
  };

  try {
    const response = await callLLM(llmOptions);

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        populationType: popSkeleton.type as PopulationType,
        success: false,
        errors: ['No JSON found in response'],
        warnings,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate OIDs
    const oidValidations: OIDValidationResult[] = [];
    if (parsed.valueSets) {
      for (const vs of parsed.valueSets) {
        if (vs.oid) {
          const validation = validateOID(vs.oid, vs.name);
          oidValidations.push(validation);

          if (!validation.valid) {
            warnings.push(`OID validation failed for "${vs.name}": ${validation.errors.map(e => e.message).join(', ')}`);
          }
        }
      }
    }

    // Build population definition
    const population: PopulationDefinition = {
      id: `pop_${popSkeleton.type}_${Date.now()}`,
      type: popSkeleton.type as PopulationType,
      description: popSkeleton.briefDescription,
      narrative: parsed.narrative || popSkeleton.briefDescription,
      criteria: buildLogicalClause(parsed.criteria),
      confidence: parsed.criteria?.confidence || 'medium',
      reviewStatus: 'pending',
    };

    // Add any warnings from the LLM
    if (parsed.warnings) {
      warnings.push(...parsed.warnings);
    }

    return {
      populationType: popSkeleton.type as PopulationType,
      success: true,
      population,
      valueSets: parsed.valueSets?.map(normalizeValueSet) || [],
      oidValidations,
      errors,
      warnings,
    };
  } catch (err) {
    return {
      populationType: popSkeleton.type as PopulationType,
      success: false,
      errors: [err instanceof Error ? err.message : 'Unknown error'],
      warnings,
    };
  }
}

// ============================================================================
// Pass 3: Cross-Reference Validation
// ============================================================================

const VALIDATION_SYSTEM_PROMPT = `You are validating a measure specification extraction. Compare the original spec with what was extracted.

Identify:
1. Populations mentioned in the spec but MISSING from extraction
2. Criteria within populations that were NOT captured
3. Extracted criteria that DON'T appear in the original spec (hallucinations)
4. Any stratification requirements that were missed
5. Any supplemental data elements that were missed

Return JSON:
{
  "valid": true/false,
  "missingPopulations": ["list of population names that should exist but don't"],
  "missingCriteria": [
    {
      "specText": "Exact text from spec describing the criterion",
      "populationType": "which population it belongs to",
      "confidence": "high/medium/low"
    }
  ],
  "possibleHallucinations": [
    {
      "criterionDescription": "Description of extracted criterion",
      "populationType": "which population",
      "reason": "Why this might be hallucinated"
    }
  ],
  "suggestions": ["Actionable suggestions for fixing issues"]
}

Be thorough but conservative - only flag clear misses or hallucinations.`;

async function crossReferenceValidation(
  documentText: string,
  skeleton: MeasureSkeleton,
  populationResults: PopulationExtractionResult[],
  options: ExtractionOptions
): Promise<CrossReferenceResult> {
  // Build summary of what was extracted
  const extractedSummary = {
    measureId: skeleton.measureId,
    populations: populationResults.map(pr => ({
      type: pr.populationType,
      criteriaCount: pr.population?.criteria?.children?.length || 0,
      criteria: pr.population?.criteria?.children?.map((c: any) => c.description) || [],
    })),
  };

  const llmOptions: LLMRequestOptions = {
    provider: options.provider || 'anthropic',
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt: VALIDATION_SYSTEM_PROMPT,
    userPrompt: `Original Specification:\n${documentText.substring(0, 30000)}\n\n---\n\nExtracted Data:\n${JSON.stringify(extractedSummary, null, 2)}\n\nValidate the extraction and identify any gaps or errors.`,
    maxTokens: 4000,
    useBackendProxy: options.useBackendProxy,
  };

  try {
    const response = await callLLM(llmOptions);

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        valid: true,
        missingPopulations: [],
        missingCriteria: [],
        possibleHallucinations: [],
        suggestions: ['Could not parse validation response'],
      };
    }

    return JSON.parse(jsonMatch[0]) as CrossReferenceResult;
  } catch (err) {
    return {
      valid: true,
      missingPopulations: [],
      missingCriteria: [],
      possibleHallucinations: [],
      suggestions: [`Validation error: ${err instanceof Error ? err.message : 'Unknown'}`],
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildLogicalClause(criteria: any): LogicalClause {
  if (!criteria) {
    return {
      id: `clause_${Date.now()}`,
      operator: 'AND',
      description: 'Empty criteria',
      children: [],
      confidence: 'low',
      reviewStatus: 'pending',
    };
  }

  return {
    id: criteria.id || `clause_${Date.now()}`,
    operator: criteria.operator || 'AND',
    description: criteria.description || '',
    children: (criteria.children || []).map((child: any) => {
      if (child.operator && child.children) {
        // Nested clause
        return buildLogicalClause(child);
      }
      // Data element
      return buildDataElement(child);
    }),
    confidence: criteria.confidence || 'medium',
    reviewStatus: 'pending',
  };
}

function buildDataElement(raw: any): DataElement {
  return {
    id: raw.id || `elem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    type: raw.type || 'observation',
    description: raw.description || '',
    valueSet: raw.valueSet ? {
      id: `vs_${Date.now()}`,
      name: raw.valueSet.name || '',
      oid: raw.valueSet.oid,
      codes: [],
      confidence: 'medium',
    } : undefined,
    timingRequirements: raw.timingRequirements || [],
    negation: raw.negation || false,
    confidence: raw.confidence || 'medium',
    reviewStatus: 'pending',
  };
}

function normalizeValueSet(vs: any): ValueSetReference {
  return {
    id: vs.id || `vs_${Date.now()}`,
    name: vs.name || '',
    oid: vs.oid,
    url: vs.oid ? `http://cts.nlm.nih.gov/fhir/ValueSet/${vs.oid}` : undefined,
    codes: vs.codes || [],
    confidence: vs.confidence || 'medium',
  };
}

function assembleUMS(
  skeleton: MeasureSkeleton,
  populationResults: PopulationExtractionResult[],
  valueSets: ValueSetReference[]
): UniversalMeasureSpec {
  // Deduplicate value sets by OID
  const uniqueValueSets = new Map<string, ValueSetReference>();
  for (const vs of valueSets) {
    const key = vs.oid || vs.name;
    if (!uniqueValueSets.has(key)) {
      uniqueValueSets.set(key, vs);
    }
  }

  const populations = populationResults
    .filter(pr => pr.success && pr.population)
    .map(pr => pr.population!);

  const metadata: MeasureMetadata = {
    measureId: skeleton.measureId,
    title: skeleton.title,
    version: skeleton.version || '1.0.0',
    program: skeleton.programType as any,
    measureType: skeleton.measureType as any,
    steward: skeleton.steward || 'Unknown',
    description: skeleton.description || '',
    measurementPeriod: {
      start: skeleton.measurementPeriod?.start,
      end: skeleton.measurementPeriod?.end,
      inclusive: true,
    },
    lastUpdated: new Date().toISOString(),
    scoring: skeleton.scoring as any,
  };

  return {
    id: `ums_${Date.now()}`,
    resourceType: 'Measure',
    metadata,
    populations,
    valueSets: Array.from(uniqueValueSets.values()),
    status: 'in_progress',
    overallConfidence: skeleton.confidence,
    reviewProgress: {
      total: populations.length,
      approved: 0,
      pending: populations.length,
      flagged: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Chunking for Large Documents
// ============================================================================

/**
 * Chunk a large document for processing
 */
export function chunkDocument(
  text: string,
  maxChunkSize: number = 30000,
  overlap: number = 1000
): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChunkSize, text.length);

    // Try to break at a paragraph or sentence boundary
    if (end < text.length) {
      const lastParagraph = text.lastIndexOf('\n\n', end);
      const lastSentence = text.lastIndexOf('. ', end);

      if (lastParagraph > start + maxChunkSize / 2) {
        end = lastParagraph + 2;
      } else if (lastSentence > start + maxChunkSize / 2) {
        end = lastSentence + 2;
      }
    }

    chunks.push(text.substring(start, end));
    start = end - overlap;
  }

  return chunks;
}

/**
 * Check if document is too large for single-pass
 */
export function isLargeDocument(text: string, threshold: number = 40000): boolean {
  return text.length > threshold;
}
