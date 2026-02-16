/**
 * OID Validation Service
 *
 * Validates OIDs (Object Identifiers) extracted from measure specifications.
 * Catches common extraction errors before they propagate into components.
 *
 * Key features:
 * - Format validation (regex)
 * - Cross-reference against known OID catalog
 * - Fuzzy name matching to detect mismatches
 * - VSAC integration (when API key available)
 */

// ============================================================================
// Types
// ============================================================================

export interface OIDValidationResult {
  valid: boolean;
  oid: string;
  errors: OIDValidationError[];
  warnings: OIDValidationWarning[];
  catalogMatch?: CatalogMatch;
}

export interface OIDValidationError {
  code: OIDErrorCode;
  message: string;
  suggestion?: string;
}

export interface OIDValidationWarning {
  code: OIDWarningCode;
  message: string;
}

export type OIDErrorCode =
  | 'MALFORMED_FORMAT'
  | 'INVALID_ROOT'
  | 'NAME_MISMATCH'
  | 'VSAC_NOT_FOUND'
  | 'VSAC_ERROR';

export type OIDWarningCode =
  | 'NOT_IN_CATALOG'
  | 'SIMILAR_OID_EXISTS'
  | 'DEPRECATED_OID'
  | 'VSAC_UNAVAILABLE';

export interface CatalogMatch {
  oid: string;
  name: string;
  alternateNames?: string[];
  codeSystem?: string;
  steward?: string;
  purpose?: string;
  lastUpdated?: string;
}

export interface OIDBatchValidationResult {
  total: number;
  valid: number;
  invalid: number;
  warnings: number;
  results: OIDValidationResult[];
}

export interface ValueSetNamePair {
  oid: string;
  name: string;
  source?: string;
}

// ============================================================================
// OID Format Validation
// ============================================================================

/**
 * OID format regex
 * OIDs are sequences of non-negative integers separated by dots
 * Must start with 0, 1, or 2
 * If starts with 0 or 1, second number must be 0-39
 */
const OID_REGEX = /^[0-2](\.(0|[1-9]\d*))+$/;

/**
 * Common OID root prefixes for healthcare value sets
 */
const KNOWN_OID_ROOTS = {
  '2.16.840.1.113883.3.464': 'NCQA (HEDIS/eCQM)',
  '2.16.840.1.113883.3.526': 'AMA-PCPI',
  '2.16.840.1.113883.3.117': 'The Joint Commission',
  '2.16.840.1.113883.3.600': 'CMS',
  '2.16.840.1.113883.6.96': 'SNOMED CT',
  '2.16.840.1.113883.6.90': 'ICD-10-CM',
  '2.16.840.1.113883.6.88': 'RxNorm',
  '2.16.840.1.113883.6.1': 'LOINC',
  '2.16.840.1.113883.6.12': 'CPT',
  '2.16.840.1.113883.6.285': 'HCPCS',
  '2.16.840.1.113883.12': 'HL7 Code Systems',
};

/**
 * Validate OID format
 */
export function validateOIDFormat(oid: string): { valid: boolean; error?: string } {
  if (!oid || typeof oid !== 'string') {
    return { valid: false, error: 'OID is empty or not a string' };
  }

  const trimmed = oid.trim();

  if (!OID_REGEX.test(trimmed)) {
    // Try to provide a helpful error message
    if (trimmed.includes(' ')) {
      return { valid: false, error: 'OID contains spaces' };
    }
    if (trimmed.includes('O') || trimmed.includes('o')) {
      return { valid: false, error: 'OID contains letter O instead of zero' };
    }
    if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
      return { valid: false, error: 'OID cannot start or end with a dot' };
    }
    if (trimmed.includes('..')) {
      return { valid: false, error: 'OID contains consecutive dots' };
    }
    if (!/^\d/.test(trimmed)) {
      return { valid: false, error: 'OID must start with a digit (0, 1, or 2)' };
    }

    return { valid: false, error: 'Invalid OID format' };
  }

  // Check that root is valid (0, 1, or 2)
  const firstArc = parseInt(trimmed.split('.')[0], 10);
  if (firstArc > 2) {
    return { valid: false, error: 'OID first arc must be 0, 1, or 2' };
  }

  return { valid: true };
}

/**
 * Get the root organization from an OID
 */
