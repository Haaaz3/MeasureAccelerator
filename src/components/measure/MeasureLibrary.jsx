import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Trash2, Clock, CheckCircle, AlertTriangle, Lock, Unlock, Shield, Brain, Zap, ChevronDown, Send, Edit3, Plus, Copy, X, ArrowUp, ArrowDown, Building2, Filter } from 'lucide-react';
import { useMeasureStore } from '../../stores/measureStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore';
import { ingestMeasureFiles } from '../../services/measureIngestion';
import { MeasureCreator } from './MeasureCreator';

const PROGRAM_LABELS                                 = {
  'MIPS_CQM': 'MIPS CQM',
  'eCQM': 'eCQM',
  'HEDIS': 'HEDIS',
  'QOF': 'QOF',
  'Registry': 'Registry',
  'Custom': 'Custom',
};

// Helper to reset review status recursively
function resetReviewStatus(obj     )      {
  if (!obj) return obj;
  const result = { ...obj, reviewStatus: 'pending' };
  if (result.children) {
    result.children = result.children.map(resetReviewStatus);
  }
  return result;
}

export function MeasureLibrary() {
  const navigate = useNavigate();
  const { measures, addMeasure, importMeasure, deleteMeasure, setActiveMeasure, getReviewProgress, lockMeasure, unlockMeasure, setMeasureStatus, updateMeasure } = useMeasureStore();
  const { linkMeasureComponents, rebuildUsageIndex } = useComponentLibraryStore();
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

  // Batch queue state
  const [batchQueue, setBatchQueue] = useState          ([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [queueDragActive, setQueueDragActive] = useState(false);
  const queueInputRef = useRef                  (null);
  const batchQueueRef = useRef          ([]);
  const processingRef = useRef(false);
  const batchCounterRef = useRef({ index: 0, total: 0 });

  // Filtering and sorting state
  const [statusTab, setStatusTab] = useState           ('all');
  const [selectedPrograms, setSelectedPrograms] = useState                     (new Set());
  const [sortDirection, setSortDirection] = useState               ('asc');
  const [showProgramDropdown, setShowProgramDropdown] = useState(false);
  const programDropdownRef = useRef                (null);

  // Close program dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e            ) => {
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
  const SUPPORTED_EXTENSIONS = ['.pdf', '.html', '.htm', '.xlsx', '.xls', '.csv', '.xml', '.json', '.cql', '.txt', '.zip'];

  const isFileSupported = (file      ) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  };

  // Process the next item in the queue (or the first file group)
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

    const activeApiKey = getActiveApiKey();
    const customConfig = selectedProvider === 'custom' ? getCustomLlmConfig() : undefined;

    const label = counter.total > 1 ? `[${counter.index}/${counter.total}] ` : '';
    setProgress({ stage: 'loading', message: `${label}Starting...`, progress: 0 });

    const wrappedSetProgress = (p                   ) => {
      const ct = batchCounterRef.current;
      const lbl = ct.total > 1 ? `[${ct.index}/${ct.total}] ` : '';
      setProgress({ ...p, message: `${lbl}${p.message}` });
    };

    try {
      console.log('[processNext] Calling ingestMeasureFiles...');
      const result = await ingestMeasureFiles(files, activeApiKey, wrappedSetProgress, selectedProvider, selectedModel, customConfig);
      console.log('[processNext] ingestMeasureFiles returned:', { success: result.success, hasUms: !!result.ums, error: result.error });

      if (result.success && result.ums) {
        const measureWithStatus = { ...result.ums, status: 'in_progress'                  };

        // Import to backend for persistence (falls back to local if backend fails)
        const importResult = await importMeasure(measureWithStatus);
        if (!importResult.success) {
          console.warn('Backend import failed, measure saved locally only:', importResult.error);
        }

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
                node = { ...node, libraryComponentId: linkMap[node.id] };
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
      } else {
        setError(result.error || 'Failed to extract measure specification');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }

    // Brief pause then process next
    setTimeout(() => processNext(), 1500);
  }, [getActiveApiKey, importMeasure, updateMeasure, selectedProvider, selectedModel, getCustomLlmConfig, linkMeasureComponents, rebuildUsageIndex, measures]);

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

    if (!processingRef.current) {
      // Start processing
      processingRef.current = true;
      setIsProcessing(true);
      setError(null);
      batchCounterRef.current.index = 0;
      processNext();
    }
  }, [getActiveApiKey, getActiveProvider, selectedProvider, selectedModel, getCustomLlmConfig, processNext]);

  const handleDrop = useCallback(async (e                 ) => {
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
  const handleQueueDrop = useCallback((e                 ) => {
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
  }, []);

  const handleQueueFileInput = useCallback((e                                     ) => {
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
  }, []);

  const removeFromQueue = useCallback((index        ) => {
    batchQueueRef.current = batchQueueRef.current.filter((_, i) => i !== index);
    setBatchQueue([...batchQueueRef.current]);
    batchCounterRef.current.total = Math.max(batchCounterRef.current.total - 1, 0);
    setBatchTotal(batchCounterRef.current.total);
  }, []);

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

  return (
    <div className="flex-1 overflow-auto">
      {/* Page Header */}
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border)] px-6 py-5">
        <div className="w-full">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[var(--text)]">Measure Library</h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Upload measure specifications for AI-powered extraction and UMS generation
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreator(true)}
                className="h-10 px-4 bg-[var(--primary)] text-black rounded-lg font-semibold hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Measure
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="w-full">

        {/* Upload Zone */}
        {isProcessing || batchQueue.length > 0 ? (
          <div className="border-2 border-[var(--primary)]/50 rounded-xl mb-6 bg-[var(--bg-tertiary)] overflow-hidden">
            {/* Current processing */}
            <div className="p-8 text-center">
              {progress?.stage === 'complete' ? (
                <div className="space-y-3">
                  <CheckCircle className="w-10 h-10 mx-auto text-[var(--success)]" />
                  <p className="text-[var(--success)] font-medium">{progress.message}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="relative">
                      <Brain className="w-12 h-12 text-[var(--accent)]" />
                      <Zap className="w-5 h-5 text-[var(--warning)] absolute -right-1 -bottom-1 animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[var(--text)] font-medium mb-2">{progress?.message || 'Processing...'}</p>
                    <div className="w-80 mx-auto h-2 bg-[var(--border)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] transition-all duration-500"
                        style={{ width: `${progress?.progress || 0}%` }}
                      />
                    </div>
                    {progress?.details && (
                      <p className="text-xs text-[var(--text-dim)] mt-2">{progress.details}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Queued items */}
            {batchQueue.length > 0 && (
              <div className="border-t border-[var(--border)]">
                {batchQueue.map((files, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] last:border-b-0 bg-[var(--bg-elevated)]/50"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-[var(--text-dim)]" />
                      <span className="text-sm text-[var(--text)]">
                        Queued: {files.map(f => f.name).join(', ')}
                      </span>
                      <span className="text-xs text-[var(--text-dim)]">
                        ({files.length} file{files.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <button
                      onClick={() => removeFromQueue(idx)}
                      className="p-1 text-[var(--text-dim)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] rounded transition-colors"
                      title="Remove from queue"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Queue drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setQueueDragActive(true); }}
              onDragLeave={(e) => { e.stopPropagation(); setQueueDragActive(false); }}
              onDrop={handleQueueDrop}
              className={`relative border-t-2 border-dashed p-5 text-center transition-all cursor-pointer ${
                queueDragActive
                  ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                  : 'border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <input
                ref={queueInputRef}
                type="file"
                accept={SUPPORTED_EXTENSIONS.join(',')}
                multiple
                onChange={handleQueueFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex items-center justify-center gap-2">
                <Plus className={`w-4 h-4 ${queueDragActive ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'}`} />
                <span className={`text-sm font-medium ${queueDragActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                  Drop files for another measure
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl p-10 text-center transition-all mb-6 bg-[var(--bg-tertiary)]
              ${dragActive
                ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                : 'border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--bg-elevated)]'
              }
            `}
          >
            <input
              type="file"
              accept={SUPPORTED_EXTENSIONS.join(',')}
              multiple
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {progress?.stage === 'complete' ? (
              <div className="space-y-4">
                <CheckCircle className="w-12 h-12 mx-auto text-[var(--success)]" />
                <p className="text-[var(--success)] font-medium">{progress.message}</p>
              </div>
            ) : (
              <>
                <Upload className={`w-10 h-10 mx-auto mb-3 ${dragActive ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'}`} />
                <p className="text-[var(--text)] font-medium mb-1">
                  Drop measure specification files here
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  Supports PDF, HTML, Excel, XML, JSON, CQL, and ZIP packages
                </p>
              </>
            )}
          </div>
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

        {/* Tabs and Filters */}
        <div className="flex items-center justify-between mb-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-lg p-1">
            <button
              onClick={() => setStatusTab('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                statusTab === 'all'
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              All ({statusCounts.all})
            </button>
            <button
              onClick={() => setStatusTab('in_progress')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                statusTab === 'in_progress'
                  ? 'bg-[var(--warning-light)] text-[var(--warning)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              In Progress ({statusCounts.inProgress})
            </button>
            <button
              onClick={() => setStatusTab('published')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                statusTab === 'published'
                  ? 'bg-[var(--success-light)] text-[var(--success)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Published ({statusCounts.published})
            </button>
          </div>

          {/* Program Filter (Multi-select) */}
          {availablePrograms.length > 0 && (
            <div className="relative" ref={programDropdownRef}>
              <button
                type="button"
                onClick={() => setShowProgramDropdown(!showProgramDropdown)}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm cursor-pointer transition-colors focus:outline-none ${
                  selectedPrograms.size > 0
                    ? 'bg-[var(--accent-light)] border-[var(--accent)]/40 text-[var(--accent)]'
                    : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text)]'
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

          {/* Sort Direction Toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--text-dim)]">Sort:</span>
            <button
              type="button"
              onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] hover:border-[var(--accent)] transition-colors"
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

        {/* Measures Grid */}
        {filteredMeasures.length > 0 ? (
          <div className="grid gap-4">
            {filteredMeasures.map((measure) => (
              <MeasureCard
                key={measure.id}
                measure={measure}
                reviewProgress={getReviewProgress(measure.id)}
                onSelect={() => {
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
                    // Rebuild usage index to clean up component references
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
      </div>

      {/* Measure Creator Modal */}
      <MeasureCreator isOpen={showCreator} onClose={() => setShowCreator(false)} />
    </div>
  );
}

function MeasureCard({
  measure,
  reviewProgress,
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
      className={`bg-[var(--bg-elevated)] border rounded-xl p-5 transition-all cursor-pointer group overflow-visible ${
        isPublished
          ? 'border-[var(--success)]/40'
          : isLocked
            ? 'border-[var(--success)]/50'
            : 'border-[var(--border)] hover:border-[var(--primary)]/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-4 overflow-visible">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {/* Status Badge */}
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

          <h3 className="text-[var(--text)] font-semibold mb-1 truncate group-hover:text-[var(--accent)] transition-colors">
            {measure.metadata.title}
          </h3>
          <p className="text-sm text-[var(--text-muted)] line-clamp-2">
            {measure.metadata.description}
          </p>

          <div className="flex items-center gap-6 mt-4 text-xs text-[var(--text-dim)]">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {isLocked ? `Locked ${new Date(measure.lockedAt ).toLocaleDateString()}` : `Updated ${new Date(measure.updatedAt).toLocaleDateString()}`}
            </span>
            <span className={`flex items-center gap-1.5 ${progress === 100 ? 'text-[var(--success)]' : ''}`}>
              <CheckCircle className="w-3.5 h-3.5" />
              {approved}/{total} reviewed
            </span>
            {flagged > 0 && (
              <span className="flex items-center gap-1.5 text-[var(--warning)]">
                <AlertTriangle className="w-3.5 h-3.5" />
                {flagged} flagged
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            {/* Copy */}
            <button
              onClick={(e) => { e.stopPropagation(); onCopy(); }}
              className="p-2 text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] rounded-lg transition-colors"
              title="Duplicate measure"
            >
              <Copy className="w-4 h-4" />
            </button>
            {/* Publish/Unpublish */}
            {!isPublished && progress === 100 && (
              <button
                onClick={(e) => { e.stopPropagation(); onPublish(); }}
                className="p-2 text-[var(--success)] hover:bg-[var(--success-light)] rounded-lg transition-colors"
                title="Publish measure"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
            {isPublished && (
              <button
                onClick={(e) => { e.stopPropagation(); onUnpublish(); }}
                className="p-2 text-[var(--warning)] hover:bg-[var(--warning-light)] rounded-lg transition-colors"
                title="Unpublish (move back to In Progress)"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            {canLock && !isPublished && (
              <button
                onClick={(e) => { e.stopPropagation(); onLock(); }}
                className="p-2 text-[var(--accent)] hover:bg-[var(--accent-light)] rounded-lg transition-colors"
                title="Lock for publish"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}
            {isLocked && (
              <button
                onClick={(e) => { e.stopPropagation(); onUnlock(); }}
                className="p-2 text-[var(--warning)] hover:bg-[var(--warning-light)] rounded-lg transition-colors"
                title="Unlock for editing"
              >
                <Unlock className="w-4 h-4" />
              </button>
            )}
            {!isLocked && !isPublished && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-2 text-[var(--text-dim)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] rounded-lg transition-colors"
                title="Delete measure"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="relative w-12 h-12 flex-shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24" cy="24" r="20"
                fill="none"
                stroke="var(--border)"
                strokeWidth="4"
              />
              <circle
                cx="24" cy="24" r="20"
                fill="none"
                stroke={isPublished ? 'var(--success)' : isLocked ? 'var(--success)' : progress === 100 ? 'var(--success)' : 'var(--accent)'}
                strokeWidth="4"
                strokeDasharray={`${progress * 1.256} 126`}
                strokeLinecap="round"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-xs font-medium ${isPublished || isLocked ? 'text-[var(--success)]' : ''}`}>
              {isPublished ? <Send className="w-4 h-4" /> : isLocked ? <Lock className="w-4 h-4" /> : `${progress}%`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
