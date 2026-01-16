/**
 * CriteriaBlockBuilder - Advanced clinical criteria builder
 *
 * Supports complex CQL-aligned logic for measures like:
 * - Diabetes measures: diagnosis with timing, lab values with thresholds
 * - Childhood Immunizations (CIS): multiple vaccines with quantity requirements
 * - Any FHIR/QI-Core based quality measure
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Syringe,
  Stethoscope,
  Activity,
  Pill,
  User,
  Calendar,
  Hash,
  Code,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { ValueSetReference, DataElementType, ConfidenceLevel, CodeReference } from '../../types/ums';

// ============================================================================
// Types for Enhanced Criteria Building
// ============================================================================

export type LogicOperator = 'AND' | 'OR' | 'NOT';

export type QuantityComparator = '>=' | '>' | '<=' | '<' | '=' | 'between';

export type TimingType =
  | 'during_measurement_period'
  | 'before_measurement_period'
  | 'by_age'
  | 'within_days_of'
  | 'within_months_of'
  | 'within_years_of'
  | 'anytime';

export interface QuantityRequirement {
  comparator: QuantityComparator;
  value: number;
  maxValue?: number; // For 'between' comparator
}

export interface TimingConstraint {
  type: TimingType;
  value?: number;
  unit?: 'days' | 'months' | 'years';
  ageValue?: number;
  ageUnit?: 'days' | 'months' | 'years';
  relativeTo?: string;
}

export interface CriteriaBlock {
  id: string;
  type: 'criterion' | 'group';

  // For type === 'criterion'
  resourceType?: DataElementType;
  description?: string;
  valueSet?: ValueSetReference | null;
  valueSetId?: string; // Reference by ID
  directCodes?: CodeReference[];
  quantity?: QuantityRequirement;
  timing?: TimingConstraint;
  negation?: boolean; // Check for ABSENCE

  // For type === 'group'
  operator?: LogicOperator;
  children?: CriteriaBlock[];

  // Metadata
  confidence?: ConfidenceLevel;
  cqlPreview?: string;
}

// FHIR/QI-Core resource type configuration
const RESOURCE_TYPE_CONFIG: Record<DataElementType, {
  label: string;
  icon: typeof Syringe;
  color: string;
  cqlResource: string;
  examples: string[];
}> = {
  immunization: {
    label: 'Immunization',
    icon: Syringe,
    color: 'emerald',
    cqlResource: 'Immunization',
    examples: ['DTaP vaccine', 'MMR vaccine', 'Flu shot'],
  },
  diagnosis: {
    label: 'Diagnosis/Condition',
    icon: Stethoscope,
    color: 'rose',
    cqlResource: 'Condition',
    examples: ['Diabetes', 'Hypertension', 'COPD'],
  },
  procedure: {
    label: 'Procedure',
    icon: Activity,
    color: 'blue',
    cqlResource: 'Procedure',
    examples: ['Colonoscopy', 'Mammogram', 'A1C test'],
  },
  observation: {
    label: 'Observation/Lab',
    icon: Activity,
    color: 'purple',
    cqlResource: 'Observation',
    examples: ['HbA1c result', 'Blood pressure', 'BMI'],
  },
  medication: {
    label: 'Medication',
    icon: Pill,
    color: 'amber',
    cqlResource: 'MedicationRequest',
    examples: ['Statin therapy', 'ACE inhibitor', 'Insulin'],
  },
  encounter: {
    label: 'Encounter/Visit',
    icon: User,
    color: 'cyan',
    cqlResource: 'Encounter',
    examples: ['Office visit', 'Telehealth', 'Annual wellness'],
  },
  demographic: {
    label: 'Patient Demographics',
    icon: User,
    color: 'slate',
    cqlResource: 'Patient',
    examples: ['Age', 'Gender', 'Race'],
  },
  assessment: {
    label: 'Assessment',
    icon: Activity,
    color: 'indigo',
    cqlResource: 'Observation',
    examples: ['Depression screening', 'Fall risk', 'Pain scale'],
  },
  device: {
    label: 'Device',
    icon: Activity,
    color: 'orange',
    cqlResource: 'DeviceRequest',
    examples: ['CPAP', 'Insulin pump'],
  },
  communication: {
    label: 'Communication',
    icon: Activity,
    color: 'teal',
    cqlResource: 'Communication',
    examples: ['Patient education', 'Care instructions'],
  },
  allergy: {
    label: 'Allergy',
    icon: AlertCircle,
    color: 'red',
    cqlResource: 'AllergyIntolerance',
    examples: ['Drug allergy', 'Food allergy'],
  },
  goal: {
    label: 'Goal',
    icon: Activity,
    color: 'green',
    cqlResource: 'Goal',
    examples: ['Weight goal', 'BP goal'],
  },
};

// ============================================================================
// Component Props
// ============================================================================

interface CriteriaBlockBuilderProps {
  criteria: CriteriaBlock[];
  onChange: (criteria: CriteriaBlock[]) => void;
  availableValueSets: { valueSet: ValueSetReference; sourceMeasure: string }[];
  showCqlPreview?: boolean;
  populationContext?: string; // e.g., 'numerator', 'denominator'
  /** Callback when CQL is generated - called whenever criteria change */
  onCqlGenerated?: (cql: string) => void;
}

