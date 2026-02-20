/**
 * Measure Evaluator Service
 *
 * Dynamically evaluates test patients against measure criteria
 * to generate validation traces for any measure in the UMS format.
 */

             
                       
                       
                
              
                         
                 
                 
                
                    
                 
                       
                   
                  
                      
import { getEffectiveTiming, getEffectiveWindow, getOperatorBetween } from '../types/ums';
import { resolveTimingWindow,                     } from '../utils/timingResolver';
// ============================================================================
// Test Patient Data Types
// ============================================================================

;                             
             
               
                 
                                  
                                        
                  
                       
    
                                
                                 
                                 
                                     
                                   
                                        
 

;                                  
               
                 
                  
                    
                                             
 

;                                  
               
                 
                  
               
               
 

;                                  
               
                 
                  
               
 

;                                    
               
                 
                  
               
                 
                
                       
 

;                                   
               
                 
                  
                    
                   
                                             
 

;                                     
               
                 
                  
               
                                   
 

// ============================================================================
// Main Evaluation Function
// ============================================================================

/**
 * Detect if a measure is for cervical cancer screening based on title/ID
 */
function isCervicalCancerMeasure(measure                      )          {
  const title = measure.metadata.title?.toLowerCase() || '';
  const measureId = measure.metadata.measureId?.toUpperCase() || '';

  return title.includes('cervical') ||
         title.includes('cervix') ||
         title.includes('pap smear') ||
         title.includes('pap test') ||
         measureId.includes('CMS124') || // Cervical Cancer Screening
         measureId.includes('CCS');
}

/**
 * Detect if a measure is for childhood immunizations based on title/ID
 */
function isChildhoodImmunizationMeasure(measure                      )          {
  const title = measure.metadata.title?.toLowerCase() || '';
  const measureId = measure.metadata.measureId?.toUpperCase() || '';

  return title.includes('childhood immun') ||
         title.includes('childhood vaccin') ||
         title.includes('immunization status') ||
         title.includes('child immun') ||
         (title.includes('immun') && title.includes('child')) ||
         measureId.includes('CMS117') || // Childhood Immunization Status
         measureId.includes('CIS');
}

/**
 * Detect if a measure is for colorectal cancer screening
 */
function isColorectalCancerMeasure(measure                      )          {
  const title = measure.metadata.title?.toLowerCase() || '';
  const measureId = measure.metadata.measureId?.toUpperCase() || '';

  return title.includes('colorectal') ||
         title.includes('colon cancer') ||
         title.includes('crc screening') ||
         measureId.includes('CMS130') ||
         measureId.includes('COL');
}

/**
 * Detect if a measure is for breast cancer screening
 */
function isBreastCancerMeasure(measure                      )          {
  const title = measure.metadata.title?.toLowerCase() || '';
  const measureId = measure.metadata.measureId?.toUpperCase() || '';

  return (title.includes('breast') && title.includes('screen')) ||
         title.includes('mammogra') ||
         measureId.includes('CMS125') ||
         measureId.includes('BCS');
}

/**
 * Get the required age range for a measure based on its type
 * Returns null if no specific age requirement can be determined
 */
;                      
                 
                 
                      
                                                       
  

/** Parse an age range from free text. Returns [min, max] or null. */
function parseAgeRangeFromText(text        )                                      {
  if (!text) return null;
  const lower = text.toLowerCase();

  // "Age 45-75", "Age 45 to 75", "ages 45 through 75", "age between 45 and 75"
  const rangeMatch = lower.match(/age[s]?\s*(?:between\s+)?(\d+)\s*[-–—]\s*(\d+)/i)
    || lower.match(/age[s]?\s*(?:between\s+)?(\d+)\s*(?:to|through|and)\s*(\d+)/i)
    || lower.match(/(\d+)\s*(?:to|through|-)\s*(\d+)\s*years/i)
    || lower.match(/between\s*(\d+)\s*and\s*(\d+)\s*years/i);
  if (rangeMatch) {
    return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };
  }

  // ">= 45 years" and "<= 75 years" in same text
  const gteMatch = lower.match(/>=?\s*(\d+)\s*(?:years|yrs)?/);
  const lteMatch = lower.match(/<=?\s*(\d+)\s*(?:years|yrs)?/);
  if (gteMatch && lteMatch) {
    return { min: parseInt(gteMatch[1]), max: parseInt(lteMatch[1]) };
  }

  // "at least 45" / "minimum 45"
  const minOnly = lower.match(/(?:at least|minimum|>=?\s*)(\d+)\s*(?:years|yrs)?/);
  // "at most 75" / "maximum 75"
  const maxOnly = lower.match(/(?:at most|maximum|up to|<=?\s*)(\d+)\s*(?:years|yrs)?/);
  if (minOnly && !maxOnly) {
    return { min: parseInt(minOnly[1]), max: 120 };
  }
  if (maxOnly && !minOnly) {
    return { min: 0, max: parseInt(maxOnly[1]) };
  }

  return null;
}

function getMeasureAgeRequirements(measure                      )                        {
  // 1. Check explicit global constraints (most reliable)
  if (measure.globalConstraints?.ageRange) {
    return {
      minAge: measure.globalConstraints.ageRange.min,
      maxAge: measure.globalConstraints.ageRange.max,
      description: `Age ${measure.globalConstraints.ageRange.min}-${measure.globalConstraints.ageRange.max}`,
      checkType: measure.globalConstraints.ageCalculation === 'turns_during' ? 'turns' : 'range'
    };
  }

  // 2. Scan ALL population criteria for age DataElements (not just IP)
  for (const pop of measure.populations) {
    const ageReq = findAgeRequirementInClause(pop.criteria);
    if (ageReq) return ageReq;
  }

  // 3. Parse from population descriptions and narratives
  for (const pop of measure.populations) {
    const parsed = parseAgeRangeFromText(pop.description)
      || parseAgeRangeFromText(pop.narrative);
    if (parsed) {
      return {
        minAge: parsed.min,
        maxAge: parsed.max,
        description: `Age ${parsed.min}-${parsed.max}`,
        checkType: parsed.min <= 18 ? 'turns' : 'range'
      };
    }
  }

  // 4. Parse from measure metadata title/description
  const metaText = `${measure.metadata.title || ''} ${measure.metadata.description || ''}`;
  const metaParsed = parseAgeRangeFromText(metaText);
  if (metaParsed) {
    return {
      minAge: metaParsed.min,
      maxAge: metaParsed.max,
      description: `Age ${metaParsed.min}-${metaParsed.max}`,
      checkType: metaParsed.min <= 18 ? 'turns' : 'range'
    };
  }

  return null;
}

