package com.algoaccel.repository;

import com.algoaccel.model.validation.TestPatient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for test patients.
 */
@Repository
public interface TestPatientRepository extends JpaRepository<TestPatient, String> {

    /**
     * Find all patients ordered by name.
     */
    List<TestPatient> findAllByOrderByName();

    /**
     * Find patients by gender.
     */
    List<TestPatient> findByGender(String gender);

    /**
     * Count patients by gender.
     */
    long countByGender(String gender);
}