export function getOIDRoot(oid: string): string | undefined {
  for (const root of Object.keys(KNOWN_OID_ROOTS).sort((a, b) => b.length - a.length)) {
    if (oid.startsWith(root)) {
      return KNOWN_OID_ROOTS[root as keyof typeof KNOWN_OID_ROOTS];
    }
  }
  return undefined;
}

// ============================================================================
// Name Matching
// ============================================================================

/**
 * Calculate string similarity using Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) {
    return 1.0;
  }

  const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - distance) / longer.length;
}

/**
 * Fuzzy match two value set names
 */
export function fuzzyMatchNames(name1: string, name2: string): {
  match: boolean;
  similarity: number;
  normalizedName1: string;
  normalizedName2: string;
} {
  // Normalize names for comparison
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  // Exact match after normalization
  if (n1 === n2) {
    return { match: true, similarity: 1.0, normalizedName1: n1, normalizedName2: n2 };
  }

  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) {
    const similarity = Math.min(n1.length, n2.length) / Math.max(n1.length, n2.length);
    return { match: similarity > 0.7, similarity, normalizedName1: n1, normalizedName2: n2 };
  }

  // Calculate similarity
  const similarity = stringSimilarity(n1, n2);
  return {
    match: similarity > 0.8,
    similarity,
    normalizedName1: n1,
    normalizedName2: n2,
  };
}

// ============================================================================
// OID Catalog (Common eCQM Value Sets)
// ============================================================================

/**
 * Catalog of common eCQM value sets
 * This provides offline validation for the most frequently used OIDs
 */
