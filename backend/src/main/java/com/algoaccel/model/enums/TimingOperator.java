package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Timing operators for temporal constraints.
 */
public enum TimingOperator {
    DURING("during"),
    BEFORE("before"),
    AFTER("after"),
    STARTS_DURING("starts during"),
    ENDS_DURING("ends during"),
    STARTS_BEFORE("starts before"),
    STARTS_AFTER("starts after"),
    ENDS_BEFORE("ends before"),
    ENDS_AFTER("ends after"),
    WITHIN("within"),
    OVERLAPS("overlaps"),
    BEFORE_END_OF("before end of"),
    AFTER_START_OF("after start of");

    private final String value;

    TimingOperator(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static TimingOperator fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (TimingOperator op : values()) {
            if (op.value.equalsIgnoreCase(value)) {
                return op;
            }
        }
        throw new IllegalArgumentException("Unknown TimingOperator: " + value);
    }
}
