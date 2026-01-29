/**
 * Test Patient Generator
 *
 * Provides a static set of test patients with realistic clinical data.
 * These patients have fixed demographics, diagnoses, encounters, procedures,
 * observations, medications, and immunizations that don't change.
 *
 * When a measure is selected, these same patients are evaluated against
 * the measure criteria, producing different outcomes based on their
 * fixed clinical profiles.
 */

import type { UniversalMeasureSpec } from '../types/ums';
import type { TestPatient } from './measureEvaluator';
import { ICD10CM, CPT, LOINC, RXNORM, CVX } from '../constants/fhirCodeSystems';

/**
 * Static test patients with comprehensive clinical data
 * These represent a diverse patient population for testing measure logic
 */
const STATIC_TEST_PATIENTS: TestPatient[] = [
  // ============================================================================
  // Patient 1: Paul Atreides - Middle-aged male with controlled hypertension
  // ============================================================================
  {
    id: 'pt-001',
    name: 'Paul Atreides',
    demographics: {
      birthDate: '1983-03-15',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2020-06-12', status: 'active' },
      { code: 'E78.5', system: ICD10CM, display: 'Hyperlipidemia, unspecified', onsetDate: '2021-02-18', status: 'active' },
    ],
    encounters: [
      { code: '99213', system: CPT, display: 'Office visit, established patient, 20-29 min', date: '2026-02-18', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-06-22', type: 'outpatient' },
      { code: '99213', system: CPT, display: 'Office visit, established patient, 20-29 min', date: '2026-09-15', type: 'outpatient' },
    ],
    procedures: [
      { code: '93000', system: CPT, display: 'Electrocardiogram, routine ECG', date: '2026-02-18' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-09-15', value: 132, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-09-15', value: 84, unit: 'mm[Hg]' },
      { code: '8302-2', system: LOINC, display: 'Body height', date: '2026-02-18', value: 178, unit: 'cm' },
      { code: '29463-7', system: LOINC, display: 'Body weight', date: '2026-09-15', value: 82, unit: 'kg' },
      { code: '2093-3', system: LOINC, display: 'Total cholesterol', date: '2026-06-22', value: 195, unit: 'mg/dL' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 10 MG Oral Tablet', startDate: '2020-06-15', status: 'active' },
      { code: '316672', system: RXNORM, display: 'Atorvastatin 20 MG Oral Tablet', startDate: '2021-02-20', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza, seasonal, injectable', date: '2025-10-15', status: 'completed' },
      { code: '213', system: CVX, display: 'SARS-COV-2 (COVID-19) vaccine', date: '2024-09-20', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 2: Lady Jessica - Female with well-controlled diabetes
  // ============================================================================
  {
    id: 'pt-002',
    name: 'Lady Jessica',
    demographics: {
      birthDate: '1978-08-22',
      gender: 'female',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'E11.9', system: ICD10CM, display: 'Type 2 diabetes mellitus without complications', onsetDate: '2019-04-10', status: 'active' },
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2020-03-15', status: 'active' },
      { code: 'E78.0', system: ICD10CM, display: 'Pure hypercholesterolemia', onsetDate: '2019-06-22', status: 'active' },
    ],
    encounters: [
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-03-10', type: 'outpatient' },
      { code: '99395', system: CPT, display: 'Preventive visit, 18-39 years', date: '2026-07-18', type: 'outpatient' },
      { code: '99213', system: CPT, display: 'Office visit, established patient', date: '2026-11-03', type: 'outpatient' },
    ],
    procedures: [
      { code: '83036', system: CPT, display: 'Hemoglobin A1c', date: '2026-03-10' },
      { code: '2028-9', system: LOINC, display: 'Retinal eye exam', date: '2026-03-10' },
      { code: '88175', system: CPT, display: 'Cytopathology, cervical or vaginal, collected in preservative fluid, automated thin layer preparation, with screening by automated system and review by physician', date: '2025-07-18' },
      { code: '87625', system: CPT, display: 'Infectious agent detection by nucleic acid; Human Papillomavirus (HPV), high-risk types', date: '2025-07-18' },
      { code: '45378', system: CPT, display: 'Colonoscopy, diagnostic', date: '2022-08-15' },
      { code: '77067', system: CPT, display: 'Screening mammography, bilateral, including CAD when performed', date: '2025-09-12' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-11-03', value: 128, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-11-03', value: 78, unit: 'mm[Hg]' },
      { code: '4548-4', system: LOINC, display: 'Hemoglobin A1c', date: '2026-03-10', value: 6.8, unit: '%' },
      { code: '2339-0', system: LOINC, display: 'Glucose [Mass/volume] in Blood', date: '2026-11-03', value: 118, unit: 'mg/dL' },
      { code: '2085-9', system: LOINC, display: 'HDL Cholesterol', date: '2026-07-18', value: 55, unit: 'mg/dL' },
      { code: '10524-7', system: LOINC, display: 'Cytology report of Cervical or vaginal smear or scraping Cyto stain', date: '2025-07-18', value: 0, unit: 'negative' },
    ],
    medications: [
      { code: '860975', system: RXNORM, display: 'Metformin 1000 MG Oral Tablet', startDate: '2019-04-15', status: 'active' },
      { code: '197361', system: RXNORM, display: 'Lisinopril 20 MG Oral Tablet', startDate: '2020-03-18', status: 'active' },
      { code: '316672', system: RXNORM, display: 'Atorvastatin 40 MG Oral Tablet', startDate: '2019-07-01', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza, seasonal, injectable', date: '2025-10-22', status: 'completed' },
      { code: '33', system: CVX, display: 'Pneumococcal polysaccharide vaccine, 23 valent', date: '2024-11-15', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 3: Leto Atreides - Elderly male with multiple comorbidities
  // ============================================================================
  {
    id: 'pt-003',
    name: 'Ender Wiggin',
    demographics: {
      birthDate: '1948-11-30',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2005-08-12', status: 'active' },
      { code: 'E11.9', system: ICD10CM, display: 'Type 2 diabetes mellitus without complications', onsetDate: '2010-03-22', status: 'active' },
      { code: 'I25.10', system: ICD10CM, display: 'Atherosclerotic heart disease of native coronary artery', onsetDate: '2018-11-05', status: 'active' },
      { code: 'N18.3', system: ICD10CM, display: 'Chronic kidney disease, stage 3', onsetDate: '2020-06-18', status: 'active' },
      { code: 'E78.5', system: ICD10CM, display: 'Hyperlipidemia, unspecified', onsetDate: '2008-02-14', status: 'active' },
    ],
    encounters: [
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-02-28', type: 'outpatient' },
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-06-15', type: 'outpatient' },
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-10-08', type: 'outpatient' },
    ],
    procedures: [
      { code: '93000', system: CPT, display: 'Electrocardiogram, routine ECG', date: '2026-02-28' },
      { code: '82565', system: CPT, display: 'Creatinine; blood', date: '2026-06-15' },
      { code: '83036', system: CPT, display: 'Hemoglobin A1c', date: '2026-10-08' },
      { code: '45378', system: CPT, display: 'Colonoscopy, diagnostic', date: '2020-04-22' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-10-08', value: 142, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-10-08', value: 86, unit: 'mm[Hg]' },
      { code: '4548-4', system: LOINC, display: 'Hemoglobin A1c', date: '2026-10-08', value: 7.8, unit: '%' },
      { code: '2160-0', system: LOINC, display: 'Creatinine [Mass/volume] in Serum', date: '2026-06-15', value: 1.8, unit: 'mg/dL' },
      { code: '33914-3', system: LOINC, display: 'eGFR', date: '2026-06-15', value: 42, unit: 'mL/min/1.73m2' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 40 MG Oral Tablet', startDate: '2005-08-20', status: 'active' },
      { code: '866924', system: RXNORM, display: 'Amlodipine 10 MG Oral Tablet', startDate: '2015-03-10', status: 'active' },
      { code: '860975', system: RXNORM, display: 'Metformin 500 MG Oral Tablet', startDate: '2010-04-01', status: 'active' },
      { code: '316672', system: RXNORM, display: 'Atorvastatin 80 MG Oral Tablet', startDate: '2018-12-01', status: 'active' },
      { code: '855318', system: RXNORM, display: 'Aspirin 81 MG Oral Tablet', startDate: '2018-11-10', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza, seasonal, injectable', date: '2025-09-28', status: 'completed' },
      { code: '33', system: CVX, display: 'Pneumococcal polysaccharide vaccine, 23 valent', date: '2023-10-15', status: 'completed' },
      { code: '121', system: CVX, display: 'Zoster vaccine, live', date: '2022-05-20', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 4: Chani Kynes - Young adult female, healthy
  // ============================================================================
  {
    id: 'pt-004',
    name: 'Chani Kynes',
    demographics: {
      birthDate: '1998-05-14',
      gender: 'female',
      race: 'Asian',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'J30.1', system: ICD10CM, display: 'Allergic rhinitis due to pollen', onsetDate: '2015-04-10', status: 'active' },
    ],
    encounters: [
      { code: '99395', system: CPT, display: 'Preventive visit, 18-39 years', date: '2026-04-22', type: 'outpatient' },
    ],
    procedures: [
      // Pap test from over 3 years ago — outside the valid lookback period, so this should NOT satisfy cervical screening numerator
      { code: '88175', system: CPT, display: 'Cytopathology, cervical or vaginal, automated thin layer prep', date: '2022-05-10' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-04-22', value: 112, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-04-22', value: 72, unit: 'mm[Hg]' },
      { code: '8302-2', system: LOINC, display: 'Body height', date: '2026-04-22', value: 165, unit: 'cm' },
      { code: '29463-7', system: LOINC, display: 'Body weight', date: '2026-04-22', value: 58, unit: 'kg' },
    ],
    medications: [
      { code: '311372', system: RXNORM, display: 'Loratadine 10 MG Oral Tablet', startDate: '2020-04-01', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza, seasonal, injectable', date: '2025-11-05', status: 'completed' },
      { code: '62', system: CVX, display: 'HPV vaccine, quadrivalent', date: '2016-08-15', status: 'completed' },
      { code: '213', system: CVX, display: 'SARS-COV-2 (COVID-19) vaccine', date: '2024-10-01', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 5: Stilgar Tabr - Middle-aged male with uncontrolled hypertension
  // ============================================================================
  {
    id: 'pt-005',
    name: 'Stilgar Tabr',
    demographics: {
      birthDate: '1970-12-08',
      gender: 'male',
      race: 'Black or African American',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2015-09-22', status: 'active' },
      { code: 'E66.9', system: ICD10CM, display: 'Obesity, unspecified', onsetDate: '2018-03-14', status: 'active' },
      { code: 'G47.33', system: ICD10CM, display: 'Obstructive sleep apnea', onsetDate: '2019-08-05', status: 'active' },
    ],
    encounters: [
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-01-15', type: 'outpatient' },
      { code: '99213', system: CPT, display: 'Office visit, established patient, 20-29 min', date: '2026-05-20', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-10-12', type: 'outpatient' },
    ],
    procedures: [
      { code: '93000', system: CPT, display: 'Electrocardiogram, routine ECG', date: '2026-01-15' },
      { code: '95810', system: CPT, display: 'Polysomnography', date: '2019-09-15' },
      { code: '82274', system: CPT, display: 'Blood, occult, by fecal hemoglobin determination by immunoassay, qualitative (FIT)', date: '2026-05-20' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-10-12', value: 158, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-10-12', value: 98, unit: 'mm[Hg]' },
      { code: '29463-7', system: LOINC, display: 'Body weight', date: '2026-10-12', value: 118, unit: 'kg' },
      { code: '39156-5', system: LOINC, display: 'Body mass index', date: '2026-10-12', value: 36.2, unit: 'kg/m2' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 40 MG Oral Tablet', startDate: '2015-10-01', status: 'active' },
      { code: '866924', system: RXNORM, display: 'Amlodipine 10 MG Oral Tablet', startDate: '2018-06-15', status: 'active' },
      { code: '310429', system: RXNORM, display: 'Hydrochlorothiazide 25 MG Oral Tablet', startDate: '2020-02-20', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza, seasonal, injectable', date: '2025-10-08', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 6: Duncan Idaho - Male in hospice care (excluded from many measures)
  // ============================================================================
  {
    id: 'pt-006',
    name: 'Duncan Idaho',
    demographics: {
      birthDate: '1955-07-19',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2008-04-12', status: 'active' },
      { code: 'C34.90', system: ICD10CM, display: 'Malignant neoplasm of unspecified part of bronchus or lung', onsetDate: '2025-02-18', status: 'active' },
      { code: 'Z51.5', system: ICD10CM, display: 'Encounter for palliative care', onsetDate: '2025-11-01', status: 'active' },
    ],
    encounters: [
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-03-08', type: 'outpatient' },
      { code: '99377', system: CPT, display: 'Hospice care supervision', date: '2026-06-15', type: 'hospice' },
      { code: '99378', system: CPT, display: 'Hospice care supervision, each additional 30 min', date: '2026-09-22', type: 'hospice' },
    ],
    procedures: [],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-03-08', value: 135, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-03-08', value: 82, unit: 'mm[Hg]' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 20 MG Oral Tablet', startDate: '2008-05-01', status: 'active' },
      { code: '892494', system: RXNORM, display: 'Morphine Sulfate 15 MG Extended Release Oral Tablet', startDate: '2025-11-05', status: 'active' },
    ],
    immunizations: [],
  },

  // ============================================================================
  // Patient 7: Gurney Halleck - Male with ESRD on dialysis (excluded)
  // ============================================================================
  {
    id: 'pt-007',
    name: 'Gurney Halleck',
    demographics: {
      birthDate: '1962-02-28',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I12.0', system: ICD10CM, display: 'Hypertensive chronic kidney disease with stage 5 CKD or ESRD', onsetDate: '2018-06-22', status: 'active' },
      { code: 'N18.6', system: ICD10CM, display: 'End stage renal disease', onsetDate: '2022-09-15', status: 'active' },
      { code: 'Z99.2', system: ICD10CM, display: 'Dependence on renal dialysis', onsetDate: '2022-10-01', status: 'active' },
      { code: 'E11.22', system: ICD10CM, display: 'Type 2 diabetes mellitus with diabetic chronic kidney disease', onsetDate: '2015-03-10', status: 'active' },
    ],
    encounters: [
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-02-14', type: 'outpatient' },
      { code: '90935', system: CPT, display: 'Hemodialysis procedure with single evaluation', date: '2026-05-08', type: 'outpatient' },
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-07-22', type: 'outpatient' },
      { code: '90937', system: CPT, display: 'Hemodialysis procedure with repeated evaluation', date: '2026-10-18', type: 'outpatient' },
    ],
    procedures: [
      { code: '90935', system: CPT, display: 'Hemodialysis procedure', date: '2026-05-08' },
      { code: '36821', system: CPT, display: 'Arteriovenous fistula creation', date: '2022-09-20' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-07-22', value: 148, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-07-22', value: 88, unit: 'mm[Hg]' },
      { code: '2160-0', system: LOINC, display: 'Creatinine', date: '2026-07-22', value: 8.5, unit: 'mg/dL' },
      { code: '3094-0', system: LOINC, display: 'BUN', date: '2026-07-22', value: 68, unit: 'mg/dL' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 40 MG Oral Tablet', startDate: '2018-07-01', status: 'active' },
      { code: '310798', system: RXNORM, display: 'Epoetin Alfa 10000 UNT/ML Injectable Solution', startDate: '2022-10-15', status: 'active' },
      { code: '311026', system: RXNORM, display: 'Sevelamer 800 MG Oral Tablet', startDate: '2022-10-15', status: 'active' },
    ],
    immunizations: [
      { code: '43', system: CVX, display: 'Hepatitis B vaccine, adult', date: '2022-11-01', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 8: Thufir Hawat - Elderly male, frail with dementia (excluded)
  // ============================================================================
  {
    id: 'pt-008',
    name: 'Valentine Wiggin',
    demographics: {
      birthDate: '1940-09-05',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '1998-05-15', status: 'active' },
      { code: 'F03.90', system: ICD10CM, display: 'Unspecified dementia without behavioral disturbance', onsetDate: '2023-08-22', status: 'active' },
      { code: 'R54', system: ICD10CM, display: 'Age-related physical debility', onsetDate: '2024-02-10', status: 'active' },
      { code: 'R26.89', system: ICD10CM, display: 'Other abnormalities of gait and mobility', onsetDate: '2024-02-10', status: 'active' },
      { code: 'Z74.09', system: ICD10CM, display: 'Other reduced mobility', onsetDate: '2024-06-15', status: 'active' },
    ],
    encounters: [
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-03-12', type: 'outpatient' },
      { code: '99483', system: CPT, display: 'Assessment of and care planning for cognitive impairment', date: '2026-06-28', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-10-05', type: 'outpatient' },
    ],
    procedures: [
      { code: '96116', system: CPT, display: 'Neurobehavioral status exam', date: '2023-08-22' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-10-05', value: 138, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-10-05', value: 76, unit: 'mm[Hg]' },
      { code: '72106-8', system: LOINC, display: 'Mini-Mental State Examination score', date: '2026-06-28', value: 18, unit: '{score}' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 10 MG Oral Tablet', startDate: '1998-06-01', status: 'active' },
      { code: '312036', system: RXNORM, display: 'Donepezil 10 MG Oral Tablet', startDate: '2023-09-01', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza, seasonal, injectable', date: '2025-10-15', status: 'completed' },
      { code: '33', system: CVX, display: 'Pneumococcal polysaccharide vaccine, 23 valent', date: '2020-11-01', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 9: Alia Atreides - Infant (for pediatric measures)
  // ============================================================================
  {
    id: 'pt-009',
    name: 'Petra Arkanian',
    demographics: {
      birthDate: '2024-06-15',
      gender: 'female',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [],
    encounters: [
      { code: '99381', system: CPT, display: 'Initial preventive visit, infant (age younger than 1 year)', date: '2024-06-20', type: 'outpatient' },
      { code: '99391', system: CPT, display: 'Periodic preventive visit, infant', date: '2024-08-15', type: 'outpatient' },
      { code: '99391', system: CPT, display: 'Periodic preventive visit, infant', date: '2024-10-18', type: 'outpatient' },
      { code: '99391', system: CPT, display: 'Periodic preventive visit, infant', date: '2025-01-20', type: 'outpatient' },
      { code: '99391', system: CPT, display: 'Periodic preventive visit, infant', date: '2025-04-15', type: 'outpatient' },
      { code: '99392', system: CPT, display: 'Periodic preventive visit, 1-4 years', date: '2025-09-18', type: 'outpatient' },
      { code: '99392', system: CPT, display: 'Periodic preventive visit, 1-4 years', date: '2026-03-20', type: 'outpatient' },
    ],
    procedures: [],
    observations: [
      { code: '8302-2', system: LOINC, display: 'Body height', date: '2026-03-20', value: 85, unit: 'cm' },
      { code: '29463-7', system: LOINC, display: 'Body weight', date: '2026-03-20', value: 11.5, unit: 'kg' },
      { code: '9843-4', system: LOINC, display: 'Head circumference', date: '2026-03-20', value: 47, unit: 'cm' },
    ],
    medications: [],
    immunizations: [
      // Complete immunization series for toddler
      { code: '110', system: CVX, display: 'DTaP-hepatitis B-IPV', date: '2024-08-15', status: 'completed' },
      { code: '110', system: CVX, display: 'DTaP-hepatitis B-IPV', date: '2024-10-18', status: 'completed' },
      { code: '110', system: CVX, display: 'DTaP-hepatitis B-IPV', date: '2025-01-20', status: 'completed' },
      { code: '133', system: CVX, display: 'PCV13', date: '2024-08-15', status: 'completed' },
      { code: '133', system: CVX, display: 'PCV13', date: '2024-10-18', status: 'completed' },
      { code: '133', system: CVX, display: 'PCV13', date: '2025-01-20', status: 'completed' },
      { code: '133', system: CVX, display: 'PCV13', date: '2025-09-18', status: 'completed' },
      { code: '116', system: CVX, display: 'Rotavirus, pentavalent', date: '2024-08-15', status: 'completed' },
      { code: '116', system: CVX, display: 'Rotavirus, pentavalent', date: '2024-10-18', status: 'completed' },
      { code: '116', system: CVX, display: 'Rotavirus, pentavalent', date: '2025-01-20', status: 'completed' },
      { code: '49', system: CVX, display: 'Hib (PRP-OMP)', date: '2024-08-15', status: 'completed' },
      { code: '49', system: CVX, display: 'Hib (PRP-OMP)', date: '2024-10-18', status: 'completed' },
      { code: '49', system: CVX, display: 'Hib (PRP-OMP)', date: '2025-09-18', status: 'completed' },
      { code: '03', system: CVX, display: 'MMR', date: '2025-09-18', status: 'completed' },
      { code: '21', system: CVX, display: 'Varicella', date: '2025-09-18', status: 'completed' },
      { code: '83', system: CVX, display: 'Hepatitis A', date: '2025-09-18', status: 'completed' },
      { code: '83', system: CVX, display: 'Hepatitis A', date: '2026-03-20', status: 'completed' },
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-15', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 10: Irulan Corrino - Child missing some immunizations
  // ============================================================================
  {
    id: 'pt-010',
    name: 'Bean Delphiki',
    demographics: {
      birthDate: '2024-03-22',
      gender: 'female',
      race: 'White',
      ethnicity: 'Hispanic or Latino',
    },
    diagnoses: [
      { code: 'J06.9', system: ICD10CM, display: 'Acute upper respiratory infection, unspecified', onsetDate: '2025-02-10', status: 'resolved' },
    ],
    encounters: [
      { code: '99381', system: CPT, display: 'Initial preventive visit, infant', date: '2024-03-28', type: 'outpatient' },
      { code: '99391', system: CPT, display: 'Periodic preventive visit, infant', date: '2024-05-22', type: 'outpatient' },
      { code: '99391', system: CPT, display: 'Periodic preventive visit, infant', date: '2024-07-25', type: 'outpatient' },
      { code: '99213', system: CPT, display: 'Office visit for URI', date: '2025-02-10', type: 'outpatient' },
      { code: '99392', system: CPT, display: 'Periodic preventive visit, 1-4 years', date: '2025-09-20', type: 'outpatient' },
      { code: '99392', system: CPT, display: 'Periodic preventive visit, 1-4 years', date: '2026-04-05', type: 'outpatient' },
    ],
    procedures: [],
    observations: [
      { code: '8302-2', system: LOINC, display: 'Body height', date: '2026-04-05', value: 88, unit: 'cm' },
      { code: '29463-7', system: LOINC, display: 'Body weight', date: '2026-04-05', value: 12.8, unit: 'kg' },
    ],
    medications: [],
    immunizations: [
      // Incomplete immunization series - missing several vaccines
      { code: '110', system: CVX, display: 'DTaP-hepatitis B-IPV', date: '2024-05-22', status: 'completed' },
      { code: '110', system: CVX, display: 'DTaP-hepatitis B-IPV', date: '2024-07-25', status: 'completed' },
      // Missing third DTaP-Hep B-IPV
      { code: '133', system: CVX, display: 'PCV13', date: '2024-05-22', status: 'completed' },
      { code: '133', system: CVX, display: 'PCV13', date: '2024-07-25', status: 'completed' },
      // Missing third and fourth PCV13
      { code: '116', system: CVX, display: 'Rotavirus', date: '2024-05-22', status: 'completed' },
      { code: '116', system: CVX, display: 'Rotavirus', date: '2024-07-25', status: 'completed' },
      { code: '49', system: CVX, display: 'Hib', date: '2024-05-22', status: 'completed' },
      // Missing additional Hib doses
      // Missing MMR
      // Missing Varicella
      // Missing Hepatitis A
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-18', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 11: Feyd Rautha - Young adult with poor diabetes control
  // ============================================================================
  {
    id: 'pt-011',
    name: 'Bonzo Madrid',
    demographics: {
      birthDate: '1995-11-03',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'E11.65', system: ICD10CM, display: 'Type 2 diabetes mellitus with hyperglycemia', onsetDate: '2022-08-15', status: 'active' },
      { code: 'E66.01', system: ICD10CM, display: 'Morbid (severe) obesity due to excess calories', onsetDate: '2020-03-20', status: 'active' },
    ],
    encounters: [
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-01-22', type: 'outpatient' },
      { code: '99213', system: CPT, display: 'Office visit, established patient, 20-29 min', date: '2026-07-15', type: 'outpatient' },
    ],
    procedures: [
      { code: '83036', system: CPT, display: 'Hemoglobin A1c', date: '2026-07-15' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-07-15', value: 138, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-07-15', value: 88, unit: 'mm[Hg]' },
      { code: '4548-4', system: LOINC, display: 'Hemoglobin A1c', date: '2026-07-15', value: 10.2, unit: '%' },
      { code: '39156-5', system: LOINC, display: 'Body mass index', date: '2026-07-15', value: 42.5, unit: 'kg/m2' },
      { code: '2339-0', system: LOINC, display: 'Glucose', date: '2026-07-15', value: 285, unit: 'mg/dL' },
    ],
    medications: [
      { code: '860975', system: RXNORM, display: 'Metformin 1000 MG Oral Tablet', startDate: '2022-08-20', status: 'active' },
      { code: '847232', system: RXNORM, display: 'Glipizide 10 MG Oral Tablet', startDate: '2023-06-10', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-11-02', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 12: Shaddam Corrino - Elderly with no recent encounters (care gap)
  // ============================================================================
  {
    id: 'pt-012',
    name: 'Colonel Graff',
    demographics: {
      birthDate: '1950-04-18',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2010-06-15', status: 'active' },
      { code: 'E11.9', system: ICD10CM, display: 'Type 2 diabetes mellitus', onsetDate: '2015-09-22', status: 'active' },
    ],
    encounters: [
      // Only telehealth visits - no in-person vitals
      { code: '99441', system: CPT, display: 'Telephone E/M, 5-10 min', date: '2026-02-10', type: 'telehealth' },
      { code: '99442', system: CPT, display: 'Telephone E/M, 11-20 min', date: '2026-08-18', type: 'telehealth' },
    ],
    procedures: [],
    observations: [
      // No recent BP readings - last one from previous year
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2025-03-15', value: 145, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2025-03-15', value: 88, unit: 'mm[Hg]' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 20 MG Oral Tablet', startDate: '2010-07-01', status: 'active' },
      { code: '860975', system: RXNORM, display: 'Metformin 500 MG Oral Tablet', startDate: '2015-10-01', status: 'active' },
    ],
    immunizations: [],
  },

  // ============================================================================
  // Patient 13: Sol Weintraub - Elderly male with good BP control
  // ============================================================================
  {
    id: 'pt-013',
    name: 'Kirsten Raymonde',
    demographics: {
      birthDate: '1952-08-30',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2008-11-20', status: 'active' },
    ],
    encounters: [
      { code: '99396', system: CPT, display: 'Preventive visit, 40-64 years', date: '2026-05-08', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-10-18', type: 'outpatient' },
    ],
    procedures: [],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-10-18', value: 128, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-10-18', value: 78, unit: 'mm[Hg]' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 20 MG Oral Tablet', startDate: '2008-12-01', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-20', status: 'completed' },
      { code: '121', system: CVX, display: 'Zoster vaccine', date: '2024-08-15', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 14: Rachel Weintraub - Child with complete immunizations
  // ============================================================================
  {
    id: 'pt-014',
    name: 'Arthur Leander',
    demographics: {
      birthDate: '2023-09-10',
      gender: 'female',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [],
    encounters: [
      { code: '99381', system: CPT, display: 'Initial preventive visit, infant', date: '2023-09-18', type: 'outpatient' },
      { code: '99391', system: CPT, display: 'Periodic preventive visit, infant', date: '2023-11-10', type: 'outpatient' },
      { code: '99391', system: CPT, display: 'Periodic preventive visit, infant', date: '2024-01-15', type: 'outpatient' },
      { code: '99391', system: CPT, display: 'Periodic preventive visit, infant', date: '2024-03-12', type: 'outpatient' },
      { code: '99391', system: CPT, display: 'Periodic preventive visit, infant', date: '2024-06-10', type: 'outpatient' },
      { code: '99392', system: CPT, display: 'Periodic preventive visit, 1-4 years', date: '2024-09-15', type: 'outpatient' },
      { code: '99392', system: CPT, display: 'Periodic preventive visit, 1-4 years', date: '2025-03-10', type: 'outpatient' },
      { code: '99392', system: CPT, display: 'Periodic preventive visit, 1-4 years', date: '2025-09-12', type: 'outpatient' },
      { code: '99392', system: CPT, display: 'Periodic preventive visit, 1-4 years', date: '2026-03-15', type: 'outpatient' },
    ],
    procedures: [],
    observations: [
      { code: '8302-2', system: LOINC, display: 'Body height', date: '2026-03-15', value: 95, unit: 'cm' },
      { code: '29463-7', system: LOINC, display: 'Body weight', date: '2026-03-15', value: 14.2, unit: 'kg' },
    ],
    medications: [],
    immunizations: [
      // Complete immunization series
      { code: '08', system: CVX, display: 'Hepatitis B, pediatric', date: '2023-09-18', status: 'completed' },
      { code: '08', system: CVX, display: 'Hepatitis B, pediatric', date: '2023-11-10', status: 'completed' },
      { code: '08', system: CVX, display: 'Hepatitis B, pediatric', date: '2024-03-12', status: 'completed' },
      { code: '20', system: CVX, display: 'DTaP', date: '2023-11-10', status: 'completed' },
      { code: '20', system: CVX, display: 'DTaP', date: '2024-01-15', status: 'completed' },
      { code: '20', system: CVX, display: 'DTaP', date: '2024-03-12', status: 'completed' },
      { code: '20', system: CVX, display: 'DTaP', date: '2025-09-12', status: 'completed' },
      { code: '10', system: CVX, display: 'IPV', date: '2023-11-10', status: 'completed' },
      { code: '10', system: CVX, display: 'IPV', date: '2024-01-15', status: 'completed' },
      { code: '10', system: CVX, display: 'IPV', date: '2024-03-12', status: 'completed' },
      { code: '10', system: CVX, display: 'IPV', date: '2026-03-15', status: 'completed' },
      { code: '133', system: CVX, display: 'PCV13', date: '2023-11-10', status: 'completed' },
      { code: '133', system: CVX, display: 'PCV13', date: '2024-01-15', status: 'completed' },
      { code: '133', system: CVX, display: 'PCV13', date: '2024-03-12', status: 'completed' },
      { code: '133', system: CVX, display: 'PCV13', date: '2024-09-15', status: 'completed' },
      { code: '116', system: CVX, display: 'Rotavirus', date: '2023-11-10', status: 'completed' },
      { code: '116', system: CVX, display: 'Rotavirus', date: '2024-01-15', status: 'completed' },
      { code: '116', system: CVX, display: 'Rotavirus', date: '2024-03-12', status: 'completed' },
      { code: '49', system: CVX, display: 'Hib', date: '2023-11-10', status: 'completed' },
      { code: '49', system: CVX, display: 'Hib', date: '2024-01-15', status: 'completed' },
      { code: '49', system: CVX, display: 'Hib', date: '2024-03-12', status: 'completed' },
      { code: '49', system: CVX, display: 'Hib', date: '2024-09-15', status: 'completed' },
      { code: '03', system: CVX, display: 'MMR', date: '2024-09-15', status: 'completed' },
      { code: '03', system: CVX, display: 'MMR', date: '2026-03-15', status: 'completed' },
      { code: '21', system: CVX, display: 'Varicella', date: '2024-09-15', status: 'completed' },
      { code: '21', system: CVX, display: 'Varicella', date: '2026-03-15', status: 'completed' },
      { code: '83', system: CVX, display: 'Hepatitis A', date: '2024-09-15', status: 'completed' },
      { code: '83', system: CVX, display: 'Hepatitis A', date: '2025-03-10', status: 'completed' },
      { code: '141', system: CVX, display: 'Influenza', date: '2024-10-15', status: 'completed' },
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-12', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 15: Fedmahn Kassad - Middle-aged with borderline BP
  // ============================================================================
  {
    id: 'pt-015',
    name: 'Clark Thompson',
    demographics: {
      birthDate: '1980-03-14',
      gender: 'male',
      race: 'Black or African American',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2018-06-22', status: 'active' },
      { code: 'F43.10', system: ICD10CM, display: 'Post-traumatic stress disorder, unspecified', onsetDate: '2017-09-22', status: 'active' },
    ],
    encounters: [
      { code: '99396', system: CPT, display: 'Preventive visit, 40-64 years', date: '2026-05-08', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-10-18', type: 'outpatient' },
    ],
    procedures: [],
    observations: [
      // Borderline controlled - just under thresholds
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-05-08', value: 142, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-05-08', value: 92, unit: 'mm[Hg]' },
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-10-18', value: 138, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-10-18', value: 88, unit: 'mm[Hg]' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 20 MG Oral Tablet', startDate: '2018-07-01', status: 'active' },
      { code: '312938', system: RXNORM, display: 'Sertraline 100 MG Oral Tablet', startDate: '2017-10-15', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-20', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 16: Brawne Lamia - Female with isolated diastolic hypertension
  // ============================================================================
  {
    id: 'pt-016',
    name: 'Jeevan Chaudhary',
    demographics: {
      birthDate: '1975-06-28',
      gender: 'female',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2020-04-15', status: 'active' },
    ],
    encounters: [
      { code: '99213', system: CPT, display: 'Office visit, established patient, 20-29 min', date: '2026-03-22', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-09-15', type: 'outpatient' },
    ],
    procedures: [],
    observations: [
      // Systolic controlled, diastolic not
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-09-15', value: 132, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-09-15', value: 94, unit: 'mm[Hg]' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 10 MG Oral Tablet', startDate: '2020-05-01', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-11-05', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 17: Martin Silenus - Older adult with alcohol use disorder
  // ============================================================================
  {
    id: 'pt-017',
    name: 'Miranda Carroll',
    demographics: {
      birthDate: '1958-12-05',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2015-08-20', status: 'active' },
      { code: 'F10.20', system: ICD10CM, display: 'Alcohol use disorder, moderate', onsetDate: '2018-03-12', status: 'active' },
      { code: 'K70.30', system: ICD10CM, display: 'Alcoholic cirrhosis of liver without ascites', onsetDate: '2022-06-18', status: 'active' },
    ],
    encounters: [
      { code: '99213', system: CPT, display: 'Office visit, established patient, 20-29 min', date: '2026-04-08', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-11-22', type: 'outpatient' },
    ],
    procedures: [],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-11-22', value: 145, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-11-22', value: 92, unit: 'mm[Hg]' },
      { code: '1742-6', system: LOINC, display: 'ALT', date: '2026-11-22', value: 85, unit: 'U/L' },
      { code: '1920-8', system: LOINC, display: 'AST', date: '2026-11-22', value: 110, unit: 'U/L' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 20 MG Oral Tablet', startDate: '2015-09-01', status: 'active' },
      { code: '2551', system: RXNORM, display: 'Disulfiram 250 MG Oral Tablet', startDate: '2023-01-15', status: 'active' },
    ],
    immunizations: [],
  },

  // ============================================================================
  // Patient 18: Lenar Hoyt - Pregnant female (excluded from many measures)
  // ============================================================================
  {
    id: 'pt-018',
    name: 'Tyler Leander',
    demographics: {
      birthDate: '1992-07-14',
      gender: 'female',
      race: 'Asian',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2021-03-10', status: 'active' },
      { code: 'Z33.1', system: ICD10CM, display: 'Pregnant state, incidental', onsetDate: '2026-02-15', status: 'active' },
      { code: 'O10.012', system: ICD10CM, display: 'Pre-existing essential hypertension complicating pregnancy, second trimester', onsetDate: '2026-05-20', status: 'active' },
    ],
    encounters: [
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-02-20', type: 'outpatient' },
      { code: '59425', system: CPT, display: 'Antepartum care, 4-6 visits', date: '2026-05-15', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-08-10', type: 'outpatient' },
    ],
    procedures: [
      { code: '76801', system: CPT, display: 'Ultrasound, pregnant uterus', date: '2026-05-15' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-08-10', value: 135, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-08-10', value: 85, unit: 'mm[Hg]' },
    ],
    medications: [
      { code: '866511', system: RXNORM, display: 'Labetalol 200 MG Oral Tablet', startDate: '2026-03-01', status: 'active' },
      { code: '310384', system: RXNORM, display: 'Prenatal vitamins', startDate: '2026-02-20', status: 'active' },
    ],
    immunizations: [
      { code: '115', system: CVX, display: 'Tdap', date: '2026-07-15', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 19: Het Masteen - No qualifying hypertension diagnosis
  // ============================================================================
  {
    id: 'pt-019',
    name: 'Elizabeth Colton',
    demographics: {
      birthDate: '1968-10-25',
      gender: 'male',
      race: 'Asian',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      // Has elevated BP readings but no HTN diagnosis code
      { code: 'R03.0', system: ICD10CM, display: 'Elevated blood pressure reading, without diagnosis of hypertension', onsetDate: '2026-03-18', status: 'active' },
    ],
    encounters: [
      { code: '99213', system: CPT, display: 'Office visit, established patient, 20-29 min', date: '2026-03-18', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-09-05', type: 'outpatient' },
    ],
    procedures: [],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-03-18', value: 145, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-03-18', value: 92, unit: 'mm[Hg]' },
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-09-05', value: 142, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-09-05', value: 88, unit: 'mm[Hg]' },
    ],
    medications: [],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-28', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 20: Meina Gladstone - High-complexity elderly female
  // ============================================================================
  {
    id: 'pt-020',
    name: 'Frank Chaudhary',
    demographics: {
      birthDate: '1945-01-22',
      gender: 'female',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2000-05-15', status: 'active' },
      { code: 'E11.65', system: ICD10CM, display: 'Type 2 diabetes mellitus with hyperglycemia', onsetDate: '2005-08-22', status: 'active' },
      { code: 'I25.10', system: ICD10CM, display: 'Atherosclerotic heart disease', onsetDate: '2015-03-18', status: 'active' },
      { code: 'I50.9', system: ICD10CM, display: 'Heart failure, unspecified', onsetDate: '2020-11-05', status: 'active' },
      { code: 'J44.1', system: ICD10CM, display: 'COPD with acute exacerbation', onsetDate: '2018-06-22', status: 'active' },
      { code: 'M81.0', system: ICD10CM, display: 'Age-related osteoporosis without current pathological fracture', onsetDate: '2019-04-10', status: 'active' },
    ],
    encounters: [
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-01-18', type: 'outpatient' },
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-04-22', type: 'outpatient' },
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-07-15', type: 'outpatient' },
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-10-28', type: 'outpatient' },
    ],
    procedures: [
      { code: '93000', system: CPT, display: 'ECG', date: '2026-01-18' },
      { code: '93306', system: CPT, display: 'Echocardiography', date: '2026-04-22' },
      { code: '83036', system: CPT, display: 'Hemoglobin A1c', date: '2026-07-15' },
      { code: '77080', system: CPT, display: 'DXA bone density', date: '2026-01-18' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-10-28', value: 136, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-10-28', value: 78, unit: 'mm[Hg]' },
      { code: '4548-4', system: LOINC, display: 'Hemoglobin A1c', date: '2026-07-15', value: 7.2, unit: '%' },
      { code: '10230-1', system: LOINC, display: 'Left ventricular ejection fraction', date: '2026-04-22', value: 42, unit: '%' },
      { code: '38265-5', system: LOINC, display: 'DXA Femoral neck T-score', date: '2026-01-18', value: -2.8, unit: '{T-score}' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 10 MG Oral Tablet', startDate: '2000-06-01', status: 'active' },
      { code: '200031', system: RXNORM, display: 'Carvedilol 12.5 MG Oral Tablet', startDate: '2020-12-01', status: 'active' },
      { code: '310798', system: RXNORM, display: 'Furosemide 40 MG Oral Tablet', startDate: '2020-12-01', status: 'active' },
      { code: '860975', system: RXNORM, display: 'Metformin 500 MG Oral Tablet', startDate: '2005-09-01', status: 'active' },
      { code: '316672', system: RXNORM, display: 'Atorvastatin 40 MG Oral Tablet', startDate: '2015-04-01', status: 'active' },
      { code: '855318', system: RXNORM, display: 'Aspirin 81 MG Oral Tablet', startDate: '2015-04-01', status: 'active' },
      { code: '904420', system: RXNORM, display: 'Tiotropium 18 MCG Inhalation Capsule', startDate: '2018-07-01', status: 'active' },
      { code: '311270', system: RXNORM, display: 'Alendronate 70 MG Oral Tablet', startDate: '2019-05-01', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-05', status: 'completed' },
      { code: '33', system: CVX, display: 'Pneumococcal polysaccharide vaccine', date: '2023-11-15', status: 'completed' },
      { code: '213', system: CVX, display: 'COVID-19 vaccine', date: '2025-09-22', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 21: Liet Kynes - Middle-aged, only early-year encounters
  // ============================================================================
  {
    id: 'pt-021',
    name: 'Alai',
    demographics: {
      birthDate: '1972-04-08',
      gender: 'male',
      race: 'White',
      ethnicity: 'Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2019-02-20', status: 'active' },
    ],
    encounters: [
      // Only encounters in first half of year
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-01-12', type: 'outpatient' },
      { code: '99213', system: CPT, display: 'Office visit, established patient, 20-29 min', date: '2026-03-28', type: 'outpatient' },
    ],
    procedures: [],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-03-28', value: 134, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-03-28', value: 86, unit: 'mm[Hg]' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 10 MG Oral Tablet', startDate: '2019-03-01', status: 'active' },
    ],
    immunizations: [],
  },

  // ============================================================================
  // Patient 22: Gaius Mohiam - Very elderly female
  // ============================================================================
  {
    id: 'pt-022',
    name: 'Dink Meeker',
    demographics: {
      birthDate: '1938-11-15',
      gender: 'female',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '1985-06-22', status: 'active' },
      { code: 'I48.91', system: ICD10CM, display: 'Unspecified atrial fibrillation', onsetDate: '2018-04-10', status: 'active' },
    ],
    encounters: [
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-02-08', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-08-18', type: 'outpatient' },
    ],
    procedures: [
      { code: '93000', system: CPT, display: 'ECG', date: '2026-02-08' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-08-18', value: 148, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-08-18', value: 72, unit: 'mm[Hg]' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 5 MG Oral Tablet', startDate: '1985-07-01', status: 'active' },
      { code: '855288', system: RXNORM, display: 'Warfarin 5 MG Oral Tablet', startDate: '2018-05-01', status: 'active' },
      { code: '866924', system: RXNORM, display: 'Amlodipine 5 MG Oral Tablet', startDate: '2010-03-15', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-12', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 23: Wellington Yueh - Recently diagnosed, new to treatment
  // ============================================================================
  {
    id: 'pt-023',
    name: 'Mazer Rackham',
    demographics: {
      birthDate: '1985-08-30',
      gender: 'male',
      race: 'Asian',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      // Newly diagnosed HTN in late 2025
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2025-11-15', status: 'active' },
    ],
    encounters: [
      { code: '99204', system: CPT, display: 'Office visit, new patient, 45-59 min', date: '2025-11-15', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-01-20', type: 'outpatient' },
      { code: '99213', system: CPT, display: 'Office visit, established patient, 20-29 min', date: '2026-04-15', type: 'outpatient' },
    ],
    procedures: [],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2025-11-15', value: 158, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2025-11-15', value: 96, unit: 'mm[Hg]' },
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-01-20', value: 145, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-01-20', value: 90, unit: 'mm[Hg]' },
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-04-15', value: 136, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-04-15', value: 84, unit: 'mm[Hg]' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 10 MG Oral Tablet', startDate: '2025-11-20', status: 'active' },
    ],
    immunizations: [],
  },

  // ============================================================================
  // Patient 24: Piter DeVries - Adult with substance abuse history
  // ============================================================================
  {
    id: 'pt-024',
    name: 'Peter Wiggin',
    demographics: {
      birthDate: '1988-02-14',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2022-05-10', status: 'active' },
      { code: 'F14.20', system: ICD10CM, display: 'Cocaine dependence, uncomplicated', onsetDate: '2019-08-22', status: 'active' },
      { code: 'F17.210', system: ICD10CM, display: 'Nicotine dependence, cigarettes, uncomplicated', onsetDate: '2010-01-01', status: 'active' },
    ],
    encounters: [
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-03-05', type: 'outpatient' },
      { code: '99213', system: CPT, display: 'Office visit, established patient, 20-29 min', date: '2026-09-18', type: 'outpatient' },
    ],
    procedures: [],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-09-18', value: 152, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-09-18', value: 95, unit: 'mm[Hg]' },
      { code: '72166-2', system: LOINC, display: 'Tobacco smoking status', date: '2026-09-18', valueString: 'Current every day smoker' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 20 MG Oral Tablet', startDate: '2022-05-15', status: 'active' },
    ],
    immunizations: [],
  },

  // ============================================================================
  // Patient 25: Glossu Rabban - Morbidly obese with metabolic syndrome
  // ============================================================================
  {
    id: 'pt-025',
    name: 'August Leavitt',
    demographics: {
      birthDate: '1976-09-22',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2015-04-18', status: 'active' },
      { code: 'E66.01', system: ICD10CM, display: 'Morbid obesity due to excess calories', onsetDate: '2012-06-10', status: 'active' },
      { code: 'E11.9', system: ICD10CM, display: 'Type 2 diabetes mellitus', onsetDate: '2018-09-22', status: 'active' },
      { code: 'E78.5', system: ICD10CM, display: 'Hyperlipidemia', onsetDate: '2016-03-15', status: 'active' },
      { code: 'K76.0', system: ICD10CM, display: 'Fatty liver, not elsewhere classified', onsetDate: '2020-08-12', status: 'active' },
    ],
    encounters: [
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-02-25', type: 'outpatient' },
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-06-18', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-11-05', type: 'outpatient' },
    ],
    procedures: [
      { code: '83036', system: CPT, display: 'Hemoglobin A1c', date: '2026-06-18' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-11-05', value: 162, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-11-05', value: 98, unit: 'mm[Hg]' },
      { code: '39156-5', system: LOINC, display: 'Body mass index', date: '2026-11-05', value: 48.5, unit: 'kg/m2' },
      { code: '4548-4', system: LOINC, display: 'Hemoglobin A1c', date: '2026-06-18', value: 8.9, unit: '%' },
      { code: '2093-3', system: LOINC, display: 'Total cholesterol', date: '2026-06-18', value: 265, unit: 'mg/dL' },
      { code: '2571-8', system: LOINC, display: 'Triglycerides', date: '2026-06-18', value: 420, unit: 'mg/dL' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 40 MG Oral Tablet', startDate: '2015-05-01', status: 'active' },
      { code: '866924', system: RXNORM, display: 'Amlodipine 10 MG Oral Tablet', startDate: '2018-02-15', status: 'active' },
      { code: '860975', system: RXNORM, display: 'Metformin 1000 MG Oral Tablet', startDate: '2018-10-01', status: 'active' },
      { code: '316672', system: RXNORM, display: 'Atorvastatin 40 MG Oral Tablet', startDate: '2016-04-01', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-22', status: 'completed' },
    ],
  },

  // ============================================================================
  // CRC SCREENING MEASURE TEST PATIENTS (26-35)
  // ============================================================================

  // ============================================================================
  // Patient 26: Naib Stilgar II - IN NUMERATOR: Recent colonoscopy (2024)
  // Age 55, had colonoscopy 2 years ago - clearly within 10-year window
  // ============================================================================
  {
    id: 'pt-026',
    name: 'Hyrum Graff',
    demographics: {
      birthDate: '1971-03-18',
      gender: 'male',
      race: 'Black or African American',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'K57.30', system: ICD10CM, display: 'Diverticulosis of large intestine without perforation or abscess', onsetDate: '2020-05-15', status: 'active' },
    ],
    encounters: [
      { code: '99396', system: CPT, display: 'Preventive visit, 40-64 years', date: '2026-03-12', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient, 30-39 min', date: '2026-09-18', type: 'outpatient' },
    ],
    procedures: [
      // COLONOSCOPY - 2 years ago, well within 10-year window
      { code: '45378', system: CPT, display: 'Colonoscopy, flexible, diagnostic', date: '2024-06-15' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-09-18', value: 128, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-09-18', value: 82, unit: 'mm[Hg]' },
    ],
    medications: [],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-20', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 27: Harah Stilgar - IN NUMERATOR: Colonoscopy at 10-year boundary
  // Age 62, colonoscopy exactly 9 years ago - tests the boundary condition
  // Edit the date to 2015 to watch patient fall OUT of numerator
  // ============================================================================
  {
    id: 'pt-027',
    name: 'Novinha Ribeira',
    demographics: {
      birthDate: '1964-08-22',
      gender: 'female',
      race: 'Black or African American',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'Z86.010', system: ICD10CM, display: 'Personal history of colonic polyps', onsetDate: '2017-04-20', status: 'resolved' },
    ],
    encounters: [
      { code: '99396', system: CPT, display: 'Preventive visit, 40-64 years', date: '2026-04-08', type: 'outpatient' },
      { code: '99213', system: CPT, display: 'Office visit, established patient', date: '2026-10-22', type: 'outpatient' },
    ],
    procedures: [
      // COLONOSCOPY - 9 years ago, JUST within 10-year window
      // Change to 2015-04-20 or earlier to see patient fall out of numerator
      { code: '45380', system: CPT, display: 'Colonoscopy with biopsy', date: '2017-04-20' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-10-22', value: 132, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-10-22', value: 78, unit: 'mm[Hg]' },
    ],
    medications: [],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-11-05', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 28: Scytale Clone - IN NUMERATOR: Very recent colonoscopy
  // Age 52, colonoscopy just 3 months ago - perfect screening compliance
  // ============================================================================
  {
    id: 'pt-028',
    name: 'Sayid Ibrahim',
    demographics: {
      birthDate: '1974-01-30',
      gender: 'male',
      race: 'Asian',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'Z12.11', system: ICD10CM, display: 'Encounter for screening for malignant neoplasm of colon', onsetDate: '2026-10-05', status: 'resolved' },
    ],
    encounters: [
      { code: '99396', system: CPT, display: 'Preventive visit, 40-64 years', date: '2026-02-15', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient', date: '2026-10-08', type: 'outpatient' },
    ],
    procedures: [
      // COLONOSCOPY - Very recent, just 3 months ago
      { code: '45378', system: CPT, display: 'Colonoscopy, flexible, diagnostic', date: '2026-10-05' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-10-08', value: 118, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-10-08', value: 74, unit: 'mm[Hg]' },
    ],
    medications: [],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-12', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 29: Reverend Mother Ramallo - NOT IN NUMERATOR: Colonoscopy too old
  // Age 68, colonoscopy 12 years ago - outside 10-year window
  // ============================================================================
  {
    id: 'pt-029',
    name: 'Sarah Chen',
    demographics: {
      birthDate: '1958-05-12',
      gender: 'female',
      race: 'White',
      ethnicity: 'Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '2010-08-22', status: 'active' },
    ],
    encounters: [
      { code: '99397', system: CPT, display: 'Preventive visit, 65+ years', date: '2026-05-18', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient', date: '2026-11-12', type: 'outpatient' },
    ],
    procedures: [
      // COLONOSCOPY - 12 years ago, OUTSIDE 10-year window - should NOT meet numerator
      { code: '45378', system: CPT, display: 'Colonoscopy, flexible, diagnostic', date: '2014-03-15' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-11-12', value: 138, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-11-12', value: 82, unit: 'mm[Hg]' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 10 MG Oral Tablet', startDate: '2010-09-01', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-28', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 30: Jamis Turok - NOT IN NUMERATOR: Never had colonoscopy
  // Age 58, in age range but no screening performed
  // ============================================================================
  {
    id: 'pt-030',
    name: 'Hot Soup Han',
    demographics: {
      birthDate: '1968-11-08',
      gender: 'male',
      race: 'Black or African American',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'E11.9', system: ICD10CM, display: 'Type 2 diabetes mellitus', onsetDate: '2020-04-15', status: 'active' },
    ],
    encounters: [
      { code: '99396', system: CPT, display: 'Preventive visit, 40-64 years', date: '2026-06-22', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient', date: '2026-12-05', type: 'outpatient' },
    ],
    procedures: [
      // NO COLONOSCOPY - patient has refused screening
      { code: '83036', system: CPT, display: 'Hemoglobin A1c', date: '2026-06-22' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-12-05', value: 142, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-12-05', value: 88, unit: 'mm[Hg]' },
      { code: '4548-4', system: LOINC, display: 'Hemoglobin A1c', date: '2026-06-22', value: 7.4, unit: '%' },
    ],
    medications: [
      { code: '860975', system: RXNORM, display: 'Metformin 1000 MG Oral Tablet', startDate: '2020-05-01', status: 'active' },
    ],
    immunizations: [],
  },

  // ============================================================================
  // Patient 31: Pardot Kynes - EXCLUDED: Has colorectal cancer diagnosis
  // Age 65, has colon cancer - should be excluded from measure
  // ============================================================================
  {
    id: 'pt-031',
    name: 'Crazy Tom',
    demographics: {
      birthDate: '1961-07-25',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      // COLORECTAL CANCER - Should trigger exclusion
      { code: 'C18.9', system: ICD10CM, display: 'Malignant neoplasm of colon, unspecified', onsetDate: '2023-09-15', status: 'active' },
      { code: 'Z85.038', system: ICD10CM, display: 'Personal history of other malignant neoplasm of large intestine', onsetDate: '2023-09-15', status: 'active' },
    ],
    encounters: [
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-02-08', type: 'outpatient' },
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-08-15', type: 'outpatient' },
    ],
    procedures: [
      { code: '44204', system: CPT, display: 'Partial colectomy', date: '2023-10-20' },
      { code: '45378', system: CPT, display: 'Colonoscopy surveillance', date: '2025-04-12' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-08-15', value: 124, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-08-15', value: 76, unit: 'mm[Hg]' },
    ],
    medications: [
      { code: '583218', system: RXNORM, display: 'Capecitabine 500 MG Oral Tablet', startDate: '2023-11-01', status: 'completed' },
    ],
    immunizations: [],
  },

  // ============================================================================
  // Patient 32: Esmar Tuek - EXCLUDED: Total colectomy history
  // Age 60, had total colectomy - no colon to screen
  // ============================================================================
  {
    id: 'pt-032',
    name: 'Fly Molo',
    demographics: {
      birthDate: '1966-02-14',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'K51.00', system: ICD10CM, display: 'Ulcerative (chronic) pancolitis without complications', onsetDate: '2008-06-22', status: 'resolved' },
      // History indicating total colectomy - should exclude
      { code: 'Z90.49', system: ICD10CM, display: 'Acquired absence of other specified parts of digestive tract', onsetDate: '2018-03-10', status: 'active' },
    ],
    encounters: [
      { code: '99214', system: CPT, display: 'Office visit, established patient', date: '2026-04-18', type: 'outpatient' },
      { code: '99214', system: CPT, display: 'Office visit, established patient', date: '2026-10-25', type: 'outpatient' },
    ],
    procedures: [
      // TOTAL COLECTOMY - should exclude from screening measure
      { code: '44150', system: CPT, display: 'Total abdominal colectomy', date: '2018-03-10' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-10-25', value: 122, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-10-25', value: 74, unit: 'mm[Hg]' },
    ],
    medications: [],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-11-08', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 33: Murbella Honored - NOT IN POPULATION: Too young (age 42)
  // Below CRC screening age of 45
  // ============================================================================
  {
    id: 'pt-033',
    name: 'Shen',
    demographics: {
      birthDate: '1984-04-30',
      gender: 'female',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'K58.9', system: ICD10CM, display: 'Irritable bowel syndrome without diarrhea', onsetDate: '2019-08-12', status: 'active' },
    ],
    encounters: [
      { code: '99395', system: CPT, display: 'Preventive visit, 18-39 years', date: '2026-05-10', type: 'outpatient' },
      { code: '99213', system: CPT, display: 'Office visit, established patient', date: '2026-11-18', type: 'outpatient' },
    ],
    procedures: [],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-11-18', value: 116, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-11-18', value: 72, unit: 'mm[Hg]' },
    ],
    medications: [
      { code: '313850', system: RXNORM, display: 'Dicyclomine 10 MG Oral Capsule', startDate: '2019-09-01', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-15', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 34: Miles Teg - NOT IN POPULATION: Too old (age 78)
  // Above CRC screening upper limit of 75
  // ============================================================================
  {
    id: 'pt-034',
    name: 'Carn Carby',
    demographics: {
      birthDate: '1948-09-05',
      gender: 'male',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'I10', system: ICD10CM, display: 'Essential (primary) hypertension', onsetDate: '1995-03-18', status: 'active' },
      { code: 'I25.10', system: ICD10CM, display: 'Atherosclerotic heart disease', onsetDate: '2015-11-22', status: 'active' },
    ],
    encounters: [
      { code: '99397', system: CPT, display: 'Preventive visit, 65+ years', date: '2026-03-22', type: 'outpatient' },
      { code: '99215', system: CPT, display: 'Office visit, established patient, 40-54 min', date: '2026-09-28', type: 'outpatient' },
    ],
    procedures: [
      // Has colonoscopy but too old for measure
      { code: '45378', system: CPT, display: 'Colonoscopy, flexible, diagnostic', date: '2022-05-18' },
      { code: '93000', system: CPT, display: 'ECG', date: '2026-03-22' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-09-28', value: 142, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-09-28', value: 78, unit: 'mm[Hg]' },
    ],
    medications: [
      { code: '197361', system: RXNORM, display: 'Lisinopril 20 MG Oral Tablet', startDate: '1995-04-01', status: 'active' },
      { code: '855318', system: RXNORM, display: 'Aspirin 81 MG Oral Tablet', startDate: '2015-12-01', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-10-02', status: 'completed' },
      { code: '121', system: CVX, display: 'Zoster vaccine', date: '2020-08-15', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 35: Darwi Odrade - NOT IN NUMERATOR: Has FIT but no colonoscopy
  // Age 56, has FOBT/FIT test but not colonoscopy - tests alternative screening
  // ============================================================================
  {
    id: 'pt-035',
    name: 'Bernard Pol',
    demographics: {
      birthDate: '1970-12-18',
      gender: 'female',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [
      { code: 'E78.5', system: ICD10CM, display: 'Hyperlipidemia, unspecified', onsetDate: '2018-05-22', status: 'active' },
    ],
    encounters: [
      { code: '99396', system: CPT, display: 'Preventive visit, 40-64 years', date: '2026-04-15', type: 'outpatient' },
      { code: '99213', system: CPT, display: 'Office visit, established patient', date: '2026-10-30', type: 'outpatient' },
    ],
    procedures: [
      // FIT/FOBT test only - may or may not qualify depending on measure definition
      { code: '82274', system: CPT, display: 'Fecal hemoglobin determination by immunoassay', date: '2026-04-15' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-10-30', value: 124, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-10-30', value: 78, unit: 'mm[Hg]' },
      // FIT result - negative
      { code: '14627-4', system: LOINC, display: 'Fecal occult blood test', date: '2026-04-15', valueString: 'Negative' },
      { code: '2093-3', system: LOINC, display: 'Total cholesterol', date: '2026-04-15', value: 215, unit: 'mg/dL' },
    ],
    medications: [
      { code: '316672', system: RXNORM, display: 'Atorvastatin 10 MG Oral Tablet', startDate: '2018-06-01', status: 'active' },
    ],
    immunizations: [
      { code: '141', system: CVX, display: 'Influenza', date: '2025-11-12', status: 'completed' },
    ],
  },

  // ============================================================================
  // Patient 36: Diana Vreeland - Young female with cervical cancer screening (NUMERATOR MET)
  // ============================================================================
  {
    id: 'pt-036',
    name: 'Diana Vreeland',
    demographics: {
      birthDate: '2001-07-22',  // 24 years old - within 20-65 age range
      gender: 'female',
      race: 'White',
      ethnicity: 'Not Hispanic or Latino',
    },
    diagnoses: [],  // Healthy patient with no chronic conditions
    encounters: [
      { code: '99395', system: CPT, display: 'Preventive visit, 18-39 years', date: '2026-03-15', type: 'outpatient' },
      { code: '99213', system: CPT, display: 'Office visit, established patient', date: '2026-08-22', type: 'outpatient' },
    ],
    procedures: [
      // Cervical cytology (Pap test) - qualifies for cervical cancer screening numerator
      { code: '88141', system: CPT, display: 'Cytopathology, cervical or vaginal, requiring interpretation by physician', date: '2026-03-15' },
      { code: '88142', system: CPT, display: 'Cytopathology, cervicovaginal, automated thin layer', date: '2026-03-15' },
    ],
    observations: [
      { code: '8480-6', system: LOINC, display: 'Systolic blood pressure', date: '2026-03-15', value: 110, unit: 'mm[Hg]' },
      { code: '8462-4', system: LOINC, display: 'Diastolic blood pressure', date: '2026-03-15', value: 70, unit: 'mm[Hg]' },
      // Cervical cytology result - normal
      { code: '10524-7', system: LOINC, display: 'Cytology report of Cervix specimen', date: '2026-03-15', valueString: 'NILM (Negative for Intraepithelial Lesion or Malignancy)' },
      { code: '8302-2', system: LOINC, display: 'Body height', date: '2026-03-15', value: 168, unit: 'cm' },
      { code: '29463-7', system: LOINC, display: 'Body weight', date: '2026-03-15', value: 62, unit: 'kg' },
    ],
    medications: [],  // No medications
    immunizations: [
      { code: '62', system: CVX, display: 'HPV vaccine, quadrivalent', date: '2019-09-15', status: 'completed' },
      { code: '141', system: CVX, display: 'Influenza, seasonal, injectable', date: '2025-10-20', status: 'completed' },
    ],
  },
];

/**
 * Get all static test patients
 * These patients have fixed clinical data that doesn't change
 */
export function generateTestPatients(
  _measure: UniversalMeasureSpec,
  count: number = 36
): TestPatient[] {
  // Return up to 'count' static patients
  return STATIC_TEST_PATIENTS.slice(0, Math.min(count, STATIC_TEST_PATIENTS.length));
}

/**
 * Get a specific patient by ID
 */
export function getTestPatientById(patientId: string): TestPatient | undefined {
  return STATIC_TEST_PATIENTS.find(p => p.id === patientId);
}

/**
 * Get all static test patients
 */
export function getAllTestPatients(): TestPatient[] {
  return STATIC_TEST_PATIENTS;
}
