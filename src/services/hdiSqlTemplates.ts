/**
 * SQL Templates for HDI Query Generation
 *
 * These templates follow the CTE-based pattern with:
 * - ONT: Ontology/terminology context
 * - DEMOG: Demographics base
 * - PRED_*: Individual predicates
 * - Final combination using INTERSECT/UNION/EXCEPT
 */

import type {
  SQLGenerationConfig,
  DemographicsPredicate,
  ConditionPredicate,
  ResultPredicate,
  ProcedurePredicate,
  MedicationPredicate,
  ImmunizationPredicate,
  EncounterPredicate,
  PredicateGroup,
  CumulativeDaysSupplyConfig,
} from '../types/hdiDataModels';

import {
  HDI_TABLES,
  HDI_COLUMN_MAPPINGS,
  DEFAULT_VALUESET_CONFIG,
  type ValueSetTableConfig,
} from './hdiSchemaBinding';

// ============================================================================
// Schema-Driven Table/Column Access
// ============================================================================

/** Get table name from schema */
const T = {
  ontology: HDI_TABLES.ontology.name,
  person: HDI_TABLES.person.name,
  person_demographics: HDI_TABLES.person_demographics.name,
  person_race: HDI_TABLES.person_race.name,
  condition: HDI_TABLES.condition.name,
  procedure: HDI_TABLES.procedure.name,
  medication: HDI_TABLES.medication.name,
  result: HDI_TABLES.result.name,
  immunization: HDI_TABLES.immunization.name,
  encounter: HDI_TABLES.encounter.name,
  valueset: DEFAULT_VALUESET_CONFIG.tableName,
};

/** Get column mappings from schema */
const C = {
  // Person columns
  person: HDI_TABLES.person.columns,
  // Condition columns
  condition: HDI_TABLES.condition.columns,
  conditionMap: HDI_COLUMN_MAPPINGS.condition,
  // Procedure columns
  procedure: HDI_TABLES.procedure.columns,
  procedureMap: HDI_COLUMN_MAPPINGS.procedure,
  // Medication columns
  medication: HDI_TABLES.medication.columns,
  medicationMap: HDI_COLUMN_MAPPINGS.medication,
  // Result columns
  result: HDI_TABLES.result.columns,
  resultMap: HDI_COLUMN_MAPPINGS.result,
  // Immunization columns
  immunization: HDI_TABLES.immunization.columns,
  immunizationMap: HDI_COLUMN_MAPPINGS.immunization,
  // Encounter columns
  encounter: HDI_TABLES.encounter.columns,
  encounterMap: HDI_COLUMN_MAPPINGS.encounter,
  // Valueset columns
  valueset: DEFAULT_VALUESET_CONFIG,
};

// ============================================================================
// Ontology CTE Template
// ============================================================================

export function generateOntologyCTE(config: SQLGenerationConfig): string {
  const contexts = config.ontologyContexts.map(c => `'${c}'`).join(',\n      ');
  const exclusions = config.excludeSnapshotsAndArchives
    ? `O.population_id not like '%SNAPSHOT%'
    and O.population_id not like '%ARCHIVE%'
    and `
    : '';

  return `-- Retrieve necessary terminology contexts and concepts.
ONT as (
  select distinct
    O.*
  from ${T.ontology} O
  where
    ${exclusions}(
      O.context_name in (
        ${contexts}
      )
    )
)`;
}

// ============================================================================
// Demographics CTE Template
// ============================================================================

export function generateDemographicsCTE(config: SQLGenerationConfig): string {
  // Column references from schema
  const birthDate = C.person.birth_date.name;

  // Synapse/T-SQL age calculation
  const ageCalc = `DATEDIFF(YEAR, P.${birthDate}, GETDATE())
      - CASE
        WHEN FORMAT(GETDATE(), 'MMdd') < FORMAT(P.${birthDate}, 'MMdd') THEN 1
        ELSE 0
      END as age_in_years`;

  return `--
-- Retrieve demographics for all persons along with relevant terminology concepts.
DEMOG as (
  select
    P.${C.person.population_id.name}
    , P.${C.person.empi_id.name}
    , P.${C.person.gender_coding_system_id.name}
    , P.${C.person.gender_code.name}
    , GENDO.concept_name as gender_concept_name
    , P.${birthDate}
    , ${ageCalc}
    , P.${C.person.deceased.name}
    , P.${C.person.deceased_dt_tm.name}
    , P.${C.person.postal_cd.name} as raw_postal_cd
    , STATEO.concept_name as state_concept_name
    , CO.concept_name as country_concept_name
    , MSO.concept_name as marital_status_concept_name
    , EO.concept_name as ethnicity_concept_name
    , RACEO.concept_name as race_concept_name
    , RO.concept_name as religion_concept_name
  from ${T.person} P
  left join ONT GENDO
    on P.${C.person.gender_coding_system_id.name} = GENDO.code_system_id
    and P.${C.person.gender_code.name} = GENDO.code_oid
    and GENDO.concept_class_name = 'Gender'
  left join ONT STATEO
    on P.${C.person.state_coding_system_id.name} = STATEO.code_system_id
    and P.${C.person.state_code.name} = STATEO.code_oid
    and STATEO.concept_class_name = 'Environment'
  left join ONT CO
    on P.${C.person.country_coding_system_id.name} = CO.code_system_id
    and P.${C.person.country_code.name} = CO.code_oid
    and CO.concept_class_name = 'Unspecified'
  left join ${T.person_demographics} PD
    on P.${C.person.empi_id.name} = PD.empi_id
    and P.${C.person.population_id.name} = PD.population_id
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
  left join ${T.person_race} RD
    on RD.empi_id = P.${C.person.empi_id.name}
    and RD.population_id = P.${C.person.population_id.name}
  left join ONT RACEO
    on RD.race_coding_system_id = RACEO.code_system_id
    and RD.race_code = RACEO.code_oid
    and RACEO.concept_class_name in ('Race', 'Ethnicity')
  where
    -- PARAMETER: Use appropriate HDI population_id.
    P.${C.person.population_id.name} = '${config.populationId}'
)`;
}

