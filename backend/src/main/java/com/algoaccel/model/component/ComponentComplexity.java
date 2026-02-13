package com.algoaccel.model.component;

import com.algoaccel.model.enums.ComplexityLevel;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Embeddable complexity metrics for a component.
 */
@Embeddable
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComponentComplexity {

    @Enumerated(EnumType.STRING)
    @Column(name = "complexity_level")
    private ComplexityLevel level;

    @Column(name = "complexity_score")
    private Integer score;

    /**
     * JSON representation of complexity factors.
     * Contains: base, timingClauses, negations, childrenSum, andOperators, nestingDepth, zeroCodes
     */
    @Column(name = "complexity_factors", columnDefinition = "TEXT")
    private String factors;
}
