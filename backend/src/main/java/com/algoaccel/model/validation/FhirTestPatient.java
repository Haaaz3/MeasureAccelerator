package com.algoaccel.model.validation;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Entity for storing FHIR test patients for measure validation.
 * Each record contains a full FHIR Bundle JSON along with expected
 * population results from CMS-validated MeasureReports.
 */
@Entity
@Table(name = "fhir_test_patient")
@Getter
@Setter
@NoArgsConstructor
public class FhirTestPatient {

    @Id
    private String id;

    @Column(name = "measure_id", nullable = false, length = 100)
    private String measureId;

    @Column(name = "test_case_name", nullable = false, length = 500)
    private String testCaseName;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "fhir_bundle", nullable = false, columnDefinition = "TEXT")
    private String fhirBundle;

    // Expected population results
    @Column(name = "expected_ip", nullable = false)
    private Integer expectedIp = 0;

    @Column(name = "expected_den", nullable = false)
    private Integer expectedDen = 0;

    @Column(name = "expected_denex", nullable = false)
    private Integer expectedDenex = 0;

    @Column(name = "expected_num", nullable = false)
    private Integer expectedNum = 0;

    @Column(name = "expected_denexcep", nullable = false)
    private Integer expectedDenexcep = 0;

    // Extracted patient demographics
    @Column(name = "patient_gender", length = 20)
    private String patientGender;

    @Column(name = "patient_birth_date", length = 20)
    private String patientBirthDate;

    // Audit
    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    /**
     * Create a new test patient with all expected values.
     */
    public FhirTestPatient(String id, String measureId, String testCaseName, String description,
                           String fhirBundle, int expectedIp, int expectedDen, int expectedDenex,
                           int expectedNum, int expectedDenexcep) {
        this.id = id;
        this.measureId = measureId;
        this.testCaseName = testCaseName;
        this.description = description;
        this.fhirBundle = fhirBundle;
        this.expectedIp = expectedIp;
        this.expectedDen = expectedDen;
        this.expectedDenex = expectedDenex;
        this.expectedNum = expectedNum;
        this.expectedDenexcep = expectedDenexcep;
    }
}
