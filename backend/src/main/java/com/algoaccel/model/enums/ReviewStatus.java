package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Review status for measure components.
 */
public enum ReviewStatus {
    PENDING("pending"),
    APPROVED("approved"),
    NEEDS_REVISION("needs_revision"),
    FLAGGED("flagged");

    private final String value;

    ReviewStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static ReviewStatus fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (ReviewStatus status : values()) {
            if (status.value.equals(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown ReviewStatus: " + value);
    }
}
