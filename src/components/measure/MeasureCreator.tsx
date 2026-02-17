import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { X, Plus, FileText, Copy, ChevronRight, ChevronLeft, Check, Users, Target, AlertTriangle, Minus, Sparkles, ArrowRight, Info, Save, Wand2, Loader2, AlertCircle, Brain, Upload, File, Trash2 } from 'lucide-react';
import { useMeasureStore } from '../../stores/measureStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { extractFromFiles, type ExtractedDocument } from '../../services/documentLoader';
import { callLLM, getDefaultModel } from '../../services/llmClient';
import { extractMeasure as extractMeasureFromBackend } from '../../services/extractionService';
import type { UniversalMeasureSpec, MeasureMetadata, PopulationDefinition, ValueSetReference, LogicalClause, DataElement, ConfidenceLevel } from '../../types/ums';
import { CriteriaBlockBuilder, type CriteriaBlock } from './CriteriaBlockBuilder';

// Step definitions for the wizard
type WizardStep =
  | 'start'           // Choose creation method
  | 'ai_input'        // Paste free text for AI parsing (AI-Guided mode only)
  | 'metadata'        // Basic measure information
  | 'initial_pop'     // Define Initial Population (with value sets)
  | 'denominator'     // Define Denominator (with value sets)
  | 'numerator'       // Define Numerator (with value sets)
  | 'exclusions'      // Define Exclusions/Exceptions (with value sets)
  | 'review';         // Review and create

type CreationMode = 'blank' | 'copy' | 'ai_guided';
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
  // New: Advanced criteria blocks for complex logic
  criteriaBlocks?: CriteriaBlock[];
}

interface MeasureCreatorProps {
  isOpen: boolean;
  onClose: () => void;
}

// Step configuration - value sets are now integrated into each population step
// Note: initial_pop is now labeled "Denominator" and the separate denominator step is hidden
const STEPS: { id: WizardStep; label: string; icon: typeof Users; description: string }[] = [
  { id: 'start', label: 'Start', icon: Plus, description: 'Choose creation method' },
  { id: 'ai_input', label: 'AI Input', icon: Brain, description: 'Paste measure specification for AI analysis' },
  { id: 'metadata', label: 'Basics', icon: FileText, description: 'Measure information' },
  { id: 'initial_pop', label: 'Denominator', icon: Users, description: 'Define eligible patients & value sets' },
  { id: 'numerator', label: 'Numerator', icon: Check, description: 'Define success criteria & value sets' },
  { id: 'exclusions', label: 'Exclusions', icon: Minus, description: 'Define exclusions & value sets' },
  { id: 'review', label: 'Review', icon: Sparkles, description: 'Review and create' },
];

// AI-parsed value set match with confidence
interface AIValueSetMatch {
  existingValueSet?: ValueSetReference;
  suggestedName: string;
  suggestedOid?: string;
  confidence: ConfidenceLevel;
  isPlaceholder: boolean;
  matchReason?: string;
}

// AI extraction result for criteria
interface AIExtractedCriterion {
  resourceType: string;
  description: string;
  valueSetMatch?: AIValueSetMatch;
  timing?: {
    type: string;
    value?: number;
    unit?: string;
    ageValue?: number;
    ageUnit?: string;
    relativeTo?: string;
  };
  quantity?: {
    comparator: string;
    value: number;
    maxValue?: number;
  };
  negation?: boolean;
  confidence: ConfidenceLevel;
}

