package com.algoaccel.model.measure;

import com.algoaccel.model.AuditableEntity;
import com.algoaccel.model.enums.ConfidenceLevel;
import com.algoaccel.model.enums.LogicalOperator;
import com.algoaccel.model.enums.ReviewStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.ArrayList;
import java.util.List;

/**
 * Logical clause in a population criteria tree.
 * Self-referencing for nested AND/OR/NOT operations.
 */
@Entity
@Table(name = "logical_clause", indexes = {
    @Index(name = "idx_clause_parent", columnList = "parent_clause_id"),
    @Index(name = "idx_clause_display_order", columnList = "parent_clause_id, display_order")
})
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class LogicalClause extends AuditableEntity {

    @Id
    @Column(length = 255)
    private String id;

    /**
     * Self-referencing parent clause.
     * NULL for root clauses owned by populations.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_clause_id")
    private LogicalClause parentClause;

    /**
     * Child clauses (nested logical operations).
     */
    @OneToMany(mappedBy = "parentClause", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("displayOrder")
    @Builder.Default
    private List<LogicalClause> childClauses = new ArrayList<>();

    /**
     * Data elements (leaf nodes).
     */
    @OneToMany(mappedBy = "clause", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("displayOrder")
    @Builder.Default
    private List<DataElement> dataElements = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private LogicalOperator operator;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ConfidenceLevel confidence;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_status", length = 50)
    private ReviewStatus reviewStatus;

    // CQL snippet cache
    @Column(name = "cql_snippet", columnDefinition = "TEXT")
    private String cqlSnippet;

    @Column(name = "cql_definition_name", length = 255)
    private String cqlDefinitionName;

    /**
     * Sibling connections override (JSON - genuinely unstructured).
     * Used for per-sibling operator overrides.
     */
    @Column(name = "sibling_connections", columnDefinition = "TEXT")
    private String siblingConnections;

    /**
     * Helper method to add a child clause.
     */
    public void addChildClause(LogicalClause child) {
        childClauses.add(child);
        child.setParentClause(this);
    }

    /**
     * Helper method to remove a child clause.
     */
    public void removeChildClause(LogicalClause child) {
        childClauses.remove(child);
        child.setParentClause(null);
    }

    /**
     * Helper method to add a data element.
     */
    public void addDataElement(DataElement element) {
        dataElements.add(element);
        element.setClause(this);
    }

    /**
     * Helper method to remove a data element.
     */
    public void removeDataElement(DataElement element) {
        dataElements.remove(element);
        element.setClause(null);
    }
}
