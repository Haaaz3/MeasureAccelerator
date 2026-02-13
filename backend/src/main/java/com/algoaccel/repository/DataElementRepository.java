package com.algoaccel.repository;

import com.algoaccel.model.enums.DataElementType;
import com.algoaccel.model.measure.DataElement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for data elements.
 */
@Repository
public interface DataElementRepository extends JpaRepository<DataElement, String> {

    /**
     * Find data elements by clause ID.
     */
    List<DataElement> findByClauseIdOrderByDisplayOrder(String clauseId);

    /**
     * Find data elements by element type.
     */
    List<DataElement> findByElementType(DataElementType type);

    /**
     * Find data elements linked to a library component.
     */
    List<DataElement> findByLibraryComponentId(String componentId);

    /**
     * Find data elements using a specific library component across all measures.
     */
    @Query("SELECT de FROM DataElement de WHERE de.libraryComponent.id = :componentId")
    List<DataElement> findByLibraryComponentIdWithMeasure(@Param("componentId") String componentId);

    /**
     * Count data elements using a library component.
     */
    long countByLibraryComponentId(String componentId);
}
