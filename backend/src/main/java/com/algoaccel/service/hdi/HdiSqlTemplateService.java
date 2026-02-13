package com.algoaccel.service.hdi;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

/**
 * HDI SQL Template Service
 *
 * Generates SQL CTE templates for the HDI (HealtheIntent) platform.
 * Follows the CTE-based pattern with:
 * - ONT: Ontology/terminology context
 * - DEMOG: Demographics base
 * - PRED_*: Individual predicates
 * - Final combination using INTERSECT/UNION/EXCEPT
 *
 * Ported from: src/services/hdiSqlTemplates.ts
 */
@Service
public class HdiSqlTemplateService {

    // ========================================================================
    // Ontology CTE Template
    // ========================================================================

    public String generateOntologyCTE(HdiSqlConfig config) {
        String contexts = config.ontologyContexts().stream()
            .map(c -> "'" + c + "'")
            .collect(Collectors.joining(",\n      "));

        String exclusions = config.excludeSnapshotsAndArchives()
            ? """
              O.population_id not like '%SNAPSHOT%'
                  and O.population_id not like '%ARCHIVE%'
                  and """
            : "";

        return String.format("""
            -- Retrieve necessary terminology contexts and concepts.
            ONT as (
              select distinct
                O.*
              from ph_d_ontology O
              where
                %s(
                  O.context_name in (
                    %s
                  )
                )
            )""", exclusions, contexts);
    }

    // ========================================================================
    // Demographics CTE Template
    // ========================================================================

    public String generateDemographicsCTE(HdiSqlConfig config) {
        String ageCalc = """
            DATEDIFF(YEAR, P.birth_date, GETDATE())
                  - CASE
                    WHEN FORMAT(GETDATE(), 'MMdd') < FORMAT(P.birth_date, 'MMdd') THEN 1
                    ELSE 0
                  END as age_in_years""";

        return String.format("""
            --
            -- Retrieve demographics for all persons along with relevant terminology concepts.
            DEMOG as (
              select
                P.population_id
                , P.empi_id
                , P.gender_coding_system_id
                , P.gender_code
                , GENDO.concept_name as gender_concept_name
                , P.birth_date
                , %s
                , P.deceased
                , P.deceased_dt_tm
                , P.postal_cd as raw_postal_cd
                , STATEO.concept_name as state_concept_name
                , CO.concept_name as country_concept_name
                , MSO.concept_name as marital_status_concept_name
                , EO.concept_name as ethnicity_concept_name
                , RACEO.concept_name as race_concept_name
                , RO.concept_name as religion_concept_name
              from ph_d_person P
              left join ONT GENDO
                on P.gender_coding_system_id = GENDO.code_system_id
                and P.gender_code = GENDO.code_oid
                and GENDO.concept_class_name = 'Gender'
              left join ONT STATEO
                on P.state_coding_system_id = STATEO.code_system_id
                and P.state_code = STATEO.code_oid
                and STATEO.concept_class_name = 'Environment'
              left join ONT CO
                on P.country_coding_system_id = CO.code_system_id
                and P.country_code = CO.code_oid
                and CO.concept_class_name = 'Unspecified'
              left join ph_d_person_demographics PD
                on P.empi_id = PD.empi_id
                and P.population_id = PD.population_id
              left join ONT MSO
                on PD.marital_coding_system_id = MSO.code_system_id
                and PD.marital_status_code = MSO.code_oid
                and MSO.concept_class_name = 'Marital Status'
              left join ONT EO
                on PD.ethnicity_coding_system_id = EO.code_system_id
                and PD.ethnicity_code = EO.code_oid
                and EO.concept_class_name in ('Race', 'Ethnicity')
              left join ONT RO
                on PD.religion_coding_system_id = RO.code_system_id
                and PD.religion_code = RO.code_oid
                and RO.concept_class_name = 'Unspecified'
              left join ph_d_person_race RD
                on RD.empi_id = P.empi_id
                and RD.population_id = P.population_id
              left join ONT RACEO
                on RD.race_coding_system_id = RACEO.code_system_id
                and RD.race_code = RACEO.code_oid
                and RACEO.concept_class_name in ('Race', 'Ethnicity')
              where
                -- PARAMETER: Use appropriate HDI population_id.
                P.population_id = '%s'
            )""", ageCalc, config.populationId());
    }

