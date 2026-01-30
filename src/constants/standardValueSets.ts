/**
 * Standard Value Sets for Clinical Quality Measures
 *
 * These value sets are sourced from VSAC (Value Set Authority Center) and
 * eCQM specifications. OIDs reference the authoritative published value sets.
 *
 * When developing or validating measures, these complete code lists ensure
 * accurate patient classification.
 */

import { CPT, HCPCS, ICD10CM, SNOMEDCT, LOINC, CVX } from './fhirCodeSystems';

export interface StandardValueSet {
  id: string;
  oid: string;
  name: string;
  version?: string;
  codes: Array<{
    code: string;
    system: string;
    display: string;
  }>;
}

// =============================================================================
// CRC SCREENING MEASURE (CMS130) VALUE SETS
// =============================================================================

/**
 * Colonoscopy - OID: 2.16.840.1.113883.3.464.1003.108.12.1020
 * Includes all CPT and HCPCS codes for colonoscopy procedures
 */
export const COLONOSCOPY_VALUE_SET: StandardValueSet = {
  id: 'colonoscopy',
  oid: '2.16.840.1.113883.3.464.1003.108.12.1020',
  name: 'Colonoscopy',
  codes: [
    // CPT Colonoscopy codes
    { code: '44388', system: CPT, display: 'Colonoscopy through stoma; diagnostic' },
    { code: '44389', system: CPT, display: 'Colonoscopy through stoma; with biopsy' },
    { code: '44390', system: CPT, display: 'Colonoscopy through stoma; with removal of foreign body' },
    { code: '44391', system: CPT, display: 'Colonoscopy through stoma; with control of bleeding' },
    { code: '44392', system: CPT, display: 'Colonoscopy through stoma; with removal of tumor(s)' },
    { code: '44394', system: CPT, display: 'Colonoscopy through stoma; with snare removal' },
    { code: '44401', system: CPT, display: 'Colonoscopy through stoma; with ablation' },
    { code: '44402', system: CPT, display: 'Colonoscopy through stoma; with stent placement' },
    { code: '44403', system: CPT, display: 'Colonoscopy through stoma; with resection' },
    { code: '44404', system: CPT, display: 'Colonoscopy through stoma; with injection' },
    { code: '44405', system: CPT, display: 'Colonoscopy through stoma; with transendoscopic balloon dilation' },
    { code: '44406', system: CPT, display: 'Colonoscopy through stoma; with band ligation' },
    { code: '44407', system: CPT, display: 'Colonoscopy through stoma; with decompression' },
    { code: '44408', system: CPT, display: 'Colonoscopy through stoma; with placement of decompression tube' },
    { code: '45378', system: CPT, display: 'Colonoscopy, flexible; diagnostic' },
    { code: '45379', system: CPT, display: 'Colonoscopy, flexible; with removal of foreign body' },
    { code: '45380', system: CPT, display: 'Colonoscopy, flexible; with biopsy' },
    { code: '45381', system: CPT, display: 'Colonoscopy, flexible; with directed submucosal injection' },
    { code: '45382', system: CPT, display: 'Colonoscopy, flexible; with control of bleeding' },
    { code: '45383', system: CPT, display: 'Colonoscopy, flexible; with ablation of tumor(s)' },
    { code: '45384', system: CPT, display: 'Colonoscopy, flexible; with removal of tumor(s) by hot biopsy' },
    { code: '45385', system: CPT, display: 'Colonoscopy, flexible; with removal of tumor(s) by snare technique' },
    { code: '45386', system: CPT, display: 'Colonoscopy, flexible; with transendoscopic balloon dilation' },
    { code: '45388', system: CPT, display: 'Colonoscopy, flexible; with ablation of tumor(s) or polyp(s)' },
    { code: '45389', system: CPT, display: 'Colonoscopy, flexible; with stent placement' },
    { code: '45390', system: CPT, display: 'Colonoscopy, flexible; with resection' },
    { code: '45391', system: CPT, display: 'Colonoscopy, flexible; with endoscopic ultrasound' },
    { code: '45392', system: CPT, display: 'Colonoscopy, flexible; with transendoscopic ultrasound guided needle aspiration' },
    { code: '45393', system: CPT, display: 'Colonoscopy, flexible; with decompression' },
    { code: '45398', system: CPT, display: 'Colonoscopy, flexible; with band ligation' },
    // HCPCS Screening colonoscopy codes
    { code: 'G0105', system: HCPCS, display: 'Colorectal cancer screening; colonoscopy on individual at high risk' },
    { code: 'G0121', system: HCPCS, display: 'Colorectal cancer screening; colonoscopy on individual not meeting criteria for high risk' },
  ],
};

/**
 * Fecal Occult Blood Test (FOBT) - OID: 2.16.840.1.113883.3.464.1003.198.12.1011
 */
export const FOBT_VALUE_SET: StandardValueSet = {
  id: 'fobt',
  oid: '2.16.840.1.113883.3.464.1003.198.12.1011',
  name: 'Fecal Occult Blood Test (FOBT)',
  codes: [
    // CPT codes
    { code: '82270', system: CPT, display: 'Blood, occult, by peroxidase activity, feces, consecutive collected specimens' },
    { code: '82274', system: CPT, display: 'Blood, occult, by fecal hemoglobin determination by immunoassay' },
    // HCPCS
    { code: 'G0328', system: HCPCS, display: 'Colorectal cancer screening; fecal occult blood test, immunoassay, 1-3 simultaneous' },
    // LOINC
    { code: '12503-9', system: LOINC, display: 'Hemoglobin.gastrointestinal [Presence] in Stool --4th specimen' },
    { code: '12504-7', system: LOINC, display: 'Hemoglobin.gastrointestinal [Presence] in Stool --5th specimen' },
    { code: '14563-1', system: LOINC, display: 'Hemoglobin.gastrointestinal [Presence] in Stool --1st specimen' },
    { code: '14564-9', system: LOINC, display: 'Hemoglobin.gastrointestinal [Presence] in Stool --2nd specimen' },
    { code: '14565-6', system: LOINC, display: 'Hemoglobin.gastrointestinal [Presence] in Stool --3rd specimen' },
    { code: '2335-8', system: LOINC, display: 'Hemoglobin.gastrointestinal [Presence] in Stool' },
    { code: '27396-1', system: LOINC, display: 'Hemoglobin.gastrointestinal [Mass/mass] in Stool' },
    { code: '27401-9', system: LOINC, display: 'Hemoglobin.gastrointestinal [Presence] in Stool --6th specimen' },
    { code: '27925-7', system: LOINC, display: 'Hemoglobin.gastrointestinal [Presence] in Stool --7th specimen' },
    { code: '27926-5', system: LOINC, display: 'Hemoglobin.gastrointestinal [Presence] in Stool --8th specimen' },
    { code: '29771-3', system: LOINC, display: 'Hemoglobin.gastrointestinal.lower [Presence] in Stool by Immunoassay' },
    { code: '56490-6', system: LOINC, display: 'Hemoglobin.gastrointestinal.lower [Presence] in Stool by Immune fecal occult blood test' },
    { code: '56491-4', system: LOINC, display: 'Hemoglobin.gastrointestinal.lower [Mass/volume] in Stool by Immunoassay' },
    { code: '57905-2', system: LOINC, display: 'Hemoglobin.gastrointestinal.lower [Presence] in Stool by Guaiac' },
    { code: '58453-2', system: LOINC, display: 'Hemoglobin.gastrointestinal.lower [Mass/volume] in Stool by Guaiac' },
    { code: '80372-6', system: LOINC, display: 'Hemoglobin.gastrointestinal [Presence] in Stool by Rapid immunoassay' },
  ],
};