export function MeasureCreator({ isOpen, onClose }: MeasureCreatorProps) {
  const { measures, addMeasure, importMeasure, setActiveMeasure, setActiveTab } = useMeasureStore();
  const { selectedProvider, selectedModel, apiKeys, getActiveApiKey, getCustomLlmConfig } = useSettingsStore();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('start');
  const [mode, setMode] = useState<CreationMode>('ai_guided');

  // AI input state
  const [aiInputText, setAiInputText] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiProgress, setAiProgress] = useState<string>('');
  const [aiExtractedData, setAiExtractedData] = useState<{
    metadata?: {
      measureId?: string;
      title?: string;
      description?: string;
      program?: string;
      measureType?: string;
      ageRange?: { min?: number; max?: number };
    };
    populations?: {
      type: string;
      description: string;
      criteria: AIExtractedCriterion[];
    }[];
    valueSets?: AIValueSetMatch[];
  } | null>(null);

  // Extracted UMS from backend extraction service (used directly in handleCreate)
  const [extractedUMS, setExtractedUMS] = useState<UniversalMeasureSpec | null>(null);

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [extractedDocuments, setExtractedDocuments] = useState<ExtractedDocument[]>([]);
  const [extractedContent, setExtractedContent] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    criteriaBlocks: [],
  });
  const [denominatorCriteria, setDenominatorCriteria] = useState<CriteriaDefinition>({
    description: '',
    valueSets: new Set(),
    criteriaBlocks: [],
  });
  const [numeratorCriteria, setNumeratorCriteria] = useState<CriteriaDefinition>({
    description: '',
    valueSets: new Set(),
    criteriaBlocks: [],
  });
  const [exclusionCriteria, setExclusionCriteria] = useState<CriteriaDefinition>({
    description: '',
    valueSets: new Set(),
    criteriaBlocks: [],
  });

  // Generated CQL for each population (updated in background)
  const [generatedCql, setGeneratedCql] = useState<{
    initialPop: string;
    denominator: string;
    numerator: string;
    exclusions: string;
  }>({ initialPop: '', denominator: '', numerator: '', exclusions: '' });

  // Unsaved changes tracking
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);


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

  const resetForm = () => {
    setCurrentStep('start');
    setMode('ai_guided');
    setMeasureId('');
    setTitle('');
    setDescription('');
    setProgram('MIPS_CQM');
    setMeasureType('process');
    setScoringType('proportion');
    setSteward('');
    setRationale('');
    setSourceMeasureId(null);
    setInitialPopCriteria({ description: '', ageRange: {}, valueSets: new Set(), criteriaBlocks: [] });
    setDenominatorCriteria({ description: '', valueSets: new Set(), criteriaBlocks: [] });
    setNumeratorCriteria({ description: '', valueSets: new Set(), criteriaBlocks: [] });
    setExclusionCriteria({ description: '', valueSets: new Set(), criteriaBlocks: [] });
    setGeneratedCql({ initialPop: '', denominator: '', numerator: '', exclusions: '' });
    setShowCloseConfirm(false);
    // Reset AI state
    setAiInputText('');
    setAiProcessing(false);
    setAiError(null);
    setAiProgress('');
    setAiExtractedData(null);
    setExtractedUMS(null);
    // Reset file upload state
    setUploadedFiles([]);
    setExtractedDocuments([]);
    setExtractedContent('');
    setIsDragging(false);
  };

  // Check if user has made any progress worth saving
  const hasUnsavedChanges = useCallback(() => {
    // If still on start step, nothing to save
    if (currentStep === 'start') return false;

    // Check if any meaningful data has been entered
    const hasMetadata = measureId.trim() || title.trim() || description.trim();
    const hasAiInput = aiInputText.trim().length > 100 || aiExtractedData !== null || uploadedFiles.length > 0;
    const hasInitialPop = initialPopCriteria.description.trim() ||
                          initialPopCriteria.ageRange?.min !== undefined ||
                          initialPopCriteria.ageRange?.max !== undefined ||
                          (initialPopCriteria.criteriaBlocks?.length || 0) > 0;
    const hasDenominator = denominatorCriteria.description.trim() ||
                           (denominatorCriteria.criteriaBlocks?.length || 0) > 0;
    const hasNumerator = numeratorCriteria.description.trim() ||
                         (numeratorCriteria.criteriaBlocks?.length || 0) > 0;
    const hasExclusions = exclusionCriteria.description.trim() ||
                          (exclusionCriteria.criteriaBlocks?.length || 0) > 0;

    return hasMetadata || hasAiInput || hasInitialPop || hasDenominator || hasNumerator || hasExclusions;
  }, [currentStep, measureId, title, description, aiInputText, aiExtractedData, uploadedFiles, initialPopCriteria, denominatorCriteria, numeratorCriteria, exclusionCriteria]);

  const handleCloseRequest = () => {
    if (hasUnsavedChanges()) {
      setShowCloseConfirm(true);
    } else {
      resetForm();
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    resetForm();
    onClose();
  };

  const handleCancelClose = () => {
    setShowCloseConfirm(false);
  };

  // Close without confirmation (used after successful create)
  const handleCloseAfterSave = () => {
    resetForm();
    onClose();
  };

  // Navigation
  const getCurrentStepIndex = () => STEPS.findIndex(s => s.id === currentStep);

  // File upload handlers
  const handleFileSelect = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'html', 'htm', 'xlsx', 'xls', 'csv', 'zip', 'txt', 'md', 'cql', 'json', 'xml'].includes(ext || '');
    });

    if (validFiles.length === 0) {
      setAiError('No valid files selected. Supported formats: PDF, HTML, Excel, CSV, ZIP, TXT, CQL, JSON, XML');
      return;
    }

    setUploadedFiles(prev => [...prev, ...validFiles]);
    setAiError(null);
    setAiProgress('Extracting content from files...');

    try {
      const result = await extractFromFiles(validFiles);
      setExtractedDocuments(prev => [...prev, ...result.documents]);
      setExtractedContent(prev => prev + '\n\n' + result.combinedContent);
      setAiProgress(`Extracted content from ${result.documents.length} file(s)`);

      if (result.errors.length > 0) {
        console.warn('File extraction warnings:', result.errors);
      }
    } catch (err) {
      setAiError(`Failed to extract content: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setExtractedDocuments(prev => prev.filter((_, i) => i !== index));
    // Re-combine remaining content
    setExtractedContent(extractedDocuments
      .filter((_, i) => i !== index)
      .map(d => `\n=== FILE: ${d.filename} (${d.fileType}) ===\n${d.content}`)
      .join('\n\n'));
  }, [extractedDocuments]);

  const clearAllFiles = useCallback(() => {
    setUploadedFiles([]);
    setExtractedDocuments([]);
    setExtractedContent('');
  }, []);

  // Get the current API key based on provider
  const getCurrentApiKey = useCallback(() => {
    return getActiveApiKey();
  }, [getActiveApiKey]);

  // Match value sets from AI extraction against existing value sets
  const matchValueSets = useCallback((suggestedName: string, suggestedOid?: string): AIValueSetMatch => {
    // Try exact OID match first (high confidence)
    if (suggestedOid) {
      const oidMatch = availableValueSets.find(v => v.valueSet.oid === suggestedOid);
      if (oidMatch) {
        return {
          existingValueSet: oidMatch.valueSet,
          suggestedName,
          suggestedOid,
          confidence: 'high',
          isPlaceholder: false,
          matchReason: 'Exact OID match',
        };
      }
    }

    // Try name-based matching (medium confidence)
    const normalizedName = suggestedName.toLowerCase().trim();
    for (const vs of availableValueSets) {
      const vsName = vs.valueSet.name.toLowerCase().trim();
      // Exact name match
      if (vsName === normalizedName) {
        return {
          existingValueSet: vs.valueSet,
          suggestedName,
          suggestedOid,
          confidence: 'high',
          isPlaceholder: false,
          matchReason: 'Exact name match',
        };
      }
      // Partial name match
      if (vsName.includes(normalizedName) || normalizedName.includes(vsName)) {
        return {
          existingValueSet: vs.valueSet,
          suggestedName,
          suggestedOid,
          confidence: 'medium',
          isPlaceholder: false,
          matchReason: 'Partial name match',
        };
      }
    }

    // No match found - create placeholder (low confidence)
    return {
      suggestedName,
      suggestedOid,
      confidence: 'low',
      isPlaceholder: true,
      matchReason: 'No existing match - placeholder created',
    };
  }, [availableValueSets]);

  // Convert AI extracted data to CriteriaBlocks
  const convertToCriteriaBlocks = useCallback((criteria: AIExtractedCriterion[]): CriteriaBlock[] => {
    return criteria.map((crit, idx) => {
      const block: CriteriaBlock = {
        id: `ai-block-${Date.now()}-${idx}`,
        type: 'criterion',
        resourceType: crit.resourceType as CriteriaBlock['resourceType'],
        description: crit.description,
        confidence: crit.confidence,
        negation: crit.negation,
      };

      // Add value set reference if we have a match
      if (crit.valueSetMatch?.existingValueSet) {
        block.valueSetId = crit.valueSetMatch.existingValueSet.oid || crit.valueSetMatch.existingValueSet.id;
      }

      // Add timing if present
      if (crit.timing && crit.timing.type) {
        block.timing = {
          type: crit.timing.type as 'during_measurement_period' | 'before_measurement_period' | 'by_age' | 'within_days_of' | 'within_months_of' | 'within_years_of' | 'anytime',
          value: crit.timing.value,
          unit: crit.timing.unit as 'days' | 'months' | 'years' | undefined,
          ageValue: crit.timing.ageValue,
          ageUnit: crit.timing.ageUnit as 'days' | 'months' | 'years' | undefined,
          relativeTo: crit.timing.relativeTo,
        };
      }

      // Add quantity if present
      if (crit.quantity && crit.quantity.comparator) {
        block.quantity = {
          comparator: crit.quantity.comparator as '>=' | '>' | '<=' | '<' | '=' | 'between',
          value: crit.quantity.value,
          maxValue: crit.quantity.maxValue,
        };
      }

      return block;
    });
  }, []);

  // Process AI input and extract measure structure using backend extraction service
  const processAiInput = useCallback(async () => {
    // Combine extracted file content with free text input
    const combinedInput = [
      extractedContent.trim(),
      aiInputText.trim()
    ].filter(Boolean).join('\n\n--- Additional Context ---\n\n');

    if (!combinedInput) {
      setAiError('Please upload files or enter measure specification text.');
      return;
    }

    setAiProcessing(true);
    setAiError(null);
    setAiProgress('Analyzing measure specification...');

    try {
      // Use backend extraction service (routes through /api/llm/extract)
      const result = await extractMeasureFromBackend(combinedInput, {
        onProgress: (phase, message) => {
          setAiProgress(message);
        },
      });

      if (!result.success || !result.ums) {
        throw new Error(result.error || 'Extraction failed');
      }

      // Store the extracted UMS for use in handleCreate
      setExtractedUMS(result.ums);

      // Extract metadata and populations for form population
      const ums = result.ums;

      // Update aiExtractedData for UI display
      setAiExtractedData({
        metadata: {
          measureId: ums.metadata.measureId,
          title: ums.metadata.title,
          description: ums.metadata.description,
          program: ums.metadata.program,
          measureType: ums.metadata.measureType,
          ageRange: ums.globalConstraints?.ageRange ? {
            min: ums.globalConstraints.ageRange.min,
            max: ums.globalConstraints.ageRange.max,
          } : undefined,
        },
        populations: ums.populations.map(pop => ({
          type: pop.type.replace(/-/g, '_'),
          description: pop.description || '',
          criteria: [], // Simplified - full data is in extractedUMS
        })),
      });

      // Auto-populate form fields from extracted metadata
      if (ums.metadata.measureId) setMeasureId(ums.metadata.measureId);
      if (ums.metadata.title) setTitle(ums.metadata.title);
      if (ums.metadata.description) setDescription(ums.metadata.description);
      if (ums.metadata.measureType) setMeasureType(ums.metadata.measureType);
      if (ums.metadata.steward) setSteward(ums.metadata.steward);
      if (ums.metadata.rationale) setRationale(ums.metadata.rationale);

      // Map program to dropdown value
      if (ums.metadata.program) {
        const programMap: Record<string, MeasureProgram> = {
          'MIPS_CQM': 'MIPS_CQM',
          'MIPS': 'MIPS_CQM',
          'eCQM': 'eCQM',
          'ECQM': 'eCQM',
          'HEDIS': 'HEDIS',
          'QOF': 'QOF',
          'Registry': 'Registry',
          'Custom': 'Custom',
        };
        const mappedProgram = programMap[ums.metadata.program] || 'Custom';
        setProgram(mappedProgram);
      }

      // Set age range if available
      if (ums.globalConstraints?.ageRange) {
        setInitialPopCriteria(prev => ({
          ...prev,
          ageRange: {
            min: ums.globalConstraints?.ageRange?.min,
            max: ums.globalConstraints?.ageRange?.max,
          },
        }));
      }

      // Auto-populate population descriptions
      for (const pop of ums.populations) {
        const popType = pop.type.replace(/-/g, '_');

        switch (popType) {
          case 'initial_population':
            setInitialPopCriteria(prev => ({
              ...prev,
              description: pop.description || pop.narrative || '',
            }));
            break;
          case 'denominator':
            setDenominatorCriteria(prev => ({
              ...prev,
              description: pop.description || pop.narrative || '',
            }));
            break;
          case 'numerator':
            setNumeratorCriteria(prev => ({
              ...prev,
              description: pop.description || pop.narrative || '',
            }));
            break;
          case 'denominator_exclusion':
          case 'denominator_exception':
            setExclusionCriteria(prev => ({
              ...prev,
              description: pop.description || pop.narrative || '',
            }));
            break;
        }
      }

      setAiProgress(`Complete! Extracted ${ums.populations.length} populations. Review and create measure.`);
      setAiProcessing(false);

    } catch (err) {
      console.error('Backend extraction error:', err);

      // Fall back to direct LLM call if backend fails
      setAiProgress('Backend extraction failed, trying direct LLM...');

      try {
        await processAiInputFallback(combinedInput);
      } catch (fallbackErr) {
        console.error('Fallback extraction error:', fallbackErr);
        setAiError(err instanceof Error ? err.message : 'Extraction failed');
        setAiProcessing(false);
      }
    }
  }, [aiInputText, extractedContent]);

  // Fallback extraction using direct LLM call (requires frontend API key)
  const processAiInputFallback = useCallback(async (combinedInput: string) => {
    const apiKey = getCurrentApiKey();
    if (!apiKey && selectedProvider !== 'custom') {
      throw new Error(`No API key configured for ${selectedProvider}. Please configure it in Settings or ensure backend LLM is configured.`);
    }

    const prompt = `You are a clinical quality measure expert. Analyze the following measure specification and extract structured data.

MEASURE SPECIFICATION:
${combinedInput}

Extract and return a JSON object with this structure:
{
  "metadata": {
    "measureId": "extracted measure ID",
    "title": "measure title",
    "description": "brief description",
    "program": "MIPS_CQM" | "eCQM" | "HEDIS" | "QOF" | "Registry" | "Custom",
    "steward": "organization",
    "measureType": "process" | "outcome" | "structure" | "patient_experience",
    "ageRange": { "min": number, "max": number }
  },
  "populations": [
    {
      "type": "initial_population" | "denominator" | "numerator" | "denominator_exclusion",
      "description": "narrative description",
      "criteria": []
    }
  ]
}

Return ONLY valid JSON.`;

    const customConfig = selectedProvider === 'custom' ? getCustomLlmConfig() : undefined;
    const modelToUse = selectedModel || getDefaultModel(selectedProvider, customConfig);

    const result = await callLLM({
      provider: selectedProvider,
      model: modelToUse,
      apiKey: apiKey || '',
      userPrompt: prompt,
      maxTokens: 8000,
      customConfig,
      jsonMode: selectedProvider === 'openai' || selectedProvider === 'google',
    });

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

    // Process populations and match value sets
    const processedPopulations = (parsed.populations || []).map((pop: any) => ({
      type: pop.type,
      description: pop.description,
      criteria: (pop.criteria || []).map((crit: any) => ({
        ...crit,
        valueSetMatch: matchValueSets(crit.valueSetName || crit.description, crit.valueSetOid),
      })),
    }));

    setAiExtractedData({
      metadata: parsed.metadata,
      populations: processedPopulations,
    });

    // Auto-populate metadata
    if (parsed.metadata) {
      if (parsed.metadata.measureId) setMeasureId(parsed.metadata.measureId);
      if (parsed.metadata.title) setTitle(parsed.metadata.title);
      if (parsed.metadata.description) setDescription(parsed.metadata.description);
      if (parsed.metadata.measureType) setMeasureType(parsed.metadata.measureType);
      if (parsed.metadata.steward) setSteward(parsed.metadata.steward);

      if (parsed.metadata.program) {
        const programMap: Record<string, MeasureProgram> = {
          'MIPS_CQM': 'MIPS_CQM',
          'MIPS': 'MIPS_CQM',
          'eCQM': 'eCQM',
          'HEDIS': 'HEDIS',
          'QOF': 'QOF',
          'Registry': 'Registry',
          'Custom': 'Custom',
        };
        const mappedProgram = programMap[parsed.metadata.program] || 'Custom';
        setProgram(mappedProgram);
      }

      if (parsed.metadata.ageRange) {
        setInitialPopCriteria(prev => ({
          ...prev,
          ageRange: parsed.metadata.ageRange,
        }));
      }
    }

    // Auto-populate criteria blocks for each population
    for (const pop of processedPopulations) {
      const blocks = convertToCriteriaBlocks(pop.criteria);

      switch (pop.type) {
        case 'initial_population':
          setInitialPopCriteria(prev => ({
            ...prev,
            description: pop.description,
            criteriaBlocks: blocks,
          }));
          break;
        case 'denominator':
          setDenominatorCriteria(prev => ({
            ...prev,
            description: pop.description,
            criteriaBlocks: blocks,
          }));
          break;
        case 'numerator':
          setNumeratorCriteria(prev => ({
            ...prev,
            description: pop.description,
            criteriaBlocks: blocks,
          }));
          break;
        case 'denominator_exclusion':
        case 'denominator_exception':
          setExclusionCriteria(prev => ({
            ...prev,
            description: pop.description,
            criteriaBlocks: blocks,
          }));
          break;
      }
    }

    setAiProgress('Complete! Review the extracted data below.');
    setAiProcessing(false);
  }, [selectedProvider, selectedModel, getCurrentApiKey, getCustomLlmConfig, matchValueSets, convertToCriteriaBlocks]);

  const canGoNext = () => {
    switch (currentStep) {
      case 'start':
        return mode === 'copy' ? !!sourceMeasureId : true;
      case 'ai_input':
        // Can proceed if AI has extracted data (including extractedUMS) OR user wants to skip (no files and no text)
        return aiExtractedData !== null || extractedUMS !== null || (uploadedFiles.length === 0 && aiInputText.trim() === '');
      case 'metadata':
        return measureId.trim() && title.trim();
      case 'initial_pop':
        return initialPopCriteria.description.trim() ||
               (initialPopCriteria.ageRange?.min !== undefined || initialPopCriteria.ageRange?.max !== undefined) ||
               (initialPopCriteria.criteriaBlocks?.length || 0) > 0;
      case 'denominator':
      case 'numerator':
      case 'exclusions':
        return true; // Optional steps
      case 'review':
        return true;
      default:
        return true;
    }
  };

  const goNext = () => {
    const currentIndex = getCurrentStepIndex();

    // Skip AI input step for non-AI modes
    if (currentStep === 'start' && mode !== 'ai_guided') {
      setCurrentStep('metadata');
      return;
    }

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

    // Skip AI input step when going back for non-AI modes
    if (currentStep === 'metadata' && mode !== 'ai_guided') {
      setCurrentStep('start');
      return;
    }

    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  // State for import progress
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleCreate = async () => {
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
    } else if (extractedUMS) {
      // Use the extracted UMS from backend extraction service
      // This preserves the full population trees with criteria and data elements
      newMeasure = {
        ...extractedUMS,
        id,
        resourceType: 'Measure',
        metadata: {
          ...extractedUMS.metadata,
          // Allow form field overrides
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

      // Count reviewable items
      let totalReviewable = 0;
      const countReviewable = (obj: any) => {
        if (obj?.reviewStatus) totalReviewable++;
        if (obj?.criteria) countReviewable(obj.criteria);
        if (obj?.children) obj.children.forEach(countReviewable);
      };
      newMeasure.populations.forEach(countReviewable);

      newMeasure.reviewProgress = {
        total: totalReviewable,
        approved: 0,
        pending: totalReviewable,
        flagged: 0,
      };
    } else {
      // Create new measure (blank or guided without backend extraction)
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

    // Import to backend for persistence
    setIsImporting(true);
    setImportError(null);

    try {
      const result = await importMeasure(newMeasure);

      if (result.success) {
        setActiveMeasure(newMeasure.id);
        setActiveTab('editor');
        handleCloseAfterSave();
      } else {
        // Fallback to local-only add if import fails
        console.warn('Backend import failed, adding locally:', result.error);
        setImportError(`Backend save failed: ${result.error}. Measure saved locally only.`);
        addMeasure(newMeasure);
        setActiveMeasure(newMeasure.id);
        setActiveTab('editor');
        // Don't close immediately so user sees the error
        setTimeout(() => handleCloseAfterSave(), 2000);
      }
    } catch (error) {
      console.error('Import error:', error);
      // Fallback to local-only add
      setImportError(`Error saving to backend. Measure saved locally only.`);
      addMeasure(newMeasure);
      setActiveMeasure(newMeasure.id);
      setActiveTab('editor');
      setTimeout(() => handleCloseAfterSave(), 2000);
    } finally {
      setIsImporting(false);
    }
  };

  // Convert CriteriaBlock to UMS LogicalClause/DataElement
  const convertCriteriaBlockToUMS = (block: CriteriaBlock): LogicalClause | DataElement => {
    if (block.type === 'group') {
      return {
        id: block.id,
        operator: block.operator || 'AND',
        description: `${block.operator || 'AND'} logic group`,
        children: (block.children || []).map(convertCriteriaBlockToUMS),
        confidence: block.confidence || 'medium',
        reviewStatus: 'pending',
      } as LogicalClause;
    }

    // Convert criterion to DataElement
    const vsRef = block.valueSetId
      ? availableValueSets.find(v => (v.valueSet.oid || v.valueSet.id) === block.valueSetId)?.valueSet
      : undefined;

    // Build description with quantity and timing
    let description = block.description || vsRef?.name || 'Unnamed criterion';
    if (block.quantity) {
      const qtyStr = block.quantity.comparator === 'between'
        ? `${block.quantity.value}-${block.quantity.maxValue}`
        : `${block.quantity.comparator} ${block.quantity.value}`;
      description = `${qtyStr} ${description}`;
    }
    if (block.timing?.type === 'by_age' && block.timing.ageValue) {
      description += ` by ${block.timing.ageValue} ${block.timing.ageUnit || 'years'} old`;
    }

    // Build timing requirements
    const timingReqs = block.timing ? [{
      description: block.timing.type === 'during_measurement_period'
        ? 'During Measurement Period'
        : block.timing.type === 'by_age'
        ? `By age ${block.timing.ageValue} ${block.timing.ageUnit || 'years'}`
        : block.timing.type === 'anytime'
        ? 'Anytime (historical)'
        : `Within ${block.timing.value} ${block.timing.type.replace('within_', '').replace('_of', '')} of ${block.timing.relativeTo || 'reference'}`,
      relativeTo: block.timing.type === 'during_measurement_period' ? 'Measurement Period' : block.timing.relativeTo || 'encounter',
      confidence: 'medium' as const,
    }] : undefined;

    // Build thresholds for quantity requirements
    const thresholds = block.quantity ? {
      valueMin: block.quantity.comparator === '>=' || block.quantity.comparator === '>' || block.quantity.comparator === 'between'
        ? block.quantity.value : undefined,
      valueMax: block.quantity.comparator === '<=' || block.quantity.comparator === '<'
        ? block.quantity.value
        : block.quantity.comparator === 'between'
        ? block.quantity.maxValue : undefined,
      comparator: block.quantity.comparator === 'between' ? undefined : block.quantity.comparator,
    } : undefined;

    return {
      id: block.id,
      type: block.resourceType || 'procedure',
      description,
      valueSet: vsRef,
      negation: block.negation,
      timingRequirements: timingReqs,
      thresholds,
      confidence: block.confidence || 'medium',
      reviewStatus: 'pending',
    } as DataElement;
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
        thresholds: {
          ageMin: initialPopCriteria.ageRange.min,
          ageMax: initialPopCriteria.ageRange.max,
        },
        confidence: 'medium',
        reviewStatus: 'pending',
      } as DataElement);
    }

    if (initialPopCriteria.requiredDiagnosis) {
      const vsRef = availableValueSets.find(v => (v.valueSet.oid || v.valueSet.id) === initialPopCriteria.requiredDiagnosis)?.valueSet;
      ipChildren.push({
        id: `dx-${timestamp}`,
        type: 'diagnosis',
        description: vsRef?.name || initialPopCriteria.requiredDiagnosis,
        valueSet: vsRef,
        confidence: 'medium',
        reviewStatus: 'pending',
      } as DataElement);
    }

    if (initialPopCriteria.requiredEncounter) {
      const vsRef = availableValueSets.find(v => (v.valueSet.oid || v.valueSet.id) === initialPopCriteria.requiredEncounter)?.valueSet;
      ipChildren.push({
        id: `enc-${timestamp}`,
        type: 'encounter',
        description: vsRef?.name || initialPopCriteria.requiredEncounter,
        valueSet: vsRef,
        confidence: 'medium',
        reviewStatus: 'pending',
      } as DataElement);
    }

    // Add criteria blocks from advanced builder
    if (initialPopCriteria.criteriaBlocks?.length) {
      initialPopCriteria.criteriaBlocks.forEach(block => {
        ipChildren.push(convertCriteriaBlockToUMS(block));
      });
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
    const denChildren: (LogicalClause | DataElement)[] = [];
    if (denominatorCriteria.criteriaBlocks?.length) {
      denominatorCriteria.criteriaBlocks.forEach(block => {
        denChildren.push(convertCriteriaBlockToUMS(block));
      });
    }

    populations.push({
      id: `den-${timestamp}`,
      type: 'denominator',
      description: denominatorCriteria.description || 'Denominator equals Initial Population',
      narrative: denominatorCriteria.description || 'Denominator = Initial Population',
      criteria: {
        id: `den-criteria-${timestamp}`,
        operator: 'AND',
        description: denominatorCriteria.description || 'Denominator Criteria',
        children: denChildren,
        confidence: 'medium',
        reviewStatus: 'pending',
      },
      confidence: 'medium',
      reviewStatus: 'pending',
    });

    // Numerator
    const numChildren: (LogicalClause | DataElement)[] = [];

    if (numeratorCriteria.requiredProcedure) {
      const vsRef = availableValueSets.find(v => (v.valueSet.oid || v.valueSet.id) === numeratorCriteria.requiredProcedure)?.valueSet;
      numChildren.push({
        id: `proc-${timestamp}`,
        type: 'procedure',
        description: vsRef?.name || numeratorCriteria.requiredProcedure,
        valueSet: vsRef,
        confidence: 'medium',
        reviewStatus: 'pending',
      } as DataElement);
    }

    if (numeratorCriteria.requiredObservation) {
      const vsRef = availableValueSets.find(v => (v.valueSet.oid || v.valueSet.id) === numeratorCriteria.requiredObservation)?.valueSet;
      numChildren.push({
        id: `obs-${timestamp}`,
        type: 'observation',
        description: vsRef?.name || numeratorCriteria.requiredObservation,
        valueSet: vsRef,
        confidence: 'medium',
        reviewStatus: 'pending',
      } as DataElement);
    }

    // Add criteria blocks from advanced builder
    if (numeratorCriteria.criteriaBlocks?.length) {
      numeratorCriteria.criteriaBlocks.forEach(block => {
        numChildren.push(convertCriteriaBlockToUMS(block));
      });
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
    if (exclusionCriteria.description || exclusionCriteria.criteriaBlocks?.length) {
      const exChildren: (LogicalClause | DataElement)[] = [];
      if (exclusionCriteria.criteriaBlocks?.length) {
        exclusionCriteria.criteriaBlocks.forEach(block => {
          exChildren.push(convertCriteriaBlockToUMS(block));
        });
      }

      populations.push({
        id: `denex-${timestamp}`,
        type: 'denominator_exclusion',
        description: exclusionCriteria.description || 'Denominator Exclusion',
        narrative: exclusionCriteria.description || 'Exclusion criteria',
        criteria: {
          id: `denex-criteria-${timestamp}`,
          operator: 'OR',
          description: exclusionCriteria.description || 'Exclusion criteria',
          children: exChildren,
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
  const visibleSteps = mode === 'ai_guided'
    ? STEPS
    : STEPS.filter(s => ['start', 'metadata', 'review'].includes(s.id));

  const currentStepConfig = STEPS.find(s => s.id === currentStep);

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
              {currentStepConfig?.description || 'Step-by-step measure authoring'}
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
                const Icon = step.icon;

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
                  className={`p-6 rounded-xl border-2 text-left transition-all hover:border-[var(--success)]/50 ${
                    mode === 'copy' ? 'border-[var(--success)] bg-[var(--success-light)]' : 'border-[var(--border)]'
                  }`}
                  disabled={measures.length === 0}
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

          {/* Step: AI Input - Upload files or paste measure specification */}
          {currentStep === 'ai_input' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--accent-light)] flex items-center justify-center">
                  <Brain className="w-8 h-8 text-[var(--accent)]" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--text)] mb-2">AI-Guided Extraction</h3>
                <p className="text-[var(--text-muted)]">
                  Upload measure documents or paste specifications - AI will extract the structure
                </p>
              </div>

              {/* Info box */}
              <div className="flex items-start gap-3 p-4 bg-[var(--accent-light)] border border-[var(--accent)]/20 rounded-lg">
                <Info className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-muted)]">
                  <strong>Supported inputs:</strong> PDF specifications, HTML documents, Excel/CSV files, ZIP packages, or plain text.
                  The AI will extract populations, criteria, timing constraints, and match value sets automatically.
                </div>
              </div>

              {/* File upload drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                    : 'border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5'
                } ${aiProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.html,.htm,.xlsx,.xls,.csv,.zip,.txt,.md,.cql,.json,.xml"
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                  className="hidden"
                  disabled={aiProcessing}
                />
                <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'}`} />
                <p className="text-[var(--text)] font-medium mb-1">
                  {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  PDF, HTML, Excel, CSV, ZIP, TXT, CQL, JSON, XML
                </p>
              </div>

              {/* Uploaded files list */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text)]">
                      Uploaded Files ({uploadedFiles.length})
                    </span>
                    <button
                      onClick={clearAllFiles}
                      disabled={aiProcessing}
                      className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-50"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="space-y-1">
                    {uploadedFiles.map((file, idx) => {
                      const doc = extractedDocuments[idx];
                      const hasError = doc?.error;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            hasError ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-[var(--bg-secondary)] border border-[var(--border)]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <File className={`w-4 h-4 flex-shrink-0 ${hasError ? 'text-rose-400' : 'text-[var(--accent)]'}`} />
                            <div className="min-w-0">
                              <div className="text-sm text-[var(--text)] truncate">{file.name}</div>
                              <div className="text-xs text-[var(--text-muted)]">
                                {doc ? (
                                  hasError ? (
                                    <span className="text-rose-400">{doc.error}</span>
                                  ) : (
                                    <span className="text-[var(--success)]">{doc.content.length.toLocaleString()} chars extracted</span>
                                  )
                                ) : (
                                  <span className="text-[var(--text-dim)]">Extracting...</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(idx);
                            }}
                            disabled={aiProcessing}
                            className="p-1 text-[var(--text-muted)] hover:text-rose-400 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 border-t border-[var(--border)]" />
                <span className="text-sm text-[var(--text-dim)]">and/or</span>
                <div className="flex-1 border-t border-[var(--border)]" />
              </div>

              {/* Text input area */}
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Additional Text / Free-form Measure Description
                </label>
                <textarea
                  value={aiInputText}
                  onChange={(e) => setAiInputText(e.target.value)}
                  placeholder={`Optionally add measure details, clarifications, or paste plain text specifications here...

For example:
- "Patients must have at least 4 DTaP doses by age 2"
- "Total cholesterol must be ≤ 5.0 mmol/l"
- "Exclude patients with hospice care or advanced illness"

This text will be combined with any uploaded documents for AI analysis.`}
                  rows={6}
                  disabled={aiProcessing}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] resize-none text-sm disabled:opacity-50"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-4">
                <button
                  onClick={processAiInput}
                  disabled={(!aiInputText.trim() && uploadedFiles.length === 0) || aiProcessing || !getCurrentApiKey()}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--primary)] text-white rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {aiProgress || 'Processing...'}
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Extract with AI
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setAiInputText('');
                    clearAllFiles();
                    setAiExtractedData(null);
                    setAiError(null);
                  }}
                  disabled={aiProcessing || (!aiInputText.trim() && uploadedFiles.length === 0)}
                  className="px-4 py-3 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
                >
                  Clear All
                </button>
              </div>

              {/* No API key warning */}
              {!getCurrentApiKey() && (
                <div className="flex items-start gap-3 p-4 bg-[var(--warning-light)] border border-[var(--warning)]/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-[var(--warning)]">
                    No API key configured for {selectedProvider}. Configure it in Settings to use AI extraction,
                    or skip this step to build the measure manually.
                  </div>
                </div>
              )}

              {/* Error display */}
              {aiError && (
                <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-rose-300">{aiError}</div>
                </div>
              )}

              {/* Extraction results preview */}
              {aiExtractedData && (
                <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                  <div className="flex items-center gap-2 text-[var(--success)] font-medium">
                    <Check className="w-5 h-5" />
                    AI Extraction Complete
                  </div>

                  {/* Metadata preview */}
                  {aiExtractedData.metadata && (
                    <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
                      <div className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-2">Extracted Metadata</div>
                      <div className="space-y-1 text-sm">
                        {aiExtractedData.metadata.measureId && (
                          <div><span className="text-[var(--text-muted)]">Measure ID:</span> <span className="text-[var(--text)]">{aiExtractedData.metadata.measureId}</span></div>
                        )}
                        {aiExtractedData.metadata.title && (
                          <div><span className="text-[var(--text-muted)]">Title:</span> <span className="text-[var(--text)]">{aiExtractedData.metadata.title}</span></div>
                        )}
                        {aiExtractedData.metadata.ageRange && (
                          <div><span className="text-[var(--text-muted)]">Age Range:</span> <span className="text-[var(--text)]">{aiExtractedData.metadata.ageRange.min} - {aiExtractedData.metadata.ageRange.max} years</span></div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Populations preview */}
                  {aiExtractedData.populations && aiExtractedData.populations.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs uppercase tracking-wider text-[var(--text-dim)]">Extracted Populations</div>
                      {aiExtractedData.populations.map((pop, idx) => (
                        <div key={idx} className={`p-4 rounded-lg border ${
                          pop.type === 'initial_population' ? 'bg-[var(--accent-light)] border-blue-500/20' :
                          pop.type === 'denominator' ? 'bg-purple-500/10 border-purple-500/20' :
                          pop.type === 'numerator' ? 'bg-[var(--success-light)] border-[var(--success)]/20' :
                          'bg-[var(--warning-light)] border-[var(--warning)]/20'
                        }`}>
                          <div className={`text-sm font-medium mb-2 ${
                            pop.type === 'initial_population' ? 'text-[var(--accent)]' :
                            pop.type === 'denominator' ? 'text-purple-400' :
                            pop.type === 'numerator' ? 'text-[var(--success)]' :
                            'text-[var(--warning)]'
                          }`}>
                            {pop.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </div>
                          <p className="text-sm text-[var(--text-muted)] mb-2">{pop.description}</p>
                          <div className="text-xs text-[var(--text-dim)]">
                            {pop.criteria.length} criteria extracted
                            {pop.criteria.some(c => c.valueSetMatch?.existingValueSet) && (
                              <span className="ml-2 text-[var(--success)]">
                                ({pop.criteria.filter(c => c.valueSetMatch?.existingValueSet).length} value sets matched)
                              </span>
                            )}
                            {pop.criteria.some(c => c.valueSetMatch?.isPlaceholder) && (
                              <span className="ml-2 text-[var(--warning)]">
                                ({pop.criteria.filter(c => c.valueSetMatch?.isPlaceholder).length} placeholders created)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-sm text-[var(--text-muted)] italic">
                    Continue to the next step to review and refine the extracted data.
                  </div>
                </div>
              )}

              {/* Skip option */}
              {!aiExtractedData && !aiProcessing && (
                <div className="text-center text-sm text-[var(--text-dim)]">
                  Or <button onClick={goNext} className="text-[var(--accent)] hover:text-[var(--accent)] underline">skip this step</button> to build the measure manually.
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
                    onChange={(e) => setProgram(e.target.value as MeasureProgram)}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
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

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-2">
                    Measure Type
                  </label>
                  <select
                    value={measureType}
                    onChange={(e) => setMeasureType(e.target.value as MeasureType)}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
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
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
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
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step: Denominator (includes Initial Population criteria) */}
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

              {/* Info box */}
              <div className="flex items-start gap-3 p-4 bg-[var(--accent-light)] border border-blue-500/20 rounded-lg">
                <Info className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-muted)]">
                  The Denominator identifies all patients who are eligible for this measure.
                  Build your criteria using the logic builder below - add diagnoses, encounters, procedures, etc. with timing and quantity requirements.
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Denominator Description (narrative)
                </label>
                <textarea
                  value={initialPopCriteria.description}
                  onChange={(e) => setInitialPopCriteria({ ...initialPopCriteria, description: e.target.value })}
                  placeholder="e.g., Patients 18-85 years of age with a diagnosis of essential hypertension and at least one outpatient visit during the measurement period"
                  rows={2}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] resize-none"
                />
              </div>

              {/* Age Range - common convenience field */}
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

              {/* Clinical Criteria Builder */}
              <div className="pt-4 border-t border-[var(--border)]">
                <CriteriaBlockBuilder
                  criteria={initialPopCriteria.criteriaBlocks || []}
                  onChange={(blocks) => setInitialPopCriteria({ ...initialPopCriteria, criteriaBlocks: blocks })}
                  availableValueSets={availableValueSets}
                  populationContext="Denominator"
                  onCqlGenerated={(cql) => setGeneratedCql(prev => ({ ...prev, initialPop: cql }))}
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

              <div className="flex items-start gap-3 p-4 bg-[var(--success-light)] border border-[var(--success)]/20 rounded-lg">
                <Info className="w-5 h-5 text-[var(--success)] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-muted)]">
                  The Numerator defines patients who received the expected care or achieved the desired outcome.
                  Build complex criteria like immunizations (e.g., "4 DTaP vaccines by age 2") using the logic builder below.
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Numerator Description (narrative)
                </label>
                <textarea
                  value={numeratorCriteria.description}
                  onChange={(e) => setNumeratorCriteria({ ...numeratorCriteria, description: e.target.value })}
                  placeholder="e.g., Patients who received all recommended immunizations by their second birthday"
                  rows={2}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--success)] resize-none"
                />
              </div>

              {/* Clinical Criteria Builder */}
              <div className="pt-4 border-t border-[var(--border)]">
                <CriteriaBlockBuilder
                  criteria={numeratorCriteria.criteriaBlocks || []}
                  onChange={(blocks) => setNumeratorCriteria({ ...numeratorCriteria, criteriaBlocks: blocks })}
                  availableValueSets={availableValueSets}
                  populationContext="Numerator"
                  onCqlGenerated={(cql) => setGeneratedCql(prev => ({ ...prev, numerator: cql }))}
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

              <div className="flex items-start gap-3 p-4 bg-[var(--warning-light)] border border-[var(--warning)]/20 rounded-lg">
                <Info className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-muted)]">
                  <strong>Exclusions</strong> remove patients based on clinical appropriateness (e.g., hospice care, ESRD).
                  <strong className="ml-2">Exceptions</strong> allow for valid clinical reasons why the numerator action wasn't performed.
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Exclusion Description (narrative)
                </label>
                <textarea
                  value={exclusionCriteria.description}
                  onChange={(e) => setExclusionCriteria({ ...exclusionCriteria, description: e.target.value })}
                  placeholder="e.g., Patients in hospice care, patients with ESRD, patients who are pregnant"
                  rows={2}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--warning)] resize-none"
                />
              </div>

              <div className="text-sm text-[var(--text-dim)] italic">
                Leave blank if no exclusions apply to this measure.
              </div>

              {/* Clinical Criteria Builder */}
              <div className="pt-4 border-t border-[var(--border)]">
                <CriteriaBlockBuilder
                  criteria={exclusionCriteria.criteriaBlocks || []}
                  onChange={(blocks) => setExclusionCriteria({ ...exclusionCriteria, criteriaBlocks: blocks })}
                  availableValueSets={availableValueSets}
                  populationContext="Exclusions"
                  onCqlGenerated={(cql) => setGeneratedCql(prev => ({ ...prev, exclusions: cql }))}
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

                {/* Populations (for guided mode) */}
                {mode === 'ai_guided' && (
                  <>
                    {(initialPopCriteria.description || (initialPopCriteria.valueSets?.size || 0) > 0) && (
                      <div className="p-4 bg-[var(--accent-light)] rounded-lg border border-blue-500/20">
                        <div className="flex items-center gap-2 text-[var(--accent)] text-sm font-medium mb-2">
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
                      <div className="p-4 bg-[var(--success-light)] rounded-lg border border-[var(--success)]/20">
                        <div className="flex items-center gap-2 text-[var(--success)] text-sm font-medium mb-2">
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
                                <span key={vsId} className="text-xs px-2 py-0.5 bg-[var(--success-light)] text-[var(--success)] rounded">
                                  {vs.valueSet.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {(exclusionCriteria.description || (exclusionCriteria.valueSets?.size || 0) > 0) && (
                      <div className="p-4 bg-[var(--warning-light)] rounded-lg border border-[var(--warning)]/20">
                        <div className="flex items-center gap-2 text-[var(--warning)] text-sm font-medium mb-2">
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
                                <span key={vsId} className="text-xs px-2 py-0.5 bg-[var(--warning-light)] text-[var(--warning)] rounded">
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
              onClick={handleCloseRequest}
              className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>

            {currentStep === 'review' ? (
              <button
                onClick={handleCreate}
                className="px-6 py-2.5 bg-[var(--success)] text-white rounded-lg font-medium hover:opacity-90 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Measure
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={!canGoNext()}
                className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