/** Walk a clause tree looking for a demographic DataElement with age info */
function findAgeRequirementInClause(clause               )                        {
  for (const child of clause.children) {
    if ('operator' in child) {
      const result = findAgeRequirementInClause(child                 );
      if (result) return result;
    } else {
      const element = child               ;
      const isAgeRelated = element.type === 'demographic'
        || element.description?.toLowerCase().includes('age')
        || element.thresholds?.ageMin !== undefined
        || element.thresholds?.ageMax !== undefined;

      if (!isAgeRelated) continue;

      // Priority 1: Structured thresholds
      if (element.thresholds?.ageMin !== undefined || element.thresholds?.ageMax !== undefined) {
        const minAge = element.thresholds.ageMin ?? 0;
        const maxAge = element.thresholds.ageMax ?? 120;
        return {
          minAge,
          maxAge,
          description: `Age ${minAge}-${maxAge}`,
          checkType: minAge <= 18 ? 'turns' : 'range'
        };
      }

      // Priority 2: Parse from description
      const parsed = parseAgeRangeFromText(element.description || '');
      if (parsed) {
        return {
          minAge: parsed.min,
          maxAge: parsed.max,
          description: `Age ${parsed.min}-${parsed.max}`,
          checkType: parsed.min <= 18 ? 'turns' : 'range'
        };
      }

      // Priority 3: Parse from additionalRequirements
      if (element.additionalRequirements) {
        for (const req of element.additionalRequirements) {
          const reqParsed = parseAgeRangeFromText(req);
          if (reqParsed) {
            return {
              minAge: reqParsed.min,
              maxAge: reqParsed.max,
              description: `Age ${reqParsed.min}-${reqParsed.max}`,
              checkType: reqParsed.min <= 18 ? 'turns' : 'range'
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Calculate patient's age at a given date
 */
function calculateAge(birthDate      , atDate      )         {
  let age = atDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = atDate.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && atDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Check if patient turns a specific age during a date range
 */
function turnsAgeDuring(birthDate      , targetAge        , rangeStart      , rangeEnd      )          {
  const targetBirthday = new Date(birthDate);
  targetBirthday.setFullYear(birthDate.getFullYear() + targetAge);
  return targetBirthday >= rangeStart && targetBirthday <= rangeEnd;
}

/**
 * Check if patient meets age requirement for the measure
 * This is a PRE-CHECK before any population evaluation
 */
function checkAgeRequirement(
  patient             ,
  measure                      ,
  mpStart        ,
  mpEnd        
)                                                      {
  const birthDate = new Date(patient.demographics.birthDate);
  const mpStartDate = new Date(mpStart);
  const mpEndDate = new Date(mpEnd);

  const ageAtStart = calculateAge(birthDate, mpStartDate);
  const ageAtEnd = calculateAge(birthDate, mpEndDate);
  const ageInfo = `Age ${ageAtStart} at MP start, ${ageAtEnd} at MP end`;

  const ageReqs = getMeasureAgeRequirements(measure);

  if (!ageReqs) {
    // No specific age requirements detected, allow through
    return { met: true, ageInfo };
  }

  // For "turns X" type measures (childhood immunizations)
  if (ageReqs.checkType === 'turns') {
    // Check if patient turns the target age (maxAge) during the measurement period
    const turnsTargetAge = turnsAgeDuring(birthDate, ageReqs.maxAge, mpStartDate, mpEndDate);

    if (!turnsTargetAge) {
      // Also check if they're within the valid range to be considered
      // For childhood imms: must be age 1-2 during the measurement period
      const withinRange = ageAtEnd >= ageReqs.minAge && ageAtStart <= ageReqs.maxAge;

      if (!withinRange) {
        return {
          met: false,
          reason: `Patient age (${ageAtStart}-${ageAtEnd}) is outside the required range. ${ageReqs.description}`,
          ageInfo
        };
      }
    }

    return { met: true, ageInfo };
  }

  // For range-based age requirements (adult measures)
  // Patient must be within the age range at some point during the measurement period
  const meetsMinAge = ageAtEnd >= ageReqs.minAge;
  const meetsMaxAge = ageAtStart <= ageReqs.maxAge;

  if (!meetsMinAge) {
    return {
      met: false,
      reason: `Patient is too young (age ${ageAtEnd}). ${ageReqs.description}`,
      ageInfo
    };
  }

  if (!meetsMaxAge) {
    return {
      met: false,
      reason: `Patient is too old (age ${ageAtStart}). ${ageReqs.description}`,
      ageInfo
    };
  }

  return { met: true, ageInfo };
}

/**
 * Check if patient meets gender requirement for the measure
 */
function checkGenderRequirement(
  patient             ,
  measure
)                                                                   {
  const requiredGender = measure.globalConstraints?.gender;

  // No gender requirement if: null, undefined, empty string, 'all', 'any', or 'Any'
  const noGenderRequirement = !requiredGender ||
    requiredGender === '' ||
    requiredGender.toLowerCase() === 'all' ||
    requiredGender.toLowerCase() === 'any';

  if (noGenderRequirement) {
    // Measure has no gender restriction — all genders pass
    return { met: true, hasGenderRequirement: false };
  }

  // Measure requires specific gender (male/female)
  if (patient.demographics.gender?.toLowerCase() !== requiredGender.toLowerCase()) {
    return {
      met: false,
      reason: `Patient gender (${patient.demographics.gender}) does not match required gender (${requiredGender})`,
      hasGenderRequirement: true
    };
  }

  return {
    met: true,
    reason: `Patient gender (${patient.demographics.gender}) meets requirement (${requiredGender})`,
    hasGenderRequirement: true
  };
}

/**
 * Evaluate a test patient against a measure and generate a validation trace
 */
export function evaluatePatient(
  patient             ,
  measure                      ,
  measurementPeriod                                 
)                         {
  // Default measurement period to current year
  const mpStart = measurementPeriod?.start || `${new Date().getFullYear()}-01-01`;
  const mpEnd = measurementPeriod?.end || `${new Date().getFullYear()}-12-31`;

  // Collect all IP pre-check nodes to show complete picture
  const ipPreCheckNodes                   = [];
  let ipPreChecksPassed = true;
  const howCloseReasons           = [];

  // Check gender requirement (for gender-specific measures)
  const genderCheck = checkGenderRequirement(patient, measure);
  if (genderCheck.hasGenderRequirement) {
    // Only add gender node if this measure has gender requirements
    ipPreCheckNodes.push({
      id: 'gender-check',
      title: 'Gender Requirement',
      type: 'decision',
      description: genderCheck.reason || (genderCheck.met ? 'Gender requirement met' : 'Gender requirement not met'),
      status: genderCheck.met ? 'pass' : 'fail',
      facts: [{
        code: 'GENDER',
        display: `Patient gender: ${patient.demographics.gender}`,
        source: 'Demographics',
      }],
    });
    if (!genderCheck.met) {
      ipPreChecksPassed = false;
      howCloseReasons.push(genderCheck.reason || 'Gender requirement not met');
    }
  }

  // Check age requirement - always show for measures with age requirements
  const ageCheck = checkAgeRequirement(patient, measure, mpStart, mpEnd);
  const ageReqs = getMeasureAgeRequirements(measure);
  if (ageReqs || ageCheck.ageInfo) {
    const ageDescription = ageCheck.met
      ? `${ageCheck.ageInfo}. Meets requirement: ${ageReqs?.description || 'Age criteria satisfied'}`
      : (ageCheck.reason || 'Age requirement not met');
    ipPreCheckNodes.push({
      id: 'age-check',
      title: 'Age Requirement',
      type: 'decision',
      description: ageDescription,
      status: ageCheck.met ? 'pass' : 'fail',
      facts: [{
        code: 'AGE',
        display: ageCheck.ageInfo || `Patient age: calculated from DOB`,
        source: 'Demographics',
        date: patient.demographics.birthDate,
      }],
    });
    if (!ageCheck.met) {
      ipPreChecksPassed = false;
      howCloseReasons.push(ageCheck.reason || 'Age requirement not met');
    }
  }

  // Find each population type (handle both snake_case and kebab-case)
  const findPop = (types) => measure.populations.find(p => types.includes(p.type));

  const ipPop = findPop(['initial_population', 'initial-population']);
  const denomPop = findPop(['denominator']);
  const denomExclPop = findPop(['denominator_exclusion', 'denominator-exclusion']);
  const denomExcepPop = findPop(['denominator_exception', 'denominator-exception']);
  const numerPop = findPop(['numerator']);
  const _numerExclPop = findPop(['numerator_exclusion', 'numerator-exclusion']);

  // Evaluate measure-defined IP criteria (only if pre-checks passed)
  const ipMeasureCriteria = (ipPop && ipPreChecksPassed)
    ? evaluatePopulation(patient, ipPop, measure, mpStart, mpEnd)
    : { met: ipPreChecksPassed, nodes: [] };

  // Combine pre-check nodes with measure-defined IP criteria nodes
  const ipResult = {
    met: ipPreChecksPassed && ipMeasureCriteria.met,
    nodes: [...ipPreCheckNodes, ...ipMeasureCriteria.nodes],
  };

  // Denominator: check if it "equals Initial Population" (common pattern)
  // If so, inherit the IP result directly to avoid mismatches
  const denomEqualsIP = !denomPop
    || denomPop.description?.toLowerCase().includes('equals initial population')
    || denomPop.description?.toLowerCase().includes('same as initial population')
    || denomPop.narrative?.toLowerCase().includes('equals initial population')
    || denomPop.criteria?.children?.length === 0;

  const denomResult = denomEqualsIP
    ? { met: ipResult.met, nodes: [] }
    : (ipResult.met
      ? evaluatePopulation(patient, denomPop , measure, mpStart, mpEnd)
      : { met: false, nodes: [] });

  // Evaluate defined exclusion criteria
  let exclusionResult = denomExclPop && denomResult.met
    ? evaluatePopulation(patient, denomExclPop, measure, mpStart, mpEnd)
    : { met: false, nodes: [] };

  const _exceptionResult = denomExcepPop && denomResult.met && !exclusionResult.met
    ? evaluatePopulation(patient, denomExcepPop, measure, mpStart, mpEnd)
    : { met: false, nodes: [] };

  let numerResult = numerPop && denomResult.met && !exclusionResult.met
    ? evaluatePopulation(patient, numerPop, measure, mpStart, mpEnd)
    : { met: false, nodes: [] };

  // Determine final outcome
  let finalOutcome                                        ;
  let howClose           = [];

  if (!ipResult.met) {
    finalOutcome = 'not_in_population';
    // Use pre-check reasons if available, otherwise generate from IP criteria
    howClose = howCloseReasons.length > 0
      ? howCloseReasons
      : generateHowClose(patient, ipPop, measure, mpStart, mpEnd);
  } else if (!denomResult.met) {
    finalOutcome = 'not_in_population';
    howClose = generateHowClose(patient, denomPop, measure, mpStart, mpEnd);
  } else if (exclusionResult.met) {
    finalOutcome = 'excluded';
  } else if (numerResult.met) {
    finalOutcome = 'in_numerator';
  } else {
    finalOutcome = 'not_in_numerator';
    howClose = generateHowClose(patient, numerPop, measure, mpStart, mpEnd);
  }

  // Generate narrative
  const narrative = generateNarrative(patient, finalOutcome, measure);

  return {
    patientId: patient.id,
    patientName: patient.name,
    narrative,
    populations: {
      initialPopulation: ipResult,
      denominator: denomResult,
      exclusions: exclusionResult,
      numerator: numerResult,
    },
    finalOutcome,
    howClose: howClose.length > 0 ? howClose : undefined,
  };
}

// ============================================================================
// Population Evaluation
// ============================================================================

function evaluatePopulation(
  patient             ,
  population                      ,
  measure                      ,
  mpStart        ,
  mpEnd
)                                            {
  const nodes                   = [];

  // Handle case where criteria might be missing or malformed
  if (!population.criteria) {
    return { met: true, nodes: [] };
  }

  // Handle case where criteria is a DataElement directly (not wrapped in LogicalClause)
  if (!population.criteria.children && population.criteria.type) {
    // It's a single DataElement, evaluate it directly
    const { met, node } = evaluateDataElement(
      patient,
      population.criteria               ,
      measure,
      mpStart,
      mpEnd
    );
    if (node) nodes.push(node);
    return { met, nodes };
  }

  // Debug: log numerator criteria count
  if (population.type === 'numerator' || population.type === 'NUMERATOR') {
    const criteriaCount = population.criteria?.children?.length || 0;
    console.log('[DEBUG] Numerator criteria count:', criteriaCount);
    if (population.criteria?.children) {
      console.log('[DEBUG] Numerator criteria titles:',
        population.criteria.children.map((c) => c.title || c.description || c.id)
      );
    }
  }

  // Evaluate the criteria clause
  const { met, childNodes } = evaluateClause(
    patient,
    population.criteria,
    measure,
    mpStart,
    mpEnd
  );

  nodes.push(...childNodes);

  return { met, nodes };
}

function evaluateClause(
  patient             ,
  clause               ,
  measure                      ,
  mpStart        ,
  mpEnd
)                                                                                              {
  const childNodes                   = [];
  const results            = [];

  // Handle missing or empty children array
  if (!clause.children || clause.children.length === 0) {
    return { met: clause.operator === 'AND', childNodes: [], matchCount: { met: 0, total: 0 } };
  }

  // Track if we've already satisfied an OR group (for short-circuit evaluation)
  let orSatisfied = false;
  let orSatisfiedByIndex = -1;
  let orSatisfiedByTitle = '';

  for (let i = 0; i < clause.children.length; i++) {
    const child = clause.children[i];
    const isOrClause = clause.operator === 'OR';

    // For OR clauses: if already satisfied, mark remaining children as skipped
    if (isOrClause && orSatisfied) {
      if ('operator' in child) {
        const nestedClause = child                 ;
        const skippedNode                 = {
          id: nestedClause.id,
          title: nestedClause.description || `${nestedClause.operator} Group`,
          type: 'collector',
          description: nestedClause.description || '',
          status: 'skipped',
          skipped: true,
          skipReason: `Not needed — qualified via: ${orSatisfiedByTitle}`,
          facts: [],
          children: [],
          operator: nestedClause.operator,
        };
        childNodes.push(skippedNode);
      } else {
        const element = child               ;
        const skippedNode                 = {
          id: element.id,
          title: getElementTitle(element),
          type: 'decision',
          description: element.description,
          status: 'skipped',
          skipped: true,
          skipReason: `Not needed — qualified via: ${orSatisfiedByTitle}`,
          facts: [],
        };
        childNodes.push(skippedNode);
      }
      results.push(false); // Not evaluated, but doesn't affect OR result
      continue;
    }

    if ('operator' in child) {
      // It's a nested LogicalClause — produce a group node to preserve tree structure
      const nestedClause = child                 ;
      const { met, childNodes: nestedNodes, matchCount, satisfiedBy } = evaluateClause(
        patient,
        nestedClause,
        measure,
        mpStart,
        mpEnd
      );
      results.push(met);

      // For OR groups, track which path satisfied it
      let groupSatisfiedBy = satisfiedBy;
      if (met && nestedClause.operator === 'OR' && !groupSatisfiedBy) {
        // Find the first passing child
        const passingChild = nestedNodes.find(n => n.status === 'pass');
        if (passingChild) {
          groupSatisfiedBy = passingChild.title;
        }
      }

      const groupNode                 = {
        id: nestedClause.id,
        title: nestedClause.description || `${nestedClause.operator} Group`,
        type: 'collector',
        description: nestedClause.description || '',
        status: met ? 'pass' : matchCount && matchCount.met > 0 ? 'partial' : 'fail',
        // Replace GROUP_MATCH with human-readable text
        facts: met && nestedClause.operator === 'OR' && groupSatisfiedBy ? [{
          code: 'OR_SATISFIED',
          display: `Qualified via: ${groupSatisfiedBy}`,
        }] : (nestedClause.operator === 'AND' && matchCount ? [{
          code: 'AND_STATUS',
          display: met ? `All ${matchCount.total} criteria met` : `${matchCount.met} of ${matchCount.total} criteria met`,
        }] : []),
        children: nestedNodes,
        operator: nestedClause.operator,
        satisfiedBy: groupSatisfiedBy,
      };
      childNodes.push(groupNode);

      // Track OR satisfaction for short-circuiting
      if (isOrClause && met && !orSatisfied) {
        orSatisfied = true;
        orSatisfiedByIndex = i;
        orSatisfiedByTitle = groupNode.title;
      }
    } else {
      // It's a DataElement
      const { met, node } = evaluateDataElement(
        patient,
        child               ,
        measure,
        mpStart,
        mpEnd
      );
      results.push(met);
      if (node) {
        childNodes.push(node);
        // Track OR satisfaction for short-circuiting
        if (isOrClause && met && !orSatisfied) {
          orSatisfied = true;
          orSatisfiedByIndex = i;
          orSatisfiedByTitle = node.title;
        }
      }
    }
  }

  // Track partial matches for AND clauses
  const metCount = results.filter(r => r).length;
  const totalCount = results.length;

  // Apply logical operators with support for per-sibling overrides
  let met         ;

  if (clause.operator === 'NOT') {
    // NOT applies to the first child only
    met = results.length > 0 ? !results[0] : true;
  } else if (results.length === 0) {
    met = clause.operator === 'AND'; // Empty AND = true, empty OR = false
  } else if (results.length === 1) {
    met = results[0];
  } else {
    // Combine results using per-sibling operators (supports siblingConnections)
    met = results[0];
    for (let i = 1; i < results.length; i++) {
      const op = getOperatorBetween(clause, i - 1, i);
      if (op === 'AND') {
        met = met && results[i];
      } else if (op === 'OR') {
        met = met || results[i];
      }
      // Note: NOT between siblings doesn't make sense, ignore
    }
  }

  return {
    met,
    childNodes,
    matchCount: { met: metCount, total: totalCount },
    satisfiedBy: orSatisfied ? orSatisfiedByTitle : undefined
  };
}

// ============================================================================
// Data Element Evaluation
// ============================================================================

// Immunization-related keywords to detect vaccine criteria
const IMMUNIZATION_KEYWORDS = [
  'dtap', 'dtp', 'tetanus', 'diphtheria', 'pertussis',
  'ipv', 'polio', 'opv',
  'mmr', 'measles', 'mumps', 'rubella',
  'hib', 'haemophilus',
  'hep a', 'hep b', 'hepa', 'hepb', 'hepatitis',
  'varicella', 'chickenpox', 'vzv',
  'pcv', 'pneumococcal', 'prevnar',
  'rotavirus', 'rota',
  'influenza', 'flu',
  'vaccine', 'immunization', 'vaccination',
  'cvx', 'shot', 'immunize'
];

function descriptionSuggestsImmunization(desc        )          {
  const lower = desc.toLowerCase();
  return IMMUNIZATION_KEYWORDS.some(kw => lower.includes(kw));
}

function evaluateDataElement(
  patient             ,
  element             ,
  measure                      ,
  mpStart        ,
  mpEnd
)                                                {
  const facts                   = [];
  let met = false;
  let incomplete = false;
  let description = element.description;

  // Check if description suggests this is about immunizations
  const looksLikeImmunization = descriptionSuggestsImmunization(element.description);

  // If it looks like an immunization criterion, try immunization evaluation first
  if (looksLikeImmunization && element.type !== 'demographic') {
    const immResult = evaluateImmunization(patient, element, measure, mpStart, mpEnd);
    if (immResult.met) {
      met = immResult.met;
      facts.push(...immResult.facts);
      // Skip to node creation
      const node                 = {
        id: element.id,
        title: getElementTitle(element),
        type: 'decision',
        description,
        status: 'pass',
        facts,
        cqlSnippet: generateCqlSnippet(element),
        source: 'Test Patient Data',
      };
      return { met, node };
    }
  }

  switch (element.type) {
    case 'demographic':
      // Handle patient sex check
      if (element.genderValue) {
        const patientGender = patient.demographics.gender;
        const genderMet = patientGender === element.genderValue;
        met = genderMet;
        facts.push({
          code: 'sex',
          display: genderMet
            ? `Patient sex (${patientGender}) matches required (${element.genderValue})`
            : `Patient sex (${patientGender}) does not match required (${element.genderValue})`,
          source: 'demographics',
        });
      } else {
        // Handle age requirement (original logic)
        const ageResult = evaluateAgeRequirement(patient, element, mpStart, mpEnd);
        met = ageResult.met;
        facts.push(...ageResult.facts);
      }
      break;

    case 'diagnosis':
      const dxResult = evaluateDiagnosis(patient, element, measure, mpStart, mpEnd);
      met = dxResult.met;
      incomplete = dxResult.incomplete || false;
      facts.push(...dxResult.facts);
      break;

    case 'encounter':
      const encResult = evaluateEncounter(patient, element, measure, mpStart, mpEnd);
      met = encResult.met;
      incomplete = encResult.incomplete || false;
      facts.push(...encResult.facts);
      break;

    case 'procedure':
      const procResult = evaluateProcedure(patient, element, measure, mpStart, mpEnd);
      met = procResult.met;
      incomplete = procResult.incomplete || false;
      facts.push(...procResult.facts);
      // If procedure didn't match but looks like immunization, try that too
      if (!met && !incomplete && looksLikeImmunization) {
        const immResult = evaluateImmunization(patient, element, measure, mpStart, mpEnd);
        if (immResult.met) {
          met = immResult.met;
          facts.length = 0; // Clear previous facts
          facts.push(...immResult.facts);
        }
      }
      break;

    case 'observation':
      const obsResult = evaluateObservation(patient, element, measure, mpStart, mpEnd);
      met = obsResult.met;
      incomplete = obsResult.incomplete || false;
      facts.push(...obsResult.facts);
      break;

    case 'medication':
      const medResult = evaluateMedication(patient, element, measure, mpStart, mpEnd);
      met = medResult.met;
      incomplete = medResult.incomplete || false;
      facts.push(...medResult.facts);
      break;

    case 'immunization':
      const immResult2 = evaluateImmunization(patient, element, measure, mpStart, mpEnd);
      met = immResult2.met;
      incomplete = immResult2.incomplete || false;
      facts.push(...immResult2.facts);
      break;

    case 'assessment':
    default:
      // Generic assessment - check if any matching data exists
      const assessResult = evaluateAssessment(patient, element, measure, mpStart, mpEnd);
      met = assessResult.met;
      incomplete = assessResult.incomplete || false;
      facts.push(...assessResult.facts);
      break;
  }

  // Determine status: incomplete takes priority over pass/fail
  let status         ;
  if (incomplete) {
    status = 'incomplete';
  } else if (met) {
    status = 'pass';
  } else {
    status = 'fail';
  }

  const node                 = {
    id: element.id,
    title: getElementTitle(element),
    type: 'decision',
    description,
    status,
    facts,
    cqlSnippet: generateCqlSnippet(element),
    source: 'Test Patient Data',
  };

  return { met, node };
}

// ============================================================================
// Specific Evaluation Functions
// ============================================================================

function evaluateAgeRequirement(
  patient             ,
  element             ,
  mpStart        ,
  mpEnd         
)                                            {
  const facts                   = [];

  const birthDate = new Date(patient.demographics.birthDate);
  const mpStartDate = new Date(mpStart);
  const mpEndDate = mpEnd ? new Date(mpEnd) : new Date(mpStartDate.getFullYear(), 11, 31);

  // Calculate age at measurement period start
  let ageAtStart = mpStartDate.getFullYear() - birthDate.getFullYear();
  const monthDiffStart = mpStartDate.getMonth() - birthDate.getMonth();
  if (monthDiffStart < 0 || (monthDiffStart === 0 && mpStartDate.getDate() < birthDate.getDate())) {
    ageAtStart--;
  }

  // Calculate age at measurement period end
  let ageAtEnd = mpEndDate.getFullYear() - birthDate.getFullYear();
  const monthDiffEnd = mpEndDate.getMonth() - birthDate.getMonth();
  if (monthDiffEnd < 0 || (monthDiffEnd === 0 && mpEndDate.getDate() < birthDate.getDate())) {
    ageAtEnd--;
  }

  // Helper: Check if patient turns a specific age during the measurement period
  const turnsAgeDuring = (targetAge        )          => {
    const targetBirthday = new Date(birthDate);
    targetBirthday.setFullYear(birthDate.getFullYear() + targetAge);
    return targetBirthday >= mpStartDate && targetBirthday <= mpEndDate;
  };

  // Helper: Get the birthday that falls in the measurement year
  const getBirthdayInMeasurementYear = ()       => {
    const birthdayInYear = new Date(birthDate);
    birthdayInYear.setFullYear(mpStartDate.getFullYear());
    return birthdayInYear;
  };

  facts.push({
    code: 'AGE',
    display: `Age: ${ageAtStart} at MP start, ${ageAtEnd} at MP end`,
    date: patient.demographics.birthDate,
    source: 'Demographics',
  });

  // Resolve effective age thresholds from all available sources
  let effectiveAgeMin                     = element.thresholds?.ageMin;
  let effectiveAgeMax                     = element.thresholds?.ageMax;

  // Parse from description and additionalRequirements if thresholds aren't set
  if (effectiveAgeMin === undefined && effectiveAgeMax === undefined) {
    const parsed = parseAgeRangeFromText(element.description || '');
    if (parsed) {
      effectiveAgeMin = parsed.min;
      effectiveAgeMax = parsed.max;
    }
  }

  if (effectiveAgeMin === undefined && effectiveAgeMax === undefined && element.additionalRequirements) {
    for (const req of element.additionalRequirements) {
      const parsed = parseAgeRangeFromText(req);
      if (parsed) {
        effectiveAgeMin = parsed.min;
        effectiveAgeMax = parsed.max;
        break;
      }
    }
  }

  let met = true;

  if (effectiveAgeMin !== undefined || effectiveAgeMax !== undefined) {
    // For pediatric measures (small age values), use strict age checking
    if (effectiveAgeMin !== undefined && effectiveAgeMin <= 18) {
      const turnsTargetAge = turnsAgeDuring(effectiveAgeMin);
      const maxAge = effectiveAgeMax ?? effectiveAgeMin;
      const isWithinStrictRange = ageAtStart <= maxAge && ageAtEnd <= maxAge + 1;

      if (turnsTargetAge && isWithinStrictRange) {
        met = true;
        const birthdayInYear = getBirthdayInMeasurementYear();
        facts.push({
          code: 'AGE_TURNS',
          display: `Turns ${effectiveAgeMin} on ${birthdayInYear.toLocaleDateString()} (within MP)`,
          source: 'Age Evaluation',
        });
      } else if (isWithinStrictRange && effectiveAgeMax !== undefined) {
        const meetsMinAtEnd = ageAtEnd >= effectiveAgeMin;
        const meetsMaxAtStart = ageAtStart <= effectiveAgeMax;
        if (meetsMinAtEnd && meetsMaxAtStart) {
          met = true;
          facts.push({
            code: 'AGE_RANGE',
            display: `Age ${ageAtStart}-${ageAtEnd} within range ${effectiveAgeMin}-${effectiveAgeMax}`,
            source: 'Age Evaluation',
          });
        } else {
          met = false;
          facts.push({
            code: 'AGE_RANGE_FAIL',
            display: `Age ${ageAtStart}-${ageAtEnd} outside pediatric range ${effectiveAgeMin}-${effectiveAgeMax}`,
            source: 'Age Evaluation',
          });
        }
      } else {
        met = false;
        facts.push({
          code: 'AGE_MIN_FAIL',
          display: `Patient age (${ageAtStart}-${ageAtEnd}) does not meet pediatric requirement (turns ${effectiveAgeMin})`,
          source: 'Age Evaluation',
        });
      }
    } else {
      // For adult measures, use traditional age-at-point-in-time logic
      if (effectiveAgeMin !== undefined && ageAtEnd < effectiveAgeMin) {
        met = false;
        facts.push({
          code: 'AGE_MIN_FAIL',
          display: `Age ${ageAtEnd} < minimum ${effectiveAgeMin}`,
          source: 'Age Evaluation',
        });
      }
      if (effectiveAgeMax !== undefined && ageAtStart > effectiveAgeMax) {
        met = false;
        facts.push({
          code: 'AGE_MAX_FAIL',
          display: `Age ${ageAtStart} > maximum ${effectiveAgeMax}`,
          source: 'Age Evaluation',
        });
      }
    }
  }

  // Also check additionalRequirements for "turns X" patterns
  if (element.additionalRequirements) {
    for (const req of element.additionalRequirements) {
      const turnsMatch = req.match(/turns?\s*(\d+)/i);
      if (turnsMatch) {
        const targetAge = parseInt(turnsMatch[1]);
        if (!turnsAgeDuring(targetAge)) {
          met = false;
          facts.push({
            code: 'AGE_TURNS_FAIL',
            display: `Does not turn ${targetAge} during measurement period`,
            source: 'Age Evaluation',
          });
        } else {
          facts.push({
            code: 'AGE_TURNS_PASS',
            display: `Turns ${targetAge} during measurement period`,
            source: 'Age Evaluation',
          });
        }
      }
    }
  }

  return { met, facts };
}

function evaluateDiagnosis(
  patient             ,
  element             ,
  measure                      ,
  mpStart        ,
  mpEnd
)                                                              {
  const facts                   = [];
  let met = false;
  let incomplete = false;

  // Get codes to match against
  const { codes: codesToMatch, needsCodes } = getCodesFromElement(element, measure);

  // If this element expects codes but has none configured, mark as incomplete
  if (needsCodes) {
    incomplete = true;
    facts.push({
      code: 'NO_CODES',
      display: `Unable to evaluate — no value set codes configured for: ${element.valueSet?.name || element.description}`,
      source: 'Configuration',
    });
    return { met: false, facts, incomplete };
  }

  for (const dx of patient.diagnoses) {
    // Check if diagnosis code matches
    const codeMatches = matchCode(dx.code, dx.system, codesToMatch);

    if (codeMatches) {
      // Check timing using structured format (with fallback to legacy)
      const { met: timingOk, window } = checkTimingStructured(dx.onsetDate, element, mpStart, mpEnd);

      if (timingOk) {
        met = true;
        facts.push({
          code: dx.code,
          display: dx.display + (window ? ` (within ${window})` : ''),
          date: dx.onsetDate,
          source: 'Problem List',
        });
      }
    }
  }

  if (!met && !incomplete) {
    facts.push({
      code: 'NO_MATCH',
      display: `No matching diagnosis found for: ${element.description}`,
      source: 'Diagnosis Evaluation',
    });
  }

  return { met, facts, incomplete };
}

function evaluateEncounter(
  patient             ,
  element             ,
  measure                      ,
  mpStart        ,
  mpEnd
)                                                              {
  const facts                   = [];
  let met = false;
  let incomplete = false;

  const { codes: codesToMatch, needsCodes } = getCodesFromElement(element, measure);

  // If this element expects codes but has none configured, mark as incomplete
  if (needsCodes) {
    incomplete = true;
    facts.push({
      code: 'NO_CODES',
      display: `Unable to evaluate — no value set codes configured for: ${element.valueSet?.name || element.description}`,
      source: 'Configuration',
    });
    return { met: false, facts, incomplete };
  }

  for (const enc of patient.encounters) {
    const codeMatches = matchCode(enc.code, enc.system, codesToMatch);

    if (codeMatches) {
      const { met: timingOk, window } = checkTimingStructured(enc.date, element, mpStart, mpEnd);

      if (timingOk) {
        met = true;
        facts.push({
          code: enc.code,
          display: enc.display + (window ? ` (within ${window})` : ''),
          date: enc.date,
          source: 'Encounters',
        });
      }
    }
  }

  if (!met && !incomplete) {
    facts.push({
      code: 'NO_MATCH',
      display: `No matching encounter found for: ${element.description}`,
      source: 'Encounter Evaluation',
    });
  }

  return { met, facts, incomplete };
}

function evaluateProcedure(
  patient             ,
  element             ,
  measure                      ,
  mpStart        ,
  mpEnd
)                                                              {
  const facts                   = [];
  let met = false;
  let incomplete = false;

  const { codes: codesToMatch, needsCodes } = getCodesFromElement(element, measure);

  // If this element expects codes but has none configured, mark as incomplete
  if (needsCodes) {
    incomplete = true;
    facts.push({
      code: 'NO_CODES',
      display: `Unable to evaluate — no value set codes configured for: ${element.valueSet?.name || element.description}`,
      source: 'Configuration',
    });
    return { met: false, facts, incomplete };
  }

  for (const proc of patient.procedures) {
    const codeMatches = matchCode(proc.code, proc.system, codesToMatch);

    if (codeMatches) {
      const { met: timingOk, window } = checkTimingStructured(proc.date, element, mpStart, mpEnd);

      if (timingOk) {
        met = true;
        facts.push({
          code: proc.code,
          display: proc.display + (window ? ` (within ${window})` : ''),
          date: proc.date,
          source: 'Procedures',
        });
      }
    }
  }

  // Also check immunizations for procedure-type elements
  if (!met && patient.immunizations) {
    for (const imm of patient.immunizations) {
      const codeMatches = matchCode(imm.code, imm.system, codesToMatch);

      if (codeMatches && imm.status === 'completed') {
        const { met: timingOk, window } = checkTimingStructured(imm.date, element, mpStart, mpEnd);

        if (timingOk) {
          met = true;
          facts.push({
            code: imm.code,
            display: imm.display + (window ? ` (within ${window})` : ''),
            date: imm.date,
            source: 'Immunizations',
          });
        }
      }
    }
  }

  if (!met && !incomplete) {
    facts.push({
      code: 'NO_MATCH',
      display: `No matching procedure/immunization found for: ${element.description}`,
      source: 'Procedure Evaluation',
    });
  }

  return { met, facts, incomplete };
}

function evaluateObservation(
  patient             ,
  element             ,
  measure                      ,
  mpStart        ,
  mpEnd
)                                                              {
  const facts                   = [];
  let met = false;
  let incomplete = false;

  const { codes: codesToMatch, needsCodes } = getCodesFromElement(element, measure);

  // If this element expects codes but has none configured, mark as incomplete
  if (needsCodes) {
    incomplete = true;
    facts.push({
      code: 'NO_CODES',
      display: `Unable to evaluate — no value set codes configured for: ${element.valueSet?.name || element.description}`,
      source: 'Configuration',
    });
    return { met: false, facts, incomplete };
  }

  for (const obs of patient.observations) {
    const codeMatches = matchCode(obs.code, obs.system, codesToMatch);

    if (codeMatches) {
      const { met: timingOk } = checkTimingStructured(obs.date, element, mpStart, mpEnd);

      if (timingOk) {
        // Check value thresholds if present
        let valueOk = true;
        if (element.thresholds && obs.value !== undefined) {
          const { valueMin, valueMax, comparator } = element.thresholds;

          if (comparator) {
            switch (comparator) {
              case '>':
                valueOk = obs.value > (valueMin || 0);
                break;
              case '>=':
                valueOk = obs.value >= (valueMin || 0);
                break;
              case '<':
                valueOk = obs.value < (valueMax || Infinity);
                break;
              case '<=':
                valueOk = obs.value <= (valueMax || Infinity);
                break;
              case '=':
                valueOk = obs.value === valueMin;
                break;
              case '!=':
                valueOk = obs.value !== valueMin;
                break;
            }
          } else {
            if (valueMin !== undefined) valueOk = valueOk && obs.value >= valueMin;
            if (valueMax !== undefined) valueOk = valueOk && obs.value <= valueMax;
          }
        }

        if (valueOk) {
          met = true;
          facts.push({
            code: obs.code,
            display: `${obs.display}: ${obs.value}${obs.unit ? ' ' + obs.unit : ''}`,
            date: obs.date,
            source: 'Observations',
          });
        }
      }
    }
  }

  if (!met && !incomplete) {
    facts.push({
      code: 'NO_MATCH',
      display: `No matching observation found for: ${element.description}`,
      source: 'Observation Evaluation',
    });
  }

  return { met, facts, incomplete };
}

function evaluateMedication(
  patient             ,
  element             ,
  measure                      ,
  mpStart        ,
  mpEnd
)                                                              {
  const facts                   = [];
  let met = false;
  let incomplete = false;

  const { codes: codesToMatch, needsCodes } = getCodesFromElement(element, measure);

  // If this element expects codes but has none configured, mark as incomplete
  if (needsCodes) {
    incomplete = true;
    facts.push({
      code: 'NO_CODES',
      display: `Unable to evaluate — no value set codes configured for: ${element.valueSet?.name || element.description}`,
      source: 'Configuration',
    });
    return { met: false, facts, incomplete };
  }

  for (const med of patient.medications) {
    const codeMatches = matchCode(med.code, med.system, codesToMatch);

    if (codeMatches) {
      // Check if medication was active during measurement period
      const medStart = new Date(med.startDate);
      const medEnd = med.endDate ? new Date(med.endDate) : new Date();
      const mpStartDate = new Date(mpStart);
      const mpEndDate = new Date(mpEnd);

      const overlaps = medStart <= mpEndDate && medEnd >= mpStartDate;

      if (overlaps) {
        met = true;
        facts.push({
          code: med.code,
          display: med.display,
          date: med.startDate,
          source: 'Medications',
        });
      }
    }
  }

  if (!met && !incomplete) {
    facts.push({
      code: 'NO_MATCH',
      display: `No matching medication found for: ${element.description}`,
      source: 'Medication Evaluation',
    });
  }

  return { met, facts, incomplete };
}

// Common childhood immunization CVX codes mapped by vaccine type
const IMMUNIZATION_CVX_CODES                           = {
  // DTaP (Diphtheria, Tetanus, Pertussis)
  'dtap': ['20', '50', '106', '107', '110', '120', '130', '132', '146', '170', '187'],
  'diphtheria': ['20', '50', '106', '107', '110', '120', '130', '132', '146', '170', '187'],
  'tetanus': ['20', '50', '106', '107', '110', '120', '130', '132', '146', '170', '187'],
  'pertussis': ['20', '50', '106', '107', '110', '120', '130', '132', '146', '170', '187'],
  // IPV (Polio)
  'ipv': ['10', '89', '110', '120', '130', '132', '146', '170'],
  'polio': ['10', '89', '110', '120', '130', '132', '146', '170'],
  // MMR
  'mmr': ['03', '94'],
  'measles': ['03', '05', '94'],
  'mumps': ['03', '07', '94'],
  'rubella': ['03', '06', '94'],
  // Hib
  'hib': ['17', '46', '47', '48', '49', '50', '51', '120', '132', '146', '170', '148'],
  'haemophilus': ['17', '46', '47', '48', '49', '50', '51', '120', '132', '146', '170', '148'],
  // Hepatitis B
  'hepb': ['08', '42', '43', '44', '45', '51', '102', '104', '110', '132', '146', '189'],
  'hepatitis b': ['08', '42', '43', '44', '45', '51', '102', '104', '110', '132', '146', '189'],
  // Hepatitis A
  'hepa': ['31', '52', '83', '84', '85', '104'],
  'hepatitis a': ['31', '52', '83', '84', '85', '104'],
  // Varicella (Chickenpox)
  'varicella': ['21', '94'],
  'chickenpox': ['21', '94'],
  'vzv': ['21', '94'],
  // PCV (Pneumococcal)
  'pcv': ['133', '152', '215', '216'],
  'pneumococcal': ['133', '152', '215', '216'],
  'prevnar': ['133', '152', '215', '216'],
  // Rotavirus
  'rotavirus': ['116', '119', '122'],
  'rota': ['116', '119', '122'],
  // Influenza
  'influenza': ['88', '140', '141', '150', '153', '155', '158', '161', '166', '168', '171', '185', '186', '197', '205'],
  'flu': ['88', '140', '141', '150', '153', '155', '158', '161', '166', '168', '171', '185', '186', '197', '205'],
};

function evaluateImmunization(
  patient             ,
  element             ,
  measure                      ,
  mpStart        ,
  mpEnd
)                                                              {
  const facts                   = [];

  if (!patient.immunizations || patient.immunizations.length === 0) {
    facts.push({
      code: 'NO_IMMUNIZATIONS',
      display: 'No immunization records found for patient',
      source: 'Immunization Evaluation',
    });
    return { met: false, facts, incomplete: false };
  }

  const { codes: codesToMatch, needsCodes } = getCodesFromElement(element, measure);
  const descLower = element.description.toLowerCase();

  // Extract required dose count from description
  // Examples: "Four DTaP vaccinations", "At least three hepatitis B", "2 doses of IPV"
  const wordToNum = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  let requiredDoses = 1;

  // Try word numbers first: "Four DTaP", "Three IPV", "One MMR"
  const wordMatch = descLower.match(/\b(one|two|three|four|five|six)\b/);
  if (wordMatch) {
    requiredDoses = wordToNum[wordMatch[1]];
  } else {
    // Try digits: "4 DTaP", "3 doses", "at least 2"
    const digitMatch = descLower.match(/\b(\d+)\s*(?:dose|shot|vaccin|dtap|ipv|mmr|hib|hep|pcv|rota|varicella|influenza|pneumo)/i);
    if (digitMatch) {
      requiredDoses = parseInt(digitMatch[1]);
    } else {
      // Try "at least N"
      const atLeastMatch = descLower.match(/at least (\d+)/);
      if (atLeastMatch) {
        requiredDoses = parseInt(atLeastMatch[1]);
      }
    }
  }

  // Determine CVX codes to match based on description keywords
  let fallbackCvxCodes           = [];
  for (const [keyword, codes] of Object.entries(IMMUNIZATION_CVX_CODES)) {
    if (descLower.includes(keyword)) {
      fallbackCvxCodes = [...new Set([...fallbackCvxCodes, ...codes])];
    }
  }

  // For childhood immunization measures, calculate the child's 2nd birthday for timing
  const birthDate = new Date(patient.demographics.birthDate);
  const secondBirthday = new Date(birthDate);
  secondBirthday.setFullYear(birthDate.getFullYear() + 2);

  // Detect if this is a childhood measure
  const isChildhoodMeasure = descLower.includes('child') ||
                              descLower.includes('infant') ||
                              descLower.includes('2 year') ||
                              descLower.includes('by age 2') ||
                              descLower.includes('before age') ||
                              measure.metadata.title?.toLowerCase().includes('childhood') ||
                              measure.metadata.title?.toLowerCase().includes('immunization');

  const matchingImmunizations                               = [];

  for (const imm of patient.immunizations) {
    if (imm.status !== 'completed') continue;

    // Check if code matches defined codes
    let codeMatches = matchCode(imm.code, imm.system, codesToMatch);

    // Fallback: check against CVX codes derived from description keywords
    if (!codeMatches && fallbackCvxCodes.length > 0) {
      codeMatches = fallbackCvxCodes.includes(imm.code);
    }

    // If still no match, try matching by display name similarity
    if (!codeMatches && (codesToMatch.length === 0 || fallbackCvxCodes.length === 0)) {
      const immDisplayLower = imm.display.toLowerCase();

      // Check if the immunization display matches any keyword in the element description
      for (const keyword of Object.keys(IMMUNIZATION_CVX_CODES)) {
        if (descLower.includes(keyword) && immDisplayLower.includes(keyword)) {
          codeMatches = true;
          break;
        }
      }

      // Also try direct substring matching between description and display
      if (!codeMatches) {
        const descWords = descLower.split(/\s+/).filter(w => w.length > 3);
        for (const word of descWords) {
          if (immDisplayLower.includes(word) && !['dose', 'shot', 'vaccine', 'with', 'from', 'that'].includes(word)) {
            codeMatches = true;
            break;
          }
        }
      }
    }

    if (codeMatches) {
      // Check timing
      const immDate = new Date(imm.date);
      let timingOk = true;

      if (isChildhoodMeasure) {
        // For childhood immunizations, must be before 2nd birthday
        timingOk = immDate <= secondBirthday;
      } else {
        // Use structured timing check with fallback to legacy
        const { met } = checkTimingStructured(imm.date, element, mpStart, mpEnd);
        timingOk = met;
      }

      if (timingOk) {
        matchingImmunizations.push(imm);
      }
    }
  }

  // Sort by date descending (most recent first) and trim to required count
  matchingImmunizations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const satisfyingRecords = matchingImmunizations.slice(0, requiredDoses);

  const doseCount = matchingImmunizations.length;
  const met = doseCount >= requiredDoses;

  // Build matching records for UI display (only the doses that satisfy the requirement)
  const matchingRecords = satisfyingRecords.map((imm, idx) => ({
    code: imm.code,
    display: imm.display,
    system: imm.system || 'CVX',
    date: imm.date,
    resourceType: 'Immunization',
    doseNumber: idx + 1,
  }));

  // Add each satisfying dose as a fact (sorted by date ascending for display)
  const sortedForDisplay = [...satisfyingRecords].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  for (let i = 0; i < sortedForDisplay.length; i++) {
    const imm = sortedForDisplay[i];
    facts.push({
      code: imm.code,
      display: imm.display,
      date: imm.date,
      source: 'Immunizations',
      doseNumber: i + 1,
      system: imm.system || 'CVX',
    });
  }

  // Add summary as first fact
  const summaryDisplay = met
    ? `${requiredDoses} of ${requiredDoses} required doses found`
    : doseCount > 0
      ? `${doseCount} of ${requiredDoses} required doses found (missing ${requiredDoses - doseCount})`
      : `No matching immunization found`;

  facts.unshift({
    code: 'DOSE_SUMMARY',
    display: summaryDisplay,
    source: 'Immunization Evaluation',
    requiredCount: requiredDoses,
    foundCount: Math.min(doseCount, requiredDoses),
    totalFound: doseCount,
  });

  return {
    met,
    facts,
    incomplete: false,
    matchingRecords,
    requiredCount: requiredDoses,
    foundCount: Math.min(doseCount, requiredDoses),
  };
}

function evaluateAssessment(
  patient             ,
  element             ,
  measure                      ,
  mpStart        ,
  mpEnd
)                                                              {
  // Generic assessment - try to match against any patient data
  const facts                   = [];

  // First check for age requirements
  if (element.description.toLowerCase().includes('age') || element.thresholds?.ageMin || element.thresholds?.ageMax) {
    const ageResult = evaluateAgeRequirement(patient, element, mpStart, mpEnd);
    return { ...ageResult, incomplete: false };
  }

  // Check if this element has no codes configured (incomplete)
  const { codes: codesToMatch, needsCodes } = getCodesFromElement(element, measure);
  if (needsCodes) {
    facts.push({
      code: 'NO_CODES',
      display: `Unable to evaluate — no value set codes configured for: ${element.valueSet?.name || element.description}`,
      source: 'Configuration',
    });
    return { met: false, facts, incomplete: true };
  }

  // Try diagnosis
  const dxResult = evaluateDiagnosis(patient, element, measure, mpStart, mpEnd);
  if (dxResult.met) return dxResult;

  // Try encounters
  const encResult = evaluateEncounter(patient, element, measure, mpStart, mpEnd);
  if (encResult.met) return encResult;

  // Try procedures
  const procResult = evaluateProcedure(patient, element, measure, mpStart, mpEnd);
  if (procResult.met) return procResult;

  // Try observations
  const obsResult = evaluateObservation(patient, element, measure, mpStart, mpEnd);
  if (obsResult.met) return obsResult;

  // Try immunizations (important for childhood measures)
  const immResult = evaluateImmunization(patient, element, measure, mpStart, mpEnd);
  if (immResult.met) return immResult;

  // Try medications
  const medResult = evaluateMedication(patient, element, measure, mpStart, mpEnd);
  if (medResult.met) return medResult;

  // Nothing matched
  facts.push({
    code: 'NO_MATCH',
    display: `No matching data found for: ${element.description}`,
    source: 'Assessment Evaluation',
  });

  return { met: false, facts, incomplete: false };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get codes from element, returning both the codes array and a flag indicating if codes were expected but missing
 */
function getCodesFromElement(element             , measure                      )                                                        {
  const codes                  = [];
  let hasValueSetReference = false;

  // Add direct codes
  if (element.directCodes && element.directCodes.length > 0) {
    codes.push(...element.directCodes);
  }

  // Add codes from value set reference
  if (element.valueSet) {
    hasValueSetReference = true;
    if (element.valueSet.codes && element.valueSet.codes.length > 0) {
      codes.push(...element.valueSet.codes);
    }
  }

  // Look up value set in measure's valueSets array
  if (element.valueSet?.id || element.valueSet?.name || element.valueSet?.oid) {
    hasValueSetReference = true;
    const vsMatch = measure.valueSets?.find(
      vs => vs.id === element.valueSet?.id ||
            vs.name === element.valueSet?.name ||
            vs.oid === element.valueSet?.oid
    );
    if (vsMatch?.codes && vsMatch.codes.length > 0) {
      codes.push(...vsMatch.codes);
    }
  }

  // Determine if this element expects codes but doesn't have them
  const needsCodes = hasValueSetReference && codes.length === 0;

  return { codes, needsCodes, hasValueSetReference };
}

function matchCode(code        , system        , targetCodes                 )          {
  if (targetCodes.length === 0) {
    // No target codes means we can't confirm a match — require actual codes
    return false;
  }

  const normalizedCode = code.replace(/\./g, '').toUpperCase();
  const normalizedSystem = normalizeCodeSystem(system);

  return targetCodes.some(tc => {
    const targetCode = tc.code.replace(/\./g, '').toUpperCase();
    const targetSystem = normalizeCodeSystem(tc.system);

    // Match code (with or without dots)
    const codeMatches = normalizedCode === targetCode || code === tc.code;

    // Match system — accept if systems match, or if either side is unknown
    const systemMatches = normalizedSystem === targetSystem ||
                          !targetSystem ||
                          !normalizedSystem ||
                          normalizedSystem === targetSystem.toUpperCase();

    return codeMatches && systemMatches;
  });
}

function normalizeCodeSystem(system        )         {
  if (!system) return '';
  const lower = system.toLowerCase().trim();

  // Handle FHIR URIs and short names for CPT
  if (lower.includes('cpt') || lower.includes('ama-assn') || lower.includes('ama.org')) return 'CPT';

  // ICD-10-CM
  if (lower.includes('icd-10') || lower.includes('icd10') || lower.includes('10-cm')) return 'ICD10';

  // SNOMED CT
  if (lower.includes('snomed') || lower.includes('sct') || lower === 'http://snomed.info/sct') return 'SNOMED';

  // LOINC
  if (lower.includes('loinc')) return 'LOINC';

  // CVX (vaccine codes)
  if (lower.includes('cvx')) return 'CVX';

  // RxNorm
  if (lower.includes('rxnorm') || lower.includes('nlm.nih.gov/research/umls/rxnorm')) return 'RXNORM';

  // HCPCS
  if (lower.includes('hcpcs')) return 'HCPCS';

  // ICD-9 (legacy)
  if (lower.includes('icd-9') || lower.includes('icd9')) return 'ICD9';

  // NDC (drug codes)
  if (lower.includes('ndc')) return 'NDC';

  return system.toUpperCase();
}

/**
 * Checks if an event date falls within the timing window defined by a structured TimingConstraint.
 * Uses resolveTimingWindow for proper date arithmetic.
 */
function checkTimingConstraint(
  date        ,
  timing                  ,
  mpStart        ,
  mpEnd        
)                                                               {
  const resolved = resolveTimingWindow(timing, mpStart, mpEnd);

  if (!resolved) {
    // Cannot resolve statically (e.g., patient-specific anchors like IPSD)
    // Default to measurement period check as fallback
    const eventDate = new Date(date + 'T00:00:00');
    const startDate = new Date(mpStart + 'T00:00:00');
    const endDate = new Date(mpEnd + 'T23:59:59');
    return {
      inWindow: eventDate >= startDate && eventDate <= endDate,
      resolvedWindow: { from: startDate, to: endDate }
    };
  }

  const eventDate = new Date(date + 'T00:00:00');
  // Extend end date to end of day for inclusive comparison
  const windowEnd = new Date(resolved.to);
  windowEnd.setHours(23, 59, 59, 999);

  return {
    inWindow: eventDate >= resolved.from && eventDate <= windowEnd,
    resolvedWindow: resolved
  };
}

/**
 * Check timing using structured timing formats (TimingOverride or TimingWindowOverride).
 * Falls back to legacy TimingRequirement[] if structured formats aren't available.
 */
function checkTimingStructured(
  date        ,
  element             ,
  mpStart        ,
  mpEnd        
)                                    {
  // Priority 1: Use structured TimingOverride (new timing editor format)
  if (element.timingOverride) {
    const effective = getEffectiveTiming(element.timingOverride);
    if (effective) {
      const { inWindow, resolvedWindow } = checkTimingConstraint(date, effective, mpStart, mpEnd);
      const windowStr = resolvedWindow
        ? `${resolvedWindow.from.toLocaleDateString()} - ${resolvedWindow.to.toLocaleDateString()}`
        : undefined;
      return { met: inWindow, window: windowStr };
    }
  }

  // Priority 2: Fall back to legacy TimingRequirement[]
  const met = checkTiming(date, element.timingRequirements, mpStart, mpEnd);
  return { met };
}

function checkTiming(
  date        ,
  timingRequirements                                 ,
  mpStart        ,
  mpEnd        
)          {
  if (!timingRequirements || timingRequirements.length === 0) {
    // Default: check if within measurement period
    const eventDate = new Date(date + 'T00:00:00');
    const startDate = new Date(mpStart + 'T00:00:00');
    const endDate = new Date(mpEnd + 'T23:59:59');
    return eventDate >= startDate && eventDate <= endDate;
  }

  const eventDate = new Date(date + 'T00:00:00');
  const mpStartDate = new Date(mpStart + 'T00:00:00');
  const mpEndDate = new Date(mpEnd + 'T23:59:59');

  for (const timing of timingRequirements) {
    switch (timing.relativeTo) {
      case 'measurement_period':
        // Check if within measurement period
        if (eventDate >= mpStartDate && eventDate <= mpEndDate) {
          return true;
        }
        // Check window if specified
        if (timing.window) {
          const windowMs = getWindowMs(timing.window);
          if (timing.window.direction === 'before') {
            const windowStart = new Date(mpStartDate.getTime() - windowMs);
            if (eventDate >= windowStart && eventDate <= mpStartDate) {
              return true;
            }
          } else if (timing.window.direction === 'after') {
            const windowEnd = new Date(mpEndDate.getTime() + windowMs);
            if (eventDate >= mpEndDate && eventDate <= windowEnd) {
              return true;
            }
          } else if (timing.window.direction === 'within') {
            const windowStart = new Date(mpStartDate.getTime() - windowMs);
            const windowEnd = new Date(mpEndDate.getTime() + windowMs);
            if (eventDate >= windowStart && eventDate <= windowEnd) {
              return true;
            }
          }
        }
        break;
      default:
        // Default to measurement period check
        if (eventDate >= mpStartDate && eventDate <= mpEndDate) {
          return true;
        }
    }
  }

  return false;
}

function getWindowMs(window                                                    )         {
  const msPerUnit                         = {
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
    years: 365 * 24 * 60 * 60 * 1000,
  };
  return window.value * (msPerUnit[window.unit] || msPerUnit.days);
}

function getElementTitle(element             )         {
  if (element.valueSet?.name) {
    return element.valueSet.name;
  }
  return element.description.substring(0, 50);
}

function generateCqlSnippet(element             )         {
  const type = element.type;
  const vsName = element.valueSet?.name || 'Value Set';

  // Check for timing requirements to include lookback periods
  const timing = element.timingRequirements?.[0];
  let timingClause = 'during "Measurement Period"';

  if (timing?.window) {
    const { value, unit, direction } = timing.window;
    if (direction === 'before' || direction === 'within') {
      timingClause = `${value} ${unit}${value > 1 ? 's' : ''} or less before end of "Measurement Period"`;
    } else if (direction === 'after') {
      timingClause = `${value} ${unit}${value > 1 ? 's' : ''} or less after start of "Measurement Period"`;
    }
  }

  // Special handling for screening procedures with known lookback periods
  const descLower = element.description?.toLowerCase() || '';
  const vsLower = vsName.toLowerCase();

  if (type === 'procedure') {
    if (vsLower.includes('colonoscopy') || descLower.includes('colonoscopy')) {
      timingClause = '10 years or less before end of "Measurement Period"';
    } else if (vsLower.includes('sigmoidoscopy') || descLower.includes('sigmoidoscopy')) {
      timingClause = '5 years or less before end of "Measurement Period"';
    } else if (vsLower.includes('ct colonography') || descLower.includes('ct colonography')) {
      timingClause = '5 years or less before end of "Measurement Period"';
    } else if (vsLower.includes('fit-dna') || vsLower.includes('stool dna') || descLower.includes('fit-dna')) {
      timingClause = '3 years or less before end of "Measurement Period"';
    } else if (vsLower.includes('fobt') || vsLower.includes('fit ') || descLower.includes('fobt') || descLower.includes('fecal')) {
      timingClause = '1 year or less before end of "Measurement Period"';
    } else if (vsLower.includes('pap') || vsLower.includes('cervical cytology') || descLower.includes('pap')) {
      timingClause = '3 years or less before end of "Measurement Period"';
    } else if (vsLower.includes('hpv') || descLower.includes('hpv')) {
      timingClause = '5 years or less before end of "Measurement Period"';
    } else if (vsLower.includes('mammography') || vsLower.includes('mammogram') || descLower.includes('mammogra')) {
      timingClause = '2 years or less before end of "Measurement Period"';
    }
  }

  switch (type) {
    case 'diagnosis':
      return `["Diagnosis": "${vsName}"] D where D.prevalencePeriod overlaps "Measurement Period"`;
    case 'encounter':
      return `["Encounter": "${vsName}"] E where E.period during "Measurement Period"`;
    case 'procedure':
      return `["Procedure": "${vsName}"] P where P.performed ${timingClause}`;
    case 'observation':
      return `["Observation": "${vsName}"] O where O.effective ${timingClause}`;
    case 'medication':
      return `["MedicationRequest": "${vsName}"] M where M.authoredOn during "Measurement Period"`;
    case 'demographic':
      if (element.genderValue) {
        return `Patient.gender = '${element.genderValue}'`;
      }
      return `AgeInYearsAt(start of "Measurement Period") >= ${element.thresholds?.ageMin || 0} and AgeInYearsAt(start of "Measurement Period") <= ${element.thresholds?.ageMax || 120}`;
    default:
      return `// ${element.description}`;
  }
}

function generateNarrative(
  patient             ,
  outcome                                        ,
  measure                      
)         {
  const measureTitle = measure.metadata.title;

  switch (outcome) {
    case 'in_numerator':
      return `${patient.name} meets all criteria for ${measureTitle} and is included in the performance numerator.`;
    case 'not_in_numerator':
      return `${patient.name} is in the denominator for ${measureTitle} but does not meet numerator criteria.`;
    case 'excluded':
      return `${patient.name} meets exclusion criteria and is excluded from ${measureTitle} performance calculation.`;
    case 'not_in_population':
      return `${patient.name} does not meet the initial population criteria for ${measureTitle}.`;
  }
}

function generateHowClose(
  patient             ,
  population                                  ,
  measure                      ,
  mpStart        ,
  mpEnd        
)           {
  const gaps           = [];

  if (!population) return gaps;

  // Analyze what criteria failed
  const analyzeClause = (clause               ) => {
    for (const child of clause.children) {
      if ('operator' in child) {
        analyzeClause(child                 );
      } else {
        const element = child               ;
        const { met } = evaluateDataElement(patient, element, measure, mpStart, mpEnd);
        if (!met) {
          gaps.push(`Missing: ${element.description}`);
        }
      }
    }
  };

  analyzeClause(population.criteria);

  return gaps.slice(0, 3); // Limit to top 3 gaps
}

