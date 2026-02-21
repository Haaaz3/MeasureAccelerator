/**
 * Measure Ingestion Service
 *
 * Orchestrates the complete measure ingestion process:
 * 1. Extract text from uploaded documents
 * 2. Use AI to extract structured measure data OR use direct parsing
 * 3. Build UMS from extracted data
 */

import { extractFromFiles,                       } from './documentLoader';
import { extractMeasureWithAI } from './aiExtractor';
import {
  extractMeasure as extractMeasureViaBackend,
  enrichDataElementsWithHtmlSpec,
  enrichDataElementsWithCqlCodes,
} from './extractionService';
import { parseMeasureSpec } from '../utils/specParser';
;                                                                                    
;                                                 
import { parseHtmlSpec,                          } from './htmlSpecParser';
import { VALUE_SET_BY_OID, getCodesForOids } from '../data/valuesets';

/**
 * Smart truncation for LLM input - prioritizes HTML and CQL content over PDF/Excel.
 * HTML has structure, CQL has definitions. PDF flow diagrams and Excel are less useful.
 */
function truncateForLLM(content        , maxChars        )         {
  if (content.length <= maxChars) return content;

  // Split by file markers (format: === FILE: filename.ext ===)
  const fileMarkerRegex = /\n?=== FILE: ([^\n]+) ===/g;
  const sections                                                                 = [];

  let lastIndex = 0;
  let match;
  const matches                                             = [];

  while ((match = fileMarkerRegex.exec(content)) !== null) {
    matches.push({ index: match.index, filename: match[1] });
  }

  // If no file markers, just truncate from the start
  if (matches.length === 0) {
    return content.substring(0, maxChars);
  }

  // Extract each file section
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const filename = matches[i].filename.toLowerCase();
    const sectionContent = content.substring(start, end);

    // Prioritize by file type: HTML > CQL > others
    let priority = 3; // Default low priority
    if (filename.includes('.html')) priority = 1;
    else if (filename.includes('.cql')) priority = 2;
    else if (filename.includes('.xml')) priority = 2;
    // PDF, Excel, TRN files get low priority

    sections.push({ filename: matches[i].filename, content: sectionContent, priority });
  }

  // Sort by priority (lower = higher priority)
  sections.sort((a, b) => a.priority - b.priority);

  // Build result with as many sections as fit
  let result = '';
  for (const section of sections) {
    if (result.length + section.content.length <= maxChars) {
      result += section.content;
    } else {
      // Add as much of this section as fits
      const remaining = maxChars - result.length;
      if (remaining > 1000) {
        result += section.content.substring(0, remaining);
      }
      break;
    }
  }

  console.log(`[truncateForLLM] Prioritized sections: ${sections.map(s => `${s.filename}(${s.priority})`).join(', ')}`);
  return result;
}

/**
 * Resolve placeholder OIDs that survived initial enrichment.
 * Uses fuzzy matching against CQL and HTML parsed value sets.
 * Also handles composite value sets like "qualifying_encounters".
 */
