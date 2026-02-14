package com.algoaccel.controller;

import com.algoaccel.dto.response.FhirTestPatientDetailDto;
import com.algoaccel.dto.response.FhirTestPatientSummaryDto;
import com.algoaccel.model.validation.FhirTestPatient;
import com.algoaccel.repository.FhirTestPatientRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST controller for FHIR test patient operations.
 * Handles CMS-validated FHIR test patients with expected population results.
 */
@RestController
@RequestMapping("/api/test-patients")
@RequiredArgsConstructor
@Slf4j
public class FhirTestPatientController {

    private final FhirTestPatientRepository fhirTestPatientRepository;
    private final ObjectMapper objectMapper;

    /**
     * Get all test patients as summaries (without FHIR bundle).
     * Optionally filter by measureId query parameter.
     */
    @GetMapping
    public ResponseEntity<List<FhirTestPatientSummaryDto>> getAllTestPatients(
            @RequestParam(required = false) String measureId) {

        List<FhirTestPatientSummaryDto> summaries;
        if (measureId != null && !measureId.isBlank()) {
            log.info("Fetching test patients for measure: {}", measureId);
            summaries = fhirTestPatientRepository.findSummariesByMeasureId(measureId);
        } else {
            log.info("Fetching all test patients");
            summaries = fhirTestPatientRepository.findAllSummaries();
        }

        return ResponseEntity.ok(summaries);
    }

