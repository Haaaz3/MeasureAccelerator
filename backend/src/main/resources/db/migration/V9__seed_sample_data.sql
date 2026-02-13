-- V9: Seed sample data

-- Insert Patient Sex components
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type, gender_value,
    created_at, created_by, updated_at, updated_by
) VALUES
(
    'patient-sex-female', 'atomic', 'Patient Sex: Female',
    'Patient administrative gender is female (FHIR Patient.gender = "female")',
    'LOW', 1,
    '1.0', 'APPROVED',
    'DEMOGRAPHICS', false, 'ecqi',
    '2.16.840.1.113883.4.642.3.1', 'Administrative Gender', 'FHIR R4',
    'DURING', 'Measurement Period', 'N/A - Patient demographic',
    false, 'Patient', 'FEMALE',
    CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'
),
(
    'patient-sex-male', 'atomic', 'Patient Sex: Male',
    'Patient administrative gender is male (FHIR Patient.gender = "male")',
    'LOW', 1,
    '1.0', 'APPROVED',
    'DEMOGRAPHICS', false, 'ecqi',
    '2.16.840.1.113883.4.642.3.1', 'Administrative Gender', 'FHIR R4',
    'DURING', 'Measurement Period', 'N/A - Patient demographic',
    false, 'Patient', 'MALE',
    CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'
),
(
    'age-65-plus', 'atomic', 'Age 65 and Older',
    'Patient age is 65 years or older during the measurement period',
    'LOW', 1,
    '1.0', 'APPROVED',
    'DEMOGRAPHICS', false, 'ecqi',
    NULL, 'Age Threshold', NULL,
    'DURING', 'Measurement Period', 'Age >= 65 during Measurement Period',
    false, 'Patient', NULL,
    CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'
);

-- Insert sample test patient
INSERT INTO test_patient (
    id, name, birth_date, gender, race, ethnicity,
    diagnoses, encounters, procedures, observations, medications, immunizations
) VALUES (
    'test-patient-001', 'Paul Atreides',
    '1970-06-15', 'male', 'White', 'Non-Hispanic',
    '[{"code":"I10","system":"ICD10CM","display":"Essential Hypertension","onsetDate":"2020-01-15"}]',
    '[{"code":"99213","system":"CPT","display":"Office Visit","date":"2024-03-15","type":"outpatient"}]',
    '[{"code":"45378","system":"CPT","display":"Colonoscopy","date":"2022-06-01"}]',
    '[{"code":"4548-4","system":"LOINC","display":"HbA1c","value":6.2,"unit":"%","date":"2024-02-01"}]',
    '[{"code":"314076","system":"RxNorm","display":"Lisinopril 10mg","startDate":"2020-02-01","status":"active"}]',
    '[]'
);
