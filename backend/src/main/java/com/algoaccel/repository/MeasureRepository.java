package com.algoaccel.repository;

import com.algoaccel.model.enums.MeasureProgram;
import com.algoaccel.model.enums.MeasureStatus;
import com.algoaccel.model.measure.Measure;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for measures.
 */
@Repository
public interface MeasureRepository extends JpaRepository<Measure, String> {

    /**
     * Find measure by CMS measure ID (e.g., "CMS130v11").
     */
    Optional<Measure> findByMeasureId(String measureId);

    /**
     * Find measures by program.
     */
    List<Measure> findByProgram(MeasureProgram program);

    /**
     * Find measures by status.
     */
    List<Measure> findByStatus(MeasureStatus status);

    /**
     * Find measures with populations eagerly loaded.
     */
    @EntityGraph(attributePaths = {"populations"})
    @Query("SELECT m FROM Measure m")
    List<Measure> findAllWithPopulations();

    /**
     * Find measure by ID with full tree eagerly loaded.
     * This avoids lazy loading issues when mapping to DTOs.
     */
    @EntityGraph(attributePaths = {"populations", "populations.rootClause", "valueSets"})
    @Query("SELECT m FROM Measure m WHERE m.id = :id")
    Optional<Measure> findByIdWithFullTree(@Param("id") String id);

    /**
     * Find measure by ID with populations only.
     */
    @EntityGraph(attributePaths = {"populations"})
    @Query("SELECT m FROM Measure m WHERE m.id = :id")
    Optional<Measure> findByIdWithPopulations(@Param("id") String id);

    /**
     * Search measures by title.
     */
    @Query("SELECT m FROM Measure m WHERE LOWER(m.title) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Measure> searchByTitle(@Param("query") String query);

    /**
     * Count measures by status.
     */
    long countByStatus(MeasureStatus status);

    /**
     * Count measures by program.
     */
    long countByProgram(MeasureProgram program);
}
