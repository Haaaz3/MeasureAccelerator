package com.algoaccel.controller;

import com.algoaccel.dto.mapper.ComponentMapper;
import com.algoaccel.dto.request.*;
import com.algoaccel.dto.response.*;
import com.algoaccel.model.component.*;
import com.algoaccel.model.enums.ApprovalStatus;
import com.algoaccel.model.enums.ComponentCategory;
import com.algoaccel.service.ComponentLibraryService;
import com.algoaccel.service.ComponentMatcherService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST controller for the component library.
 * Provides CRUD operations, search, filtering, and workflow endpoints.
 */
@RestController
@RequestMapping("/api/components")
public class ComponentLibraryController {

    private final ComponentLibraryService componentService;
    private final ComponentMatcherService matcherService;
    private final ComponentMapper componentMapper;

    public ComponentLibraryController(
            ComponentLibraryService componentService,
            ComponentMatcherService matcherService,
            ComponentMapper componentMapper) {
        this.componentService = componentService;
        this.matcherService = matcherService;
        this.componentMapper = componentMapper;
    }

    // ========================================================================
    // Read Operations
    // ========================================================================

    /**
     * Get all components (summary view).
     */
    @GetMapping
    public ResponseEntity<List<ComponentSummaryDto>> getAllComponents(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "false") boolean includeArchived) {

        List<LibraryComponent> components;

        if (search != null && !search.isEmpty()) {
            components = componentService.search(search);
        } else if (category != null && !category.isEmpty()) {
            ComponentCategory cat = ComponentCategory.fromValue(category);
            if (status != null && !status.isEmpty()) {
                ApprovalStatus stat = ApprovalStatus.fromValue(status);
                components = componentService.findByCategory(cat).stream()
                    .filter(c -> c.getVersionInfo() != null && c.getVersionInfo().getStatus() == stat)
                    .collect(Collectors.toList());
            } else {
                components = componentService.findByCategory(cat);
            }
        } else if (status != null && !status.isEmpty()) {
            ApprovalStatus stat = ApprovalStatus.fromValue(status);
            components = componentService.findByStatus(stat);
        } else {
            components = includeArchived ?
                componentService.findAllIncludingArchived() :
                componentService.findAll();
        }

        return ResponseEntity.ok(componentMapper.toSummaryDtoList(components));
    }

    /**
     * Get a single component by ID (full view).
     */
    @GetMapping("/{id}")
    public ResponseEntity<ComponentDto> getComponent(@PathVariable String id) {
        return componentService.findById(id)
            .map(componentMapper::toDto)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get library statistics.
     */
    @GetMapping("/stats")
    public ResponseEntity<ComponentStatsDto> getStats() {
        Map<ComponentCategory, Long> categoryCounts = componentService.getCategoryCounts();
        Map<ApprovalStatus, Long> statusCounts = componentService.getStatusCounts();

        long total = statusCounts.values().stream().mapToLong(Long::longValue).sum();

        // Convert enum maps to string maps for JSON
        Map<String, Long> byCategory = categoryCounts.entrySet().stream()
            .collect(Collectors.toMap(
                e -> e.getKey().getValue(),
                Map.Entry::getValue
            ));

        Map<String, Long> byStatus = statusCounts.entrySet().stream()
            .collect(Collectors.toMap(
                e -> e.getKey().getValue(),
                Map.Entry::getValue
            ));

        return ResponseEntity.ok(new ComponentStatsDto(total, byCategory, byStatus));
    }

    // ========================================================================
    // Create Operations
    // ========================================================================

    /**
     * Create a new atomic component.
     */
    @PostMapping("/atomic")
    public ResponseEntity<ComponentDto> createAtomicComponent(
            @Valid @RequestBody CreateAtomicComponentRequest request) {

        AtomicComponent entity = componentMapper.toEntity(request);
        LibraryComponent saved = componentService.create(entity);
        return ResponseEntity.status(HttpStatus.CREATED).body(componentMapper.toDto(saved));
    }

    /**
     * Create a new composite component.
     */
    @PostMapping("/composite")
    public ResponseEntity<ComponentDto> createCompositeComponent(
            @Valid @RequestBody CreateCompositeComponentRequest request) {

        CompositeComponent entity = componentMapper.toEntity(request);
        LibraryComponent saved = componentService.create(entity);
        return ResponseEntity.status(HttpStatus.CREATED).body(componentMapper.toDto(saved));
    }

    // ========================================================================
    // Update Operations
    // ========================================================================

    /**
     * Update a component.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ComponentDto> updateComponent(
            @PathVariable String id,
            @RequestBody UpdateComponentRequest request) {

        LibraryComponent existing = componentService.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Component not found: " + id));

        // Build an update entity from request
        LibraryComponent updates;
        if (existing instanceof AtomicComponent) {
            updates = new AtomicComponent();
        } else {
            updates = new CompositeComponent();
        }
        componentMapper.applyUpdates(updates, request);

        // Handle category separately (for re-inference logic)
        if (request.category() != null) {
            if (updates.getMetadata() == null) {
                updates.setMetadata(new ComponentMetadata());
            }
            updates.getMetadata().setCategory(ComponentCategory.fromValue(request.category()));
        }

        LibraryComponent saved = componentService.update(id, updates);
        return ResponseEntity.ok(componentMapper.toDto(saved));
    }

    /**
     * Set component category manually (disables auto-assignment).
     */
    @PutMapping("/{id}/category")
    public ResponseEntity<ComponentDto> setCategory(
            @PathVariable String id,
            @Valid @RequestBody SetCategoryRequest request) {

        ComponentCategory category = ComponentCategory.fromValue(request.category());
        LibraryComponent saved = componentService.setCategory(id, category);
        return ResponseEntity.ok(componentMapper.toDto(saved));
    }

    // ========================================================================
    // Delete Operations
    // ========================================================================

    /**
     * Delete a component.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteComponent(@PathVariable String id) {
        componentService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ========================================================================
    // Versioning Endpoints
    // ========================================================================

    /**
     * Create a new version of a component.
     */
    @PostMapping("/{id}/versions")
    public ResponseEntity<ComponentDto> createVersion(
            @PathVariable String id,
            @RequestBody CreateVersionRequest request) {

        LibraryComponent saved = componentService.createVersion(
            id,
            request.changeDescription(),
            request.createdBy()
        );
        return ResponseEntity.ok(componentMapper.toDto(saved));
    }

    /**
     * Approve a component.
     */
    @PostMapping("/{id}/approve")
    public ResponseEntity<ComponentDto> approveComponent(
            @PathVariable String id,
            @RequestBody ApproveComponentRequest request) {

        LibraryComponent saved = componentService.approve(id, request.approvedBy());
        return ResponseEntity.ok(componentMapper.toDto(saved));
    }

    /**
     * Archive a component.
     */
    @PostMapping("/{id}/archive")
    public ResponseEntity<ComponentDto> archiveComponent(@PathVariable String id) {
        LibraryComponent saved = componentService.archive(id, null);
        return ResponseEntity.ok(componentMapper.toDto(saved));
    }

    // ========================================================================
    // Usage Tracking
    // ========================================================================

    /**
     * Add a measure reference to component usage.
     */
    @PostMapping("/{id}/usage/{measureId}")
    public ResponseEntity<Void> addUsage(
            @PathVariable String id,
            @PathVariable String measureId) {

        componentService.addUsage(id, measureId);
        return ResponseEntity.ok().build();
    }

    /**
     * Remove a measure reference from component usage.
     */
    @DeleteMapping("/{id}/usage/{measureId}")
    public ResponseEntity<Void> removeUsage(
            @PathVariable String id,
            @PathVariable String measureId) {

        componentService.removeUsage(id, measureId);
        return ResponseEntity.noContent().build();
    }

    // ========================================================================
    // Matching Endpoints
    // ========================================================================

    /**
     * Get readable identity string for a component.
     */
    @GetMapping("/{id}/identity")
    public ResponseEntity<Map<String, String>> getComponentIdentity(@PathVariable String id) {
        return componentService.findById(id)
            .map(component -> {
                String hash = matcherService.generateComponentHash(component);
                String readable = matcherService.getReadableIdentity(component);
                return ResponseEntity.ok(Map.of(
                    "hash", hash,
                    "readable", readable
                ));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Check if two components are identical.
     */
    @GetMapping("/compare")
    public ResponseEntity<Map<String, Object>> compareComponents(
            @RequestParam String id1,
            @RequestParam String id2) {

        LibraryComponent comp1 = componentService.findById(id1)
            .orElseThrow(() -> new EntityNotFoundException("Component not found: " + id1));
        LibraryComponent comp2 = componentService.findById(id2)
            .orElseThrow(() -> new EntityNotFoundException("Component not found: " + id2));

        boolean identical = matcherService.areComponentsIdentical(comp1, comp2);

        return ResponseEntity.ok(Map.of(
            "identical", identical,
            "hash1", matcherService.generateComponentHash(comp1),
            "hash2", matcherService.generateComponentHash(comp2)
        ));
    }

    // ========================================================================
    // Exception Handling
    // ========================================================================

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(EntityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", ex.getMessage()));
    }
}
