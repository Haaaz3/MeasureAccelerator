import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, Info, Code, FileText, User, AlertTriangle, Cpu, FileCode, Database, ChevronDown, ChevronUp, Heart, Calendar, Stethoscope, Pill, Syringe, Activity, Edit3, X, Save, Plus, Trash2, Library, ChevronRight, ArrowUpDown, Filter, ArrowUp, ArrowDown } from 'lucide-react';
import { useMeasureStore, type CodeOutputFormat } from '../../stores/measureStore';
import type { PatientValidationTrace, ValidationNode } from '../../types/ums';
import { generateTestPatients } from '../../services/testPatientGenerator';
import { evaluatePatient, type TestPatient } from '../../services/measureEvaluator';

const CODE_FORMAT_INFO: Record<CodeOutputFormat, { label: string; icon: typeof Code; color: string }> = {
  cql: { label: 'CQL (Clinical Quality Language)', icon: FileCode, color: 'text-purple-400' },
  synapse: { label: 'Azure Synapse SQL', icon: Database, color: 'text-blue-400' },
  sql: { label: 'Standard SQL', icon: Code, color: 'text-emerald-400' },
};

// Test patients with complex EMR data - named after Dune & Hyperion characters
const _DEMO_TRACES: PatientValidationTrace[] = [
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

type PopulationFilter = 'all' | 'in_numerator' | 'not_in_numerator' | 'excluded' | 'not_in_population';
type SortField = 'name' | 'age' | 'sex' | 'outcome';
type SortDirection = 'asc' | 'desc';

// Helper to calculate age from birth date
function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function ValidationTraceViewer() {
  const { getActiveMeasure, selectedCodeFormat, setActiveTab } = useMeasureStore();
  const measure = getActiveMeasure();
  const [selectedTrace, setSelectedTrace] = useState<PatientValidationTrace | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<TestPatient | null>(null);
  const [inspectNode, setInspectNode] = useState<ValidationNode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationTraces, setValidationTraces] = useState<PatientValidationTrace[]>([]);
  const [testPatients, setTestPatients] = useState<TestPatient[]>([]);
  const [showPatientDetails, setShowPatientDetails] = useState(true);
  const [populationFilter, setPopulationFilter] = useState<PopulationFilter>('all');
  const [editingPatient, setEditingPatient] = useState<TestPatient | null>(null);
  const [editedPatientData, setEditedPatientData] = useState<TestPatient | null>(null);

  // Sort and filter state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [ageRange, setAgeRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [showFilters, setShowFilters] = useState(false);

  const codeInfo = CODE_FORMAT_INFO[selectedCodeFormat];
  const CodeIcon = codeInfo.icon;

  // Load edited patients from localStorage
  const loadEditedPatients = (): Record<string, TestPatient> => {
    try {
      const saved = localStorage.getItem('editedTestPatients');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  // Save edited patients to localStorage
  const saveEditedPatientsToStorage = (patients: Record<string, TestPatient>) => {
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

    console.log('Loaded test patients:', patients.map(p => ({
      name: p.name,
      birthDate: p.demographics.birthDate,
      diagnoses: p.diagnoses.length,
      encounters: p.encounters.length,
      procedures: p.procedures.length,
      edited: !!editedPatients[p.id],
    })));

    // Evaluate each patient against the measure
    const traces = patients.map(patient => {
      const trace = evaluatePatient(patient, measure);
      console.log(`Evaluated ${patient.name}:`, trace.finalOutcome);
      return trace;
    });

    setTestPatients(patients);
    setValidationTraces(traces);
    setSelectedTrace(traces[0] || null);
    setSelectedPatient(patients[0] || null);
    setIsGenerating(false);
  }, [measure?.id]); // Re-run when measure changes

  // Handle patient selection
  const handleSelectPatient = (trace: PatientValidationTrace, _index: number) => {
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
  const handleFilterClick = (filter: PopulationFilter) => {
    setPopulationFilter(prev => prev === filter ? 'all' : filter);
  };

  // Toggle sort direction or change sort field
  const handleSortChange = (field: SortField) => {
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
  const startEditingPatient = (patient: TestPatient) => {
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
    console.log(`Saved patient ${editedPatientData.id} to localStorage`);

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
  const _resetPatientToOriginal = (patientId: string) => {
    const editedPatients = loadEditedPatients();
    delete editedPatients[patientId];
    saveEditedPatientsToStorage(editedPatients);

    // Reload the original patient
    const basePatients = generateTestPatients(measure!, 36);
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
            onClick={() => useMeasureStore.getState().setActiveTab('library')}
            className="px-6 py-3 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors inline-flex items-center gap-2"
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
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-4">
            <button
              onClick={() => setActiveTab('library')}
              className="text-[var(--text-muted)] hover:text-cyan-400 transition-colors"
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
                <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-5 h-5 text-cyan-400" />
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
                onClick={() => setActiveTab('codegen')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] hover:border-cyan-500/30 transition-colors group"
              >
                <CodeIcon className={`w-5 h-5 ${codeInfo.color}`} />
                <span className={`font-medium ${codeInfo.color}`}>{codeInfo.label}</span>
                <span className="text-xs text-[var(--text-dim)] group-hover:text-cyan-400 transition-colors">← Change</span>
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
                  ? 'bg-emerald-500/25 border-2 border-emerald-500/60 ring-2 ring-emerald-500/20'
                  : 'bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15'
              }`}
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-medium">{stats.inNumerator}</span>
              <span className="text-[var(--text-muted)]">In Numerator</span>
            </button>
            <button
              onClick={() => handleFilterClick('not_in_numerator')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                populationFilter === 'not_in_numerator'
                  ? 'bg-red-500/25 border-2 border-red-500/60 ring-2 ring-red-500/20'
                  : 'bg-red-500/10 border border-red-500/20 hover:bg-red-500/15'
              }`}
            >
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 font-medium">{stats.notControlled}</span>
              <span className="text-[var(--text-muted)]">In Denominator</span>
            </button>
            <button
              onClick={() => handleFilterClick('excluded')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                populationFilter === 'excluded'
                  ? 'bg-amber-500/25 border-2 border-amber-500/60 ring-2 ring-amber-500/20'
                  : 'bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 font-medium">{stats.excluded}</span>
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
                className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-cyan-400 transition-colors"
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
                      ? 'bg-cyan-500/20 text-cyan-400'
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
              {(['name', 'age', 'sex', 'outcome'] as SortField[]).map(field => (
                <button
                  key={field}
                  onClick={() => handleSortChange(field)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    sortField === field
                      ? 'bg-cyan-500/20 text-cyan-400'
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
                    {(['all', 'male', 'female'] as const).map(g => (
                      <button
                        key={g}
                        onClick={() => setGenderFilter(g)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          genderFilter === g
                            ? 'bg-cyan-500/20 text-cyan-400'
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
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
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
                      ? 'bg-cyan-500/15 border border-cyan-500/30'
                      : 'hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      gender === 'male' ? 'bg-blue-500/15' : gender === 'female' ? 'bg-pink-500/15' : 'bg-[var(--bg-tertiary)]'
                    }`}>
                      <User className={`w-4 h-4 ${
                        gender === 'male' ? 'text-blue-400' : gender === 'female' ? 'text-pink-400' : 'text-[var(--text-muted)]'
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
            <div className="max-w-5xl mx-auto">
              {/* Patient header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-xl font-bold text-[var(--text)]">{selectedTrace.patientName}</h1>
                  <OutcomeBadge outcome={selectedTrace.finalOutcome} />
                </div>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  {selectedTrace.narrative}
                </p>
              </div>

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
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-sm"
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
                                      <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-mono">{dx.code}</code>
                                    </td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">{dx.display}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{dx.system}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{dx.onsetDate}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">
                                      <span className={`px-2 py-0.5 rounded text-xs ${
                                        dx.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                                        dx.status === 'resolved' ? 'bg-blue-500/15 text-blue-400' :
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
                                      <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono">{enc.code}</code>
                                    </td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">{enc.display}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{enc.system}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5 text-[var(--text-muted)]">{enc.date}</td>
                                    <td className="border-b border-[var(--border)]/50 p-2.5">
                                      <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/15 text-cyan-400">
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
                                      <code className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono">{proc.code}</code>
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
                                        med.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                                        med.status === 'completed' ? 'bg-blue-500/15 text-blue-400' :
                                        'bg-red-500/15 text-red-400'
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
                                        imm.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                                        'bg-red-500/15 text-red-400'
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

              {/* How close section */}
              {selectedTrace.howClose && selectedTrace.howClose.length > 0 && (
                <div className="mb-6 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                  <h3 className="text-sm font-medium text-cyan-400 mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Gap Analysis
                  </h3>
                  <ul className="space-y-1 text-sm text-[var(--text-muted)]">
                    {selectedTrace.howClose.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-cyan-400 mt-1">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Summary pills */}
              <div className="flex flex-wrap gap-3 mb-6">
                <SummaryPill
                  label="Initial Population"
                  value={selectedTrace.populations.initialPopulation.met ? 'Met' : 'Not Met'}
                  positive={selectedTrace.populations.initialPopulation.met}
                />
                <SummaryPill
                  label="Denominator"
                  value={selectedTrace.populations.denominator.met ? 'In' : 'Out'}
                  positive={selectedTrace.populations.denominator.met}
                />
                <SummaryPill
                  label="Exclusions"
                  value={selectedTrace.populations.exclusions.met ? 'Excluded' : 'None'}
                  positive={!selectedTrace.populations.exclusions.met}
                />
                <SummaryPill
                  label="Numerator"
                  value={selectedTrace.populations.numerator.met ? 'Met' : selectedTrace.populations.exclusions.met ? 'N/A' : 'Not Met'}
                  positive={selectedTrace.populations.numerator.met}
                />
              </div>

              {/* Population sections */}
              {selectedTrace.populations.initialPopulation.nodes.length > 0 && (
                <ValidationSection
                  title="Initial Population"
                  subtitle="ALL criteria must be true"
                  nodes={selectedTrace.populations.initialPopulation.nodes}
                  operator="AND"
                  resultChip={selectedTrace.populations.initialPopulation.met ? 'In IP' : 'Not in IP'}
                  resultPositive={selectedTrace.populations.initialPopulation.met}
                  onInspect={setInspectNode}
                />
              )}

              {selectedTrace.populations.denominator.nodes.length > 0 && (
                <ValidationSection
                  title="Denominator"
                  nodes={selectedTrace.populations.denominator.nodes}
                  operator="AND"
                  resultChip="Check Exclusions →"
                  resultPositive={true}
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
                  subtitle="Quality action / outcome criteria"
                  nodes={selectedTrace.populations.numerator.nodes}
                  operator="AND"
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

function ValidationSection({
  title,
  subtitle,
  nodes,
  operator,
  resultChip,
  resultPositive,
  onInspect,
}: {
  title: string;
  subtitle?: string;
  nodes: ValidationNode[];
  operator: 'AND' | 'OR';
  resultChip: string;
  resultPositive: boolean;
  onInspect: (node: ValidationNode) => void;
}) {
  return (
    <div className="mb-6 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-light)] p-5">
      <div className="mb-3">
        <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--text-dim)] mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-stretch gap-4 overflow-x-auto pb-2">
        {nodes.map((node, i) => (
          <div key={node.id} className="contents">
            <ValidationNodeCard node={node} onClick={() => onInspect(node)} />
            {i < nodes.length - 1 && (
              <span className={`self-center text-xs font-semibold tracking-wider ${
                operator === 'AND' ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {operator}
              </span>
            )}
          </div>
        ))}

        <div className={`self-center px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${
          resultPositive
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-red-500/15 text-red-400 border border-red-500/30'
        }`}>
          {resultChip}
        </div>
      </div>
    </div>
  );
}

function ValidationNodeCard({ node, onClick }: { node: ValidationNode; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="w-72 flex-shrink-0 bg-gradient-to-b from-white/[0.06] to-white/[0.03] border border-white/[0.14] rounded-xl p-4 cursor-pointer hover:border-cyan-500/50 transition-colors relative"
    >
      {/* Status icon */}
      <div className="absolute top-3 right-3">
        {node.status === 'pass' ? (
          <CheckCircle className="w-5 h-5 text-emerald-400" />
        ) : node.status === 'not_applicable' ? (
          <div className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs text-[var(--text-muted)]">—</div>
        ) : (
          <XCircle className="w-5 h-5 text-red-400" />
        )}
      </div>

      {/* Badge */}
      <span className="inline-block text-[10px] text-[var(--text-muted)] px-2 py-0.5 rounded-full border border-white/[0.18] bg-[#0c1324]/75 mb-2">
        {node.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
      </span>

      <h4 className="font-medium text-[var(--text)] text-sm mb-1 pr-6">{node.title}</h4>
      <p className="text-xs text-[var(--text-muted)] mb-2">{node.description}</p>

      {/* Facts preview with codes */}
      {node.facts.length > 0 && (
        <ul className="text-xs text-[var(--text-muted)] space-y-1 border-t border-white/[0.08] pt-2 mt-2">
          {node.facts.slice(0, 3).map((fact, i) => (
            <li key={i} className="flex items-start gap-2">
              {fact.code && fact.code !== '—' && (
                <code className="text-cyan-400 bg-cyan-500/10 px-1 rounded text-[10px] font-mono flex-shrink-0">{fact.code}</code>
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
        <div className="text-[10px] text-[var(--text-dim)] mt-2 pt-2 border-t border-white/[0.08]">
          Source: {node.source}
        </div>
      )}
    </div>
  );
}

function InspectModal({ node, onClose }: { node: ValidationNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/55 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[min(1000px,92vw)] max-h-[85vh] overflow-auto bg-[var(--bg-secondary)] border border-white/[0.15] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.12] sticky top-0 bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-3">
            {node.status === 'pass' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : node.status === 'not_applicable' ? (
              <div className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs text-[var(--text-muted)]">—</div>
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            <h3 className="font-bold text-[var(--text)]">{node.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-white/[0.2] rounded-lg text-sm text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Meta pills */}
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-full border border-white/[0.18] bg-white/[0.06] text-xs text-[var(--text)]">
              Population: {node.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </span>
            <span className={`px-2.5 py-1 rounded-full border text-xs ${
              node.status === 'pass'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : node.status === 'not_applicable'
                ? 'border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}>
              Status: {node.status === 'pass' ? 'Criteria Met' : node.status === 'not_applicable' ? 'Not Evaluated' : 'Criteria Not Met'}
            </span>
          </div>

          <p className="text-sm text-[var(--text-muted)]">{node.description}</p>

          {/* CQL */}
          {node.cqlSnippet && (
            <div>
              <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Code className="w-3.5 h-3.5" />
                Generated CQL Logic
              </h4>
              <pre className="p-3 bg-[#0b1a34] border border-white/[0.12] rounded-lg text-xs text-cyan-300 overflow-auto whitespace-pre font-mono">
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
              <div className="border border-white/[0.12] rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
                      <th className="border-b border-white/[0.12] p-2.5 text-left font-medium">Code</th>
                      <th className="border-b border-white/[0.12] p-2.5 text-left font-medium">Display Name</th>
                      <th className="border-b border-white/[0.12] p-2.5 text-left font-medium">Raw Value</th>
                      <th className="border-b border-white/[0.12] p-2.5 text-left font-medium">System/Unit</th>
                      <th className="border-b border-white/[0.12] p-2.5 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {node.facts.map((fact, i) => (
                      <tr key={i} className="text-[var(--text)] hover:bg-white/[0.02]">
                        <td className="border-b border-white/[0.08] p-2.5">
                          {fact.code && fact.code !== '—' ? (
                            <code className="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded font-mono">{fact.code}</code>
                          ) : (
                            <span className="text-[var(--text-dim)]">—</span>
                          )}
                        </td>
                        <td className="border-b border-white/[0.08] p-2.5">{fact.display || '—'}</td>
                        <td className="border-b border-white/[0.08] p-2.5">
                          {fact.rawCode && fact.rawCode !== '—' ? (
                            <span className="font-medium">{fact.rawCode}</span>
                          ) : (
                            <span className="text-[var(--text-dim)]">—</span>
                          )}
                        </td>
                        <td className="border-b border-white/[0.08] p-2.5 text-[var(--text-muted)]">{fact.rawDisplay || '—'}</td>
                        <td className="border-b border-white/[0.08] p-2.5 text-[var(--text-muted)]">{fact.date || '—'}</td>
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

function SummaryPill({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/[0.18] bg-white/[0.06] text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={`font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>{value}</span>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: PatientValidationTrace['finalOutcome'] }) {
  const styles = {
    in_numerator: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    not_in_numerator: 'bg-red-500/15 text-red-400 border-red-500/30',
    excluded: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
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
}: {
  patient: TestPatient;
  onSave: () => void;
  onCancel: () => void;
  onChange: (patient: TestPatient) => void;
}) {
  const [activeTab, setActiveTab] = useState<'demographics' | 'diagnoses' | 'encounters' | 'procedures' | 'observations' | 'medications' | 'immunizations'>('demographics');

  const updateDemographics = (field: string, value: string) => {
    onChange({
      ...patient,
      demographics: { ...patient.demographics, [field]: value },
    });
  };

  const updateName = (value: string) => {
    onChange({ ...patient, name: value });
  };

  const addDiagnosis = () => {
    onChange({
      ...patient,
      diagnoses: [...patient.diagnoses, { code: '', system: 'ICD10', display: '', onsetDate: new Date().toISOString().split('T')[0], status: 'active' as const }],
    });
  };

  const updateDiagnosis = (index: number, field: string, value: string) => {
    const updated = [...patient.diagnoses];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...patient, diagnoses: updated });
  };

  const removeDiagnosis = (index: number) => {
    onChange({ ...patient, diagnoses: patient.diagnoses.filter((_, i) => i !== index) });
  };

  const addEncounter = () => {
    onChange({
      ...patient,
      encounters: [...patient.encounters, { code: '', system: 'CPT', display: '', date: new Date().toISOString().split('T')[0], type: 'outpatient' }],
    });
  };

  const updateEncounter = (index: number, field: string, value: string) => {
    const updated = [...patient.encounters];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...patient, encounters: updated });
  };

  const removeEncounter = (index: number) => {
    onChange({ ...patient, encounters: patient.encounters.filter((_, i) => i !== index) });
  };

  const addProcedure = () => {
    onChange({
      ...patient,
      procedures: [...patient.procedures, { code: '', system: 'CPT', display: '', date: new Date().toISOString().split('T')[0] }],
    });
  };

  const updateProcedure = (index: number, field: string, value: string) => {
    const updated = [...patient.procedures];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...patient, procedures: updated });
  };

  const removeProcedure = (index: number) => {
    onChange({ ...patient, procedures: patient.procedures.filter((_, i) => i !== index) });
  };

  const addObservation = () => {
    onChange({
      ...patient,
      observations: [...patient.observations, { code: '', system: 'LOINC', display: '', date: new Date().toISOString().split('T')[0], value: undefined, unit: '' }],
    });
  };

  const updateObservation = (index: number, field: string, value: string | number | undefined) => {
    const updated = [...patient.observations];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...patient, observations: updated });
  };

  const removeObservation = (index: number) => {
    onChange({ ...patient, observations: patient.observations.filter((_, i) => i !== index) });
  };

  const addMedication = () => {
    onChange({
      ...patient,
      medications: [...patient.medications, { code: '', system: 'RxNorm', display: '', startDate: new Date().toISOString().split('T')[0], status: 'active' as const }],
    });
  };

  const updateMedication = (index: number, field: string, value: string) => {
    const updated = [...patient.medications];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...patient, medications: updated });
  };

  const removeMedication = (index: number) => {
    onChange({ ...patient, medications: patient.medications.filter((_, i) => i !== index) });
  };

  const addImmunization = () => {
    onChange({
      ...patient,
      immunizations: [...(patient.immunizations || []), { code: '', system: 'CVX', display: '', date: new Date().toISOString().split('T')[0], status: 'completed' as const }],
    });
  };

  const updateImmunization = (index: number, field: string, value: string) => {
    const updated = [...(patient.immunizations || [])];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...patient, immunizations: updated });
  };

  const removeImmunization = (index: number) => {
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
  ] as const;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-[min(1100px,95vw)] max-h-[90vh] overflow-hidden bg-[var(--bg-secondary)] border border-white/[0.15] rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.12]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text)]">Edit Patient</h3>
              <p className="text-sm text-[var(--text-muted)]">{patient.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.2] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.12] overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/[0.02]'
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
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.15] text-[var(--text)] focus:border-cyan-500/50 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={patient.demographics.birthDate}
                    onChange={(e) => updateDemographics('birthDate', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.15] text-[var(--text)] focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Gender</label>
                  <select
                    value={patient.demographics.gender}
                    onChange={(e) => updateDemographics('gender', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.15] text-[var(--text)] focus:border-cyan-500/50 focus:outline-none"
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
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.15] text-[var(--text)] focus:border-cyan-500/50 focus:outline-none"
                    placeholder="e.g., White, Black, Asian"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1">Ethnicity</label>
                  <input
                    type="text"
                    value={patient.demographics.ethnicity || ''}
                    onChange={(e) => updateDemographics('ethnicity', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.15] text-[var(--text)] focus:border-cyan-500/50 focus:outline-none"
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
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Diagnosis
              </button>
              {patient.diagnoses.map((dx, index) => (
                <div key={index} className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.1] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text)]">Diagnosis {index + 1}</span>
                    <button onClick={() => removeDiagnosis(index)} className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input type="text" value={dx.code} onChange={(e) => updateDiagnosis(index, 'code', e.target.value)} placeholder="Code (e.g., I10)" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <input type="text" value={dx.display} onChange={(e) => updateDiagnosis(index, 'display', e.target.value)} placeholder="Description" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <input type="date" value={dx.onsetDate} onChange={(e) => updateDiagnosis(index, 'onsetDate', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <select value={dx.status} onChange={(e) => updateDiagnosis(index, 'status', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none">
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
              <button onClick={addEncounter} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm">
                <Plus className="w-4 h-4" />
                Add Encounter
              </button>
              {patient.encounters.map((enc, index) => (
                <div key={index} className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-white/[0.1] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text)]">Encounter {index + 1}</span>
                    <button onClick={() => removeEncounter(index)} className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input type="text" value={enc.code} onChange={(e) => updateEncounter(index, 'code', e.target.value)} placeholder="Code (e.g., 99213)" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <input type="text" value={enc.display} onChange={(e) => updateEncounter(index, 'display', e.target.value)} placeholder="Description" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <input type="date" value={enc.date} onChange={(e) => updateEncounter(index, 'date', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <select value={enc.type} onChange={(e) => updateEncounter(index, 'type', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none">
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
                    <button onClick={() => removeProcedure(index)} className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors">
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
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Description</label>
                      <input
                        type="text"
                        value={proc.display}
                        onChange={(e) => updateProcedure(index, 'display', e.target.value)}
                        placeholder="e.g., Colonoscopy, flexible, diagnostic"
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Procedure Date</label>
                      <input
                        type="date"
                        value={proc.date}
                        onChange={(e) => updateProcedure(index, 'date', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none"
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
                    <button onClick={() => removeObservation(index)} className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <input type="text" value={obs.code} onChange={(e) => updateObservation(index, 'code', e.target.value)} placeholder="Code (e.g., 8480-6)" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <input type="text" value={obs.display} onChange={(e) => updateObservation(index, 'display', e.target.value)} placeholder="Description" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <input type="number" value={obs.value ?? ''} onChange={(e) => updateObservation(index, 'value', e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="Value" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <input type="text" value={obs.unit || ''} onChange={(e) => updateObservation(index, 'unit', e.target.value)} placeholder="Unit (e.g., mm[Hg])" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <input type="date" value={obs.date} onChange={(e) => updateObservation(index, 'date', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
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
                    <button onClick={() => removeMedication(index)} className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input type="text" value={med.code} onChange={(e) => updateMedication(index, 'code', e.target.value)} placeholder="Code" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <input type="text" value={med.display} onChange={(e) => updateMedication(index, 'display', e.target.value)} placeholder="Medication name" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <input type="date" value={med.startDate} onChange={(e) => updateMedication(index, 'startDate', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <select value={med.status} onChange={(e) => updateMedication(index, 'status', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none">
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
                    <button onClick={() => removeImmunization(index)} className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input type="text" value={imm.code} onChange={(e) => updateImmunization(index, 'code', e.target.value)} placeholder="CVX Code" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <input type="text" value={imm.display} onChange={(e) => updateImmunization(index, 'display', e.target.value)} placeholder="Vaccine name" className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <input type="date" value={imm.date} onChange={(e) => updateImmunization(index, 'date', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none" />
                    <select value={imm.status} onChange={(e) => updateImmunization(index, 'status', e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/[0.15] text-[var(--text)] text-sm focus:border-cyan-500/50 focus:outline-none">
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
