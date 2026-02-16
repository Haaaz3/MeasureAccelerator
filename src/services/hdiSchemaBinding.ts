/**
 * HDI Schema Binding System
 *
 * Provides typed schema definitions for the HDI (HealtheIntent) platform.
 * This ensures SQL generation uses valid table and column names, and
 * makes schema changes easier to manage across the codebase.
 *
 * Key features:
 * - Type-safe table and column definitions
 * - Validation of column references
 * - Mapping between UMS data types and HDI schemas
 * - Dialect-specific SQL type mappings
 */

// ============================================================================
// Core Schema Types
// ============================================================================

export type SQLDialect = 'synapse' | 'postgres' | 'oracle' | 'sqlserver';

export interface ColumnDefinition {
  name: string;
  type: SQLColumnType;
  nullable: boolean;
  description?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  referencesTable?: string;
  referencesColumn?: string;
}

export type SQLColumnType =
  | 'varchar'
  | 'nvarchar'
  | 'text'
  | 'int'
  | 'bigint'
  | 'decimal'
  | 'numeric'
  | 'float'
  | 'date'
  | 'datetime'
  | 'datetime2'
  | 'timestamp'
  | 'boolean'
  | 'bit'
  | 'uuid';

export interface TableDefinition {
  name: string;
  schema?: string;
  description?: string;
  columns: Record<string, ColumnDefinition>;
  primaryKey?: string[];
  indexes?: IndexDefinition[];
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface SchemaBinding {
  dialect: SQLDialect;
  tables: Record<string, TableDefinition>;
  valueSetsTable?: ValueSetTableConfig;
}

export interface ValueSetTableConfig {
  tableName: string;
  oidColumn: string;
  codeColumn: string;
  codeSystemColumn?: string;
  displayColumn?: string;
}

// ============================================================================
// HDI Schema Definition
// ============================================================================

/**
 * Standard HDI table definitions for clinical data models
 */
export const HDI_TABLES = {
  person: {
    name: 'ph_d_person',
    description: 'Patient demographics master table',
    columns: {
      population_id: { name: 'population_id', type: 'varchar', nullable: false, isPrimaryKey: true },
      empi_id: { name: 'empi_id', type: 'varchar', nullable: false, isPrimaryKey: true },
      gender_coding_system_id: { name: 'gender_coding_system_id', type: 'varchar', nullable: true },
      gender_code: { name: 'gender_code', type: 'varchar', nullable: true },
      birth_date: { name: 'birth_date', type: 'date', nullable: true },
      deceased: { name: 'deceased', type: 'boolean', nullable: true },
      deceased_dt_tm: { name: 'deceased_dt_tm', type: 'datetime', nullable: true },
      postal_cd: { name: 'postal_cd', type: 'varchar', nullable: true },
      state_coding_system_id: { name: 'state_coding_system_id', type: 'varchar', nullable: true },
      state_code: { name: 'state_code', type: 'varchar', nullable: true },
      country_coding_system_id: { name: 'country_coding_system_id', type: 'varchar', nullable: true },
      country_code: { name: 'country_code', type: 'varchar', nullable: true },
    },
    primaryKey: ['population_id', 'empi_id'],
  },

  person_demographics: {
    name: 'ph_d_person_demographics',
    description: 'Extended patient demographics',
    columns: {
      population_id: { name: 'population_id', type: 'varchar', nullable: false },
      empi_id: { name: 'empi_id', type: 'varchar', nullable: false },
      marital_coding_system_id: { name: 'marital_coding_system_id', type: 'varchar', nullable: true },
      marital_status_code: { name: 'marital_status_code', type: 'varchar', nullable: true },
      ethnicity_coding_system_id: { name: 'ethnicity_coding_system_id', type: 'varchar', nullable: true },
      ethnicity_code: { name: 'ethnicity_code', type: 'varchar', nullable: true },
      religion_coding_system_id: { name: 'religion_coding_system_id', type: 'varchar', nullable: true },
      religion_code: { name: 'religion_code', type: 'varchar', nullable: true },
    },
  },

  person_race: {
    name: 'ph_d_person_race',
    description: 'Patient race information (can have multiple)',
    columns: {
      population_id: { name: 'population_id', type: 'varchar', nullable: false },
      empi_id: { name: 'empi_id', type: 'varchar', nullable: false },
      race_coding_system_id: { name: 'race_coding_system_id', type: 'varchar', nullable: true },
      race_code: { name: 'race_code', type: 'varchar', nullable: true },
    },
  },

  ontology: {
    name: 'ph_d_ontology',
    description: 'Terminology/ontology reference table',
    columns: {
      population_id: { name: 'population_id', type: 'varchar', nullable: false },
      context_name: { name: 'context_name', type: 'varchar', nullable: false },
      concept_class_name: { name: 'concept_class_name', type: 'varchar', nullable: true },
      concept_name: { name: 'concept_name', type: 'varchar', nullable: true },
      code_system_id: { name: 'code_system_id', type: 'varchar', nullable: true },
      code_oid: { name: 'code_oid', type: 'varchar', nullable: true },
    },
  },

  condition: {
    name: 'ph_f_condition',
    description: 'Patient conditions/diagnoses',
    columns: {
      population_id: { name: 'population_id', type: 'varchar', nullable: false },
      empi_id: { name: 'empi_id', type: 'varchar', nullable: false },
      condition_id: { name: 'condition_id', type: 'varchar', nullable: false, isPrimaryKey: true },
      condition_code: { name: 'condition_code', type: 'varchar', nullable: true },
      condition_coding_system_id: { name: 'condition_coding_system_id', type: 'varchar', nullable: true },
      condition_type_code: { name: 'condition_type_code', type: 'varchar', nullable: true },
      status_code: { name: 'status_code', type: 'varchar', nullable: true },
      effective_date: { name: 'effective_date', type: 'date', nullable: true },
      claim_id: { name: 'claim_id', type: 'varchar', nullable: true },
    },
  },

  procedure: {
    name: 'ph_f_procedure',
    description: 'Patient procedures',
    columns: {
      population_id: { name: 'population_id', type: 'varchar', nullable: false },
      empi_id: { name: 'empi_id', type: 'varchar', nullable: false },
      procedure_id: { name: 'procedure_id', type: 'varchar', nullable: false, isPrimaryKey: true },
      procedure_code: { name: 'procedure_code', type: 'varchar', nullable: true },
      procedure_coding_system_id: { name: 'procedure_coding_system_id', type: 'varchar', nullable: true },
      performed_date: { name: 'performed_date', type: 'date', nullable: true },
    },
  },

  medication: {
    name: 'ph_f_medication',
    description: 'Patient medications/prescriptions',
    columns: {
      population_id: { name: 'population_id', type: 'varchar', nullable: false },
      empi_id: { name: 'empi_id', type: 'varchar', nullable: false },
      medication_id: { name: 'medication_id', type: 'varchar', nullable: false, isPrimaryKey: true },
      medication_code: { name: 'medication_code', type: 'varchar', nullable: true },
      medication_coding_system_id: { name: 'medication_coding_system_id', type: 'varchar', nullable: true },
      effective_date: { name: 'effective_date', type: 'date', nullable: true },
      end_date: { name: 'end_date', type: 'date', nullable: true },
      days_supply: { name: 'days_supply', type: 'int', nullable: true },
      status: { name: 'status', type: 'varchar', nullable: true },
    },
  },

  result: {
    name: 'ph_f_result',
    description: 'Patient lab/observation results',
    columns: {
      population_id: { name: 'population_id', type: 'varchar', nullable: false },
      empi_id: { name: 'empi_id', type: 'varchar', nullable: false },
      result_id: { name: 'result_id', type: 'varchar', nullable: false, isPrimaryKey: true },
      result_code: { name: 'result_code', type: 'varchar', nullable: true },
      result_coding_system_id: { name: 'result_coding_system_id', type: 'varchar', nullable: true },
      service_date: { name: 'service_date', type: 'date', nullable: true },
      numeric_value: { name: 'numeric_value', type: 'decimal', nullable: true },
      unit_of_measure_code: { name: 'unit_of_measure_code', type: 'varchar', nullable: true },
      norm_codified_value_code: { name: 'norm_codified_value_code', type: 'varchar', nullable: true },
      status: { name: 'status', type: 'varchar', nullable: true },
    },
  },

  immunization: {
    name: 'ph_f_immunization',
    description: 'Patient immunizations',
    columns: {
      population_id: { name: 'population_id', type: 'varchar', nullable: false },
      empi_id: { name: 'empi_id', type: 'varchar', nullable: false },
      immunization_id: { name: 'immunization_id', type: 'varchar', nullable: false, isPrimaryKey: true },
      immunization_code: { name: 'immunization_code', type: 'varchar', nullable: true },
      immunization_coding_system_id: { name: 'immunization_coding_system_id', type: 'varchar', nullable: true },
      administration_date: { name: 'administration_date', type: 'date', nullable: true },
    },
  },

  encounter: {
    name: 'ph_f_encounter',
    description: 'Patient encounters/visits',
    columns: {
      population_id: { name: 'population_id', type: 'varchar', nullable: false },
      empi_id: { name: 'empi_id', type: 'varchar', nullable: false },
      encounter_id: { name: 'encounter_id', type: 'varchar', nullable: false, isPrimaryKey: true },
      encounter_type_code: { name: 'encounter_type_code', type: 'varchar', nullable: true },
      encounter_type_coding_system_id: { name: 'encounter_type_coding_system_id', type: 'varchar', nullable: true },
      service_date: { name: 'service_date', type: 'date', nullable: true },
      discharge_date: { name: 'discharge_date', type: 'date', nullable: true },
      facility_type_code: { name: 'facility_type_code', type: 'varchar', nullable: true },
    },
  },
} as const satisfies Record<string, TableDefinition>;

/**
 * Default value set table configuration
 */
export const DEFAULT_VALUESET_CONFIG: ValueSetTableConfig = {
  tableName: 'valueset_codes',
  oidColumn: 'valueset_oid',
  codeColumn: 'code',
  codeSystemColumn: 'code_system',
  displayColumn: 'display',
};

// ============================================================================
// Data Model Mappings
// ============================================================================

/**
 * UMS data element type to HDI table mapping
 */
export const UMS_TO_HDI_TABLE: Record<string, keyof typeof HDI_TABLES> = {
  diagnosis: 'condition',
  condition: 'condition',
  procedure: 'procedure',
  medication: 'medication',
  observation: 'result',
  result: 'result',
  assessment: 'result',
  immunization: 'immunization',
  encounter: 'encounter',
  demographic: 'person',
};

/**
 * Get the HDI table for a UMS data element type
 */
export function getHDITable(umsType: string): TableDefinition | undefined {
  const tableKey = UMS_TO_HDI_TABLE[umsType.toLowerCase()];
  return tableKey ? HDI_TABLES[tableKey] : undefined;
}

/**
 * Column mappings for specific data model operations
 */
export const HDI_COLUMN_MAPPINGS = {
  condition: {
    codeColumn: 'condition_code',
    dateColumn: 'effective_date',
    idColumn: 'condition_id',
    statusColumn: 'status_code',
  },
  procedure: {
    codeColumn: 'procedure_code',
    dateColumn: 'performed_date',
    idColumn: 'procedure_id',
  },
  medication: {
    codeColumn: 'medication_code',
    dateColumn: 'effective_date',
    endDateColumn: 'end_date',
    idColumn: 'medication_id',
    daysSupplyColumn: 'days_supply',
    statusColumn: 'status',
  },
  result: {
    codeColumn: 'result_code',
    dateColumn: 'service_date',
    idColumn: 'result_id',
    valueColumn: 'numeric_value',
    unitColumn: 'unit_of_measure_code',
    codifiedValueColumn: 'norm_codified_value_code',
    statusColumn: 'status',
  },
  immunization: {
    codeColumn: 'immunization_code',
    dateColumn: 'administration_date',
    idColumn: 'immunization_id',
  },
  encounter: {
    codeColumn: 'encounter_type_code',
    dateColumn: 'service_date',
    endDateColumn: 'discharge_date',
    idColumn: 'encounter_id',
    facilityColumn: 'facility_type_code',
  },
} as const;

// ============================================================================
// Schema Validation
// ============================================================================

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
  warnings: string[];
}