export const OID_CATALOG: Record<string, CatalogMatch> = {
  // ===== Encounters =====
  '2.16.840.1.113883.3.464.1003.101.12.1001': {
    oid: '2.16.840.1.113883.3.464.1003.101.12.1001',
    name: 'Office Visit',
    alternateNames: ['Office Visits', 'Outpatient Visit'],
    steward: 'NCQA',
    purpose: 'Qualifying encounters for measure inclusion',
  },
  '2.16.840.1.113883.3.464.1003.101.12.1016': {
    oid: '2.16.840.1.113883.3.464.1003.101.12.1016',
    name: 'Home Healthcare Services',
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.101.12.1023': {
    oid: '2.16.840.1.113883.3.464.1003.101.12.1023',
    name: 'Preventive Care Services - Established Office Visit, 18 and Up',
    alternateNames: ['Preventive Care Established'],
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.101.12.1024': {
    oid: '2.16.840.1.113883.3.464.1003.101.12.1024',
    name: 'Preventive Care Services - Initial Office Visit, 18 and Up',
    alternateNames: ['Preventive Care Initial'],
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.101.12.1025': {
    oid: '2.16.840.1.113883.3.464.1003.101.12.1025',
    name: 'Annual Wellness Visit',
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.101.12.1030': {
    oid: '2.16.840.1.113883.3.464.1003.101.12.1030',
    name: 'Online Assessments',
    alternateNames: ['Telehealth', 'Virtual Visit'],
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.101.12.1080': {
    oid: '2.16.840.1.113883.3.464.1003.101.12.1080',
    name: 'Telephone Visits',
    steward: 'NCQA',
  },

  // ===== Hospice =====
  '2.16.840.1.113883.3.464.1003.1003': {
    oid: '2.16.840.1.113883.3.464.1003.1003',
    name: 'Hospice Care Ambulatory',
    alternateNames: ['Hospice Services', 'Hospice Encounter'],
    steward: 'NCQA',
    purpose: 'Common exclusion criterion',
  },

  // ===== Colorectal Cancer Screening (CMS130) =====
  '2.16.840.1.113883.3.464.1003.108.12.1020': {
    oid: '2.16.840.1.113883.3.464.1003.108.12.1020',
    name: 'Colonoscopy',
    steward: 'NCQA',
    purpose: 'CRC screening procedure',
  },
  '2.16.840.1.113883.3.464.1003.108.12.1038': {
    oid: '2.16.840.1.113883.3.464.1003.108.12.1038',
    name: 'Fecal Occult Blood Test (FOBT)',
    alternateNames: ['FOBT', 'Stool Blood Test'],
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.108.12.1039': {
    oid: '2.16.840.1.113883.3.464.1003.108.12.1039',
    name: 'Flexible Sigmoidoscopy',
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.108.12.1001': {
    oid: '2.16.840.1.113883.3.464.1003.108.12.1001',
    name: 'Malignant Neoplasm of Colon',
    alternateNames: ['Colorectal Cancer', 'Colon Cancer'],
    steward: 'NCQA',
    purpose: 'CRC screening exclusion',
  },
  '2.16.840.1.113883.3.464.1003.198.12.1019': {
    oid: '2.16.840.1.113883.3.464.1003.198.12.1019',
    name: 'Total Colectomy',
    steward: 'NCQA',
    purpose: 'CRC screening exclusion',
  },
  '2.16.840.1.113883.3.464.1003.108.12.1007': {
    oid: '2.16.840.1.113883.3.464.1003.108.12.1007',
    name: 'FIT DNA',
    alternateNames: ['Cologuard', 'Stool DNA'],
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.108.12.1011': {
    oid: '2.16.840.1.113883.3.464.1003.108.12.1011',
    name: 'CT Colonography',
    alternateNames: ['Virtual Colonoscopy'],
    steward: 'NCQA',
  },

  // ===== Cervical Cancer Screening (CMS124) =====
  '2.16.840.1.113883.3.464.1003.108.12.1017': {
    oid: '2.16.840.1.113883.3.464.1003.108.12.1017',
    name: 'Pap Test',
    alternateNames: ['Cervical Cytology', 'Pap Smear'],
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.110.12.1059': {
    oid: '2.16.840.1.113883.3.464.1003.110.12.1059',
    name: 'HPV Test',
    alternateNames: ['High Risk HPV Test', 'hrHPV'],
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.198.12.1014': {
    oid: '2.16.840.1.113883.3.464.1003.198.12.1014',
    name: 'Hysterectomy with No Residual Cervix',
    alternateNames: ['Total Hysterectomy'],
    steward: 'NCQA',
    purpose: 'Cervical screening exclusion',
  },

  // ===== Breast Cancer Screening (CMS125) =====
  '2.16.840.1.113883.3.464.1003.198.12.1005': {
    oid: '2.16.840.1.113883.3.464.1003.198.12.1005',
    name: 'Mammography',
    alternateNames: ['Mammogram', 'Breast Cancer Screening'],
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.198.12.1068': {
    oid: '2.16.840.1.113883.3.464.1003.198.12.1068',
    name: 'Bilateral Mastectomy',
    steward: 'NCQA',
    purpose: 'Breast screening exclusion',
  },
  '2.16.840.1.113883.3.464.1003.198.12.1133': {
    oid: '2.16.840.1.113883.3.464.1003.198.12.1133',
    name: 'Unilateral Mastectomy Left',
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.198.12.1134': {
    oid: '2.16.840.1.113883.3.464.1003.198.12.1134',
    name: 'Unilateral Mastectomy Right',
    steward: 'NCQA',
  },

  // ===== Diabetes (CMS122, CMS123, etc.) =====
  '2.16.840.1.113883.3.464.1003.103.12.1001': {
    oid: '2.16.840.1.113883.3.464.1003.103.12.1001',
    name: 'Diabetes',
    alternateNames: ['Diabetes Mellitus'],
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.198.12.1013': {
    oid: '2.16.840.1.113883.3.464.1003.198.12.1013',
    name: 'HbA1c Laboratory Test',
    alternateNames: ['Hemoglobin A1c', 'A1C'],
    steward: 'NCQA',
  },

  // ===== Hypertension (CMS165) =====
  '2.16.840.1.113883.3.464.1003.104.12.1011': {
    oid: '2.16.840.1.113883.3.464.1003.104.12.1011',
    name: 'Essential Hypertension',
    alternateNames: ['Hypertension', 'High Blood Pressure'],
    steward: 'NCQA',
  },

  // ===== Mental Health =====
  '2.16.840.1.113883.3.464.1003.105.12.1007': {
    oid: '2.16.840.1.113883.3.464.1003.105.12.1007',
    name: 'Major Depression',
    alternateNames: ['Major Depressive Disorder', 'MDD'],
    steward: 'NCQA',
  },

  // ===== Medications =====
  '2.16.840.1.113883.3.464.1003.196.12.1001': {
    oid: '2.16.840.1.113883.3.464.1003.196.12.1001',
    name: 'Antidepressant Medication',
    alternateNames: ['Antidepressants'],
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.196.12.1205': {
    oid: '2.16.840.1.113883.3.464.1003.196.12.1205',
    name: 'ACE Inhibitor or ARB',
    alternateNames: ['ACEI/ARB', 'ACE Inhibitors'],
    steward: 'NCQA',
  },

  // ===== Immunizations =====
  '2.16.840.1.113883.3.464.1003.196.12.1214': {
    oid: '2.16.840.1.113883.3.464.1003.196.12.1214',
    name: 'Influenza Vaccine',
    alternateNames: ['Flu Shot', 'Flu Vaccine'],
    steward: 'NCQA',
  },
  '2.16.840.1.113883.3.464.1003.110.12.1027': {
    oid: '2.16.840.1.113883.3.464.1003.110.12.1027',
    name: 'Pneumococcal Vaccine',
    alternateNames: ['Pneumonia Vaccine'],
    steward: 'NCQA',
  },

  // ===== Palliative Care =====
  '2.16.840.1.113883.3.464.1003.1167': {
    oid: '2.16.840.1.113883.3.464.1003.1167',
    name: 'Palliative Care',
    alternateNames: ['Comfort Care'],
    steward: 'NCQA',
    purpose: 'Common exclusion - often confused with Hospice',
  },

  // ===== Frailty =====
  '2.16.840.1.113883.3.464.1003.113.12.1074': {
    oid: '2.16.840.1.113883.3.464.1003.113.12.1074',
    name: 'Frailty Diagnosis',
    alternateNames: ['Frailty'],
    steward: 'NCQA',
    purpose: 'Advanced illness exclusion',
  },

  // ===== ESRD =====
  '2.16.840.1.113883.3.464.1003.109.12.1028': {
    oid: '2.16.840.1.113883.3.464.1003.109.12.1028',
    name: 'End Stage Renal Disease',
    alternateNames: ['ESRD', 'Kidney Failure'],
    steward: 'NCQA',
  },

  // ===== Pregnancy =====
  '2.16.840.1.113883.3.464.1003.111.12.1011': {
    oid: '2.16.840.1.113883.3.464.1003.111.12.1011',
    name: 'Pregnancy',
    alternateNames: ['Pregnant'],
    steward: 'NCQA',
  },
};

