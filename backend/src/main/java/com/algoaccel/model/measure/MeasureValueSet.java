package com.algoaccel.model.measure;

import com.algoaccel.model.enums.ConfidenceLevel;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/**
 * Value set owned by a measure.
 * Contains codes that define clinical concepts for the measure criteria.
 */
@Entity
@Table(name = "measure_value_set", indexes = {
    @Index(name = "idx_value_set_measure", columnList = "measure_id"),
    @Index(name = "idx_value_set_oid", columnList = "oid")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MeasureValueSet {

    @Id
    @Column(length = 255)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measure_id", nullable = false)
    private Measure measure;

    @Column(length = 255)
    private String oid;

    @Column(length = 500)
    private String url;

    @Column(nullable = false, length = 500)
    private String name;

    @Column(length = 100)
    private String version;

    @Column(length = 255)
    private String publisher;

    @Column(columnDefinition = "TEXT")
    private String purpose;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ConfidenceLevel confidence;

    @Column
    @Builder.Default
    private Boolean verified = false;

    @Column(length = 255)
    private String source;

    // Codes in this value set
    @OneToMany(mappedBy = "valueSet", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<ValueSetCode> codes = new ArrayList<>();

    /**
     * Helper method to add a code.
     */
    public void addCode(ValueSetCode code) {
        codes.add(code);
        code.setValueSet(this);
    }
}
