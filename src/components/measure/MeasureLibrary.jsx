import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Trash2, Clock, CheckCircle, AlertTriangle, Lock, Unlock, Shield, Brain, Zap, ChevronDown, Send, Edit3, Plus, Copy, X, ArrowUp, ArrowDown, Building2, Download, Sparkles } from 'lucide-react';
import { useMeasureStore } from '../../stores/measureStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useImportQueueStore } from '../../stores/importQueueStore';
import { ingestMeasureFiles } from '../../services/measureIngestion';
import { extractFromFiles } from '../../services/documentLoader';
import { classifyDocument } from '../../utils/catalogueClassifier';
import { recordClassifierFeedbackAsync } from '../../api/classifierFeedback';
import { MeasureCreator } from './MeasureCreator';
import { ImportQueuePanel } from './ImportQueuePanel';
import { CatalogueConfirmationChip } from '../ingestion/CatalogueConfirmationChip';

const PROGRAM_LABELS                                 = {
  'MIPS_CQM': 'MIPS CQM',
  'eCQM': 'eCQM',
  'HEDIS': 'HEDIS',
  'QOF': 'QOF',
  'Registry': 'Registry',
  'Custom': 'Custom',
};

// Helper to reset review status recursively
function _resetReviewStatus(obj     )      {
  if (!obj) return obj;
  const result = { ...obj, reviewStatus: 'pending' };
  if (result.children) {
    result.children = result.children.map(_resetReviewStatus);
  }
  return result;
}

