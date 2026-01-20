import { useState, useMemo } from 'react';
import {
  Database, Search, Filter, Plus, Download, Code, FileJson, FileSpreadsheet, Copy,
  X, ChevronRight, Link2, Shield, Eye
} from 'lucide-react';
import { useMeasureStore } from '../../stores/measureStore';
import type { ValueSetReference, CodeReference, CodeSystem } from '../../types/ums';

type ViewMode = 'grid' | 'list';
type SortField = 'name' | 'codeCount' | 'system' | 'usageCount';

// Aggregated value set with usage tracking
interface AggregatedValueSet extends ValueSetReference {
  usedByMeasures: Array<{ id: string; measureId: string; title: string }>;
  primaryCodeSystem: CodeSystem | 'Mixed';
}

export function ValueSetManager() {
  const { measures } = useMeasureStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCodeSystem, setSelectedCodeSystem] = useState<CodeSystem | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedValueSet, setSelectedValueSet] = useState<AggregatedValueSet | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Aggregate all value sets across measures with usage tracking
  const aggregatedValueSets = useMemo(() => {
    const vsMap = new Map<string, AggregatedValueSet>();

    measures.forEach(measure => {
      measure.valueSets.forEach(vs => {
        const key = vs.oid || vs.id;
        const existing = vsMap.get(key);

        if (existing) {
          // Add to usage list if not already there
          if (!existing.usedByMeasures.some(m => m.id === measure.id)) {
            existing.usedByMeasures.push({
              id: measure.id,
              measureId: measure.metadata.measureId,
              title: measure.metadata.title,
            });
          }
          // Merge codes if this version has more
          if ((vs.codes?.length || 0) > (existing.codes?.length || 0)) {
            existing.codes = vs.codes;
          }
        } else {
          // Determine primary code system
          const systems = new Set(vs.codes?.map(c => c.system) || []);
          const primarySystem = systems.size === 1 ? [...systems][0] : 'Mixed';

          vsMap.set(key, {
            ...vs,
            usedByMeasures: [{
              id: measure.id,
              measureId: measure.metadata.measureId,
              title: measure.metadata.title,
            }],
            primaryCodeSystem: primarySystem as CodeSystem | 'Mixed',
          });
        }
      });
    });

    return Array.from(vsMap.values());
  }, [measures]);

  // Filter and sort value sets
  const filteredValueSets = useMemo(() => {
    let result = aggregatedValueSets;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(vs =>
        vs.name.toLowerCase().includes(term) ||
        vs.oid?.toLowerCase().includes(term) ||
        vs.codes?.some(c =>
          c.code.toLowerCase().includes(term) ||
          c.display.toLowerCase().includes(term)
        )
      );
    }

    // Code system filter
    if (selectedCodeSystem !== 'all') {
      result = result.filter(vs =>
        vs.codes?.some(c => c.system === selectedCodeSystem)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'codeCount':
          cmp = (a.codes?.length || 0) - (b.codes?.length || 0);
          break;
        case 'usageCount':
          cmp = a.usedByMeasures.length - b.usedByMeasures.length;
          break;
        case 'system':
          cmp = (a.primaryCodeSystem || '').localeCompare(b.primaryCodeSystem || '');
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [aggregatedValueSets, searchTerm, selectedCodeSystem, sortField, sortAsc]);

  // Get all unique code systems
  const codeSystems = useMemo(() => {
    const systems = new Set<CodeSystem>();
    aggregatedValueSets.forEach(vs => {
      vs.codes?.forEach(c => systems.add(c.system));
    });
    return Array.from(systems).sort();
  }, [aggregatedValueSets]);

  // Export functions
  const exportToJSON = (vs: AggregatedValueSet) => {
    const exportData = {
      resourceType: 'ValueSet',
      id: vs.id,
      url: vs.oid ? `http://cts.nlm.nih.gov/fhir/ValueSet/${vs.oid}` : undefined,
      identifier: vs.oid ? [{ system: 'urn:ietf:rfc:3986', value: `urn:oid:${vs.oid}` }] : undefined,
      version: vs.version,
      name: vs.name.replace(/[^a-zA-Z0-9]/g, ''),
      title: vs.name,
      status: 'active',
      compose: {
        include: Object.entries(
          (vs.codes || []).reduce((acc, code) => {
            if (!acc[code.system]) acc[code.system] = [];
            acc[code.system].push({ code: code.code, display: code.display });
            return acc;
          }, {} as Record<string, Array<{ code: string; display: string }>>)
        ).map(([system, concepts]) => ({
          system: getSystemUri(system as CodeSystem),
          concept: concepts,
        })),
      },
    };

    downloadFile(JSON.stringify(exportData, null, 2), `${vs.name.replace(/\s+/g, '_')}.json`, 'application/json');
  };

  const exportToCSV = (vs: AggregatedValueSet) => {
    const headers = ['Code', 'Display', 'System'];
    const rows = vs.codes?.map(c => [c.code, `"${c.display.replace(/"/g, '""')}"`, c.system]) || [];
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadFile(csv, `${vs.name.replace(/\s+/g, '_')}.csv`, 'text/csv');
  };

  const exportAllToJSON = () => {
    const bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: filteredValueSets.map(vs => ({
        resource: {
          resourceType: 'ValueSet',
          id: vs.id,
          url: vs.oid ? `http://cts.nlm.nih.gov/fhir/ValueSet/${vs.oid}` : undefined,
          name: vs.name.replace(/[^a-zA-Z0-9]/g, ''),
          title: vs.name,
          status: 'active',
        },
      })),
    };
    downloadFile(JSON.stringify(bundle, null, 2), 'value_sets_bundle.json', 'application/json');
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main panel */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-3">
                  <Database className="w-7 h-7 text-[var(--accent)]" />
                  Value Set Manager
                </h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Manage clinical terminology value sets across all measures following{' '}
                  <a
                    href="https://vsac.nlm.nih.gov/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline"
                  >
                    VSAC best practices
                  </a>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Value Set
                </button>
                <button
                  onClick={exportAllToJSON}
                  className="px-3 py-2 bg-[var(--bg-secondary)] text-[var(--text-muted)] rounded-lg text-sm hover:text-[var(--text)] transition-colors flex items-center gap-2 border border-[var(--border)]"
                >
                  <Download className="w-4 h-4" />
                  Export All
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <StatCard
                label="Total Value Sets"
                value={aggregatedValueSets.length}
                icon={Database}
              />
              <StatCard
                label="Total Codes"
                value={aggregatedValueSets.reduce((sum, vs) => sum + (vs.codes?.length || 0), 0)}
                icon={Code}
              />
              <StatCard
                label="Code Systems"
                value={codeSystems.length}
                icon={Link2}
              />
              <StatCard
                label="VSAC Verified"
                value={aggregatedValueSets.filter(vs => vs.verified).length}
                icon={Shield}
                color="emerald"
              />
            </div>
          </div>

          {/* Filters & Search */}
          <div className="mb-6 p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)]">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Search */}
              <div className="flex-1 min-w-[300px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, OID, or code..."
                  className="w-full pl-10 pr-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]/50"
                />
              </div>

              {/* Code System Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[var(--text-dim)]" />
                <select
                  value={selectedCodeSystem}
                  onChange={(e) => setSelectedCodeSystem(e.target.value as CodeSystem | 'all')}
                  className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]/50"
                >
                  <option value="all">All Code Systems</option>
                  {codeSystems.map(sys => (
                    <option key={sys} value={sys}>{sys}</option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-dim)]">Sort:</span>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] focus:outline-none"
                >
                  <option value="name">Name</option>
                  <option value="codeCount">Code Count</option>
                  <option value="usageCount">Usage</option>
                  <option value="system">Code System</option>
                </select>
                <button
                  onClick={() => setSortAsc(!sortAsc)}
                  className="p-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {sortAsc ? '↑' : '↓'}
                </button>
              </div>

              {/* View toggle */}
              <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-[var(--accent-light)] text-[var(--accent)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-dim)]'}`}
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-[var(--accent-light)] text-[var(--accent)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-dim)]'}`}
                >
                  <Database className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Value Set List/Grid */}
          {filteredValueSets.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-muted)]">
              <Database className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No value sets found</p>
              <p className="text-sm mt-1">
                {measures.length === 0
                  ? 'Import a measure to see its value sets'
                  : 'Try adjusting your search or filters'}
              </p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-3">
              {filteredValueSets.map(vs => (
                <ValueSetListItem
                  key={vs.oid || vs.id}
                  valueSet={vs}
                  onSelect={() => setSelectedValueSet(vs)}
                  onExportJSON={() => exportToJSON(vs)}
                  onExportCSV={() => exportToCSV(vs)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredValueSets.map(vs => (
                <ValueSetGridItem
                  key={vs.oid || vs.id}
                  valueSet={vs}
                  onSelect={() => setSelectedValueSet(vs)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedValueSet && (
        <ValueSetDetailPanel
          valueSet={selectedValueSet}
          onClose={() => setSelectedValueSet(null)}
          onExportJSON={() => exportToJSON(selectedValueSet)}
          onExportCSV={() => exportToCSV(selectedValueSet)}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateValueSetModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'cyan',
}: {
  label: string;
  value: number;
  icon: typeof Database;
  color?: 'cyan' | 'emerald' | 'amber';
}) {
  const colorClasses = {
    cyan: 'text-[var(--accent)] bg-[var(--accent-light)]',
    emerald: 'text-[var(--success)] bg-[var(--success-light)]',
    amber: 'text-[var(--warning)] bg-[var(--warning-light)]',
  };

  return (
    <div className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)]">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-[var(--text)]">{value.toLocaleString()}</div>
          <div className="text-xs text-[var(--text-muted)]">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ValueSetListItem({
  valueSet,
  onSelect,
  onExportJSON,
  onExportCSV,
}: {
  valueSet: AggregatedValueSet;
  onSelect: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
}) {
  return (
    <div
      className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] hover:border-[var(--accent)]/50 transition-colors cursor-pointer group"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
              {valueSet.name}
            </h3>
            {valueSet.verified && (
              <span className="px-2 py-0.5 text-xs bg-[var(--success-light)] text-[var(--success)] rounded flex items-center gap-1">
                <Shield className="w-3 h-3" />
                VSAC Verified
              </span>
            )}
            <span className={`px-2 py-0.5 text-xs rounded ${getConfidenceColor(valueSet.confidence)}`}>
              {valueSet.confidence}
            </span>
          </div>

          {valueSet.oid && (
            <code className="text-xs text-[var(--text-dim)] block mb-2">
              OID: {valueSet.oid}
            </code>
          )}

          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <Code className="w-3.5 h-3.5" />
              {valueSet.codes?.length || 0} codes
            </span>
            <span className="flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5" />
              {valueSet.primaryCodeSystem}
            </span>
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5" />
              Used in {valueSet.usedByMeasures.length} measure{valueSet.usedByMeasures.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onExportJSON(); }}
            className="p-2 text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] rounded-lg transition-colors"
            title="Export as FHIR JSON"
          >
            <FileJson className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onExportCSV(); }}
            className="p-2 text-[var(--text-dim)] hover:text-[var(--success)] hover:bg-[var(--success-light)] rounded-lg transition-colors"
            title="Export as CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
          <ChevronRight className="w-5 h-5 text-[var(--text-dim)]" />
        </div>
      </div>
    </div>
  );
}

function ValueSetGridItem({
  valueSet,
  onSelect,
}: {
  valueSet: AggregatedValueSet;
  onSelect: () => void;
}) {
  return (
    <div
      className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] hover:border-[var(--accent)]/50 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getSystemBgColor(valueSet.primaryCodeSystem)}`}>
          <Code className="w-5 h-5" />
        </div>
        {valueSet.verified && (
          <Shield className="w-4 h-4 text-[var(--success)]" />
        )}
      </div>

      <h3 className="font-medium text-[var(--text)] mb-1 line-clamp-2">{valueSet.name}</h3>

      <div className="text-xs text-[var(--text-dim)] mb-3">
        {valueSet.primaryCodeSystem} • {valueSet.codes?.length || 0} codes
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {valueSet.usedByMeasures.slice(0, 2).map(m => (
          <span key={m.id} className="px-1.5 py-0.5 text-[10px] bg-[var(--bg-tertiary)] rounded text-[var(--text-muted)]">
            {m.measureId}
          </span>
        ))}
        {valueSet.usedByMeasures.length > 2 && (
          <span className="text-[10px] text-[var(--text-dim)]">
            +{valueSet.usedByMeasures.length - 2} more
          </span>
        )}
      </div>
    </div>
  );
}

function ValueSetDetailPanel({
  valueSet,
  onClose,
  onExportJSON,
  onExportCSV,
}: {
  valueSet: AggregatedValueSet;
  onClose: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
}) {
  const [codeSearch, setCodeSearch] = useState('');
  const [showAddCode, setShowAddCode] = useState(false);
  const [newCode, setNewCode] = useState({ code: '', display: '', system: 'ICD10' as CodeSystem });

  const filteredCodes = valueSet.codes?.filter(c =>
    c.code.toLowerCase().includes(codeSearch.toLowerCase()) ||
    c.display.toLowerCase().includes(codeSearch.toLowerCase())
  ) || [];

  // Group codes by system
  const codesBySystem = filteredCodes.reduce((acc, code) => {
    if (!acc[code.system]) acc[code.system] = [];
    acc[code.system].push(code);
    return acc;
  }, {} as Record<string, CodeReference[]>);

  return (
    <div className="w-[500px] border-l border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-bold text-[var(--text)]">{valueSet.name}</h2>
            {valueSet.verified && (
              <Shield className="w-4 h-4 text-[var(--success)]" />
            )}
          </div>
          {valueSet.oid && (
            <code className="text-xs text-[var(--text-dim)]">OID: {valueSet.oid}</code>
          )}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
          <X className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
      </div>

      {/* Metadata */}
      <div className="p-4 border-b border-[var(--border)] space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-[var(--text-dim)] mb-1">Version</div>
            <div className="text-[var(--text)]">{valueSet.version || 'N/A'}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-dim)] mb-1">Source</div>
            <div className="text-[var(--text)]">{valueSet.source || 'AI Generated'}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-dim)] mb-1">Confidence</div>
            <span className={`px-2 py-0.5 text-xs rounded ${getConfidenceColor(valueSet.confidence)}`}>
              {valueSet.confidence}
            </span>
          </div>
          <div>
            <div className="text-xs text-[var(--text-dim)] mb-1">Code Count</div>
            <div className="text-[var(--text)]">{valueSet.codes?.length || 0}</div>
          </div>
        </div>

        {/* Used by measures */}
        <div>
          <div className="text-xs text-[var(--text-dim)] mb-2">Used in Measures</div>
          <div className="flex flex-wrap gap-2">
            {valueSet.usedByMeasures.map(m => (
              <span
                key={m.id}
                className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] rounded border border-[var(--border)] text-[var(--text-muted)]"
                title={m.title}
              >
                {m.measureId}
              </span>
            ))}
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onExportJSON}
            className="flex-1 py-2 text-sm bg-[var(--accent-light)] text-[var(--accent)] rounded-lg hover:bg-[var(--accent)]/20 transition-colors flex items-center justify-center gap-2"
          >
            <FileJson className="w-4 h-4" />
            FHIR JSON
          </button>
          <button
            onClick={onExportCSV}
            className="flex-1 py-2 text-sm bg-[var(--success-light)] text-[var(--success)] rounded-lg hover:opacity-80 transition-all flex items-center justify-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {/* Code search & add */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
            <input
              type="text"
              value={codeSearch}
              onChange={(e) => setCodeSearch(e.target.value)}
              placeholder="Search codes..."
              className="w-full pl-10 pr-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]/50"
            />
          </div>
          <button
            onClick={() => setShowAddCode(!showAddCode)}
            className="px-3 py-2 bg-[var(--accent-light)] text-[var(--accent)] rounded-lg hover:bg-[var(--accent)]/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {showAddCode && (
          <div className="mt-3 p-3 bg-[var(--bg-tertiary)] rounded-lg space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={newCode.code}
                onChange={(e) => setNewCode({ ...newCode, code: e.target.value })}
                placeholder="Code"
                className="px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm text-[var(--text)] focus:outline-none"
              />
              <input
                type="text"
                value={newCode.display}
                onChange={(e) => setNewCode({ ...newCode, display: e.target.value })}
                placeholder="Display"
                className="col-span-2 px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm text-[var(--text)] focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={newCode.system}
                onChange={(e) => setNewCode({ ...newCode, system: e.target.value as CodeSystem })}
                className="flex-1 px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-sm text-[var(--text)] focus:outline-none"
              >
                <option value="ICD10">ICD-10</option>
                <option value="SNOMED">SNOMED</option>
                <option value="CPT">CPT</option>
                <option value="HCPCS">HCPCS</option>
                <option value="LOINC">LOINC</option>
                <option value="RxNorm">RxNorm</option>
                <option value="CVX">CVX</option>
              </select>
              <button
                onClick={() => {
                  // TODO: Implement add code to value set
                  setNewCode({ code: '', display: '', system: 'ICD10' });
                  setShowAddCode(false);
                }}
                className="px-3 py-1.5 bg-[var(--primary)] text-white rounded text-sm hover:bg-[var(--primary-hover)]"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Code list grouped by system */}
      <div className="flex-1 overflow-auto p-4">
        {Object.entries(codesBySystem).map(([system, codes]) => (
          <div key={system} className="mb-4">
            <div className="flex items-center gap-2 mb-2 sticky top-0 bg-[var(--bg-secondary)] py-1">
              <span className={`px-2 py-0.5 text-xs rounded ${getSystemBgColor(system)}`}>
                {system}
              </span>
              <span className="text-xs text-[var(--text-dim)]">{codes.length} codes</span>
            </div>
            <div className="space-y-1">
              {codes.map((code, idx) => (
                <div
                  key={`${code.code}-${idx}`}
                  className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded group hover:bg-[var(--bg)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <code className="text-xs text-[var(--accent)] font-mono shrink-0">{code.code}</code>
                    <span className="text-sm text-[var(--text)] truncate">{code.display}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => navigator.clipboard.writeText(code.code)}
                      className="p-1 text-[var(--text-dim)] hover:text-[var(--text)] rounded"
                      title="Copy code"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredCodes.length === 0 && (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <Code className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No codes found</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateValueSetModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [oid, setOid] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[500px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text)]">Create New Value Set</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm text-[var(--text-muted)] block mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Diabetes Mellitus Diagnoses"
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]/50"
            />
          </div>

          <div>
            <label className="text-sm text-[var(--text-muted)] block mb-1">OID (optional)</label>
            <input
              type="text"
              value={oid}
              onChange={(e) => setOid(e.target.value)}
              placeholder="e.g., 2.16.840.1.113883.3.464.1003.103.12.1001"
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]/50"
            />
          </div>

          <div>
            <label className="text-sm text-[var(--text-muted)] block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the clinical concept this value set represents..."
              rows={3}
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]/50 resize-none"
            />
          </div>

          <div className="p-3 bg-[var(--accent-light)] border border-blue-500/20 rounded-lg">
            <p className="text-sm text-[var(--accent)]">
              <strong>Tip:</strong> Following VSAC best practices, ensure your value set name clearly
              describes the clinical concept and avoid creating duplicates of existing value sets.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--border)] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // TODO: Implement create value set
              onClose();
            }}
            disabled={!name.trim()}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Value Set
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case 'high': return 'bg-[var(--success-light)] text-[var(--success)]';
    case 'medium': return 'bg-[var(--warning-light)] text-[var(--warning)]';
    case 'low': return 'bg-[var(--danger-light)] text-[var(--danger)]';
    default: return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]';
  }
}

function getSystemBgColor(system: string): string {
  switch (system) {
    case 'ICD10': return 'bg-blue-500/15 text-[var(--accent)]';
    case 'SNOMED': return 'bg-purple-500/15 text-purple-400';
    case 'CPT': return 'bg-[var(--success-light)] text-[var(--success)]';
    case 'HCPCS': return 'bg-[var(--accent-light)] text-[var(--accent)]';
    case 'LOINC': return 'bg-[var(--warning-light)] text-[var(--warning)]';
    case 'RxNorm': return 'bg-pink-500/15 text-pink-400';
    case 'CVX': return 'bg-indigo-500/15 text-indigo-400';
    default: return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]';
  }
}

function getSystemUri(system: CodeSystem): string {
  switch (system) {
    case 'ICD10': return 'http://hl7.org/fhir/sid/icd-10-cm';
    case 'SNOMED': return 'http://snomed.info/sct';
    case 'CPT': return 'http://www.ama-assn.org/go/cpt';
    case 'HCPCS': return 'https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets';
    case 'LOINC': return 'http://loinc.org';
    case 'RxNorm': return 'http://www.nlm.nih.gov/research/umls/rxnorm';
    case 'CVX': return 'http://hl7.org/fhir/sid/cvx';
    default: return '';
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
