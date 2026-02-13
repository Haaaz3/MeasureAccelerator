package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Categories for organizing library components.
 * Maps to the 9 categories defined in Phase 2.
 */
public enum ComponentCategory {
    DEMOGRAPHICS("demographics"),
    ENCOUNTERS("encounters"),
    CONDITIONS("conditions"),
    PROCEDURES("procedures"),
    MEDICATIONS("medications"),
    ASSESSMENTS("assessments"),
    LABORATORY("laboratory"),
    CLINICAL_OBSERVATIONS("clinical-observations"),
    EXCLUSIONS("exclusions");

    private final String value;

    ComponentCategory(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static ComponentCategory fromValue(String value) {
        for (ComponentCategory category : values()) {
            if (category.value.equals(value)) {
                return category;
            }
        }
        throw new IllegalArgumentException("Unknown ComponentCategory: " + value);
    }
}
