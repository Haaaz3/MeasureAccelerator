package com.algoaccel.model.component;

import com.algoaccel.model.enums.ApprovalStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Embeddable version information for a component.
 * Tracks version history and approval workflow.
 */
@Embeddable
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComponentVersionInfo {

    @Column(name = "version_id")
    private String versionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "version_status")
    private ApprovalStatus status;

    /**
     * JSON array of VersionHistoryEntry objects.
     * Each entry contains: versionId, status, createdAt, createdBy, changeDescription, supersededBy
     */
    @Column(name = "version_history", columnDefinition = "TEXT")
    private String versionHistory;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;
}
