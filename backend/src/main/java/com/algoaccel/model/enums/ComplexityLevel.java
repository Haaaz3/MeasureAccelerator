package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Complexity levels for components and measures.
 */
public enum ComplexityLevel {
    LOW("low"),
    MEDIUM("medium"),
    HIGH("high");

    private final String value;

    ComplexityLevel(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static ComplexityLevel fromScore(int score) {
        if (score <= 3) {
            return LOW;
        } else if (score <= 7) {
            return MEDIUM;
        } else {
            return HIGH;
        }
    }

    public static ComplexityLevel fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (ComplexityLevel level : values()) {
            if (level.value.equalsIgnoreCase(value)) {
                return level;
            }
        }
        throw new IllegalArgumentException("Unknown ComplexityLevel: " + value);
    }
}
