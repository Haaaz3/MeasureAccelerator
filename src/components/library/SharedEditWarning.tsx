import { useState } from 'react';
import { AlertTriangle, ArrowRight, Copy, X, FileText } from 'lucide-react';
import { useMeasureStore } from '../../stores/measureStore';

// ============================================================================
// Types
// ============================================================================

interface SharedEditWarningProps {
  componentName: string;
  usageCount: number;
  measureIds: string[];
  onUpdateAll: () => void;
  onCreateCopy: () => void;
  onCancel: () => void;
}

type EditChoice = 'update_all' | 'create_copy';

// ============================================================================
// Component
// ============================================================================

export default function SharedEditWarning({
  componentName,
  usageCount,
  measureIds,
  onUpdateAll,
  onCreateCopy,
  onCancel,
}: SharedEditWarningProps) {
  const [selectedChoice, setSelectedChoice] = useState<EditChoice>('update_all');
  const { measures } = useMeasureStore();

  // Create a lookup map for measure names
  const measureLookup = new Map(measures.map(m => [m.id, m]));

  const handleContinue = () => {
    if (selectedChoice === 'update_all') {
      onUpdateAll();
    } else {
      onCreateCopy();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="rounded-xl shadow-2xl border w-full max-w-lg flex flex-col"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Header                                                          */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/15">
              <AlertTriangle size={18} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                This component is shared
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Changes may affect multiple measures
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Body                                                             */}
        {/* ---------------------------------------------------------------- */}
        <div className="px-6 py-5 space-y-5">
          {/* Usage Summary */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg border"
            style={{
              borderColor: 'rgba(234,179,8,0.3)',
              backgroundColor: 'rgba(234,179,8,0.06)',
            }}
          >
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            <p className="text-sm" style={{ color: 'var(--text)' }}>
              <span className="font-semibold">&ldquo;{componentName}&rdquo;</span>{' '}
              is used in{' '}
              <span className="font-semibold">{usageCount} measure{usageCount !== 1 ? 's' : ''}</span>.
            </p>
          </div>

          {/* Affected Measures List */}
          <div>
            <h3
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Affected Measures
            </h3>
            <div
              className="border rounded-lg overflow-y-auto max-h-36 divide-y"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-primary)',
              }}
            >
              {measureIds.map((measureId) => {
                const measure = measureLookup.get(measureId);
                const displayName = measure?.metadata?.title || measureId;
                const displayId = measure?.metadata?.measureId || measureId;
                return (
                  <div
                    key={measureId}
                    className="flex items-center gap-2.5 px-4 py-2.5"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <FileText size={14} style={{ color: 'var(--text-secondary)' }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block" style={{ color: 'var(--accent)' }}>
                        {displayId}
                      </span>
                      <span className="text-xs truncate block" style={{ color: 'var(--text-secondary)' }}>
                        {displayName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Radio Options */}
          <div className="space-y-3">
            {/* Option 1: Update All */}
            <label
              className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all"
              style={{
                borderColor:
                  selectedChoice === 'update_all'
                    ? 'var(--accent)'
                    : 'var(--border)',
                backgroundColor:
                  selectedChoice === 'update_all'
                    ? 'var(--accent-muted, rgba(99,102,241,0.08))'
                    : 'transparent',
              }}
            >
              <input
                type="radio"
                name="editChoice"
                value="update_all"
                checked={selectedChoice === 'update_all'}
                onChange={() => setSelectedChoice('update_all')}
                className="mt-0.5 accent-indigo-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <ArrowRight size={14} style={{ color: 'var(--accent)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    Update all measures
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  All {usageCount} measure{usageCount !== 1 ? 's' : ''} will use the new version.
                  Recommended if this is a correction.
                </p>
              </div>
            </label>

            {/* Option 2: Create Copy */}
            <label
              className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all"
              style={{
                borderColor:
                  selectedChoice === 'create_copy'
                    ? 'var(--accent)'
                    : 'var(--border)',
                backgroundColor:
                  selectedChoice === 'create_copy'
                    ? 'var(--accent-muted, rgba(99,102,241,0.08))'
                    : 'transparent',
              }}
            >
              <input
                type="radio"
                name="editChoice"
                value="create_copy"
                checked={selectedChoice === 'create_copy'}
                onChange={() => setSelectedChoice('create_copy')}
                className="mt-0.5 accent-indigo-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Copy size={14} style={{ color: 'var(--accent)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    Create new version for this measure only
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Other measures will continue using the current version.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Footer                                                           */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors border hover:opacity-80"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            style={{
              backgroundColor: 'var(--accent)',
              color: '#fff',
            }}
          >
            Continue
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
