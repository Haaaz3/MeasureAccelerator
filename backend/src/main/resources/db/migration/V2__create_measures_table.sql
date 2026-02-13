-- V2: Create measure table

CREATE TABLE measure (
    id VARCHAR(255) PRIMARY KEY,

    -- Metadata
    measure_id VARCHAR(100),
    title VARCHAR(500),
    version VARCHAR(50),
    steward VARCHAR(255),
    program VARCHAR(50),
    measure_type VARCHAR(50),
    description TEXT,
    rationale TEXT,
    clinical_recommendation TEXT,

    -- Measurement Period
    period_start VARCHAR(100),
    period_end VARCHAR(100),

    -- Global Constraints (embedded)
    age_min INT,
    age_max INT,
    gender VARCHAR(20),
    age_calculation VARCHAR(50),
    product_line TEXT,
    continuous_enrollment_days INT,
    allowed_gap_days INT,

    -- Status
    status VARCHAR(50),
    overall_confidence VARCHAR(20),
    locked_at TIMESTAMP,
    locked_by VARCHAR(255),

    -- Generated Code (cacheable, regenerated on demand)
    generated_cql TEXT,
    generated_sql TEXT,

    -- Audit fields
    created_at TIMESTAMP,
    created_by VARCHAR(255),
    updated_at TIMESTAMP,
    updated_by VARCHAR(255)
);

CREATE INDEX idx_measure_status ON measure(status);
CREATE INDEX idx_measure_program ON measure(program);
