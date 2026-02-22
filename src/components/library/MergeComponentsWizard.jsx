import { useState, useMemo, useCallback } from 'react';
import {
  X,
  Check,
  Search,
  GripVertical,
  Code,
  Building2,
  Stethoscope,
  Scissors,
  Pill,
  FlaskConical,
  ClipboardList,
  User,
  Syringe,
  AlertTriangle,
  GitBranch,
  MessageSquare,
  Target,
  Cpu,
  Activity,
  Heart,
  ChevronDown,
  GitMerge,
} from 'lucide-react';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore';

// ============================================================================
// Icons mapping
// ============================================================================
const ICONS = {
  encounter: Building2,
  diagnosis: Stethoscope,
  procedure: Scissors,
  medication: Pill,
  lab: FlaskConical,
  assessment: ClipboardList,
  demographic: User,
  immunization: Syringe,
  allergy: AlertTriangle,
  intervention: GitBranch,
  communication: MessageSquare,
  caregoal: Target,
  device: Cpu,
  symptom: Activity,
  familyhistory: Heart,
  custom: Code,
};

const CAT_COLORS = {
  encounter: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  diagnosis: { bg: 'rgba(236, 72, 153, 0.15)', text: '#ec4899' },
  procedure: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  medication: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
  lab: { bg: 'rgba(99, 102, 241, 0.15)', text: '#6366f1' },
  assessment: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' },
  demographic: { bg: 'rgba(100, 116, 139, 0.15)', text: '#64748b' },
  immunization: { bg: 'rgba(20, 184, 166, 0.15)', text: '#14b8a6' },
  allergy: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  intervention: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  communication: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
  device: { bg: 'rgba(120, 113, 108, 0.15)', text: '#78716c' },
  custom: { bg: 'rgba(120, 113, 108, 0.1)', text: '#78716c' },
};

const CONFIDENCE_COLORS = {
  high: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
  medium: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
  low: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
};

// ============================================================================
// Code Generation
// ============================================================================
function generateMergeCQL(name, components, logic) {
  if (components.length === 0) return `define "${name}":\n  // No components selected`;
  if (components.length === 1) return `define "${name}":\n  "${components[0].name}"`;
  const joiner = logic === 'OR' ? '\n    or ' : '\n    and ';
  const refs = components.map(c => `"${c.name}"`).join(joiner);
  return `define "${name}":\n  ${refs}`;
}

function generateMergeSynapse(name, components, logic) {
  return JSON.stringify({
    name,
    type: 'composite',
    logic,
    components: components.map(c => ({
      ref: c.name,
      id: c.id,
      category: c.category || c.type,
    })),
  }, null, 2);
}

