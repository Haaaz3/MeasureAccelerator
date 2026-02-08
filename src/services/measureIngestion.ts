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
import { parseMeasureSpec } from '../utils/specParser';
import type { UniversalMeasureSpec } from '../types/ums';

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

    // Debug: Log extracted content
    console.log('=== DOCUMENT EXTRACTION DEBUG ===');
    console.log('Files processed:', extractionResult.documents.map(d => d.filename));
    console.log('Total characters:', extractionResult.combinedContent.length);
    console.log('Content preview (first 1000 chars):', extractionResult.combinedContent.substring(0, 1000));

    onProgress?.({
      stage: 'extracting',
      message: `Extracted text from ${extractionResult.documents.length} document(s)`,
      progress: 20,
      details: `${extractionResult.combinedContent.length.toLocaleString()} characters extracted`,
    });

    if (!extractionResult.combinedContent || extractionResult.combinedContent.length < 100) {
      return {
        success: false,
        documentInfo: {
          filesProcessed: files.length,
          totalCharacters: extractionResult.combinedContent.length,
          extractionErrors: extractionResult.errors,
        },
        error: 'Unable to extract meaningful content from the uploaded files. Please ensure the files contain readable text.',
      };
    }

    // Stage 2: Use AI to extract structured data
    if (!apiKey) {
      return {
        success: false,
        documentInfo: {
          filesProcessed: files.length,
          totalCharacters: extractionResult.combinedContent.length,
          extractionErrors: extractionResult.errors,
        },
        error: 'API key is required for AI extraction. Please configure your API key in settings.',
      };
    }

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

    const aiResult = await extractMeasureWithAI(
      extractionResult.combinedContent,
      apiKey,
      (aiProgress) => {
        onProgress?.({
          stage: 'ai_processing',
          message: aiProgress.message,
          progress: 30 + (aiProgress.progress * 0.6), // Scale AI progress to 30-90%
        });
      },
      provider,
      model,
      customConfig
    );

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

    // Stage 3: Finalize
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

