import { useEffect, useState } from 'react';
import { Plus, FileText, Loader } from 'lucide-react';
import { useMeasureStore } from '../../stores/measureStore.js';
import { MeasureCreator } from './MeasureCreator.jsx';

export function MeasureLibrary() {
  const { measures, isLoading, error, setActiveMeasure, fetchMeasures } = useMeasureStore();
  const [showCreator, setShowCreator] = useState(false);

  useEffect(() => {
    fetchMeasures();
  }, [fetchMeasures]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--danger)] mb-2">Failed to load measures</p>
          <p className="text-sm text-[var(--text-muted)]">{error}</p>
          <button
            onClick={() => fetchMeasures()}
            className="mt-4 px-4 py-2 bg-[var(--primary)] text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Measure Library</h1>
        <button
          onClick={() => setShowCreator(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Measure
        </button>
      </div>

      {measures.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
            <p className="text-lg text-[var(--text-muted)]">No measures found</p>
            <p className="text-sm text-[var(--text-dim)]">Create your first measure to get started</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {measures.map((measure) => (
            <button
              key={measure.id}
              onClick={() => setActiveMeasure(measure.id)}
              className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-left hover:border-[var(--primary)] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--text)]">{measure.measureId || measure.id}</h3>
                  <p className="text-sm text-[var(--text-muted)] mt-1">{measure.title}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  measure.status === 'PUBLISHED' ? 'bg-[var(--success-light)] text-[var(--success)]' : 'bg-[var(--draft-bg)] text-[var(--draft)]'
                }`}>
                  {measure.status || 'Draft'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Measure Creator Modal */}
      <MeasureCreator
        isOpen={showCreator}
        onClose={() => setShowCreator(false)}
      />
    </div>
  );
}
