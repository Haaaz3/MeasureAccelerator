/**
 * Measure Extraction Service
 *
 * Orchestrates AI-based measure extraction by calling the backend LLM proxy.
 * Extracts metadata, populations, criteria, and value sets from measure specifications.
 */

import { post } from '../api/client';
import type {
  UniversalMeasureSpec,
  PopulationDefinition,
  LogicalClause,
  DataElement,
  ValueSetReference,
  ConfidenceLevel,
  ReviewStatus,
  MeasureMetadata,
} from '../types/ums';
import { parseHtmlSpec, type HtmlSpecParseResult } from './htmlSpecParser';
import type { CqlParseResult } from './cqlParser';

// ============================================================================
// Types
// ============================================================================

export interface ExtractionOptions {
  provider?: string;
  model?: string;
  onProgress?: (phase: string, message: string) => void;
}

export interface ExtractionResult {
  success: boolean;
  ums: UniversalMeasureSpec | null;
  extractedData?: ExtractedData;
  skeleton?: ExtractedSkeleton;
  tokensUsed: number;
  error?: string;
}

interface ExtractedSkeleton {
  metadata: Partial<MeasureMetadata>;
  populationTypes: string[];
  valueSetCount: number;
  hasTimingConstraints: boolean;
  hasAgeConstraints: boolean;
  estimatedComplexity: 'low' | 'medium' | 'high';
}

interface ExtractedData {
  metadata: Partial<MeasureMetadata> & {
    rationale?: string;
    clinicalRecommendation?: string;
    measurementPeriod?: {
      start: string;
      end: string;
    };
  };
  globalConstraints?: {
    ageMin?: number | null;
    ageMax?: number | null;
    ageCalculation?: string;
    gender?: string;
  };
  populations: ExtractedPopulation[];
  valueSets: ExtractedValueSet[];
}

interface ExtractedPopulation {
  type: string;
  description: string;
  narrative?: string;
  criteria?: ExtractedCriteria;
}

interface ExtractedCriteria {
  operator?: 'AND' | 'OR';
  description?: string;
  children?: (ExtractedCriterion | ExtractedCriteria)[];
}

interface ExtractedCode {
  code: string;
  display?: string;
  system?: string;
}

interface ExtractedCriterion {
  type?: string;
  dataType?: string;
  description: string;
  valueSet?: { oid?: string; name?: string; codes?: ExtractedCode[] };
  directCodes?: ExtractedCode[];
  timing?: {
    type: string;
    period?: string;
    offset?: string;
    offsetUnit?: string;
  };
}

interface ExtractedValueSet {
  oid?: string;
  name: string;
  purpose?: string;
  version?: string;
  codeSystem?: string;
  codes?: ExtractedCode[];
}

interface LlmResponse {
  content: string;
  tokensUsed: number;
  provider: string;
  model: string;
}

// ============================================================================
// System Prompts
// ============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are an expert in healthcare quality measures, CQL (Clinical Quality Language), and FHIR.
Your task is to extract structured measure data from a quality measure specification document.

Extract the following information in valid JSON format:

{
  "metadata": {
    "measureId": "CMS measure ID (e.g., CMS130v12)",
    "title": "Full measure title",
    "version": "Version number",
    "steward": "Measure steward organization",
    "program": "Quality program (MIPS_CQM, eCQM, HEDIS, etc.)",
    "measureType": "process|outcome|structure|patient_experience",
    "description": "Brief description",
    "rationale": "Clinical rationale",
    "clinicalRecommendation": "Clinical recommendation statement",
    "measurementPeriod": {
      "start": "YYYY-01-01",
      "end": "YYYY-12-31"
    }
  },
  "globalConstraints": {
    "ageMin": number or null,
    "ageMax": number or null,
    "ageCalculation": "at_start|at_end|during",
    "gender": "any|male|female"
  },
  "populations": [
    {
      "type": "initial_population|denominator|numerator|denominator_exclusion|denominator_exception|numerator_exclusion",
      "description": "Human-readable description",
      "narrative": "Detailed narrative of criteria",
      "criteria": {
        "operator": "AND|OR",
        "children": [
          {
            "type": "dataElement|reference|logicalClause",
            "dataType": "Condition|Procedure|Encounter|Observation|MedicationRequest|etc.",
            "valueSet": { "oid": "2.16.840.1...", "name": "Value Set Name" },
            "directCodes": [{ "code": "E11.9", "display": "Type 2 diabetes", "system": "ICD10" }],
            "timing": { "type": "during|before|after|within", "period": "measurement_period|custom", "offset": "90 days", "offsetUnit": "days" },
            "description": "Description of this criterion"
          }
        ]
      }
    }
  ],
  "valueSets": [
    {
      "oid": "2.16.840.1.xxx",
      "name": "Value Set Name",
      "purpose": "What this value set represents",
      "codeSystem": "Primary code system (ICD10, SNOMED, CPT, LOINC, CVX, RxNorm)",
      "codes": [
        { "code": "E11.9", "display": "Type 2 diabetes mellitus", "system": "ICD10" },
        { "code": "44054006", "display": "Type 2 diabetes mellitus", "system": "SNOMED" }
      ]
    }
  ]
}