/**
 * FIT-DNA Test (Cologuard) - OID: 2.16.840.1.113883.3.464.1003.108.12.1039
 */
export const FIT_DNA_VALUE_SET: StandardValueSet = {
  id: 'fit-dna',
  oid: '2.16.840.1.113883.3.464.1003.108.12.1039',
  name: 'FIT-DNA (Stool DNA)',
  codes: [
    { code: '81528', system: CPT, display: 'Oncology (colorectal) screening, quantitative real-time target and signal amplification' },
    { code: 'G0464', system: HCPCS, display: 'Colorectal cancer screening; stool-based DNA and fecal occult hemoglobin' },
  ],
};

/**
 * Flexible Sigmoidoscopy - OID: 2.16.840.1.113883.3.464.1003.198.12.1010
 */
export const FLEXIBLE_SIGMOIDOSCOPY_VALUE_SET: StandardValueSet = {
  id: 'flexible-sigmoidoscopy',
  oid: '2.16.840.1.113883.3.464.1003.198.12.1010',
  name: 'Flexible Sigmoidoscopy',
  codes: [
    { code: '45330', system: CPT, display: 'Sigmoidoscopy, flexible; diagnostic' },
    { code: '45331', system: CPT, display: 'Sigmoidoscopy, flexible; with biopsy' },
    { code: '45332', system: CPT, display: 'Sigmoidoscopy, flexible; with removal of foreign body' },
    { code: '45333', system: CPT, display: 'Sigmoidoscopy, flexible; with removal of tumor(s) by hot biopsy' },
    { code: '45334', system: CPT, display: 'Sigmoidoscopy, flexible; with control of bleeding' },
    { code: '45335', system: CPT, display: 'Sigmoidoscopy, flexible; with directed submucosal injection' },
    { code: '45337', system: CPT, display: 'Sigmoidoscopy, flexible; with decompression' },
    { code: '45338', system: CPT, display: 'Sigmoidoscopy, flexible; with removal of tumor(s) by snare technique' },
    { code: '45339', system: CPT, display: 'Sigmoidoscopy, flexible; with ablation of tumor(s)' },
    { code: '45340', system: CPT, display: 'Sigmoidoscopy, flexible; with transendoscopic balloon dilation' },
    { code: '45341', system: CPT, display: 'Sigmoidoscopy, flexible; with endoscopic ultrasound' },
    { code: '45342', system: CPT, display: 'Sigmoidoscopy, flexible; with transendoscopic ultrasound guided needle aspiration' },
    { code: '45346', system: CPT, display: 'Sigmoidoscopy, flexible; with ablation of tumor(s)' },
    { code: '45347', system: CPT, display: 'Sigmoidoscopy, flexible; with placement of endoscopic stent' },
    { code: '45349', system: CPT, display: 'Sigmoidoscopy, flexible; with resection' },
    { code: '45350', system: CPT, display: 'Sigmoidoscopy, flexible; with band ligation' },
    { code: 'G0104', system: HCPCS, display: 'Colorectal cancer screening; flexible sigmoidoscopy' },
  ],
};

/**
 * CT Colonography - OID: 2.16.840.1.113883.3.464.1003.108.12.1038
 */
export const CT_COLONOGRAPHY_VALUE_SET: StandardValueSet = {
  id: 'ct-colonography',
  oid: '2.16.840.1.113883.3.464.1003.108.12.1038',
  name: 'CT Colonography',
  codes: [
    { code: '74261', system: CPT, display: 'CT colonography, diagnostic, without contrast' },
    { code: '74262', system: CPT, display: 'CT colonography, diagnostic, with contrast' },
    { code: '74263', system: CPT, display: 'CT colonography, screening' },
  ],
};

// =============================================================================
// CERVICAL CANCER SCREENING MEASURE (CMS124) VALUE SETS
// =============================================================================

/**
 * Pap Test (Cervical Cytology) - OID: 2.16.840.1.113883.3.464.1003.108.12.1017
 * Tests for abnormal cervical cells
 */
export const PAP_TEST_VALUE_SET: StandardValueSet = {
  id: 'pap-test',
  oid: '2.16.840.1.113883.3.464.1003.108.12.1017',
  name: 'Pap Test',
  codes: [
    // CPT Cytopathology codes
    { code: '88141', system: CPT, display: 'Cytopathology, cervical or vaginal, requiring interpretation by physician' },
    { code: '88142', system: CPT, display: 'Cytopathology, cervical or vaginal, collected in preservative fluid, automated thin layer preparation' },
    { code: '88143', system: CPT, display: 'Cytopathology, cervical or vaginal, collected in preservative fluid, with manual screening' },
    { code: '88147', system: CPT, display: 'Cytopathology smears, cervical or vaginal, screening by automated system' },
    { code: '88148', system: CPT, display: 'Cytopathology smears, cervical or vaginal, screening by automated system with manual rescreening' },
    { code: '88150', system: CPT, display: 'Cytopathology, slides, cervical or vaginal, manual screening under physician supervision' },
    { code: '88152', system: CPT, display: 'Cytopathology, slides, cervical or vaginal, manual screening and computer-assisted rescreening' },
    { code: '88153', system: CPT, display: 'Cytopathology, slides, cervical or vaginal, manual screening and rescreening under physician supervision' },
    { code: '88164', system: CPT, display: 'Cytopathology, slides, cervical or vaginal, TBS, manual screening' },
    { code: '88165', system: CPT, display: 'Cytopathology, slides, cervical or vaginal, TBS, with manual screening and rescreening' },
    { code: '88166', system: CPT, display: 'Cytopathology, slides, cervical or vaginal, TBS, with manual screening and computer-assisted rescreening' },
    { code: '88167', system: CPT, display: 'Cytopathology, slides, cervical or vaginal, TBS, with manual screening and computer-assisted rescreening using cell selection and target' },
    { code: '88174', system: CPT, display: 'Cytopathology, cervical or vaginal, collected in preservative fluid, automated thin layer preparation, screening by automated system' },
    { code: '88175', system: CPT, display: 'Cytopathology, cervical or vaginal, collected in preservative fluid, automated thin layer preparation, with screening by automated system and target by physician' },
    // HCPCS
    { code: 'G0123', system: HCPCS, display: 'Screening cytopathology, cervical or vaginal, collected in preservative fluid, automated thin layer preparation, screening by cytotechnologist' },
    { code: 'G0124', system: HCPCS, display: 'Screening cytopathology, cervical or vaginal, collected in preservative fluid, automated thin layer preparation, requiring interpretation by physician' },
    { code: 'G0141', system: HCPCS, display: 'Screening cytopathology smears, cervical or vaginal, performed by automated system, with manual rescreening, requiring interpretation by physician' },
    { code: 'G0143', system: HCPCS, display: 'Screening cytopathology, cervical or vaginal, collected in preservative fluid, automated thin layer preparation, with manual screening and rescreening' },
    { code: 'G0144', system: HCPCS, display: 'Screening cytopathology, cervical or vaginal, collected in preservative fluid, automated thin layer preparation, with screening by automated system, under physician supervision' },
    { code: 'G0145', system: HCPCS, display: 'Screening cytopathology, cervical or vaginal, collected in preservative fluid, automated thin layer preparation, with screening by automated system and target by physician' },
    { code: 'G0147', system: HCPCS, display: 'Screening cytopathology smears, cervical or vaginal, performed by automated system under physician supervision' },
    { code: 'G0148', system: HCPCS, display: 'Screening cytopathology smears, cervical or vaginal, performed by automated system with manual rescreening' },
    { code: 'Q0091', system: HCPCS, display: 'Screening Papanicolaou smear; obtaining, preparing, and conveyance of cervical or vaginal smear to laboratory' },
    // LOINC
    { code: '10524-7', system: LOINC, display: 'Cytology report of Cervical or vaginal smear or scraping Cyto stain' },
    { code: '18500-9', system: LOINC, display: 'Thin prep cervical cytology report' },
    { code: '19762-4', system: LOINC, display: 'General categories [Interpretation] in Cervical or vaginal smear or scraping by Cyto stain' },
    { code: '19764-0', system: LOINC, display: 'Statement of adequacy [Interpretation] in Cervical or vaginal smear or scraping by Cyto stain' },
    { code: '19765-7', system: LOINC, display: 'Microscopic observation [Identifier] in Cervical or vaginal smear or scraping by Cyto stain' },
    { code: '19766-5', system: LOINC, display: 'Microscopic observation [Identifier] in Cervical or vaginal smear or scraping by Cyto stain Narrative' },
    { code: '19774-9', system: LOINC, display: 'Cytology study comment in Cervical or vaginal smear or scraping' },
    { code: '33717-0', system: LOINC, display: 'Cytology Cervical or vaginal smear or scraping study' },
    { code: '47527-7', system: LOINC, display: 'Cytology report of Cervical or vaginal smear or scraping Cyto stain.thin prep' },
  ],
};

