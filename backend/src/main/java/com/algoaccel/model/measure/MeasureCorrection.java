package com.algoaccel.model.measure;

import com.algoaccel.model.enums.CorrectionType;
import com.algoaccel.model.enums.PopulationType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Correction record for measure audit trail.
 * Tracks all modifications made to a measure for ML training feedback.
 */
@Entity
@Table(name = "measure_correction", indexes = {
    @Index(name = "idx_correction_measure", columnList = "measure_id"),
    @Index(name = "idx_correction_type", columnList = "correction_type")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MeasureCorrection {

    @Id
    @Column(length = 255)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measure_id", nullable = false)
    private Measure measure;

    @Enumerated(EnumType.STRING)
    @Column(name = "correction_type", nullable = false, length = 50)
    private CorrectionType correctionType;

    @Column(name = "component_id", length = 255)
    private String componentId;

    @Column(name = "component_path", length = 500)
    private String componentPath;

    /**
     * Original value (stored as JSON since structure varies by correction type).
     */
    @Column(name = "original_value", columnDefinition = "TEXT")
    private String originalValue;

    /**
     * Corrected value (stored as JSON).
     */
    @Column(name = "corrected_value", columnDefinition = "TEXT")
    private String correctedValue;

    @Column(name = "user_notes", columnDefinition = "TEXT")
    private String userNotes;

    @Column(name = "source_reference", length = 500)
    private String sourceReference;

    @Enumerated(EnumType.STRING)
    @Column(name = "population_type", length = 50)
    private PopulationType populationType;

    @Column(nullable = false)
    private LocalDateTime timestamp;
}
