package com.algoaccel.dto.response;

import com.algoaccel.model.validation.FhirTestPatient;

/**
 * Full detail DTO for FHIR test patients.
 * Includes the fhirBundle for individual patient detail view.
 */
public record FhirTestPatientDetailDto(
    String id,
    String measureId,
    String testCaseName,
    String description,
    String fhirBundle,
    Integer expectedIp,
    Integer expectedDen,
    Integer expectedDenex,
    Integer expectedNum,
    Integer expectedDenexcep,
    String patientGender,
    String patientBirthDate,
    String createdAt,
    String updatedAt
) {
    /**
     * Create from entity.
     */
    public static FhirTestPatientDetailDto fromEntity(FhirTestPatient entity) {
        return new FhirTestPatientDetailDto(
            entity.getId(),
            entity.getMeasureId(),
            entity.getTestCaseName(),
            entity.getDescription(),
            entity.getFhirBundle(),
            entity.getExpectedIp(),
            entity.getExpectedDen(),
            entity.getExpectedDenex(),
            entity.getExpectedNum(),
            entity.getExpectedDenexcep(),
            entity.getPatientGender(),
            entity.getPatientBirthDate(),
            entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null,
            entity.getUpdatedAt() != null ? entity.getUpdatedAt().toString() : null
        );
    }
}
