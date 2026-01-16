import { useState, useMemo } from 'react';
import { X, Plus, FileText, Copy, ChevronRight, ChevronLeft, Check, Database, Search, Users, Target, AlertTriangle, Minus, Sparkles, ArrowRight, Info } from 'lucide-react';
import { useMeasureStore } from '../../stores/measureStore';
import type { UniversalMeasureSpec, MeasureMetadata, PopulationDefinition, ValueSetReference, LogicalClause, DataElement } from '../../types/ums';

// Step definitions for the wizard
type WizardStep =
  | 'start'           // Choose creation method
  | 'metadata'        // Basic measure information
  | 'initial_pop'     // Define Initial Population (with value sets)
  | 'denominator'     // Define Denominator (with value sets)
  | 'numerator'       // Define Numerator (with value sets)
  | 'exclusions'      // Define Exclusions/Exceptions (with value sets)
  | 'review';         // Review and create

type CreationMode = 'blank' | 'copy' | 'guided';
type MeasureProgram = MeasureMetadata['program'];
type MeasureType = MeasureMetadata['measureType'];
type ScoringType = 'proportion' | 'ratio' | 'continuous_variable';

interface CriteriaDefinition {
  description: string;
  ageRange?: { min?: number; max?: number };
  requiredDiagnosis?: string;
  requiredEncounter?: string;
  requiredProcedure?: string;
  requiredObservation?: string;
  timingConstraint?: string;
  // Associated value sets for this population's criteria
  valueSets?: Set<string>;
}

interface MeasureCreatorProps {
  isOpen: boolean;
  onClose: () => void;
}

// Step configuration - value sets are now integrated into each population step
const STEPS: { id: WizardStep; label: string; icon: typeof Users; description: string }[] = [
  { id: 'start', label: 'Start', icon: Plus, description: 'Choose creation method' },
  { id: 'metadata', label: 'Basics', icon: FileText, description: 'Measure information' },
  { id: 'initial_pop', label: 'Initial Pop', icon: Users, description: 'Define eligible patients & value sets' },
  { id: 'denominator', label: 'Denominator', icon: Target, description: 'Define denominator & value sets' },
  { id: 'numerator', label: 'Numerator', icon: Check, description: 'Define success criteria & value sets' },
  { id: 'exclusions', label: 'Exclusions', icon: Minus, description: 'Define exclusions & value sets' },
  { id: 'review', label: 'Review', icon: Sparkles, description: 'Review and create' },
];

