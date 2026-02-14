-- V10: Seed 9 production eCQM measures with full component library
-- This migration creates the complete component library and all 9 measures
-- with their population logic trees, data elements, and value sets.

-- ============================================================================
-- SECTION 1: SHARED COMPONENTS (Library)
-- These components are used across multiple measures
-- ============================================================================

-- Age threshold components
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
-- Age >= 12 (CMS2)
('age-12-plus', 'atomic', 'Age 12 and Older',
 'Patient age is 12 years or older during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'DEMOGRAPHICS', false, 'ecqi',
 false, 'Patient', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Age >= 18 (CMS69, CMS122, CMS138, CMS165)
('age-18-plus', 'atomic', 'Age 18 and Older',
 'Patient age is 18 years or older during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'DEMOGRAPHICS', false, 'ecqi',
 false, 'Patient', 4,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Age 18-64 (CMS124 with HPV)
('age-18-64', 'atomic', 'Age 18-64 Years',
 'Patient age is between 18 and 64 years during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'DEMOGRAPHICS', false, 'ecqi',
 false, 'Patient', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Age 18-75 (CMS122)
('age-18-75', 'atomic', 'Age 18-75 Years',
 'Patient age is between 18 and 75 years during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'DEMOGRAPHICS', false, 'ecqi',
 false, 'Patient', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Age 18-85 (CMS165)
('age-18-85', 'atomic', 'Age 18-85 Years',
 'Patient age is between 18 and 85 years during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'DEMOGRAPHICS', false, 'ecqi',
 false, 'Patient', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Age 21-64 (CMS124)
('age-21-64', 'atomic', 'Age 21-64 Years',
 'Patient age is between 21 and 64 years during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'DEMOGRAPHICS', false, 'ecqi',
 false, 'Patient', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Age 45-75 (CMS130)
('age-45-75', 'atomic', 'Age 45-75 Years',
 'Patient age is between 45 and 75 years during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'DEMOGRAPHICS', false, 'ecqi',
 false, 'Patient', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Age 52-74 (CMS125)
('age-52-74', 'atomic', 'Age 52-74 Years',
 'Patient age is between 52 and 74 years during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'DEMOGRAPHICS', false, 'ecqi',
 false, 'Patient', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Encounter components
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
-- Office Visit (used by all 9 measures)
('enc-office-visit', 'atomic', 'Qualifying Encounter: Office Visit',
 'Office visit encounter during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'ENCOUNTERS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.101.12.1001', 'Office Visit', '20240101',
 'DURING', 'Measurement Period', 'during Measurement Period',
 false, 'Encounter', 9,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Preventive Care (CMS69, CMS124, CMS125, CMS127, CMS130, CMS138)
('enc-preventive-care', 'atomic', 'Qualifying Encounter: Preventive Care',
 'Preventive care services encounter during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'ENCOUNTERS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.101.12.1027', 'Preventive Care Services - Established Office Visit, 18 and Up', '20240101',
 'DURING', 'Measurement Period', 'during Measurement Period',
 false, 'Encounter', 6,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Telehealth (CMS2, CMS122, CMS165)
('enc-telehealth', 'atomic', 'Qualifying Encounter: Telehealth',
 'Telehealth or virtual encounter during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'ENCOUNTERS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.101.12.1089', 'Online Assessments', '20240101',
 'DURING', 'Measurement Period', 'during Measurement Period',
 false, 'Encounter', 3,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Psych Visit (CMS2)
('enc-psych-visit', 'atomic', 'Qualifying Encounter: Psych Visit',
 'Psychiatric or mental health encounter during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'ENCOUNTERS', false, 'ecqi',
 '2.16.840.1.113883.3.526.3.1492', 'Outpatient Consultation', '20240101',
 'DURING', 'Measurement Period', 'during Measurement Period',
 false, 'Encounter', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Annual Wellness Visit
('enc-annual-wellness', 'atomic', 'Annual Wellness Visit',
 'Annual wellness visit during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'ENCOUNTERS', false, 'ecqi',
 '2.16.840.1.113883.3.526.3.1240', 'Annual Wellness Visit', '20240101',
 'DURING', 'Measurement Period', 'during Measurement Period',
 false, 'Encounter', 6,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Exclusion components
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
-- Hospice Care Exclusion (CMS122, CMS124, CMS125, CMS127, CMS130, CMS165)
('excl-hospice', 'atomic', 'Hospice Care Exclusion',
 'Patient receiving hospice care services - common exclusion across quality measures',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.526.3.1584', 'Hospice Care Ambulatory', '20240101',
 'DURING', 'Measurement Period', 'during Measurement Period',
 false, 'Encounter', 6,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Palliative Care Exclusion (CMS122, CMS124, CMS125, CMS130, CMS165)
('excl-palliative', 'atomic', 'Palliative Care Exclusion',
 'Patient receiving palliative care services',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.101.12.1090', 'Palliative Care Encounter', '20240101',
 'DURING', 'Measurement Period', 'during Measurement Period',
 false, 'Encounter', 5,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Advanced Illness Exclusion (CMS122, CMS125)
('excl-advanced-illness', 'atomic', 'Advanced Illness Exclusion',
 'Patient with advanced illness and frailty',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.111.12.1059', 'Advanced Illness', '20240101',
 'DURING', 'Measurement Period', 'during Measurement Period',
 false, 'Condition', 2,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Pregnancy Exclusion (CMS69, CMS165)
('excl-pregnancy', 'atomic', 'Pregnancy Exclusion',
 'Patient with active pregnancy diagnosis',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.526.3.378', 'Pregnancy', '20240101',
 'DURING', 'Measurement Period', 'during Measurement Period',
 false, 'Condition', 2,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS2 - Depression Screening Components
-- ============================================================================
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
('cms2-adolescent-depression-screening', 'atomic', 'Adolescent Depression Screening',
 'Adolescent depression screening performed (LOINC 73831-0)',
 'LOW', 1, '1.0', 'APPROVED',
 'ASSESSMENTS', false, 'ecqi',
 '2.16.840.1.113883.3.600.559', 'Adolescent Depression Screening', '20240101',
 'DURING', 'Encounter', 'during encounter',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms2-adult-depression-screening', 'atomic', 'Adult Depression Screening',
 'Adult depression screening performed (LOINC 73832-8)',
 'LOW', 1, '1.0', 'APPROVED',
 'ASSESSMENTS', false, 'ecqi',
 '2.16.840.1.113883.3.600.145', 'Adult Depression Screening', '20240101',
 'DURING', 'Encounter', 'during encounter',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms2-positive-depression-finding', 'atomic', 'Positive Depression Screening Finding',
 'Depression screening result indicates positive finding',
 'LOW', 1, '1.0', 'APPROVED',
 'CLINICAL_OBSERVATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.600.2449', 'Positive Depression Screening', '20240101',
 'DURING', 'Encounter', 'during encounter',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms2-negative-depression-finding', 'atomic', 'Negative Depression Screening Finding',
 'Depression screening result indicates negative finding',
 'LOW', 1, '1.0', 'APPROVED',
 'CLINICAL_OBSERVATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.600.2450', 'Negative Depression Screening', '20240101',
 'DURING', 'Encounter', 'during encounter',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms2-followup-plan', 'atomic', 'Follow-Up for Positive Depression Screening',
 'Follow-up plan documented for positive depression screening',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'CLINICAL_OBSERVATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.600.1916', 'Follow Up for Above Normal BMI', '20240101',
 'DURING', 'Encounter', 'during encounter or within 2 days',
 false, 'Procedure', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms2-antidepressant-med', 'atomic', 'Antidepressant Medication Active',
 'Patient has active antidepressant medication order',
 'LOW', 1, '1.0', 'APPROVED',
 'MEDICATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.196.12.1213', 'Antidepressant Medications', '20240101',
 'DURING', 'Encounter', 'active during encounter',
 false, 'MedicationRequest', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms2-bipolar-diagnosis', 'atomic', 'Bipolar Disorder Diagnosis',
 'Patient has diagnosis of bipolar disorder',
 'LOW', 1, '1.0', 'APPROVED',
 'CONDITIONS', false, 'ecqi',
 '2.16.840.1.113883.3.600.450', 'Bipolar Diagnosis', '20240101',
 'BEFORE', 'Encounter', 'active before or during encounter',
 false, 'Condition', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms2-not-done-medical', 'atomic', 'Depression Screening Not Done: Medical Reason',
 'Depression screening not performed due to medical reason',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.600.2447', 'Medical Reason', '20240101',
 'DURING', 'Encounter', 'during encounter',
 true, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms2-not-done-patient', 'atomic', 'Depression Screening Not Done: Patient Reason',
 'Depression screening not performed due to patient reason',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.600.2448', 'Patient Reason', '20240101',
 'DURING', 'Encounter', 'during encounter',
 true, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS69 - BMI Screening Components
-- ============================================================================
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
('cms69-bmi-measurement', 'atomic', 'BMI Measurement',
 'Body mass index measurement documented',
 'LOW', 1, '1.0', 'APPROVED',
 'CLINICAL_OBSERVATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.600.1468', 'BMI LOINC Value', '20240101',
 'DURING', 'Encounter', 'during encounter',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms69-bmi-overweight', 'atomic', 'BMI >= 25 (Overweight/Obese)',
 'BMI result 25 or greater indicating overweight or obese',
 'LOW', 1, '1.0', 'APPROVED',
 'CLINICAL_OBSERVATIONS', false, 'ecqi',
 NULL, 'BMI Threshold', NULL,
 'DURING', 'Encounter', 'during encounter',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms69-bmi-underweight', 'atomic', 'BMI < 18.5 (Underweight)',
 'BMI result less than 18.5 indicating underweight',
 'LOW', 1, '1.0', 'APPROVED',
 'CLINICAL_OBSERVATIONS', false, 'ecqi',
 NULL, 'BMI Threshold', NULL,
 'DURING', 'Encounter', 'during encounter',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms69-followup-plan', 'atomic', 'Follow-Up Plan for Abnormal BMI',
 'Follow-up plan documented for abnormal BMI',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'CLINICAL_OBSERVATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.600.1.1525', 'Follow Up for Above Normal BMI', '20240101',
 'DURING', 'Encounter', 'during encounter',
 false, 'Procedure', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms69-not-done-medical', 'atomic', 'BMI Not Done: Medical Reason',
 'BMI screening not performed due to medical reason',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.600.1.1502', 'Medical Reason', '20240101',
 'DURING', 'Encounter', 'during encounter',
 true, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms69-not-done-patient', 'atomic', 'BMI Not Done: Patient Reason',
 'BMI screening not performed due to patient reason',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.600.1.1503', 'Patient Reason', '20240101',
 'DURING', 'Encounter', 'during encounter',
 true, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS122 - Diabetes HbA1c Components
-- ============================================================================
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
('cms122-diabetes-dx', 'atomic', 'Diabetes Diagnosis',
 'Patient has diagnosis of diabetes mellitus',
 'LOW', 1, '1.0', 'APPROVED',
 'CONDITIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.103.12.1001', 'Diabetes', '20240101',
 'BEFORE', 'Measurement Period', 'active before end of measurement period',
 false, 'Condition', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms122-hba1c-test', 'atomic', 'HbA1c Lab Test',
 'Hemoglobin A1c laboratory test performed (LOINC 4548-4)',
 'LOW', 1, '1.0', 'APPROVED',
 'LABORATORY', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.198.12.1013', 'HbA1c Laboratory Test', '20240101',
 'DURING', 'Measurement Period', 'during measurement period',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms122-hba1c-poor-control', 'atomic', 'HbA1c Result > 9%',
 'HbA1c result greater than 9% indicating poor glycemic control',
 'LOW', 1, '1.0', 'APPROVED',
 'LABORATORY', false, 'ecqi',
 NULL, 'HbA1c Threshold', NULL,
 'DURING', 'Measurement Period', 'most recent during measurement period',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS124 - Cervical Cancer Screening Components
-- ============================================================================
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
('cms124-pap-test', 'atomic', 'Cervical Cytology (Pap Test) within 3 Years',
 'Cervical cytology (Pap smear) performed within 3 years',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'PROCEDURES', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.108.12.1017', 'Pap Test', '20240101',
 'BEFORE', 'Measurement Period End', '3 years or less before end of measurement period',
 false, 'Procedure', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms124-hpv-test', 'atomic', 'HPV Test within 5 Years (Age 30+)',
 'Human papillomavirus (HPV) test performed within 5 years for women 30 and older',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'PROCEDURES', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.110.12.1059', 'HPV Test', '20240101',
 'BEFORE', 'Measurement Period End', '5 years or less before end of measurement period',
 false, 'Procedure', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms124-hysterectomy', 'atomic', 'Hysterectomy with No Residual Cervix',
 'History of hysterectomy with no residual cervix',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.198.12.1014', 'Hysterectomy with No Residual Cervix', '20240101',
 'BEFORE', 'Measurement Period End', 'before end of measurement period',
 false, 'Procedure', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS125 - Breast Cancer Screening Components
-- ============================================================================
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
('cms125-mammography', 'atomic', 'Mammography within 27 Months',
 'Screening mammogram performed within 27 months of end of measurement period',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'PROCEDURES', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.108.12.1018', 'Mammography', '20240101',
 'BEFORE', 'Measurement Period End', '27 months or less before end of measurement period',
 false, 'Procedure', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms125-bilateral-mastectomy', 'atomic', 'Bilateral Mastectomy',
 'History of bilateral mastectomy',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.198.12.1005', 'Bilateral Mastectomy', '20240101',
 'BEFORE', 'Measurement Period End', 'before end of measurement period',
 false, 'Procedure', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms125-unilateral-mastectomy', 'atomic', 'Unilateral Mastectomy (Both Sides)',
 'History of unilateral mastectomy of both left and right breasts',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.198.12.1020', 'Unilateral Mastectomy', '20240101',
 'BEFORE', 'Measurement Period End', 'before end of measurement period',
 false, 'Procedure', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS127 - Pneumococcal Vaccination Components
-- ============================================================================
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
('cms127-pneumo-vaccine', 'atomic', 'Pneumococcal Vaccine Administered',
 'Pneumococcal vaccine administered',
 'LOW', 1, '1.0', 'APPROVED',
 'PROCEDURES', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.110.12.1027', 'Pneumococcal Vaccine', '20240101',
 'BEFORE', 'Measurement Period End', 'before end of measurement period',
 false, 'Immunization', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms127-pneumo-history', 'atomic', 'Pneumococcal Vaccination History',
 'Documentation of pneumococcal vaccination history',
 'LOW', 1, '1.0', 'APPROVED',
 'CLINICAL_OBSERVATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.110.12.1034', 'Pneumococcal Vaccine Administered', '20240101',
 'BEFORE', 'Measurement Period End', 'before end of measurement period',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms127-immunocompromised', 'atomic', 'Immunocompromised Conditions',
 'Patient has immunocompromising conditions',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.120.12.1001', 'Immunocompromising Conditions', '20240101',
 'BEFORE', 'Measurement Period End', 'before end of measurement period',
 false, 'Condition', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS130 - Colorectal Cancer Screening Components
-- ============================================================================
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
('cms130-colonoscopy', 'atomic', 'Colonoscopy within 10 Years',
 'Colonoscopy performed within 10 years of end of measurement period',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'PROCEDURES', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.108.12.1020', 'Colonoscopy', '20240101',
 'BEFORE', 'Measurement Period End', '10 years or less before end of measurement period',
 false, 'Procedure', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms130-fobt', 'atomic', 'FIT/FOBT within 1 Year',
 'Fecal immunochemical test or fecal occult blood test within 1 year',
 'LOW', 1, '1.0', 'APPROVED',
 'PROCEDURES', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.198.12.1011', 'Fecal Occult Blood Test (FOBT)', '20240101',
 'DURING', 'Measurement Period', 'during measurement period',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms130-sigmoidoscopy', 'atomic', 'Flexible Sigmoidoscopy within 5 Years',
 'Flexible sigmoidoscopy performed within 5 years',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'PROCEDURES', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.198.12.1010', 'Flexible Sigmoidoscopy', '20240101',
 'BEFORE', 'Measurement Period End', '5 years or less before end of measurement period',
 false, 'Procedure', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms130-fitdna', 'atomic', 'FIT-DNA Test within 3 Years',
 'Stool DNA test (FIT-DNA) performed within 3 years',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'PROCEDURES', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.108.12.1039', 'FIT DNA', '20240101',
 'BEFORE', 'Measurement Period End', '3 years or less before end of measurement period',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms130-crc-diagnosis', 'atomic', 'Colorectal Cancer Diagnosis',
 'Patient has diagnosis of colorectal cancer',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.108.12.1001', 'Malignant Neoplasm of Colon', '20240101',
 'BEFORE', 'Measurement Period End', 'before end of measurement period',
 false, 'Condition', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms130-total-colectomy', 'atomic', 'Total Colectomy',
 'History of total colectomy',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.198.12.1019', 'Total Colectomy', '20240101',
 'BEFORE', 'Measurement Period End', 'before end of measurement period',
 false, 'Procedure', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS138 - Tobacco Screening Components
-- ============================================================================
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
('cms138-tobacco-screening', 'atomic', 'Tobacco Use Screening',
 'Tobacco use screening performed',
 'LOW', 1, '1.0', 'APPROVED',
 'ASSESSMENTS', false, 'ecqi',
 '2.16.840.1.113883.3.526.3.1278', 'Tobacco Use Screening', '20240101',
 'DURING', 'Measurement Period', 'during measurement period',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms138-tobacco-user', 'atomic', 'Tobacco User Finding',
 'Patient identified as tobacco user',
 'LOW', 1, '1.0', 'APPROVED',
 'CLINICAL_OBSERVATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.526.3.1170', 'Tobacco User', '20240101',
 'DURING', 'Measurement Period', 'during measurement period',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms138-tobacco-nonuser', 'atomic', 'Tobacco Non-User Finding',
 'Patient identified as tobacco non-user',
 'LOW', 1, '1.0', 'APPROVED',
 'CLINICAL_OBSERVATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.526.3.1189', 'Tobacco Non-User', '20240101',
 'DURING', 'Measurement Period', 'during measurement period',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms138-cessation-counseling', 'atomic', 'Tobacco Cessation Counseling',
 'Tobacco cessation counseling provided',
 'LOW', 1, '1.0', 'APPROVED',
 'PROCEDURES', false, 'ecqi',
 '2.16.840.1.113883.3.526.3.509', 'Tobacco Use Cessation Counseling', '20240101',
 'DURING', 'Measurement Period', 'during measurement period',
 false, 'Procedure', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms138-cessation-medication', 'atomic', 'Tobacco Cessation Medication',
 'Tobacco cessation medication prescribed',
 'LOW', 1, '1.0', 'APPROVED',
 'MEDICATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.526.3.1190', 'Tobacco Use Cessation Pharmacotherapy', '20240101',
 'DURING', 'Measurement Period', 'during measurement period',
 false, 'MedicationRequest', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms138-limited-life', 'atomic', 'Limited Life Expectancy',
 'Patient has limited life expectancy',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.526.3.1259', 'Limited Life Expectancy', '20240101',
 'DURING', 'Measurement Period', 'during measurement period',
 false, 'Condition', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms138-not-done-medical', 'atomic', 'Tobacco Screening Not Done: Medical Reason',
 'Tobacco screening not performed due to medical reason',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.526.3.1007', 'Medical Reason', '20240101',
 'DURING', 'Encounter', 'during encounter',
 true, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS165 - Blood Pressure Components
-- ============================================================================
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
('cms165-hypertension-dx', 'atomic', 'Essential Hypertension Diagnosis',
 'Patient has diagnosis of essential hypertension (ICD-10 I10)',
 'LOW', 1, '1.0', 'APPROVED',
 'CONDITIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.104.12.1011', 'Essential Hypertension', '20240101',
 'BEFORE', 'Measurement Period', 'active before end of measurement period',
 false, 'Condition', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms165-bp-measurement', 'atomic', 'Blood Pressure Measurement',
 'Blood pressure measurement documented',
 'LOW', 1, '1.0', 'APPROVED',
 'CLINICAL_OBSERVATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.526.3.1032', 'Diastolic Blood Pressure', '20240101',
 'DURING', 'Measurement Period', 'most recent during measurement period',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms165-systolic-controlled', 'atomic', 'Systolic BP < 140 mmHg',
 'Most recent systolic blood pressure less than 140 mmHg',
 'LOW', 1, '1.0', 'APPROVED',
 'CLINICAL_OBSERVATIONS', false, 'ecqi',
 NULL, 'Systolic BP Threshold', NULL,
 'DURING', 'Measurement Period', 'most recent during measurement period',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms165-diastolic-controlled', 'atomic', 'Diastolic BP < 90 mmHg',
 'Most recent diastolic blood pressure less than 90 mmHg',
 'LOW', 1, '1.0', 'APPROVED',
 'CLINICAL_OBSERVATIONS', false, 'ecqi',
 NULL, 'Diastolic BP Threshold', NULL,
 'DURING', 'Measurement Period', 'most recent during measurement period',
 false, 'Observation', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms165-esrd', 'atomic', 'ESRD Diagnosis',
 'Patient has diagnosis of end-stage renal disease',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.526.3.353', 'End Stage Renal Disease', '20240101',
 'BEFORE', 'Measurement Period End', 'before end of measurement period',
 false, 'Condition', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

('cms165-kidney-transplant', 'atomic', 'Kidney Transplant',
 'Patient has history of kidney transplant',
 'LOW', 1, '1.0', 'APPROVED',
 'EXCLUSIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.109.12.1012', 'Kidney Transplant', '20240101',
 'BEFORE', 'Measurement Period End', 'before end of measurement period',
 false, 'Procedure', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- SECTION 2: MEASURES
-- ============================================================================

-- CMS2 - Depression Screening
INSERT INTO measure (
    id, measure_id, title, version, steward, program, measure_type,
    description, rationale, clinical_recommendation,
    period_start, period_end,
    age_min, age_max,
    status,
    created_at, created_by, updated_at, updated_by
) VALUES (
    'cms2-v13', 'CMS2v13', 'Preventive Care and Screening: Screening for Depression and Follow-Up Plan',
    '13.0.000', 'Centers for Medicare & Medicaid Services', 'MIPS_CQM', 'process',
    'Percentage of patients aged 12 years and older screened for depression on the date of the encounter or up to 14 days prior to the date of the encounter using an age-appropriate standardized depression screening tool AND if positive, a follow-up plan is documented on the date of the eligible encounter.',
    'Screening for depression is key to detecting patients with undiagnosed depression and connecting them with appropriate treatment.',
    'The U.S. Preventive Services Task Force (USPSTF) recommends screening for depression in the general adult population, including pregnant and postpartum women. Screening should be implemented with adequate systems in place to ensure accurate diagnosis, effective treatment, and appropriate follow-up.',
    '2025-01-01', '2025-12-31',
    12, NULL,
    'PUBLISHED',
    CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'
);

-- CMS69 - BMI Screening
INSERT INTO measure (
    id, measure_id, title, version, steward, program, measure_type,
    description, rationale, clinical_recommendation,
    period_start, period_end,
    age_min, age_max,
    status,
    created_at, created_by, updated_at, updated_by
) VALUES (
    'cms69-v12', 'CMS69v12', 'Preventive Care and Screening: Body Mass Index (BMI) Screening and Follow-Up Plan',
    '12.0.000', 'Centers for Medicare & Medicaid Services', 'MIPS_CQM', 'process',
    'Percentage of patients aged 18 years and older with a BMI documented during the current encounter or within the previous 12 months AND who had a follow-up plan documented if most recent BMI was outside of normal parameters.',
    'Obesity is a chronic, complex multifactorial disease that increases risk for developing chronic conditions. Assessment of BMI and providing a follow-up plan supports appropriate clinical management.',
    'The U.S. Preventive Services Task Force (USPSTF) recommends that clinicians screen for obesity in adults and offer or refer patients with a body mass index (BMI) of 30 kg/m² or higher to intensive, multicomponent behavioral interventions.',
    '2025-01-01', '2025-12-31',
    18, NULL,
    'PUBLISHED',
    CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'
);

-- CMS122 - Diabetes HbA1c Poor Control
INSERT INTO measure (
    id, measure_id, title, version, steward, program, measure_type,
    description, rationale, clinical_recommendation,
    period_start, period_end,
    age_min, age_max,
    status,
    created_at, created_by, updated_at, updated_by
) VALUES (
    'cms122-v12', 'CMS122v12', 'Diabetes: Hemoglobin A1c (HbA1c) Poor Control (>9%)',
    '12.0.000', 'National Committee for Quality Assurance', 'MIPS_CQM', 'outcome',
    'Percentage of patients 18-75 years of age with diabetes who had hemoglobin A1c > 9.0% during the measurement period.',
    'Diabetes mellitus is a group of diseases characterized by high blood glucose levels caused by the body''s inability to correctly produce or use the hormone insulin. Proper glycemic control can reduce the risk of complications.',
    'The American Diabetes Association (ADA) recommends an A1C goal for many nonpregnant adults of <7% without significant hypoglycemia. More stringent A1C goals may be appropriate for individual patients if achievable without significant hypoglycemia.',
    '2025-01-01', '2025-12-31',
    18, 75,
    'PUBLISHED',
    CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'
);

-- CMS124 - Cervical Cancer Screening
INSERT INTO measure (
    id, measure_id, title, version, steward, program, measure_type,
    description, rationale, clinical_recommendation,
    period_start, period_end,
    age_min, age_max, gender,
    status,
    created_at, created_by, updated_at, updated_by
) VALUES (
    'cms124-v12', 'CMS124v12', 'Cervical Cancer Screening',
    '12.0.000', 'National Committee for Quality Assurance', 'MIPS_CQM', 'process',
    'Percentage of women 21-64 years of age who were screened for cervical cancer using either of the following criteria: Women age 21-64 who had cervical cytology performed within the last 3 years, or Women age 30-64 who had cervical cytology/human papillomavirus (HPV) co-testing within the last 5 years.',
    'Cervical cancer was once the leading cause of cancer death in women in the United States. With regular cervical cancer screening, this cancer can often be prevented entirely or detected early when treatment is more effective.',
    'The U.S. Preventive Services Task Force (USPSTF) recommends screening for cervical cancer every 3 years with cervical cytology alone in women aged 21 to 29 years.',
    '2025-01-01', '2025-12-31',
    21, 64, 'FEMALE',
    'PUBLISHED',
    CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'
);

-- CMS125 - Breast Cancer Screening
INSERT INTO measure (
    id, measure_id, title, version, steward, program, measure_type,
    description, rationale, clinical_recommendation,
    period_start, period_end,
    age_min, age_max, gender,
    status,
    created_at, created_by, updated_at, updated_by
) VALUES (
    'cms125-v12', 'CMS125v12', 'Breast Cancer Screening',
    '12.0.000', 'National Committee for Quality Assurance', 'MIPS_CQM', 'process',
    'Percentage of women 50-74 years of age who had a mammogram to screen for breast cancer in the 27 months prior to the end of the measurement period.',
    'Breast cancer is the most commonly diagnosed cancer in women and the second leading cause of cancer death among women in the United States. Screening mammograms can detect breast cancer early, when treatment is most effective.',
    'The U.S. Preventive Services Task Force (USPSTF) recommends biennial screening mammography for women aged 50 to 74 years.',
    '2025-01-01', '2025-12-31',
    52, 74, 'FEMALE',
    'PUBLISHED',
    CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'
);

-- CMS127 - Pneumococcal Vaccination
INSERT INTO measure (
    id, measure_id, title, version, steward, program, measure_type,
    description, rationale, clinical_recommendation,
    period_start, period_end,
    age_min, age_max,
    status,
    created_at, created_by, updated_at, updated_by
) VALUES (
    'cms127-v12', 'CMS127v12', 'Pneumococcal Vaccination Status for Older Adults',
    '12.0.000', 'National Committee for Quality Assurance', 'MIPS_CQM', 'process',
    'Percentage of patients 65 years of age and older who have ever received a pneumococcal vaccine.',
    'Pneumococcal disease is a leading cause of vaccine-preventable death in the United States among older adults. Pneumococcal vaccination can prevent pneumococcal disease and its complications.',
    'The Centers for Disease Control and Prevention (CDC) recommends pneumococcal vaccination for all adults 65 years or older.',
    '2025-01-01', '2025-12-31',
    65, NULL,
    'PUBLISHED',
    CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'
);

-- CMS130 - Colorectal Cancer Screening
INSERT INTO measure (
    id, measure_id, title, version, steward, program, measure_type,
    description, rationale, clinical_recommendation,
    period_start, period_end,
    age_min, age_max,
    status,
    created_at, created_by, updated_at, updated_by
) VALUES (
    'cms130-v12', 'CMS130v12', 'Colorectal Cancer Screening',
    '12.0.000', 'National Committee for Quality Assurance', 'MIPS_CQM', 'process',
    'Percentage of adults 45-75 years of age who had appropriate screening for colorectal cancer.',
    'Colorectal cancer is the second leading cause of cancer deaths in the United States. Regular screening can detect colorectal cancer early, when treatment is most effective, and can prevent colorectal cancer by finding and removing precancerous polyps.',
    'The U.S. Preventive Services Task Force (USPSTF) recommends screening for colorectal cancer starting at age 45 years and continuing until age 75 years.',
    '2025-01-01', '2025-12-31',
    45, 75,
    'PUBLISHED',
    CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'
);

-- CMS138 - Tobacco Screening
INSERT INTO measure (
    id, measure_id, title, version, steward, program, measure_type,
    description, rationale, clinical_recommendation,
    period_start, period_end,
    age_min, age_max,
    status,
    created_at, created_by, updated_at, updated_by
) VALUES (
    'cms138-v12', 'CMS138v12', 'Preventive Care and Screening: Tobacco Use: Screening and Cessation Intervention',
    '12.0.000', 'American Medical Association', 'MIPS_CQM', 'process',
    'Percentage of patients aged 18 years and older who were screened for tobacco use one or more times within the measurement period AND who received tobacco cessation intervention if identified as a tobacco user.',
    'Tobacco use is the leading cause of preventable death in the United States. Cessation counseling and pharmacotherapy can significantly increase quit rates among tobacco users.',
    'The U.S. Preventive Services Task Force (USPSTF) recommends that clinicians ask all adults about tobacco use, advise them to stop using tobacco, and provide behavioral interventions and U.S. Food and Drug Administration (FDA)–approved pharmacotherapy for cessation to adults who use tobacco.',
    '2025-01-01', '2025-12-31',
    18, NULL,
    'PUBLISHED',
    CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'
);

-- CMS165 - Blood Pressure Control
INSERT INTO measure (
    id, measure_id, title, version, steward, program, measure_type,
    description, rationale, clinical_recommendation,
    period_start, period_end,
    age_min, age_max,
    status,
    created_at, created_by, updated_at, updated_by
) VALUES (
    'cms165-v12', 'CMS165v12', 'Controlling High Blood Pressure',
    '12.0.000', 'National Committee for Quality Assurance', 'MIPS_CQM', 'outcome',
    'Percentage of patients 18-85 years of age who had a diagnosis of essential hypertension starting before and continuing into, or starting during the first six months of the measurement period, and whose most recent blood pressure was adequately controlled (<140/90mmHg) during the measurement period.',
    'High blood pressure is a leading risk factor for heart disease, stroke, kidney disease, and other serious health conditions. Controlling blood pressure can significantly reduce the risk of these complications.',
    'The American Heart Association (AHA) recommends a blood pressure goal of <130/80 mm Hg for most adults with hypertension. The Eighth Joint National Committee (JNC 8) recommends a goal of <140/90 mm Hg for adults younger than 60 years and those 60 years or older with diabetes or chronic kidney disease.',
    '2025-01-01', '2025-12-31',
    18, 85,
    'PUBLISHED',
    CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'
);

-- ============================================================================
-- SECTION 3: LOGICAL CLAUSES AND POPULATIONS
-- Building the population logic trees for each measure
-- ============================================================================

-- CMS2 Population Logic
-- Initial Population root clause
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms2-ip-root', 'AND', 'Initial Population: Age >= 12 AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms2-ip', 'cms2-v13', 'INITIAL_POPULATION', 'Patients aged 12 and older with a qualifying encounter', 'Patients aged 12 years and older with at least one eligible encounter during the measurement period.', 'cms2-ip-root', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Denominator
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms2-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms2-den', 'cms2-v13', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms2-den-root', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Denominator Exclusion
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms2-denex-root', 'OR', 'Denominator Exclusion: Bipolar diagnosis', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms2-denex', 'cms2-v13', 'DENOMINATOR_EXCLUSION', 'Patients with bipolar disorder diagnosis', 'Patients with a diagnosis of bipolar disorder active before or during the encounter.', 'cms2-denex-root', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Numerator
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms2-num-root', 'OR', 'Numerator: Negative screening OR (Positive screening AND follow-up)', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms2-num', 'cms2-v13', 'NUMERATOR', 'Depression screening performed with appropriate follow-up', 'Patients screened for depression who had either a negative result or a positive result with documented follow-up plan.', 'cms2-num-root', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Denominator Exception
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms2-denexcep-root', 'OR', 'Denominator Exception: Medical or patient reason for not screening', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms2-denexcep', 'cms2-v13', 'DENOMINATOR_EXCEPTION', 'Depression screening not performed for valid reason', 'Patients who did not receive depression screening for medical or patient reasons.', 'cms2-denexcep-root', 4, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS69 Population Logic
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms69-ip-root', 'AND', 'Initial Population: Age >= 18 AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms69-ip', 'cms69-v12', 'INITIAL_POPULATION', 'Patients aged 18 and older with a qualifying encounter', 'Patients aged 18 years and older with at least one eligible encounter during the measurement period.', 'cms69-ip-root', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms69-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms69-den', 'cms69-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms69-den-root', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms69-denex-root', 'OR', 'Denominator Exclusion: Pregnancy or Palliative Care', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms69-denex', 'cms69-v12', 'DENOMINATOR_EXCLUSION', 'Pregnancy or palliative care', 'Patients with pregnancy or receiving palliative care.', 'cms69-denex-root', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms69-num-root', 'AND', 'Numerator: BMI documented with follow-up if abnormal', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms69-num', 'cms69-v12', 'NUMERATOR', 'BMI documented with appropriate follow-up', 'Patients with BMI documented and follow-up plan if BMI is abnormal.', 'cms69-num-root', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms69-denexcep-root', 'OR', 'Denominator Exception: Medical or patient reason', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms69-denexcep', 'cms69-v12', 'DENOMINATOR_EXCEPTION', 'BMI not performed for valid reason', 'Patients who did not receive BMI screening for medical or patient reasons.', 'cms69-denexcep-root', 4, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS122 Population Logic
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms122-ip-root', 'AND', 'Initial Population: Age 18-75 AND Diabetes AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms122-ip', 'cms122-v12', 'INITIAL_POPULATION', 'Patients 18-75 with diabetes and qualifying encounter', 'Patients aged 18-75 years with diabetes and at least one eligible encounter during the measurement period.', 'cms122-ip-root', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms122-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms122-den', 'cms122-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms122-den-root', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms122-denex-root', 'OR', 'Denominator Exclusion: Hospice, Palliative, or Advanced Illness', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms122-denex', 'cms122-v12', 'DENOMINATOR_EXCLUSION', 'Hospice, palliative care, or advanced illness', 'Patients receiving hospice care, palliative care, or with advanced illness.', 'cms122-denex-root', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms122-num-root', 'OR', 'Numerator: HbA1c > 9% or no HbA1c test (inverse measure)', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms122-num', 'cms122-v12', 'NUMERATOR', 'HbA1c poor control (>9%) or no test', 'Patients with HbA1c > 9% or no HbA1c test during measurement period (inverse measure - lower rate is better).', 'cms122-num-root', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS124 Population Logic
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms124-ip-root', 'AND', 'Initial Population: Female AND Age 21-64 AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms124-ip', 'cms124-v12', 'INITIAL_POPULATION', 'Female patients 21-64 with qualifying encounter', 'Female patients aged 21-64 years with at least one eligible encounter during the measurement period.', 'cms124-ip-root', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms124-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms124-den', 'cms124-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms124-den-root', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms124-denex-root', 'OR', 'Denominator Exclusion: Hysterectomy, Hospice, or Palliative', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms124-denex', 'cms124-v12', 'DENOMINATOR_EXCLUSION', 'Hysterectomy, hospice, or palliative care', 'Patients with hysterectomy with no residual cervix, or receiving hospice or palliative care.', 'cms124-denex-root', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms124-num-root', 'OR', 'Numerator: Pap test within 3 years OR HPV test within 5 years (age 30+)', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms124-num', 'cms124-v12', 'NUMERATOR', 'Appropriate cervical cancer screening', 'Patients with cervical cytology within 3 years or HPV test within 5 years (age 30+).', 'cms124-num-root', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS125 Population Logic
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms125-ip-root', 'AND', 'Initial Population: Female AND Age 52-74 AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms125-ip', 'cms125-v12', 'INITIAL_POPULATION', 'Female patients 52-74 with qualifying encounter', 'Female patients aged 52-74 years with at least one eligible encounter during the measurement period.', 'cms125-ip-root', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms125-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms125-den', 'cms125-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms125-den-root', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms125-denex-root', 'OR', 'Denominator Exclusion: Mastectomy, Hospice, Palliative, or Advanced Illness', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms125-denex', 'cms125-v12', 'DENOMINATOR_EXCLUSION', 'Mastectomy or exclusion criteria', 'Patients with bilateral mastectomy, or receiving hospice, palliative care, or with advanced illness.', 'cms125-denex-root', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms125-num-root', 'OR', 'Numerator: Mammography within 27 months', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms125-num', 'cms125-v12', 'NUMERATOR', 'Mammogram within 27 months', 'Patients with screening mammogram within 27 months prior to end of measurement period.', 'cms125-num-root', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS127 Population Logic
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms127-ip-root', 'AND', 'Initial Population: Age >= 65 AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms127-ip', 'cms127-v12', 'INITIAL_POPULATION', 'Patients 65 and older with qualifying encounter', 'Patients aged 65 years and older with at least one eligible encounter during the measurement period.', 'cms127-ip-root', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms127-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms127-den', 'cms127-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms127-den-root', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms127-denex-root', 'OR', 'Denominator Exclusion: Hospice or Immunocompromised', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms127-denex', 'cms127-v12', 'DENOMINATOR_EXCLUSION', 'Hospice or immunocompromised', 'Patients receiving hospice care or with immunocompromising conditions.', 'cms127-denex-root', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms127-num-root', 'OR', 'Numerator: Pneumococcal vaccine administered or history', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms127-num', 'cms127-v12', 'NUMERATOR', 'Pneumococcal vaccination received', 'Patients who received pneumococcal vaccine or have documented vaccination history.', 'cms127-num-root', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS130 Population Logic
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms130-ip-root', 'AND', 'Initial Population: Age 45-75 AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms130-ip', 'cms130-v12', 'INITIAL_POPULATION', 'Patients 45-75 with qualifying encounter', 'Patients aged 45-75 years with at least one eligible encounter during the measurement period.', 'cms130-ip-root', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms130-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms130-den', 'cms130-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms130-den-root', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms130-denex-root', 'OR', 'Denominator Exclusion: CRC diagnosis, Colectomy, Hospice, or Palliative', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms130-denex', 'cms130-v12', 'DENOMINATOR_EXCLUSION', 'CRC diagnosis, colectomy, or exclusion criteria', 'Patients with colorectal cancer diagnosis, total colectomy, or receiving hospice or palliative care.', 'cms130-denex-root', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms130-num-root', 'OR', 'Numerator: Colonoscopy, FOBT, Sigmoidoscopy, or FIT-DNA', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms130-num', 'cms130-v12', 'NUMERATOR', 'Appropriate colorectal cancer screening', 'Patients with colonoscopy within 10 years, FOBT within 1 year, sigmoidoscopy within 5 years, or FIT-DNA within 3 years.', 'cms130-num-root', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS138 Population Logic
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms138-ip-root', 'AND', 'Initial Population: Age >= 18 AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms138-ip', 'cms138-v12', 'INITIAL_POPULATION', 'Patients 18 and older with qualifying encounter', 'Patients aged 18 years and older with at least one eligible encounter during the measurement period.', 'cms138-ip-root', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms138-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms138-den', 'cms138-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms138-den-root', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms138-denexcep-root', 'OR', 'Denominator Exception: Medical reason or limited life expectancy', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms138-denexcep', 'cms138-v12', 'DENOMINATOR_EXCEPTION', 'Medical reason or limited life expectancy', 'Patients who did not receive tobacco screening for medical reasons or have limited life expectancy.', 'cms138-denexcep-root', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms138-num-root', 'AND', 'Numerator: Tobacco screening AND (if user, cessation intervention)', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms138-num', 'cms138-v12', 'NUMERATOR', 'Tobacco screening with intervention if user', 'Patients screened for tobacco use and, if identified as tobacco user, received cessation intervention.', 'cms138-num-root', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS165 Population Logic
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms165-ip-root', 'AND', 'Initial Population: Age 18-85 AND Hypertension AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms165-ip', 'cms165-v12', 'INITIAL_POPULATION', 'Patients 18-85 with hypertension and qualifying encounter', 'Patients aged 18-85 years with essential hypertension and at least one eligible encounter during the measurement period.', 'cms165-ip-root', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms165-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms165-den', 'cms165-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms165-den-root', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms165-denex-root', 'OR', 'Denominator Exclusion: Pregnancy, ESRD, Transplant, Hospice, or Palliative', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms165-denex', 'cms165-v12', 'DENOMINATOR_EXCLUSION', 'Pregnancy, ESRD, transplant, or exclusion criteria', 'Patients with pregnancy, ESRD, kidney transplant, or receiving hospice or palliative care.', 'cms165-denex-root', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms165-num-root', 'AND', 'Numerator: Systolic < 140 AND Diastolic < 90 on most recent reading', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms165-num', 'cms165-v12', 'NUMERATOR', 'Blood pressure adequately controlled', 'Patients with most recent blood pressure reading <140/90 mmHg.', 'cms165-num-root', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- SECTION 4: DATA ELEMENTS (Link clauses to library components)
-- ============================================================================

-- CMS2 Data Elements
INSERT INTO data_element (id, clause_id, element_type, description, library_component_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms2-ip-age', 'cms2-ip-root', 'DEMOGRAPHIC', 'Patient age 12 or older', 'age-12-plus', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-ip-enc', 'cms2-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 'enc-office-visit', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-denex-bipolar', 'cms2-denex-root', 'DIAGNOSIS', 'Bipolar disorder diagnosis', 'cms2-bipolar-diagnosis', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-num-neg', 'cms2-num-root', 'OBSERVATION', 'Negative depression screening', 'cms2-negative-depression-finding', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-num-pos', 'cms2-num-root', 'OBSERVATION', 'Positive depression screening with follow-up', 'cms2-positive-depression-finding', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-denexcep-medical', 'cms2-denexcep-root', 'OBSERVATION', 'Screening not done - medical reason', 'cms2-not-done-medical', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-denexcep-patient', 'cms2-denexcep-root', 'OBSERVATION', 'Screening not done - patient reason', 'cms2-not-done-patient', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS69 Data Elements
INSERT INTO data_element (id, clause_id, element_type, description, library_component_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms69-ip-age', 'cms69-ip-root', 'DEMOGRAPHIC', 'Patient age 18 or older', 'age-18-plus', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-ip-enc', 'cms69-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 'enc-office-visit', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-denex-preg', 'cms69-denex-root', 'DIAGNOSIS', 'Pregnancy diagnosis', 'excl-pregnancy', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-denex-pall', 'cms69-denex-root', 'ENCOUNTER', 'Palliative care', 'excl-palliative', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-num-bmi', 'cms69-num-root', 'OBSERVATION', 'BMI measurement documented', 'cms69-bmi-measurement', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-num-followup', 'cms69-num-root', 'PROCEDURE', 'Follow-up plan for abnormal BMI', 'cms69-followup-plan', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-denexcep-medical', 'cms69-denexcep-root', 'OBSERVATION', 'BMI not done - medical reason', 'cms69-not-done-medical', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-denexcep-patient', 'cms69-denexcep-root', 'OBSERVATION', 'BMI not done - patient reason', 'cms69-not-done-patient', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS122 Data Elements
INSERT INTO data_element (id, clause_id, element_type, description, library_component_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms122-ip-age', 'cms122-ip-root', 'DEMOGRAPHIC', 'Patient age 18-75', 'age-18-75', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-ip-dm', 'cms122-ip-root', 'DIAGNOSIS', 'Diabetes diagnosis', 'cms122-diabetes-dx', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-ip-enc', 'cms122-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 'enc-office-visit', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-denex-hospice', 'cms122-denex-root', 'ENCOUNTER', 'Hospice care', 'excl-hospice', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-denex-pall', 'cms122-denex-root', 'ENCOUNTER', 'Palliative care', 'excl-palliative', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-denex-adv', 'cms122-denex-root', 'DIAGNOSIS', 'Advanced illness', 'excl-advanced-illness', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-num-hba1c', 'cms122-num-root', 'OBSERVATION', 'HbA1c > 9% or no test', 'cms122-hba1c-poor-control', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS124 Data Elements
INSERT INTO data_element (id, clause_id, element_type, description, library_component_id, gender_value, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms124-ip-sex', 'cms124-ip-root', 'DEMOGRAPHIC', 'Patient sex: Female', 'patient-sex-female', 'FEMALE', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-ip-age', 'cms124-ip-root', 'DEMOGRAPHIC', 'Patient age 21-64', 'age-21-64', NULL, 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-ip-enc', 'cms124-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 'enc-office-visit', NULL, 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-denex-hyst', 'cms124-denex-root', 'PROCEDURE', 'Hysterectomy with no residual cervix', 'cms124-hysterectomy', NULL, 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-denex-hospice', 'cms124-denex-root', 'ENCOUNTER', 'Hospice care', 'excl-hospice', NULL, 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-denex-pall', 'cms124-denex-root', 'ENCOUNTER', 'Palliative care', 'excl-palliative', NULL, 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-num-pap', 'cms124-num-root', 'PROCEDURE', 'Pap test within 3 years', 'cms124-pap-test', NULL, 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-num-hpv', 'cms124-num-root', 'PROCEDURE', 'HPV test within 5 years (age 30+)', 'cms124-hpv-test', NULL, 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS125 Data Elements
INSERT INTO data_element (id, clause_id, element_type, description, library_component_id, gender_value, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms125-ip-sex', 'cms125-ip-root', 'DEMOGRAPHIC', 'Patient sex: Female', 'patient-sex-female', 'FEMALE', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-ip-age', 'cms125-ip-root', 'DEMOGRAPHIC', 'Patient age 52-74', 'age-52-74', NULL, 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-ip-enc', 'cms125-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 'enc-office-visit', NULL, 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-denex-bilat', 'cms125-denex-root', 'PROCEDURE', 'Bilateral mastectomy', 'cms125-bilateral-mastectomy', NULL, 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-denex-unilat', 'cms125-denex-root', 'PROCEDURE', 'Unilateral mastectomy (both sides)', 'cms125-unilateral-mastectomy', NULL, 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-denex-hospice', 'cms125-denex-root', 'ENCOUNTER', 'Hospice care', 'excl-hospice', NULL, 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-denex-pall', 'cms125-denex-root', 'ENCOUNTER', 'Palliative care', 'excl-palliative', NULL, 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-denex-adv', 'cms125-denex-root', 'DIAGNOSIS', 'Advanced illness', 'excl-advanced-illness', NULL, 4, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-num-mammo', 'cms125-num-root', 'PROCEDURE', 'Mammography within 27 months', 'cms125-mammography', NULL, 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS127 Data Elements
INSERT INTO data_element (id, clause_id, element_type, description, library_component_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms127-ip-age', 'cms127-ip-root', 'DEMOGRAPHIC', 'Patient age 65 or older', 'age-65-plus', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-ip-enc', 'cms127-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 'enc-office-visit', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-denex-hospice', 'cms127-denex-root', 'ENCOUNTER', 'Hospice care', 'excl-hospice', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-denex-immuno', 'cms127-denex-root', 'DIAGNOSIS', 'Immunocompromised conditions', 'cms127-immunocompromised', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-num-vaccine', 'cms127-num-root', 'IMMUNIZATION', 'Pneumococcal vaccine administered', 'cms127-pneumo-vaccine', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-num-history', 'cms127-num-root', 'OBSERVATION', 'Pneumococcal vaccination history', 'cms127-pneumo-history', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS130 Data Elements
INSERT INTO data_element (id, clause_id, element_type, description, library_component_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms130-ip-age', 'cms130-ip-root', 'DEMOGRAPHIC', 'Patient age 45-75', 'age-45-75', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-ip-enc', 'cms130-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 'enc-office-visit', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-denex-crc', 'cms130-denex-root', 'DIAGNOSIS', 'Colorectal cancer diagnosis', 'cms130-crc-diagnosis', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-denex-colect', 'cms130-denex-root', 'PROCEDURE', 'Total colectomy', 'cms130-total-colectomy', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-denex-hospice', 'cms130-denex-root', 'ENCOUNTER', 'Hospice care', 'excl-hospice', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-denex-pall', 'cms130-denex-root', 'ENCOUNTER', 'Palliative care', 'excl-palliative', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-num-colon', 'cms130-num-root', 'PROCEDURE', 'Colonoscopy within 10 years', 'cms130-colonoscopy', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-num-fobt', 'cms130-num-root', 'OBSERVATION', 'FIT/FOBT within 1 year', 'cms130-fobt', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-num-sig', 'cms130-num-root', 'PROCEDURE', 'Flexible sigmoidoscopy within 5 years', 'cms130-sigmoidoscopy', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-num-fitdna', 'cms130-num-root', 'OBSERVATION', 'FIT-DNA within 3 years', 'cms130-fitdna', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS138 Data Elements
INSERT INTO data_element (id, clause_id, element_type, description, library_component_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms138-ip-age', 'cms138-ip-root', 'DEMOGRAPHIC', 'Patient age 18 or older', 'age-18-plus', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-ip-enc', 'cms138-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 'enc-office-visit', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-denexcep-medical', 'cms138-denexcep-root', 'OBSERVATION', 'Tobacco screening not done - medical reason', 'cms138-not-done-medical', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-denexcep-life', 'cms138-denexcep-root', 'DIAGNOSIS', 'Limited life expectancy', 'cms138-limited-life', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-num-screen', 'cms138-num-root', 'OBSERVATION', 'Tobacco use screening', 'cms138-tobacco-screening', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-num-counsel', 'cms138-num-root', 'PROCEDURE', 'Tobacco cessation counseling', 'cms138-cessation-counseling', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-num-med', 'cms138-num-root', 'MEDICATION', 'Tobacco cessation medication', 'cms138-cessation-medication', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- CMS165 Data Elements
INSERT INTO data_element (id, clause_id, element_type, description, library_component_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms165-ip-age', 'cms165-ip-root', 'DEMOGRAPHIC', 'Patient age 18-85', 'age-18-85', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-ip-htn', 'cms165-ip-root', 'DIAGNOSIS', 'Essential hypertension diagnosis', 'cms165-hypertension-dx', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-ip-enc', 'cms165-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 'enc-office-visit', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-denex-preg', 'cms165-denex-root', 'DIAGNOSIS', 'Pregnancy', 'excl-pregnancy', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-denex-esrd', 'cms165-denex-root', 'DIAGNOSIS', 'ESRD diagnosis', 'cms165-esrd', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-denex-transplant', 'cms165-denex-root', 'PROCEDURE', 'Kidney transplant', 'cms165-kidney-transplant', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-denex-hospice', 'cms165-denex-root', 'ENCOUNTER', 'Hospice care', 'excl-hospice', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-denex-pall', 'cms165-denex-root', 'ENCOUNTER', 'Palliative care', 'excl-palliative', 4, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-num-sys', 'cms165-num-root', 'OBSERVATION', 'Systolic BP < 140', 'cms165-systolic-controlled', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-num-dia', 'cms165-num-root', 'OBSERVATION', 'Diastolic BP < 90', 'cms165-diastolic-controlled', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- SECTION 5: VALUE SETS (Representative codes for key value sets)
-- ============================================================================

-- Office Visit Value Set (shared across all measures)
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
SELECT 'vs-office-visit-' || m.id, m.id, '2.16.840.1.113883.3.464.1003.101.12.1001', 'Office Visit', '20240101', 'NCQA', true
FROM measure m WHERE m.id IN ('cms2-v13', 'cms69-v12', 'cms122-v12', 'cms124-v12', 'cms125-v12', 'cms127-v12', 'cms130-v12', 'cms138-v12', 'cms165-v12');

-- Representative codes for Office Visit
INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
SELECT
    'code-ov-' || m.id || '-' || c.code,
    'vs-office-visit-' || m.id,
    c.code,
    c.code_system,
    'http://www.ama-assn.org/go/cpt',
    c.display,
    '2024'
FROM measure m
CROSS JOIN (
    SELECT '99201' AS code, 'CPT' AS code_system, 'Office visit, new patient, minimal' AS display
    UNION ALL SELECT '99202', 'CPT', 'Office visit, new patient, low complexity'
    UNION ALL SELECT '99203', 'CPT', 'Office visit, new patient, moderate complexity'
    UNION ALL SELECT '99211', 'CPT', 'Office visit, established patient, minimal'
    UNION ALL SELECT '99212', 'CPT', 'Office visit, established patient, low complexity'
    UNION ALL SELECT '99213', 'CPT', 'Office visit, established patient, moderate complexity'
    UNION ALL SELECT '99214', 'CPT', 'Office visit, established patient, high complexity'
    UNION ALL SELECT '99215', 'CPT', 'Office visit, established patient, comprehensive'
) c
WHERE m.id = 'cms130-v12';  -- Just create codes for one measure as reference

-- Hospice Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
SELECT 'vs-hospice-' || m.id, m.id, '2.16.840.1.113883.3.526.3.1584', 'Hospice Care Ambulatory', '20240101', 'AMA-PCPI', true
FROM measure m WHERE m.id IN ('cms122-v12', 'cms124-v12', 'cms125-v12', 'cms127-v12', 'cms130-v12', 'cms165-v12');

-- Diabetes Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-diabetes-cms122', 'cms122-v12', '2.16.840.1.113883.3.464.1003.103.12.1001', 'Diabetes', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-dm-e11', 'vs-diabetes-cms122', 'E11', 'ICD10', 'http://hl7.org/fhir/sid/icd-10-cm', 'Type 2 diabetes mellitus', '2024'),
('code-dm-e119', 'vs-diabetes-cms122', 'E11.9', 'ICD10', 'http://hl7.org/fhir/sid/icd-10-cm', 'Type 2 diabetes mellitus without complications', '2024'),
('code-dm-e10', 'vs-diabetes-cms122', 'E10', 'ICD10', 'http://hl7.org/fhir/sid/icd-10-cm', 'Type 1 diabetes mellitus', '2024');

-- HbA1c Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-hba1c-cms122', 'cms122-v12', '2.16.840.1.113883.3.464.1003.198.12.1013', 'HbA1c Laboratory Test', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-hba1c-4548', 'vs-hba1c-cms122', '4548-4', 'LOINC', 'http://loinc.org', 'Hemoglobin A1c/Hemoglobin.total in Blood', '2024'),
('code-hba1c-17856', 'vs-hba1c-cms122', '17856-6', 'LOINC', 'http://loinc.org', 'Hemoglobin A1c/Hemoglobin.total in Blood by HPLC', '2024');

-- Mammography Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-mammo-cms125', 'cms125-v12', '2.16.840.1.113883.3.464.1003.108.12.1018', 'Mammography', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-mammo-77067', 'vs-mammo-cms125', '77067', 'CPT', 'http://www.ama-assn.org/go/cpt', 'Screening mammography, bilateral', '2024'),
('code-mammo-77066', 'vs-mammo-cms125', '77066', 'CPT', 'http://www.ama-assn.org/go/cpt', 'Diagnostic mammography, bilateral', '2024');

-- Colonoscopy Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-colon-cms130', 'cms130-v12', '2.16.840.1.113883.3.464.1003.108.12.1020', 'Colonoscopy', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-colon-45378', 'vs-colon-cms130', '45378', 'CPT', 'http://www.ama-assn.org/go/cpt', 'Colonoscopy, flexible, diagnostic', '2024'),
('code-colon-45380', 'vs-colon-cms130', '45380', 'CPT', 'http://www.ama-assn.org/go/cpt', 'Colonoscopy with biopsy', '2024');

-- Essential Hypertension Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-htn-cms165', 'cms165-v12', '2.16.840.1.113883.3.464.1003.104.12.1011', 'Essential Hypertension', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-htn-i10', 'vs-htn-cms165', 'I10', 'ICD10', 'http://hl7.org/fhir/sid/icd-10-cm', 'Essential (primary) hypertension', '2024');
