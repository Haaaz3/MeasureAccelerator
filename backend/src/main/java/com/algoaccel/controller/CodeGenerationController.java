package com.algoaccel.controller;

import com.algoaccel.service.CqlGeneratorService;
import com.algoaccel.service.CqlGeneratorService.CqlGenerationResult;
import com.algoaccel.service.hdi.HdiSqlGeneratorService;
import com.algoaccel.service.hdi.HdiSqlGeneratorService.SqlGenerationResult;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST controller for code generation endpoints.
 * Generates CQL and HDI SQL from measure specifications.
 */
@RestController
@RequestMapping("/api/measures")
public class CodeGenerationController {

    private final CqlGeneratorService cqlGeneratorService;
    private final HdiSqlGeneratorService hdiSqlGeneratorService;

    public CodeGenerationController(
            CqlGeneratorService cqlGeneratorService,
            HdiSqlGeneratorService hdiSqlGeneratorService) {
        this.cqlGeneratorService = cqlGeneratorService;
        this.hdiSqlGeneratorService = hdiSqlGeneratorService;
    }

    // ========================================================================
    // CQL Generation Endpoints
    // ========================================================================

    /**
     * Generate CQL for a measure.
     *
     * @param measureId The measure ID (primary key)
     * @return Generated CQL library code
     */
    @GetMapping("/{measureId}/cql")
    public ResponseEntity<CqlResponse> generateCql(@PathVariable String measureId) {
        CqlGenerationResult result = cqlGeneratorService.generateCql(measureId);

        if (!result.success()) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(new CqlResponse(
                    false,
                    null,
                    result.errors(),
                    result.warnings(),
                    null
                ));
        }

        return ResponseEntity.ok(new CqlResponse(
            true,
            result.cql(),
            null,
            result.warnings(),
            new CqlMetadataResponse(
                result.metadata().libraryName(),
                result.metadata().version(),
                result.metadata().populationCount(),
                result.metadata().valueSetCount(),
                result.metadata().definitionCount()
            )
        ));
    }

    /**
     * Preview CQL generation without persisting.
     */
    @PostMapping("/{measureId}/cql/preview")
    public ResponseEntity<CqlResponse> previewCql(@PathVariable String measureId) {
        // Same as generate but marked as preview
        return generateCql(measureId);
    }

    // ========================================================================
    // HDI SQL Generation Endpoints
    // ========================================================================

    /**
     * Generate HDI SQL for a measure.
     *
     * @param measureId The measure ID (primary key)
     * @param populationId HDI population_id parameter (optional, defaults to placeholder)
     * @return Generated SQL query
     */
    @GetMapping("/{measureId}/sql")
    public ResponseEntity<SqlResponse> generateSql(
            @PathVariable String measureId,
            @RequestParam(required = false, defaultValue = "${POPULATION_ID}") String populationId) {

        SqlGenerationResult result = hdiSqlGeneratorService.generateHdiSql(measureId, populationId);

        if (!result.success()) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(new SqlResponse(
                    false,
                    null,
                    result.errors(),
                    result.warnings(),
                    null
                ));
        }

        return ResponseEntity.ok(new SqlResponse(
            true,
            result.sql(),
            null,
            result.warnings(),
            new SqlMetadataResponse(
                result.metadata().predicateCount(),
                result.metadata().dataModelsUsed(),
                result.metadata().estimatedComplexity(),
                result.metadata().generatedAt()
            )
        ));
    }

    /**
     * Preview HDI SQL generation without persisting.
     */
    @PostMapping("/{measureId}/sql/preview")
    public ResponseEntity<SqlResponse> previewSql(
            @PathVariable String measureId,
            @RequestBody(required = false) SqlPreviewRequest request) {

        String populationId = (request != null && request.populationId() != null) ?
            request.populationId() : "${POPULATION_ID}";

        return generateSql(measureId, populationId);
    }

    // ========================================================================
    // Combined Generation Endpoint
    // ========================================================================

    /**
     * Generate both CQL and SQL for a measure in one request.
     */
    @GetMapping("/{measureId}/code")
    public ResponseEntity<CombinedCodeResponse> generateAllCode(
            @PathVariable String measureId,
            @RequestParam(required = false, defaultValue = "${POPULATION_ID}") String populationId) {

        CqlGenerationResult cqlResult = cqlGeneratorService.generateCql(measureId);
        SqlGenerationResult sqlResult = hdiSqlGeneratorService.generateHdiSql(measureId, populationId);

        return ResponseEntity.ok(new CombinedCodeResponse(
            new CqlResponse(
                cqlResult.success(),
                cqlResult.cql(),
                cqlResult.errors(),
                cqlResult.warnings(),
                cqlResult.success() ? new CqlMetadataResponse(
                    cqlResult.metadata().libraryName(),
                    cqlResult.metadata().version(),
                    cqlResult.metadata().populationCount(),
                    cqlResult.metadata().valueSetCount(),
                    cqlResult.metadata().definitionCount()
                ) : null
            ),
            new SqlResponse(
                sqlResult.success(),
                sqlResult.sql(),
                sqlResult.errors(),
                sqlResult.warnings(),
                sqlResult.success() ? new SqlMetadataResponse(
                    sqlResult.metadata().predicateCount(),
                    sqlResult.metadata().dataModelsUsed(),
                    sqlResult.metadata().estimatedComplexity(),
                    sqlResult.metadata().generatedAt()
                ) : null
            )
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

    // ========================================================================
    // Response DTOs
    // ========================================================================

    public record CqlResponse(
        boolean success,
        String cql,
        java.util.List<String> errors,
        java.util.List<String> warnings,
        CqlMetadataResponse metadata
    ) {}

    public record CqlMetadataResponse(
        String libraryName,
        String version,
        int populationCount,
        int valueSetCount,
        int definitionCount
    ) {}

    public record SqlResponse(
        boolean success,
        String sql,
        java.util.List<String> errors,
        java.util.List<String> warnings,
        SqlMetadataResponse metadata
    ) {}

    public record SqlMetadataResponse(
        int predicateCount,
        java.util.List<String> dataModelsUsed,
        String estimatedComplexity,
        String generatedAt
    ) {}

    public record CombinedCodeResponse(
        CqlResponse cql,
        SqlResponse sql
    ) {}

    public record SqlPreviewRequest(
        String populationId,
        String intakePeriodStart,
        String intakePeriodEnd
    ) {}
}