export function MeasureCreator({ isOpen, onClose }: MeasureCreatorProps) {
  const { measures, addMeasure, setActiveMeasure, setActiveTab } = useMeasureStore();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('start');
  const [mode, setMode] = useState<CreationMode>('guided');

  // Basic metadata
  const [measureId, setMeasureId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [program, setProgram] = useState<MeasureProgram>('MIPS_CQM');
  const [measureType, setMeasureType] = useState<MeasureType>('process');
  const [scoringType, setScoringType] = useState<ScoringType>('proportion');
  const [steward, setSteward] = useState('');
  const [rationale, setRationale] = useState('');

  // Copy mode - source measure
  const [sourceMeasureId, setSourceMeasureId] = useState<string | null>(null);

  // Population criteria (each includes associated value sets)
  const [initialPopCriteria, setInitialPopCriteria] = useState<CriteriaDefinition>({
    description: '',
    ageRange: {},
    valueSets: new Set(),
  });
  const [denominatorCriteria, setDenominatorCriteria] = useState<CriteriaDefinition>({
    description: '',
    valueSets: new Set(),
  });
  const [numeratorCriteria, setNumeratorCriteria] = useState<CriteriaDefinition>({
    description: '',
    valueSets: new Set(),
  });
  const [exclusionCriteria, setExclusionCriteria] = useState<CriteriaDefinition>({
    description: '',
    valueSets: new Set(),
  });

  // Value set search (shared across steps)
  const [valueSetSearch, setValueSetSearch] = useState('');

  // Get all unique value sets from all measures
  const availableValueSets = useMemo(() => {
    const vsMap = new Map<string, { valueSet: ValueSetReference; sourceMeasure: string }>();
    measures.forEach(m => {
      m.valueSets.forEach(vs => {
        const key = vs.oid || vs.id;
        if (!vsMap.has(key)) {
          vsMap.set(key, { valueSet: vs, sourceMeasure: m.metadata.measureId });
        }
      });
    });
    return Array.from(vsMap.values());
  }, [measures]);

  // Filter value sets by search
  const filteredValueSets = useMemo(() => {
    if (!valueSetSearch) return availableValueSets;
    const search = valueSetSearch.toLowerCase();
    return availableValueSets.filter(v =>
      v.valueSet.name.toLowerCase().includes(search) ||
      (v.valueSet.oid && v.valueSet.oid.toLowerCase().includes(search)) ||
      v.sourceMeasure.toLowerCase().includes(search)
    );
  }, [availableValueSets, valueSetSearch]);

  const resetForm = () => {
    setCurrentStep('start');
    setMode('guided');
    setMeasureId('');
    setTitle('');
    setDescription('');
    setProgram('MIPS_CQM');
    setMeasureType('process');
    setScoringType('proportion');
    setSteward('');
    setRationale('');
    setSourceMeasureId(null);
    setInitialPopCriteria({ description: '', ageRange: {}, valueSets: new Set() });
    setDenominatorCriteria({ description: '', valueSets: new Set() });
    setNumeratorCriteria({ description: '', valueSets: new Set() });
    setExclusionCriteria({ description: '', valueSets: new Set() });
    setValueSetSearch('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Navigation
  const getCurrentStepIndex = () => STEPS.findIndex(s => s.id === currentStep);

  const canGoNext = () => {
    switch (currentStep) {
      case 'start':
        return mode === 'copy' ? !!sourceMeasureId : true;
      case 'metadata':
        return measureId.trim() && title.trim();
      case 'initial_pop':
        return initialPopCriteria.description.trim() ||
               (initialPopCriteria.ageRange?.min !== undefined || initialPopCriteria.ageRange?.max !== undefined);
      case 'denominator':
      case 'numerator':
      case 'exclusions':
      case 'value_sets':
        return true; // Optional steps
      case 'review':
        return true;
      default:
        return true;
    }
  };

  const goNext = () => {
    const currentIndex = getCurrentStepIndex();

    // Skip to review for copy mode after metadata
    if (mode === 'copy' && currentStep === 'metadata') {
      setCurrentStep('review');
      return;
    }

    // Skip to review for blank mode after metadata
    if (mode === 'blank' && currentStep === 'metadata') {
      setCurrentStep('review');
      return;
    }

    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  };

  const goBack = () => {
    const currentIndex = getCurrentStepIndex();

    // Handle special cases for copy/blank mode
    if ((mode === 'copy' || mode === 'blank') && currentStep === 'review') {
      setCurrentStep('metadata');
      return;
    }

    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  const handleCreate = () => {
    const now = new Date().toISOString();
    const id = `ums-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let newMeasure: UniversalMeasureSpec;

    if (mode === 'copy' && sourceMeasureId) {
      // Copy from existing measure
      const source = measures.find(m => m.id === sourceMeasureId);
      if (!source) return;

      newMeasure = {
        ...JSON.parse(JSON.stringify(source)),
        id,
        metadata: {
          ...source.metadata,
          measureId: measureId || `${source.metadata.measureId}-COPY`,
          title: title || `Copy of ${source.metadata.title}`,
          description: description || source.metadata.description,
          version: '1.0',
          lastUpdated: now,
        },
        status: 'in_progress',
        createdAt: now,
        updatedAt: now,
        lockedAt: undefined,
        lockedBy: undefined,
        approvedAt: undefined,
        approvedBy: undefined,
      };

      // Reset all review statuses to pending
      newMeasure.populations = newMeasure.populations.map(pop => ({
        ...pop,
        reviewStatus: 'pending',
        criteria: pop.criteria ? resetClauseReviewStatus(pop.criteria) : pop.criteria,
      }));
      newMeasure.reviewProgress = {
        total: newMeasure.reviewProgress.total,
        approved: 0,
        pending: newMeasure.reviewProgress.total,
        flagged: 0,
      };
    } else {
      // Create new measure (blank or guided)
      // Collect all value sets from all population criteria
      const allSelectedVSIds = new Set<string>([
        ...(initialPopCriteria.valueSets || []),
        ...(denominatorCriteria.valueSets || []),
        ...(numeratorCriteria.valueSets || []),
        ...(exclusionCriteria.valueSets || []),
      ]);
      const selectedVSList = Array.from(allSelectedVSIds)
        .map(vsId => availableValueSets.find(v => (v.valueSet.oid || v.valueSet.id) === vsId)?.valueSet)
        .filter((vs): vs is ValueSetReference => vs !== undefined)
        .map(vs => ({ ...vs, id: `vs-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` }));

      // Build populations from criteria definitions
      const populations = buildPopulationsFromCriteria();

      // Count reviewable items
      let totalReviewable = 0;
      const countReviewable = (obj: any) => {
        if (obj?.reviewStatus) totalReviewable++;
        if (obj?.criteria) countReviewable(obj.criteria);
        if (obj?.children) obj.children.forEach(countReviewable);
      };
      populations.forEach(countReviewable);

      newMeasure = {
        id,
        metadata: {
          measureId: measureId || 'NEW-001',
          title: title || 'New Measure',
          version: '1.0',
          steward: steward || 'Organization',
          program,
          measureType,
          description: description || rationale || 'New custom measure',
          measurementPeriod: {
            start: `${new Date().getFullYear()}-01-01`,
            end: `${new Date().getFullYear()}-12-31`,
            inclusive: true,
          },
          lastUpdated: now,
        },
        populations,
        valueSets: selectedVSList,
        status: 'in_progress',
        overallConfidence: 'medium',
        reviewProgress: {
          total: totalReviewable,
          approved: 0,
          pending: totalReviewable,
          flagged: 0,
        },
        createdAt: now,
        updatedAt: now,
      };
    }

    addMeasure(newMeasure);
    setActiveMeasure(newMeasure.id);
    setActiveTab('editor');
    handleClose();
  };

  // Build population definitions from user-entered criteria
  const buildPopulationsFromCriteria = (): PopulationDefinition[] => {
    const populations: PopulationDefinition[] = [];
    const timestamp = Date.now();

    // Initial Population
    const ipChildren: (LogicalClause | DataElement)[] = [];

    if (initialPopCriteria.ageRange?.min !== undefined || initialPopCriteria.ageRange?.max !== undefined) {
      ipChildren.push({
        id: `age-${timestamp}`,
        type: 'demographic',
        description: `Age ${initialPopCriteria.ageRange.min || 0} to ${initialPopCriteria.ageRange.max || 999} years`,
        constraints: {
          minAge: initialPopCriteria.ageRange.min,
          maxAge: initialPopCriteria.ageRange.max,
          ageUnit: 'years',
        },
        confidence: 'medium',
        reviewStatus: 'pending',
      } as DataElement);
    }

    if (initialPopCriteria.requiredDiagnosis) {
      ipChildren.push({
        id: `dx-${timestamp}`,
        type: 'diagnosis',
        description: initialPopCriteria.requiredDiagnosis,
        constraints: {},
        confidence: 'medium',
        reviewStatus: 'pending',
      } as DataElement);
    }

    if (initialPopCriteria.requiredEncounter) {
      ipChildren.push({
        id: `enc-${timestamp}`,
        type: 'encounter',
        description: initialPopCriteria.requiredEncounter,
        constraints: {},
        confidence: 'medium',
        reviewStatus: 'pending',
      } as DataElement);
    }

    populations.push({
      id: `ip-${timestamp}`,
      type: 'initial_population',
      description: initialPopCriteria.description || 'Initial Population',
      narrative: initialPopCriteria.description || 'Define the initial population criteria',
      criteria: {
        id: `ip-criteria-${timestamp}`,
        operator: 'AND',
        description: initialPopCriteria.description || 'Initial Population Criteria',
        children: ipChildren,
        confidence: 'medium',
        reviewStatus: 'pending',
      },
      confidence: 'medium',
      reviewStatus: 'pending',
    });

    // Denominator
    populations.push({
      id: `den-${timestamp}`,
      type: 'denominator',
      description: denominatorCriteria.description || 'Denominator equals Initial Population',
      narrative: denominatorCriteria.description || 'Denominator = Initial Population',
      criteria: {
        id: `den-criteria-${timestamp}`,
        operator: 'AND',
        description: denominatorCriteria.description || 'Denominator Criteria',
        children: [],
        confidence: 'medium',
        reviewStatus: 'pending',
      },
      confidence: 'medium',
      reviewStatus: 'pending',
    });

    // Numerator
    const numChildren: (LogicalClause | DataElement)[] = [];

    if (numeratorCriteria.requiredProcedure) {
      numChildren.push({
        id: `proc-${timestamp}`,
        type: 'procedure',
        description: numeratorCriteria.requiredProcedure,
        constraints: {},
        confidence: 'medium',
        reviewStatus: 'pending',
      } as DataElement);
    }

    if (numeratorCriteria.requiredObservation) {
      numChildren.push({
        id: `obs-${timestamp}`,
        type: 'observation',
        description: numeratorCriteria.requiredObservation,
        constraints: {},
        confidence: 'medium',
        reviewStatus: 'pending',
      } as DataElement);
    }

    populations.push({
      id: `num-${timestamp}`,
      type: 'numerator',
      description: numeratorCriteria.description || 'Numerator',
      narrative: numeratorCriteria.description || 'Define the numerator criteria',
      criteria: {
        id: `num-criteria-${timestamp}`,
        operator: 'AND',
        description: numeratorCriteria.description || 'Numerator Criteria',
        children: numChildren,
        confidence: 'medium',
        reviewStatus: 'pending',
      },
      confidence: 'medium',
      reviewStatus: 'pending',
    });

    // Denominator Exclusion (if specified)
    if (exclusionCriteria.description) {
      populations.push({
        id: `denex-${timestamp}`,
        type: 'denominator_exclusion',
        description: exclusionCriteria.description,
        narrative: exclusionCriteria.description,
        criteria: {
          id: `denex-criteria-${timestamp}`,
          operator: 'OR',
          description: exclusionCriteria.description,
          children: [],
          confidence: 'medium',
          reviewStatus: 'pending',
        },
        confidence: 'medium',
        reviewStatus: 'pending',
      });
    }

    return populations;
  };

  if (!isOpen) return null;

  // Get visible steps based on mode
  const visibleSteps = mode === 'guided'
    ? STEPS
    : STEPS.filter(s => ['start', 'metadata', 'review'].includes(s.id));

  const currentStepConfig = STEPS.find(s => s.id === currentStep);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[var(--bg)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-secondary)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Create New Measure</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {currentStepConfig?.description || 'Step-by-step measure authoring'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        {currentStep !== 'start' && (
          <div className="px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
            <div className="flex items-center gap-2 overflow-x-auto">
              {visibleSteps.filter(s => s.id !== 'start').map((step, idx) => {
                const stepIndex = visibleSteps.findIndex(s => s.id === step.id);
                const currentIndex = visibleSteps.findIndex(s => s.id === currentStep);
                const isComplete = stepIndex < currentIndex;
                const isCurrent = step.id === currentStep;
                const Icon = step.icon;

                return (
                  <div key={step.id} className="flex items-center">
                    <button
                      onClick={() => isComplete && setCurrentStep(step.id)}
                      disabled={!isComplete}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                        isCurrent
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                          : isComplete
                          ? 'text-emerald-400 hover:bg-emerald-500/10 cursor-pointer'
                          : 'text-[var(--text-dim)]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="whitespace-nowrap">{step.label}</span>
                      {isComplete && <Check className="w-3 h-3" />}
                    </button>
                    {idx < visibleSteps.filter(s => s.id !== 'start').length - 1 && (
                      <ChevronRight className="w-4 h-4 text-[var(--text-dim)] mx-1 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Step: Start - Choose Creation Method */}
          {currentStep === 'start' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-xl font-semibold text-[var(--text)] mb-2">How would you like to create your measure?</h3>
                <p className="text-[var(--text-muted)]">Choose a starting point for your new quality measure</p>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
                <button
                  onClick={() => setMode('guided')}
                  className={`p-6 rounded-xl border-2 text-left transition-all hover:border-cyan-500/50 ${
                    mode === 'guided' ? 'border-cyan-500 bg-cyan-500/10' : 'border-[var(--border)]'
                  }`}
                >
                  <div className="w-14 h-14 rounded-xl bg-cyan-500/15 flex items-center justify-center mb-4">
                    <Sparkles className="w-7 h-7 text-cyan-400" />
                  </div>
                  <h3 className="font-semibold text-[var(--text)] mb-2">Guided Builder</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Step-by-step wizard to define populations, criteria, and value sets
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs text-cyan-400">
                    <Check className="w-3 h-3" />
                    <span>Recommended</span>
                  </div>
                </button>

                <button
                  onClick={() => setMode('blank')}
                  className={`p-6 rounded-xl border-2 text-left transition-all hover:border-purple-500/50 ${
                    mode === 'blank' ? 'border-purple-500 bg-purple-500/10' : 'border-[var(--border)]'
                  }`}
                >
                  <div className="w-14 h-14 rounded-xl bg-purple-500/15 flex items-center justify-center mb-4">
                    <Plus className="w-7 h-7 text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-[var(--text)] mb-2">Start Blank</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Create an empty measure and define everything in the editor
                  </p>
                </button>

                <button
                  onClick={() => setMode('copy')}
                  className={`p-6 rounded-xl border-2 text-left transition-all hover:border-emerald-500/50 ${
                    mode === 'copy' ? 'border-emerald-500 bg-emerald-500/10' : 'border-[var(--border)]'
                  }`}
                  disabled={measures.length === 0}
                >
                  <div className="w-14 h-14 rounded-xl bg-emerald-500/15 flex items-center justify-center mb-4">
                    <Copy className="w-7 h-7 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-[var(--text)] mb-2">Copy Existing</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Duplicate an existing measure and modify it
                  </p>
                  {measures.length === 0 && (
                    <div className="mt-4 text-xs text-[var(--text-dim)]">
                      No measures available to copy
                    </div>
                  )}
                </button>
              </div>

              {/* Copy mode: Source measure selection */}
              {mode === 'copy' && measures.length > 0 && (
                <div className="max-w-3xl mx-auto mt-6">
                  <label className="block text-sm font-medium text-[var(--text)] mb-3">
                    Select measure to copy:
                  </label>
                  <div className="grid gap-2 max-h-48 overflow-auto">
                    {measures.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSourceMeasureId(m.id)}
                        className={`p-4 rounded-lg border text-left transition-all ${
                          sourceMeasureId === m.id
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-[var(--border)] hover:border-[var(--text-dim)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-mono text-[var(--text-muted)]">{m.metadata.measureId}</span>
                            <div className="text-sm font-medium text-[var(--text)]">{m.metadata.title}</div>
                          </div>
                          {sourceMeasureId === m.id && <Check className="w-5 h-5 text-emerald-400" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Metadata */}
          {currentStep === 'metadata' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Measure Information</h3>
                <p className="text-[var(--text-muted)]">Enter basic details about your quality measure</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Measure ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={measureId}
                    onChange={(e) => setMeasureId(e.target.value)}
                    placeholder="e.g., CMS123v1"
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Program <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={program}
                    onChange={(e) => setProgram(e.target.value as MeasureProgram)}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-cyan-500"
                  >
                    <option value="MIPS_CQM">MIPS CQM</option>
                    <option value="eCQM">eCQM</option>
                    <option value="HEDIS">HEDIS</option>
                    <option value="QOF">QOF</option>
                    <option value="Registry">Registry</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Diabetes: Hemoglobin A1c Control"
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Description / Clinical Rationale
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the clinical purpose and importance of this measure..."
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Measure Type
                  </label>
                  <select
                    value={measureType}
                    onChange={(e) => setMeasureType(e.target.value as MeasureType)}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-cyan-500"
                  >
                    <option value="process">Process</option>
                    <option value="outcome">Outcome</option>
                    <option value="structure">Structure</option>
                    <option value="patient_experience">Patient Experience</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Scoring Type
                  </label>
                  <select
                    value={scoringType}
                    onChange={(e) => setScoringType(e.target.value as ScoringType)}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-cyan-500"
                  >
                    <option value="proportion">Proportion</option>
                    <option value="ratio">Ratio</option>
                    <option value="continuous_variable">Continuous Variable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Steward
                  </label>
                  <input
                    type="text"
                    value={steward}
                    onChange={(e) => setSteward(e.target.value)}
                    placeholder="e.g., CMS, NCQA"
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step: Initial Population */}
          {currentStep === 'initial_pop' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/15 flex items-center justify-center">
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Initial Population</h3>
                <p className="text-[var(--text-muted)]">
                  Define who is eligible to be evaluated by this measure
                </p>
              </div>

              {/* Info box */}
              <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-muted)]">
                  The Initial Population identifies all patients, episodes, or events who share common characteristics.
                  All other populations (denominator, numerator, exclusions) are subsets of this population.
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Population Description
                </label>
                <textarea
                  value={initialPopCriteria.description}
                  onChange={(e) => setInitialPopCriteria({ ...initialPopCriteria, description: e.target.value })}
                  placeholder="e.g., Patients 18-85 years of age with a diagnosis of essential hypertension and at least one outpatient visit during the measurement period"
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Minimum Age (years)
                  </label>
                  <input
                    type="number"
                    value={initialPopCriteria.ageRange?.min ?? ''}
                    onChange={(e) => setInitialPopCriteria({
                      ...initialPopCriteria,
                      ageRange: { ...initialPopCriteria.ageRange, min: e.target.value ? parseInt(e.target.value) : undefined }
                    })}
                    placeholder="e.g., 18"
                    min={0}
                    max={150}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Maximum Age (years)
                  </label>
                  <input
                    type="number"
                    value={initialPopCriteria.ageRange?.max ?? ''}
                    onChange={(e) => setInitialPopCriteria({
                      ...initialPopCriteria,
                      ageRange: { ...initialPopCriteria.ageRange, max: e.target.value ? parseInt(e.target.value) : undefined }
                    })}
                    placeholder="e.g., 85"
                    min={0}
                    max={150}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Required Diagnosis
                </label>
                <input
                  type="text"
                  value={initialPopCriteria.requiredDiagnosis || ''}
                  onChange={(e) => setInitialPopCriteria({ ...initialPopCriteria, requiredDiagnosis: e.target.value })}
                  placeholder="e.g., Essential Hypertension, Diabetes Mellitus"
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Required Encounter Type
                </label>
                <input
                  type="text"
                  value={initialPopCriteria.requiredEncounter || ''}
                  onChange={(e) => setInitialPopCriteria({ ...initialPopCriteria, requiredEncounter: e.target.value })}
                  placeholder="e.g., Office Visit, Annual Wellness Visit"
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Value Set Picker for Initial Population */}
              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <label className="text-sm font-medium text-[var(--text)]">
                    Associated Value Sets
                  </label>
                  <span className="text-xs text-[var(--text-dim)]">
                    ({initialPopCriteria.valueSets?.size || 0} selected)
                  </span>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
                  <input
                    type="text"
                    value={valueSetSearch}
                    onChange={(e) => setValueSetSearch(e.target.value)}
                    placeholder="Search value sets..."
                    className="w-full pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="grid gap-2 max-h-40 overflow-auto">
                  {filteredValueSets.slice(0, 10).map(({ valueSet, sourceMeasure }) => {
                    const key = valueSet.oid || valueSet.id;
                    const isSelected = initialPopCriteria.valueSets?.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const next = new Set(initialPopCriteria.valueSets || []);
                          if (isSelected) next.delete(key);
                          else next.add(key);
                          setInitialPopCriteria({ ...initialPopCriteria, valueSets: next });
                        }}
                        className={`p-3 rounded-lg border text-left transition-all text-sm ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-500/10'
                            : 'border-[var(--border)] hover:border-[var(--text-dim)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[var(--text)]">{valueSet.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                        </div>
                        <div className="text-xs text-[var(--text-dim)] mt-1">
                          {valueSet.oid && <span className="font-mono">{valueSet.oid}</span>}
                          {valueSet.oid && ' · '}
                          from {sourceMeasure}
                        </div>
                      </button>
                    );
                  })}
                  {filteredValueSets.length === 0 && (
                    <div className="text-sm text-[var(--text-muted)] text-center py-4">
                      No value sets found. You can add them later in the editor.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step: Denominator */}
          {currentStep === 'denominator' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-500/15 flex items-center justify-center">
                  <Target className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Denominator</h3>
                <p className="text-[var(--text-muted)]">
                  Define the subset of the Initial Population who are eligible for the quality action
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-muted)]">
                  For most proportion measures, the Denominator equals the Initial Population.
                  Add additional criteria only if you need to further refine who is eligible.
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Denominator Description
                </label>
                <textarea
                  value={denominatorCriteria.description}
                  onChange={(e) => setDenominatorCriteria({ ...denominatorCriteria, description: e.target.value })}
                  placeholder="e.g., Equals Initial Population (or add additional criteria)"
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Additional Timing Constraints (optional)
                </label>
                <input
                  type="text"
                  value={denominatorCriteria.timingConstraint || ''}
                  onChange={(e) => setDenominatorCriteria({ ...denominatorCriteria, timingConstraint: e.target.value })}
                  placeholder="e.g., During first 6 months of measurement period"
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Value Set Picker for Denominator */}
              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4 text-purple-400" />
                  <label className="text-sm font-medium text-[var(--text)]">
                    Associated Value Sets
                  </label>
                  <span className="text-xs text-[var(--text-dim)]">
                    ({denominatorCriteria.valueSets?.size || 0} selected)
                  </span>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
                  <input
                    type="text"
                    value={valueSetSearch}
                    onChange={(e) => setValueSetSearch(e.target.value)}
                    placeholder="Search value sets..."
                    className="w-full pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="grid gap-2 max-h-40 overflow-auto">
                  {filteredValueSets.slice(0, 10).map(({ valueSet, sourceMeasure }) => {
                    const key = valueSet.oid || valueSet.id;
                    const isSelected = denominatorCriteria.valueSets?.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const next = new Set(denominatorCriteria.valueSets || []);
                          if (isSelected) next.delete(key);
                          else next.add(key);
                          setDenominatorCriteria({ ...denominatorCriteria, valueSets: next });
                        }}
                        className={`p-3 rounded-lg border text-left transition-all text-sm ${
                          isSelected
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-[var(--border)] hover:border-[var(--text-dim)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[var(--text)]">{valueSet.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                        </div>
                        <div className="text-xs text-[var(--text-dim)] mt-1">
                          {valueSet.oid && <span className="font-mono">{valueSet.oid}</span>}
                          {valueSet.oid && ' · '}
                          from {sourceMeasure}
                        </div>
                      </button>
                    );
                  })}
                  {filteredValueSets.length === 0 && (
                    <div className="text-sm text-[var(--text-muted)] text-center py-4">
                      No value sets found. You can add them later in the editor.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step: Numerator */}
          {currentStep === 'numerator' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Numerator</h3>
                <p className="text-[var(--text-muted)]">
                  Define the criteria that indicate successful performance (quality action completed)
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <Info className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-muted)]">
                  The Numerator defines patients who received the expected care or achieved the desired outcome.
                  This is what you're measuring - the "success" criteria.
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Numerator Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={numeratorCriteria.description}
                  onChange={(e) => setNumeratorCriteria({ ...numeratorCriteria, description: e.target.value })}
                  placeholder="e.g., Patients whose most recent blood pressure is adequately controlled (systolic < 140 and diastolic < 90)"
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Required Procedure or Test
                </label>
                <input
                  type="text"
                  value={numeratorCriteria.requiredProcedure || ''}
                  onChange={(e) => setNumeratorCriteria({ ...numeratorCriteria, requiredProcedure: e.target.value })}
                  placeholder="e.g., HbA1c Lab Test, Colonoscopy, Mammogram"
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Required Result/Observation
                </label>
                <input
                  type="text"
                  value={numeratorCriteria.requiredObservation || ''}
                  onChange={(e) => setNumeratorCriteria({ ...numeratorCriteria, requiredObservation: e.target.value })}
                  placeholder="e.g., Blood pressure reading, HbA1c result < 9%"
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Value Set Picker for Numerator */}
              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <label className="text-sm font-medium text-[var(--text)]">
                    Associated Value Sets
                  </label>
                  <span className="text-xs text-[var(--text-dim)]">
                    ({numeratorCriteria.valueSets?.size || 0} selected)
                  </span>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
                  <input
                    type="text"
                    value={valueSetSearch}
                    onChange={(e) => setValueSetSearch(e.target.value)}
                    placeholder="Search value sets..."
                    className="w-full pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="grid gap-2 max-h-40 overflow-auto">
                  {filteredValueSets.slice(0, 10).map(({ valueSet, sourceMeasure }) => {
                    const key = valueSet.oid || valueSet.id;
                    const isSelected = numeratorCriteria.valueSets?.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const next = new Set(numeratorCriteria.valueSets || []);
                          if (isSelected) next.delete(key);
                          else next.add(key);
                          setNumeratorCriteria({ ...numeratorCriteria, valueSets: next });
                        }}
                        className={`p-3 rounded-lg border text-left transition-all text-sm ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-[var(--border)] hover:border-[var(--text-dim)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[var(--text)]">{valueSet.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                        </div>
                        <div className="text-xs text-[var(--text-dim)] mt-1">
                          {valueSet.oid && <span className="font-mono">{valueSet.oid}</span>}
                          {valueSet.oid && ' · '}
                          from {sourceMeasure}
                        </div>
                      </button>
                    );
                  })}
                  {filteredValueSets.length === 0 && (
                    <div className="text-sm text-[var(--text-muted)] text-center py-4">
                      No value sets found. You can add them later in the editor.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step: Exclusions */}
          {currentStep === 'exclusions' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Exclusions & Exceptions</h3>
                <p className="text-[var(--text-muted)]">
                  Define criteria that remove patients from the denominator (optional)
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-muted)]">
                  <strong>Exclusions</strong> remove patients based on clinical appropriateness (e.g., hospice care, ESRD).
                  <br /><strong>Exceptions</strong> allow for valid clinical reasons why the numerator action wasn't performed.
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Denominator Exclusions
                </label>
                <textarea
                  value={exclusionCriteria.description}
                  onChange={(e) => setExclusionCriteria({ ...exclusionCriteria, description: e.target.value })}
                  placeholder="e.g., Patients in hospice care, patients with ESRD, patients who are pregnant"
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="text-sm text-[var(--text-dim)] italic">
                Leave blank if no exclusions apply to this measure.
              </div>

              {/* Value Set Picker for Exclusions */}
              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4 text-amber-400" />
                  <label className="text-sm font-medium text-[var(--text)]">
                    Associated Value Sets
                  </label>
                  <span className="text-xs text-[var(--text-dim)]">
                    ({exclusionCriteria.valueSets?.size || 0} selected)
                  </span>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
                  <input
                    type="text"
                    value={valueSetSearch}
                    onChange={(e) => setValueSetSearch(e.target.value)}
                    placeholder="Search value sets..."
                    className="w-full pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="grid gap-2 max-h-40 overflow-auto">
                  {filteredValueSets.slice(0, 10).map(({ valueSet, sourceMeasure }) => {
                    const key = valueSet.oid || valueSet.id;
                    const isSelected = exclusionCriteria.valueSets?.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const next = new Set(exclusionCriteria.valueSets || []);
                          if (isSelected) next.delete(key);
                          else next.add(key);
                          setExclusionCriteria({ ...exclusionCriteria, valueSets: next });
                        }}
                        className={`p-3 rounded-lg border text-left transition-all text-sm ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-[var(--border)] hover:border-[var(--text-dim)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[var(--text)]">{valueSet.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                        </div>
                        <div className="text-xs text-[var(--text-dim)] mt-1">
                          {valueSet.oid && <span className="font-mono">{valueSet.oid}</span>}
                          {valueSet.oid && ' · '}
                          from {sourceMeasure}
                        </div>
                      </button>
                    );
                  })}
                  {filteredValueSets.length === 0 && (
                    <div className="text-sm text-[var(--text-muted)] text-center py-4">
                      No value sets found. You can add them later in the editor.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step: Review */}
          {currentStep === 'review' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Review Your Measure</h3>
                <p className="text-[var(--text-muted)]">
                  Confirm the details before creating your measure
                </p>
              </div>

              <div className="space-y-4">
                {/* Basic Info */}
                <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
                  <div className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-2">Basic Information</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Measure ID:</span>
                      <span className="font-mono text-[var(--text)]">{measureId || 'NEW-001'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Title:</span>
                      <span className="text-[var(--text)]">{title || 'Untitled Measure'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Program:</span>
                      <span className="text-[var(--text)]">{program}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Type:</span>
                      <span className="text-[var(--text)] capitalize">{measureType.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>

                {/* Populations (for guided mode) */}
                {mode === 'guided' && (
                  <>
                    {(initialPopCriteria.description || (initialPopCriteria.valueSets?.size || 0) > 0) && (
                      <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <div className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-2">
                          <Users className="w-4 h-4" />
                          Initial Population
                        </div>
                        {initialPopCriteria.description && (
                          <p className="text-sm text-[var(--text-muted)]">{initialPopCriteria.description}</p>
                        )}
                        {(initialPopCriteria.ageRange?.min !== undefined || initialPopCriteria.ageRange?.max !== undefined) && (
                          <p className="text-xs text-[var(--text-dim)] mt-1">
                            Age: {initialPopCriteria.ageRange?.min || 0} - {initialPopCriteria.ageRange?.max || '∞'} years
                          </p>
                        )}
                        {(initialPopCriteria.valueSets?.size || 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Array.from(initialPopCriteria.valueSets || []).map(vsId => {
                              const vs = availableValueSets.find(v => (v.valueSet.oid || v.valueSet.id) === vsId);
                              return vs ? (
                                <span key={vsId} className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                                  {vs.valueSet.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {(denominatorCriteria.description || (denominatorCriteria.valueSets?.size || 0) > 0) && (
                      <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                        <div className="flex items-center gap-2 text-purple-400 text-sm font-medium mb-2">
                          <Target className="w-4 h-4" />
                          Denominator
                        </div>
                        {denominatorCriteria.description && (
                          <p className="text-sm text-[var(--text-muted)]">{denominatorCriteria.description}</p>
                        )}
                        {(denominatorCriteria.valueSets?.size || 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Array.from(denominatorCriteria.valueSets || []).map(vsId => {
                              const vs = availableValueSets.find(v => (v.valueSet.oid || v.valueSet.id) === vsId);
                              return vs ? (
                                <span key={vsId} className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                                  {vs.valueSet.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {(numeratorCriteria.description || (numeratorCriteria.valueSets?.size || 0) > 0) && (
                      <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-2">
                          <Check className="w-4 h-4" />
                          Numerator
                        </div>
                        {numeratorCriteria.description && (
                          <p className="text-sm text-[var(--text-muted)]">{numeratorCriteria.description}</p>
                        )}
                        {(numeratorCriteria.valueSets?.size || 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Array.from(numeratorCriteria.valueSets || []).map(vsId => {
                              const vs = availableValueSets.find(v => (v.valueSet.oid || v.valueSet.id) === vsId);
                              return vs ? (
                                <span key={vsId} className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">
                                  {vs.valueSet.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {(exclusionCriteria.description || (exclusionCriteria.valueSets?.size || 0) > 0) && (
                      <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-2">
                          <AlertTriangle className="w-4 h-4" />
                          Exclusions
                        </div>
                        {exclusionCriteria.description && (
                          <p className="text-sm text-[var(--text-muted)]">{exclusionCriteria.description}</p>
                        )}
                        {(exclusionCriteria.valueSets?.size || 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Array.from(exclusionCriteria.valueSets || []).map(vsId => {
                              const vs = availableValueSets.find(v => (v.valueSet.oid || v.valueSet.id) === vsId);
                              return vs ? (
                                <span key={vsId} className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded">
                                  {vs.valueSet.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Copy mode info */}
                {mode === 'copy' && sourceMeasureId && (
                  <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-2">
                      <Copy className="w-4 h-4" />
                      Copying From
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                      {measures.find(m => m.id === sourceMeasureId)?.metadata.title}
                    </p>
                  </div>
                )}

                {/* Blank mode info */}
                {mode === 'blank' && (
                  <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="flex items-center gap-2 text-purple-400 text-sm font-medium mb-2">
                      <Plus className="w-4 h-4" />
                      Starting Blank
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                      Your measure will be created with empty population definitions.
                      Use the UMS Editor to define criteria.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between">
          <div>
            {currentStep !== 'start' && (
              <button
                onClick={goBack}
                className="flex items-center gap-2 px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>

            {currentStep === 'review' ? (
              <button
                onClick={handleCreate}
                className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Measure
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={!canGoNext()}
                className="px-6 py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: Reset review status recursively for LogicalClause
function resetClauseReviewStatus(clause: LogicalClause): LogicalClause {
  return {
    ...clause,
    reviewStatus: 'pending',
    children: clause.children.map(child => {
      if ('operator' in child) {
        return resetClauseReviewStatus(child as LogicalClause);
      }
      return { ...child, reviewStatus: 'pending' as const };
    }),
  };
}
