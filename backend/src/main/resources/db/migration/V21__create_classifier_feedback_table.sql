-- Classifier feedback table for training signal storage
-- Stores user confirmations/overrides of catalogue type detection

CREATE TABLE classifier_feedback (
    id BIGSERIAL PRIMARY KEY,
    document_name VARCHAR(500),
    detected_type VARCHAR(50),
    confirmed_type VARCHAR(50) NOT NULL,
    was_overridden BOOLEAN NOT NULL DEFAULT FALSE,
    confidence VARCHAR(20),
    signals TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_classifier_feedback_confirmed_type ON classifier_feedback(confirmed_type);
CREATE INDEX idx_classifier_feedback_created_at ON classifier_feedback(created_at);