// ============================================================================
// Index Prescription Start Date (IPSD) CTE Template
// ============================================================================

/**
 * Generates an IPSD CTE for medication-based measures that need an index event.
 * Calculates the first dispensing date per patient within the intake period.
 */
export function generateIPSDCTE(
  valueSetOid: string,
  config: SQLGenerationConfig
): string {
  const intakeStart = config.intakePeriod?.start || "'${INTAKE_PERIOD_START}'";
  const intakeEnd = config.intakePeriod?.end || "'${INTAKE_PERIOD_END}'";
  const startQuoted = intakeStart.startsWith("'") ? intakeStart : `'${intakeStart}'`;
  const endQuoted = intakeEnd.startsWith("'") ? intakeEnd : `'${intakeEnd}'`;

  // Schema-driven column references
  const medCols = C.medicationMap;
  const vsCols = C.valueset;

  return `-- Index Prescription Start Date: First qualifying medication dispensing during Intake Period
IPSD as (
  select
    M.population_id
    , M.empi_id
    , min(M.${medCols.dateColumn}) as index_prescription_start_date
  from ${T.medication} M
  where
    M.population_id = '${config.populationId}'
    and exists (
      select 1 from ${T.valueset} VS
      where VS.${vsCols.oidColumn} = '${valueSetOid}'
        and VS.${vsCols.codeColumn} = M.${medCols.codeColumn}
    )
    and M.${medCols.dateColumn} >= ${startQuoted}
    and M.${medCols.dateColumn} <= ${endQuoted}
  group by M.population_id, M.empi_id
)`;
}

/**
 * Generates a MED_COVERAGE CTE for cumulative days supply calculation.
 * Used by AMM-style measures that require continuous treatment windows.
 */
export function generateMedCoverageCTE(
  valueSetOid: string,
  config: SQLGenerationConfig
): string {
  // Schema-driven column references
  const medCols = C.medicationMap;
  const vsCols = C.valueset;

  return `-- Medication coverage: all dispensings from IPSD forward with days_supply
MED_COVERAGE as (
  select
    M.population_id
    , M.empi_id
    , M.${medCols.dateColumn}
    , M.${medCols.endDateColumn}
    , coalesce(M.${medCols.daysSupplyColumn}, datediff(day, M.${medCols.dateColumn}, M.${medCols.endDateColumn})) as days_supply
    , I.index_prescription_start_date as ipsd
    , datediff(day, I.index_prescription_start_date, M.${medCols.dateColumn}) as days_from_ipsd
  from ${T.medication} M
  inner join IPSD I
    on M.empi_id = I.empi_id
    and M.population_id = I.population_id
  where
    M.population_id = '${config.populationId}'
    and exists (
      select 1 from ${T.valueset} VS
      where VS.${vsCols.oidColumn} = '${valueSetOid}'
        and VS.${vsCols.codeColumn} = M.${medCols.codeColumn}
    )
    and M.${medCols.dateColumn} >= I.index_prescription_start_date
)`;
}

/**
 * Generates a cumulative days supply predicate CTE for a specific rate.
 */
export function generateCumulativeDaysSupplyCTE(
  cdsConfig: CumulativeDaysSupplyConfig,
  alias: string,
  _config: SQLGenerationConfig
): string {
  return `-- ${cdsConfig.rateLabel}
${alias} as (
  select
    MC.population_id
    , MC.empi_id
    , 'Medication' as data_model
    , null as identifier
    , MC.ipsd as clinical_start_date
    , DATEADD(DAY, ${cdsConfig.windowDays}, MC.ipsd) as clinical_end_date
    , '${cdsConfig.rateLabel.replace(/'/g, "''")}' as description
  from MED_COVERAGE MC
  where
    MC.days_from_ipsd <= ${cdsConfig.windowDays}
  group by MC.population_id, MC.empi_id, MC.ipsd
  having sum(MC.days_supply) >= ${cdsConfig.requiredDaysSupply}
)`;
}

