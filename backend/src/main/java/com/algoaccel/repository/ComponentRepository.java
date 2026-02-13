package com.algoaccel.repository;

import com.algoaccel.model.component.LibraryComponent;
import com.algoaccel.model.enums.ApprovalStatus;
import com.algoaccel.model.enums.ComponentCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for library components (both atomic and composite).
 */
@Repository
public interface ComponentRepository extends JpaRepository<LibraryComponent, String> {

    /**
     * Find components by category.
     */
    List<LibraryComponent> findByMetadataCategory(ComponentCategory category);

    /**
     * Find components by approval status.
     */
    List<LibraryComponent> findByVersionInfoStatus(ApprovalStatus status);

    /**
     * Find components by category and status.
     */
    List<LibraryComponent> findByMetadataCategoryAndVersionInfoStatus(
        ComponentCategory category, ApprovalStatus status);

    /**
     * Find approved components.
     */
    @Query("SELECT c FROM LibraryComponent c WHERE c.versionInfo.status = 'APPROVED'")
    List<LibraryComponent> findAllApproved();

    /**
     * Find non-archived components.
     */
    @Query("SELECT c FROM LibraryComponent c WHERE c.versionInfo.status != 'ARCHIVED'")
    List<LibraryComponent> findAllNonArchived();

    /**
     * Search components by name (case-insensitive).
     */
    @Query("SELECT c FROM LibraryComponent c WHERE LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<LibraryComponent> searchByName(@Param("query") String query);

    /**
     * Search components by name or description.
     */
    @Query("SELECT c FROM LibraryComponent c WHERE " +
           "LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(c.description) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<LibraryComponent> searchByNameOrDescription(@Param("query") String query);

    /**
     * Count components by category.
     */
    long countByMetadataCategory(ComponentCategory category);

    /**
     * Count components by status.
     */
    long countByVersionInfoStatus(ApprovalStatus status);
}
