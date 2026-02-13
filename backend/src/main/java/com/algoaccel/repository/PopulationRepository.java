package com.algoaccel.repository;

import com.algoaccel.model.enums.PopulationType;
import com.algoaccel.model.measure.Population;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for populations.
 */
@Repository
public interface PopulationRepository extends JpaRepository<Population, String> {

    /**
     * Find populations by measure ID.
     */
    List<Population> findByMeasureIdOrderByDisplayOrder(String measureId);

    /**
     * Find population by measure ID and type.
     */
    Optional<Population> findByMeasureIdAndPopulationType(String measureId, PopulationType type);

    /**
     * Find population with root clause eagerly loaded.
     */
    @EntityGraph(attributePaths = {"rootClause", "rootClause.childClauses", "rootClause.dataElements"})
    @Query("SELECT p FROM Population p WHERE p.id = :id")
    Optional<Population> findByIdWithRootClause(@Param("id") String id);
}
