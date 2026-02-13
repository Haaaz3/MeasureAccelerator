-- V1: Create library_component table (single-table inheritance)

CREATE TABLE library_component (
    id VARCHAR(255) PRIMARY KEY,
    component_type VARCHAR(31) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,

    -- Complexity (embedded)
    complexity_level VARCHAR(20),
    complexity_score INT,
    complexity_factors TEXT,

    -- Version Info (embedded)
    version_id VARCHAR(50),
    version_status VARCHAR(50),
    version_history TEXT,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    review_notes TEXT,

    -- Usage (embedded)
    measure_ids TEXT,
    usage_count INT DEFAULT 0,
    last_used_at TIMESTAMP,
    parent_composite_ids TEXT,

    -- Metadata (embedded)
    category VARCHAR(50),
    category_auto_assigned BOOLEAN DEFAULT FALSE,
    tags TEXT,
    source_origin VARCHAR(50),
    source_reference VARCHAR(500),
    original_measure_id VARCHAR(255),

    -- Audit fields
    created_at TIMESTAMP,
    created_by VARCHAR(255),
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),

    -- AtomicComponent fields
    value_set_oid VARCHAR(255),
    value_set_name VARCHAR(500),
    value_set_version VARCHAR(100),
    value_set_codes TEXT,
    additional_value_sets TEXT,
    timing_operator VARCHAR(50),
    timing_quantity INT,
    timing_unit VARCHAR(50),
    timing_position VARCHAR(100),
    timing_reference VARCHAR(255),
    timing_display TEXT,
    negation BOOLEAN,
    resource_type VARCHAR(100),
    gender_value VARCHAR(20),

    -- CompositeComponent fields
    logical_operator VARCHAR(10),
    children TEXT
);

CREATE INDEX idx_component_category ON library_component(category);
CREATE INDEX idx_component_status ON library_component(version_status);
CREATE INDEX idx_component_type ON library_component(component_type);
