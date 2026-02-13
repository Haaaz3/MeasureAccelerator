package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Status of a measure in the workflow.
 */
public enum MeasureStatus {
    IN_PROGRESS("in_progress"),
    PUBLISHED("published");

    private final String value;

    MeasureStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static MeasureStatus fromValue(String value) {
        if (value == null) {
            return IN_PROGRESS;
        }
        for (MeasureStatus status : values()) {
            if (status.value.equals(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown MeasureStatus: " + value);
    }
}
