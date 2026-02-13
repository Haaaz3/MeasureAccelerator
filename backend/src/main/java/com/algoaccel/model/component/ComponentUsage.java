package com.algoaccel.model.component;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Embeddable usage tracking for a component.
 * Tracks which measures use this component.
 */
@Embeddable
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComponentUsage {

    /**
     * JSON array of measure IDs that use this component.
     */
    @Column(name = "measure_ids", columnDefinition = "TEXT")
    private String measureIds;

    @Column(name = "usage_count")
    private Integer usageCount;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    /**
     * JSON array of parent composite component IDs (if this is a child component).
     */
    @Column(name = "parent_composite_ids", columnDefinition = "TEXT")
    private String parentCompositeIds;
}
