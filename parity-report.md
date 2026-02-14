# AlgoAccelerator: TypeScript vs Java Code Generator Parity Report

**Generated:** 2026-02-13
**Purpose:** Document differences between TypeScript (frontend) and Java (backend) code generators to ensure consistent output.

---

## Overview

This report compares the following generator pairs:
- **CQL Generators**: `src/services/cqlGenerator.ts` vs `backend/src/main/java/com/algoaccel/service/CqlGeneratorService.java`
- **SQL Generators**: `src/services/hdiSqlGenerator.ts` vs `backend/src/main/java/com/algoaccel/service/hdi/HdiSqlGeneratorService.java`
- **SQL Templates**: `src/services/hdiSqlTemplates.ts` vs `backend/src/main/java/com/algoaccel/service/hdi/HdiSqlTemplateService.java`

---

## CQL Generator Parity

### Library Headers

| Aspect | TypeScript | Java | Status |
|--------|------------|------|--------|
| Library name from measureId | `sanitizeLibraryName()` | `sanitizeLibraryName()` | **MATCH** |
| FHIR version | `'4.0.1'` | `'4.0.1'` | **MATCH** |
| QICoreCommon version | `'2.0.0'` | `'2.0.0'` | **MATCH** |
| MATGlobalCommonFunctions version | `'7.0.000'` | `'7.0.000'` | **MATCH** |
| Hospice version | `'6.9.000'` | `'6.9.000'` | **MATCH** |
| Code systems declared | LOINC, SNOMEDCT, ICD10CM, CPT, HCPCS, RxNorm, CVX | Same set | **MATCH** |

### Value Set Declarations

| Aspect | TypeScript | Java | Status |
|--------|------------|------|--------|
| URL construction from OID | `http://cts.nlm.nih.gov/fhir/ValueSet/${oid}` | Same | **MATCH** |
| Warning for empty codes | Adds inline comment + warnings array | Same pattern | **MATCH** |
| Handling null/undefined | `if (!vs) continue` | `if (vs == null) continue` | **MATCH** |

### Parameters Section

| Aspect | TypeScript | Java | Status |
|--------|------------|------|--------|
| Default measurement period | Current year (hardcoded 2025) | `LocalDate.now().getYear()` | **MINOR DIFF** |
| Format | `@YYYY-MM-DDT00:00:00.0` | Same format | **MATCH** |

**Difference Detail:** TypeScript uses hardcoded `2025-01-01` as fallback, Java uses dynamic current year. This is intentional - Java backend should use runtime current year.

### Helper Definitions

| Aspect | TypeScript | Java | Status |
|--------|------------|------|--------|
| Age calculation | `AgeInYearsAt(date from end of "Measurement Period")` | Same | **MATCH** |
| Patient Age Valid | `Interval[min, max]` | Same | **MATCH** |
| Gender handling | `Patient.gender = '${gender}'` | `Patient.gender = '${gc.getGender().getValue()}'` | **MATCH** |
| Hospice services | `Hospice."Has Hospice Services"` | Same | **MATCH** |
| CRC helpers | Full set (Colonoscopy, FOBT, etc.) | Same | **MATCH** |
| Cervical helpers | Full set (Pap Test, HPV Test, etc.) | Same | **MATCH** |
| Breast cancer helpers | Full set | Same | **MATCH** |

### Population Definitions

| Aspect | TypeScript | Java | Status |
|--------|------------|------|--------|
| Operator mapping | `and`/`or` | Same | **MATCH** |
| Negation support | `not exists` | Same | **MATCH** |
| Resource type mapping | `diagnosis` -> `Condition`, etc. | Same mapping | **MATCH** |

### Patient.gender Handling

| Aspect | TypeScript | Java | Status |
|--------|------------|------|--------|
| Global constraint gender | `Patient.gender = '${gender}'` | `Patient.gender = '${gc.getGender().getValue()}'` | **MATCH** |
| Element-level genderValue | `Patient.gender = '${element.genderValue}'` | `Patient.gender = '${element.getGenderValue().getValue()}'` | **MATCH** |

### Supplemental Data

| Aspect | TypeScript | Java | Status |
|--------|------------|------|--------|
| SDE Ethnicity | `SDE."SDE Ethnicity"` | Same | **MATCH** |
| SDE Payer | `SDE."SDE Payer"` | Same | **MATCH** |
| SDE Race | `SDE."SDE Race"` | Same | **MATCH** |
| SDE Sex | `SDE."SDE Sex"` | Same | **MATCH** |

