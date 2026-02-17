/**
 * Measure Extraction Service
 *
 * Orchestrates AI-based measure extraction by calling the backend LLM proxy.
 * Extracts metadata, populations, criteria, and value sets from measure specifications.
 */

import { post } from '../api/client.js';

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
      "purpose": "What this value set represents"
    }
  ]
}

Important guidelines:
1. Extract ALL populations mentioned (IP, Denominator, Numerator, Exclusions, Exceptions)
2. Capture timing constraints precisely (during measurement period, within 90 days, etc.)
3. Identify value sets by their OIDs when available
4. Use proper FHIR resource types for data elements
5. For age constraints, identify the calculation method (at start, at end, or during period)
6. Preserve the logical structure (AND/OR groupings) of criteria
7. If something is unclear, use null or omit it rather than guessing

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

Extract in this JSON format:

{
  "type": "the_population_type",
  "description": "Human-readable description",
  "narrative": "Full narrative from the spec",
  "criteria": {
    "operator": "AND|OR",
    "children": [
      {
        "type": "dataElement",
        "dataType": "Condition|Procedure|Encounter|Observation|MedicationRequest",
        "valueSet": { "oid": "2.16.840.1...", "name": "Name" },
        "timing": { "type": "during|before|after|within", "period": "measurement_period" },
        "description": "Description"
      }
    ]
  }
}

