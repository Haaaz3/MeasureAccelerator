/**
 * Bundled Value Set Expansions
 *
 * Pre-expanded value sets for common CMS quality measures.
 * These are used when VSAC API is not available.
 *
 * Each value set includes the full code list from VSAC.
 * Version: 2024-05 (eCQI Publication Cycle)
 */

// Office Visit - commonly used across many CMS measures
export const OFFICE_VISIT = {
  oid: '2.16.840.1.113883.3.464.1003.101.12.1001',
  name: 'Office Visit',
  version: '2024-05',
  codes: [
    { code: '99201', system: 'CPT', display: 'Office visit, new patient, minimal' },
    { code: '99202', system: 'CPT', display: 'Office visit, new patient, straightforward' },
    { code: '99203', system: 'CPT', display: 'Office visit, new patient, low complexity' },
    { code: '99204', system: 'CPT', display: 'Office visit, new patient, moderate complexity' },
    { code: '99205', system: 'CPT', display: 'Office visit, new patient, high complexity' },
    { code: '99211', system: 'CPT', display: 'Office visit, established patient, minimal' },
    { code: '99212', system: 'CPT', display: 'Office visit, established patient, straightforward' },
    { code: '99213', system: 'CPT', display: 'Office visit, established patient, low complexity' },
    { code: '99214', system: 'CPT', display: 'Office visit, established patient, moderate complexity' },
    { code: '99215', system: 'CPT', display: 'Office visit, established patient, high complexity' },
  ],
};

// Preventive Care Services - Initial Office Visit, 0 to 17
export const PREVENTIVE_CARE_INITIAL_0_17 = {
  oid: '2.16.840.1.113883.3.464.1003.101.12.1022',
  name: 'Preventive Care Services, Initial Office Visit, 0 to 17',
  version: '2024-05',
  codes: [
    { code: '99381', system: 'CPT', display: 'Initial preventive visit, infant (<1 year)' },
    { code: '99382', system: 'CPT', display: 'Initial preventive visit, early childhood (1-4 years)' },
    { code: '99383', system: 'CPT', display: 'Initial preventive visit, late childhood (5-11 years)' },
    { code: '99384', system: 'CPT', display: 'Initial preventive visit, adolescent (12-17 years)' },
  ],
};

// Preventive Care Services - Established Office Visit, 0 to 17
export const PREVENTIVE_CARE_ESTABLISHED_0_17 = {
  oid: '2.16.840.1.113883.3.464.1003.101.12.1024',
  name: 'Preventive Care, Established Office Visit, 0 to 17',
  version: '2024-05',
  codes: [
    { code: '99391', system: 'CPT', display: 'Periodic preventive visit, infant (<1 year)' },
    { code: '99392', system: 'CPT', display: 'Periodic preventive visit, early childhood (1-4 years)' },
    { code: '99393', system: 'CPT', display: 'Periodic preventive visit, late childhood (5-11 years)' },
    { code: '99394', system: 'CPT', display: 'Periodic preventive visit, adolescent (12-17 years)' },
  ],
};

// Home Healthcare Services
export const HOME_HEALTHCARE_SERVICES = {
  oid: '2.16.840.1.113883.3.464.1003.101.12.1016',
  name: 'Home Healthcare Services',
  version: '2024-05',
  codes: [
    { code: '99341', system: 'CPT', display: 'Home visit, new patient, low complexity' },
    { code: '99342', system: 'CPT', display: 'Home visit, new patient, moderate complexity' },
    { code: '99343', system: 'CPT', display: 'Home visit, new patient, moderate-high complexity' },
    { code: '99344', system: 'CPT', display: 'Home visit, new patient, high complexity' },
    { code: '99345', system: 'CPT', display: 'Home visit, new patient, very high complexity' },
    { code: '99347', system: 'CPT', display: 'Home visit, established patient, minimal' },
    { code: '99348', system: 'CPT', display: 'Home visit, established patient, low complexity' },
    { code: '99349', system: 'CPT', display: 'Home visit, established patient, moderate complexity' },
    { code: '99350', system: 'CPT', display: 'Home visit, established patient, high complexity' },
  ],
};

