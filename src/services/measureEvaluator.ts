/**
 * Measure Evaluator Service
 *
 * Dynamically evaluates test patients against measure criteria
 * to generate validation traces for any measure in the UMS format.
 */

import type {
  UniversalMeasureSpec,
  PopulationDefinition,
  LogicalClause,
  DataElement,
  PatientValidationTrace,
  ValidationNode,
  ValidationFact,
  CodeReference,
  TimingRequirement,
} from '../types/ums';
import {
  getCRCScreeningNumeratorValueSets,
  getCRCScreeningExclusionValueSets,
  isCodeInValueSets,
} from '../constants/standardValueSets';

// ============================================================================
// Test Patient Data Types
// ============================================================================

export interface TestPatient {
  id: string;
  name: string;
  demographics: {
    birthDate: string; // ISO date
    gender: 'male' | 'female' | 'other';
    race?: string;
    ethnicity?: string;
  };
  diagnoses: PatientDiagnosis[];
  encounters: PatientEncounter[];
  procedures: PatientProcedure[];
  observations: PatientObservation[];
  medications: PatientMedication[];
  immunizations?: PatientImmunization[];
}

export interface PatientDiagnosis {
  code: string;
  system: string;
  display: string;
  onsetDate: string;
  status: 'active' | 'resolved' | 'inactive';
}

export interface PatientEncounter {
  code: string;
  system: string;
  display: string;
  date: string;
  type: string;
}

export interface PatientProcedure {
  code: string;
  system: string;
  display: string;
  date: string;
}

export interface PatientObservation {
  code: string;
  system: string;
  display: string;
  date: string;
  value?: number;
  unit?: string;
  valueString?: string;
}

export interface PatientMedication {
  code: string;
  system: string;
  display: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'stopped';
}

export interface PatientImmunization {
  code: string;
  system: string;
  display: string;
  date: string;
  status: 'completed' | 'not-done';
}

// ============================================================================
// Main Evaluation Function
// ============================================================================

/**
 * Evaluate a test patient against a measure and generate a validation trace
 */
