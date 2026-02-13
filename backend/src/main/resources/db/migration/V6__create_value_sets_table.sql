-- V6: Create value set tables

-- Value sets owned by measures
CREATE TABLE measure_value_set (
    id VARCHAR(255) PRIMARY KEY,
    measure_id VARCHAR(255) NOT NULL,

    -- Value set metadata
    oid VARCHAR(255),
    url VARCHAR(500),
    name VARCHAR(500) NOT NULL,
    version VARCHAR(100),
    publisher VARCHAR(255),
    purpose TEXT,

    -- Review status
    confidence VARCHAR(20),
    verified BOOLEAN DEFAULT FALSE,
    source VARCHAR(255),

    CONSTRAINT fk_value_set_measure
        FOREIGN KEY (measure_id) REFERENCES measure(id) ON DELETE CASCADE
);

CREATE INDEX idx_value_set_measure ON measure_value_set(measure_id);
CREATE INDEX idx_value_set_oid ON measure_value_set(oid);

-- Codes within value sets
CREATE TABLE value_set_code (
    id VARCHAR(255) PRIMARY KEY,
    value_set_id VARCHAR(255) NOT NULL,

    code VARCHAR(100) NOT NULL,
    code_system VARCHAR(50) NOT NULL,
    system_uri VARCHAR(500),
    display VARCHAR(500),
    version VARCHAR(100),

    CONSTRAINT fk_code_value_set
        FOREIGN KEY (value_set_id) REFERENCES measure_value_set(id) ON DELETE CASCADE
);

CREATE INDEX idx_code_value_set ON value_set_code(value_set_id);
CREATE INDEX idx_code_system ON value_set_code(code_system);

-- Join table: DataElement to ValueSets (many-to-many)
CREATE TABLE data_element_value_set (
    data_element_id VARCHAR(255) NOT NULL,
    value_set_id VARCHAR(255) NOT NULL,

    PRIMARY KEY (data_element_id, value_set_id),

    CONSTRAINT fk_dev_data_element
        FOREIGN KEY (data_element_id) REFERENCES data_element(id) ON DELETE CASCADE,

    CONSTRAINT fk_dev_value_set
        FOREIGN KEY (value_set_id) REFERENCES measure_value_set(id) ON DELETE CASCADE
);