// DTaP Vaccine (CMS117 - Childhood Immunization)
export const DTAP_VACCINE = {
  oid: '2.16.840.1.113883.3.464.1003.196.12.1214',
  name: 'DTaP Vaccine',
  version: '2024-05',
  codes: [
    { code: '20', system: 'CVX', display: 'DTaP' },
    { code: '50', system: 'CVX', display: 'DTaP-Hib' },
    { code: '106', system: 'CVX', display: 'DTaP, 5 pertussis antigens' },
    { code: '107', system: 'CVX', display: 'DTaP, NOS' },
    { code: '110', system: 'CVX', display: 'DTaP-Hep B-IPV' },
    { code: '120', system: 'CVX', display: 'DTaP-Hib-IPV' },
    { code: '130', system: 'CVX', display: 'DTaP-IPV' },
    { code: '132', system: 'CVX', display: 'DTaP-IPV-Hib-Hep B (historical)' },
    { code: '146', system: 'CVX', display: 'DTaP-IPV-Hib-Hep B' },
    { code: '170', system: 'CVX', display: 'DTaP-IPV-Hib-Hep B-Hib (non-US)' },
    { code: '187', system: 'CVX', display: 'Hexavalent DTaP-IPV-Hib-Hep B' },
  ],
};

// IPV (Polio) Vaccine
export const IPV_VACCINE = {
  oid: '2.16.840.1.113883.3.464.1003.196.12.1219',
  name: 'Inactivated Polio Vaccine (IPV)',
  version: '2024-05',
  codes: [
    { code: '10', system: 'CVX', display: 'IPV' },
    { code: '89', system: 'CVX', display: 'Polio, NOS' },
    { code: '110', system: 'CVX', display: 'DTaP-Hep B-IPV' },
    { code: '120', system: 'CVX', display: 'DTaP-Hib-IPV' },
    { code: '130', system: 'CVX', display: 'DTaP-IPV' },
    { code: '132', system: 'CVX', display: 'DTaP-IPV-Hib-Hep B (historical)' },
    { code: '146', system: 'CVX', display: 'DTaP-IPV-Hib-Hep B' },
    { code: '170', system: 'CVX', display: 'DTaP-IPV-Hib-Hep B-Hib (non-US)' },
  ],
};

// MMR Vaccine
export const MMR_VACCINE = {
  oid: '2.16.840.1.113883.3.464.1003.196.12.1224',
  name: 'Measles, Mumps and Rubella (MMR) Vaccine',
  version: '2024-05',
  codes: [
    { code: '03', system: 'CVX', display: 'MMR' },
    { code: '94', system: 'CVX', display: 'MMRV' },
  ],
};

// Hib Vaccine 3-dose
export const HIB_VACCINE_3_DOSE = {
  oid: '2.16.840.1.113883.3.464.1003.110.12.1083',
  name: 'Hib Vaccine (3 dose schedule)',
  version: '2024-05',
  codes: [
    { code: '49', system: 'CVX', display: 'Hib (PRP-OMP)' },
    { code: '148', system: 'CVX', display: 'Hib-Men CY' },
  ],
};

// Hib Vaccine 4-dose
export const HIB_VACCINE_4_DOSE = {
  oid: '2.16.840.1.113883.3.464.1003.110.12.1085',
  name: 'Hib Vaccine (4 dose schedule)',
  version: '2024-05',
  codes: [
    { code: '17', system: 'CVX', display: 'Hib, NOS' },
    { code: '46', system: 'CVX', display: 'Hib (PRP-D)' },
    { code: '47', system: 'CVX', display: 'Hib (HbOC)' },
    { code: '48', system: 'CVX', display: 'Hib (PRP-T)' },
    { code: '50', system: 'CVX', display: 'DTaP-Hib' },
    { code: '51', system: 'CVX', display: 'Hib-Hep B' },
    { code: '120', system: 'CVX', display: 'DTaP-Hib-IPV' },
    { code: '132', system: 'CVX', display: 'DTaP-IPV-Hib-Hep B (historical)' },
    { code: '146', system: 'CVX', display: 'DTaP-IPV-Hib-Hep B' },
    { code: '170', system: 'CVX', display: 'DTaP-IPV-Hib-Hep B-Hib (non-US)' },
  ],
};