export function MeasureLibrary() {
  const navigate = useNavigate();
  const { measures, addMeasure, importMeasure, deleteMeasure, setActiveMeasure, getReviewProgress, lockMeasure, unlockMeasure, setMeasureStatus, updateMeasure, viewedMeasures, markMeasureViewed } = useMeasureStore();
  const { linkMeasureComponents, rebuildUsageIndex, getComponent } = useComponentLibraryStore();
  const { addNotification } = useNotificationStore();
  const {
    selectedProvider,
    selectedModel,
    getActiveApiKey,
    getActiveProvider,
    getCustomLlmConfig,
  } = useSettingsStore();

  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState                          (null);
  const [error, setError] = useState               (null);
  const [showCreator, setShowCreator] = useState(false);
  const [importExpanded, setImportExpanded] = useState(false);

  // Catalogue confirmation state
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  // Shape: { files: File[], classification: ClassificationResult, documentName: string, extractedContent: string }

  // Batch queue state
  const [batchQueue, setBatchQueue] = useState          ([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [_queueDragActive, setQueueDragActive] = useState(false);
  const _queueInputRef = useRef                  (null);
  const fileInputRef = useRef                  (null);
  const batchQueueRef = useRef          ([]);
  const processingRef = useRef(false);
  const batchCounterRef = useRef({ index: 0, total: 0 });

  // Track import queue item IDs for status reporting (maps batch index to queue item ID)
  const queueItemIdsRef = useRef          ([]);

  // Track cancelled item IDs - checked at natural breakpoints in the pipeline
  const cancelledItemsRef = useRef                  (new Set());

  // Filtering and sorting state
  const [statusTab, setStatusTab] = useState           ('all');
  const [selectedPrograms, setSelectedPrograms] = useState                     (new Set());
  const [sortDirection, setSortDirection] = useState               ('asc');
  const [showProgramDropdown, setShowProgramDropdown] = useState(false);
  const programDropdownRef = useRef                (null);

  // Close program dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e            ) => {
      // Defensive check - ensure event and target exist
      if (!e || !e.target) return;
      if (programDropdownRef.current && !programDropdownRef.current.contains(e.target        )) {
        setShowProgramDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProgramToggle = (program                ) => {
    setSelectedPrograms(prev => {
      const next = new Set(prev);
      if (next.has(program)) {
        next.delete(program);
      } else {
        next.add(program);
      }
      return next;
    });
  };


  // Supported file extensions
  const SUPPORTED_EXTENSIONS = useMemo(() => ['.pdf', '.html', '.htm', '.xlsx', '.xls', '.csv', '.xml', '.json', '.cql', '.txt', '.zip'], []);

  const isFileSupported = useCallback((file      ) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  }, [SUPPORTED_EXTENSIONS]);

  // Process the next item in the queue (or the first file group)
  // Phase 1: Extract text and classify, show confirmation chip
  // Phase 2: After confirmation, proceed with AI extraction
  const processNext = useCallback(async () => {
    console.log('[processNext] START - queue length:', batchQueueRef.current.length);
    const queue = batchQueueRef.current;
    if (queue.length === 0) {
      // All done
      console.log('[processNext] Queue empty, stopping');
      processingRef.current = false;
      setIsProcessing(false);
      setBatchIndex(0);
      setBatchTotal(0);
      setTimeout(() => setProgress(null), 3000);
      return;
    }

    const [files, ...rest] = queue;
    batchQueueRef.current = rest;
    setBatchQueue(rest);

    const counter = batchCounterRef.current;
    counter.index++;
    setBatchIndex(counter.index);

    // Get the queue item ID for this batch item (for status reporting)
    const currentQueueItemId = queueItemIdsRef.current[counter.index - 1];

    // Fire-and-forget: Report processing started
    try {
      if (currentQueueItemId) {
        useImportQueueStore.getState().reportProcessing(currentQueueItemId);
      }
    } catch (e) { /* ignore - UI store error should never interrupt pipeline */ }

    const label = counter.total > 1 ? `[${counter.index}/${counter.total}] ` : '';
    setProgress({ stage: 'loading', message: `${label}Extracting text...`, progress: 5 });

    try {
      // Phase 1: Extract text and classify
      console.log('[processNext] Extracting text from files...');
      const extractionResult = await extractFromFiles(files);

      if (!extractionResult.combinedContent || extractionResult.combinedContent.length < 100) {
        setError('Could not extract sufficient text from the document. Please try a text-based PDF.');
        setTimeout(() => processNext(), 1500);
        return;
      }

      // Classify the document
      const classification = classifyDocument(extractionResult.combinedContent);
      console.log('[processNext] Classification result:', classification);

      // Get document name for display
      const documentName = files.length === 1
        ? files[0].name
        : `${files.length} files (${files[0].name}, ...)`;

      // If high confidence, auto-confirm; otherwise show confirmation chip
      if (classification.confidence === 'high' && classification.detected) {
        console.log('[processNext] High confidence detection, auto-confirming:', classification.detected);
        // Record feedback (non-blocking)
        recordClassifierFeedbackAsync({
          documentName,
          detectedType: classification.detected,
          confirmedType: classification.detected,
          wasOverridden: false,
          confidence: classification.confidence,
          signals: classification.signals,
        });
        // Continue with ingestion using detected type
        await continueIngestion(files, classification.detected, currentQueueItemId);
      } else {
        // Show confirmation chip and pause processing
        console.log('[processNext] Showing confirmation chip for:', documentName);
        setProgress({ stage: 'confirming', message: `${label}Awaiting catalogue confirmation...`, progress: 15 });
        setPendingConfirmation({
          files,
          classification,
          documentName,
          extractedContent: extractionResult.combinedContent,
          queueItemId: currentQueueItemId,
        });
        // Processing pauses here - will resume when user confirms or cancels
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setTimeout(() => processNext(), 1500);
    }
  }, [getActiveApiKey, selectedProvider, selectedModel, getCustomLlmConfig]);

  // Continue ingestion after catalogue confirmation
  const continueIngestion = useCallback(async (files, confirmedType, queueItemId) => {
    const activeApiKey = getActiveApiKey();
    const customConfig = selectedProvider === 'custom' ? getCustomLlmConfig() : undefined;

    const counter = batchCounterRef.current;
    const label = counter.total > 1 ? `[${counter.index}/${counter.total}] ` : '';

    const wrappedSetProgress = (p) => {
      const ct = batchCounterRef.current;
      const lbl = ct.total > 1 ? `[${ct.index}/${ct.total}] ` : '';
      setProgress({ ...p, message: `${lbl}${p.message}` });

      // Fire-and-forget: Report progress to UI store
      try {
        if (queueItemId) {
          useImportQueueStore.getState().reportProgress(queueItemId, p.progress || 0, p.stage || 'processing', p.message);
        }
      } catch (e) { /* ignore */ }
    };

    try {
      console.log('[continueIngestion] Calling ingestMeasureFiles with confirmed type:', confirmedType);
      const result = await ingestMeasureFiles(files, activeApiKey, wrappedSetProgress, selectedProvider, selectedModel, customConfig);
      console.log('[continueIngestion] ingestMeasureFiles returned:', { success: result.success, hasUms: !!result.ums, error: result.error });

      // Check if cancelled after LLM extraction (natural breakpoint)
      if (queueItemId && cancelledItemsRef.current.has(queueItemId)) {
        console.log('[continueIngestion] Import cancelled, skipping remaining steps');
        setProgress({ stage: 'cancelled', message: 'Import cancelled', progress: 0 });
        setTimeout(() => processNext(), 500);
        return;
      }

      if (result.success && result.ums) {
        // Apply confirmed catalogue type to the measure
        const measureWithStatus = {
          ...result.ums,
          status: 'in_progress',
          metadata: {
            ...result.ums.metadata,
            program: confirmedType, // Use the user-confirmed catalogue type
          },
        };

        // Check if cancelled before backend import (natural breakpoint)
        if (queueItemId && cancelledItemsRef.current.has(queueItemId)) {
          console.log('[continueIngestion] Import cancelled before save');
          setProgress({ stage: 'cancelled', message: 'Import cancelled', progress: 0 });
          setTimeout(() => processNext(), 500);
          return;
        }

        // Import to backend for persistence (falls back to local if backend fails)
        const importResult = await importMeasure(measureWithStatus);
        if (!importResult.success) {
          console.warn('Backend import failed, measure saved locally only:', importResult.error);
        }

        // Navigate to editor after successful import
        navigate('/editor');

        // Immediately match against component library — link to existing approved components
        console.log('[MeasureLibrary] About to call linkMeasureComponents for:', measureWithStatus.metadata.measureId);
        console.log('[MeasureLibrary] Populations:', JSON.stringify(measureWithStatus.populations, null, 2).slice(0, 2000));
        const linkMap = linkMeasureComponents(
          measureWithStatus.metadata.measureId,
          measureWithStatus.populations,
        );
        console.log('[MeasureLibrary] linkMeasureComponents returned linkMap:', linkMap);

        // Write libraryComponentId (or ingestionWarning for zero-code elements)
        if (Object.keys(linkMap).length > 0) {
          const stampLinks = (node     )      => {
            if (!node) return node;
            if (node.id && linkMap[node.id]) {
              if (linkMap[node.id] === '__ZERO_CODES__') {
                // Zero codes — set warning instead of linking
                node = { ...node, ingestionWarning: 'No codes found for this logic block. Add codes in the component library or re-upload with terminology.' };
              } else {
                const componentId = linkMap[node.id];
                const libraryComp = getComponent(componentId);
                let updatedNode = { ...node, libraryComponentId: componentId };

                // Sync codes from library component if element has none
                if (libraryComp?.type === 'atomic' && libraryComp.valueSet?.codes?.length > 0) {
                  const elementCodes = updatedNode.valueSet?.codes || [];
                  if (elementCodes.length === 0 && updatedNode.valueSet) {
                    updatedNode = {
                      ...updatedNode,
                      valueSet: {
                        ...updatedNode.valueSet,
                        codes: [...libraryComp.valueSet.codes],
                        oid: updatedNode.valueSet.oid || libraryComp.valueSet.oid,
                      },
                    };
                    console.log(`[stampLinks] Synced ${libraryComp.valueSet.codes.length} codes from library to element "${updatedNode.description || updatedNode.id}"`);
                  }
                }

                node = updatedNode;
              }
            }
            if (node.children) {
              node = { ...node, children: node.children.map(stampLinks) };
            }
            if (node.criteria) {
              node = { ...node, criteria: stampLinks(node.criteria) };
            }
            return node;
          };
          const linkedPopulations = measureWithStatus.populations.map(stampLinks);
          updateMeasure(measureWithStatus.id, { populations: linkedPopulations });

          // Rebuild usage index with the LINKED measure (not the original without links)
          const measureWithLinks = { ...measureWithStatus, populations: linkedPopulations };
          rebuildUsageIndex([...measures, measureWithLinks]);
        } else {
          // No links created - still rebuild with the new measure
          rebuildUsageIndex([...measures, measureWithStatus]);
        }

        const ct = batchCounterRef.current;
        const lbl = ct.total > 1 ? `[${ct.index}/${ct.total}] ` : '';
        setProgress({ stage: 'complete', message: `${lbl}Successfully imported "${result.ums.metadata.title}"`, progress: 100 });

        // Show toast notification for successful import
        addNotification({
          type: 'success',
          title: 'Import Complete',
          message: `${result.ums.metadata.measureId} — ${result.ums.metadata.title}`,
          measureId: result.ums.id,
          cmsId: result.ums.metadata.measureId,
          measureName: result.ums.metadata.title,
        });

        // Fire-and-forget: Report completion to UI store
        try {
          const ct = batchCounterRef.current;
          const queueItemId = queueItemIdsRef.current[ct.index - 1];
          if (queueItemId) {
            useImportQueueStore.getState().reportComplete(queueItemId, {
              cmsId: result.ums.metadata.measureId,
              measureName: result.ums.metadata.title,
            });
          }
        } catch (e) { /* ignore - UI store error should never interrupt pipeline */ }
      } else {
        setError(result.error || 'Failed to extract measure specification');

        // Show toast notification for failed import
        addNotification({
          type: 'error',
          title: 'Import Failed',
          message: result.error || 'Failed to extract measure specification',
        });

        // Fire-and-forget: Report error to UI store
        try {
          const ct = batchCounterRef.current;
          const queueItemId = queueItemIdsRef.current[ct.index - 1];
          if (queueItemId) {
            useImportQueueStore.getState().reportError(queueItemId, result.error || 'Failed to extract measure specification');
          }
        } catch (e) { /* ignore - UI store error should never interrupt pipeline */ }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');

      // Fire-and-forget: Report error to UI store
      try {
        const ct = batchCounterRef.current;
        const queueItemId = queueItemIdsRef.current[ct.index - 1];
        if (queueItemId) {
          useImportQueueStore.getState().reportError(queueItemId, err instanceof Error ? err.message : 'Unknown error occurred');
        }
      } catch (e) { /* ignore - UI store error should never interrupt pipeline */ }
    }

    // Brief pause then process next
    setTimeout(() => processNext(), 1500);
  }, [getActiveApiKey, importMeasure, updateMeasure, selectedProvider, selectedModel, getCustomLlmConfig, linkMeasureComponents, rebuildUsageIndex, measures, navigate, getComponent, processNext, addNotification]);

  // Handle catalogue confirmation from CatalogueConfirmationChip
  const handleCatalogueConfirm = useCallback((catalogueType, wasOverridden, classifierSignals) => {
    if (!pendingConfirmation) return;

    const { files, classification, documentName, queueItemId } = pendingConfirmation;

    // Record feedback (non-blocking)
    recordClassifierFeedbackAsync({
      documentName,
      detectedType: classification?.detected || null,
      confirmedType: catalogueType,
      wasOverridden,
      confidence: classification?.confidence || 'low',
      signals: classifierSignals,
    });

    // Clear pending confirmation
    setPendingConfirmation(null);

    // Continue with ingestion
    continueIngestion(files, catalogueType, queueItemId);
  }, [pendingConfirmation, continueIngestion]);

  // Handle catalogue confirmation cancel
  const handleCatalogueCancel = useCallback(() => {
    if (!pendingConfirmation) return;

    const { queueItemId } = pendingConfirmation;

    // Report cancellation
    if (queueItemId) {
      try {
        useImportQueueStore.getState().reportCancelled(queueItemId);
      } catch (e) { /* ignore */ }
    }

    // Clear pending confirmation
    setPendingConfirmation(null);

    // Continue processing the queue
    setProgress(null);
    setTimeout(() => processNext(), 500);
  }, [pendingConfirmation, processNext]);

  // Handle files: either start processing or add to queue
  const handleFiles = useCallback(async (files        ) => {
    console.log('[handleFiles] START - received', files.length, 'files:', files.map(f => f.name));
    const supportedFiles = files.filter(isFileSupported);
    console.log('[handleFiles] Supported files:', supportedFiles.length);

    if (supportedFiles.length === 0) {
      console.log('[handleFiles] REJECTED - no supported files');
      setError('Please upload measure specification files (PDF, HTML, Excel, XML, JSON, CQL, or ZIP)');
      return;
    }

    // Validate API key upfront
    const activeApiKey = getActiveApiKey();
    const activeProvider = getActiveProvider();
    const customConfig = selectedProvider === 'custom' ? getCustomLlmConfig() : undefined;
    console.log('[handleFiles] API key check:', { hasKey: !!activeApiKey, provider: selectedProvider });

    if (selectedProvider === 'custom') {
      if (!customConfig?.baseUrl) {
        console.log('[handleFiles] REJECTED - no custom LLM config');
        setError('Please configure your Custom LLM base URL in Settings to use AI-powered extraction');
        return;
      }
    } else if (!activeApiKey) {
      console.log('[handleFiles] REJECTED - no API key for provider:', activeProvider.name);
      setError(`Please configure your ${activeProvider.name} API key in Settings to use AI-powered extraction`);
      return;
    }
    console.log('[handleFiles] API key validated, adding to queue');

    // Add to queue
    batchQueueRef.current = [...batchQueueRef.current, supportedFiles];
    setBatchQueue([...batchQueueRef.current]);
    batchCounterRef.current.total++;
    setBatchTotal(batchCounterRef.current.total);

    // Fire-and-forget: Report to UI store that files were queued
    try {
      const filename = supportedFiles.length === 1
        ? supportedFiles[0].name
        : `${supportedFiles.length} files`;
      const queueItemId = useImportQueueStore.getState().reportQueued({ filename });
      // Store the queue item ID so we can update it later
      queueItemIdsRef.current.push(queueItemId);
    } catch (e) { /* ignore - UI store error should never interrupt pipeline */ }

    if (!processingRef.current) {
      // Start processing
      processingRef.current = true;
      setIsProcessing(true);
      setError(null);
      batchCounterRef.current.index = 0;
      processNext();
    }
  }, [getActiveApiKey, getActiveProvider, selectedProvider, getCustomLlmConfig, processNext, isFileSupported]);

  const _handleDrop = useCallback(async (e                 ) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  }, [handleFiles]);

  const handleFileInput = useCallback(async (e                                     ) => {
    const files = e.target.files;
    if (!files) return;
    await handleFiles(Array.from(files));
    e.target.value = '';
  }, [handleFiles]);

  // Queue-specific drop handler
  const _handleQueueDrop = useCallback((e                 ) => {
    e.preventDefault();
    e.stopPropagation();
    setQueueDragActive(false);
    const files = Array.from(e.dataTransfer.files).filter(isFileSupported);
    if (files.length > 0) {
      batchQueueRef.current = [...batchQueueRef.current, files];
      setBatchQueue([...batchQueueRef.current]);
      batchCounterRef.current.total++;
      setBatchTotal(batchCounterRef.current.total);
    }
  }, [isFileSupported]);

  const _handleQueueFileInput = useCallback((e                                     ) => {
    const files = e.target.files;
    if (!files) return;
    const supported = Array.from(files).filter(isFileSupported);
    if (supported.length > 0) {
      batchQueueRef.current = [...batchQueueRef.current, supported];
      setBatchQueue([...batchQueueRef.current]);
      batchCounterRef.current.total++;
      setBatchTotal(batchCounterRef.current.total);
    }
    e.target.value = '';
  }, [isFileSupported]);

  const removeFromQueue = useCallback((index        ) => {
    // Get the queue item ID before removing (offset by current index since processed items are removed)
    const queueItemId = queueItemIdsRef.current[batchCounterRef.current.index + index];

    batchQueueRef.current = batchQueueRef.current.filter((_, i) => i !== index);
    setBatchQueue([...batchQueueRef.current]);
    batchCounterRef.current.total = Math.max(batchCounterRef.current.total - 1, 0);
    setBatchTotal(batchCounterRef.current.total);

    // Also update importQueueStore
    if (queueItemId) {
      try {
        useImportQueueStore.getState().reportCancelled(queueItemId);
      } catch (e) { /* ignore */ }
    }
  }, []);

  // Cancel the currently active import
  const cancelActiveImport = useCallback(() => {
    const currentIndex = batchCounterRef.current.index;
    const currentQueueItemId = queueItemIdsRef.current[currentIndex - 1];

    if (currentQueueItemId) {
      // Mark as cancelled - pipeline will check this at breakpoints
      cancelledItemsRef.current.add(currentQueueItemId);

      // Update store immediately to show cancelled state
      try {
        useImportQueueStore.getState().reportCancelled(currentQueueItemId);
      } catch (e) { /* ignore */ }
    }

    // Immediate visual feedback - clear UI state so panel disappears
    processingRef.current = false;
    setIsProcessing(false);
    setProgress(null);
    setBatchIndex(0);
    setBatchTotal(0);
    batchCounterRef.current = { index: 0, total: 0 };
  }, []);

  // Cancel all imports (active + queued)
  const cancelAllImports = useCallback(() => {
    // Cancel active import
    cancelActiveImport();

    // Clear the queue
    const currentIndex = batchCounterRef.current.index;
    queueItemIdsRef.current.slice(currentIndex).forEach((itemId) => {
      if (itemId) {
        cancelledItemsRef.current.add(itemId);
        try {
          useImportQueueStore.getState().reportCancelled(itemId);
        } catch (e) { /* ignore */ }
      }
    });

    // Immediate visual feedback - clear all state so panel disappears
    batchQueueRef.current = [];
    setBatchQueue([]);
    processingRef.current = false;
    setIsProcessing(false);
    setProgress(null);
    setBatchIndex(0);
    setBatchTotal(0);
    batchCounterRef.current = { index: 0, total: 0 };
  }, [cancelActiveImport]);

  const getConfidenceColor = (confidence        ) => {
    switch (confidence) {
      case 'high': return 'text-[var(--success)]';
      case 'medium': return 'text-[var(--warning)]';
      case 'low': return 'text-[var(--danger)]';
      default: return 'text-[var(--text-muted)]';
    }
  };

  // Filter and sort measures
  const filteredMeasures = useMemo(() => {
    let result = measures.filter((m) => {
      // Status filter
      const status = m.status || 'in_progress'; // Default to in_progress for legacy measures
      if (statusTab !== 'all' && status !== statusTab) return false;

      // Program filter (multi-select)
      if (selectedPrograms.size > 0 && !selectedPrograms.has(m.metadata.program                  )) return false;

      return true;
    });

    // Sort by name (alphabetically)
    result = [...result].sort((a, b) => {
      const comparison = a.metadata.title.localeCompare(b.metadata.title);
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [measures, statusTab, selectedPrograms, sortDirection]);

  // Get unique programs for filter dropdown
  const availablePrograms = useMemo(() => {
    const programs = new Set(measures.map(m => m.metadata.program).filter(Boolean));
    return Array.from(programs)                    ;
  }, [measures]);

  // Count measures by status
  const statusCounts = useMemo(() => {
    const inProgress = measures.filter(m => (m.status || 'in_progress') === 'in_progress').length;
    const published = measures.filter(m => m.status === 'published').length;
    return { inProgress, published, all: measures.length };
  }, [measures]);

  // Copy a measure - simple deep clone with title change
  const handleCopyMeasure = useCallback((measure                      ) => {
    const now = new Date().toISOString();
    const newId = `ums-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Deep clone the entire measure
    const copiedMeasure                       = JSON.parse(JSON.stringify(measure));

    // Update only what needs to change
    copiedMeasure.id = newId;
    copiedMeasure.resourceType = 'Measure';
    copiedMeasure.metadata.title = `${measure.metadata.title} (Copy)`;
    copiedMeasure.metadata.measureId = `${measure.metadata.measureId}-COPY`;
    copiedMeasure.metadata.lastUpdated = now;
    copiedMeasure.metadata.url = `urn:uuid:${newId}`;
    copiedMeasure.status = 'in_progress';
    copiedMeasure.createdAt = now;
    copiedMeasure.updatedAt = now;
    copiedMeasure.lockedAt = undefined;
    copiedMeasure.lockedBy = undefined;
    copiedMeasure.approvedAt = undefined;
    copiedMeasure.approvedBy = undefined;
    copiedMeasure.corrections = [];

    // Reset review status
    copiedMeasure.reviewProgress = {
      total: measure.reviewProgress?.total || 0,
      approved: 0,
      pending: measure.reviewProgress?.total || 0,
      flagged: 0,
    };

    addMeasure(copiedMeasure);

    // Sync with component library: the copied measure retains libraryComponentId links
    // from the original, so we just need to rebuild usage to include the new measure
    rebuildUsageIndex([...measures, copiedMeasure]);

    setActiveMeasure(copiedMeasure.id);
    navigate('/editor');
  }, [addMeasure, setActiveMeasure, rebuildUsageIndex, measures, navigate]);

  // Full-page drag handlers
  const handlePageDragOver = useCallback((e                 ) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handlePageDragLeave = useCallback((e) => {
    // Defensive check - ensure event exists
    if (!e || !e.currentTarget) return;
    // Only set drag inactive if leaving the page entirely
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) {
      setDragActive(false);
    }
  }, []);

  const handlePageDrop = useCallback(async (e                 ) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  }, [handleFiles]);

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      {/* Full-page drag overlay */}
      {dragActive && (
        <div className="fixed inset-0 z-50 bg-[var(--primary)]/5 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-[var(--primary)]">
          <div className="bg-[var(--bg-elevated)] rounded-2xl p-10 shadow-2xl text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-[var(--primary)]" />
            <p className="text-lg font-semibold text-[var(--text)]">Drop measure specs here</p>
            <p className="text-sm text-[var(--text-muted)] mt-2">PDF, HTML, Excel, XML, JSON, CQL, or ZIP</p>
          </div>
        </div>
      )}

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        {/* Row 1: Title + Actions */}
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text)]">Measure Library</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Upload measure specifications for AI-powered extraction and UMS generation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setImportExpanded(!importExpanded)}
              className={`h-10 px-4 rounded-lg font-medium transition-colors flex items-center gap-2 border ${
                importExpanded
                  ? 'bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary)]'
                  : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text)] hover:border-[var(--primary)]/50'
              }`}
            >
              <Download className="w-4 h-4" />
              Import from Spec
            </button>
            <button
              onClick={() => setShowCreator(true)}
              className="h-10 px-4 bg-[var(--primary)] text-black rounded-lg font-semibold hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Measure
            </button>
          </div>
        </div>

        {/* Row 2: Collapsible import bar */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            importExpanded ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-6 pb-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border)] rounded-lg px-4 py-3 flex items-center gap-4 cursor-pointer hover:border-[var(--primary)]/50 hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--primary-light)] flex items-center justify-center flex-shrink-0">
                <Upload className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text)]">Drop files here or click to browse</p>
                <p className="text-xs text-[var(--text-muted)]">Supports PDF, HTML, Excel, XML, JSON, CQL, and ZIP packages</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={SUPPORTED_EXTENSIONS.join(',')}
                multiple
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Row 3: Filters */}
        <div className="px-6 pb-3 flex items-center justify-between">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
            <button
              onClick={() => setStatusTab('all')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusTab === 'all'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              All ({statusCounts.all})
            </button>
            <button
              onClick={() => setStatusTab('in_progress')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                statusTab === 'in_progress'
                  ? 'bg-[var(--warning-light)] text-[var(--warning)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              In Progress ({statusCounts.inProgress})
            </button>
            <button
              onClick={() => setStatusTab('published')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                statusTab === 'published'
                  ? 'bg-[var(--success-light)] text-[var(--success)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Send className="w-3 h-3" />
              Published ({statusCounts.published})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Program Filter */}
            {availablePrograms.length > 0 && (
              <div className="relative" ref={programDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowProgramDropdown(!showProgramDropdown)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm cursor-pointer transition-colors focus:outline-none ${
                    selectedPrograms.size > 0
                      ? 'bg-[var(--accent-light)] border-[var(--accent)]/40 text-[var(--accent)]'
                      : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text)]'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">
                    {selectedPrograms.size === 0
                      ? 'All Programs'
                      : selectedPrograms.size === 1
                        ? PROGRAM_LABELS[Array.from(selectedPrograms)[0]] || Array.from(selectedPrograms)[0]
                        : `${selectedPrograms.size} Programs`}
                  </span>
                  {selectedPrograms.size > 0 ? (
                    <X
                      className="w-3.5 h-3.5 ml-0.5 hover:text-[var(--text)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPrograms(new Set());
                      }}
                    />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                  )}
                </button>

                {showProgramDropdown && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--bg-elevated,var(--bg))] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[160px]">
                    {availablePrograms.map((program) => {
                      const isSelected = selectedPrograms.has(program);
                      return (
                        <button
                          key={program}
                          type="button"
                          onClick={() => handleProgramToggle(program)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
                            isSelected
                              ? 'text-[var(--accent)] bg-[var(--accent-light)]'
                              : 'text-[var(--text)] hover:bg-[var(--bg-tertiary)]'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? 'bg-[var(--accent)] border-[var(--accent)]'
                                : 'border-[var(--border)]'
                            }`}
                          >
                            {isSelected && (
                              <CheckCircle className="w-3 h-3 text-white" />
                            )}
                          </span>
                          {PROGRAM_LABELS[program] || program}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Sort Direction */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-dim)]">Sort:</span>
              <button
                type="button"
                onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] hover:border-[var(--accent)] transition-colors"
                title={sortDirection === 'asc' ? 'A → Z' : 'Z → A'}
              >
                {sortDirection === 'asc' ? (
                  <>
                    <ArrowUp className="w-3.5 h-3.5" />
                    A → Z
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-3.5 h-3.5" />
                    Z → A
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Import Queue Panel - receives real pipeline state as props */}
        <ImportQueuePanel
          isProcessing={isProcessing}
          batchQueue={batchQueue}
          progress={progress}
          batchIndex={batchIndex}
          batchTotal={batchTotal}
          onRemoveFromQueue={removeFromQueue}
          onCancelActive={cancelActiveImport}
          onCancelAll={cancelAllImports}
        />

        {/* Catalogue Confirmation Chip - shown when awaiting user confirmation */}
        {pendingConfirmation && (
          <CatalogueConfirmationChip
            classification={pendingConfirmation.classification}
            documentName={pendingConfirmation.documentName}
            onConfirm={handleCatalogueConfirm}
            onCancel={handleCatalogueCancel}
          />
        )}

        {/* Error display */}
        {error && (
          <div className="mb-6 p-4 bg-[var(--danger-light)] border border-[var(--danger)]/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--danger)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[var(--danger)] font-medium">Extraction Error</p>
              <p className="text-sm text-[var(--text-muted)] mt-1 whitespace-pre-wrap">{error}</p>
              {error.includes('Settings') && (
                <button
                  onClick={() => navigate('/settings')}
                  className="mt-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] underline"
                >
                  Go to Settings
                </button>
              )}
            </div>
            <button
              onClick={() => setError(null)}
              className="text-[var(--danger)] hover:text-[var(--danger)]/80"
            >
              &times;
            </button>
          </div>
        )}

        {/* Measures List */}
        {filteredMeasures.length > 0 ? (
          <div className="space-y-2">
            {filteredMeasures.map((measure) => (
              <MeasureCard
                key={measure.id}
                measure={measure}
                reviewProgress={getReviewProgress(measure.id)}
                isNew={measure.isNew && !viewedMeasures?.includes(measure.id)}
                onSelect={() => {
                  markMeasureViewed(measure.id);
                  setActiveMeasure(measure.id);
                  navigate('/editor');
                }}
                onDelete={() => {
                  if (measure.lockedAt) {
                    alert('Cannot delete a locked measure. Unlock it first.');
                    return;
                  }
                  if (confirm(`Delete "${measure.metadata.title}"?`)) {
                    deleteMeasure(measure.id);
                    rebuildUsageIndex(measures.filter(m => m.id !== measure.id));
                  }
                }}
                onCopy={() => handleCopyMeasure(measure)}
                onLock={() => lockMeasure(measure.id)}
                onUnlock={() => unlockMeasure(measure.id)}
                onPublish={() => setMeasureStatus(measure.id, 'published')}
                onUnpublish={() => setMeasureStatus(measure.id, 'in_progress')}
                getConfidenceColor={getConfidenceColor}
              />
            ))}
          </div>
        ) : measures.length > 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>No measures match the current filter</p>
            <button
              onClick={() => { setStatusTab('all'); setSelectedPrograms(new Set()); }}
              className="mt-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>No measures imported yet</p>
            <p className="text-sm mt-1">Upload specification files or create a new measure to get started</p>
            <button
              onClick={() => setShowCreator(true)}
              className="mt-4 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors inline-flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create New Measure
            </button>
          </div>
        )}
      </div>

      {/* Measure Creator Modal */}
      <MeasureCreator isOpen={showCreator} onClose={() => setShowCreator(false)} />
    </div>
  );
}

function MeasureCard({
  measure,
  reviewProgress,
  isNew,
  onSelect,
  onDelete,
  onCopy,
  onLock,
  onUnlock,
  onPublish,
  onUnpublish,
  getConfidenceColor,
}










 ) {
  const { approved, total, flagged } = reviewProgress;
  const progress = total > 0 ? Math.round((approved / total) * 100) : 0;
  const isLocked = !!measure.lockedAt;
  const canLock = progress === 100 && !isLocked;
  const status = measure.status || 'in_progress';
  const isPublished = status === 'published';

  return (
    <div
      className={`bg-[var(--bg-elevated)] border rounded-lg p-3 transition-all cursor-pointer group ${
        isNew
          ? 'border-l-4 border-l-orange-500 border-t-[var(--border)] border-r-[var(--border)] border-b-[var(--border)] bg-gradient-to-r from-orange-50 to-transparent'
          : isPublished
            ? 'border-[var(--success)]/40'
            : isLocked
              ? 'border-[var(--success)]/50'
              : 'border-[var(--border)] hover:border-[var(--primary)]/50'
      }`}
      onClick={onSelect}
    >
      {/* Row 1: Tags */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {/* New badge - first in the row */}
        {isNew && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-orange-500 text-white rounded-full">
            <span className="w-1.5 h-1.5 bg-white rounded-full" />
            New
          </span>
        )}
        {isPublished ? (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-[var(--success-light)] text-[var(--success)] flex items-center gap-1">
            <Send className="w-3 h-3" />
            Published
          </span>
        ) : (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-[var(--warning-light)] text-[var(--warning)] flex items-center gap-1">
            <Edit3 className="w-3 h-3" />
            In Progress
          </span>
        )}
        <span className="px-2 py-0.5 text-xs font-medium bg-[var(--bg-tertiary)] rounded border border-[var(--border)]">
          {measure.metadata.measureId}
        </span>
        <span className="px-2 py-0.5 text-xs font-medium bg-[var(--accent-light)] text-[var(--accent)] rounded">
          {measure.metadata.program.replace('_', ' ')}
        </span>
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${getConfidenceColor(measure.overallConfidence)} bg-current/10`}>
          {measure.overallConfidence} confidence
        </span>
        {isLocked && (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-[var(--success-light)] text-[var(--success)] flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Locked
          </span>
        )}
      </div>

      {/* Row 2: Name + metadata inline + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text)] truncate group-hover:text-[var(--accent)] transition-colors">
            {measure.metadata.title}
          </h3>
          <span className="flex items-center gap-1 text-xs text-[var(--text-dim)] whitespace-nowrap">
            <Clock className="w-3 h-3" />
            {isLocked ? new Date(measure.lockedAt ).toLocaleDateString() : new Date(measure.updatedAt).toLocaleDateString()}
          </span>
          <span className={`flex items-center gap-1 text-xs whitespace-nowrap ${progress === 100 ? 'text-[var(--success)]' : 'text-[var(--text-dim)]'}`}>
            <CheckCircle className="w-3 h-3" />
            {approved}/{total} reviewed
          </span>
          {flagged > 0 && (
            <span className="flex items-center gap-1 text-xs text-[var(--warning)] whitespace-nowrap">
              <AlertTriangle className="w-3 h-3" />
              {flagged} flagged
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className="p-1.5 text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] rounded transition-colors"
            title="Duplicate measure"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {!isPublished && progress === 100 && (
            <button
              onClick={(e) => { e.stopPropagation(); onPublish(); }}
              className="p-1.5 text-[var(--success)] hover:bg-[var(--success-light)] rounded transition-colors"
              title="Publish measure"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
          {isPublished && (
            <button
              onClick={(e) => { e.stopPropagation(); onUnpublish(); }}
              className="p-1.5 text-[var(--warning)] hover:bg-[var(--warning-light)] rounded transition-colors"
              title="Unpublish"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
          {canLock && !isPublished && (
            <button
              onClick={(e) => { e.stopPropagation(); onLock(); }}
              className="p-1.5 text-[var(--accent)] hover:bg-[var(--accent-light)] rounded transition-colors"
              title="Lock for publish"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}
          {isLocked && (
            <button
              onClick={(e) => { e.stopPropagation(); onUnlock(); }}
              className="p-1.5 text-[var(--warning)] hover:bg-[var(--warning-light)] rounded transition-colors"
              title="Unlock for editing"
            >
              <Unlock className="w-3.5 h-3.5" />
            </button>
          )}
          {!isLocked && !isPublished && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 text-[var(--text-dim)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] rounded transition-colors"
              title="Delete measure"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Progress ring */}
          <div className="relative w-8 h-8 ml-1">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
              <circle
                cx="16" cy="16" r="12"
                fill="none"
                stroke="var(--border)"
                strokeWidth="3"
              />
              <circle
                cx="16" cy="16" r="12"
                fill="none"
                stroke={isPublished ? 'var(--success)' : isLocked ? 'var(--success)' : progress === 100 ? 'var(--success)' : 'var(--accent)'}
                strokeWidth="3"
                strokeDasharray={`${progress * 0.754} 75.4`}
                strokeLinecap="round"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-medium ${isPublished || isLocked ? 'text-[var(--success)]' : ''}`}>
              {isPublished ? <Send className="w-3 h-3" /> : isLocked ? <Lock className="w-3 h-3" /> : `${progress}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Description (single line truncated) */}
      <p className="text-xs text-[var(--text-muted)] mt-1.5 truncate">
        {measure.metadata.description}
      </p>
    </div>
  );
}
