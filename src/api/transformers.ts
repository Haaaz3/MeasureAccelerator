/**
 * API Response Transformers
 *
 * Converts backend DTOs to frontend types.
 */

import type { MeasureDto, PopulationDto, LogicalClauseDto, DataElementDto, ValueSetDto } from './measures';
import type { ComponentDto, ComponentSummary } from './components';
import type {
  UniversalMeasureSpec,
  PopulationDefinition,
  LogicalClause,
  DataElement,
  ValueSetReference,
  ConfidenceLevel,
  ReviewStatus,
  MeasureStatus,
  PopulationType,
  LogicalOperator,
  DataElementType,
  MeasureType,
} from '../types/ums';
import type {
  LibraryComponent,
  AtomicComponent,
  CompositeComponent,
  ComponentCategory,
  ApprovalStatus,
  ComponentValueSet,
  TimingExpression,
  ComponentComplexity,
  ComponentVersionInfo,
  ComponentUsage,
  ComponentMetadata,
} from '../types/componentLibrary';

// ============================================================================
// Measure Transformers
// ============================================================================

function mapConfidence(confidence: string | null): ConfidenceLevel {
  if (confidence === 'HIGH' || confidence === 'high') return 'high';
  if (confidence === 'LOW' || confidence === 'low') return 'low';
  return 'medium';
}

function mapReviewStatus(status: string | null): ReviewStatus {
  if (status === 'APPROVED' || status === 'approved') return 'approved';
  if (status === 'FLAGGED' || status === 'flagged') return 'flagged';
  if (status === 'NEEDS_REVISION' || status === 'needs_revision') return 'needs_revision';
  return 'pending';
}

function mapMeasureStatus(status: string | null): MeasureStatus {
  if (status === 'PUBLISHED' || status === 'published') return 'published';
  return 'in_progress';
}

function mapPopulationType(type: string): PopulationType {
  const mapping: Record<string, PopulationType> = {
    'INITIAL_POPULATION': 'initial-population',
    'DENOMINATOR': 'denominator',
    'DENOMINATOR_EXCLUSION': 'denominator-exclusion',
    'DENOMINATOR_EXCEPTION': 'denominator-exception',
    'NUMERATOR': 'numerator',
    'NUMERATOR_EXCLUSION': 'numerator-exclusion',
  };
  return mapping[type] || 'initial-population';
}

function mapLogicalOperator(operator: string): LogicalOperator {
  if (operator === 'OR') return 'OR';
  if (operator === 'NOT') return 'NOT';
  return 'AND';
}

function mapElementType(type: string): DataElementType {
  const mapping: Record<string, DataElementType> = {
    'DIAGNOSIS': 'diagnosis',
    'ENCOUNTER': 'encounter',
    'PROCEDURE': 'procedure',
    'OBSERVATION': 'observation',
    'MEDICATION': 'medication',
    'DEMOGRAPHIC': 'demographic',
    'IMMUNIZATION': 'immunization',
    'DEVICE': 'device',
    'ASSESSMENT': 'assessment',
    'ALLERGY': 'allergy',
    'COMMUNICATION': 'communication',
    'GOAL': 'goal',
  };
  return mapping[type] || 'observation';
}

function mapMeasureType(type: string | null): MeasureType {
  if (type === 'outcome') return 'outcome';
  if (type === 'structure') return 'structure';
  if (type === 'patient_experience') return 'patient_experience';
  return 'process';
}

function mapProgram(program: string | null): 'MIPS_CQM' | 'eCQM' | 'HEDIS' | 'QOF' | 'Registry' | 'Custom' {
  if (program === 'MIPS_CQM' || program === 'MIPS') return 'MIPS_CQM';
  if (program === 'eCQM') return 'eCQM';
  if (program === 'HEDIS') return 'HEDIS';
  if (program === 'QOF') return 'QOF';
  if (program === 'Registry') return 'Registry';
  return 'Custom';
}

function mapComparator(comp: string | null | undefined): '>' | '>=' | '<' | '<=' | '=' | '!=' | undefined {
  if (comp === '>' || comp === '>=' || comp === '<' || comp === '<=' || comp === '=' || comp === '!=') {
    return comp;
  }
  return undefined;
}