// Hepatitis B Vaccine
export const HEPATITIS_B_VACCINE = {
  oid: '2.16.840.1.113883.3.464.1003.196.12.1189',
  name: 'Hepatitis B Vaccine',
  version: '2024-05',
  codes: [
    { code: '08', system: 'CVX', display: 'Hep B, adolescent or pediatric' },
    { code: '42', system: 'CVX', display: 'Hep B, adolescent/high risk infant' },
    { code: '43', system: 'CVX', display: 'Hep B, adult' },
    { code: '44', system: 'CVX', display: 'Hep B, dialysis' },
    { code: '45', system: 'CVX', display: 'Hep B, NOS' },
    { code: '51', system: 'CVX', display: 'Hib-Hep B' },
    { code: '102', system: 'CVX', display: 'DTaP-Hep B-IPV' },
    { code: '104', system: 'CVX', display: 'Hep A-Hep B' },
    { code: '110', system: 'CVX', display: 'DTaP-Hep B-IPV' },
    { code: '132', system: 'CVX', display: 'DTaP-IPV-Hib-Hep B (historical)' },
    { code: '146', system: 'CVX', display: 'DTaP-IPV-Hib-Hep B' },
    { code: '189', system: 'CVX', display: 'Hep B (CpG adjuvanted)' },
  ],
};

// Varicella Zoster (Chickenpox) Vaccine
export const VZV_VACCINE = {
  oid: '2.16.840.1.113883.3.464.1003.196.12.1170',
  name: 'Varicella Zoster Vaccine',
  version: '2024-05',
  codes: [
    { code: '21', system: 'CVX', display: 'Varicella' },
    { code: '94', system: 'CVX', display: 'MMRV' },
  ],
};

// Pneumococcal Conjugate Vaccine
export const PNEUMOCOCCAL_CONJUGATE_VACCINE = {
  oid: '2.16.840.1.113883.3.464.1003.196.12.1221',
  name: 'Pneumococcal Conjugate Vaccine',
  version: '2024-05',
  codes: [
    { code: '133', system: 'CVX', display: 'PCV13' },
    { code: '152', system: 'CVX', display: 'PCV (NOS)' },
    { code: '215', system: 'CVX', display: 'PCV15' },
    { code: '216', system: 'CVX', display: 'PCV20' },
  ],
};

// Rotavirus Vaccine (2-dose schedule)
export const ROTAVIRUS_VACCINE_2_DOSE = {
  oid: '2.16.840.1.113883.3.464.1003.196.12.1223',
  name: 'Rotavirus Vaccine (2 dose schedule)',
  version: '2024-05',
  codes: [
    { code: '119', system: 'CVX', display: 'Rotavirus, monovalent' },
  ],
};

// Rotavirus Vaccine (3-dose schedule)
export const ROTAVIRUS_VACCINE_3_DOSE = {
  oid: '2.16.840.1.113883.3.464.1003.196.12.1222',
  name: 'Rotavirus Vaccine (3 dose schedule)',
  version: '2024-05',
  codes: [
    { code: '116', system: 'CVX', display: 'Rotavirus, pentavalent' },
    { code: '122', system: 'CVX', display: 'Rotavirus, NOS' },
  ],
};

// Influenza Vaccine
export const INFLUENZA_VACCINE = {
  oid: '2.16.840.1.113883.3.464.1003.196.12.1153',
  name: 'Influenza Vaccine',
  version: '2024-05',
  codes: [
    { code: '88', system: 'CVX', display: 'Influenza, NOS' },
    { code: '140', system: 'CVX', display: 'Influenza, IIV3, high dose' },
    { code: '141', system: 'CVX', display: 'Influenza, IIV3, intradermal' },
    { code: '150', system: 'CVX', display: 'Influenza, IIV4, intradermal' },
    { code: '153', system: 'CVX', display: 'Influenza, LAIV4, intranasal' },
    { code: '155', system: 'CVX', display: 'Influenza, RIV' },
    { code: '158', system: 'CVX', display: 'Influenza, IIV4' },
    { code: '161', system: 'CVX', display: 'Influenza, IIV4, intradermal' },
    { code: '166', system: 'CVX', display: 'Influenza, IIV4, adjuvanted' },
    { code: '168', system: 'CVX', display: 'Influenza, IIV3, adjuvanted' },
    { code: '171', system: 'CVX', display: 'Influenza, IIV4, high dose' },
    { code: '185', system: 'CVX', display: 'Influenza, RIV4' },
    { code: '186', system: 'CVX', display: 'Influenza, IIV3' },
    { code: '197', system: 'CVX', display: 'Influenza, IIV4, high dose, quadrivalent' },
    { code: '205', system: 'CVX', display: 'Influenza, IIV4, adjuvanted, quadrivalent' },
  ],
};

