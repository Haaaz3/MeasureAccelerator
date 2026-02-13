package com.algoaccel.service.hdi;

import com.algoaccel.model.enums.DataElementType;
import com.algoaccel.model.enums.LogicalOperator;
import com.algoaccel.model.enums.PopulationType;
import com.algoaccel.model.measure.*;
import com.algoaccel.repository.MeasureRepository;
import com.algoaccel.service.hdi.HdiSqlTemplateService.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * HDI SQL Generator Service
 *
 * Converts Universal Measure Specifications (UMS) into production-ready SQL
 * queries following the HDI (HealtheIntent) platform patterns.
 *
 * Output SQL structure:
 * - CTE-based (ONT, DEMOG, PRED_*)
 * - Ontology joins for terminology resolution
 * - Predicate-based patient filtering
 * - INTERSECT/UNION/EXCEPT for population logic
 *
 * Ported from: src/services/hdiSqlGenerator.ts
 */
@Service
@Transactional(readOnly = true)
public class HdiSqlGeneratorService {

    private final MeasureRepository measureRepository;
    private final HdiSqlTemplateService templateService;
    private final ObjectMapper objectMapper;

    public HdiSqlGeneratorService(
            MeasureRepository measureRepository,
            HdiSqlTemplateService templateService,
            ObjectMapper objectMapper) {
        this.measureRepository = measureRepository;
        this.templateService = templateService;
        this.objectMapper = objectMapper;
    }

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Generate HDI SQL from a measure ID.
     */
    public SqlGenerationResult generateHdiSql(String measureId, String populationId) {
        Measure measure = measureRepository.findByIdWithFullTree(measureId)
            .orElseThrow(() -> new EntityNotFoundException("Measure not found: " + measureId));

        return generateHdiSql(measure, populationId);
    }

