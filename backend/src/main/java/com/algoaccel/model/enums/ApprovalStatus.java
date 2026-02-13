package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Approval status for library components.
 */
public enum ApprovalStatus {
    DRAFT("draft"),
    PENDING_REVIEW("pending_review"),
    APPROVED("approved"),
    ARCHIVED("archived");

    private final String value;

    ApprovalStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static ApprovalStatus fromValue(String value) {
        for (ApprovalStatus status : values()) {
            if (status.value.equals(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown ApprovalStatus: " + value);
    }
}
