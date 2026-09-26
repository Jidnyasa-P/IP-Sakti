import React, { useState, useEffect } from "react";
import { Header, ActiveTab } from "./components/Header";
import { LandingView } from "./components/LandingView";
import { ChatView } from "./components/ChatView";
import { ProductAnalyzerView } from "./components/ProductAnalyzerView";
import { IPRNavigatorView } from "./components/IPRNavigatorView";
import { TraditionalKnowledgeView } from "./components/TraditionalKnowledgeView";
import { ResearchView } from "./components/ResearchView";
import { WorkspaceView } from "./components/WorkspaceView";
import { HelpDeskView } from "./components/HelpDeskView";
import { AdminView } from "./components/AdminView";
import { LoginView } from "./components/LoginView";
import { RegisterView } from "./components/RegisterView";
import { ProfileView } from "./components/ProfileView";
import { ExpertAdvisoryView } from "./components/ExpertAdvisoryView";
import { OfficialPartnersCarousel } from "./components/OfficialPartnersCarousel";
import { CitationModal } from "./components/CitationModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GuidedTour } from "./components/GuidedTour";
import { Citation, normalizeRole } from "./types";
import { ExternalLink } from "lucide-react";
import { LegalPolicyModal, LegalDocument } from "./components/LegalPolicyModal";
import { LanguageProvider, useTranslation } from "./context/LanguageContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ExpertAdvisoryProvider } from "./context/ExpertAdvisoryContext";
import { ThemeProvider } from "./context/ThemeContext";

const TOUR_STORAGE_KEY = "ipsakti_guided_tour_status";