// ============================================================================
// Demographics Predicate Template
// ============================================================================

export function generateDemographicsPredicateCTE(
  predicate: DemographicsPredicate,
  config: SQLGenerationConfig
): string {
  const conditions: string[] = [];
  const needsIndexJoin = !!(predicate.age?.indexEvent);

  // Age constraints
  if (predicate.age) {
    if (predicate.age.indexEvent) {
      // Age calculated relative to an index event date (e.g., IPSD)
      // Synapse/T-SQL age calculation
      const ie = predicate.age.indexEvent;
      const ageExpr = `DATEDIFF(YEAR, D.birth_date, I.${ie.dateColumn})
      - CASE
        WHEN FORMAT(I.${ie.dateColumn}, 'MMdd') < FORMAT(D.birth_date, 'MMdd') THEN 1
        ELSE 0
      END`;

      if (predicate.age.min !== undefined) {
        conditions.push(`${ageExpr} >= ${predicate.age.min}`);
      }
      if (predicate.age.max !== undefined) {
        conditions.push(`${ageExpr} <= ${predicate.age.max}`);
      }
    } else {
      // Standard age from DEMOG CTE's precomputed age_in_years
      if (predicate.age.min !== undefined) {
        conditions.push(`age_in_years >= ${predicate.age.min}`);
      }
      if (predicate.age.max !== undefined) {
        conditions.push(`age_in_years <= ${predicate.age.max}`);
      }
    }
  }

  // Gender constraints
  if (predicate.gender?.include && predicate.gender.include.length > 0) {
    const genders = predicate.gender.include.map(g => `'${g}'`).join(', ');
    conditions.push(`gender_concept_name in (${genders})`);
  }

  // Deceased filter
  if (predicate.deceased !== undefined && predicate.deceased !== null) {
    if (predicate.deceased === false) {
      conditions.push(`(deceased = false or deceased is null)`);
    } else {
      conditions.push(`deceased = true`);
    }
  }

  // Geographic constraints
  if (predicate.geography) {
    if (predicate.geography.postalCodes && predicate.geography.postalCodes.length > 0) {
      const codes = predicate.geography.postalCodes.map(c => `'${c}'`).join(', ');
      conditions.push(`raw_postal_cd in (${codes})`);
    }
    if (predicate.geography.states && predicate.geography.states.length > 0) {
      const states = predicate.geography.states.map(s => `'${s}'`).join(', ');
      conditions.push(`state_concept_name in (${states})`);
    }
    if (predicate.geography.countries && predicate.geography.countries.length > 0) {
      const countries = predicate.geography.countries.map(c => `'${c}'`).join(', ');
      conditions.push(`country_concept_name in (${countries})`);
    }
  }

  // Marital status
  if (predicate.maritalStatus?.include && predicate.maritalStatus.include.length > 0) {
    const statuses = predicate.maritalStatus.include.map(s => `'${s}'`).join(', ');
    conditions.push(`marital_status_concept_name in (${statuses})`);
  }

  // Ethnicity
  if (predicate.ethnicity?.include && predicate.ethnicity.include.length > 0) {
    const ethnicities = predicate.ethnicity.include.map(e => `'${e}'`).join(', ');
    conditions.push(`ethnicity_concept_name in (${ethnicities})`);
  }

  // Race
  if (predicate.race?.include && predicate.race.include.length > 0) {
    const races = predicate.race.include.map(r => `'${r}'`).join(', ');
    conditions.push(`race_concept_name in (${races})`);
  }

  // Religion
  if (predicate.religion?.include && predicate.religion.include.length > 0) {
    const religions = predicate.religion.include.map(r => `'${r}'`).join(', ');
    conditions.push(`religion_concept_name in (${religions})`);
  }

  const whereClause = conditions.length > 0
    ? conditions.join('\n    and ')
    : '1=1';

  const description = predicate.description
    ? `-- ${predicate.description}\n`
    : '';

  const tableAlias = needsIndexJoin ? 'D' : '';
  const fromClause = needsIndexJoin
    ? `DEMOG D
  inner join ${predicate.age!.indexEvent!.cteAlias} I
    on D.empi_id = I.empi_id
    and D.population_id = I.population_id`
    : 'DEMOG';
  const colPrefix = needsIndexJoin ? 'D.' : '';

  return `${description}${predicate.alias} as (
  select distinct
    ${colPrefix}population_id
    , ${colPrefix}empi_id
    , 'Demographics' as data_model
    , null as identifier
    , null as clinical_start_date
    , null as clinical_end_date
    , ${predicate.description ? `'${predicate.description.replace(/'/g, "''")}'` : 'null'} as description
  from ${fromClause}
  where
    ${whereClause}
)`;
}

// ============================================================================
// Condition Predicate Template
// ============================================================================

export function generateConditionPredicateCTE(
  predicate: ConditionPredicate,
  config: SQLGenerationConfig
): string {
  const conditions: string[] = [];
  const needsIndexJoin = !!(predicate.timing?.indexEvent);
  const ie = predicate.timing?.indexEvent;

  // Schema-driven column references
  const condCols = C.conditionMap;
  const vsCols = C.valueset;

  // Population filter
  conditions.push(`C.population_id = '${config.populationId}'`);

  // Value set / code constraints
  if (predicate.codes) {
    if (predicate.codes.valueSetOid) {
      conditions.push(`exists (
      select 1 from ${T.valueset} VS
      where VS.${vsCols.oidColumn} = '${predicate.codes.valueSetOid}'
        and VS.${vsCols.codeColumn} = C.${condCols.codeColumn}
    )`);
    } else if (predicate.codes.explicitCodes && predicate.codes.explicitCodes.length > 0) {
      const codes = predicate.codes.explicitCodes.map(c => `'${c.code}'`).join(', ');
      conditions.push(`C.${condCols.codeColumn} in (${codes})`);
    }
  }

  // Condition type filter
  if (predicate.conditionType && predicate.conditionType !== 'any') {
    const typeMapping = {
      diagnosis: 'FHIR Diagnosis Condition Type',
      problem: 'FHIR Problem Condition Type'
    };
    conditions.push(`C.${C.condition.condition_type_code.name} = '${typeMapping[predicate.conditionType]}'`);
  }

  // Status filter
  if (predicate.status?.include && predicate.status.include.length > 0) {
    const statuses = predicate.status.include.map(s => `'${s}'`).join(', ');
    conditions.push(`C.${condCols.statusColumn} in (${statuses})`);
  }

  // Timing constraints
  if (predicate.timing) {
    if (ie) {
      // Index-event-relative timing (e.g., "within 60 days of IPSD")
      if (ie.daysBefore) {
        conditions.push(`C.${condCols.dateColumn} >= DATEADD(DAY, -${ie.daysBefore}, I.${ie.dateColumn})`);
      }
      if (ie.daysAfter) {
        conditions.push(`C.${condCols.dateColumn} <= DATEADD(DAY, ${ie.daysAfter}, I.${ie.dateColumn})`);
      }
    } else {
      if (predicate.timing.effectiveDateRange) {
        if (predicate.timing.effectiveDateRange.start) {
          conditions.push(`C.${condCols.dateColumn} >= '${predicate.timing.effectiveDateRange.start}'`);
        }
        if (predicate.timing.effectiveDateRange.end) {
          conditions.push(`C.${condCols.dateColumn} <= '${predicate.timing.effectiveDateRange.end}'`);
        }
      }
      if (predicate.timing.lookbackYears) {
        conditions.push(`C.${condCols.dateColumn} >= DATEADD(YEAR, -${predicate.timing.lookbackYears}, GETDATE())`);
      }
      if (predicate.timing.lookbackDays) {
        conditions.push(`C.${condCols.dateColumn} >= DATEADD(DAY, -${predicate.timing.lookbackDays}, GETDATE())`);
      }
    }
  }

  // Claim source filter
  if (predicate.requireClaimSource) {
    conditions.push(`C.${C.condition.claim_id.name} is not null`);
  }

  const whereClause = conditions.join('\n    and ');
  const description = predicate.description
    ? `-- ${predicate.description}\n`
    : '';

  const indexJoin = needsIndexJoin
    ? `\n  inner join ${ie!.cteAlias} I\n    on C.empi_id = I.empi_id\n    and C.population_id = I.population_id`
    : '';

  return `${description}${predicate.alias} as (
  select distinct
    C.population_id
    , C.empi_id
    , 'Condition' as data_model
    , C.${condCols.idColumn} as identifier
    , C.${condCols.dateColumn} as clinical_start_date
    , null as clinical_end_date
    , ${predicate.description ? `'${predicate.description.replace(/'/g, "''")}'` : 'null'} as description
  from ${T.condition} C${indexJoin}
  where
    ${whereClause}
)`;
}

// ============================================================================
// Result Predicate Template
// ============================================================================

export function generateResultPredicateCTE(
  predicate: ResultPredicate,
  config: SQLGenerationConfig
): string {
  const conditions: string[] = [];

  // Schema-driven column references
  const resultCols = C.resultMap;
  const vsCols = C.valueset;

  // Population filter
  conditions.push(`R.population_id = '${config.populationId}'`);

  // Value set / code constraints
  if (predicate.codes) {
    if (predicate.codes.valueSetOid) {
      conditions.push(`exists (
      select 1 from ${T.valueset} VS
      where VS.${vsCols.oidColumn} = '${predicate.codes.valueSetOid}'
        and VS.${vsCols.codeColumn} = R.${resultCols.codeColumn}
    )`);
    } else if (predicate.codes.explicitCodes && predicate.codes.explicitCodes.length > 0) {
      const codes = predicate.codes.explicitCodes.map(c => `'${c.code}'`).join(', ');
      conditions.push(`R.${resultCols.codeColumn} in (${codes})`);
    }
  }

  // Numeric value constraints
  if (predicate.value?.numeric) {
    const nv = predicate.value.numeric;
    if (nv.operator === 'between' && nv.min !== undefined && nv.max !== undefined) {
      conditions.push(`R.${resultCols.valueColumn} between ${nv.min} and ${nv.max}`);
    } else if (nv.min !== undefined && nv.operator !== 'between') {
      const op = nv.operator === 'gte' ? '>=' : nv.operator === 'gt' ? '>' : '>=';
      conditions.push(`R.${resultCols.valueColumn} ${op} ${nv.min}`);
    } else if (nv.max !== undefined && nv.operator !== 'between') {
      const op = nv.operator === 'lte' ? '<=' : nv.operator === 'lt' ? '<' : '<=';
      conditions.push(`R.${resultCols.valueColumn} ${op} ${nv.max}`);
    }
  }

  // Codified value constraints
  if (predicate.value?.codified?.include && predicate.value.codified.include.length > 0) {
    const values = predicate.value.codified.include.map(v => `'${v}'`).join(', ');
    conditions.push(`R.${resultCols.codifiedValueColumn} in (${values})`);
  }

  // Unit of measure
  if (predicate.unitOfMeasure && predicate.unitOfMeasure.length > 0) {
    const units = predicate.unitOfMeasure.map(u => `'${u}'`).join(', ');
    conditions.push(`R.${resultCols.unitColumn} in (${units})`);
  }

  // Status filter
  if (predicate.status && predicate.status.length > 0) {
    const statuses = predicate.status.map(s => `'${s}'`).join(', ');
    conditions.push(`R.${resultCols.statusColumn} in (${statuses})`);
  }

  // Timing constraints
  if (predicate.timing) {
    if (predicate.timing.serviceDateRange) {
      if (predicate.timing.serviceDateRange.start) {
        conditions.push(`R.${resultCols.dateColumn} >= '${predicate.timing.serviceDateRange.start}'`);
      }
      if (predicate.timing.serviceDateRange.end) {
        conditions.push(`R.${resultCols.dateColumn} <= '${predicate.timing.serviceDateRange.end}'`);
      }
    }
    if (predicate.timing.lookbackYears) {
      conditions.push(`R.${resultCols.dateColumn} >= DATEADD(YEAR, -${predicate.timing.lookbackYears}, GETDATE())`);
    }
    if (predicate.timing.lookbackDays) {
      conditions.push(`R.${resultCols.dateColumn} >= DATEADD(DAY, -${predicate.timing.lookbackDays}, GETDATE())`);
    }
  }

  const whereClause = conditions.join('\n    and ');
  const description = predicate.description
    ? `-- ${predicate.description}\n`
    : '';

  return `${description}${predicate.alias} as (
  select distinct
    R.population_id
    , R.empi_id
    , 'Result' as data_model
    , R.${resultCols.idColumn} as identifier
    , R.${resultCols.dateColumn} as clinical_start_date
    , null as clinical_end_date
    , ${predicate.description ? `'${predicate.description.replace(/'/g, "''")}'` : 'null'} as description
  from ${T.result} R
  where
    ${whereClause}
)`;
}

// ============================================================================
// Procedure Predicate Template
// ============================================================================

export function generateProcedurePredicateCTE(
  predicate: ProcedurePredicate,
  config: SQLGenerationConfig
): string {
  const conditions: string[] = [];

  // Schema-driven column references
  const procCols = C.procedureMap;
  const vsCols = C.valueset;

  // Population filter
  conditions.push(`PR.population_id = '${config.populationId}'`);

  // Value set / code constraints
  if (predicate.codes) {
    if (predicate.codes.valueSetOid) {
      conditions.push(`exists (
      select 1 from ${T.valueset} VS
      where VS.${vsCols.oidColumn} = '${predicate.codes.valueSetOid}'
        and VS.${vsCols.codeColumn} = PR.${procCols.codeColumn}
    )`);
    } else if (predicate.codes.explicitCodes && predicate.codes.explicitCodes.length > 0) {
      const codes = predicate.codes.explicitCodes.map(c => `'${c.code}'`).join(', ');
      conditions.push(`PR.${procCols.codeColumn} in (${codes})`);
    }
  }

  // Timing constraints
  if (predicate.timing) {
    if (predicate.timing.performedDateRange) {
      if (predicate.timing.performedDateRange.start) {
        conditions.push(`PR.${procCols.dateColumn} >= '${predicate.timing.performedDateRange.start}'`);
      }
      if (predicate.timing.performedDateRange.end) {
        conditions.push(`PR.${procCols.dateColumn} <= '${predicate.timing.performedDateRange.end}'`);
      }
    }
    if (predicate.timing.lookbackYears) {
      conditions.push(`PR.${procCols.dateColumn} >= DATEADD(YEAR, -${predicate.timing.lookbackYears}, GETDATE())`);
    }
    if (predicate.timing.lookbackDays) {
      conditions.push(`PR.${procCols.dateColumn} >= DATEADD(DAY, -${predicate.timing.lookbackDays}, GETDATE())`);
    }
  }

  const whereClause = conditions.join('\n    and ');
  const description = predicate.description
    ? `-- ${predicate.description}\n`
    : '';

  return `${description}${predicate.alias} as (
  select distinct
    PR.population_id
    , PR.empi_id
    , 'Procedure' as data_model
    , PR.${procCols.idColumn} as identifier
    , PR.${procCols.dateColumn} as clinical_start_date
    , null as clinical_end_date
    , ${predicate.description ? `'${predicate.description.replace(/'/g, "''")}'` : 'null'} as description
  from ${T.procedure} PR
  where
    ${whereClause}
)`;
}

// ============================================================================
// Medication Predicate Template
// ============================================================================

export function generateMedicationPredicateCTE(
  predicate: MedicationPredicate,
  config: SQLGenerationConfig
): string {
  // If this predicate has a cumulative days supply config, delegate to that template
  if (predicate.cumulativeDaysSupply) {
    return generateCumulativeDaysSupplyCTE(
      predicate.cumulativeDaysSupply,
      predicate.alias,
      config
    );
  }

  const conditions: string[] = [];
  const needsIndexJoin = !!(predicate.timing?.indexEvent);
  const ie = predicate.timing?.indexEvent;

  // Schema-driven column references
  const medCols = C.medicationMap;
  const vsCols = C.valueset;

  // Population filter
  conditions.push(`M.population_id = '${config.populationId}'`);

  // Value set / code constraints
  if (predicate.codes) {
    if (predicate.codes.valueSetOid) {
      conditions.push(`exists (
      select 1 from ${T.valueset} VS
      where VS.${vsCols.oidColumn} = '${predicate.codes.valueSetOid}'
        and VS.${vsCols.codeColumn} = M.${medCols.codeColumn}
    )`);
    } else if (predicate.codes.explicitCodes && predicate.codes.explicitCodes.length > 0) {
      const codes = predicate.codes.explicitCodes.map(c => `'${c.code}'`).join(', ');
      conditions.push(`M.${medCols.codeColumn} in (${codes})`);
    }
  }

  // Status filter
  if (predicate.status && predicate.status !== 'any') {
    conditions.push(`M.${medCols.statusColumn} = '${predicate.status}'`);
  }

  // Timing constraints
  if (predicate.timing) {
    if (ie) {
      // Index-event-relative timing (e.g., "105 days prior to IPSD")
      if (ie.daysBefore) {
        conditions.push(`M.${medCols.dateColumn} >= DATEADD(DAY, -${ie.daysBefore}, I.${ie.dateColumn})`);
      }
      if (ie.daysAfter) {
        conditions.push(`M.${medCols.dateColumn} <= DATEADD(DAY, ${ie.daysAfter}, I.${ie.dateColumn})`);
      }
      // For exclusion predicates that need "before index event"
      // If daysBefore is set but no daysAfter, also cap at the index event date
      if (ie.daysBefore && !ie.daysAfter) {
        conditions.push(`M.${medCols.dateColumn} < I.${ie.dateColumn}`);
      }
    } else {
      if (predicate.timing.effectiveDateRange) {
        if (predicate.timing.effectiveDateRange.start) {
          conditions.push(`M.${medCols.dateColumn} >= '${predicate.timing.effectiveDateRange.start}'`);
        }
        if (predicate.timing.effectiveDateRange.end) {
          conditions.push(`M.${medCols.dateColumn} <= '${predicate.timing.effectiveDateRange.end}'`);
        }
      }
      if (predicate.timing.lookbackDays) {
        conditions.push(`M.${medCols.dateColumn} >= DATEADD(DAY, -${predicate.timing.lookbackDays}, GETDATE())`);
      }
    }
  }

  const whereClause = conditions.join('\n    and ');
  const description = predicate.description
    ? `-- ${predicate.description}\n`
    : '';

  const indexJoin = needsIndexJoin
    ? `\n  inner join ${ie!.cteAlias} I\n    on M.empi_id = I.empi_id\n    and M.population_id = I.population_id`
    : '';

  return `${description}${predicate.alias} as (
  select distinct
    M.population_id
    , M.empi_id
    , 'Medication' as data_model
    , M.${medCols.idColumn} as identifier
    , M.${medCols.dateColumn} as clinical_start_date
    , M.${medCols.endDateColumn} as clinical_end_date
    , ${predicate.description ? `'${predicate.description.replace(/'/g, "''")}'` : 'null'} as description
  from ${T.medication} M${indexJoin}
  where
    ${whereClause}
)`;
}

// ============================================================================
// Immunization Predicate Template
// ============================================================================

export function generateImmunizationPredicateCTE(
  predicate: ImmunizationPredicate,
  config: SQLGenerationConfig
): string {
  const conditions: string[] = [];

  // Schema-driven column references
  const immunCols = C.immunizationMap;
  const vsCols = C.valueset;

  // Population filter
  conditions.push(`I.population_id = '${config.populationId}'`);

  // Value set / code constraints
  if (predicate.codes) {
    if (predicate.codes.valueSetOid) {
      conditions.push(`exists (
      select 1 from ${T.valueset} VS
      where VS.${vsCols.oidColumn} = '${predicate.codes.valueSetOid}'
        and VS.${vsCols.codeColumn} = I.${immunCols.codeColumn}
    )`);
    } else if (predicate.codes.explicitCodes && predicate.codes.explicitCodes.length > 0) {
      const codes = predicate.codes.explicitCodes.map(c => `'${c.code}'`).join(', ');
      conditions.push(`I.${immunCols.codeColumn} in (${codes})`);
    }
  }

  // Timing constraints
  if (predicate.timing) {
    if (predicate.timing.administrationDateRange) {
      if (predicate.timing.administrationDateRange.start) {
        conditions.push(`I.${immunCols.dateColumn} >= '${predicate.timing.administrationDateRange.start}'`);
      }
      if (predicate.timing.administrationDateRange.end) {
        conditions.push(`I.${immunCols.dateColumn} <= '${predicate.timing.administrationDateRange.end}'`);
      }
    }
    if (predicate.timing.lookbackYears) {
      conditions.push(`I.${immunCols.dateColumn} >= DATEADD(YEAR, -${predicate.timing.lookbackYears}, GETDATE())`);
    }
    if (predicate.timing.lookbackDays) {
      conditions.push(`I.${immunCols.dateColumn} >= DATEADD(DAY, -${predicate.timing.lookbackDays}, GETDATE())`);
    }
  }

  const whereClause = conditions.join('\n    and ');
  const description = predicate.description
    ? `-- ${predicate.description}\n`
    : '';

  return `${description}${predicate.alias} as (
  select distinct
    I.population_id
    , I.empi_id
    , 'Immunization' as data_model
    , I.${immunCols.idColumn} as identifier
    , I.${immunCols.dateColumn} as clinical_start_date
    , null as clinical_end_date
    , ${predicate.description ? `'${predicate.description.replace(/'/g, "''")}'` : 'null'} as description
  from ${T.immunization} I
  where
    ${whereClause}
)`;
}

// ============================================================================
// Encounter Predicate Template
// ============================================================================

export function generateEncounterPredicateCTE(
  predicate: EncounterPredicate,
  config: SQLGenerationConfig
): string {
  const conditions: string[] = [];
  const needsIndexJoin = !!(predicate.timing?.indexEvent);
  const ie = predicate.timing?.indexEvent;

  // Schema-driven column references
  const encCols = C.encounterMap;
  const vsCols = C.valueset;

  // Population filter
  conditions.push(`E.population_id = '${config.populationId}'`);

  // Encounter type constraints
  if (predicate.encounterType?.include && predicate.encounterType.include.length > 0) {
    const types = predicate.encounterType.include.map(t => `'${t}'`).join(', ');
    conditions.push(`E.${encCols.codeColumn} in (${types})`);
  }

  // Value set code matching via codes on the encounter
  if ((predicate as any).codes) {
    const codes = (predicate as any).codes;
    if (codes.valueSetOid) {
      conditions.push(`exists (
      select 1 from ${T.valueset} VS
      where VS.${vsCols.oidColumn} = '${codes.valueSetOid}'
        and VS.${vsCols.codeColumn} = E.${encCols.codeColumn}
    )`);
    } else if (codes.explicitCodes && codes.explicitCodes.length > 0) {
      const codeList = codes.explicitCodes.map((c: any) => `'${c.code}'`).join(', ');
      conditions.push(`E.${encCols.codeColumn} in (${codeList})`);
    }
  }

  // Timing constraints
  if (predicate.timing) {
    if (ie) {
      // Index-event-relative timing
      if (ie.daysBefore) {
        conditions.push(`E.${encCols.dateColumn} >= DATEADD(DAY, -${ie.daysBefore}, I.${ie.dateColumn})`);
      }
      if (ie.daysAfter) {
        conditions.push(`E.${encCols.dateColumn} <= DATEADD(DAY, ${ie.daysAfter}, I.${ie.dateColumn})`);
      }
    } else {
      if (predicate.timing.serviceDateRange) {
        if (predicate.timing.serviceDateRange.start) {
          conditions.push(`E.${encCols.dateColumn} >= '${predicate.timing.serviceDateRange.start}'`);
        }
        if (predicate.timing.serviceDateRange.end) {
          conditions.push(`E.${encCols.dateColumn} <= '${predicate.timing.serviceDateRange.end}'`);
        }
      }
      if (predicate.timing.lookbackDays) {
        conditions.push(`E.${encCols.dateColumn} >= DATEADD(DAY, -${predicate.timing.lookbackDays}, GETDATE())`);
      }
    }
  }

  // Facility type constraints
  if (predicate.facilityType && predicate.facilityType.length > 0) {
    const facilities = predicate.facilityType.map(f => `'${f}'`).join(', ');
    conditions.push(`E.${encCols.facilityColumn} in (${facilities})`);
  }

  const whereClause = conditions.join('\n    and ');
  const description = predicate.description
    ? `-- ${predicate.description}\n`
    : '';

  const indexJoin = needsIndexJoin
    ? `\n  inner join ${ie!.cteAlias} I\n    on E.empi_id = I.empi_id\n    and E.population_id = I.population_id`
    : '';

  return `${description}${predicate.alias} as (
  select distinct
    E.population_id
    , E.empi_id
    , 'Encounter' as data_model
    , E.${encCols.idColumn} as identifier
    , E.${encCols.dateColumn} as clinical_start_date
    , E.${encCols.endDateColumn} as clinical_end_date
    , ${predicate.description ? `'${predicate.description.replace(/'/g, "''")}'` : 'null'} as description
  from ${T.encounter} E${indexJoin}
  where
    ${whereClause}
)`;
}

// ============================================================================
// Predicate Combination Templates
// ============================================================================

export function generatePredicateCombination(
  group: PredicateGroup,
  outputAlias: string
): string {
  const operator = group.operator;

  // Handle NOT operator (single child expected)
  if (operator === 'NOT' && group.children.length === 1) {
    const child = group.children[0];
    const childRef = typeof child === 'string' ? child : generatePredicateCombination(child, `${outputAlias}_sub`);
    return `-- NOT: Patients NOT in ${childRef}
