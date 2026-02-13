package com.algoaccel.dto.request;

/**
 * Request DTO for creating a new version of a component.
 */
public record CreateVersionRequest(
    String changeDescription,
    String createdBy
) {}
