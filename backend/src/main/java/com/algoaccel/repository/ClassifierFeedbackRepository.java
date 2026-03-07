package com.algoaccel.repository;

import com.algoaccel.model.ClassifierFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for classifier feedback entries.
 */
@Repository
public interface ClassifierFeedbackRepository extends JpaRepository<ClassifierFeedback, Long> {

    /**
     * Find feedback entries by confirmed type.
     */
    List<ClassifierFeedback> findByConfirmedType(String confirmedType);

    /**
     * Find feedback entries where the user overrode the detection.
     */
    List<ClassifierFeedback> findByWasOverriddenTrue();

    /**
     * Find feedback entries created after a given timestamp.
     */
    List<ClassifierFeedback> findByCreatedAtAfter(LocalDateTime timestamp);

    /**
     * Count overrides by detected type.
     */
    long countByDetectedTypeAndWasOverriddenTrue(String detectedType);
}