/**
 * HPV Test (High-Risk Human Papillomavirus) - OID: 2.16.840.1.113883.3.464.1003.110.12.1059
 * Tests for high-risk HPV strains that can cause cervical cancer
 */
export const HPV_TEST_VALUE_SET: StandardValueSet = {
  id: 'hpv-test',
  oid: '2.16.840.1.113883.3.464.1003.110.12.1059',
  name: 'HPV Test',
  codes: [
    // CPT codes for HPV testing
    { code: '87620', system: CPT, display: 'Infectious agent detection by nucleic acid, HPV, direct probe technique' },
    { code: '87621', system: CPT, display: 'Infectious agent detection by nucleic acid, HPV, amplified probe technique' },
    { code: '87622', system: CPT, display: 'Infectious agent detection by nucleic acid, HPV, quantification' },
    { code: '87624', system: CPT, display: 'Infectious agent detection by nucleic acid, HPV, high-risk types' },
    { code: '87625', system: CPT, display: 'Infectious agent detection by nucleic acid, HPV, types 16 and 18 only' },
    // HCPCS
    { code: 'G0476', system: HCPCS, display: 'Infectious agent detection by nucleic acid; HPV high-risk types, includes 16 and 18, cervical, with algorithmic analysis' },
    // LOINC
    { code: '21440-3', system: LOINC, display: 'Human papilloma virus 16+18+31+33+35+45+51+52+56 DNA [Presence] in Cervix by Probe' },
    { code: '30167-1', system: LOINC, display: 'Human papilloma virus DNA [Presence] in Cervix by Probe' },
    { code: '38372-9', system: LOINC, display: 'Human papilloma virus 6+11+42+43+44 DNA [Presence] in Cervix by Probe' },
    { code: '59263-4', system: LOINC, display: 'Human papilloma virus 16 DNA [Presence] in Cervix by Probe' },
    { code: '59264-2', system: LOINC, display: 'Human papilloma virus 18 DNA [Presence] in Cervix by Probe' },
    { code: '59420-0', system: LOINC, display: 'Human papilloma virus 16+18+31+33+35+39+45+51+52+56+58+59+66+68 DNA [Presence] in Cervix by Probe' },
    { code: '69002-4', system: LOINC, display: 'Human papilloma virus E6+E7 mRNA [Presence] in Cervix by NAA' },
    { code: '71431-1', system: LOINC, display: 'Human papilloma virus 31+33+35+39+45+51+52+56+58+59+66+68 DNA [Presence] in Cervix by NAA' },
    { code: '75694-0', system: LOINC, display: 'Human papilloma virus 18+45 E6+E7 mRNA [Presence] in Cervix by NAA' },
    { code: '77379-6', system: LOINC, display: 'Human papilloma virus 16 and 18 and 31+33+35+39+45+51+52+56+58+59+66+68 DNA [Interpretation] in Cervix' },
    { code: '77399-4', system: LOINC, display: 'Human papilloma virus 16 DNA [Presence] in Cervix by NAA' },
    { code: '77400-0', system: LOINC, display: 'Human papilloma virus 18 DNA [Presence] in Cervix by NAA' },
    { code: '82354-2', system: LOINC, display: 'Human papilloma virus 16 and 18 and 31+33+35+39+45+51+52+56+58+59+66+68 DNA panel - Cervix by NAA' },
    { code: '82456-5', system: LOINC, display: 'Human papilloma virus 16 and 18 DNA [Presence] in Cervix by NAA' },
    { code: '82675-0', system: LOINC, display: 'Human papilloma virus 16+18+31+33+35+39+45+51+52+56+58+59+68 DNA [Presence] in Cervix by NAA' },
  ],
};

/**
 * Hysterectomy with No Residual Cervix - OID: 2.16.840.1.113883.3.464.1003.198.12.1014
 * Procedures that remove the cervix, making cervical cancer screening unnecessary
 */
