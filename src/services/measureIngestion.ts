/**
 * Measure Ingestion Service
 *
 * Orchestrates the complete measure ingestion process:
 * 1. Extract text from uploaded documents
 * 2. Use AI to extract structured measure data OR use direct parsing
 * 3. Build UMS from extracted data
 */

import { extractFromFiles, type ExtractionResult } from './documentLoader';
import { extractMeasureWithAI } from './aiExtractor';
import {
  extractMeasure as extractMeasureViaBackend,
  enrichDataElementsWithHtmlSpec,
  enrichDataElementsWithCqlCodes,
} from './extractionService';
import { parseMeasureSpec } from '../utils/specParser';
import type { UniversalMeasureSpec, DataElement, LogicalClause } from '../types/ums';
import type { CqlParseResult } from './cqlParser';
import { parseHtmlSpec, type HtmlSpecParseResult } from './htmlSpecParser';

/**
 * Smart truncation for LLM input - prioritizes HTML and CQL content over PDF/Excel.
 * HTML has structure, CQL has definitions. PDF flow diagrams and Excel are less useful.
 */
function truncateForLLM(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;

  // Split by file markers (format: === FILE: filename.ext ===)
  const fileMarkerRegex = /\n?=== FILE: ([^\n]+) ===/g;
  const sections: Array<{ filename: string; content: string; priority: number }> = [];

  let lastIndex = 0;
  let match;
  const matches: Array<{ index: number; filename: string }> = [];

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

export interface IngestionProgress {
  stage: 'loading' | 'extracting' | 'ai_processing' | 'building' | 'complete' | 'error';
  message: string;
  progress: number;
  details?: string;
}

export interface IngestionResult {
  success: boolean;
  ums?: UniversalMeasureSpec;
  documentInfo: {
    filesProcessed: number;
    totalCharacters: number;
    extractionErrors: string[];
  };
  aiInfo?: {
    tokensUsed?: number;
    model: string;
  };
  error?: string;
}

/**
 * Ingest measure specification files using AI extraction
 */
export async function ingestMeasureFiles(
  files: File[],
  apiKey: string,
  onProgress?: (progress: IngestionProgress) => void,
  provider: 'anthropic' | 'openai' | 'google' | 'custom' = 'anthropic',
  model?: string,
  customConfig?: { baseUrl: string; modelName: string }
): Promise<IngestionResult> {
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

    const providerNames: Record<string, string> = {
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
    const MAX_LLM_CHARS = 80000; // ~20K tokens - enough for structure extraction
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
    let aiResult: { success: boolean; ums?: UniversalMeasureSpec; error?: string; tokensUsed?: number };

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

      console.warn('🔴 CHECKPOINT 0: backendResult received:', { success: backendResult.success, hasUms: !!backendResult.ums, error: backendResult.error });
      if (backendResult.success && backendResult.ums) {
        console.log('[Measure Ingestion] Backend extraction successful');
        console.log('[DEBUG] *** REACHED POST-EXTRACTION BLOCK ***');
        aiResult = {
          success: true,
          ums: backendResult.ums,
          tokensUsed: backendResult.tokensUsed,
        };
        console.warn('🔴 CHECKPOINT 1: After backend extraction, aiResult.success =', aiResult.success);
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
      console.log('[DEBUG] *** EARLY RETURN - aiResult failed ***', { success: aiResult.success, hasUms: !!aiResult.ums });
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

    console.log('[DEBUG] *** PASSED aiResult CHECK - proceeding to enrichment ***');

    // Wrap all enrichment in try/catch to catch any errors
    try {
    // Stage 3: Enrich with CQL-parsed codes
    onProgress?.({
      stage: 'building',
      message: 'Enriching with parsed CQL codes...',
      progress: 90,
    });

    // Parse CQL content deterministically to extract codes the LLM may have missed
    console.warn('🔴 CHECKPOINT 2: About to run CQL parser');
    const { parseCqlFromDocument, normalizeCodeSystem } = await import('./cqlParser');
    const cqlParsed = parseCqlFromDocument(extractionResult.combinedContent);

    console.log('[Measure Ingestion] CQL Parser found:', {
      valueSets: cqlParsed.valueSets.length,
      codes: cqlParsed.codes.length,
      codeSystems: cqlParsed.codeSystems.length,
    });

    // DEBUG: CQL parser details
    console.log('[DEBUG-CQL] Parser returned:', JSON.stringify({
      valueSetsCount: cqlParsed.valueSets.length,
      codesCount: cqlParsed.codes.length,
      firstVs: cqlParsed.valueSets[0],
      firstCode: cqlParsed.codes[0],
    }, null, 2));

    // Build a lookup of value set name -> parsed value set
    const vsLookup = new Map<string, typeof cqlParsed.valueSets[0]>();
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
      (aiResult.ums as any).parsedCqlCodes = parsedDirectCodes;
    }

    // DEBUG: Check what content the HTML parser receives
    console.log('[DEBUG] *** ABOUT TO CALL HTML PARSER ***');
    console.log('[DEBUG-HTML] combinedContent length:', extractionResult.combinedContent?.length);
    console.log('[DEBUG-HTML] First 500 chars:', extractionResult.combinedContent?.substring(0, 500));
    console.log('[DEBUG-HTML] Contains "Terminology"?', extractionResult.combinedContent?.includes('Terminology'));
    console.log('[DEBUG-HTML] Contains "Data Criteria"?', extractionResult.combinedContent?.includes('Data Criteria'));
    console.log('[DEBUG-HTML] Contains "valueset"?', extractionResult.combinedContent?.includes('valueset'));
    console.log('[DEBUG-HTML] Contains "<li>"?', extractionResult.combinedContent?.includes('<li>'));
    console.log('[DEBUG-HTML] Contains "using"?', extractionResult.combinedContent?.includes('using'));
    console.log('[DEBUG-HTML] Sample around "Terminology":',
      extractionResult.combinedContent?.substring(
        Math.max(0, (extractionResult.combinedContent?.indexOf('Terminology') || 0) - 50),
        (extractionResult.combinedContent?.indexOf('Terminology') || 0) + 200
      )
    );

    // Parse HTML spec for codes and value sets (deterministic, no LLM needed)
    console.warn('🔴 CHECKPOINT 3: About to run HTML parser');
    const htmlParsed = parseHtmlSpec(extractionResult.combinedContent);
    console.log('[Measure Ingestion] HTML parser found:', {
      codes: htmlParsed.codes.length,
      valueSets: htmlParsed.valueSets.length,
      dataElementMappings: htmlParsed.dataElementMappings.length,
    });

    // DEBUG: HTML parser details
    console.log('[DEBUG-HTML] Parser returned:', JSON.stringify({
      codesCount: htmlParsed.codes.length,
      valueSetsCount: htmlParsed.valueSets.length,
      mappingsCount: htmlParsed.dataElementMappings.length,
      firstCode: htmlParsed.codes[0],
      firstVs: htmlParsed.valueSets[0],
      firstMapping: htmlParsed.dataElementMappings[0],
    }, null, 2));

    // DEBUG: Count DataElements before enrichment
    let totalDataElements = 0;
    for (const pop of aiResult.ums.populations || []) {
      function countElements(node: any): number {
        if (!node) return 0;
        if ('children' in node) return (node.children || []).reduce((sum: number, c: any) => sum + countElements(c), 0);
        return 1;
      }
      totalDataElements += pop.criteria ? countElements(pop.criteria) : 0;
    }
    console.log('[DEBUG-UMS] Total DataElements before enrichment:', totalDataElements);
    console.log('[DEBUG-UMS] First population criteria sample:', JSON.stringify(aiResult.ums.populations?.[0]?.criteria, null, 2)?.substring(0, 500));

    // Enrich DataElements with HTML-parsed data FIRST
    // HTML enrichment replaces placeholder OIDs (like "dtap_vaccine") with real OIDs
    console.warn('🔴 CHECKPOINT 4: About to enrich with HTML data');
    enrichDataElementsWithHtmlSpec(aiResult.ums, htmlParsed);

    // THEN enrich with CQL-parsed data (can now match on real OIDs from HTML step)
    console.warn('🔴 CHECKPOINT 4.5: About to enrich with CQL data');
    enrichDataElementsWithCqlCodes(aiResult.ums, cqlParsed, normalizeCodeSystem);

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

    // DEBUG: Check measure before return
    console.log('[DEBUG-MEASURE] About to return UMS. measureId:', aiResult.ums.metadata?.measureId);
    console.log('[DEBUG-MEASURE] populations count:', aiResult.ums.populations?.length);
    console.log('[DEBUG-MEASURE] valueSets count:', aiResult.ums.valueSets?.length);
    console.warn('🔴 CHECKPOINT 5: About to return final UMS');

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

