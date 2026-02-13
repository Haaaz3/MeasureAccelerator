package com.algoaccel.model.measure;

import com.algoaccel.model.enums.CodeSystem;
import jakarta.persistence.*;
import lombok.*;

/**
 * Individual code within a value set.
 */
@Entity
@Table(name = "value_set_code", indexes = {
    @Index(name = "idx_code_value_set", columnList = "value_set_id"),
    @Index(name = "idx_code_system", columnList = "code_system")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValueSetCode {

    @Id
    @Column(length = 255)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "value_set_id", nullable = false)
    private MeasureValueSet valueSet;

    @Column(nullable = false, length = 100)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "code_system", nullable = false, length = 50)
    private CodeSystem codeSystem;

    @Column(name = "system_uri", length = 500)
    private String systemUri;

    @Column(length = 500)
    private String display;

    @Column(length = 100)
    private String version;
}