function transformDataElement(dto: DataElementDto): DataElement {
  return {
    id: dto.id,
    type: mapElementType(dto.elementType),
    description: dto.description || '',
    libraryComponentId: dto.libraryComponentId || undefined,
    negation: dto.negation || false,
    negationRationale: dto.negationRationale || undefined,
    confidence: mapConfidence(dto.confidence),
    reviewStatus: mapReviewStatus(dto.reviewStatus),
    thresholds: dto.thresholds ? {
      ageMin: dto.thresholds.ageMin ?? undefined,
      ageMax: dto.thresholds.ageMax ?? undefined,
      valueMin: dto.thresholds.valueMin ?? undefined,
      valueMax: dto.thresholds.valueMax ?? undefined,
      comparator: mapComparator(dto.thresholds.comparator),
      unit: dto.thresholds.unit || undefined,
    } : undefined,
  };
}

function transformLogicalClause(dto: LogicalClauseDto): LogicalClause {
  // Transform children - they can be either LogicalClause or DataElement
  const children: (DataElement | LogicalClause)[] = [];

  // Add transformed data elements
  if (dto.dataElements) {
    children.push(...dto.dataElements.map(transformDataElement));
  }

  // Add transformed nested clauses
  if (dto.children) {
    children.push(...dto.children.map(transformLogicalClause));
  }

  return {
    id: dto.id,
    operator: mapLogicalOperator(dto.operator),
    description: dto.description || '',
    children,
    confidence: mapConfidence(null),
    reviewStatus: mapReviewStatus(null),
  };
}

function transformPopulation(dto: PopulationDto): PopulationDefinition {
  const defaultCriteria: LogicalClause = {
    id: `${dto.id}-criteria`,
    operator: 'AND',
    description: '',
    children: [],
    confidence: 'medium',
    reviewStatus: 'pending',
  };

  return {
    id: dto.id,
    type: mapPopulationType(dto.populationType),
    description: dto.description || '',
    narrative: dto.narrative || undefined,
    criteria: dto.rootClause ? transformLogicalClause(dto.rootClause) : defaultCriteria,
    confidence: mapConfidence(dto.confidence),
    reviewStatus: mapReviewStatus(dto.reviewStatus),
    reviewNotes: dto.reviewNotes || undefined,
    cqlDefinition: dto.cqlDefinition || undefined,
    cqlDefinitionName: dto.cqlDefinitionName || undefined,
  };
}

function transformValueSet(dto: ValueSetDto): ValueSetReference {
  return {
    id: dto.id,
    oid: dto.oid || undefined,
    url: dto.url || undefined,
    name: dto.name,
    version: dto.version || undefined,
    publisher: dto.publisher || undefined,
    purpose: dto.purpose || undefined,
    confidence: mapConfidence(dto.confidence),
    verified: dto.verified,
    source: dto.source || undefined,
    codes: dto.codes?.map(c => ({
      code: c.code,
      display: c.display || '',
      system: c.system as any || 'SNOMED',
    })) || [],
  };
}

export function transformMeasureDto(dto: MeasureDto): UniversalMeasureSpec {
  // Count review progress from populations
  let total = 0, approved = 0, pending = 0, flagged = 0;
  const countStatus = (clause: LogicalClauseDto | null) => {
    if (!clause) return;
    clause.dataElements?.forEach(de => {
      total++;
      const status = mapReviewStatus(de.reviewStatus);
      if (status === 'approved') approved++;
      else if (status === 'pending') pending++;
      else if (status === 'flagged' || status === 'needs_revision') flagged++;
    });
    clause.children?.forEach(countStatus);
  };
  dto.populations?.forEach(p => countStatus(p.rootClause));

  return {
    id: dto.id,
    resourceType: 'Measure',
    metadata: {
      measureId: dto.measureId,
      title: dto.title,
      version: dto.version || '1.0.0',
      steward: dto.steward || 'Unknown',
      program: mapProgram(dto.program),
      measureType: mapMeasureType(dto.measureType),
      description: dto.description || '',
      rationale: dto.rationale || undefined,
      clinicalRecommendation: dto.clinicalRecommendation || undefined,
      measurementPeriod: {
        start: dto.periodStart || new Date().getFullYear() + '-01-01',
        end: dto.periodEnd || new Date().getFullYear() + '-12-31',
        inclusive: true,
      },
      lastUpdated: dto.updatedAt || new Date().toISOString(),
    },
    populations: dto.populations?.map(transformPopulation) || [],
    valueSets: dto.valueSets?.map(transformValueSet) || [],
    globalConstraints: dto.globalConstraints ? {
      ageRange: (dto.globalConstraints.ageMin != null || dto.globalConstraints.ageMax != null) ? {
        min: dto.globalConstraints.ageMin ?? 0,
        max: dto.globalConstraints.ageMax ?? 150,
      } : undefined,
      gender: dto.globalConstraints.gender as 'male' | 'female' | 'all' | undefined,
    } : undefined,
    status: mapMeasureStatus(dto.status),
    overallConfidence: mapConfidence(dto.overallConfidence),
    reviewProgress: { total, approved, pending, flagged },
    createdAt: dto.createdAt || new Date().toISOString(),
    updatedAt: dto.updatedAt || new Date().toISOString(),
    createdBy: dto.createdBy || undefined,
    lockedAt: dto.lockedAt || undefined,
    lockedBy: dto.lockedBy || undefined,
    generatedCql: dto.generatedCql || undefined,
    generatedSql: dto.generatedSql || undefined,
    corrections: dto.corrections?.map(c => ({
      id: c.id,
      timestamp: c.timestamp,
      correctionType: c.correctionType as any,
      componentId: c.field || '',
      componentPath: c.field || '',
      originalValue: c.oldValue,
      correctedValue: c.newValue,
      userNotes: c.description || undefined,
      measureContext: {
        measureId: dto.measureId,
        measureType: dto.measureType || 'process',
        program: dto.program || '',
      },
    })) || [],
  };
}

