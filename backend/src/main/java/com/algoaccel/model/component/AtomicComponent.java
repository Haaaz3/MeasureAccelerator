package com.algoaccel.model.component;

import com.algoaccel.model.enums.Gender;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

/**
 * Atomic component representing a single clinical concept.
 * Contains a value set, timing expression, and optional negation.
 */
@Entity
@DiscriminatorValue("atomic")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
public class AtomicComponent extends LibraryComponent {

    @Embedded
    private ComponentValueSet valueSet;

    /**
     * JSON array of additional ComponentValueSet objects.
     */
    @Column(name = "additional_value_sets", columnDefinition = "TEXT")
    private String additionalValueSets;

    @Embedded
    private TimingExpression timing;

    @Column
    private boolean negation;

    /**
     * QI-Core resource type (e.g., Patient, Encounter, Condition, Procedure, etc.)
     */
    @Column(name = "resource_type", length = 100)
    private String resourceType;

    /**
     * For Patient sex components: the gender value to check.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "gender_value", length = 20)
    private Gender genderValue;

    @Override
    public String getType() {
        return "atomic";
    }
}