    // ========================================================================
    // Index Prescription Start Date (IPSD) CTE Template
    // ========================================================================

    public String generateIPSDCTE(String valueSetOid, HdiSqlConfig config) {
        String intakeStart = config.intakePeriodStart() != null ?
            config.intakePeriodStart() : "'${INTAKE_PERIOD_START}'";
        String intakeEnd = config.intakePeriodEnd() != null ?
            config.intakePeriodEnd() : "'${INTAKE_PERIOD_END}'";

        String startQuoted = intakeStart.startsWith("'") ? intakeStart : "'" + intakeStart + "'";
        String endQuoted = intakeEnd.startsWith("'") ? intakeEnd : "'" + intakeEnd + "'";

        return String.format("""
            -- Index Prescription Start Date: First qualifying medication dispensing during Intake Period
            IPSD as (
              select
                M.population_id
                , M.empi_id
                , min(M.effective_date) as index_prescription_start_date
              from ph_f_medication M
              where
                M.population_id = '%s'
                and exists (
                  select 1 from valueset_codes VS
                  where VS.valueset_oid = '%s'
                    and VS.code = M.medication_code
                )
                and M.effective_date >= %s
                and M.effective_date <= %s
              group by M.population_id, M.empi_id
            )""", config.populationId(), valueSetOid, startQuoted, endQuoted);
    }

    public String generateMedCoverageCTE(String valueSetOid, HdiSqlConfig config) {
        return String.format("""
            -- Medication coverage: all dispensings from IPSD forward with days_supply
            MED_COVERAGE as (
              select
                M.population_id
                , M.empi_id
                , M.effective_date
                , M.end_date
                , coalesce(M.days_supply, datediff(day, M.effective_date, M.end_date)) as days_supply
                , I.index_prescription_start_date as ipsd
                , datediff(day, I.index_prescription_start_date, M.effective_date) as days_from_ipsd
              from ph_f_medication M
              inner join IPSD I
                on M.empi_id = I.empi_id
                and M.population_id = I.population_id
              where
                M.population_id = '%s'
                and exists (
                  select 1 from valueset_codes VS
                  where VS.valueset_oid = '%s'
                    and VS.code = M.medication_code
                )
                and M.effective_date >= I.index_prescription_start_date
            )""", config.populationId(), valueSetOid);
    }

    public String generateCumulativeDaysSupplyCTE(CumulativeDaysSupplyConfig cdsConfig,
                                                   String alias, HdiSqlConfig config) {
        return String.format("""
            -- %s
            %s as (
              select
                MC.population_id
                , MC.empi_id
                , 'Medication' as data_model
                , null as identifier
                , MC.ipsd as clinical_start_date
                , DATEADD(DAY, %d, MC.ipsd) as clinical_end_date
                , '%s' as description
              from MED_COVERAGE MC
              where
                MC.days_from_ipsd <= %d
              group by MC.population_id, MC.empi_id, MC.ipsd
              having sum(MC.days_supply) >= %d
            )""",
            cdsConfig.rateLabel(),
            alias,
            cdsConfig.windowDays(),
            escapeSQL(cdsConfig.rateLabel()),
            cdsConfig.windowDays(),
            cdsConfig.requiredDaysSupply());
    }

    // ========================================================================
    // Demographics Predicate Template
    // ========================================================================

