package com.algoaccel.model.measure;

import com.algoaccel.model.AuditableEntity;
import com.algoaccel.model.enums.ConfidenceLevel;
import com.algoaccel.model.enums.MeasureProgram;
import com.algoaccel.model.enums.MeasureStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Universal Measure Specification entity.
 * Represents a clinical quality measure with populations, value sets, and generated code.
 */
@Entity
@Table(name = "measure", indexes = {
    @Index(name = "idx_measure_status", columnList = "status"),
    @Index(name = "idx_measure_program", columnList = "program")
})
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class Measure extends AuditableEntity {

    @Id
    @Column(length = 255)
    private String id;

    /**
     * CMS measure identifier (e.g., "CMS130v11")
     */
    @Column(name = "measure_id", length = 100)
    private String measureId;

    @Column(length = 500)
    private String title;

    @Column(length = 50)
    private String version;

    @Column(length = 255)
    private String steward;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private MeasureProgram program;

    @Column(name = "measure_type", length = 50)
    private String measureType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String rationale;

    @Column(name = "clinical_recommendation", columnDefinition = "TEXT")
    private String clinicalRecommendation;

    // Measurement Period
    @Column(name = "period_start", length = 100)
    private String periodStart;

    @Column(name = "period_end", length = 100)
    private String periodEnd;

    // Global Constraints (embedded)
    @Embedded
    private GlobalConstraints globalConstraints;

    // Status
    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private MeasureStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "overall_confidence", length = 20)
    private ConfidenceLevel overallConfidence;

    @Column(name = "locked_at")
    private LocalDateTime lockedAt;

    @Column(name = "locked_by", length = 255)
    private String lockedBy;

    // Populations (relational - not JSON)
    @OneToMany(mappedBy = "measure", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("displayOrder")
    @Builder.Default
    private List<Population> populations = new ArrayList<>();

    // Value sets (relational - not JSON)
    @OneToMany(mappedBy = "measure", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<MeasureValueSet> valueSets = new ArrayList<>();

    // Corrections (relational - not JSON)
    @OneToMany(mappedBy = "measure", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("timestamp DESC")
    @Builder.Default
    private List<MeasureCorrection> corrections = new ArrayList<>();

    // Generated Code (cacheable, regenerated on demand)
    @Column(name = "generated_cql", columnDefinition = "TEXT")
    private String generatedCql;

    @Column(name = "generated_sql", columnDefinition = "TEXT")
    private String generatedSql;

    /**
     * Helper method to add a population.
     */
    public void addPopulation(Population population) {
        populations.add(population);
        population.setMeasure(this);
    }

    /**
     * Helper method to remove a population.
     */
    public void removePopulation(Population population) {
        populations.remove(population);
        population.setMeasure(null);
    }

    /**
     * Helper method to add a value set.
     */
    public void addValueSet(MeasureValueSet valueSet) {
        valueSets.add(valueSet);
        valueSet.setMeasure(this);
    }

    /**
     * Helper method to add a correction.
     */
    public void addCorrection(MeasureCorrection correction) {
        corrections.add(correction);
        correction.setMeasure(this);
    }
}
