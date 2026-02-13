-- V7: Create corrections table for measure audit trail

CREATE TABLE measure_correction (
    id VARCHAR(255) PRIMARY KEY,
    measure_id VARCHAR(255) NOT NULL,

    -- Correction details
    correction_type VARCHAR(50) NOT NULL,
    component_id VARCHAR(255),
    component_path VARCHAR(500),

    -- Values (stored as JSON since structure varies by correction type)
    original_value TEXT,
    corrected_value TEXT,

    -- Context
    user_notes TEXT,
    source_reference VARCHAR(500),
    population_type VARCHAR(50),

    -- Audit
    timestamp TIMESTAMP NOT NULL,

    CONSTRAINT fk_correction_measure
        FOREIGN KEY (measure_id) REFERENCES measure(id) ON DELETE CASCADE
);

CREATE INDEX idx_correction_measure ON measure_correction(measure_id);
CREATE INDEX idx_correction_type ON measure_correction(correction_type);