function resolvePlaceholderOids(
  ums                      ,
  cqlParsed                ,
  htmlParsed
)       {
  const isRealOid = (oid        ) => /^\d+\.\d+/.test(oid || '');

  // Build lookup maps from CQL value sets (which have real OIDs)
  const cqlVsByName = new Map                                       ();
  const cqlVsByOid = new Map                                       ();
  for (const vs of cqlParsed.valueSets) {
    cqlVsByName.set(vs.name.toLowerCase(), vs);
    cqlVsByOid.set(vs.oid, vs);
  }

  // Build lookup from HTML value sets
  const htmlVsByName = new Map                                                  ();
  for (const vs of htmlParsed.valueSets) {
    htmlVsByName.set(vs.name.toLowerCase(), vs.oid);
  }

  // Common composite value set patterns and their constituent OIDs
  // These are hardcoded for common CMS measures - ideally would be parsed from CQL
  const compositeValueSets                                  = {
    'qualifying_encounters': [
      '2.16.840.1.113883.3.464.1003.101.12.1001', // Office Visit
      '2.16.840.1.113883.3.464.1003.101.12.1022', // Preventive Care Initial 0-17
      '2.16.840.1.113883.3.464.1003.101.12.1024', // Preventive Care Established 0-17
      '2.16.840.1.113883.3.464.1003.101.12.1016', // Home Healthcare Services
    ],
    'hospice_encounter': [
      '2.16.840.1.113883.3.464.1003.1003', // Hospice Encounter
    ],
  };

  let resolvedCount = 0;
  let compositeCount = 0;

  function walkAndResolve(node                             )       {
    if (!node) return;

    if ('type' in node && !('children' in node)) {
      // DataElement
      const elem = node               ;

      if (elem.valueSet?.oid && !isRealOid(elem.valueSet.oid)) {
        const placeholderOid = elem.valueSet.oid.toLowerCase();

        // Check if this is a known composite value set
        if (compositeValueSets[placeholderOid]) {
          // Create multiple value set references for composite
          const constituentOids = compositeValueSets[placeholderOid];
          const firstOid = constituentOids[0];
          const firstVs = cqlVsByOid.get(firstOid);

          // Set the primary value set
          elem.valueSet.oid = firstOid;
          if (firstVs) {
            elem.valueSet.name = firstVs.name;
          }

          // Store additional OIDs in a composite field for later expansion
          (elem       ).compositeValueSetOids = constituentOids;

          console.log(`[resolvePlaceholderOids] Resolved composite "${placeholderOid}" to ${constituentOids.length} constituent OIDs`);
          compositeCount++;
          resolvedCount++;
          return;
        }

        // Try to match by fuzzy name against CQL value sets
        const vsName = (elem.valueSet.name || '').toLowerCase();
        const description = (elem.description || '').toLowerCase();

        // Try exact name match first
        let matchedVs = cqlVsByName.get(vsName);

        // Try HTML match
        if (!matchedVs && vsName) {
          const htmlOid = htmlVsByName.get(vsName);
          if (htmlOid) {
            elem.valueSet.oid = htmlOid;
            console.log(`[resolvePlaceholderOids] Resolved "${vsName}" via HTML to OID ${htmlOid}`);
            resolvedCount++;
            return;
          }
        }

        // Try fuzzy match against CQL value sets by keywords in description
        if (!matchedVs) {
          for (const [cqlName, cqlVs] of cqlVsByName) {
            // Check if CQL value set name appears in element description or vice versa
            const cqlWords = cqlName.split(/\s+/).filter(w => w.length >= 4);
            const descWords = description.split(/\s+/).filter(w => w.length >= 4);

            // Require at least 2 significant word matches for fuzzy matching
            const matches = cqlWords.filter(cw => descWords.some(dw => dw.includes(cw) || cw.includes(dw)));
            if (matches.length >= 2 || cqlName.includes(vsName) || vsName.includes(cqlName)) {
              matchedVs = cqlVs;
              break;
            }
          }
        }

        if (matchedVs) {
          console.log(`[resolvePlaceholderOids] Resolved "${placeholderOid}" to OID ${matchedVs.oid} (${matchedVs.name})`);
          elem.valueSet.oid = matchedVs.oid;
          elem.valueSet.name = matchedVs.name;
          elem.valueSet.version = matchedVs.version;
          resolvedCount++;
        }
      }
    } else {
      // LogicalClause — recurse
      const clause = node                 ;
      if (clause.children) clause.children.forEach(walkAndResolve);
    }
  }

  // Walk all populations
  for (const pop of ums.populations || []) {
    if (pop.criteria) walkAndResolve(pop.criteria);
  }

  console.log(`[resolvePlaceholderOids] Resolved ${resolvedCount} placeholder OIDs (${compositeCount} composite)`);
}

/**
 * Populate value set codes from bundled expansions.
 * This runs after OID resolution to fill in actual code lists.
 */
