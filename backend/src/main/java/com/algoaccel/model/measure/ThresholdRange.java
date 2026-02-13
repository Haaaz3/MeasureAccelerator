package com.algoaccel.model.measure;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Embeddable threshold range for data elements.
 * Used for age ranges, value ranges, etc.
 */
@Embeddable
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ThresholdRange {

    @Column(name = "age_min")
    private Integer ageMin;

    @Column(name = "age_max")
    private Integer ageMax;

    @Column(name = "value_min", precision = 10, scale = 2)
    private BigDecimal valueMin;

    @Column(name = "value_max", precision = 10, scale = 2)
    private BigDecimal valueMax;

    @Column(name = "value_unit")
    private String unit;

    @Column(name = "value_comparator")
    private String comparator; // >, >=, <, <=, =, !=
}
