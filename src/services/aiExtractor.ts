/**
 * AI Extraction Service
 *
 * Uses various LLM APIs to intelligently extract measure specifications
 * from document content and convert to UMS format.
 *
 * Supports: Anthropic (Claude), OpenAI (GPT), Google (Gemini)
 */

import type {
  UniversalMeasureSpec,
  PopulationDefinition,
  ValueSetReference,
  MeasureType,
  ConfidenceLevel,
  CodeSystem,
  DataElement,
  LogicalClause,
  TimingRequirement,
  LogicalOperator,
  CodeReference,
} from '../types/ums';
import {
  getValueSetByOID,
  getCRCScreeningNumeratorValueSets,
  getCRCScreeningExclusionValueSets,
  getChildhoodImmunizationValueSets,
  type StandardValueSet,
} from '../constants/standardValueSets';

// API URLs
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const GOOGLE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Default models for each provider
const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  google: 'gemini-1.5-pro',
};

export interface ExtractionProgress {
  stage: 'extracting' | 'parsing' | 'building' | 'complete' | 'error';
  message: string;
  progress: number;
}

export interface AIExtractionResult {
  success: boolean;
  ums?: UniversalMeasureSpec;
  rawExtraction?: ExtractedMeasureData;
  error?: string;
  tokensUsed?: number;
}

interface ExtractedCriterion {
  type: 'diagnosis' | 'encounter' | 'procedure' | 'observation' | 'medication' | 'demographic' | 'assessment' | 'immunization';
  description: string;
  valueSetName?: string;
  valueSetOid?: string;
  directCodes?: { code: string; display: string; system: string }[];
  timing?: {
    description: string;
    relativeTo: string;
    window?: { value: number; unit: string; direction: string };
  };
  ageRange?: { min: number; max: number; unit: string };
  thresholds?: { operator: string; value: number | string; unit?: string };
}

interface ExtractedPopulation {
  type: string;
  description: string;
  narrative: string;
  cqlExpression?: string;
  logicOperator: 'AND' | 'OR';
  criteria: ExtractedCriterion[];
}

interface ExtractedValueSet {
  name: string;
  oid?: string;
  version?: string;
  purpose?: string;
  codeSystem: string;
  codes: { code: string; display: string; system: string }[];
}

interface ExtractedMeasureData {
  measureId: string;
  title: string;
  version: string;
  description: string;
  measureType: string;
  steward: string;
  cbeNumber?: string;
  rationale?: string;
  clinicalRecommendation?: string;
  populations: ExtractedPopulation[];
  valueSets: ExtractedValueSet[];
  supplementalData?: string[];
  measurementPeriod?: string;
  ageRange?: { min: number; max: number; unit: string };
}

type LLMProvider = 'anthropic' | 'openai' | 'google' | 'custom';

export interface CustomLLMConfig {
  baseUrl: string;
  modelName: string;
}

/**
 * Extract measure data from document content using AI
 * Supports multiple LLM providers: Anthropic (Claude), OpenAI (GPT), Google (Gemini), Custom/Local
 */
