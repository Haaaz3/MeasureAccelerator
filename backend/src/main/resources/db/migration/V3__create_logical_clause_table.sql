-- V3: Create logical_clause table
-- Created BEFORE population because population references it

CREATE TABLE logical_clause (
    id VARCHAR(255) PRIMARY KEY,

    -- Parent clause (NULL for root clauses owned by populations)
    parent_clause_id VARCHAR(255) NULL,

    -- Operator (AND, OR, NOT)
    operator VARCHAR(10) NOT NULL,
    description TEXT,

    -- Display order within parent (for ordering children)
    display_order INT NOT NULL DEFAULT 0,

    -- Review status
    confidence VARCHAR(20),
    review_status VARCHAR(50),

    -- CQL snippet cache
    cql_snippet TEXT,
    cql_definition_name VARCHAR(255),

    -- Sibling connections override (JSON - genuinely unstructured)
    sibling_connections TEXT,

    -- Audit fields
    created_at TIMESTAMP,
    created_by VARCHAR(255),
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),

    -- Self-referential FK: ON DELETE CASCADE means deleting a parent deletes all children
    CONSTRAINT fk_clause_parent
        FOREIGN KEY (parent_clause_id) REFERENCES logical_clause(id) ON DELETE CASCADE
);

CREATE INDEX idx_clause_parent ON logical_clause(parent_clause_id);
CREATE INDEX idx_clause_display_order ON logical_clause(parent_clause_id, display_order);