${outputAlias} as (
  select empi_id from DEMOG
  except
  select empi_id from ${typeof child === 'string' ? child : `${outputAlias}_sub`}
)`;
  }

  // Handle INTERSECT (AND logic)
  if (operator === 'AND' || operator === 'INTERSECT') {
    const selects = group.children.map((child, i) => {
      if (typeof child === 'string') {
        return `  select empi_id from ${child}`;
      } else {
        return `  select empi_id from ${outputAlias}_nested_${i}`;
      }
    });
    return `-- AND/INTERSECT: Patients meeting ALL criteria
select count(*) from (
${selects.join('\nintersect\n')}
) ${outputAlias}`;
  }

  // Handle UNION (OR logic)
  if (operator === 'OR' || operator === 'UNION') {
    const selects = group.children.map((child, i) => {
      if (typeof child === 'string') {
        return `  select empi_id from ${child}`;
      } else {
        return `  select empi_id from ${outputAlias}_nested_${i}`;
      }
    });
    return `-- OR/UNION: Patients meeting ANY criteria
select count(*) from (
${selects.join('\nunion\n')}
) ${outputAlias}`;
  }

  // Handle EXCEPT (exclusion logic)
  if (operator === 'EXCEPT') {
    const [base, ...exclusions] = group.children;
    const baseRef = typeof base === 'string' ? base : `${outputAlias}_base`;
    const exclusionRefs = exclusions.map((ex, i) =>
      typeof ex === 'string' ? ex : `${outputAlias}_ex_${i}`
    );

    return `-- EXCEPT: Patients in base but NOT in exclusions
