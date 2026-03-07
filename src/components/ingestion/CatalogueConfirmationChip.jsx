import { useState, useCallback, useMemo } from 'react';
import { Check, HelpCircle, AlertTriangle, ChevronDown, X } from 'lucide-react';
import { getCatalogueOptions, CATALOGUE_LABELS } from '../../utils/catalogueClassifier';

/**
 * CatalogueConfirmationChip
 *
 * A small inline UI element shown after document parsing but before UMS rendering.
 * Displays the detected catalogue type and lets the user confirm or override.
 *
 * Props:
 * - classification: The classifier output object from catalogueClassifier.js
 * - onConfirm: (catalogueType, wasOverridden, classifierSignals) => void
 * - onCancel: () => void
 * - documentName: string - shown as context e.g. "CMS127v12_2024.pdf"
 */
export function CatalogueConfirmationChip({
  classification,
  onConfirm,
  onCancel,
  documentName,
}) {
  const [showOverride, setShowOverride] = useState(false);
  const [selectedType, setSelectedType] = useState(classification?.detected || null);

  const catalogueOptions = useMemo(() => getCatalogueOptions(), []);

  const handleConfirm = useCallback(() => {
    const wasOverridden = selectedType !== classification?.detected;
    onConfirm(
      selectedType || 'Custom',
      wasOverridden,
      classification?.signals || []
    );
  }, [selectedType, classification, onConfirm]);

  const handleSelectType = useCallback((type) => {
    setSelectedType(type);
    setShowOverride(false);
  }, []);

  // Determine chip style based on confidence
  const confidence = classification?.confidence || 'low';
  const detected = classification?.detected;

  const chipStyle = useMemo(() => {
    if (!detected) {
      // Null detection - neutral chip
      return {
        bg: 'bg-[var(--bg-tertiary)]',
        border: 'border-[var(--border)]',
        text: 'text-[var(--text-muted)]',
        icon: null,
        label: 'Unable to detect',
      };
    }

    switch (confidence) {
      case 'high':
        return {
          bg: 'bg-[var(--success-light)]',
          border: 'border-[var(--success)]/40',
          text: 'text-[var(--success)]',
          icon: <Check className="w-3.5 h-3.5" />,
          label: `Detected: ${CATALOGUE_LABELS[detected] || detected}`,
        };
      case 'medium':
        return {
          bg: 'bg-[var(--warning-light)]',
          border: 'border-[var(--warning)]/40',
          text: 'text-[var(--warning)]',
          icon: <HelpCircle className="w-3.5 h-3.5" />,
          label: `Detected: ${CATALOGUE_LABELS[detected] || detected}?`,
        };
      case 'low':
      default:
        return {
          bg: 'bg-[var(--bg-tertiary)]',
          border: 'border-[var(--border)]',
          text: 'text-[var(--text-muted)]',
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          label: `Detected: ${CATALOGUE_LABELS[detected] || detected} (low confidence)`,
        };
    }
  }, [detected, confidence]);

  // If user has overridden, show their selection
  const displayLabel = selectedType !== detected && selectedType
    ? `Selected: ${CATALOGUE_LABELS[selectedType] || selectedType}`
    : chipStyle.label;

  const isOverridden = selectedType !== detected && selectedType !== null;

  return (
    <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg mb-4">
      {/* Header with document name */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[var(--text-muted)]">
          Catalogue type for: <span className="font-medium text-[var(--text)]">{documentName}</span>
        </span>
        <button
          onClick={onCancel}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
          title="Cancel import"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main content row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Detection chip */}
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
            isOverridden
              ? 'bg-[var(--accent-light)] border-[var(--accent)]/40 text-[var(--accent)]'
              : `${chipStyle.bg} ${chipStyle.border} ${chipStyle.text}`
          }`}
        >
          {isOverridden ? <Check className="w-3.5 h-3.5" /> : chipStyle.icon}
          <span>{displayLabel}</span>
        </div>

        {/* Override dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowOverride(!showOverride)}
            className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1"
          >
            {detected ? 'Not right?' : 'Select type'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOverride ? 'rotate-180' : ''}`} />
          </button>

          {showOverride && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[160px]">
              {catalogueOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSelectType(option.value)}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    selectedType === option.value
                      ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                      : 'text-[var(--text)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedType && !detected}
            className="px-4 py-1.5 text-sm font-medium bg-[var(--primary)] text-black rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>

      {/* Signals list (collapsed by default, show on hover or click) */}
      {classification?.signals && classification.signals.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-[var(--text-dim)] cursor-pointer hover:text-[var(--text-muted)]">
            Detection signals ({classification.signals.length})
          </summary>
          <ul className="mt-2 space-y-1 pl-4">
            {classification.signals.map((signal, i) => (
              <li key={i} className="text-xs text-[var(--text-muted)] list-disc">
                {signal}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default CatalogueConfirmationChip;