    public String generateDemographicsPredicateCTE(DemographicsPredicate predicate, HdiSqlConfig config) {
        StringBuilder conditions = new StringBuilder();
        boolean needsIndexJoin = predicate.indexEvent() != null;

        // Age constraints
        if (predicate.ageMin() != null || predicate.ageMax() != null) {
            if (needsIndexJoin) {
                String ie = predicate.indexEvent().dateColumn();
                String ageExpr = String.format("""
                    DATEDIFF(YEAR, D.birth_date, I.%s)
                          - CASE
                            WHEN FORMAT(I.%s, 'MMdd') < FORMAT(D.birth_date, 'MMdd') THEN 1
                            ELSE 0
                          END""", ie, ie);

                if (predicate.ageMin() != null) {
                    appendCondition(conditions, ageExpr + " >= " + predicate.ageMin());
                }
                if (predicate.ageMax() != null) {
                    appendCondition(conditions, ageExpr + " <= " + predicate.ageMax());
                }
            } else {
                if (predicate.ageMin() != null) {
                    appendCondition(conditions, "age_in_years >= " + predicate.ageMin());
                }
                if (predicate.ageMax() != null) {
                    appendCondition(conditions, "age_in_years <= " + predicate.ageMax());
                }
            }
        }

        // Gender constraints
        if (predicate.genderInclude() != null && !predicate.genderInclude().isEmpty()) {
            String genders = predicate.genderInclude().stream()
                .map(g -> "'" + g + "'")
                .collect(Collectors.joining(", "));
            appendCondition(conditions, "gender_concept_name in (" + genders + ")");
        }

        // Deceased filter
        if (predicate.deceased() != null) {
            if (Boolean.FALSE.equals(predicate.deceased())) {
                appendCondition(conditions, "(deceased = false or deceased is null)");
            } else {
                appendCondition(conditions, "deceased = true");
            }
        }

        // Geographic constraints
        if (predicate.postalCodes() != null && !predicate.postalCodes().isEmpty()) {
            String codes = predicate.postalCodes().stream()
                .map(c -> "'" + c + "'")
                .collect(Collectors.joining(", "));
            appendCondition(conditions, "raw_postal_cd in (" + codes + ")");
        }
        if (predicate.states() != null && !predicate.states().isEmpty()) {
            String states = predicate.states().stream()
                .map(s -> "'" + s + "'")
                .collect(Collectors.joining(", "));
            appendCondition(conditions, "state_concept_name in (" + states + ")");
        }

        String whereClause = conditions.length() > 0 ? conditions.toString() : "1=1";
        String description = predicate.description() != null ? "-- " + predicate.description() + "\n" : "";

        String tableAlias = needsIndexJoin ? "D" : "";
        String fromClause;
        String colPrefix;
        if (needsIndexJoin) {
            fromClause = String.format("""
                DEMOG D
              inner join %s I
                on D.empi_id = I.empi_id
                and D.population_id = I.population_id""", predicate.indexEvent().cteAlias());
            colPrefix = "D.";
        } else {
            fromClause = "DEMOG";
            colPrefix = "";
        }

        String descField = predicate.description() != null ?
            "'" + escapeSQL(predicate.description()) + "'" : "null";

        return String.format("""
            %s%s as (
              select distinct
                %spopulation_id
                , %sempi_id
                , 'Demographics' as data_model
                , null as identifier
                , null as clinical_start_date
                , null as clinical_end_date
                , %s as description
              from %s
              where
                %s
            )""", description, predicate.alias(), colPrefix, colPrefix, descField, fromClause, whereClause);
    }

    // ========================================================================
    // Condition Predicate Template
    // ========================================================================