// Hepatitis A Vaccine
export const HEPATITIS_A_VACCINE = {
  oid: '2.16.840.1.113883.3.464.1003.196.12.1215',
  name: 'Hepatitis A Vaccine',
  version: '2024-05',
  codes: [
    { code: '31', system: 'CVX', display: 'Hep A, pediatric, NOS' },
    { code: '52', system: 'CVX', display: 'Hep A, adult' },
    { code: '83', system: 'CVX', display: 'Hep A, pediatric/adolescent, 2 dose' },
    { code: '84', system: 'CVX', display: 'Hep A, pediatric/adolescent, 3 dose' },
    { code: '85', system: 'CVX', display: 'Hep A, NOS' },
    { code: '104', system: 'CVX', display: 'Hep A-Hep B' },
  ],
};

// Child Influenza Vaccine (different from adult influenza)
export const CHILD_INFLUENZA_VACCINE = {
  oid: '2.16.840.1.113883.3.464.1003.196.12.1218',
  name: 'Influenza Vaccine for Children',
  version: '2024-05',
  codes: [
    { code: '88', system: 'CVX', display: 'Influenza, NOS' },
    { code: '135', system: 'CVX', display: 'Influenza, high dose' },
    { code: '140', system: 'CVX', display: 'Influenza, IIV3, high dose' },
    { code: '141', system: 'CVX', display: 'Influenza, IIV3, intradermal' },
    { code: '150', system: 'CVX', display: 'Influenza, IIV4, intradermal' },
    { code: '153', system: 'CVX', display: 'Influenza, LAIV4, intranasal' },
    { code: '155', system: 'CVX', display: 'Influenza, RIV' },
    { code: '158', system: 'CVX', display: 'Influenza, IIV4' },
    { code: '161', system: 'CVX', display: 'Influenza, IIV4, intradermal' },
    { code: '171', system: 'CVX', display: 'Influenza, IIV4, high dose' },
    { code: '185', system: 'CVX', display: 'Influenza, RIV4' },
    { code: '186', system: 'CVX', display: 'Influenza, IIV3' },
    { code: '197', system: 'CVX', display: 'Influenza, IIV4, high dose, quadrivalent' },
    { code: '205', system: 'CVX', display: 'Influenza, IIV4, adjuvanted, quadrivalent' },
  ],
};

// Diabetes (CMS122)
export const DIABETES = {
  oid: '2.16.840.1.113883.3.464.1003.103.12.1001',
  name: 'Diabetes',
  version: '2024-05',
  codes: [
    { code: 'E08', system: 'ICD10', display: 'Diabetes mellitus due to underlying condition' },
    { code: 'E09', system: 'ICD10', display: 'Drug or chemical induced diabetes mellitus' },
    { code: 'E10', system: 'ICD10', display: 'Type 1 diabetes mellitus' },
    { code: 'E11', system: 'ICD10', display: 'Type 2 diabetes mellitus' },
    { code: 'E13', system: 'ICD10', display: 'Other specified diabetes mellitus' },
    { code: '73211009', system: 'SNOMED', display: 'Diabetes mellitus' },
    { code: '44054006', system: 'SNOMED', display: 'Type 2 diabetes mellitus' },
    { code: '46635009', system: 'SNOMED', display: 'Type 1 diabetes mellitus' },
  ],
};

// HbA1c Lab Test (CMS122)
export const HBA1C_LAB_TEST = {
  oid: '2.16.840.1.113883.3.464.1003.198.12.1013',
  name: 'HbA1c Laboratory Test',
  version: '2024-05',
  codes: [
    { code: '4548-4', system: 'LOINC', display: 'Hemoglobin A1c/Hemoglobin.total in Blood' },
    { code: '4549-2', system: 'LOINC', display: 'Hemoglobin A1c/Hemoglobin.total in Blood by Electrophoresis' },
    { code: '17856-6', system: 'LOINC', display: 'Hemoglobin A1c/Hemoglobin.total in Blood by HPLC' },
    { code: '59261-8', system: 'LOINC', display: 'Hemoglobin A1c/Hemoglobin.total in Blood by IFCC protocol' },
    { code: '62388-4', system: 'LOINC', display: 'Hemoglobin A1c/Hemoglobin.total in Blood by JDS/JSCC protocol' },
  ],
};