// ============================================================================
// ChipSelect Components
// ============================================================================
function ChipSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const selected = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(selected ? null : o)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              border: selected ? '2px solid var(--accent)' : '1.5px solid var(--border)',
              backgroundColor: selected ? 'var(--accent-muted)' : 'var(--bg-primary)',
              color: selected ? 'var(--accent)' : 'var(--text)',
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function MultiChipSelect({ options, value, onChange }) {
  const arr = value || [];
  const toggle = (v) => onChange(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const selected = arr.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize"
            style={{
              border: selected ? '2px solid var(--accent)' : '1.5px solid var(--border)',
              backgroundColor: selected ? 'var(--accent-muted)' : 'var(--bg-primary)',
              color: selected ? 'var(--accent)' : 'var(--text)',
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// StepBar Component
// ============================================================================
function StepBar({ step, labels }) {
  return (
    <div className="flex items-center gap-0 mb-4">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center" style={{ flex: i < labels.length - 1 ? 1 : 'none' }}>
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all"
            style={{
              backgroundColor: step >= i ? 'var(--accent)' : 'var(--border)',
              color: step >= i ? 'white' : 'var(--text-secondary)',
            }}
          >
            {step > i ? <Check size={12} /> : i + 1}
          </div>
          <span
            className="text-xs font-medium ml-1 whitespace-nowrap"
            style={{ color: step === i ? 'var(--text)' : 'var(--text-secondary)' }}
          >
            {label}
          </span>
          {i < labels.length - 1 && (
            <div
              className="flex-1 h-px mx-1.5 transition-colors"
              style={{ backgroundColor: step > i ? 'var(--accent)' : 'var(--border)' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================
export default function MergeComponentsWizard({ onSave, onClose, preSelectedIds = [], startAtStep = 0 }) {
  const [step, setStep] = useState(startAtStep);
  const [selected, setSelected] = useState(preSelectedIds);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState([]);
  const [filterConfidence, setFilterConfidence] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [showFilters, setShowFilters] = useState(false);

  const [mergeName, setMergeName] = useState('Combined Component');
  const [mergeLogic, setMergeLogic] = useState('OR');
  const [mergeTags, setMergeTags] = useState('');

  const [codeTab, setCodeTab] = useState('cql');
  const [editedCql, setEditedCql] = useState(null);
  const [editedSynapse, setEditedSynapse] = useState(null);

  const { components, addComponent } = useComponentLibraryStore();

  const toggle = useCallback((id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  // Get all categories and measures from components
  const allCategories = useMemo(() => {
    const cats = [...new Set(components.map(c => c.category || c.type || 'custom'))];
    return cats.filter(Boolean).sort();
  }, [components]);

  // Filter and sort components
  const filtered = useMemo(() => {
    let items = [...components];
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(c =>
        c.name.toLowerCase().includes(s) ||
        (c.tags || []).some(tag => tag.toLowerCase().includes(s)) ||
        (c.description || '').toLowerCase().includes(s)
      );
    }
    if (filterCat.length > 0) {
      items = items.filter(c => filterCat.includes(c.category || c.type));
    }
    if (filterConfidence) {
      items = items.filter(c => c.complexity?.level === filterConfidence);
    }
    items.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name);
      if (sortBy === 'usage') return (b.usage?.measureIds?.length || 0) - (a.usage?.measureIds?.length || 0);
      return 0;
    });
    return items;
  }, [components, search, filterCat, filterConfidence, sortBy]);

  // Group by category for display
  const grouped = useMemo(() => {
    if (sortBy !== 'category') return null;
    const map = {};
    filtered.forEach(c => {
      const cat = c.category || c.type || 'custom';
      (map[cat] = map[cat] || []).push(c);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, sortBy]);

  const selectedComponents = selected.map(id => components.find(c => c.id === id)).filter(Boolean);

  const cqlCode = editedCql !== null ? editedCql : generateMergeCQL(mergeName, selectedComponents, mergeLogic);
  const synapseCode = editedSynapse !== null ? editedSynapse : generateMergeSynapse(mergeName, selectedComponents, mergeLogic);

  const stepLabels = ['Select Components', 'Configure Merge', 'Review & Code'];

  // Handle save
  const handleSave = useCallback(() => {
    if (!mergeName?.trim() || selectedComponents.length < 2) return;

    const tags = (mergeTags || '').split(',').map(t => t.trim()).filter(Boolean);

    // Create composite component
    const compositeComponent = {
      id: `comp-${Date.now()}`,
      name: mergeName.trim(),
      type: 'composite',
      category: selectedComponents[0]?.category || 'custom',
      description: `Composite of ${selectedComponents.length} components using ${mergeLogic} logic`,
      components: selectedComponents.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category || c.type,
      })),
      logic: mergeLogic,
      tags,
      complexity: { level: 'medium', score: selectedComponents.length },
      versionInfo: { version: '1.0', status: 'draft' },
      usage: { measureIds: [], lastUsed: null },
      metadata: {
        cqlExpression: editedCql || cqlCode,
        synapseJson: editedSynapse || synapseCode,
      },
      createdAt: new Date().toISOString(),
    };

    addComponent(compositeComponent);
    onSave();
  }, [mergeName, selectedComponents, mergeLogic, mergeTags, editedCql, editedSynapse, cqlCode, synapseCode, addComponent, onSave]);

  const canNext = step === 0 ? selected.length >= 2 : step === 1 ? mergeName.trim() : false;

  // ============================================================================
  // Component Tile - Checkbox in dedicated LEFT GUTTER column, not inside tile
  // Layout: [checkbox gutter] [tile card] as two sibling flex items
  // ============================================================================
  const ComponentTile = ({ comp }) => {
    const isSel = selected.includes(comp.id);
    const cat = comp.category || comp.type || 'custom';
    const cc = CAT_COLORS[cat] || CAT_COLORS.custom;
    const IconComponent = ICONS[cat] || Code;
    const conf = CONFIDENCE_COLORS[comp.complexity?.level] || CONFIDENCE_COLORS.medium;
    const cxLevel = comp.complexity?.level || 'medium';
    const cxDots = cxLevel === 'low' ? 1 : cxLevel === 'medium' ? 2 : 3;
    const cxColor = cxLevel === 'low' ? '#059669' : cxLevel === 'medium' ? '#d97706' : '#dc2626';

    return (
      <div
        onClick={() => toggle(comp.id)}
        className="flex gap-2.5 cursor-pointer mb-1.5"
        style={{ alignItems: 'stretch' }}
      >
        {/* LEFT GUTTER — checkbox only, vertically centered */}
        <div className="flex items-center flex-shrink-0 pt-0.5">
          <div
            className="w-5 h-5 rounded flex items-center justify-center transition-all"
            style={{
              border: isSel ? '2px solid var(--accent)' : '1.5px solid var(--border)',
              backgroundColor: isSel ? 'var(--accent)' : 'transparent',
            }}
          >
            {isSel && <Check size={12} color="white" />}
          </div>
        </div>

        {/* TILE — full card, no checkbox inside */}
        <div
          className="flex-1 p-3 rounded-lg transition-all"
          style={{
            border: isSel ? '2px solid var(--accent)' : '1px solid var(--border)',
            backgroundColor: isSel ? 'var(--accent-muted)' : 'var(--bg-primary)',
          }}
        >
          {/* Row 1: Name + category badge */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="text-sm font-bold truncate" style={{ color: 'var(--text)', lineHeight: 1.3 }}>
              {comp.name}
            </div>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded capitalize flex-shrink-0"
              style={{ backgroundColor: cc.bg, color: cc.text }}
            >
              {cat}
            </span>
          </div>

          {/* Row 2: Description */}
          <div className="text-xs mb-2.5" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {comp.description || 'No description provided'}
          </div>

          {/* Row 3: Complexity */}
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Complexity</span>
            <div className="flex gap-0.5">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: i < cxDots ? cxColor : 'var(--border)' }}
                />
              ))}
            </div>
            <span className="text-[11px] font-semibold capitalize" style={{ color: cxColor }}>
              {cxLevel}
            </span>
          </div>

          {/* Row 4: Divider */}
          <div className="h-px mb-2" style={{ backgroundColor: 'var(--border)' }} />

          {/* Row 5: Measure + status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-secondary)" strokeWidth="1.3" strokeLinecap="round">
                <path d="M2 9l3-3 2 2 3-4"/>
              </svg>
              <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {comp.usage?.measureIds?.length || 0} measures · {comp.valueSet?.codes?.length || 0} codes
              </span>
            </div>
            {comp.versionInfo?.status && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{
                  ...(comp.versionInfo.status === 'approved'
                    ? { color: '#166534', backgroundColor: 'rgba(34, 197, 94, 0.15)' }
                    : { color: '#92400e', backgroundColor: 'rgba(245, 158, 11, 0.15)' }
                  )
                }}
              >
                {comp.versionInfo.status === 'approved' ? 'Approved' : 'In Review'}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // Step 0: Select
  // ============================================================================
  const renderSelect = () => (
    <div>
      {/* Search */}
      <div className="relative mb-2.5">
        <div className="absolute left-2.5 top-2.5">
          <Search size={14} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <input
          type="text"
          className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm outline-none"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text)' }}
          placeholder="Search by name, tag, or description..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filter/sort bar */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium"
          style={{
            border: (filterCat.length || filterConfidence) ? '1.5px solid var(--accent)' : '1px solid var(--border)',
            backgroundColor: (filterCat.length || filterConfidence) ? 'var(--accent-muted)' : 'var(--bg-primary)',
            color: (filterCat.length || filterConfidence) ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          Filters {(filterCat.length + (filterConfidence ? 1 : 0)) > 0 && `(${filterCat.length + (filterConfidence ? 1 : 0)})`}
          <ChevronDown size={12} />
        </button>
        <div className="flex items-center gap-1">
          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Sort:</span>
          {['name', 'category', 'usage'].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSortBy(s)}
              className="px-2 py-1 rounded text-[10px] font-semibold capitalize"
              style={{
                backgroundColor: sortBy === s ? 'var(--accent)' : 'transparent',
                color: sortBy === s ? 'white' : 'var(--text-secondary)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="p-3 rounded-lg border mb-2.5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-tertiary)' }}>
          <div className="mb-2">
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Category</label>
            <MultiChipSelect options={allCategories} value={filterCat} onChange={setFilterCat} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Complexity</label>
            <ChipSelect options={['low', 'medium', 'high']} value={filterConfidence} onChange={setFilterConfidence} />
          </div>
          {(filterCat.length > 0 || filterConfidence) && (
            <button
              type="button"
              onClick={() => { setFilterCat([]); setFilterConfidence(null); }}
              className="mt-2 text-xs font-medium"
              style={{ color: 'var(--accent)' }}
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Count */}
      <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
        {filtered.length} components
        {selected.length > 0 && (
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}> · {selected.length} selected</span>
        )}
      </div>

      {/* Component list */}
      <div className="max-h-[380px] overflow-y-auto pr-1">
        {sortBy === 'category' && grouped ? (
          grouped.map(([cat, items]) => (
            <div key={cat} className="mb-3">
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1 pl-7 capitalize" style={{ color: 'var(--text-secondary)' }}>
                {cat} ({items.length})
              </div>
              {items.map(c => <ComponentTile key={c.id} comp={c} />)}
            </div>
          ))
        ) : (
          filtered.map(c => <ComponentTile key={c.id} comp={c} />)
        )}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            No components match your search.
          </div>
        )}
      </div>

      {/* Selected summary strip */}
      {selected.length > 0 && (
        <div className="mt-2.5 p-2.5 rounded-lg flex items-center gap-1.5 flex-wrap" style={{ backgroundColor: 'var(--accent-muted)', border: '1px solid var(--accent)' }}>
          <span className="text-xs font-semibold mr-1" style={{ color: 'var(--accent)' }}>Selected:</span>
          {selectedComponents.map(c => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              {c.name}
              <span onClick={(e) => { e.stopPropagation(); toggle(c.id); }} className="cursor-pointer opacity-60 hover:opacity-100">
                <X size={10} />
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // Step 1: Configure
  // ============================================================================
  const renderConfigure = () => (
    <div>
      {/* Merged component name */}
      <div className="mb-3.5">
        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Merged Component Name</label>
        <input
          type="text"
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text)' }}
          value={mergeName}
          onChange={e => setMergeName(e.target.value)}
          placeholder="Combined Component"
        />
      </div>

      {/* Logic selector */}
      <div className="mb-3.5">
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Combine Logic</label>
        <div className="flex gap-2">
          {[
            { key: 'OR', label: 'OR (Union)', desc: 'Patient meets any of the components' },
            { key: 'AND', label: 'AND (Intersection)', desc: 'Patient must meet all components' },
          ].map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMergeLogic(opt.key)}
              className="flex-1 p-3 rounded-lg text-left transition-all"
              style={{
                border: mergeLogic === opt.key ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                backgroundColor: mergeLogic === opt.key ? 'var(--accent-muted)' : 'var(--bg-primary)',
              }}
            >
              <div className="text-sm font-semibold" style={{ color: mergeLogic === opt.key ? 'var(--accent)' : 'var(--text)' }}>{opt.label}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Components to merge */}
      <div className="mb-3.5">
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Components to Merge ({selected.length})</label>
        <div className="flex flex-col gap-1">
          {selectedComponents.map((c, idx) => {
            const cat = c.category || c.type || 'custom';
            const cc = CAT_COLORS[cat] || CAT_COLORS.custom;
            const IconComponent = ICONS[cat] || Code;
            return (
              <div
                key={c.id}
                className="flex items-center gap-2 p-2 rounded-lg"
                style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
              >
                <GripVertical size={12} style={{ color: 'var(--text-secondary)' }} />
                <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cc.bg }}>
                  <IconComponent size={12} style={{ color: cc.text }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{c.name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    {c.valueSet?.codes?.length || 0} codes · {cat}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="w-6 h-6 rounded flex items-center justify-center opacity-50 hover:opacity-100"
                >
                  <X size={12} style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Logic preview */}
        <div className="mt-2 p-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
          <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Logic Preview</div>
          <div className="text-xs font-mono" style={{ color: 'var(--text)', lineHeight: 1.6 }}>
            {selectedComponents.map((c, i) => (
              <span key={c.id}>
                <span>"{c.name}"</span>
                {i < selectedComponents.length - 1 && (
                  <span className="font-bold" style={{ color: mergeLogic === 'OR' ? '#f59e0b' : '#3b82f6' }}> {mergeLogic} </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="p-3 rounded-lg text-xs" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)', lineHeight: 1.5 }}>
        Components will be combined using <strong>{mergeLogic}</strong> logic. Each value set remains separate with its codes preserved.
      </div>

      {/* Tags */}
      <div className="mt-3">
        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Tags (optional)</label>
        <input
          type="text"
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text)' }}
          placeholder="comma-separated"
          value={mergeTags}
          onChange={e => setMergeTags(e.target.value)}
        />
      </div>
    </div>
  );

  // ============================================================================
  // Step 2: Review & Code
  // ============================================================================
  const renderReview = () => {
    const totalCodes = selectedComponents.reduce((a, c) => a + (c.valueSet?.codes?.length || 0), 0);
    const rows = [
      { l: 'Name', v: mergeName },
      { l: 'Logic', v: mergeLogic === 'OR' ? 'OR (Union)' : 'AND (Intersection)' },
      { l: 'Components', v: `${selected.length} components, ${totalCodes} total codes` },
      mergeTags && { l: 'Tags', v: mergeTags },
    ].filter(Boolean);

    return (
      <div>
        {/* Summary */}
        <div className="rounded-lg border overflow-hidden mb-3" style={{ borderColor: 'var(--border)' }}>
          {rows.map((r, i) => (
            <div
              key={r.l}
              className="flex px-3 py-2"
              style={{
                borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                backgroundColor: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
              }}
            >
              <span className="text-xs font-semibold w-24 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{r.l}</span>
              <span className="text-xs" style={{ color: 'var(--text)' }}>{r.v}</span>
            </div>
          ))}
        </div>

        {/* Component list */}
        <div className="mb-3">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Merged Components</label>
          {selectedComponents.map((c, idx) => {
            const cat = c.category || c.type || 'custom';
            const cc = CAT_COLORS[cat] || CAT_COLORS.custom;
            const IconComponent = ICONS[cat] || Code;
            return (
              <div key={c.id}>
                <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cc.bg }}>
                    <IconComponent size={10} style={{ color: cc.text }} />
                  </div>
                  <span className="text-xs font-medium flex-1" style={{ color: 'var(--text)' }}>{c.name}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    {c.valueSet?.codes?.length || 0} codes
                  </span>
                </div>
                {idx < selectedComponents.length - 1 && (
                  <div className="text-center py-0.5 text-xs font-bold" style={{ color: mergeLogic === 'OR' ? '#f59e0b' : '#3b82f6' }}>
                    {mergeLogic}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Code editor */}
        <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="flex border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-tertiary)' }}>
            {[{ key: 'cql', label: 'CQL' }, { key: 'synapse', label: 'Synapse JSON' }].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCodeTab(tab.key)}
                className="flex-1 py-2 px-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                style={{
                  backgroundColor: codeTab === tab.key ? 'var(--bg-primary)' : 'transparent',
                  borderBottom: codeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                  color: codeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <Code size={12} />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <textarea
              className="w-full px-3.5 py-3 border-none outline-none text-xs font-mono resize-y"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text)',
                minHeight: 140,
                lineHeight: 1.6,
              }}
              value={codeTab === 'cql' ? cqlCode : synapseCode}
              onChange={e => {
                if (codeTab === 'cql') setEditedCql(e.target.value);
                else setEditedSynapse(e.target.value);
              }}
            />
            <div
              className="absolute top-2 right-2.5 text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
            >
              {(codeTab === 'cql' ? editedCql : editedSynapse) !== null ? 'edited' : 'auto-generated'}
            </div>
          </div>
        </div>
        <div className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          Edit code directly before saving. Manual edits override auto-generation.
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="rounded-xl shadow-2xl border w-full max-w-[580px] max-h-[90vh] flex flex-col"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)' }}
            >
              <GitMerge size={14} style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Merge Components</h2>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Combine existing components with logic operators</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-md flex items-center justify-center hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3.5">
          <StepBar step={step} labels={stepLabels} />
          {step === 0 && renderSelect()}
          {step === 1 && renderConfigure()}
          {step === 2 && renderReview()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
              opacity: step > 0 ? 1 : 0.5,
            }}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <div className="flex items-center gap-2">
            {step === 0 && selected.length >= 2 && (
              <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>{selected.length} components selected</span>
            )}
            {step === 0 && selected.length > 0 && selected.length < 2 && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Select at least 2</span>
            )}
            <button
              type="button"
              onClick={() => {
                if (step === 2) {
                  handleSave();
                } else if (canNext) {
                  setStep(step + 1);
                }
              }}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor: (step === 2 || canNext) ? 'var(--accent)' : 'var(--border)',
                color: (step === 2 || canNext) ? 'white' : 'var(--text-secondary)',
                cursor: (step === 2 || canNext) ? 'pointer' : 'not-allowed',
                boxShadow: (step === 2 || canNext) ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
              }}
            >
              {step === 2 ? 'Merge Components' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