Important guidelines:
1. Extract ALL populations mentioned (IP, Denominator, Numerator, Exclusions, Exceptions)
2. CRITICAL: For each population, you MUST include a "criteria" object with an array of "children" data elements. Never leave criteria empty - extract at least one data element per population.
3. Capture timing constraints precisely (during measurement period, within 90 days, etc.)
4. Identify value sets by their OIDs when available
5. Use proper FHIR resource types for data elements (Condition, Procedure, Encounter, Observation, MedicationRequest, Immunization, etc.)
6. For age constraints, identify the calculation method (at start, at end, or during period)
7. Preserve the logical structure (AND/OR groupings) of criteria
8. Each data element in children MUST have: dataType (FHIR resource type), description (what this criterion checks for), and valueSet if applicable
9. CRITICAL - EXTRACT CODES: For each value set, extract ALL individual codes found in the document (look in CQL valueset declarations, XML, tables, appendices). Include code, display name, and system (ICD10, SNOMED, CPT, LOINC, CVX, RxNorm, HCPCS).
10. Look for CQL "valueset" declarations like: valueset "DTaP Vaccine": 'urn:oid:2.16.840.1...' and "code" declarations like: code "Disorder Name": '12345' from "SNOMEDCT"
11. For directCodes in criteria, extract individual codes that are NOT part of a value set but are directly referenced

Return ONLY the JSON object, no additional text or markdown.`;

const SKELETON_SYSTEM_PROMPT = `You are an expert in healthcare quality measures. Your task is to extract a high-level skeleton of a measure from its specification.

Extract the following in valid JSON format:

{
  "metadata": {
    "measureId": "CMS measure ID",
    "title": "Full measure title",
    "version": "Version number",
    "steward": "Measure steward",
    "program": "MIPS_CQM|eCQM|HEDIS|QOF|Registry|Custom",
    "measureType": "process|outcome|structure|patient_experience",
    "description": "Brief description"
  },
  "populationTypes": ["initial_population", "denominator", "numerator", "denominator_exclusion", "etc."],
  "valueSetCount": number,
  "hasTimingConstraints": boolean,
  "hasAgeConstraints": boolean,
  "estimatedComplexity": "low|medium|high"
}

Return ONLY the JSON object, no additional text.`;

const POPULATION_DETAIL_PROMPT = `You are an expert in healthcare quality measures. Given the following measure specification text and population type, extract detailed criteria for that population.

CRITICAL: You MUST include at least one data element in the criteria.children array. Never return empty children.

Extract in this JSON format:

{
  "type": "the_population_type",
  "description": "Human-readable description of who is in this population",
  "narrative": "Full narrative text from the specification",
  "criteria": {
    "operator": "AND",
    "children": [
      {
        "type": "dataElement",
        "dataType": "Encounter",
        "valueSet": { "oid": "2.16.840.1.113883.3.464.1003.101.12.1001", "name": "Office Visit" },
        "timing": { "type": "during", "period": "measurement_period" },
        "description": "Patient had an office visit during the measurement period"
      }
    ]
  }
}

Guidelines:
- dataType must be a FHIR resource type: Condition, Procedure, Encounter, Observation, MedicationRequest, Immunization, etc.
- Always include at least one meaningful data element in children array
- Include valueSet with OID and name when referenced in the specification
- Include timing constraints when specified