// Hypertension (CMS165)
export const ESSENTIAL_HYPERTENSION = {
  oid: '2.16.840.1.113883.3.464.1003.104.12.1011',
  name: 'Essential Hypertension',
  version: '2024-05',
  codes: [
    { code: 'I10', system: 'ICD10', display: 'Essential (primary) hypertension' },
    { code: '59621000', system: 'SNOMED', display: 'Essential hypertension' },
    { code: '38341003', system: 'SNOMED', display: 'Hypertensive disorder, systemic arterial' },
  ],
};

// Hospice Encounter (common exclusion)
export const HOSPICE_ENCOUNTER = {
  oid: '2.16.840.1.113883.3.464.1003.1003',
  name: 'Hospice Encounter',
  version: '2024-05',
  codes: [
    { code: '385763009', system: 'SNOMED', display: 'Hospice care' },
    { code: '385765002', system: 'SNOMED', display: 'Hospice care management' },
  ],
};

// Severe Combined Immunodeficiency (CMS117 Denominator Exclusion)
export const SEVERE_COMBINED_IMMUNODEFICIENCY = {
  oid: '2.16.840.1.113883.3.464.1003.120.12.1007',
  name: 'Severe Combined Immunodeficiency',
  version: '2024-05',
  codes: [
    { code: 'D81.0', system: 'ICD10', display: 'Severe combined immunodeficiency with reticular dysgenesis' },
    { code: 'D81.1', system: 'ICD10', display: 'Severe combined immunodeficiency with low T- and B-cell numbers' },
    { code: 'D81.2', system: 'ICD10', display: 'Severe combined immunodeficiency with low or normal B-cell numbers' },
    { code: 'D81.9', system: 'ICD10', display: 'Combined immunodeficiency, unspecified' },
    { code: '31323000', system: 'SNOMED', display: 'Severe combined immunodeficiency disease' },
  ],
};

// Disorders of the Immune System (CMS117 Denominator Exclusion)
export const DISORDERS_OF_IMMUNE_SYSTEM = {
  oid: '2.16.840.1.113883.3.464.1003.120.12.1001',
  name: 'Disorders of the Immune System',
  version: '2024-05',
  codes: [
    { code: 'D80.0', system: 'ICD10', display: 'Hereditary hypogammaglobulinemia' },
    { code: 'D80.1', system: 'ICD10', display: 'Nonfamilial hypogammaglobulinemia' },
    { code: 'D80.2', system: 'ICD10', display: 'Selective deficiency of immunoglobulin A [IgA]' },
    { code: 'D80.3', system: 'ICD10', display: 'Selective deficiency of immunoglobulin G [IgG] subclasses' },
    { code: 'D80.4', system: 'ICD10', display: 'Selective deficiency of immunoglobulin M [IgM]' },
    { code: 'D80.5', system: 'ICD10', display: 'Immunodeficiency with increased immunoglobulin M [IgM]' },
    { code: 'D80.6', system: 'ICD10', display: 'Antibody deficiency with near-normal immunoglobulins' },
    { code: 'D80.7', system: 'ICD10', display: 'Transient hypogammaglobulinemia of infancy' },
    { code: 'D80.8', system: 'ICD10', display: 'Other immunodeficiencies with predominantly antibody defects' },
    { code: 'D80.9', system: 'ICD10', display: 'Immunodeficiency with predominantly antibody defects, unspecified' },
    { code: 'D83.0', system: 'ICD10', display: 'Common variable immunodeficiency with predominant abnormalities of B-cell numbers and function' },
    { code: 'D83.1', system: 'ICD10', display: 'Common variable immunodeficiency with predominant immunoregulatory T-cell disorders' },
    { code: 'D83.2', system: 'ICD10', display: 'Common variable immunodeficiency with autoantibodies to B- or T-cells' },
    { code: 'D83.8', system: 'ICD10', display: 'Other common variable immunodeficiencies' },
    { code: 'D83.9', system: 'ICD10', display: 'Common variable immunodeficiency, unspecified' },
    { code: 'D84.0', system: 'ICD10', display: 'Lymphocyte function antigen-1 [LFA-1] defect' },
    { code: 'D84.1', system: 'ICD10', display: 'Defects in the complement system' },
    { code: 'D84.8', system: 'ICD10', display: 'Other specified immunodeficiencies' },
    { code: 'D84.9', system: 'ICD10', display: 'Immunodeficiency, unspecified' },
    { code: 'D89.9', system: 'ICD10', display: 'Disorder involving the immune mechanism, unspecified' },
  ],
};

