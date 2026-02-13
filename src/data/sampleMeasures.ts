/**
 * Sample Measures for Testing
 */

import type { UniversalMeasureSpec } from '../types/ums';

/**
 * Sample CRC Screening Measure (CMS130)
 * Based on Colorectal Cancer Screening eCQM
 */
export function createSampleCRCMeasure(): UniversalMeasureSpec {
  const now = new Date().toISOString();
  const id = `ums-cms130-sample-${Date.now()}`;

  return {
    id,
    metadata: {
      measureId: 'CMS130v12',
      title: 'Colorectal Cancer Screening',
      version: '12.0.000',
      cbeNumber: '0034',
      steward: 'National Committee for Quality Assurance',
      program: 'MIPS_CQM',
      measureType: 'process',
      description: 'Percentage of adults 45-75 years of age who had appropriate screening for colorectal cancer.',
      rationale: 'Colorectal cancer is the second leading cause of cancer deaths in the United States. Regular screening can detect colorectal cancer early, when treatment is most effective.',
      clinicalRecommendation: 'The U.S. Preventive Services Task Force (USPSTF) recommends screening for colorectal cancer starting at age 45 years and continuing until age 75 years (Grade A recommendation).',
      submissionFrequency: 'Once per performance period',
      improvementNotation: 'increase',
      measurementPeriod: {
        start: '2025-01-01',
        end: '2025-12-31',
        inclusive: true,
      },
      lastUpdated: now,
      sourceDocuments: ['Sample Measure for Testing'],
    },
    populations: [
      {
        id: 'ip-0',
        type: 'initial_population',
        description: 'Patients 45-75 years of age with a visit during the measurement period',
        narrative: 'Patients 45-75 years of age with at least one eligible encounter during the measurement period.',
        confidence: 'high',
        reviewStatus: 'approved',
        criteria: {
          id: 'ip-criteria-0',
          operator: 'AND',
          description: 'Initial Population criteria',
          confidence: 'high',
          reviewStatus: 'approved',
          children: [
            {
              id: 'ip-elem-0-0',
              type: 'demographic',
              description: 'Patient age 45-75 years at start of measurement period',
              confidence: 'high',
              source: 'Sample',
              reviewStatus: 'approved',
              thresholds: {
                ageMin: 45,
                ageMax: 75,
              },
            },
            {
              id: 'ip-elem-0-1',
              type: 'encounter',
              description: 'Qualifying encounter during measurement period',
              valueSet: {
                id: 'vs-office-visit',
                name: 'Office Visit',
                oid: '2.16.840.1.113883.3.464.1003.101.12.1001',
                confidence: 'high',
                codes: [
                  { code: '99201', display: 'Office visit, new patient, minimal', system: 'CPT' },
                  { code: '99202', display: 'Office visit, new patient, low', system: 'CPT' },
                  { code: '99203', display: 'Office visit, new patient, moderate', system: 'CPT' },
                  { code: '99211', display: 'Office visit, established patient, minimal', system: 'CPT' },
                  { code: '99212', display: 'Office visit, established patient, low', system: 'CPT' },
                  { code: '99213', display: 'Office visit, established patient, moderate', system: 'CPT' },
                  { code: '99214', display: 'Office visit, established patient, high', system: 'CPT' },
                  { code: '99215', display: 'Office visit, established patient, comprehensive', system: 'CPT' },
                ],
                totalCodeCount: 8,
              },
              timingRequirements: [
                {
                  description: 'During measurement period',
                  relativeTo: 'measurement_period',
                  confidence: 'high',
                },
              ],
              confidence: 'high',
              source: 'Sample',
              reviewStatus: 'approved',
            },
          ],
        },
      },
      {
        id: 'den-0',
        type: 'denominator',
        description: 'Equals Initial Population',
        narrative: 'Equals Initial Population',
        confidence: 'high',
        reviewStatus: 'approved',
        criteria: {
          id: 'den-criteria-0',
          operator: 'AND',
          description: 'Denominator equals Initial Population',
          confidence: 'high',
          reviewStatus: 'approved',
          children: [],
        },
      },
      {
        id: 'ex-0',
        type: 'denominator_exclusion',
        description: 'Patients with colorectal cancer, total colectomy, hospice care, or advanced illness',
        narrative: 'Patients with a diagnosis of colorectal cancer, history of total colectomy, receiving hospice or palliative care, or with advanced illness and frailty.',
        confidence: 'high',
        reviewStatus: 'pending',
        criteria: {
          id: 'ex-criteria-0',
          operator: 'OR',
          description: 'Denominator Exclusion criteria',
          confidence: 'high',
          reviewStatus: 'pending',
          children: [
            {
              id: 'ex-elem-0-0',
              type: 'diagnosis',
              description: 'Diagnosis of colorectal cancer',
              valueSet: {
                id: 'vs-crc',
                name: 'Malignant Neoplasm of Colon',
                oid: '2.16.840.1.113883.3.464.1003.108.12.1001',
                confidence: 'medium',
                codes: [
                  { code: 'C18.9', display: 'Malignant neoplasm of colon, unspecified', system: 'ICD10' },
                ],
                totalCodeCount: 1,
              },
              confidence: 'medium',
              source: 'Sample',
              reviewStatus: 'pending',
            },
            {
              id: 'ex-elem-0-1',
              type: 'procedure',
              description: 'History of total colectomy',
              valueSet: {
                id: 'vs-colectomy',
                name: 'Total Colectomy',
                oid: '2.16.840.1.113883.3.464.1003.198.12.1019',
                confidence: 'medium',
                codes: [
                  { code: '44150', display: 'Colectomy, total, abdominal', system: 'CPT' },
                ],
                totalCodeCount: 1,
              },
              confidence: 'medium',
              source: 'Sample',
              reviewStatus: 'pending',
            },
            {
              id: 'ex-elem-0-2',
              type: 'encounter',
              description: 'Hospice or palliative care',
              valueSet: {
                id: 'vs-hospice',
                name: 'Hospice Care',
                oid: '2.16.840.1.113883.3.464.1003.1003',
                confidence: 'medium',
                codes: [
                  { code: 'Z51.5', display: 'Encounter for palliative care', system: 'ICD10' },
                ],
                totalCodeCount: 1,
              },
              confidence: 'medium',
              source: 'Sample',
              reviewStatus: 'pending',
            },
          ],
        },
      },
      {
        id: 'num-0',
        type: 'numerator',
        description: 'Patients with appropriate colorectal cancer screening',
        narrative: 'Patients with one or more screenings for colorectal cancer. Appropriate screenings include: Fecal occult blood test (FOBT) during the measurement period, FIT-DNA test during the measurement period or the two years prior, Flexible sigmoidoscopy during the measurement period or the four years prior, CT colonography during the measurement period or the four years prior, or Colonoscopy during the measurement period or the nine years prior.',
        confidence: 'high',
        reviewStatus: 'pending',
        criteria: {
          id: 'num-criteria-0',
          operator: 'OR',
          description: 'Numerator screening criteria',
          confidence: 'high',
          reviewStatus: 'pending',
          children: [
            {
              id: 'num-elem-0-0',
              type: 'procedure',
              description: 'Colonoscopy within 10 years',
              valueSet: {
                id: 'vs-colonoscopy',
                name: 'Colonoscopy',
                oid: '2.16.840.1.113883.3.464.1003.108.12.1020',
                confidence: 'medium',
                codes: [
                  { code: '45378', display: 'Colonoscopy, flexible; diagnostic', system: 'CPT' },
                  { code: '45380', display: 'Colonoscopy, flexible; with biopsy', system: 'CPT' },
                ],
                totalCodeCount: 2,
              },
              timingRequirements: [
                {
                  description: 'Within 10 years of measurement period end',
                  relativeTo: 'measurement_period_end',
                  window: { value: 10, unit: 'years', direction: 'before' },
                  confidence: 'high',
                },
              ],
              confidence: 'medium',
              source: 'Sample',
              reviewStatus: 'pending',
            },
            {
              id: 'num-elem-0-1',
              type: 'observation',
              description: 'FOBT during measurement period',
              valueSet: {
                id: 'vs-fobt',
                name: 'Fecal Occult Blood Test (FOBT)',
                oid: '2.16.840.1.113883.3.464.1003.198.12.1011',
                confidence: 'medium',
                codes: [
                  { code: '82270', display: 'Blood, occult, by peroxidase activity', system: 'CPT' },
                ],
                totalCodeCount: 1,
              },
              timingRequirements: [
                {
                  description: 'During measurement period',
                  relativeTo: 'measurement_period',
                  confidence: 'high',
                },
              ],
              confidence: 'medium',
              source: 'Sample',
              reviewStatus: 'pending',
            },
            {
              id: 'num-elem-0-2',
              type: 'observation',
              description: 'FIT-DNA test within 3 years',
              valueSet: {
                id: 'vs-fitdna',
                name: 'FIT-DNA (Stool DNA)',
                oid: '2.16.840.1.113883.3.464.1003.108.12.1039',
                confidence: 'medium',
                codes: [
                  { code: '81528', display: 'Oncology (colorectal) screening, stool-based DNA', system: 'CPT' },
                ],
                totalCodeCount: 1,
              },
              timingRequirements: [
                {
                  description: 'Within 3 years of measurement period end',
                  relativeTo: 'measurement_period_end',
                  window: { value: 3, unit: 'years', direction: 'before' },
                  confidence: 'high',
                },
              ],
              confidence: 'medium',
              source: 'Sample',
              reviewStatus: 'pending',
            },
            {
              id: 'num-elem-0-3',
              type: 'procedure',
              description: 'Flexible sigmoidoscopy within 5 years',
              valueSet: {
                id: 'vs-sigmoidoscopy',
                name: 'Flexible Sigmoidoscopy',
                oid: '2.16.840.1.113883.3.464.1003.198.12.1010',
                confidence: 'medium',
                codes: [
                  { code: '45330', display: 'Sigmoidoscopy, flexible; diagnostic', system: 'CPT' },
                ],
                totalCodeCount: 1,
              },
              timingRequirements: [
                {
                  description: 'Within 5 years of measurement period end',
                  relativeTo: 'measurement_period_end',
                  window: { value: 5, unit: 'years', direction: 'before' },
                  confidence: 'high',
                },
              ],
              confidence: 'medium',
              source: 'Sample',
              reviewStatus: 'pending',
            },
          ],
        },
      },
    ],
    valueSets: [
      {
        id: 'vs-office-visit',
        name: 'Office Visit',
        oid: '2.16.840.1.113883.3.464.1003.101.12.1001',
        confidence: 'high',
        source: 'Sample',
        verified: false,
        codes: [
          { code: '99201', display: 'Office visit, new patient, minimal', system: 'CPT' },
          { code: '99202', display: 'Office visit, new patient, low', system: 'CPT' },
          { code: '99203', display: 'Office visit, new patient, moderate', system: 'CPT' },
          { code: '99211', display: 'Office visit, established patient, minimal', system: 'CPT' },
          { code: '99212', display: 'Office visit, established patient, low', system: 'CPT' },
          { code: '99213', display: 'Office visit, established patient, moderate', system: 'CPT' },
          { code: '99214', display: 'Office visit, established patient, high', system: 'CPT' },
          { code: '99215', display: 'Office visit, established patient, comprehensive', system: 'CPT' },
        ],
        totalCodeCount: 8,
      },
    ],
    status: 'in_progress',
    overallConfidence: 'medium',
    reviewProgress: { total: 12, approved: 4, pending: 8, flagged: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Sample Breast Cancer Screening Measure (CMS125)
 * Includes Patient Sex: Female demographic component
 */
export function createSampleBreastCancerMeasure(): UniversalMeasureSpec {
  const now = new Date().toISOString();
  const id = `ums-cms125-sample-${Date.now()}`;

  return {
    id,
    metadata: {
      measureId: 'CMS125v12',
      title: 'Breast Cancer Screening',
      version: '12.0.000',
      cbeNumber: '2372',
      steward: 'National Committee for Quality Assurance',
      program: 'MIPS_CQM',
      measureType: 'process',
      description: 'Percentage of women 50-74 years of age who had a mammogram to screen for breast cancer in the 27 months prior to the end of the measurement period.',
      rationale: 'Breast cancer is the most commonly diagnosed cancer in women and the second leading cause of cancer death among women in the United States. Early detection through screening mammography can significantly reduce breast cancer mortality.',
      clinicalRecommendation: 'The U.S. Preventive Services Task Force (USPSTF) recommends biennial screening mammography for women aged 50 to 74 years (Grade B recommendation).',
      submissionFrequency: 'Once per performance period',
      improvementNotation: 'increase',
      measurementPeriod: {
        start: '2025-01-01',
        end: '2025-12-31',
        inclusive: true,
      },
      lastUpdated: now,
      sourceDocuments: ['Sample Measure for Testing'],
    },
    populations: [
      {
        id: 'ip-0',
        type: 'initial_population',
        description: 'Female patients 50-74 years of age with a visit during the measurement period',
        narrative: 'Female patients 50-74 years of age with at least one eligible encounter during the measurement period.',
        confidence: 'high',
        reviewStatus: 'approved',
        criteria: {
          id: 'ip-criteria-0',
          operator: 'AND',
          description: 'Initial Population criteria',
          confidence: 'high',
          reviewStatus: 'approved',
          children: [
            {
              id: 'ip-elem-0-sex',
              type: 'demographic',
              description: 'Patient Sex: Female',
              genderValue: 'female',
              libraryComponentId: 'patient-sex-female',
              confidence: 'high',
              source: 'Sample',
              reviewStatus: 'approved',
            },
            {
              id: 'ip-elem-0-age',
              type: 'demographic',
              description: 'Patient age 50-74 years at start of measurement period',
              confidence: 'high',
              source: 'Sample',
              reviewStatus: 'approved',
              thresholds: {
                ageMin: 50,
                ageMax: 74,
              },
            },
            {
              id: 'ip-elem-0-enc',
              type: 'encounter',
              description: 'Qualifying encounter during measurement period',
              valueSet: {
                id: 'vs-office-visit',
                name: 'Office Visit',
                oid: '2.16.840.1.113883.3.464.1003.101.12.1001',
                confidence: 'high',
                codes: [
                  { code: '99201', display: 'Office visit, new patient, minimal', system: 'CPT' },
                  { code: '99202', display: 'Office visit, new patient, low', system: 'CPT' },
                  { code: '99211', display: 'Office visit, established patient, minimal', system: 'CPT' },
                  { code: '99212', display: 'Office visit, established patient, low', system: 'CPT' },
                  { code: '99213', display: 'Office visit, established patient, moderate', system: 'CPT' },
                ],
                totalCodeCount: 5,
              },
              timingRequirements: [
                {
                  description: 'During measurement period',
                  relativeTo: 'measurement_period',
                  confidence: 'high',
                },
              ],
              confidence: 'high',
              source: 'Sample',
              reviewStatus: 'approved',
            },
          ],
        },
      },
      {
        id: 'den-0',
        type: 'denominator',
        description: 'Equals Initial Population',
        narrative: 'Equals Initial Population',
        confidence: 'high',
        reviewStatus: 'approved',
        criteria: {
          id: 'den-criteria-0',
          operator: 'AND',
          description: 'Denominator equals Initial Population',
          confidence: 'high',
          reviewStatus: 'approved',
          children: [],
        },
      },
      {
        id: 'ex-0',
        type: 'denominator_exclusion',
        description: 'Patients with bilateral mastectomy, hospice care, or advanced illness',
        narrative: 'Patients with history of bilateral mastectomy, receiving hospice or palliative care, or with advanced illness and frailty.',
        confidence: 'high',
        reviewStatus: 'pending',
        criteria: {
          id: 'ex-criteria-0',
          operator: 'OR',
          description: 'Denominator Exclusion criteria',
          confidence: 'high',
          reviewStatus: 'pending',
          children: [
            {
              id: 'ex-elem-0-0',
              type: 'procedure',
              description: 'Bilateral mastectomy',
              valueSet: {
                id: 'vs-mastectomy',
                name: 'Bilateral Mastectomy',
                oid: '2.16.840.1.113883.3.464.1003.198.12.1005',
                confidence: 'medium',
                codes: [
                  { code: '19303', display: 'Mastectomy, simple, complete', system: 'CPT' },
                ],
                totalCodeCount: 1,
              },
              confidence: 'medium',
              source: 'Sample',
              reviewStatus: 'pending',
            },
            {
              id: 'ex-elem-0-1',
              type: 'encounter',
              description: 'Hospice Care',
              valueSet: {
                id: 'vs-hospice',
                name: 'Hospice Care Ambulatory',
                oid: '2.16.840.1.113883.3.526.3.1584',
                confidence: 'medium',
                codes: [
                  { code: '99377', display: 'Hospice care supervision', system: 'CPT' },
                  { code: '99378', display: 'Hospice care supervision', system: 'CPT' },
                ],
                totalCodeCount: 2,
              },
              confidence: 'medium',
              source: 'Sample',
              reviewStatus: 'pending',
            },
          ],
        },
      },
      {
        id: 'num-0',
        type: 'numerator',
        description: 'Patients with a mammogram within 27 months prior to the end of the measurement period',
        narrative: 'Patients who had a screening mammogram within 27 months prior to the end of the measurement period.',
        confidence: 'high',
        reviewStatus: 'approved',
        criteria: {
          id: 'num-criteria-0',
          operator: 'OR',
          description: 'Numerator criteria',
          confidence: 'high',
          reviewStatus: 'approved',
          children: [
            {
              id: 'num-elem-0-0',
              type: 'procedure',
              description: 'Mammography within 27 months',
              valueSet: {
                id: 'vs-mammography',
                name: 'Mammography',
                oid: '2.16.840.1.113883.3.464.1003.108.12.1018',
                confidence: 'high',
                codes: [
                  { code: '77067', display: 'Screening mammography, bilateral', system: 'CPT' },
                  { code: '77066', display: 'Diagnostic mammography, bilateral', system: 'CPT' },
                  { code: '77065', display: 'Diagnostic mammography, unilateral', system: 'CPT' },
                ],
                totalCodeCount: 3,
              },
              timingRequirements: [
                {
                  description: '27 months or less before end of measurement period',
                  relativeTo: 'measurement_period_end',
                  window: {
                    value: 27,
                    unit: 'months',
                    direction: 'before',
                  },
                  confidence: 'high',
                },
              ],
              confidence: 'high',
              source: 'Sample',
              reviewStatus: 'approved',
            },
          ],
        },
      },
    ],
    valueSets: [
      {
        id: 'vs-office-visit',
        name: 'Office Visit',
        oid: '2.16.840.1.113883.3.464.1003.101.12.1001',
        confidence: 'high',
        source: 'Sample',
        verified: false,
        codes: [
          { code: '99201', display: 'Office visit, new patient, minimal', system: 'CPT' },
          { code: '99202', display: 'Office visit, new patient, low', system: 'CPT' },
          { code: '99211', display: 'Office visit, established patient, minimal', system: 'CPT' },
          { code: '99212', display: 'Office visit, established patient, low', system: 'CPT' },
          { code: '99213', display: 'Office visit, established patient, moderate', system: 'CPT' },
        ],
        totalCodeCount: 5,
      },
    ],
    status: 'in_progress',
    overallConfidence: 'medium',
    reviewProgress: { total: 8, approved: 4, pending: 4, flagged: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Sample Cervical Cancer Screening Measure (CMS124)
 * Includes Patient Sex: Female demographic component
 */
export function createSampleCervicalCancerMeasure(): UniversalMeasureSpec {
  const now = new Date().toISOString();
  const id = `ums-cms124-sample-${Date.now()}`;

  return {
    id,
    metadata: {
      measureId: 'CMS124v12',
      title: 'Cervical Cancer Screening',
      version: '12.0.000',
      cbeNumber: '0032',
      steward: 'National Committee for Quality Assurance',
      program: 'MIPS_CQM',
      measureType: 'process',
      description: 'Percentage of women 21-64 years of age who were screened for cervical cancer using either of the following criteria: Women age 21-64 who had cervical cytology performed within the last 3 years, or Women age 30-64 who had cervical cytology/human papillomavirus (HPV) co-testing within the last 5 years.',
      rationale: 'Cervical cancer is highly preventable with early detection through screening. The Pap test can detect precancerous lesions that, if treated, can prevent cervical cancer.',
      clinicalRecommendation: 'The U.S. Preventive Services Task Force (USPSTF) recommends screening for cervical cancer every 3 years with cervical cytology alone in women aged 21 to 29 years, and every 3 years with cervical cytology alone, every 5 years with hrHPV testing alone, or every 5 years with hrHPV testing in combination with cytology (cotesting) in women aged 30 to 65 years.',
      submissionFrequency: 'Once per performance period',
      improvementNotation: 'increase',
      measurementPeriod: {
        start: '2025-01-01',
        end: '2025-12-31',
        inclusive: true,
      },
      lastUpdated: now,
      sourceDocuments: ['Sample Measure for Testing'],
    },
    populations: [
      {
        id: 'ip-0',
        type: 'initial_population',
        description: 'Female patients 21-64 years of age with a visit during the measurement period',
        narrative: 'Female patients 21-64 years of age with at least one eligible encounter during the measurement period.',
        confidence: 'high',
        reviewStatus: 'approved',
        criteria: {
          id: 'ip-criteria-0',
          operator: 'AND',
          description: 'Initial Population criteria',
          confidence: 'high',
          reviewStatus: 'approved',
          children: [
            {
              id: 'ip-elem-0-sex',
              type: 'demographic',
              description: 'Patient Sex: Female',
              genderValue: 'female',
              libraryComponentId: 'patient-sex-female',
              confidence: 'high',
              source: 'Sample',
              reviewStatus: 'approved',
            },
            {
              id: 'ip-elem-0-age',
              type: 'demographic',
              description: 'Patient age 21-64 years at start of measurement period',
              confidence: 'high',
              source: 'Sample',
              reviewStatus: 'approved',
              thresholds: {
                ageMin: 21,
                ageMax: 64,
              },
            },
            {
              id: 'ip-elem-0-enc',
              type: 'encounter',
              description: 'Qualifying encounter during measurement period',
              valueSet: {
                id: 'vs-office-visit',
                name: 'Office Visit',
                oid: '2.16.840.1.113883.3.464.1003.101.12.1001',
                confidence: 'high',
                codes: [
                  { code: '99201', display: 'Office visit, new patient, minimal', system: 'CPT' },
                  { code: '99202', display: 'Office visit, new patient, low', system: 'CPT' },
                  { code: '99211', display: 'Office visit, established patient, minimal', system: 'CPT' },
                  { code: '99212', display: 'Office visit, established patient, low', system: 'CPT' },
                  { code: '99213', display: 'Office visit, established patient, moderate', system: 'CPT' },
                ],
                totalCodeCount: 5,
              },
              timingRequirements: [
                {
                  description: 'During measurement period',
                  relativeTo: 'measurement_period',
                  confidence: 'high',
                },
              ],
              confidence: 'high',
              source: 'Sample',
              reviewStatus: 'approved',
            },
          ],
        },
      },
      {
        id: 'den-0',
        type: 'denominator',
        description: 'Equals Initial Population',
        narrative: 'Equals Initial Population',
        confidence: 'high',
        reviewStatus: 'approved',
        criteria: {
          id: 'den-criteria-0',
          operator: 'AND',
          description: 'Denominator equals Initial Population',
          confidence: 'high',
          reviewStatus: 'approved',
          children: [],
        },
      },
      {
        id: 'ex-0',
        type: 'denominator_exclusion',
        description: 'Patients with hysterectomy with no residual cervix, hospice care, or advanced illness',
        narrative: 'Patients who have had a hysterectomy with no residual cervix, receiving hospice or palliative care, or with advanced illness and frailty.',
        confidence: 'high',
        reviewStatus: 'pending',
        criteria: {
          id: 'ex-criteria-0',
          operator: 'OR',
          description: 'Denominator Exclusion criteria',
          confidence: 'high',
          reviewStatus: 'pending',
          children: [
            {
              id: 'ex-elem-0-0',
              type: 'procedure',
              description: 'Hysterectomy with no residual cervix',
              valueSet: {
                id: 'vs-hysterectomy',
                name: 'Hysterectomy with No Residual Cervix',
                oid: '2.16.840.1.113883.3.464.1003.198.12.1014',
                confidence: 'medium',
                codes: [
                  { code: '58150', display: 'Total abdominal hysterectomy', system: 'CPT' },
                  { code: '58152', display: 'Total abdominal hysterectomy with colpo-urethrocystopexy', system: 'CPT' },
                ],
                totalCodeCount: 2,
              },
              confidence: 'medium',
              source: 'Sample',
              reviewStatus: 'pending',
            },
            {
              id: 'ex-elem-0-1',
              type: 'encounter',
              description: 'Hospice Care',
              valueSet: {
                id: 'vs-hospice',
                name: 'Hospice Care Ambulatory',
                oid: '2.16.840.1.113883.3.526.3.1584',
                confidence: 'medium',
                codes: [
                  { code: '99377', display: 'Hospice care supervision', system: 'CPT' },
                  { code: '99378', display: 'Hospice care supervision', system: 'CPT' },
                ],
                totalCodeCount: 2,
              },
              confidence: 'medium',
              source: 'Sample',
              reviewStatus: 'pending',
            },
          ],
        },
      },
      {
        id: 'num-0',
        type: 'numerator',
        description: 'Patients with appropriate cervical cancer screening',
        narrative: 'Patients who had cervical cytology within 3 years, or cervical cytology/HPV co-testing within 5 years (for women 30-64).',
        confidence: 'high',
        reviewStatus: 'approved',
        criteria: {
          id: 'num-criteria-0',
          operator: 'OR',
          description: 'Numerator criteria',
          confidence: 'high',
          reviewStatus: 'approved',
          children: [
            {
              id: 'num-elem-0-0',
              type: 'procedure',
              description: 'Cervical cytology (Pap test) within 3 years',
              valueSet: {
                id: 'vs-pap-test',
                name: 'Pap Test',
                oid: '2.16.840.1.113883.3.464.1003.108.12.1017',
                confidence: 'high',
                codes: [
                  { code: '88141', display: 'Cytopathology, cervical or vaginal', system: 'CPT' },
                  { code: '88142', display: 'Cytopathology, cervical or vaginal, thin layer', system: 'CPT' },
                  { code: '88143', display: 'Cytopathology, cervical or vaginal, thin layer, rescreening', system: 'CPT' },
                  { code: '88175', display: 'Cytopathology, cervical or vaginal, automated thin layer', system: 'CPT' },
                ],
                totalCodeCount: 4,
              },
              timingRequirements: [
                {
                  description: '3 years or less before end of measurement period',
                  relativeTo: 'measurement_period_end',
                  window: {
                    value: 3,
                    unit: 'years',
                    direction: 'before',
                  },
                  confidence: 'high',
                },
              ],
              confidence: 'high',
              source: 'Sample',
              reviewStatus: 'approved',
            },
            {
              id: 'num-elem-0-1',
              type: 'procedure',
              description: 'HPV test within 5 years (for women 30-64)',
              valueSet: {
                id: 'vs-hpv-test',
                name: 'HPV Test',
                oid: '2.16.840.1.113883.3.464.1003.110.12.1059',
                confidence: 'high',
                codes: [
                  { code: '87624', display: 'Human papillomavirus (HPV) test, high-risk types', system: 'CPT' },
                  { code: '87625', display: 'Human papillomavirus (HPV) test, high-risk types, quantitation', system: 'CPT' },
                ],
                totalCodeCount: 2,
              },
              timingRequirements: [
                {
                  description: '5 years or less before end of measurement period',
                  relativeTo: 'measurement_period_end',
                  window: {
                    value: 5,
                    unit: 'years',
                    direction: 'before',
                  },
                  confidence: 'high',
                },
              ],
              confidence: 'high',
              source: 'Sample',
              reviewStatus: 'approved',
            },
          ],
        },
      },
    ],
    valueSets: [
      {
        id: 'vs-office-visit',
        name: 'Office Visit',
        oid: '2.16.840.1.113883.3.464.1003.101.12.1001',
        confidence: 'high',
        source: 'Sample',
        verified: false,
        codes: [
          { code: '99201', display: 'Office visit, new patient, minimal', system: 'CPT' },
          { code: '99202', display: 'Office visit, new patient, low', system: 'CPT' },
          { code: '99211', display: 'Office visit, established patient, minimal', system: 'CPT' },
          { code: '99212', display: 'Office visit, established patient, low', system: 'CPT' },
          { code: '99213', display: 'Office visit, established patient, moderate', system: 'CPT' },
        ],
        totalCodeCount: 5,
      },
    ],
    status: 'in_progress',
    overallConfidence: 'medium',
    reviewProgress: { total: 10, approved: 5, pending: 5, flagged: 0 },
    createdAt: now,
    updatedAt: now,
  };
}
