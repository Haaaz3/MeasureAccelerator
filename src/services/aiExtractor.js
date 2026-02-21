/**
 * AI Extraction Service
 *
 * Uses various LLM APIs to intelligently extract measure specifications
 * from document content and convert to UMS format.
 *
 * Supports: Anthropic (Claude), OpenAI (GPT), Google (Gemini)
 */

             
                       
                       
                    
              
                  
             
              
                
                    
                  
                
                      
import {
  getValueSetByOID,
  getCRCScreeningNumeratorValueSets,
  getCRCScreeningExclusionValueSets,
  getChildhoodImmunizationValueSets,
  getChildhoodImmunizationExclusionValueSets,
                        
} from '../constants/standardValueSets';
import {
  callLLM,
  DEFAULT_MODELS,
                   
                       
} from './llmClient';
import {
  extractWithMultiPass,
  isLargeDocument,
                                           
} from './multiPassExtractor';

;                                    
                                                                      
                  
                   
 

;                                    
                   
                             
                                       
                 
                      
 

;                             
                                                                                                                               
                      
                        
                       
                                                                    
            
                        
                       
                                                                
    
                                                        
                                                                           
 

;                              
               
                      
                    
                         
                              
                                 
 

;                            
               
               
                   
                   
                     
                                                             
 

;                               
                    
                
                  
                      
                      
                  
                     
                     
                                  
                                     
                                 
                              
                             
                                                        
 

// Re-export types from llmClient for backwards compatibility
;                                                               
// Re-export multi-pass types for callers who need detailed results
;                                                                                                                                      

/**
 * Extraction mode configuration
 * - 'multi-pass': Uses three-pass extraction (skeleton → detail → validation) for better accuracy
 * - 'single-shot': Uses single LLM call with verification pass (faster, legacy fallback)
 * - 'auto': Uses multi-pass for large documents, single-shot for smaller ones
 */
;                                                                  

/**
 * Extract measure data from document content using AI
 * Supports multiple LLM providers: Anthropic (Claude), OpenAI (GPT), Google (Gemini), Custom/Local
 * When pageImages are provided (for image-based PDFs), uses vision capability for extraction
 *
 * @param extractionMode - 'multi-pass' (default), 'single-shot', or 'auto'
 */