function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("landing");
  const { currentLanguage, setLanguage, t } = useTranslation();
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const [pendingGrievance, setPendingGrievance] = useState<{
    conversationId?: string;
    messageId?: string;
    query?: string;
    response?: string;
  } | null>(null);

  const handleRaiseGrievance = (context: {
    conversationId?: string;
    messageId?: string;
    query?: string;
    response?: string;
  }) => {
    setPendingGrievance(context);
    setActiveTab("workspace");
  };
  const { isLoggedIn, currentUser } = useAuth();
  const [officialPortalLinks, setOfficialPortalLinks] = useState<
    { id: string; label: string; url: string }[]
  >([]);

  useEffect(() => {
    let active = true;
    fetch("/api/official-links")
      .then(async (res) => (res.ok ? res.json() : { links: [] }))
      .then((data) => {
        if (!active) return;
        const links = Array.isArray(data?.links) ? data.links : [];
        setOfficialPortalLinks(links.map((item: { id?: string; label?: string; url?: string }) => ({
          id: String(item.id || item.url || "official"),
          label: String(item.label || "Official Source"),
          url: String(item.url || ""),
        })).filter((item: { url: string }) => item.url));
      })
      .catch(() => {
        if (active) setOfficialPortalLinks([]);
      });

    return () => {
      active = false;
    };
  }, []);

  // First-time visitor guided tour auto-discovery state
  // The site always opens directly on the Home/Landing page.
  // The walkthrough is available from the Home page but does not block first load.
  const [isTourActive, setIsTourActive] = useState<boolean>(false);

  const handleStartTour = () => {
    setIsTourActive(true);
  };

  const handleCompleteTour = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "completed");
    } catch (e) {
      console.warn("Failed to save tour status:", e);
    }
    setIsTourActive(false);
    if (!isLoggedIn) {
      setActiveTab("landing");
    }
  };

  const handleSkipTour = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "skipped");
    } catch (e) {
      console.warn("Failed to save tour status:", e);
    }
    setIsTourActive(false);
    if (!isLoggedIn) {
      setActiveTab("landing");
    }
  };

  const isExpert =
    isLoggedIn && currentUser && normalizeRole(currentUser.role) === "Expert";

  // Helper to render current active view
  const renderCurrentView = () => {
    // Public views always accessible when logged out, unless guided tour is active
    if (!isLoggedIn && !isTourActive) {
      if (activeTab === "login") {
        return (
          <LoginView setActiveTab={setActiveTab} targetTabAfterLogin="chat" />
        );
      }
      if (activeTab === "register") {
        return <RegisterView setActiveTab={setActiveTab} />;
      }
      return (
        <LandingView
          setActiveTab={setActiveTab}
          onOpenWalkthrough={handleStartTour}
        />
      );
    }

    // Role-specific enforcement: Legal Expert only sees flagged low-confidence queries
    if (isExpert && !isTourActive) {
      if (activeTab === "landing") {
        return (
          <LandingView
            setActiveTab={setActiveTab}
            onOpenWalkthrough={handleStartTour}
            onRaiseGrievance={() => handleRaiseGrievance({})}
          />
        );
      }
      if (activeTab === "helpdesk") {
        return <HelpDeskView setActiveTab={setActiveTab} onRaiseGrievance={() => { setActiveTab("expert"); window.setTimeout(() => window.dispatchEvent(new CustomEvent("ipsakti:open-expert-grievances")), 0); }} onOpenLegal={(doc) => setLegalDocument(doc)} />;
      }
      if (activeTab === "profile") {
        return <ProfileView setActiveTab={setActiveTab} />;
      }
      return (
        <ExpertAdvisoryView
          onOpenCitation={(cite) => setActiveCitation(cite)}
        />
      );
    }

    // Standard views for Practitioners, Researchers, Organizations & Admins
    switch (activeTab) {
      case "landing":
        return (
          <LandingView
            setActiveTab={setActiveTab}
            onOpenWalkthrough={handleStartTour}
            onRaiseGrievance={() => handleRaiseGrievance({})}
          />
        );
      case "chat":
        return (
          <ChatView
            language={currentLanguage}
            onOpenCitation={(cite) => setActiveCitation(cite)}
            onRaiseGrievance={handleRaiseGrievance}
          />
        );
      case "product":
        return (
          <ProductAnalyzerView
            onOpenCitation={(cite) => setActiveCitation(cite)}
          />
        );
      case "ipr":
        return (
          <IPRNavigatorView
            onOpenCitation={(cite) => setActiveCitation(cite)}
          />
        );
      case "tk":
        return (
          <TraditionalKnowledgeView
            onOpenCitation={(cite) => setActiveCitation(cite)}
          />
        );
      case "research":
        return (
          <ResearchView onOpenCitation={(cite) => setActiveCitation(cite)} />
        );
      case "helpdesk":
        return <HelpDeskView setActiveTab={setActiveTab} onRaiseGrievance={() => handleRaiseGrievance({})} onOpenLegal={(doc) => setLegalDocument(doc)} />;
      case "workspace":
        return (
          <WorkspaceView
            setActiveTab={setActiveTab}
            openGrievanceOnLoad={pendingGrievance}
            onGrievanceOpened={() => setPendingGrievance(null)}
          />
        );
      case "admin":
        return <AdminView />;
      case "profile":
        return <ProfileView setActiveTab={setActiveTab} />;
      case "expert":
        return (
          <ExpertAdvisoryView
            onOpenCitation={(cite) => setActiveCitation(cite)}
          />
        );
      default:
        return <LandingView setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-emerald-100 dark:selection:bg-emerald-900 selection:text-emerald-900 dark:selection:text-emerald-100 w-full overflow-x-hidden transition-colors">
      {/* Primary Application Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        language={currentLanguage}
        setLanguage={setLanguage}
        onOpenWalkthrough={handleStartTour}
        isTourActive={isTourActive}
      />

      {/* Main Viewport Container */}
      <div className="flex-1 w-full min-w-0 pt-14 xl:pt-24 pb-20 xl:pb-0">
        <ErrorBoundary key={activeTab} onReset={() => setActiveTab("landing")}>
          <main className="w-full max-w-[1800px] mx-auto min-w-0">
            {renderCurrentView()}
          </main>
        </ErrorBoundary>
      </div>

      {/* Citation Inspector Modal */}
      <CitationModal
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />

      {/* Interactive In-Product Guided Tour */}
      <GuidedTour
        isOpen={isTourActive}
        activeTab={activeTab}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onComplete={handleCompleteTour}
        onSkip={handleSkipTour}
      />

      <LegalPolicyModal document={legalDocument} onClose={() => setLegalDocument(null)} />

      <OfficialPartnersCarousel links={officialPortalLinks} />

      {/* Government-style footer: dark, accessible, source-linked and responsive. */}
      <footer className="w-full bg-slate-950 text-slate-200 border-t border-slate-800 mt-auto mb-14 lg:mb-0">
        <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-9 sm:py-11">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1.4fr] gap-8 lg:gap-10">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-white p-1.5 shrink-0">
                  <img src="/ip-sakti-logo.png" alt="IP-SAKTI logo" className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-serif font-bold text-white text-lg">IP-SAKTI Sahayak</h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-1">AYUSH & Traditional Knowledge IPR Research Platform</p>
                </div>
              </div>
              <p className="mt-5 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl">AI-assisted research and decision support. Verify important information against current official sources before taking legal, regulatory or policy action.</p>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white mb-4">Useful Links</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  ["Home", "landing"],
                  ["Sahayak AI", "chat"],
                  ["Product Analyzer", "product"],
                  ["IPR Navigator", "ipr"],
                  ["TK & ABS", "tk"],
                  ["Research", "research"],
                  ["HelpDesk", "helpdesk"],
                  ...(isLoggedIn ? [["My Workspace", "workspace"]] : []),
                ].map(([label, tab]) => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab as ActiveTab)} className="text-left text-slate-300 hover:text-white hover:underline transition-colors">{label}</button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white mb-4">Website Policies & Support</h3>
              <div className="flex flex-col gap-2 text-sm">
                <button type="button" onClick={() => setLegalDocument("terms")} className="text-left text-slate-300 hover:text-white hover:underline">Terms & Conditions</button>
                <button type="button" onClick={() => setLegalDocument("privacy")} className="text-left text-slate-300 hover:text-white hover:underline">Privacy Policy</button>
                <button type="button" onClick={() => setActiveTab("helpdesk")} className="text-left text-slate-300 hover:text-white hover:underline">Feedback & Contact</button>
                <button type="button" onClick={() => setActiveTab("helpdesk")} className="text-left text-slate-300 hover:text-white hover:underline">Help / FAQs</button>
              </div>
            </div>

            <div className="min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white mb-4">Official Links</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 max-h-48 overflow-y-auto pr-1">
                {officialPortalLinks.map((link) => (
                  <a key={`${link.id}-${link.url}`} href={link.url} target="_blank" rel="noreferrer noopener" className="text-slate-300 hover:text-white hover:underline flex items-center gap-1 min-w-0">
                    <span className="truncate text-sm">{link.label}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ))}
                {officialPortalLinks.length === 0 && <span className="text-slate-500 text-xs">Loading official links…</span>}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-[11px] text-slate-400">
            <span>Official source links are resolved from the application's source registry.</span>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span>© {new Date().getFullYear()} IP-SAKTI Sahayak</span>
              <span>Last updated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <NotificationProvider>
            <ExpertAdvisoryProvider>
              <AppContent />
            </ExpertAdvisoryProvider>
          </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
