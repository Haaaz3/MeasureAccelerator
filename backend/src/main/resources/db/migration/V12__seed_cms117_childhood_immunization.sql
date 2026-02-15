-- V12: Add CMS117 - Childhood Immunization Status
-- This measure assesses whether children who turn 2 years old during the
-- measurement period have received the recommended childhood immunizations.

-- ============================================================================
-- SECTION 1: LIBRARY COMPONENTS FOR CMS117
-- ============================================================================

-- Age component for children turning 2
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
('age-turn-2', 'atomic', 'Child Turns 2 During Measurement Period',
 'Child who turns 2 years old during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'DEMOGRAPHICS', false, 'ecqi',
 false, 'Patient', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Vaccine components for CMS117 numerator
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
-- DTaP (Diphtheria, Tetanus, Pertussis) - 4 doses required
('cms117-dtap-vaccine', 'atomic', 'DTaP Vaccine (4 doses)',
 'Four doses of diphtheria, tetanus, and pertussis (DTaP) vaccine administered by second birthday',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'IMMUNIZATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.196.12.1214', 'DTaP Vaccine', '20240101',
 'BEFORE', '2nd Birthday', 'administered by second birthday',
 false, 'Immunization', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- IPV (Inactivated Polio Vaccine) - 3 doses required
('cms117-ipv-vaccine', 'atomic', 'IPV Vaccine (3 doses)',
 'Three doses of inactivated polio vaccine (IPV) administered by second birthday',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'IMMUNIZATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.196.12.1219', 'Inactivated Polio Vaccine (IPV)', '20240101',
 'BEFORE', '2nd Birthday', 'administered by second birthday',
 false, 'Immunization', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- MMR (Measles, Mumps, Rubella) - 1 dose required
('cms117-mmr-vaccine', 'atomic', 'MMR Vaccine (1 dose)',
 'One dose of measles, mumps, and rubella (MMR) vaccine administered by second birthday',
 'LOW', 1, '1.0', 'APPROVED',
 'IMMUNIZATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.196.12.1224', 'Measles, Mumps and Rubella (MMR) Vaccine', '20240101',
 'BEFORE', '2nd Birthday', 'administered by second birthday',
 false, 'Immunization', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- HiB (Haemophilus influenzae type B) - 3 or 4 doses required
('cms117-hib-vaccine', 'atomic', 'HiB Vaccine (3-4 doses)',
 'Three or four doses of Haemophilus influenzae type B (HiB) vaccine administered by second birthday',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'IMMUNIZATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.196.12.1218', 'Haemophilus Influenzae Type B (Hib) Vaccine', '20240101',
 'BEFORE', '2nd Birthday', 'administered by second birthday',
 false, 'Immunization', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Hepatitis B - 3 doses required
('cms117-hepb-vaccine', 'atomic', 'Hepatitis B Vaccine (3 doses)',
 'Three doses of hepatitis B vaccine administered by second birthday',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'IMMUNIZATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.196.12.1216', 'Hepatitis B Vaccine', '20240101',
 'BEFORE', '2nd Birthday', 'administered by second birthday',
 false, 'Immunization', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- VZV (Varicella/Chickenpox) - 1 dose required
('cms117-vzv-vaccine', 'atomic', 'Varicella (VZV) Vaccine (1 dose)',
 'One dose of varicella (chickenpox) vaccine administered by second birthday',
 'LOW', 1, '1.0', 'APPROVED',
 'IMMUNIZATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.196.12.1232', 'Varicella Zoster Vaccine (VZV)', '20240101',
 'BEFORE', '2nd Birthday', 'administered by second birthday',
 false, 'Immunization', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- PCV (Pneumococcal Conjugate Vaccine) - 4 doses required
('cms117-pcv-vaccine', 'atomic', 'PCV Vaccine (4 doses)',
 'Four doses of pneumococcal conjugate vaccine (PCV) administered by second birthday',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'IMMUNIZATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.196.12.1221', 'Pneumococcal Conjugate Vaccine', '20240101',
 'BEFORE', '2nd Birthday', 'administered by second birthday',
 false, 'Immunization', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Hepatitis A - 1 dose required
('cms117-hepa-vaccine', 'atomic', 'Hepatitis A Vaccine (1 dose)',
 'One dose of hepatitis A vaccine administered by second birthday',
 'LOW', 1, '1.0', 'APPROVED',
 'IMMUNIZATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.196.12.1215', 'Hepatitis A Vaccine', '20240101',
 'BEFORE', '2nd Birthday', 'administered by second birthday',
 false, 'Immunization', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Rotavirus - 2 or 3 doses required
('cms117-rota-vaccine', 'atomic', 'Rotavirus Vaccine (2-3 doses)',
 'Two or three doses of rotavirus vaccine administered by second birthday',
 'MEDIUM', 2, '1.0', 'APPROVED',
 'IMMUNIZATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.196.12.1223', 'Rotavirus Vaccine', '20240101',
 'BEFORE', '2nd Birthday', 'administered by second birthday',
 false, 'Immunization', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),

-- Influenza - 2 doses required
('cms117-flu-vaccine', 'atomic', 'Influenza Vaccine (2 doses)',
 'Two doses of influenza vaccine administered by second birthday',
 'LOW', 1, '1.0', 'APPROVED',
 'IMMUNIZATIONS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.196.12.1217', 'Influenza Vaccine', '20240101',
 'BEFORE', '2nd Birthday', 'administered by second birthday',
 false, 'Immunization', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Encounter component for well-child visits
INSERT INTO library_component (
    id, component_type, name, description,
    complexity_level, complexity_score,
    version_id, version_status,
    category, category_auto_assigned, source_origin,
    value_set_oid, value_set_name, value_set_version,
    timing_operator, timing_reference, timing_display,
    negation, resource_type,
    usage_count,
    created_at, created_by, updated_at, updated_by
) VALUES
('enc-well-child', 'atomic', 'Well-Child Visit',
 'Well-child or pediatric preventive care visit during the measurement period',
 'LOW', 1, '1.0', 'APPROVED',
 'ENCOUNTERS', false, 'ecqi',
 '2.16.840.1.113883.3.464.1003.101.12.1024', 'Home Healthcare Services', '20240101',
 'DURING', 'Measurement Period', 'during Measurement Period',
 false, 'Encounter', 1,
 CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- SECTION 2: CMS117 MEASURE
-- ============================================================================

INSERT INTO measure (
    id, measure_id, title, version, steward, program, measure_type,
    description, rationale, clinical_recommendation,
    period_start, period_end,
    age_min, age_max,
    status,
    created_at, created_by, updated_at, updated_by
) VALUES (
    'cms117-v12', 'CMS117v12', 'Childhood Immunization Status',
    '12.0.000', 'National Committee for Quality Assurance', 'MIPS_CQM', 'process',
    'Percentage of children 2 years of age who had four diphtheria, tetanus and acellular pertussis (DTaP); three polio (IPV); one measles, mumps and rubella (MMR); three or four H influenza type B (HiB); three hepatitis B (Hep B); one chicken pox (VZV); four pneumococcal conjugate (PCV); one hepatitis A (Hep A); two or three rotavirus (RV); and two influenza (flu) vaccines by their second birthday.',
    'Infants and toddlers are particularly vulnerable to infectious diseases because their immune systems have not built up the necessary defenses to fight infection. Immunizations help prevent dangerous diseases and save lives.',
    'The Advisory Committee on Immunization Practices (ACIP) recommends that children receive all recommended vaccines according to the childhood immunization schedule. The CDC recommends completion of the primary vaccination series by age 2.',
    '2025-01-01', '2025-12-31',
    2, 2,
    'PUBLISHED',
    CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'
);

-- ============================================================================
-- SECTION 3: LOGICAL CLAUSES AND POPULATIONS
-- ============================================================================

-- Initial Population
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms117-ip-root', 'AND', 'Initial Population: Child turns 2 during measurement period AND qualifying encounter', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms117-ip', 'cms117-v12', 'INITIAL_POPULATION', 'Children who turn 2 during measurement period with qualifying encounter', 'Children who turn 2 years of age during the measurement period and have a qualifying encounter during the measurement period.', 'cms117-ip-root', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Denominator
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms117-den-root', 'AND', 'Denominator: Equals Initial Population', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms117-den', 'cms117-v12', 'DENOMINATOR', 'Equals Initial Population', 'Equals Initial Population', 'cms117-den-root', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Denominator Exclusion
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms117-denex-root', 'OR', 'Denominator Exclusion: Hospice care', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms117-denex', 'cms117-v12', 'DENOMINATOR_EXCLUSION', 'Hospice care', 'Children receiving hospice care during the measurement period.', 'cms117-denex-root', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Numerator
INSERT INTO logical_clause (id, operator, description, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms117-num-root', 'AND', 'Numerator: All required vaccinations by second birthday', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

INSERT INTO population (id, measure_id, population_type, description, narrative, root_clause_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES ('cms117-num', 'cms117-v12', 'NUMERATOR', 'All required childhood immunizations by second birthday', 'Children who have received all recommended immunizations (DTaP x4, IPV x3, MMR x1, HiB x3-4, Hep B x3, VZV x1, PCV x4, Hep A x1, Rotavirus x2-3, Influenza x2) by their second birthday.', 'cms117-num-root', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- SECTION 4: DATA ELEMENTS
-- ============================================================================

-- Initial Population data elements
INSERT INTO data_element (id, clause_id, element_type, description, library_component_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms117-ip-age', 'cms117-ip-root', 'DEMOGRAPHIC', 'Child turns 2 during measurement period', 'age-turn-2', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms117-ip-enc', 'cms117-ip-root', 'ENCOUNTER', 'Qualifying encounter during measurement period', 'enc-office-visit', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Denominator Exclusion data elements
INSERT INTO data_element (id, clause_id, element_type, description, library_component_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms117-denex-hospice', 'cms117-denex-root', 'ENCOUNTER', 'Hospice care', 'excl-hospice', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- Numerator data elements (all required vaccines)
INSERT INTO data_element (id, clause_id, element_type, description, library_component_id, display_order, created_at, created_by, updated_at, updated_by)
VALUES
('cms117-num-dtap', 'cms117-num-root', 'IMMUNIZATION', 'DTaP vaccine (4 doses)', 'cms117-dtap-vaccine', 0, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms117-num-ipv', 'cms117-num-root', 'IMMUNIZATION', 'IPV vaccine (3 doses)', 'cms117-ipv-vaccine', 1, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms117-num-mmr', 'cms117-num-root', 'IMMUNIZATION', 'MMR vaccine (1 dose)', 'cms117-mmr-vaccine', 2, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms117-num-hib', 'cms117-num-root', 'IMMUNIZATION', 'HiB vaccine (3-4 doses)', 'cms117-hib-vaccine', 3, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms117-num-hepb', 'cms117-num-root', 'IMMUNIZATION', 'Hepatitis B vaccine (3 doses)', 'cms117-hepb-vaccine', 4, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms117-num-vzv', 'cms117-num-root', 'IMMUNIZATION', 'Varicella vaccine (1 dose)', 'cms117-vzv-vaccine', 5, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms117-num-pcv', 'cms117-num-root', 'IMMUNIZATION', 'PCV vaccine (4 doses)', 'cms117-pcv-vaccine', 6, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms117-num-hepa', 'cms117-num-root', 'IMMUNIZATION', 'Hepatitis A vaccine (1 dose)', 'cms117-hepa-vaccine', 7, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms117-num-rota', 'cms117-num-root', 'IMMUNIZATION', 'Rotavirus vaccine (2-3 doses)', 'cms117-rota-vaccine', 8, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
('cms117-num-flu', 'cms117-num-root', 'IMMUNIZATION', 'Influenza vaccine (2 doses)', 'cms117-flu-vaccine', 9, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');

-- ============================================================================
-- SECTION 5: VALUE SETS
-- ============================================================================

-- Office Visit Value Set for CMS117
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-office-visit-cms117-v12', 'cms117-v12', '2.16.840.1.113883.3.464.1003.101.12.1001', 'Office Visit', '20240101', 'NCQA', true);

-- DTaP Vaccine Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-dtap-cms117', 'cms117-v12', '2.16.840.1.113883.3.464.1003.196.12.1214', 'DTaP Vaccine', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-dtap-90700', 'vs-dtap-cms117', '90700', 'CVX', 'http://hl7.org/fhir/sid/cvx', 'DTaP vaccine', '2024'),
('code-dtap-20', 'vs-dtap-cms117', '20', 'CVX', 'http://hl7.org/fhir/sid/cvx', 'DTaP', '2024');

-- IPV Vaccine Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-ipv-cms117', 'cms117-v12', '2.16.840.1.113883.3.464.1003.196.12.1219', 'Inactivated Polio Vaccine (IPV)', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-ipv-10', 'vs-ipv-cms117', '10', 'CVX', 'http://hl7.org/fhir/sid/cvx', 'IPV', '2024'),
('code-ipv-90713', 'vs-ipv-cms117', '90713', 'CPT', 'http://www.ama-assn.org/go/cpt', 'Poliovirus vaccine, inactivated', '2024');

-- MMR Vaccine Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-mmr-cms117', 'cms117-v12', '2.16.840.1.113883.3.464.1003.196.12.1224', 'Measles, Mumps and Rubella (MMR) Vaccine', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-mmr-03', 'vs-mmr-cms117', '03', 'CVX', 'http://hl7.org/fhir/sid/cvx', 'MMR', '2024'),
('code-mmr-90707', 'vs-mmr-cms117', '90707', 'CPT', 'http://www.ama-assn.org/go/cpt', 'MMR vaccine', '2024');

-- HiB Vaccine Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-hib-cms117', 'cms117-v12', '2.16.840.1.113883.3.464.1003.196.12.1218', 'Haemophilus Influenzae Type B (Hib) Vaccine', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-hib-17', 'vs-hib-cms117', '17', 'CVX', 'http://hl7.org/fhir/sid/cvx', 'Hib, unspecified formulation', '2024'),
('code-hib-90648', 'vs-hib-cms117', '90648', 'CPT', 'http://www.ama-assn.org/go/cpt', 'Hib vaccine (PRP-T)', '2024');

-- Hepatitis B Vaccine Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-hepb-cms117', 'cms117-v12', '2.16.840.1.113883.3.464.1003.196.12.1216', 'Hepatitis B Vaccine', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-hepb-08', 'vs-hepb-cms117', '08', 'CVX', 'http://hl7.org/fhir/sid/cvx', 'Hep B, pediatric', '2024'),
('code-hepb-90744', 'vs-hepb-cms117', '90744', 'CPT', 'http://www.ama-assn.org/go/cpt', 'Hep B vaccine, pediatric/adolescent', '2024');

-- Varicella Vaccine Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-vzv-cms117', 'cms117-v12', '2.16.840.1.113883.3.464.1003.196.12.1232', 'Varicella Zoster Vaccine (VZV)', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-vzv-21', 'vs-vzv-cms117', '21', 'CVX', 'http://hl7.org/fhir/sid/cvx', 'Varicella', '2024'),
('code-vzv-90716', 'vs-vzv-cms117', '90716', 'CPT', 'http://www.ama-assn.org/go/cpt', 'Varicella virus vaccine', '2024');

-- PCV Vaccine Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-pcv-cms117', 'cms117-v12', '2.16.840.1.113883.3.464.1003.196.12.1221', 'Pneumococcal Conjugate Vaccine', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-pcv-133', 'vs-pcv-cms117', '133', 'CVX', 'http://hl7.org/fhir/sid/cvx', 'PCV13', '2024'),
('code-pcv-90670', 'vs-pcv-cms117', '90670', 'CPT', 'http://www.ama-assn.org/go/cpt', 'PCV13 vaccine', '2024');

-- Hepatitis A Vaccine Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-hepa-cms117', 'cms117-v12', '2.16.840.1.113883.3.464.1003.196.12.1215', 'Hepatitis A Vaccine', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-hepa-83', 'vs-hepa-cms117', '83', 'CVX', 'http://hl7.org/fhir/sid/cvx', 'Hep A, pediatric', '2024'),
('code-hepa-90633', 'vs-hepa-cms117', '90633', 'CPT', 'http://www.ama-assn.org/go/cpt', 'Hep A vaccine, pediatric', '2024');

-- Rotavirus Vaccine Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-rota-cms117', 'cms117-v12', '2.16.840.1.113883.3.464.1003.196.12.1223', 'Rotavirus Vaccine', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-rota-116', 'vs-rota-cms117', '116', 'CVX', 'http://hl7.org/fhir/sid/cvx', 'Rotavirus, pentavalent', '2024'),
('code-rota-90680', 'vs-rota-cms117', '90680', 'CPT', 'http://www.ama-assn.org/go/cpt', 'Rotavirus vaccine, pentavalent', '2024');

-- Influenza Vaccine Value Set
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-flu-cms117', 'cms117-v12', '2.16.840.1.113883.3.464.1003.196.12.1217', 'Influenza Vaccine', '20240101', 'NCQA', true);

INSERT INTO value_set_code (id, value_set_id, code, code_system, system_uri, display, version)
VALUES
('code-flu-141', 'vs-flu-cms117', '141', 'CVX', 'http://hl7.org/fhir/sid/cvx', 'Influenza, seasonal, injectable', '2024'),
('code-flu-90686', 'vs-flu-cms117', '90686', 'CPT', 'http://www.ama-assn.org/go/cpt', 'Influenza virus vaccine, quadrivalent', '2024');

-- Hospice Value Set for CMS117
INSERT INTO measure_value_set (id, measure_id, oid, name, version, publisher, verified)
VALUES ('vs-hospice-cms117-v12', 'cms117-v12', '2.16.840.1.113883.3.526.3.1584', 'Hospice Care Ambulatory', '20240101', 'AMA-PCPI', true);

-- Update usage counts for shared components
UPDATE library_component SET usage_count = usage_count + 1 WHERE id = 'enc-office-visit';
UPDATE library_component SET usage_count = usage_count + 1 WHERE id = 'excl-hospice';
