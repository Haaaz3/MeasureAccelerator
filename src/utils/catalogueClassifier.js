/**
 * Catalogue Classifier
 *
 * Analyzes raw document text (extracted from PDFs, Word docs, etc.) to detect
 * the catalogue type before UMS rendering. Returns a classification result
 * with confidence levels and human-readable signals.
 *
 * Supported catalogue types:
 * - eCQM: CMS Electronic Clinical Quality Measures
 * - MIPS_CQM: Merit-based Incentive Payment System CQMs
 * - HEDIS: Healthcare Effectiveness Data and Information Set
 * - QOF: Quality and Outcomes Framework (UK NHS)
 * - Clinical_Standard: Generic clinical practice guidelines
 */

/**
 * Classification result shape
 * @typedef {Object} ClassificationResult
 * @property {'eCQM' | 'MIPS_CQM' | 'HEDIS' | 'QOF' | 'Clinical_Standard' | null} detected
 * @property {'high' | 'medium' | 'low'} confidence
 * @property {string[]} signals - Human-readable descriptions of detected signals
 * @property {Object} rawScores - Raw signal counts by catalogue type
 */

/**
 * Catalogue type constants matching what mapProgram() in transformers.js recognizes
 */
export const CATALOGUE_TYPES = {
  ECQM: 'eCQM',
  MIPS_CQM: 'MIPS_CQM',
  HEDIS: 'HEDIS',
  QOF: 'QOF',
  CLINICAL_STANDARD: 'Clinical_Standard',
};

/**
 * Human-readable labels for UI display
 */
export const CATALOGUE_LABELS = {
  eCQM: 'eCQM',
  MIPS_CQM: 'MIPS CQM',
  HEDIS: 'HEDIS',
  QOF: 'QOF',
  Clinical_Standard: 'Clinical Standard',
  Custom: 'Custom',
};

/**
 * Classify a document based on its raw text content.
 *
 * @param {string} text - The full extracted text string from the document
 * @returns {ClassificationResult} - Classification result with detected type, confidence, and signals
 */
