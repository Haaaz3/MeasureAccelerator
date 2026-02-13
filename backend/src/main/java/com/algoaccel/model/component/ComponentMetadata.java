package com.algoaccel.model.component;

import com.algoaccel.model.enums.ComponentCategory;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Embeddable metadata for a component.
 * Note: Audit fields (createdAt, createdBy, etc.) are in AuditableEntity base class.
 */
@Embeddable
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComponentMetadata {

    @Enumerated(EnumType.STRING)
    @Column(name = "category")
    private ComponentCategory category;

    /**
     * True if category was auto-assigned by inferCategory(); false if manually set.
     */
    @Column(name = "category_auto_assigned")
    private Boolean categoryAutoAssigned;

    /**
     * JSON array of tags for the component.
     */
    @Column(name = "tags", columnDefinition = "TEXT")
    private String tags;

    /**
     * Origin of the component: 'ecqi', 'custom', 'imported'
     */
    @Column(name = "source_origin")
    private String sourceOrigin;

    /**
     * Reference to original source (e.g., eCQI URL, import file name)
     */
    @Column(name = "source_reference")
    private String sourceReference;

    /**
     * Original measure ID if imported from a specific measure
     */
    @Column(name = "original_measure_id")
    private String originalMeasureId;
}
