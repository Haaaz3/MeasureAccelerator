import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code, Copy, Check, Download, RefreshCw, FileCode, Database, Sparkles, Library, ChevronRight, CheckCircle, XCircle, AlertTriangle, Loader2, Server, Search, X, ChevronUp, ChevronDown, Edit3 } from 'lucide-react';
import { useMeasureStore } from '../../stores/measureStore';
import { generateCQL, validateCQL, isCQLServiceAvailable } from '../../services/cqlGenerator';
import { validateCQLSyntax,                                                       } from '../../services/cqlValidator';
import { generateHDISQL, DEFAULT_HDI_CONFIG } from '../../services/hdiSqlGenerator';
import { validateHDISQL,                                                    } from '../../services/hdiSqlValidator';
import { InlineErrorBanner } from '../shared/ErrorBoundary';
import { applyCQLOverrides, applySQLOverrides, getOverrideCountForMeasure, getOverridesForMeasure } from '../../services/codeOverrideHelper';
import { useComponentCodeStore } from '../../stores/componentCodeStore';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore';
import { generateComponentAwareMeasureCode } from '../../services/componentAwareCodeGenerator';
import { MeasureCodeEditor } from './MeasureCodeEditor';

export function CodeGeneration() {
  const navigate = useNavigate();
  const {
    selectedCodeFormat,
    setSelectedCodeFormat,
    setLastGeneratedCode,
    saveMeasureCodeOverride,
    revertMeasureCodeOverride,
    getMeasureCodeOverride,
    measureCodeOverrides,
  } = useMeasureStore();
  // Use Zustand selector for reactive updates when measure is edited
  const measure = useMeasureStore((state) =>
    state.measures.find((m) => m.id === state.activeMeasureId) || null
  );
  const format = selectedCodeFormat;
  const setFormat = setSelectedCodeFormat;

  // Subscribe to code stores for reactivity when components are edited or overridden
  const codeStates = useComponentCodeStore((state) => state.codeStates);
  const libraryComponents = useComponentLibraryStore((state) => state.components);

  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cqlServiceAvailable, setCqlServiceAvailable] = useState                (null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState                            (null);
  const [generationResult, setGenerationResult] = useState                            (null);

  // Syntax validation (local, runs automatically on generation)
  const [syntaxValidationResult, setSyntaxValidationResult] = useState                                  (null);

  // Synapse SQL state
  const [synapseResult, setSynapseResult] = useState                            (null);
  const [synapseValidation, setSynapseValidation] = useState                               (null);
  const [isValidatingSynapse, setIsValidatingSynapse] = useState(false);

  // Generation error state
  const [generationError, setGenerationError] = useState               (null);

  // Component-aware generation result (for composition stats)
  const [composedResult, setComposedResult] = useState                            (null);
  const [useComponentAware, setUseComponentAware] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchResults, setSearchResults] = useState          ([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const codeRef = useRef                (null);
  const searchInputRef = useRef                  (null);
  const currentMatchRef = useRef             (null);

  // Override audit panel state
  const [showAuditDetails, setShowAuditDetails] = useState(false);

  // Code editor mode state
  const [showCodeEditor, setShowCodeEditor] = useState(false);

  // Get measure-level code override for current format
  const measureOverrideKey = measure ? `${measure.id}::${format === 'cql' ? 'cql' : 'synapse-sql'}` : null;
  const measureOverride = measureOverrideKey ? measureCodeOverrides[measureOverrideKey] : null;

  // Get the current displayed code (with override applied if present)
  const currentDisplayedCode = useMemo(() => {
    if (measureOverride?.code) {
      return measureOverride.code;
    }
    if (format === 'cql' && generationResult?.cql) {
      return generationResult.cql;
    }
    if (format === 'synapse' && synapseResult?.sql) {
      return synapseResult.sql;
    }
    return null;
  }, [format, generationResult, synapseResult, measureOverride]);

  // Original generated code (before any overrides)
  const originalGeneratedCode = useMemo(() => {
    if (format === 'cql' && generationResult?.cql) {
      return generationResult.cql;
    }
    if (format === 'synapse' && synapseResult?.sql) {
      return synapseResult.sql;
    }
    return null;
  }, [format, generationResult, synapseResult]);

  // Handler for saving code edits
  const handleSaveCodeOverride = useCallback(async (code, note) => {
    if (!measure) return;
    const formatKey = format === 'cql' ? 'cql' : 'synapse-sql';
    saveMeasureCodeOverride(
      measure.id,
      formatKey,
      code,
      note,
      originalGeneratedCode
    );
    setShowCodeEditor(false);
  }, [measure, format, saveMeasureCodeOverride, originalGeneratedCode]);

  // Handler for reverting to generated code
  const handleRevertCodeOverride = useCallback(() => {
    if (!measure) return;
    const formatKey = format === 'cql' ? 'cql' : 'synapse-sql';
    revertMeasureCodeOverride(measure.id, formatKey);
  }, [measure, format, revertMeasureCodeOverride]);

  // Override count for current measure and format
  const overrideCount = useMemo(() => {
    if (!measure) return 0;
    // Map format to CodeOutputFormat for override lookup
    const formatMap                                                    = {
      'cql': 'cql',
      'synapse': 'synapse-sql',
    };
    return getOverrideCountForMeasure(measure, formatMap[format]);
  }, [measure, format, codeStates]);

  // Check CQL service availability on mount
  useEffect(() => {
    isCQLServiceAvailable().then(setCqlServiceAvailable);
  }, []);

  // Helper to extract embedded WARNING comments from generated code
  const extractEmbeddedWarnings = useCallback((code        )           => {
    const warnings           = [];
    const warningPattern = /\/\*\s*WARNING:\s*([^*]+)\*\//g;
    const commentPattern = /--\s*WARNING:\s*(.+)$/gm;

    let match;
    while ((match = warningPattern.exec(code)) !== null) {
      warnings.push(match[1].trim());
    }
    while ((match = commentPattern.exec(code)) !== null) {
      warnings.push(match[1].trim());
    }

    return warnings;
  }, []);

  // Search functionality
  const performSearch = useCallback((query        , code        ) => {
    if (!query.trim() || !code) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    const results           = [];
    const lowerQuery = query.toLowerCase();
    const lowerCode = code.toLowerCase();
    let pos = 0;

    while ((pos = lowerCode.indexOf(lowerQuery, pos)) !== -1) {
      results.push(pos);
      pos += 1;
    }

    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
  }, []);

  const navigateSearch = useCallback((direction                 ) => {
    if (searchResults.length === 0) return;

    let newIndex = currentSearchIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    }
    setCurrentSearchIndex(newIndex);
  }, [currentSearchIndex, searchResults.length]);

  const toggleSearch = useCallback(() => {
    setSearchVisible(prev => {
      if (!prev) {
        setTimeout(() => searchInputRef.current?.focus(), 0);
      } else {
        setSearchQuery('');
        setSearchResults([]);
      }
      return !prev;
    });
  }, []);

  // Keyboard shortcuts for search
  useEffect(() => {
    const handleKeyDown = (e               ) => {
      // Ctrl/Cmd + F to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        if (!searchVisible) {
          toggleSearch();
        } else {
          searchInputRef.current?.focus();
        }
      }
      // Escape to close search
      if (e.key === 'Escape' && searchVisible) {
        toggleSearch();
      }
      // Enter/Shift+Enter to navigate results
      if (e.key === 'Enter' && searchVisible && searchResults.length > 0) {
        e.preventDefault();
        navigateSearch(e.shiftKey ? 'prev' : 'next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchVisible, searchResults.length, navigateSearch, toggleSearch]);

  // Update search results when query or code changes
  useEffect(() => {
    const code = format === 'cql' && generationResult?.cql
      ? generationResult.cql
      : format === 'synapse' && synapseResult?.sql
      ? synapseResult.sql
      : '';
    performSearch(searchQuery, code);
  }, [searchQuery, generationResult?.cql, synapseResult?.sql, format, performSearch]);

  // Scroll to current match when it changes
  useEffect(() => {
    if (currentMatchRef.current && searchResults.length > 0) {
      currentMatchRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentSearchIndex, searchResults.length]);

  // Helper to highlight search matches in code
  const highlightCode = useCallback((code        )                  => {
    if (!searchQuery.trim() || searchResults.length === 0) {
      return code;
    }

    const parts                    = [];
    let lastIndex = 0;
    const lowerQuery = searchQuery.toLowerCase();
    const lowerCode = code.toLowerCase();

    searchResults.forEach((pos, idx) => {
      // Add text before match
      if (pos > lastIndex) {
        parts.push(code.substring(lastIndex, pos));
      }

      // Add highlighted match
      const matchText = code.substring(pos, pos + searchQuery.length);
      const isCurrentMatch = idx === currentSearchIndex;
      parts.push(
        <mark
          key={`match-${idx}`}
          ref={isCurrentMatch ? currentMatchRef : undefined}
          className={`${isCurrentMatch ? 'bg-[var(--accent)] text-white' : 'bg-[var(--warning)]/40'} rounded px-0.5`}
        >
          {matchText}
        </mark>
      );

      lastIndex = pos + searchQuery.length;
    });

    // Add remaining text
    if (lastIndex < code.length) {
      parts.push(code.substring(lastIndex));
    }

    return <>{parts}</>;
  }, [searchQuery, searchResults, currentSearchIndex]);

  // Update generation result when measure changes
  useEffect(() => {
    if (measure && format === 'cql') {
      try {
        setGenerationError(null);

        if (useComponentAware) {
          // Use component-aware generation (pulls from library component code)
          const composed = generateComponentAwareMeasureCode(measure);
          setComposedResult(composed);

          // Create a CQL result object from composed code
          const result                      = {
            success: true,
            cql: composed.cql,
            warnings: [...composed.warnings],
            metadata: {
              libraryName: (measure.metadata.measureId || 'Measure').replace(/[^a-zA-Z0-9]/g, ''),
              version: measure.metadata.version || '1.0.0',
              populationCount: measure.populations?.length ?? 0,
              valueSetCount: measure.valueSets?.length ?? 0,
              definitionCount: composed.populations.length,
            },
          };

          // Add composition stats to warnings
          if (composed.componentFromLibraryCount > 0) {
            result.warnings?.unshift(`${composed.componentFromLibraryCount}/${composed.componentCount} components from library`);
          }
          if (composed.overrideCount > 0) {
            result.warnings?.unshift(`${composed.overrideCount} component(s) with code overrides`);
          }

          // Run local syntax validation
          const syntaxResult = validateCQLSyntax(result.cql);
          setSyntaxValidationResult(syntaxResult);

          setGenerationResult(result);
          setValidationResult(null);

          // Update co-pilot context with generated CQL
          setLastGeneratedCode(result.cql || null, null, measure?.id || null);
        } else {
          // Fall back to standard generation (for comparison/debugging)
          const result = generateCQL(measure);

          // Apply code overrides if any exist
          if (result.success && result.cql) {
            const { code: modifiedCql, overrideCount: appliedOverrides } = applyCQLOverrides(result.cql, measure);
            result.cql = modifiedCql;

            // Add warning about overrides if any were applied
            if (appliedOverrides > 0 && result.warnings) {
              result.warnings.unshift(`${appliedOverrides} component(s) using manually overridden code`);
            }

            // Run local syntax validation immediately after generation
            const syntaxResult = validateCQLSyntax(result.cql);
            setSyntaxValidationResult(syntaxResult);
          } else {
            setSyntaxValidationResult(null);
          }

          setGenerationResult(result);
          setComposedResult(null);
          setValidationResult(null);

          // Update co-pilot context with generated CQL
          if (result.success && result.cql) {
            setLastGeneratedCode(result.cql, null, measure?.id || null);
          }

          // Check for generation-level errors
          if (!result.success && result.errors && result.errors.length > 0) {
            setGenerationError(`Cannot generate CQL: ${result.errors.join(', ')}`);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during CQL generation';
        setGenerationError(`CQL generation failed: ${errorMessage}`);
        setGenerationResult(null);
        setComposedResult(null);
        setSyntaxValidationResult(null);
      }
    }
  }, [measure, format, useComponentAware, codeStates, libraryComponents]);

  // Generate Synapse SQL when format is 'synapse'
  useEffect(() => {
    if (measure && format === 'synapse') {
      try {
        setGenerationError(null);

        if (useComponentAware) {
          // Use component-aware generation
          const composed = generateComponentAwareMeasureCode(measure);
          setComposedResult(composed);

          // Create a SQL result object from composed code
          const result                      = {
            success: true,
            sql: composed.sql,
            warnings: [...composed.warnings],
            errors: [],
            metadata: {
              predicateCount: composed.componentCount,
              dataModelsUsed: ['CONDITION', 'ENCOUNTER', 'PROCEDURE', 'RESULT'],
              estimatedComplexity: composed.componentCount > 10 ? 'high' : composed.componentCount > 5 ? 'medium' : 'low',
              generatedAt: new Date().toISOString(),
            },
          };

          // Add composition stats to warnings
          if (composed.componentFromLibraryCount > 0) {
            result.warnings.unshift(`${composed.componentFromLibraryCount}/${composed.componentCount} components from library`);
          }
          if (composed.overrideCount > 0) {
            result.warnings.unshift(`${composed.overrideCount} component(s) with code overrides`);
          }

          setSynapseResult(result);
          setSynapseValidation(null);

          // Update co-pilot context with generated SQL
          setLastGeneratedCode(null, result.sql || null, measure?.id || null);
        } else {
          // Fall back to standard generation
          const result = generateHDISQL(measure, {
            ...DEFAULT_HDI_CONFIG,
            measurementPeriod: measure.metadata.measurementPeriod ? {
              start: measure.metadata.measurementPeriod.start || '',
              end: measure.metadata.measurementPeriod.end || '',
            } : undefined,
            ontologyContexts: [
              'HEALTHE INTENT Demographics',
              'HEALTHE INTENT Encounters',
              'HEALTHE INTENT Procedures',
              'HEALTHE INTENT Conditions',
              'HEALTHE INTENT Results',
            ],
          });

          // Apply code overrides if any exist
          if (result.success && result.sql) {
            const { code: modifiedSql, overrideCount: appliedOverrides } = applySQLOverrides(result.sql, measure, 'synapse-sql');
            result.sql = modifiedSql;

            // Add warning about overrides if any were applied
            if (appliedOverrides > 0) {
              result.warnings.unshift(`${appliedOverrides} component(s) using manually overridden code`);
            }
          }

          setSynapseResult(result);
          setComposedResult(null);
          setSynapseValidation(null);

          // Update co-pilot context with generated SQL
          if (result.success && result.sql) {
            setLastGeneratedCode(null, result.sql, measure?.id || null);
          }

          // Check for generation-level errors
          if (!result.success && result.errors && result.errors.length > 0) {
            setGenerationError(`Cannot generate Synapse SQL: ${result.errors.join(', ')}`);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during Synapse SQL generation';
        setGenerationError(`Synapse SQL generation failed: ${errorMessage}`);
        setSynapseResult(null);
        setComposedResult(null);
      }
    }
  }, [measure, format, useComponentAware, codeStates, libraryComponents]);

  if (!measure) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center">
            <Code className="w-8 h-8 text-[var(--text-dim)]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No Measure Selected</h2>
          <p className="text-[var(--text-muted)] mb-6">
            Select a measure from the library to generate CQL, SQL, or Synapse code.
          </p>
          <button
            onClick={() => navigate('/library')}
            className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors inline-flex items-center gap-2"
          >
            <Library className="w-4 h-4" />
            Go to Measure Library
          </button>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    // Phase 1C: Single authoritative code path - no getGeneratedCode fallback
    const code = (format === 'cql' && generationResult?.cql)
      ? generationResult.cql
      : (format === 'synapse' && synapseResult?.sql)
      ? synapseResult.sql
      : '// Generating...';
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      if (measure && format === 'cql') {
        const result = generateCQL(measure);
        setGenerationResult(result);
        setValidationResult(null);

        // Run local syntax validation on regeneration
        if (result.success && result.cql) {
          const syntaxResult = validateCQLSyntax(result.cql);
          setSyntaxValidationResult(syntaxResult);
        } else {
          setSyntaxValidationResult(null);
        }

        if (!result.success && result.errors && result.errors.length > 0) {
          setGenerationError(`Cannot generate CQL: ${result.errors.join(', ')}`);
        }
      }
      if (measure && format === 'synapse') {
        const result = generateHDISQL(measure, {
          ...DEFAULT_HDI_CONFIG,
          measurementPeriod: measure.metadata.measurementPeriod ? {
            start: measure.metadata.measurementPeriod.start || '',
            end: measure.metadata.measurementPeriod.end || '',
          } : undefined,
          ontologyContexts: [
            'HEALTHE INTENT Demographics',
            'HEALTHE INTENT Encounters',
            'HEALTHE INTENT Procedures',
            'HEALTHE INTENT Conditions',
            'HEALTHE INTENT Results',
          ],
        });
        setSynapseResult(result);
        setSynapseValidation(null);

        if (!result.success && result.errors && result.errors.length > 0) {
          setGenerationError(`Cannot generate Synapse SQL: ${result.errors.join(', ')}`);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during code generation';
      setGenerationError(`Code generation failed: ${errorMessage}`);
    }

    setTimeout(() => setIsGenerating(false), 500);
  };

  const handleValidateSynapse = () => {
    if (!synapseResult?.sql) return;
    setIsValidatingSynapse(true);
    try {
      const config                      = {
        ...DEFAULT_HDI_CONFIG,
        measurementPeriod: measure.metadata.measurementPeriod ? {
          start: measure.metadata.measurementPeriod.start || '',
          end: measure.metadata.measurementPeriod.end || '',
        } : undefined,
      };
      const result = validateHDISQL(synapseResult.sql, config);
      setSynapseValidation(result);
    } catch (err) {
      setSynapseValidation({
        valid: false,
        score: 0,
        errors: [{ severity: 'error', code: 'VALIDATION_ERROR', message: err instanceof Error ? err.message : 'Validation failed' }],
        warnings: [],
        suggestions: [],
      });
    } finally {
      setIsValidatingSynapse(false);
    }
  };

  const handleValidateCQL = async () => {
    if (!generationResult?.cql || format !== 'cql') return;

    setIsValidating(true);
    try {
      const result = await validateCQL(generationResult.cql);
      setValidationResult(result);
    } catch (err) {
      setValidationResult({
        valid: false,
        errors: [{ severity: 'error', message: err instanceof Error ? err.message : 'Validation failed' }],
        warnings: [],
      });
    } finally {
      setIsValidating(false);
    }
  };

  const reviewProgress = measure.reviewProgress;
  const canGenerate = reviewProgress.approved === reviewProgress.total;
  const approvalPercent = Math.round((reviewProgress.approved / reviewProgress.total) * 100);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="w-full">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-4">
          <button
            onClick={() => navigate('/library')}
            className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          >
            Measure Library
          </button>
          <ChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
          <span className="text-[var(--text-muted)]">{measure.metadata.measureId}</span>
          <ChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
          <span className="text-[var(--text)]">Code Generation</span>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[var(--text)]">Code Generation</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Generate executable code from the approved Universal Measure Spec
          </p>
        </div>

        {/* Approval status */}
        {!canGenerate && (
          <div className="mb-6 p-4 bg-[var(--warning-light)] border border-[var(--warning)]/30 rounded-xl">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-[var(--warning)]">Review Required</h3>
                <p className="text-sm text-[var(--warning)] opacity-80 mt-1">
                  All measure components must be approved before generating production code.
                  Currently {approvalPercent}% approved ({reviewProgress.approved}/{reviewProgress.total} components).
                </p>
                <button
                  onClick={() => navigate('/editor')}
                  className="mt-3 px-3 py-1.5 bg-[var(--warning-light)] text-[var(--warning)] rounded-lg text-sm font-medium hover:opacity-80 transition-all border border-[var(--warning)]/20"
                >
                  Continue Review
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Override Audit Summary Panel */}
        {overrideCount > 0 && (() => {
          const overrideSummary = measure ? getOverridesForMeasure(measure) : null;

          return (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <Edit3 className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-amber-500">Manual Overrides Applied ({overrideCount})</h3>
                    <button
                      onClick={() => setShowAuditDetails(!showAuditDetails)}
                      className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400"
                    >
                      {showAuditDetails ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          Show Audit Details
                        </>
                      )}
                    </button>
                  </div>

                  {/* Collapsed view */}
                  {!showAuditDetails && (
                    <p className="text-sm text-amber-500/80 mt-1">
                      {overrideCount} component(s) using manually overridden code. Click "Show Audit Details" to see all overrides.
                    </p>
                  )}

                  {/* Expanded Audit Details */}
                  {showAuditDetails && overrideSummary && (
                    <div className="mt-4 space-y-3">
                      {overrideSummary.overrideInfos.map((info, index) => (
                        <div
                          key={info.componentId}
                          className="p-3 bg-[var(--bg)] rounded-lg border border-amber-500/20"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-[10px] rounded uppercase font-medium">
                                  {info.override.format}
                                </span>
                                <span className="text-sm font-medium text-[var(--text)]">
                                  {info.componentDescription}
                                </span>
                              </div>
                              <div className="text-xs text-[var(--text-dim)] mt-1">
                                Modified: {new Date(info.override.updatedAt).toLocaleString()}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                useComponentCodeStore.getState().setInspectingComponent(info.componentId);
                                navigate('/editor');
                              }}
                              className="text-xs text-[var(--primary)] hover:underline"
                            >
                              Edit
                            </button>
                          </div>

                          {/* Notes for this override */}
                          {info.override.notes.length > 0 && (
                            <div className="mt-2 pl-3 border-l-2 border-amber-500/30">
                              {info.override.notes.slice(0, 2).map((note, noteIndex) => (
                                <p key={noteIndex} className="text-xs text-[var(--text-muted)] italic">
                                  "{note.content}"
                                </p>
                              ))}
                              {info.override.notes.length > 2 && (
                                <p className="text-xs text-[var(--text-dim)]">
                                  + {info.override.notes.length - 2} more note(s)
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => {
                        const overrideMarker = format === 'cql' ? '[CQL OVERRIDE]' : '[SYNAPSE SQL OVERRIDE]';
                        if (codeRef.current) {
                          const codeText = codeRef.current.textContent || '';
                          const overriddenIndex = codeText.indexOf(overrideMarker);
                          if (overriddenIndex !== -1) {
                            const codeElement = codeRef.current;
                            setSearchQuery(overrideMarker);
                            setTimeout(() => {
                              const highlightedSpan = codeElement.querySelector('.bg-amber-400\\/30');
                              if (highlightedSpan) {
                                highlightedSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }, 100);
                          }
                        }
                      }}
                      className="px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-all border border-amber-500/20 flex items-center gap-1.5"
                    >
                      <Search className="w-4 h-4" />
                      Find in Code
                    </button>
                    <button
                      onClick={() => {
                        if (overrideSummary && overrideSummary.overrideInfos.length > 0) {
                          const firstOverride = overrideSummary.overrideInfos[0];
                          useComponentCodeStore.getState().setInspectingComponent(firstOverride.componentId);
                        }
                        navigate('/editor');
                      }}
                      className="px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-all border border-amber-500/20 flex items-center gap-1.5"
                    >
                      <Edit3 className="w-4 h-4" />
                      View in UMS Editor
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Format selector */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--text-muted)]">Output Format:</span>
            <div className="flex gap-2">
              {[
                { id: 'cql', label: 'CQL', icon: FileCode },
                { id: 'synapse', label: 'Synapse SQL', icon: Database },
              ].map((f) => (
                <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  format === f.id
                    ? 'bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]/30'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]'
                }`}
              >
                <f.icon className="w-4 h-4" />
                {f.label}
              </button>
            ))}
            </div>
          </div>

          {/* Composition indicator */}
          {composedResult && useComponentAware && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent-light)] rounded-lg text-sm">
                <Library className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-[var(--accent)]">
                  {composedResult.componentFromLibraryCount}/{composedResult.componentCount} from library
                </span>
              </div>
              {composedResult.overrideCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-lg text-sm">
                  <Edit3 className="w-4 h-4 text-amber-500" />
                  <span className="text-amber-500">{composedResult.overrideCount} overrides</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Syntax Validation Status (CQL only, shown immediately after generation) */}
        {format === 'cql' && syntaxValidationResult && (
          <div className={`mb-4 p-3 rounded-xl border flex items-center gap-3 ${
            syntaxValidationResult.valid
              ? 'bg-[var(--success)]/5 border-[var(--success)]/30'
              : 'bg-[var(--danger)]/5 border-[var(--danger)]/30'
          }`}>
            {syntaxValidationResult.valid ? (
              <>
                <CheckCircle className="w-5 h-5 text-[var(--success)] flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-[var(--success)]">Valid CQL Syntax</span>
                  {syntaxValidationResult.metadata && (
                    <span className="text-xs text-[var(--text-muted)] ml-2">
                      {syntaxValidationResult.metadata.definitionCount} definitions, {syntaxValidationResult.metadata.valueSetCount} value sets
                    </span>
                  )}
                  {syntaxValidationResult.warnings.length > 0 && (
                    <span className="text-xs text-[var(--warning)] ml-2">
                      ({syntaxValidationResult.warnings.length} warning{syntaxValidationResult.warnings.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-[var(--danger)] flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-[var(--danger)]">
                    CQL Syntax Errors ({syntaxValidationResult.errors.length})
                  </span>
                  <div className="mt-1 space-y-1">
                    {syntaxValidationResult.errors.slice(0, 3).map((error, i) => (
                      <div key={i} className="text-xs text-[var(--danger)] flex items-start gap-1">
                        <span className="flex-shrink-0">•</span>
                        <span>
                          {error.line && <span className="font-mono">Line {error.line}: </span>}
                          {error.message}
                          {error.suggestion && <span className="text-[var(--text-dim)]"> ({error.suggestion})</span>}
                        </span>
                      </div>
                    ))}
                    {syntaxValidationResult.errors.length > 3 && (
                      <div className="text-xs text-[var(--text-dim)]">
                        ... and {syntaxValidationResult.errors.length - 3} more error{syntaxValidationResult.errors.length - 3 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Code preview */}
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm font-medium text-[var(--text)]">
                {measure.metadata.measureId}_{format.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSearch}
                className={`px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                  searchVisible
                    ? 'text-[var(--accent)] bg-[var(--accent-light)] rounded-lg'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
                title="Search (Ctrl+F)"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
              <button
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
              {format === 'cql' && (
                <button
                  onClick={handleValidateCQL}
                  disabled={isValidating || !generationResult?.success}
                  className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] text-[var(--text)] rounded-lg flex items-center gap-2 hover:bg-[var(--bg)] transition-colors disabled:opacity-50"
                  title={cqlServiceAvailable === false ? 'CQL Services not available - run Docker container' : 'Validate CQL syntax'}
                >
                  {isValidating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : validationResult?.valid ? (
                    <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                  ) : validationResult ? (
                    <XCircle className="w-4 h-4 text-[var(--danger)]" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {isValidating ? 'Validating...' : validationResult?.valid ? 'Valid' : 'Validate CQL'}
                </button>
              )}
              {format === 'synapse' && (
                <button
                  onClick={handleValidateSynapse}
                  disabled={isValidatingSynapse || !synapseResult?.success}
                  className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] text-[var(--text)] rounded-lg flex items-center gap-2 hover:bg-[var(--bg)] transition-colors disabled:opacity-50"
                  title="Validate Synapse SQL pattern compliance"
                >
                  {isValidatingSynapse ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : synapseValidation?.valid ? (
                    <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                  ) : synapseValidation ? (
                    <XCircle className="w-4 h-4 text-[var(--danger)]" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {isValidatingSynapse ? 'Validating...' : synapseValidation ? `Score: ${synapseValidation.score}/100` : 'Validate'}
                </button>
              )}
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] text-[var(--text)] rounded-lg flex items-center gap-2 hover:bg-[var(--bg)] transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-[var(--success)]" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button className="px-3 py-1.5 text-sm bg-[var(--accent-light)] text-[var(--accent)] rounded-lg flex items-center gap-2 hover:bg-[var(--accent)]/20 transition-colors">
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>

          {/* Search bar */}
          {searchVisible && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
              <Search className="w-4 h-4 text-[var(--text-muted)]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) {
                      navigateSearch('prev');
                    } else {
                      navigateSearch('next');
                    }
                  }
                }}
                placeholder="Search in code... (Enter for next, Shift+Enter for prev)"
                className="flex-1 bg-transparent text-sm text-[var(--text)] placeholder-[var(--text-dim)] outline-none"
              />
              {searchResults.length > 0 && (
                <span className="text-xs text-[var(--text-muted)]">
                  {currentSearchIndex + 1} of {searchResults.length}
                </span>
              )}
              {searchQuery && searchResults.length === 0 && (
                <span className="text-xs text-[var(--warning)]">No matches</span>
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateSearch('prev')}
                  disabled={searchResults.length === 0}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
                  title="Previous (Shift+Enter)"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigateSearch('next')}
                  disabled={searchResults.length === 0}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
                  title="Next (Enter)"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={toggleSearch}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
                title="Close (Escape)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Code content */}
          <div className="relative">
            {isGenerating && (
              <div className="absolute inset-0 bg-[var(--bg-secondary)]/80 flex items-center justify-center z-10">
                <div className="flex items-center gap-3 text-[var(--accent)]">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Generating {format.toUpperCase()}...</span>
                </div>
              </div>
            )}
            <pre ref={codeRef} className="p-4 text-sm font-mono overflow-auto max-h-[600px] text-[var(--text)]">
              <code className={!canGenerate ? 'opacity-50' : ''}>
                {(() => {
                  // Use overridden code if available, otherwise generated code
                  const code = currentDisplayedCode || '// Generating...';
                  return searchQuery && searchResults.length > 0 ? highlightCode(code) : code;
                })()}
              </code>
            </pre>
          </div>
        </div>

        {/* Measure Code Editor - Intuitive editing experience */}
        {currentDisplayedCode && (
          <div className="mt-6">
            <MeasureCodeEditor
              code={currentDisplayedCode}
              originalCode={originalGeneratedCode}
              format={format === 'cql' ? 'cql' : 'synapse-sql'}
              measureId={measure?.id}
              onSave={handleSaveCodeOverride}
              editHistory={measureOverride?.notes || []}
              hasOverride={!!measureOverride}
              onRevert={handleRevertCodeOverride}
            />
          </div>
        )}

        {/* Generation Error Display */}
        {generationError && (
          <div className="mt-4">
            <InlineErrorBanner
              message={generationError}
              onDismiss={() => setGenerationError(null)}
            />
          </div>
        )}

        {/* CQL Generation Warnings */}
        {format === 'cql' && generationResult && (
          (() => {
            // Collect warnings from generation result and embedded in code
            const resultWarnings = generationResult.warnings || [];
            const embeddedWarnings = generationResult.cql ? extractEmbeddedWarnings(generationResult.cql) : [];
            const allWarnings = [...new Set([...resultWarnings, ...embeddedWarnings])];

            if (allWarnings.length === 0) return null;

            return (
              <div className="mt-4 p-4 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
                  <h3 className="text-sm font-medium text-[var(--warning)]">
                    Generation Warnings ({allWarnings.length})
                  </h3>
                </div>
                <div className="space-y-1">
                  {allWarnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-[var(--warning)]">
                      <span className="text-[var(--warning)] mt-0.5">•</span>
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()
        )}

        {/* Synapse SQL Generation Warnings */}
        {format === 'synapse' && synapseResult && (
          (() => {
            // Collect warnings from generation result and embedded in code
            const resultWarnings = synapseResult.warnings || [];
            const embeddedWarnings = synapseResult.sql ? extractEmbeddedWarnings(synapseResult.sql) : [];
            const allWarnings = [...new Set([...resultWarnings, ...embeddedWarnings])];

            if (allWarnings.length === 0) return null;

            return (
              <div className="mt-4 p-4 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
                  <h3 className="text-sm font-medium text-[var(--warning)]">
                    Generation Warnings ({allWarnings.length})
                  </h3>
                </div>
                <div className="space-y-1">
                  {allWarnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-[var(--warning)]">
                      <span className="text-[var(--warning)] mt-0.5">•</span>
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()
        )}

        {/* Validation Results */}
        {format === 'cql' && validationResult && (
          <div className={`mt-6 p-4 rounded-xl border ${
            validationResult.valid
              ? 'bg-[var(--success)]/5 border-[var(--success)]/30'
              : 'bg-[var(--danger)]/5 border-[var(--danger)]/30'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {validationResult.valid ? (
                <>
                  <CheckCircle className="w-5 h-5 text-[var(--success)]" />
                  <h3 className="text-sm font-medium text-[var(--success)]">CQL Validation Passed</h3>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-[var(--danger)]" />
                  <h3 className="text-sm font-medium text-[var(--danger)]">CQL Validation Failed</h3>
                </>
              )}
            </div>

            {validationResult.errors.length > 0 && (
              <div className="space-y-2 mb-3">
                <h4 className="text-xs font-medium text-[var(--danger)] uppercase tracking-wider">Errors ({validationResult.errors.length})</h4>
                {validationResult.errors.map((error, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-[var(--danger)]">
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <span>{error.message}</span>
                      {error.line && (
                        <span className="text-[var(--text-dim)] ml-2">
                          (Line {error.line}{error.column ? `:${error.column}` : ''})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {validationResult.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-[var(--warning)] uppercase tracking-wider">Warnings ({validationResult.warnings.length})</h4>
                {validationResult.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-[var(--warning)]">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <span>{warning.message}</span>
                      {warning.line && (
                        <span className="text-[var(--text-dim)] ml-2">
                          (Line {warning.line}{warning.column ? `:${warning.column}` : ''})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {validationResult.valid && validationResult.elm && (
              <p className="text-sm text-[var(--success)]">
                ELM (Expression Logical Model) compiled successfully. Ready for execution.
              </p>
            )}
          </div>
        )}

        {/* Synapse SQL Validation Results */}
        {format === 'synapse' && synapseValidation && (
          <div className={`mt-6 p-4 rounded-xl border ${
            synapseValidation.valid
              ? 'bg-[var(--success)]/5 border-[var(--success)]/30'
              : 'bg-[var(--danger)]/5 border-[var(--danger)]/30'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {synapseValidation.valid ? (
                <>
                  <CheckCircle className="w-5 h-5 text-[var(--success)]" />
                  <h3 className="text-sm font-medium text-[var(--success)]">Synapse SQL Validation Passed</h3>
                  <span className="ml-auto text-sm font-mono text-[var(--success)]">Score: {synapseValidation.score}/100</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-[var(--danger)]" />
                  <h3 className="text-sm font-medium text-[var(--danger)]">Synapse SQL Validation Issues Found</h3>
                  <span className="ml-auto text-sm font-mono text-[var(--danger)]">Score: {synapseValidation.score}/100</span>
                </>
              )}
            </div>

            {synapseValidation.errors.length > 0 && (
              <div className="space-y-2 mb-3">
                <h4 className="text-xs font-medium text-[var(--danger)] uppercase tracking-wider">Errors ({synapseValidation.errors.length})</h4>
                {synapseValidation.errors.map((error, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-[var(--danger)]">
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-mono text-xs text-[var(--text-dim)] mr-2">[{error.code}]</span>
                      <span>{error.message}</span>
                      {error.suggestion && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{error.suggestion}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {synapseValidation.warnings.length > 0 && (
              <div className="space-y-2 mb-3">
                <h4 className="text-xs font-medium text-[var(--warning)] uppercase tracking-wider">Warnings ({synapseValidation.warnings.length})</h4>
                {synapseValidation.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-[var(--warning)]">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-mono text-xs text-[var(--text-dim)] mr-2">[{warning.code}]</span>
                      <span>{warning.message}</span>
                      {warning.suggestion && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{warning.suggestion}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {synapseValidation.suggestions.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Suggestions</h4>
                {synapseValidation.suggestions.map((suggestion, i) => (
                  <p key={i} className="text-sm text-[var(--text-muted)]">{suggestion}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Synapse SQL Generation Metadata */}
        {format === 'synapse' && synapseResult && (
          <div className="mt-4 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span>Predicates: <strong className="text-[var(--text)]">{synapseResult.metadata.predicateCount}</strong></span>
              <span>Data Models: <strong className="text-[var(--text)]">{synapseResult.metadata.dataModelsUsed.join(', ') || 'none'}</strong></span>
              <span>Complexity: <strong className="text-[var(--text)]">{synapseResult.metadata.estimatedComplexity}</strong></span>
              {synapseResult.warnings.length > 0 && (
                <span className="text-[var(--warning)]">{synapseResult.warnings.length} warning(s)</span>
              )}
              {synapseResult.errors.length > 0 && (
                <span className="text-[var(--danger)]">{synapseResult.errors.length} error(s)</span>
              )}
            </div>
          </div>
        )}

        {/* CQL Service Status */}
        {format === 'cql' && cqlServiceAvailable === false && !validationResult && (
          <div className="mt-6 p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-[var(--warning)]">CQL Validation Service Not Available</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  To validate CQL syntax, start the CQL Services Docker container:
                </p>
                <code className="block mt-2 p-2 bg-[var(--bg-tertiary)] rounded text-xs font-mono text-[var(--text-dim)]">
                  docker run -p 8080:8080 cqframework/cql-translation-service
                </code>
              </div>
            </div>
          </div>
        )}

        {/* Generation notes */}
        <div className="mt-6 p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)]">
          <h3 className="text-sm font-medium text-[var(--text)] mb-2">Generation Notes</h3>
          <ul className="space-y-1 text-sm text-[var(--text-muted)]">
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent)] mt-0.5">•</span>
              Code generated from UMS version {measure.metadata.version}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent)] mt-0.5">•</span>
              {measure.populations.length} population definitions included
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent)] mt-0.5">•</span>
              {measure.valueSets.length} value set references linked
            </li>
            {format === 'cql' && generationResult && (
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)] mt-0.5">•</span>
                {generationResult.metadata.definitionCount} CQL definitions generated
              </li>
            )}
            {format === 'synapse' && synapseResult && (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--accent)] mt-0.5">•</span>
                  Synapse SQL: {synapseResult.metadata.predicateCount} predicates across {synapseResult.metadata.dataModelsUsed.length} data models
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--accent)] mt-0.5">•</span>
                  Target: Azure Synapse / T-SQL (CTE pattern with ONT, DEMOG, PRED_*)
                </li>
              </>
            )}
            {!canGenerate && (
              <li className="flex items-start gap-2 text-[var(--warning)]">
                <span className="mt-0.5">⚠</span>
                Preview only - complete review to generate production code
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Helper to extract age range from population data elements
// Uses UMS schema: DataElement.thresholds.ageMin/ageMax (canonical source)
function extractAgeRange(populations       )                                      {
  const findAgeConstraints = (node     )                                        => {
    if (!node) return null;

    // PRIMARY: Check UMS thresholds (canonical schema)
    if (node.thresholds) {
      const t = node.thresholds;
      if (t.ageMin !== undefined || t.ageMax !== undefined) {
        return { min: t.ageMin, max: t.ageMax };
      }
    }

    // FALLBACK: Check legacy constraints field (for backwards compatibility)
    if (node.constraints) {
      const c = node.constraints;
      if (c.ageMin !== undefined || c.ageMax !== undefined) {
        return { min: c.ageMin, max: c.ageMax };
      }
      if (c.minAge !== undefined || c.maxAge !== undefined) {
        return { min: c.minAge, max: c.maxAge };
      }
    }

    // Recursively check children
    if (node.children) {
      for (const child of node.children) {
        const result = findAgeConstraints(child);
        if (result) return result;
      }
    }

    // Check nested criteria
    if (node.criteria) {
      return findAgeConstraints(node.criteria);
    }

    return null;
  };

  // Search through populations for age constraints
  for (const pop of populations) {
    const constraints = findAgeConstraints(pop);
    if (constraints && (constraints.min !== undefined || constraints.max !== undefined)) {
      return {
        min: constraints.min ?? 0,
        max: constraints.max ?? 999
      };
    }
  }

  // Fallback: look for age patterns in text descriptions
  for (const pop of populations) {
    const searchText = JSON.stringify(pop);
    const match = searchText.match(/(?:age[d]?\s*)?(\d+)\s*[-–to]+\s*(\d+)/i);
    if (match) {
      return { min: parseInt(match[1]), max: parseInt(match[2]) };
    }
  }

  return null;
}

// Helper to collect all data elements from populations
function collectDataElements(populations       )        {
  const elements        = [];

  const traverse = (node     ) => {
    if (!node) return;
    if (node.type && ['diagnosis', 'encounter', 'procedure', 'observation', 'medication', 'demographic', 'assessment'].includes(node.type)) {
      elements.push(node);
    }
    if (node.criteria) traverse(node.criteria);
    if (node.children) node.children.forEach(traverse);
  };

  populations.forEach(traverse);
  return elements;
}

// Helper to get population by type - supports both FHIR kebab-case and legacy underscore
function getPopulation(populations       , type        )             {
  // Map between FHIR kebab-case and legacy underscore formats
  const typeVariants                           = {
    'initial-population': ['initial-population', 'initial_population'],
    'initial_population': ['initial-population', 'initial_population'],
    'denominator': ['denominator'],
    'denominator-exclusion': ['denominator-exclusion', 'denominator_exclusion'],
    'denominator_exclusion': ['denominator-exclusion', 'denominator_exclusion'],
    'denominator-exception': ['denominator-exception', 'denominator_exception'],
    'denominator_exception': ['denominator-exception', 'denominator_exception'],
    'numerator': ['numerator'],
    'numerator-exclusion': ['numerator-exclusion', 'numerator_exclusion'],
    'numerator_exclusion': ['numerator-exclusion', 'numerator_exclusion'],
  };

  const variants = typeVariants[type] || [type];
  return populations.find(p => variants.includes(p.type)) || null;
}

function getGeneratedCode(measure     , format                  )         {
  // Use globalConstraints as primary source (single source of truth), fallback to population extraction
  const ageRange = measure.globalConstraints?.ageRange ||
                   extractAgeRange(measure.populations) ||
                   { min: 18, max: 85 };
  const dataElements = collectDataElements(measure.populations);
  const ipPop = getPopulation(measure.populations, 'initial_population');
  const denomPop = getPopulation(measure.populations, 'denominator');
  const exclPop = getPopulation(measure.populations, 'denominator_exclusion');
  const numPop = getPopulation(measure.populations, 'numerator');

  // Build value set declarations from actual measure value sets with FHIR canonical URLs
  const valueSetDeclarations = measure.valueSets.map((vs     ) => {
    // Use FHIR canonical URL (VSAC format) if OID exists, otherwise use urn:oid
    const url = vs.url || (vs.oid ? `http://cts.nlm.nih.gov/fhir/ValueSet/${vs.oid}` : `urn:oid:2.16.840.1.113883.3.XXX.${vs.id}`);
    return `valueset "${vs.name}": '${url}'`;
  }).join('\n');

  // Build code lists for SQL
  const buildCodeList = (vs     ) => {
    if (!vs?.codes?.length) return '/* No codes defined */';
    return vs.codes.map((c     ) => `'${c.code}'`).join(', ');
  };

  if (format === 'cql') {
    // Build population criteria from actual data
    const ipCriteria = ipPop?.narrative || 'Patients meeting initial population criteria';
    const denomCriteria = denomPop?.narrative || 'Initial Population';
    const exclCriteria = exclPop?.narrative || 'Patients with exclusion criteria';
    const numCriteria = numPop?.narrative || 'Patients meeting numerator criteria';

    // Use CQL definition names from populations (FHIR alignment)
    const ipDefName = ipPop?.cqlDefinitionName || 'Initial Population';
    const denomDefName = denomPop?.cqlDefinitionName || 'Denominator';
    const exclDefName = exclPop?.cqlDefinitionName || 'Denominator Exclusion';
    const numDefName = numPop?.cqlDefinitionName || 'Numerator';

    // Library name from measure ID (FHIR canonical format)
    const libraryName = measure.metadata.measureId.replace(/[^a-zA-Z0-9]/g, '');
    const libraryUrl = measure.metadata.url || `urn:uuid:${measure.id}`;

    return `/*
 * ${measure.metadata.title}
 * Measure ID: ${measure.metadata.measureId}
 * Version: ${measure.metadata.version}
 * Scoring: ${measure.metadata.scoring || 'proportion'}
 * Generated: ${new Date().toISOString()}
 *
 * FHIR R4 / QI-Core aligned CQL
 * Library URL: ${libraryUrl}
 *
 * THIS CODE WAS AUTO-GENERATED FROM UMS (FHIR-aligned)
 * Review status: ${measure.reviewProgress.approved}/${measure.reviewProgress.total} approved
 */

library ${libraryName} version '${measure.metadata.version}'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers
include QICoreCommon version '2.0.0' called QICoreCommon

codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMEDCT": 'http://snomed.info/sct'
codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "CPT": 'http://www.ama-assn.org/go/cpt'

// Value Sets from UMS (VSAC canonical URLs)
${valueSetDeclarations}

parameter "Measurement Period" Interval<DateTime>
  default Interval[@${measure.metadata.measurementPeriod?.start || '2025-01-01'}T00:00:00.0, @${measure.metadata.measurementPeriod?.end || '2025-12-31'}T23:59:59.999]

context Patient

/*
 * ${ipDefName}
 * ${ipCriteria}
 */
define "${ipDefName}":
  AgeInYearsAt(date from end of "Measurement Period") in Interval[${ageRange.min}, ${ageRange.max}]
${dataElements.filter(e => e.type === 'diagnosis').map(e => `    and exists "${e.valueSet?.name || 'Qualifying Condition'}"`).join('\n')}
${dataElements.filter(e => e.type === 'encounter').map(e => `    and exists "${e.valueSet?.name || 'Qualifying Encounter'}"`).join('\n')}

/*
 * ${denomDefName}
 * ${denomCriteria}
 */
define "${denomDefName}":
  "${ipDefName}"

/*
 * ${exclDefName}
 * ${exclCriteria}
 */
define "${exclDefName}":
${dataElements.filter(e => exclPop?.criteria && JSON.stringify(exclPop.criteria).includes(e.id)).map(e => `  exists "${e.valueSet?.name || 'Exclusion Condition'}"`).join('\n    or ') || '  false /* No exclusions defined */'}

/*
 * ${numDefName}
 * ${numCriteria}
 */
define "${numDefName}":
${dataElements.filter(e => numPop?.criteria && JSON.stringify(numPop.criteria).includes(e.id)).map(e => `  exists "${e.valueSet?.name || 'Numerator Action'}"`).join('\n    and ') || '  true /* Define numerator criteria */'}

// QI-Core Data Element Definitions
${measure.valueSets.map((vs     ) => {
  const relatedElement = dataElements.find(e => e.valueSet?.id === vs.id);
  const elemType = relatedElement?.type || 'diagnosis';
  // QI-Core resource types (FHIR alignment)
  const qicoreType = elemType === 'diagnosis' ? 'Condition' :
                     elemType === 'encounter' ? 'Encounter' :
                     elemType === 'procedure' ? 'Procedure' :
                     elemType === 'observation' ? 'Observation' :
                     elemType === 'medication' ? 'MedicationRequest' :
                     elemType === 'assessment' ? 'Observation' : 'Condition';
  const timing = relatedElement?.timingRequirements?.[0]?.description || 'During Measurement Period';

  return `define "${vs.name}":
  [${qicoreType}: "${vs.name}"] R
    where R.clinicalStatus ~ QICoreCommon."active"
      and (R.onset as Period) overlaps "Measurement Period"
    /* Timing: ${timing} */`;
}).join('\n\n')}
`;
  }

  if (format === 'synapse') {
    const measureName = measure.metadata.measureId.replace(/[^a-zA-Z0-9]/g, '_');

    // Build actual code IN clauses from value sets
    const diagnosisVS = measure.valueSets.find((vs     ) =>
      dataElements.some(e => e.type === 'diagnosis' && e.valueSet?.id === vs.id)
    );
    const encounterVS = measure.valueSets.find((vs     ) =>
      dataElements.some(e => e.type === 'encounter' && e.valueSet?.id === vs.id)
    );
    const exclusionVS = measure.valueSets.find((vs     ) =>
      vs.name.toLowerCase().includes('hospice') || vs.name.toLowerCase().includes('exclusion')
    );
    const numeratorVS = measure.valueSets.find((vs     ) =>
      dataElements.some(e => numPop?.criteria && JSON.stringify(numPop.criteria).includes(e.id) && e.valueSet?.id === vs.id)
    );

    return `/*
 * ${measure.metadata.title}
 * Measure ID: ${measure.metadata.measureId}
 * Target: Azure Synapse Analytics
 * Generated: ${new Date().toISOString()}
 *
 * Age Range: ${ageRange.min}-${ageRange.max}
 * Value Sets: ${measure.valueSets.length}
 */

DECLARE @MeasurementPeriodStart DATE = '${measure.metadata.measurementPeriod?.start || '2025-01-01'}';
DECLARE @MeasurementPeriodEnd DATE = '${measure.metadata.measurementPeriod?.end || '2025-12-31'}';

-- Value Set Reference Tables (populate from UMS)
${measure.valueSets.map((vs     ) => `-- ${vs.name}: ${vs.codes?.length || 0} codes
-- Codes: ${vs.codes?.slice(0, 5).map((c     ) => c.code).join(', ')}${vs.codes?.length > 5 ? '...' : ''}`).join('\n')}

-- Initial Population
-- ${ipPop?.narrative || 'Patients meeting initial criteria'}
CREATE OR ALTER VIEW [measure].[${measureName}_InitialPopulation]
AS
SELECT DISTINCT
    p.patient_id,
    p.date_of_birth,
    DATEDIFF(YEAR, p.date_of_birth, @MeasurementPeriodEnd) AS age_at_mp_end
FROM [clinical].[patients] p
INNER JOIN [clinical].[diagnoses] dx
    ON p.patient_id = dx.patient_id
    AND dx.diagnosis_code IN (${buildCodeList(diagnosisVS)})
    AND dx.onset_date <= @MeasurementPeriodEnd
    AND (dx.resolution_date IS NULL OR dx.resolution_date >= @MeasurementPeriodStart)
INNER JOIN [clinical].[encounters] enc
    ON p.patient_id = enc.patient_id
    AND enc.encounter_type_code IN (${buildCodeList(encounterVS)})
    AND enc.encounter_date BETWEEN @MeasurementPeriodStart AND @MeasurementPeriodEnd
WHERE DATEDIFF(YEAR, p.date_of_birth, @MeasurementPeriodEnd) BETWEEN ${ageRange.min} AND ${ageRange.max};
GO

-- Denominator Exclusions
-- ${exclPop?.narrative || 'Patients meeting exclusion criteria'}
CREATE OR ALTER VIEW [measure].[${measureName}_DenominatorExclusions]
AS
SELECT DISTINCT patient_id
FROM (
    SELECT patient_id
    FROM [clinical].[encounters]
    WHERE encounter_type_code IN (${buildCodeList(exclusionVS)})
    AND encounter_date BETWEEN @MeasurementPeriodStart AND @MeasurementPeriodEnd
) exclusions;
GO

-- Numerator
-- ${numPop?.narrative || 'Patients meeting numerator criteria'}
CREATE OR ALTER VIEW [measure].[${measureName}_Numerator]
AS
SELECT DISTINCT patient_id
FROM [clinical].[procedures]
WHERE procedure_code IN (${buildCodeList(numeratorVS)})
AND procedure_date BETWEEN @MeasurementPeriodStart AND @MeasurementPeriodEnd;
GO

-- Final Measure Calculation
CREATE OR ALTER VIEW [measure].[${measureName}_Results]
AS
SELECT
    ip.patient_id,
    ip.age_at_mp_end,
    CASE WHEN ex.patient_id IS NOT NULL THEN 1 ELSE 0 END AS is_excluded,
    CASE WHEN num.patient_id IS NOT NULL THEN 1 ELSE 0 END AS numerator_met,
    CASE
        WHEN ex.patient_id IS NOT NULL THEN 'Excluded'
        WHEN num.patient_id IS NOT NULL THEN 'Performance Met'
        ELSE 'Performance Not Met'
    END AS measure_status
FROM [measure].[${measureName}_InitialPopulation] ip
LEFT JOIN [measure].[${measureName}_DenominatorExclusions] ex
    ON ip.patient_id = ex.patient_id
LEFT JOIN [measure].[${measureName}_Numerator] num
    ON ip.patient_id = num.patient_id
    AND ex.patient_id IS NULL;
GO
`;
  }

  // Standard SQL
  // Build actual code IN clauses from value sets
  const diagnosisVS = measure.valueSets.find((vs     ) =>
    dataElements.some(e => e.type === 'diagnosis' && e.valueSet?.id === vs.id)
  );
  const encounterVS = measure.valueSets.find((vs     ) =>
    dataElements.some(e => e.type === 'encounter' && e.valueSet?.id === vs.id)
  );
  const exclusionVS = measure.valueSets.find((vs     ) =>
    vs.name.toLowerCase().includes('hospice') || vs.name.toLowerCase().includes('exclusion')
  );
  const numeratorVS = measure.valueSets.find((vs     ) =>
    dataElements.some(e => numPop?.criteria && JSON.stringify(numPop.criteria).includes(e.id) && e.valueSet?.id === vs.id)
  );

  return `/*
 * ${measure.metadata.title}
 * Measure ID: ${measure.metadata.measureId}
 * Target: Standard SQL (PostgreSQL/MySQL compatible)
 * Generated: ${new Date().toISOString()}
 *
 * Age Range: ${ageRange.min}-${ageRange.max}
 * Value Sets: ${measure.valueSets.length}
 */

-- Parameters
SET @measurement_period_start = '${measure.metadata.measurementPeriod?.start || '2025-01-01'}';
SET @measurement_period_end = '${measure.metadata.measurementPeriod?.end || '2025-12-31'}';

-- Value Sets from UMS:
${measure.valueSets.map((vs     ) => `-- ${vs.name}: ${vs.codes?.map((c     ) => c.code).join(', ') || 'No codes'}`).join('\n')}

-- Initial Population
-- ${ipPop?.narrative || 'Patients meeting initial criteria'}
WITH initial_population AS (
    SELECT DISTINCT
        p.patient_id,
        p.date_of_birth,
        TIMESTAMPDIFF(YEAR, p.date_of_birth, @measurement_period_end) AS age
    FROM patients p
    INNER JOIN diagnoses dx ON p.patient_id = dx.patient_id
    INNER JOIN encounters enc ON p.patient_id = enc.patient_id
    WHERE
        -- Age criteria: ${ageRange.min}-${ageRange.max} years
        TIMESTAMPDIFF(YEAR, p.date_of_birth, @measurement_period_end) BETWEEN ${ageRange.min} AND ${ageRange.max}
        -- Diagnosis criteria
        AND dx.diagnosis_code IN (${buildCodeList(diagnosisVS)})
        AND dx.onset_date <= @measurement_period_end
        -- Encounter criteria
        AND enc.encounter_date BETWEEN @measurement_period_start AND @measurement_period_end
        AND enc.encounter_type IN (${buildCodeList(encounterVS)})
),

-- Denominator Exclusions
-- ${exclPop?.narrative || 'Patients with exclusion criteria'}
exclusions AS (
    SELECT DISTINCT patient_id
    FROM encounters
    WHERE encounter_type IN (${buildCodeList(exclusionVS)})
    AND encounter_date BETWEEN @measurement_period_start AND @measurement_period_end
),

-- Numerator
-- ${numPop?.narrative || 'Patients meeting numerator criteria'}
numerator AS (
    SELECT DISTINCT patient_id
    FROM procedures
    WHERE procedure_code IN (${buildCodeList(numeratorVS)})
    AND procedure_date BETWEEN @measurement_period_start AND @measurement_period_end
)

-- Final Results
SELECT
    ip.patient_id,
    ip.age,
    CASE WHEN ex.patient_id IS NOT NULL THEN TRUE ELSE FALSE END AS excluded,
    CASE WHEN num.patient_id IS NOT NULL THEN TRUE ELSE FALSE END AS numerator_met,
    CASE
        WHEN ex.patient_id IS NOT NULL THEN 'Excluded'
        WHEN num.patient_id IS NOT NULL THEN 'Performance Met'
        ELSE 'Performance Not Met'
    END AS outcome
FROM initial_population ip
LEFT JOIN exclusions ex ON ip.patient_id = ex.patient_id
LEFT JOIN numerator num ON ip.patient_id = num.patient_id;
`;
}
