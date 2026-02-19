import { FileText, CheckCircle, Code, Library, Database, Settings, X, ChevronRight, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMeasureStore } from '../../stores/measureStore';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore';

// Map tab IDs to routes
const TAB_TO_ROUTE = {
  library: '/library',
  editor: '/editor',
  valuesets: '/valuesets',
  validation: '/validation',
  codegen: '/codegen',
  components: '/components',
  settings: '/settings',
};

export function Sidebar() {
  const navigate = useNavigate();
  const { activeTab, activeMeasureId, setActiveMeasure, measures } = useMeasureStore();
  const { components } = useComponentLibraryStore();
  const activeMeasure = measures.find(m => m.id === activeMeasureId);

  // Count measures
  const measureCount = measures.length;

  // Count active (non-archived) components
  const activeComponentCount = components.filter(c => c.versionInfo.status !== 'archived').length;

  // Count total unique value sets across all measures
  const allValueSets = measures.flatMap(m => m.valueSets);
  const uniqueValueSetCount = new Set(allValueSets.map(vs => vs.oid || vs.id)).size;

  // Main navigation - always accessible
  const mainNavItems = [
    { id: 'library', icon: Library, label: 'Measure Library', badge: measureCount > 0 ? measureCount : undefined },
    { id: 'components', icon: Layers, label: 'Component Library', badge: activeComponentCount > 0 ? activeComponentCount : undefined },
    { id: 'valuesets', icon: Database, label: 'Value Set Library', badge: uniqueValueSetCount > 0 ? uniqueValueSetCount : undefined },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  // Measure-specific navigation - shown when a measure is selected
  const measureNavItems = [
    { id: 'editor', icon: FileText, label: 'UMS Editor' },
    { id: 'validation', icon: CheckCircle, label: 'Test Validation' },
    { id: 'codegen', icon: Code, label: 'Code Generation' },
  ];

  const handleCloseMeasure = () => {
    setActiveMeasure(null);
    navigate('/library');
  };

  return (
    <aside className="w-64 bg-[var(--sidebar-bg)] flex flex-col shadow-lg">
      {/* Logo */}
      <div className="p-4 border-b border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]">
        <img
          src="/logo.png"
          alt="Algo Accelerator"
          className="w-full h-auto max-h-14 object-contain mix-blend-multiply"
        />
      </div>

      {/* Main Navigation */}
      <nav className="p-3 space-y-1">
        {mainNavItems.map((item) => {
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => navigate(TAB_TO_ROUTE[item.id])}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all
                ${isActive
                  ? 'bg-[var(--primary-light)] text-[var(--primary)] font-semibold'
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
                  onClick={() => navigate(TAB_TO_ROUTE[item.id])}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-[var(--primary-light)] text-[var(--primary)] font-semibold'
                      : 'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-bg-hover)] hover:text-[var(--sidebar-text)]'
                    }
                  `}
                  style={isActive ? { borderLeft: '3px solid var(--primary)' } : { paddingLeft: '15px' }}
                >
                  <ChevronRight className={`w-3 h-3 text-[var(--primary)]`} />
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
