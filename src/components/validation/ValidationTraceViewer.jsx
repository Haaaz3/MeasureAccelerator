import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Info, Code, FileText, User, AlertTriangle, Cpu, FileCode, Database, ChevronDown, ChevronUp, Heart, Calendar, Stethoscope, Pill, Syringe, Activity, Edit3, X, Save, Plus, Trash2, Library, ChevronRight, ArrowUpDown, Filter, ArrowUp, ArrowDown } from 'lucide-react';
import { useMeasureStore } from '../../stores/measureStore';
import { generateTestPatients } from '../../services/testPatientGenerator';
import { evaluatePatient } from '../../services/measureEvaluator';

/** Strip standalone AND/OR/NOT operators that appear as line separators in descriptions */
function cleanDescription(desc                    )         {
  if (!desc) return '';
  return desc
    .replace(/\n\s*(AND|OR|NOT)\s*\n/gi, ' ')
    .replace(/\n\s*(AND|OR|NOT)\s*$/gi, '')
    .replace(/^\s*(AND|OR|NOT)\s*\n/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const CODE_FORMAT_INFO                                                                                = {
  cql: { label: 'CQL', icon: FileCode, color: 'text-purple-400' },
  synapse: { label: 'Synapse SQL', icon: Database, color: 'text-[var(--accent)]' },
};

// Test patients with complex EMR data - named after Dune & Hyperion characters
const _DEMO_TRACES                           = [
  // ===== PATIENT 1: Paul Atreides - Not in Numerator (no qualifying BP readings) =====
  {
    patientId: 'pt-001',
    patientName: 'Paul Atreides',
    narrative: 'Paul meets the Initial Population (age 42, Essential Hypertension I10, qualifying office visits 99213/99214) and is in the Denominator. No exclusions apply. The Numerator is NOT met because while blood pressure was recorded, the most recent same-day SBP/DBP pair (148/94 on 2025-09-15) exceeds thresholds.',
    populations: {
      initialPopulation: {
        met: true,
        nodes: [
          {
            id: 'ip-age',
            title: 'Age 18–85 at end of MP',
            type: 'initial_population',
            description: 'Patient age calculated at measurement period end',
            status: 'pass',
            facts: [
              { code: 'DOB', display: 'Date of Birth', rawCode: '1983-03-15', rawDisplay: 'Demographics', date: '1983-03-15' },
              { code: 'AGE', display: 'Age at MP End', rawCode: '42', rawDisplay: 'Calculated', date: '2025-12-31' },
            ],
            cqlSnippet: 'AgeInYearsAt(date from end of "Measurement Period") in Interval[18, 85]',
            source: 'Arrakis Medical Center (EMR)',
          },
          {
            id: 'ip-dx',
            title: 'Essential Hypertension',
            type: 'initial_population',
            description: 'Active diagnosis during first 6 months of MP',
            status: 'pass',
            facts: [
              { code: 'I10', display: 'Essential (primary) hypertension', rawCode: 'I10', rawDisplay: 'ICD-10-CM', date: '2024-06-12', source: 'Problem List' },
              { code: 'I11.9', display: 'Hypertensive heart disease without heart failure', rawCode: 'I11.9', rawDisplay: 'ICD-10-CM', date: '2024-08-03', source: 'Encounter Dx' },
            ],
            cqlSnippet: '["Diagnosis": "Essential Hypertension"] d\n  where d.prevalencePeriod overlaps Interval[start of "Measurement Period", start of "Measurement Period" + 6 months)',
            source: 'Arrakis Medical Center (EMR)',
          },
          {
            id: 'ip-enc',
            title: 'Qualifying Outpatient Encounter',
            type: 'initial_population',
            description: 'At least one qualifying encounter during MP',
            status: 'pass',
            facts: [
              { code: '99213', display: 'Office visit, established, 20-29 min', rawCode: '99213', rawDisplay: 'CPT', date: '2025-02-18' },
              { code: '99214', display: 'Office visit, established, 30-39 min', rawCode: '99214', rawDisplay: 'CPT', date: '2025-06-22' },
              { code: '99213', display: 'Office visit, established, 20-29 min', rawCode: '99213', rawDisplay: 'CPT', date: '2025-09-15' },
            ],
            cqlSnippet: 'exists(["Encounter": "Office Visit"] E where E.relevantPeriod during "Measurement Period")',
            source: 'Arrakis Medical Center (EMR)',
          },
        ],
      },
      denominator: {
        met: true,
        nodes: [
          {
            id: 'den-eq',
            title: 'Equals Initial Population',
            type: 'denominator',
            description: 'Included because Initial Population criteria met',
            status: 'pass',
            facts: [{ code: '—', display: 'Denominator state', rawDisplay: 'Included', date: '2025-12-31' }],
            cqlSnippet: 'define "Denominator": "Initial Population"',
            source: 'Arrakis Medical Center (EMR)',
          },
        ],
      },
      exclusions: {
        met: false,
        nodes: [
          {
            id: 'ex-hospice',
            title: 'Hospice Services',
            type: 'denominator_exclusion',
            description: 'No hospice services found',
            status: 'fail',
            facts: [{ code: '—', display: 'Hospice encounter/order', rawDisplay: 'None found', date: '—' }],
            cqlSnippet: 'exists(["Encounter": "Hospice Care Ambulatory"])',
            source: 'Arrakis Medical Center (EMR)',
          },
          {
            id: 'ex-esrd',
            title: 'ESRD or Dialysis',
            type: 'denominator_exclusion',
            description: 'No ESRD diagnosis or dialysis',
            status: 'fail',
            facts: [{ code: '—', display: 'ESRD/Dialysis evidence', rawDisplay: 'None found', date: '—' }],
            cqlSnippet: 'exists(["Diagnosis": "End Stage Renal Disease"])',
            source: 'Arrakis Medical Center (EMR)',
          },
          {
            id: 'ex-pregnancy',
            title: 'Pregnancy',
            type: 'denominator_exclusion',
            description: 'No pregnancy diagnosis during MP',
            status: 'fail',
            facts: [{ code: '—', display: 'Pregnancy diagnosis', rawDisplay: 'None found', date: '—' }],
            cqlSnippet: 'exists(["Diagnosis": "Pregnancy"])',
            source: 'Arrakis Medical Center (EMR)',
          },
        ],
      },
      numerator: {
        met: false,
        nodes: [
          {
            id: 'num-sbp',
            title: 'Systolic BP Readings',
            type: 'numerator',
            description: 'All SBP readings during MP',
            status: 'pass',
            facts: [
              { code: '8480-6', display: 'Systolic blood pressure', rawCode: '152', rawDisplay: 'mm[Hg]', date: '2025-02-18' },
              { code: '8480-6', display: 'Systolic blood pressure', rawCode: '145', rawDisplay: 'mm[Hg]', date: '2025-06-22' },
              { code: '8480-6', display: 'Systolic blood pressure', rawCode: '148', rawDisplay: 'mm[Hg]', date: '2025-09-15' },
            ],
            cqlSnippet: '["Physical Exam": "Systolic Blood Pressure"] SBP\n  where SBP.relevantPeriod during "Measurement Period"\n    and SBP.result.unit = \'mm[Hg]\'',
            source: 'Arrakis Medical Center (EMR)',
          },
          {
            id: 'num-dbp',
            title: 'Diastolic BP Readings',
            type: 'numerator',
            description: 'All DBP readings during MP',
            status: 'pass',
            facts: [
              { code: '8462-4', display: 'Diastolic blood pressure', rawCode: '98', rawDisplay: 'mm[Hg]', date: '2025-02-18' },
              { code: '8462-4', display: 'Diastolic blood pressure', rawCode: '92', rawDisplay: 'mm[Hg]', date: '2025-06-22' },
              { code: '8462-4', display: 'Diastolic blood pressure', rawCode: '94', rawDisplay: 'mm[Hg]', date: '2025-09-15' },
            ],
            cqlSnippet: '["Physical Exam": "Diastolic Blood Pressure"] DBP\n  where DBP.relevantPeriod during "Measurement Period"\n    and DBP.result.unit = \'mm[Hg]\'',
            source: 'Arrakis Medical Center (EMR)',
          },
          {
            id: 'num-recent',
            title: 'Most Recent BP Day',
            type: 'numerator',
            description: 'Latest same-day SBP+DBP pair',
            status: 'pass',
            facts: [
              { code: '8480-6', display: 'Most recent SBP', rawCode: '148', rawDisplay: 'mm[Hg]', date: '2025-09-15' },
              { code: '8462-4', display: 'Most recent DBP', rawCode: '94', rawDisplay: 'mm[Hg]', date: '2025-09-15' },
            ],
            cqlSnippet: 'Last(("Qualifying DBP Dates" intersect "Qualifying SBP Dates") QualifyingBPDays sort by date)',
            source: 'Arrakis Medical Center (EMR)',
          },
          {
            id: 'num-threshold',
            title: 'BP Control Threshold',
            type: 'numerator',
            description: 'SBP < 140 AND DBP < 90',
            status: 'fail',
            facts: [
              { code: 'SBP', display: 'Systolic threshold check', rawCode: '148 >= 140', rawDisplay: 'FAIL', date: '2025-09-15' },
              { code: 'DBP', display: 'Diastolic threshold check', rawCode: '94 >= 90', rawDisplay: 'FAIL', date: '2025-09-15' },
            ],
            cqlSnippet: '"Most Recent SBP" < 140 mm[Hg] and "Most Recent DBP" < 90 mm[Hg]',
            source: 'Arrakis Medical Center (EMR)',
          },
        ],
      },
    },
    finalOutcome: 'not_in_numerator',
    howClose: [
      'Most recent BP (2025-09-15): 148/94 mm[Hg] — both values exceed thresholds',
      'SBP needs to decrease by 9 mm[Hg] (148 → <140)',
      'DBP needs to decrease by 5 mm[Hg] (94 → <90)',
      'Trend improving: 152/98 → 145/92 → 148/94 over the year',
    ],
  },

  // ===== PATIENT 2: Lady Jessica - IN NUMERATOR (controlled BP) =====
  {
    patientId: 'pt-002',
    patientName: 'Lady Jessica',
    narrative: 'Lady Jessica meets all criteria and has well-controlled blood pressure. Most recent same-day BP reading (128/78 on 2025-11-03) is below thresholds. Patient is counted in the Numerator.',
    populations: {
      initialPopulation: {
        met: true,
        nodes: [
          {
            id: 'ip-age',
            title: 'Age 18–85 at end of MP',
            type: 'initial_population',
            description: 'Patient age: 38 years',
            status: 'pass',
            facts: [
              { code: 'DOB', display: 'Date of Birth', rawCode: '1987-08-22', rawDisplay: 'Demographics', date: '1987-08-22' },
              { code: 'AGE', display: 'Age at MP End', rawCode: '38', rawDisplay: 'Calculated', date: '2025-12-31' },
            ],
            cqlSnippet: 'AgeInYearsAt(date from end of "Measurement Period") in Interval[18, 85]',
            source: 'Bene Gesserit Medical (EMR)',
          },
          {
            id: 'ip-dx',
            title: 'Essential Hypertension',
            type: 'initial_population',
            description: 'Hypertension diagnosed and active',
            status: 'pass',
            facts: [
              { code: 'I10', display: 'Essential (primary) hypertension', rawCode: 'I10', rawDisplay: 'ICD-10-CM', date: '2023-11-15' },
            ],
            cqlSnippet: '["Diagnosis": "Essential Hypertension"]',
            source: 'Bene Gesserit Medical (EMR)',
          },
          {
            id: 'ip-enc',
            title: 'Qualifying Outpatient Encounter',
            type: 'initial_population',
            description: 'Multiple qualifying encounters',
            status: 'pass',
            facts: [
              { code: '99214', display: 'Office visit, established, 30-39 min', rawCode: '99214', rawDisplay: 'CPT', date: '2025-03-10' },
              { code: '99395', display: 'Preventive visit, 18-39 years', rawCode: '99395', rawDisplay: 'CPT', date: '2025-07-18' },
              { code: '99213', display: 'Office visit, established, 20-29 min', rawCode: '99213', rawDisplay: 'CPT', date: '2025-11-03' },
            ],
            cqlSnippet: 'exists(["Encounter": "Office Visit"])',
            source: 'Bene Gesserit Medical (EMR)',
          },
        ],
      },
      denominator: {
        met: true,
        nodes: [
          {
            id: 'den-eq',
            title: 'Equals Initial Population',
            type: 'denominator',
            description: 'Included in Denominator',
            status: 'pass',
            facts: [{ code: '—', display: 'Denominator state', rawDisplay: 'Included', date: '2025-12-31' }],
            cqlSnippet: 'define "Denominator": "Initial Population"',
            source: 'Bene Gesserit Medical (EMR)',
          },
        ],
      },
      exclusions: {
        met: false,
        nodes: [
          {
            id: 'ex-hospice',
            title: 'Hospice Services',
            type: 'denominator_exclusion',
            description: 'No hospice evidence',
            status: 'fail',
            facts: [{ code: '—', display: 'Hospice', rawDisplay: 'None', date: '—' }],
            cqlSnippet: 'exists(["Encounter": "Hospice Care Ambulatory"])',
            source: 'Bene Gesserit Medical (EMR)',
          },
        ],
      },
      numerator: {
        met: true,
        nodes: [
          {
            id: 'num-sbp',
            title: 'Systolic BP Readings',
            type: 'numerator',
            description: 'SBP readings during MP',
            status: 'pass',
            facts: [
              { code: '8480-6', display: 'Systolic blood pressure', rawCode: '132', rawDisplay: 'mm[Hg]', date: '2025-03-10' },
              { code: '8480-6', display: 'Systolic blood pressure', rawCode: '126', rawDisplay: 'mm[Hg]', date: '2025-07-18' },
              { code: '8480-6', display: 'Systolic blood pressure', rawCode: '128', rawDisplay: 'mm[Hg]', date: '2025-11-03' },
            ],
            cqlSnippet: '["Physical Exam": "Systolic Blood Pressure"]',
            source: 'Bene Gesserit Medical (EMR)',
          },
          {
            id: 'num-dbp',
            title: 'Diastolic BP Readings',
            type: 'numerator',
            description: 'DBP readings during MP',
            status: 'pass',
            facts: [
              { code: '8462-4', display: 'Diastolic blood pressure', rawCode: '84', rawDisplay: 'mm[Hg]', date: '2025-03-10' },
              { code: '8462-4', display: 'Diastolic blood pressure', rawCode: '76', rawDisplay: 'mm[Hg]', date: '2025-07-18' },
              { code: '8462-4', display: 'Diastolic blood pressure', rawCode: '78', rawDisplay: 'mm[Hg]', date: '2025-11-03' },
            ],
            cqlSnippet: '["Physical Exam": "Diastolic Blood Pressure"]',
            source: 'Bene Gesserit Medical (EMR)',
          },
          {
            id: 'num-threshold',
            title: 'BP Control Threshold',
            type: 'numerator',
            description: 'Most recent: 128/78 — CONTROLLED',
            status: 'pass',
            facts: [
              { code: 'SBP', display: 'Systolic threshold', rawCode: '128 < 140', rawDisplay: 'PASS', date: '2025-11-03' },
              { code: 'DBP', display: 'Diastolic threshold', rawCode: '78 < 90', rawDisplay: 'PASS', date: '2025-11-03' },
            ],
            cqlSnippet: '"Most Recent SBP" < 140 and "Most Recent DBP" < 90',
            source: 'Bene Gesserit Medical (EMR)',
          },
        ],
      },
    },
    finalOutcome: 'in_numerator',
  },

  // ===== PATIENT 3: Duncan Idaho - EXCLUDED (hospice) =====
  {
    patientId: 'pt-003',
    patientName: 'Duncan Idaho',
    narrative: 'Duncan meets Initial Population criteria but is EXCLUDED due to hospice care services. Per CMS guidelines, patients receiving hospice are excluded from the denominator.',
    populations: {
      initialPopulation: {
        met: true,
        nodes: [
          {
            id: 'ip-age',
            title: 'Age 18–85 at end of MP',
            type: 'initial_population',
            description: 'Patient age: 67 years',
            status: 'pass',
            facts: [
              { code: 'AGE', display: 'Age at MP End', rawCode: '67', rawDisplay: 'Calculated', date: '2025-12-31' },
            ],
            cqlSnippet: 'AgeInYearsAt(date from end of "Measurement Period") in Interval[18, 85]',
            source: 'Ginaz Swordmaster Clinic (EMR)',
          },
          {
            id: 'ip-dx',
            title: 'Essential Hypertension',
            type: 'initial_population',
            description: 'Active hypertension with comorbidities',
            status: 'pass',
            facts: [
              { code: 'I10', display: 'Essential hypertension', rawCode: 'I10', rawDisplay: 'ICD-10-CM', date: '2019-03-22' },
              { code: 'I25.10', display: 'ASCVD without angina', rawCode: 'I25.10', rawDisplay: 'ICD-10-CM', date: '2022-08-14' },
              { code: 'N18.3', display: 'CKD Stage 3', rawCode: 'N18.3', rawDisplay: 'ICD-10-CM', date: '2023-01-09' },
            ],
            cqlSnippet: '["Diagnosis": "Essential Hypertension"]',
            source: 'Ginaz Swordmaster Clinic (EMR)',
          },
          {
            id: 'ip-enc',
            title: 'Qualifying Encounter',
            type: 'initial_population',
            description: 'Office visits during MP',
            status: 'pass',
            facts: [
              { code: '99214', display: 'Office visit', rawCode: '99214', rawDisplay: 'CPT', date: '2025-01-15' },
              { code: '99215', display: 'Office visit, complex', rawCode: '99215', rawDisplay: 'CPT', date: '2025-04-22' },
            ],
            cqlSnippet: 'exists(["Encounter": "Office Visit"])',
            source: 'Ginaz Swordmaster Clinic (EMR)',
          },
        ],
      },
      denominator: {
        met: true,
        nodes: [
          {
            id: 'den-eq',
            title: 'Equals Initial Population',
            type: 'denominator',
            description: 'Would be in denominator if not excluded',
            status: 'pass',
            facts: [{ code: '—', display: 'Denominator', rawDisplay: 'Included (pre-exclusion)', date: '—' }],
            cqlSnippet: 'define "Denominator": "Initial Population"',
            source: 'Ginaz Swordmaster Clinic (EMR)',
          },
        ],
      },
      exclusions: {
        met: true,
        nodes: [
          {
            id: 'ex-hospice',
            title: 'Hospice Services',
            type: 'denominator_exclusion',
            description: 'Patient enrolled in hospice',
            status: 'pass',
            facts: [
              { code: '99377', display: 'Hospice supervision', rawCode: '99377', rawDisplay: 'CPT', date: '2025-06-01' },
              { code: 'G9473', display: 'Hospice services', rawCode: 'G9473', rawDisplay: 'HCPCS', date: '2025-06-15' },
              { code: 'Z51.5', display: 'Encounter for palliative care', rawCode: 'Z51.5', rawDisplay: 'ICD-10-CM', date: '2025-07-01' },
            ],
            cqlSnippet: 'exists(["Encounter": "Hospice Care Ambulatory"] H\n  where H.relevantPeriod overlaps "Measurement Period")',
            source: 'Ginaz Swordmaster Clinic (EMR)',
          },
        ],
      },
      numerator: {
        met: false,
        nodes: [
          {
            id: 'num-na',
            title: 'Numerator Evaluation',
            type: 'numerator',
            description: 'Not evaluated due to exclusion',
            status: 'not_applicable',
            facts: [{ code: '—', display: 'Status', rawDisplay: 'Excluded - not evaluated', date: '—' }],
            cqlSnippet: '-- Patient excluded, numerator not evaluated',
            source: 'Ginaz Swordmaster Clinic (EMR)',
          },
        ],
      },
    },
    finalOutcome: 'excluded',
  },

  // ===== PATIENT 4: Stilgar - NOT IN POPULATION (age out of range) =====
  {
    patientId: 'pt-004',
    patientName: 'Stilgar',
    narrative: 'Stilgar does not meet the Initial Population because his age (89) exceeds the upper limit of 85 years. Despite having hypertension and qualifying encounters, he is excluded from the measure population.',
    populations: {
      initialPopulation: {
        met: false,
        nodes: [
          {
            id: 'ip-age',
            title: 'Age 18–85 at end of MP',
            type: 'initial_population',
            description: 'Age 89 exceeds upper limit of 85',
            status: 'fail',
            facts: [
              { code: 'DOB', display: 'Date of Birth', rawCode: '1936-05-18', rawDisplay: 'Demographics', date: '1936-05-18' },
              { code: 'AGE', display: 'Age at MP End', rawCode: '89', rawDisplay: 'Exceeds 85', date: '2025-12-31' },
            ],
            cqlSnippet: 'AgeInYearsAt(date from end of "Measurement Period") in Interval[18, 85]\n-- Result: 89 NOT in [18, 85]',
            source: 'Sietch Tabr Medical (EMR)',
          },
          {
            id: 'ip-dx',
            title: 'Essential Hypertension',
            type: 'initial_population',
            description: 'Has qualifying diagnosis',
            status: 'pass',
            facts: [
              { code: 'I10', display: 'Essential hypertension', rawCode: 'I10', rawDisplay: 'ICD-10-CM', date: '2015-02-20' },
              { code: 'I11.0', display: 'Hypertensive heart disease w/ HF', rawCode: 'I11.0', rawDisplay: 'ICD-10-CM', date: '2021-09-14' },
            ],
            cqlSnippet: '["Diagnosis": "Essential Hypertension"]',
            source: 'Sietch Tabr Medical (EMR)',
          },
          {
            id: 'ip-enc',
            title: 'Qualifying Encounter',
            type: 'initial_population',
            description: 'Has qualifying encounters',
            status: 'pass',
            facts: [
              { code: '99215', display: 'Office visit, complex', rawCode: '99215', rawDisplay: 'CPT', date: '2025-02-12' },
              { code: '99214', display: 'Office visit', rawCode: '99214', rawDisplay: 'CPT', date: '2025-08-30' },
            ],
            cqlSnippet: 'exists(["Encounter": "Office Visit"])',
            source: 'Sietch Tabr Medical (EMR)',
          },
        ],
      },
      denominator: { met: false, nodes: [] },
      exclusions: { met: false, nodes: [] },
      numerator: { met: false, nodes: [] },
    },
    finalOutcome: 'not_in_population',
    howClose: [
      'Patient is 89 years old; measure requires age 18-85',
      'Would need to be 4 years younger to qualify',
      'All other IP criteria are met (diagnosis, encounters)',
    ],
  },

  // ===== PATIENT 5: Chani - IN NUMERATOR (well controlled) =====
  {
    patientId: 'pt-005',
    patientName: 'Chani',
    narrative: 'Chani meets all criteria with excellent BP control. Recent readings show consistent control below thresholds. Most recent same-day BP: 118/72.',
    populations: {
      initialPopulation: {
        met: true,
        nodes: [
          {
            id: 'ip-age',
            title: 'Age 18–85',
            type: 'initial_population',
            description: 'Age 32 within range',
            status: 'pass',
            facts: [{ code: 'AGE', display: 'Age at MP End', rawCode: '32', rawDisplay: 'Calculated', date: '2025-12-31' }],
            cqlSnippet: 'AgeInYearsAt(date from end of "Measurement Period") in Interval[18, 85]',
            source: 'Fremen Health Services (EMR)',
          },
          {
            id: 'ip-dx',
            title: 'Essential Hypertension',
            type: 'initial_population',
            description: 'Gestational hypertension evolved to essential',
            status: 'pass',
            facts: [
              { code: 'O13.9', display: 'Gestational HTN (resolved)', rawCode: 'O13.9', rawDisplay: 'ICD-10-CM', date: '2022-04-15' },
              { code: 'I10', display: 'Essential hypertension', rawCode: 'I10', rawDisplay: 'ICD-10-CM', date: '2023-02-28' },
            ],
            cqlSnippet: '["Diagnosis": "Essential Hypertension"]',
            source: 'Fremen Health Services (EMR)',
          },
          {
            id: 'ip-enc',
            title: 'Qualifying Encounter',
            type: 'initial_population',
            description: 'Regular follow-up visits',
            status: 'pass',
            facts: [
              { code: '99213', display: 'Office visit', rawCode: '99213', rawDisplay: 'CPT', date: '2025-03-22' },
              { code: '99213', display: 'Office visit', rawCode: '99213', rawDisplay: 'CPT', date: '2025-06-18' },
              { code: '99213', display: 'Office visit', rawCode: '99213', rawDisplay: 'CPT', date: '2025-09-10' },
              { code: '99214', display: 'Office visit', rawCode: '99214', rawDisplay: 'CPT', date: '2025-12-05' },
            ],
            cqlSnippet: 'exists(["Encounter": "Office Visit"])',
            source: 'Fremen Health Services (EMR)',
          },
        ],
      },
      denominator: {
        met: true,
        nodes: [
          {
            id: 'den-eq',
            title: 'In Denominator',
            type: 'denominator',
            description: 'Included',
            status: 'pass',
            facts: [{ code: '—', display: 'Status', rawDisplay: 'Included', date: '—' }],
            cqlSnippet: 'define "Denominator": "Initial Population"',
            source: 'Fremen Health Services (EMR)',
          },
        ],
      },
      exclusions: {
        met: false,
        nodes: [
          {
            id: 'ex-none',
            title: 'No Exclusions',
            type: 'denominator_exclusion',
            description: 'No exclusion criteria met',
            status: 'fail',
            facts: [{ code: '—', display: 'Exclusions', rawDisplay: 'None apply', date: '—' }],
            cqlSnippet: 'not exists("Denominator Exclusions")',
            source: 'Fremen Health Services (EMR)',
          },
        ],
      },
      numerator: {
        met: true,
        nodes: [
          {
            id: 'num-bp',
            title: 'BP Readings',
            type: 'numerator',
            description: 'Consistent control throughout year',
            status: 'pass',
            facts: [
              { code: '8480-6/8462-4', display: 'BP Reading', rawCode: '122/76', rawDisplay: 'mm[Hg]', date: '2025-03-22' },
              { code: '8480-6/8462-4', display: 'BP Reading', rawCode: '118/74', rawDisplay: 'mm[Hg]', date: '2025-06-18' },
              { code: '8480-6/8462-4', display: 'BP Reading', rawCode: '120/78', rawDisplay: 'mm[Hg]', date: '2025-09-10' },
              { code: '8480-6/8462-4', display: 'BP Reading', rawCode: '118/72', rawDisplay: 'mm[Hg]', date: '2025-12-05' },
            ],
            cqlSnippet: '"Most Recent SBP" < 140 and "Most Recent DBP" < 90',
            source: 'Fremen Health Services (EMR)',
          },
          {
            id: 'num-threshold',
            title: 'Threshold Met',
            type: 'numerator',
            description: '118/72 < 140/90 — CONTROLLED',
            status: 'pass',
            facts: [
              { code: 'RESULT', display: 'BP Control Status', rawCode: '118/72', rawDisplay: 'CONTROLLED', date: '2025-12-05' },
            ],
            cqlSnippet: '"Has Controlled Blood Pressure" = true',
            source: 'Fremen Health Services (EMR)',
          },
        ],
      },
    },
    finalOutcome: 'in_numerator',
  },

  // ===== PATIENT 6: Sol Weintraub - Not in Numerator (no BP readings) =====
  {
    patientId: 'pt-006',
    patientName: 'Sol Weintraub',
    narrative: 'Sol meets IP criteria but has NO blood pressure readings recorded during the measurement period. Despite having hypertension on his problem list, no vital signs were documented during qualifying encounters.',
    populations: {
      initialPopulation: {
        met: true,
        nodes: [
          {
            id: 'ip-age',
            title: 'Age 18–85',
            type: 'initial_population',
            description: 'Age 71 within range',
            status: 'pass',
            facts: [{ code: 'AGE', display: 'Age', rawCode: '71', rawDisplay: 'Years', date: '2025-12-31' }],
            cqlSnippet: 'AgeInYearsAt(end of "Measurement Period") in Interval[18, 85]',
            source: 'Hyperion University Medical (EMR)',
          },
          {
            id: 'ip-dx',
            title: 'Essential Hypertension',
            type: 'initial_population',
            description: 'Long-standing hypertension',
            status: 'pass',
            facts: [
              { code: 'I10', display: 'Essential hypertension', rawCode: 'I10', rawDisplay: 'ICD-10-CM', date: '2010-06-15' },
            ],
            cqlSnippet: '["Diagnosis": "Essential Hypertension"]',
            source: 'Hyperion University Medical (EMR)',
          },
          {
            id: 'ip-enc',
            title: 'Qualifying Encounter',
            type: 'initial_population',
            description: 'Telehealth visits (no vitals)',
            status: 'pass',
            facts: [
              { code: '99441', display: 'Telephone E/M, 5-10 min', rawCode: '99441', rawDisplay: 'CPT', date: '2025-04-12' },
              { code: '99442', display: 'Telephone E/M, 11-20 min', rawCode: '99442', rawDisplay: 'CPT', date: '2025-08-22' },
            ],
            cqlSnippet: 'exists(["Encounter": "Telephone Visits"])',
            source: 'Hyperion University Medical (EMR)',
          },
        ],
      },
      denominator: {
        met: true,
        nodes: [{ id: 'den', title: 'In Denominator', type: 'denominator', description: 'Included', status: 'pass', facts: [] }],
      },
      exclusions: {
        met: false,
        nodes: [{ id: 'ex', title: 'No Exclusions', type: 'denominator_exclusion', description: 'None', status: 'fail', facts: [] }],
      },
      numerator: {
        met: false,
        nodes: [
          {
            id: 'num-sbp',
            title: 'Systolic BP',
            type: 'numerator',
            description: 'No SBP recorded during MP',
            status: 'fail',
            facts: [{ code: '8480-6', display: 'Systolic BP', rawCode: '—', rawDisplay: 'No readings in MP', date: '—' }],
            cqlSnippet: '["Physical Exam": "Systolic Blood Pressure"]\n-- Result: Empty set',
            source: 'Hyperion University Medical (EMR)',
          },
          {
            id: 'num-dbp',
            title: 'Diastolic BP',
            type: 'numerator',
            description: 'No DBP recorded during MP',
            status: 'fail',
            facts: [{ code: '8462-4', display: 'Diastolic BP', rawCode: '—', rawDisplay: 'No readings in MP', date: '—' }],
            cqlSnippet: '["Physical Exam": "Diastolic Blood Pressure"]\n-- Result: Empty set',
            source: 'Hyperion University Medical (EMR)',
          },
        ],
      },
    },
    finalOutcome: 'not_in_numerator',
    howClose: [
      'No blood pressure readings found in measurement period',
      'Encounters were telehealth only — no in-person vitals',
      'Care gap: Patient needs in-person visit with BP measurement',
      'Last known BP (pre-MP): 142/88 on 2024-11-05',
    ],
  },

  // ===== PATIENT 7: Kassad - IN NUMERATOR (borderline but controlled) =====
  {
    patientId: 'pt-007',
    patientName: 'Fedmahn Kassad',
    narrative: 'Colonel Kassad has borderline controlled hypertension. Most recent BP reading (138/88) is just under thresholds. Meets all IP criteria and has no exclusions.',
    populations: {
      initialPopulation: {
        met: true,
        nodes: [
          {
            id: 'ip-age',
            title: 'Age 18–85',
            type: 'initial_population',
            description: 'Age 45',
            status: 'pass',
            facts: [{ code: 'AGE', display: 'Age', rawCode: '45', rawDisplay: 'Years', date: '2025-12-31' }],
            cqlSnippet: 'AgeInYearsAt(end of "Measurement Period") in Interval[18, 85]',
            source: 'FORCE Military Medical (EMR)',
          },
          {
            id: 'ip-dx',
            title: 'Essential Hypertension',
            type: 'initial_population',
            description: 'Service-connected hypertension',
            status: 'pass',
            facts: [
              { code: 'I10', display: 'Essential hypertension', rawCode: 'I10', rawDisplay: 'ICD-10-CM', date: '2018-03-14' },
              { code: 'F43.10', display: 'PTSD, unspecified', rawCode: 'F43.10', rawDisplay: 'ICD-10-CM', date: '2017-09-22' },
            ],
            cqlSnippet: '["Diagnosis": "Essential Hypertension"]',
            source: 'FORCE Military Medical (EMR)',
          },
          {
            id: 'ip-enc',
            title: 'Qualifying Encounter',
            type: 'initial_population',
            description: 'Annual exam plus follow-ups',
            status: 'pass',
            facts: [
              { code: '99396', display: 'Preventive visit, 40-64 years', rawCode: '99396', rawDisplay: 'CPT', date: '2025-05-08' },
              { code: '99214', display: 'Office visit', rawCode: '99214', rawDisplay: 'CPT', date: '2025-10-18' },
            ],
            cqlSnippet: 'exists(["Encounter": "Office Visit"])',
            source: 'FORCE Military Medical (EMR)',
          },
        ],
      },
      denominator: { met: true, nodes: [{ id: 'den', title: 'In Denominator', type: 'denominator', description: 'Included', status: 'pass', facts: [] }] },
      exclusions: { met: false, nodes: [{ id: 'ex', title: 'No Exclusions', type: 'denominator_exclusion', description: 'None', status: 'fail', facts: [] }] },
      numerator: {
        met: true,
        nodes: [
          {
            id: 'num-bp',
            title: 'BP Readings',
            type: 'numerator',
            description: 'Borderline but controlled',
            status: 'pass',
            facts: [
              { code: '8480-6/8462-4', display: 'BP', rawCode: '142/92', rawDisplay: 'mm[Hg]', date: '2025-05-08' },
              { code: '8480-6/8462-4', display: 'BP', rawCode: '138/88', rawDisplay: 'mm[Hg]', date: '2025-10-18' },
            ],
            cqlSnippet: '"Most Recent SBP" < 140 and "Most Recent DBP" < 90',
            source: 'FORCE Military Medical (EMR)',
          },
          {
            id: 'num-threshold',
            title: 'Threshold Check',
            type: 'numerator',
            description: '138 < 140 AND 88 < 90 — PASS',
            status: 'pass',
            facts: [
              { code: 'SBP', display: 'Systolic', rawCode: '138 < 140', rawDisplay: 'PASS', date: '2025-10-18' },
              { code: 'DBP', display: 'Diastolic', rawCode: '88 < 90', rawDisplay: 'PASS', date: '2025-10-18' },
            ],
            cqlSnippet: '138 < 140 = true AND 88 < 90 = true',
            source: 'FORCE Military Medical (EMR)',
          },
        ],
      },
    },
    finalOutcome: 'in_numerator',
  },

  // ===== PATIENT 8: Brawne Lamia - EXCLUDED (ESRD) =====
  {
    patientId: 'pt-008',
    patientName: 'Brawne Lamia',
    narrative: 'Brawne meets IP criteria but is EXCLUDED due to End Stage Renal Disease (ESRD) with ongoing dialysis. Patients with ESRD are excluded from the hypertension measure.',
    populations: {
      initialPopulation: {
        met: true,
        nodes: [
          {
            id: 'ip-age',
            title: 'Age 18–85',
            type: 'initial_population',
            description: 'Age 52',
            status: 'pass',
            facts: [{ code: 'AGE', display: 'Age', rawCode: '52', rawDisplay: 'Years', date: '2025-12-31' }],
            cqlSnippet: 'AgeInYearsAt(end of "Measurement Period") in Interval[18, 85]',
            source: 'Lusus Medical Center (EMR)',
          },
          {
            id: 'ip-dx',
            title: 'Essential Hypertension',
            type: 'initial_population',
            description: 'Hypertension with renal complications',
            status: 'pass',
            facts: [
              { code: 'I12.0', display: 'HTN CKD with Stage 5/ESRD', rawCode: 'I12.0', rawDisplay: 'ICD-10-CM', date: '2022-11-18' },
              { code: 'N18.6', display: 'End stage renal disease', rawCode: 'N18.6', rawDisplay: 'ICD-10-CM', date: '2023-03-05' },
            ],
            cqlSnippet: '["Diagnosis": "Essential Hypertension"]',
            source: 'Lusus Medical Center (EMR)',
          },
          {
            id: 'ip-enc',
            title: 'Qualifying Encounter',
            type: 'initial_population',
            description: 'Nephrology visits',
            status: 'pass',
            facts: [
              { code: '99214', display: 'Office visit', rawCode: '99214', rawDisplay: 'CPT', date: '2025-02-14' },
              { code: '99215', display: 'Office visit, complex', rawCode: '99215', rawDisplay: 'CPT', date: '2025-07-22' },
            ],
            cqlSnippet: 'exists(["Encounter": "Office Visit"])',
            source: 'Lusus Medical Center (EMR)',
          },
        ],
      },
      denominator: { met: true, nodes: [{ id: 'den', title: 'In Denominator', type: 'denominator', description: 'Pre-exclusion', status: 'pass', facts: [] }] },
      exclusions: {
        met: true,
        nodes: [
          {
            id: 'ex-esrd',
            title: 'ESRD Diagnosis',
            type: 'denominator_exclusion',
            description: 'End Stage Renal Disease',
            status: 'pass',
            facts: [
              { code: 'N18.6', display: 'End stage renal disease', rawCode: 'N18.6', rawDisplay: 'ICD-10-CM', date: '2023-03-05' },
            ],
            cqlSnippet: 'exists(["Diagnosis": "End Stage Renal Disease"])',
            source: 'Lusus Medical Center (EMR)',
          },
          {
            id: 'ex-dialysis',
            title: 'Dialysis Services',
            type: 'denominator_exclusion',
            description: 'Ongoing hemodialysis',
            status: 'pass',
            facts: [
              { code: '90935', display: 'Hemodialysis, single evaluation', rawCode: '90935', rawDisplay: 'CPT', date: '2025-01-08' },
              { code: '90937', display: 'Hemodialysis, repeated evaluation', rawCode: '90937', rawDisplay: 'CPT', date: '2025-12-15' },
              { code: 'Z99.2', display: 'Dependence on renal dialysis', rawCode: 'Z99.2', rawDisplay: 'ICD-10-CM', date: '2023-03-05' },
            ],
            cqlSnippet: 'exists(["Procedure": "Dialysis Services"])',
            source: 'Lusus Medical Center (EMR)',
          },
        ],
      },
      numerator: { met: false, nodes: [{ id: 'num', title: 'N/A', type: 'numerator', description: 'Excluded', status: 'not_applicable', facts: [] }] },
    },
    finalOutcome: 'excluded',
  },

  // ===== PATIENT 9: Martin Silenus - NOT IN NUMERATOR (SBP controlled, DBP not) =====
  {
    patientId: 'pt-009',
    patientName: 'Martin Silenus',
    narrative: 'Martin has isolated diastolic hypertension. While his systolic BP (132) is well controlled, his diastolic (94) exceeds the 90 threshold. Both must be controlled to meet numerator.',
    populations: {
      initialPopulation: {
        met: true,
        nodes: [
          {
            id: 'ip-age',
            title: 'Age 18–85',
            type: 'initial_population',
            description: 'Age 68',
            status: 'pass',
            facts: [{ code: 'AGE', display: 'Age', rawCode: '68', rawDisplay: 'Years', date: '2025-12-31' }],
            cqlSnippet: 'AgeInYearsAt(end of "Measurement Period") in Interval[18, 85]',
            source: 'Old Earth Poetry Institute Medical (EMR)',
          },
          {
            id: 'ip-dx',
            title: 'Essential Hypertension',
            type: 'initial_population',
            description: 'Alcohol-related hypertension',
            status: 'pass',
            facts: [
              { code: 'I10', display: 'Essential hypertension', rawCode: 'I10', rawDisplay: 'ICD-10-CM', date: '2015-08-20' },
              { code: 'F10.20', display: 'Alcohol use disorder, moderate', rawCode: 'F10.20', rawDisplay: 'ICD-10-CM', date: '2018-03-12' },
            ],
            cqlSnippet: '["Diagnosis": "Essential Hypertension"]',
            source: 'Old Earth Poetry Institute Medical (EMR)',
          },
          {
            id: 'ip-enc',
            title: 'Qualifying Encounter',
            type: 'initial_population',
            description: 'Regular visits',
            status: 'pass',
            facts: [
              { code: '99213', display: 'Office visit', rawCode: '99213', rawDisplay: 'CPT', date: '2025-04-08' },
              { code: '99214', display: 'Office visit', rawCode: '99214', rawDisplay: 'CPT', date: '2025-11-22' },
            ],
            cqlSnippet: 'exists(["Encounter": "Office Visit"])',
            source: 'Old Earth Poetry Institute Medical (EMR)',
          },
        ],
      },
      denominator: { met: true, nodes: [{ id: 'den', title: 'In Denominator', type: 'denominator', description: 'Included', status: 'pass', facts: [] }] },
      exclusions: { met: false, nodes: [{ id: 'ex', title: 'No Exclusions', type: 'denominator_exclusion', description: 'None', status: 'fail', facts: [] }] },
      numerator: {
        met: false,
        nodes: [
          {
            id: 'num-sbp',
            title: 'Systolic BP',
            type: 'numerator',
            description: 'SBP controlled',
            status: 'pass',
            facts: [
              { code: '8480-6', display: 'Systolic BP', rawCode: '132', rawDisplay: 'mm[Hg] < 140', date: '2025-11-22' },
            ],
            cqlSnippet: '"Most Recent SBP" < 140 -- 132 < 140 = true',
            source: 'Old Earth Poetry Institute Medical (EMR)',
          },
          {
            id: 'num-dbp',
            title: 'Diastolic BP',
            type: 'numerator',
            description: 'DBP NOT controlled',
            status: 'fail',
            facts: [
              { code: '8462-4', display: 'Diastolic BP', rawCode: '94', rawDisplay: 'mm[Hg] >= 90', date: '2025-11-22' },
            ],
            cqlSnippet: '"Most Recent DBP" < 90 -- 94 < 90 = false',
            source: 'Old Earth Poetry Institute Medical (EMR)',
          },
          {
            id: 'num-threshold',
            title: 'Combined Threshold',
            type: 'numerator',
            description: 'FAIL: DBP 94 >= 90',
            status: 'fail',
            facts: [
              { code: 'RESULT', display: 'Control Status', rawCode: '132/94', rawDisplay: 'NOT CONTROLLED', date: '2025-11-22' },
            ],
            cqlSnippet: 'SBP < 140 AND DBP < 90\n-- true AND false = false',
            source: 'Old Earth Poetry Institute Medical (EMR)',
          },
        ],
      },
    },
    finalOutcome: 'not_in_numerator',
    howClose: [
      'Systolic BP is well controlled: 132 mm[Hg] (< 140)',
      'Diastolic BP exceeds threshold: 94 mm[Hg] (>= 90)',
      'DBP needs to decrease by 5 mm[Hg] to reach < 90',
      'Consider medication adjustment for diastolic control',
    ],
  },

  // ===== PATIENT 10: Het Masteen - NOT IN POPULATION (no hypertension dx) =====
  {
    patientId: 'pt-010',
    patientName: 'Het Masteen',
    narrative: 'Het Masteen does not have a qualifying hypertension diagnosis during the required window. While he had elevated BP readings, no ICD-10 code for hypertension was documented in the first 6 months of the measurement period.',
    populations: {
      initialPopulation: {
        met: false,
        nodes: [
          {
            id: 'ip-age',
            title: 'Age 18–85',
            type: 'initial_population',
            description: 'Age 55',
            status: 'pass',
            facts: [{ code: 'AGE', display: 'Age', rawCode: '55', rawDisplay: 'Years', date: '2025-12-31' }],
            cqlSnippet: 'AgeInYearsAt(end of "Measurement Period") in Interval[18, 85]',
            source: 'Templar Brotherhood Medical (EMR)',
          },
          {
            id: 'ip-dx',
            title: 'Essential Hypertension',
            type: 'initial_population',
            description: 'NO qualifying diagnosis in window',
            status: 'fail',
            facts: [
              { code: 'R03.0', display: 'Elevated BP reading (not dx)', rawCode: 'R03.0', rawDisplay: 'ICD-10-CM', date: '2025-03-18' },
              { code: '—', display: 'I10 (Essential HTN)', rawCode: 'NOT FOUND', rawDisplay: 'In first 6 mo of MP', date: '—' },
            ],
            cqlSnippet: '["Diagnosis": "Essential Hypertension"] d\n  where d.prevalencePeriod overlaps Interval[start of MP, start of MP + 6 months)\n-- Result: No qualifying diagnosis found',
            source: 'Templar Brotherhood Medical (EMR)',
          },
          {
            id: 'ip-enc',
            title: 'Qualifying Encounter',
            type: 'initial_population',
            description: 'Has qualifying encounters',
            status: 'pass',
            facts: [
              { code: '99213', display: 'Office visit', rawCode: '99213', rawDisplay: 'CPT', date: '2025-03-18' },
              { code: '99214', display: 'Office visit', rawCode: '99214', rawDisplay: 'CPT', date: '2025-09-05' },
            ],
            cqlSnippet: 'exists(["Encounter": "Office Visit"])',
            source: 'Templar Brotherhood Medical (EMR)',
          },
        ],
      },
      denominator: { met: false, nodes: [] },
      exclusions: { met: false, nodes: [] },
      numerator: { met: false, nodes: [] },
    },
    finalOutcome: 'not_in_population',
    howClose: [
      'No Essential Hypertension (I10) diagnosis found',
      'R03.0 (Elevated BP reading) is a symptom code, not a diagnosis',
      'Diagnosis must be active during first 6 months of measurement period',
      'Provider should consider adding I10 to problem list if clinically appropriate',
    ],
  },

  // ===== PATIENT 11: Leto Atreides II - IN NUMERATOR =====
  {
    patientId: 'pt-011',
    patientName: 'Leto Atreides II',
    narrative: 'Leto II (the God Emperor) has well-controlled hypertension despite multiple comorbidities. Most recent BP 124/80 is well under thresholds.',
    populations: {
      initialPopulation: {
        met: true,
        nodes: [
          {
            id: 'ip-age',
            title: 'Age 18–85',
            type: 'initial_population',
            description: 'Age 78',
            status: 'pass',
            facts: [{ code: 'AGE', display: 'Age', rawCode: '78', rawDisplay: 'Years', date: '2025-12-31' }],
            cqlSnippet: 'AgeInYearsAt(end of "Measurement Period") in Interval[18, 85]',
            source: 'Arrakeen Imperial Medical (EMR)',
          },
          {
            id: 'ip-dx',
            title: 'Essential Hypertension',
            type: 'initial_population',
            description: 'Multiple cardiovascular diagnoses',
            status: 'pass',
            facts: [
              { code: 'I10', display: 'Essential hypertension', rawCode: 'I10', rawDisplay: 'ICD-10-CM', date: '2008-05-12' },
              { code: 'E11.9', display: 'Type 2 DM', rawCode: 'E11.9', rawDisplay: 'ICD-10-CM', date: '2012-03-08' },
              { code: 'I25.10', display: 'ASCVD', rawCode: 'I25.10', rawDisplay: 'ICD-10-CM', date: '2018-11-22' },
              { code: 'E78.5', display: 'Hyperlipidemia', rawCode: 'E78.5', rawDisplay: 'ICD-10-CM', date: '2010-07-15' },
            ],
            cqlSnippet: '["Diagnosis": "Essential Hypertension"]',
            source: 'Arrakeen Imperial Medical (EMR)',
          },
          {
            id: 'ip-enc',
            title: 'Qualifying Encounter',
            type: 'initial_population',
            description: 'Comprehensive care visits',
            status: 'pass',
            facts: [
              { code: '99215', display: 'Office visit, complex', rawCode: '99215', rawDisplay: 'CPT', date: '2025-02-28' },
              { code: '99215', display: 'Office visit, complex', rawCode: '99215', rawDisplay: 'CPT', date: '2025-06-15' },
              { code: '99215', display: 'Office visit, complex', rawCode: '99215', rawDisplay: 'CPT', date: '2025-10-08' },
            ],
            cqlSnippet: 'exists(["Encounter": "Office Visit"])',
            source: 'Arrakeen Imperial Medical (EMR)',
          },
        ],
      },
      denominator: { met: true, nodes: [{ id: 'den', title: 'In Denominator', type: 'denominator', description: 'Included', status: 'pass', facts: [] }] },
      exclusions: { met: false, nodes: [{ id: 'ex', title: 'No Exclusions', type: 'denominator_exclusion', description: 'None', status: 'fail', facts: [] }] },
      numerator: {
        met: true,
        nodes: [
          {
            id: 'num-bp',
            title: 'BP Control',
            type: 'numerator',
            description: 'Excellent control',
            status: 'pass',
            facts: [
              { code: '8480-6/8462-4', display: 'BP', rawCode: '128/82', rawDisplay: 'mm[Hg]', date: '2025-02-28' },
              { code: '8480-6/8462-4', display: 'BP', rawCode: '122/78', rawDisplay: 'mm[Hg]', date: '2025-06-15' },
              { code: '8480-6/8462-4', display: 'BP', rawCode: '124/80', rawDisplay: 'mm[Hg]', date: '2025-10-08' },
            ],
            cqlSnippet: '"Most Recent SBP" < 140 and "Most Recent DBP" < 90',
            source: 'Arrakeen Imperial Medical (EMR)',
          },
        ],
      },
    },
    finalOutcome: 'in_numerator',
  },

  // ===== PATIENT 12: Gurney Halleck - NOT IN NUMERATOR (SBP elevated) =====
  {
    patientId: 'pt-012',
    patientName: 'Gurney Halleck',
    narrative: 'Gurney has isolated systolic hypertension, common in older adults. His SBP (146) exceeds the 140 threshold while DBP (78) is well controlled.',
    populations: {
      initialPopulation: {
        met: true,
        nodes: [
          {
            id: 'ip-age',
            title: 'Age 18–85',
            type: 'initial_population',
            description: 'Age 62',
            status: 'pass',
            facts: [{ code: 'AGE', display: 'Age', rawCode: '62', rawDisplay: 'Years', date: '2025-12-31' }],
            cqlSnippet: 'AgeInYearsAt(end of "Measurement Period")',
            source: 'House Atreides Medical (EMR)',
          },
          {
            id: 'ip-dx',
            title: 'Essential Hypertension',
            type: 'initial_population',
            description: 'Long-standing HTN',
            status: 'pass',
            facts: [
              { code: 'I10', display: 'Essential hypertension', rawCode: 'I10', rawDisplay: 'ICD-10-CM', date: '2012-04-18' },
            ],
            cqlSnippet: '["Diagnosis": "Essential Hypertension"]',
            source: 'House Atreides Medical (EMR)',
          },
          {
            id: 'ip-enc',
            title: 'Qualifying Encounter',
            type: 'initial_population',
            description: 'Regular follow-up',
            status: 'pass',
            facts: [
              { code: '99214', display: 'Office visit', rawCode: '99214', rawDisplay: 'CPT', date: '2025-05-12' },
              { code: '99213', display: 'Office visit', rawCode: '99213', rawDisplay: 'CPT', date: '2025-11-08' },
            ],
            cqlSnippet: 'exists(["Encounter": "Office Visit"])',
            source: 'House Atreides Medical (EMR)',
          },
        ],
      },
      denominator: { met: true, nodes: [{ id: 'den', title: 'In Denominator', type: 'denominator', description: 'Included', status: 'pass', facts: [] }] },
      exclusions: { met: false, nodes: [{ id: 'ex', title: 'No Exclusions', type: 'denominator_exclusion', description: 'None', status: 'fail', facts: [] }] },
      numerator: {
        met: false,
        nodes: [
          {
            id: 'num-sbp',
            title: 'Systolic BP',
            type: 'numerator',
            description: 'SBP NOT controlled',
            status: 'fail',
            facts: [
              { code: '8480-6', display: 'Systolic BP', rawCode: '146', rawDisplay: 'mm[Hg] >= 140', date: '2025-11-08' },
            ],
            cqlSnippet: '"Most Recent SBP" < 140 -- 146 < 140 = false',
            source: 'House Atreides Medical (EMR)',
          },
          {
            id: 'num-dbp',
            title: 'Diastolic BP',
            type: 'numerator',
            description: 'DBP controlled',
            status: 'pass',
            facts: [
              { code: '8462-4', display: 'Diastolic BP', rawCode: '78', rawDisplay: 'mm[Hg] < 90', date: '2025-11-08' },
            ],
            cqlSnippet: '"Most Recent DBP" < 90 -- 78 < 90 = true',
            source: 'House Atreides Medical (EMR)',
          },
        ],
      },
    },
    finalOutcome: 'not_in_numerator',
    howClose: [
      'Isolated systolic hypertension pattern',
      'SBP 146 mm[Hg] — needs to decrease by 7 mm[Hg]',
      'DBP 78 mm[Hg] — well controlled',
      'Consider adjusting antihypertensive regimen for better SBP control',
    ],
  },

  // ===== PATIENT 13: Father Lenar Hoyt - EXCLUDED (Advanced Illness + Frailty) =====
  {
    patientId: 'pt-013',
    patientName: 'Father Lenar Hoyt',
    narrative: 'Father Hoyt meets IP criteria but is EXCLUDED due to the Advanced Illness and Frailty exclusion pattern. He is over 66 with documented frailty indicators and advanced illness diagnoses.',
    populations: {
      initialPopulation: {
        met: true,
        nodes: [
          {
            id: 'ip-age',
            title: 'Age 18–85',
            type: 'initial_population',
            description: 'Age 74',
            status: 'pass',
            facts: [{ code: 'AGE', display: 'Age', rawCode: '74', rawDisplay: 'Years', date: '2025-12-31' }],
            cqlSnippet: 'AgeInYearsAt(end of "Measurement Period") in Interval[18, 85]',
            source: 'Pacem Hyperion Medical (EMR)',
          },
          {
            id: 'ip-dx',
            title: 'Essential Hypertension',
            type: 'initial_population',
            description: 'Hypertension with multiple comorbidities',
            status: 'pass',
            facts: [
              { code: 'I10', display: 'Essential hypertension', rawCode: 'I10', rawDisplay: 'ICD-10-CM', date: '2010-02-14' },
              { code: 'C34.90', display: 'Malignant neoplasm of lung', rawCode: 'C34.90', rawDisplay: 'ICD-10-CM', date: '2024-08-22' },
            ],
            cqlSnippet: '["Diagnosis": "Essential Hypertension"]',
            source: 'Pacem Hyperion Medical (EMR)',
          },
          {
            id: 'ip-enc',
            title: 'Qualifying Encounter',
            type: 'initial_population',
            description: 'Oncology and primary care visits',
            status: 'pass',
            facts: [
              { code: '99215', display: 'Office visit, complex', rawCode: '99215', rawDisplay: 'CPT', date: '2025-03-10' },
              { code: '99214', display: 'Office visit', rawCode: '99214', rawDisplay: 'CPT', date: '2025-08-18' },
            ],
            cqlSnippet: 'exists(["Encounter": "Office Visit"])',
            source: 'Pacem Hyperion Medical (EMR)',
          },
        ],
      },
      denominator: { met: true, nodes: [{ id: 'den', title: 'In Denominator', type: 'denominator', description: 'Pre-exclusion', status: 'pass', facts: [] }] },
      exclusions: {
        met: true,
        nodes: [
          {
            id: 'ex-frailty',
            title: 'Frailty Indicators',
            type: 'denominator_exclusion',
            description: 'Multiple frailty indicators documented',
            status: 'pass',
            facts: [
              { code: 'R54', display: 'Age-related physical debility', rawCode: 'R54', rawDisplay: 'ICD-10-CM', date: '2025-03-10' },
              { code: 'R26.89', display: 'Other abnormalities of gait', rawCode: 'R26.89', rawDisplay: 'ICD-10-CM', date: '2025-03-10' },
              { code: 'Z74.09', display: 'Need for assistance with self-care', rawCode: 'Z74.09', rawDisplay: 'ICD-10-CM', date: '2025-06-15' },
            ],
            cqlSnippet: 'exists(["Diagnosis": "Frailty Device"])',
            source: 'Pacem Hyperion Medical (EMR)',
          },
          {
            id: 'ex-advanced-illness',
            title: 'Advanced Illness',
            type: 'denominator_exclusion',
            description: 'Active malignancy qualifies as advanced illness',
            status: 'pass',
            facts: [
              { code: 'C34.90', display: 'Lung cancer', rawCode: 'C34.90', rawDisplay: 'ICD-10-CM', date: '2024-08-22' },
              { code: '96413', display: 'Chemotherapy infusion', rawCode: '96413', rawDisplay: 'CPT', date: '2025-04-05' },
              { code: '96415', display: 'Chemotherapy infusion, additional hour', rawCode: '96415', rawDisplay: 'CPT', date: '2025-07-18' },
            ],
            cqlSnippet: 'Age >= 66 and exists("Frailty Device") and exists("Advanced Illness")',
            source: 'Pacem Hyperion Medical (EMR)',
          },
        ],
      },
      numerator: { met: false, nodes: [{ id: 'num', title: 'N/A', type: 'numerator', description: 'Excluded', status: 'not_applicable', facts: [] }] },
    },
    finalOutcome: 'excluded',
  },
];

// Helper to calculate age from birth date
function calculateAge(birthDate        )         {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Helper to detect screening measures that use OR logic for numerator
function isScreeningMeasure(measureTitle        , measureId        )          {
  const title = measureTitle.toLowerCase();
  const id = measureId?.toUpperCase() || '';

  // CRC screening
  if (title.includes('colorectal') || title.includes('colon') || id.includes('CMS130')) {
    return true;
  }

  // Cervical cancer screening
  if (title.includes('cervical') || title.includes('cervix') ||
      title.includes('pap smear') || title.includes('pap test') ||
      id.includes('CMS124')) {
    return true;
  }

  // Breast cancer screening
  if (title.includes('breast') && title.includes('screen') || id.includes('CMS125')) {
    return true;
  }

  return false;
}

export function ValidationTraceViewer() {
  const navigate = useNavigate();
  const { getActiveMeasure, selectedCodeFormat } = useMeasureStore();
  const measure = getActiveMeasure();
  const [selectedTrace, setSelectedTrace] = useState                               (null);
  const [selectedPatient, setSelectedPatient] = useState                    (null);
  const [inspectNode, setInspectNode] = useState                       (null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationTraces, setValidationTraces] = useState                          ([]);
  const [testPatients, setTestPatients] = useState               ([]);
  const [showPatientDetails, setShowPatientDetails] = useState(true);
  const [populationFilter, setPopulationFilter] = useState                  ('all');
  const [editingPatient, setEditingPatient] = useState                    (null);
  const [editedPatientData, setEditedPatientData] = useState                    (null);

  // Sort and filter state
  const [sortField, setSortField] = useState           ('name');
  const [sortDirection, setSortDirection] = useState               ('asc');
  const [genderFilter, setGenderFilter] = useState                           ('all');
  const [ageRange, setAgeRange] = useState                                            ({ min: null, max: null });
  const [showFilters, setShowFilters] = useState(false);

  const codeInfo = CODE_FORMAT_INFO[selectedCodeFormat];
  const CodeIcon = codeInfo.icon;

  // Load edited patients from localStorage
  const loadEditedPatients = ()                              => {
    try {
      const saved = localStorage.getItem('editedTestPatients');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  // Save edited patients to localStorage
  const saveEditedPatientsToStorage = (patients                             ) => {
    try {
      localStorage.setItem('editedTestPatients', JSON.stringify(patients));
    } catch (e) {
      console.warn('Failed to save edited patients to localStorage:', e);
    }
  };

  // Generate test patients and evaluate them when measure changes
  useEffect(() => {
    if (!measure) {
      setValidationTraces([]);
      setTestPatients([]);
      setSelectedTrace(null);
      setSelectedPatient(null);
      return;
    }

    setIsGenerating(true);

    // Get all static test patients (36 total)
    const basePatients = generateTestPatients(measure, 36);

    // Merge with any locally edited patients
    const editedPatients = loadEditedPatients();
    const patients = basePatients.map(p =>
      editedPatients[p.id] ? { ...editedPatients[p.id] } : p
    );

    // Evaluate each patient against the measure
    const traces = patients.map(patient => {
      const trace = evaluatePatient(patient, measure);
      return trace;
    });

    setTestPatients(patients);
    setValidationTraces(traces);
    setSelectedTrace(traces[0] || null);
    setSelectedPatient(patients[0] || null);
    setIsGenerating(false);
  }, [measure?.id]); // Re-run when measure changes

  // Handle patient selection
  const handleSelectPatient = (trace                        , _index        ) => {
    setSelectedTrace(trace);
    // Find the patient by matching the trace's patientId
    const patient = testPatients.find(p => p.id === trace.patientId);
    setSelectedPatient(patient || null);
  };

  // Filter and sort traces
  const filteredAndSortedTraces = useMemo(() => {
    let traces = [...validationTraces];

    // Apply population filter
    if (populationFilter !== 'all') {
      traces = traces.filter(t => t.finalOutcome === populationFilter);
    }

    // Apply gender filter
    if (genderFilter !== 'all') {
      traces = traces.filter(t => {
        const patient = testPatients.find(p => p.id === t.patientId);
        return patient?.demographics.gender === genderFilter;
      });
    }

    // Apply age range filter
    if (ageRange.min !== null || ageRange.max !== null) {
      traces = traces.filter(t => {
        const patient = testPatients.find(p => p.id === t.patientId);
        if (!patient) return false;
        const age = calculateAge(patient.demographics.birthDate);
        if (ageRange.min !== null && age < ageRange.min) return false;
        if (ageRange.max !== null && age > ageRange.max) return false;
        return true;
      });
    }

    // Apply sorting
    traces.sort((a, b) => {
      const patientA = testPatients.find(p => p.id === a.patientId);
      const patientB = testPatients.find(p => p.id === b.patientId);

      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = (a.patientName || '').localeCompare(b.patientName || '');
          break;
        case 'age':
          const ageA = patientA ? calculateAge(patientA.demographics.birthDate) : 0;
          const ageB = patientB ? calculateAge(patientB.demographics.birthDate) : 0;
          comparison = ageA - ageB;
          break;
        case 'sex':
          const genderA = patientA?.demographics.gender || '';
          const genderB = patientB?.demographics.gender || '';
          comparison = genderA.localeCompare(genderB);
          break;
        case 'outcome':
          const outcomeOrder = { in_numerator: 0, not_in_numerator: 1, excluded: 2, not_in_population: 3 };
          comparison = outcomeOrder[a.finalOutcome] - outcomeOrder[b.finalOutcome];
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return traces;
  }, [validationTraces, populationFilter, genderFilter, ageRange, sortField, sortDirection, testPatients]);

  // Keep filteredTraces as an alias for backwards compatibility
  const filteredTraces = filteredAndSortedTraces;

  // Handle filter click
  const handleFilterClick = (filter                  ) => {
    setPopulationFilter(prev => prev === filter ? 'all' : filter);
  };

  // Toggle sort direction or change sort field
  const handleSortChange = (field           ) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setGenderFilter('all');
    setAgeRange({ min: null, max: null });
    setPopulationFilter('all');
  };

  // Start editing a patient
  const startEditingPatient = (patient             ) => {
    setEditingPatient(patient);
    setEditedPatientData(JSON.parse(JSON.stringify(patient))); // Deep clone
  };

  // Save edited patient
  const saveEditedPatient = () => {
    if (!editedPatientData || !measure) return;

    // Update the patient in the list
    const updatedPatients = testPatients.map(p =>
      p.id === editedPatientData.id ? editedPatientData : p
    );
    setTestPatients(updatedPatients);

    // Persist to localStorage
    const editedPatients = loadEditedPatients();
    editedPatients[editedPatientData.id] = editedPatientData;
    saveEditedPatientsToStorage(editedPatients);

    // Re-evaluate all patients
    const traces = updatedPatients.map(patient => evaluatePatient(patient, measure));
    setValidationTraces(traces);

    // Update selected patient if it was the one being edited
    if (selectedPatient?.id === editedPatientData.id) {
      setSelectedPatient(editedPatientData);
      const newTrace = traces.find(t => t.patientId === editedPatientData.id);
      if (newTrace) setSelectedTrace(newTrace);
    }

    setEditingPatient(null);
    setEditedPatientData(null);
  };

  // Reset a patient to original data
  const _resetPatientToOriginal = (patientId        ) => {
    const editedPatients = loadEditedPatients();
    delete editedPatients[patientId];
    saveEditedPatientsToStorage(editedPatients);

    // Reload the original patient
    const basePatients = generateTestPatients(measure , 36);
    const originalPatient = basePatients.find(p => p.id === patientId);
    if (originalPatient && measure) {
      const updatedPatients = testPatients.map(p =>
        p.id === patientId ? originalPatient : p
      );
      setTestPatients(updatedPatients);
      const traces = updatedPatients.map(patient => evaluatePatient(patient, measure));
      setValidationTraces(traces);
      if (selectedPatient?.id === patientId) {
        setSelectedPatient(originalPatient);
        const newTrace = traces.find(t => t.patientId === patientId);
        if (newTrace) setSelectedTrace(newTrace);
      }
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingPatient(null);
    setEditedPatientData(null);
  };

  if (!measure) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-[var(--text-dim)]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No Measure Selected</h2>
          <p className="text-[var(--text-muted)] mb-6">
            Select a measure from the library to generate test patients and validate measure logic.
          </p>
          <button
            onClick={() => navigate('/library')}
            className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors inline-flex items-center gap-2"
          >
            <Library className="w-4 h-4" />
            Go to Measure Library
          </button>
        </div>
      </div>
    );
  }

  // Calculate summary stats from dynamic traces
  const stats = {
    total: validationTraces.length,
    inNumerator: validationTraces.filter(t => t.finalOutcome === 'in_numerator').length,
    notControlled: validationTraces.filter(t => t.finalOutcome === 'not_in_numerator').length,
    excluded: validationTraces.filter(t => t.finalOutcome === 'excluded').length,
    notInPop: validationTraces.filter(t => t.finalOutcome === 'not_in_population').length,
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with measure info and code format */}
      <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="w-full">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-4">
            <button
              onClick={() => navigate('/library')}
              className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            >
              Measure Library
            </button>
            <ChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
            <span className="text-[var(--text-muted)]">{measure.metadata.measureId}</span>
            <ChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
            <span className="text-[var(--text)]">Test Validation</span>
          </nav>

          {/* Measure & Code Format Info */}
          <div className="flex items-start gap-6 mb-4">
            {/* Measure being validated */}
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-1">Validating Measure</div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-[var(--text)]">{measure.metadata.title}</h1>
                  <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <span className="font-mono">{measure.metadata.measureId}</span>
                    <span className="text-[var(--text-dim)]">•</span>
                    <span>v{measure.metadata.version}</span>
                    <span className="text-[var(--text-dim)]">•</span>
                    <span className="capitalize">{measure.metadata.program.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Code format being validated */}
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-1">Generated Code</div>
              <button
                onClick={() => navigate('/codegen')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors group"
              >
                <CodeIcon className={`w-5 h-5 ${codeInfo.color}`} />
                <span className={`font-medium ${codeInfo.color}`}>{codeInfo.label}</span>
                <span className="text-xs text-[var(--text-dim)] group-hover:text-[var(--accent)] transition-colors">← Change</span>
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Running {stats.total} synthetic test patients through the generated <span className={`font-medium ${codeInfo.color}`}>{codeInfo.label}</span> code to validate measure logic produces correct outcomes.
          </p>

          {/* Summary stats - clickable filters */}
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={() => handleFilterClick('in_numerator')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                populationFilter === 'in_numerator'
                  ? 'bg-[var(--success-light)] border-2 border-[var(--success)]/60 ring-2 ring-[var(--success)]/20'
                  : 'bg-[var(--success-light)] border border-[var(--success)]/20 hover:opacity-80'
              }`}
            >
              <CheckCircle className="w-4 h-4 text-[var(--success)]" />
              <span className="text-[var(--success)] font-medium">{stats.inNumerator}</span>
              <span className="text-[var(--text-muted)]">In Numerator</span>
            </button>
            <button
              onClick={() => handleFilterClick('not_in_numerator')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                populationFilter === 'not_in_numerator'
                  ? 'bg-[var(--danger-light)] border-2 border-[var(--danger)]/60 ring-2 ring-[var(--danger)]/20'
                  : 'bg-[var(--danger-light)] border border-[var(--danger)]/20 hover:opacity-80'
              }`}
            >
              <XCircle className="w-4 h-4 text-[var(--danger)]" />
              <span className="text-[var(--danger)] font-medium">{stats.notControlled}</span>
              <span className="text-[var(--text-muted)]">In Denominator</span>
            </button>
            <button
              onClick={() => handleFilterClick('excluded')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                populationFilter === 'excluded'
                  ? 'bg-[var(--warning-light)] border-2 border-[var(--warning)]/60 ring-2 ring-[var(--warning)]/20'
                  : 'bg-[var(--warning-light)] border border-[var(--warning)]/20 hover:opacity-80'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
              <span className="text-[var(--warning)] font-medium">{stats.excluded}</span>
              <span className="text-[var(--text-muted)]">Excluded</span>
            </button>
            <button
              onClick={() => handleFilterClick('not_in_population')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                populationFilter === 'not_in_population'
                  ? 'bg-slate-500/25 border-2 border-slate-400/60 ring-2 ring-slate-500/20'
                  : 'bg-[var(--bg-tertiary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)]/80'
              }`}
            >
              <span className="text-[var(--text-muted)] font-medium">{stats.notInPop}</span>
              <span className="text-[var(--text-dim)]">Not in Population</span>
            </button>
            {populationFilter !== 'all' && (
              <button
                onClick={() => setPopulationFilter('all')}
                className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
              >
                <X className="w-3 h-3" />
                Clear filter
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Patient list */}
        <div className="w-80 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden">
          {/* Header with title and controls */}
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-[var(--text)]">Test Patients</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    showFilters || genderFilter !== 'all' || ageRange.min !== null || ageRange.max !== null
                      ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                  title="Filter patients"
                >
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {filteredTraces.length === stats.total
                ? `${stats.total} synthetic patients`
                : `${filteredTraces.length} of ${stats.total} patients`}
            </p>

            {/* Sort controls */}
            <div className="flex items-center gap-1 mt-3 flex-wrap">
              <span className="text-xs text-[var(--text-dim)] mr-1">Sort:</span>
              {(['name', 'age', 'sex', 'outcome']               ).map(field => (
                <button
                  key={field}
                  onClick={() => handleSortChange(field)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    sortField === field
                      ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <span className="capitalize">{field}</span>
                  {sortField === field && (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  )}
                </button>
              ))}
            </div>

            {/* Filter panel */}
            {showFilters && (
              <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-3">
                {/* Gender filter */}
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Gender</label>
                  <div className="flex gap-1">
                    {(['all', 'male', 'female']).map(g => (
                      <button
                        key={g}
                        onClick={() => setGenderFilter(g)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          genderFilter === g
                            ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                      >
                        {g === 'all' ? 'All' : g.charAt(0).toUpperCase() + g.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Age range filter */}
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Age Range</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={ageRange.min ?? ''}
                      onChange={(e) => setAgeRange(prev => ({ ...prev, min: e.target.value ? parseInt(e.target.value) : null }))}
                      className="w-16 px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-xs text-[var(--text)] placeholder-[var(--text-dim)]"
                    />
                    <span className="text-xs text-[var(--text-dim)]">to</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={ageRange.max ?? ''}
                      onChange={(e) => setAgeRange(prev => ({ ...prev, max: e.target.value ? parseInt(e.target.value) : null }))}
                      className="w-16 px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-xs text-[var(--text)] placeholder-[var(--text-dim)]"
                    />
                  </div>
                </div>

                {/* Clear filters */}
                {(genderFilter !== 'all' || ageRange.min !== null || ageRange.max !== null) && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-[var(--accent)] hover:text-[var(--accent)] flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Patient list */}
          <div className="flex-1 overflow-auto p-2">
            {isGenerating ? (
              <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
                <span>Loading...</span>
              </div>
            ) : filteredTraces.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                {genderFilter !== 'all' || ageRange.min !== null || ageRange.max !== null
                  ? 'No patients match your filters'
                  : populationFilter !== 'all'
                  ? 'No patients in this category'
                  : 'No test patients'}
              </div>
            ) : filteredTraces.map((trace, index) => {
              const patient = testPatients.find(p => p.id === trace.patientId);
              const age = patient ? calculateAge(patient.demographics.birthDate) : null;
              const gender = patient?.demographics.gender;

              return (
                <button
                  key={trace.patientId}
                  onClick={() => handleSelectPatient(trace, index)}
                  className={`w-full p-3 rounded-lg text-left transition-colors mb-1 ${
                    selectedTrace?.patientId === trace.patientId
                      ? 'bg-[var(--accent-light)] border border-[var(--accent)]/30'
                      : 'hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      gender === 'male' ? 'bg-blue-500/15' : gender === 'female' ? 'bg-pink-500/15' : 'bg-[var(--bg-tertiary)]'
                    }`}>
                      <User className={`w-4 h-4 ${
                        gender === 'male' ? 'text-[var(--accent)]' : gender === 'female' ? 'text-pink-400' : 'text-[var(--text-muted)]'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--text)] truncate">{trace.patientName}</div>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
                        {age !== null && <span>{age} yrs</span>}
                        {gender && <span className="capitalize">{gender}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <OutcomeBadge outcome={trace.finalOutcome} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Trace detail */}
        {selectedTrace ? (
          <div className="flex-1 overflow-auto p-6">
            <div className="w-full">
              {/* Patient header */}
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-[var(--text)]">{selectedTrace.patientName}</h1>
                  <OutcomeBadge outcome={selectedTrace.finalOutcome} />
                </div>
              </div>

              {/* Measure Evaluation Summary - detailed view showing ALL criteria */}
              <DetailedEvaluationSummary
                trace={selectedTrace}
                patient={selectedPatient}
                measure={measure}
                howClose={selectedTrace.howClose}
              />

              {/* Patient Clinical Details Panel */}
              {selectedPatient && (
                <div className="mb-6 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-light)] overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between">
                    <button
                      onClick={() => setShowPatientDetails(!showPatientDetails)}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
                        <User className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-[var(--text)]">Patient Clinical Data</h3>
                        <p className="text-xs text-[var(--text-muted)]">
                          Demographics, diagnoses, encounters, procedures, observations
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEditingPatient(selectedPatient)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-light)] border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors text-sm"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit Patient
                      </button>
                      <button
                        onClick={() => setShowPatientDetails(!showPatientDetails)}
                        className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        {showPatientDetails ? (
                          <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                        )}
                      </button>
                    </div>
                  </div>

                  {showPatientDetails && (
                    <div className="p-5 pt-0 space-y-5">
                      {/* Demographics */}
                      <div>
                        <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          Demographics
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                            <div className="text-xs text-[var(--text-dim)]">Date of Birth</div>
                            <div className="text-sm font-medium text-[var(--text)]">{selectedPatient.demographics.birthDate}</div>
                          </div>
                          <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                            <div className="text-xs text-[var(--text-dim)]">Age</div>
                            <div className="text-sm font-medium text-[var(--text)]">
                              {Math.floor((new Date().getTime() - new Date(selectedPatient.demographics.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years
                            </div>
                          </div>
                          <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                            <div className="text-xs text-[var(--text-dim)]">Gender</div>
                            <div className="text-sm font-medium text-[var(--text)] capitalize">{selectedPatient.demographics.gender}</div>
                          </div>
                          {selectedPatient.demographics.race && (
                            <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                              <div className="text-xs text-[var(--text-dim)]">Race</div>
                              <div className="text-sm font-medium text-[var(--text)]">{selectedPatient.demographics.race}</div>
                            </div>
                          )}
                          {selectedPatient.demographics.ethnicity && (
                            <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                              <div className="text-xs text-[var(--text-dim)]">Ethnicity</div>
                              <div className="text-sm font-medium text-[var(--text)]">{selectedPatient.demographics.ethnicity}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Diagnoses */}
                      {selectedPatient.diagnoses.length > 0 && (
                        <div>
                          <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Heart className="w-3.5 h-3.5" />
                            Diagnoses ({selectedPatient.diagnoses.length})
                          </h4>
                          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Code</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Description</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">System</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Onset Date</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedPatient.diagnoses.map((dx, i) => (
                                  <tr key={i} className="text-[var(--text)] hover:bg-[var(--bg-tertiary)]/50">
                                    <td className="border-b border-[var(--border)]/50 p-2.5">
                                      <code className="text-[var(--danger)] bg-[var(--danger-light)] px-1.5 py-0.5 rounded font-mono">{dx.code}</code>
                                    </td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">{dx.display}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{dx.system}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{dx.onsetDate}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">
                                      <span className={`px-2 py-0.5 rounded text-xs ${
                                        dx.status === 'active' ? 'bg-[var(--success-light)] text-[var(--success)]' :
                                        dx.status === 'resolved' ? 'bg-blue-500/15 text-[var(--accent)]' :
                                        'bg-gray-500/15 text-gray-400'
                                      }`}>
                                        {dx.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Encounters */}
                      {selectedPatient.encounters.length > 0 && (
                        <div>
                          <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Stethoscope className="w-3.5 h-3.5" />
                            Encounters ({selectedPatient.encounters.length})
                          </h4>
                          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Code</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Description</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">System</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Date</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Type</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedPatient.encounters.map((enc, i) => (
                                  <tr key={i} className="text-[var(--text)] hover:bg-[var(--bg-tertiary)]/50">
                                    <td className="border-b border-[var(--border)]/50 p-2.5">
                                      <code className="text-[var(--accent)] bg-[var(--accent-light)] px-1.5 py-0.5 rounded font-mono">{enc.code}</code>
                                    </td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">{enc.display}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{enc.system}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{enc.date}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">
                                      <span className="px-2 py-0.5 rounded text-xs bg-[var(--accent-light)] text-[var(--accent)]">
                                        {enc.type}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Procedures */}
                      {selectedPatient.procedures.length > 0 && (
                        <div>
                          <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5" />
                            Procedures ({selectedPatient.procedures.length})
                          </h4>
                          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Code</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Description</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">System</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedPatient.procedures.map((proc, i) => (
                                  <tr key={i} className="text-[var(--text)] hover:bg-[var(--bg-tertiary)]/50">
                                    <td className="border-b border-[var(--border)]/50 p-2.5">
                                      <code className="text-[var(--warning)] bg-[var(--warning-light)] px-1.5 py-0.5 rounded font-mono">{proc.code}</code>
                                    </td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">{proc.display}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{proc.system}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{proc.date}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Observations */}
                      {selectedPatient.observations.length > 0 && (
                        <div>
                          <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5" />
                            Observations ({selectedPatient.observations.length})
                          </h4>
                          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Code</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Description</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Value</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedPatient.observations.map((obs, i) => (
                                  <tr key={i} className="text-[var(--text)] hover:bg-[var(--bg-tertiary)]/50">
                                    <td className="border-b border-[var(--border)]/50 p-2.5">
                                      <code className="text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded font-mono">{obs.code}</code>
                                    </td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">{obs.display}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 font-medium">
                                      {obs.value !== undefined ? `${obs.value} ${obs.unit || ''}` : obs.valueString || '—'}
                                    </td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{obs.date}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Medications */}
                      {selectedPatient.medications.length > 0 && (
                        <div>
                          <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Pill className="w-3.5 h-3.5" />
                            Medications ({selectedPatient.medications.length})
                          </h4>
                          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Code</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Medication</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Start Date</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">End Date</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedPatient.medications.map((med, i) => (
                                  <tr key={i} className="text-[var(--text)] hover:bg-[var(--bg-tertiary)]/50">
                                    <td className="border-b border-[var(--border)]/50 p-2.5">
                                      <code className="text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded font-mono">{med.code}</code>
                                    </td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">{med.display}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{med.startDate}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{med.endDate || '—'}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">
                                      <span className={`px-2 py-0.5 rounded text-xs ${
                                        med.status === 'active' ? 'bg-[var(--success-light)] text-[var(--success)]' :
                                        med.status === 'completed' ? 'bg-blue-500/15 text-[var(--accent)]' :
                                        'bg-[var(--danger-light)] text-[var(--danger)]'
                                      }`}>
                                        {med.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Immunizations */}
                      {selectedPatient.immunizations && selectedPatient.immunizations.length > 0 && (
                        <div>
                          <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Syringe className="w-3.5 h-3.5" />
                            Immunizations ({selectedPatient.immunizations.length})
                          </h4>
                          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Code</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Vaccine</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">System</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Date</th>
                                  <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedPatient.immunizations.map((imm, i) => (
                                  <tr key={i} className="text-[var(--text)] hover:bg-[var(--bg-tertiary)]/50">
                                    <td className="border-b border-[var(--border)]/50 p-2.5">
                                      <code className="text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded font-mono">{imm.code}</code>
                                    </td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">{imm.display}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{imm.system}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{imm.date}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">
                                      <span className={`px-2 py-0.5 rounded text-xs ${
                                        imm.status === 'completed' ? 'bg-[var(--success-light)] text-[var(--success)]' :
                                        'bg-[var(--danger-light)] text-[var(--danger)]'
                                      }`}>
                                        {imm.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Empty state */}
                      {selectedPatient.diagnoses.length === 0 &&
                       selectedPatient.encounters.length === 0 &&
                       selectedPatient.procedures.length === 0 &&
                       selectedPatient.observations.length === 0 &&
                       selectedPatient.medications.length === 0 &&
                       (!selectedPatient.immunizations || selectedPatient.immunizations.length === 0) && (
                        <div className="text-center py-6 text-[var(--text-muted)]">
                          No clinical data recorded for this patient
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Initial Population - shows each criterion (age, sex, diagnosis, etc.) */}
              {selectedTrace.populations.initialPopulation.nodes.length > 0 && (
                <ValidationSection
                  title="Initial Population"
                  subtitle="Patient must meet ALL criteria to be included in the measure"
                  nodes={selectedTrace.populations.initialPopulation.nodes}
                  operator="AND"
                  resultChip={selectedTrace.populations.initialPopulation.met ? 'IN POPULATION' : 'NOT IN POPULATION'}
                  resultPositive={selectedTrace.populations.initialPopulation.met}
                  onInspect={setInspectNode}
                />
              )}

              {selectedTrace.populations.exclusions.nodes.length > 0 && (
                <ValidationSection
                  title="Denominator Exclusions"
                  subtitle="ANY one triggers exclusion"
                  nodes={selectedTrace.populations.exclusions.nodes}
                  operator="OR"
                  resultChip={selectedTrace.populations.exclusions.met ? 'EXCLUDED' : 'Not Excluded'}
                  resultPositive={!selectedTrace.populations.exclusions.met}
                  onInspect={setInspectNode}
                />
              )}

              {selectedTrace.populations.numerator.nodes.length > 0 && !selectedTrace.populations.exclusions.met && (
                <ValidationSection
                  title="Numerator"
                  subtitle={isScreeningMeasure(measure.metadata.title, measure.metadata.measureId || '')
                    ? "ANY ONE screening test qualifies"
                    : "Quality action / outcome criteria"}
                  nodes={selectedTrace.populations.numerator.nodes}
                  operator={isScreeningMeasure(measure.metadata.title, measure.metadata.measureId || '') ? "OR" : "AND"}
                  resultChip={selectedTrace.populations.numerator.met ? 'MET' : 'NOT MET'}
                  resultPositive={selectedTrace.populations.numerator.met}
                  onInspect={setInspectNode}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
            <p>Select a patient to view their validation trace</p>
          </div>
        )}

        {/* Inspect modal */}
        {inspectNode && (
          <InspectModal node={inspectNode} onClose={() => setInspectNode(null)} />
        )}

        {/* Patient Edit Modal */}
        {editingPatient && editedPatientData && (
          <PatientEditModal
            patient={editedPatientData}
            onSave={saveEditedPatient}
            onCancel={cancelEditing}
            onChange={setEditedPatientData}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Find the first qualifying fact from a list of validation nodes.
 * Returns the earliest dated fact that contributed to qualification.
 */
function findFirstQualifyingFact(nodes                  )                                                                            {
  let earliest                                                                            = null;
  let earliestDate              = null;

  for (const node of nodes) {
    if (node.status !== 'pass') continue;

    // Check this node's facts
    for (const fact of node.facts) {
      // Skip placeholder/summary facts
      if (!fact.date || fact.date === '—' || fact.code === '—' || fact.code === 'PROGRESS' || fact.code === 'NO_MATCH') continue;

      const factDate = new Date(fact.date);
      if (isNaN(factDate.getTime())) continue;

      if (!earliestDate || factDate < earliestDate) {
        earliestDate = factDate;
        earliest = {
          code: fact.code,
          display: fact.display,
          date: fact.date,
          nodeTitle: node.title,
        };
      }
    }

    // Recursively check children
    if (node.children && node.children.length > 0) {
      const childResult = findFirstQualifyingFact(node.children);
      if (childResult) {
        const childDate = new Date(childResult.date);
        if (!earliestDate || childDate < earliestDate) {
          earliestDate = childDate;
          earliest = childResult;
        }
      }
    }
  }

  return earliest;
}

function ValidationSection({
  title,
  subtitle,
  nodes,
  operator,
  resultChip,
  resultPositive,
  onInspect,
}   
                
                    
                          
                         
                     
                          
                                            
 ) {
  const useListLayout = nodes.length > 4;
  const metCount = nodes.filter(n => n.status === 'pass').length;

  // Find the first qualifying fact for this section
  const firstQualification = resultPositive ? findFirstQualifyingFact(nodes) : null;

  return (
    <div className={`mb-6 rounded-xl border p-5 transition-colors ${
      resultPositive
        ? 'bg-[var(--success)]/5 border-[var(--success)]/30'
        : 'bg-[var(--bg-secondary)] border-[var(--border-light)]'
    }`}>
      {/* Header with status indicator */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            {resultPositive ? (
              <CheckCircle className="w-5 h-5 text-[var(--success)]" />
            ) : (
              <XCircle className="w-5 h-5 text-[var(--danger)]" />
            )}
            <h3 className={`text-sm font-semibold uppercase tracking-wider ${
              resultPositive ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'
            }`}>{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-[var(--text-dim)] mt-1 ml-7">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {useListLayout && (
            <span className="text-xs text-[var(--text-muted)]">
              {metCount} of {nodes.length} met
            </span>
          )}
          <div className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${
            resultPositive
              ? 'bg-[var(--success)] text-white'
              : 'bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/30'
          }`}>
            {resultChip}
          </div>
        </div>
      </div>

      {/* Qualifying event - shows the first triggering event */}
      {firstQualification && (
        <div className="mb-4 p-3 bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-lg">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-3.5 h-3.5 text-[var(--success)]" />
            <code className="text-[var(--accent)] bg-[var(--accent-light)] px-1.5 py-0.5 rounded text-xs font-mono">
              {firstQualification.code}
            </code>
            <span className="text-sm text-[var(--text)]">{firstQualification.display}</span>
            <span className="text-xs text-[var(--text-muted)]">on {firstQualification.date}</span>
            <span className="text-[10px] text-[var(--text-dim)]">via {firstQualification.nodeTitle}</span>
          </div>
        </div>
      )}

      <ValidationNodeList nodes={nodes} operator={operator} onInspect={onInspect} />
    </div>
  );
}

function OperatorSeparator({ operator }                                     ) {
  return (
    <div className="flex items-center gap-2 ml-4 my-1">
      <div className="w-px h-3 bg-[var(--border)]" />
      <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${
        operator === 'AND' ? 'bg-[var(--success-light)] text-[var(--success)]' :
        operator === 'OR' ? 'bg-[var(--warning-light)] text-[var(--warning)]' :
        'bg-[var(--danger-light)] text-[var(--danger)]'
      }`}>
        {operator}
      </span>
      <div className="w-px h-3 bg-[var(--border)]" />
    </div>
  );
}

function ValidationNodeList({
  nodes,
  operator,
  onInspect,
}   
                          
                                  
                                            
 ) {
  return (
    <div className="space-y-0">
      {nodes.map((node, i) => (
        <div key={node.id}>
          {i > 0 && <OperatorSeparator operator={operator} />}
          {node.children && node.children.length > 0 ? (
            /* Group node — render as a nested section */
            <div className="ml-2 rounded-lg border border-[var(--border-light)] bg-[var(--bg-tertiary)]/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                {node.status === 'pass' ? (
                  <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                ) : node.status === 'partial' ? (
                  <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
                ) : (
                  <XCircle className="w-4 h-4 text-[var(--danger)]" />
                )}
                <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                  node.operator === 'AND' ? 'bg-[var(--success-light)] text-[var(--success)]' :
                  node.operator === 'OR' ? 'bg-[var(--warning-light)] text-[var(--warning)]' :
                  'bg-[var(--danger-light)] text-[var(--danger)]'
                }`}>
                  {node.operator}
                </span>
                <h4 className="text-sm font-medium text-[var(--text-muted)]">{cleanDescription(node.title)}</h4>
                {node.facts[0] && (
                  <span className="text-xs text-[var(--text-dim)]">{node.facts[0].display}</span>
                )}
              </div>
              <ValidationNodeList
                nodes={node.children}
                operator={node.operator || 'AND'}
                onInspect={onInspect}
              />
            </div>
          ) : (
            /* Leaf node — render as a row */
            <ValidationNodeRow node={node} onClick={() => onInspect(node)} />
          )}
        </div>
      ))}
    </div>
  );
}

function ValidationNodeRow({ node, onClick }                                               ) {
  // Get the most relevant facts to show inline (skip summary/progress facts)
  const detailFacts = node.facts.filter(f =>
    f.code !== 'PROGRESS' && f.code !== 'NO_MATCH' && f.code !== 'NO_IMMUNIZATIONS'
  );
  const doseFact = node.facts.find(f => f.code === 'DOSE_COUNT' || f.code === 'INSUFFICIENT_DOSES');
  const noMatchFact = node.facts.find(f => f.code === 'NO_MATCH' || f.code === 'NO_IMMUNIZATIONS');

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors border ${
        node.status === 'pass'
          ? 'bg-[var(--success)]/5 border-[var(--success)]/20 hover:border-[var(--success)]/40'
          : node.status === 'not_applicable'
          ? 'bg-[var(--bg-tertiary)] border-[var(--border-light)] hover:border-[var(--border)]'
          : 'bg-[var(--danger)]/5 border-[var(--danger)]/20 hover:border-[var(--danger)]/40'
      }`}
    >
      {/* Pass/Fail icon */}
      <div className="flex-shrink-0">
        {node.status === 'pass' ? (
          <CheckCircle className="w-5 h-5 text-[var(--success)]" />
        ) : node.status === 'not_applicable' ? (
          <div className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs text-[var(--text-muted)]">—</div>
        ) : (
          <XCircle className="w-5 h-5 text-[var(--danger)]" />
        )}
      </div>

      {/* Criterion title and description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-[var(--text)] text-sm truncate">{cleanDescription(node.title)}</h4>
          {doseFact && (
            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
              node.status === 'pass'
                ? 'bg-[var(--success)]/15 text-[var(--success)]'
                : 'bg-[var(--danger)]/15 text-[var(--danger)]'
            }`}>
              {doseFact.display}
            </span>
          )}
        </div>
        {/* Show key supporting facts inline */}
        {detailFacts.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {detailFacts.slice(0, 5).map((fact, i) => (
              <span key={i} className="text-xs text-[var(--text-muted)]">
                {fact.code && fact.code !== '—' && fact.code !== 'DOSE_COUNT' && fact.code !== 'INSUFFICIENT_DOSES' && (
                  <code className="text-[var(--accent)] bg-[var(--accent-light)] px-1 rounded text-[10px] font-mono mr-1">{fact.code}</code>
                )}
                {fact.display}
                {fact.date && <span className="text-[var(--text-dim)]"> ({fact.date})</span>}
              </span>
            ))}
            {detailFacts.length > 5 && (
              <span className="text-xs text-[var(--text-dim)]">+{detailFacts.length - 5} more</span>
            )}
          </div>
        ) : noMatchFact ? (
          <p className="text-xs text-[var(--text-dim)] mt-0.5">{noMatchFact.display}</p>
        ) : (
          <p className="text-xs text-[var(--text-dim)] mt-0.5">{cleanDescription(node.description)}</p>
        )}
      </div>

      {/* Click-to-inspect indicator */}
      <ChevronRight className="w-4 h-4 text-[var(--text-dim)] flex-shrink-0" />
    </div>
  );
}

function ValidationNodeCard({ node, onClick }                                               ) {
  return (
    <div
      onClick={onClick}
      className="w-72 flex-shrink-0 bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg)] border border-[var(--border)] rounded-xl p-4 cursor-pointer hover:border-[var(--accent)]/50 transition-colors relative"
    >
      {/* Status icon */}
      <div className="absolute top-3 right-3">
        {node.status === 'pass' ? (
          <CheckCircle className="w-5 h-5 text-[var(--success)]" />
        ) : node.status === 'not_applicable' ? (
          <div className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs text-[var(--text-muted)]">—</div>
        ) : (
          <XCircle className="w-5 h-5 text-[var(--danger)]" />
        )}
      </div>

      {/* Badge */}
      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border mb-2 ${
        node.type === 'decision'
          ? node.status === 'pass'
            ? 'text-[var(--success)] border-[var(--success)]/30 bg-[var(--success-light)]'
            : 'text-[var(--danger)] border-[var(--danger)]/30 bg-[var(--danger-light)]'
          : 'text-[var(--text-muted)] border-[var(--border)] bg-[var(--bg-secondary)]'
      }`}>
        {node.type === 'decision'
          ? (node.status === 'pass' ? 'Met' : 'Not Met')
          : node.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
      </span>

      <h4 className="font-medium text-[var(--text)] text-sm mb-1 pr-6">{cleanDescription(node.title)}</h4>
      <p className="text-xs text-[var(--text-muted)] mb-2">{cleanDescription(node.description)}</p>

      {/* Facts preview with codes */}
      {node.facts.length > 0 && (
        <ul className="text-xs text-[var(--text-muted)] space-y-1 border-t border-[var(--border-light)] pt-2 mt-2">
          {node.facts.slice(0, 3).map((fact, i) => (
            <li key={i} className="flex items-start gap-2">
              {fact.code && fact.code !== '—' && (
                <code className="text-[var(--accent)] bg-[var(--accent-light)] px-1 rounded text-[10px] font-mono flex-shrink-0">{fact.code}</code>
              )}
              <span className="truncate">
                {fact.display}
                {fact.rawCode && fact.rawCode !== '—' && fact.rawCode !== fact.code && (
                  <span className="text-[var(--text-dim)]"> = {fact.rawCode}</span>
                )}
              </span>
            </li>
          ))}
          {node.facts.length > 3 && (
            <li className="text-[var(--text-dim)]">+{node.facts.length - 3} more...</li>
          )}
        </ul>
      )}

      {node.source && (
        <div className="text-[10px] text-[var(--text-dim)] mt-2 pt-2 border-t border-[var(--border-light)]">
          Source: {node.source}
        </div>
      )}
    </div>
  );
}

function InspectModal({ node, onClose }                                               ) {
  return (
    <div
      className="fixed inset-0 bg-black/55 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[min(1000px,92vw)] max-h-[85vh] overflow-auto bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-3">
            {node.status === 'pass' ? (
              <CheckCircle className="w-5 h-5 text-[var(--success)]" />
            ) : node.status === 'not_applicable' ? (
              <div className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs text-[var(--text-muted)]">—</div>
            ) : (
              <XCircle className="w-5 h-5 text-[var(--danger)]" />
            )}
            <h3 className="font-bold text-[var(--text)]">{cleanDescription(node.title)}</h3>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Meta pills */}
          <div className="flex flex-wrap gap-2">
            <span className={`px-2.5 py-1 rounded-full border text-xs ${
              node.type === 'decision'
                ? node.status === 'pass'
                  ? 'border-[var(--success)]/30 bg-[var(--success-light)] text-[var(--success)]'
                  : 'border-[var(--danger)]/30 bg-[var(--danger-light)] text-[var(--danger)]'
                : 'border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text)]'
            }`}>
              {node.type === 'decision'
                ? (node.status === 'pass' ? 'Met' : 'Not Met')
                : `Population: ${node.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`}
            </span>
            <span className={`px-2.5 py-1 rounded-full border text-xs ${
              node.status === 'pass'
                ? 'border-[var(--success)]/30 bg-[var(--success-light)] text-[var(--success)]'
                : node.status === 'not_applicable'
                ? 'border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                : 'border-[var(--danger)]/30 bg-[var(--danger-light)] text-[var(--danger)]'
            }`}>
              Status: {node.status === 'pass' ? 'Criteria Met' : node.status === 'not_applicable' ? 'Not Evaluated' : 'Criteria Not Met'}
            </span>
          </div>

          <p className="text-sm text-[var(--text-muted)]">{cleanDescription(node.description)}</p>

          {/* CQL */}
          {node.cqlSnippet && (
            <div>
              <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Code className="w-3.5 h-3.5" />
                Generated CQL Logic
              </h4>
              <pre className="p-3 bg-[var(--code-bg)] border border-[var(--border)] rounded-lg text-xs text-[var(--code-keyword)] overflow-auto whitespace-pre font-mono">
                {node.cqlSnippet}
              </pre>
            </div>
          )}

          {/* Facts table */}
          {node.facts.length > 0 && (
            <div>
              <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                EMR Data Used for Evaluation ({node.facts.length} record{node.facts.length !== 1 ? 's' : ''})
              </h4>
              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
                      <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Code</th>
                      <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Display Name</th>
                      <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Raw Value</th>
                      <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">System/Unit</th>
                      <th className="border-b border-[var(--border)] p-2.5 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {node.facts.map((fact, i) => (
                      <tr key={i} className="text-[var(--text)] hover:bg-[var(--bg-tertiary)]">
                        <td className="border-b border-[var(--border-light)] p-2.5">
                          {fact.code && fact.code !== '—' ? (
                            <code className="text-[var(--accent)] bg-[var(--accent-light)] px-1.5 py-0.5 rounded font-mono">{fact.code}</code>
                          ) : (
                            <span className="text-[var(--text-dim)]">—</span>
                          )}
                        </td>
                        <td className="border-b border-[var(--border-light)] p-2.5">{fact.display || '—'}</td>
                        <td className="border-b border-[var(--border-light)] p-2.5">
                          {fact.rawCode && fact.rawCode !== '—' ? (
                            <span className="font-medium">{fact.rawCode}</span>
                          ) : (
                            <span className="text-[var(--text-dim)]">—</span>
                          )}
                        </td>
                        <td className="border-b border-[var(--border-light)] p-2.5 text-[var(--text-muted)]">{fact.rawDisplay || '—'}</td>
                        <td className="border-b border-[var(--border-light)] p-2.5 text-[var(--text-muted)]">{fact.date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {node.source && (
                <div className="text-xs text-[var(--text-muted)] mt-2">Data Source: {node.source}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Helper to get the first qualifying fact from a set of validation nodes */
function getFirstQualifyingFact(nodes                  )                                                          {
  for (const node of nodes) {
    if (node.status === 'pass' && node.facts && node.facts.length > 0) {
      const fact = node.facts.find(f => f.code && f.code !== 'NO_MATCH' && f.code !== '—' && !f.code.includes('FAIL'));
      if (fact) {
        return { code: fact.code, display: fact.display || '', date: fact.date };
      }
    }
  }
  return null;
}

function EvaluationFlowItem({
  label,
  met,
  nodes,
  metText,
  notMetText,
  isImplied = false,
  impliedText,
  showTrigger = false,
}   
                
               
                          
                  
                     
                      
                       
                        
 ) {
  const firstFact = met ? getFirstQualifyingFact(nodes) : null;
  // For exclusions or other items where we want to show what triggered the result
  const triggerFact = showTrigger ? getFirstQualifyingFact(nodes) : null;

  return (
    <div className="flex items-start gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        met ? 'bg-[var(--success-light)]' : 'bg-[var(--danger-light)]'
      }`}>
        {met ? (
          <CheckCircle className="w-3.5 h-3.5 text-[var(--success)]" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-[var(--danger)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--text)]">{label}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${
            met
              ? 'bg-[var(--success-light)] text-[var(--success)]'
              : 'bg-[var(--danger-light)] text-[var(--danger)]'
          }`}>
            {met ? metText : notMetText}
          </span>
        </div>
        {isImplied && impliedText && (
          <p className="text-xs text-[var(--text-dim)] mt-0.5">{impliedText}</p>
        )}
        {firstFact && (
          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-[var(--text-dim)]">Triggered by:</span>
            <code className="text-[var(--accent)] bg-[var(--accent-light)] px-1.5 py-0.5 rounded font-mono">
              {firstFact.code}
            </code>
            <span className="text-[var(--text-muted)] truncate max-w-[250px]">{firstFact.display}</span>
            {firstFact.date && firstFact.date !== '—' && (
              <span className="text-[var(--text-dim)]">on {firstFact.date}</span>
            )}
          </div>
        )}
        {triggerFact && (
          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-[var(--text-dim)]">Excluded by:</span>
            <code className="text-[var(--warning)] bg-[var(--warning-light)] px-1.5 py-0.5 rounded font-mono">
              {triggerFact.code}
            </code>
            <span className="text-[var(--text-muted)] truncate max-w-[250px]">{triggerFact.display}</span>
            {triggerFact.date && triggerFact.date !== '—' && (
              <span className="text-[var(--text-dim)]">on {triggerFact.date}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryPill({ label, value, positive }                                                     ) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={`font-bold ${positive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{value}</span>
    </div>
  );
}

/**
 * DetailedEvaluationSummary - Enhanced evaluation summary that shows ALL criteria
 * Replaces the simple Measure Evaluation Summary with detailed narrative for each criterion
 */
function DetailedEvaluationSummary({ trace, patient, measure, howClose }) {
  const [collapsedSections, setCollapsedSections] = useState({});

  const toggleSection = (sectionId) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Get measurement period for display
  const mpStart = measure?.measurementPeriod?.start || `${new Date().getFullYear()}-01-01`;
  const mpEnd = measure?.measurementPeriod?.end || `${new Date().getFullYear()}-12-31`;

  // Helper to format dates
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '—') return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  // Recursively flatten all nodes including nested children
  const flattenNodes = (nodes) => {
    if (!nodes) return [];
    const result = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children && node.children.length > 0) {
        result.push(...flattenNodes(node.children));
      }
    }
    return result;
  };

  // Render a single criterion node with its facts
  const renderCriterionNode = (node, index, isLast = false) => {
    const isPass = node.status === 'pass' || node.status === 'partial';
    const isIncomplete = node.status === 'incomplete';
    const facts = node.facts || [];

    // Get the most relevant fact for display
    const primaryFact = facts.find(f =>
      f.code && f.code !== 'NO_MATCH' && f.code !== 'NO_CODES' && f.code !== '—' && !f.code.includes('FAIL') && f.code !== 'GROUP_MATCH'
    ) || facts.find(f => f.display && !f.display.includes('None found'));

    // Determine styling based on status
    let iconBgClass, iconComponent, badgeClass, badgeText;
    if (isIncomplete) {
      iconBgClass = 'bg-[var(--warning-light)]';
      iconComponent = <AlertTriangle className="w-3 h-3 text-[var(--warning)]" />;
      badgeClass = 'bg-[var(--warning-light)] text-[var(--warning)]';
      badgeText = 'Incomplete';
    } else if (isPass) {
      iconBgClass = 'bg-[var(--success-light)]';
      iconComponent = <CheckCircle className="w-3 h-3 text-[var(--success)]" />;
      badgeClass = 'bg-[var(--success-light)] text-[var(--success)]';
      badgeText = 'Met';
    } else {
      iconBgClass = 'bg-[var(--danger-light)]';
      iconComponent = <XCircle className="w-3 h-3 text-[var(--danger)]" />;
      badgeClass = 'bg-[var(--danger-light)] text-[var(--danger)]';
      badgeText = 'Not Met';
    }

    // Clean description for inline display
    const cleanedDesc = node.description ? cleanDescription(node.description) : null;

    return (
      <div key={node.id || index} className={`flex items-start gap-2 py-1.5 ${!isLast ? 'border-b border-[var(--border-light)]' : ''}`}>
        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBgClass}`}>
          {iconComponent}
        </div>
        <div className="flex-1 min-w-0">
          {/* Main line: Title + Badge + Description (all inline) */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--text)]">{node.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badgeClass}`}>
              {badgeText}
            </span>
            {cleanedDesc && (
              <>
                <span className="text-[var(--text-dim)]">—</span>
                <span className="text-xs text-[var(--text-muted)]">{cleanedDesc}</span>
              </>
            )}
          </div>
          {/* Secondary line: fact details (code + display + date) - indented */}
          {isIncomplete && (
            <p className="text-[11px] text-[var(--warning)] mt-0.5 ml-0">
              No value set codes configured
            </p>
          )}
          {primaryFact && !isIncomplete && (
            <div className="mt-0.5 ml-0 flex items-center gap-1.5 flex-wrap text-[11px]">
              {primaryFact.code && primaryFact.code !== '—' && (
                <code className={`px-1 py-0.5 rounded font-mono text-[10px] ${
                  isPass
                    ? 'text-[var(--accent)] bg-[var(--accent-light)]'
                    : 'text-[var(--danger)] bg-[var(--danger-light)]'
                }`}>
                  {primaryFact.code}
                </code>
              )}
              {primaryFact.display && (
                <span className="text-[var(--text-muted)]">{primaryFact.display}</span>
              )}
              {primaryFact.date && primaryFact.date !== '—' && (
                <span className="text-[var(--text-dim)]">on {formatDate(primaryFact.date)}</span>
              )}
              {/* Show count of additional matching records inline */}
              {facts.filter(f => f.code && f.code !== 'NO_MATCH' && f.code !== '—' && f.date).length > 1 && (
                <span className="text-[var(--text-dim)]">
                  (+{facts.filter(f => f.code && f.code !== 'NO_MATCH' && f.code !== '—' && f.date).length - 1} more)
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render a population section
  const renderPopulationSection = (
    label,
    populationResult,
    sectionId,
    options = {}
  ) => {
    const { isImplied, impliedText, showTrigger, hideIfEmpty } = options;
    const { met, nodes } = populationResult || { met: false, nodes: [] };
    const allNodes = flattenNodes(nodes);
    const isCollapsed = collapsedSections[sectionId] || false;

    // Skip if no nodes and hideIfEmpty is true
    if (hideIfEmpty && allNodes.length === 0) return null;

    // Count met/total
    const metCount = allNodes.filter(n => n.status === 'pass' || n.status === 'partial').length;
    const totalCount = allNodes.length;

    return (
      <div className="border-b border-[var(--border)] last:border-b-0 pb-3 mb-3 last:pb-0 last:mb-0">
        <button
          onClick={() => toggleSection(sectionId)}
          className="w-full flex items-start gap-3 hover:bg-[var(--bg-tertiary)]/30 rounded-lg p-1 -m-1 transition-colors"
        >
          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
            showTrigger ? 'bg-[var(--warning-light)]' : met ? 'bg-[var(--success-light)]' : 'bg-[var(--danger-light)]'
          }`}>
            {showTrigger ? (
              <AlertTriangle className="w-3.5 h-3.5 text-[var(--warning)]" />
            ) : met ? (
              <CheckCircle className="w-3.5 h-3.5 text-[var(--success)]" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-[var(--danger)]" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-[var(--text)]">{label}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                showTrigger
                  ? 'bg-[var(--warning-light)] text-[var(--warning)]'
                  : met
                    ? 'bg-[var(--success-light)] text-[var(--success)]'
                    : 'bg-[var(--danger-light)] text-[var(--danger)]'
              }`}>
                {showTrigger ? 'Excluded' : met ? 'Qualifies' : 'Does Not Qualify'}
              </span>
              {totalCount > 0 && (
                <span className="text-xs text-[var(--text-dim)]">
                  ({metCount}/{totalCount} criteria)
                </span>
              )}
            </div>
            {isImplied && impliedText && (
              <p className="text-xs text-[var(--text-dim)] mt-0.5">{impliedText}</p>
            )}
          </div>
          <div className="flex-shrink-0 p-1">
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
            ) : (
              <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
            )}
          </div>
        </button>

        {!isCollapsed && allNodes.length > 0 && (
          <div className="mt-1.5 ml-6 border-l-2 border-[var(--border)] pl-2">
            {allNodes.map((node, idx) => renderCriterionNode(node, idx, idx === allNodes.length - 1))}
          </div>
        )}

        {!isCollapsed && isImplied && allNodes.length === 0 && (
          <div className="mt-2 ml-8 text-xs text-[var(--text-dim)]">
            No additional criteria required.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-6 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-light)] p-5">
      <h3 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-[var(--accent)]" />
        Measure Evaluation Summary
      </h3>

      <div className="space-y-0">
        {/* Initial Population */}
        {renderPopulationSection(
          'Initial Population',
          trace.populations.initialPopulation,
          'ip'
        )}

        {/* Denominator - only show if IP met */}
        {trace.populations.initialPopulation.met && renderPopulationSection(
          'Denominator',
          trace.populations.denominator,
          'denom',
          {
            isImplied: !trace.populations.denominator?.nodes?.length,
            impliedText: 'Equals Initial Population'
          }
        )}

        {/* Exclusions - only show if patient IS excluded */}
        {trace.populations.initialPopulation.met && trace.populations.exclusions?.met && renderPopulationSection(
          'Denominator Exclusions',
          { ...trace.populations.exclusions, nodes: trace.populations.exclusions.nodes.filter(n => n.status === 'pass') },
          'exclusions',
          { showTrigger: true }
        )}

        {/* Numerator - only show if in denominator and not excluded */}
        {trace.populations.initialPopulation.met && !trace.populations.exclusions?.met && renderPopulationSection(
          'Numerator',
          trace.populations.numerator,
          'numer'
        )}

        {/* Gap Analysis items - compute from failed numerator criteria if howClose is empty */}
        {(() => {
          // Compute gaps from failed numerator criteria
          const numeratorNodes = flattenNodes(trace.populations.numerator?.nodes || []);
          const failedCriteria = numeratorNodes.filter(n =>
            n.status !== 'pass' && n.status !== 'partial' && n.status !== 'incomplete'
          );

          // Build gap messages from failed criteria descriptions
          const computedGaps = failedCriteria.map(node => {
            const desc = node.description ? cleanDescription(node.description) : null;
            return desc ? `Missing: ${desc}` : `Missing: ${node.title}`;
          });

          // Use provided howClose if available, otherwise use computed gaps
          const gapsToShow = (howClose && howClose.length > 0) ? howClose : computedGaps;

          // Only show if patient is in denominator but not in numerator
          const showGaps = trace.populations.initialPopulation.met &&
                           !trace.populations.exclusions?.met &&
                           !trace.populations.numerator?.met &&
                           gapsToShow.length > 0;

          if (!showGaps) return null;

          return (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <div className="text-xs font-medium text-[var(--accent)] mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Gaps to Close ({gapsToShow.length})
              </div>
              <ul className="space-y-1">
                {gapsToShow.map((item, i) => (
                  <li key={i} className="text-sm text-[var(--text-muted)] flex items-start gap-2">
                    <span className="text-[var(--warning)] mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function OutcomeBadge({ outcome }                                                     ) {
  const styles = {
    in_numerator: 'bg-[var(--success-light)] text-[var(--success)] border-[var(--success)]/30',
    not_in_numerator: 'bg-[var(--danger-light)] text-[var(--danger)] border-[var(--danger)]/30',
    excluded: 'bg-[var(--warning-light)] text-[var(--warning)] border-[var(--warning)]/30',
    not_in_population: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border)]',
  };

  const labels = {
    in_numerator: 'In Numerator',
    not_in_numerator: 'In Denominator',
    excluded: 'Excluded',
    not_in_population: 'Not in Population',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs border ${styles[outcome]}`}>
      {labels[outcome]}
    </span>
  );
}

// Patient Edit Modal Component
function PatientEditModal({
  patient,
  onSave,
  onCancel,
  onChange,
}   
                       
                     
                       
                                           
 ) {
  const [activeTab, setActiveTab] = useState                                                                                                               ('demographics');

  const updateDemographics = (field        , value        ) => {
    onChange({
      ...patient,
      demographics: { ...patient.demographics, [field]: value },
    });
  };

  const updateName = (value        ) => {
    onChange({ ...patient, name: value });
  };

  const addDiagnosis = () => {
    onChange({
      ...patient,
      diagnoses: [...patient.diagnoses, { code: '', system: 'ICD10', display: '', onsetDate: new Date().toISOString().split('T')[0], status: 'active' }],
    });
  };

  const updateDiagnosis = (index        , field        , value        ) => {
    const updated = [...patient.diagnoses];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...patient, diagnoses: updated });
  };

  const removeDiagnosis = (index        ) => {
    onChange({ ...patient, diagnoses: patient.diagnoses.filter((_, i) => i !== index) });
  };

  const addEncounter = () => {
    onChange({
      ...patient,
      encounters: [...patient.encounters, { code: '', system: 'CPT', display: '', date: new Date().toISOString().split('T')[0], type: 'outpatient' }],
    });
  };

  const updateEncounter = (index        , field        , value        ) => {
    const updated = [...patient.encounters];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...patient, encounters: updated });
  };

  const removeEncounter = (index        ) => {
    onChange({ ...patient, encounters: patient.encounters.filter((_, i) => i !== index) });
  };

  const addProcedure = () => {
    onChange({
      ...patient,
      procedures: [...patient.procedures, { code: '', system: 'CPT', display: '', date: new Date().toISOString().split('T')[0] }],
    });
  };

  const updateProcedure = (index        , field        , value        ) => {
    const updated = [...patient.procedures];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...patient, procedures: updated });
  };

  const removeProcedure = (index        ) => {
    onChange({ ...patient, procedures: patient.procedures.filter((_, i) => i !== index) });
  };

  const addObservation = () => {
    onChange({
      ...patient,
      observations: [...patient.observations, { code: '', system: 'LOINC', display: '', date: new Date().toISOString().split('T')[0], value: undefined, unit: '' }],
    });
  };

  const updateObservation = (index        , field        , value                             ) => {
    const updated = [...patient.observations];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...patient, observations: updated });
  };

  const removeObservation = (index        ) => {
    onChange({ ...patient, observations: patient.observations.filter((_, i) => i !== index) });
  };

  const addMedication = () => {
    onChange({
      ...patient,
      medications: [...patient.medications, { code: '', system: 'RxNorm', display: '', startDate: new Date().toISOString().split('T')[0], status: 'active' }],
    });
  };

  const updateMedication = (index        , field        , value        ) => {
    const updated = [...patient.medications];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...patient, medications: updated });
  };

  const removeMedication = (index        ) => {
    onChange({ ...patient, medications: patient.medications.filter((_, i) => i !== index) });
  };

  const addImmunization = () => {
    onChange({
      ...patient,
      immunizations: [...(patient.immunizations || []), { code: '', system: 'CVX', display: '', date: new Date().toISOString().split('T')[0], status: 'completed' }],
    });
  };

  const updateImmunization = (index        , field        , value        ) => {
    const updated = [...(patient.immunizations || [])];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...patient, immunizations: updated });
  };

  const removeImmunization = (index        ) => {
    onChange({ ...patient, immunizations: (patient.immunizations || []).filter((_, i) => i !== index) });
  };

  const tabs = [
    { id: 'demographics', label: 'Demographics', icon: User },
    { id: 'diagnoses', label: `Diagnoses (${patient.diagnoses.length})`, icon: Heart },
    { id: 'encounters', label: `Encounters (${patient.encounters.length})`, icon: Stethoscope },
    { id: 'procedures', label: `Procedures (${patient.procedures.length})`, icon: Activity },
    { id: 'observations', label: `Observations (${patient.observations.length})`, icon: FileCode },
    { id: 'medications', label: `Medications (${patient.medications.length})`, icon: Pill },
    { id: 'immunizations', label: `Immunizations (${patient.immunizations?.length || 0})`, icon: Syringe },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-[min(1100px,95vw)] max-h-[90vh] overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text)]">Edit Patient</h3>
              <p className="text-sm text-[var(--text-muted)]">{patient.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)] overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--accent-light)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {activeTab === 'demographics' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Patient Name</label>
                <input
                  type="text"
                  value={patient.name}
                  onChange={(e) => updateName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={patient.demographics.birthDate}
                    onChange={(e) => updateDemographics('birthDate', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Gender</label>
                  <select
                    value={patient.demographics.gender}
                    onChange={(e) => updateDemographics('gender', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Race</label>
                  <input
                    type="text"
                    value={patient.demographics.race || ''}
                    onChange={(e) => updateDemographics('race', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none"
                    placeholder="e.g., White, Black, Asian"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Ethnicity</label>
                  <input
                    type="text"
                    value={patient.demographics.ethnicity || ''}
                    onChange={(e) => updateDemographics('ethnicity', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none"
                    placeholder="e.g., Hispanic or Latino"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'diagnoses' && (
            <div className="space-y-3">
              <button
                onClick={addDiagnosis}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--success-light)] border border-[var(--success)]/30 text-[var(--success)] hover:opacity-80 transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Diagnosis
              </button>
              {patient.diagnoses.map((dx, index) => (
                <div key={index} className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.1] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text)]">Diagnosis {index + 1}</span>
                    <button onClick={() => removeDiagnosis(index)} className="p-1 text-[var(--danger)] hover:bg-[var(--danger-light)] rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input type="text" value={dx.code} onChange={(e) => updateDiagnosis(index, 'code', e.target.value)} placeholder="Code (e.g., I10)" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <input type="text" value={dx.display} onChange={(e) => updateDiagnosis(index, 'display', e.target.value)} placeholder="Description" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <input type="date" value={dx.onsetDate} onChange={(e) => updateDiagnosis(index, 'onsetDate', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <select value={dx.status} onChange={(e) => updateDiagnosis(index, 'status', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none">
                      <option value="active">Active</option>
                      <option value="resolved">Resolved</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              ))}
              {patient.diagnoses.length === 0 && <p className="text-[var(--text-muted)] text-sm py-4">No diagnoses recorded</p>}
            </div>
          )}

          {activeTab === 'encounters' && (
            <div className="space-y-3">
              <button onClick={addEncounter} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent-light)] border border-blue-500/30 text-[var(--accent)] hover:bg-blue-500/20 transition-colors text-sm">
                <Plus className="w-4 h-4" />
                Add Encounter
              </button>
              {patient.encounters.map((enc, index) => (
                <div key={index} className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.1] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text)]">Encounter {index + 1}</span>
                    <button onClick={() => removeEncounter(index)} className="p-1 text-[var(--danger)] hover:bg-[var(--danger-light)] rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input type="text" value={enc.code} onChange={(e) => updateEncounter(index, 'code', e.target.value)} placeholder="Code (e.g., 99213)" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <input type="text" value={enc.display} onChange={(e) => updateEncounter(index, 'display', e.target.value)} placeholder="Description" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <input type="date" value={enc.date} onChange={(e) => updateEncounter(index, 'date', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <select value={enc.type} onChange={(e) => updateEncounter(index, 'type', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none">
                      <option value="outpatient">Outpatient</option>
                      <option value="inpatient">Inpatient</option>
                      <option value="emergency">Emergency</option>
                      <option value="telehealth">Telehealth</option>
                      <option value="hospice">Hospice</option>
                    </select>
                  </div>
                </div>
              ))}
              {patient.encounters.length === 0 && <p className="text-[var(--text-muted)] text-sm py-4">No encounters recorded</p>}
            </div>
          )}

          {activeTab === 'procedures' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button onClick={addProcedure} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors text-sm">
                  <Plus className="w-4 h-4" />
                  Add Procedure
                </button>
                <p className="text-xs text-[var(--text-muted)]">
                  Edit procedure dates to test measure timing logic (e.g., colonoscopy within 10 years)
                </p>
              </div>
              {patient.procedures.map((proc, index) => (
                <div key={index} className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.1] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text)]">Procedure {index + 1}</span>
                    <button onClick={() => removeProcedure(index)} className="p-1 text-[var(--danger)] hover:bg-[var(--danger-light)] rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">CPT/HCPCS Code</label>
                      <input
                        type="text"
                        value={proc.code}
                        onChange={(e) => updateProcedure(index, 'code', e.target.value)}
                        placeholder="e.g., 45378"
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Description</label>
                      <input
                        type="text"
                        value={proc.display}
                        onChange={(e) => updateProcedure(index, 'display', e.target.value)}
                        placeholder="e.g., Colonoscopy, flexible, diagnostic"
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Procedure Date</label>
                      <input
                        type="date"
                        value={proc.date}
                        onChange={(e) => updateProcedure(index, 'date', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none"
                      />
                    </div>
                  </div>
                  {/* Quick info about common procedure codes */}
                  {proc.code === '45378' && (
                    <p className="text-xs text-orange-400/80">Colonoscopy - screening valid for 10 years</p>
                  )}
                  {proc.code === '45380' && (
                    <p className="text-xs text-orange-400/80">Colonoscopy with biopsy - screening valid for 10 years</p>
                  )}
                  {proc.code === '82274' && (
                    <p className="text-xs text-orange-400/80">FIT/FOBT test - screening valid for 1 year</p>
                  )}
                </div>
              ))}
              {patient.procedures.length === 0 && <p className="text-[var(--text-muted)] text-sm py-4">No procedures recorded</p>}
            </div>
          )}

          {activeTab === 'observations' && (
            <div className="space-y-3">
              <button onClick={addObservation} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-colors text-sm">
                <Plus className="w-4 h-4" />
                Add Observation
              </button>
              {patient.observations.map((obs, index) => (
                <div key={index} className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.1] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text)]">Observation {index + 1}</span>
                    <button onClick={() => removeObservation(index)} className="p-1 text-[var(--danger)] hover:bg-[var(--danger-light)] rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <input type="text" value={obs.code} onChange={(e) => updateObservation(index, 'code', e.target.value)} placeholder="Code (e.g., 8480-6)" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <input type="text" value={obs.display} onChange={(e) => updateObservation(index, 'display', e.target.value)} placeholder="Description" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <input type="number" value={obs.value ?? ''} onChange={(e) => updateObservation(index, 'value', e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="Value" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <input type="text" value={obs.unit || ''} onChange={(e) => updateObservation(index, 'unit', e.target.value)} placeholder="Unit (e.g., mm[Hg])" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <input type="date" value={obs.date} onChange={(e) => updateObservation(index, 'date', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                  </div>
                </div>
              ))}
              {patient.observations.length === 0 && <p className="text-[var(--text-muted)] text-sm py-4">No observations recorded</p>}
            </div>
          )}

          {activeTab === 'medications' && (
            <div className="space-y-3">
              <button onClick={addMedication} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-400 hover:bg-pink-500/20 transition-colors text-sm">
                <Plus className="w-4 h-4" />
                Add Medication
              </button>
              {patient.medications.map((med, index) => (
                <div key={index} className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.1] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text)]">Medication {index + 1}</span>
                    <button onClick={() => removeMedication(index)} className="p-1 text-[var(--danger)] hover:bg-[var(--danger-light)] rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input type="text" value={med.code} onChange={(e) => updateMedication(index, 'code', e.target.value)} placeholder="Code" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <input type="text" value={med.display} onChange={(e) => updateMedication(index, 'display', e.target.value)} placeholder="Medication name" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <input type="date" value={med.startDate} onChange={(e) => updateMedication(index, 'startDate', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <select value={med.status} onChange={(e) => updateMedication(index, 'status', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none">
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="stopped">Stopped</option>
                    </select>
                  </div>
                </div>
              ))}
              {patient.medications.length === 0 && <p className="text-[var(--text-muted)] text-sm py-4">No medications recorded</p>}
            </div>
          )}

          {activeTab === 'immunizations' && (
            <div className="space-y-3">
              <button onClick={addImmunization} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 transition-colors text-sm">
                <Plus className="w-4 h-4" />
                Add Immunization
              </button>
              {(patient.immunizations || []).map((imm, index) => (
                <div key={index} className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.1] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text)]">Immunization {index + 1}</span>
                    <button onClick={() => removeImmunization(index)} className="p-1 text-[var(--danger)] hover:bg-[var(--danger-light)] rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input type="text" value={imm.code} onChange={(e) => updateImmunization(index, 'code', e.target.value)} placeholder="CVX Code" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <input type="text" value={imm.display} onChange={(e) => updateImmunization(index, 'display', e.target.value)} placeholder="Vaccine name" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <input type="date" value={imm.date} onChange={(e) => updateImmunization(index, 'date', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none" />
                    <select value={imm.status} onChange={(e) => updateImmunization(index, 'status', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] text-sm focus:border-[var(--accent)]/50 focus:outline-none">
                      <option value="completed">Completed</option>
                      <option value="not-done">Not Done</option>
                    </select>
                  </div>
                </div>
              ))}
              {(!patient.immunizations || patient.immunizations.length === 0) && <p className="text-[var(--text-muted)] text-sm py-4">No immunizations recorded</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