export function evaluatePatient(
  patient: TestPatient,
  measure: UniversalMeasureSpec,
  measurementPeriod?: { start: string; end: string }
): PatientValidationTrace {
  // Default measurement period to current year
  const mpStart = measurementPeriod?.start || `${new Date().getFullYear()}-01-01`;
  const mpEnd = measurementPeriod?.end || `${new Date().getFullYear()}-12-31`;

  // Find each population type
  const ipPop = measure.populations.find(p => p.type === 'initial_population');
  const denomPop = measure.populations.find(p => p.type === 'denominator');
  const denomExclPop = measure.populations.find(p => p.type === 'denominator_exclusion');
  const denomExcepPop = measure.populations.find(p => p.type === 'denominator_exception');
  const numerPop = measure.populations.find(p => p.type === 'numerator');
  const _numerExclPop = measure.populations.find(p => p.type === 'numerator_exclusion');

  // Evaluate each population
  const ipResult = ipPop
    ? evaluatePopulation(patient, ipPop, measure, mpStart, mpEnd)
    : { met: true, nodes: [] };

  const denomResult = denomPop && ipResult.met
    ? evaluatePopulation(patient, denomPop, measure, mpStart, mpEnd)
    : { met: ipResult.met, nodes: [] }; // If no separate denominator, use IP result

  // Evaluate defined exclusion criteria
  let exclusionResult = denomExclPop && denomResult.met
    ? evaluatePopulation(patient, denomExclPop, measure, mpStart, mpEnd)
    : { met: false, nodes: [] };

  // Also check for common exclusion patterns (fallback detection)
  if (!exclusionResult.met && denomResult.met) {
    const commonExclusion = checkCommonExclusions(patient, measure);
    if (commonExclusion.met) {
      exclusionResult = commonExclusion;
    }
  }

  const _exceptionResult = denomExcepPop && denomResult.met && !exclusionResult.met
    ? evaluatePopulation(patient, denomExcepPop, measure, mpStart, mpEnd)
    : { met: false, nodes: [] };

  let numerResult = numerPop && denomResult.met && !exclusionResult.met
    ? evaluatePopulation(patient, numerPop, measure, mpStart, mpEnd)
    : { met: false, nodes: [] };

  // If numerator not met via measure-defined criteria, check against standard value sets
  // This handles cases where the measure's value sets are incomplete
  if (!numerResult.met && denomResult.met && !exclusionResult.met) {
    const isCRCMeasure = measure.metadata.title.toLowerCase().includes('colorectal') ||
                         measure.metadata.title.toLowerCase().includes('colon') ||
                         measure.metadata.measureId?.toUpperCase().includes('CMS130');

    if (isCRCMeasure) {
      const crcNumerator = checkCRCScreeningNumerator(patient, mpStart, mpEnd);
      if (crcNumerator.met) {
        numerResult = crcNumerator;
        console.log(`Numerator met via standard CRC value sets for ${patient.name}`);
      }
    }
  }

  // Determine final outcome
  let finalOutcome: PatientValidationTrace['finalOutcome'];
  let howClose: string[] = [];

  if (!ipResult.met) {
    finalOutcome = 'not_in_population';
    howClose = generateHowClose(patient, ipPop, measure, mpStart, mpEnd);
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
  patient: TestPatient,
  population: PopulationDefinition,
  measure: UniversalMeasureSpec,
  mpStart: string,
  mpEnd: string
): { met: boolean; nodes: ValidationNode[] } {
  const nodes: ValidationNode[] = [];

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
  patient: TestPatient,
  clause: LogicalClause,
  measure: UniversalMeasureSpec,
  mpStart: string,
  mpEnd: string
): { met: boolean; childNodes: ValidationNode[]; matchCount?: { met: number; total: number } } {
  const childNodes: ValidationNode[] = [];
  const results: boolean[] = [];

  for (const child of clause.children) {
    if ('operator' in child) {
      // It's a nested LogicalClause
      const { met, childNodes: nestedNodes } = evaluateClause(
        patient,
        child as LogicalClause,
        measure,
        mpStart,
        mpEnd
      );
      results.push(met);
      childNodes.push(...nestedNodes);
    } else {
      // It's a DataElement
      const { met, node } = evaluateDataElement(
        patient,
        child as DataElement,
        measure,
        mpStart,
        mpEnd
      );
      results.push(met);
      if (node) childNodes.push(node);
    }
  }

  // Track partial matches for AND clauses
  const metCount = results.filter(r => r).length;
  const totalCount = results.length;

  // Apply logical operator
  let met: boolean;
  switch (clause.operator) {
    case 'AND':
      met = results.every(r => r);
      // Add a summary node for AND clauses showing partial progress
      if (totalCount > 1) {
        childNodes.unshift({
          id: `${clause.operator}-summary`,
          title: `Progress: ${metCount} of ${totalCount} criteria met`,
          type: 'decision',
          description: met ? 'All criteria satisfied' : `${totalCount - metCount} criteria remaining`,
          status: met ? 'pass' : (metCount > 0 ? 'partial' : 'fail'),
          facts: [{
            code: 'PROGRESS',
            display: `${metCount}/${totalCount} criteria met`,
            source: 'Clause Evaluation',
          }],
        });
      }
      break;
    case 'OR':
      met = results.some(r => r);
      break;
    case 'NOT':
      met = results.length > 0 ? !results[0] : true;
      break;
    default:
      met = results.every(r => r);
  }

  return { met, childNodes, matchCount: { met: metCount, total: totalCount } };
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

function descriptionSuggestsImmunization(desc: string): boolean {
  const lower = desc.toLowerCase();
  return IMMUNIZATION_KEYWORDS.some(kw => lower.includes(kw));
}

function evaluateDataElement(
  patient: TestPatient,
  element: DataElement,
  measure: UniversalMeasureSpec,
  mpStart: string,
  mpEnd: string
): { met: boolean; node: ValidationNode | null } {
  const facts: ValidationFact[] = [];
  let met = false;
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
      const node: ValidationNode = {
        id: element.id,
        title: getElementTitle(element),
        type: 'decision',
        description,
        status: met ? 'pass' : 'fail',
        facts,
        cqlSnippet: generateCqlSnippet(element),
        source: 'Test Patient Data',
      };
      return { met, node };
    }
  }

  switch (element.type) {
    case 'demographic':
      const ageResult = evaluateAgeRequirement(patient, element, mpStart, mpEnd);
      met = ageResult.met;
      facts.push(...ageResult.facts);
      break;

    case 'diagnosis':
      const dxResult = evaluateDiagnosis(patient, element, measure, mpStart, mpEnd);
      met = dxResult.met;
      facts.push(...dxResult.facts);
      break;

    case 'encounter':
      const encResult = evaluateEncounter(patient, element, measure, mpStart, mpEnd);
      met = encResult.met;
      facts.push(...encResult.facts);
      break;

    case 'procedure':
      const procResult = evaluateProcedure(patient, element, measure, mpStart, mpEnd);
      met = procResult.met;
      facts.push(...procResult.facts);
      // If procedure didn't match but looks like immunization, try that too
      if (!met && looksLikeImmunization) {
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
      facts.push(...obsResult.facts);
      break;

    case 'medication':
      const medResult = evaluateMedication(patient, element, measure, mpStart, mpEnd);
      met = medResult.met;
      facts.push(...medResult.facts);
      break;

    case 'immunization':
      const immResult2 = evaluateImmunization(patient, element, measure, mpStart, mpEnd);
      met = immResult2.met;
      facts.push(...immResult2.facts);
      break;

    case 'assessment':
    default:
      // Generic assessment - check if any matching data exists
      const assessResult = evaluateAssessment(patient, element, measure, mpStart, mpEnd);
      met = assessResult.met;
      facts.push(...assessResult.facts);
      break;
  }

  const node: ValidationNode = {
    id: element.id,
    title: getElementTitle(element),
    type: 'decision',
    description,
    status: met ? 'pass' : 'fail',
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
  patient: TestPatient,
  element: DataElement,
  mpStart: string,
  mpEnd?: string
): { met: boolean; facts: ValidationFact[] } {
  const facts: ValidationFact[] = [];

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
  const turnsAgeDuring = (targetAge: number): boolean => {
    const targetBirthday = new Date(birthDate);
    targetBirthday.setFullYear(birthDate.getFullYear() + targetAge);
    return targetBirthday >= mpStartDate && targetBirthday <= mpEndDate;
  };

  // Helper: Get the birthday that falls in the measurement year
  const getBirthdayInMeasurementYear = (): Date => {
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

  // Check against thresholds
  const thresholds = element.thresholds;
  let met = true;

  if (thresholds) {
    const targetAge = thresholds.ageMin;

    // For pediatric measures (small age values), check if child "turns X" during the year
    // This is the standard definition for measures like CMS117 (Childhood Immunization)
    if (targetAge !== undefined && targetAge <= 18) {
      // Check if the child turns the target age during the measurement period
      const turnsTargetAge = turnsAgeDuring(targetAge);

      // Also check the range: age at end should be >= min and age at start should be <= max
      const meetsMinAtEnd = thresholds.ageMin === undefined || ageAtEnd >= thresholds.ageMin;
      const meetsMaxAtStart = thresholds.ageMax === undefined || ageAtStart <= thresholds.ageMax;

      if (turnsTargetAge || (meetsMinAtEnd && meetsMaxAtStart)) {
        met = true;
        const birthdayInYear = getBirthdayInMeasurementYear();
        facts.push({
          code: 'AGE_TURNS',
          display: `Turns ${targetAge} on ${birthdayInYear.toLocaleDateString()} (within MP)`,
          source: 'Age Evaluation',
        });
      } else {
        met = false;
        facts.push({
          code: 'AGE_MIN_FAIL',
          display: `Does not turn ${targetAge} during measurement period`,
          source: 'Age Evaluation',
        });
      }
    } else {
      // For adult measures, use traditional age-at-point-in-time logic
      if (thresholds.ageMin !== undefined && ageAtEnd < thresholds.ageMin) {
        met = false;
        facts.push({
          code: 'AGE_MIN_FAIL',
          display: `Age ${ageAtEnd} < minimum ${thresholds.ageMin}`,
          source: 'Age Evaluation',
        });
      }
      if (thresholds.ageMax !== undefined && ageAtStart > thresholds.ageMax) {
        met = false;
        facts.push({
          code: 'AGE_MAX_FAIL',
          display: `Age ${ageAtStart} > maximum ${thresholds.ageMax}`,
          source: 'Age Evaluation',
        });
      }
    }
  }

  // Also check additionalRequirements for age patterns
  if (element.additionalRequirements) {
    for (const req of element.additionalRequirements) {
      // Check for "turns X" pattern (e.g., "turns 2 during measurement period")
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
        continue;
      }

      const ageMatch = req.match(/Age\s*(\d+)\s*-\s*(\d+)/i);
      if (ageMatch) {
        const minAge = parseInt(ageMatch[1]);
        const maxAge = parseInt(ageMatch[2]);
        // Use ageAtEnd for min check, ageAtStart for max check
        if (ageAtEnd < minAge || ageAtStart > maxAge) {
          met = false;
          facts.push({
            code: 'AGE_RANGE_FAIL',
            display: `Age outside required range ${minAge}-${maxAge}`,
            source: 'Age Evaluation',
          });
        }
      }
    }
  }

  return { met, facts };
}

function evaluateDiagnosis(
  patient: TestPatient,
  element: DataElement,
  measure: UniversalMeasureSpec,
  mpStart: string,
  mpEnd: string
): { met: boolean; facts: ValidationFact[] } {
  const facts: ValidationFact[] = [];
  let met = false;

  // Get codes to match against
  const codesToMatch = getCodesFromElement(element, measure);

  for (const dx of patient.diagnoses) {
    // Check if diagnosis code matches
    const codeMatches = matchCode(dx.code, dx.system, codesToMatch);

    if (codeMatches) {
      // Check timing if required
      const timingOk = checkTiming(dx.onsetDate, element.timingRequirements, mpStart, mpEnd);

      if (timingOk) {
        met = true;
        facts.push({
          code: dx.code,
          display: dx.display,
          date: dx.onsetDate,
          source: 'Problem List',
        });
      }
    }
  }

  if (!met) {
    facts.push({
      code: 'NO_MATCH',
      display: `No matching diagnosis found for: ${element.description}`,
      source: 'Diagnosis Evaluation',
    });
  }

  return { met, facts };
}

// Common outpatient/office visit CPT codes for fallback matching
const COMMON_OFFICE_VISIT_CODES = [
  // Office/Outpatient Visit - New Patient
  '99201', '99202', '99203', '99204', '99205',
  // Office/Outpatient Visit - Established Patient
  '99211', '99212', '99213', '99214', '99215',
  // Preventive Visit - New Patient
  '99381', '99382', '99383', '99384', '99385', '99386', '99387',
  // Preventive Visit - Established Patient
  '99391', '99392', '99393', '99394', '99395', '99396', '99397',
  // Telehealth
  '99441', '99442', '99443',
];

// Common cervical cytology (Pap test) CPT codes for cervical cancer screening
const CERVICAL_CYTOLOGY_CODES = [
  // Cytopathology cervical/vaginal
  '88141', '88142', '88143', '88147', '88148',
  '88150', '88152', '88153', '88164', '88165',
  '88166', '88167', '88174', '88175',
  // HPV testing
  '87620', '87621', '87622', '87624', '87625',
];

// Common colonoscopy/colorectal screening CPT codes
const COLORECTAL_SCREENING_CODES = [
  // Colonoscopy
  '44388', '44389', '44390', '44391', '44392',
  '44393', '44394', '44397', '45355', '45378',
  '45379', '45380', '45381', '45382', '45383',
  '45384', '45385', '45386', '45387', '45388',
  '45389', '45390', '45391', '45392', '45393',
  // FIT/FOBT
  '82270', '82274',
  // Sigmoidoscopy
  '45330', '45331', '45332', '45333', '45334', '45335',
];

function evaluateEncounter(
  patient: TestPatient,
  element: DataElement,
  measure: UniversalMeasureSpec,
  mpStart: string,
  mpEnd: string
): { met: boolean; facts: ValidationFact[] } {
  const facts: ValidationFact[] = [];
  let met = false;

  const codesToMatch = getCodesFromElement(element, measure);
  const descLower = element.description.toLowerCase();

  // Determine if this is a generic "office visit" or "outpatient" encounter requirement
  const isGenericOfficeVisit = codesToMatch.length === 0 ||
    descLower.includes('office visit') ||
    descLower.includes('outpatient') ||
    descLower.includes('qualifying encounter') ||
    descLower.includes('qualifying visit') ||
    descLower.includes('face-to-face') ||
    descLower.includes('preventive');

  for (const enc of patient.encounters) {
    let codeMatches = matchCode(enc.code, enc.system, codesToMatch);

    // Fallback: if no specific codes or generic office visit, accept common visit codes
    if (!codeMatches && isGenericOfficeVisit) {
      codeMatches = COMMON_OFFICE_VISIT_CODES.includes(enc.code);
    }

    if (codeMatches) {
      const timingOk = checkTiming(enc.date, element.timingRequirements, mpStart, mpEnd);

      if (timingOk) {
        met = true;
        facts.push({
          code: enc.code,
          display: enc.display,
          date: enc.date,
          source: 'Encounters',
        });
      }
    }
  }

  if (!met) {
    facts.push({
      code: 'NO_MATCH',
      display: `No matching encounter found for: ${element.description}`,
      source: 'Encounter Evaluation',
    });
  }

  return { met, facts };
}

function evaluateProcedure(
  patient: TestPatient,
  element: DataElement,
  measure: UniversalMeasureSpec,
  mpStart: string,
  mpEnd: string
): { met: boolean; facts: ValidationFact[] } {
  const facts: ValidationFact[] = [];
  let met = false;

  const codesToMatch = getCodesFromElement(element, measure);
  const descLower = element.description.toLowerCase();

  // Determine if this is a screening-type procedure that can use fallback codes
  const isCervicalScreening = descLower.includes('cervical') ||
    descLower.includes('pap') ||
    descLower.includes('cytology') ||
    descLower.includes('hpv');

  const isColorectalScreening = descLower.includes('colonoscopy') ||
    descLower.includes('colorectal') ||
    descLower.includes('colon') ||
    descLower.includes('fobt') ||
    descLower.includes('fit ') ||
    descLower.includes('fecal') ||
    descLower.includes('sigmoidoscopy');

  for (const proc of patient.procedures) {
    let codeMatches = matchCode(proc.code, proc.system, codesToMatch);

    // Fallback: if no match found via defined codes, try common screening codes
    // This handles cases where the value set is incomplete or uses different code systems
    if (!codeMatches) {
      if (isCervicalScreening && CERVICAL_CYTOLOGY_CODES.includes(proc.code)) {
        codeMatches = true;
        console.log(`Cervical screening fallback match: ${proc.code} - ${proc.display}`);
      } else if (isColorectalScreening && COLORECTAL_SCREENING_CODES.includes(proc.code)) {
        codeMatches = true;
        console.log(`Colorectal screening fallback match: ${proc.code} - ${proc.display}`);
      }
    }

    if (codeMatches) {
      const timingOk = checkTiming(proc.date, element.timingRequirements, mpStart, mpEnd);

      if (timingOk) {
        met = true;
        facts.push({
          code: proc.code,
          display: proc.display,
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
        const timingOk = checkTiming(imm.date, element.timingRequirements, mpStart, mpEnd);

        if (timingOk) {
          met = true;
          facts.push({
            code: imm.code,
            display: imm.display,
            date: imm.date,
            source: 'Immunizations',
          });
        }
      }
    }
  }

  if (!met) {
    facts.push({
      code: 'NO_MATCH',
      display: `No matching procedure/immunization found for: ${element.description}`,
      source: 'Procedure Evaluation',
    });
  }

  return { met, facts };
}

function evaluateObservation(
  patient: TestPatient,
  element: DataElement,
  measure: UniversalMeasureSpec,
  mpStart: string,
  mpEnd: string
): { met: boolean; facts: ValidationFact[] } {
  const facts: ValidationFact[] = [];
  let met = false;

  const codesToMatch = getCodesFromElement(element, measure);

  for (const obs of patient.observations) {
    const codeMatches = matchCode(obs.code, obs.system, codesToMatch);

    if (codeMatches) {
      const timingOk = checkTiming(obs.date, element.timingRequirements, mpStart, mpEnd);

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

  if (!met) {
    facts.push({
      code: 'NO_MATCH',
      display: `No matching observation found for: ${element.description}`,
      source: 'Observation Evaluation',
    });
  }

  return { met, facts };
}

function evaluateMedication(
  patient: TestPatient,
  element: DataElement,
  measure: UniversalMeasureSpec,
  mpStart: string,
  mpEnd: string
): { met: boolean; facts: ValidationFact[] } {
  const facts: ValidationFact[] = [];
  let met = false;

  const codesToMatch = getCodesFromElement(element, measure);

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

  if (!met) {
    facts.push({
      code: 'NO_MATCH',
      display: `No matching medication found for: ${element.description}`,
      source: 'Medication Evaluation',
    });
  }

  return { met, facts };
}

// Common childhood immunization CVX codes mapped by vaccine type
const IMMUNIZATION_CVX_CODES: Record<string, string[]> = {
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
  patient: TestPatient,
  element: DataElement,
  measure: UniversalMeasureSpec,
  mpStart: string,
  mpEnd: string
): { met: boolean; facts: ValidationFact[] } {
  const facts: ValidationFact[] = [];

  if (!patient.immunizations || patient.immunizations.length === 0) {
    facts.push({
      code: 'NO_IMMUNIZATIONS',
      display: 'No immunization records found for patient',
      source: 'Immunization Evaluation',
    });
    return { met: false, facts };
  }

  const codesToMatch = getCodesFromElement(element, measure);
  const descLower = element.description.toLowerCase();

  // Extract required dose count from description (e.g., "4 DTaP" or "three doses")
  const doseMatch = descLower.match(/(\d+)\s*(dose|shot|vaccine|dtap|ipv|mmr|hib|hep|pcv|rota|varicella)/i);
  const wordDoseMatch = descLower.match(/(one|two|three|four|five)\s*(dose|shot|vaccine)/i);
  let requiredDoses = 1;
  if (doseMatch) {
    requiredDoses = parseInt(doseMatch[1]);
  } else if (wordDoseMatch) {
    const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    requiredDoses = wordToNum[wordDoseMatch[1].toLowerCase()] || 1;
  }

  // Determine CVX codes to match based on description keywords
  let fallbackCvxCodes: string[] = [];
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

  const matchingImmunizations: typeof patient.immunizations = [];

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
      } else if (element.timingRequirements && element.timingRequirements.length > 0) {
        // Use standard timing check
        timingOk = checkTiming(imm.date, element.timingRequirements, mpStart, mpEnd);
      }

      if (timingOk) {
        matchingImmunizations.push(imm);
        facts.push({
          code: imm.code,
          display: imm.display,
          date: imm.date,
          source: 'Immunizations',
        });
      }
    }
  }

  const doseCount = matchingImmunizations.length;
  const met = doseCount >= requiredDoses;

  // Add summary fact
  if (requiredDoses > 1) {
    facts.unshift({
      code: 'DOSE_COUNT',
      display: `${doseCount} of ${requiredDoses} required doses found`,
      source: 'Immunization Evaluation',
    });
  }

  if (!met && doseCount === 0) {
    facts.push({
      code: 'NO_MATCH',
      display: `No matching immunization found for: ${element.description}`,
      source: 'Immunization Evaluation',
    });
  } else if (!met && doseCount > 0) {
    facts.push({
      code: 'INSUFFICIENT_DOSES',
      display: `Only ${doseCount} of ${requiredDoses} required doses found`,
      source: 'Immunization Evaluation',
    });
  }

  return { met, facts };
}

function evaluateAssessment(
  patient: TestPatient,
  element: DataElement,
  measure: UniversalMeasureSpec,
  mpStart: string,
  mpEnd: string
): { met: boolean; facts: ValidationFact[] } {
  // Generic assessment - try to match against any patient data
  const facts: ValidationFact[] = [];

  // First check for age requirements
  if (element.description.toLowerCase().includes('age') || element.thresholds?.ageMin || element.thresholds?.ageMax) {
    return evaluateAgeRequirement(patient, element, mpStart, mpEnd);
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

  return { met: false, facts };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getCodesFromElement(element: DataElement, measure: UniversalMeasureSpec): CodeReference[] {
  const codes: CodeReference[] = [];

  // Add direct codes
  if (element.directCodes) {
    codes.push(...element.directCodes);
  }

  // Add codes from value set reference
  if (element.valueSet?.codes) {
    codes.push(...element.valueSet.codes);
  }

  // Look up value set in measure's valueSets array
  if (element.valueSet?.id || element.valueSet?.name) {
    const vsMatch = measure.valueSets.find(
      vs => vs.id === element.valueSet?.id ||
            vs.name === element.valueSet?.name ||
            vs.oid === element.valueSet?.oid
    );
    if (vsMatch?.codes) {
      codes.push(...vsMatch.codes);
    }
  }

  return codes;
}

function matchCode(code: string, system: string, targetCodes: CodeReference[]): boolean {
  if (targetCodes.length === 0) {
    // If no specific codes, consider it a match (generic criteria)
    return true;
  }

  const normalizedCode = code.replace(/\./g, '').toUpperCase();
  const normalizedSystem = normalizeCodeSystem(system);

  return targetCodes.some(tc => {
    const targetCode = tc.code.replace(/\./g, '').toUpperCase();
    const targetSystem = normalizeCodeSystem(tc.system);

    // Match code (with or without dots)
    const codeMatches = normalizedCode === targetCode || code === tc.code;

    // Match system (flexible matching)
    const systemMatches = normalizedSystem === targetSystem ||
                          !targetSystem ||
                          !normalizedSystem;

    return codeMatches && systemMatches;
  });
}

function normalizeCodeSystem(system: string): string {
  const lower = system.toLowerCase();
  if (lower.includes('icd') || lower.includes('10-cm')) return 'ICD10';
  if (lower.includes('snomed') || lower.includes('sct')) return 'SNOMED';
  if (lower.includes('cpt')) return 'CPT';
  if (lower.includes('hcpcs')) return 'HCPCS';
  if (lower.includes('loinc')) return 'LOINC';
  if (lower.includes('rxnorm') || lower.includes('rx')) return 'RxNorm';
  if (lower.includes('cvx')) return 'CVX';
  return system.toUpperCase();
}

/**
 * Check for exclusions using comprehensive standard value sets
 * This uses the complete published value sets from VSAC for accurate detection
 */
function checkCommonExclusions(
  patient: TestPatient,
  _measure: UniversalMeasureSpec
): { met: boolean; nodes: ValidationNode[] } {
  const nodes: ValidationNode[] = [];

  // Get exclusion value sets for this measure type
  const exclusionValueSets = getCRCScreeningExclusionValueSets();

  // Check diagnoses against exclusion value sets
  for (const dx of patient.diagnoses) {
    const result = isCodeInValueSets(dx.code, dx.system, exclusionValueSets);
    if (result.found && result.valueSet) {
      const node: ValidationNode = {
        id: `excl-dx-${result.valueSet.id}`,
        title: `Exclusion: ${result.valueSet.name}`,
        type: 'decision',
        description: `Patient has ${result.valueSet.name} diagnosis (OID: ${result.valueSet.oid})`,
        status: 'pass',
        facts: [{
          code: dx.code,
          display: dx.display,
          date: dx.onsetDate,
          source: `Problem List (matched ${result.valueSet.name})`,
        }],
        cqlSnippet: `exists ([Diagnosis: "${result.valueSet.name}"])`,
        source: `Standard Value Set: ${result.valueSet.oid}`,
      };
      nodes.push(node);
      console.log(`Exclusion detected via value set "${result.valueSet.name}": ${dx.code} - ${dx.display}`);
      return { met: true, nodes };
    }
  }

  // Check procedures against exclusion value sets
  for (const proc of patient.procedures) {
    const result = isCodeInValueSets(proc.code, proc.system, exclusionValueSets);
    if (result.found && result.valueSet) {
      const node: ValidationNode = {
        id: `excl-proc-${result.valueSet.id}`,
        title: `Exclusion: ${result.valueSet.name}`,
        type: 'decision',
        description: `Patient has ${result.valueSet.name} procedure (OID: ${result.valueSet.oid})`,
        status: 'pass',
        facts: [{
          code: proc.code,
          display: proc.display,
          date: proc.date,
          source: `Procedures (matched ${result.valueSet.name})`,
        }],
        cqlSnippet: `exists ([Procedure: "${result.valueSet.name}"])`,
        source: `Standard Value Set: ${result.valueSet.oid}`,
      };
      nodes.push(node);
      console.log(`Exclusion detected via value set "${result.valueSet.name}": ${proc.code} - ${proc.display}`);
      return { met: true, nodes };
    }
  }

  // Check encounters for hospice type
  for (const enc of patient.encounters) {
    if (enc.type === 'hospice') {
      const node: ValidationNode = {
        id: 'excl-enc-hospice',
        title: 'Exclusion: Hospice Care Encounter',
        type: 'decision',
        description: 'Patient has hospice care encounter',
        status: 'pass',
        facts: [{
          code: enc.code,
          display: enc.display,
          date: enc.date,
          source: 'Encounters (hospice type)',
        }],
        cqlSnippet: 'exists ([Encounter: "Hospice Encounter"])',
        source: 'Encounter Type Detection',
      };
      nodes.push(node);
      console.log(`Exclusion detected: Hospice encounter type`);
      return { met: true, nodes };
    }

    // Also check encounter codes against hospice value set
    const result = isCodeInValueSets(enc.code, enc.system, exclusionValueSets);
    if (result.found && result.valueSet?.id === 'hospice-care') {
      const node: ValidationNode = {
        id: 'excl-enc-hospice-code',
        title: 'Exclusion: Hospice Care',
        type: 'decision',
        description: `Patient has hospice care encounter code (OID: ${result.valueSet.oid})`,
        status: 'pass',
        facts: [{
          code: enc.code,
          display: enc.display,
          date: enc.date,
          source: `Encounters (matched ${result.valueSet.name})`,
        }],
        cqlSnippet: `exists ([Encounter: "Hospice Care"])`,
        source: `Standard Value Set: ${result.valueSet.oid}`,
      };
      nodes.push(node);
      console.log(`Exclusion detected via hospice encounter code: ${enc.code}`);
      return { met: true, nodes };
    }
  }

  return { met: false, nodes: [] };
}

/**
 * Check if patient meets CRC screening numerator criteria using standard value sets
 */
function checkCRCScreeningNumerator(
  patient: TestPatient,
  _mpStart: string,
  mpEnd: string
): { met: boolean; nodes: ValidationNode[]; screeningType?: string } {
  const nodes: ValidationNode[] = [];
  const numeratorValueSets = getCRCScreeningNumeratorValueSets();
  const mpEndDate = new Date(mpEnd);

  // Check procedures for screening tests
  for (const proc of patient.procedures) {
    const result = isCodeInValueSets(proc.code, proc.system, numeratorValueSets);
    if (result.found && result.valueSet) {
      const procDate = new Date(proc.date);

      // Check timing based on screening type
      let validPeriodYears: number;
      let screeningType = result.valueSet.name;

      switch (result.valueSet.id) {
        case 'colonoscopy':
          validPeriodYears = 10;
          break;
        case 'flexible-sigmoidoscopy':
          validPeriodYears = 5;
          break;
        case 'ct-colonography':
          validPeriodYears = 5;
          break;
        case 'fit-dna':
          validPeriodYears = 3;
          break;
        case 'fobt':
          validPeriodYears = 1;
          break;
        default:
          validPeriodYears = 10;
      }

      // Check if within valid period
      const cutoffDate = new Date(mpEndDate);
      cutoffDate.setFullYear(cutoffDate.getFullYear() - validPeriodYears);

      if (procDate >= cutoffDate) {
        const node: ValidationNode = {
          id: `numer-proc-${result.valueSet.id}`,
          title: `Numerator: ${result.valueSet.name}`,
          type: 'decision',
          description: `Patient has ${screeningType} within ${validPeriodYears} years (OID: ${result.valueSet.oid})`,
          status: 'pass',
          facts: [{
            code: proc.code,
            display: proc.display,
            date: proc.date,
            source: `Procedures (matched ${result.valueSet.name})`,
          }],
          cqlSnippet: `exists ([Procedure: "${result.valueSet.name}"] P where P.performed ${validPeriodYears} years or less before end of "Measurement Period")`,
          source: `Standard Value Set: ${result.valueSet.oid}`,
        };
        nodes.push(node);
        console.log(`Numerator met via ${screeningType}: ${proc.code} on ${proc.date}`);
        return { met: true, nodes, screeningType };
      } else {
        console.log(`${screeningType} found but outside ${validPeriodYears}-year window: ${proc.date}`);
      }
    }
  }

  // Check observations for FOBT/FIT results
  for (const obs of patient.observations) {
    const result = isCodeInValueSets(obs.code, obs.system, numeratorValueSets);
    if (result.found && result.valueSet?.id === 'fobt') {
      const obsDate = new Date(obs.date);
      const cutoffDate = new Date(mpEndDate);
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);

      if (obsDate >= cutoffDate) {
        const node: ValidationNode = {
          id: 'numer-obs-fobt',
          title: 'Numerator: FOBT Result',
          type: 'decision',
          description: `Patient has FOBT result within 1 year (OID: ${result.valueSet.oid})`,
          status: 'pass',
          facts: [{
            code: obs.code,
            display: obs.display,
            date: obs.date,
            source: `Observations (matched ${result.valueSet.name})`,
          }],
          cqlSnippet: `exists ([Observation: "FOBT"] O where O.effective 1 year or less before end of "Measurement Period")`,
          source: `Standard Value Set: ${result.valueSet.oid}`,
        };
        nodes.push(node);
        console.log(`Numerator met via FOBT observation: ${obs.code} on ${obs.date}`);
        return { met: true, nodes, screeningType: 'FOBT' };
      }
    }
  }

  return { met: false, nodes };
}

function checkTiming(
  date: string,
  timingRequirements: TimingRequirement[] | undefined,
  mpStart: string,
  mpEnd: string
): boolean {
  if (!timingRequirements || timingRequirements.length === 0) {
    // Default: check if within measurement period
    const eventDate = new Date(date);
    const startDate = new Date(mpStart);
    const endDate = new Date(mpEnd);
    return eventDate >= startDate && eventDate <= endDate;
  }

  const eventDate = new Date(date);
  const mpStartDate = new Date(mpStart);
  const mpEndDate = new Date(mpEnd);

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

function getWindowMs(window: { value: number; unit: string; direction: string }): number {
  const msPerUnit: Record<string, number> = {
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
    years: 365 * 24 * 60 * 60 * 1000,
  };
  return window.value * (msPerUnit[window.unit] || msPerUnit.days);
}

function getElementTitle(element: DataElement): string {
  if (element.valueSet?.name) {
    return element.valueSet.name;
  }
  return element.description.substring(0, 50);
}

function generateCqlSnippet(element: DataElement): string {
  const type = element.type;
  const vsName = element.valueSet?.name || 'Value Set';

  switch (type) {
    case 'diagnosis':
      return `["Diagnosis": "${vsName}"] D where D.prevalencePeriod overlaps "Measurement Period"`;
    case 'encounter':
      return `["Encounter": "${vsName}"] E where E.period during "Measurement Period"`;
    case 'procedure':
      return `["Procedure": "${vsName}"] P where P.performed during "Measurement Period"`;
    case 'observation':
      return `["Observation": "${vsName}"] O where O.effective during "Measurement Period"`;
    case 'medication':
      return `["MedicationRequest": "${vsName}"] M where M.authoredOn during "Measurement Period"`;
    case 'demographic':
      return `AgeInYearsAt(start of "Measurement Period") >= ${element.thresholds?.ageMin || 0} and AgeInYearsAt(start of "Measurement Period") <= ${element.thresholds?.ageMax || 120}`;
    default:
      return `// ${element.description}`;
  }
}

function generateNarrative(
  patient: TestPatient,
  outcome: PatientValidationTrace['finalOutcome'],
  measure: UniversalMeasureSpec
): string {
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
  patient: TestPatient,
  population: PopulationDefinition | undefined,
  measure: UniversalMeasureSpec,
  mpStart: string,
  mpEnd: string
): string[] {
  const gaps: string[] = [];

  if (!population) return gaps;

  // Analyze what criteria failed
  const analyzeClause = (clause: LogicalClause) => {
    for (const child of clause.children) {
      if ('operator' in child) {
        analyzeClause(child as LogicalClause);
      } else {
        const element = child as DataElement;
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

