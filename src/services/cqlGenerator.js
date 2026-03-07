/**
 * CQL Generator Service
 *
 * Generates Clinical Quality Language (CQL) from Universal Measure Spec (UMS).
 * Supports FHIR R4, QI-Core profiles, and eCQM standards.
 *
 * Features:
 * - Full CQL library generation with proper structure
 * - Value set declarations with VSAC OIDs
 * - Population definitions (IP, Denominator, Exclusions, Numerator)
 * - Helper definitions for common patterns
 * - CQL validation via CQL Services API (optional)
 */

             
                       
                       
                
              
                    
                    
                      

import {
  generateCQLFromTree,
  isLogicalClause,
} from './logicTreeUtils';

import {
  escapeIdentifier,
  validateLibraryName,
  intervalTemplate,
  existsQueryTemplate,
  defineTemplate,
  combineExpressionsTemplate,
  libraryHeaderTemplate,
  valueSetDeclarationsTemplate,
  parametersTemplate,
  supplementalDataTemplate,
  crcScreeningTemplates,
  cervicalScreeningTemplates,
  breastScreeningTemplates,
  ageAtEndOfMPTemplate,
  ageRangeCheckTemplate,
  genderCheckTemplate,
  hospiceCheckTemplate,
  STANDARD_INCLUDES,
  STANDARD_CODE_SYSTEMS,
} from './cqlTemplates';

// ============================================================================
// Types
// ============================================================================

;                                     
                   
              
                    
                      
             
                        
                    
                            
                          
                            
    
 

;                                     
                 
                               
                                   
                                                  
 

;                                    
                    
                  
                
                  
                     
 

;                                      
                      
                  
                
                  
 

// ============================================================================
// Main CQL Generation
// ============================================================================

/**
 * Generate complete CQL library from a UMS measure
 */
