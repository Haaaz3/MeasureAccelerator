package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Types of corrections for measure audit trail.
 */
public enum CorrectionType {
    CODE_ADDED("code_added"),
    CODE_REMOVED("code_removed"),
    CODE_SYSTEM_CHANGED("code_system_changed"),
    TIMING_CHANGED("timing_changed"),
    LOGIC_CHANGED("logic_changed"),
    DESCRIPTION_CHANGED("description_changed"),
    THRESHOLD_CHANGED("threshold_changed"),
    POPULATION_REASSIGNED("population_reassigned"),
    ELEMENT_ADDED("element_added"),
    ELEMENT_REMOVED("element_removed");

    private final String value;

    CorrectionType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static CorrectionType fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (CorrectionType type : values()) {
            if (type.value.equals(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown CorrectionType: " + value);
    }
}
