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
 * Ingest measure specification files using direct parsing (no AI)
 * This is faster and works offline
 *
 * Strategy:
 * 1. Parse HTML/PDF for measure structure (populations, descriptions)
 * 2. Parse Excel TRN for actual codes in value sets
 * 3. Merge the two to create complete UMS with codes
 */
export async function ingestMeasureFilesDirect(
  files: File[],
  onProgress?: (progress: IngestionProgress) => void
): Promise<IngestionResult> {
  try {
    onProgress?.({
      stage: 'loading',
      message: `Loading ${files.length} file(s)...`,
      progress: 10,
    });

    // Categorize files
    const htmlFiles = files.filter(f => {
      const name = f.name.toLowerCase();
      return name.endsWith('.html') && !name.includes('flow');
    });
    const excelFiles = files.filter(f => {
      const name = f.name.toLowerCase();
      return (name.endsWith('.xlsx') || name.endsWith('.xls')) &&
             (name.includes('trn') || name.includes('terminology') || name.includes('code'));
    });
    const zipFiles = files.filter(f => f.name.toLowerCase().endsWith('.zip'));
    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf') && !f.name.toLowerCase().includes('flow'));

    // Determine primary structure file (HTML > ZIP > PDF)
    const primaryFile = htmlFiles[0] || zipFiles[0] || pdfFiles[0] || files[0];
    console.log('Selected primary file for structure:', primaryFile.name);
    console.log('Excel files for codes:', excelFiles.map(f => f.name));

    onProgress?.({
      stage: 'extracting',
      message: `Parsing structure from ${primaryFile.name}...`,
      progress: 20,
    });

    // Parse the primary file for structure
    const parseResult = await parseMeasureSpec(primaryFile);

    if (!parseResult.success || !parseResult.ums) {
      return {
        success: false,
        documentInfo: {
          filesProcessed: files.length,
          totalCharacters: 0,
          extractionErrors: parseResult.warnings || ['Failed to parse document'],
        },
        error: parseResult.warnings?.join(', ') || 'Failed to parse measure specification',
      };
    }

    // If we have Excel TRN files, parse them for codes and merge
    if (excelFiles.length > 0) {
      onProgress?.({
        stage: 'extracting',
        message: `Extracting codes from ${excelFiles[0].name}...`,
        progress: 50,
      });

      const codesResult = await parseTerminologyExcel(excelFiles[0]);
      console.log(`Extracted ${codesResult.valueSets.length} value sets with codes from Excel`);

      // Merge codes into the UMS value sets
      mergeCodesIntoUMS(parseResult.ums, codesResult);
    }

    onProgress?.({
      stage: 'complete',
      message: 'Measure parsing complete',
      progress: 100,
    });

    // Update source documents with all file names
    parseResult.ums.metadata.sourceDocuments = files.map(f => f.name);

    return {
      success: true,
      ums: parseResult.ums,
      documentInfo: {
        filesProcessed: files.length,
        totalCharacters: 0,
        extractionErrors: parseResult.warnings || [],
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

/**
 * Parse Excel TRN (Terminology) file for value sets and codes
 */
async function parseTerminologyExcel(file: File): Promise<{ valueSets: Array<{ name: string; oid: string | null; codes: Array<{ code: string; display: string; system: string }> }> }> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const valueSets: Array<{ name: string; oid: string | null; codes: Array<{ code: string; display: string; system: string }> }> = [];
  const vsMap = new Map<string, typeof valueSets[0]>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];

    // Find header row by looking for common column names
    let headerRow = -1;
    let codeCol = -1, displayCol = -1, systemCol = -1, vsNameCol = -1, oidCol = -1;

    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const row = rows[i];
      if (!row) continue;

      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').toLowerCase().trim();

        // Look for code column
        if ((cell === 'code' || cell === 'code value' || cell.includes('code')) && !cell.includes('system')) {
          codeCol = j;
        }
        // Look for display/description column
        if (cell === 'description' || cell === 'display' || cell === 'code description' || cell.includes('descriptor')) {
          displayCol = j;
        }
        // Look for code system column
        if (cell === 'code system' || cell === 'codesystem' || cell === 'system' || cell.includes('code system')) {
          systemCol = j;
        }
        // Look for value set name column
        if (cell === 'value set name' || cell === 'valueset name' || cell.includes('value set') && cell.includes('name')) {
          vsNameCol = j;
        }
        // Look for OID column
        if (cell === 'oid' || cell === 'value set oid' || cell.includes('oid')) {
          oidCol = j;
        }
      }

      // If we found at least code column, this is likely the header
      if (codeCol >= 0) {
        headerRow = i;
        break;
      }
    }

    console.log(`Sheet "${sheetName}": headerRow=${headerRow}, codeCol=${codeCol}, displayCol=${displayCol}, systemCol=${systemCol}, vsNameCol=${vsNameCol}, oidCol=${oidCol}`);

    if (headerRow >= 0 && codeCol >= 0) {
      for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        const code = String(row[codeCol] || '').trim();
        if (!code) continue;

        const display = displayCol >= 0 ? String(row[displayCol] || '').trim() : code;
        const system = systemCol >= 0 ? String(row[systemCol] || '').trim() : 'Unknown';
        const vsName = vsNameCol >= 0 ? String(row[vsNameCol] || '').trim() : sheetName;
        const oid = oidCol >= 0 ? String(row[oidCol] || '').trim() : null;

        // Use vsName + oid as key to group codes
        const key = vsName + (oid || '');

        if (!vsMap.has(key)) {
          vsMap.set(key, {
            name: vsName,
            oid: oid || null,
            codes: [],
          });
        }

        vsMap.get(key)!.codes.push({
          code,
          display,
          system,
        });
      }
    }
  }

  valueSets.push(...vsMap.values());
  console.log(`Total value sets extracted: ${valueSets.length}, total codes: ${valueSets.reduce((sum, vs) => sum + vs.codes.length, 0)}`);

  return { valueSets };
}