export function generateCQL(measure                      )                      {
  const errors           = [];
  const warnings           = [];

  try {
    // Validate minimum requirements
    if (!measure.metadata.measureId) {
      errors.push('Measure ID is required');
    }
    if (!measure.populations || measure.populations.length === 0) {
      errors.push('At least one population definition is required');
    }

    if (errors.length > 0) {
      return {
        success: false,
        cql: '',
        errors,
        warnings,
        metadata: {
          libraryName: '',
          version: '',
          populationCount: 0,
          valueSetCount: 0,
          definitionCount: 0,
        },
      };
    }

    // Generate library name from measure ID
    const libraryName = sanitizeLibraryName(measure.metadata.measureId);
    const version = measure.metadata.version || '1.0.0';

    // Generate CQL sections
    const header = generateHeader(measure, libraryName, version);
    const valueSets = generateValueSetDeclarations(measure.valueSets, warnings);
    const parameters = generateParameters(measure);
    const helperDefinitions = generateHelperDefinitions(measure);
    const populationDefinitions = generatePopulationDefinitions(measure);
    const supplementalData = generateSupplementalData(measure);

    // Assemble complete CQL
    const cql = [
      header,
      valueSets,
      parameters,
      'context Patient\n',
      helperDefinitions,
      populationDefinitions,
      supplementalData,
    ]
      .filter(Boolean)
      .join('\n');

    // Count definitions
    const definitionCount = (cql.match(/^define\s+"/gm) || []).length;

    return {
      success: true,
      cql,
      warnings,
      metadata: {
        libraryName,
        version,
        populationCount: measure.populations?.length ?? 0,
        valueSetCount: measure.valueSets?.length ?? 0,
        definitionCount,
      },
    };
  } catch (err) {
    return {
      success: false,
      cql: '',
      errors: [err instanceof Error ? err.message : 'Unknown error during CQL generation'],
      warnings,
      metadata: {
        libraryName: '',
        version: '',
        populationCount: 0,
        valueSetCount: 0,
        definitionCount: 0,
      },
    };
  }
}

/**
 * Generate CQL library header
 */
function generateHeader(
  measure                      ,
  libraryName        ,
  version        
)         {
  // Generate comment block with measure metadata
  const commentLines           = [
    '/*',
    ` * Library: ${libraryName}`,
    ` * Title: ${measure.metadata.title}`,
    ` * Measure ID: ${measure.metadata.measureId}`,
    ` * Version: ${version}`,
    ` * Steward: ${measure.metadata.steward || 'Not specified'}`,
    ` * Type: ${measure.metadata.measureType || 'process'}`,
    ` * Scoring: ${measure.metadata.scoring || 'proportion'}`,
    ` *`,
    ` * Description: ${measure.metadata.description || 'No description provided'}`,
    ` *`,
    ` * Generated: ${new Date().toISOString()}`,
    ` * Generator: Insight Forge CQL Generator v1.0`,
    ' */',
    '',
  ];

  // Use template for library structure
  const headerContent = libraryHeaderTemplate({
    name: libraryName,
    version: version,
    fhirVersion: '4.0.1',
    includes: STANDARD_INCLUDES,
    codeSystems: STANDARD_CODE_SYSTEMS,
    parameters: [],
  });

  return commentLines.join('\n') + headerContent;
}

/**
 * Generate value set declarations
 * @param valueSets - Value sets to declare
 * @param warnings - Array to collect warnings about value sets with no codes
 */
function generateValueSetDeclarations(valueSets                     , warnings           = [])         {
  if (!valueSets || valueSets.length === 0) {
    return '// No value sets defined\n';
  }

  const declarations                           = [];

  for (const vs of valueSets) {
    if (!vs) continue; // Skip null/undefined entries

    const url = vs.url || (vs.oid ? `http://cts.nlm.nih.gov/fhir/ValueSet/${vs.oid}` : null);
    if (url) {
      // Check if value set has no codes defined
      const hasCodes = vs.codes && vs.codes.length > 0;
      if (!hasCodes) {
        declarations.push({
          name: vs.name,
          url,
          warning: `Value set "${vs.name}" has no codes defined - may need expansion`,
        });
        warnings.push(`Value set "${vs.name}" has no codes defined`);
      } else {
        declarations.push({
          name: vs.name,
          url,
        });
      }
    } else {
      // No OID specified - add as comment (not supported by template, handle separately)
      warnings.push(`Value set "${vs.name}" has no OID or URL specified`);
    }
  }

  // Handle value sets without OIDs by prepending comments
  const vsWithoutOid = valueSets.filter(vs => vs && !vs.url && !vs.oid);
  const commentLines = vsWithoutOid.map(vs =>
    `// valueset "${escapeIdentifier(vs.name).escaped}": 'OID_NOT_SPECIFIED'`
  );

  const templateOutput = valueSetDeclarationsTemplate(declarations);

  if (commentLines.length > 0) {
    return templateOutput + commentLines.join('\n') + '\n';
  }

  return templateOutput;
}

/**
 * Generate parameters section
 */
function generateParameters(measure                      )         {
  const currentYear = new Date().getFullYear();
  const mpStart = measure.metadata.measurementPeriod?.start || `${currentYear}-01-01`;
  const mpEnd = measure.metadata.measurementPeriod?.end || `${currentYear}-12-31`;

  return parametersTemplate([
    {
      name: 'Measurement Period',
      type: 'Interval<DateTime>',
      default: intervalTemplate({ start: mpStart, end: mpEnd, type: 'DateTime' }),
    },
  ]);
}

/**
 * Generate helper definitions used across populations
 */
function generateHelperDefinitions(measure                      )         {
  const definitions                  = [];

  // Age calculation
  const ageRange = measure.globalConstraints?.ageRange;
  if (ageRange) {
    definitions.push(ageAtEndOfMPTemplate());
    definitions.push(ageRangeCheckTemplate(ageRange.min, ageRange.max));
  }

  // Gender requirement
  const gender = measure.globalConstraints?.gender;
  if (gender && gender !== 'all') {
    definitions.push(genderCheckTemplate(gender                     ));
  }

  // Qualifying encounters helper
  const hasEncounterCriteria = measure.populations?.some(pop =>
    pop.criteria && hasDataElementType(pop.criteria, 'encounter')
  ) ?? false;
  if (hasEncounterCriteria) {
    definitions.push({
      name: 'Qualifying Encounter During Measurement Period',
      expression: `( [Encounter: "Office Visit"]
    union [Encounter: "Annual Wellness Visit"]
    union [Encounter: "Preventive Care Services Established Office Visit, 18 and Up"]
    union [Encounter: "Home Healthcare Services"]
    union [Encounter: "Online Assessments"]
    union [Encounter: "Telephone Visits"]
  ) Encounter
    where Encounter.status = 'finished'
      and Encounter.period during "Measurement Period"`,
    });
  }

  // Hospice check (common exclusion)
  definitions.push(hospiceCheckTemplate());

  // Detect measure type and add specific helpers
  const title = measure.metadata.title?.toLowerCase() || '';
  const measureId = measure.metadata.measureId?.toUpperCase() || '';

  // Colorectal cancer screening helpers
  if (title.includes('colorectal') || measureId.includes('CMS130')) {
    definitions.push(...crcScreeningTemplates());
  }

  // Cervical cancer screening helpers
  if (title.includes('cervical') || measureId.includes('CMS124')) {
    definitions.push(...cervicalScreeningTemplates());
  }

  // Breast cancer screening helpers
  if (title.includes('breast') && title.includes('screen') || measureId.includes('CMS125')) {
    definitions.push(...breastScreeningTemplates());
  }

  // Build output using defineTemplate
  const lines           = ['// Helper Definitions'];
  for (const def of definitions) {
    lines.push('');
    lines.push(defineTemplate(def));
  }

  lines.push('');
  return lines.join('\n');
}

// NOTE: Measure-specific helpers (CRC, Cervical, Breast) are now provided by
// crcScreeningTemplates, cervicalScreeningTemplates, and breastScreeningTemplates
// from cqlTemplates.ts

/**
 * Generate population definitions
 */
function generatePopulationDefinitions(measure                      )         {
  const lines           = ['// Population Definitions'];

  // Initial Population
  const ipPop = findPopulation(measure.populations, 'initial_population');
  if (ipPop) {
    lines.push(generatePopulationDefinition(ipPop, 'Initial Population', measure));
  }

  // Denominator
  const denomPop = findPopulation(measure.populations, 'denominator');
  lines.push(generateDenominatorDefinition(denomPop, measure));

  // Denominator Exclusions
  const exclPop = findPopulation(measure.populations, 'denominator_exclusion');
  lines.push(generateExclusionDefinition(exclPop, measure));

  // Denominator Exceptions
  const excepPop = findPopulation(measure.populations, 'denominator_exception');
  if (excepPop) {
    lines.push(generatePopulationDefinition(excepPop, 'Denominator Exception', measure));
  }

  // Numerator
  const numPop = findPopulation(measure.populations, 'numerator');
  lines.push(generateNumeratorDefinition(numPop, measure));

  // Numerator Exclusions
  const numExclPop = findPopulation(measure.populations, 'numerator_exclusion');
  if (numExclPop) {
    lines.push(generatePopulationDefinition(numExclPop, 'Numerator Exclusion', measure));
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Generate a single population definition
 */
function generatePopulationDefinition(
  pop                      ,
  name        ,
  measure                      
)         {
  // Generate criteria expression
  const criteriaExpr = generateCriteriaExpression(pop.criteria, measure);

  // Build comment from narrative
  const comment = pop.narrative
    ? `${name}\n${pop.narrative.substring(0, 200)}${pop.narrative.length > 200 ? '...' : ''}`
    : undefined;

  return defineTemplate({
    name,
    expression: criteriaExpr,
    comment,
  });
}

/**
 * Generate denominator definition (typically equals IP)
 */
function generateDenominatorDefinition(
  pop                             ,
  measure                      
)         {
  if (pop && pop.criteria && pop.criteria.children && pop.criteria.children.length > 0) {
    // Has explicit denominator criteria
    return generatePopulationDefinition(pop, 'Denominator', measure);
  }

  // Default: Denominator equals Initial Population
  return defineTemplate({
    name: 'Denominator',
    expression: '"Initial Population"',
    comment: 'Denominator\nEquals Initial Population',
  });
}

/**
 * Generate exclusion definition with common patterns
 */
function generateExclusionDefinition(
  pop                             ,
  measure                      
)         {
  const exclusionCriteria           = [];

  // Always include hospice
  exclusionCriteria.push('"Has Hospice Services"');

  // Add measure-specific exclusions
  const title = measure.metadata.title?.toLowerCase() || '';
  const measureId = measure.metadata.measureId?.toUpperCase() || '';

  if (title.includes('colorectal') || measureId.includes('CMS130')) {
    exclusionCriteria.push('"Has Colorectal Cancer"');
    exclusionCriteria.push('"Has Total Colectomy"');
  }

  if (title.includes('cervical') || measureId.includes('CMS124')) {
    exclusionCriteria.push('"Has Hysterectomy"');
    exclusionCriteria.push('"Absence of Cervix Diagnosis"');
  }

  if (title.includes('breast') && title.includes('screen') || measureId.includes('CMS125')) {
    exclusionCriteria.push('"Has Bilateral Mastectomy"');
    exclusionCriteria.push('("Has Unilateral Mastectomy Left" and "Has Unilateral Mastectomy Right")');
  }

  // Add custom exclusions from population criteria
  if (pop && pop.criteria && pop.criteria.children && pop.criteria.children.length > 0) {
    const customExpr = generateCriteriaExpression(pop.criteria, measure);
    if (customExpr !== 'true' && customExpr !== 'false') {
      exclusionCriteria.push(`(${customExpr})`);
    }
  }

  const expression = combineExpressionsTemplate(exclusionCriteria, 'or');

  return defineTemplate({
    name: 'Denominator Exclusion',
    expression,
    comment: `Denominator Exclusion\n${pop?.narrative || 'Patients meeting exclusion criteria'}`,
  });
}

/**
 * Generate numerator definition
 */
function generateNumeratorDefinition(
  pop                             ,
  measure                      
)         {
  const title = measure.metadata.title?.toLowerCase() || '';
  const measureId = measure.metadata.measureId?.toUpperCase() || '';
  const comment = `Numerator\n${pop?.narrative || 'Patients meeting numerator criteria'}`;

  // Measure-specific numerator logic
  // Note: Helper definitions like "Colonoscopy Performed" already include exists,
  // so we reference them directly as boolean expressions
  if (title.includes('colorectal') || measureId.includes('CMS130')) {
    const crcNumerator = [
      '"Colonoscopy Performed"',
      '"Fecal Occult Blood Test Performed"',
      '"Flexible Sigmoidoscopy Performed"',
      '"FIT DNA Test Performed"',
      '"CT Colonography Performed"',
    ];
    return defineTemplate({
      name: 'Numerator',
      expression: combineExpressionsTemplate(crcNumerator, 'or'),
      comment,
    });
  }

  if (title.includes('cervical') || measureId.includes('CMS124')) {
    const cervicalNumerator = [
      '"Cervical Cytology Within 3 Years"',
      '(AgeInYearsAt(date from end of "Measurement Period") >= 30\n        and "HPV Test Within 5 Years")',
    ];
    return defineTemplate({
      name: 'Numerator',
      expression: combineExpressionsTemplate(cervicalNumerator, 'or'),
      comment,
    });
  }

  if (title.includes('breast') && title.includes('screen') || measureId.includes('CMS125')) {
    return defineTemplate({
      name: 'Numerator',
      expression: '"Mammography Within 27 Months"',
      comment,
    });
  }

  // Generic numerator from criteria
  if (pop && pop.criteria) {
    const criteriaExpr = generateCriteriaExpression(pop.criteria, measure);
    return defineTemplate({
      name: 'Numerator',
      expression: criteriaExpr,
      comment,
    });
  }

  // No numerator criteria defined - generate placeholder with warning comment
  return defineTemplate({
    name: 'Numerator',
    expression: '/* WARNING: No numerator criteria defined in measure specification */\n  true',
    comment,
  });
}

/**
 * Generate supplemental data definitions
 */
function generateSupplementalData(_measure                      )         {
  return supplementalDataTemplate();
}

/**
 * Generate CQL expression from criteria
 *
 * Uses generateCQLFromTree from logicTreeUtils for complex nested boolean logic
 * (e.g., A AND (B OR C)), falling back to simple flat joining for non-nested criteria.
 */
function generateCriteriaExpression(
  criteria               ,
  measure                      ,
  indent         = 0
)         {
  if (!criteria || !criteria.children || criteria.children.length === 0) {
    return 'true';
  }

  // Check if we have complex nested logic that requires tree-based generation
  const hasNestedClauses = criteria.children.some(child => isLogicalClause(child));
  const hasMixedOperators = criteria.siblingConnections && criteria.siblingConnections.length > 0;

  // Use tree-based generator for complex boolean logic (A AND (B OR C))
  if (hasNestedClauses || hasMixedOperators) {
    const getCriterionCQL = (element             ) => generateDataElementExpression(element, measure);
    return generateCQLFromTree(criteria, getCriterionCQL);
  }

  // Fall back to simple flat approach for non-nested criteria
  const expressions           = [];

  for (const child of criteria.children) {
    // At this point, all children should be DataElements (not nested clauses)
    const expr = generateDataElementExpression(child               , measure);
    expressions.push(expr);
  }

  if (expressions.length === 0) {
    return 'true';
  }

  const operator = criteria.operator === 'OR' ? 'or' : 'and';
  return combineExpressionsTemplate(expressions, operator, indent);
}

/**
 * Generate HEDIS metadata comment for data elements with hedis block
 */
function generateHedisComment(element             )         {
  if (!element.hedis?.collectionType) {
    return '';
  }
  const collectionType = element.hedis.collectionType;
  const hybridFlag = element.hedis.hybridSourceFlag ? ', Hybrid Source' : '';
  return `/* HEDIS Collection: ${collectionType}${hybridFlag} */\n  `;
}

/**
 * Generate CQL expression for a data element
 */
function generateDataElementExpression(
  element             ,
  _measure
)         {
  if (!element) {
    return '/* WARNING: Null data element encountered */\n  true';
  }

  // Generate HEDIS comment prefix if applicable
  const hedisComment = generateHedisComment(element);

  // Handle missing valueSet gracefully
  const hasValueSet = element.valueSet?.name || element.valueSet?.id;
  if (!hasValueSet && element.type !== 'demographic') {
    // No value set specified for a non-demographic element
    const desc = element.description || `${element.type} criterion`;
    return `${hedisComment}/* WARNING: No value set defined for "${desc}" */\n  true`;
  }

  const vsName = element.valueSet?.name || 'Unspecified Value Set';

  // Map element type to FHIR resource type and alias
  const resourceTypeMap                                                                   = {
    diagnosis: { resourceType: 'Condition', alias: 'C' },
    encounter: { resourceType: 'Encounter', alias: 'E' },
    procedure: { resourceType: 'Procedure', alias: 'P' },
    observation: { resourceType: 'Observation', alias: 'O' },
    medication: { resourceType: 'MedicationRequest', alias: 'M' },
    immunization: { resourceType: 'Immunization', alias: 'I' },
  };

  switch (element.type) {
    case 'demographic':
      return hedisComment + generateDemographicExpression(element);

    case 'diagnosis':
    case 'encounter':
    case 'procedure':
    case 'immunization': {
      const config = resourceTypeMap[element.type];
      const timing = generateTimingExpression(element.timingRequirements, config.alias, config.resourceType);
      return hedisComment + existsQueryTemplate({
        resourceType: config.resourceType,
        valueSet: vsName,
        alias: config.alias,
        timingExpression: timing,
      });
    }

    case 'observation': {
      const timing = generateTimingExpression(element.timingRequirements, 'O', 'Observation');
      return hedisComment + existsQueryTemplate({
        resourceType: 'Observation',
        valueSet: vsName,
        alias: 'O',
        additionalCriteria: ['O.value is not null'],
        timingExpression: timing,
      });
    }

    case 'medication': {
      const timing = generateTimingExpression(element.timingRequirements, 'M', 'MedicationRequest');
      return hedisComment + existsQueryTemplate({
        resourceType: 'MedicationRequest',
        valueSet: vsName,
        alias: 'M',
        timingExpression: timing,
      });
    }

    default:
      return hedisComment + `// TODO: ${element.description || 'Unknown criterion'}`;
  }
}

/**
 * Generate demographic expression
 * Handles both age thresholds and patient sex checks
 */
function generateDemographicExpression(element             )         {
  // Handle patient sex check
  if (element.genderValue) {
    return `Patient.gender = '${element.genderValue}'`;
  }

  // Handle age thresholds
  if (element.thresholds) {
    const { ageMin, ageMax } = element.thresholds;
    if (ageMin !== undefined || ageMax !== undefined) {
      const min = ageMin ?? 0;
      const max = ageMax ?? 999;
      return `AgeInYearsAt(date from end of "Measurement Period") in Interval[${min}, ${max}]`;
    }
  }

  return '"Patient Age Valid"';
}

/**
 * Get the timing attribute for a FHIR resource type
 */
function getTimingAttribute(resourceType                 )         {
  const timingAttributes                                  = {
    Procedure: 'performed',
    Observation: 'effective',
    Encounter: 'period',
    Condition: 'onset',
    MedicationRequest: 'authoredOn',
    MedicationAdministration: 'effective',
    Immunization: 'occurrence',
    DiagnosticReport: 'effective',
    ServiceRequest: 'authoredOn',
    CarePlan: 'period',
    Goal: 'start',
    AllergyIntolerance: 'onset',
    FamilyMemberHistory: 'date',
  };
  return timingAttributes[resourceType] || 'performed';
}

/**
 * Generate timing expression from timing requirements
 * Returns the timing clause without leading "and" - caller is responsible for conjunction
 */
function generateTimingExpression(
  timing                      ,
  alias         ,
  resourceType                  
)         {
  const timingAttr = resourceType ? getTimingAttribute(resourceType) : 'performed';
  const attr = alias ? `${alias}.${timingAttr}` : timingAttr;

  if (!timing || timing.length === 0) {
    return `${attr} during "Measurement Period"`;
  }

  const req = timing[0];
  const window = req.window;

  if (!window) {
    return `${attr} during "Measurement Period"`;
  }

  const { value, unit, direction } = window;
  const unitPlural = value === 1 ? unit.replace(/s$/, '') : unit;

  if (direction === 'before') {
    return `${attr} ends ${value} ${unitPlural} or less before end of "Measurement Period"`;
  } else if (direction === 'after') {
    return `${attr} starts ${value} ${unitPlural} or less after start of "Measurement Period"`;
  } else {
    return `${attr} during "Measurement Period"`;
  }
}

// ============================================================================
// CQL Validation via CQL Services API
// ============================================================================

/**
 * Validate CQL syntax and translate to ELM
 *
 * Requires CQL Services API to be running (default: http://localhost:8080)
 *
 * @param cql - CQL code to validate
 * @param serviceUrl - URL of CQL Services API (defaults to localhost:8080)
 */
export async function validateCQL(
  cql        ,
  serviceUrl         = 'http://localhost:8080'
)                               {
  try {
    const response = await fetch(`${serviceUrl}/cql/translator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/cql',
        Accept: 'application/elm+json',
      },
      body: cql,
    });

    if (!response.ok) {
      // Parse error response
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        return {
          valid: false,
          errors: parseTranslatorErrors(errorData),
          warnings: parseTranslatorWarnings(errorData),
        };
      } catch {
        return {
          valid: false,
          errors: [{ severity: 'error', message: `Translation failed: ${errorText}` }],
          warnings: [],
        };
      }
    }

    const elm = await response.text();
    const elmJson = JSON.parse(elm);

    // Check for annotation errors/warnings in ELM
    const annotations = elmJson?.library?.annotation || [];
    const errors = annotations
      .filter((a     ) => a.errorSeverity === 'error')
      .map((a     ) => ({
        severity: 'error'         ,
        message: a.message,
        line: a.locator?.start?.line,
        column: a.locator?.start?.column,
        errorType: a.errorType,
      }));

    const warnings = annotations
      .filter((a     ) => a.errorSeverity === 'warning')
      .map((a     ) => ({
        severity: 'warning'         ,
        message: a.message,
        line: a.locator?.start?.line,
        column: a.locator?.start?.column,
      }));

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      elm: errors.length === 0 ? elm : undefined,
    };
  } catch (err) {
    // Handle connection errors
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return {
        valid: false,
        errors: [
          {
            severity: 'error',
            message: `Cannot connect to CQL Services at ${serviceUrl}. Ensure the service is running.`,
          },
        ],
        warnings: [],
      };
    }

    return {
      valid: false,
      errors: [
        {
          severity: 'error',
          message: err instanceof Error ? err.message : 'Unknown validation error',
        },
      ],
      warnings: [],
    };
  }
}

/**
 * Check if CQL Services API is available
 */
export async function isCQLServiceAvailable(
  serviceUrl         = 'http://localhost:8080'
)                   {
  try {
    const response = await fetch(`${serviceUrl}/cql/translator`, {
      method: 'HEAD',
    });
    return response.status !== 404;
  } catch {
    return false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sanitize measure ID for use as CQL library name
 * Uses validateLibraryName from cqlTemplates for consistency
 */
function sanitizeLibraryName(measureId        )         {
  return validateLibraryName(measureId);
}

// NOTE: sanitizeIdentifier is now provided by escapeIdentifier from cqlTemplates.ts
// Usage: escapeIdentifier(name).escaped

/**
 * Find population by type (handles both kebab-case and underscore formats)
 */
function findPopulation(
  populations                        ,
  type        
)                              {
  const typeVariants                           = {
    initial_population: ['initial_population', 'initial-population'],
    denominator: ['denominator'],
    denominator_exclusion: ['denominator_exclusion', 'denominator-exclusion'],
    denominator_exception: ['denominator_exception', 'denominator-exception'],
    numerator: ['numerator'],
    numerator_exclusion: ['numerator_exclusion', 'numerator-exclusion'],
  };

  const variants = typeVariants[type] || [type];
  return populations.find(p => variants.includes(p.type)) || null;
}

/**
 * Check if criteria contains a specific data element type
 */
function hasDataElementType(criteria               , type        )          {
  if (!criteria || !criteria.children) return false;

  for (const child of criteria.children) {
    if ('operator' in child) {
      if (hasDataElementType(child                 , type)) return true;
    } else {
      if ((child               ).type === type) return true;
    }
  }

  return false;
}

/**
 * Parse translator errors from response
 */
function parseTranslatorErrors(data     )                       {
  if (Array.isArray(data)) {
    return data
      .filter(item => item.severity === 'error')
      .map(item => ({
        severity: 'error'         ,
        message: item.message || 'Unknown error',
        line: item.line,
        column: item.column,
        errorType: item.errorType,
      }));
  }

  if (data.errorExceptions) {
    return data.errorExceptions.map((e     ) => ({
      severity: 'error'         ,
      message: e.message || 'Translation error',
      line: e.startLine,
      column: e.startChar,
    }));
  }

  return [{ severity: 'error', message: data.message || 'Unknown error' }];
}

/**
 * Parse translator warnings from response
 */
function parseTranslatorWarnings(data     )                         {
  if (Array.isArray(data)) {
    return data
      .filter(item => item.severity === 'warning')
      .map(item => ({
        severity: 'warning'         ,
        message: item.message || 'Warning',
        line: item.line,
        column: item.column,
      }));
  }

  return [];
}

