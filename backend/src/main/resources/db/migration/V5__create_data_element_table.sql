-- V5: Create data_element table

CREATE TABLE data_element (
    id VARCHAR(255) PRIMARY KEY,

    -- Parent logical clause (required - data elements always belong to a clause)
    clause_id VARCHAR(255) NOT NULL,

    -- Element type (diagnosis, encounter, procedure, observation, medication, demographic, etc.)
    element_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(100),
    description TEXT,

    -- Thresholds (embedded)
    age_min INT,
    age_max INT,
    value_min DECIMAL(10,2),
    value_max DECIMAL(10,2),
    value_unit VARCHAR(50),
    value_comparator VARCHAR(10),

    -- Gender (enum for Patient sex checks)
    gender_value VARCHAR(20),

    -- Negation
    negation BOOLEAN NOT NULL DEFAULT FALSE,
    negation_rationale TEXT,

    -- Timing override (JSON - variable structure)
    timing_override TEXT,
    timing_window TEXT,

    -- Additional requirements (JSON array)
    additional_requirements TEXT,

    -- Review status
    confidence VARCHAR(20),
    review_status VARCHAR(50),

    -- CQL cache
    cql_definition_name VARCHAR(255),
    cql_expression TEXT,

    -- Library component link (for traceability)
    library_component_id VARCHAR(255),

    -- Display order within clause (for ordering siblings)
    display_order INT NOT NULL DEFAULT 0,

    -- Audit fields
    created_at TIMESTAMP,
    created_by VARCHAR(255),
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),

    -- FK to parent clause: cascade delete
    CONSTRAINT fk_element_clause
        FOREIGN KEY (clause_id) REFERENCES logical_clause(id) ON DELETE CASCADE,

    -- FK to library component: SET NULL if library component is deleted
    CONSTRAINT fk_element_library_component
        FOREIGN KEY (library_component_id) REFERENCES library_component(id) ON DELETE SET NULL
);

CREATE INDEX idx_element_clause ON data_element(clause_id);
CREATE INDEX idx_element_type ON data_element(element_type);
CREATE INDEX idx_element_library_component ON data_element(library_component_id);
CREATE INDEX idx_element_display_order ON data_element(clause_id, display_order);