export const HYSTERECTOMY_NO_CERVIX_VALUE_SET: StandardValueSet = {
  id: 'hysterectomy-no-cervix',
  oid: '2.16.840.1.113883.3.464.1003.198.12.1014',
  name: 'Hysterectomy with No Residual Cervix',
  codes: [
    // CPT codes
    { code: '51925', system: CPT, display: 'Closure of vesicouterine fistula, with hysterectomy' },
    { code: '57530', system: CPT, display: 'Trachelectomy (cervicectomy), amputation of cervix' },
    { code: '57531', system: CPT, display: 'Radical trachelectomy, with bilateral total pelvic lymphadenectomy' },
    { code: '57540', system: CPT, display: 'Excision of cervical stump, abdominal approach' },
    { code: '57545', system: CPT, display: 'Excision of cervical stump, abdominal approach; with pelvic floor repair' },
    { code: '57550', system: CPT, display: 'Excision of cervical stump, vaginal approach' },
    { code: '57555', system: CPT, display: 'Excision of cervical stump, vaginal approach; with anterior and/or posterior repair' },
    { code: '57556', system: CPT, display: 'Excision of cervical stump, vaginal approach; with repair of enterocele' },
    { code: '58150', system: CPT, display: 'Total abdominal hysterectomy, with or without removal of tube(s), with or without removal of ovary(s)' },
    { code: '58152', system: CPT, display: 'Total abdominal hysterectomy, with or without removal of tube(s), with or without removal of ovary(s); with colpo-urethrocystopexy' },
    { code: '58200', system: CPT, display: 'Total abdominal hysterectomy, including partial vaginectomy, with para-aortic and pelvic lymph node sampling' },
    { code: '58210', system: CPT, display: 'Radical abdominal hysterectomy, with bilateral total pelvic lymphadenectomy and para-aortic lymph node sampling' },
    { code: '58240', system: CPT, display: 'Pelvic exenteration for gynecologic malignancy, with total abdominal hysterectomy or cervicectomy' },
    { code: '58260', system: CPT, display: 'Vaginal hysterectomy, for uterus 250 g or less' },
    { code: '58262', system: CPT, display: 'Vaginal hysterectomy, for uterus 250 g or less; with removal of tube(s), and/or ovary(s)' },
    { code: '58263', system: CPT, display: 'Vaginal hysterectomy, for uterus 250 g or less; with removal of tube(s), and/or ovary(s), with repair of enterocele' },
    { code: '58267', system: CPT, display: 'Vaginal hysterectomy, for uterus 250 g or less; with colpo-urethrocystopexy (Marshall-Marchetti-Krantz type, Pereyra type) with or without endoscopic control' },
    { code: '58270', system: CPT, display: 'Vaginal hysterectomy, for uterus 250 g or less; with repair of enterocele' },
    { code: '58275', system: CPT, display: 'Vaginal hysterectomy, with total or partial vaginectomy' },
    { code: '58280', system: CPT, display: 'Vaginal hysterectomy, with total or partial vaginectomy; with repair of enterocele' },
    { code: '58285', system: CPT, display: 'Vaginal hysterectomy, radical (Schauta type operation)' },
    { code: '58290', system: CPT, display: 'Vaginal hysterectomy, for uterus greater than 250 g' },
    { code: '58291', system: CPT, display: 'Vaginal hysterectomy, for uterus greater than 250 g; with removal of tube(s) and/or ovary(s)' },
    { code: '58292', system: CPT, display: 'Vaginal hysterectomy, for uterus greater than 250 g; with removal of tube(s) and/or ovary(s), with repair of enterocele' },
    { code: '58293', system: CPT, display: 'Vaginal hysterectomy, for uterus greater than 250 g; with colpo-urethrocystopexy (Marshall-Marchetti-Krantz type, Pereyra type) with or without endoscopic control' },
    { code: '58294', system: CPT, display: 'Vaginal hysterectomy, for uterus greater than 250 g; with repair of enterocele' },
    { code: '58541', system: CPT, display: 'Laparoscopy, surgical, supracervical hysterectomy, for uterus 250 g or less' },
    { code: '58542', system: CPT, display: 'Laparoscopy, surgical, supracervical hysterectomy, for uterus 250 g or less; with removal of tube(s) and/or ovary(s)' },
    { code: '58543', system: CPT, display: 'Laparoscopy, surgical, supracervical hysterectomy, for uterus greater than 250 g' },
    { code: '58544', system: CPT, display: 'Laparoscopy, surgical, supracervical hysterectomy, for uterus greater than 250 g; with removal of tube(s) and/or ovary(s)' },
    { code: '58548', system: CPT, display: 'Laparoscopy, surgical, with radical hysterectomy, with bilateral total pelvic lymphadenectomy and para-aortic lymph node sampling' },
    { code: '58550', system: CPT, display: 'Laparoscopy, surgical, with vaginal hysterectomy, for uterus 250 g or less' },
    { code: '58552', system: CPT, display: 'Laparoscopy, surgical, with vaginal hysterectomy, for uterus 250 g or less; with removal of tube(s) and/or ovary(s)' },
    { code: '58553', system: CPT, display: 'Laparoscopy, surgical, with vaginal hysterectomy, for uterus greater than 250 g' },
    { code: '58554', system: CPT, display: 'Laparoscopy, surgical, with vaginal hysterectomy, for uterus greater than 250 g; with removal of tube(s) and/or ovary(s)' },
    { code: '58570', system: CPT, display: 'Laparoscopy, surgical, with total hysterectomy, for uterus 250 g or less' },
    { code: '58571', system: CPT, display: 'Laparoscopy, surgical, with total hysterectomy, for uterus 250 g or less; with removal of tube(s) and/or ovary(s)' },
    { code: '58572', system: CPT, display: 'Laparoscopy, surgical, with total hysterectomy, for uterus greater than 250 g' },
    { code: '58573', system: CPT, display: 'Laparoscopy, surgical, with total hysterectomy, for uterus greater than 250 g; with removal of tube(s) and/or ovary(s)' },
    { code: '58575', system: CPT, display: 'Laparoscopy, surgical, total hysterectomy for resection of malignancy, with omentectomy' },
    // ICD-10-PCS (procedure codes)
    { code: '0UTC0ZZ', system: 'ICD10PCS', display: 'Resection of Cervix, Open Approach' },
    { code: '0UTC4ZZ', system: 'ICD10PCS', display: 'Resection of Cervix, Percutaneous Endoscopic Approach' },
    { code: '0UTC7ZZ', system: 'ICD10PCS', display: 'Resection of Cervix, Via Natural or Artificial Opening' },
    { code: '0UTC8ZZ', system: 'ICD10PCS', display: 'Resection of Cervix, Via Natural or Artificial Opening Endoscopic' },
    // ICD-10-CM (history/status codes)
    { code: 'Z90.710', system: ICD10CM, display: 'Acquired absence of both cervix and uterus' },
    { code: 'Z90.711', system: ICD10CM, display: 'Acquired absence of uterus with remaining cervical stump' },
    { code: 'Z90.712', system: ICD10CM, display: 'Acquired absence of cervix with remaining uterus' },
  ],
};

/**
 * Cervical Cancer - diagnosis codes for exclusion
 */
export const CERVICAL_CANCER_VALUE_SET: StandardValueSet = {
  id: 'cervical-cancer',
  oid: '2.16.840.1.113883.3.464.1003.108.12.1007',
  name: 'Cervical Cancer',
  codes: [
    { code: 'C53.0', system: ICD10CM, display: 'Malignant neoplasm of endocervix' },
    { code: 'C53.1', system: ICD10CM, display: 'Malignant neoplasm of exocervix' },
    { code: 'C53.8', system: ICD10CM, display: 'Malignant neoplasm of overlapping sites of cervix uteri' },
    { code: 'C53.9', system: ICD10CM, display: 'Malignant neoplasm of cervix uteri, unspecified' },
    { code: 'D06.0', system: ICD10CM, display: 'Carcinoma in situ of endocervix' },
    { code: 'D06.1', system: ICD10CM, display: 'Carcinoma in situ of exocervix' },
    { code: 'D06.7', system: ICD10CM, display: 'Carcinoma in situ of other parts of cervix' },
    { code: 'D06.9', system: ICD10CM, display: 'Carcinoma in situ of cervix, unspecified' },
    { code: 'Z85.41', system: ICD10CM, display: 'Personal history of malignant neoplasm of cervix uteri' },
  ],
};

// =============================================================================
// CRC SCREENING EXCLUSION VALUE SETS
// =============================================================================

/**
 * Malignant Neoplasm of Colon - OID: 2.16.840.1.113883.3.464.1003.108.12.1001
 */