select count(*) from (
  select empi_id from ${baseRef}
${exclusionRefs.map(ex => `  except select empi_id from ${ex}`).join('\n')}
) ${outputAlias}`;
  }

  return `-- Unknown operator: ${operator}`;
}

// ============================================================================
// Full SQL Generation
// ============================================================================

export function generateFullSQL(
  predicateCTEs: string[],
  combination: string,
  config: SQLGenerationConfig,
  options?: {
    indexEventCTEs?: string[];
    auxiliaryCTEs?: string[];
  }
): string {
  const header = config.includeComments
    ? `-- ============================================================================
-- Generated SQL for HDI Platform
-- Population ID: ${config.populationId}
-- Dialect: ${config.dialect}
-- Generated: ${new Date().toISOString()}
-- ============================================================================
`
    : '';

  const ontCTE = generateOntologyCTE(config);
  const demogCTE = generateDemographicsCTE(config);

  // Index event CTEs come right after DEMOG, before predicates
  const indexSection = options?.indexEventCTEs?.length
    ? `,\n--\n${options.indexEventCTEs.join(',\n--\n')}`
    : '';

  const predicateSection = predicateCTEs.length > 0
    ? `,\n--\n${predicateCTEs.join(',\n--\n')}`
    : '';

  // Auxiliary CTEs come after predicates, before populations
  const auxSection = options?.auxiliaryCTEs?.length
    ? `,\n--\n${options.auxiliaryCTEs.join(',\n--\n')}`
    : '';

  const allSections = `${indexSection}${predicateSection}${auxSection}`;
  const sectionsWithTrailingComma = allSections.length > 0 ? `${allSections},` : ',';

  return `${header}with ${ontCTE},
${demogCTE}${sectionsWithTrailingComma}
--
-- Final population combination
${combination}`;
}