    public String generateConditionPredicateCTE(ConditionPredicate predicate, HdiSqlConfig config) {
        StringBuilder conditions = new StringBuilder();
        boolean needsIndexJoin = predicate.indexEvent() != null;

        // Population filter
        appendCondition(conditions, "C.population_id = '" + config.populationId() + "'");

        // Value set / code constraints
        if (predicate.valueSetOid() != null) {
            appendCondition(conditions, String.format("""
                exists (
                  select 1 from valueset_codes VS
                  where VS.valueset_oid = '%s'
                    and VS.code = C.condition_code
                )""", predicate.valueSetOid()));
        }

        // Timing constraints
        if (predicate.indexEvent() != null) {
            IndexEventTiming ie = predicate.indexEvent();
            if (ie.daysBefore() != null) {
                appendCondition(conditions, String.format(
                    "C.effective_date >= DATEADD(DAY, -%d, I.%s)",
                    ie.daysBefore(), ie.dateColumn()));
            }
            if (ie.daysAfter() != null) {
                appendCondition(conditions, String.format(
                    "C.effective_date <= DATEADD(DAY, %d, I.%s)",
                    ie.daysAfter(), ie.dateColumn()));
            }
        } else {
            if (predicate.lookbackYears() != null) {
                appendCondition(conditions, String.format(
                    "C.effective_date >= DATEADD(YEAR, -%d, GETDATE())",
                    predicate.lookbackYears()));
            }
            if (predicate.lookbackDays() != null) {
                appendCondition(conditions, String.format(
                    "C.effective_date >= DATEADD(DAY, -%d, GETDATE())",
                    predicate.lookbackDays()));
            }
        }

        String whereClause = conditions.toString();
        String description = predicate.description() != null ? "-- " + predicate.description() + "\n" : "";

        String indexJoin = needsIndexJoin ?
            String.format("""

              inner join %s I
                on C.empi_id = I.empi_id
                and C.population_id = I.population_id""", predicate.indexEvent().cteAlias()) : "";

        String descField = predicate.description() != null ?
            "'" + escapeSQL(predicate.description()) + "'" : "null";

        return String.format("""
            %s%s as (
              select distinct
                C.population_id
                , C.empi_id
                , 'Condition' as data_model
                , C.condition_id as identifier
                , C.effective_date as clinical_start_date
                , null as clinical_end_date
                , %s as description
              from ph_f_condition C%s
              where
                %s
            )""", description, predicate.alias(), descField, indexJoin, whereClause);
    }

    // ========================================================================
    // Result Predicate Template
    // ========================================================================

    public String generateResultPredicateCTE(ResultPredicate predicate, HdiSqlConfig config) {
        StringBuilder conditions = new StringBuilder();

        appendCondition(conditions, "R.population_id = '" + config.populationId() + "'");

        if (predicate.valueSetOid() != null) {
            appendCondition(conditions, String.format("""
                exists (
                  select 1 from valueset_codes VS
                  where VS.valueset_oid = '%s'
                    and VS.code = R.result_code
                )""", predicate.valueSetOid()));
        }

        // Numeric value constraints
        if (predicate.numericMin() != null && predicate.numericMax() != null) {
            appendCondition(conditions, String.format(
                "R.numeric_value between %s and %s",
                predicate.numericMin(), predicate.numericMax()));
        } else if (predicate.numericMin() != null) {
            appendCondition(conditions, "R.numeric_value >= " + predicate.numericMin());
        } else if (predicate.numericMax() != null) {
            appendCondition(conditions, "R.numeric_value <= " + predicate.numericMax());
        }

        // Timing
        if (predicate.lookbackYears() != null) {
            appendCondition(conditions, String.format(
                "R.service_date >= DATEADD(YEAR, -%d, GETDATE())",
                predicate.lookbackYears()));
        }
        if (predicate.lookbackDays() != null) {
            appendCondition(conditions, String.format(
                "R.service_date >= DATEADD(DAY, -%d, GETDATE())",
                predicate.lookbackDays()));
        }

        String whereClause = conditions.toString();
        String description = predicate.description() != null ? "-- " + predicate.description() + "\n" : "";
        String descField = predicate.description() != null ?
            "'" + escapeSQL(predicate.description()) + "'" : "null";

        return String.format("""
            %s%s as (
              select distinct
                R.population_id
                , R.empi_id
                , 'Result' as data_model
                , R.result_id as identifier
                , R.service_date as clinical_start_date
                , null as clinical_end_date
                , %s as description
              from ph_f_result R
              where
                %s
            )""", description, predicate.alias(), descField, whereClause);
    }

    // ========================================================================
    // Procedure Predicate Template
    // ========================================================================