export function classifyDocument(text) {
  if (!text || typeof text !== 'string') {
    return {
      detected: null,
      confidence: 'low',
      signals: [],
      rawScores: { eCQM: 0, MIPS_CQM: 0, HEDIS: 0, QOF: 0, Clinical_Standard: 0 },
    };
  }

  const normalizedText = text.toLowerCase();
  const scores = {
    eCQM: 0,
    MIPS_CQM: 0,
    HEDIS: 0,
    QOF: 0,
    Clinical_Standard: 0,
  };
  const signals = [];

  // =========================================================================
  // eCQM signals
  // =========================================================================

  // CMS measure ID pattern (e.g., "CMS127v12", "CMS2v13")
  const cmsIdPattern = /\bCMS\d{1,4}v\d{1,2}\b/gi;
  const cmsMatches = text.match(cmsIdPattern);
  if (cmsMatches && cmsMatches.length > 0) {
    scores.eCQM += 2;
    signals.push(`Found CMS measure ID: ${cmsMatches[0]}`);
  }

  // Explicit eCQM mention
  if (/\becqm\b/i.test(text) || /electronic clinical quality measure/i.test(text)) {
    scores.eCQM += 2;
    signals.push("Contains 'eCQM' or 'electronic Clinical Quality Measure'");
  }

  // QDM - Quality Data Model
  if (/\bqdm\b/i.test(text) || /quality data model/i.test(text)) {
    scores.eCQM += 1;
    signals.push("Contains 'QDM' (Quality Data Model)");
  }

  // FHIR AND measure in proximity (within 50 chars)
  if (/fhir.{0,50}measure|measure.{0,50}fhir/i.test(text)) {
    scores.eCQM += 1;
    signals.push("Contains 'FHIR' and 'measure' in proximity");
  }

  // MAT - Measure Authoring Tool
  if (/\bmat\b/i.test(text) && /measure authoring tool/i.test(text)) {
    scores.eCQM += 1;
    signals.push("Contains 'MAT' (Measure Authoring Tool)");
  }

  // Publisher contains CMS or Centers for Medicare
  if (/centers for medicare/i.test(text) || /\bcms\b.*\bpublisher\b|\bpublisher\b.*\bcms\b/i.test(text)) {
    scores.eCQM += 1;
    signals.push("Publisher/steward is CMS or Centers for Medicare");
  }

  // =========================================================================
  // MIPS CQM signals
  // =========================================================================

  // Explicit MIPS mention
  if (/\bmips\b/i.test(text) || /merit-based incentive payment system/i.test(text)) {
    scores.MIPS_CQM += 2;
    signals.push("Contains 'MIPS' or 'Merit-based Incentive Payment System'");
  }

  // Quality ID # pattern
  if (/quality id\s*#?\s*\d+/i.test(text)) {
    scores.MIPS_CQM += 1;
    signals.push("Contains 'Quality ID #' pattern");
  }

  // NQF# pattern
  if (/nqf\s*#?\s*\d+/i.test(text)) {
    scores.MIPS_CQM += 1;
    signals.push("Contains 'NQF#' pattern");
  }

  // PQRS (older measures)
  if (/\bpqrs\b/i.test(text)) {
    scores.MIPS_CQM += 1;
    signals.push("Contains 'PQRS' (predecessor to MIPS)");
  }

  // Eligible Clinician / Eligible Professional
  if (/eligible clinician/i.test(text) || /eligible professional/i.test(text)) {
    scores.MIPS_CQM += 1;
    signals.push("Contains 'Eligible Clinician' or 'Eligible Professional'");
  }

  // Document has eCQM signals AND MIPS - classify as MIPS CQM
  if (scores.eCQM > 0 && scores.MIPS_CQM > 0) {
    scores.MIPS_CQM += 1;
    signals.push("Has both eCQM and MIPS signals - likely MIPS CQM");
  }

  // =========================================================================
  // HEDIS signals
  // =========================================================================

  // Explicit HEDIS mention
  if (/\bhedis\b/i.test(text) || /healthcare effectiveness data/i.test(text)) {
    scores.HEDIS += 2;
    signals.push("Contains 'HEDIS' or 'Healthcare Effectiveness Data'");
  }

  // NCQA
  if (/\bncqa\b/i.test(text) || /national committee for quality assurance/i.test(text)) {
    scores.HEDIS += 2;
    signals.push("Contains 'NCQA' (National Committee for Quality Assurance)");
  }

  // HEDIS measurement year format (MY 2024, MY2024, etc.)
  const myPattern = /\bmy\s*20\d{2}\b/i;
  if (myPattern.test(text)) {
    scores.HEDIS += 1;
    signals.push("Contains HEDIS measurement year format (MY YYYY)");
  }

  // Hybrid AND Administrative in proximity
  if (/hybrid.{0,30}administrative|administrative.{0,30}hybrid/i.test(text)) {
    scores.HEDIS += 1;
    signals.push("Contains 'Hybrid' and 'Administrative' in proximity");
  }

  // IPSD or IPED (HEDIS pharmacy anchor dates)
  if (/\bipsd\b/i.test(text) || /\biped\b/i.test(text)) {
    scores.HEDIS += 1;
    signals.push("Contains 'IPSD' or 'IPED' (HEDIS pharmacy dates)");
  }

  // Continuous Enrollment section
  if (/continuous enrollment/i.test(text)) {
    scores.HEDIS += 1;
    signals.push("Contains 'Continuous Enrollment' section");
  }

  // =========================================================================
  // QOF signals (UK NHS)
  // =========================================================================

  // Explicit QOF mention
  if (/\bqof\b/i.test(text) || /quality and outcomes framework/i.test(text)) {
    scores.QOF += 2;
    signals.push("Contains 'QOF' or 'Quality and Outcomes Framework'");
  }

  // NHS or National Health Service
  if (/\bnhs\b/i.test(text) || /national health service/i.test(text)) {
    scores.QOF += 2;
    signals.push("Contains 'NHS' or 'National Health Service'");
  }

  // SNOMED CT AND UK in proximity
  if (/snomed.{0,30}uk|uk.{0,30}snomed/i.test(text)) {
    scores.QOF += 1;
    signals.push("Contains 'SNOMED CT' and 'UK' in proximity");
  }

  // Achievement threshold / Exception reporting
  if (/achievement threshold/i.test(text) || /exception reporting/i.test(text)) {
    scores.QOF += 1;
    signals.push("Contains 'Achievement threshold' or 'Exception reporting'");
  }

  // Points AND Prevalence in proximity (QOF scoring language)
  if (/points.{0,50}prevalence|prevalence.{0,50}points/i.test(text)) {
    scores.QOF += 1;
    signals.push("Contains 'Points' and 'Prevalence' in proximity (QOF scoring)");
  }

  // =========================================================================
  // Clinical Standard signals
  // =========================================================================

  // Clinical Practice Guideline or Clinical Standard
  if (/clinical practice guideline/i.test(text) || /\bclinical standard\b/i.test(text)) {
    scores.Clinical_Standard += 2;
    signals.push("Contains 'Clinical Practice Guideline' or 'Clinical Standard'");
  }

  // Measure Specification without other specific signals
  if (/measure specification/i.test(text)) {
    // Only add if no strong signals from other types
    const hasStrongSignals = scores.eCQM >= 2 || scores.MIPS_CQM >= 2 || scores.HEDIS >= 2 || scores.QOF >= 2;
    if (!hasStrongSignals) {
      scores.Clinical_Standard += 1;
      signals.push("Contains 'Measure Specification' without specific catalogue signals");
    }
  }

  // Denominator AND Numerator but no CMS measure ID
  if (/\bdenominator\b/i.test(text) && /\bnumerator\b/i.test(text)) {
    if (!cmsMatches || cmsMatches.length === 0) {
      // Only add if no strong signals from other types
      const hasStrongSignals = scores.eCQM >= 2 || scores.MIPS_CQM >= 2 || scores.HEDIS >= 2 || scores.QOF >= 2;
      if (!hasStrongSignals) {
        scores.Clinical_Standard += 1;
        signals.push("Contains 'Denominator' and 'Numerator' without CMS measure ID");
      }
    }
  }

  // =========================================================================
  // Determine winner and confidence
  // =========================================================================

  const sortedTypes = Object.entries(scores)
    .sort(([, a], [, b]) => b - a);

  const [topType, topScore] = sortedTypes[0];
  const [, secondScore] = sortedTypes[1] || ['', 0];

  // If no signals matched, return null
  if (topScore === 0) {
    return {
      detected: null,
      confidence: 'low',
      signals: ['No catalogue signals detected'],
      rawScores: scores,
    };
  }

  // Determine confidence level
  let confidence;
  if (topScore >= 3 && topScore >= secondScore * 2) {
    confidence = 'high';
  } else if (topScore >= 2 || topScore >= secondScore * 1.5) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    detected: topType,
    confidence,
    signals,
    rawScores: scores,
  };
}

/**
 * Get all catalogue options for dropdown/selection UI
 * @returns {Array<{value: string, label: string}>}
 */
export function getCatalogueOptions() {
  return [
    { value: 'eCQM', label: 'eCQM' },
    { value: 'MIPS_CQM', label: 'MIPS CQM' },
    { value: 'HEDIS', label: 'HEDIS' },
    { value: 'QOF', label: 'QOF' },
    { value: 'Clinical_Standard', label: 'Clinical Standard' },
    { value: 'Custom', label: 'Custom' },
  ];
}
