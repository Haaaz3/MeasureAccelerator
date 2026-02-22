import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  ChevronRight,
  Plus,
  Check,
  Building2,
  Stethoscope,
  Scissors,
  Pill,
  FlaskConical,
  ClipboardList,
  Syringe,
  AlertTriangle,
  User,
  Target,
  GitBranch,
  Activity,
  Heart,
  MessageSquare,
  Code,
  Cpu,
} from 'lucide-react';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore';
import { createAtomicComponent } from '../../services/componentLibraryService';

// ============================================================================
// Icons mapping
// ============================================================================
const ICONS = {
  encounter: Building2,
  diagnosis: Stethoscope,
  procedure: Scissors,
  medication: Pill,
  lab: FlaskConical,
  assessment: ClipboardList,
  device: Cpu,
  communication: MessageSquare,
  immunization: Syringe,
  allergy: AlertTriangle,
  demographic: User,
  caregoal: Target,
  intervention: GitBranch,
  familyhistory: Heart,
  symptom: Activity,
  custom: Code,
};

// ============================================================================
// ChipSelect Component
// ============================================================================
function ChipSelect({ options, value, onChange, multi }) {
  const toggle = (v) => {
    if (multi) {
      const current = value || [];
      onChange(current.includes(v) ? current.filter(x => x !== v) : [...current, v]);
    } else {
      onChange(v);
    }
  };
  const isSelected = (v) => multi ? (value || []).includes(v) : value === v;

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const label = typeof o === 'string' ? o : o.label;
        const val = typeof o === 'string' ? o : o.value;
        const selected = isSelected(val);
        return (
          <button
            key={val}
            type="button"
            onClick={() => toggle(val)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              border: selected ? '2px solid var(--accent)' : '1.5px solid var(--border)',
              backgroundColor: selected ? 'var(--accent-muted)' : 'var(--bg-primary)',
              color: selected ? 'var(--accent)' : 'var(--text)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Categories with subcategories and dynamic config fields
// ============================================================================
const CATEGORIES = {
  encounter: {
    label: 'Encounter',
    icon: 'encounter',
    desc: 'Office visits, ED, telehealth, inpatient',
    subcategories: [
      { id: 'office-visit', label: 'Office Visit', desc: 'Outpatient office visits' },
      { id: 'ed-visit', label: 'Emergency Department Visit', desc: 'ED encounters' },
      { id: 'inpatient', label: 'Inpatient Stay', desc: 'Hospital admissions' },
      { id: 'telehealth', label: 'Telehealth', desc: 'Virtual encounters' },
      { id: 'preventive', label: 'Preventive / Wellness', desc: 'Annual wellness, preventive care' },
      { id: 'encounter-other', label: 'Other Encounter', desc: 'Not listed above' },
    ],
    configFields: (sub) => [
      { type: 'chips', label: 'Timing', key: 'timingOp', options: ['During', 'Overlaps', 'Starts During', 'Ends During', 'Before Start', 'After End'] },
      { type: 'chips', label: 'Status', key: 'status', options: ['active', 'completed', 'in-progress', 'not-done'] },
      ...(['inpatient', 'ed-visit'].includes(sub) ? [{ type: 'chips', label: 'Facility Type', key: 'facilityLocation', options: ['Emergency Department', 'Inpatient Ward', 'ICU', 'Observation Unit', 'Other'] }] : []),
      ...(sub === 'inpatient' ? [{ type: 'inline', label: 'Length of Stay', fields: [{ key: 'losOp', type: 'select', options: ['<=', '>=', '<', '>', '='], width: 60 }, { key: 'losValue', type: 'number', placeholder: '120', width: 70 }, { key: 'losUnit', type: 'select', options: ['days', 'hours'], width: 75 }] }] : []),
    ],
    defaults: { timingOp: 'During', timingRef: 'Measurement Period', status: 'completed' },
  },
  diagnosis: {
    label: 'Diagnosis / Condition',
    icon: 'diagnosis',
    desc: 'Active conditions, resolved, recurrence',
    subcategories: [
      { id: 'active-dx', label: 'Active Condition', desc: 'Currently active' },
      { id: 'chronic-dx', label: 'Chronic Condition', desc: 'Long-standing ongoing' },
      { id: 'resolved-dx', label: 'Resolved Condition', desc: 'Previously resolved' },
      { id: 'history-dx', label: 'History of Condition', desc: 'Historical' },
      { id: 'dx-other', label: 'Other Diagnosis', desc: 'Not listed above' },
    ],
    configFields: () => [
      { type: 'chips', label: 'Clinical Status', key: 'status', options: ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'] },
      { type: 'chips', label: 'Timing', key: 'timingOp', options: ['Overlaps', 'During', 'Before Start', 'After Start', 'Starts During'] },
      { type: 'chips', label: 'Severity', key: 'severity', options: ['mild', 'moderate', 'severe'] },
    ],
    defaults: { timingOp: 'Overlaps', timingRef: 'Measurement Period', status: 'active' },
  },
  procedure: {
    label: 'Procedure',
    icon: 'procedure',
    desc: 'Screenings, surgeries, interventions',
    subcategories: [
      { id: 'screening', label: 'Screening / Preventive', desc: 'Mammogram, colonoscopy, Pap test' },
      { id: 'surgical', label: 'Surgical Procedure', desc: 'Surgical operations' },
      { id: 'diagnostic-proc', label: 'Diagnostic Procedure', desc: 'Imaging, biopsy' },
      { id: 'proc-other', label: 'Other Procedure', desc: 'Not listed above' },
    ],
    configFields: (sub) => [
      { type: 'chips', label: 'Timing', key: 'timingOp', options: ['During', 'Before Start', 'Before End', 'Overlaps'] },
      ...(sub === 'screening' ? [
        { type: 'inline', label: 'Lookback Period', fields: [{ key: 'timingQuantity', type: 'number', placeholder: '27', width: 70 }, { key: 'timingUnit', type: 'select', options: ['Months', 'Years', 'Weeks', 'Days'], width: 90 }] },
        { type: 'chips', label: 'Result Status', key: 'resultStatus', options: ['completed', 'final', 'preliminary', 'amended'] },
      ] : []),
      { type: 'chips', label: 'Status', key: 'status', options: ['completed', 'in-progress', 'not-done'] },
      ...(['surgical', 'diagnostic-proc'].includes(sub) ? [{ type: 'text', label: 'Anatomical Location', key: 'anatomicalLocation', placeholder: 'e.g., Left breast, cervix' }] : []),
    ],
    defaults: { timingOp: 'During', timingRef: 'Measurement Period', status: 'completed' },
  },
  medication: {
    label: 'Medication',
    icon: 'medication',
    desc: 'Prescriptions, dispensed, administered',
    subcategories: [
      { id: 'active-rx', label: 'Active Prescription', desc: 'Currently prescribed' },
      { id: 'dispensed', label: 'Dispensed', desc: 'Pharmacy-dispensed' },
      { id: 'administered', label: 'Administered', desc: 'Given in clinical setting' },
      { id: 'med-other', label: 'Other Medication Event', desc: 'Not listed above' },
    ],
    configFields: (sub) => [
      { type: 'chips', label: 'Timing', key: 'timingOp', options: ['During', 'Overlaps', 'Before Start', 'After End'] },
      { type: 'chips', label: 'Status', key: 'status', options: ['active', 'completed', 'stopped', 'on-hold', 'not-done'] },
      { type: 'chips', label: 'Route', key: 'route', options: ['Oral', 'IV', 'IM', 'Subcutaneous', 'Topical', 'Inhaled', 'Other'] },
      ...(sub === 'active-rx' ? [{ type: 'chips', label: 'Frequency', key: 'frequency', options: ['Once daily', 'BID', 'TID', 'QID', 'Weekly', 'Monthly', 'PRN', 'Other'] }] : []),
      ...(sub === 'dispensed' ? [{ type: 'inline', label: 'Days Supply', fields: [{ key: 'supplyOp', type: 'select', options: ['>=', '<=', '='], width: 60 }, { key: 'supplyValue', type: 'number', placeholder: '90', width: 70 }, { key: 'supplyUnit', type: 'select', options: ['days'], width: 60 }] }] : []),
    ],
    defaults: { timingOp: 'During', timingRef: 'Measurement Period', status: 'active' },
  },
  lab: {
    label: 'Laboratory Test',
    icon: 'lab',
    desc: 'Lab results with values',
    subcategories: [
      { id: 'lab-result', label: 'Lab with Numeric Result', desc: 'HbA1c > 9%, LDL >= 190' },
      { id: 'lab-performed', label: 'Lab Performed (any result)', desc: 'Test completed' },
      { id: 'lab-not-done', label: 'Lab Not Performed', desc: 'Absence of lab test' },
      { id: 'lab-interpreted', label: 'Lab with Interpretation', desc: 'Normal, Abnormal, Critical' },
      { id: 'lab-other', label: 'Other Lab', desc: 'Not listed above' },
    ],
    configFields: (sub) => [
      { type: 'chips', label: 'Timing', key: 'timingOp', options: ['During', 'Before End', 'Overlaps'] },
      ...(sub === 'lab-result' ? [{ type: 'inline', label: 'Result Threshold', fields: [{ key: 'resultOp', type: 'select', options: ['>', '>=', '<', '<=', '=', '!='], width: 65 }, { key: 'resultValue', type: 'number', placeholder: '9.0', width: 80 }, { key: 'resultUnit', type: 'text', placeholder: '%', width: 55 }] }] : []),
      ...(sub === 'lab-interpreted' ? [{ type: 'chips', label: 'Interpretation', key: 'interpretation', options: ['Normal', 'Abnormal', 'Critical', 'High', 'Low', 'Positive', 'Negative'] }] : []),
      ...(sub !== 'lab-not-done' ? [{ type: 'chips', label: 'Result Status', key: 'status', options: ['final', 'amended', 'corrected', 'preliminary'] }] : []),
    ],
    defaults: { timingOp: 'During', timingRef: 'Measurement Period', status: 'final' },
  },
  assessment: {
    label: 'Assessment / Screening',
    icon: 'assessment',
    desc: 'PHQ-9, fall risk, tobacco use',
    subcategories: [
      { id: 'scored-tool', label: 'Scored Screening Tool', desc: 'PHQ-9, AUDIT-C, GAD-7' },
      { id: 'binary-screen', label: 'Yes/No Screen', desc: 'Tobacco use, depression screen' },
      { id: 'risk-assessment', label: 'Risk Assessment', desc: 'Fall risk, CV risk' },
      { id: 'assess-other', label: 'Other Assessment', desc: 'Not listed above' },
    ],
    configFields: (sub) => [
      { type: 'chips', label: 'Timing', key: 'timingOp', options: ['During', 'Before End', 'Overlaps'] },
      ...(sub === 'scored-tool' ? [
        { type: 'chips', label: 'Common Tool', key: 'toolName', options: ['PHQ-9', 'AUDIT-C', 'GAD-7', 'DAST-10', 'Edinburgh', 'MMSE', 'MoCA', 'Other'] },
        { type: 'inline', label: 'Score Threshold', fields: [{ key: 'resultOp', type: 'select', options: ['>=', '>', '<=', '<', '='], width: 65 }, { key: 'resultValue', type: 'number', placeholder: '10', width: 80 }] },
      ] : []),
      ...(sub === 'binary-screen' ? [{ type: 'chips', label: 'Result', key: 'screenResult', options: ['Positive', 'Negative', 'Performed (any)', 'Not performed'] }] : []),
      ...(sub === 'risk-assessment' ? [{ type: 'chips', label: 'Risk Level', key: 'riskLevel', options: ['Low', 'Moderate', 'High', 'Very High'] }] : []),
    ],
    defaults: { timingOp: 'During', timingRef: 'Measurement Period' },
  },
  demographic: {
    label: 'Patient Demographic',
    icon: 'demographic',
    desc: 'Age, sex, race, ethnicity, payer',
    subcategories: [
      { id: 'age', label: 'Age', desc: 'Patient age at a point in time' },
      { id: 'sex', label: 'Biological Sex', desc: 'Administrative sex' },
      { id: 'gender-identity', label: 'Gender Identity', desc: 'Self-reported gender' },
      { id: 'race', label: 'Race', desc: 'OMB race categories' },
      { id: 'ethnicity', label: 'Ethnicity', desc: 'Hispanic/Latino status' },
      { id: 'payer', label: 'Payer / Insurance', desc: 'Insurance coverage type' },
      { id: 'language', label: 'Language', desc: 'Preferred language' },
      { id: 'demo-other', label: 'Other Demographic', desc: 'Custom attribute' },
    ],
    configFields: (sub) => {
      if (sub === 'age') return [
        { type: 'inline', label: 'Minimum Age', fields: [{ key: 'ageMinOp', type: 'select', options: ['>=', '>'], width: 60 }, { key: 'ageMin', type: 'number', placeholder: '18', width: 70 }, { key: 'ageMinUnit', type: 'select', options: ['years', 'months', 'days'], width: 85 }] },
        { type: 'inline', label: 'Maximum Age', fields: [{ key: 'ageMaxOp', type: 'select', options: ['<=', '<'], width: 60 }, { key: 'ageMax', type: 'number', placeholder: '75', width: 70 }, { key: 'ageMaxUnit', type: 'select', options: ['years', 'months', 'days'], width: 85 }] },
        { type: 'chips', label: 'Evaluated At', key: 'ageRef', options: ['Start of Measurement Period', 'End of Measurement Period', 'Date of Encounter'] },
      ];
      if (sub === 'sex') return [{ type: 'chips', label: 'Biological Sex', key: 'sexValue', options: ['Male', 'Female'] }];
      if (sub === 'gender-identity') return [{ type: 'chips', label: 'Gender Identity', key: 'genderValue', options: ['Male', 'Female', 'Non-binary', 'Transgender Male', 'Transgender Female', 'Other', 'Unknown'] }];
      if (sub === 'race') return [{ type: 'chips', label: 'Race (select all that apply)', key: 'raceValue', multi: true, options: ['American Indian or Alaska Native', 'Asian', 'Black or African American', 'Native Hawaiian or Other Pacific Islander', 'White', 'Other Race', 'Unknown'] }];
      if (sub === 'ethnicity') return [{ type: 'chips', label: 'Ethnicity', key: 'ethnicityValue', options: ['Hispanic or Latino', 'Not Hispanic or Latino', 'Unknown'] }];
      if (sub === 'payer') return [{ type: 'chips', label: 'Payer Category', key: 'payerType', options: ['Medicare', 'Medicaid', 'Private / Commercial', 'Self-Pay', 'Military / VA', 'Other'] }];
      if (sub === 'language') return [{ type: 'chips', label: 'Language', key: 'languageValue', options: ['English', 'Spanish', 'Chinese', 'French', 'Arabic', 'Vietnamese', 'Korean', 'Other'] }];
      return [
        { type: 'text', label: 'Attribute Name', key: 'customAttr', placeholder: 'e.g., birthdate, marital status' },
        { type: 'text', label: 'Attribute Value', key: 'customAttrValue', placeholder: 'e.g., >= 65 years' },
      ];
    },
    defaults: {},
  },
  immunization: {
    label: 'Immunization',
    icon: 'immunization',
    desc: 'Vaccines administered or historical',
    subcategories: [
      { id: 'vaccine-given', label: 'Vaccine Administered', desc: 'Active immunization' },
      { id: 'vaccine-hx', label: 'Historical Vaccine', desc: 'On record' },
      { id: 'vaccine-declined', label: 'Vaccine Declined', desc: 'Patient refused' },
      { id: 'imm-other', label: 'Other', desc: 'Not listed above' },
    ],
    configFields: (sub) => [
      { type: 'chips', label: 'Timing', key: 'timingOp', options: ['During', 'Before End', 'Before Start'] },
      { type: 'chips', label: 'Dose Number', key: 'doseNumber', options: ['1st dose', '2nd dose', '3rd dose', 'Booster', 'Any'] },
      ...(sub !== 'vaccine-declined' ? [{ type: 'chips', label: 'Status', key: 'status', options: ['completed', 'not-done'] }] : []),
    ],
    defaults: { timingOp: 'During', timingRef: 'Measurement Period', status: 'completed' },
  },
  allergy: {
    label: 'Allergy / Intolerance',
    icon: 'allergy',
    desc: 'Drug, food, environmental',
    subcategories: [
      { id: 'drug-allergy', label: 'Drug Allergy', desc: 'Medication-related' },
      { id: 'food-allergy', label: 'Food Allergy', desc: 'Food intolerance' },
      { id: 'env-allergy', label: 'Environmental', desc: 'Pollen, dust' },
      { id: 'allergy-other', label: 'Other', desc: 'Not listed above' },
    ],
    configFields: () => [
      { type: 'chips', label: 'Clinical Status', key: 'status', options: ['active', 'inactive', 'resolved'] },
      { type: 'chips', label: 'Criticality', key: 'severity', options: ['low', 'high', 'unable-to-assess'] },
      { type: 'chips', label: 'Verification', key: 'verification', options: ['confirmed', 'unconfirmed', 'refuted'] },
    ],
    defaults: { status: 'active' },
  },
  intervention: {
    label: 'Intervention',
    icon: 'intervention',
    desc: 'Counseling, education, referrals',
    subcategories: [
      { id: 'counseling', label: 'Counseling', desc: 'Cessation, dietary, behavioral' },
      { id: 'education', label: 'Patient Education', desc: 'Self-management' },
      { id: 'referral', label: 'Referral', desc: 'Specialist referral' },
      { id: 'int-other', label: 'Other', desc: 'Not listed above' },
    ],
    configFields: () => [
      { type: 'chips', label: 'Timing', key: 'timingOp', options: ['During', 'Before End', 'Overlaps'] },
      { type: 'chips', label: 'Status', key: 'status', options: ['completed', 'in-progress', 'not-done'] },
    ],
    defaults: { timingOp: 'During', timingRef: 'Measurement Period', status: 'completed' },
  },
  communication: {
    label: 'Communication',
    icon: 'communication',
    desc: 'Patient/provider communication',
    subcategories: [
      { id: 'to-patient', label: 'To Patient', desc: 'Provider to patient' },
      { id: 'to-provider', label: 'To Provider', desc: 'Provider to provider' },
      { id: 'comm-other', label: 'Other', desc: 'Not listed above' },
    ],
    configFields: () => [
      { type: 'chips', label: 'Medium', key: 'medium', options: ['In-person', 'Telephone', 'Email', 'Patient Portal', 'Video', 'Mail', 'Other'] },
      { type: 'chips', label: 'Timing', key: 'timingOp', options: ['During', 'Before End', 'Overlaps'] },
      { type: 'chips', label: 'Status', key: 'status', options: ['completed', 'in-progress', 'not-done'] },
    ],
    defaults: { timingOp: 'During', timingRef: 'Measurement Period', status: 'completed' },
  },
  device: {
    label: 'Device',
    icon: 'device',
    desc: 'Medical devices, implants',
    subcategories: [
      { id: 'applied', label: 'Applied Device', desc: 'CPAP, brace' },
      { id: 'implant', label: 'Implanted Device', desc: 'Pacemaker, stent' },
      { id: 'device-other', label: 'Other', desc: 'Not listed above' },
    ],
    configFields: (sub) => [
      { type: 'chips', label: 'Timing', key: 'timingOp', options: ['During', 'Before End', 'Overlaps'] },
      { type: 'chips', label: 'Status', key: 'status', options: ['active', 'completed', 'entered-in-error'] },
      ...(sub === 'implant' ? [{ type: 'text', label: 'Anatomical Location', key: 'anatomicalLocation', placeholder: 'e.g., Left chest wall' }] : []),
    ],
    defaults: { timingOp: 'During', timingRef: 'Measurement Period', status: 'active' },
  },
  caregoal: {
    label: 'Care Goal',
    icon: 'caregoal',
    desc: 'Patient care goals',
    subcategories: [
      { id: 'target-goal', label: 'Target-Based Goal', desc: 'HbA1c < 7%' },
      { id: 'behavioral', label: 'Behavioral Goal', desc: 'Exercise, diet' },
      { id: 'goal-other', label: 'Other', desc: 'Not listed above' },
    ],
    configFields: (sub) => [
      { type: 'chips', label: 'Status', key: 'status', options: ['active', 'completed', 'accepted', 'cancelled', 'on-hold'] },
      ...(sub === 'target-goal' ? [{ type: 'inline', label: 'Target', fields: [{ key: 'targetOp', type: 'select', options: ['<', '<=', '>', '>=', '='], width: 60 }, { key: 'targetValue', type: 'number', placeholder: '7.0', width: 70 }, { key: 'targetUnit', type: 'text', placeholder: '%', width: 55 }] }] : []),
    ],
    defaults: { status: 'active' },
  },
  familyhistory: {
    label: 'Family History',
    icon: 'familyhistory',
    desc: 'Family member conditions',
    subcategories: [
      { id: 'parent-hx', label: 'Parent', desc: 'Mother or father' },
      { id: 'sibling-hx', label: 'Sibling', desc: 'Brother or sister' },
      { id: 'fhx-other', label: 'Other Relationship', desc: 'Grandparent, child, etc.' },
    ],
    configFields: () => [
      { type: 'chips', label: 'Relationship', key: 'relationship', options: ['Mother', 'Father', 'Parent (either)', 'Sibling', 'Child', 'Grandparent', 'Other'] },
      { type: 'chips', label: 'Status', key: 'status', options: ['completed', 'health-unknown'] },
    ],
    defaults: { status: 'completed' },
  },
  symptom: {
    label: 'Symptom',
    icon: 'symptom',
    desc: 'Reported symptoms, clinical findings',
    subcategories: [
      { id: 'reported', label: 'Patient-Reported', desc: 'Self-reported' },
      { id: 'clinical-finding', label: 'Clinical Finding', desc: 'Provider-observed' },
      { id: 'symptom-other', label: 'Other', desc: 'Not listed above' },
    ],
    configFields: () => [
      { type: 'chips', label: 'Timing', key: 'timingOp', options: ['During', 'Overlaps', 'Before End'] },
      { type: 'chips', label: 'Severity', key: 'severity', options: ['mild', 'moderate', 'severe'] },
      { type: 'chips', label: 'Status', key: 'status', options: ['active', 'inactive', 'resolved'] },
    ],
    defaults: { timingOp: 'During', timingRef: 'Measurement Period', status: 'active' },
  },
  custom: {
    label: 'Custom / CQL',
    icon: 'custom',
    desc: 'Full control, raw CQL',
    subcategories: [
      { id: 'custom-full', label: 'Full Custom', desc: 'All fields available' },
      { id: 'cql-only', label: 'Raw CQL Expression', desc: 'Write CQL directly' },
    ],
    configFields: (sub) => sub === 'cql-only' ? [{ type: 'cql' }] : [
      { type: 'text', label: 'Value Set OID', key: 'vsOid', placeholder: '2.16.840.1.113883...' },
      { type: 'text', label: 'Value Set Name', key: 'vsName', placeholder: 'e.g., Office Visit' },
      { type: 'chips', label: 'Timing', key: 'timingOp', options: ['During', 'Overlaps', 'Before Start', 'After Start', 'Before End', 'After End', 'Within', 'Includes'] },
      { type: 'chips', label: 'Status', key: 'status', options: ['active', 'completed', 'in-progress', 'not-done', 'on-hold', 'stopped', 'cancelled'] },
    ],
    defaults: {},
  },
};

const CAT_GROUPS = [
  { group: 'Clinical', ids: ['encounter', 'diagnosis', 'procedure', 'medication', 'lab', 'assessment'] },
  { group: 'Medication & Allergy', ids: ['immunization', 'allergy'] },
  { group: 'Care & Communication', ids: ['intervention', 'communication', 'caregoal', 'device'] },
  { group: 'Patient Context', ids: ['demographic', 'familyhistory', 'symptom'] },
  { group: 'Advanced', ids: ['custom'] },
];

// ============================================================================
// Code Generation
// ============================================================================
function generateCQL(form, cat, sub) {
  const name = form.name || 'Unnamed';
  const quotedName = `"${name}"`;
  const vs = form.vsName || sub?.label || 'Value Set';

  if (form.cqlExpression) return form.cqlExpression;

  if (cat?.label === 'Patient Demographic') {
    if (form.sexValue) return `define ${quotedName}:\n  Patient.gender = '${form.sexValue.toLowerCase()}'`;
    if (form.ageMin || form.ageMax) {
      const parts = [];
      if (form.ageMin) parts.push(`AgeInYearsAt(start of "Measurement Period") ${form.ageMinOp || '>='} ${form.ageMin}`);
      if (form.ageMax) parts.push(`AgeInYearsAt(start of "Measurement Period") ${form.ageMaxOp || '<='} ${form.ageMax}`);
      return `define ${quotedName}:\n  ${parts.join('\n    and ')}`;
    }
    if (form.raceValue) {
      const values = Array.isArray(form.raceValue) ? form.raceValue : [form.raceValue];
      return `define ${quotedName}:\n  exists (\n    Patient.race.coding C\n      where C.display in { ${values.map(x => `'${x}'`).join(', ')} }\n  )`;
    }
    if (form.ethnicityValue) return `define ${quotedName}:\n  Patient.ethnicity.display = '${form.ethnicityValue}'`;
    if (form.payerType) return `define ${quotedName}:\n  exists (\n    [Coverage: "${form.payerType}"] C\n      where C.period overlaps "Measurement Period"\n  )`;
    return `define ${quotedName}:\n  // Custom demographic`;
  }

  const existsOp = form.negation ? 'not exists' : 'exists';
  const qdm = cat?.label === 'Encounter' ? 'Encounter, Performed'
    : cat?.label === 'Diagnosis / Condition' ? 'Diagnosis'
    : cat?.label === 'Procedure' ? 'Procedure, Performed'
    : cat?.label === 'Medication' ? 'Medication, Active'
    : cat?.label === 'Laboratory Test' ? 'Laboratory Test, Performed'
    : cat?.label === 'Assessment / Screening' ? 'Assessment, Performed'
    : cat?.label || 'Unknown';

  let timing = '';
  if (form.timingOp) {
    const quantity = form.timingQuantity ? ` ${form.timingQuantity} ${(form.timingUnit || 'years').toLowerCase()} before end of` : '';
    timing = `\n      where E.relevantDatetime${quantity} during "${form.timingRef || 'Measurement Period'}"`;
  }

  let result = '';
  if (form.resultValue) {
    result = `\n        and E.result ${form.resultOp || '>'} ${form.resultValue} '${form.resultUnit || ''}'`.trimEnd();
  }

  return `define ${quotedName}:\n  ${existsOp} (\n    [${qdm}: "${vs}"] E${timing}${result}\n  )`;
}

function generateSynapse(form, cat, sub) {
  const obj = {
    name: form.name || 'Unnamed',
    type: cat?.label?.toLowerCase().replace(/[^a-z]/g, '_') || 'custom',
    subtype: sub?.id || 'unknown',
  };

  if (form.vsOid) obj.value_set = { oid: form.vsOid, name: form.vsName || '' };
  else if (form.vsName) obj.value_set = { name: form.vsName };

  if (form.timingOp && cat?.label !== 'Patient Demographic') {
    obj.timing = {
      operator: form.timingOp,
      ...(form.timingQuantity && { quantity: +form.timingQuantity, unit: form.timingUnit }),
      reference: form.timingRef || 'Measurement Period',
    };
  }

  if (form.resultValue) {
    obj.result = { operator: form.resultOp, value: +form.resultValue, ...(form.resultUnit && { unit: form.resultUnit }) };
  }

  if (form.negation) obj.negation = true;
  if (form.status) obj.status = form.status;
  if (form.sexValue) obj.attribute = { name: 'gender', value: form.sexValue.toLowerCase() };
  if (form.ageMin) obj.age = { min: +form.ageMin, ...(form.ageMax && { max: +form.ageMax }), unit: form.ageMinUnit || 'years', reference: form.ageRef || 'Start of Measurement Period' };
  if (form.raceValue) obj.attribute = { name: 'race', value: form.raceValue };
  if (form.ethnicityValue) obj.attribute = { name: 'ethnicity', value: form.ethnicityValue };

  return JSON.stringify(obj, null, 2);
}

// ============================================================================
// Config Field Renderer
// ============================================================================
function renderConfigField(field, form, update) {
  if (field.type === 'chips') {
    return (
      <div key={field.key} className="mb-3">
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{field.label}</label>
        <ChipSelect options={field.options} value={form[field.key]} onChange={v => update(field.key, v)} multi={field.multi} />
      </div>
    );
  }

  if (field.type === 'text') {
    return (
      <div key={field.key} className="mb-3">
        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{field.label}</label>
        <input
          type="text"
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text)' }}
          placeholder={field.placeholder}
          value={form[field.key] || ''}
          onChange={e => update(field.key, e.target.value)}
        />
      </div>
    );
  }

  if (field.type === 'inline') {
    return (
      <div key={field.label} className="mb-3">
        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{field.label}</label>
        <div className="flex gap-1.5">
          {field.fields.map(f => (
            <div key={f.key} style={{ width: f.width }}>
              {f.type === 'select' ? (
                <select
                  className="w-full px-2 py-2 rounded-lg border text-xs outline-none"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  value={form[f.key] || f.options[0]}
                  onChange={e => update(f.key, e.target.value)}
                >
                  {f.options.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type}
                  className="w-full px-2 py-2 rounded-lg border text-xs outline-none"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  placeholder={f.placeholder}
                  value={form[f.key] || ''}
                  onChange={e => update(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'cql') {
    return (
      <div key="cql" className="mb-3">
        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>CQL Expression</label>
        <textarea
          className="w-full px-3 py-2 rounded-lg border text-xs outline-none font-mono resize-y"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text)', minHeight: 140 }}
          placeholder={'define "Custom Criteria":\n  exists (\n    [Encounter: "Office Visit"] E\n      where E.period during "Measurement Period"\n  )'}
          value={form.cqlExpression || ''}
          onChange={e => update('cqlExpression', e.target.value)}
        />
      </div>
    );
  }

  return null;
}

// ============================================================================
// StepBar Component
// ============================================================================
function StepBar({ step, labels }) {
  return (
    <div className="flex items-center gap-0 mb-4">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center" style={{ flex: i < labels.length - 1 ? 1 : 'none' }}>
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all"
            style={{
              backgroundColor: step >= i ? 'var(--accent)' : 'var(--border)',
              color: step >= i ? 'white' : 'var(--text-secondary)',
            }}
          >
            {step > i ? <Check size={12} /> : i + 1}
          </div>
          <span
            className="text-xs font-medium ml-1 whitespace-nowrap"
            style={{ color: step === i ? 'var(--text)' : 'var(--text-secondary)' }}
          >
            {label}
          </span>
          {i < labels.length - 1 && (
            <div
              className="flex-1 h-px mx-1.5 transition-colors"
              style={{ backgroundColor: step > i ? 'var(--accent)' : 'var(--border)' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================
export default function CreateComponentWizard({ onSave, onClose }) {
  // No atomic/composite toggle - starts directly at category selection (Step 0)
  const [step, setStep] = useState(0); // 0=category, 1=subtype, 2=configure, 3=review+code
  const [catId, setCatId] = useState(null);
  const [subId, setSubId] = useState(null);
  const [form, setForm] = useState({ codes: [] });
  const [search, setSearch] = useState('');
  const [codeTab, setCodeTab] = useState('cql');
  const [editedCql, setEditedCql] = useState(null);
  const [editedSynapse, setEditedSynapse] = useState(null);

  const { addComponent } = useComponentLibraryStore();

  const update = useCallback((key, val) => setForm(prev => ({ ...prev, [key]: val })), []);

  const cat = catId ? CATEGORIES[catId] : null;
  const sub = cat?.subcategories.find(s => s.id === subId);

  const selectCat = (id) => {
    setCatId(id);
    setSubId(null);
    setStep(1);
  };

  const selectSub = (s) => {
    setSubId(s.id);
    setForm(prev => ({ ...prev, ...(CATEGORIES[catId].defaults || {}) }));
    setStep(2);
  };

  // Reset edited code when form changes
  useEffect(() => {
    setEditedCql(null);
    setEditedSynapse(null);
  }, [form]);

  const cqlCode = editedCql !== null ? editedCql : generateCQL(form, cat, sub);
  const synapseCode = editedSynapse !== null ? editedSynapse : generateSynapse(form, cat, sub);

  const stepLabels = ['Category', cat?.label || 'Subtype', 'Configure', 'Review & Code'];

  // Filter categories by search
  const filteredGroups = useMemo(() => {
    return CAT_GROUPS.map(g => ({
      ...g,
      cats: g.ids.map(id => ({ id, ...CATEGORIES[id] })).filter(c =>
        c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.desc.toLowerCase().includes(search.toLowerCase())
      ),
    })).filter(g => g.cats.length > 0);
  }, [search]);

  // Handle save
  const handleSave = useCallback(() => {
    if (!form.name?.trim() || !cat || !sub) return;

    const tags = (form.tags || '').split(',').map(t => t.trim()).filter(Boolean);

    // Build timing expression
    const timingParts = [(form.timingOp || 'during').toLowerCase()];
    if (form.timingQuantity) {
      timingParts.push(form.timingQuantity, (form.timingUnit || 'years').toLowerCase());
    }
    timingParts.push(form.timingRef || 'Measurement Period');
    const timingExpression = timingParts.join(' ');

    const component = createAtomicComponent({
      name: form.name.trim(),
      valueSet: {
        oid: form.vsOid?.trim() || '',
        version: form.vsVersion?.trim() || '1.0',
        name: form.vsName?.trim() || sub.label,
      },
      timing: {
        operator: (form.timingOp || 'during').toLowerCase(),
        quantity: form.timingQuantity ? Number(form.timingQuantity) : undefined,
        unit: form.timingQuantity ? (form.timingUnit || 'years').toLowerCase() : undefined,
        reference: form.timingRef || 'Measurement Period',
        displayExpression: timingExpression,
      },
      negation: form.negation || false,
      category: catId,
      tags,
    });

    // Store additional metadata
    component.metadata.subtype = subId;
    if (form.resultValue) component.metadata.result = { op: form.resultOp, value: form.resultValue, unit: form.resultUnit };
    if (form.sexValue) component.metadata.sexValue = form.sexValue;
    if (form.genderValue) component.metadata.genderValue = form.genderValue;
    if (form.ageMin) component.metadata.age = { min: form.ageMin, max: form.ageMax, unit: form.ageMinUnit };
    if (form.raceValue) component.metadata.raceValue = form.raceValue;
    if (form.ethnicityValue) component.metadata.ethnicityValue = form.ethnicityValue;
    if (form.payerType) component.metadata.payerType = form.payerType;
    if (form.severity) component.metadata.severity = form.severity;
    if (form.route) component.metadata.route = form.route;
    if (form.frequency) component.metadata.frequency = form.frequency;
    if (form.interpretation) component.metadata.interpretation = form.interpretation;
    if (form.medium) component.metadata.medium = form.medium;
    if (form.doseNumber) component.metadata.doseNumber = form.doseNumber;
    if (form.relationship) component.metadata.relationship = form.relationship;
    if (editedCql || form.cqlExpression) component.metadata.cqlExpression = editedCql || form.cqlExpression;
    if (editedSynapse) component.metadata.synapseJson = editedSynapse;

    addComponent(component);
    onSave();
  }, [form, cat, sub, catId, subId, editedCql, editedSynapse, addComponent, onSave]);

  const canNext = step === 0 ? catId
    : step === 1 ? subId
    : step === 2 ? (form.name || '').trim()
    : false;

  // ============================================================================
  // Step 0: Category Selection (no atomic/composite toggle - starts here directly)
  // ============================================================================
  const renderStep0 = () => (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>
        What type of component are you building?
      </div>
      <input
        type="text"
        className="w-full px-3 py-2 rounded-lg border text-sm outline-none mb-2.5"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text)' }}
        placeholder="Search categories..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="max-h-[380px] overflow-y-auto pr-1">
        {filteredGroups.map(group => (
          <div key={group.group} className="mb-3">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 px-0.5" style={{ color: 'var(--text-secondary)' }}>
              {group.group}
            </div>
            {group.cats.map(c => {
              const IconComponent = ICONS[c.icon] || Code;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCat(c.id)}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border text-left w-full mb-1 transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-muted)]"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <IconComponent size={14} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{c.label}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{c.desc}</div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  // ============================================================================
  // Step 1: Subcategory Selection
  // ============================================================================
  const renderStep1 = () => {
    const IconComponent = ICONS[cat?.icon] || Code;
    return (
      <div>
        <div className="flex items-center gap-2 mb-3.5 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'var(--accent-muted)' }}>
            <IconComponent size={12} style={{ color: 'var(--accent)' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{cat?.label}</span>
          <button
            type="button"
            onClick={() => { setStep(0); setCatId(null); }}
            className="ml-auto text-xs font-medium"
            style={{ color: 'var(--accent)' }}
          >
            Change
          </button>
        </div>

        <div className="text-[10px] font-bold uppercase tracking-wide mb-2.5" style={{ color: 'var(--text-secondary)' }}>
          What kind of {cat?.label.toLowerCase()}?
        </div>

        {cat?.subcategories.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => selectSub(s)}
            className="flex items-center gap-2.5 p-3 rounded-lg border text-left w-full mb-1.5 transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-muted)]"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
          >
            <div className="flex-1">
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.label}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.desc}</div>
            </div>
            <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
        ))}
      </div>
    );
  };

  // ============================================================================
  // Step 2: Configure
  // ============================================================================
  const renderStep2 = () => {
    const fields = typeof cat?.configFields === 'function' ? cat.configFields(subId, form) : [];
    const IconComponent = ICONS[cat?.icon] || Code;

    return (
      <div>
        <div className="flex items-center gap-1.5 mb-3.5 p-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: 'var(--accent-muted)' }}>
            <IconComponent size={10} style={{ color: 'var(--accent)' }} />
          </div>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>{cat?.label}</span>
          <span style={{ color: 'var(--text-secondary)' }}>→</span>
          <span className="font-semibold" style={{ color: 'var(--accent)' }}>{sub?.label}</span>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="ml-auto text-xs font-medium"
            style={{ color: 'var(--accent)' }}
          >
            Change
          </button>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Component Name</label>
          <input
            type="text"
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text)' }}
            placeholder={`e.g., ${sub?.label || 'Component'} During MP`}
            value={form.name || ''}
            onChange={e => update('name', e.target.value)}
          />
        </div>

        {catId !== 'demographic' && subId !== 'cql-only' && (
          <fieldset className="border rounded-lg p-3 mb-3" style={{ borderColor: 'var(--border)' }}>
            <legend className="text-[10px] font-bold uppercase tracking-wide px-1.5" style={{ color: 'var(--text-secondary)' }}>Value Set</legend>
            <div className="mb-2">
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>OID</label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text)' }}
                placeholder="2.16.840.1.113883.3.464..."
                value={form.vsOid || ''}
                onChange={e => update('vsOid', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Version</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  placeholder="20230301"
                  value={form.vsVersion || ''}
                  onChange={e => update('vsVersion', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  placeholder="e.g., Office Visit"
                  value={form.vsName || ''}
                  onChange={e => update('vsName', e.target.value)}
                />
              </div>
            </div>
          </fieldset>
        )}

        {fields.map((f, i) => <div key={i}>{renderConfigField(f, form, update)}</div>)}

        {catId !== 'demographic' && subId !== 'cql-only' && (
          <div
            className="flex items-center justify-between p-2.5 rounded-lg border mt-2"
            style={{
              borderColor: form.negation ? 'var(--accent)' : 'var(--border)',
              backgroundColor: form.negation ? 'var(--accent-muted)' : 'var(--bg-primary)',
            }}
          >
            <div>
              <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Negation (absence of)</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Represents absence of this criterion</div>
            </div>
            <button
              type="button"
              onClick={() => update('negation', !form.negation)}
              className="w-9 h-5 rounded-full relative transition-all flex-shrink-0"
              style={{ backgroundColor: form.negation ? 'var(--accent)' : 'var(--border)' }}
            >
              <div
                className="w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-all shadow-sm"
                style={{ left: form.negation ? '19px' : '3px' }}
              />
            </button>
          </div>
        )}

        <div className="mt-2.5">
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Tags (optional)</label>
          <input
            type="text"
            className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text)' }}
            placeholder="comma-separated"
            value={form.tags || ''}
            onChange={e => update('tags', e.target.value)}
          />
        </div>
      </div>
    );
  };

  // ============================================================================
  // Step 3: Review & Code
  // ============================================================================
  const renderStep3 = () => {
    const rows = [
      { l: 'Name', v: form.name || '(unnamed)' },
      { l: 'Category', v: `${cat?.label} → ${sub?.label}` },
      form.vsName && { l: 'Value Set', v: form.vsName },
      form.timingOp && catId !== 'demographic' && { l: 'Timing', v: `${form.timingOp} ${form.timingQuantity ? form.timingQuantity + ' ' + (form.timingUnit || 'years') + ' ' : ''}${form.timingRef || 'Measurement Period'}` },
      form.resultValue && { l: 'Result', v: `${form.resultOp || '>'} ${form.resultValue}${form.resultUnit || ''}` },
      form.sexValue && { l: 'Sex', v: form.sexValue },
      form.genderValue && { l: 'Gender', v: form.genderValue },
      form.ageMin && { l: 'Age', v: `${form.ageMinOp || '>='} ${form.ageMin}${form.ageMax ? ' and ' + (form.ageMaxOp || '<=') + ' ' + form.ageMax : ''} ${form.ageMinUnit || 'years'}` },
      form.raceValue && { l: 'Race', v: Array.isArray(form.raceValue) ? form.raceValue.join(', ') : form.raceValue },
      form.ethnicityValue && { l: 'Ethnicity', v: form.ethnicityValue },
      form.payerType && { l: 'Payer', v: form.payerType },
      form.route && { l: 'Route', v: form.route },
      form.frequency && { l: 'Frequency', v: form.frequency },
      form.severity && { l: 'Severity', v: form.severity },
      form.interpretation && { l: 'Interpretation', v: form.interpretation },
      form.medium && { l: 'Medium', v: form.medium },
      form.doseNumber && { l: 'Dose', v: form.doseNumber },
      form.relationship && { l: 'Relationship', v: form.relationship },
      form.negation && { l: 'Negation', v: 'Yes' },
      form.status && { l: 'Status', v: form.status },
      form.tags && { l: 'Tags', v: form.tags },
    ].filter(Boolean);

    return (
      <div>
        <div className="rounded-lg border overflow-hidden mb-4" style={{ borderColor: 'var(--border)' }}>
          {rows.map((r, i) => (
            <div
              key={r.l}
              className="flex px-3 py-2"
              style={{
                borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                backgroundColor: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
              }}
            >
              <span className="text-xs font-semibold w-20 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{r.l}</span>
              <span className="text-xs" style={{ color: 'var(--text)' }}>{r.v}</span>
            </div>
          ))}
        </div>

        <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="flex border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-tertiary)' }}>
            {[{ key: 'cql', label: 'CQL' }, { key: 'synapse', label: 'Synapse JSON' }].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCodeTab(tab.key)}
                className="flex-1 py-2 px-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                style={{
                  backgroundColor: codeTab === tab.key ? 'var(--bg-primary)' : 'transparent',
                  borderBottom: codeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                  color: codeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <Code size={12} />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <textarea
              className="w-full px-3.5 py-3 border-none outline-none text-xs font-mono resize-y"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text)',
                minHeight: 160,
                lineHeight: 1.6,
              }}
              value={codeTab === 'cql' ? cqlCode : synapseCode}
              onChange={e => {
                if (codeTab === 'cql') setEditedCql(e.target.value);
                else setEditedSynapse(e.target.value);
              }}
            />
            <div
              className="absolute top-2 right-2.5 text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
            >
              {(codeTab === 'cql' ? editedCql : editedSynapse) !== null ? 'edited' : 'auto-generated'}
            </div>
          </div>
        </div>
        <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
          Edit the code directly before saving. Manual edits override auto-generation.
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="rounded-xl shadow-2xl border w-full max-w-[560px] max-h-[90vh] flex flex-col"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-muted)', border: '1px solid var(--accent)' }}
            >
              <Plus size={14} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Create Component</h2>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Define a reusable measure building block</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-md flex items-center justify-center hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3.5">
          <StepBar step={step} labels={stepLabels} />
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
              opacity: step > 0 ? 1 : 0.5,
            }}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (step === 3) {
                handleSave();
              } else if (canNext) {
                setStep(step + 1);
              }
            }}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: (step === 3 || canNext) ? 'var(--accent)' : 'var(--border)',
              color: (step === 3 || canNext) ? 'white' : 'var(--text-secondary)',
              cursor: (step === 3 || canNext) ? 'pointer' : 'not-allowed',
              boxShadow: (step === 3 || canNext) ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
            }}
          >
            {step === 3 ? 'Create Component' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