function populateBundledValueSetCodes(ums                      )       {
  const isRealOid = (oid        ) => /^\d+\.\d+/.test(oid || '');

  let populatedCount = 0;
  let codesAdded = 0;

  function walkAndPopulate(node                             )       {
    if (!node) return;

    if ('type' in node && !('children' in node)) {
      // DataElement
      const elem = node               ;

      // Skip if already has codes
      if (elem.valueSet?.codes && elem.valueSet.codes.length > 0) {
        return;
      }

      // Check if we have bundled codes for this OID
      let bundledVs = null;
      if (elem.valueSet?.oid && isRealOid(elem.valueSet.oid)) {
        bundledVs = VALUE_SET_BY_OID[elem.valueSet.oid];
      }

      // Fallback: try name-based matching if OID lookup failed
      if (!bundledVs && elem.valueSet?.name) {
        const nameKey = elem.valueSet.name.toLowerCase().trim();
        for (const [oid, vs] of Object.entries(VALUE_SET_BY_OID)) {
          if (vs.name.toLowerCase().trim() === nameKey) {
            bundledVs = vs;
            // Correct the OID to the canonical one
            elem.valueSet.oid = oid;
            console.log(`[populateBundledCodes] Matched "${elem.valueSet.name}" by NAME → OID ${oid}`);
            break;
          }
        }
      }

      if (bundledVs && bundledVs.codes) {
        elem.valueSet.codes = bundledVs.codes.map(c => ({
          code: c.code,
          display: c.display,
          system: c.system,
        }));
        codesAdded += bundledVs.codes.length;
        populatedCount++;
        console.log(`[populateBundledCodes] Added ${bundledVs.codes.length} codes to "${elem.valueSet.name || elem.valueSet.oid}"`);
      }

      // Handle composite value sets (multiple OIDs combined)
      if ((elem       ).compositeValueSetOids) {
        const compositeOids = (elem       ).compositeValueSetOids;
        const allCodes = getCodesForOids(compositeOids);
        if (allCodes.length > 0) {
          if (!elem.valueSet) {
            (elem       ).valueSet = { id: '', oid: '', name: '', codes: [], confidence: 'high' };
          }
          elem.valueSet.codes = allCodes.map(c => ({
            code: c.code,
            display: c.display,
            system: c.system,
          }));
          codesAdded += allCodes.length;
          populatedCount++;
          console.log(`[populateBundledCodes] Added ${allCodes.length} composite codes to "${elem.valueSet.name || 'composite'}"`);
        }
      }
    } else {
      // LogicalClause — recurse
      const clause = node                 ;
      if (clause.children) clause.children.forEach(walkAndPopulate);
    }
  }

  // Walk all populations
  for (const pop of ums.populations || []) {
    if (pop.criteria) walkAndPopulate(pop.criteria);
  }

  // Also populate codes in the UMS valueSets array
  for (const vs of ums.valueSets || []) {
    if ((!vs.codes || vs.codes.length === 0)) {
      let bundledVs = null;

      // Try OID lookup first
      if (vs.oid && isRealOid(vs.oid)) {
        bundledVs = VALUE_SET_BY_OID[vs.oid];
      }

      // Fallback: try name-based matching
      if (!bundledVs && vs.name) {
        const nameKey = vs.name.toLowerCase().trim();
        for (const [oid, bundled] of Object.entries(VALUE_SET_BY_OID)) {
          if (bundled.name.toLowerCase().trim() === nameKey) {
            bundledVs = bundled;
            vs.oid = oid; // Correct to canonical OID
            break;
          }
        }
      }

      if (bundledVs && bundledVs.codes) {
        vs.codes = bundledVs.codes.map(c => ({
          code: c.code,
          display: c.display,
          system: c.system,
        }));
        codesAdded += bundledVs.codes.length;
      }
    }
  }

  console.log(`[populateBundledValueSetCodes] Populated ${populatedCount} DataElements with ${codesAdded} total codes`);
}

;                                   
                                                                                        
                  
                   
                   
 

;                                 
                   
                             
                 
                           
                            
                               
    
            
                        
                  
    
                 
 

/**
 * Ingest measure specification files using AI extraction
 */