// ============================================================================
// Main Validation Functions
// ============================================================================

/**
 * Validate an OID with optional name matching
 */
export function validateOID(
  oid: string,
  extractedName?: string
): OIDValidationResult {
  const errors: OIDValidationError[] = [];
  const warnings: OIDValidationWarning[] = [];
  let catalogMatch: CatalogMatch | undefined;

  // Step 1: Format validation
  const formatResult = validateOIDFormat(oid);
  if (!formatResult.valid) {
    errors.push({
      code: 'MALFORMED_FORMAT',
      message: formatResult.error || 'Invalid OID format',
      suggestion: 'OID should be a sequence of numbers separated by dots (e.g., 2.16.840.1.113883.3.464.1003.101.12.1001)',
    });
    return { valid: false, oid, errors, warnings };
  }

  // Step 2: Check if we recognize the root
  const root = getOIDRoot(oid);
  if (!root) {
    warnings.push({
      code: 'NOT_IN_CATALOG',
      message: `OID root not recognized. May be valid but not in common eCQM catalog.`,
    });
  }

  // Step 3: Catalog lookup
  catalogMatch = OID_CATALOG[oid];

  if (catalogMatch) {
    // Found in catalog - verify name if provided
    if (extractedName) {
      const nameMatch = fuzzyMatchNames(extractedName, catalogMatch.name);

      if (!nameMatch.match) {
        // Check alternate names
        const altMatch = catalogMatch.alternateNames?.some(
          alt => fuzzyMatchNames(extractedName, alt).match
        );

        if (!altMatch) {
          errors.push({
            code: 'NAME_MISMATCH',
            message: `Extracted name "${extractedName}" does not match catalog name "${catalogMatch.name}"`,
            suggestion: `Expected name similar to: ${catalogMatch.name}${
              catalogMatch.alternateNames ? ` (or: ${catalogMatch.alternateNames.join(', ')})` : ''
            }`,
          });
        }
      }
    }
  } else {
    // Not in catalog
    warnings.push({
      code: 'NOT_IN_CATALOG',
      message: 'OID not found in common eCQM value set catalog. Verify it is correct.',
    });

    // Check for similar OIDs (potential typos)
    const similarOIDs = findSimilarOIDs(oid);
    if (similarOIDs.length > 0) {
      warnings.push({
        code: 'SIMILAR_OID_EXISTS',
        message: `Similar OIDs in catalog: ${similarOIDs.map(s => `${s.oid} (${s.name})`).join(', ')}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    oid,
    errors,
    warnings,
    catalogMatch,
  };
}

/**
 * Find OIDs in catalog that are similar to the given OID (potential typos)
 */
function findSimilarOIDs(oid: string, maxDistance: number = 2): CatalogMatch[] {
  const similar: CatalogMatch[] = [];

  for (const catalogOid of Object.keys(OID_CATALOG)) {
    // Quick length check - OIDs with very different lengths are unlikely matches
    if (Math.abs(catalogOid.length - oid.length) > maxDistance) {
      continue;
    }

    // Calculate edit distance on the numeric parts
    const oidParts = oid.split('.');
    const catalogParts = catalogOid.split('.');

    if (oidParts.length === catalogParts.length) {
      let differences = 0;
      for (let i = 0; i < oidParts.length; i++) {
        if (oidParts[i] !== catalogParts[i]) {
          differences++;
        }
      }

      if (differences <= maxDistance) {
        similar.push(OID_CATALOG[catalogOid]);
      }
    }
  }

  return similar;
}

/**
 * Validate a batch of OID/name pairs
 */
export function validateOIDBatch(
  pairs: ValueSetNamePair[]
): OIDBatchValidationResult {
  const results = pairs.map(pair => validateOID(pair.oid, pair.name));

  return {
    total: results.length,
    valid: results.filter(r => r.valid).length,
    invalid: results.filter(r => !r.valid).length,
    warnings: results.filter(r => r.warnings.length > 0).length,
    results,
  };
}

/**
 * Get suggestions for a value set name (fuzzy search catalog)
 */
export function suggestValueSets(
  nameQuery: string,
  limit: number = 5
): CatalogMatch[] {
  const matches: Array<{ match: CatalogMatch; score: number }> = [];

  for (const catalogMatch of Object.values(OID_CATALOG)) {
    const nameSim = stringSimilarity(nameQuery, catalogMatch.name);
    let bestScore = nameSim;

    // Check alternate names
    if (catalogMatch.alternateNames) {
      for (const alt of catalogMatch.alternateNames) {
        const altSim = stringSimilarity(nameQuery, alt);
        if (altSim > bestScore) {
          bestScore = altSim;
        }
      }
    }

    if (bestScore > 0.3) {
      matches.push({ match: catalogMatch, score: bestScore });
    }
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(m => m.match);
}

// ============================================================================
// VSAC Integration (Optional)
// ============================================================================

export interface VSACValidationOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Validate OID against VSAC (requires API key)
 */
export async function validateOIDViaVSAC(
  oid: string,
  options: VSACValidationOptions
): Promise<OIDValidationResult> {
  const { apiKey, baseUrl = 'https://vsac.nlm.nih.gov/vsac/svs', timeout = 10000 } = options;

  // First do local validation
  const localResult = validateOID(oid);

  if (!localResult.valid) {
    return localResult;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const url = `${baseUrl}/RetrieveValueSet?id=${encodeURIComponent(oid)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${btoa(`apikey:${apiKey}`)}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();

      // Update result with VSAC data
      return {
        ...localResult,
        catalogMatch: {
          oid,
          name: data.displayName || data.name,
          steward: data.source,
          lastUpdated: data.effectiveDate,
        },
      };
    } else if (response.status === 404) {
      return {
        ...localResult,
        valid: false,
        errors: [
          ...localResult.errors,
          {
            code: 'VSAC_NOT_FOUND',
            message: 'OID not found in VSAC',
            suggestion: 'Verify the OID is correct or check if the value set has been retired',
          },
        ],
      };
    } else {
      return {
        ...localResult,
        warnings: [
          ...localResult.warnings,
          {
            code: 'VSAC_UNAVAILABLE',
            message: `VSAC returned status ${response.status}`,
          },
        ],
      };
    }
  } catch (err) {
    return {
      ...localResult,
      warnings: [
        ...localResult.warnings,
        {
          code: 'VSAC_UNAVAILABLE',
          message: err instanceof Error ? err.message : 'VSAC request failed',
        },
      ],
    };
  }
}

// ============================================================================
// Export Catalog Size for Testing
// ============================================================================

export function getCatalogSize(): number {
  return Object.keys(OID_CATALOG).length;
}

export function getCatalogOIDs(): string[] {
  return Object.keys(OID_CATALOG);
}
