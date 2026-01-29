/**
 * Sample Component Library Test Data
 * 
 * Use this to seed the library for testing and development.
 */

import type {
  AtomicComponent,
  CompositeComponent,
  ComponentLibrary,
  CategoryGroup,
} from '../types/componentLibrary';

// ============================================================================
// Sample Atomic Components
// ============================================================================

export const sampleAtomics: Omit<AtomicComponent, 'complexity'>[] = [
  // Demographics - Low complexity
  {
    type: 'atomic',
    id: 'age-45-75-at-start-mp',
    name: 'Age 45-75 at Start of MP',
    description: 'Patient age between 45 and 75 years at the start of the measurement period',
    valueSet: {
      oid: 'N/A',
      version: 'N/A',
      name: 'Demographic Constraint',
    },
    timing: {
      operator: 'during',
      reference: 'Measurement Period',
      displayExpression: 'at start of Measurement Period',
    },
    negation: false,
    versionInfo: {
      versionId: '1.0',
      versionHistory: [
        {
          versionId: '1.0',
          status: 'approved',
          createdAt: '2024-01-15T10:00:00Z',
          createdBy: 'system',
          changeDescription: 'Initial version',
        },
      ],
      status: 'approved',
      approvedBy: 'admin',
      approvedAt: '2024-01-15T10:00:00Z',
    },
    usage: {
      measureIds: [],
      usageCount: 0,
    },
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      createdBy: 'system',
      updatedAt: '2024-01-15T10:00:00Z',
      updatedBy: 'system',
      category: 'demographics',
      tags: ['age', 'standard'],
      source: { origin: 'ecqi' },
    },
  },
  
  // Encounters - Low complexity
  {
    type: 'atomic',
    id: 'office-visit-during-mp',
    name: 'Office Visit during MP',
    description: 'Office visit encounter during the measurement period',
    valueSet: {
      oid: '2.16.840.1.113883.3.464.1003.101.12.1001',
      version: '20240101',
      name: 'Office Visit',
    },
    timing: {
      operator: 'during',
      reference: 'Measurement Period',
      displayExpression: 'during Measurement Period',
    },
    negation: false,
    versionInfo: {
      versionId: '1.0',
      versionHistory: [
        {
          versionId: '1.0',
          status: 'approved',
          createdAt: '2024-01-15T10:00:00Z',
          createdBy: 'system',
          changeDescription: 'Initial version',
        },
      ],
      status: 'approved',
      approvedBy: 'admin',
      approvedAt: '2024-01-15T10:00:00Z',
    },
    usage: {
      measureIds: [],
      usageCount: 0,
    },
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      createdBy: 'system',
      updatedAt: '2024-01-15T10:00:00Z',
      updatedBy: 'system',
      category: 'encounters',
      tags: ['encounter', 'outpatient', 'standard'],
      source: { origin: 'ecqi' },
    },
  },
  
  {
    type: 'atomic',
    id: 'home-healthcare-during-mp',
    name: 'Home Healthcare Services during MP',
    description: 'Home healthcare services encounter during the measurement period',
    valueSet: {
      oid: '2.16.840.1.113883.3.464.1003.101.12.1016',
      version: '20240101',
      name: 'Home Healthcare Services',
    },
    timing: {
      operator: 'during',
      reference: 'Measurement Period',
      displayExpression: 'during Measurement Period',
    },
    negation: false,
    versionInfo: {
      versionId: '1.0',
      versionHistory: [
        {
          versionId: '1.0',
          status: 'approved',
          createdAt: '2024-01-15T10:00:00Z',
          createdBy: 'system',
          changeDescription: 'Initial version',
        },
      ],
      status: 'approved',
      approvedBy: 'admin',
      approvedAt: '2024-01-15T10:00:00Z',
    },
    usage: {
      measureIds: [],
      usageCount: 0,
    },
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      createdBy: 'system',
      updatedAt: '2024-01-15T10:00:00Z',
      updatedBy: 'system',
      category: 'encounters',
      tags: ['encounter', 'home health', 'standard'],
      source: { origin: 'ecqi' },
    },
  },
  
  {
    type: 'atomic',
    id: 'preventive-care-during-mp',
    name: 'Preventive Care Services during MP',
    description: 'Preventive care services encounter during the measurement period',
    valueSet: {
      oid: '2.16.840.1.113883.3.464.1003.101.12.1027',
      version: '20240101',
      name: 'Preventive Care Services - Established Office Visit, 18 and Up',
    },
    timing: {
      operator: 'during',
      reference: 'Measurement Period',
      displayExpression: 'during Measurement Period',
    },
    negation: false,
    versionInfo: {
      versionId: '1.0',
      versionHistory: [
        {
          versionId: '1.0',
          status: 'approved',
          createdAt: '2024-01-15T10:00:00Z',
          createdBy: 'system',
          changeDescription: 'Initial version',
        },
      ],
      status: 'approved',
      approvedBy: 'admin',
      approvedAt: '2024-01-15T10:00:00Z',
    },
    usage: {
      measureIds: [],
      usageCount: 0,
    },
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      createdBy: 'system',
      updatedAt: '2024-01-15T10:00:00Z',
      updatedBy: 'system',
      category: 'encounters',
      tags: ['encounter', 'preventive', 'standard'],
      source: { origin: 'ecqi' },
    },
  },
  
  {
    type: 'atomic',
    id: 'annual-wellness-during-mp',
    name: 'Annual Wellness Visit during MP',
    description: 'Annual wellness visit encounter during the measurement period',
    valueSet: {
      oid: '2.16.840.1.113883.3.526.3.1240',
      version: '20240101',
      name: 'Annual Wellness Visit',
    },
    timing: {
      operator: 'during',
      reference: 'Measurement Period',
      displayExpression: 'during Measurement Period',
    },
    negation: false,
    versionInfo: {
      versionId: '1.0',
      versionHistory: [
        {
          versionId: '1.0',
          status: 'approved',
          createdAt: '2024-01-15T10:00:00Z',
          createdBy: 'system',
          changeDescription: 'Initial version',
        },
      ],
      status: 'approved',
      approvedBy: 'admin',
      approvedAt: '2024-01-15T10:00:00Z',
    },
    usage: {
      measureIds: [],
      usageCount: 0,
    },
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      createdBy: 'system',
      updatedAt: '2024-01-15T10:00:00Z',
      updatedBy: 'system',
      category: 'encounters',
      tags: ['encounter', 'wellness', 'standard'],
      source: { origin: 'ecqi' },
    },
  },
  
  {
    type: 'atomic',
    id: 'online-assessment-during-mp',
    name: 'Online Assessment during MP',
    description: 'Online assessment encounter during the measurement period',
    valueSet: {
      oid: '2.16.840.1.113883.3.464.1003.101.12.1089',
      version: '20240101',
      name: 'Online Assessments',
    },
    timing: {
      operator: 'during',
      reference: 'Measurement Period',
      displayExpression: 'during Measurement Period',
    },
    negation: false,
    versionInfo: {
      versionId: '1.0',
      versionHistory: [
        {
          versionId: '1.0',
          status: 'approved',
          createdAt: '2024-01-15T10:00:00Z',
          createdBy: 'system',
          changeDescription: 'Initial version',
        },
      ],
      status: 'approved',
      approvedBy: 'admin',
      approvedAt: '2024-01-15T10:00:00Z',
    },
    usage: {
      measureIds: [],
      usageCount: 0,
    },
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      createdBy: 'system',
      updatedAt: '2024-01-15T10:00:00Z',
      updatedBy: 'system',
      category: 'encounters',
      tags: ['encounter', 'telehealth', 'standard'],
      source: { origin: 'ecqi' },
    },
  },
  
  // Procedures - Medium complexity (longer lookback)
  {
    type: 'atomic',
    id: 'colonoscopy-within-10-years',
    name: 'Colonoscopy within 10 years before end of MP',
    description: 'Colonoscopy procedure performed within 10 years before the end of measurement period',
    valueSet: {
      oid: '2.16.840.1.113883.3.464.1003.108.12.1020',
      version: '20240101',
      name: 'Colonoscopy',
    },
    timing: {
      operator: 'within',
      quantity: 10,
      unit: 'years',
      position: 'before end of',
      reference: 'Measurement Period',
      displayExpression: 'within 10 years before end of Measurement Period',
    },
    negation: false,
    versionInfo: {
      versionId: '1.0',
      versionHistory: [
        {
          versionId: '1.0',
          status: 'approved',
          createdAt: '2024-01-15T10:00:00Z',
          createdBy: 'system',
          changeDescription: 'Initial version',
        },
      ],
      status: 'approved',
      approvedBy: 'admin',
      approvedAt: '2024-01-15T10:00:00Z',
    },
    usage: {
      measureIds: [],
      usageCount: 0,
    },
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      createdBy: 'system',
      updatedAt: '2024-01-15T10:00:00Z',
      updatedBy: 'system',
      category: 'procedures',
      tags: ['screening', 'colorectal'],
      source: { origin: 'ecqi', originalMeasureId: 'CMS130' },
    },
  },
  
  // Exclusions - Medium complexity
  {
    type: 'atomic',
    id: 'hospice-encounter-during-mp',
    name: 'Hospice Encounter during MP',
    description: 'Hospice care encounter during the measurement period',
    valueSet: {
      oid: '2.16.840.1.113883.3.464.1003.1003',
      version: '20240101',
      name: 'Hospice Encounter',
    },
    timing: {
      operator: 'during',
      reference: 'Measurement Period',
      displayExpression: 'during Measurement Period',
    },
    negation: false,
    versionInfo: {
      versionId: '1.0',
      versionHistory: [
        {
          versionId: '1.0',
          status: 'approved',
          createdAt: '2024-01-15T10:00:00Z',
          createdBy: 'system',
          changeDescription: 'Initial version',
        },
      ],
      status: 'approved',
      approvedBy: 'admin',
      approvedAt: '2024-01-15T10:00:00Z',
    },
    usage: {
      measureIds: [],
      usageCount: 0,
    },
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      createdBy: 'system',
      updatedAt: '2024-01-15T10:00:00Z',
      updatedBy: 'system',
      category: 'exclusions',
      tags: ['hospice', 'exclusion', 'standard'],
      source: { origin: 'ecqi' },
    },
  },
  
  {
    type: 'atomic',
    id: 'hospice-intervention-during-mp',
    name: 'Hospice Intervention during MP',
    description: 'Hospice intervention during the measurement period',
    valueSet: {
      oid: '2.16.840.1.113883.3.464.1003.1004',
      version: '20240101',
      name: 'Hospice Intervention',
    },
    timing: {
      operator: 'during',
      reference: 'Measurement Period',
      displayExpression: 'during Measurement Period',
    },
    negation: false,
    versionInfo: {
      versionId: '1.0',
      versionHistory: [
        {
          versionId: '1.0',
          status: 'approved',
          createdAt: '2024-01-15T10:00:00Z',
          createdBy: 'system',
          changeDescription: 'Initial version',
        },
      ],
      status: 'approved',
      approvedBy: 'admin',
      approvedAt: '2024-01-15T10:00:00Z',
    },
    usage: {
      measureIds: [],
      usageCount: 0,
    },
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      createdBy: 'system',
      updatedAt: '2024-01-15T10:00:00Z',
      updatedBy: 'system',
      category: 'exclusions',
      tags: ['hospice', 'exclusion', 'standard'],
      source: { origin: 'ecqi' },
    },
  },
  
  // Conditions with negation - Higher complexity
  {
    type: 'atomic',
    id: 'absence-of-cervix',
    name: 'Absence of Cervix',
    description: 'Patient has documented absence of cervix (congenital or surgical)',
    valueSet: {
      oid: '2.16.840.1.113883.3.464.1003.198.12.1014',
      version: '20240101',
      name: 'Absence of Cervix',
    },
    timing: {
      operator: 'starts before',
      position: 'before end of',
      reference: 'Measurement Period',
      displayExpression: 'starts before end of Measurement Period',
    },
    negation: true, // This is used as an exclusion - "absence of" concept
    versionInfo: {
      versionId: '1.0',
      versionHistory: [
        {
          versionId: '1.0',
          status: 'approved',
          createdAt: '2024-01-15T10:00:00Z',
          createdBy: 'system',
          changeDescription: 'Initial version',
        },
      ],
      status: 'approved',
      approvedBy: 'admin',
      approvedAt: '2024-01-15T10:00:00Z',
    },
    usage: {
      measureIds: [],
      usageCount: 0,
    },
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      createdBy: 'system',
      updatedAt: '2024-01-15T10:00:00Z',
      updatedBy: 'system',
      category: 'exclusions',
      tags: ['exclusion', 'anatomical'],
      source: { origin: 'ecqi', originalMeasureId: 'CMS125' },
    },
  },
];

