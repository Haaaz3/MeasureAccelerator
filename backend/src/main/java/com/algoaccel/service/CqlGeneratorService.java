package com.algoaccel.service;

import com.algoaccel.model.enums.DataElementType;
import com.algoaccel.model.enums.Gender;
import com.algoaccel.model.enums.LogicalOperator;
import com.algoaccel.model.enums.PopulationType;
import com.algoaccel.model.measure.*;
import com.algoaccel.repository.MeasureRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * CQL Generator Service
 *
 * Generates Clinical Quality Language (CQL) from Universal Measure Spec entities.
 * Supports FHIR R4, QI-Core profiles, and eCQM standards.
 *
 * Features:
 * - Full CQL library generation with proper structure
 * - Value set declarations with VSAC OIDs
 * - Population definitions (IP, Denominator, Exclusions, Numerator)
 * - Helper definitions for common patterns
 *
 * Ported from: src/services/cqlGenerator.ts
 */
@Service
@Transactional(readOnly = true)
public class CqlGeneratorService {

    private final MeasureRepository measureRepository;
    private final ObjectMapper objectMapper;

    public CqlGeneratorService(MeasureRepository measureRepository, ObjectMapper objectMapper) {
        this.measureRepository = measureRepository;
        this.objectMapper = objectMapper;
    }

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Generate complete CQL library from a measure by ID.
     */
    public CqlGenerationResult generateCql(String measureId) {
        Measure measure = measureRepository.findByIdWithFullTree(measureId)
            .orElseThrow(() -> new EntityNotFoundException("Measure not found: " + measureId));

        return generateCql(measure);
    }

