/**
 * MeasureCreator - Multi-step measure creation wizard
 *
 * Supports three creation modes:
 * - AI-Guided: Upload/paste specs and extract populations with AI
 * - Blank: Start with empty measure template
 * - Copy: Duplicate an existing measure
 *
 * Uses CriteriaBlockBuilder for defining population criteria.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Copy,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Check,
  Brain,
  Wand2,
  Upload,
  File,
  Trash2,
  Users,
  Target,
  AlertTriangle,
  Info,
  Loader2,
  AlertCircle,
  Sparkles,
  Save,
  FileText,
} from 'lucide-react';
import { useMeasureStore } from '../../stores/measureStore.js';
import { CriteriaBlockBuilder } from './CriteriaBlockBuilder.jsx';
import { extractMeasure, extractTextFromFiles } from '../../services/extractionService.js';

// ============================================================================
// Constants
// ============================================================================

const STEPS = [
  { id: 'start', label: 'Start', description: 'Choose how to create your measure' },
  { id: 'ai_input', label: 'Input', description: 'Upload or paste measure specification', icon: Brain },
  { id: 'metadata', label: 'Metadata', description: 'Basic measure information', icon: File },
  { id: 'initial_pop', label: 'Denominator', description: 'Who is eligible for the measure', icon: Users },
  { id: 'numerator', label: 'Numerator', description: 'Who meets the performance criteria', icon: Check },
  { id: 'exclusions', label: 'Exclusions', description: 'Who should be excluded', icon: AlertTriangle },
  { id: 'review', label: 'Review', description: 'Review and create measure', icon: Sparkles },
];

const MEASURE_PROGRAMS = [
  { value: 'MIPS_CQM', label: 'MIPS CQM' },
  { value: 'eCQM', label: 'eCQM' },
  { value: 'HEDIS', label: 'HEDIS' },
  { value: 'QOF', label: 'QOF' },
  { value: 'Registry', label: 'Registry' },
  { value: 'Custom', label: 'Custom' },
];

const MEASURE_TYPES = [
  { value: 'process', label: 'Process' },
  { value: 'outcome', label: 'Outcome' },
  { value: 'structure', label: 'Structure' },
  { value: 'patient_experience', label: 'Patient Experience' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function generateId() {
  return `ums-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Main Component
// ============================================================================

export function MeasureCreator({ isOpen, onClose }) {
  const { measures, importMeasure, createMeasure, setActiveMeasure, setActiveTab } = useMeasureStore();

  // Wizard state
  const [currentStep, setCurrentStep] = useState('start');
  const [mode, setMode] = useState('ai_guided'); // 'ai_guided' | 'blank' | 'copy'
  const [sourceMeasureId, setSourceMeasureId] = useState(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Metadata state
  const [measureId, setMeasureId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [program, setProgram] = useState('MIPS_CQM');
  const [measureType, setMeasureType] = useState('process');
  const [steward, setSteward] = useState('');

  // Population criteria state
  const [initialPopCriteria, setInitialPopCriteria] = useState({
    description: '',
    ageRange: { min: undefined, max: undefined },
    criteriaBlocks: [],
  });
  const [numeratorCriteria, setNumeratorCriteria] = useState({
    description: '',
    criteriaBlocks: [],
  });
  const [exclusionCriteria, setExclusionCriteria] = useState({
    description: '',
    criteriaBlocks: [],
  });

  // AI extraction state
  const [aiInputText, setAiInputText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiProgress, setAiProgress] = useState({ phase: '', message: '' });
  const [extractedUMS, setExtractedUMS] = useState(null);
  const fileInputRef = useRef(null);

  // Available value sets (would come from API/store in real app)
  const availableValueSets = useMemo(() => [], []);

  // AI Extraction handler
  const handleAIExtraction = useCallback(async () => {
    // Combine pasted text and uploaded files
    let documentText = aiInputText;

    if (uploadedFiles.length > 0) {
      setAiProcessing(true);
      setAiProgress({ phase: 'files', message: 'Extracting text from files...' });

      try {
        const fileText = await extractTextFromFiles(uploadedFiles);
        documentText = documentText ? `${documentText}\n\n${fileText}` : fileText;
      } catch (error) {
        setAiError(`Failed to extract text from files: ${error.message}`);
        setAiProcessing(false);
        return false;
      }
    }

    if (!documentText || documentText.trim().length < 50) {
      // Not enough text, skip extraction
      return true;
    }

    setAiProcessing(true);
    setAiError(null);
    setAiProgress({ phase: 'starting', message: 'Starting AI extraction...' });

    try {
      const result = await extractMeasure(documentText, {
        onProgress: (phase, message) => {
          setAiProgress({ phase, message });
        },
      });

      if (!result.success) {
        setAiError(result.error || 'Extraction failed');
        setAiProcessing(false);
        return false;
      }

      // Store extracted UMS and populate form fields
      setExtractedUMS(result.ums);

      // Populate metadata
      const meta = result.ums.metadata;
      setMeasureId(meta.measureId || '');
      setTitle(meta.title || '');
      setDescription(meta.description || '');
      setProgram(meta.program || 'MIPS_CQM');
      setMeasureType(meta.measureType || 'process');
      setSteward(meta.steward || '');

      // Populate population descriptions
      const ip = result.ums.populations?.find(p =>
        p.type === 'initial_population' || p.type === 'denominator'
      );
      const num = result.ums.populations?.find(p => p.type === 'numerator');
      const excl = result.ums.populations?.find(p =>
        p.type === 'denominator_exclusion' || p.type === 'denominator_exception'
      );

      if (ip) {
        setInitialPopCriteria(prev => ({
          ...prev,
          description: ip.description || ip.narrative || '',
        }));
      }
      if (num) {
        setNumeratorCriteria(prev => ({
          ...prev,
          description: num.description || num.narrative || '',
        }));
      }
      if (excl) {
        setExclusionCriteria(prev => ({
          ...prev,
          description: excl.description || excl.narrative || '',
        }));
      }

      // Set age constraints if present
      if (result.ums.globalConstraints) {
        const gc = result.ums.globalConstraints;
        setInitialPopCriteria(prev => ({
          ...prev,
          ageRange: {
            min: gc.ageMin ?? undefined,
            max: gc.ageMax ?? undefined,
          },
        }));
      }

      setAiProcessing(false);
      setAiProgress({ phase: 'complete', message: 'Extraction complete!' });
      return true;
    } catch (error) {
      console.error('AI extraction error:', error);
      setAiError(error.message || 'An unexpected error occurred');
      setAiProcessing(false);
      return false;
    }
  }, [aiInputText, uploadedFiles]);

  // Navigation
  const getCurrentStepIndex = () => STEPS.findIndex(s => s.id === currentStep);

  const canGoNext = () => {
    switch (currentStep) {
      case 'start':
        return mode === 'copy' ? !!sourceMeasureId : true;
      case 'ai_input':
        return true; // Can skip
      case 'metadata':
        return measureId.trim() && title.trim();
      case 'initial_pop':
      case 'numerator':
      case 'exclusions':
        return true; // Optional steps
      case 'review':
        return true;
      default:
        return true;
    }
  };

  const goNext = async () => {
    const currentIndex = getCurrentStepIndex();

    // Skip AI input step for non-AI modes
    if (currentStep === 'start' && mode !== 'ai_guided') {
      setCurrentStep('metadata');
      return;
    }

    // Handle AI extraction when leaving ai_input step
    if (currentStep === 'ai_input' && (aiInputText.trim() || uploadedFiles.length > 0)) {
      const success = await handleAIExtraction();
      if (!success && aiError) {
        // Stay on this step if extraction failed
        return;
      }
    }

    // Skip to review for copy/blank mode after metadata
    if ((mode === 'copy' || mode === 'blank') && currentStep === 'metadata') {
      setCurrentStep('review');
      return;
    }

    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  };

  const goBack = () => {
    const currentIndex = getCurrentStepIndex();

    // Handle special cases
    if ((mode === 'copy' || mode === 'blank') && currentStep === 'review') {
      setCurrentStep('metadata');
      return;
    }

    if (currentStep === 'metadata' && mode !== 'ai_guided') {
      setCurrentStep('start');
      return;
    }

    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  // Close handling
  const handleCloseRequest = () => {
    const hasProgress = measureId || title || aiInputText || uploadedFiles.length > 0;
    if (hasProgress) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowCloseConfirm(false);
  };

  // Create measure
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    const now = new Date().toISOString();
    const id = generateId();

    let newMeasure;
    let useFullImport = false;

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
      };
      useFullImport = true;
    } else if (extractedUMS && mode === 'ai_guided') {
      // Use AI-extracted UMS with full population structure
      newMeasure = {
        ...extractedUMS,
        id,
        // Override metadata with any user edits
        metadata: {
          ...extractedUMS.metadata,
          measureId: measureId || extractedUMS.metadata.measureId,
          title: title || extractedUMS.metadata.title,
          description: description || extractedUMS.metadata.description,
          steward: steward || extractedUMS.metadata.steward,
          program: program || extractedUMS.metadata.program,
          measureType: measureType || extractedUMS.metadata.measureType,
          lastUpdated: now,
        },
        status: 'in_progress',
        createdAt: now,
        updatedAt: now,
      };
      useFullImport = true;
    } else {
      // Create new measure (blank or AI-guided without extraction)
      newMeasure = {
        id,
        metadata: {
          measureId: measureId || 'NEW-001',
          title: title || 'New Measure',
          version: '1.0',
          steward: steward || 'Organization',
          program,
          measureType,
          description: description || 'New custom measure',
          measurementPeriod: {
            start: `${new Date().getFullYear()}-01-01`,
            end: `${new Date().getFullYear()}-12-31`,
            inclusive: true,
          },
          lastUpdated: now,
        },
        populations: [
          {
            id: `ip-${Date.now()}`,
            type: 'initial_population',
            description: initialPopCriteria.description || 'Initial Population',
            narrative: initialPopCriteria.description || 'Define the initial population criteria',
            criteria: {
              id: `ip-criteria-${Date.now()}`,
              operator: 'AND',
              description: 'Initial Population Criteria',
              children: [],
              confidence: 'medium',
              reviewStatus: 'pending',
            },
            confidence: 'medium',
            reviewStatus: 'pending',
          },
          {
            id: `den-${Date.now()}`,
            type: 'denominator',
            description: 'Denominator equals Initial Population',
            narrative: 'Denominator = Initial Population',
            criteria: {
              id: `den-criteria-${Date.now()}`,
              operator: 'AND',
              description: 'Denominator Criteria',
              children: [],
              confidence: 'medium',
              reviewStatus: 'pending',
            },
            confidence: 'medium',
            reviewStatus: 'pending',
          },
          {
            id: `num-${Date.now()}`,
            type: 'numerator',
            description: numeratorCriteria.description || 'Numerator',
            narrative: numeratorCriteria.description || 'Define the numerator criteria',
            criteria: {
              id: `num-criteria-${Date.now()}`,
              operator: 'AND',
              description: 'Numerator Criteria',
              children: [],
              confidence: 'medium',
              reviewStatus: 'pending',
            },
            confidence: 'medium',
            reviewStatus: 'pending',
          },
        ],
        valueSets: [],
        status: 'in_progress',
        overallConfidence: 'medium',
        reviewProgress: {
          total: 3,
          approved: 0,
          pending: 3,
          flagged: 0,
        },
        createdAt: now,
        updatedAt: now,
      };

      // Add exclusion population if specified
      if (exclusionCriteria.description || exclusionCriteria.criteriaBlocks?.length) {
        newMeasure.populations.push({
          id: `denex-${Date.now()}`,
          type: 'denominator_exclusion',
          description: exclusionCriteria.description || 'Denominator Exclusion',
          narrative: exclusionCriteria.description || 'Exclusion criteria',
          criteria: {
            id: `denex-criteria-${Date.now()}`,
            operator: 'OR',
            description: 'Exclusion criteria',
            children: [],
            confidence: 'medium',
            reviewStatus: 'pending',
          },
          confidence: 'medium',
          reviewStatus: 'pending',
        });
      }
      useFullImport = true;
    }

    // Persist to backend
    setIsCreating(true);
    try {
      let result;
      if (useFullImport) {
        // Use import endpoint for full measure with populations
        result = await importMeasure(newMeasure);
      } else {
        // Use simple create endpoint for basic measures
        result = await createMeasure({
          measureId: newMeasure.metadata.measureId,
          title: newMeasure.metadata.title,
          version: newMeasure.metadata.version,
          steward: newMeasure.metadata.steward,
          program: newMeasure.metadata.program,
          measureType: newMeasure.metadata.measureType,
          description: newMeasure.metadata.description,
          status: 'IN_PROGRESS',
        });
      }

      if (result) {
        setActiveMeasure(result.id);
        setActiveTab('editor');
        onClose();
      }
    } catch (error) {
      console.error('Failed to create measure:', error);
      // Could show error to user here
    } finally {
      setIsCreating(false);
    }
  };

  // File handling
  const handleFileSelect = (files) => {
    setUploadedFiles(prev => [...prev, ...Array.from(files)]);
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  // Get visible steps based on mode
  const visibleSteps = mode === 'ai_guided'
    ? STEPS
    : STEPS.filter(s => ['start', 'metadata', 'review'].includes(s.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleCloseRequest}
      />

      {/* Unsaved Changes Confirmation Dialog */}
      {showCloseConfirm && (
        <div className="absolute inset-0 z-60 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCancelClose} />
          <div className="relative bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-2xl p-6 max-w-md mx-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[var(--warning-light)] flex items-center justify-center flex-shrink-0">
                <Save className="w-6 h-6 text-[var(--warning)]" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Unsaved Changes</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  You have unsaved progress on this measure. Are you sure you want to close without saving?
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCancelClose}
                    className="flex-1 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    Keep Editing
                  </button>
                  <button
                    onClick={handleConfirmClose}
                    className="flex-1 px-4 py-2 bg-rose-500/20 border border-rose-500/40 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/30 transition-colors"
                  >
                    Discard Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[var(--bg)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-secondary)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Create New Measure</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Step-by-step measure authoring
            </p>
          </div>
          <button
            onClick={handleCloseRequest}
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
                const Icon = step.icon || File;

                return (
                  <div key={step.id} className="flex items-center">
                    <button
                      onClick={() => isComplete && setCurrentStep(step.id)}
                      disabled={!isComplete}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                        isCurrent
                          ? 'bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]/40'
                          : isComplete
                          ? 'text-[var(--success)] hover:bg-[var(--success-light)] cursor-pointer'
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
                  onClick={() => setMode('ai_guided')}
                  className={`p-6 rounded-xl border-2 text-left transition-all hover:border-[var(--accent)]/50 ${
                    mode === 'ai_guided' ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border)]'
                  }`}
                >
                  <div className="w-14 h-14 rounded-xl bg-[var(--accent-light)] flex items-center justify-center mb-4">
                    <Brain className="w-7 h-7 text-[var(--accent)]" />
                  </div>
                  <h3 className="font-semibold text-[var(--text)] mb-2">AI-Guided Builder</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Paste measure specs and let AI extract populations, criteria, and value sets
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs text-[var(--accent)]">
                    <Wand2 className="w-3 h-3" />
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
                  disabled={measures.length === 0}
                  className={`p-6 rounded-xl border-2 text-left transition-all hover:border-[var(--success)]/50 ${
                    mode === 'copy' ? 'border-[var(--success)] bg-[var(--success-light)]' : 'border-[var(--border)]'
                  } ${measures.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="w-14 h-14 rounded-xl bg-[var(--success-light)] flex items-center justify-center mb-4">
                    <Copy className="w-7 h-7 text-[var(--success)]" />
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
                            ? 'border-[var(--success)] bg-[var(--success-light)]'
                            : 'border-[var(--border)] hover:border-[var(--text-dim)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-mono text-[var(--text-muted)]">{m.metadata.measureId}</span>
                            <div className="text-sm font-medium text-[var(--text)]">{m.metadata.title}</div>
                          </div>
                          {sourceMeasureId === m.id && <Check className="w-5 h-5 text-[var(--success)]" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: AI Input */}
          {currentStep === 'ai_input' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--accent-light)] flex items-center justify-center">
                  <Brain className="w-8 h-8 text-[var(--accent)]" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--text)] mb-2">AI-Guided Extraction</h3>
                <p className="text-[var(--text-muted)]">
                  Upload a PDF or paste your measure specification. AI will extract the structure.
                </p>
              </div>

              {/* AI Processing Indicator */}
              {aiProcessing && (
                <div className="p-4 bg-[var(--accent-light)] border border-[var(--accent)]/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
                    <div>
                      <div className="text-sm font-medium text-[var(--accent)]">
                        {aiProgress.phase === 'files' ? 'Processing Files' :
                         aiProgress.phase === 'skeleton' ? 'Analyzing Structure' :
                         aiProgress.phase === 'extraction' ? 'Extracting Populations' :
                         aiProgress.phase === 'converting' ? 'Finalizing' :
                         'Processing...'}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">{aiProgress.message}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {aiError && !aiProcessing && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-rose-400">Extraction Error</div>
                      <div className="text-xs text-[var(--text-muted)] mt-1">{aiError}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* File Upload Section */}
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Upload PDF
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--accent)] transition-colors"
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)]">
                    Click to upload PDF or drag and drop
                  </p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">
                    Supports PDF, TXT, and MD files
                  </p>
                </div>

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-[var(--accent)]" />
                          <div>
                            <div className="text-sm font-medium text-[var(--text)]">{file.name}</div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {(file.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(idx)}
                          className="p-1 text-[var(--text-muted)] hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 text-[var(--text-dim)]">
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-xs uppercase">or paste text</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>

              <div className="flex items-start gap-3 p-4 bg-[var(--accent-light)] border border-[var(--accent)]/20 rounded-lg">
                <Info className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-muted)]">
                  <strong>Tip:</strong> Paste the full measure specification text, including populations,
                  criteria, and any timing/quantity requirements. The more detail, the better the extraction.
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Measure Specification
                </label>
                <textarea
                  value={aiInputText}
                  onChange={(e) => setAiInputText(e.target.value)}
                  placeholder="Paste your measure specification here..."
                  rows={10}
                  disabled={aiProcessing}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] resize-none text-sm disabled:opacity-50"
                />
              </div>

              <div className="text-center text-sm text-[var(--text-dim)]">
                Or <button onClick={() => setCurrentStep('metadata')} disabled={aiProcessing} className="text-[var(--accent)] hover:underline disabled:opacity-50">skip this step</button> to build the measure manually.
              </div>
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
                    Measure ID <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={measureId}
                    onChange={(e) => setMeasureId(e.target.value)}
                    placeholder="e.g., CMS123v1"
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Program <span className="text-[var(--danger)]">*</span>
                  </label>
                  <select
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    {MEASURE_PROGRAMS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Title <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Diabetes: Hemoglobin A1c Control"
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
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
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Measure Type
                  </label>
                  <select
                    value={measureType}
                    onChange={(e) => setMeasureType(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    {MEASURE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
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
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step: Denominator */}
          {currentStep === 'initial_pop' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/15 flex items-center justify-center">
                  <Users className="w-8 h-8 text-[var(--accent)]" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Denominator</h3>
                <p className="text-[var(--text-muted)]">
                  Define who is eligible to be evaluated by this measure
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Denominator Description
                </label>
                <textarea
                  value={initialPopCriteria.description}
                  onChange={(e) => setInitialPopCriteria({ ...initialPopCriteria, description: e.target.value })}
                  placeholder="e.g., Patients 18-85 years of age with a diagnosis of essential hypertension..."
                  rows={2}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] resize-none"
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
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
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
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border)]">
                <CriteriaBlockBuilder
                  criteria={initialPopCriteria.criteriaBlocks || []}
                  onChange={(blocks) => setInitialPopCriteria({ ...initialPopCriteria, criteriaBlocks: blocks })}
                  availableValueSets={availableValueSets}
                  populationContext="Denominator"
                />
              </div>
            </div>
          )}

          {/* Step: Numerator */}
          {currentStep === 'numerator' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--success-light)] flex items-center justify-center">
                  <Check className="w-8 h-8 text-[var(--success)]" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Numerator</h3>
                <p className="text-[var(--text-muted)]">
                  Define the criteria that indicate successful performance
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Numerator Description
                </label>
                <textarea
                  value={numeratorCriteria.description}
                  onChange={(e) => setNumeratorCriteria({ ...numeratorCriteria, description: e.target.value })}
                  placeholder="e.g., Patients who received all recommended immunizations..."
                  rows={2}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--success)] resize-none"
                />
              </div>

              <div className="pt-4 border-t border-[var(--border)]">
                <CriteriaBlockBuilder
                  criteria={numeratorCriteria.criteriaBlocks || []}
                  onChange={(blocks) => setNumeratorCriteria({ ...numeratorCriteria, criteriaBlocks: blocks })}
                  availableValueSets={availableValueSets}
                  populationContext="Numerator"
                />
              </div>
            </div>
          )}

          {/* Step: Exclusions */}
          {currentStep === 'exclusions' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--warning-light)] flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-[var(--warning)]" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Exclusions & Exceptions</h3>
                <p className="text-[var(--text-muted)]">
                  Define criteria that remove patients from the denominator (optional)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Exclusion Description
                </label>
                <textarea
                  value={exclusionCriteria.description}
                  onChange={(e) => setExclusionCriteria({ ...exclusionCriteria, description: e.target.value })}
                  placeholder="e.g., Patients in hospice care, patients with ESRD..."
                  rows={2}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--warning)] resize-none"
                />
              </div>

              <div className="text-sm text-[var(--text-dim)] italic">
                Leave blank if no exclusions apply to this measure.
              </div>

              <div className="pt-4 border-t border-[var(--border)]">
                <CriteriaBlockBuilder
                  criteria={exclusionCriteria.criteriaBlocks || []}
                  onChange={(blocks) => setExclusionCriteria({ ...exclusionCriteria, criteriaBlocks: blocks })}
                  availableValueSets={availableValueSets}
                  populationContext="Exclusions"
                />
              </div>
            </div>
          )}

          {/* Step: Review */}
          {currentStep === 'review' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--success-light)] flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-[var(--success)]" />
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

                {/* Mode info */}
                {mode === 'copy' && sourceMeasureId && (
                  <div className="p-4 bg-[var(--success-light)] rounded-lg border border-[var(--success)]/20">
                    <div className="flex items-center gap-2 text-[var(--success)] text-sm font-medium mb-2">
                      <Copy className="w-4 h-4" />
                      Copying From
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                      {measures.find(m => m.id === sourceMeasureId)?.metadata.title}
                    </p>
                  </div>
                )}

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

                {mode === 'ai_guided' && extractedUMS && (
                  <div className="p-4 bg-[var(--accent-light)] rounded-lg border border-[var(--accent)]/20">
                    <div className="flex items-center gap-2 text-[var(--accent)] text-sm font-medium mb-2">
                      <Brain className="w-4 h-4" />
                      AI Extraction Complete
                    </div>
                    <div className="text-sm text-[var(--text-muted)] space-y-1">
                      <p>Extracted {extractedUMS.populations?.length || 0} populations:</p>
                      <ul className="list-disc list-inside ml-2 text-xs">
                        {extractedUMS.populations?.map((pop, idx) => (
                          <li key={idx}>
                            {pop.type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            {pop.criteria?.children?.length > 0 && ` (${pop.criteria.children.length} criteria)`}
                          </li>
                        ))}
                      </ul>
                      {extractedUMS.valueSets?.length > 0 && (
                        <p className="mt-2">Found {extractedUMS.valueSets.length} value sets</p>
                      )}
                    </div>
                  </div>
                )}

                {mode === 'ai_guided' && !extractedUMS && (
                  <div className="p-4 bg-[var(--warning-light)] rounded-lg border border-[var(--warning)]/20">
                    <div className="flex items-center gap-2 text-[var(--warning)] text-sm font-medium mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      Manual Entry Mode
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                      No AI extraction was performed. Your measure will start with empty populations.
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
              onClick={handleCloseRequest}
              className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>

            {currentStep === 'review' ? (
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="px-6 py-2.5 bg-[var(--success)] text-white rounded-lg font-medium hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Measure
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={!canGoNext() || aiProcessing}
                className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {aiProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : currentStep === 'ai_input' && (aiInputText.trim() || uploadedFiles.length > 0) ? (
                  <>
                    <Brain className="w-4 h-4" />
                    Extract with AI
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MeasureCreator;
