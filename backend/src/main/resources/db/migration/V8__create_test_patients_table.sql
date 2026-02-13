-- V8: Create test patients table for measure validation

CREATE TABLE test_patient (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,

    -- Demographics
    birth_date DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    race VARCHAR(100),
    ethnicity VARCHAR(100),

    -- Clinical data stored as JSON (denormalized for simplicity)
    -- These are static test fixtures, not user-editable relational data
    diagnoses TEXT,
    encounters TEXT,
    procedures TEXT,
    observations TEXT,
    medications TEXT,
    immunizations TEXT
);
