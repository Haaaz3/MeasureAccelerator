package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Types of data elements in measure criteria.
 * Maps to QI-Core resource types and clinical concepts.
 */
public enum DataElementType {
    DIAGNOSIS("diagnosis"),
    ENCOUNTER("encounter"),
    PROCEDURE("procedure"),
    OBSERVATION("observation"),
    MEDICATION("medication"),
    DEMOGRAPHIC("demographic"),
    ASSESSMENT("assessment"),
    IMMUNIZATION("immunization"),
    DEVICE("device"),
    COMMUNICATION("communication"),
    ALLERGY("allergy"),
    GOAL("goal");

    private final String value;

    DataElementType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static DataElementType fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (DataElementType type : values()) {
            if (type.value.equalsIgnoreCase(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown DataElementType: " + value);
    }
}
