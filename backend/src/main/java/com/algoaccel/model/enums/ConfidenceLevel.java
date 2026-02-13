package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Confidence levels for AI-parsed content.
 */
public enum ConfidenceLevel {
    HIGH("high"),
    MEDIUM("medium"),
    LOW("low");

    private final String value;

    ConfidenceLevel(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static ConfidenceLevel fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (ConfidenceLevel level : values()) {
            if (level.value.equalsIgnoreCase(value)) {
                return level;
            }
        }
        throw new IllegalArgumentException("Unknown ConfidenceLevel: " + value);
    }
}
