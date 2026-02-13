package com.algoaccel.model.measure;

import com.algoaccel.model.AuditableEntity;
import com.algoaccel.model.enums.ConfidenceLevel;
import com.algoaccel.model.enums.PopulationType;
import com.algoaccel.model.enums.ReviewStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * Population definition for a measure (e.g., Initial Population, Denominator, Numerator).
 * References a root LogicalClause that contains the criteria tree.
 */
@Entity
@Table(name = "population", indexes = {
    @Index(name = "idx_population_measure", columnList = "measure_id"),
    @Index(name = "idx_population_type", columnList = "population_type"),
    @Index(name = "idx_population_display_order", columnList = "measure_id, display_order")
})
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class Population extends AuditableEntity {

    @Id
    @Column(length = 255)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measure_id", nullable = false)
    private Measure measure;

    @Enumerated(EnumType.STRING)
    @Column(name = "population_type", nullable = false, length = 50)
    private PopulationType populationType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String narrative;

    /**
     * Root of the criteria tree.
     * NULL allowed during construction; will be set when tree is built.
     */
    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "root_clause_id")
    private LogicalClause rootClause;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ConfidenceLevel confidence;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_status", length = 50)
    private ReviewStatus reviewStatus;

    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;

    // CQL generation cache
    @Column(name = "cql_definition", columnDefinition = "TEXT")
    private String cqlDefinition;

    @Column(name = "cql_definition_name", length = 255)
    private String cqlDefinitionName;
}