    public String generateProcedurePredicateCTE(ProcedurePredicate predicate, HdiSqlConfig config) {
        StringBuilder conditions = new StringBuilder();

        appendCondition(conditions, "PR.population_id = '" + config.populationId() + "'");

        if (predicate.valueSetOid() != null) {
            appendCondition(conditions, String.format("""
                exists (
                  select 1 from valueset_codes VS
                  where VS.valueset_oid = '%s'
                    and VS.code = PR.procedure_code
                )""", predicate.valueSetOid()));
        }

        if (predicate.lookbackYears() != null) {
            appendCondition(conditions, String.format(
                "PR.performed_date >= DATEADD(YEAR, -%d, GETDATE())",
                predicate.lookbackYears()));
        }
        if (predicate.lookbackDays() != null) {
            appendCondition(conditions, String.format(
                "PR.performed_date >= DATEADD(DAY, -%d, GETDATE())",
                predicate.lookbackDays()));
        }

        String whereClause = conditions.toString();
        String description = predicate.description() != null ? "-- " + predicate.description() + "\n" : "";
        String descField = predicate.description() != null ?
            "'" + escapeSQL(predicate.description()) + "'" : "null";

        return String.format("""
            %s%s as (
              select distinct
                PR.population_id
                , PR.empi_id
                , 'Procedure' as data_model
                , PR.procedure_id as identifier
                , PR.performed_date as clinical_start_date
                , null as clinical_end_date
                , %s as description
              from ph_f_procedure PR
              where
                %s
            )""", description, predicate.alias(), descField, whereClause);
    }

    // ========================================================================
    // Medication Predicate Template
    // ========================================================================

    public String generateMedicationPredicateCTE(MedicationPredicate predicate, HdiSqlConfig config) {
        StringBuilder conditions = new StringBuilder();
        boolean needsIndexJoin = predicate.indexEvent() != null;

        appendCondition(conditions, "M.population_id = '" + config.populationId() + "'");

        if (predicate.valueSetOid() != null) {
            appendCondition(conditions, String.format("""
                exists (
                  select 1 from valueset_codes VS
                  where VS.valueset_oid = '%s'
                    and VS.code = M.medication_code
                )""", predicate.valueSetOid()));
        }

        if (predicate.indexEvent() != null) {
            IndexEventTiming ie = predicate.indexEvent();
            if (ie.daysBefore() != null) {
                appendCondition(conditions, String.format(
                    "M.effective_date >= DATEADD(DAY, -%d, I.%s)",
                    ie.daysBefore(), ie.dateColumn()));
            }
            if (ie.daysAfter() != null) {
                appendCondition(conditions, String.format(
                    "M.effective_date <= DATEADD(DAY, %d, I.%s)",
                    ie.daysAfter(), ie.dateColumn()));
            }
            if (ie.daysBefore() != null && ie.daysAfter() == null) {
                appendCondition(conditions, String.format(
                    "M.effective_date < I.%s", ie.dateColumn()));
            }
        } else {
            if (predicate.lookbackDays() != null) {
                appendCondition(conditions, String.format(
                    "M.effective_date >= DATEADD(DAY, -%d, GETDATE())",
                    predicate.lookbackDays()));
            }
        }

        String whereClause = conditions.toString();
        String description = predicate.description() != null ? "-- " + predicate.description() + "\n" : "";

        String indexJoin = needsIndexJoin ?
            String.format("""

              inner join %s I
                on M.empi_id = I.empi_id
                and M.population_id = I.population_id""", predicate.indexEvent().cteAlias()) : "";

        String descField = predicate.description() != null ?
            "'" + escapeSQL(predicate.description()) + "'" : "null";

        return String.format("""
            %s%s as (
              select distinct
                M.population_id
                , M.empi_id
                , 'Medication' as data_model
                , M.medication_id as identifier
                , M.effective_date as clinical_start_date
                , M.end_date as clinical_end_date
                , %s as description
              from ph_f_medication M%s
              where
                %s
            )""", description, predicate.alias(), descField, indexJoin, whereClause);
    }

    // ========================================================================
    // Immunization Predicate Template
    // ========================================================================

