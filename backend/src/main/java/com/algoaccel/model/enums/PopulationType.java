package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * FHIR Measure population types.
 * Uses kebab-case to match FHIR standard codes.
 */
public enum PopulationType {
    INITIAL_POPULATION("initial-population"),
    DENOMINATOR("denominator"),
    DENOMINATOR_EXCLUSION("denominator-exclusion"),
    DENOMINATOR_EXCEPTION("denominator-exception"),
    NUMERATOR("numerator"),
    NUMERATOR_EXCLUSION("numerator-exclusion");

    private final String value;

    PopulationType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static PopulationType fromValue(String value) {
        if (value == null) {
            return null;
        }
        // Handle both kebab-case and underscore formats
        String normalized = value.toLowerCase().replace('_', '-');
        for (PopulationType type : values()) {
            if (type.value.equals(normalized)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown PopulationType: " + value);
    }
}