export const COLORECTAL_CANCER_VALUE_SET: StandardValueSet = {
  id: 'colorectal-cancer',
  oid: '2.16.840.1.113883.3.464.1003.108.12.1001',
  name: 'Malignant Neoplasm of Colon',
  codes: [
    { code: 'C18.0', system: ICD10CM, display: 'Malignant neoplasm of cecum' },
    { code: 'C18.1', system: ICD10CM, display: 'Malignant neoplasm of appendix' },
    { code: 'C18.2', system: ICD10CM, display: 'Malignant neoplasm of ascending colon' },
    { code: 'C18.3', system: ICD10CM, display: 'Malignant neoplasm of hepatic flexure' },
    { code: 'C18.4', system: ICD10CM, display: 'Malignant neoplasm of transverse colon' },
    { code: 'C18.5', system: ICD10CM, display: 'Malignant neoplasm of splenic flexure' },
    { code: 'C18.6', system: ICD10CM, display: 'Malignant neoplasm of descending colon' },
    { code: 'C18.7', system: ICD10CM, display: 'Malignant neoplasm of sigmoid colon' },
    { code: 'C18.8', system: ICD10CM, display: 'Malignant neoplasm of overlapping sites of colon' },
    { code: 'C18.9', system: ICD10CM, display: 'Malignant neoplasm of colon, unspecified' },
    { code: 'C19', system: ICD10CM, display: 'Malignant neoplasm of rectosigmoid junction' },
    { code: 'C20', system: ICD10CM, display: 'Malignant neoplasm of rectum' },
    { code: 'C21.0', system: ICD10CM, display: 'Malignant neoplasm of anus, unspecified' },
    { code: 'C21.1', system: ICD10CM, display: 'Malignant neoplasm of anal canal' },
    { code: 'C21.2', system: ICD10CM, display: 'Malignant neoplasm of cloacogenic zone' },
    { code: 'C21.8', system: ICD10CM, display: 'Malignant neoplasm of overlapping sites of rectum, anus and anal canal' },
    { code: 'Z85.038', system: ICD10CM, display: 'Personal history of other malignant neoplasm of large intestine' },
    { code: 'Z85.048', system: ICD10CM, display: 'Personal history of other malignant neoplasm of rectum, rectosigmoid junction, and anus' },
  ],
};

/**
 * Total Colectomy - OID: 2.16.840.1.113883.3.464.1003.198.12.1019
 */
export const TOTAL_COLECTOMY_VALUE_SET: StandardValueSet = {
  id: 'total-colectomy',
  oid: '2.16.840.1.113883.3.464.1003.198.12.1019',
  name: 'Total Colectomy',
  codes: [
    { code: '44150', system: CPT, display: 'Colectomy, total, abdominal, without proctectomy' },
    { code: '44151', system: CPT, display: 'Colectomy, total, abdominal, with proctectomy' },
    { code: '44155', system: CPT, display: 'Colectomy, total, abdominal, with proctectomy; with ileostomy' },
    { code: '44156', system: CPT, display: 'Colectomy, total, abdominal, with proctectomy; with creation of continent ileostomy' },
    { code: '44157', system: CPT, display: 'Colectomy, total, abdominal, with proctectomy; with ileoanal anastomosis' },
    { code: '44158', system: CPT, display: 'Colectomy, total, abdominal, with proctectomy; with ileoanal anastomosis, creation of ileal reservoir' },
    { code: '44210', system: CPT, display: 'Laparoscopy, surgical; colectomy, total, abdominal, without proctectomy' },
    { code: '44211', system: CPT, display: 'Laparoscopy, surgical; colectomy, total, abdominal, with proctectomy' },
    { code: '44212', system: CPT, display: 'Laparoscopy, surgical; colectomy, total, abdominal, with proctectomy, with ileostomy' },
    // SNOMED codes
    { code: '26390003', system: SNOMEDCT, display: 'Total colectomy' },
    { code: '303401008', system: SNOMEDCT, display: 'Parks panproctocolectomy, bileostomy and ileoanal pouch' },
    { code: '307666008', system: SNOMEDCT, display: 'Total colectomy and ileostomy' },
    { code: '307667004', system: SNOMEDCT, display: 'Total colectomy, ileostomy and rectal mucous fistula' },
    { code: '307669001', system: SNOMEDCT, display: 'Total colectomy, ileostomy and closure of rectal stump' },
    { code: '31130001', system: SNOMEDCT, display: 'Total abdominal colectomy with proctectomy and ileostomy' },
    { code: '36192008', system: SNOMEDCT, display: 'Total abdominal colectomy with ileoproctostomy' },
    { code: '44751009', system: SNOMEDCT, display: 'Total abdominal colectomy with proctectomy and continent ileostomy' },
    { code: '456004', system: SNOMEDCT, display: 'Total abdominal colectomy with ileostomy' },
    { code: '80294005', system: SNOMEDCT, display: 'Total abdominal colectomy with rectal mucosectomy and ileoanal anastomosis' },
  ],
};

// =============================================================================
// COMMON EXCLUSION VALUE SETS (Used across multiple measures)
// =============================================================================

/**
 * Hospice Care - OID: 2.16.840.1.113883.3.464.1003.1003
 */
export const HOSPICE_CARE_VALUE_SET: StandardValueSet = {
  id: 'hospice-care',
  oid: '2.16.840.1.113883.3.464.1003.1003',
  name: 'Hospice Care',
  codes: [
    // ICD-10-CM
    { code: 'Z51.5', system: ICD10CM, display: 'Encounter for palliative care' },
    // CPT
    { code: '99377', system: CPT, display: 'Physician supervision of a hospice patient' },
    { code: '99378', system: CPT, display: 'Physician supervision of a hospice patient (additional 30 min)' },
    // HCPCS
    { code: 'G0182', system: HCPCS, display: 'Physician certification for Medicare-covered home health services' },
    { code: 'G9473', system: HCPCS, display: 'Services performed by chaplain in the hospice setting' },
    { code: 'G9474', system: HCPCS, display: 'Services performed by dietary counselor in hospice setting' },
    { code: 'G9475', system: HCPCS, display: 'Services performed by other counselor in hospice setting' },
    { code: 'G9476', system: HCPCS, display: 'Services performed by volunteer in hospice setting' },
    { code: 'G9477', system: HCPCS, display: 'Services performed by care coordinator in hospice setting' },
    { code: 'Q5003', system: HCPCS, display: 'Hospice care provided in nursing long term care facility' },
    { code: 'Q5004', system: HCPCS, display: 'Hospice care provided in skilled nursing facility' },
    { code: 'Q5005', system: HCPCS, display: 'Hospice care provided in inpatient hospital' },
    { code: 'Q5006', system: HCPCS, display: 'Hospice care provided in inpatient hospice facility' },
    { code: 'Q5007', system: HCPCS, display: 'Hospice care provided in long term care facility' },
    { code: 'Q5008', system: HCPCS, display: 'Hospice care provided in inpatient psychiatric facility' },
    { code: 'Q5010', system: HCPCS, display: 'Hospice home care provided in a hospice facility' },
    // SNOMED
    { code: '385763009', system: SNOMEDCT, display: 'Hospice care' },
    { code: '385765002', system: SNOMEDCT, display: 'Hospice care management' },
  ],
};

/**
 * Hospice Care Ambulatory - OID: 2.16.840.1.113883.3.526.3.1584
 * Used across many eCQMs including CMS117, CMS122, CMS127, CMS347, etc.
 * Ambulatory encounter codes indicating hospice care
 */