    public String generateImmunizationPredicateCTE(ImmunizationPredicate predicate, HdiSqlConfig config) {
        StringBuilder conditions = new StringBuilder();

        appendCondition(conditions, "I.population_id = '" + config.populationId() + "'");

        if (predicate.valueSetOid() != null) {
            appendCondition(conditions, String.format("""
                exists (
                  select 1 from valueset_codes VS
                  where VS.valueset_oid = '%s'
                    and VS.code = I.immunization_code
                )""", predicate.valueSetOid()));
        }

        if (predicate.lookbackYears() != null) {
            appendCondition(conditions, String.format(
                "I.administration_date >= DATEADD(YEAR, -%d, GETDATE())",
                predicate.lookbackYears()));
        }
        if (predicate.lookbackDays() != null) {
            appendCondition(conditions, String.format(
                "I.administration_date >= DATEADD(DAY, -%d, GETDATE())",
                predicate.lookbackDays()));
        }

        String whereClause = conditions.toString();
        String description = predicate.description() != null ? "-- " + predicate.description() + "\n" : "";
        String descField = predicate.description() != null ?
            "'" + escapeSQL(predicate.description()) + "'" : "null";

        return String.format("""
            %s%s as (
              select distinct
                I.population_id
                , I.empi_id
                , 'Immunization' as data_model
                , I.immunization_id as identifier
                , I.administration_date as clinical_start_date
                , null as clinical_end_date
                , %s as description
              from ph_f_immunization I
              where
                %s
            )""", description, predicate.alias(), descField, whereClause);
    }

    // ========================================================================
    // Encounter Predicate Template
    // ========================================================================

    public String generateEncounterPredicateCTE(EncounterPredicate predicate, HdiSqlConfig config) {
        StringBuilder conditions = new StringBuilder();
        boolean needsIndexJoin = predicate.indexEvent() != null;

        appendCondition(conditions, "E.population_id = '" + config.populationId() + "'");

        if (predicate.encounterTypeInclude() != null && !predicate.encounterTypeInclude().isEmpty()) {
            String types = predicate.encounterTypeInclude().stream()
                .map(t -> "'" + t + "'")
                .collect(Collectors.joining(", "));
            appendCondition(conditions, "E.encounter_type_code in (" + types + ")");
        }

        if (predicate.valueSetOid() != null) {
            appendCondition(conditions, String.format("""
                exists (
                  select 1 from valueset_codes VS
                  where VS.valueset_oid = '%s'
                    and VS.code = E.encounter_type_code
                )""", predicate.valueSetOid()));
        }

        if (predicate.indexEvent() != null) {
            IndexEventTiming ie = predicate.indexEvent();
            if (ie.daysBefore() != null) {
                appendCondition(conditions, String.format(
                    "E.service_date >= DATEADD(DAY, -%d, I.%s)",
                    ie.daysBefore(), ie.dateColumn()));
            }
            if (ie.daysAfter() != null) {
                appendCondition(conditions, String.format(
                    "E.service_date <= DATEADD(DAY, %d, I.%s)",
                    ie.daysAfter(), ie.dateColumn()));
            }
        } else if (predicate.lookbackDays() != null) {
            appendCondition(conditions, String.format(
                "E.service_date >= DATEADD(DAY, -%d, GETDATE())",
                predicate.lookbackDays()));
        }

        String whereClause = conditions.toString();
        String description = predicate.description() != null ? "-- " + predicate.description() + "\n" : "";

        String indexJoin = needsIndexJoin ?
            String.format("""

              inner join %s I
                on E.empi_id = I.empi_id
                and E.population_id = I.population_id""", predicate.indexEvent().cteAlias()) : "";

        String descField = predicate.description() != null ?
            "'" + escapeSQL(predicate.description()) + "'" : "null";

        return String.format("""
            %s%s as (
              select distinct
                E.population_id
                , E.empi_id
                , 'Encounter' as data_model
                , E.encounter_id as identifier
                , E.service_date as clinical_start_date
                , E.discharge_date as clinical_end_date
                , %s as description
              from ph_f_encounter E%s
              where
                %s
            )""", description, predicate.alias(), descField, indexJoin, whereClause);
    }

    // ========================================================================
    // Full SQL Assembly
    // ========================================================================

