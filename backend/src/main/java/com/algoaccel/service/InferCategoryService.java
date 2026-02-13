package com.algoaccel.service;

import com.algoaccel.model.component.*;
import com.algoaccel.model.enums.ComponentCategory;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Category Inference Service
 *
 * Determines the most appropriate category for a component based on its properties.
 * Used for auto-categorization when creating new components.
 *
 * Priority order:
 * 1. Exclusion detection (keywords in name/description)
 * 2. Patient resource type or genderValue → Demographics
 * 3. Age-related components → Demographics
 * 4. Resource type mapping (Encounter, Condition, Procedure, etc.)
 * 5. Value set analysis (LOINC codes, keywords)
 * 6. Value set name patterns
 * 7. Default: clinical-observations
 */
@Service
public class InferCategoryService {

    private final ObjectMapper objectMapper;

    // Common LOINC lab code prefixes and keywords
    private static final Set<String> LAB_KEYWORDS = Set.of(
        "hba1c", "hemoglobin a1c", "glycated", "glucose", "cholesterol", "ldl", "hdl",
        "triglyceride", "creatinine", "egfr", "bun", "blood urea", "potassium", "sodium",
        "calcium", "magnesium", "albumin", "bilirubin", "ast", "alt", "alkaline phosphatase",
        "tsh", "thyroid", "t3", "t4", "hemoglobin", "hematocrit", "platelet", "wbc", "rbc",
        "inr", "pt", "ptt", "blood count", "cbc", "metabolic panel", "lipid panel",
        "urinalysis", "urine", "serum", "plasma", "laboratory", "lab result"
    );

    // Common assessment/screening keywords
    private static final Set<String> ASSESSMENT_KEYWORDS = Set.of(
        "phq", "gad", "audit", "dast", "screening", "survey", "questionnaire", "assessment",
        "score", "scale", "index", "fall risk", "depression", "anxiety", "substance",
        "cognitive", "functional", "adl", "iadl", "pain", "quality of life", "frailty",
        "nutrition", "social determinant", "sdoh", "tobacco", "alcohol", "readiness"
    );

    // Common exclusion keywords
    private static final Set<String> EXCLUSION_KEYWORDS = Set.of(
        "hospice", "palliative", "end of life", "end-of-life", "terminal", "exclusion",
        "exception", "advanced illness", "frailty", "dementia", "nursing facility",
        "long-term care", "skilled nursing"
    );

    // Encounter keywords
    private static final Set<String> ENCOUNTER_KEYWORDS = Set.of(
        "visit", "encounter", "office", "outpatient", "inpatient", "emergency", "telehealth",
        "home health", "preventive", "wellness"
    );

    // Medication keywords
    private static final Set<String> MEDICATION_KEYWORDS = Set.of(
        "medication", "drug", "prescription", "rx", "pharmacy", "therapeutic", "dose"
    );

    // Procedure keywords
    private static final Set<String> PROCEDURE_KEYWORDS = Set.of(
        "procedure", "surgery", "surgical", "operation", "screening", "colonoscopy",
        "mammogram", "mammography", "biopsy", "imaging", "endoscopy", "injection"
    );

    // Condition/diagnosis keywords
    private static final Set<String> CONDITION_KEYWORDS = Set.of(
        "diagnosis", "condition", "disease", "disorder", "syndrome", "infection"
    );

    public InferCategoryService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Infer the most appropriate category for a component.
     */
    public ComponentCategory infer(LibraryComponent component) {
        // 1. Check for exclusion keywords first (applies to both atomic and composite)
        if (isExclusionComponent(component)) {
            return ComponentCategory.EXCLUSIONS;
        }

        // 2. For atomic components, use resourceType and other indicators
        if (component instanceof AtomicComponent atomic) {
            return inferAtomicCategory(atomic);
        }

        // 3. For composite components, check keywords in name/description
        if (component instanceof CompositeComponent) {
            return inferCompositeCategory(component);
        }

        // 4. Default fallback
        return ComponentCategory.CLINICAL_OBSERVATIONS;
    }

    private ComponentCategory inferAtomicCategory(AtomicComponent atomic) {
        // Patient resource type or genderValue → Demographics
        if ("Patient".equals(atomic.getResourceType()) || atomic.getGenderValue() != null) {
            return ComponentCategory.DEMOGRAPHICS;
        }

        // Age-related components → Demographics
        if (isAgeComponent(atomic)) {
            return ComponentCategory.DEMOGRAPHICS;
        }

        // Resource type mapping
        if (atomic.getResourceType() != null) {
            ComponentCategory category = mapResourceType(atomic.getResourceType(), atomic.getValueSet());
            if (category != null) {
                return category;
            }
        }

        // Fallback: infer from value set name patterns
        if (atomic.getValueSet() != null) {
            ComponentCategory vsCategory = inferFromValueSet(atomic.getValueSet());
            if (vsCategory != null) {
                return vsCategory;
            }
        }

        return ComponentCategory.CLINICAL_OBSERVATIONS;
    }

    private ComponentCategory mapResourceType(String resourceType, ComponentValueSet valueSet) {
        return switch (resourceType) {
            case "Encounter" -> ComponentCategory.ENCOUNTERS;
            case "Condition" -> ComponentCategory.CONDITIONS;
            case "Procedure" -> ComponentCategory.PROCEDURES;
            case "MedicationRequest", "MedicationDispense", "MedicationAdministration", "MedicationStatement" ->
                ComponentCategory.MEDICATIONS;
            case "Immunization" -> ComponentCategory.MEDICATIONS; // Grouped under medications
            case "Observation", "DiagnosticReport" -> inferObservationCategory(valueSet);
            default -> null;
        };
    }

