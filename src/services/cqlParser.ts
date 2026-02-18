/**
 * CQL Parser
 *
 * Deterministic parser for extracting value sets and codes from CQL content.
 * This bypasses the LLM for reliable extraction of:
 * - Value set declarations (OID + name)
 * - Code declarations (code + system + display)
 * - Code system declarations
 */

export interface ParsedValueSet {
  name: string;
  oid: string;
  version?: string;
}

export interface ParsedCode {
  name: string;
  code: string;
  system: string;
  systemOid?: string;
  display?: string;
}

export interface ParsedCodeSystem {
  name: string;
  oid: string;
}

export interface CqlParseResult {
  valueSets: ParsedValueSet[];
  codes: ParsedCode[];
  codeSystems: ParsedCodeSystem[];
}

/**
 * Parse CQL content to extract value sets, codes, and code systems.
 */
export function parseCqlContent(cqlContent: string): CqlParseResult {
  const valueSets: ParsedValueSet[] = [];
  const codes: ParsedCode[] = [];
  const codeSystems: ParsedCodeSystem[] = [];

  // Build code system lookup for resolving code references
  const codeSystemLookup: Record<string, string> = {};

  // Pattern: codesystem "Name": 'urn:oid:...'
  // Example: codesystem "SNOMEDCT": 'urn:oid:2.16.840.1.113883.6.96'
  const codeSystemRegex = /codesystem\s+"([^"]+)":\s*'([^']+)'/gi;
  let match: RegExpExecArray | null;

  while ((match = codeSystemRegex.exec(cqlContent)) !== null) {
    const name = match[1];
    const oidOrUrl = match[2];
    const oid = extractOid(oidOrUrl);
    codeSystems.push({ name, oid: oid || oidOrUrl });
    codeSystemLookup[name] = oid || oidOrUrl;
  }

  // Pattern: valueset "Name": 'urn:oid:...' [version 'x.x.x']
  // Example: valueset "DTaP Vaccine": 'urn:oid:2.16.840.1.113883.3.464.1003.196.12.1214'
  const valueSetRegex = /valueset\s+"([^"]+)":\s*'([^']+)'(?:\s+version\s+'([^']+)')?/gi;

  while ((match = valueSetRegex.exec(cqlContent)) !== null) {
    const name = match[1];
    const oidOrUrl = match[2];
    const version = match[3];
    const oid = extractOid(oidOrUrl);
    valueSets.push({
      name,
      oid: oid || oidOrUrl,
      version,
    });
  }

  // Pattern: code "Name": 'CODE' from "SystemName" [display 'Display Text']
  // Example: code "Anaphylaxis caused by rotavirus vaccine (disorder)": '428331000124103' from "SNOMEDCT" display 'Anaphylaxis caused by rotavirus vaccine'
  const codeRegex = /code\s+"([^"]+)":\s*'([^']+)'\s+from\s+"([^"]+)"(?:\s+display\s+'([^']*)')?/gi;

  while ((match = codeRegex.exec(cqlContent)) !== null) {
    const name = match[1];
    const code = match[2];
    const systemName = match[3];
    const display = match[4];

    codes.push({
      name,
      code,
      system: systemName,
      systemOid: codeSystemLookup[systemName],
      display: display || name,
    });
  }

  return { valueSets, codes, codeSystems };
}

/**
 * Extract OID from a URN string.
 * Input: 'urn:oid:2.16.840.1.113883.3.464.1003.196.12.1214'
 * Output: '2.16.840.1.113883.3.464.1003.196.12.1214'
 */
function extractOid(urn: string): string | null {
  const match = urn.match(/urn:oid:([\d.]+)/i);
  return match ? match[1] : null;
}

/**
 * Map system name to standard code system identifier.
 */
export function normalizeCodeSystem(systemName: string): string {
  const systemMap: Record<string, string> = {
    'SNOMEDCT': 'SNOMED',
    'SNOMED': 'SNOMED',
    'SNOMED-CT': 'SNOMED',
    'ICD10CM': 'ICD10',
    'ICD-10-CM': 'ICD10',
    'ICD10': 'ICD10',
    'ICD-10': 'ICD10',
    'ICD9CM': 'ICD9',
    'ICD-9-CM': 'ICD9',
    'CPT': 'CPT',
    'CPT-4': 'CPT',
    'HCPCS': 'HCPCS',
    'LOINC': 'LOINC',
    'CVX': 'CVX',
    'RXNORM': 'RxNorm',
    'RxNorm': 'RxNorm',
    'NDC': 'NDC',
    'UCUM': 'UCUM',
    'AdministrativeGender': 'AdministrativeGender',
  };
  return systemMap[systemName.toUpperCase()] || systemMap[systemName] || systemName;
}

/**
 * Parse all CQL content from a combined document string.
 * Looks for CQL code blocks and CQL file content.
 */
export function parseCqlFromDocument(documentContent: string): CqlParseResult {
  const allResults: CqlParseResult = {
    valueSets: [],
    codes: [],
    codeSystems: [],
  };

  // Look for CQL file content marked with === filename.cql === headers
  const cqlSections = documentContent.split(/===\s+[^=]+\.cql\s+===/i);

  for (const section of cqlSections) {
    // Check if this section contains CQL content
    if (section.includes('valueset "') || section.includes('code "') || section.includes('codesystem "')) {
      const result = parseCqlContent(section);
      allResults.valueSets.push(...result.valueSets);
      allResults.codes.push(...result.codes);
      allResults.codeSystems.push(...result.codeSystems);
    }
  }

  // Also look for CQL in markdown code blocks
  const codeBlockRegex = /```(?:cql)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(documentContent)) !== null) {
    const blockContent = match[1];
    if (blockContent.includes('valueset "') || blockContent.includes('code "')) {
      const result = parseCqlContent(blockContent);
      allResults.valueSets.push(...result.valueSets);
      allResults.codes.push(...result.codes);
      allResults.codeSystems.push(...result.codeSystems);
    }
  }

  // Dedupe by name
  const seenValueSets = new Set<string>();
  allResults.valueSets = allResults.valueSets.filter(vs => {
    if (seenValueSets.has(vs.name)) return false;
    seenValueSets.add(vs.name);
    return true;
  });

  const seenCodes = new Set<string>();
  allResults.codes = allResults.codes.filter(c => {
    const key = `${c.system}:${c.code}`;
    if (seenCodes.has(key)) return false;
    seenCodes.add(key);
    return true;
  });

  return allResults;
}

export default {
  parseCqlContent,
  parseCqlFromDocument,
  normalizeCodeSystem,
};