// ============================================================================
// Sample Composite Components  
// ============================================================================

export const sampleComposites: Omit<CompositeComponent, 'complexity'>[] = [
  {
    type: 'composite',
    id: 'qualifying-encounter-cms130',
    name: 'Qualifying Encounter (Standard)',
    description: 'Standard eCQM qualifying encounter pattern used across multiple measures',
    operator: 'OR',
    children: [
      { componentId: 'office-visit-during-mp', versionId: '1.0', displayName: 'Office Visit during MP' },
      { componentId: 'home-healthcare-during-mp', versionId: '1.0', displayName: 'Home Healthcare Services during MP' },
      { componentId: 'preventive-care-during-mp', versionId: '1.0', displayName: 'Preventive Care Services during MP' },
      { componentId: 'annual-wellness-during-mp', versionId: '1.0', displayName: 'Annual Wellness Visit during MP' },
      { componentId: 'online-assessment-during-mp', versionId: '1.0', displayName: 'Online Assessment during MP' },
    ],
    versionInfo: {
      versionId: '1.0',
      versionHistory: [
        {
          versionId: '1.0',
          status: 'approved',
          createdAt: '2024-01-15T12:00:00Z',
          createdBy: 'system',
          changeDescription: 'Initial version',
        },
      ],
      status: 'approved',
      approvedBy: 'admin',
      approvedAt: '2024-01-15T12:00:00Z',
    },
    usage: {
      measureIds: [],
      usageCount: 0,
    },
    metadata: {
      createdAt: '2024-01-15T12:00:00Z',
      createdBy: 'system',
      updatedAt: '2024-01-15T12:00:00Z',
      updatedBy: 'system',
      category: 'encounters',
      tags: ['qualifying', 'standard', 'ecqm'],
      source: { origin: 'ecqi' },
    },
  },
  
  {
    type: 'composite',
    id: 'hospice-exclusion',
    name: 'Hospice Exclusion',
    description: 'Standard hospice exclusion pattern - encounter OR intervention during MP',
    operator: 'OR',
    children: [
      { componentId: 'hospice-encounter-during-mp', versionId: '1.0', displayName: 'Hospice Encounter during MP' },
      { componentId: 'hospice-intervention-during-mp', versionId: '1.0', displayName: 'Hospice Intervention during MP' },
    ],
    versionInfo: {
      versionId: '1.0',
      versionHistory: [
        {
          versionId: '1.0',
          status: 'approved',
          createdAt: '2024-01-15T12:00:00Z',
          createdBy: 'system',
          changeDescription: 'Initial version',
        },
      ],
      status: 'approved',
      approvedBy: 'admin',
      approvedAt: '2024-01-15T12:00:00Z',
    },
    usage: {
      measureIds: [],
      usageCount: 0,
    },
    metadata: {
      createdAt: '2024-01-15T12:00:00Z',
      createdBy: 'system',
      updatedAt: '2024-01-15T12:00:00Z',
      updatedBy: 'system',
      category: 'exclusions',
      tags: ['hospice', 'exclusion', 'standard'],
      source: { origin: 'ecqi' },
    },
  },
];

