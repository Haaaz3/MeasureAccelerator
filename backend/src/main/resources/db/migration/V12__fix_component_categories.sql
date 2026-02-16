-- V12: Fix component categories to align with FHIR resource types
-- This migration corrects category assignments that don't match the component's resource_type

-- Fix Immunization components: should be MEDICATIONS (not PROCEDURES)
UPDATE library_component
SET category = 'MEDICATIONS'
WHERE resource_type = 'Immunization' AND category != 'MEDICATIONS';

-- Fix FOBT/FIT-DNA lab tests: should be LABORATORY (not PROCEDURES)
-- These are Observation resources that represent lab tests
UPDATE library_component
SET category = 'LABORATORY'
WHERE id IN ('cms130-fobt', 'cms130-fitdna')
  AND resource_type = 'Observation';

-- Fix follow-up plans: should be PROCEDURES (not CLINICAL_OBSERVATIONS)
-- These have resource_type = 'Procedure'
UPDATE library_component
SET category = 'PROCEDURES'
WHERE id IN ('cms2-followup-plan', 'cms69-followup-plan')
  AND resource_type = 'Procedure';

-- Ensure all age-related components are in DEMOGRAPHICS
-- Age components have resource_type = 'Patient' and names containing 'Age'
UPDATE library_component
SET category = 'DEMOGRAPHICS'
WHERE resource_type = 'Patient'
  AND (name LIKE '%Age%' OR name LIKE '%age%')
  AND category != 'DEMOGRAPHICS';

-- Ensure all Patient sex/gender components are in DEMOGRAPHICS
UPDATE library_component
SET category = 'DEMOGRAPHICS'
WHERE resource_type = 'Patient'
  AND category != 'DEMOGRAPHICS';
