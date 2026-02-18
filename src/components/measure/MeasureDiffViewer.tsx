/**
 * MeasureDiffViewer
 *
 * A component for comparing two versions of a measure (year-over-year diff).
 * Shows:
 * - Summary of changes
 * - Detailed element-by-element comparison
 * - Value set changes
 * - Population changes
 * - Optional CQL diff
 */

import { useState, useMemo } from 'react';
import {
  GitCompare,
  Plus,
  Minus,
  Edit3,
  ChevronDown,
  ChevronRight,
  FileText,
  Code2,
  X,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

import type { UniversalMeasureSpec } from '../../types/ums';
import {
  compareMeasures,
  type MeasureDiffResult,
  type ElementDiff,
  type DiffChangeType,
} from '../../services/measureDiffService';
import { generateCQL } from '../../services/cqlGenerator';

// ============================================================================
// Sub-Components
// ============================================================================

interface DiffStatBadgeProps {
  count: number;
  type: 'added' | 'removed' | 'modified';
  label: string;
}

const DiffStatBadge = ({ count, type, label }: DiffStatBadgeProps) => {
  if (count === 0) return null;

  const colors = {
    added: 'bg-green-500/10 text-green-500 border-green-500/30',
    removed: 'bg-red-500/10 text-red-500 border-red-500/30',
    modified: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  };

  const icons = {
    added: <Plus size={12} />,
    removed: <Minus size={12} />,
    modified: <Edit3 size={12} />,
  };

  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border
      ${colors[type]}
    `}>
      {icons[type]}
      {count} {label}
    </span>
  );
};

interface ElementDiffRowProps {
  diff: ElementDiff;
}

const ElementDiffRow = ({ diff }: ElementDiffRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const element = diff.newElement || diff.oldElement;

  const colors: Record<DiffChangeType, string> = {
    added: 'border-l-green-500 bg-green-500/5',
    removed: 'border-l-red-500 bg-red-500/5',
    modified: 'border-l-amber-500 bg-amber-500/5',
    unchanged: 'border-l-gray-500 bg-gray-500/5',
  };

  const icons: Record<DiffChangeType, React.ReactNode> = {
    added: <Plus size={14} className="text-green-500" />,
    removed: <Minus size={14} className="text-red-500" />,
    modified: <Edit3 size={14} className="text-amber-500" />,
    unchanged: <CheckCircle size={14} className="text-gray-500" />,
  };

  return (
    <div className={`
      border-l-4 rounded-r-lg mb-2
      ${colors[diff.changeType]}
    `}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--bg-secondary)]/50"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {icons[diff.changeType]}
        <span className="flex-1 text-sm text-[var(--text)]">
          {element?.description?.substring(0, 60)}
          {(element?.description?.length || 0) > 60 ? '...' : ''}
        </span>
        <span className="px-2 py-0.5 text-[10px] bg-[var(--bg-tertiary)] rounded uppercase">
          {element?.type}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 text-sm">
          {/* Changes list */}
          {diff.changes.length > 0 && (
            <div className="space-y-1 mb-2">
              {diff.changes.map((change, i) => (
                <div key={i} className="flex items-start gap-2 text-[var(--text-muted)]">
                  <span className="text-[var(--text-dim)]">•</span>
                  <span>{change}</span>
                </div>
              ))}
            </div>
          )}

          {/* Value set details */}
          {diff.valueSetDiff && (
            <div className="mt-2 p-2 bg-[var(--bg-secondary)] rounded-lg">
              <div className="text-xs text-[var(--text-dim)] mb-1">Value Set</div>
              {diff.valueSetDiff.oidChanged && (
                <div className="text-xs">
                  <span className="text-red-400 line-through">{diff.valueSetDiff.oldOid}</span>
                  {' → '}
                  <span className="text-green-400">{diff.valueSetDiff.newOid}</span>
                </div>
              )}
              {diff.valueSetDiff.codesAdded > 0 && (
                <div className="text-xs text-green-400">+{diff.valueSetDiff.codesAdded} codes</div>
              )}
              {diff.valueSetDiff.codesRemoved > 0 && (
                <div className="text-xs text-red-400">-{diff.valueSetDiff.codesRemoved} codes</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface MeasureDiffViewerProps {
  measures: UniversalMeasureSpec[];
  onClose?: () => void;
}

export const MeasureDiffViewer = ({ measures, onClose }: MeasureDiffViewerProps) => {
  const [oldMeasureId, setOldMeasureId] = useState<string>('');
  const [newMeasureId, setNewMeasureId] = useState<string>('');
  const [showCodeDiff, setShowCodeDiff] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    metadata: true,
    elements: true,
    populations: false,
    code: false,
  });

  // Get selected measures
  const oldMeasure = measures.find(m => m.id === oldMeasureId);
  const newMeasure = measures.find(m => m.id === newMeasureId);

  // Compute diff
  const diffResult = useMemo<MeasureDiffResult | null>(() => {
    if (!oldMeasure || !newMeasure) return null;

    // Generate CQL for both measures
    const oldCqlResult = generateCQL(oldMeasure);
    const newCqlResult = generateCQL(newMeasure);

    return compareMeasures(
      oldMeasure,
      newMeasure,
      oldCqlResult.success ? oldCqlResult.cql : undefined,
      newCqlResult.success ? newCqlResult.cql : undefined
    );
  }, [oldMeasure, newMeasure]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="bg-[var(--bg)] rounded-xl border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-[var(--primary)]" />
          <span className="font-semibold text-[var(--text)]">Year-over-Year Measure Comparison</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)]"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Measure Selection */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Previous Version (Baseline)</label>
            <select
              value={oldMeasureId}
              onChange={(e) => setOldMeasureId(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)]"
            >
              <option value="">Select measure...</option>
              {measures.map(m => (
                <option key={m.id} value={m.id} disabled={m.id === newMeasureId}>
                  {m.metadata?.title || m.id} ({m.metadata?.version || 'no version'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Current Version (Compare To)</label>
            <select
              value={newMeasureId}
              onChange={(e) => setNewMeasureId(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)]"
            >
              <option value="">Select measure...</option>
              {measures.map(m => (
                <option key={m.id} value={m.id} disabled={m.id === oldMeasureId}>
                  {m.metadata?.title || m.id} ({m.metadata?.version || 'no version'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* No selection message */}
      {(!oldMeasure || !newMeasure) && (
        <div className="p-8 text-center">
          <GitCompare className="w-12 h-12 mx-auto text-[var(--text-dim)] mb-4" />
          <p className="text-[var(--text-muted)]">
            Select two measures to compare their specifications
          </p>
        </div>
      )}

      {/* Diff Results */}
      {diffResult && (
        <div className="max-h-[500px] overflow-y-auto">
          {/* Summary */}
          <div className="p-4 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
            <h3 className="font-medium text-[var(--text)] mb-3">Change Summary</h3>
            <div className="flex flex-wrap gap-2">
              <DiffStatBadge count={diffResult.summary.elementsAdded} type="added" label="added" />
              <DiffStatBadge count={diffResult.summary.elementsRemoved} type="removed" label="removed" />
              <DiffStatBadge count={diffResult.summary.elementsModified} type="modified" label="modified" />
              {diffResult.summary.valueSetsChanged > 0 && (
                <span className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/30">
                  {diffResult.summary.valueSetsChanged} value set changes
                </span>
              )}
            </div>

            {diffResult.summary.totalChanges === 0 && (
              <div className="flex items-center gap-2 mt-3 text-green-500">
                <CheckCircle size={16} />
                <span className="text-sm">No differences found between these versions</span>
              </div>
            )}
          </div>

          {/* Metadata Changes */}
          {diffResult.metadataChanges.length > 0 && (
            <div className="border-b border-[var(--border)]">
              <button
                onClick={() => toggleSection('metadata')}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[var(--bg-secondary)]"
              >
                {expandedSections.metadata ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <FileText size={16} className="text-[var(--primary)]" />
                <span className="font-medium text-[var(--text)]">Metadata Changes</span>
                <span className="px-2 py-0.5 text-xs bg-[var(--bg-tertiary)] rounded-full">
                  {diffResult.metadataChanges.length}
                </span>
              </button>
              {expandedSections.metadata && (
                <div className="px-4 pb-4">
                  {diffResult.metadataChanges.map((change, i) => (
                    <div key={i} className="flex items-start gap-2 py-1 text-sm">
                      <span className="text-[var(--text-dim)] w-24">{change.field}:</span>
                      <span className="text-red-400 line-through">{change.oldValue || '(empty)'}</span>
                      <span className="text-[var(--text-dim)]">→</span>
                      <span className="text-green-400">{change.newValue || '(empty)'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Element Changes */}
          {diffResult.elementChanges.length > 0 && (
            <div className="border-b border-[var(--border)]">
              <button
                onClick={() => toggleSection('elements')}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[var(--bg-secondary)]"
              >
                {expandedSections.elements ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Code2 size={16} className="text-[var(--primary)]" />
                <span className="font-medium text-[var(--text)]">Data Element Changes</span>
                <span className="px-2 py-0.5 text-xs bg-[var(--bg-tertiary)] rounded-full">
                  {diffResult.elementChanges.length}
                </span>
              </button>
              {expandedSections.elements && (
                <div className="px-4 pb-4">
                  {diffResult.elementChanges.map((diff, i) => (
                    <ElementDiffRow key={i} diff={diff} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Code Diff (CQL) */}
          {diffResult.codeDiff && diffResult.codeDiff.length > 0 && (
            <div>
              <button
                onClick={() => toggleSection('code')}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[var(--bg-secondary)]"
              >
                {expandedSections.code ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Code2 size={16} className="text-[var(--primary)]" />
                <span className="font-medium text-[var(--text)]">CQL Code Diff</span>
              </button>
              {expandedSections.code && (
                <div className="px-4 pb-4 font-mono text-xs">
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3 max-h-[300px] overflow-auto">
                    {diffResult.codeDiff.map((part, index) => (
                      <div
                        key={index}
                        className={`
                          ${part.added ? 'bg-green-500/20 text-green-400' : ''}
                          ${part.removed ? 'bg-red-500/20 text-red-400' : ''}
                          ${!part.added && !part.removed ? 'text-[var(--text-dim)]' : ''}
                        `}
                      >
                        {part.value.split('\n').map((line, lineIndex, lines) => (
                          lineIndex === lines.length - 1 && line === '' ? null : (
                            <div key={lineIndex} className="flex">
                              <span className="w-4 flex-shrink-0 text-right pr-1 opacity-50 select-none">
                                {part.added ? '+' : part.removed ? '-' : ' '}
                              </span>
                              <span className="whitespace-pre">{line}</span>
                            </div>
                          )
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MeasureDiffViewer;