export const HOSPICE_CARE_AMBULATORY_VALUE_SET: StandardValueSet = {
  id: 'hospice-care-ambulatory',
  oid: '2.16.840.1.113883.3.526.3.1584',
  name: 'Hospice Care Ambulatory',
  codes: [
    // SNOMED CT
    { code: '385763009', system: SNOMEDCT, display: 'Hospice care (regime/therapy)' },
    { code: '385765002', system: SNOMEDCT, display: 'Hospice care management (procedure)' },
    { code: '386359008', system: SNOMEDCT, display: 'Hospice care (finding)' },
    { code: '182964004', system: SNOMEDCT, display: 'Terminal care (regime/therapy)' },
    { code: '305336008', system: SNOMEDCT, display: 'Admission to hospice (procedure)' },
    { code: '183919006', system: SNOMEDCT, display: 'Urgent admission to hospice (procedure)' },
    { code: '183920000', system: SNOMEDCT, display: 'Routine admission to hospice (procedure)' },
    { code: '183921001', system: SNOMEDCT, display: 'Admission to hospice for respite (procedure)' },
    { code: '442361000124100', system: SNOMEDCT, display: 'Referral to hospice service (procedure)' },
    { code: '428371000124100', system: SNOMEDCT, display: 'Discharge to healthcare facility for hospice care (procedure)' },
    { code: '428361000124107', system: SNOMEDCT, display: 'Discharge to home for hospice care (procedure)' },
  ],
};

/**
 * Frailty/Advanced Illness - OID: 2.16.840.1.113883.3.464.1003.110.12.1082
 */
export const FRAILTY_VALUE_SET: StandardValueSet = {
  id: 'frailty',
  oid: '2.16.840.1.113883.3.464.1003.110.12.1082',
  name: 'Frailty',
  codes: [
    { code: 'R54', system: ICD10CM, display: 'Age-related physical debility' },
    { code: 'R62.7', system: ICD10CM, display: 'Adult failure to thrive' },
    { code: 'R64', system: ICD10CM, display: 'Cachexia' },
    { code: 'R26.0', system: ICD10CM, display: 'Ataxic gait' },
    { code: 'R26.1', system: ICD10CM, display: 'Paralytic gait' },
    { code: 'R26.2', system: ICD10CM, display: 'Difficulty in walking, not elsewhere classified' },
    { code: 'R26.89', system: ICD10CM, display: 'Other abnormalities of gait and mobility' },
    { code: 'R26.9', system: ICD10CM, display: 'Unspecified abnormalities of gait and mobility' },
    { code: 'Z74.01', system: ICD10CM, display: 'Bed confinement status' },
    { code: 'Z74.09', system: ICD10CM, display: 'Other reduced mobility' },
    { code: 'Z99.3', system: ICD10CM, display: 'Dependence on wheelchair' },
    { code: 'Z99.81', system: ICD10CM, display: 'Dependence on supplemental oxygen' },
    { code: 'M62.81', system: ICD10CM, display: 'Muscle weakness (generalized)' },
    { code: 'M62.84', system: ICD10CM, display: 'Sarcopenia' },
  ],
};

/**
 * Dementia and Related Conditions - OID: 2.16.840.1.113883.3.464.1003.113.12.1034
 */
export const DEMENTIA_VALUE_SET: StandardValueSet = {
  id: 'dementia',
  oid: '2.16.840.1.113883.3.464.1003.113.12.1034',
  name: 'Dementia and Related Conditions',
  codes: [
    { code: 'F01.50', system: ICD10CM, display: 'Vascular dementia without behavioral disturbance' },
    { code: 'F01.51', system: ICD10CM, display: 'Vascular dementia with behavioral disturbance' },
    { code: 'F02.80', system: ICD10CM, display: 'Dementia in other diseases classified elsewhere without behavioral disturbance' },
    { code: 'F02.81', system: ICD10CM, display: 'Dementia in other diseases classified elsewhere with behavioral disturbance' },
    { code: 'F03.90', system: ICD10CM, display: 'Unspecified dementia without behavioral disturbance' },
    { code: 'F03.91', system: ICD10CM, display: 'Unspecified dementia with behavioral disturbance' },
    { code: 'G30.0', system: ICD10CM, display: 'Alzheimer disease with early onset' },
    { code: 'G30.1', system: ICD10CM, display: 'Alzheimer disease with late onset' },
    { code: 'G30.8', system: ICD10CM, display: 'Other Alzheimer disease' },
    { code: 'G30.9', system: ICD10CM, display: 'Alzheimer disease, unspecified' },
    { code: 'G31.01', system: ICD10CM, display: 'Pick disease' },
    { code: 'G31.09', system: ICD10CM, display: 'Other frontotemporal dementia' },
    { code: 'G31.83', system: ICD10CM, display: 'Dementia with Lewy bodies' },
  ],
};

// =============================================================================
// CHILDHOOD IMMUNIZATION STATUS (CMS117) VALUE SETS
// =============================================================================

/**
 * DTaP Vaccine - OID: 2.16.840.1.113883.3.464.1003.196.12.1214
 * Diphtheria, Tetanus, and Pertussis vaccine
 */
export const DTAP_VACCINE_VALUE_SET: StandardValueSet = {
  id: 'dtap-vaccine',
  oid: '2.16.840.1.113883.3.464.1003.196.12.1214',
  name: 'DTaP Vaccine',
  codes: [
    { code: '20', system: CVX, display: 'DTaP vaccine' },
    { code: '50', system: CVX, display: 'DTaP-Hib vaccine' },
    { code: '106', system: CVX, display: 'DTaP, 5 pertussis antigens' },
    { code: '107', system: CVX, display: 'DTaP, unspecified formulation' },
    { code: '110', system: CVX, display: 'DTaP-Hep B-IPV vaccine' },
    { code: '120', system: CVX, display: 'DTaP-Hib-IPV vaccine' },
    { code: '146', system: CVX, display: 'DTaP-IPV-Hib-Hep B vaccine' },
  ],
};

/**
 * IPV (Inactivated Polio Vaccine) - OID: 2.16.840.1.113883.3.464.1003.196.12.1219
 */
export const IPV_VACCINE_VALUE_SET: StandardValueSet = {
  id: 'ipv-vaccine',
  oid: '2.16.840.1.113883.3.464.1003.196.12.1219',
  name: 'Inactivated Polio Vaccine (IPV)',
  codes: [
    { code: '10', system: CVX, display: 'IPV vaccine' },
    { code: '89', system: CVX, display: 'Polio vaccine, unspecified formulation' },
    { code: '110', system: CVX, display: 'DTaP-Hep B-IPV vaccine' },
    { code: '120', system: CVX, display: 'DTaP-Hib-IPV vaccine' },
    { code: '146', system: CVX, display: 'DTaP-IPV-Hib-Hep B vaccine' },
  ],
};

/**
 * MMR Vaccine - OID: 2.16.840.1.113883.3.464.1003.196.12.1224
 * Measles, Mumps, and Rubella vaccine
 */
export const MMR_VACCINE_VALUE_SET: StandardValueSet = {
  id: 'mmr-vaccine',
  oid: '2.16.840.1.113883.3.464.1003.196.12.1224',
  name: 'MMR Vaccine',
  codes: [
    { code: '03', system: CVX, display: 'MMR vaccine' },
    { code: '94', system: CVX, display: 'MMRV vaccine' },
  ],
};

/**
 * Hib Vaccine - OID: 2.16.840.1.113883.3.464.1003.110.12.1085
 * Haemophilus influenzae type b vaccine
 */
