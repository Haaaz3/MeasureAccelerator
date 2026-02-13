package com.algoaccel.model.measure;

import com.algoaccel.model.AuditableEntity;
import com.algoaccel.model.component.LibraryComponent;
import com.algoaccel.model.enums.ConfidenceLevel;
import com.algoaccel.model.enums.DataElementType;
import com.algoaccel.model.enums.Gender;
import com.algoaccel.model.enums.ReviewStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.HashSet;
import java.util.Set;

/**
 * Data element (leaf node) in a population criteria tree.
 * Represents a single clinical criterion.
 */
@Entity
@Table(name = "data_element", indexes = {
    @Index(name = "idx_element_clause", columnList = "clause_id"),
    @Index(name = "idx_element_type", columnList = "element_type"),
    @Index(name = "idx_element_library_component", columnList = "library_component_id"),
    @Index(name = "idx_element_display_order", columnList = "clause_id, display_order")
})
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class DataElement extends AuditableEntity {

    @Id
    @Column(length = 255)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clause_id", nullable = false)
    private LogicalClause clause;

    @Enumerated(EnumType.STRING)
    @Column(name = "element_type", nullable = false, length = 50)
    private DataElementType elementType;

    @Column(name = "resource_type", length = 100)
    private String resourceType;

    @Column(columnDefinition = "TEXT")
    private String description;

    // Thresholds (embedded)
    @Embedded
    private ThresholdRange thresholds;

    // Gender for demographic checks
    @Enumerated(EnumType.STRING)
    @Column(name = "gender_value", length = 20)
    private Gender genderValue;

    @Column(nullable = false)
    @Builder.Default
    private boolean negation = false;

    @Column(name = "negation_rationale", columnDefinition = "TEXT")
    private String negationRationale;

    // Timing override (JSON - variable structure)
    @Column(name = "timing_override", columnDefinition = "TEXT")
    private String timingOverride;

    @Column(name = "timing_window", columnDefinition = "TEXT")
    private String timingWindow;

    // Additional requirements (JSON array)
    @Column(name = "additional_requirements", columnDefinition = "TEXT")
    private String additionalRequirements;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ConfidenceLevel confidence;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_status", length = 50)
    private ReviewStatus reviewStatus;

    // CQL cache
    @Column(name = "cql_definition_name", length = 255)
    private String cqlDefinitionName;

    @Column(name = "cql_expression", columnDefinition = "TEXT")
    private String cqlExpression;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    // Value sets (many-to-many)
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "data_element_value_set",
        joinColumns = @JoinColumn(name = "data_element_id"),
        inverseJoinColumns = @JoinColumn(name = "value_set_id")
    )
    @Builder.Default
    private Set<MeasureValueSet> valueSets = new HashSet<>();

    // Library component link (for traceability)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "library_component_id")
    private LibraryComponent libraryComponent;
}
