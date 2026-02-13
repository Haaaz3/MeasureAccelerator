package com.algoaccel.repository;

import com.algoaccel.model.measure.LogicalClause;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for logical clauses.
 */
@Repository
public interface LogicalClauseRepository extends JpaRepository<LogicalClause, String> {

    /**
     * Find child clauses by parent ID.
     */
    List<LogicalClause> findByParentClauseIdOrderByDisplayOrder(String parentClauseId);

    /**
     * Find root clauses (no parent).
     */
    @Query("SELECT c FROM LogicalClause c WHERE c.parentClause IS NULL")
    List<LogicalClause> findRootClauses();

    /**
     * Find clause with children and data elements eagerly loaded.
     */
    @EntityGraph(attributePaths = {"childClauses", "dataElements"})
    @Query("SELECT c FROM LogicalClause c WHERE c.id = :id")
    Optional<LogicalClause> findByIdWithChildren(@Param("id") String id);
}
