package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Logical operators for combining criteria in measure populations.
 */
public enum LogicalOperator {
    AND("AND"),
    OR("OR"),
    NOT("NOT");

    private final String value;

    LogicalOperator(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static LogicalOperator fromValue(String value) {
        for (LogicalOperator op : values()) {
            if (op.value.equalsIgnoreCase(value)) {
                return op;
            }
        }
        throw new IllegalArgumentException("Unknown LogicalOperator: " + value);
    }
}
