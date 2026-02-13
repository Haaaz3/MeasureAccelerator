/**
 * FHIR Code System URIs
 *
 * Standard URIs for healthcare terminology systems as defined by HL7 FHIR.
 * These align with US Core / CURES FHIR profiles.
 */

// Diagnosis code systems
export const ICD10CM = 'http://hl7.org/fhir/sid/icd-10-cm';
export const SNOMEDCT = 'http://snomed.info/sct';

// Procedure code systems
export const CPT = 'http://www.ama-assn.org/go/cpt';
export const HCPCS = 'https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets';
export const ICD10PCS = 'http://www.cms.gov/Medicare/Coding/ICD10';

// Observation code systems
export const LOINC = 'http://loinc.org';

// Medication code systems
export const RXNORM = 'http://www.nlm.nih.gov/research/umls/rxnorm';
export const NDC = 'http://hl7.org/fhir/sid/ndc';

// Immunization code systems
export const CVX = 'http://hl7.org/fhir/sid/cvx';

// Administrative/Demographic code systems
export const ADMINISTRATIVE_GENDER = 'http://hl7.org/fhir/administrative-gender';

// All code systems for reference
export const FHIR_CODE_SYSTEMS = {
  ICD10CM,
  SNOMEDCT,
  CPT,
  HCPCS,
  ICD10PCS,
  LOINC,
  RXNORM,
  NDC,
  CVX,
  ADMINISTRATIVE_GENDER,
} as const;

/**
 * Map short names to full FHIR URIs
 */
export const CODE_SYSTEM_MAP: Record<string, string> = {
  'ICD10': ICD10CM,
  'ICD10CM': ICD10CM,
  'ICD-10': ICD10CM,
  'ICD-10-CM': ICD10CM,
  'SNOMED': SNOMEDCT,
  'SNOMEDCT': SNOMEDCT,
  'SCT': SNOMEDCT,
  'CPT': CPT,
  'HCPCS': HCPCS,
  'LOINC': LOINC,
  'RxNorm': RXNORM,
  'RXNORM': RXNORM,
  'CVX': CVX,
  'NDC': NDC,
  'AdministrativeGender': ADMINISTRATIVE_GENDER,
  'administrative-gender': ADMINISTRATIVE_GENDER,
};

/**
 * Get display name for a code system URI
 */
export function getCodeSystemDisplayName(uri: string): string {
  switch (uri) {
    case ICD10CM:
      return 'ICD-10-CM';
    case SNOMEDCT:
      return 'SNOMED CT';
    case CPT:
      return 'CPT';
    case HCPCS:
      return 'HCPCS';
    case ICD10PCS:
      return 'ICD-10-PCS';
    case LOINC:
      return 'LOINC';
    case RXNORM:
      return 'RxNorm';
    case NDC:
      return 'NDC';
    case CVX:
      return 'CVX';
    case ADMINISTRATIVE_GENDER:
      return 'Administrative Gender';
    default:
      // If it's a short name, return as-is
      if (!uri.startsWith('http')) {
        return uri;
      }
      // Extract last path segment for unknown URIs
      return uri.split('/').pop() || uri;
  }
}

/**
 * Normalize any code system identifier to the full FHIR URI
 */
export function toFhirUri(system: string): string {
  // Already a full URI
  if (system.startsWith('http')) {
    return system;
  }
  // Map short name to URI
  return CODE_SYSTEM_MAP[system.toUpperCase()] || CODE_SYSTEM_MAP[system] || system;
}

/**
 * Check if two code systems are equivalent
 */
export function codeSystemsMatch(system1: string, system2: string): boolean {
  const uri1 = toFhirUri(system1);
  const uri2 = toFhirUri(system2);
  return uri1.toLowerCase() === uri2.toLowerCase();
}
