import { useState } from 'react';
import { X, Plus, Trash2, Clock, FileText, Stethoscope, Calendar, Pill, Users, ClipboardCheck } from 'lucide-react';
import type { DataElement, ValueSetReference, TimingRequirement, ConfidenceLevel, CodeSystem } from '../../types/ums';

interface ComponentBuilderProps {
  measureId?: string;
  populationId?: string;
  populationType: string;
  existingValueSets: ValueSetReference[];
  onSave: (component: DataElement, newValueSet?: ValueSetReference, logicOperator?: 'AND' | 'OR') => void;
  onClose: () => void;
}

type ComponentType = DataElement['type'];

const COMPONENT_TYPES: { value: ComponentType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'diagnosis', label: 'Diagnosis', icon: <Stethoscope className="w-4 h-4" />, description: 'Medical condition or disease (ICD-10, SNOMED)' },
  { value: 'encounter', label: 'Encounter', icon: <Calendar className="w-4 h-4" />, description: 'Patient visit or healthcare interaction (CPT, HCPCS)' },
  { value: 'procedure', label: 'Procedure', icon: <ClipboardCheck className="w-4 h-4" />, description: 'Medical procedure performed (CPT, HCPCS, ICD-10-PCS)' },
  { value: 'observation', label: 'Observation/Lab', icon: <FileText className="w-4 h-4" />, description: 'Lab result, vital sign, or clinical observation (LOINC)' },
  { value: 'medication', label: 'Medication', icon: <Pill className="w-4 h-4" />, description: 'Drug or medication (RxNorm, NDC)' },
  { value: 'demographic', label: 'Demographic', icon: <Users className="w-4 h-4" />, description: 'Patient demographics (age, sex, etc.)' },
  { value: 'assessment', label: 'Assessment', icon: <ClipboardCheck className="w-4 h-4" />, description: 'Clinical assessment or screening result' },
];

const TIMING_PRESETS = [
  { label: 'During measurement period', value: 'measurement_period', description: 'During the measurement period' },
  { label: 'Prior year', value: 'prior_year', description: 'During the year prior to measurement period' },
  { label: 'Prior 2 years', value: 'prior_2_years', description: 'During the 2 years prior to measurement period' },
  { label: 'Any time', value: 'any_time', description: 'Any time in patient history' },
  { label: 'Custom', value: 'custom', description: 'Custom timing window' },
];

const CODE_SYSTEMS: { value: CodeSystem; label: string }[] = [
  { value: 'ICD10', label: 'ICD-10-CM' },
  { value: 'CPT', label: 'CPT' },
  { value: 'HCPCS', label: 'HCPCS' },
  { value: 'SNOMED', label: 'SNOMED CT' },
  { value: 'LOINC', label: 'LOINC' },
  { value: 'RxNorm', label: 'RxNorm' },
  { value: 'CVX', label: 'CVX' },
];