    /**
     * Get a specific test patient with full detail (including FHIR bundle).
     */
    @GetMapping("/{id}")
    public ResponseEntity<FhirTestPatientDetailDto> getTestPatient(@PathVariable String id) {
        return fhirTestPatientRepository.findById(id)
            .map(FhirTestPatientDetailDto::fromEntity)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get count of test patients for a measure.
     */
    @GetMapping("/count")
    public ResponseEntity<Map<String, Long>> getTestPatientCount(
            @RequestParam(required = false) String measureId) {

        long count;
        if (measureId != null && !measureId.isBlank()) {
            count = fhirTestPatientRepository.countByMeasureId(measureId);
        } else {
            count = fhirTestPatientRepository.count();
        }

        return ResponseEntity.ok(Map.of("count", count));
    }

    /**
     * Import a FHIR Bundle JSON and extract expected populations from MeasureReport.
     * The bundle should contain Patient resources and optionally MeasureReport for expected results.
     */
    @PostMapping("/import")
    public ResponseEntity<?> importFhirBundle(@RequestBody ImportRequest request) {
        try {
            log.info("Importing FHIR bundle for measure: {}", request.measureId());

            JsonNode bundleJson = objectMapper.readTree(request.fhirBundle());

            // Validate it's a FHIR Bundle
            String resourceType = bundleJson.path("resourceType").asText();
            if (!"Bundle".equals(resourceType)) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Expected FHIR Bundle, got: " + resourceType));
            }

            // Extract patient info and expected populations
            FhirTestPatient patient = new FhirTestPatient();
            patient.setId(request.id() != null ? request.id() : UUID.randomUUID().toString());
            patient.setMeasureId(request.measureId());
            patient.setTestCaseName(request.testCaseName());
            patient.setDescription(request.description());
            patient.setFhirBundle(request.fhirBundle());

            // Set expected populations from request or defaults
            patient.setExpectedIp(request.expectedIp() != null ? request.expectedIp() : 0);
            patient.setExpectedDen(request.expectedDen() != null ? request.expectedDen() : 0);
            patient.setExpectedDenex(request.expectedDenex() != null ? request.expectedDenex() : 0);
            patient.setExpectedNum(request.expectedNum() != null ? request.expectedNum() : 0);
            patient.setExpectedDenexcep(request.expectedDenexcep() != null ? request.expectedDenexcep() : 0);

            // Try to extract patient demographics from bundle
            extractPatientDemographics(bundleJson, patient);

            // Try to extract expected populations from MeasureReport in bundle
            extractExpectedPopulationsFromBundle(bundleJson, patient);

            // Check if already exists
            if (fhirTestPatientRepository.existsByMeasureIdAndTestCaseName(
                    patient.getMeasureId(), patient.getTestCaseName())) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Test case already exists for this measure: " + patient.getTestCaseName()));
            }

            FhirTestPatient saved = fhirTestPatientRepository.save(patient);
            log.info("Imported test patient: {} for measure: {}", saved.getTestCaseName(), saved.getMeasureId());

            return ResponseEntity.status(HttpStatus.CREATED)
                .body(FhirTestPatientDetailDto.fromEntity(saved));

        } catch (Exception e) {
            log.error("Failed to import FHIR bundle", e);
            return ResponseEntity.badRequest()
                .body(Map.of("error", "Failed to parse FHIR bundle: " + e.getMessage()));
        }
    }

    /**
     * Bulk import multiple test patients.
     */
    @PostMapping("/import/bulk")
    public ResponseEntity<?> bulkImportFhirBundles(@RequestBody List<ImportRequest> requests) {
        int imported = 0;
        int skipped = 0;
        int failed = 0;

        for (ImportRequest request : requests) {
            try {
                JsonNode bundleJson = objectMapper.readTree(request.fhirBundle());

                FhirTestPatient patient = new FhirTestPatient();
                patient.setId(request.id() != null ? request.id() : UUID.randomUUID().toString());
                patient.setMeasureId(request.measureId());
                patient.setTestCaseName(request.testCaseName());
                patient.setDescription(request.description());
                patient.setFhirBundle(request.fhirBundle());
                patient.setExpectedIp(request.expectedIp() != null ? request.expectedIp() : 0);
                patient.setExpectedDen(request.expectedDen() != null ? request.expectedDen() : 0);
                patient.setExpectedDenex(request.expectedDenex() != null ? request.expectedDenex() : 0);
                patient.setExpectedNum(request.expectedNum() != null ? request.expectedNum() : 0);
                patient.setExpectedDenexcep(request.expectedDenexcep() != null ? request.expectedDenexcep() : 0);

                extractPatientDemographics(bundleJson, patient);
                extractExpectedPopulationsFromBundle(bundleJson, patient);

                if (fhirTestPatientRepository.existsByMeasureIdAndTestCaseName(
                        patient.getMeasureId(), patient.getTestCaseName())) {
                    skipped++;
                    continue;
                }

                fhirTestPatientRepository.save(patient);
                imported++;

            } catch (Exception e) {
                log.warn("Failed to import test patient: {}", request.testCaseName(), e);
                failed++;
            }
        }

        return ResponseEntity.ok(Map.of(
            "imported", imported,
            "skipped", skipped,
            "failed", failed,
            "total", requests.size()
        ));
    }

    /**
     * Delete a test patient.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTestPatient(@PathVariable String id) {
        if (!fhirTestPatientRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        fhirTestPatientRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Extract patient demographics from FHIR bundle.
     */
    private void extractPatientDemographics(JsonNode bundleJson, FhirTestPatient patient) {
        JsonNode entries = bundleJson.path("entry");
        if (!entries.isArray()) return;

        for (JsonNode entry : entries) {
            JsonNode resource = entry.path("resource");
            if ("Patient".equals(resource.path("resourceType").asText())) {
                // Extract gender
                String gender = resource.path("gender").asText(null);
                if (gender != null) {
                    patient.setPatientGender(gender);
                }

                // Extract birth date
                String birthDate = resource.path("birthDate").asText(null);
                if (birthDate != null) {
                    patient.setPatientBirthDate(birthDate);
                }

                break; // Found patient, stop looking
            }
        }
    }

    /**
     * Extract expected populations from MeasureReport in FHIR bundle.
     * CMS test bundles typically include the expected MeasureReport.
     */
    private void extractExpectedPopulationsFromBundle(JsonNode bundleJson, FhirTestPatient patient) {
        JsonNode entries = bundleJson.path("entry");
        if (!entries.isArray()) return;

        for (JsonNode entry : entries) {
            JsonNode resource = entry.path("resource");
            if ("MeasureReport".equals(resource.path("resourceType").asText())) {
                JsonNode groups = resource.path("group");
                if (!groups.isArray() || groups.isEmpty()) continue;

                JsonNode firstGroup = groups.get(0);
                JsonNode populations = firstGroup.path("population");
                if (!populations.isArray()) continue;

                for (JsonNode population : populations) {
                    String code = population.path("code").path("coding").path(0).path("code").asText();
                    int count = population.path("count").asInt(0);

                    switch (code) {
                        case "initial-population" -> patient.setExpectedIp(count);
                        case "denominator" -> patient.setExpectedDen(count);
                        case "denominator-exclusion" -> patient.setExpectedDenex(count);
                        case "numerator" -> patient.setExpectedNum(count);
                        case "denominator-exception" -> patient.setExpectedDenexcep(count);
                    }
                }

                break; // Found MeasureReport, stop looking
            }
        }
    }

    /**
     * Request DTO for importing FHIR bundles.
     */
    public record ImportRequest(
        String id,
        String measureId,
        String testCaseName,
        String description,
        String fhirBundle,
        Integer expectedIp,
        Integer expectedDen,
        Integer expectedDenex,
        Integer expectedNum,
        Integer expectedDenexcep
    ) {}
}