export async function extractMeasureWithAI(
  documentContent: string,
  apiKey: string,
  onProgress?: (progress: ExtractionProgress) => void,
  provider: LLMProvider = 'anthropic',
  model?: string,
  customConfig?: CustomLLMConfig
): Promise<AIExtractionResult> {
  // For custom provider, API key is optional but base URL is required
  if (provider === 'custom') {
    if (!customConfig?.baseUrl) {
      return {
        success: false,
        error: 'Custom LLM base URL is required',
      };
    }
  } else if (!apiKey) {
    return {
      success: false,
      error: 'API key is required for AI extraction',
    };
  }

  const actualModel = provider === 'custom'
    ? (customConfig?.modelName || 'default')
    : (model || DEFAULT_MODELS[provider as keyof typeof DEFAULT_MODELS]);
  const providerNames: Record<LLMProvider, string> = {
    anthropic: 'Claude',
    openai: 'GPT',
    google: 'Gemini',
    custom: 'Custom LLM',
  };

  try {
    onProgress?.({ stage: 'extracting', message: `Sending to ${providerNames[provider]} for analysis...`, progress: 10 });

    // Truncate content if too long
    const maxContentLength = provider === 'google' ? 100000 : 150000;
    const truncatedContent = documentContent.length > maxContentLength
      ? documentContent.substring(0, maxContentLength) + '\n\n[Content truncated due to length...]'
      : documentContent;

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(truncatedContent);

    // Call the appropriate API based on provider
    let content: string;
    let tokensUsed: number | undefined;

    if (provider === 'anthropic') {
      const result = await callAnthropicAPI(apiKey, actualModel, systemPrompt, userPrompt);
      content = result.content;
      tokensUsed = result.tokensUsed;
    } else if (provider === 'openai') {
      const result = await callOpenAIAPI(apiKey, actualModel, systemPrompt, userPrompt);
      content = result.content;
      tokensUsed = result.tokensUsed;
    } else if (provider === 'google') {
      const result = await callGoogleAPI(apiKey, actualModel, systemPrompt, userPrompt);
      content = result.content;
      tokensUsed = result.tokensUsed;
    } else if (provider === 'custom' && customConfig) {
      const result = await callCustomAPI(customConfig.baseUrl, apiKey, actualModel, systemPrompt, userPrompt);
      content = result.content;
      tokensUsed = result.tokensUsed;
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    onProgress?.({ stage: 'parsing', message: 'Parsing AI response...', progress: 60 });

    // Debug logging
    console.log('=== AI EXTRACTION DEBUG ===');
    console.log('Raw AI response length:', content.length);
    console.log('First 500 chars:', content.substring(0, 500));

    let extractedData = parseAIResponse(content);

    if (!extractedData) {
      console.error('Failed to parse AI response. Full content:', content);
      throw new Error('Failed to parse AI response');
    }

    // Debug: Log extracted data
    console.log('Extracted valueSets count:', extractedData.valueSets?.length || 0);
    console.log('Extracted populations count:', extractedData.populations?.length || 0);
    if (extractedData.valueSets?.length > 0) {
      console.log('First valueSet:', JSON.stringify(extractedData.valueSets[0], null, 2));
    }
    if (extractedData.populations?.length > 0) {
      console.log('First population criteria count:', extractedData.populations[0].criteria?.length || 0);
    }

    // Enrich value sets with complete codes from standard sources
    onProgress?.({ stage: 'building', message: 'Enriching value sets from standard sources...', progress: 70 });
    extractedData = enrichValueSetsFromStandards(extractedData);
    console.log('After enrichment, valueSets count:', extractedData.valueSets?.length || 0);

    onProgress?.({ stage: 'building', message: 'Building UMS structure...', progress: 80 });

    // Convert to UMS format
    const ums = convertToUMS(extractedData);

    onProgress?.({ stage: 'complete', message: 'Extraction complete', progress: 100 });

    return {
      success: true,
      ums,
      rawExtraction: extractedData,
      tokensUsed,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    onProgress?.({ stage: 'error', message: errorMessage, progress: 0 });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Build system prompt for measure extraction
 */
function buildSystemPrompt(): string {
  return `You are an expert clinical quality measure analyst specializing in eCQM, MIPS CQM, HEDIS, and QOF measures. Your task is to extract COMPLETE structured measure specification data including ALL value sets with their codes.

CRITICAL: You must extract EVERY value set mentioned in the document with ALL their codes. This is essential for measure implementation.

You must respond with ONLY a valid JSON object (no markdown, no explanation). The JSON must follow this exact schema:

{
  "measureId": "CMS###v##" (include version in ID),
  "title": "Full measure title",
  "version": "Version number (e.g., 13.0.000)",
  "description": "Complete measure description",
  "measureType": "process" | "outcome" | "structure",
  "steward": "Organization name",
  "cbeNumber": "NQF/CBE number if present (e.g., 0055)",
  "rationale": "Clinical rationale for the measure",
  "clinicalRecommendation": "Clinical recommendation statement with citations",
  "ageRange": { "min": number, "max": number, "unit": "years" },
  "measurementPeriod": "Calendar year or specific period",

  "populations": [
    {
      "type": "initial_population" | "denominator" | "denominator_exclusion" | "denominator_exception" | "numerator" | "numerator_exclusion",
      "description": "Brief one-line description",
      "narrative": "Complete narrative definition from the spec",
      "logicOperator": "AND" | "OR",
      "cqlExpression": "Full CQL definition if present",
      "criteria": [
        {
          "type": "diagnosis" | "encounter" | "procedure" | "observation" | "medication" | "demographic" | "assessment" | "immunization",
          "description": "What this criterion checks for",
          "valueSetName": "Exact name of value set used (must match a valueSets entry)",
          "valueSetOid": "OID like 2.16.840.1.113883.3.464.1003.101.12.1001",
          "directCodes": [{"code": "E11.9", "display": "Type 2 diabetes", "system": "ICD10"}],
          "timing": {
            "description": "During measurement period",
            "relativeTo": "measurement_period",
            "window": { "value": 12, "unit": "months", "direction": "before" }
          },
          "ageRange": { "min": 18, "max": 75, "unit": "years" },
          "thresholds": { "operator": ">", "value": 9, "unit": "%" }
        }
      ]
    }
  ],

  "valueSets": [
    {
      "name": "Diabetes Value Set Name",
      "oid": "2.16.840.1.113883.3.464.1003.103.12.1001",
      "version": "Version if specified",
      "purpose": "Used for denominator inclusion - identifies diabetic patients",
      "codeSystem": "Primary code system (ICD10, SNOMED, etc.)",
      "codes": [
        { "code": "E11.9", "display": "Type 2 diabetes mellitus without complications", "system": "ICD10" },
        { "code": "E11.65", "display": "Type 2 diabetes mellitus with hyperglycemia", "system": "ICD10" },
        { "code": "E13.9", "display": "Other specified diabetes mellitus without complications", "system": "ICD10" }
      ]
    }
  ],

  "supplementalData": ["Ethnicity", "Payer", "Race", "Sex"]
}

EXTRACTION RULES:
1. POPULATIONS: Extract ALL population types with structured criteria objects, not just strings
2. CRITERIA DETAIL: Each criterion must specify its type and link to a valueSetName/valueSetOid
3. VALUE SETS - CRITICAL:
   - Extract EVERY value set referenced in the measure
   - Include the FULL OID (2.16.840.1.113883.x.xxx.xxx...)
   - Extract ALL codes listed in each value set (ICD-10, CPT, SNOMED, LOINC, HCPCS, RxNorm, CVX)
   - Look in tables, appendices, and code lists for the actual codes
4. TIMING: Include temporal requirements (during measurement period, within X months, etc.)
5. THRESHOLDS: For outcome measures, include numeric thresholds (e.g., HbA1c > 9%)
6. AGE REQUIREMENTS: Extract age criteria with min/max/unit
7. CQL: Include full CQL expressions when present in the document

COMMON VALUE SET PATTERNS TO LOOK FOR:
- "Office Visit" OIDs typically: 2.16.840.1.113883.3.464.1003.101.12.1001
- "Annual Wellness Visit"
- "Preventive Care Services"
- "Home Healthcare Services"
- "Telephone Visits", "Online Assessments"
- Disease-specific value sets (Diabetes, Hypertension, etc.)
- Lab test value sets (HbA1c, LDL, etc.)
- Medication value sets

WELL-KNOWN VALUE SET OIDs (use these when you recognize the value set type):
- Colonoscopy: 2.16.840.1.113883.3.464.1003.108.12.1020
- FOBT (Fecal Occult Blood Test): 2.16.840.1.113883.3.464.1003.198.12.1011
- FIT-DNA Test: 2.16.840.1.113883.3.464.1003.108.12.1039
- Flexible Sigmoidoscopy: 2.16.840.1.113883.3.464.1003.198.12.1010
- CT Colonography: 2.16.840.1.113883.3.464.1003.108.12.1038
- Colorectal Cancer: 2.16.840.1.113883.3.464.1003.108.12.1001
- Total Colectomy: 2.16.840.1.113883.3.464.1003.198.12.1019
- Hospice Care: 2.16.840.1.113883.3.464.1003.1003
- Advanced Illness/Dementia: 2.16.840.1.113883.3.464.1003.113.12.1050
- Frailty: 2.16.840.1.113883.3.464.1003.113.12.1074

IMMUNIZATION MEASURES (e.g., Childhood Immunization Status CMS117):
- Use type "immunization" for ALL vaccine/immunization criteria — NEVER use "procedure"
- Childhood immunization measures typically require ALL of these 10 vaccine groups as SEPARATE criteria in the numerator:
  1. DTaP (Diphtheria, Tetanus, Pertussis) - OID: 2.16.840.1.113883.3.464.1003.196.12.1214
  2. IPV (Inactivated Polio) - OID: 2.16.840.1.113883.3.464.1003.196.12.1219
  3. MMR (Measles, Mumps, Rubella) - OID: 2.16.840.1.113883.3.464.1003.196.12.1224
  4. Hib (Haemophilus influenzae type b) - OID: 2.16.840.1.113883.3.464.1003.110.12.1085
  5. Hepatitis B - OID: 2.16.840.1.113883.3.464.1003.196.12.1216
  6. VZV/Varicella (Chickenpox) - OID: 2.16.840.1.113883.3.464.1003.196.12.1236
  7. PCV (Pneumococcal Conjugate) - OID: 2.16.840.1.113883.3.464.1003.196.12.1221
  8. Hepatitis A - OID: 2.16.840.1.113883.3.464.1003.196.12.1215
  9. Rotavirus - OID: 2.16.840.1.113883.3.464.1003.196.12.1223
  10. Influenza - OID: 2.16.840.1.113883.3.464.1003.196.12.1218
- Each vaccine group should be its own criterion with type "immunization"
- Vaccines use CVX codes (e.g., CVX 20 = DTaP), not CPT or SNOMED
- The numerator logic is typically AND (all vaccines required)

CRITICAL OID EXTRACTION:
- Always extract the FULL OID (2.16.840.1.113883.x.xxx.xxx.xx.xxxx format)
- OIDs are essential for automated value set enrichment
- Even if you can't extract all codes, the OID allows us to look them up from standard sources

Be extremely thorough. A complete extraction should have:
- 5-8+ value sets for a typical measure
- 10-50+ codes per value set (but OID is more important than individual codes)
- Structured criteria for each population with valueSet references
- Every value set should have an OID if mentioned in the document`;
}

/**
 * Build user prompt with document content
 */
function buildUserPrompt(content: string): string {
  return `Extract the COMPLETE clinical quality measure specification from the following document content.

IMPORTANT EXTRACTION REQUIREMENTS:
1. Extract ALL value sets with their COMPLETE code lists (ICD-10, CPT, SNOMED, LOINC codes)
2. For each population (Initial Population, Denominator, Numerator, Exclusions, Exceptions):
   - Create structured criteria objects linking to value sets
   - Include timing requirements (during measurement period, within X months, etc.)
   - Include any thresholds (e.g., HbA1c > 9%, BMI >= 25)
3. Look for code lists in tables, appendices, and anywhere codes are listed
4. Include OIDs for value sets (format: 2.16.840.1.113883.x.xxx.xxx...)
5. Extract CQL expressions if present

DOCUMENT CONTENT:
${content}

Return ONLY valid JSON matching the schema. Include ALL value sets with ALL their codes. Be thorough - a complete measure should have 5-10+ value sets with 10-100+ codes each.`;
}

/**
 * Call Anthropic (Claude) API
 */
async function callAnthropicAPI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; tokensUsed?: number }> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.content?.[0]?.text || '',
    tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  };
}

/**
 * Call OpenAI (GPT) API
 */
async function callOpenAIAPI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; tokensUsed?: number }> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0),
  };
}