interface CriteriaBlockItemProps {
  block: CriteriaBlock;
  depth: number;
  onUpdate: (block: CriteriaBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  availableValueSets: { valueSet: ValueSetReference; sourceMeasure: string }[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `cb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createEmptyCriterion(): CriteriaBlock {
  return {
    id: generateId(),
    type: 'criterion',
    resourceType: 'procedure',
    description: '',
    timing: { type: 'during_measurement_period' },
    confidence: 'medium',
  };
}

function createLogicGroup(operator: LogicOperator = 'AND'): CriteriaBlock {
  return {
    id: generateId(),
    type: 'group',
    operator,
    children: [],
    confidence: 'medium',
  };
}

function generateCqlPreview(block: CriteriaBlock, valueSets: Map<string, ValueSetReference>): string {
  if (block.type === 'group') {
    if (!block.children || block.children.length === 0) return '';
    const childCql = block.children
      .map(c => generateCqlPreview(c, valueSets))
      .filter(Boolean);
    if (childCql.length === 0) return '';
    if (block.operator === 'NOT') {
      return `not (${childCql[0]})`;
    }
    return `(${childCql.join(`\n  ${block.operator?.toLowerCase()} `)})`;
  }

  // Criterion
  const config = block.resourceType ? RESOURCE_TYPE_CONFIG[block.resourceType] : null;
  if (!config) return '';

  const resource = config.cqlResource;
  let cql = '';

  // Get value set reference
  const vsName = block.valueSet?.name || block.valueSetId
    ? valueSets.get(block.valueSetId || '')?.name || 'ValueSet'
    : null;

  if (vsName) {
    cql = `[${resource}: "${vsName}"]`;
  } else if (block.description) {
    cql = `[${resource}] // ${block.description}`;
  } else {
    cql = `[${resource}]`;
  }

  // Add timing
  if (block.timing) {
    switch (block.timing.type) {
      case 'during_measurement_period':
        cql += `\n  where ${resource.toLowerCase()}.performed during "Measurement Period"`;
        break;
      case 'by_age':
        if (block.timing.ageValue && block.timing.ageUnit) {
          cql += `\n  where AgeInYearsAt(${resource.toLowerCase()}.performed) <= ${block.timing.ageValue}`;
        }
        break;
      case 'within_days_of':
      case 'within_months_of':
      case 'within_years_of':
        if (block.timing.value && block.timing.relativeTo) {
          const unit = block.timing.type.replace('within_', '').replace('_of', '');
          cql += `\n  where ${resource.toLowerCase()}.performed ${block.timing.value} ${unit} or less before ${block.timing.relativeTo}`;
        }
        break;
    }
  }

  // Add quantity
  if (block.quantity) {
    const countExpr = `Count(${cql})`;
    switch (block.quantity.comparator) {
      case '>=':
        cql = `${countExpr} >= ${block.quantity.value}`;
        break;
      case '>':
        cql = `${countExpr} > ${block.quantity.value}`;
        break;
      case '<=':
        cql = `${countExpr} <= ${block.quantity.value}`;
        break;
      case '<':
        cql = `${countExpr} < ${block.quantity.value}`;
        break;
      case '=':
        cql = `${countExpr} = ${block.quantity.value}`;
        break;
      case 'between':
        cql = `${countExpr} >= ${block.quantity.value} and ${countExpr} <= ${block.quantity.maxValue || block.quantity.value}`;
        break;
    }
  } else {
    cql = `exists (${cql})`;
  }

  // Negation
  if (block.negation) {
    cql = `not ${cql}`;
  }

  return cql;
}

// ============================================================================
// Sub-Components
// ============================================================================

function ResourceTypeSelector({
  value,
  onChange,
}: {
  value?: DataElementType;
  onChange: (type: DataElementType) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const config = value ? RESOURCE_TYPE_CONFIG[value] : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
          config
            ? `border-${config.color}-500/40 bg-${config.color}-500/10 text-${config.color}-400`
            : 'border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-muted)]'
        }`}
      >
        {config && <config.icon className="w-4 h-4" />}
        <span>{config?.label || 'Select resource type'}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-64 bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-xl z-20 max-h-80 overflow-auto">
            {Object.entries(RESOURCE_TYPE_CONFIG).map(([type, cfg]) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onChange(type as DataElementType);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--bg-secondary)] transition-colors ${
                  value === type ? 'bg-[var(--bg-secondary)]' : ''
                }`}
              >
                <cfg.icon className={`w-4 h-4 text-${cfg.color}-400`} />
                <div className="flex-1">
                  <div className="text-sm text-[var(--text)]">{cfg.label}</div>
                  <div className="text-xs text-[var(--text-dim)]">{cfg.examples[0]}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function QuantitySelector({
  value,
  onChange,
}: {
  value?: QuantityRequirement;
  onChange: (quantity: QuantityRequirement | undefined) => void;
}) {
  const [enabled, setEnabled] = useState(!!value);

  const handleToggle = () => {
    if (enabled) {
      onChange(undefined);
      setEnabled(false);
    } else {
      onChange({ comparator: '>=', value: 1 });
      setEnabled(true);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            enabled
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border)]'
          }`}
        >
          <Hash className="w-3 h-3" />
          Quantity Required
        </button>
      </div>

      {enabled && value && (
        <div className="flex items-center gap-2 pl-4">
          <select
            value={value.comparator}
            onChange={(e) => onChange({ ...value, comparator: e.target.value as QuantityComparator })}
            className="px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm text-[var(--text)]"
          >
            <option value=">=">At least</option>
            <option value=">">More than</option>
            <option value="=">Exactly</option>
            <option value="<=">At most</option>
            <option value="<">Less than</option>
            <option value="between">Between</option>
          </select>
          <input
            type="number"
            min={0}
            value={value.value}
            onChange={(e) => onChange({ ...value, value: parseInt(e.target.value) || 0 })}
            className="w-16 px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm text-[var(--text)] text-center"
          />
          {value.comparator === 'between' && (
            <>
              <span className="text-[var(--text-muted)] text-sm">and</span>
              <input
                type="number"
                min={value.value}
                value={value.maxValue || value.value}
                onChange={(e) => onChange({ ...value, maxValue: parseInt(e.target.value) || value.value })}
                className="w-16 px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm text-[var(--text)] text-center"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TimingSelector({
  value,
  onChange,
}: {
  value?: TimingConstraint;
  onChange: (timing: TimingConstraint) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Calendar className="w-3 h-3 text-cyan-400" />
        <span className="text-xs font-medium text-[var(--text-muted)]">Timing</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={value?.type || 'during_measurement_period'}
          onChange={(e) => onChange({ ...value, type: e.target.value as TimingType })}
          className="px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm text-[var(--text)]"
        >
          <option value="during_measurement_period">During Measurement Period</option>
          <option value="before_measurement_period">Before Measurement Period</option>
          <option value="by_age">By Age</option>
          <option value="within_days_of">Within X Days</option>
          <option value="within_months_of">Within X Months</option>
          <option value="within_years_of">Within X Years</option>
          <option value="anytime">Anytime (historical)</option>
        </select>

        {value?.type === 'by_age' && (
          <div className="flex items-center gap-1">
            <span className="text-sm text-[var(--text-muted)]">by</span>
            <input
              type="number"
              min={0}
              value={value.ageValue || 2}
              onChange={(e) => onChange({ ...value, ageValue: parseInt(e.target.value) || 0 })}
              className="w-14 px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm text-[var(--text)] text-center"
            />
            <select
              value={value.ageUnit || 'years'}
              onChange={(e) => onChange({ ...value, ageUnit: e.target.value as 'days' | 'months' | 'years' })}
              className="px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm text-[var(--text)]"
            >
              <option value="days">days old</option>
              <option value="months">months old</option>
              <option value="years">years old</option>
            </select>
          </div>
        )}

        {(value?.type === 'within_days_of' || value?.type === 'within_months_of' || value?.type === 'within_years_of') && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              value={value.value || 1}
              onChange={(e) => onChange({ ...value, value: parseInt(e.target.value) || 1 })}
              className="w-14 px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm text-[var(--text)] text-center"
            />
            <span className="text-sm text-[var(--text-muted)]">
              {value.type.replace('within_', '').replace('_of', '')} of
            </span>
            <input
              type="text"
              value={value.relativeTo || ''}
              onChange={(e) => onChange({ ...value, relativeTo: e.target.value })}
              placeholder="e.g., encounter date"
              className="w-32 px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm text-[var(--text)]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ValueSetSelector({
  value,
  onChange,
  availableValueSets,
  resourceType,
}: {
  value?: string;
  onChange: (vsId: string | undefined) => void;
  availableValueSets: { valueSet: ValueSetReference; sourceMeasure: string }[];
  resourceType?: DataElementType;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Filter value sets by resource type category
  const filteredValueSets = useMemo(() => {
    let vsList = availableValueSets;

    // Filter by search term
    if (search) {
      const s = search.toLowerCase();
      vsList = vsList.filter(v =>
        v.valueSet.name.toLowerCase().includes(s) ||
        v.valueSet.oid?.toLowerCase().includes(s)
      );
    }

    return vsList.slice(0, 20);
  }, [availableValueSets, search]);

  const selectedVs = value
    ? availableValueSets.find(v => (v.valueSet.oid || v.valueSet.id) === value)
    : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-all ${
          selectedVs
            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
            : 'border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-muted)]'
        }`}
      >
        <Code className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 truncate">
          {selectedVs?.valueSet.name || 'Select value set...'}
        </span>
        <ChevronDown className="w-4 h-4 flex-shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-xl z-20 max-h-64 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-[var(--border)]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search value sets..."
                className="w-full px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm text-[var(--text)] placeholder-[var(--text-dim)]"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-auto">
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] border-b border-[var(--border)]"
              >
                (No value set - describe in text)
              </button>
              {filteredValueSets.map(({ valueSet, sourceMeasure }) => (
                <button
                  key={valueSet.oid || valueSet.id}
                  type="button"
                  onClick={() => {
                    onChange(valueSet.oid || valueSet.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-[var(--bg-secondary)] transition-colors ${
                    value === (valueSet.oid || valueSet.id) ? 'bg-cyan-500/10' : ''
                  }`}
                >
                  <div className="text-sm text-[var(--text)] truncate">{valueSet.name}</div>
                  <div className="text-xs text-[var(--text-dim)] flex items-center gap-2">
                    {valueSet.oid && <span className="font-mono">{valueSet.oid}</span>}
                    <span>·</span>
                    <span>{valueSet.codes?.length || 0} codes</span>
                    <span>·</span>
                    <span>{sourceMeasure}</span>
                  </div>
                </button>
              ))}
              {filteredValueSets.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-[var(--text-dim)]">
                  No value sets found
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CriteriaBlockItem({
  block,
  depth,
  onUpdate,
  onDelete,
  onDuplicate,
  availableValueSets,
}: CriteriaBlockItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const config = block.resourceType ? RESOURCE_TYPE_CONFIG[block.resourceType] : null;

  const handleAddChild = (type: 'criterion' | 'group') => {
    if (block.type !== 'group') return;
    const newChild = type === 'criterion' ? createEmptyCriterion() : createLogicGroup();
    onUpdate({
      ...block,
      children: [...(block.children || []), newChild],
    });
  };

  const handleUpdateChild = (index: number, child: CriteriaBlock) => {
    if (block.type !== 'group' || !block.children) return;
    const newChildren = [...block.children];
    newChildren[index] = child;
    onUpdate({ ...block, children: newChildren });
  };

  const handleDeleteChild = (index: number) => {
    if (block.type !== 'group' || !block.children) return;
    onUpdate({
      ...block,
      children: block.children.filter((_, i) => i !== index),
    });
  };

  const handleDuplicateChild = (index: number) => {
    if (block.type !== 'group' || !block.children) return;
    const child = block.children[index];
    const duplicated = JSON.parse(JSON.stringify(child));
    duplicated.id = generateId();
    onUpdate({
      ...block,
      children: [...block.children.slice(0, index + 1), duplicated, ...block.children.slice(index + 1)],
    });
  };

  // Render Logic Group
  if (block.type === 'group') {
    return (
      <div
        className={`border rounded-lg transition-all ${
          block.operator === 'AND'
            ? 'border-blue-500/30 bg-blue-500/5'
            : block.operator === 'OR'
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-rose-500/30 bg-rose-500/5'
        }`}
        style={{ marginLeft: depth > 0 ? '1rem' : 0 }}
      >
        {/* Group Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]/50">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            )}
          </button>

          <select
            value={block.operator}
            onChange={(e) => onUpdate({ ...block, operator: e.target.value as LogicOperator })}
            className={`px-2 py-1 rounded text-xs font-bold ${
              block.operator === 'AND'
                ? 'bg-blue-500/20 text-blue-400'
                : block.operator === 'OR'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            <option value="AND">ALL of (AND)</option>
            <option value="OR">ANY of (OR)</option>
            <option value="NOT">NONE of (NOT)</option>
          </select>

          <span className="text-xs text-[var(--text-dim)]">
            {block.children?.length || 0} items
          </span>

          <div className="flex-1" />

          <button
            type="button"
            onClick={onDuplicate}
            className="p-1 text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)] rounded"
            title="Duplicate group"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-[var(--text-dim)] hover:text-rose-400 hover:bg-rose-500/10 rounded"
            title="Delete group"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Group Children */}
        {isExpanded && (
          <div className="p-3 space-y-2">
            {block.children?.map((child, index) => (
              <CriteriaBlockItem
                key={child.id}
                block={child}
                depth={depth + 1}
                onUpdate={(updated) => handleUpdateChild(index, updated)}
                onDelete={() => handleDeleteChild(index)}
                onDuplicate={() => handleDuplicateChild(index)}
                availableValueSets={availableValueSets}
              />
            ))}

            {/* Add buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleAddChild('criterion')}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/30 rounded-lg transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Criterion
              </button>
              <button
                type="button"
                onClick={() => handleAddChild('group')}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-400 hover:bg-purple-500/10 border border-purple-500/30 rounded-lg transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Logic Group
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Criterion
  return (
    <div
      className={`border rounded-lg bg-[var(--bg-secondary)] overflow-hidden ${
        config ? `border-${config.color}-500/30` : 'border-[var(--border)]'
      }`}
      style={{ marginLeft: depth > 0 ? '1rem' : 0 }}
    >
      {/* Criterion Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-tertiary)]/50">
        <GripVertical className="w-4 h-4 text-[var(--text-dim)] cursor-grab" />

        <ResourceTypeSelector
          value={block.resourceType}
          onChange={(type) => onUpdate({ ...block, resourceType: type })}
        />

        <div className="flex-1" />

        {/* Negation toggle */}
        <button
          type="button"
          onClick={() => onUpdate({ ...block, negation: !block.negation })}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            block.negation
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              : 'text-[var(--text-dim)] hover:bg-[var(--bg-tertiary)]'
          }`}
          title="Toggle negation (check for ABSENCE)"
        >
          {block.negation ? 'NOT' : 'not'}
        </button>

        <button
          type="button"
          onClick={onDuplicate}
          className="p-1 text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)] rounded"
          title="Duplicate"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 text-[var(--text-dim)] hover:text-rose-400 hover:bg-rose-500/10 rounded"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Criterion Body */}
      <div className="p-3 space-y-3">
        {/* Value Set */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
            Value Set
          </label>
          <ValueSetSelector
            value={block.valueSetId}
            onChange={(vsId) => onUpdate({ ...block, valueSetId: vsId })}
            availableValueSets={availableValueSets}
            resourceType={block.resourceType}
          />
        </div>

        {/* Description (if no value set) */}
        {!block.valueSetId && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Description
            </label>
            <input
              type="text"
              value={block.description || ''}
              onChange={(e) => onUpdate({ ...block, description: e.target.value })}
              placeholder="Describe the clinical criteria..."
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder-[var(--text-dim)]"
            />
          </div>
        )}

        {/* Quantity */}
        <QuantitySelector
          value={block.quantity}
          onChange={(quantity) => onUpdate({ ...block, quantity })}
        />

        {/* Timing */}
        <TimingSelector
          value={block.timing}
          onChange={(timing) => onUpdate({ ...block, timing })}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CriteriaBlockBuilder({
  criteria,
  onChange,
  availableValueSets,
  showCqlPreview = true,
  populationContext,
  onCqlGenerated,
}: CriteriaBlockBuilderProps) {
  const [cqlVisible, setCqlVisible] = useState(showCqlPreview);

  // Create value set map for CQL generation
  const valueSetMap = useMemo(() => {
    const map = new Map<string, ValueSetReference>();
    availableValueSets.forEach(({ valueSet }) => {
      const key = valueSet.oid || valueSet.id;
      map.set(key, valueSet);
    });
    return map;
  }, [availableValueSets]);

  const handleAddRoot = (type: 'criterion' | 'group') => {
    const newBlock = type === 'criterion' ? createEmptyCriterion() : createLogicGroup();
    onChange([...criteria, newBlock]);
  };

  const handleUpdateBlock = (index: number, block: CriteriaBlock) => {
    const newCriteria = [...criteria];
    newCriteria[index] = block;
    onChange(newCriteria);
  };

  const handleDeleteBlock = (index: number) => {
    onChange(criteria.filter((_, i) => i !== index));
  };

  const handleDuplicateBlock = (index: number) => {
    const block = criteria[index];
    const duplicated = JSON.parse(JSON.stringify(block));
    duplicated.id = generateId();
    onChange([...criteria.slice(0, index + 1), duplicated, ...criteria.slice(index + 1)]);
  };

  // Generate CQL preview
  const cqlPreview = useMemo(() => {
    if (criteria.length === 0) return '';

    const lines = criteria.map(block => generateCqlPreview(block, valueSetMap));
    return lines.filter(Boolean).join('\n  and ');
  }, [criteria, valueSetMap]);

  // Notify parent when CQL is generated
  useEffect(() => {
    if (onCqlGenerated) {
      onCqlGenerated(cqlPreview);
    }
  }, [cqlPreview, onCqlGenerated]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-[var(--text)]">
          Criteria Logic Builder
          {populationContext && (
            <span className="text-[var(--text-muted)] ml-2">({populationContext})</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCqlVisible(!cqlVisible)}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            cqlVisible
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          {cqlVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          CQL Preview
        </button>
      </div>

      {/* Criteria Blocks */}
      <div className="space-y-3">
        {criteria.map((block, index) => (
          <CriteriaBlockItem
            key={block.id}
            block={block}
            depth={0}
            onUpdate={(updated) => handleUpdateBlock(index, updated)}
            onDelete={() => handleDeleteBlock(index)}
            onDuplicate={() => handleDuplicateBlock(index)}
            availableValueSets={availableValueSets}
          />
        ))}

        {criteria.length === 0 && (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <p className="text-sm mb-4">No criteria defined yet</p>
          </div>
        )}

        {/* Add buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => handleAddRoot('criterion')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/30 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Criterion
          </button>
          <button
            type="button"
            onClick={() => handleAddRoot('group')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-400 hover:bg-purple-500/10 border border-purple-500/30 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Logic Group
          </button>
        </div>
      </div>

      {/* CQL Preview */}
      {cqlVisible && cqlPreview && (
        <div className="mt-4 p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]">
          <div className="flex items-center gap-2 mb-2">
            <Code className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">CQL Preview</span>
          </div>
          <pre className="text-xs text-[var(--text-muted)] font-mono whitespace-pre-wrap overflow-x-auto">
            {cqlPreview}
          </pre>
        </div>
      )}
    </div>
  );
}

export default CriteriaBlockBuilder;
