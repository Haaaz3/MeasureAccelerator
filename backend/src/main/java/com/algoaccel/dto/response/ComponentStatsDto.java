package com.algoaccel.dto.response;

import java.util.Map;

/**
 * Response DTO for component library statistics.
 */
public record ComponentStatsDto(
    long totalComponents,
    Map<String, Long> byCategory,
    Map<String, Long> byStatus
) {}
