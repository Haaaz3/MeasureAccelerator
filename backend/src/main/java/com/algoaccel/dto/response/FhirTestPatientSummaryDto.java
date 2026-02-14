package com.algoaccel.dto.response;

/**
 * Summary DTO for FHIR test patients.
 * Excludes the large fhirBundle field for list responses.
 */
public record FhirTestPatientSummaryDto(
    String id,
    String measureId,
    String testCaseName,
    String description,
    Integer expectedIp,
    Integer expectedDen,
    Integer expectedDenex,
    Integer expectedNum,
    Integer expectedDenexcep,
    String patientGender,
    String patientBirthDate
) {
    /**
     * Convenience method to get expected populations as a formatted string.
     */
    public String getExpectedPopulationsFormatted() {
        return String.format("IP=%d DEN=%d DENEX=%d NUM=%d DENEXCEP=%d",
            expectedIp, expectedDen, expectedDenex, expectedNum, expectedDenexcep);
    }
}