// ============================================================================
// Sample Library Structure
// ============================================================================

export const sampleCategories: CategoryGroup[] = [
  {
    category: 'demographics',
    displayName: 'Demographics',
    componentIds: ['age-45-75-at-start-mp'],
    sortOrder: 1,
  },
  {
    category: 'encounters',
    displayName: 'Encounters',
    componentIds: [
      'office-visit-during-mp',
      'home-healthcare-during-mp',
      'preventive-care-during-mp',
      'annual-wellness-during-mp',
      'online-assessment-during-mp',
      'qualifying-encounter-cms130',
    ],
    sortOrder: 2,
  },
  {
    category: 'procedures',
    displayName: 'Procedures',
    componentIds: ['colonoscopy-within-10-years'],
    sortOrder: 3,
  },
  {
    category: 'exclusions',
    displayName: 'Exclusions',
    componentIds: [
      'hospice-encounter-during-mp',
      'hospice-intervention-during-mp',
      'hospice-exclusion',
      'absence-of-cervix',
    ],
    sortOrder: 4,
  },
];

// ============================================================================
// Expected Complexity Scores (for testing)
// ============================================================================

export const expectedComplexityScores: Record<string, { score: number; level: string }> = {
  'office-visit-during-mp': { score: 2, level: 'low' },           // base(1) + timing(1)
  'home-healthcare-during-mp': { score: 2, level: 'low' },        // base(1) + timing(1)
  'colonoscopy-within-10-years': { score: 3, level: 'low' },      // base(1) + timing(2) - "within X before"
  'absence-of-cervix': { score: 5, level: 'medium' },             // base(1) + timing(2) + negation(2)
  'hospice-exclusion': { score: 4, level: 'medium' },             // 2 children * 2 each = 4
  'qualifying-encounter-cms130': { score: 10, level: 'high' },    // 5 children * 2 each = 10
};