export async function extractMeasureWithAI(
  documentContent        ,
  apiKey        ,
  onProgress                                         ,
  provider              = 'anthropic',
  model         ,
  customConfig                  ,
  pageImages           , // Base64 encoded PNG images for vision-based extraction
  extractionMode                 = 'multi-pass'
)                              {
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

  // Determine effective extraction mode
  let effectiveMode = extractionMode;
  if (extractionMode === 'auto') {
    // Use multi-pass for large documents, single-shot for smaller ones
    effectiveMode = isLargeDocument(documentContent, 40000) ? 'multi-pass' : 'single-shot';
  }

  // Route to multi-pass extraction if enabled (and no page images - vision requires single-shot)
  if (effectiveMode === 'multi-pass' && !pageImages?.length) {
    return extractWithMultiPassAdapter(
      documentContent,
      apiKey,
      onProgress,
      provider,
      model,
      customConfig
    );
  }

  // Fall through to single-shot extraction (legacy path)
  const actualModel = provider === 'custom'
    ? (customConfig?.modelName || 'default')
    : (model || DEFAULT_MODELS[provider                               ]);
  const providerNames                              = {
    anthropic: 'Claude',
    openai: 'GPT',
    google: 'Gemini',
    custom: 'Custom LLM',
  };

  try {
    onProgress?.({ stage: 'extracting', message: `Sending to ${providerNames[provider]} for extraction...`, progress: 10 });

    // Truncate content if too long
    const maxContentLength = provider === 'google' ? 100000 : 150000;
    const truncatedContent = documentContent.length > maxContentLength
      ? documentContent.substring(0, maxContentLength) + '\n\n[Content truncated due to length...]'
      : documentContent;

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(truncatedContent);

    // Call the LLM using unified client (supports vision for all providers)
    const result = await callLLM({
      provider,
      model: actualModel,
      apiKey,
      systemPrompt,
      userPrompt,
      images: pageImages,
      maxTokens: 16000,
      customConfig,
      jsonMode: provider === 'openai' || provider === 'google',
    });

    const content = result.content;
    const tokensUsed = result.tokensUsed;

    onProgress?.({ stage: 'parsing', message: 'Parsing extraction results...', progress: 40 });

    console.log('[AI Extractor] Received response from API:', {
      contentLength: content.length,
      contentPreview: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      tokensUsed,
    });

    if (!content || content.trim().length === 0) {
      console.error('[AI Extractor] Empty response from API');
      throw new Error('AI returned empty response. The document may not contain enough recognizable measure content.');
    }

    let extractedData = parseAIResponse(content);

    if (!extractedData) {
      console.error('[AI Extractor] Failed to parse AI response:', content.substring(0, 1000));
      throw new Error('Failed to parse AI response. The AI may not have returned valid JSON.');
    }

    // --- Verification Pass: second AI call to audit extraction completeness ---
    onProgress?.({ stage: 'parsing', message: 'Verifying extraction completeness...', progress: 50 });

    const actualModelStr = provider === 'custom'
      ? (customConfig?.modelName || 'default')
      : (model || DEFAULT_MODELS[provider                               ]);

    const verificationResult = await runVerificationPass(
      truncatedContent,
      extractedData,
      provider,
      apiKey,
      actualModelStr,
      customConfig,
    );

    if (verificationResult && !verificationResult.isComplete) {
      extractedData = mergeVerificationResults(extractedData, verificationResult);
    }

    // Enrich value sets with complete codes from standard sources
    onProgress?.({ stage: 'building', message: 'Enriching value sets from standard sources...', progress: 65 });
    extractedData = enrichValueSetsFromStandards(extractedData);

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
function buildSystemPrompt()         {
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
      "nestedGroups": [
        {
          "groupOperator": "OR",
          "description": "Group description (e.g., Qualifying Encounters)",
          "criteriaIndices": [0, 1, 2]
        }
      ],
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
3. AND vs OR LOGIC - CRITICAL:
   - The TOP-LEVEL logicOperator for a population is almost always "AND" (patient must meet age requirement AND have a qualifying encounter AND meet other criteria)
   - When multiple ALTERNATIVE encounter types are listed (Office Visit OR Annual Wellness OR Preventive Care etc.), these are ALTERNATIVES — the patient needs ANY ONE, not ALL of them
   - Use "nestedGroups" to group alternative criteria under OR logic within an AND population
   - Example: Initial population = age 51-74 AND (Office Visit OR Annual Wellness OR Preventive Care) → logicOperator: "AND" with nestedGroups: [{"groupOperator": "OR", "description": "Qualifying Encounters", "criteriaIndices": [1,2,3]}]
   - Qualifying encounter lists are ALWAYS OR logic — a patient does NOT need every encounter type
   - Denominator exclusions with multiple conditions are usually OR (any one exclusion qualifies)
   - Numerator criteria for screening measures are usually OR (any qualifying screening method)
   - Numerator criteria for immunization measures are AND (all vaccines required)
4. VALUE SETS - CRITICAL:
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
function buildUserPrompt(content        )         {
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

// API call functions have been moved to llmClient.ts

/**
 * Parse AI response to extract JSON
 */
function parseAIResponse(content        )                              {
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
function validateExtractedData(data     )                              {
  if (!data || typeof data !== 'object') return null;

  // Normalize populations to ensure criteria are properly structured
  const normalizedPopulations                        = (Array.isArray(data.populations) ? data.populations : []).map((pop     ) => {
    // Handle both old format (criteria as strings) and new format (criteria as objects)
    let criteria                       = [];
    if (Array.isArray(pop.criteria)) {
      criteria = pop.criteria.map((crit     ) => {
        if (typeof crit === 'string') {
          // Old format: convert string to basic criterion
          return {
            type: 'assessment'         ,
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
        }                      ;
      });
    }

    return {
      type: pop.type || 'initial_population',
      description: pop.description || '',
      narrative: pop.narrative || pop.description || '',
      cqlExpression: pop.cqlExpression,
      logicOperator: (pop.logicOperator || 'AND')                ,
      criteria,
    };
  });

  // Normalize value sets to ensure codes are properly structured
  const normalizedValueSets                      = (Array.isArray(data.valueSets) ? data.valueSets : []).map((vs     ) => ({
    name: vs.name || 'Unknown Value Set',
    oid: vs.oid,
    version: vs.version,
    purpose: vs.purpose,
    codeSystem: vs.codeSystem || 'ICD10',
    codes: (Array.isArray(vs.codes) ? vs.codes : []).map((c     ) => ({
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
function convertToUMS(data                      )                       {
  const now = new Date().toISOString();
  const id = `ums-${data.measureId.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;

  // First, build a map of value sets by name for easy lookup
  const valueSetsByName = new Map                           ();

  // Convert value sets first so we can reference them from criteria
  const valueSets                      = data.valueSets.map((vs, idx) => {
    const valueSet                    = {
      id: `vs-${idx}`,
      name: vs.name,
      oid: vs.oid,
      version: vs.version,
      confidence: vs.oid ? 'high'                    : 'medium'                   ,
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
  const findValueSet = (name         , oid         )                                => {
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
  const populations                         = data.populations.map((pop, idx) => {
    const criteriaList = pop.criteria || [];
    const popType = mapPopulationType(pop.type);

    // Build DataElement children from extracted criteria
    const children                                  = criteriaList.map((crit, cidx) => {
      // Find matching value set
      const linkedValueSet = findValueSet(crit.valueSetName, crit.valueSetOid);

      // Build timing requirements
      const timingRequirements                      = [];
      if (crit.timing) {
        timingRequirements.push({
          description: crit.timing.description || 'During measurement period',
          relativeTo: crit.timing.relativeTo || 'measurement_period',
          window: crit.timing.window ? {
            value: crit.timing.window.value,
            unit: crit.timing.window.unit                                         ,
            direction: crit.timing.window.direction                                 ,
          } : undefined,
          confidence: 'high'                   ,
        });
      }

      // Build direct codes if no value set but codes provided
      const directCodes                  = (crit.directCodes || []).map(c => ({
        code: c.code,
        display: c.display,
        system: mapCodeSystem(c.system),
      }));

      // Build additional requirements from thresholds
      const additionalRequirements           = [];
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

      const dataElement              = {
        id: `${popType}-elem-${idx}-${cidx}`,
        type: elementType       ,
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
        confidence: linkedValueSet ? 'high'                    : 'medium'                   ,
        source: 'AI Extraction',
        reviewStatus: 'pending'         ,
      };

      return dataElement;
    });

    // If no structured criteria, create a placeholder from the narrative
    if (children.length === 0 && pop.narrative) {
      children.push({
        id: `${popType}-elem-${idx}-0`,
        type: 'assessment'         ,
        description: pop.narrative.substring(0, 500),
        confidence: 'low'                   ,
        source: 'AI Extraction (narrative only)',
        reviewStatus: 'pending'         ,
      });
    }

    // Post-process: group sibling encounter elements into OR subclause
    // When 3+ encounter-type elements are siblings in an AND clause, they are almost
    // certainly alternatives (Office Visit OR Annual Wellness OR Preventive Care), not
    // requirements (patient does NOT need every encounter type).
    const topOperator = (pop.logicOperator || 'AND')                   ;
    let finalChildren                                  = children;

    if (topOperator === 'AND') {
      const encounterChildren = children.filter((c     ) => c.type === 'encounter');
      const nonEncounterChildren = children.filter((c     ) => c.type !== 'encounter');

      if (encounterChildren.length >= 3) {
        // Group encounters into an OR subclause
        const orClause                = {
          id: `${popType}-enc-or-${idx}`,
          operator: 'OR',
          description: 'Qualifying Encounters',
          confidence: 'high'                   ,
          reviewStatus: 'approved'         ,
          children: encounterChildren,
        };
        finalChildren = [...nonEncounterChildren, orClause];
      }

      // Also check for AI-provided nestedGroups
      if ((pop       ).nestedGroups && Array.isArray((pop       ).nestedGroups)) {
        for (const group of (pop       ).nestedGroups) {
          if (group.groupOperator === 'OR' && Array.isArray(group.criteriaIndices)) {
            const groupedIndices = new Set(group.criteriaIndices            );
            const grouped = children.filter((_     , i        ) => groupedIndices.has(i));
            const ungrouped = children.filter((_     , i        ) => !groupedIndices.has(i));

            if (grouped.length >= 2) {
              const nestedClause                = {
                id: `${popType}-group-${idx}`,
                operator: 'OR',
                description: group.description || 'Grouped criteria',
                confidence: 'high'                   ,
                reviewStatus: 'pending'         ,
                children: grouped,
              };
              finalChildren = [...ungrouped, nestedClause];
            }
          }
        }
      }
    }

    return {
      id: `${popType}-${idx}`,
      type: popType,
      description: pop.description || pop.narrative?.substring(0, 200) || '',
      narrative: pop.narrative || pop.description || '',
      confidence: children.some(c => (c               ).valueSet) ? 'high'                    : 'medium'                   ,
      reviewStatus: 'pending'         ,
      criteria: {
        id: `${popType}-criteria-${idx}`,
        operator: topOperator,
        description: pop.description || '',
        confidence: 'high'                   ,
        reviewStatus: 'pending'         ,
        children: finalChildren,
      },
      cqlDefinition: pop.cqlExpression,
    };
  });

  // Calculate review progress by counting all reviewable items
  let total = 0, pending = 0;
  const countStatus = (obj     ) => {
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
  const globalConstraints      = {};
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
function mapPopulationType(type        )      {
  const typeMap                         = {
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
function mapMeasureType(type        )              {
  const lower = type.toLowerCase();
  if (lower.includes('outcome')) return 'outcome';
  if (lower.includes('structure')) return 'structure';
  return 'process';
}

/**
 * Map code system string to enum
 */
function mapCodeSystem(system        )             {
  const systemMap                             = {
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
function enrichValueSetsFromStandards(data                      )                       {
  const enrichedValueSets                      = [];
  const addedOids = new Set        ();

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
  }

  return {
    ...data,
    valueSets: enrichedValueSets,
  };
}

/**
 * Find a standard value set by fuzzy name matching
 */
function findStandardValueSetByName(name        , measureTitle         )                          {
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
      const keywords                           = {
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
function detectMissingValueSets(data                      , existingOids             )                     {
  const missing                     = [];
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

    // Add immunization exclusion value sets (hospice) if missing
    const immunizationExclusionSets = getChildhoodImmunizationExclusionValueSets();
    for (const vs of immunizationExclusionSets) {
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
function detectPrimaryCodeSystem(vs                  )         {
  const systemCounts                         = {};
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
function mapCodeSystemFromUri(uri        )         {
  const uriMap                         = {
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

// =============================================================================
// VERIFICATION PASS — Second AI call to audit extraction completeness
// =============================================================================

;                             
                      
                                            
                                                        
                                                                                     
                                        
 

/**
 * Build system prompt for the verification/audit pass
 */
function buildVerificationSystemPrompt()         {
  return `You are a clinical quality measure auditor. You will receive an ORIGINAL DOCUMENT and an AI EXTRACTION of that document. Your job is to find anything the extraction MISSED or got WRONG by comparing it against the original document.

You must respond with ONLY valid JSON (no markdown, no code fences, no explanation).

RULES:
1. Only report things that are CLEARLY stated in the original document but MISSING from the extraction
2. Do NOT invent criteria or value sets that aren't in the document
3. Pay special attention to:
   - Denominator exclusion criteria (these are commonly missed or incomplete)
   - Denominator exception criteria
   - All numerator sub-criteria (e.g., immunization measures need EVERY vaccine group as a separate criterion)
   - Correct criterion types: use "immunization" for vaccines (never "procedure"), "diagnosis" for conditions, "encounter" for visits
4. Check that the number of criteria in each population matches what the document describes
5. Check that value sets mentioned in exclusions/exceptions are included in the valueSets array`;
}

/**
 * Build user prompt for the verification pass
 */
function buildVerificationPrompt(documentContent        , extractedData                      )         {
  // Summarize the extraction concisely to save tokens
  const extractionSummary = {
    measureId: extractedData.measureId,
    title: extractedData.title,
    populations: extractedData.populations.map(p => ({
      type: p.type,
      description: p.description,
      criteriaCount: p.criteria.length,
      criteria: p.criteria.map(c => ({
        type: c.type,
        description: c.description,
        valueSetName: c.valueSetName,
        valueSetOid: c.valueSetOid,
      })),
    })),
    valueSetNames: extractedData.valueSets.map(vs => ({
      name: vs.name,
      oid: vs.oid,
      codeCount: vs.codes.length,
    })),
  };

  // Truncate document for verification — we need less detail than extraction
  const maxDocLength = 150000;
  const truncatedDoc = documentContent.length > maxDocLength
    ? documentContent.substring(0, maxDocLength) + '\n\n[Document truncated...]'
    : documentContent;

  return `Audit this measure extraction for completeness and correctness.

EXTRACTED DATA:
${JSON.stringify(extractionSummary, null, 2)}

ORIGINAL DOCUMENT:
${truncatedDoc}

Compare the extraction against the document. Return ONLY valid JSON:
{
  "isComplete": true or false,
  "missingPopulations": [
    {
      "type": "denominator_exclusion",
      "description": "Description of the missing population",
      "narrative": "Full narrative from the document",
      "logicOperator": "AND" or "OR",
      "criteria": [
        {
          "type": "diagnosis" | "encounter" | "procedure" | "observation" | "medication" | "demographic" | "assessment" | "immunization",
          "description": "What this criterion checks",
          "valueSetName": "Value set name if mentioned",
          "valueSetOid": "OID if mentioned"
        }
      ]
    }
  ],
  "missingCriteria": {
    "denominator_exclusion": [
      {
        "type": "diagnosis",
        "description": "Missing criterion description",
        "valueSetName": "Value set name",
        "valueSetOid": "OID if available"
      }
    ]
  },
  "typeFixes": [
    {
      "population": "numerator",
      "description": "Criterion description to fix",
      "correctType": "immunization"
    }
  ],
  "missingValueSets": [
    {
      "name": "Value set name",
      "oid": "OID",
      "purpose": "What it's used for",
      "codeSystem": "Primary code system",
      "codes": []
    }
  ]
}

If the extraction is complete and correct, return: { "isComplete": true, "missingPopulations": [], "missingCriteria": {}, "typeFixes": [], "missingValueSets": [] }`;
}

/**
 * Parse the verification response JSON
 * Lenient — returns null on failure so we gracefully degrade
 */
function parseVerificationResponse(content        )                            {
  try {
    // Try direct parse
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.isComplete === 'boolean') {
      return {
        isComplete: parsed.isComplete,
        missingPopulations: Array.isArray(parsed.missingPopulations) ? parsed.missingPopulations : [],
        missingCriteria: (parsed.missingCriteria && typeof parsed.missingCriteria === 'object') ? parsed.missingCriteria : {},
        typeFixes: Array.isArray(parsed.typeFixes) ? parsed.typeFixes : [],
        missingValueSets: Array.isArray(parsed.missingValueSets) ? parsed.missingValueSets : [],
      };
    }
  } catch {
    // Try extracting JSON from markdown/text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed.isComplete === 'boolean') {
          return {
            isComplete: parsed.isComplete,
            missingPopulations: Array.isArray(parsed.missingPopulations) ? parsed.missingPopulations : [],
            missingCriteria: (parsed.missingCriteria && typeof parsed.missingCriteria === 'object') ? parsed.missingCriteria : {},
            typeFixes: Array.isArray(parsed.typeFixes) ? parsed.typeFixes : [],
            missingValueSets: Array.isArray(parsed.missingValueSets) ? parsed.missingValueSets : [],
          };
        }
      } catch {
        // Fall through
      }
    }
  }

  return null;
}

/**
 * Merge verification corrections into the extracted data
 */
function mergeVerificationResults(
  data                      ,
  verification                    
)                       {
  const merged = { ...data };

  // 1. Add entirely missing populations
  if (verification.missingPopulations.length > 0) {
    const existingTypes = new Set(merged.populations.map(p => p.type));
    for (const pop of verification.missingPopulations) {
      // Normalize criteria in missing populations
      const normalizedCriteria                       = (pop.criteria || []).map((c     ) => ({
        type: c.type || 'assessment',
        description: c.description || '',
        valueSetName: c.valueSetName,
        valueSetOid: c.valueSetOid,
        directCodes: c.directCodes,
        timing: c.timing,
        ageRange: c.ageRange,
        thresholds: c.thresholds,
      }));

      if (!existingTypes.has(pop.type)) {
        // Entirely new population type
        merged.populations.push({
          type: pop.type,
          description: pop.description || '',
          narrative: pop.narrative || pop.description || '',
          logicOperator: (pop.logicOperator || 'AND')                ,
          criteria: normalizedCriteria,
        });
      } else {
        // Population type exists but might need the criteria merged
        const existing = merged.populations.find(p => p.type === pop.type);
        if (existing && normalizedCriteria.length > 0) {
          const existingDescs = new Set(existing.criteria.map(c => c.description.toLowerCase()));
          for (const crit of normalizedCriteria) {
            if (!existingDescs.has(crit.description.toLowerCase())) {
              existing.criteria.push(crit);
            }
          }
        }
      }
    }
  }

  // 2. Add missing criteria to existing populations
  for (const [popType, criteria] of Object.entries(verification.missingCriteria)) {
    if (!Array.isArray(criteria) || criteria.length === 0) continue;

    const targetPop = merged.populations.find(p => p.type === popType);
    if (targetPop) {
      const existingDescs = new Set(targetPop.criteria.map(c => c.description.toLowerCase()));
      for (const crit of criteria) {
        const normalized                     = {
          type: (crit.type || 'assessment')                              ,
          description: crit.description || '',
          valueSetName: crit.valueSetName,
          valueSetOid: crit.valueSetOid,
          directCodes: crit.directCodes,
          timing: crit.timing,
          ageRange: crit.ageRange,
          thresholds: crit.thresholds,
        };
        if (!existingDescs.has(normalized.description.toLowerCase())) {
          targetPop.criteria.push(normalized);
        }
      }
    } else {
      // Population doesn't exist yet — create it
      merged.populations.push({
        type: popType,
        description: `${popType.replace(/_/g, ' ')}`,
        narrative: '',
        logicOperator: 'OR',
        criteria: criteria.map((c     ) => ({
          type: c.type || 'assessment',
          description: c.description || '',
          valueSetName: c.valueSetName,
          valueSetOid: c.valueSetOid,
          directCodes: c.directCodes,
          timing: c.timing,
          ageRange: c.ageRange,
          thresholds: c.thresholds,
        })),
      });
    }
  }

  // 3. Apply type fixes
  for (const fix of verification.typeFixes) {
    const targetPop = merged.populations.find(p => p.type === fix.population);
    if (targetPop) {
      const targetCrit = targetPop.criteria.find(
        c => c.description.toLowerCase().includes(fix.description.toLowerCase()) ||
             fix.description.toLowerCase().includes(c.description.toLowerCase())
      );
      if (targetCrit) {
        targetCrit.type = fix.correctType                              ;
      }
    }
  }

  // 4. Add missing value sets
  if (verification.missingValueSets.length > 0) {
    const existingOids = new Set(merged.valueSets.filter(vs => vs.oid).map(vs => vs.oid));
    const existingNames = new Set(merged.valueSets.map(vs => vs.name.toLowerCase()));

    for (const vs of verification.missingValueSets) {
      const isDuplicate = (vs.oid && existingOids.has(vs.oid)) ||
                          existingNames.has((vs.name || '').toLowerCase());
      if (!isDuplicate) {
        merged.valueSets.push({
          name: vs.name || 'Unknown',
          oid: vs.oid,
          version: vs.version,
          purpose: vs.purpose,
          codeSystem: vs.codeSystem || 'ICD10',
          codes: Array.isArray(vs.codes) ? vs.codes.map((c     ) => ({
            code: c.code || '',
            display: c.display || '',
            system: c.system || 'ICD10',
          })) : [],
        });
      }
    }
  }

  return merged;
}

/**
 * Run the verification pass — calls the same AI provider to audit the extraction
 * Returns null on any failure (graceful degradation)
 */
async function runVerificationPass(
  documentContent        ,
  extractedData                      ,
  provider             ,
  apiKey        ,
  model        ,
  customConfig                  ,
)                                     {
  try {
    const systemPrompt = buildVerificationSystemPrompt();
    const userPrompt = buildVerificationPrompt(documentContent, extractedData);

    const result = await callLLM({
      provider,
      model,
      apiKey,
      systemPrompt,
      userPrompt,
      maxTokens: 8000,
      customConfig,
      jsonMode: provider === 'openai' || provider === 'google',
    });

    return parseVerificationResponse(result.content);
  } catch {
    return null;
  }
}

// =============================================================================
// MULTI-PASS EXTRACTION ADAPTER
// =============================================================================

/**
 * Adapter function that calls multi-pass extraction and converts the result
 * to the AIExtractionResult format expected by the rest of the system.
 */
async function extractWithMultiPassAdapter(
  documentContent        ,
  apiKey        ,
  onProgress                                         ,
  provider              = 'anthropic',
  model         ,
  customConfig                  ,
)                              {
  // Map progress from multi-pass format to legacy format
  const progressMapper = (mpProgress                                                                             ) => {
    const stageMap                                              = {
      'skeleton': 'extracting',
      'populations': 'extracting',
      'validation': 'parsing',
      'complete': 'complete',
    };

    // Calculate overall progress percentage
    let progress = 0;
    if (mpProgress.phase === 'skeleton') {
      progress = 10;
    } else if (mpProgress.phase === 'populations') {
      // Populations phase takes 10-70% progress
      progress = 10 + Math.round((mpProgress.currentStep / mpProgress.totalSteps) * 60);
    } else if (mpProgress.phase === 'validation') {
      progress = 80;
    } else if (mpProgress.phase === 'complete') {
      progress = 100;
    }

    onProgress?.({
      stage: stageMap[mpProgress.phase] || 'extracting',
      message: mpProgress.message,
      progress,
    });
  };

  try {
    const result = await extractWithMultiPass(documentContent, {
      apiKey,
      provider,
      model,
      onProgress: progressMapper,
      includeFewShotExamples: true,
      skipValidationPass: false,
    });

    if (!result.success || !result.ums) {
      return {
        success: false,
        error: result.errors.join('; ') || 'Multi-pass extraction failed',
      };
    }

    onProgress?.({ stage: 'complete', message: 'Extraction complete', progress: 100 });

    return {
      success: true,
      ums: result.ums,
      // Note: rawExtraction not available from multi-pass - the UMS is the canonical output
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