/**
 * Merge codes from Excel into the UMS structure
 */
function mergeCodesIntoUMS(
  ums: UniversalMeasureSpec,
  codesResult: { valueSets: Array<{ name: string; oid: string | null; codes: Array<{ code: string; display: string; system: string }> }> }
): void {
  // Create lookup maps for value sets by name and OID
  const codesByName = new Map<string, typeof codesResult.valueSets[0]>();
  const codesByOid = new Map<string, typeof codesResult.valueSets[0]>();

  for (const vs of codesResult.valueSets) {
    codesByName.set(vs.name.toLowerCase(), vs);
    if (vs.oid) {
      codesByOid.set(vs.oid, vs);
    }
  }

  console.log(`Code lookup maps: ${codesByName.size} by name, ${codesByOid.size} by OID`);

  // Update UMS value sets with codes
  for (const umsVs of ums.valueSets) {
    // Try to find matching codes by OID first, then by name
    let matchedCodes: typeof codesResult.valueSets[0] | undefined;

    if (umsVs.oid) {
      matchedCodes = codesByOid.get(umsVs.oid);
    }
    if (!matchedCodes) {
      matchedCodes = codesByName.get(umsVs.name.toLowerCase());
    }
    // Also try partial name match
    if (!matchedCodes) {
      for (const [name, vs] of codesByName) {
        if (umsVs.name.toLowerCase().includes(name) || name.includes(umsVs.name.toLowerCase())) {
          matchedCodes = vs;
          break;
        }
      }
    }

    if (matchedCodes) {
      console.log(`Matched value set "${umsVs.name}" with ${matchedCodes.codes.length} codes`);
      umsVs.codes = matchedCodes.codes.map(c => ({
        code: c.code,
        display: c.display,
        system: mapCodeSystemName(c.system),
      }));
      umsVs.totalCodeCount = matchedCodes.codes.length;
      umsVs.verified = true;
    }
  }

  // Also update codes in population criteria DataElements
  const updateElementCodes = (element: any) => {
    if (element.valueSet) {
      const umsVs = ums.valueSets.find(vs => vs.id === element.valueSet.id || vs.name === element.valueSet.name);
      if (umsVs && umsVs.codes && umsVs.codes.length > 0) {
        element.valueSet.codes = umsVs.codes;
        element.valueSet.totalCodeCount = umsVs.totalCodeCount;
      }
    }
    if (element.children) {
      element.children.forEach(updateElementCodes);
    }
  };

  for (const pop of ums.populations) {
    if (pop.criteria) {
      updateElementCodes(pop.criteria);
    }
  }
}

function mapCodeSystemName(systemName: string): 'ICD10' | 'SNOMED' | 'CPT' | 'HCPCS' | 'LOINC' | 'RxNorm' | 'CVX' {
  const lower = systemName.toLowerCase();
  if (lower.includes('icd') || lower.includes('10-cm') || lower.includes('10cm')) return 'ICD10';
  if (lower.includes('snomed') || lower.includes('sct')) return 'SNOMED';
  if (lower.includes('cpt')) return 'CPT';
  if (lower.includes('hcpcs') || lower.includes('hcpc')) return 'HCPCS';
  if (lower.includes('loinc')) return 'LOINC';
  if (lower.includes('rxnorm') || lower.includes('rx')) return 'RxNorm';
  if (lower.includes('cvx')) return 'CVX';
  return 'CPT'; // default
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

/**
 * Preview document content without AI extraction
 */
export async function previewDocuments(files: File[]): Promise<ExtractionResult> {
  return extractFromFiles(files);
}