    private ComponentCategory inferObservationCategory(ComponentValueSet valueSet) {
        if (valueSet != null) {
            if (isLabValueSet(valueSet)) {
                return ComponentCategory.LABORATORY;
            }
            if (isAssessmentValueSet(valueSet)) {
                return ComponentCategory.ASSESSMENTS;
            }
        }
        return ComponentCategory.CLINICAL_OBSERVATIONS;
    }

    private ComponentCategory inferCompositeCategory(LibraryComponent component) {
        String name = component.getName() != null ? component.getName().toLowerCase() : "";
        String desc = component.getDescription() != null ? component.getDescription().toLowerCase() : "";
        String text = name + " " + desc;

        if (containsKeywords(text, Set.of("encounter", "visit"))) return ComponentCategory.ENCOUNTERS;
        if (containsKeywords(text, Set.of("medication", "drug"))) return ComponentCategory.MEDICATIONS;
        if (containsKeywords(text, Set.of("procedure"))) return ComponentCategory.PROCEDURES;
        if (containsKeywords(text, Set.of("condition", "diagnosis"))) return ComponentCategory.CONDITIONS;
        if (containsKeywords(text, Set.of("age", "demographic"))) return ComponentCategory.DEMOGRAPHICS;
        if (containsKeywords(text, LAB_KEYWORDS)) return ComponentCategory.LABORATORY;
        if (containsKeywords(text, ASSESSMENT_KEYWORDS)) return ComponentCategory.ASSESSMENTS;

        return ComponentCategory.CLINICAL_OBSERVATIONS;
    }

    /**
     * Check if text contains any keywords from a set.
     */
    private boolean containsKeywords(String text, Set<String> keywords) {
        String lowerText = text.toLowerCase();
        return keywords.stream().anyMatch(lowerText::contains);
    }

    /**
     * Check if a value set appears to be lab-related.
     */
    private boolean isLabValueSet(ComponentValueSet valueSet) {
        if (valueSet == null) return false;

        String name = valueSet.getName() != null ? valueSet.getName().toLowerCase() : "";

        // Check name for lab keywords
        if (containsKeywords(name, LAB_KEYWORDS)) {
            return true;
        }

        // Check codes for LOINC (common in labs)
        List<Map<String, Object>> codes = parseCodes(valueSet.getCodes());
        if (!codes.isEmpty()) {
            long loincCount = codes.stream()
                .filter(c -> {
                    Object system = c.get("system");
                    return system != null && system.toString().toLowerCase().contains("loinc");
                })
                .count();
            // If most codes are LOINC, likely a lab
            if (loincCount > codes.size() / 2) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a value set appears to be assessment-related.
     */
    private boolean isAssessmentValueSet(ComponentValueSet valueSet) {
        if (valueSet == null) return false;
        String name = valueSet.getName() != null ? valueSet.getName().toLowerCase() : "";
        return containsKeywords(name, ASSESSMENT_KEYWORDS);
    }

    /**
     * Check if a component is an exclusion component.
     */
    private boolean isExclusionComponent(LibraryComponent component) {
        String name = component.getName() != null ? component.getName().toLowerCase() : "";
        String desc = component.getDescription() != null ? component.getDescription().toLowerCase() : "";
        String text = name + " " + desc;
        return containsKeywords(text, EXCLUSION_KEYWORDS);
    }

    /**
     * Check if a component is age-related (demographics).
     */
    private boolean isAgeComponent(AtomicComponent component) {
        String name = component.getName() != null ? component.getName().toLowerCase() : "";
        String desc = component.getDescription() != null ? component.getDescription().toLowerCase() : "";
        String text = name + " " + desc;
        return text.contains("age") || text.contains("years old") || text.contains("years of age");
    }

    /**
     * Infer category from value set name patterns.
     */
    private ComponentCategory inferFromValueSet(ComponentValueSet valueSet) {
        if (valueSet == null || valueSet.getName() == null) return null;

        String name = valueSet.getName().toLowerCase();

        if (containsKeywords(name, ENCOUNTER_KEYWORDS)) return ComponentCategory.ENCOUNTERS;
        if (containsKeywords(name, MEDICATION_KEYWORDS)) return ComponentCategory.MEDICATIONS;
        if (containsKeywords(name, PROCEDURE_KEYWORDS)) return ComponentCategory.PROCEDURES;
        if (containsKeywords(name, CONDITION_KEYWORDS)) return ComponentCategory.CONDITIONS;
        if (containsKeywords(name, LAB_KEYWORDS)) return ComponentCategory.LABORATORY;
        if (containsKeywords(name, ASSESSMENT_KEYWORDS)) return ComponentCategory.ASSESSMENTS;

        return null;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseCodes(String codesJson) {
        if (codesJson == null || codesJson.isEmpty()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(codesJson, List.class);
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    /**
     * Get a human-readable label for a category.
     */
    public String getCategoryLabel(ComponentCategory category) {
        return switch (category) {
            case DEMOGRAPHICS -> "Demographics";
            case ENCOUNTERS -> "Encounters";
            case CONDITIONS -> "Conditions";
            case PROCEDURES -> "Procedures";
            case MEDICATIONS -> "Medications";
            case ASSESSMENTS -> "Assessments";
            case LABORATORY -> "Laboratory";
            case CLINICAL_OBSERVATIONS -> "Clinical Observations";
            case EXCLUSIONS -> "Exclusions";
        };
    }
}
