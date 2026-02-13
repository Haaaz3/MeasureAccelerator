package com.algoaccel.model.measure;

import com.algoaccel.model.enums.Gender;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Embeddable global constraints for a measure.
 * Applies to all populations in the measure.
 */
@Embeddable
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GlobalConstraints {

    @Column(name = "age_min")
    private Integer ageMin;

    @Column(name = "age_max")
    private Integer ageMax;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender")
    private Gender gender;

    /**
     * How age is calculated: at_start, at_end, during, turns_during
     */
    @Column(name = "age_calculation")
    private String ageCalculation;

    /**
     * JSON array of product lines (for payer-specific measures)
     */
    @Column(name = "product_line", columnDefinition = "TEXT")
    private String productLine;

    @Column(name = "continuous_enrollment_days")
    private Integer continuousEnrollmentDays;

    @Column(name = "allowed_gap_days")
    private Integer allowedGapDays;
}
