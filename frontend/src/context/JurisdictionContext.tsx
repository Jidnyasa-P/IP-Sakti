import React, { createContext, useContext, useState, ReactNode } from 'react';
import { JurisdictionMode } from '../types';

// ---------------------------------------------------------------------------
// JurisdictionContext — app-wide "Dual Toggle" state:
//   India (domestic)  <->  International / Export
//
// This is currently local/frontend-only state. It is exposed app-wide so
// that any view (Chat, Product Analyzer, IPR Navigator, TK & ABS, etc.) can
// later read it and pass it to backend APIs (e.g. as `target_market` /
// `jurisdiction`), consistent with the domestic/international distinction
// already used by backend/app/services/jurisdiction_service.py.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ipsakti_jurisdiction_mode';

interface JurisdictionContextType {
  jurisdiction: JurisdictionMode;
  setJurisdiction: (mode: JurisdictionMode) => void;
  toggleJurisdiction: () => void;
}

const JurisdictionContext = createContext<JurisdictionContextType | undefined>(undefined);

export const JurisdictionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jurisdiction, setJurisdictionState] = useState<JurisdictionMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'India' || saved === 'International') return saved;
    } catch {}
    return 'India';
  });

  const setJurisdiction = (mode: JurisdictionMode) => {
    setJurisdictionState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  };

  const toggleJurisdiction = () => {
    setJurisdiction(jurisdiction === 'India' ? 'International' : 'India');
  };

  return (
    <JurisdictionContext.Provider value={{ jurisdiction, setJurisdiction, toggleJurisdiction }}>
      {children}
    </JurisdictionContext.Provider>
  );
};

export const useJurisdiction = (): JurisdictionContextType => {
  const context = useContext(JurisdictionContext);
  if (!context) {
    throw new Error('useJurisdiction must be used within a JurisdictionProvider');
  }
  return context;
};