// ============================================================================
// Component Transformers
// ============================================================================

function mapComponentCategory(category: string | null | undefined): ComponentCategory {
  if (!category) {
    console.warn('[transformers] Component has null/undefined category, defaulting to clinical-observations');
    return 'clinical-observations';
  }
  const mapping: Record<string, ComponentCategory> = {
    'DEMOGRAPHICS': 'demographics',
    'demographics': 'demographics',
    'CONDITIONS': 'conditions',
    'conditions': 'conditions',
    'ENCOUNTERS': 'encounters',
    'encounters': 'encounters',
    'PROCEDURES': 'procedures',
    'procedures': 'procedures',
    'MEDICATIONS': 'medications',
    'medications': 'medications',
    'OBSERVATIONS': 'clinical-observations',
    'observations': 'clinical-observations',
    'IMMUNIZATIONS': 'medications',
    'immunizations': 'medications',
    'ASSESSMENTS': 'assessments',
    'assessments': 'assessments',
    'CLINICAL_OBSERVATIONS': 'clinical-observations',
    'clinical-observations': 'clinical-observations',
    'EXCLUSIONS': 'exclusions',
    'exclusions': 'exclusions',
    'LABORATORY': 'laboratory',
    'laboratory': 'laboratory',
  };
  const mapped = mapping[category];
  if (!mapped) {
    console.warn(`[transformers] Unknown category "${category}", defaulting to clinical-observations`);
    return 'clinical-observations';
  }
  return mapped;
}

function mapApprovalStatus(status: string): ApprovalStatus {
  if (status === 'APPROVED' || status === 'approved') return 'approved';
  if (status === 'ARCHIVED' || status === 'archived') return 'archived';
  if (status === 'PENDING_REVIEW' || status === 'pending_review') return 'pending_review';
  return 'draft';
}

function createDefaultValueSet(): ComponentValueSet {
  return {
    oid: '',
    version: '',
    name: 'Unknown',
    codes: [],
  };
}

function createDefaultTiming(): TimingExpression {
  return {
    operator: 'during',
    reference: 'Measurement Period',
    displayExpression: 'during Measurement Period',
  };
}

function createDefaultComplexity(): ComponentComplexity {
  return {
    level: 'LOW',
    score: 1,
    factors: [],
  };
}

function createDefaultVersionInfo(status: ApprovalStatus): ComponentVersionInfo {
  const now = new Date().toISOString();
  return {
    versionId: '1.0',
    versionHistory: [{
      versionId: '1.0',
      status,
      createdAt: now,
      createdBy: 'system',
      changeDescription: 'Initial version',
    }],
    status,
  };
}

function createDefaultUsage(): ComponentUsage {
  return {
    measureIds: [],
    usageCount: 0,
  };
}

function createDefaultMetadata(category: ComponentCategory): ComponentMetadata {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    createdBy: 'system',
    updatedAt: now,
    updatedBy: 'system',
    category,
    tags: [],
    source: { origin: 'ecqi' },
  };
}

