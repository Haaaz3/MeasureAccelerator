package com.algoaccel.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * Request DTO for manually setting a component's category.
 */
public record SetCategoryRequest(
    @NotBlank(message = "Category is required")
    String category
) {}
