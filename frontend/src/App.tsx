import React, { useState } from 'react';
import { Header, ActiveTab } from './components/Header';
import { LandingView } from './components/LandingView';
import { ChatView } from './components/ChatView';
import { ProductAnalyzerView } from './components/ProductAnalyzerView';
import { IPRNavigatorView } from './components/IPRNavigatorView';
import { TraditionalKnowledgeView } from './components/TraditionalKnowledgeView';
import { ResearchView } from './components/ResearchView';
import { WorkspaceView } from './components/WorkspaceView';
import { AdminView } from './components/AdminView';
import { CitationModal } from './components/CitationModal';
import { Citation } from './types';
import { Shield, ExternalLink } from 'lucide-react';
import { LanguageProvider, useTranslation } from './context/LanguageContext';

function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('landing');
  const { currentLanguage, setLanguage, t } = useTranslation();
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* Primary Application Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        language={currentLanguage}
        setLanguage={setLanguage}
      />

      {/* Main Viewport Container */}
      <div className="flex-1 w-full">
        {activeTab === 'landing' && <LandingView setActiveTab={setActiveTab} />}
        {activeTab === 'chat' && (
          <ChatView
            language={currentLanguage}
            onOpenCitation={(cite) => setActiveCitation(cite)}
          />
        )}
        {activeTab === 'product' && (
          <ProductAnalyzerView
            onOpenCitation={(cite) => setActiveCitation(cite)}
          />
        )}
        {activeTab === 'ipr' && (
          <IPRNavigatorView
            onOpenCitation={(cite) => setActiveCitation(cite)}
          />
        )}
        {activeTab === 'tk' && (
          <TraditionalKnowledgeView
            onOpenCitation={(cite) => setActiveCitation(cite)}
          />
        )}
        {activeTab === 'research' && (
          <ResearchView
            onOpenCitation={(cite) => setActiveCitation(cite)}
          />
        )}
        {activeTab === 'workspace' && (
          <WorkspaceView
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === 'admin' && <AdminView />}
      </div>

      {/* Citation Inspector Modal */}
      <CitationModal
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />

      {/* Persistent Official Portals Footer */}
      <footer className="w-full bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-800 text-amber-300 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span className="font-serif font-bold text-slate-800 text-sm">
              {t('brand.name', 'IP-SAKTI')} {t('brand.badge', 'Sahayak')}
            </span>
            <span className="text-slate-400">|</span>
            <span>{t('footer.brand_subtitle', 'AYUSH & Traditional Knowledge IPR Research Platform')}</span>
          </div>

          {/* Official Statutory Portal Links */}
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <a
              href="https://ipindia.gov.in"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-slate-800 hover:underline flex items-center gap-1"
            >
              <span>IP India (CGPDTM)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://ayush.gov.in"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-slate-800 hover:underline flex items-center gap-1"
            >
              <span>Ministry of AYUSH</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="http://nbaindia.org"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-slate-800 hover:underline flex items-center gap-1"
            >
              <span>National Biodiversity Authority (NBA)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="http://www.tkdl.res.in"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-slate-800 hover:underline flex items-center gap-1"
            >
              <span>CSIR-TKDL</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://www.wipo.int"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-slate-800 hover:underline flex items-center gap-1"
            >
              <span>WIPO</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="text-slate-400 text-[10px]">
            {t('footer.statutory_notice', 'Decision-support repository grounded in Indian statutory acts.')}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
