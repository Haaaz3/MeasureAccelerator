package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * FHIR Administrative Gender.
 * Used for Patient sex demographic checks.
 */
public enum Gender {
    MALE("male"),
    FEMALE("female");

    private final String value;

    Gender(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @Override
    public String toString() {
        return value;
    }

    public static Gender fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (Gender gender : values()) {
            if (gender.value.equalsIgnoreCase(value)) {
                return gender;
            }
        }
        throw new IllegalArgumentException("Unknown Gender: " + value);
    }
}
