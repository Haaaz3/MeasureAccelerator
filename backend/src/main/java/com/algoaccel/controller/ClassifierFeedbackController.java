package com.algoaccel.controller;

import com.algoaccel.dto.request.ClassifierFeedbackRequest;
import com.algoaccel.model.ClassifierFeedback;
import com.algoaccel.repository.ClassifierFeedbackRepository;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * REST controller for classifier feedback endpoints.
 * Records user confirmations/overrides of catalogue type detection
 * for future classifier improvement.
 */
@RestController
@RequestMapping("/api/classifier")
public class ClassifierFeedbackController {

    private static final Logger log = LoggerFactory.getLogger(ClassifierFeedbackController.class);

    private final ClassifierFeedbackRepository repository;

    // Valid programme values (matching frontend mapProgram() in transformers.js)
    private static final Set<String> VALID_TYPES = Set.of(
        "eCQM", "MIPS_CQM", "HEDIS", "QOF", "Registry", "Custom", "Clinical_Standard"
    );

    public ClassifierFeedbackController(ClassifierFeedbackRepository repository) {
        this.repository = repository;
    }

    /**
     * Record classifier feedback from a user confirmation/override.
     *
     * POST /api/classifier/feedback
     */
    @PostMapping("/feedback")
    public ResponseEntity<Map<String, Boolean>> recordFeedback(
            @Valid @RequestBody ClassifierFeedbackRequest request) {

        // Validate confirmedType
        if (!VALID_TYPES.contains(request.confirmedType())) {
            log.warn("[ClassifierFeedback] Invalid confirmedType: {}", request.confirmedType());
            return ResponseEntity.badRequest().body(Map.of("recorded", false));
        }

        // Build entity
        ClassifierFeedback feedback = ClassifierFeedback.builder()
            .documentName(request.documentName())
            .detectedType(request.detectedType())
            .confirmedType(request.confirmedType())
            .wasOverridden(request.wasOverridden())
            .confidence(request.confidence())
            .signals(request.signals() != null ? String.join("; ", request.signals()) : null)
            .build();

        // Persist
        repository.save(feedback);

        // Log at INFO level
        log.info("[ClassifierFeedback] Document: {}, Detected: {}, Confirmed: {}, Override: {}",
            request.documentName(),
            request.detectedType(),
            request.confirmedType(),
            request.wasOverridden());

        return ResponseEntity.ok(Map.of("recorded", true));
    }

    /**
     * Get feedback statistics (for analytics/debugging).
     *
     * GET /api/classifier/feedback/stats
     */
    @GetMapping("/feedback/stats")
    public ResponseEntity<Map<String, Object>> getFeedbackStats() {
        long totalCount = repository.count();
        long overrideCount = repository.findByWasOverriddenTrue().size();

        return ResponseEntity.ok(Map.of(
            "totalFeedback", totalCount,
            "overrideCount", overrideCount,
            "overrideRate", totalCount > 0 ? (double) overrideCount / totalCount : 0.0
        ));
    }
}