export function ComponentBuilder({
  populationType,
  existingValueSets,
  onSave,
  onClose,
}: ComponentBuilderProps) {
  // Component state
  const [componentType, setComponentType] = useState<ComponentType>('diagnosis');
  const [description, setDescription] = useState('');
  const [logicOperator, setLogicOperator] = useState<'AND' | 'OR'>('AND');

  // Value set state
  const [valueSetMode, setValueSetMode] = useState<'existing' | 'new'>('existing');
  const [selectedValueSetId, setSelectedValueSetId] = useState<string>('');
  const [newValueSetName, setNewValueSetName] = useState('');
  const [newValueSetOid, setNewValueSetOid] = useState('');
  const [newValueSetCodeSystem, setNewValueSetCodeSystem] = useState<CodeSystem>('ICD10');

  // Timing state
  const [timingPreset, setTimingPreset] = useState<string>('measurement_period');
  const [customTimingValue, setCustomTimingValue] = useState<number>(12);
  const [customTimingUnit, setCustomTimingUnit] = useState<'days' | 'months' | 'years'>('months');
  const [customTimingDirection, setCustomTimingDirection] = useState<'before' | 'after' | 'within'>('before');

  // Additional requirements
  const [additionalRequirements, setAdditionalRequirements] = useState<string[]>([]);
  const [newRequirement, setNewRequirement] = useState('');

  const handleAddRequirement = () => {
    if (newRequirement.trim()) {
      setAdditionalRequirements([...additionalRequirements, newRequirement.trim()]);
      setNewRequirement('');
    }
  };

  const handleRemoveRequirement = (index: number) => {
    setAdditionalRequirements(additionalRequirements.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!description.trim()) {
      alert('Please enter a description for the component');
      return;
    }

    // Build timing requirements
    const timingRequirements: TimingRequirement[] = [];
    if (timingPreset === 'measurement_period') {
      timingRequirements.push({
        description: 'During the measurement period',
        relativeTo: 'measurement_period',
        confidence: 'high',
      });
    } else if (timingPreset === 'prior_year') {
      timingRequirements.push({
        description: 'During the year prior to measurement period',
        relativeTo: 'measurement_period',
        window: { value: 12, unit: 'months', direction: 'before' },
        confidence: 'high',
      });
    } else if (timingPreset === 'prior_2_years') {
      timingRequirements.push({
        description: 'During the 2 years prior to measurement period',
        relativeTo: 'measurement_period',
        window: { value: 24, unit: 'months', direction: 'before' },
        confidence: 'high',
      });
    } else if (timingPreset === 'custom') {
      timingRequirements.push({
        description: `Within ${customTimingValue} ${customTimingUnit} ${customTimingDirection} measurement period`,
        relativeTo: 'measurement_period',
        window: { value: customTimingValue, unit: customTimingUnit, direction: customTimingDirection },
        confidence: 'high',
      });
    }

    // Get or create value set reference
    let valueSetRef: ValueSetReference | undefined;
    let newValueSet: ValueSetReference | undefined;

    if (valueSetMode === 'existing' && selectedValueSetId) {
      valueSetRef = existingValueSets.find(vs => vs.id === selectedValueSetId);
    } else if (valueSetMode === 'new' && newValueSetName.trim()) {
      newValueSet = {
        id: `vs-new-${Date.now()}`,
        name: newValueSetName.trim(),
        oid: newValueSetOid.trim() || undefined,
        confidence: newValueSetOid ? 'high' as ConfidenceLevel : 'medium' as ConfidenceLevel,
        source: 'User Created',
        verified: false,
        codes: [],
        totalCodeCount: 0,
      };
      valueSetRef = newValueSet;
    }

    // Build the component
    const component: DataElement = {
      id: `${populationType}-elem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: componentType,
      description: description.trim(),
      valueSet: valueSetRef,
      timingRequirements: timingRequirements.length > 0 ? timingRequirements : undefined,
      additionalRequirements: additionalRequirements.length > 0 ? additionalRequirements : undefined,
      confidence: valueSetRef?.oid ? 'high' as ConfidenceLevel : 'medium' as ConfidenceLevel,
      source: 'User Created',
      reviewStatus: 'pending',
    };

    onSave(component, newValueSet, logicOperator);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Add Component</h2>
            <p className="text-sm text-[var(--text-muted)]">Build a new criterion for this population</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Component Type Selection */}
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-3">Component Type</label>
            <div className="grid grid-cols-2 gap-2">
              {COMPONENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setComponentType(type.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    componentType === type.value
                      ? 'bg-[var(--accent-light)] border-[var(--accent)]/50 text-[var(--accent)]'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text)] hover:border-[var(--text-dim)]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {type.icon}
                    <span className="font-medium">{type.label}</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{type.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Logic Connection */}
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-2">Logic Connection</label>
            <p className="text-xs text-[var(--text-muted)] mb-3">How should this component connect to existing criteria?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setLogicOperator('AND')}
                className={`flex-1 px-4 py-3 rounded-lg border text-center transition-all ${
                  logicOperator === 'AND'
                    ? 'bg-[var(--success)]/10 border-[var(--success)]/50 text-[var(--success)]'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text)] hover:border-[var(--text-dim)]'
                }`}
              >
                <span className="font-mono font-bold text-sm">AND</span>
                <p className="text-xs mt-1 opacity-70">Must also meet this criterion</p>
              </button>
              <button
                onClick={() => setLogicOperator('OR')}
                className={`flex-1 px-4 py-3 rounded-lg border text-center transition-all ${
                  logicOperator === 'OR'
                    ? 'bg-[var(--warning)]/10 border-[var(--warning)]/50 text-[var(--warning)]'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text)] hover:border-[var(--text-dim)]'
                }`}
              >
                <span className="font-mono font-bold text-sm">OR</span>
                <p className="text-xs mt-1 opacity-70">Alternative to existing criteria</p>
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Patient has a diagnosis of diabetes during the measurement period"
              className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]/50 resize-none"
              rows={2}
            />
          </div>

          {/* Value Set Selection */}
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-3">Value Set</label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setValueSetMode('existing')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  valueSetMode === 'existing'
                    ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Select Existing
              </button>
              <button
                onClick={() => setValueSetMode('new')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  valueSetMode === 'new'
                    ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Create New
              </button>
            </div>

            {valueSetMode === 'existing' ? (
              <select
                value={selectedValueSetId}
                onChange={(e) => setSelectedValueSetId(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]/50"
              >
                <option value="">-- Select a value set --</option>
                {existingValueSets.map((vs) => (
                  <option key={vs.id} value={vs.id}>
                    {vs.name} {vs.oid ? `(${vs.oid})` : ''} - {vs.codes?.length || 0} codes
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newValueSetName}
                  onChange={(e) => setNewValueSetName(e.target.value)}
                  placeholder="Value Set Name (e.g., Diabetes Diagnosis)"
                  className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]/50"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newValueSetOid}
                    onChange={(e) => setNewValueSetOid(e.target.value)}
                    placeholder="OID (optional, e.g., 2.16.840.1...)"
                    className="px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]/50"
                  />
                  <select
                    value={newValueSetCodeSystem}
                    onChange={(e) => setNewValueSetCodeSystem(e.target.value as CodeSystem)}
                    className="px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]/50"
                  >
                    {CODE_SYSTEMS.map((cs) => (
                      <option key={cs.value} value={cs.value}>{cs.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Timing Requirements */}
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Timing Requirements
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {TIMING_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setTimingPreset(preset.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    timingPreset === preset.value
                      ? 'bg-blue-500/15 border-blue-500/50 text-[var(--accent)]'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text)] hover:border-[var(--text-dim)]'
                  }`}
                >
                  <span className="text-sm font-medium">{preset.label}</span>
                </button>
              ))}
            </div>

            {timingPreset === 'custom' && (
              <div className="flex items-center gap-2 p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]">
                <span className="text-sm text-[var(--text)]">Within</span>
                <input
                  type="number"
                  value={customTimingValue}
                  onChange={(e) => setCustomTimingValue(parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-[var(--text)] text-center"
                  min={1}
                />
                <select
                  value={customTimingUnit}
                  onChange={(e) => setCustomTimingUnit(e.target.value as 'days' | 'months' | 'years')}
                  className="px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-[var(--text)]"
                >
                  <option value="days">days</option>
                  <option value="months">months</option>
                  <option value="years">years</option>
                </select>
                <select
                  value={customTimingDirection}
                  onChange={(e) => setCustomTimingDirection(e.target.value as 'before' | 'after' | 'within')}
                  className="px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-[var(--text)]"
                >
                  <option value="before">before</option>
                  <option value="after">after</option>
                  <option value="within">within</option>
                </select>
                <span className="text-sm text-[var(--text)]">measurement period</span>
              </div>
            )}
          </div>

          {/* Additional Requirements */}
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-3">
              Additional Requirements (Optional)
            </label>
            <div className="space-y-2">
              {additionalRequirements.map((req, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded-lg">
                  <span className="flex-1 text-sm text-[var(--text)]">{req}</span>
                  <button
                    onClick={() => handleRemoveRequirement(idx)}
                    className="p-1 text-[var(--danger)] hover:bg-[var(--danger-light)] rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRequirement}
                  onChange={(e) => setNewRequirement(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRequirement()}
                  placeholder="e.g., Age >= 18, HbA1c > 9%, most recent result"
                  className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]/50"
                />
                <button
                  onClick={handleAddRequirement}
                  className="px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-dim)]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Component
          </button>
        </div>
      </div>
    </div>
  );
}
