import React, { useState, useEffect } from "react";
import { Header, ActiveTab } from "./components/Header";
import { LandingView } from "./components/LandingView";
import { ChatView } from "./components/ChatView";
import { ProductAnalyzerView } from "./components/ProductAnalyzerView";
import { IPRNavigatorView } from "./components/IPRNavigatorView";
import { TraditionalKnowledgeView } from "./components/TraditionalKnowledgeView";
import { ResearchView } from "./components/ResearchView";
import { WorkspaceView } from "./components/WorkspaceView";
import { AdminView } from "./components/AdminView";
import { LoginView } from "./components/LoginView";
import { RegisterView } from "./components/RegisterView";
import { ProfileView } from "./components/ProfileView";
import { ExpertAdvisoryView } from "./components/ExpertAdvisoryView";
import { CitationModal } from "./components/CitationModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GuidedTour } from "./components/GuidedTour";
import { Citation, normalizeRole } from "./types";
import { Shield, ExternalLink } from "lucide-react";
import { LanguageProvider, useTranslation } from "./context/LanguageContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ExpertAdvisoryProvider } from "./context/ExpertAdvisoryContext";
import { ThemeProvider } from "./context/ThemeContext";

const TOUR_STORAGE_KEY = "ipsakti_guided_tour_status";

function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("landing");
  const { currentLanguage, setLanguage, t } = useTranslation();
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const { isLoggedIn, currentUser } = useAuth();

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
          />
        );
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
          />
        );
      case "chat":
        return (
          <ChatView
            language={currentLanguage}
            onOpenCitation={(cite) => setActiveCitation(cite)}
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
      case "workspace":
        return <WorkspaceView setActiveTab={setActiveTab} />;
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
      <div className="flex-1 w-full pb-20 lg:pb-0">
        <ErrorBoundary key={activeTab} onReset={() => setActiveTab("landing")}>
          {renderCurrentView()}
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

      {/* Persistent Official Portals Footer */}
      <footer className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 mt-auto mb-14 lg:mb-0 transition-colors">
        <div className="w-full px-3 sm:px-5 lg:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-800 text-amber-300 flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span className="font-serif font-bold text-slate-800 dark:text-slate-200 text-sm">
              {t("brand.name", "IP-SAKTI")} {t("brand.badge", "Sahayak")}
            </span>
            <span className="text-slate-400 dark:text-slate-600">|</span>
            <span className="truncate">
              {t(
                "footer.brand_subtitle",
                "AYUSH & Traditional Knowledge IPR Research Platform",
              )}
            </span>
          </div>

          {/* Official Statutory Portal Links */}
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <a
              href="https://ipindia.gov.in"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-slate-800 dark:hover:text-slate-200 hover:underline flex items-center gap-1"
            >
              <span>IP India (CGPDTM)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://ayush.gov.in"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-slate-800 dark:hover:text-slate-200 hover:underline flex items-center gap-1"
            >
              <span>Ministry of AYUSH</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="http://nbaindia.org"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-slate-800 dark:hover:text-slate-200 hover:underline flex items-center gap-1"
            >
              <span>National Biodiversity Authority (NBA)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="http://www.tkdl.res.in"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-slate-800 dark:hover:text-slate-200 hover:underline flex items-center gap-1"
            >
              <span>CSIR-TKDL</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://www.wipo.int"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-slate-800 dark:hover:text-slate-200 hover:underline flex items-center gap-1"
            >
              <span>WIPO</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="text-slate-400 dark:text-slate-500 text-[10px]">
            {t(
              "footer.statutory_notice",
              "Decision-support repository grounded in Indian statutory acts.",
            )}
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
          <ExpertAdvisoryProvider>
            <AppContent />
          </ExpertAdvisoryProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