Return ONLY the JSON object.`;

// ============================================================================
// Main Extraction Functions
// ============================================================================

/**
 * Extract measure data from specification text using AI.
 */
export async function extractMeasure(
  documentText: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const { onProgress, provider, model } = options;

  try {
    // Phase 1: Skeleton extraction
    onProgress?.('skeleton', 'Analyzing document structure...');

    const skeletonResult = await callLlmExtract({
      systemPrompt: SKELETON_SYSTEM_PROMPT,
      userPrompt: `Extract the measure skeleton from this specification:\n\n${documentText}`,
      provider,
      model,
      maxTokens: 4000,
    });

    const skeleton = parseJsonResponse(skeletonResult.content) as ExtractedSkeleton | null;
    if (!skeleton) {
      throw new Error('Failed to parse skeleton extraction response');
    }

    onProgress?.('skeleton_complete', `Found ${skeleton.populationTypes?.length || 0} populations`);

    // Phase 2: Full extraction
    onProgress?.('extraction', 'Extracting populations and criteria...');

    const fullResult = await callLlmExtract({
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      userPrompt: `Extract complete measure data from this specification:\n\n${documentText}`,
      provider,
      model,
      maxTokens: 16000,
    });

    const extractedData = parseJsonResponse(fullResult.content) as ExtractedData | null;
    if (!extractedData) {
      throw new Error('Failed to parse extraction response');
    }

    // Debug: Log extracted data
    console.log('[extractMeasure] Raw LLM response:', fullResult.content.substring(0, 500));
    console.log('[EXTRACT-RAW] First population first criterion:',
      JSON.stringify(extractedData?.populations?.[0]?.criteria?.children?.[0], null, 2));
    console.log('[extractMeasure] Extracted populations:', extractedData.populations?.map(p => ({
      type: p.type,
      hasCriteria: !!p.criteria,
      criteriaChildren: p.criteria?.children?.length || 0,
    })));

    onProgress?.('extraction_complete', `Extracted ${extractedData.populations?.length || 0} populations`);

    // Phase 3: Convert to UMS format
    onProgress?.('converting', 'Converting to UMS format...');

    const ums = convertToUMS(extractedData);

    // Debug: Log first UMS data element
    console.log('=== POST-EXTRACT-UMS REACHED ===');
    console.log('[EXTRACT-UMS] First population first data element:',
      JSON.stringify(ums?.populations?.[0]?.criteria?.children?.[0], null, 2));

    // Count DataElements with value sets for verification
    try {
      let vsCount = 0;
      function countVs(node: any): void {
        if (!node) return;
        if (node.valueSet?.oid || node.valueSet?.name) vsCount++;
        if (node.children) node.children.forEach(countVs);
      }
      for (const pop of (ums?.populations || [])) {
        if (pop.criteria) countVs(pop.criteria);
      }
      console.log('[extractMeasure] FINAL: UMS has', vsCount, 'DataElements with value sets out of', (ums?.populations || []).length, 'populations');
    } catch (crashErr) {
      console.error('💥💥💥 CRASH AFTER [EXTRACT-UMS] 💥💥💥');
      console.error('💥 Error:', crashErr);
      console.error('💥 Message:', crashErr instanceof Error ? crashErr.message : String(crashErr));
      console.error('💥 Stack:', crashErr instanceof Error ? crashErr.stack : 'no stack');
    }

    try { console.log('=== LINE AFTER VSCOUNT TRY/CATCH ==='); } catch(e) { console.error('CRASH after vsCount:', e); }

    // Phase 4: Enrich DataElements with HTML and CQL parsing
    // This extracts real OIDs, codes, and mappings from the source document
    onProgress?.('enriching', 'Enriching data elements with codes and value sets...');
    try {
      console.log('[extractMeasure] Starting enrichment phase');

      // Parse HTML specification to extract value sets and data element mappings
      const htmlParsed = parseHtmlSpec(documentText);
      console.log('[extractMeasure] HTML parsing complete:', {
        valueSets: htmlParsed.valueSets.length,
        codes: htmlParsed.codes.length,
        mappings: htmlParsed.dataElementMappings.length,
      });

      // Parse CQL to extract value set declarations and code definitions
      const { parseCqlFromDocument, normalizeCodeSystem } = await import('./cqlParser');
      const cqlParsed = parseCqlFromDocument(documentText);
      console.log('[extractMeasure] CQL parsing complete:', {
        valueSets: cqlParsed.valueSets.length,
        codes: cqlParsed.codes.length,
      });

      // Enrich DataElements with HTML-parsed data FIRST
      // HTML enrichment replaces placeholder OIDs with real OIDs from the spec
      enrichDataElementsWithHtmlSpec(ums, htmlParsed);

      // THEN enrich with CQL-parsed data (can now match on real OIDs)
      enrichDataElementsWithCqlCodes(ums, cqlParsed, normalizeCodeSystem);

      // Count enriched DataElements
      let enrichedCount = 0;
      function countEnriched(node: any): void {
        if (!node) return;
        if (node.valueSet?.oid && /^\d+\.\d+/.test(node.valueSet.oid)) enrichedCount++;
        if (node.children) node.children.forEach(countEnriched);
      }
      for (const pop of (ums?.populations || [])) {
        if (pop.criteria) countEnriched(pop.criteria);
      }
      console.log('[extractMeasure] After enrichment:', enrichedCount, 'DataElements have real OIDs');

    } catch (enrichErr) {
      console.error('[extractMeasure] Enrichment error (continuing anyway):', enrichErr);
      // Continue without enrichment - we still have the LLM-extracted data
    }

    try {
      console.log('=== BEFORE onProgress ===');
      onProgress?.('complete', 'Extraction complete');
      console.log('=== AFTER onProgress ===');
    } catch(e) {
      console.error('=== onProgress CRASHED ===', e);
    }

    try { console.log('=== BEFORE RETURN ==='); } catch(e) { console.error('CRASH before return:', e); }

    return {
      success: true,
      ums,
      extractedData,
      skeleton,
      tokensUsed: (skeletonResult.tokensUsed || 0) + (fullResult.tokensUsed || 0),
    };
  } catch (error) {
    console.error('💥💥💥 OUTER CATCH in extractMeasure 💥💥💥');
    console.error('💥 Extraction error:', error);
    console.error('💥 Message:', error instanceof Error ? error.message : String(error));
    console.error('💥 Stack:', error instanceof Error ? error.stack : 'no stack');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Extraction failed',
      ums: null,
      tokensUsed: 0,
    };
  }
}

/**
 * Extract measure data using multi-pass strategy for complex documents.
 */
export async function extractMeasureMultiPass(
  documentText: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const { onProgress, provider, model } = options;

  try {
    // Phase 1: Get skeleton
    onProgress?.('skeleton', 'Analyzing document structure...');

    const skeletonResult = await callLlmExtract({
      systemPrompt: SKELETON_SYSTEM_PROMPT,
      userPrompt: `Extract the measure skeleton:\n\n${documentText}`,
      provider,
      model,
      maxTokens: 4000,
    });

    const skeleton = parseJsonResponse(skeletonResult.content) as ExtractedSkeleton | null;
    if (!skeleton) {
      throw new Error('Failed to parse skeleton');
    }

    const populationTypes = skeleton.populationTypes || [
      'initial_population',
      'denominator',
      'numerator',
    ];

    onProgress?.('skeleton_complete', `Found ${populationTypes.length} population types`);

    // Phase 2: Extract each population in detail
    const populations: ExtractedPopulation[] = [];
    let totalTokens = skeletonResult.tokensUsed || 0;

    for (let i = 0; i < populationTypes.length; i++) {
      const popType = populationTypes[i];
      onProgress?.('population', `Extracting ${formatPopulationType(popType)} (${i + 1}/${populationTypes.length})...`);

      const popResult = await callLlmExtract({
        systemPrompt: POPULATION_DETAIL_PROMPT,
        userPrompt: `Population type: ${popType}\n\nMeasure specification:\n${documentText}`,
        provider,
        model,
        maxTokens: 8000,
      });

      const popData = parseJsonResponse(popResult.content) as ExtractedPopulation | null;
      if (popData) {
        populations.push(popData);
      }

      totalTokens += popResult.tokensUsed || 0;
    }

    onProgress?.('populations_complete', `Extracted ${populations.length} populations`);

    // Phase 3: Extract value sets
    onProgress?.('valueSets', 'Identifying value sets...');

    const vsResult = await callLlmExtract({
      systemPrompt: `Extract all value sets referenced in this measure specification. Return JSON: { "valueSets": [{ "oid": "...", "name": "...", "purpose": "..." }] }`,
      userPrompt: documentText,
      provider,
      model,
      maxTokens: 4000,
    });

    const vsData = parseJsonResponse(vsResult.content) as { valueSets?: ExtractedValueSet[] } | null;
    totalTokens += vsResult.tokensUsed || 0;

    // Phase 4: Assemble full UMS
    onProgress?.('converting', 'Assembling UMS...');

    const extractedData: ExtractedData = {
      metadata: skeleton.metadata || {},
      populations,
      valueSets: vsData?.valueSets || [],
    };

    const ums = convertToUMS(extractedData);

    onProgress?.('complete', 'Multi-pass extraction complete');

    return {
      success: true,
      ums,
      extractedData,
      skeleton,
      tokensUsed: totalTokens,
    };
  } catch (error) {
    console.error('Multi-pass extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Multi-pass extraction failed',
      ums: null,
      tokensUsed: 0,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

interface LlmExtractRequest {
  systemPrompt: string;
  userPrompt: string;
  provider?: string;
  model?: string;
  maxTokens?: number;
  images?: string[];
}

/**
 * Call LLM for extraction - tries direct API first, falls back to backend proxy.
 */
async function callLlmExtract(request: LlmExtractRequest): Promise<LlmResponse> {
  // Try to get API key from settings store for direct API call
  const { useSettingsStore } = await import('../stores/settingsStore');
  const settings = useSettingsStore.getState();
  const apiKey = settings.getActiveApiKey?.() || settings.apiKeys?.anthropic;
  const provider = request.provider || settings.selectedProvider || 'anthropic';
  const model = request.model || settings.selectedModel || 'claude-sonnet-4-20250514';

  // If we have an API key, use direct API call (bypasses backend WebClient issues)
  if (apiKey) {
    console.log('[callLlmExtract] Using direct API call with frontend API key');
    const { callLLM } = await import('./llmClient');

    const response = await callLLM({
      provider: provider as 'anthropic' | 'openai' | 'google' | 'custom',
      model,
      apiKey,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      maxTokens: request.maxTokens || 16000,
      images: request.images,
    });

    return {
      content: response.content,
      tokensUsed: response.tokensUsed || 0,
    };
  }

  // Fall back to backend proxy
  console.log('[callLlmExtract] Using backend proxy (no frontend API key)');
  const response = await post<LlmResponse>('/llm/extract', {
    systemPrompt: request.systemPrompt,
    userPrompt: request.userPrompt,
    provider: provider || null,
    model: model || null,
    maxTokens: request.maxTokens || 16000,
    images: request.images || null,
  });

  return response;
}

/**
 * Parse JSON from LLM response, handling markdown code blocks.
 */
function parseJsonResponse(content: string): unknown | null {
  if (!content) return null;

  try {
    // Try direct parse first
    return JSON.parse(content);
  } catch {
    // Try extracting from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Fall through
      }
    }

    // Try finding JSON object boundaries
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        // Fall through
      }
    }

    console.warn('Failed to parse JSON response:', content.slice(0, 200));
    return null;
  }
}

/**
 * Convert extracted data to UMS format for the frontend.
 */
function convertToUMS(extractedData: ExtractedData): UniversalMeasureSpec {
  const now = new Date().toISOString();
  const metadata = extractedData.metadata || {};

  // Helper for unique IDs - prevents duplicate entity errors in backend
  const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Debug: Log input populations
  console.log('[convertToUMS] Input populations:', extractedData.populations?.length || 0);
  extractedData.populations?.forEach((pop, i) => {
    console.log(`[convertToUMS] Pop ${i}: type=${pop.type}, criteria=${JSON.stringify(pop.criteria)?.substring(0, 200)}`);
  });

  // Build populations array
  const populations: PopulationDefinition[] = (extractedData.populations || []).map((pop, idx) => {
    const criteria = convertCriteria(pop.criteria);
    console.log(`[convertToUMS] Converted pop ${idx}: type=${pop.type}, criteriaChildren=${criteria.children?.length || 0}`);
    return {
      id: `pop-${uniqueId()}`,
      type: mapPopulationType(pop.type),
      description: pop.description || '',
      narrative: pop.narrative || pop.description || '',
      criteria,
      confidence: 'medium' as ConfidenceLevel,
      reviewStatus: 'pending' as ReviewStatus,
    };
  });

  // Ensure we have at least IP, Denominator, Numerator
  const existingTypes = new Set(populations.map(p => p.type));
  const requiredTypes: Array<PopulationDefinition['type']> = ['initial-population', 'denominator', 'numerator'];

  for (const type of requiredTypes) {
    if (!existingTypes.has(type)) {
      populations.push({
        id: `pop-${uniqueId()}`,
        type,
        description: formatPopulationType(type),
        narrative: '',
        criteria: {
          id: `clause-${uniqueId()}`,
          operator: 'AND',
          description: '',
          children: [],
          confidence: 'medium' as ConfidenceLevel,
          reviewStatus: 'pending' as ReviewStatus,
        },
        confidence: 'low' as ConfidenceLevel,
        reviewStatus: 'pending' as ReviewStatus,
      });
    }
  }

  // Build value sets array - preserve codes from LLM extraction
  const valueSets: ValueSetReference[] = (extractedData.valueSets || []).map((vs, idx) => ({
    id: `vs-${uniqueId()}`,
    oid: vs.oid || '',
    name: vs.name || 'Unnamed Value Set',
    purpose: vs.purpose || '',
    version: vs.version || '',
    codes: (vs.codes || []).map(c => ({
      code: c.code,
      display: c.display || '',
      system: c.system || '',
    })),
  }));

  return {
    id: `ums-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    resourceType: 'Measure',
    metadata: {
      measureId: metadata.measureId || 'NEW-001',
      title: metadata.title || 'Extracted Measure',
      version: metadata.version || '1.0',
      steward: metadata.steward || '',
      program: mapProgram(metadata.program),
      measureType: mapMeasureType(metadata.measureType),
      description: metadata.description || '',
      rationale: metadata.rationale || '',
      clinicalRecommendation: metadata.clinicalRecommendation || '',
      measurementPeriod: {
        start: metadata.measurementPeriod?.start || `${new Date().getFullYear()}-01-01`,
        end: metadata.measurementPeriod?.end || `${new Date().getFullYear()}-12-31`,
        inclusive: true,
      },
      lastUpdated: now,
    },
    globalConstraints: extractedData.globalConstraints ? {
      ageRange: {
        min: extractedData.globalConstraints.ageMin ?? 0,
        max: extractedData.globalConstraints.ageMax ?? 150,
      },
      gender: (extractedData.globalConstraints.gender as 'any' | 'male' | 'female') || 'any',
    } : undefined,
    populations,
    valueSets,
    status: 'in_progress',
    overallConfidence: 'medium' as ConfidenceLevel,
    reviewProgress: {
      total: populations.length,
      approved: 0,
      pending: populations.length,
      flagged: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert extracted criteria to UMS LogicalClause format.
 */
let convertCriteriaDepth = 0;
function convertCriteria(criteria?: ExtractedCriteria): LogicalClause {
  convertCriteriaDepth++;
  console.log('[convertCriteria] ENTER depth=' + convertCriteriaDepth);

  // Helper to generate truly unique IDs
  const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  if (!criteria) {
    console.log('[convertCriteria] No criteria provided, returning empty clause');
    convertCriteriaDepth--;
    return {
      id: `clause-${uniqueId()}`,
      operator: 'AND',
      description: '',
      children: [],
      confidence: 'medium' as ConfidenceLevel,
      reviewStatus: 'pending' as ReviewStatus,
    };
  }
  console.log(`[convertCriteria] Converting criteria: operator=${criteria.operator}, children=${criteria.children?.length || 0}`);

  const clause: LogicalClause = {
    id: `clause-${uniqueId()}`,
    operator: criteria.operator || 'AND',
    description: criteria.description || '',
    children: [],
    confidence: 'medium' as ConfidenceLevel,
    reviewStatus: 'pending' as ReviewStatus,
  };

  if (Array.isArray(criteria.children)) {
    clause.children = criteria.children.map((child, idx) => {
      // Check if it's a nested clause (has operator property)
      if ('operator' in child) {
        return convertCriteria(child as ExtractedCriteria);
      }

      // Data element - use unique IDs to avoid duplicates across populations
      const criterion = child as ExtractedCriterion;
      const elemId = uniqueId();
      const dataElement: DataElement = {
        id: `elem-${elemId}`,
        type: mapElementType(criterion.dataType),
        description: criterion.description || '',
        confidence: 'medium' as ConfidenceLevel,
        reviewStatus: 'pending' as ReviewStatus,
      };

      if (criterion.valueSet && (criterion.valueSet.oid || criterion.valueSet.name)) {
        dataElement.valueSet = {
          id: `vs-${uniqueId()}`,
          oid: criterion.valueSet.oid || '',
          name: criterion.valueSet.name || '',
          // Preserve codes from LLM extraction
          codes: (criterion.valueSet.codes || []).map(c => ({
            code: c.code,
            display: c.display || '',
            system: c.system || '',
          })),
          confidence: 'medium' as ConfidenceLevel,
        };
        // DTaP trace logging
        if (criterion.description?.includes('DTaP') || criterion.valueSet?.name?.includes('DTaP')) {
          console.log('[TRACE-DTaP] Criterion:', JSON.stringify({ desc: criterion.description?.substring(0, 40), vsOid: criterion.valueSet.oid, vsName: criterion.valueSet.name }));
          console.log('[TRACE-DTaP] DataElement:', JSON.stringify({ id: dataElement.id, desc: dataElement.description?.substring(0, 40), vsOid: dataElement.valueSet?.oid, vsName: dataElement.valueSet?.name }));
        }
      }

      // Handle directCodes (codes not part of a value set)
      if (criterion.directCodes && criterion.directCodes.length > 0) {
        dataElement.directCodes = criterion.directCodes.map(c => ({
          code: c.code,
          display: c.display || '',
          system: c.system || '',
        }));
      }

      return dataElement;
    });
  }

  convertCriteriaDepth--;
  return clause;
}

/**
 * Map population type string to UMS type.
 */
function mapPopulationType(type: string): PopulationDefinition['type'] {
  const mapping: Record<string, PopulationDefinition['type']> = {
    'initial_population': 'initial-population',
    'INITIAL_POPULATION': 'initial-population',
    'denominator': 'denominator',
    'DENOMINATOR': 'denominator',
    'denominator_exclusion': 'denominator-exclusion',
    'DENOMINATOR_EXCLUSION': 'denominator-exclusion',
    'denominator_exception': 'denominator-exception',
    'DENOMINATOR_EXCEPTION': 'denominator-exception',
    'numerator': 'numerator',
    'NUMERATOR': 'numerator',
    'numerator_exclusion': 'numerator-exclusion',
    'NUMERATOR_EXCLUSION': 'numerator-exclusion',
    'measure_population': 'measure-population',
    'MEASURE_POPULATION': 'measure-population',
    'measure_observation': 'measure-observation',
    'MEASURE_OBSERVATION': 'measure-observation',
  };
  return mapping[type] || 'initial-population';
}

/**
 * Map element type to UMS DataElement type.
 */
function mapElementType(type?: string): DataElement['type'] {
  if (!type) return 'observation';
  const mapping: Record<string, DataElement['type']> = {
    'Condition': 'diagnosis',
    'condition': 'diagnosis',
    'Encounter': 'encounter',
    'encounter': 'encounter',
    'Procedure': 'procedure',
    'procedure': 'procedure',
    'Observation': 'observation',
    'observation': 'observation',
    'MedicationRequest': 'medication',
    'medication': 'medication',
    'Immunization': 'immunization',
    'immunization': 'immunization',
    'Patient': 'demographic',
    'demographic': 'demographic',
    'Device': 'device',
    'device': 'device',
    'Assessment': 'assessment',
    'assessment': 'assessment',
    'AllergyIntolerance': 'allergy',
    'allergy': 'allergy',
  };
  return mapping[type] || 'observation';
}

/**
 * Map program string to MeasureMetadata program type.
 */
function mapProgram(program?: string): MeasureMetadata['program'] {
  if (!program) return 'Custom';
  if (program.includes('MIPS') || program === 'MIPS_CQM') return 'MIPS_CQM';
  if (program === 'eCQM' || program === 'ECQM') return 'eCQM';
  if (program === 'HEDIS') return 'HEDIS';
  if (program === 'QOF') return 'QOF';
  if (program === 'Registry') return 'Registry';
  return 'Custom';
}

/**
 * Map measure type string to MeasureMetadata measureType.
 */
function mapMeasureType(type?: string): MeasureMetadata['measureType'] {
  if (!type) return 'process';
  if (type === 'outcome') return 'outcome';
  if (type === 'structure') return 'structure';
  if (type === 'patient_experience') return 'patient_experience';
  return 'process';
}

/**
 * Format population type for display.
 */
function formatPopulationType(type: string): string {
  const labels: Record<string, string> = {
    'initial_population': 'Initial Population',
    'initial-population': 'Initial Population',
    'denominator': 'Denominator',
    'numerator': 'Numerator',
    'denominator_exclusion': 'Denominator Exclusion',
    'denominator-exclusion': 'Denominator Exclusion',
    'denominator_exception': 'Denominator Exception',
    'denominator-exception': 'Denominator Exception',
    'numerator_exclusion': 'Numerator Exclusion',
    'numerator-exclusion': 'Numerator Exclusion',
    'measure_population': 'Measure Population',
    'measure-population': 'Measure Population',
    'measure_observation': 'Measure Observation',
    'measure-observation': 'Measure Observation',
  };
  return labels[type] || type.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// PDF Text Extraction (client-side)
// ============================================================================

/**
 * Extract text from a PDF file using pdf.js.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  // Dynamic import pdf.js
  const pdfjsLib = await import('pdfjs-dist');

  // Use local worker from public folder to avoid CORS issues
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: { str?: string }) => item.str || '').join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n\n');
}

/**
 * Extract text from uploaded files (PDF or text).
 */
export async function extractTextFromFiles(files: File[]): Promise<string> {
  const textParts: string[] = [];

  for (const file of files) {
    if (file.type === 'application/pdf') {
      try {
        const pdfText = await extractTextFromPDF(file);
        textParts.push(`--- ${file.name} ---\n${pdfText}`);
      } catch (error) {
        console.error(`Failed to extract PDF ${file.name}:`, error);
        textParts.push(`--- ${file.name} (extraction failed) ---`);
      }
    } else if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const text = await file.text();
      textParts.push(`--- ${file.name} ---\n${text}`);
    } else {
      console.warn(`Unsupported file type: ${file.type} for ${file.name}`);
    }
  }

  return textParts.join('\n\n');
}

// ============================================================================
// Enrichment Functions
// These enrich DataElements with real OIDs, codes, and mappings from HTML/CQL
// ============================================================================

/**
 * Enrich UMS DataElements with HTML-parsed value sets and data element mappings.
 * This replaces placeholder OIDs with real OIDs from the specification.
 */
export function enrichDataElementsWithHtmlSpec(
  ums: UniversalMeasureSpec,
  htmlResult: HtmlSpecParseResult
): void {
  // Build lookup maps
  const vsNameToOid = new Map<string, string>();
  const oidToVsName = new Map<string, string>();
  for (const vs of htmlResult.valueSets) {
    vsNameToOid.set(vs.name.toLowerCase(), vs.oid);
    oidToVsName.set(vs.oid, vs.name);
  }

  // Build data element mapping index
  const descriptionToMapping = new Map<string, typeof htmlResult.dataElementMappings[0]>();
  for (const mapping of htmlResult.dataElementMappings) {
    descriptionToMapping.set(mapping.fullDescription.toLowerCase(), mapping);
    descriptionToMapping.set(mapping.description.toLowerCase(), mapping);
  }

  // Build a map of value set names to associated codes
  // We match codes to value sets based on description similarity
  const vsNameToCodes = new Map<string, Array<{ code: string; display: string; system: string }>>();
  for (const vs of htmlResult.valueSets) {
    const vsNameLower = vs.name.toLowerCase();
    const matchingCodes: Array<{ code: string; display: string; system: string }> = [];

    for (const code of htmlResult.codes) {
      const codeDisplayLower = code.display.toLowerCase();
      // Match if code display contains key words from value set name or vice versa
      // Split VS name into significant words (3+ chars)
      const vsWords = vsNameLower.split(/\s+/).filter(w => w.length >= 3);
      const codeWords = codeDisplayLower.split(/\s+/).filter(w => w.length >= 3);

      // Check for word overlap (at least 2 matching words or name contains key phrase)
      const matchingWords = vsWords.filter(vw =>
        codeWords.some(cw => cw.includes(vw) || vw.includes(cw))
      );

      if (matchingWords.length >= 2 ||
          codeDisplayLower.includes(vsNameLower) ||
          vsNameLower.includes(codeDisplayLower.split('(')[0].trim())) {
        matchingCodes.push({
          code: code.code,
          display: code.display,
          system: code.system,
        });
      }
    }

    if (matchingCodes.length > 0) {
      vsNameToCodes.set(vsNameLower, matchingCodes);
      console.log(`[enrichHtml] Matched ${matchingCodes.length} codes to value set "${vs.name}"`);
    }
  }

  let enrichedCount = 0;
  let oidsAttached = 0;
  let codesAttached = 0;

  function isDataElement(node: DataElement | LogicalClause): node is DataElement {
    return 'type' in node && !('children' in node);
  }

  // Helper: check if an OID looks like a real OID (starts with digit and has dots)
  const isRealOid = (oid: string) => /^\d+\.\d+/.test(oid);

  // Helper: attach codes to a DataElement's valueSet if it doesn't already have codes
  function attachCodesToValueSet(elem: DataElement): void {
    if (!elem.valueSet?.name) return;
    if (elem.valueSet.codes && elem.valueSet.codes.length > 0) return; // Already has codes

    const vsNameLower = elem.valueSet.name.toLowerCase();
    const matchedCodes = vsNameToCodes.get(vsNameLower);

    if (matchedCodes && matchedCodes.length > 0) {
      elem.valueSet.codes = matchedCodes.map(c => ({
        code: c.code,
        display: c.display,
        system: c.system as any,
      }));
      codesAttached += matchedCodes.length;
      console.log(`[enrichHtml] Attached ${matchedCodes.length} codes to "${elem.valueSet.name}"`);
    }
  }

  function walkAndEnrich(node: DataElement | LogicalClause): void {
    if (!node) return;

    if (isDataElement(node)) {
      const elem = node;
      const desc = (elem.description || '').toLowerCase().trim();
      const vsName = (elem.valueSet?.name || '').toLowerCase().trim();

      // Strategy 1: Match by description against Data Criteria mappings
      let mapping = descriptionToMapping.get(desc);
      if (!mapping && vsName) {
        mapping = descriptionToMapping.get(vsName);
      }
      // Try partial matching
      if (!mapping) {
        for (const [key, m] of descriptionToMapping.entries()) {
          if (desc && (key.includes(desc) || desc.includes(key))) {
            mapping = m;
            break;
          }
        }
      }

      if (mapping) {
        if (mapping.valueSetOid) {
          if (!elem.valueSet) {
            (elem as any).valueSet = { id: '', oid: '', name: '', codes: [], confidence: 'medium' };
          }
          if (!elem.valueSet!.oid || !isRealOid(elem.valueSet!.oid)) {
            elem.valueSet!.oid = mapping.valueSetOid;
            oidsAttached++;
          }
          if (!elem.valueSet!.name || elem.valueSet!.name === '') {
            elem.valueSet!.name = mapping.valueSetName || oidToVsName.get(mapping.valueSetOid) || '';
          }
        }

        // Attach direct code from mapping
        if (mapping.directCode && (!elem.directCodes || elem.directCodes.length === 0)) {
          elem.directCodes = [{
            code: mapping.directCode,
            display: mapping.directCodeDisplay || mapping.description,
            system: (mapping.directCodeSystem as any) || 'SNOMED',
          }];
        }
      }

      // Strategy 2: If element has a value set name, look up its OID from HTML
      if (elem.valueSet?.name) {
        const realOid = vsNameToOid.get(elem.valueSet.name.toLowerCase());
        if (realOid) {
          const currentOid = elem.valueSet.oid || '';
          if (!currentOid || !isRealOid(currentOid)) {
            console.log(`[enrichHtml] Replacing OID for ${elem.valueSet.name}: "${currentOid}" → "${realOid}"`);
            elem.valueSet.oid = realOid;
            oidsAttached++;
          }
        }
      }

      // Strategy 3: If element has a value set OID, look up its name from HTML
      if (elem.valueSet?.oid && (!elem.valueSet?.name || elem.valueSet.name === '')) {
        const name = oidToVsName.get(elem.valueSet.oid);
        if (name) {
          elem.valueSet.name = name;
          enrichedCount++;
        }
      }

      // Strategy 4: Attach codes to the DataElement's valueSet from parsed HTML codes
      // This populates valueSet.codes based on name matching
      attachCodesToValueSet(elem);

      if (mapping || (elem.valueSet?.oid && isRealOid(elem.valueSet.oid))) enrichedCount++;
    } else {
      // LogicalClause — recurse into children
      const clause = node as LogicalClause;
      if (clause.children) clause.children.forEach(walkAndEnrich);
    }
  }

  // Walk all populations
  for (const pop of ums.populations || []) {
    if (pop.criteria) walkAndEnrich(pop.criteria);
  }

  // Also add HTML-parsed value sets to the UMS valueSets array
  // Include any matched codes for each value set
  const existingOids = new Set((ums.valueSets || []).map(vs => vs.oid));
  for (const htmlVs of htmlResult.valueSets) {
    if (!existingOids.has(htmlVs.oid)) {
      if (!ums.valueSets) ums.valueSets = [];
      const matchedCodes = vsNameToCodes.get(htmlVs.name.toLowerCase()) || [];
      ums.valueSets.push({
        id: `vs-html-${htmlVs.oid.replace(/\./g, '-')}`,
        oid: htmlVs.oid,
        name: htmlVs.name,
        purpose: '',
        version: '',
        codes: matchedCodes.map(c => ({
          code: c.code,
          display: c.display,
          system: c.system as any,
        })),
        confidence: 'high',
        verified: true,
      });
    }
  }

  console.log(`[enrichDataElementsWithHtmlSpec] Enriched ${enrichedCount} DataElements, ${oidsAttached} OIDs attached, ${codesAttached} codes attached`);
}

/**
 * Enrich UMS DataElements with CQL-parsed value sets and codes.
 * Fills in missing OIDs/names from CQL valueset declarations.
 */
export function enrichDataElementsWithCqlCodes(
  ums: UniversalMeasureSpec,
  cqlResult: CqlParseResult,
  normalizeCodeSystem: (s: string) => string
): void {
  // Build OID -> valueset lookup
  const oidToVs = new Map<string, typeof cqlResult.valueSets[0]>();
  const nameToVs = new Map<string, typeof cqlResult.valueSets[0]>();
  for (const vs of cqlResult.valueSets) {
    oidToVs.set(vs.oid, vs);
    nameToVs.set(vs.name.toLowerCase(), vs);
  }

  let enrichedCount = 0;
  let codesAttached = 0;

  // Helper: check if an OID looks like a real OID
  const isRealOid = (oid: string) => /^\d+\.\d+/.test(oid);

  function walkAndEnrich(node: DataElement | LogicalClause): void {
    if (!node) return;

    if ('type' in node && !('children' in node)) {
      // DataElement
      const elem = node as DataElement;

      // 1. If DataElement has valueSet with OID, try to fill in name from CQL
      if (elem.valueSet?.oid && isRealOid(elem.valueSet.oid)) {
        const cqlVs = oidToVs.get(elem.valueSet.oid);
        if (cqlVs) {
          if (!elem.valueSet.name || elem.valueSet.name === '') {
            elem.valueSet.name = cqlVs.name;
            enrichedCount++;
          }
          elem.valueSet.version = elem.valueSet.version || cqlVs.version;
        }
      }

      // 2. If DataElement has valueSet with name, try to fill in/replace OID from CQL
      if (elem.valueSet?.name) {
        const cqlVs = nameToVs.get(elem.valueSet.name.toLowerCase());
        if (cqlVs) {
          const currentOid = elem.valueSet.oid || '';
          if (!currentOid || !isRealOid(currentOid)) {
            console.log(`[enrichCql] Replacing OID for ${elem.valueSet.name}: "${currentOid}" → "${cqlVs.oid}"`);
            elem.valueSet.oid = cqlVs.oid;
            elem.valueSet.version = elem.valueSet.version || cqlVs.version;
            enrichedCount++;
          }
        }
      }

      // 3. Try to match CQL codes to DataElement by description
      if (!elem.directCodes || elem.directCodes.length === 0) {
        const descLower = (elem.description || '').toLowerCase();
        for (const cqlCode of cqlResult.codes) {
          const codeNameLower = cqlCode.name.toLowerCase();
          if (descLower.includes(codeNameLower) || codeNameLower.includes(descLower.split(' ').slice(0, 3).join(' '))) {
            elem.directCodes = [{
              code: cqlCode.code,
              display: cqlCode.name,
              system: normalizeCodeSystem(cqlCode.system),
            }];
            codesAttached++;
            break;
          }
        }
      }
    } else {
      // LogicalClause — recurse
      const clause = node as LogicalClause;
      if (clause.children) clause.children.forEach(walkAndEnrich);
    }
  }

  // Walk all populations
  for (const pop of ums.populations || []) {
    if (pop.criteria) walkAndEnrich(pop.criteria);
  }

  console.log('[enrichDataElementsWithCqlCodes] Enriched', enrichedCount, 'DataElements,', codesAttached, 'codes attached');
}

export default {
  extractMeasure,
  extractMeasureMultiPass,
  extractTextFromPDF,
  extractTextFromFiles,
};