export const HIB_VACCINE_VALUE_SET: StandardValueSet = {
  id: 'hib-vaccine',
  oid: '2.16.840.1.113883.3.464.1003.110.12.1085',
  name: 'Hib Vaccine',
  codes: [
    { code: '17', system: CVX, display: 'Hib vaccine, unspecified formulation' },
    { code: '46', system: CVX, display: 'Hib (PRP-D) vaccine' },
    { code: '47', system: CVX, display: 'Hib (HbOC) vaccine' },
    { code: '48', system: CVX, display: 'Hib (PRP-T) vaccine' },
    { code: '49', system: CVX, display: 'Hib (PRP-OMP) vaccine' },
    { code: '50', system: CVX, display: 'DTaP-Hib vaccine' },
    { code: '120', system: CVX, display: 'DTaP-Hib-IPV vaccine' },
    { code: '146', system: CVX, display: 'DTaP-IPV-Hib-Hep B vaccine' },
    { code: '148', system: CVX, display: 'Meningococcal C/Y-Hib PRP vaccine' },
  ],
};

/**
 * Hepatitis B Vaccine - OID: 2.16.840.1.113883.3.464.1003.196.12.1216
 */
export const HEPATITIS_B_VACCINE_VALUE_SET: StandardValueSet = {
  id: 'hep-b-vaccine',
  oid: '2.16.840.1.113883.3.464.1003.196.12.1216',
  name: 'Hepatitis B Vaccine',
  codes: [
    { code: '08', system: CVX, display: 'Hep B vaccine, pediatric or adolescent' },
    { code: '42', system: CVX, display: 'Hep B vaccine, adolescent/high risk infant' },
    { code: '43', system: CVX, display: 'Hep B vaccine, adult' },
    { code: '44', system: CVX, display: 'Hep B vaccine, dialysis' },
    { code: '45', system: CVX, display: 'Hep B vaccine, unspecified formulation' },
    { code: '51', system: CVX, display: 'Hib-Hep B vaccine' },
    { code: '110', system: CVX, display: 'DTaP-Hep B-IPV vaccine' },
    { code: '146', system: CVX, display: 'DTaP-IPV-Hib-Hep B vaccine' },
    { code: '189', system: CVX, display: 'Hep B vaccine (CpG adjuvant)' },
  ],
};

/**
 * Varicella (Chickenpox) Vaccine - OID: 2.16.840.1.113883.3.464.1003.196.12.1236
 */
export const VARICELLA_VACCINE_VALUE_SET: StandardValueSet = {
  id: 'varicella-vaccine',
  oid: '2.16.840.1.113883.3.464.1003.196.12.1236',
  name: 'Varicella Vaccine',
  codes: [
    { code: '21', system: CVX, display: 'Varicella vaccine' },
    { code: '94', system: CVX, display: 'MMRV vaccine' },
  ],
};

/**
 * Pneumococcal Conjugate Vaccine (PCV) - OID: 2.16.840.1.113883.3.464.1003.196.12.1221
 */
export const PCV_VACCINE_VALUE_SET: StandardValueSet = {
  id: 'pcv-vaccine',
  oid: '2.16.840.1.113883.3.464.1003.196.12.1221',
  name: 'Pneumococcal Conjugate Vaccine (PCV)',
  codes: [
    { code: '133', system: CVX, display: 'PCV13 vaccine' },
    { code: '152', system: CVX, display: 'PCV vaccine, unspecified' },
    { code: '100', system: CVX, display: 'PCV7 vaccine' },
  ],
};

/**
 * Hepatitis A Vaccine - OID: 2.16.840.1.113883.3.464.1003.196.12.1215
 */
export const HEPATITIS_A_VACCINE_VALUE_SET: StandardValueSet = {
  id: 'hep-a-vaccine',
  oid: '2.16.840.1.113883.3.464.1003.196.12.1215',
  name: 'Hepatitis A Vaccine',
  codes: [
    { code: '31', system: CVX, display: 'Hep A vaccine, pediatric, unspecified' },
    { code: '83', system: CVX, display: 'Hep A vaccine, pediatric/adolescent, 2 dose' },
    { code: '84', system: CVX, display: 'Hep A vaccine, pediatric/adolescent, 3 dose' },
    { code: '85', system: CVX, display: 'Hep A vaccine, unspecified formulation' },
    { code: '104', system: CVX, display: 'Hep A-Hep B vaccine' },
  ],
};

/**
 * Rotavirus Vaccine - OID: 2.16.840.1.113883.3.464.1003.196.12.1223
 */
export const ROTAVIRUS_VACCINE_VALUE_SET: StandardValueSet = {
  id: 'rotavirus-vaccine',
  oid: '2.16.840.1.113883.3.464.1003.196.12.1223',
  name: 'Rotavirus Vaccine',
  codes: [
    { code: '116', system: CVX, display: 'Rotavirus vaccine, pentavalent' },
    { code: '119', system: CVX, display: 'Rotavirus vaccine, monovalent' },
    { code: '122', system: CVX, display: 'Rotavirus vaccine, unspecified formulation' },
  ],
};

/**
 * Influenza Vaccine - OID: 2.16.840.1.113883.3.464.1003.196.12.1218
 */
export const INFLUENZA_VACCINE_VALUE_SET: StandardValueSet = {
  id: 'influenza-vaccine',
  oid: '2.16.840.1.113883.3.464.1003.196.12.1218',
  name: 'Influenza Vaccine',
  codes: [
    { code: '88', system: CVX, display: 'Influenza vaccine, unspecified formulation' },
    { code: '135', system: CVX, display: 'Influenza, high dose seasonal' },
    { code: '140', system: CVX, display: 'Influenza, seasonal, injectable, preservative free' },
    { code: '141', system: CVX, display: 'Influenza, seasonal, injectable' },
    { code: '144', system: CVX, display: 'Influenza, seasonal, intradermal, preservative free' },
    { code: '149', system: CVX, display: 'Influenza, live, intranasal, quadrivalent' },
    { code: '150', system: CVX, display: 'Influenza, injectable, quadrivalent, preservative free' },
    { code: '153', system: CVX, display: 'Influenza, injectable, MDCK, preservative free' },
    { code: '155', system: CVX, display: 'Influenza, recombinant, injectable, preservative free' },
    { code: '158', system: CVX, display: 'Influenza, injectable, quadrivalent' },
    { code: '161', system: CVX, display: 'Influenza, injectable, quadrivalent, preservative free, pediatric' },
    { code: '166', system: CVX, display: 'Influenza, intradermal, quadrivalent, preservative free' },
    { code: '168', system: CVX, display: 'Influenza, trivalent, adjuvanted' },
    { code: '171', system: CVX, display: 'Influenza, injectable, MDCK, preservative free, quadrivalent' },
    { code: '185', system: CVX, display: 'Influenza, recombinant, quadrivalent, injectable, preservative free' },
    { code: '186', system: CVX, display: 'Influenza, injectable, MDCK, quadrivalent, preservative free' },
    { code: '197', system: CVX, display: 'Influenza, high-dose, quadrivalent' },
    { code: '205', system: CVX, display: 'Influenza, adjuvanted, quadrivalent' },
  ],
};

/**
 * Get all childhood immunization vaccine value sets
 */
export function getChildhoodImmunizationValueSets(): StandardValueSet[] {
  return [
    DTAP_VACCINE_VALUE_SET,
    IPV_VACCINE_VALUE_SET,
    MMR_VACCINE_VALUE_SET,
    HIB_VACCINE_VALUE_SET,
    HEPATITIS_B_VACCINE_VALUE_SET,
    VARICELLA_VACCINE_VALUE_SET,
    PCV_VACCINE_VALUE_SET,
    HEPATITIS_A_VACCINE_VALUE_SET,
    ROTAVIRUS_VACCINE_VALUE_SET,
    INFLUENZA_VACCINE_VALUE_SET,
  ];
}

