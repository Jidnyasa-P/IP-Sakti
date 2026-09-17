import React from 'react';
import { useJurisdiction } from '../context/JurisdictionContext';

// Compact, reversible India <-> International jurisdiction switch, styled to
// match the existing language-selector control in Header.tsx.
export const JurisdictionToggle: React.FC = () => {
  const { jurisdiction, toggleJurisdiction } = useJurisdiction();
  const isIndia = jurisdiction === 'India';

  return (
    <button
      type="button"
      id="jurisdiction-toggle-btn"
      onClick={toggleJurisdiction}
      title="Switch between Domestic (India) and International/Export guidance"
      aria-label="Toggle jurisdiction between India and International"
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
        isIndia
          ? 'border-emerald-300 bg-emerald-50/70 text-emerald-900'
          : 'border-amber-300 bg-amber-50/70 text-amber-900'
      }`}
    >
      <span className="text-sm leading-none">{isIndia ? '\u{1F1EE}\u{1F1F3}' : '\u{1F30D}'}</span>
      <span className="whitespace-nowrap">{isIndia ? 'Domestic (India)' : 'International / Export'}</span>
    </button>
  );
};