---

## HDI SQL Generator Parity

### CTE Structure

| Aspect | TypeScript | Java | Status |
|--------|------------|------|--------|
| ONT (Ontology) | `generateOntologyCTE()` | `generateOntologyCTE()` | **MATCH** |
| DEMOG (Demographics) | `generateDemographicsCTE()` | `generateDemographicsCTE()` | **MATCH** |
| PRED_* (Predicates) | Per-predicate CTEs | Same pattern | **MATCH** |
| Population combination | INTERSECT/UNION/EXCEPT | Same operators | **MATCH** |

### Demographics Age Calculation

| Aspect | TypeScript | Java | Status |
|--------|------------|------|--------|
| Age formula | `DATEDIFF(YEAR, birth_date, GETDATE()) - CASE...` | Same | **MATCH** |
| Birthday correction | `FORMAT(GETDATE(), 'MMdd') < FORMAT(birth_date, 'MMdd')` | Same | **MATCH** |

### Sex/Gender Filtering

| Aspect | TypeScript | Java | Status |
|--------|------------|------|--------|
| Gender to FHIR concept | `male` -> `['FHIR Male', 'FHIR Male Gender Identity']` | `mapGenderToFhirConcept('male')` -> `'FHIR Male'` | **DIFF** |
| Include array | Returns array with 2 values | Returns single value | **DIFF** |

**Difference Detail:**
- TypeScript includes both `'FHIR Male'` AND `'FHIR Male Gender Identity'` in the gender filter
- Java only maps to single value `'FHIR Male'`

**Impact:** Minor - Java implementation is simpler but may miss gender identity codes.

**Recommendation:** Update Java `mapGenderToFhirConcept()` to return a list matching TypeScript behavior, or document as intentional simplification.

### Population Combination Logic

| Aspect | TypeScript | Java | Status |
|--------|------------|------|--------|
| AND operator | `INTERSECT` | Same | **MATCH** |
| OR operator | `UNION` | Same | **MATCH** |
| NOT operator | `EXCEPT` | Same | **MATCH** |

### Ontology Context Derivation

| Aspect | TypeScript | Java | Status |
|--------|------------|------|--------|
| Demographics context | `'HEALTHE INTENT Demographics'` (always) | Same | **MATCH** |
| Conditions context | Derived from data models | Same pattern | **MATCH** |
| Procedures context | Derived from data models | Same pattern | **MATCH** |

---

## Summary of Differences

### Intentional Differences (Formatting/Environment)

1. **Measurement Period Default Year**
   - TypeScript: Hardcoded 2025
   - Java: Dynamic `LocalDate.now().getYear()`
   - **Status:** Intentional - backend should use runtime date

### Potential Bugs

1. **Gender Identity Mapping in SQL**
   - TypeScript includes both `'FHIR Male'` and `'FHIR Male Gender Identity'`
   - Java only returns `'FHIR Male'`
   - **Recommendation:** Consider updating Java to match TypeScript for completeness

### Verified Matches

- CQL library headers
- Value set declarations
- Code system declarations
- FHIR resource type mappings
- Logical operator handling (AND/OR/NOT)
- Age calculation formulas
- Hospice exclusion patterns
- Supplemental data elements
- SQL CTE structure
- Population combination operators

---

## Recommendations

1. **High Priority:** Verify the gender identity mapping difference is acceptable for the target HDI platform. If gender identity codes should be included, update `HdiSqlGeneratorService.mapGenderToFhirConcept()`.

2. **Low Priority:** Consider making the TypeScript measurement period default dynamic like Java (using browser date).

3. **Documentation:** Both implementations are well-documented and follow the same patterns. The Java implementation correctly notes "Ported from" the TypeScript source.

---

## Test Verification

To verify parity in production:

```bash
# Start backend
export JAVA_HOME=/Users/austindobson/java/jdk-17.0.9+9/Contents/Home
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# Create a test measure with populations via the UI
# Then compare outputs:
curl -s http://localhost:8080/api/measures/{ID}/cql > /tmp/java-cql.txt
curl -s http://localhost:8080/api/measures/{ID}/sql > /tmp/java-sql.txt

# Compare structure and patterns (exact text will differ due to timestamps)
```

---

*Report generated as part of post-migration validation for AlgoAccelerator Phase 3.*
