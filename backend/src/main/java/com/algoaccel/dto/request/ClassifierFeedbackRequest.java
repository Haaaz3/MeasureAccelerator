package com.algoaccel.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

/**
 * Request DTO for recording classifier feedback.
 * Captures user confirmations/overrides of catalogue type detection.
 */
public record ClassifierFeedbackRequest(
    String documentName,
    String detectedType,
    @NotBlank(message = "confirmedType is required")
    String confirmedType,
    boolean wasOverridden,
    String confidence,
    List<String> signals,
    String timestamp
) {}
