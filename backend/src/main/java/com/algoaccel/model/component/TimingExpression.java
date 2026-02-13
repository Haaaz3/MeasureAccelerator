package com.algoaccel.model.component;

import com.algoaccel.model.enums.TimingOperator;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Embeddable timing expression for components.
 * Defines when a clinical event should occur relative to a reference point.
 */
@Embeddable
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimingExpression {

    @Enumerated(EnumType.STRING)
    @Column(name = "timing_operator")
    private TimingOperator operator;

    @Column(name = "timing_quantity")
    private Integer quantity;

    @Column(name = "timing_unit")
    private String unit; // years, months, days, hours

    @Column(name = "timing_position")
    private String position; // before start of, after end of, etc.

    @Column(name = "timing_reference")
    private String reference; // Measurement Period, Encounter, IPSD, etc.

    @Column(name = "timing_display", columnDefinition = "TEXT")
    private String displayExpression;
}
