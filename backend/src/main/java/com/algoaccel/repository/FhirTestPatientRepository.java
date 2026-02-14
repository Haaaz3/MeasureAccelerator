package com.algoaccel.repository;

import com.algoaccel.model.validation.FhirTestPatient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for FHIR test patients.
 */
@Repository
public interface FhirTestPatientRepository extends JpaRepository<FhirTestPatient, String> {

    /**
     * Find all test patients for a specific measure.
     * Note: This returns full entities including fhirBundle.
     * For list views, use the summary projection query instead.
     */
    List<FhirTestPatient> findByMeasureId(String measureId);

    /**
     * Find test patients by measure ID, ordered by test case name.
     */
    List<FhirTestPatient> findByMeasureIdOrderByTestCaseName(String measureId);

    /**
     * Count test patients for a measure.
     */
    long countByMeasureId(String measureId);

    /**
     * Find test patients by measure ID without the large fhirBundle field.
     * Returns a projection with summary data only.
     */
    @Query("""
        SELECT new com.algoaccel.dto.response.FhirTestPatientSummaryDto(
            p.id, p.measureId, p.testCaseName, p.description,
            p.expectedIp, p.expectedDen, p.expectedDenex, p.expectedNum, p.expectedDenexcep,
            p.patientGender, p.patientBirthDate
        )
        FROM FhirTestPatient p
        WHERE p.measureId = :measureId
        ORDER BY p.testCaseName
        """)
    List<com.algoaccel.dto.response.FhirTestPatientSummaryDto> findSummariesByMeasureId(
            @Param("measureId") String measureId);

    /**
     * Find all test patients as summaries (without fhirBundle).
     */
    @Query("""
        SELECT new com.algoaccel.dto.response.FhirTestPatientSummaryDto(
            p.id, p.measureId, p.testCaseName, p.description,
            p.expectedIp, p.expectedDen, p.expectedDenex, p.expectedNum, p.expectedDenexcep,
            p.patientGender, p.patientBirthDate
        )
        FROM FhirTestPatient p
        ORDER BY p.measureId, p.testCaseName
        """)
    List<com.algoaccel.dto.response.FhirTestPatientSummaryDto> findAllSummaries();

    /**
     * Check if a test case with the same name exists for a measure.
     */
    boolean existsByMeasureIdAndTestCaseName(String measureId, String testCaseName);
}
