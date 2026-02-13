package com.algoaccel.model.enums;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Clinical terminology code systems.
 */
public enum CodeSystem {
    ICD10("ICD10", "http://hl7.org/fhir/sid/icd-10"),
    ICD10CM("ICD10CM", "http://hl7.org/fhir/sid/icd-10-cm"),
    ICD10PCS("ICD10PCS", "http://www.cms.gov/Medicare/Coding/ICD10"),
    SNOMED("SNOMED", "http://snomed.info/sct"),
    CPT("CPT", "http://www.ama-assn.org/go/cpt"),
    HCPCS("HCPCS", "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets"),
    LOINC("LOINC", "http://loinc.org"),
    RXNORM("RxNorm", "http://www.nlm.nih.gov/research/umls/rxnorm"),
    CVX("CVX", "http://hl7.org/fhir/sid/cvx"),
    NDC("NDC", "http://hl7.org/fhir/sid/ndc");

    private final String code;
    private final String uri;

    CodeSystem(String code, String uri) {
        this.code = code;
        this.uri = uri;
    }

    @JsonValue
    public String getCode() {
        return code;
    }

    public String getUri() {
        return uri;
    }

    public static CodeSystem fromCode(String code) {
        if (code == null) {
            return null;
        }
        for (CodeSystem system : values()) {
            if (system.code.equalsIgnoreCase(code)) {
                return system;
            }
        }
        throw new IllegalArgumentException("Unknown CodeSystem: " + code);
    }

    public static CodeSystem fromUri(String uri) {
        if (uri == null) {
            return null;
        }
        for (CodeSystem system : values()) {
            if (system.uri.equals(uri)) {
                return system;
            }
        }
        return null; // Unknown URI is not an error
    }
}
