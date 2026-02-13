package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Quality measure programs.
 */
public enum MeasureProgram {
    MIPS_CQM("MIPS_CQM"),
    ECQM("eCQM"),
    HEDIS("HEDIS"),
    QOF("QOF"),
    REGISTRY("Registry"),
    CUSTOM("Custom");

    private final String value;

    MeasureProgram(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static MeasureProgram fromValue(String value) {
        if (value == null) {
            return CUSTOM;
        }
        for (MeasureProgram program : values()) {
            if (program.value.equalsIgnoreCase(value)) {
                return program;
            }
        }
        return CUSTOM;
    }
}