export interface SchemaValidationError {
  type: 'missing_table' | 'missing_column' | 'type_mismatch' | 'invalid_reference';
  message: string;
  table?: string;
  column?: string;
}

/**
 * Validate that a column exists in a table
 */
export function validateColumn(
  tableName: keyof typeof HDI_TABLES,
  columnName: string
): SchemaValidationResult {
  const table = HDI_TABLES[tableName];
  if (!table) {
    return {
      valid: false,
      errors: [{ type: 'missing_table', message: `Table '${tableName}' not found in schema` }],
      warnings: [],
    };
  }

  const column = table.columns[columnName];
  if (!column) {
    return {
      valid: false,
      errors: [{
        type: 'missing_column',
        message: `Column '${columnName}' not found in table '${table.name}'`,
        table: table.name,
        column: columnName,
      }],
      warnings: [],
    };
  }

  return { valid: true, errors: [], warnings: [] };
}

/**
 * Validate a full predicate against the schema
 */
export function validatePredicateSchema(
  dataModel: string,
  columns: string[]
): SchemaValidationResult {
  const tableKey = UMS_TO_HDI_TABLE[dataModel.toLowerCase()];
  if (!tableKey) {
    return {
      valid: false,
      errors: [{ type: 'missing_table', message: `Unknown data model: ${dataModel}` }],
      warnings: [],
    };
  }

  const table = HDI_TABLES[tableKey];
  const errors: SchemaValidationError[] = [];

  for (const col of columns) {
    // Handle aliased columns (e.g., "C.condition_code" -> "condition_code")
    const colName = col.includes('.') ? col.split('.').pop()! : col;

    if (!table.columns[colName]) {
      errors.push({
        type: 'missing_column',
        message: `Column '${colName}' not found in table '${table.name}'`,
        table: table.name,
        column: colName,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

// ============================================================================
// SQL Expression Builders (Type-Safe)
// ============================================================================

/**
 * Build a type-safe column reference
 */
export function col(
  tableName: keyof typeof HDI_TABLES,
  columnName: string,
  alias?: string
): string {
  const table = HDI_TABLES[tableName];
  if (!table.columns[columnName]) {
    throw new SchemaBindingError(
      `Column '${columnName}' does not exist in table '${table.name}'`
    );
  }

  const prefix = alias ? `${alias}.` : '';
  return `${prefix}${table.columns[columnName].name}`;
}

/**
 * Build a type-safe table reference
 */
export function table(tableName: keyof typeof HDI_TABLES, alias?: string): string {
  const tableDefn = HDI_TABLES[tableName];
  return alias ? `${tableDefn.name} ${alias}` : tableDefn.name;
}

/**
 * Build a value set exists subquery
 */
export function valueSetExists(
  valueSetOid: string,
  codeColumnRef: string,
  config: ValueSetTableConfig = DEFAULT_VALUESET_CONFIG
): string {
  return `exists (
      select 1 from ${config.tableName} VS
      where VS.${config.oidColumn} = '${valueSetOid}'
        and VS.${config.codeColumn} = ${codeColumnRef}
    )`;
}

/**
 * Build a population filter clause
 */
export function populationFilter(alias: string, populationId: string): string {
  return `${alias}.population_id = '${populationId}'`;
}

// ============================================================================
// Dialect-Specific SQL Functions
// ============================================================================

export interface DialectFunctions {
  currentDate: () => string;
  dateAdd: (interval: 'day' | 'month' | 'year', amount: number, dateExpr: string) => string;
  dateDiff: (interval: 'day' | 'month' | 'year', start: string, end: string) => string;
  ageCalculation: (birthDateCol: string, asOfDateExpr: string) => string;
  coalesce: (...args: string[]) => string;
  iif: (condition: string, trueVal: string, falseVal: string) => string;
}

export const DIALECT_FUNCTIONS: Record<SQLDialect, DialectFunctions> = {
  synapse: {
    currentDate: () => 'GETDATE()',
    dateAdd: (interval, amount, dateExpr) =>
      `DATEADD(${interval.toUpperCase()}, ${amount}, ${dateExpr})`,
    dateDiff: (interval, start, end) =>
      `DATEDIFF(${interval.toUpperCase()}, ${start}, ${end})`,
    ageCalculation: (birthDateCol, asOfDateExpr) =>
      `DATEDIFF(YEAR, ${birthDateCol}, ${asOfDateExpr})
      - CASE
        WHEN FORMAT(${asOfDateExpr}, 'MMdd') < FORMAT(${birthDateCol}, 'MMdd') THEN 1
        ELSE 0
      END`,
    coalesce: (...args) => `COALESCE(${args.join(', ')})`,
    iif: (cond, t, f) => `IIF(${cond}, ${t}, ${f})`,
  },

  sqlserver: {
    currentDate: () => 'GETDATE()',
    dateAdd: (interval, amount, dateExpr) =>
      `DATEADD(${interval.toUpperCase()}, ${amount}, ${dateExpr})`,
    dateDiff: (interval, start, end) =>
      `DATEDIFF(${interval.toUpperCase()}, ${start}, ${end})`,
    ageCalculation: (birthDateCol, asOfDateExpr) =>
      `DATEDIFF(YEAR, ${birthDateCol}, ${asOfDateExpr})
      - CASE
        WHEN FORMAT(${asOfDateExpr}, 'MMdd') < FORMAT(${birthDateCol}, 'MMdd') THEN 1
        ELSE 0
      END`,
    coalesce: (...args) => `COALESCE(${args.join(', ')})`,
    iif: (cond, t, f) => `IIF(${cond}, ${t}, ${f})`,
  },

  postgres: {
    currentDate: () => 'CURRENT_DATE',
    dateAdd: (interval, amount, dateExpr) =>
      `${dateExpr} + INTERVAL '${amount} ${interval}s'`,
    dateDiff: (interval, start, end) => {
      if (interval === 'day') return `(${end}::date - ${start}::date)`;
      if (interval === 'year') return `EXTRACT(YEAR FROM AGE(${end}, ${start}))`;
      return `EXTRACT(${interval.toUpperCase()} FROM AGE(${end}, ${start}))`;
    },
    ageCalculation: (birthDateCol, asOfDateExpr) =>
      `EXTRACT(YEAR FROM AGE(${asOfDateExpr}::date, ${birthDateCol}::date))`,
    coalesce: (...args) => `COALESCE(${args.join(', ')})`,
    iif: (cond, t, f) => `CASE WHEN ${cond} THEN ${t} ELSE ${f} END`,
  },

  oracle: {
    currentDate: () => 'SYSDATE',
    dateAdd: (interval, amount, dateExpr) => {
      if (interval === 'day') return `${dateExpr} + ${amount}`;
      if (interval === 'month') return `ADD_MONTHS(${dateExpr}, ${amount})`;
      if (interval === 'year') return `ADD_MONTHS(${dateExpr}, ${amount * 12})`;
      return `${dateExpr} + ${amount}`;
    },
    dateDiff: (interval, start, end) => {
      if (interval === 'day') return `(${end} - ${start})`;
      if (interval === 'year') return `FLOOR(MONTHS_BETWEEN(${end}, ${start}) / 12)`;
      return `MONTHS_BETWEEN(${end}, ${start})`;
    },
    ageCalculation: (birthDateCol, asOfDateExpr) =>
      `FLOOR(MONTHS_BETWEEN(${asOfDateExpr}, ${birthDateCol}) / 12)`,
    coalesce: (...args) => `COALESCE(${args.join(', ')})`,
    iif: (cond, t, f) => `CASE WHEN ${cond} THEN ${t} ELSE ${f} END`,
  },
};

/**
 * Get dialect-specific SQL functions
 */
export function getDialectFunctions(dialect: SQLDialect): DialectFunctions {
  return DIALECT_FUNCTIONS[dialect];
}

// ============================================================================
// Predicate Building Helpers
// ============================================================================

export interface PredicateColumnConfig {
  dataModel: keyof typeof HDI_COLUMN_MAPPINGS;
  alias: string;
}

/**
 * Get the standard columns for a predicate data model
 */
export function getPredicateColumns(config: PredicateColumnConfig): {
  code: string;
  date: string;
  id: string;
  endDate?: string;
  status?: string;
} {
  const mapping = HDI_COLUMN_MAPPINGS[config.dataModel];
  const { alias } = config;

  return {
    code: `${alias}.${mapping.codeColumn}`,
    date: `${alias}.${mapping.dateColumn}`,
    id: `${alias}.${mapping.idColumn}`,
    endDate: 'endDateColumn' in mapping ? `${alias}.${mapping.endDateColumn}` : undefined,
    status: 'statusColumn' in mapping ? `${alias}.${mapping.statusColumn}` : undefined,
  };
}

/**
 * Build a standard predicate SELECT clause
 */
export function buildPredicateSelect(
  dataModel: string,
  alias: string,
  description?: string
): string {
  const tableKey = UMS_TO_HDI_TABLE[dataModel.toLowerCase()] as keyof typeof HDI_COLUMN_MAPPINGS;
  const mapping = HDI_COLUMN_MAPPINGS[tableKey];

  if (!mapping) {
    throw new SchemaBindingError(`Unknown data model: ${dataModel}`);
  }

  const endDateExpr = 'endDateColumn' in mapping
    ? `${alias}.${(mapping as typeof HDI_COLUMN_MAPPINGS.medication).endDateColumn}`
    : 'null';

  const descExpr = description
    ? `'${description.replace(/'/g, "''")}'`
    : 'null';

  return `select distinct
    ${alias}.population_id
    , ${alias}.empi_id
    , '${capitalize(dataModel)}' as data_model
    , ${alias}.${mapping.idColumn} as identifier
    , ${alias}.${mapping.dateColumn} as clinical_start_date
    , ${endDateExpr} as clinical_end_date
    , ${descExpr} as description`;
}

// ============================================================================
// Error Handling
// ============================================================================

export class SchemaBindingError extends Error {
  constructor(message: string) {
    super(`Schema Binding Error: ${message}`);
    this.name = 'SchemaBindingError';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Create a complete schema binding configuration
 */
export function createSchemaBinding(
  dialect: SQLDialect,
  valueSetConfig?: Partial<ValueSetTableConfig>
): SchemaBinding {
  return {
    dialect,
    tables: HDI_TABLES as unknown as Record<string, TableDefinition>,
    valueSetsTable: valueSetConfig
      ? { ...DEFAULT_VALUESET_CONFIG, ...valueSetConfig }
      : DEFAULT_VALUESET_CONFIG,
  };
}

/**
 * Export schema documentation for reference
 */
export function generateSchemaDocumentation(): string {
  const lines: string[] = [
    '# HDI Schema Reference',
    '',
    'This document describes the HDI (HealtheIntent) schema used for clinical data.',
    '',
  ];

  for (const [key, table] of Object.entries(HDI_TABLES)) {
    lines.push(`## ${table.name}`);
    if (table.description) {
      lines.push(table.description);
    }
    lines.push('');
    lines.push('| Column | Type | Nullable | Description |');
    lines.push('|--------|------|----------|-------------|');

    for (const [_colKey, col] of Object.entries(table.columns)) {
      const pk = col.isPrimaryKey ? ' (PK)' : '';
      lines.push(`| ${col.name}${pk} | ${col.type} | ${col.nullable ? 'Yes' : 'No'} | ${col.description || ''} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