export function transformComponentSummary(dto: ComponentSummary): LibraryComponent {
  const category = mapComponentCategory(dto.category);
  const status = mapApprovalStatus(dto.status);

  // Map complexity level from backend
  const complexityLevel = dto.complexityLevel?.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | undefined;
  const complexity: ComponentComplexity = {
    level: complexityLevel || 'LOW',
    score: complexityLevel === 'HIGH' ? 5 : complexityLevel === 'MEDIUM' ? 3 : 1,
    factors: [],
  };

  const atomic: AtomicComponent = {
    type: 'atomic',
    id: dto.id,
    name: dto.name,
    description: dto.description || '',
    valueSet: createDefaultValueSet(),
    timing: createDefaultTiming(),
    negation: false,
    complexity,
    versionInfo: createDefaultVersionInfo(status),
    usage: {
      measureIds: [],
      usageCount: dto.usageCount || 0,
      lastUsedAt: dto.updatedAt || undefined,
    },
    metadata: createDefaultMetadata(category),
  };

  return atomic;
}

export function transformComponentDto(dto: ComponentDto): LibraryComponent {
  const category = mapComponentCategory(dto.metadata?.category);
  const status = mapApprovalStatus(dto.versionInfo?.status);
  const now = new Date().toISOString();

  const versionInfo: ComponentVersionInfo = {
    versionId: dto.versionInfo?.versionId || '1.0',
    versionHistory: dto.versionInfo?.versionHistory?.map(h => ({
      versionId: h.versionId,
      status: mapApprovalStatus(h.status),
      createdAt: h.createdAt,
      createdBy: h.createdBy,
      changeDescription: h.changeDescription,
    })) || [{
      versionId: dto.versionInfo?.versionId || '1.0',
      status,
      createdAt: dto.createdAt || now,
      createdBy: dto.createdBy || 'system',
      changeDescription: 'Initial version',
    }],
    status,
    approvedBy: dto.versionInfo?.approvedBy || undefined,
    approvedAt: dto.versionInfo?.approvedAt || undefined,
  };

  const usage: ComponentUsage = {
    measureIds: dto.usage?.measureIds || [],
    usageCount: dto.usage?.usageCount || 0,
    lastUsedAt: dto.usage?.lastUsedAt || undefined,
  };

  const metadata: ComponentMetadata = {
    createdAt: dto.createdAt || now,
    createdBy: dto.createdBy || 'system',
    updatedAt: dto.updatedAt || now,
    updatedBy: dto.updatedBy || 'system',
    category,
    tags: dto.metadata?.tags || [],
    source: { origin: 'ecqi' },
  };

  const complexity: ComponentComplexity = dto.complexity ? {
    level: (dto.complexity.level as 'LOW' | 'MEDIUM' | 'HIGH') || 'LOW',
    score: dto.complexity.score || 1,
    factors: dto.complexity.factors || [],
  } : createDefaultComplexity();

  if (dto.type === 'composite') {
    const composite: CompositeComponent = {
      type: 'composite',
      id: dto.id,
      name: dto.name,
      description: dto.description || '',
      operator: 'AND',
      childRefs: dto.childComponents?.map(c => ({
        componentId: c.id,
        versionId: '1.0',
        displayName: c.name,
      })) || [],
      complexity,
      versionInfo,
      usage,
      metadata,
    };
    return composite;
  }

  const valueSet: ComponentValueSet = dto.valueSet ? {
    oid: dto.valueSet.oid || '',
    version: '',
    name: dto.valueSet.name || 'Unknown',
    codes: dto.valueSet.codes?.map(c => ({
      code: c.code,
      display: c.display,
      system: c.system as any,
    })) || [],
  } : createDefaultValueSet();

  const timing: TimingExpression = dto.timing ? {
    operator: (dto.timing.type as any) || 'during',
    quantity: dto.timing.duration || undefined,
    unit: dto.timing.unit as any || undefined,
    reference: 'Measurement Period',
    displayExpression: `${dto.timing.type || 'during'} Measurement Period`,
  } : createDefaultTiming();

  const atomic: AtomicComponent = {
    type: 'atomic',
    id: dto.id,
    name: dto.name,
    description: dto.description || '',
    valueSet,
    timing,
    negation: false,
    complexity,
    versionInfo,
    usage,
    metadata,
  };

  return atomic;
}
