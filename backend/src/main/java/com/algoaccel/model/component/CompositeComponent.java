package com.algoaccel.model.component;

import com.algoaccel.model.enums.LogicalOperator;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

/**
 * Composite component combining multiple atomic components with a logical operator.
 */
@Entity
@DiscriminatorValue("composite")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
public class CompositeComponent extends LibraryComponent {

    @Enumerated(EnumType.STRING)
    @Column(name = "logical_operator", length = 10)
    private LogicalOperator operator;

    /**
     * JSON array of ComponentReference objects.
     * Each reference has: componentId, versionId, displayName
     */
    @Column(name = "children", columnDefinition = "TEXT")
    private String children;

    @Override
    public String getType() {
        return "composite";
    }
}