    public String generateFullSQL(List<String> predicateCTEs, String combination, HdiSqlConfig config,
                                   List<String> indexEventCTEs, List<String> auxiliaryCTEs) {

        String header = config.includeComments() ?
            String.format("""
                -- ============================================================================
                -- Generated SQL for HDI Platform
                -- Population ID: %s
                -- Dialect: synapse
                -- Generated: %s
                -- ============================================================================
                """, config.populationId(), Instant.now().toString()) : "";

        String ontCTE = generateOntologyCTE(config);
        String demogCTE = generateDemographicsCTE(config);

        String indexSection = indexEventCTEs != null && !indexEventCTEs.isEmpty() ?
            ",\n--\n" + String.join(",\n--\n", indexEventCTEs) : "";

        String predicateSection = predicateCTEs != null && !predicateCTEs.isEmpty() ?
            ",\n--\n" + String.join(",\n--\n", predicateCTEs) : "";

        String auxSection = auxiliaryCTEs != null && !auxiliaryCTEs.isEmpty() ?
            ",\n--\n" + String.join(",\n--\n", auxiliaryCTEs) : "";

        String allSections = indexSection + predicateSection + auxSection;
        String sectionsWithComma = !allSections.isEmpty() ? allSections + "," : ",";

        return String.format("""
            %swith %s,
            %s%s
            --
            -- Final population combination
            %s""", header, ontCTE, demogCTE, sectionsWithComma, combination);
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private void appendCondition(StringBuilder sb, String condition) {
        if (sb.length() > 0) {
            sb.append("\n    and ");
        }
        sb.append(condition);
    }

    private String escapeSQL(String s) {
        return s.replace("'", "''");
    }

    // ========================================================================
    // Supporting Records
    // ========================================================================

    public record HdiSqlConfig(
        String populationId,
        List<String> ontologyContexts,
        boolean excludeSnapshotsAndArchives,
        boolean includeComments,
        String intakePeriodStart,
        String intakePeriodEnd,
        String measurementPeriodStart,
        String measurementPeriodEnd
    ) {
        public static HdiSqlConfig defaultConfig(String populationId) {
            return new HdiSqlConfig(
                populationId,
                List.of("HEALTHE INTENT Demographics"),
                true,
                true,
                null,
                null,
                null,
                null
            );
        }
    }

    public record IndexEventTiming(
        String cteAlias,
        String dateColumn,
        Integer daysBefore,
        Integer daysAfter
    ) {}

    public record CumulativeDaysSupplyConfig(
        String valueSetOid,
        String indexEventCte,
        String indexEventDateColumn,
        int windowDays,
        int requiredDaysSupply,
        String rateLabel
    ) {}

    public record DemographicsPredicate(
        String alias,
        String description,
        Integer ageMin,
        Integer ageMax,
        IndexEventTiming indexEvent,
        List<String> genderInclude,
        Boolean deceased,
        List<String> postalCodes,
        List<String> states
    ) {}

    public record ConditionPredicate(
        String alias,
        String description,
        String valueSetOid,
        String valueSetName,
        IndexEventTiming indexEvent,
        Integer lookbackDays,
        Integer lookbackYears
    ) {}

    public record ResultPredicate(
        String alias,
        String description,
        String valueSetOid,
        Double numericMin,
        Double numericMax,
        Integer lookbackDays,
        Integer lookbackYears
    ) {}

    public record ProcedurePredicate(
        String alias,
        String description,
        String valueSetOid,
        Integer lookbackDays,
        Integer lookbackYears
    ) {}

    public record MedicationPredicate(
        String alias,
        String description,
        String valueSetOid,
        IndexEventTiming indexEvent,
        Integer lookbackDays
    ) {}

    public record ImmunizationPredicate(
        String alias,
        String description,
        String valueSetOid,
        Integer lookbackDays,
        Integer lookbackYears
    ) {}

    public record EncounterPredicate(
        String alias,
        String description,
        String valueSetOid,
        List<String> encounterTypeInclude,
        IndexEventTiming indexEvent,
        Integer lookbackDays
    ) {}
}
