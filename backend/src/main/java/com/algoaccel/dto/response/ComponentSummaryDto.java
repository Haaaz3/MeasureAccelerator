package com.algoaccel.dto.response;

import java.time.LocalDateTime;

/**
 * Lightweight summary DTO for component list views.
 */
public record ComponentSummaryDto(
    String id,
    String type,
    String name,
    String description,
    String category,
    String status,
    String complexityLevel,
    int usageCount,
    LocalDateTime updatedAt
) {}