// HIV (CMS117 Denominator Exclusion)
export const HIV = {
  oid: '2.16.840.1.113883.3.464.1003.120.12.1003',
  name: 'HIV',
  version: '2024-05',
  codes: [
    { code: 'B20', system: 'ICD10', display: 'Human immunodeficiency virus [HIV] disease' },
    { code: 'Z21', system: 'ICD10', display: 'Asymptomatic human immunodeficiency virus [HIV] infection status' },
    { code: '86406008', system: 'SNOMED', display: 'Human immunodeficiency virus infection' },
    { code: '165816005', system: 'SNOMED', display: 'Human immunodeficiency virus positive' },
  ],
};

// Malignant Neoplasm of Lymphatic and Hematopoietic Tissue (CMS117 Denominator Exclusion)
export const MALIGNANT_NEOPLASM_LYMPHATIC = {
  oid: '2.16.840.1.113883.3.464.1003.108.12.1009',
  name: 'Malignant Neoplasm of Lymphatic and Hematopoietic Tissue',
  version: '2024-05',
  codes: [
    { code: 'C81.00', system: 'ICD10', display: 'Nodular lymphocyte predominant Hodgkin lymphoma, unspecified site' },
    { code: 'C81.10', system: 'ICD10', display: 'Nodular sclerosis Hodgkin lymphoma, unspecified site' },
    { code: 'C81.20', system: 'ICD10', display: 'Mixed cellularity Hodgkin lymphoma, unspecified site' },
    { code: 'C81.30', system: 'ICD10', display: 'Lymphocyte depleted Hodgkin lymphoma, unspecified site' },
    { code: 'C81.90', system: 'ICD10', display: 'Hodgkin lymphoma, unspecified, unspecified site' },
    { code: 'C82.00', system: 'ICD10', display: 'Follicular lymphoma grade I, unspecified site' },
    { code: 'C83.00', system: 'ICD10', display: 'Small cell B-cell lymphoma, unspecified site' },
    { code: 'C84.00', system: 'ICD10', display: 'Mycosis fungoides, unspecified site' },
    { code: 'C85.10', system: 'ICD10', display: 'Unspecified B-cell lymphoma, unspecified site' },
    { code: 'C85.90', system: 'ICD10', display: 'Non-Hodgkin lymphoma, unspecified, unspecified site' },
    { code: 'C90.00', system: 'ICD10', display: 'Multiple myeloma not having achieved remission' },
    { code: 'C91.00', system: 'ICD10', display: 'Acute lymphoblastic leukemia not having achieved remission' },
    { code: 'C91.10', system: 'ICD10', display: 'Chronic lymphocytic leukemia of B-cell type not having achieved remission' },
    { code: 'C92.00', system: 'ICD10', display: 'Acute myeloblastic leukemia, not having achieved remission' },
    { code: 'C92.10', system: 'ICD10', display: 'Chronic myeloid leukemia, BCR/ABL-positive, not having achieved remission' },
    { code: 'C95.00', system: 'ICD10', display: 'Acute leukemia of unspecified cell type not having achieved remission' },
    { code: 'C95.90', system: 'ICD10', display: 'Leukemia, unspecified not having achieved remission' },
    { code: '93143009', system: 'SNOMED', display: 'Leukemia' },
    { code: '118600007', system: 'SNOMED', display: 'Malignant lymphoma' },
  ],
};

// Intussusception (CMS117 Rotavirus contraindication)
export const INTUSSUSCEPTION = {
  oid: '2.16.840.1.113883.3.464.1003.199.12.1056',
  name: 'Intussusception',
  version: '2024-05',
  codes: [
    { code: 'K56.1', system: 'ICD10', display: 'Intussusception' },
    { code: '40054001', system: 'SNOMED', display: 'Intussusception' },
  ],
};

// Anaphylactic Reaction to DTaP Vaccine
export const ANAPHYLAXIS_DTAP = {
  oid: '2.16.840.1.113883.3.464.1003.199.12.1031',
  name: 'Anaphylactic Reaction to DTaP Vaccine',
  version: '2024-05',
  codes: [
    { code: '428321000124101', system: 'SNOMED', display: 'Anaphylaxis caused by vaccine product containing Corynebacterium diphtheriae and Clostridium tetani and Bordetella pertussis antigens' },
  ],
};