export async function ingestMeasureFiles(
  files        ,
  apiKey        ,
  onProgress                                        ,
  provider                                               = 'anthropic',
  model         ,
  customConfig                                         
)                           {
  try {
    // Stage 1: Load and extract text from documents
    onProgress?.({
      stage: 'loading',
      message: `Loading ${files.length} file(s)...`,
      progress: 5,
    });

    const extractionResult = await extractFromFiles(files);

    console.log('[Measure Ingestion] Extraction result:', {
      documentsCount: extractionResult.documents.length,
      combinedContentLength: extractionResult.combinedContent.length,
      errors: extractionResult.errors,
      documentDetails: extractionResult.documents.map(d => ({
        filename: d.filename,
        contentLength: d.content.length,
        error: d.error,
      })),
    });

    onProgress?.({
      stage: 'extracting',
      message: `Extracted text from ${extractionResult.documents.length} document(s)`,
      progress: 20,
      details: `${extractionResult.combinedContent.length.toLocaleString()} characters extracted`,
    });

    if (!extractionResult.combinedContent || extractionResult.combinedContent.length < 100) {
      // Build a helpful error message based on what went wrong
      let errorMessage = 'Could not extract text from this PDF.';

      if (extractionResult.combinedContent.length === 0) {
        errorMessage = 'Could not extract any text from this PDF. The document may be image-based (scanned) or contain only graphics.';
      } else if (extractionResult.combinedContent.length < 100) {
        errorMessage = `Only ${extractionResult.combinedContent.length} characters were extracted from this PDF. The document may be mostly images or have embedded text that cannot be read.`;
      }

      if (extractionResult.errors.length > 0) {
        errorMessage += ` Errors: ${extractionResult.errors.join('; ')}`;
      }

      errorMessage += ' Please try a text-based PDF or paste the measure specification directly.';

      console.warn('[Measure Ingestion] Insufficient content extracted:', {
        contentLength: extractionResult.combinedContent.length,
        content: extractionResult.combinedContent.substring(0, 200),
      });

      return {
        success: false,
        documentInfo: {
          filesProcessed: files.length,
          totalCharacters: extractionResult.combinedContent.length,
          extractionErrors: extractionResult.errors,
        },
        error: errorMessage,
      };
    }

    // Stage 2: Use AI to extract structured data
    // Try backend extraction service first (routes through /api/llm/extract)
    // Falls back to direct API if backend fails

    const providerNames                         = {
      anthropic: 'Claude',
      openai: 'GPT',
      google: 'Gemini',
      custom: 'Custom LLM',
    };

    onProgress?.({
      stage: 'ai_processing',
      message: `Analyzing content with ${providerNames[provider] || provider} AI...`,
      progress: 30,
    });

    // Truncate content for LLM - it only needs structure, not all codes
    // Full content is kept for CQL/HTML deterministic parsers
    // 200K chars is well within Claude's 200K token context window
    const MAX_LLM_CHARS = 200000; // ~50K tokens - needed for complex measures like CMS117 with 10 vaccine groups
    const contentForLLM = truncateForLLM(extractionResult.combinedContent, MAX_LLM_CHARS);
    if (extractionResult.combinedContent.length > MAX_LLM_CHARS) {
      console.log(`[Measure Ingestion] Truncated content for LLM: ${extractionResult.combinedContent.length} → ${contentForLLM.length} chars`);
    }

    console.log('[Measure Ingestion] Sending to backend AI extraction:', {
      contentLength: contentForLLM.length,
      originalLength: extractionResult.combinedContent.length,
      contentPreview: contentForLLM.substring(0, 500) + '...',
    });

    // Try backend extraction first (uses server-side API key)
    let aiResult                                                                                       ;

    try {
      const backendResult = await extractMeasureViaBackend(contentForLLM, {
        onProgress: (phase, message) => {
          onProgress?.({
            stage: 'ai_processing',
            message,
            progress: 30 + (phase === 'complete' ? 60 : 30),
          });
        },
      });

      if (backendResult.success && backendResult.ums) {
        console.log('[Measure Ingestion] Backend extraction successful');
        aiResult = {
          success: true,
          ums: backendResult.ums,
          tokensUsed: backendResult.tokensUsed,
        };
      } else {
        console.warn('[Measure Ingestion] Backend extraction failed:', backendResult.error);
        throw new Error(backendResult.error || 'Backend extraction failed');
      }
    } catch (backendError) {
      console.warn('[Measure Ingestion] Backend extraction failed, trying direct API:', backendError);

      // Fall back to direct API call if backend fails and API key is provided
      if (!apiKey) {
        return {
          success: false,
          documentInfo: {
            filesProcessed: files.length,
            totalCharacters: extractionResult.combinedContent.length,
            extractionErrors: extractionResult.errors,
          },
          error: 'Backend AI extraction failed and no frontend API key is configured. Please configure your API key in settings or ensure the backend LLM is configured.',
        };
      }

      onProgress?.({
        stage: 'ai_processing',
        message: `Backend unavailable, using direct ${providerNames[provider] || provider} API...`,
        progress: 35,
      });

      console.log('[Measure Ingestion] Falling back to direct API:', {
        provider,
        model,
      });

      aiResult = await extractMeasureWithAI(
        contentForLLM,
        apiKey,
        (aiProgress) => {
          onProgress?.({
            stage: 'ai_processing',
            message: aiProgress.message,
            progress: 30 + (aiProgress.progress * 0.6),
          });
        },
        provider,
        model,
        customConfig,
        extractionResult.pageImages
      );
    }

    if (!aiResult.success || !aiResult.ums) {
      return {
        success: false,
        documentInfo: {
          filesProcessed: files.length,
          totalCharacters: extractionResult.combinedContent.length,
          extractionErrors: extractionResult.errors,
        },
        error: aiResult.error || 'AI extraction failed to produce valid results',
      };
    }

    // Wrap all enrichment in try/catch to catch any errors
    try {
    // Stage 3: Enrich with CQL-parsed codes
    onProgress?.({
      stage: 'building',
      message: 'Enriching with parsed CQL codes...',
      progress: 90,
    });

    // Parse CQL content deterministically to extract codes the LLM may have missed
    const { parseCqlFromDocument, normalizeCodeSystem } = await import('./cqlParser');
    const cqlParsed = parseCqlFromDocument(extractionResult.combinedContent);

    console.log('[Measure Ingestion] CQL Parser found:', {
      valueSets: cqlParsed.valueSets.length,
      codes: cqlParsed.codes.length,
      codeSystems: cqlParsed.codeSystems.length,
    });

    // Build a lookup of value set name -> parsed value set
    const vsLookup = new Map                                       ();
    for (const vs of cqlParsed.valueSets) {
      vsLookup.set(vs.name.toLowerCase(), vs);
    }

    // Enrich UMS valueSets with OIDs from CQL
    for (const vs of aiResult.ums.valueSets || []) {
      const parsed = vsLookup.get(vs.name.toLowerCase());
      if (parsed) {
        vs.oid = vs.oid || parsed.oid;
        vs.version = vs.version || parsed.version;
      }
    }

    // Add any CQL value sets that weren't in the LLM extraction
    const existingVsNames = new Set((aiResult.ums.valueSets || []).map(vs => vs.name.toLowerCase()));
    for (const vs of cqlParsed.valueSets) {
      if (!existingVsNames.has(vs.name.toLowerCase())) {
        aiResult.ums.valueSets = aiResult.ums.valueSets || [];
        aiResult.ums.valueSets.push({
          id: `vs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          oid: vs.oid,
          name: vs.name,
          version: vs.version || '',
          codes: [],
        });
      }
    }

    // Convert parsed codes to directCodes format and attach to UMS
    // These are individual code declarations from CQL (not value set contents)
    const parsedDirectCodes = cqlParsed.codes.map(c => ({
      code: c.code,
      display: c.display || c.name,
      system: normalizeCodeSystem(c.system),
    }));

    if (parsedDirectCodes.length > 0) {
      console.log('[Measure Ingestion] Attaching', parsedDirectCodes.length, 'parsed CQL codes to measure');
      // Store parsed codes in the measure for later use by components
      (aiResult.ums       ).parsedCqlCodes = parsedDirectCodes;
    }

    // Parse HTML spec for codes and value sets (deterministic, no LLM needed)
    const htmlParsed = parseHtmlSpec(extractionResult.combinedContent);
    console.log('[Measure Ingestion] HTML parser found:', {
      codes: htmlParsed.codes.length,
      valueSets: htmlParsed.valueSets.length,
      dataElementMappings: htmlParsed.dataElementMappings.length,
    });

    // Enrich DataElements with HTML-parsed data FIRST
    // HTML enrichment replaces placeholder OIDs (like "dtap_vaccine") with real OIDs
    enrichDataElementsWithHtmlSpec(aiResult.ums, htmlParsed);

    // THEN enrich with CQL-parsed data (can now match on real OIDs from HTML step)
    enrichDataElementsWithCqlCodes(aiResult.ums, cqlParsed, normalizeCodeSystem);

    // FINAL PASS: Resolve remaining placeholder OIDs using CQL value sets
    resolvePlaceholderOids(aiResult.ums, cqlParsed, htmlParsed);

    // POPULATE CODES: Use bundled value set expansions to fill in code lists
    populateBundledValueSetCodes(aiResult.ums);

    } catch (enrichmentError) {
      console.error('[ENRICHMENT FATAL ERROR]', enrichmentError);
      console.error('[ENRICHMENT FATAL ERROR] Stack:', enrichmentError instanceof Error ? enrichmentError.stack : 'No stack');
      // Continue anyway - we have the UMS from LLM, just without enrichment
    }

    // Stage 4: Finalize
    onProgress?.({
      stage: 'complete',
      message: 'Measure ingestion complete',
      progress: 100,
    });

    // Update source documents
    aiResult.ums.metadata.sourceDocuments = files.map(f => f.name);

    return {
      success: true,
      ums: aiResult.ums,
      documentInfo: {
        filesProcessed: files.length,
        totalCharacters: extractionResult.combinedContent.length,
        extractionErrors: extractionResult.errors,
      },
      aiInfo: {
        tokensUsed: aiResult.tokensUsed,
        model: model || 'default',
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    onProgress?.({
      stage: 'error',
      message: errorMessage,
      progress: 0,
    });

    return {
      success: false,
      documentInfo: {
        filesProcessed: files.length,
        totalCharacters: 0,
        extractionErrors: [errorMessage],
      },
      error: errorMessage,
    };
  }
}

// Enrichment functions are imported from extractionService.ts