/**
 * Call Google (Gemini) API
 */
async function callGoogleAPI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; tokensUsed?: number }> {
  const url = `${GOOGLE_API_URL}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `${systemPrompt}\n\n${userPrompt}` },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 16000,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Google API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return {
    content,
    tokensUsed: data.usageMetadata?.totalTokenCount,
  };
}

/**
 * Call Custom/Local LLM API (OpenAI-compatible format)
 */
async function callCustomAPI(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; tokensUsed?: number }> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // Only add Authorization header if API key is provided
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Custom LLM API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0),
  };
}

/**
 * Parse AI response to extract JSON
 */
function parseAIResponse(content: string): ExtractedMeasureData | null {
  try {
    // Try to parse directly
    const parsed = JSON.parse(content);
    return validateExtractedData(parsed);
  } catch {
    // Try to find JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateExtractedData(parsed);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Validate and normalize extracted data
 */
function validateExtractedData(data: any): ExtractedMeasureData | null {
  if (!data || typeof data !== 'object') return null;

  // Normalize populations to ensure criteria are properly structured
  const normalizedPopulations: ExtractedPopulation[] = (Array.isArray(data.populations) ? data.populations : []).map((pop: any) => {
    // Handle both old format (criteria as strings) and new format (criteria as objects)
    let criteria: ExtractedCriterion[] = [];
    if (Array.isArray(pop.criteria)) {
      criteria = pop.criteria.map((crit: any) => {
        if (typeof crit === 'string') {
          // Old format: convert string to basic criterion
          return {
            type: 'assessment' as const,
            description: crit,
          };
        }
        // New format: use structured criterion
        let criterionType = crit.type || 'assessment';

        // Normalize vaccine/immunization criteria that were mistyped as 'procedure'
        if (criterionType === 'procedure' || criterionType === 'assessment') {
          const desc = (crit.description || '').toLowerCase();
          const vsName = (crit.valueSetName || '').toLowerCase();
          if (/\b(vaccine|vaccination|immunization|immunize|dtap|ipv|mmr|hib|hepatitis\s*[ab]|varicella|chickenpox|pneumococcal|pcv|rotavirus|influenza|polio|diphtheria|tetanus|pertussis|measles|mumps|rubella)\b/i.test(desc) ||
              /\b(vaccine|vaccination|immunization|dtap|ipv|mmr|hib|hep\s*[ab]|varicella|pcv|rotavirus|influenza)\b/i.test(vsName)) {
            criterionType = 'immunization';
          }
        }

        return {
          type: criterionType,
          description: crit.description || '',
          valueSetName: crit.valueSetName,
          valueSetOid: crit.valueSetOid,
          directCodes: crit.directCodes,
          timing: crit.timing,
          ageRange: crit.ageRange,
          thresholds: crit.thresholds,
        } as ExtractedCriterion;
      });
    }

    return {
      type: pop.type || 'initial_population',
      description: pop.description || '',
      narrative: pop.narrative || pop.description || '',
      cqlExpression: pop.cqlExpression,
      logicOperator: (pop.logicOperator || 'AND') as 'AND' | 'OR',
      criteria,
    };
  });

  // Normalize value sets to ensure codes are properly structured
  const normalizedValueSets: ExtractedValueSet[] = (Array.isArray(data.valueSets) ? data.valueSets : []).map((vs: any) => ({
    name: vs.name || 'Unknown Value Set',
    oid: vs.oid,
    version: vs.version,
    purpose: vs.purpose,
    codeSystem: vs.codeSystem || 'ICD10',
    codes: (Array.isArray(vs.codes) ? vs.codes : []).map((c: any) => ({
      code: c.code || '',
      display: c.display || '',
      system: c.system || 'ICD10',
    })),
  }));

  return {
    measureId: data.measureId || 'Unknown',
    title: data.title || 'Untitled Measure',
    version: data.version || '1.0',
    description: data.description || '',
    measureType: data.measureType || 'process',
    steward: data.steward || 'Unknown',
    cbeNumber: data.cbeNumber,
    rationale: data.rationale,
    clinicalRecommendation: data.clinicalRecommendation,
    populations: normalizedPopulations,
    valueSets: normalizedValueSets,
    supplementalData: data.supplementalData,
    measurementPeriod: data.measurementPeriod,
    ageRange: data.ageRange,
  };
}

/**
 * Convert extracted data to UMS format
 */
function convertToUMS(data: ExtractedMeasureData): UniversalMeasureSpec {
  const now = new Date().toISOString();
  const id = `ums-${data.measureId.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;

  // First, build a map of value sets by name for easy lookup
  const valueSetsByName = new Map<string, ValueSetReference>();

  // Convert value sets first so we can reference them from criteria
  const valueSets: ValueSetReference[] = data.valueSets.map((vs, idx) => {
    const valueSet: ValueSetReference = {
      id: `vs-${idx}`,
      name: vs.name,
      oid: vs.oid,
      version: vs.version,
      confidence: vs.oid ? 'high' as ConfidenceLevel : 'medium' as ConfidenceLevel,
      source: 'AI Extraction',
      verified: false,
      codes: (vs.codes || []).map(c => ({
        code: c.code,
        display: c.display,
        system: mapCodeSystem(c.system),
      })),
      totalCodeCount: vs.codes?.length || 0,
    };
    valueSetsByName.set(vs.name.toLowerCase(), valueSet);
    if (vs.oid) {
      valueSetsByName.set(vs.oid, valueSet);
    }
    return valueSet;
  });

  // Helper to find a value set by name or OID
  const findValueSet = (name?: string, oid?: string): ValueSetReference | undefined => {
    if (oid && valueSetsByName.has(oid)) {
      return valueSetsByName.get(oid);
    }
    if (name) {
      const lower = name.toLowerCase();
      if (valueSetsByName.has(lower)) {
        return valueSetsByName.get(lower);
      }
      // Fuzzy match
      for (const [key, vs] of valueSetsByName.entries()) {
        if (key.includes(lower) || lower.includes(key)) {
          return vs;
        }
      }
    }
    return undefined;
  };

  // Convert populations with rich criteria structure
  const populations: PopulationDefinition[] = data.populations.map((pop, idx) => {
    const criteriaList = pop.criteria || [];
    const popType = mapPopulationType(pop.type);

    // Build DataElement children from extracted criteria
    const children: (DataElement | LogicalClause)[] = criteriaList.map((crit, cidx) => {
      // Find matching value set
      const linkedValueSet = findValueSet(crit.valueSetName, crit.valueSetOid);

      // Build timing requirements
      const timingRequirements: TimingRequirement[] = [];
      if (crit.timing) {
        timingRequirements.push({
          description: crit.timing.description || 'During measurement period',
          relativeTo: crit.timing.relativeTo || 'measurement_period',
          window: crit.timing.window ? {
            value: crit.timing.window.value,
            unit: crit.timing.window.unit as 'days' | 'weeks' | 'months' | 'years',
            direction: crit.timing.window.direction as 'before' | 'after' | 'within',
          } : undefined,
          confidence: 'high' as ConfidenceLevel,
        });
      }

      // Build direct codes if no value set but codes provided
      const directCodes: CodeReference[] = (crit.directCodes || []).map(c => ({
        code: c.code,
        display: c.display,
        system: mapCodeSystem(c.system),
      }));

      // Build additional requirements from thresholds
      const additionalRequirements: string[] = [];
      if (crit.thresholds) {
        additionalRequirements.push(
          `${crit.thresholds.operator} ${crit.thresholds.value}${crit.thresholds.unit ? ` ${crit.thresholds.unit}` : ''}`
        );
      }
      if (crit.ageRange && (crit.type !== 'demographic')) {
        additionalRequirements.push(
          `Age ${crit.ageRange.min}-${crit.ageRange.max} ${crit.ageRange.unit}`
        );
      }

      // If this criterion has an ageRange, treat it as a demographic element with thresholds
      const elementType = crit.ageRange ? 'demographic' : (crit.type || 'assessment');
      const ageThresholds = crit.ageRange ? {
        ageMin: crit.ageRange.min,
        ageMax: crit.ageRange.max,
      } : undefined;

      const dataElement: DataElement = {
        id: `${popType}-elem-${idx}-${cidx}`,
        type: elementType as any,
        description: crit.description,
        valueSet: linkedValueSet ? {
          id: linkedValueSet.id,
          name: linkedValueSet.name,
          oid: linkedValueSet.oid,
          codes: linkedValueSet.codes,
          confidence: linkedValueSet.confidence,
          totalCodeCount: linkedValueSet.totalCodeCount,
        } : undefined,
        directCodes: directCodes.length > 0 ? directCodes : undefined,
        thresholds: ageThresholds || (crit.thresholds ? {
          valueMin: typeof crit.thresholds.value === 'number' ? crit.thresholds.value : undefined,
        } : undefined),
        timingRequirements: timingRequirements.length > 0 ? timingRequirements : undefined,
        additionalRequirements: additionalRequirements.length > 0 ? additionalRequirements : undefined,
        confidence: linkedValueSet ? 'high' as ConfidenceLevel : 'medium' as ConfidenceLevel,
        source: 'AI Extraction',
        reviewStatus: 'pending' as const,
      };

      return dataElement;
    });

    // If no structured criteria, create a placeholder from the narrative
    if (children.length === 0 && pop.narrative) {
      children.push({
        id: `${popType}-elem-${idx}-0`,
        type: 'assessment' as const,
        description: pop.narrative.substring(0, 500),
        confidence: 'low' as ConfidenceLevel,
        source: 'AI Extraction (narrative only)',
        reviewStatus: 'pending' as const,
      });
    }

    return {
      id: `${popType}-${idx}`,
      type: popType,
      description: pop.description || pop.narrative?.substring(0, 200) || '',
      narrative: pop.narrative || pop.description || '',
      confidence: children.some(c => (c as DataElement).valueSet) ? 'high' as ConfidenceLevel : 'medium' as ConfidenceLevel,
      reviewStatus: 'pending' as const,
      criteria: {
        id: `${popType}-criteria-${idx}`,
        operator: (pop.logicOperator || 'AND') as LogicalOperator,
        description: pop.description || '',
        confidence: 'high' as ConfidenceLevel,
        reviewStatus: 'pending' as const,
        children,
      },
      cqlDefinition: pop.cqlExpression,
    };
  });

  // Calculate review progress by counting all reviewable items
  let total = 0, pending = 0;
  const countStatus = (obj: any) => {
    if (!obj) return;
    if (obj.reviewStatus) {
      total++;
      if (obj.reviewStatus === 'pending') pending++;
    }
    if (obj.criteria) countStatus(obj.criteria);
    if (obj.children) obj.children.forEach(countStatus);
  };
  populations.forEach(countStatus);

  // Determine measurement year from data or default
  const currentYear = new Date().getFullYear();

  // Build globalConstraints from measure-level age range
  const globalConstraints: any = {};
  if (data.ageRange) {
    globalConstraints.ageRange = {
      min: data.ageRange.min,
      max: data.ageRange.max,
    };
  }

  return {
    id,
    metadata: {
      measureId: data.measureId,
      title: data.title,
      version: data.version,
      cbeNumber: data.cbeNumber,
      steward: data.steward,
      program: 'MIPS_CQM',
      measureType: mapMeasureType(data.measureType),
      description: data.description,
      rationale: data.rationale,
      clinicalRecommendation: data.clinicalRecommendation,
      submissionFrequency: 'Once per performance period',
      improvementNotation: data.measureType === 'outcome' ? 'decrease' : 'increase',
      measurementPeriod: {
        start: `${currentYear}-01-01`,
        end: `${currentYear}-12-31`,
        inclusive: true,
      },
      lastUpdated: now,
      sourceDocuments: ['AI Extraction'],
    },
    populations,
    globalConstraints: Object.keys(globalConstraints).length > 0 ? globalConstraints : undefined,
    valueSets,
    status: 'in_progress',
    overallConfidence: valueSets.length > 0 && valueSets.some(vs => vs.codes.length > 0) ? 'high' : 'medium',
    reviewProgress: { total, approved: 0, pending, flagged: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Map population type string to enum
 */
function mapPopulationType(type: string): any {
  const typeMap: Record<string, string> = {
    'initial_population': 'initial_population',
    'initial population': 'initial_population',
    'initialpopulation': 'initial_population',
    'denominator': 'denominator',
    'denominator_exclusion': 'denominator_exclusion',
    'denominator exclusion': 'denominator_exclusion',
    'denominator exclusions': 'denominator_exclusion',
    'denominatorexclusion': 'denominator_exclusion',
    'denominator_exception': 'denominator_exception',
    'denominator exception': 'denominator_exception',
    'denominator exceptions': 'denominator_exception',
    'denominatorexception': 'denominator_exception',
    'numerator': 'numerator',
    'numerator_exclusion': 'numerator_exclusion',
    'numerator exclusion': 'numerator_exclusion',
    'numeratorexclusion': 'numerator_exclusion',
  };

  return typeMap[type.toLowerCase()] || type;
}

/**
 * Map measure type string to enum
 */
function mapMeasureType(type: string): MeasureType {
  const lower = type.toLowerCase();
  if (lower.includes('outcome')) return 'outcome';
  if (lower.includes('structure')) return 'structure';
  return 'process';
}

/**
 * Map code system string to enum
 */
function mapCodeSystem(system: string): CodeSystem {
  const systemMap: Record<string, CodeSystem> = {
    'icd10': 'ICD10',
    'icd-10': 'ICD10',
    'icd10cm': 'ICD10',
    'icd-10-cm': 'ICD10',
    'cpt': 'CPT',
    'hcpcs': 'HCPCS',
    'loinc': 'LOINC',
    'snomed': 'SNOMED',
    'snomedct': 'SNOMED',
    'snomed-ct': 'SNOMED',
    'rxnorm': 'RxNorm',
    'cvx': 'CVX',
  };

  return systemMap[system.toLowerCase()] || 'CPT';
}

/**
 * Enrich extracted value sets with complete codes from standard sources
 * This fills in missing codes when we recognize an OID or value set name
 */
function enrichValueSetsFromStandards(data: ExtractedMeasureData): ExtractedMeasureData {
  const enrichedValueSets: ExtractedValueSet[] = [];
  const addedOids = new Set<string>();

  // First, enrich existing value sets by OID lookup
  for (const vs of data.valueSets) {
    if (vs.oid) {
      const standardVS = getValueSetByOID(vs.oid);
      if (standardVS) {
        // Found a standard value set - merge codes
        const existingCodes = new Set(vs.codes.map(c => `${c.code}|${c.system}`));
        const mergedCodes = [...vs.codes];

        for (const standardCode of standardVS.codes) {
          const key = `${standardCode.code}|${standardCode.system}`;
          if (!existingCodes.has(key)) {
            mergedCodes.push({
              code: standardCode.code,
              display: standardCode.display,
              system: mapCodeSystemFromUri(standardCode.system),
            });
          }
        }

        console.log(`Enriched value set "${vs.name}" (${vs.oid}): ${vs.codes.length} -> ${mergedCodes.length} codes`);

        enrichedValueSets.push({
          ...vs,
          codes: mergedCodes,
        });
        addedOids.add(vs.oid);
        continue;
      }
    }

    // No standard match, try fuzzy name matching
    const matchedVS = findStandardValueSetByName(vs.name, data.title);
    if (matchedVS && !addedOids.has(matchedVS.oid)) {
      const existingCodes = new Set(vs.codes.map(c => `${c.code}|${c.system}`));
      const mergedCodes = [...vs.codes];

      for (const standardCode of matchedVS.codes) {
        const key = `${standardCode.code}|${standardCode.system}`;
        if (!existingCodes.has(key)) {
          mergedCodes.push({
            code: standardCode.code,
            display: standardCode.display,
            system: mapCodeSystemFromUri(standardCode.system),
          });
        }
      }

      console.log(`Enriched value set "${vs.name}" by name match to "${matchedVS.name}": ${vs.codes.length} -> ${mergedCodes.length} codes`);

      enrichedValueSets.push({
        ...vs,
        oid: vs.oid || matchedVS.oid,
        codes: mergedCodes,
      });
      addedOids.add(matchedVS.oid);
      continue;
    }

    // No match found, keep as-is
    enrichedValueSets.push(vs);
  }

  // Add missing standard value sets based on measure type detection
  const missingValueSets = detectMissingValueSets(data, addedOids);
  for (const missingVS of missingValueSets) {
    enrichedValueSets.push({
      name: missingVS.name,
      oid: missingVS.oid,
      purpose: `Standard ${missingVS.name} value set (auto-added)`,
      codeSystem: detectPrimaryCodeSystem(missingVS),
      codes: missingVS.codes.map(c => ({
        code: c.code,
        display: c.display,
        system: mapCodeSystemFromUri(c.system),
      })),
    });
    console.log(`Added missing standard value set: "${missingVS.name}" with ${missingVS.codes.length} codes`);
  }

  return {
    ...data,
    valueSets: enrichedValueSets,
  };
}

/**
 * Find a standard value set by fuzzy name matching
 */
function findStandardValueSetByName(name: string, measureTitle?: string): StandardValueSet | null {
  const lowerName = name.toLowerCase();
  const lowerTitle = measureTitle?.toLowerCase() || '';

  // Check if this is a CRC-related measure
  const isCRCMeasure = lowerTitle.includes('colorectal') ||
                       lowerTitle.includes('colon') ||
                       lowerTitle.includes('crc');

  if (isCRCMeasure) {
    // Try CRC-specific value sets
    const crcNumeratorSets = getCRCScreeningNumeratorValueSets();
    const crcExclusionSets = getCRCScreeningExclusionValueSets();
    const allCRCSets = [...crcNumeratorSets, ...crcExclusionSets];

    for (const vs of allCRCSets) {
      const vsNameLower = vs.name.toLowerCase();
      if (lowerName.includes(vsNameLower) || vsNameLower.includes(lowerName)) {
        return vs;
      }
      // Check for partial matches
      const nameWords = lowerName.split(/\s+/);
      const vsWords = vsNameLower.split(/\s+/);
      const overlap = nameWords.filter(w => vsWords.includes(w) && w.length > 3);
      if (overlap.length >= 2) {
        return vs;
      }
    }
  }

  // Check if this is an immunization-related measure
  const isImmunizationMeasure = lowerTitle.includes('immunization') ||
                                 lowerTitle.includes('childhood imm') ||
                                 lowerTitle.includes('cms117');

  if (isImmunizationMeasure || /\b(vaccine|vaccination|immunization|dtap|ipv|mmr|hib|hepatitis\s*[ab]|varicella|pcv|pneumococcal|rotavirus|influenza)\b/i.test(lowerName)) {
    const immunizationSets = getChildhoodImmunizationValueSets();

    for (const vs of immunizationSets) {
      const vsNameLower = vs.name.toLowerCase();
      if (lowerName.includes(vsNameLower) || vsNameLower.includes(lowerName)) {
        return vs;
      }
      // Check for keyword matches
      const keywords: Record<string, string[]> = {
        'dtap': ['dtap', 'diphtheria', 'tetanus', 'pertussis'],
        'ipv': ['ipv', 'polio', 'inactivated polio'],
        'mmr': ['mmr', 'measles', 'mumps', 'rubella'],
        'hib': ['hib', 'haemophilus'],
        'hep-b': ['hepatitis b', 'hep b', 'hepb'],
        'varicella': ['varicella', 'chickenpox', 'vzv'],
        'pcv': ['pcv', 'pneumococcal conjugate'],
        'hep-a': ['hepatitis a', 'hep a', 'hepa'],
        'rotavirus': ['rotavirus', 'rota'],
        'influenza': ['influenza', 'flu vaccine'],
      };

      for (const [vsId, kws] of Object.entries(keywords)) {
        if (vs.id === `${vsId}-vaccine` && kws.some(kw => lowerName.includes(kw))) {
          return vs;
        }
      }
    }
  }

  return null;
}

/**
 * Detect missing value sets that should be added based on measure type
 */
function detectMissingValueSets(data: ExtractedMeasureData, existingOids: Set<string>): StandardValueSet[] {
  const missing: StandardValueSet[] = [];
  const lowerTitle = data.title.toLowerCase();
  const lowerDesc = data.description?.toLowerCase() || '';

  // Detect CRC screening measure
  if (lowerTitle.includes('colorectal') ||
      lowerTitle.includes('colon cancer screening') ||
      lowerDesc.includes('colorectal cancer screening')) {

    // Add CRC numerator value sets if missing
    const crcNumeratorSets = getCRCScreeningNumeratorValueSets();
    for (const vs of crcNumeratorSets) {
      if (!existingOids.has(vs.oid)) {
        missing.push(vs);
        existingOids.add(vs.oid);
      }
    }

    // Add CRC exclusion value sets if missing
    const crcExclusionSets = getCRCScreeningExclusionValueSets();
    for (const vs of crcExclusionSets) {
      if (!existingOids.has(vs.oid)) {
        missing.push(vs);
        existingOids.add(vs.oid);
      }
    }
  }

  // Detect childhood immunization measure
  if (lowerTitle.includes('immunization') ||
      lowerTitle.includes('childhood imm') ||
      lowerDesc.includes('childhood immunization') ||
      lowerTitle.includes('cms117')) {

    const immunizationSets = getChildhoodImmunizationValueSets();
    for (const vs of immunizationSets) {
      if (!existingOids.has(vs.oid)) {
        missing.push(vs);
        existingOids.add(vs.oid);
      }
    }
  }

  // TODO: Add detection for other measure types:
  // - Diabetes (HbA1c, nephropathy, eye exam)
  // - Hypertension (blood pressure)
  // - Breast cancer screening (mammography)
  // - Cervical cancer screening
  // - etc.

  return missing;
}

/**
 * Detect primary code system from a value set's codes
 */
function detectPrimaryCodeSystem(vs: StandardValueSet): string {
  const systemCounts: Record<string, number> = {};
  for (const code of vs.codes) {
    const system = mapCodeSystemFromUri(code.system);
    systemCounts[system] = (systemCounts[system] || 0) + 1;
  }

  let maxCount = 0;
  let primarySystem = 'CPT';
  for (const [system, count] of Object.entries(systemCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primarySystem = system;
    }
  }

  return primarySystem;
}

/**
 * Map FHIR URI code system to short form
 */
function mapCodeSystemFromUri(uri: string): string {
  const uriMap: Record<string, string> = {
    'http://hl7.org/fhir/sid/icd-10-cm': 'ICD10',
    'http://snomed.info/sct': 'SNOMED',
    'http://www.ama-assn.org/go/cpt': 'CPT',
    'https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets': 'HCPCS',
    'http://loinc.org': 'LOINC',
    'http://www.nlm.nih.gov/research/umls/rxnorm': 'RxNorm',
    'http://hl7.org/fhir/sid/cvx': 'CVX',
  };

  return uriMap[uri] || uri;
}