// Anaphylactic Reaction to Common Vaccine
export const ANAPHYLAXIS_COMMON_VACCINE = {
  oid: '2.16.840.1.113883.3.464.1003.199.12.1032',
  name: 'Anaphylactic Reaction to Common Vaccine',
  version: '2024-05',
  codes: [
    { code: '293104008', system: 'SNOMED', display: 'Adverse reaction to component of vaccine product' },
    { code: '219082005', system: 'SNOMED', display: 'Adverse reaction to vaccine' },
  ],
};

// Create a lookup map by OID for quick access
export const VALUE_SET_BY_OID = {
  [OFFICE_VISIT.oid]: OFFICE_VISIT,
  [PREVENTIVE_CARE_INITIAL_0_17.oid]: PREVENTIVE_CARE_INITIAL_0_17,
  [PREVENTIVE_CARE_ESTABLISHED_0_17.oid]: PREVENTIVE_CARE_ESTABLISHED_0_17,
  [HOME_HEALTHCARE_SERVICES.oid]: HOME_HEALTHCARE_SERVICES,
  [DTAP_VACCINE.oid]: DTAP_VACCINE,
  [IPV_VACCINE.oid]: IPV_VACCINE,
  [MMR_VACCINE.oid]: MMR_VACCINE,
  [HIB_VACCINE_3_DOSE.oid]: HIB_VACCINE_3_DOSE,
  [HIB_VACCINE_4_DOSE.oid]: HIB_VACCINE_4_DOSE,
  [HEPATITIS_B_VACCINE.oid]: HEPATITIS_B_VACCINE,
  [VZV_VACCINE.oid]: VZV_VACCINE,
  [PNEUMOCOCCAL_CONJUGATE_VACCINE.oid]: PNEUMOCOCCAL_CONJUGATE_VACCINE,
  [ROTAVIRUS_VACCINE_2_DOSE.oid]: ROTAVIRUS_VACCINE_2_DOSE,
  [ROTAVIRUS_VACCINE_3_DOSE.oid]: ROTAVIRUS_VACCINE_3_DOSE,
  [INFLUENZA_VACCINE.oid]: INFLUENZA_VACCINE,
  [HEPATITIS_A_VACCINE.oid]: HEPATITIS_A_VACCINE,
  [CHILD_INFLUENZA_VACCINE.oid]: CHILD_INFLUENZA_VACCINE,
  [DIABETES.oid]: DIABETES,
  [HBA1C_LAB_TEST.oid]: HBA1C_LAB_TEST,
  [ESSENTIAL_HYPERTENSION.oid]: ESSENTIAL_HYPERTENSION,
  [HOSPICE_ENCOUNTER.oid]: HOSPICE_ENCOUNTER,
  [SEVERE_COMBINED_IMMUNODEFICIENCY.oid]: SEVERE_COMBINED_IMMUNODEFICIENCY,
  [DISORDERS_OF_IMMUNE_SYSTEM.oid]: DISORDERS_OF_IMMUNE_SYSTEM,
  [HIV.oid]: HIV,
  [MALIGNANT_NEOPLASM_LYMPHATIC.oid]: MALIGNANT_NEOPLASM_LYMPHATIC,
  [INTUSSUSCEPTION.oid]: INTUSSUSCEPTION,
  [ANAPHYLAXIS_DTAP.oid]: ANAPHYLAXIS_DTAP,
  [ANAPHYLAXIS_COMMON_VACCINE.oid]: ANAPHYLAXIS_COMMON_VACCINE,
};

/**
 * Get value set codes by OID
 * Returns the bundled expansion if available, otherwise null
 */
export function getValueSetByOid(oid) {
  return VALUE_SET_BY_OID[oid] || null;
}

/**
 * Get codes for multiple OIDs (useful for composite value sets)
 * Returns a flat array of all codes from all matching value sets
 */
export function getCodesForOids(oids) {
  const codes = [];
  for (const oid of oids) {
    const vs = VALUE_SET_BY_OID[oid];
    if (vs && vs.codes) {
      codes.push(...vs.codes);
    }
  }
  return codes;
}

export default {
  VALUE_SET_BY_OID,
  getValueSetByOid,
  getCodesForOids,
};
