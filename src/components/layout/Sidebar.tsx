import { FileText, CheckCircle, Code, Library, Activity, Database, Settings, X, ChevronRight } from 'lucide-react';
import { useMeasureStore } from '../../stores/measureStore';

export function Sidebar() {
  const { activeTab, setActiveTab, activeMeasureId, setActiveMeasure, measures } = useMeasureStore();
  const activeMeasure = measures.find(m => m.id === activeMeasureId);

  // Count total unique value sets across all measures
  const allValueSets = measures.flatMap(m => m.valueSets);
  const uniqueValueSetCount = new Set(allValueSets.map(vs => vs.oid || vs.id)).size;

  // Main navigation - always accessible
  const mainNavItems = [
    { id: 'library' as const, icon: Library, label: 'Measure Library' },
    { id: 'valuesets' as const, icon: Database, label: 'Value Set Library', badge: uniqueValueSetCount > 0 ? uniqueValueSetCount : undefined },
    { id: 'settings' as const, icon: Settings, label: 'Settings' },
  ];

  // Measure-specific navigation - shown when a measure is selected
  const measureNavItems = [
    { id: 'editor' as const, icon: FileText, label: 'UMS Editor' },
    { id: 'validation' as const, icon: CheckCircle, label: 'Test Validation' },
    { id: 'codegen' as const, icon: Code, label: 'Code Generation' },
  ];

  const handleCloseMeasure = () => {
    setActiveMeasure(null);
    setActiveTab('library');
  };

  return (
    <aside className="w-64 bg-[var(--sidebar-bg)] flex flex-col shadow-lg">
      {/* Logo - Oracle Health inspired branding */}
      <div className="p-4 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center shadow-md">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-[var(--sidebar-text)] text-base tracking-tight">Measure</h1>
            <h1 className="font-semibold text-[var(--primary)] text-base tracking-tight -mt-0.5" style={{ color: '#C74634' }}>Accelerator</h1>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="p-3 space-y-1">
        {mainNavItems.map((item) => {
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all
                ${isActive
                  ? 'bg-[var(--sidebar-bg-active)] text-white border-l-3 border-[var(--primary)]'
                  : 'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-bg-hover)] hover:text-[var(--sidebar-text)]'
                }
              `}
              style={isActive ? { borderLeft: '3px solid var(--primary)' } : {}}
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-[var(--accent)] text-white rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Active Measure Context */}
      {activeMeasure && (
        <div className="flex-1 flex flex-col border-t border-[var(--sidebar-border)]">
          {/* Measure Header */}
          <div className="p-3">
            <div className="p-3 rounded-lg bg-[var(--sidebar-bg-hover)] border border-[var(--sidebar-border)]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: '#C74634' }}>
                    Active Measure
                  </div>
                  <div className="text-sm font-semibold text-[var(--sidebar-text)] truncate">
                    {activeMeasure.metadata.measureId}
                  </div>
                  <div className="text-xs text-[var(--sidebar-text-muted)] mt-0.5 truncate">
                    {activeMeasure.metadata.title}
                  </div>
                </div>
                <button
                  onClick={handleCloseMeasure}
                  className="p-1.5 text-[var(--sidebar-text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded transition-colors"
                  title="Close measure"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Measure Navigation */}
          <nav className="px-3 pb-3 space-y-1">
            {measureNavItems.map((item) => {
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-[var(--sidebar-bg-active)] text-white'
                      : 'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-bg-hover)] hover:text-[var(--sidebar-text)]'
                    }
                  `}
                  style={isActive ? { borderLeft: '3px solid var(--primary)' } : { paddingLeft: '15px' }}
                >
                  <ChevronRight className={`w-3 h-3 ${isActive ? 'text-white' : 'text-[var(--sidebar-text-muted)]'}`} />
                  <item.icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* No Measure Selected Hint */}
      {!activeMeasure && measures.length > 0 && (
        <div className="flex-1 flex flex-col justify-center px-3">
          <div className="p-4 rounded-lg border border-dashed border-[var(--sidebar-border)] text-center bg-[var(--sidebar-bg-hover)]/30">
            <FileText className="w-8 h-8 mx-auto mb-2 text-[var(--sidebar-text-muted)]" />
            <p className="text-xs text-[var(--sidebar-text-muted)]">
              Select a measure from the library to edit, validate, or generate code
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-[var(--sidebar-border)]">
        <div className="text-xs text-[var(--sidebar-text-muted)] text-center">
          {measures.length} measure{measures.length !== 1 ? 's' : ''} in library
        </div>
      </div>
    </aside>
  );
}
