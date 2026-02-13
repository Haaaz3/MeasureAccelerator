package com.algoaccel.repository;

import com.algoaccel.model.measure.MeasureValueSet;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for measure value sets.
 */
@Repository
public interface ValueSetRepository extends JpaRepository<MeasureValueSet, String> {

    /**
     * Find value sets by measure ID.
     */
    List<MeasureValueSet> findByMeasureId(String measureId);

    /**
     * Find value set by OID.
     */
    Optional<MeasureValueSet> findByOid(String oid);

    /**
     * Find value set by measure ID and OID.
     */
    Optional<MeasureValueSet> findByMeasureIdAndOid(String measureId, String oid);

    /**
     * Find value set with codes eagerly loaded.
     */
    @EntityGraph(attributePaths = {"codes"})
    @Query("SELECT vs FROM MeasureValueSet vs WHERE vs.id = :id")
    Optional<MeasureValueSet> findByIdWithCodes(@Param("id") String id);

    /**
     * Search value sets by name.
     */
    @Query("SELECT vs FROM MeasureValueSet vs WHERE LOWER(vs.name) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<MeasureValueSet> searchByName(@Param("query") String query);
}