/**
 * Get childhood immunization exclusion value sets
 * CMS117 excludes patients in hospice care
 */
export function getChildhoodImmunizationExclusionValueSets(): StandardValueSet[] {
  return [
    HOSPICE_CARE_VALUE_SET,
    HOSPICE_CARE_AMBULATORY_VALUE_SET,
  ];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all CRC screening numerator value sets
 */
export function getCRCScreeningNumeratorValueSets(): StandardValueSet[] {
  return [
    COLONOSCOPY_VALUE_SET,
    FOBT_VALUE_SET,
    FIT_DNA_VALUE_SET,
    FLEXIBLE_SIGMOIDOSCOPY_VALUE_SET,
    CT_COLONOGRAPHY_VALUE_SET,
  ];
}

/**
 * Get all CRC screening exclusion value sets
 */
export function getCRCScreeningExclusionValueSets(): StandardValueSet[] {
  return [
    COLORECTAL_CANCER_VALUE_SET,
    TOTAL_COLECTOMY_VALUE_SET,
    HOSPICE_CARE_VALUE_SET,
    FRAILTY_VALUE_SET,
    DEMENTIA_VALUE_SET,
  ];
}

/**
 * Get all cervical cancer screening numerator value sets
 */
export function getCervicalScreeningNumeratorValueSets(): StandardValueSet[] {
  return [
    PAP_TEST_VALUE_SET,
    HPV_TEST_VALUE_SET,
  ];
}

/**
 * Get all cervical cancer screening exclusion value sets
 */
export function getCervicalScreeningExclusionValueSets(): StandardValueSet[] {
  return [
    HYSTERECTOMY_NO_CERVIX_VALUE_SET,
    CERVICAL_CANCER_VALUE_SET,
    HOSPICE_CARE_VALUE_SET,
  ];
}

// ============================================================================
// Breast Cancer Screening (CMS125)
// ============================================================================

/**
 * Mammography - OID: 2.16.840.1.113883.3.464.1003.108.12.1018
 * Screening and diagnostic mammography procedures
 */
export const MAMMOGRAPHY_VALUE_SET: StandardValueSet = {
  id: 'mammography',
  oid: '2.16.840.1.113883.3.464.1003.108.12.1018',
  name: 'Mammography',
  codes: [
    // CPT Mammography codes
    { code: '77065', system: CPT, display: 'Diagnostic mammography, including CAD when performed; unilateral' },
    { code: '77066', system: CPT, display: 'Diagnostic mammography, including CAD when performed; bilateral' },
    { code: '77067', system: CPT, display: 'Screening mammography, bilateral, including CAD when performed' },
    // HCPCS
    { code: 'G0202', system: HCPCS, display: 'Screening mammography, bilateral, including CAD when performed' },
    { code: 'G0204', system: HCPCS, display: 'Diagnostic mammography, including CAD when performed; bilateral' },
    { code: 'G0206', system: HCPCS, display: 'Diagnostic mammography, including CAD when performed; unilateral' },
    // LOINC
    { code: '24606-6', system: LOINC, display: 'MG Breast Screening' },
    { code: '24604-1', system: LOINC, display: 'MG Breast Diagnostic Limited Views' },
    { code: '24605-8', system: LOINC, display: 'MG Breast Diagnostic' },
    { code: '26346-7', system: LOINC, display: 'MG Breast - bilateral Screening' },
    { code: '26349-1', system: LOINC, display: 'MG Breast - bilateral Diagnostic' },
    { code: '26347-5', system: LOINC, display: 'MG Breast - left Screening' },
    { code: '26350-9', system: LOINC, display: 'MG Breast - left Diagnostic' },
    { code: '26348-3', system: LOINC, display: 'MG Breast - right Screening' },
    { code: '26351-7', system: LOINC, display: 'MG Breast - right Diagnostic' },
    // SNOMED CT
    { code: '24623002', system: SNOMEDCT, display: 'Screening mammography' },
    { code: '71651007', system: SNOMEDCT, display: 'Mammography' },
    { code: '566571000119105', system: SNOMEDCT, display: 'Mammography of right breast' },
    { code: '572701000119102', system: SNOMEDCT, display: 'Mammography of left breast' },
  ],
};

/**
 * Get breast cancer screening numerator value sets
 */
export function getBreastCancerScreeningNumeratorValueSets(): StandardValueSet[] {
  return [
    MAMMOGRAPHY_VALUE_SET,
  ];
}

/**
 * Get all standard value sets organized by measure
 */
export const STANDARD_VALUE_SETS_BY_MEASURE: Record<string, {
  numerator: StandardValueSet[];
  exclusions: StandardValueSet[];
}> = {
  'CMS130': {
    numerator: getCRCScreeningNumeratorValueSets(),
    exclusions: getCRCScreeningExclusionValueSets(),
  },
  'colorectal-cancer-screening': {
    numerator: getCRCScreeningNumeratorValueSets(),
    exclusions: getCRCScreeningExclusionValueSets(),
  },
};

/**
 * Look up a value set by OID
 */
export function getValueSetByOID(oid: string): StandardValueSet | undefined {
  return getAllStandardValueSets().find(vs => vs.oid === oid);
}

/**
 * Get all standard value sets for browsing
 */
export function getAllStandardValueSets(): StandardValueSet[] {
  return [
    COLONOSCOPY_VALUE_SET,
    FOBT_VALUE_SET,
    FIT_DNA_VALUE_SET,
    FLEXIBLE_SIGMOIDOSCOPY_VALUE_SET,
    CT_COLONOGRAPHY_VALUE_SET,
    COLORECTAL_CANCER_VALUE_SET,
    TOTAL_COLECTOMY_VALUE_SET,
    HOSPICE_CARE_VALUE_SET,
    HOSPICE_CARE_AMBULATORY_VALUE_SET,
    FRAILTY_VALUE_SET,
    DEMENTIA_VALUE_SET,
    ...getChildhoodImmunizationValueSets(),
  ];
}

/**
 * Search standard value sets by name or OID
 */
export function searchStandardValueSets(query: string): StandardValueSet[] {
  const lowerQuery = query.toLowerCase();
  return getAllStandardValueSets().filter(vs =>
    vs.name.toLowerCase().includes(lowerQuery) ||
    vs.oid.includes(query) ||
    vs.codes.some(c =>
      c.code.toLowerCase().includes(lowerQuery) ||
      c.display.toLowerCase().includes(lowerQuery)
    )
  );
}

/**
 * Check if a code is in any of the given value sets
 */
export function isCodeInValueSets(
  code: string,
  _system: string,
  valueSets: StandardValueSet[]
): { found: boolean; valueSet?: StandardValueSet; matchedCode?: StandardValueSet['codes'][0] } {
  const normalizedCode = code.toUpperCase().replace(/\./g, '');

  for (const vs of valueSets) {
    for (const vsCode of vs.codes) {
      const normalizedVsCode = vsCode.code.toUpperCase().replace(/\./g, '');
      if (normalizedCode === normalizedVsCode) {
        return { found: true, valueSet: vs, matchedCode: vsCode };
      }
    }
  }

  return { found: false };
}