    /**
     * Generate complete CQL library from a measure entity.
     */
    public CqlGenerationResult generateCql(Measure measure) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        try {
            // Validate minimum requirements
            if (measure.getMeasureId() == null || measure.getMeasureId().isEmpty()) {
                errors.add("Measure ID is required");
            }
            if (measure.getPopulations() == null || measure.getPopulations().isEmpty()) {
                errors.add("At least one population definition is required");
            }

            if (!errors.isEmpty()) {
                return new CqlGenerationResult(
                    false,
                    "",
                    errors,
                    warnings,
                    new CqlMetadata("", "", 0, 0, 0)
                );
            }

            // Generate library name from measure ID
            String libraryName = sanitizeLibraryName(measure.getMeasureId());
            String version = measure.getVersion() != null ? measure.getVersion() : "1.0.0";

            // Generate CQL sections
            String header = generateHeader(measure, libraryName, version);
            String valueSets = generateValueSetDeclarations(measure.getValueSets(), warnings);
            String parameters = generateParameters(measure);
            String helperDefinitions = generateHelperDefinitions(measure);
            String populationDefinitions = generatePopulationDefinitions(measure);
            String supplementalData = generateSupplementalData();

            // Assemble complete CQL
            StringBuilder cqlBuilder = new StringBuilder();
            cqlBuilder.append(header).append("\n");
            cqlBuilder.append(valueSets).append("\n");
            cqlBuilder.append(parameters).append("\n");
            cqlBuilder.append("context Patient\n\n");
            cqlBuilder.append(helperDefinitions).append("\n");
            cqlBuilder.append(populationDefinitions).append("\n");
            cqlBuilder.append(supplementalData);

            String cql = cqlBuilder.toString();

            // Count definitions
            int definitionCount = countDefinitions(cql);

            return new CqlGenerationResult(
                true,
                cql,
                null,
                warnings.isEmpty() ? null : warnings,
                new CqlMetadata(
                    libraryName,
                    version,
                    measure.getPopulations().size(),
                    measure.getValueSets() != null ? measure.getValueSets().size() : 0,
                    definitionCount
                )
            );

        } catch (Exception e) {
            errors.add(e.getMessage() != null ? e.getMessage() : "Unknown error during CQL generation");
            return new CqlGenerationResult(
                false,
                "",
                errors,
                warnings.isEmpty() ? null : warnings,
                new CqlMetadata("", "", 0, 0, 0)
            );
        }
    }

    // ========================================================================
    // Header Generation
    // ========================================================================

    private String generateHeader(Measure measure, String libraryName, String version) {
        StringBuilder sb = new StringBuilder();

        sb.append("/*\n");
        sb.append(" * Library: ").append(libraryName).append("\n");
        sb.append(" * Title: ").append(measure.getTitle() != null ? measure.getTitle() : "Untitled").append("\n");
        sb.append(" * Measure ID: ").append(measure.getMeasureId()).append("\n");
        sb.append(" * Version: ").append(version).append("\n");
        sb.append(" * Steward: ").append(measure.getSteward() != null ? measure.getSteward() : "Not specified").append("\n");
        sb.append(" * Type: ").append(measure.getMeasureType() != null ? measure.getMeasureType() : "process").append("\n");
        sb.append(" * Scoring: proportion\n");
        sb.append(" *\n");
        sb.append(" * Description: ").append(measure.getDescription() != null ? truncate(measure.getDescription(), 200) : "No description provided").append("\n");
        sb.append(" *\n");
        sb.append(" * Generated: ").append(Instant.now().toString()).append("\n");
        sb.append(" * Generator: AlgoAccelerator CQL Generator v1.0\n");
        sb.append(" */\n\n");

        sb.append("library ").append(libraryName).append(" version '").append(version).append("'\n\n");

        sb.append("using FHIR version '4.0.1'\n\n");

        sb.append("include FHIRHelpers version '4.0.1' called FHIRHelpers\n");
        sb.append("include QICoreCommon version '2.0.0' called QICoreCommon\n");
        sb.append("include MATGlobalCommonFunctions version '7.0.000' called Global\n");
        sb.append("include SupplementalDataElements version '3.4.000' called SDE\n");
        sb.append("include Hospice version '6.9.000' called Hospice\n\n");

        sb.append("// Code Systems\n");
        sb.append("codesystem \"LOINC\": 'http://loinc.org'\n");
        sb.append("codesystem \"SNOMEDCT\": 'http://snomed.info/sct'\n");
        sb.append("codesystem \"ICD10CM\": 'http://hl7.org/fhir/sid/icd-10-cm'\n");
        sb.append("codesystem \"CPT\": 'http://www.ama-assn.org/go/cpt'\n");
        sb.append("codesystem \"HCPCS\": 'https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets'\n");
        sb.append("codesystem \"RxNorm\": 'http://www.nlm.nih.gov/research/umls/rxnorm'\n");
        sb.append("codesystem \"CVX\": 'http://hl7.org/fhir/sid/cvx'\n\n");

        return sb.toString();
    }

    // ========================================================================
    // Value Set Declarations
    // ========================================================================

    private String generateValueSetDeclarations(List<MeasureValueSet> valueSets, List<String> warnings) {
        if (valueSets == null || valueSets.isEmpty()) {
            return "// No value sets defined\n";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("// Value Sets\n");

        for (MeasureValueSet vs : valueSets) {
            if (vs == null) continue;

            String url = vs.getUrl();
            if (url == null && vs.getOid() != null) {
                url = "http://cts.nlm.nih.gov/fhir/ValueSet/" + vs.getOid();
            }

            if (url != null) {
                boolean hasCodes = vs.getCodes() != null && !vs.getCodes().isEmpty();
                sb.append("valueset \"").append(sanitizeIdentifier(vs.getName())).append("\": '").append(url).append("'\n");
                if (!hasCodes) {
                    sb.append("  /* WARNING: Value set \"").append(vs.getName()).append("\" has no codes defined - may need expansion */\n");
                    warnings.add("Value set \"" + vs.getName() + "\" has no codes defined");
                }
            } else {
                sb.append("// valueset \"").append(sanitizeIdentifier(vs.getName())).append("\": 'OID_NOT_SPECIFIED'\n");
                warnings.add("Value set \"" + vs.getName() + "\" has no OID or URL specified");
            }
        }

        sb.append("\n");
        return sb.toString();
    }

    // ========================================================================
    // Parameters
    // ========================================================================

    private String generateParameters(Measure measure) {
        String mpStart = measure.getPeriodStart() != null ? measure.getPeriodStart() : LocalDate.now().getYear() + "-01-01";
        String mpEnd = measure.getPeriodEnd() != null ? measure.getPeriodEnd() : LocalDate.now().getYear() + "-12-31";

        return String.format("""
            // Parameters
            parameter "Measurement Period" Interval<DateTime>
              default Interval[@%sT00:00:00.0, @%sT23:59:59.999]

            """, mpStart, mpEnd);
    }

    // ========================================================================
    // Helper Definitions
    // ========================================================================

    private String generateHelperDefinitions(Measure measure) {
        StringBuilder sb = new StringBuilder();
        sb.append("// Helper Definitions\n");

        // Age calculation
        GlobalConstraints gc = measure.getGlobalConstraints();
        if (gc != null && gc.getAgeMin() != null && gc.getAgeMax() != null) {
            sb.append("""

                define "Age at End of Measurement Period":
                  AgeInYearsAt(date from end of "Measurement Period")

                define "Patient Age Valid":
                  "Age at End of Measurement Period" in Interval[""");
            sb.append(gc.getAgeMin()).append(", ").append(gc.getAgeMax()).append("]");
        }

        // Gender requirement
        if (gc != null && gc.getGender() != null) {
            sb.append("""

                define "Patient Gender Valid":
                  Patient.gender = '""");
            sb.append(gc.getGender().getValue()).append("'");
        }

        // Qualifying encounters helper
        if (hasDataElementType(measure, DataElementType.ENCOUNTER)) {
            sb.append("""

                define "Qualifying Encounter During Measurement Period":
                  ( [Encounter: "Office Visit"]
                    union [Encounter: "Annual Wellness Visit"]
                    union [Encounter: "Preventive Care Services Established Office Visit, 18 and Up"]
                    union [Encounter: "Home Healthcare Services"]
                    union [Encounter: "Online Assessments"]
                    union [Encounter: "Telephone Visits"]
                  ) Encounter
                    where Encounter.status = 'finished'
                      and Encounter.period during "Measurement Period"
                """);
        }

        // Hospice check
        sb.append("""

            define "Has Hospice Services":
              Hospice."Has Hospice Services"
            """);

        // Detect measure type and add specific helpers
        String title = measure.getTitle() != null ? measure.getTitle().toLowerCase() : "";
        String measureIdUpper = measure.getMeasureId() != null ? measure.getMeasureId().toUpperCase() : "";

        if (title.contains("colorectal") || measureIdUpper.contains("CMS130")) {
            sb.append(generateCrcHelpers());
        }

        if (title.contains("cervical") || measureIdUpper.contains("CMS124")) {
            sb.append(generateCervicalHelpers());
        }

        if ((title.contains("breast") && title.contains("screen")) || measureIdUpper.contains("CMS125")) {
            sb.append(generateBreastCancerHelpers());
        }

        sb.append("\n");
        return sb.toString();
    }

    private String generateCrcHelpers() {
        return """

            // Colorectal Cancer Screening Helpers
            define "Colonoscopy Performed":
              [Procedure: "Colonoscopy"] Colonoscopy
                where Colonoscopy.status = 'completed'
                  and Colonoscopy.performed ends 10 years or less before end of "Measurement Period"

            define "Fecal Occult Blood Test Performed":
              [Observation: "Fecal Occult Blood Test (FOBT)"] FOBT
                where FOBT.status in { 'final', 'amended', 'corrected' }
                  and FOBT.effective ends 1 year or less before end of "Measurement Period"
                  and FOBT.value is not null

            define "Flexible Sigmoidoscopy Performed":
              [Procedure: "Flexible Sigmoidoscopy"] Sigmoidoscopy
                where Sigmoidoscopy.status = 'completed'
                  and Sigmoidoscopy.performed ends 5 years or less before end of "Measurement Period"

            define "FIT DNA Test Performed":
              [Observation: "FIT DNA"] FITTest
                where FITTest.status in { 'final', 'amended', 'corrected' }
                  and FITTest.effective ends 3 years or less before end of "Measurement Period"
                  and FITTest.value is not null

            define "CT Colonography Performed":
              [Procedure: "CT Colonography"] CTCol
                where CTCol.status = 'completed'
                  and CTCol.performed ends 5 years or less before end of "Measurement Period"

            define "Has Colorectal Cancer":
              exists ([Condition: "Malignant Neoplasm of Colon"] Cancer
                where Cancer.clinicalStatus ~ QICoreCommon."active")

            define "Has Total Colectomy":
              exists ([Procedure: "Total Colectomy"] Colectomy
                where Colectomy.status = 'completed'
                  and Colectomy.performed starts before end of "Measurement Period")
            """;
    }

    private String generateCervicalHelpers() {
        return """

            // Cervical Cancer Screening Helpers
            define "Cervical Cytology Within 3 Years":
              [Observation: "Pap Test"] Pap
                where Pap.status in { 'final', 'amended', 'corrected' }
                  and Pap.effective ends 3 years or less before end of "Measurement Period"
                  and Pap.value is not null

            define "HPV Test Within 5 Years":
              [Observation: "HPV Test"] HPV
                where HPV.status in { 'final', 'amended', 'corrected' }
                  and HPV.effective ends 5 years or less before end of "Measurement Period"
                  and HPV.value is not null

            define "Has Hysterectomy":
              exists ([Procedure: "Hysterectomy with No Residual Cervix"] Hyst
                where Hyst.status = 'completed'
                  and Hyst.performed starts before end of "Measurement Period")

            define "Absence of Cervix Diagnosis":
              exists ([Condition: "Congenital or Acquired Absence of Cervix"] Absence
                where Absence.clinicalStatus ~ QICoreCommon."active")
            """;
    }

    private String generateBreastCancerHelpers() {
        return """

            // Breast Cancer Screening Helpers
            define "Mammography Within 27 Months":
              [DiagnosticReport: "Mammography"] Mammogram
                where Mammogram.status in { 'final', 'amended', 'corrected' }
                  and Mammogram.effective ends 27 months or less before end of "Measurement Period"

            define "Has Bilateral Mastectomy":
              exists ([Procedure: "Bilateral Mastectomy"] Mastectomy
                where Mastectomy.status = 'completed'
                  and Mastectomy.performed starts before end of "Measurement Period")

            define "Has Unilateral Mastectomy Left":
              exists ([Procedure: "Unilateral Mastectomy Left"] LeftMastectomy
                where LeftMastectomy.status = 'completed')

            define "Has Unilateral Mastectomy Right":
              exists ([Procedure: "Unilateral Mastectomy Right"] RightMastectomy
                where RightMastectomy.status = 'completed')
            """;
    }

    // ========================================================================
    // Population Definitions
    // ========================================================================

    private String generatePopulationDefinitions(Measure measure) {
        StringBuilder sb = new StringBuilder();
        sb.append("// Population Definitions\n");

        // Initial Population
        Population ipPop = findPopulation(measure.getPopulations(), PopulationType.INITIAL_POPULATION);
        if (ipPop != null) {
            sb.append(generatePopulationDefinition(ipPop, "Initial Population"));
        }

        // Denominator
        Population denomPop = findPopulation(measure.getPopulations(), PopulationType.DENOMINATOR);
        sb.append(generateDenominatorDefinition(denomPop));

        // Denominator Exclusions
        Population exclPop = findPopulation(measure.getPopulations(), PopulationType.DENOMINATOR_EXCLUSION);
        sb.append(generateExclusionDefinition(exclPop, measure));

        // Denominator Exceptions
        Population excepPop = findPopulation(measure.getPopulations(), PopulationType.DENOMINATOR_EXCEPTION);
        if (excepPop != null) {
            sb.append(generatePopulationDefinition(excepPop, "Denominator Exception"));
        }

        // Numerator
        Population numPop = findPopulation(measure.getPopulations(), PopulationType.NUMERATOR);
        sb.append(generateNumeratorDefinition(numPop, measure));

        // Numerator Exclusions
        Population numExclPop = findPopulation(measure.getPopulations(), PopulationType.NUMERATOR_EXCLUSION);
        if (numExclPop != null) {
            sb.append(generatePopulationDefinition(numExclPop, "Numerator Exclusion"));
        }

        sb.append("\n");
        return sb.toString();
    }

    private String generatePopulationDefinition(Population pop, String name) {
        StringBuilder sb = new StringBuilder();

        // Add narrative as comment
        if (pop.getNarrative() != null && !pop.getNarrative().isEmpty()) {
            sb.append("\n/*\n * ").append(name).append("\n * ");
            sb.append(truncate(pop.getNarrative(), 200));
            sb.append("\n */\n");
        }

        // Generate criteria expression
        String criteriaExpr = "true";
        if (pop.getRootClause() != null) {
            criteriaExpr = generateCriteriaExpression(pop.getRootClause(), 0);
        }

        sb.append("define \"").append(name).append("\":\n");
        sb.append("  ").append(criteriaExpr).append("\n");

        return sb.toString();
    }

    private String generateDenominatorDefinition(Population pop) {
        if (pop != null && pop.getRootClause() != null && hasChildren(pop.getRootClause())) {
            return generatePopulationDefinition(pop, "Denominator");
        }

        // Default: Denominator equals Initial Population
        return """

            /*
             * Denominator
             * Equals Initial Population
             */
            define "Denominator":
              "Initial Population"
            """;
    }

    private String generateExclusionDefinition(Population pop, Measure measure) {
        StringBuilder sb = new StringBuilder();

        String narrative = pop != null && pop.getNarrative() != null ?
            truncate(pop.getNarrative(), 200) : "Patients meeting exclusion criteria";

        sb.append("\n/*\n * Denominator Exclusion\n * ").append(narrative).append("\n */\n");
        sb.append("define \"Denominator Exclusion\":\n");

        List<String> exclusionCriteria = new ArrayList<>();

        // Always include hospice
        exclusionCriteria.add("\"Has Hospice Services\"");

        // Add measure-specific exclusions
        String title = measure.getTitle() != null ? measure.getTitle().toLowerCase() : "";
        String measureIdUpper = measure.getMeasureId() != null ? measure.getMeasureId().toUpperCase() : "";

        if (title.contains("colorectal") || measureIdUpper.contains("CMS130")) {
            exclusionCriteria.add("\"Has Colorectal Cancer\"");
            exclusionCriteria.add("\"Has Total Colectomy\"");
        }

        if (title.contains("cervical") || measureIdUpper.contains("CMS124")) {
            exclusionCriteria.add("\"Has Hysterectomy\"");
            exclusionCriteria.add("\"Absence of Cervix Diagnosis\"");
        }

        if ((title.contains("breast") && title.contains("screen")) || measureIdUpper.contains("CMS125")) {
            exclusionCriteria.add("\"Has Bilateral Mastectomy\"");
            exclusionCriteria.add("(\"Has Unilateral Mastectomy Left\" and \"Has Unilateral Mastectomy Right\")");
        }

        // Add custom exclusions from population criteria
        if (pop != null && pop.getRootClause() != null && hasChildren(pop.getRootClause())) {
            String customExpr = generateCriteriaExpression(pop.getRootClause(), 0);
            if (!customExpr.equals("true") && !customExpr.equals("false")) {
                exclusionCriteria.add("(" + customExpr + ")");
            }
        }

        sb.append("  ").append(String.join("\n    or ", exclusionCriteria)).append("\n");

        return sb.toString();
    }

    private String generateNumeratorDefinition(Population pop, Measure measure) {
        String title = measure.getTitle() != null ? measure.getTitle().toLowerCase() : "";
        String measureIdUpper = measure.getMeasureId() != null ? measure.getMeasureId().toUpperCase() : "";

        StringBuilder sb = new StringBuilder();
        String narrative = pop != null && pop.getNarrative() != null ?
            truncate(pop.getNarrative(), 200) : "Patients meeting numerator criteria";

        sb.append("\n/*\n * Numerator\n * ").append(narrative).append("\n */\n");
        sb.append("define \"Numerator\":\n");

        // Measure-specific numerator logic
        if (title.contains("colorectal") || measureIdUpper.contains("CMS130")) {
            sb.append("""
                  exists "Colonoscopy Performed"
                    or exists "Fecal Occult Blood Test Performed"
                    or exists "Flexible Sigmoidoscopy Performed"
                    or exists "FIT DNA Test Performed"
                    or exists "CT Colonography Performed"
                """);
            return sb.toString();
        }

        if (title.contains("cervical") || measureIdUpper.contains("CMS124")) {
            sb.append("""
                  exists "Cervical Cytology Within 3 Years"
                    or (AgeInYearsAt(date from end of "Measurement Period") >= 30
                        and exists "HPV Test Within 5 Years")
                """);
            return sb.toString();
        }

        if ((title.contains("breast") && title.contains("screen")) || measureIdUpper.contains("CMS125")) {
            sb.append("  exists \"Mammography Within 27 Months\"\n");
            return sb.toString();
        }

        // Generic numerator from criteria
        if (pop != null && pop.getRootClause() != null && hasChildren(pop.getRootClause())) {
            String criteriaExpr = generateCriteriaExpression(pop.getRootClause(), 0);
            sb.append("  ").append(criteriaExpr).append("\n");
        } else {
            sb.append("  /* WARNING: No numerator criteria defined in measure specification */\n");
            sb.append("  true\n");
        }

        return sb.toString();
    }

    // ========================================================================
    // Criteria Expression Generation
    // ========================================================================

    private String generateCriteriaExpression(LogicalClause clause, int indent) {
        if (clause == null) {
            return "true";
        }

        List<String> expressions = new ArrayList<>();

        // Process child clauses
        if (clause.getChildClauses() != null) {
            for (LogicalClause childClause : clause.getChildClauses()) {
                String nested = generateCriteriaExpression(childClause, indent + 1);
                if (!nested.equals("true")) {
                    expressions.add("(" + nested + ")");
                }
            }
        }

        // Process data elements
        if (clause.getDataElements() != null) {
            for (DataElement element : clause.getDataElements()) {
                String expr = generateDataElementExpression(element);
                expressions.add(expr);
            }
        }

        if (expressions.isEmpty()) {
            return "true";
        }

        String operator = clause.getOperator() == LogicalOperator.OR ? "\n    or " : "\n    and ";
        return String.join(operator, expressions);
    }

    private String generateDataElementExpression(DataElement element) {
        if (element == null) {
            return "/* WARNING: Null data element encountered */\n  true";
        }

        // Handle demographic type with gender
        if (element.getElementType() == DataElementType.DEMOGRAPHIC) {
            return generateDemographicExpression(element);
        }

        // Get value set name
        String vsName = getValueSetName(element);
        if (vsName == null) {
            String desc = element.getDescription() != null ? element.getDescription() : element.getElementType().getValue() + " criterion";
            return "/* WARNING: No value set defined for \"" + desc + "\" */\n  true";
        }

        // Get timing expression
        String timing = generateTimingExpression(element);

        // Generate based on type
        return switch (element.getElementType()) {
            case DIAGNOSIS -> String.format("""
                exists ([Condition: "%s"] C
                      where C.clinicalStatus ~ QICoreCommon."active"%s)""",
                vsName, timing.isEmpty() ? "" : "\n        " + timing);

            case ENCOUNTER -> String.format("""
                exists ([Encounter: "%s"] E
                      where E.status = 'finished'%s)""",
                vsName, timing.isEmpty() ? "" : "\n        " + timing);

            case PROCEDURE -> String.format("""
                exists ([Procedure: "%s"] P
                      where P.status = 'completed'%s)""",
                vsName, timing.isEmpty() ? "" : "\n        " + timing);

            case OBSERVATION, ASSESSMENT -> String.format("""
                exists ([Observation: "%s"] O
                      where O.status in { 'final', 'amended', 'corrected' }
                        and O.value is not null%s)""",
                vsName, timing.isEmpty() ? "" : "\n        " + timing);

            case MEDICATION -> String.format("""
                exists ([MedicationRequest: "%s"] M
                      where M.status in { 'active', 'completed' }%s)""",
                vsName, timing.isEmpty() ? "" : "\n        " + timing);

            case IMMUNIZATION -> String.format("""
                exists ([Immunization: "%s"] I
                      where I.status = 'completed'%s)""",
                vsName, timing.isEmpty() ? "" : "\n        " + timing);

            default -> "// TODO: " + (element.getDescription() != null ? element.getDescription() : "Unknown criterion");
        };
    }

    private String generateDemographicExpression(DataElement element) {
        // Handle patient sex check
        if (element.getGenderValue() != null) {
            return "Patient.gender = '" + element.getGenderValue().getValue() + "'";
        }

        // Handle age thresholds
        ThresholdRange thresholds = element.getThresholds();
        if (thresholds != null) {
            Integer ageMin = thresholds.getAgeMin();
            Integer ageMax = thresholds.getAgeMax();
            if (ageMin != null || ageMax != null) {
                int min = ageMin != null ? ageMin : 0;
                int max = ageMax != null ? ageMax : 999;
                return "AgeInYearsAt(date from end of \"Measurement Period\") in Interval[" + min + ", " + max + "]";
            }
        }

        return "\"Patient Age Valid\"";
    }

    private String generateTimingExpression(DataElement element) {
        // Try to parse timing from timingOverride JSON
        if (element.getTimingOverride() != null && !element.getTimingOverride().isEmpty()) {
            try {
                Map<String, Object> override = objectMapper.readValue(
                    element.getTimingOverride(),
                    new TypeReference<Map<String, Object>>() {}
                );

                // Get effective timing (modified or original)
                @SuppressWarnings("unchecked")
                Map<String, Object> timing = override.containsKey("modified") && override.get("modified") != null ?
                    (Map<String, Object>) override.get("modified") :
                    (Map<String, Object>) override.get("original");

                if (timing != null) {
                    String operator = (String) timing.get("operator");
                    Integer value = timing.get("value") != null ? ((Number) timing.get("value")).intValue() : null;
                    String unit = (String) timing.get("unit");

                    if (value != null && unit != null) {
                        String unitSingular = value == 1 ? unit.replace("(s)", "") : unit.replace("(s)", "s");
                        if ("within".equals(operator) || "before end of".equals(operator)) {
                            return "and ends " + value + " " + unitSingular + " or less before end of \"Measurement Period\"";
                        } else if ("after start of".equals(operator)) {
                            return "and starts " + value + " " + unitSingular + " or less after start of \"Measurement Period\"";
                        }
                    }
                }
            } catch (JsonProcessingException e) {
                // Fall through to default
            }
        }

        // Default timing
        return "and occurs during \"Measurement Period\"";
    }

    // ========================================================================
    // Supplemental Data
    // ========================================================================

    private String generateSupplementalData() {
        return """

            // Supplemental Data Elements
            define "SDE Ethnicity":
              SDE."SDE Ethnicity"

            define "SDE Payer":
              SDE."SDE Payer"

            define "SDE Race":
              SDE."SDE Race"

            define "SDE Sex":
              SDE."SDE Sex"
            """;
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private String sanitizeLibraryName(String measureId) {
        String sanitized = measureId.replaceAll("[^a-zA-Z0-9]", "");
        // CQL identifiers can't start with numbers
        if (!sanitized.isEmpty() && Character.isDigit(sanitized.charAt(0))) {
            sanitized = "_" + sanitized;
        }
        return sanitized;
    }

    private String sanitizeIdentifier(String name) {
        return name.replace("\"", "\\\"").trim();
    }

    private String truncate(String text, int maxLength) {
        if (text == null) return "";
        if (text.length() <= maxLength) return text;
        return text.substring(0, maxLength) + "...";
    }

    private Population findPopulation(List<Population> populations, PopulationType type) {
        if (populations == null) return null;
        return populations.stream()
            .filter(p -> p.getPopulationType() == type)
            .findFirst()
            .orElse(null);
    }

    private boolean hasChildren(LogicalClause clause) {
        if (clause == null) return false;
        return (clause.getChildClauses() != null && !clause.getChildClauses().isEmpty()) ||
               (clause.getDataElements() != null && !clause.getDataElements().isEmpty());
    }

    private boolean hasDataElementType(Measure measure, DataElementType type) {
        if (measure.getPopulations() == null) return false;

        for (Population pop : measure.getPopulations()) {
            if (pop.getRootClause() != null && hasDataElementTypeInClause(pop.getRootClause(), type)) {
                return true;
            }
        }
        return false;
    }

    private boolean hasDataElementTypeInClause(LogicalClause clause, DataElementType type) {
        if (clause.getDataElements() != null) {
            for (DataElement element : clause.getDataElements()) {
                if (element.getElementType() == type) return true;
            }
        }
        if (clause.getChildClauses() != null) {
            for (LogicalClause child : clause.getChildClauses()) {
                if (hasDataElementTypeInClause(child, type)) return true;
            }
        }
        return false;
    }

    private String getValueSetName(DataElement element) {
        if (element.getValueSets() != null && !element.getValueSets().isEmpty()) {
            return element.getValueSets().iterator().next().getName();
        }
        return null;
    }

    private int countDefinitions(String cql) {
        Pattern pattern = Pattern.compile("^define\\s+\"", Pattern.MULTILINE);
        return (int) pattern.matcher(cql).results().count();
    }

    // ========================================================================
    // Result Records
    // ========================================================================

    public record CqlGenerationResult(
        boolean success,
        String cql,
        List<String> errors,
        List<String> warnings,
        CqlMetadata metadata
    ) {}

    public record CqlMetadata(
        String libraryName,
        String version,
        int populationCount,
        int valueSetCount,
        int definitionCount
    ) {}
}
