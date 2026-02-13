package com.algoaccel.model.component;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Embeddable value set reference for atomic components.
 */
@Embeddable
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComponentValueSet {

    @Column(name = "value_set_oid")
    private String oid;

    @Column(name = "value_set_name", length = 500)
    private String name;

    @Column(name = "value_set_version")
    private String version;

    /**
     * JSON array of CodeReference objects.
     * Each code has: code, system, display, version
     */
    @Column(name = "value_set_codes", columnDefinition = "TEXT")
    private String codes;
}
