-- V11: Create FHIR Test Patients table for measure validation
-- Stores CMS FHIR test patient bundles with expected population results

CREATE TABLE fhir_test_patient (
    id VARCHAR(255) PRIMARY KEY,
    measure_id VARCHAR(100) NOT NULL,
    test_case_name VARCHAR(500) NOT NULL,
    description TEXT,

    -- Full FHIR Bundle JSON
    fhir_bundle TEXT NOT NULL,

    -- Expected population results (the answer key from CMS-validated MeasureReport)
    expected_ip INTEGER NOT NULL DEFAULT 0,
    expected_den INTEGER NOT NULL DEFAULT 0,
    expected_denex INTEGER NOT NULL DEFAULT 0,
    expected_num INTEGER NOT NULL DEFAULT 0,
    expected_denexcep INTEGER NOT NULL DEFAULT 0,

    -- Patient demographics extracted from FHIR for quick filtering
    patient_gender VARCHAR(20),
    patient_birth_date VARCHAR(20),

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fhir_test_patient_measure ON fhir_test_patient(measure_id);
CREATE INDEX idx_fhir_test_patient_name ON fhir_test_patient(test_case_name);

-- Note: Actual FHIR bundles will be imported via the API endpoint
-- POST /api/test-patients/import
-- or populated by a separate data migration script
