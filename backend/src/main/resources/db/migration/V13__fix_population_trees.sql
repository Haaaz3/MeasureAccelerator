-- V13: Fix population trees for all 9 measures
-- This migration ensures all measures have complete population structures
-- with logical clauses and data elements.

-- ============================================================================
-- CLEANUP: Remove any orphaned data to ensure clean state
-- ============================================================================

-- Delete existing data elements (will be recreated)
DELETE FROM data_element WHERE clause_id LIKE 'cms%-%-root';

-- Delete existing populations (will be recreated)
DELETE FROM population WHERE measure_id IN (
    'cms2-v13', 'cms69-v12', 'cms122-v12', 'cms124-v12', 'cms125-v12',
    'cms127-v12', 'cms130-v12', 'cms138-v12', 'cms165-v12'
);

-- Delete existing logical clauses (will be recreated)
DELETE FROM logical_clause WHERE id LIKE 'cms%-%-root';

-- ============================================================================
-- CMS2: Screening for Depression and Follow-Up Plan
-- ============================================================================

-- Logical Clauses
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms2-ip-root', 'AND', 'Initial Population: Age >= 12 AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-denex-root', 'OR', 'Denominator Exclusion: Bipolar diagnosis', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-num-root', 'OR', 'Numerator: Negative screening OR Positive with follow-up', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-denexcep-root', 'OR', 'Denominator Exception: Medical or patient reason', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Populations
INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms2-ip', 'cms2-v13', 'INITIAL_POPULATION', 'Patients aged 12 and older with a qualifying encounter', 'Patients aged 12 years and older with at least one eligible encounter during the measurement period.', 'cms2-ip-root', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-den', 'cms2-v13', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms2-den-root', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-denex', 'cms2-v13', 'DENOMINATOR_EXCLUSION', 'Patients with bipolar disorder diagnosis', 'Patients with a diagnosis of bipolar disorder active before or during the encounter.', 'cms2-denex-root', 2, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-num', 'cms2-v13', 'NUMERATOR', 'Depression screening performed with appropriate follow-up', 'Patients screened for depression who had either a negative result or a positive result with documented follow-up plan.', 'cms2-num-root', 3, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-denexcep', 'cms2-v13', 'DENOMINATOR_EXCEPTION', 'Depression screening not performed for valid reason', 'Patients who did not receive depression screening for medical or patient reasons.', 'cms2-denexcep-root', 4, 'MEDIUM', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Data Elements (without library_component_id to avoid FK issues)
INSERT INTO data_element (id, clause_id, element_type, description, age_min, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES ('cms2-ip-age', 'cms2-ip-root', 'DEMOGRAPHIC', 'Patient age 12 or older', 12, 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms2-ip-enc', 'cms2-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-denex-bipolar', 'cms2-denex-root', 'DIAGNOSIS', 'Bipolar disorder diagnosis', 0, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-num-neg', 'cms2-num-root', 'OBSERVATION', 'Negative depression screening', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-num-pos', 'cms2-num-root', 'OBSERVATION', 'Positive depression screening with follow-up', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-denexcep-medical', 'cms2-denexcep-root', 'OBSERVATION', 'Screening not done - medical reason', 0, 'MEDIUM', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms2-denexcep-patient', 'cms2-denexcep-root', 'OBSERVATION', 'Screening not done - patient reason', 1, 'MEDIUM', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS69: Preventive Care and Screening: Body Mass Index (BMI)
-- ============================================================================

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms69-ip-root', 'AND', 'Initial Population: Age >= 18 AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-denex-root', 'OR', 'Denominator Exclusion: Pregnancy or Palliative Care', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-num-root', 'AND', 'Numerator: BMI documented with follow-up if abnormal', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-denexcep-root', 'OR', 'Denominator Exception: Medical or patient reason', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms69-ip', 'cms69-v12', 'INITIAL_POPULATION', 'Patients aged 18 and older with a qualifying encounter', 'Patients aged 18 years and older with at least one eligible encounter during the measurement period.', 'cms69-ip-root', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-den', 'cms69-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms69-den-root', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-denex', 'cms69-v12', 'DENOMINATOR_EXCLUSION', 'Pregnancy or palliative care', 'Patients with pregnancy or receiving palliative care.', 'cms69-denex-root', 2, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-num', 'cms69-v12', 'NUMERATOR', 'BMI documented with appropriate follow-up', 'Patients with BMI documented and follow-up plan if BMI is abnormal.', 'cms69-num-root', 3, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-denexcep', 'cms69-v12', 'DENOMINATOR_EXCEPTION', 'BMI not performed for valid reason', 'Patients who did not receive BMI screening for medical or patient reasons.', 'cms69-denexcep-root', 4, 'MEDIUM', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, age_min, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES ('cms69-ip-age', 'cms69-ip-root', 'DEMOGRAPHIC', 'Patient age 18 or older', 18, 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms69-ip-enc', 'cms69-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-denex-preg', 'cms69-denex-root', 'DIAGNOSIS', 'Pregnancy diagnosis', 0, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-denex-pall', 'cms69-denex-root', 'ENCOUNTER', 'Palliative care', 1, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-num-bmi', 'cms69-num-root', 'OBSERVATION', 'BMI measurement documented', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-num-followup', 'cms69-num-root', 'PROCEDURE', 'Follow-up plan for abnormal BMI', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-denexcep-medical', 'cms69-denexcep-root', 'OBSERVATION', 'BMI not done - medical reason', 0, 'MEDIUM', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms69-denexcep-patient', 'cms69-denexcep-root', 'OBSERVATION', 'BMI not done - patient reason', 1, 'MEDIUM', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS122: Diabetes: Hemoglobin A1c Poor Control
-- ============================================================================

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms122-ip-root', 'AND', 'Initial Population: Age 18-75 AND Diabetes AND Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-denex-root', 'OR', 'Denominator Exclusion: Hospice, Palliative, Advanced Illness', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-num-root', 'OR', 'Numerator: HbA1c > 9% or no test', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms122-ip', 'cms122-v12', 'INITIAL_POPULATION', 'Patients 18-75 with diabetes and qualifying encounter', 'Patients aged 18-75 years with diabetes and at least one eligible encounter during the measurement period.', 'cms122-ip-root', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-den', 'cms122-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms122-den-root', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-denex', 'cms122-v12', 'DENOMINATOR_EXCLUSION', 'Hospice, palliative care, or advanced illness', 'Patients receiving hospice care, palliative care, or with advanced illness and frailty.', 'cms122-denex-root', 2, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-num', 'cms122-v12', 'NUMERATOR', 'HbA1c poor control (>9%) or no test', 'Patients whose most recent HbA1c level is >9% or was not tested during the measurement period (inverse measure).', 'cms122-num-root', 3, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, age_min, age_max, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES ('cms122-ip-age', 'cms122-ip-root', 'DEMOGRAPHIC', 'Patient age 18-75', 18, 75, 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms122-ip-dm', 'cms122-ip-root', 'DIAGNOSIS', 'Diabetes diagnosis', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-ip-enc', 'cms122-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 2, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-denex-hospice', 'cms122-denex-root', 'ENCOUNTER', 'Hospice care', 0, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-denex-pall', 'cms122-denex-root', 'ENCOUNTER', 'Palliative care', 1, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-denex-adv', 'cms122-denex-root', 'DIAGNOSIS', 'Advanced illness', 2, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms122-num-hba1c', 'cms122-num-root', 'OBSERVATION', 'HbA1c > 9% or no test performed', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS124: Cervical Cancer Screening
-- ============================================================================

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms124-ip-root', 'AND', 'Initial Population: Female, Age 21-64, Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-denex-root', 'OR', 'Denominator Exclusion: Hysterectomy, Hospice, Palliative', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-num-root', 'OR', 'Numerator: Pap test OR HPV test', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms124-ip', 'cms124-v12', 'INITIAL_POPULATION', 'Female patients 21-64 with qualifying encounter', 'Female patients aged 21-64 years with at least one eligible encounter during the measurement period.', 'cms124-ip-root', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-den', 'cms124-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms124-den-root', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-denex', 'cms124-v12', 'DENOMINATOR_EXCLUSION', 'Hysterectomy, hospice, or palliative care', 'Patients with hysterectomy with no residual cervix, hospice care, or palliative care.', 'cms124-denex-root', 2, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-num', 'cms124-v12', 'NUMERATOR', 'Appropriate cervical cancer screening', 'Patients with Pap test within 3 years or HPV test within 5 years (for age 30+).', 'cms124-num-root', 3, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, gender_value, age_min, age_max, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms124-ip-sex', 'cms124-ip-root', 'DEMOGRAPHIC', 'Patient sex: Female', 'FEMALE', NULL, NULL, 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-ip-age', 'cms124-ip-root', 'DEMOGRAPHIC', 'Patient age 21-64', NULL, 21, 64, 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms124-ip-enc', 'cms124-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 2, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-denex-hyst', 'cms124-denex-root', 'PROCEDURE', 'Hysterectomy with no residual cervix', 0, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-denex-hospice', 'cms124-denex-root', 'ENCOUNTER', 'Hospice care', 1, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-denex-pall', 'cms124-denex-root', 'ENCOUNTER', 'Palliative care', 2, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-num-pap', 'cms124-num-root', 'PROCEDURE', 'Pap test within 3 years', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms124-num-hpv', 'cms124-num-root', 'PROCEDURE', 'HPV test within 5 years (age 30+)', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS125: Breast Cancer Screening
-- ============================================================================

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms125-ip-root', 'AND', 'Initial Population: Female, Age 52-74, Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-denex-root', 'OR', 'Denominator Exclusion: Mastectomy, Hospice, Palliative', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-num-root', 'OR', 'Numerator: Mammography within 27 months', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms125-ip', 'cms125-v12', 'INITIAL_POPULATION', 'Female patients 52-74 with qualifying encounter', 'Female patients aged 52-74 years with at least one eligible encounter during the measurement period.', 'cms125-ip-root', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-den', 'cms125-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms125-den-root', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-denex', 'cms125-v12', 'DENOMINATOR_EXCLUSION', 'Mastectomy, hospice, or palliative care', 'Patients with bilateral mastectomy, hospice care, palliative care, or advanced illness.', 'cms125-denex-root', 2, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-num', 'cms125-v12', 'NUMERATOR', 'Mammography within 27 months', 'Patients with mammography screening within 27 months prior to the end of the measurement period.', 'cms125-num-root', 3, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, gender_value, age_min, age_max, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms125-ip-sex', 'cms125-ip-root', 'DEMOGRAPHIC', 'Patient sex: Female', 'FEMALE', NULL, NULL, 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-ip-age', 'cms125-ip-root', 'DEMOGRAPHIC', 'Patient age 52-74', NULL, 52, 74, 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms125-ip-enc', 'cms125-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 2, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-denex-bilat', 'cms125-denex-root', 'PROCEDURE', 'Bilateral mastectomy', 0, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-denex-unilat', 'cms125-denex-root', 'PROCEDURE', 'Unilateral mastectomy (both sides)', 1, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-denex-hospice', 'cms125-denex-root', 'ENCOUNTER', 'Hospice care', 2, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-denex-pall', 'cms125-denex-root', 'ENCOUNTER', 'Palliative care', 3, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-denex-adv', 'cms125-denex-root', 'DIAGNOSIS', 'Advanced illness', 4, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms125-num-mammo', 'cms125-num-root', 'PROCEDURE', 'Mammography within 27 months', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS127: Pneumococcal Vaccination Status for Older Adults
-- ============================================================================

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms127-ip-root', 'AND', 'Initial Population: Age >= 65 AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-denex-root', 'OR', 'Denominator Exclusion: Hospice or Immunocompromised', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-num-root', 'OR', 'Numerator: Pneumococcal vaccine administered or history', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms127-ip', 'cms127-v12', 'INITIAL_POPULATION', 'Patients 65 and older with qualifying encounter', 'Patients aged 65 years and older with at least one eligible encounter during the measurement period.', 'cms127-ip-root', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-den', 'cms127-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms127-den-root', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-denex', 'cms127-v12', 'DENOMINATOR_EXCLUSION', 'Hospice care or immunocompromised', 'Patients receiving hospice care or with immunocompromised conditions.', 'cms127-denex-root', 2, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-num', 'cms127-v12', 'NUMERATOR', 'Pneumococcal vaccination', 'Patients who received pneumococcal vaccine or have documented vaccination history.', 'cms127-num-root', 3, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, age_min, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES ('cms127-ip-age', 'cms127-ip-root', 'DEMOGRAPHIC', 'Patient age 65 or older', 65, 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms127-ip-enc', 'cms127-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-denex-hospice', 'cms127-denex-root', 'ENCOUNTER', 'Hospice care', 0, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-denex-immuno', 'cms127-denex-root', 'DIAGNOSIS', 'Immunocompromised conditions', 1, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-num-vaccine', 'cms127-num-root', 'IMMUNIZATION', 'Pneumococcal vaccine administered', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms127-num-history', 'cms127-num-root', 'OBSERVATION', 'Pneumococcal vaccination history', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS130: Colorectal Cancer Screening
-- ============================================================================

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms130-ip-root', 'AND', 'Initial Population: Age 45-75 AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-denex-root', 'OR', 'Denominator Exclusion: CRC, Colectomy, Hospice, Palliative', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-num-root', 'OR', 'Numerator: Colonoscopy OR FOBT OR FIT-DNA OR Sigmoidoscopy', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms130-ip', 'cms130-v12', 'INITIAL_POPULATION', 'Patients 45-75 with qualifying encounter', 'Patients aged 45-75 years with at least one eligible encounter during the measurement period.', 'cms130-ip-root', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-den', 'cms130-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms130-den-root', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-denex', 'cms130-v12', 'DENOMINATOR_EXCLUSION', 'CRC, colectomy, hospice, or palliative care', 'Patients with colorectal cancer, total colectomy, hospice care, or palliative care.', 'cms130-denex-root', 2, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-num', 'cms130-v12', 'NUMERATOR', 'Appropriate colorectal cancer screening', 'Patients with colonoscopy within 10 years, FOBT within 1 year, FIT-DNA within 3 years, or sigmoidoscopy within 5 years.', 'cms130-num-root', 3, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, age_min, age_max, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES ('cms130-ip-age', 'cms130-ip-root', 'DEMOGRAPHIC', 'Patient age 45-75', 45, 75, 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms130-ip-enc', 'cms130-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-denex-crc', 'cms130-denex-root', 'DIAGNOSIS', 'Colorectal cancer diagnosis', 0, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-denex-colect', 'cms130-denex-root', 'PROCEDURE', 'Total colectomy', 1, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-denex-hospice', 'cms130-denex-root', 'ENCOUNTER', 'Hospice care', 2, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-denex-pall', 'cms130-denex-root', 'ENCOUNTER', 'Palliative care', 3, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-num-colon', 'cms130-num-root', 'PROCEDURE', 'Colonoscopy within 10 years', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-num-fobt', 'cms130-num-root', 'OBSERVATION', 'FIT/FOBT within 1 year', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-num-sig', 'cms130-num-root', 'PROCEDURE', 'Flexible sigmoidoscopy within 5 years', 2, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms130-num-fitdna', 'cms130-num-root', 'OBSERVATION', 'FIT-DNA within 3 years', 3, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS138: Preventive Care and Screening: Tobacco Use
-- ============================================================================

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms138-ip-root', 'AND', 'Initial Population: Age >= 18 AND Qualifying Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-denexcep-root', 'OR', 'Denominator Exception: Medical reason or limited life expectancy', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-num-root', 'AND', 'Numerator: Tobacco screening with cessation intervention if user', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms138-ip', 'cms138-v12', 'INITIAL_POPULATION', 'Patients 18 and older with qualifying encounter', 'Patients aged 18 years and older with at least one eligible encounter during the measurement period.', 'cms138-ip-root', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-den', 'cms138-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms138-den-root', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-denexcep', 'cms138-v12', 'DENOMINATOR_EXCEPTION', 'Medical reason or limited life expectancy', 'Patients with medical reason for not screening or with limited life expectancy.', 'cms138-denexcep-root', 2, 'MEDIUM', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-num', 'cms138-v12', 'NUMERATOR', 'Tobacco screening with intervention', 'Patients screened for tobacco use with cessation counseling or medication if tobacco user.', 'cms138-num-root', 3, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, age_min, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES ('cms138-ip-age', 'cms138-ip-root', 'DEMOGRAPHIC', 'Patient age 18 or older', 18, 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms138-ip-enc', 'cms138-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-denexcep-medical', 'cms138-denexcep-root', 'OBSERVATION', 'Tobacco screening not done - medical reason', 0, 'MEDIUM', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-denexcep-life', 'cms138-denexcep-root', 'DIAGNOSIS', 'Limited life expectancy', 1, 'MEDIUM', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-num-screen', 'cms138-num-root', 'OBSERVATION', 'Tobacco use screening', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-num-counsel', 'cms138-num-root', 'PROCEDURE', 'Tobacco cessation counseling', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms138-num-med', 'cms138-num-root', 'MEDICATION', 'Tobacco cessation medication', 2, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- CMS165: Controlling High Blood Pressure
-- ============================================================================

INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms165-ip-root', 'AND', 'Initial Population: Age 18-85 AND Hypertension AND Encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-denex-root', 'OR', 'Denominator Exclusion: ESRD, Pregnancy, Hospice, Palliative', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-num-root', 'AND', 'Numerator: BP < 140/90', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms165-ip', 'cms165-v12', 'INITIAL_POPULATION', 'Patients 18-85 with hypertension and qualifying encounter', 'Patients aged 18-85 years with essential hypertension and at least one eligible encounter during the measurement period.', 'cms165-ip-root', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-den', 'cms165-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms165-den-root', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-denex', 'cms165-v12', 'DENOMINATOR_EXCLUSION', 'ESRD, pregnancy, hospice, or palliative care', 'Patients with ESRD, pregnancy, kidney transplant, hospice care, or palliative care.', 'cms165-denex-root', 2, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-num', 'cms165-v12', 'NUMERATOR', 'Blood pressure adequately controlled', 'Patients whose most recent blood pressure is adequately controlled (systolic < 140 AND diastolic < 90).', 'cms165-num-root', 3, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, age_min, age_max, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES ('cms165-ip-age', 'cms165-ip-root', 'DEMOGRAPHIC', 'Patient age 18-85', 18, 85, 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO data_element (id, clause_id, element_type, description, display_order, confidence, review_status, created_at, created_by, updated_at, updated_by)
VALUES
('cms165-ip-htn', 'cms165-ip-root', 'DIAGNOSIS', 'Essential hypertension diagnosis', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-ip-enc', 'cms165-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 2, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-denex-preg', 'cms165-denex-root', 'DIAGNOSIS', 'Pregnancy', 0, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-denex-esrd', 'cms165-denex-root', 'DIAGNOSIS', 'ESRD diagnosis', 1, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-denex-transplant', 'cms165-denex-root', 'PROCEDURE', 'Kidney transplant', 2, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-denex-hospice', 'cms165-denex-root', 'ENCOUNTER', 'Hospice care', 3, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-denex-pall', 'cms165-denex-root', 'ENCOUNTER', 'Palliative care', 4, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-num-sys', 'cms165-num-root', 'OBSERVATION', 'Systolic BP < 140', 0, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms165-num-dia', 'cms165-num-root', 'OBSERVATION', 'Diastolic BP < 90', 1, 'HIGH', 'APPROVED', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');