Return ONLY the JSON object.`;

// ============================================================================
// Main Extraction Functions
// ============================================================================

/**
 * Extract measure data from specification text using AI.
 *
 * @param {string} documentText - The measure specification text
 * @param {Object} options - Extraction options
 * @param {string} options.provider - LLM provider (anthropic, openai, google)
 * @param {string} options.model - Specific model to use
 * @param {Function} options.onProgress - Progress callback (phase, message)
 * @returns {Promise<Object>} Extracted measure data
 */
export async function extractMeasure(documentText, options = {}) {
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

    const skeleton = parseJsonResponse(skeletonResult.content);
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

    const extractedData = parseJsonResponse(fullResult.content);
    if (!extractedData) {
      throw new Error('Failed to parse extraction response');
    }

    onProgress?.('extraction_complete', `Extracted ${extractedData.populations?.length || 0} populations`);

    // Phase 3: Convert to UMS format
    onProgress?.('converting', 'Converting to UMS format...');

    const ums = convertToUMS(extractedData);

    onProgress?.('complete', 'Extraction complete');

    return {
      success: true,
      ums,
      extractedData,
      skeleton,
      tokensUsed: (skeletonResult.tokensUsed || 0) + (fullResult.tokensUsed || 0),
    };
  } catch (error) {
    console.error('Extraction error:', error);
    return {
      success: false,
      error: error.message || 'Extraction failed',
      ums: null,
    };
  }
}

/**
 * Extract measure data using multi-pass strategy for complex documents.
 *
 * @param {string} documentText - The measure specification text
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extracted measure data
 */
export async function extractMeasureMultiPass(documentText, options = {}) {
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

    const skeleton = parseJsonResponse(skeletonResult.content);
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
    const populations = [];
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

      const popData = parseJsonResponse(popResult.content);
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

    const vsData = parseJsonResponse(vsResult.content);
    totalTokens += vsResult.tokensUsed || 0;

    // Phase 4: Assemble full UMS
    onProgress?.('converting', 'Assembling UMS...');

    const extractedData = {
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
      error: error.message || 'Multi-pass extraction failed',
      ums: null,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Call the backend LLM extract endpoint.
 */
async function callLlmExtract({ systemPrompt, userPrompt, provider, model, maxTokens, images }) {
  const response = await post('/llm/extract', {
    systemPrompt,
    userPrompt,
    provider: provider || null,
    model: model || null,
    maxTokens: maxTokens || 16000,
    images: images || null,
  });

  return response;
}

/**
 * Parse JSON from LLM response, handling markdown code blocks.
 */
function parseJsonResponse(content) {
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
function convertToUMS(extractedData) {
  const now = new Date().toISOString();
  const metadata = extractedData.metadata || {};

  // Build populations array
  const populations = (extractedData.populations || []).map((pop, idx) => ({
    id: `pop-${Date.now()}-${idx}`,
    type: pop.type || 'initial_population',
    description: pop.description || '',
    narrative: pop.narrative || pop.description || '',
    criteria: convertCriteria(pop.criteria),
    confidence: 'medium',
    reviewStatus: 'pending',
  }));

  // Ensure we have at least IP, Denominator, Numerator
  const existingTypes = new Set(populations.map(p => p.type));
  const requiredTypes = ['initial_population', 'denominator', 'numerator'];

  for (const type of requiredTypes) {
    if (!existingTypes.has(type)) {
      populations.push({
        id: `pop-${Date.now()}-${type}`,
        type,
        description: formatPopulationType(type),
        narrative: '',
        criteria: {
          id: `clause-${Date.now()}-${type}`,
          operator: 'AND',
          description: '',
          children: [],
          confidence: 'medium',
          reviewStatus: 'pending',
        },
        confidence: 'low',
        reviewStatus: 'pending',
      });
    }
  }

  // Build value sets array
  const valueSets = (extractedData.valueSets || []).map((vs, idx) => ({
    id: `vs-${Date.now()}-${idx}`,
    oid: vs.oid || '',
    name: vs.name || 'Unnamed Value Set',
    purpose: vs.purpose || '',
    version: vs.version || '',
    codes: [],
  }));

  return {
    id: `ums-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    metadata: {
      measureId: metadata.measureId || 'NEW-001',
      title: metadata.title || 'Extracted Measure',
      version: metadata.version || '1.0',
      steward: metadata.steward || '',
      program: metadata.program || 'MIPS_CQM',
      measureType: metadata.measureType || 'process',
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
    globalConstraints: extractedData.globalConstraints || {
      ageMin: null,
      ageMax: null,
      ageCalculation: 'at_start',
      gender: 'any',
    },
    populations,
    valueSets,
    status: 'in_progress',
    overallConfidence: 'medium',
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
 * Convert extracted criteria to UMS format.
 */
function convertCriteria(criteria) {
  if (!criteria) {
    return {
      id: `clause-${Date.now()}`,
      operator: 'AND',
      description: '',
      children: [],
      confidence: 'medium',
      reviewStatus: 'pending',
    };
  }

  const clause = {
    id: `clause-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    operator: criteria.operator || 'AND',
    description: criteria.description || '',
    children: [],
    confidence: 'medium',
    reviewStatus: 'pending',
  };

  if (Array.isArray(criteria.children)) {
    clause.children = criteria.children.map((child, idx) => {
      if (child.type === 'logicalClause' || child.operator) {
        return convertCriteria(child);
      }

      // Data element
      return {
        id: `elem-${Date.now()}-${idx}`,
        type: 'dataElement',
        dataType: child.dataType || 'Condition',
        description: child.description || '',
        valueSet: child.valueSet || null,
        timing: child.timing || null,
        confidence: 'medium',
        reviewStatus: 'pending',
      };
    });
  }

  return clause;
}

/**
 * Format population type for display.
 */
function formatPopulationType(type) {
  const labels = {
    initial_population: 'Initial Population',
    denominator: 'Denominator',
    numerator: 'Numerator',
    denominator_exclusion: 'Denominator Exclusion',
    denominator_exception: 'Denominator Exception',
    numerator_exclusion: 'Numerator Exclusion',
    measure_population: 'Measure Population',
    measure_observation: 'Measure Observation',
  };
  return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// PDF Text Extraction
// ============================================================================

/**
 * Extract text from a PDF file using pdf.js.
 *
 * @param {File} file - PDF file object
 * @returns {Promise<string>} Extracted text
 */
export async function extractTextFromPDF(file) {
  // Dynamic import pdf.js
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textParts = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n\n');
}

/**
 * Extract text from uploaded files (PDF or text).
 *
 * @param {File[]} files - Array of uploaded files
 * @returns {Promise<string>} Combined extracted text
 */
export async function extractTextFromFiles(files) {
  const textParts = [];

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

export default {
  extractMeasure,
  extractMeasureMultiPass,
  extractTextFromPDF,
  extractTextFromFiles,
};
