import { useState, useCallback, useMemo, useRef } from 'react';
import { Upload, FileText, Trash2, Clock, CheckCircle, AlertTriangle, Lock, Unlock, Shield, Brain, Zap, ChevronDown, Send, Edit3, Plus, Copy, X } from 'lucide-react';
import { useMeasureStore } from '../../stores/measureStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore';
import { ingestMeasureFiles, type IngestionProgress } from '../../services/measureIngestion';
import { MeasureCreator } from './MeasureCreator';
import type { UniversalMeasureSpec, MeasureStatus } from '../../types/ums';

type StatusTab = 'all' | 'in_progress' | 'published';
type ProgramFilter = 'all' | 'MIPS_CQM' | 'eCQM' | 'HEDIS' | 'QOF' | 'Registry' | 'Custom';

// Helper to reset review status recursively
function resetReviewStatus(obj: any): any {
  if (!obj) return obj;
  const result = { ...obj, reviewStatus: 'pending' };
  if (result.children) {
    result.children = result.children.map(resetReviewStatus);
  }
  return result;
}

export function MeasureLibrary() {
  const { measures, addMeasure, deleteMeasure, setActiveMeasure, getReviewProgress, lockMeasure, unlockMeasure, setMeasureStatus } = useMeasureStore();
  const { linkMeasureComponents, recalculateUsage } = useComponentLibraryStore();
  const {
    selectedProvider,
    selectedModel,
    getActiveApiKey,
    getActiveProvider,
    getCustomLlmConfig,
  } = useSettingsStore();

  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<IngestionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);

  // Batch queue state
  const [batchQueue, setBatchQueue] = useState<File[][]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [queueDragActive, setQueueDragActive] = useState(false);
  const queueInputRef = useRef<HTMLInputElement>(null);
  const batchQueueRef = useRef<File[][]>([]);
  const processingRef = useRef(false);
  const batchCounterRef = useRef({ index: 0, total: 0 });

  // Filtering state
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [programFilter, setProgramFilter] = useState<ProgramFilter>('all');

  // Get store's setActiveTab for navigation
  const { setActiveTab } = useMeasureStore();

  // Supported file extensions
  const SUPPORTED_EXTENSIONS = ['.pdf', '.html', '.htm', '.xlsx', '.xls', '.csv', '.xml', '.json', '.cql', '.txt', '.zip'];

  const isFileSupported = (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  };

  // Process the next item in the queue (or the first file group)
  const processNext = useCallback(async () => {
    const queue = batchQueueRef.current;
    if (queue.length === 0) {
      // All done
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

    const wrappedSetProgress = (p: IngestionProgress) => {
      const ct = batchCounterRef.current;
      const lbl = ct.total > 1 ? `[${ct.index}/${ct.total}] ` : '';
      setProgress({ ...p, message: `${lbl}${p.message}` });
    };

    try {
      const result = await ingestMeasureFiles(files, activeApiKey, wrappedSetProgress, selectedProvider, selectedModel, customConfig);

      if (result.success && result.ums) {
        const measureWithStatus = { ...result.ums, status: 'in_progress' as MeasureStatus };
        addMeasure(measureWithStatus);

        // Immediately match against component library — link to existing approved components
        linkMeasureComponents(
          measureWithStatus.metadata.measureId,
          measureWithStatus.populations,
        );
        // Recalculate usage counts across all measures (including the new one)
        recalculateUsage([...measures, measureWithStatus]);

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
  }, [getActiveApiKey, addMeasure, selectedProvider, selectedModel, getCustomLlmConfig, linkMeasureComponents, recalculateUsage, measures]);

  // Handle files: either start processing or add to queue
  const handleFiles = useCallback(async (files: File[]) => {
    const supportedFiles = files.filter(isFileSupported);

    if (supportedFiles.length === 0) {
      setError('Please upload measure specification files (PDF, HTML, Excel, XML, JSON, CQL, or ZIP)');
      return;
    }

    // Validate API key upfront
    const activeApiKey = getActiveApiKey();
    const activeProvider = getActiveProvider();
    const customConfig = selectedProvider === 'custom' ? getCustomLlmConfig() : undefined;

    if (selectedProvider === 'custom') {
      if (!customConfig?.baseUrl) {
        setError('Please configure your Custom LLM base URL in Settings to use AI-powered extraction');
        return;
      }
    } else if (!activeApiKey) {
      setError(`Please configure your ${activeProvider.name} API key in Settings to use AI-powered extraction`);
      return;
    }

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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  }, [handleFiles]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    await handleFiles(Array.from(files));
    e.target.value = '';
  }, [handleFiles]);

  // Queue-specific drop handler
  const handleQueueDrop = useCallback((e: React.DragEvent) => {
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

  const handleQueueFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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

  const removeFromQueue = useCallback((index: number) => {
    batchQueueRef.current = batchQueueRef.current.filter((_, i) => i !== index);
    setBatchQueue([...batchQueueRef.current]);
    batchCounterRef.current.total = Math.max(batchCounterRef.current.total - 1, 0);
    setBatchTotal(batchCounterRef.current.total);
  }, []);

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-[var(--success)]';
      case 'medium': return 'text-[var(--warning)]';
      case 'low': return 'text-[var(--danger)]';
      default: return 'text-[var(--text-muted)]';
    }
  };

  // Filter measures based on status tab and program filter
  const filteredMeasures = useMemo(() => {
    return measures.filter((m) => {
      // Status filter
      const status = m.status || 'in_progress'; // Default to in_progress for legacy measures
      if (statusTab !== 'all' && status !== statusTab) return false;

      // Program filter
      if (programFilter !== 'all' && m.metadata.program !== programFilter) return false;

      return true;
    });
  }, [measures, statusTab, programFilter]);

  // Get unique programs for filter dropdown
  const availablePrograms = useMemo(() => {
    const programs = new Set(measures.map(m => m.metadata.program));
    return Array.from(programs);
  }, [measures]);

  // Count measures by status
  const statusCounts = useMemo(() => {
    const inProgress = measures.filter(m => (m.status || 'in_progress') === 'in_progress').length;
    const published = measures.filter(m => m.status === 'published').length;
    return { inProgress, published, all: measures.length };
  }, [measures]);

  // Copy a measure - simple deep clone with title change
  const handleCopyMeasure = useCallback((measure: UniversalMeasureSpec) => {
    const now = new Date().toISOString();
    const newId = `ums-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Deep clone the entire measure
    const copiedMeasure: UniversalMeasureSpec = JSON.parse(JSON.stringify(measure));

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
    setActiveMeasure(copiedMeasure.id);
  }, [addMeasure, setActiveMeasure]);

  return (
    <div className="flex-1 overflow-auto">
      {/* Page Header */}
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border)] px-6 py-5">
        <div className="max-w-5xl mx-auto">
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
        <div className="max-w-5xl mx-auto">

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
                  onClick={() => setActiveTab('settings')}
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

          {/* Program Filter */}
          {availablePrograms.length > 1 && (
            <div className="relative">
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value as ProgramFilter)}
                className="px-4 py-2 pr-8 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] appearance-none cursor-pointer focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="all">All Programs</option>
                {availablePrograms.map(program => (
                  <option key={program} value={program}>{program.replace('_', ' ')}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)] pointer-events-none" />
            </div>
          )}
        </div>

        {/* Measures Grid */}
        {filteredMeasures.length > 0 ? (
          <div className="grid gap-4">
            {filteredMeasures.map((measure) => (
              <MeasureCard
                key={measure.id}
                measure={measure}
                reviewProgress={getReviewProgress(measure.id)}
                onSelect={() => setActiveMeasure(measure.id)}
                onDelete={() => {
                  if (measure.lockedAt) {
                    alert('Cannot delete a locked measure. Unlock it first.');
                    return;
                  }
                  if (confirm(`Delete "${measure.metadata.title}"?`)) {
                    deleteMeasure(measure.id);
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
              onClick={() => { setStatusTab('all'); setProgramFilter('all'); }}
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
}: {
  measure: UniversalMeasureSpec;
  reviewProgress: { approved: number; total: number; pending: number; flagged: number };
  onSelect: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  getConfidenceColor: (c: string) => string;
}) {
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
              {isLocked ? `Locked ${new Date(measure.lockedAt!).toLocaleDateString()}` : `Updated ${new Date(measure.updatedAt).toLocaleDateString()}`}
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