    /**
     * Generate HDI SQL from a measure entity.
     */
    public SqlGenerationResult generateHdiSql(Measure measure, String populationId) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        try {
            // Build config
            HdiSqlConfig config = HdiSqlConfig.defaultConfig(
                populationId != null ? populationId : "${POPULATION_ID}"
            );

            // Extract predicates from UMS
            MeasureSqlMapping mapping = extractPredicatesFromMeasure(measure, config);

            if (mapping.predicates().isEmpty()) {
                warnings.add("No clinical criteria found - generating demographics-only query");
            }

            // Generate CTE for each predicate
            List<String> predicateCTEs = new ArrayList<>();
            for (PredicateInfo pred : mapping.predicates()) {
                try {
                    predicateCTEs.add(generatePredicateCTE(pred, config));
                } catch (Exception e) {
                    errors.add("Failed to generate CTE for predicate " + pred.alias() + ": " + e.getMessage());
                    predicateCTEs.add("-- ERROR: Failed to generate " + pred.alias());
                }
            }

            // Auto-configure ontology contexts
            Set<String> dataModelsUsed = mapping.predicates().stream()
                .map(PredicateInfo::type)
                .collect(Collectors.toSet());
            List<String> autoContexts = deriveOntologyContexts(dataModelsUsed);

            HdiSqlConfig updatedConfig = new HdiSqlConfig(
                config.populationId(),
                autoContexts,
                config.excludeSnapshotsAndArchives(),
                config.includeComments(),
                config.intakePeriodStart(),
                config.intakePeriodEnd(),
                config.measurementPeriodStart(),
                config.measurementPeriodEnd()
            );

            // Generate population combination logic
            String populationSQL = generatePopulationLogic(mapping);

            // Assemble full SQL
            String sql = templateService.generateFullSQL(
                predicateCTEs,
                populationSQL,
                updatedConfig,
                mapping.indexEventCTEs(),
                mapping.auxiliaryCTEs()
            );

            return new SqlGenerationResult(
                errors.isEmpty(),
                sql,
                errors.isEmpty() ? null : errors,
                warnings.isEmpty() ? null : warnings,
                new SqlMetadata(
                    mapping.predicates().size(),
                    new ArrayList<>(dataModelsUsed),
                    estimateComplexity(mapping),
                    Instant.now().toString()
                )
            );

        } catch (Exception e) {
            errors.add("SQL generation failed: " + e.getMessage());
            return new SqlGenerationResult(
                false,
                "",
                errors,
                warnings.isEmpty() ? null : warnings,
                new SqlMetadata(0, List.of(), "low", Instant.now().toString())
            );
        }
    }

    // ========================================================================
    // Predicate Extraction
    // ========================================================================

    private MeasureSqlMapping extractPredicatesFromMeasure(Measure measure, HdiSqlConfig config) {
        List<PredicateInfo> predicates = new ArrayList<>();
        Map<PopulationType, PredicateGroup> populations = new EnumMap<>(PopulationType.class);

        AtomicInteger predicateCounter = new AtomicInteger(0);

        // Extract global demographic constraints
        if (measure.getGlobalConstraints() != null) {
            GlobalConstraints gc = measure.getGlobalConstraints();
            if (gc.getAgeMin() != null || gc.getAgeMax() != null || gc.getGender() != null) {
                String alias = "PRED_DEMOG_" + predicateCounter.incrementAndGet();
                predicates.add(new PredicateInfo(
                    "demographics",
                    alias,
                    "Global demographic constraints",
                    null,
                    gc.getAgeMin(),
                    gc.getAgeMax(),
                    gc.getGender() != null ? List.of(mapGenderToFhirConcept(gc.getGender().getValue())) : null,
                    null,
                    null,
                    null
                ));
            }
        }

        // Process each population
        if (measure.getPopulations() == null || measure.getPopulations().isEmpty()) {
            return new MeasureSqlMapping(
                measure.getMeasureId() != null ? measure.getMeasureId() : "unknown",
                predicates,
                populations,
                null,
                null
            );
        }

        for (Population population : measure.getPopulations()) {
            List<String> popPredicateAliases = new ArrayList<>();

            if (population.getRootClause() != null) {
                ExtractionResult extracted = extractFromLogicalClause(
                    population.getRootClause(),
                    predicateCounter,
                    measure.getValueSets()
                );
                predicates.addAll(extracted.predicates());
                popPredicateAliases.addAll(extracted.aliases());
            }

            // Determine operator
            String operator = (population.getRootClause() != null &&
                population.getRootClause().getOperator() == LogicalOperator.OR) ? "UNION" : "INTERSECT";

            PredicateGroup group = new PredicateGroup(operator, popPredicateAliases);
            populations.put(population.getPopulationType(), group);
        }

        return new MeasureSqlMapping(
            measure.getMeasureId() != null ? measure.getMeasureId() : "unknown",
            predicates,
            populations,
            null,
            null
        );
    }

    private ExtractionResult extractFromLogicalClause(
            LogicalClause clause,
            AtomicInteger counter,
            List<MeasureValueSet> valueSets) {

        List<PredicateInfo> predicates = new ArrayList<>();
        List<String> aliases = new ArrayList<>();

        if (clause == null) {
            return new ExtractionResult(predicates, aliases);
        }

        // Process child clauses (nested)
        if (clause.getChildClauses() != null) {
            for (LogicalClause childClause : clause.getChildClauses()) {
                ExtractionResult nested = extractFromLogicalClause(childClause, counter, valueSets);
                predicates.addAll(nested.predicates());
                aliases.addAll(nested.aliases());
            }
        }

        // Process data elements (leaf nodes)
        if (clause.getDataElements() != null) {
            for (DataElement element : clause.getDataElements()) {
                PredicateInfo pred = dataElementToPredicate(element, counter, valueSets);
                if (pred != null) {
                    predicates.add(pred);
                    aliases.add(pred.alias());
                }
            }
        }

        return new ExtractionResult(predicates, aliases);
    }

    private PredicateInfo dataElementToPredicate(
            DataElement element,
            AtomicInteger counter,
            List<MeasureValueSet> valueSets) {

        if (element == null) {
            return null;
        }

        // Find value set
        String valueSetOid = null;
        String valueSetName = null;
        if (element.getValueSets() != null && !element.getValueSets().isEmpty()) {
            MeasureValueSet vs = element.getValueSets().iterator().next();
            valueSetOid = vs.getOid();
            valueSetName = vs.getName();
        }

        // Extract timing
        TimingInfo timing = extractTimingFromElement(element);

        String description = element.getDescription() != null ?
            element.getDescription() : (valueSetName != null ? valueSetName : "Clinical criterion");

        DataElementType type = element.getElementType();
        if (type == null) {
            return null;
        }

        return switch (type) {
            case DIAGNOSIS -> new PredicateInfo(
                "condition",
                "PRED_COND_" + counter.incrementAndGet(),
                description,
                valueSetOid,
                null, null, null, null,
                timing != null ? timing.lookbackDays() : null,
                timing != null ? timing.lookbackYears() : null
            );

            case PROCEDURE -> new PredicateInfo(
                "procedure",
                "PRED_PROC_" + counter.incrementAndGet(),
                description,
                valueSetOid,
                null, null, null, null,
                timing != null ? timing.lookbackDays() : null,
                timing != null ? timing.lookbackYears() : null
            );

            case MEDICATION -> new PredicateInfo(
                "medication",
                "PRED_MED_" + counter.incrementAndGet(),
                description,
                valueSetOid,
                null, null, null, null,
                timing != null ? timing.lookbackDays() : null,
                null
            );

            case OBSERVATION, ASSESSMENT -> new PredicateInfo(
                "result",
                "PRED_RESULT_" + counter.incrementAndGet(),
                description,
                valueSetOid,
                null, null, null, null,
                timing != null ? timing.lookbackDays() : null,
                timing != null ? timing.lookbackYears() : null
            );

            case IMMUNIZATION -> new PredicateInfo(
                "immunization",
                "PRED_IMMUN_" + counter.incrementAndGet(),
                description,
                valueSetOid,
                null, null, null, null,
                timing != null ? timing.lookbackDays() : null,
                timing != null ? timing.lookbackYears() : null
            );

            case ENCOUNTER -> new PredicateInfo(
                "encounter",
                "PRED_ENC_" + counter.incrementAndGet(),
                description,
                valueSetOid,
                null, null, null, null,
                timing != null ? timing.lookbackDays() : null,
                null
            );

            case DEMOGRAPHIC -> {
                Integer ageMin = element.getThresholds() != null ? element.getThresholds().getAgeMin() : null;
                Integer ageMax = element.getThresholds() != null ? element.getThresholds().getAgeMax() : null;
                List<String> genderInclude = element.getGenderValue() != null ?
                    List.of(mapGenderToFhirConcept(element.getGenderValue().getValue())) : null;

                yield new PredicateInfo(
                    "demographics",
                    "PRED_DEMOG_" + counter.incrementAndGet(),
                    description,
                    null,
                    ageMin,
                    ageMax,
                    genderInclude,
                    null,
                    null,
                    null
                );
            }

            default -> null;
        };
    }

    private TimingInfo extractTimingFromElement(DataElement element) {
        if (element.getTimingOverride() == null || element.getTimingOverride().isEmpty()) {
            return null;
        }

        try {
            Map<String, Object> override = objectMapper.readValue(
                element.getTimingOverride(),
                new TypeReference<Map<String, Object>>() {}
            );

            @SuppressWarnings("unchecked")
            Map<String, Object> timing = override.containsKey("modified") && override.get("modified") != null ?
                (Map<String, Object>) override.get("modified") :
                (Map<String, Object>) override.get("original");

            if (timing == null) {
                return null;
            }

            Integer value = timing.get("value") != null ?
                ((Number) timing.get("value")).intValue() : null;
            String unit = (String) timing.get("unit");

            if (value != null && unit != null) {
                if (unit.contains("year")) {
                    return new TimingInfo(null, value);
                } else if (unit.contains("day")) {
                    return new TimingInfo(value, null);
                } else if (unit.contains("month")) {
                    return new TimingInfo(value * 30, null);
                }
            }
        } catch (JsonProcessingException e) {
            // Ignore parsing errors
        }

        return null;
    }

    // ========================================================================
    // Predicate CTE Generation
    // ========================================================================

    private String generatePredicateCTE(PredicateInfo pred, HdiSqlConfig config) {
        return switch (pred.type()) {
            case "demographics" -> templateService.generateDemographicsPredicateCTE(
                new DemographicsPredicate(
                    pred.alias(),
                    pred.description(),
                    pred.ageMin(),
                    pred.ageMax(),
                    null, // indexEvent
                    pred.genderInclude(),
                    null, // deceased
                    null, null // postalCodes, states
                ),
                config
            );

            case "condition" -> templateService.generateConditionPredicateCTE(
                new ConditionPredicate(
                    pred.alias(),
                    pred.description(),
                    pred.valueSetOid(),
                    null, // valueSetName
                    null, // indexEvent
                    pred.lookbackDays(),
                    pred.lookbackYears()
                ),
                config
            );

            case "result" -> templateService.generateResultPredicateCTE(
                new ResultPredicate(
                    pred.alias(),
                    pred.description(),
                    pred.valueSetOid(),
                    null, null, // numeric range
                    pred.lookbackDays(),
                    pred.lookbackYears()
                ),
                config
            );

            case "procedure" -> templateService.generateProcedurePredicateCTE(
                new ProcedurePredicate(
                    pred.alias(),
                    pred.description(),
                    pred.valueSetOid(),
                    pred.lookbackDays(),
                    pred.lookbackYears()
                ),
                config
            );

            case "medication" -> templateService.generateMedicationPredicateCTE(
                new MedicationPredicate(
                    pred.alias(),
                    pred.description(),
                    pred.valueSetOid(),
                    null, // indexEvent
                    pred.lookbackDays()
                ),
                config
            );

            case "immunization" -> templateService.generateImmunizationPredicateCTE(
                new ImmunizationPredicate(
                    pred.alias(),
                    pred.description(),
                    pred.valueSetOid(),
                    pred.lookbackDays(),
                    pred.lookbackYears()
                ),
                config
            );

            case "encounter" -> templateService.generateEncounterPredicateCTE(
                new EncounterPredicate(
                    pred.alias(),
                    pred.description(),
                    pred.valueSetOid(),
                    null, // encounterTypeInclude
                    null, // indexEvent
                    pred.lookbackDays()
                ),
                config
            );

            default -> "-- WARNING: Unknown predicate type: " + pred.type() + "\n" +
                pred.alias() + " as (\n  select distinct empi_id from DEMOG -- Placeholder\n)";
        };
    }

    // ========================================================================
    // Population Logic Generation
    // ========================================================================

    private String generatePopulationLogic(MeasureSqlMapping mapping) {
        List<String> sections = new ArrayList<>();

        // Initial Population
        PredicateGroup ip = mapping.populations().get(PopulationType.INITIAL_POPULATION);
        if (ip != null) {
            sections.add(generatePopulationSection("INITIAL_POPULATION", ip,
                "Initial Population: Patients meeting all baseline criteria", false));
        }

        boolean hasIP = ip != null;

        // Denominator
        PredicateGroup denom = mapping.populations().get(PopulationType.DENOMINATOR);
        if (denom != null && !denom.children().isEmpty()) {
            sections.add(generatePopulationSection("DENOMINATOR", denom,
                "Denominator: Patients eligible for the measure", hasIP));
        } else if (hasIP) {
            sections.add("""
                -- Denominator: Equals Initial Population
                DENOMINATOR as (
                  select empi_id from INITIAL_POPULATION
                )""");
        }

        // Denominator Exclusions
        PredicateGroup denomExcl = mapping.populations().get(PopulationType.DENOMINATOR_EXCLUSION);
        if (denomExcl != null && !denomExcl.children().isEmpty()) {
            sections.add(generatePopulationSection("DENOM_EXCLUSION", denomExcl,
                "Denominator Exclusions: Patients to exclude from calculation", false));
        }

        // Denominator Exceptions
        PredicateGroup denomExcep = mapping.populations().get(PopulationType.DENOMINATOR_EXCEPTION);
        if (denomExcep != null && !denomExcep.children().isEmpty()) {
            sections.add(generatePopulationSection("DENOM_EXCEPTION", denomExcep,
                "Denominator Exceptions: Patients with valid exceptions", false));
        }

        // Numerator
        PredicateGroup num = mapping.populations().get(PopulationType.NUMERATOR);
        if (num != null && !num.children().isEmpty()) {
            sections.add(generatePopulationSection("NUMERATOR", num,
                "Numerator: Patients meeting the measure criteria", false));
        }

        // Numerator Exclusions
        PredicateGroup numExcl = mapping.populations().get(PopulationType.NUMERATOR_EXCLUSION);
        if (numExcl != null && !numExcl.children().isEmpty()) {
            sections.add(generatePopulationSection("NUM_EXCLUSION", numExcl,
                "Numerator Exclusions: Patients excluded from numerator", false));
        }

        // Final calculation
        sections.add(generateFinalCalculation(mapping));

        return String.join(",\n--\n", sections);
    }

    private String generatePopulationSection(String alias, PredicateGroup group, String comment, boolean hasIP) {
        if (group.children().isEmpty()) {
            String fallbackSource = ("DENOMINATOR".equals(alias) && hasIP) ? "INITIAL_POPULATION" : "DEMOG";
            return String.format("""
                -- %s
                %s as (
                  select distinct empi_id from %s
                )""", comment, alias, fallbackSource);
        }

        String setOp = "UNION".equals(group.operator()) ? "union" : "intersect";
        List<String> selects = group.children().stream()
            .map(childAlias -> "  select empi_id from " + childAlias)
            .collect(Collectors.toList());

        if (selects.size() == 1) {
            return String.format("""
                -- %s
                %s as (
                %s
                )""", comment, alias, selects.get(0));
        }

        return String.format("""
            -- %s
            %s as (
            %s
            )""", comment, alias, String.join("\n  " + setOp + "\n", selects));
    }

    private String generateFinalCalculation(MeasureSqlMapping mapping) {
        boolean hasExclusions = mapping.populations().containsKey(PopulationType.DENOMINATOR_EXCLUSION) &&
            !mapping.populations().get(PopulationType.DENOMINATOR_EXCLUSION).children().isEmpty();
        boolean hasExceptions = mapping.populations().containsKey(PopulationType.DENOMINATOR_EXCEPTION) &&
            !mapping.populations().get(PopulationType.DENOMINATOR_EXCEPTION).children().isEmpty();
        boolean hasNumerator = mapping.populations().containsKey(PopulationType.NUMERATOR) &&
            !mapping.populations().get(PopulationType.NUMERATOR).children().isEmpty();

        StringBuilder sql = new StringBuilder();
        sql.append("""
            -- Final Measure Calculation
            MEASURE_RESULT as (
              select
                'Initial Population' as population_type
                , count(distinct empi_id) as patient_count
              from INITIAL_POPULATION
              union all
              select
                'Denominator' as population_type
                , count(distinct empi_id) as patient_count
              from DENOMINATOR""");

        if (hasExclusions) {
            sql.append("""

              union all
              select
                'Denominator Exclusion' as population_type
                , count(distinct empi_id) as patient_count
              from DENOM_EXCLUSION""");
        }

        if (hasExceptions) {
            sql.append("""

              union all
              select
                'Denominator Exception' as population_type
                , count(distinct empi_id) as patient_count
              from DENOM_EXCEPTION""");
        }

        if (hasNumerator) {
            sql.append("""

              union all
              select
                'Numerator' as population_type
                , count(distinct empi_id) as patient_count
              from NUMERATOR""");
        }

        sql.append("""

            )
            select * from MEASURE_RESULT""");

        return sql.toString();
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private List<String> deriveOntologyContexts(Set<String> dataModelsUsed) {
        Set<String> contexts = new LinkedHashSet<>();
        contexts.add("HEALTHE INTENT Demographics");

        Map<String, String> modelToContext = Map.of(
            "encounter", "HEALTHE INTENT Encounters",
            "condition", "HEALTHE INTENT Conditions",
            "procedure", "HEALTHE INTENT Procedures",
            "result", "HEALTHE INTENT Results",
            "medication", "HEALTHE INTENT Medications",
            "immunization", "HEALTHE INTENT Immunizations"
        );

        for (String model : dataModelsUsed) {
            String context = modelToContext.get(model);
            if (context != null) {
                contexts.add(context);
            }
        }

        return new ArrayList<>(contexts);
    }

    private String estimateComplexity(MeasureSqlMapping mapping) {
        int predicateCount = mapping.predicates().size();
        long dataModelCount = mapping.predicates().stream()
            .map(PredicateInfo::type)
            .distinct()
            .count();

        if (predicateCount <= 3 && dataModelCount <= 2) return "low";
        if (predicateCount <= 8 && dataModelCount <= 4) return "medium";
        return "high";
    }

    private String mapGenderToFhirConcept(String gender) {
        return switch (gender.toLowerCase()) {
            case "male" -> "FHIR Male";
            case "female" -> "FHIR Female";
            default -> gender;
        };
    }

    // ========================================================================
    // Supporting Records
    // ========================================================================

    public record SqlGenerationResult(
        boolean success,
        String sql,
        List<String> errors,
        List<String> warnings,
        SqlMetadata metadata
    ) {}

    public record SqlMetadata(
        int predicateCount,
        List<String> dataModelsUsed,
        String estimatedComplexity,
        String generatedAt
    ) {}

    private record MeasureSqlMapping(
        String measureId,
        List<PredicateInfo> predicates,
        Map<PopulationType, PredicateGroup> populations,
        List<String> indexEventCTEs,
        List<String> auxiliaryCTEs
    ) {}

    private record PredicateInfo(
        String type,
        String alias,
        String description,
        String valueSetOid,
        Integer ageMin,
        Integer ageMax,
        List<String> genderInclude,
        IndexEventTiming indexEvent,
        Integer lookbackDays,
        Integer lookbackYears
    ) {}

    private record PredicateGroup(
        String operator,
        List<String> children
    ) {}

    private record ExtractionResult(
        List<PredicateInfo> predicates,
        List<String> aliases
    ) {}

    private record TimingInfo(
        Integer lookbackDays,
        Integer lookbackYears
    ) {}
}
