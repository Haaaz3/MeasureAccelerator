package com.algoaccel.model.validation;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

/**
 * Test patient for measure validation.
 * Contains static clinical data used to test measure criteria.
 */
@Entity
@Table(name = "test_patient")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestPatient {

    @Id
    @Column(length = 255)
    private String id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "birth_date", nullable = false)
    private LocalDate birthDate;

    @Column(nullable = false, length = 20)
    private String gender;

    @Column(length = 100)
    private String race;

    @Column(length = 100)
    private String ethnicity;

    /**
     * JSON array of PatientDiagnosis objects.
     * Each diagnosis has: code, system, display, onsetDate, status
     */
    @Column(columnDefinition = "TEXT")
    private String diagnoses;

    /**
     * JSON array of PatientEncounter objects.
     * Each encounter has: code, system, display, date, type
     */
    @Column(columnDefinition = "TEXT")
    private String encounters;

    /**
     * JSON array of PatientProcedure objects.
     * Each procedure has: code, system, display, date
     */
    @Column(columnDefinition = "TEXT")
    private String procedures;

    /**
     * JSON array of PatientObservation objects.
     * Each observation has: code, system, display, value, unit, date
     */
    @Column(columnDefinition = "TEXT")
    private String observations;

    /**
     * JSON array of PatientMedication objects.
     * Each medication has: code, system, display, startDate, endDate, status
     */
    @Column(columnDefinition = "TEXT")
    private String medications;

    /**
     * JSON array of PatientImmunization objects.
     * Each immunization has: code, system, display, date
     */
    @Column(columnDefinition = "TEXT")
    private String immunizations;
}
