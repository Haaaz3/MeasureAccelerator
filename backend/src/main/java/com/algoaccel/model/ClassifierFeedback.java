package com.algoaccel.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Entity for storing classifier feedback/training signals.
 * Records user confirmations and overrides of catalogue type detection
 * for future classifier improvement.
 */
@Entity
@Table(name = "classifier_feedback")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassifierFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_name", length = 500)
    private String documentName;

    @Column(name = "detected_type", length = 50)
    private String detectedType;

    @Column(name = "confirmed_type", length = 50, nullable = false)
    private String confirmedType;

    @Column(name = "was_overridden", nullable = false)
    private Boolean wasOverridden = false;

    @Column(name = "confidence", length = 20)
    private String confidence;

    @Column(name = "signals", columnDefinition = "TEXT")
    private String signals;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
