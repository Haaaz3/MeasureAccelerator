/**
 * Deterministic parser for eCQM HTML specification files.
 * Extracts codes, value sets, and data element mappings from
 * the standardized "Terminology" and "Data Criteria" sections.
 *
 * This is the PRIMARY source of code data — more reliable than LLM extraction
 * because the HTML format is standardized across all eCQM specs.
 */

export interface ParsedDirectCode {
  display: string;
  system: string;  // SNOMEDCT, CVX, ICD10PCS, CPT, LOINC, HCPCS, etc.
  code: string;
}

export interface ParsedValueSet {
  name: string;
  oid: string;
}

export interface DataElementMapping {
  /** Full description like "Diagnosis: Hepatitis A" or "Immunization, Administered: DTaP Vaccine" */
  fullDescription: string;
  /** The QDM data type: Diagnosis, Encounter, Immunization, Procedure, Assessment, etc. */
  dataType: string;
  /** The specific description after the colon */
  description: string;
  /** Value set name if mapped to a value set */
  valueSetName?: string;
  /** Value set OID if mapped to a value set */
  valueSetOid?: string;
  /** Direct code value if mapped to an individual code */
  directCode?: string;
  /** Direct code system if mapped to an individual code */
  directCodeSystem?: string;
  /** Direct code display name */
  directCodeDisplay?: string;
}

export interface HtmlSpecParseResult {
  codes: ParsedDirectCode[];
  valueSets: ParsedValueSet[];
  dataElementMappings: DataElementMapping[];
}

export function parseHtmlSpec(htmlOrText: string): HtmlSpecParseResult {
  const codes: ParsedDirectCode[] = [];
  const valueSets: ParsedValueSet[] = [];
  const dataElementMappings: DataElementMapping[] = [];

  // Strip HTML tags to get clean text (the HTML content may arrive as raw HTML or pre-extracted text)
  const text = htmlOrText.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

  // ============================================================
  // PARSE TERMINOLOGY SECTION — codes and value sets
  // ============================================================

  // Match code declarations:
  // code "Display Name" ("SYSTEM Code (CODE_VALUE)")
  // Variations:
  //   code "Anaphylaxis caused by rotavirus vaccine (disorder)" ("SNOMEDCT Code (428331000124103)")
  //   code "rotavirus, live, monovalent vaccine" ("CVX Code (119)")
  //   code "Hospice care [Minimum Data Set]" ("LOINC Code (45755-6)")
  //   code "Office or other outpatient visit..." ("CPT Code (99211)")
  const codeRegex = /code\s+"([^"]+)"\s+\("?(\w+)\s+Code\s+\(?([^)"]+)\)?"?\)/gi;
  let match;
  while ((match = codeRegex.exec(text)) !== null) {
    codes.push({
      display: match[1].trim(),
      system: match[2].trim().toUpperCase(),
      code: match[3].trim(),
    });
  }

  // Match valueset declarations:
  // valueset "Name" (OID)
  // e.g.: valueset "DTaP Vaccine" (2.16.840.1.113883.3.464.1003.196.12.1214)
  const valueSetRegex = /valueset\s+"([^"]+)"\s+\(([0-9][0-9.]+)\)/gi;
  while ((match = valueSetRegex.exec(text)) !== null) {
    valueSets.push({
      name: match[1].trim(),
      oid: match[2].trim(),
    });
  }

  // ============================================================
  // PARSE DATA CRITERIA SECTION — data element → value set/code mappings
  // ============================================================

  // Match data element mappings with OID (value set reference):
  // "TYPE: Description" using "VS Name (OID)"
  // e.g.: "Diagnosis: Hepatitis A" using "Hepatitis A (2.16.840.1.113883.3.464.1003.110.12.1024)"
  const dataElementVsRegex = /"([^"]+?):\s+([^"]+)"\s+using\s+"([^"]+)\s+\(([0-9][0-9.]+)\)"/gi;
  while ((match = dataElementVsRegex.exec(text)) !== null) {
    dataElementMappings.push({
      fullDescription: `${match[1].trim()}: ${match[2].trim()}`,
      dataType: match[1].trim().replace(/,\s*(Performed|Administered|Order|Active|Recommended)$/i, ''),
      description: match[2].trim(),
      valueSetName: match[3].trim(),
      valueSetOid: match[4].trim(),
    });
  }

  // Match data element mappings with direct code (no OID):
  // "TYPE: Description" using "Display (SYSTEM Code CODE)"
  // e.g.: "Diagnosis: Anaphylaxis..." using "Anaphylaxis... (SNOMEDCT Code 428331000124103)"
  const dataElementCodeRegex = /"([^"]+?):\s+([^"]+)"\s+using\s+"([^"]+)\s+\((\w+)\s+Code\s+([^)]+)\)"/gi;
  while ((match = dataElementCodeRegex.exec(text)) !== null) {
    // Skip if already matched as value set mapping
    const desc = `${match[1].trim()}: ${match[2].trim()}`;
    if (!dataElementMappings.find(m => m.fullDescription === desc)) {
      dataElementMappings.push({
        fullDescription: desc,
        dataType: match[1].trim().replace(/,\s*(Performed|Administered|Order|Active|Recommended)$/i, ''),
        description: match[2].trim(),
        directCodeDisplay: match[3].trim(),
        directCodeSystem: match[4].trim().toUpperCase(),
        directCode: match[5].trim(),
      });
    }
  }

  console.log(`[htmlSpecParser] Extracted ${codes.length} codes, ${valueSets.length} value sets, ${dataElementMappings.length} data element mappings`);

  return { codes, valueSets, dataElementMappings };
}

export default {
  parseHtmlSpec,
};
