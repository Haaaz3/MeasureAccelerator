-- V4: Create population table
-- Created AFTER logical_clause so we can reference it

CREATE TABLE population (
    id VARCHAR(255) PRIMARY KEY,
    measure_id VARCHAR(255) NOT NULL,

    -- Population type (initial-population, denominator, numerator, etc.)
    population_type VARCHAR(50) NOT NULL,
    description TEXT,
    narrative TEXT,

    -- Reference to root logical clause (the criteria tree)
    -- NULL allowed during construction; will be set when tree is built
    root_clause_id VARCHAR(255) NULL,

    -- Display order within measure (IP first, then Denom, etc.)
    display_order INT NOT NULL DEFAULT 0,

    -- Review status
    confidence VARCHAR(20),
    review_status VARCHAR(50),
    review_notes TEXT,

    -- CQL generation cache
    cql_definition TEXT,
    cql_definition_name VARCHAR(255),

    -- Audit fields
    created_at TIMESTAMP,
    created_by VARCHAR(255),
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),

    -- FK to measure: deleting measure cascades to populations
    CONSTRAINT fk_population_measure
        FOREIGN KEY (measure_id) REFERENCES measure(id) ON DELETE CASCADE,

    -- FK to root clause: RESTRICT to prevent orphaning clauses
    CONSTRAINT fk_population_root_clause
        FOREIGN KEY (root_clause_id) REFERENCES logical_clause(id) ON DELETE RESTRICT
);

CREATE INDEX idx_population_measure ON population(measure_id);
CREATE INDEX idx_population_type ON population(population_type);
CREATE INDEX idx_population_display_order ON population(measure_id, display_order);
