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
import { CitationModal } from "./components/CitationModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GuidedTour } from "./components/GuidedTour";
import { Citation, normalizeRole } from "./types";
import { ExternalLink } from "lucide-react";
import { LegalPolicyModal, LegalDocument } from "./components/LegalPolicyModal";
import { LanguageProvider, useTranslation } from "./context/LanguageContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ExpertAdvisoryProvider } from "./context/ExpertAdvisoryContext";
import { ThemeProvider } from "./context/ThemeContext";
import { authFetch } from "./components/auth/authStorage";

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
    if (!isLoggedIn) {
      setOfficialPortalLinks([]);
      return () => { active = false; };
    }

    const manifestDocuments = [
      { id: "DOC-PATENTS-ACT-1970", label: "IP India (CGPDTM)" },
      { id: "DOC-DRUGS-RULES-1945", label: "CDSCO / ASU Rules" },
      { id: "DOC-BD-AMENDMENT-ACT-2023", label: "National Biodiversity Authority (NBA)" },
      { id: "DOC-WIPO-PCT", label: "WIPO" },
    ];

    Promise.all(
      manifestDocuments.map(async (item) => {
        try {
          const res = await authFetch(`/api/documents/${encodeURIComponent(item.id)}`);
          if (!res.ok) return null;
          const data = await res.json();
          const url = data?.metadata?.url;
          return url ? { ...item, url: String(url) } : null;
        } catch {
          return null;
        }
      }),
    ).then((links) => {
      if (active) setOfficialPortalLinks(links.filter(Boolean) as { id: string; label: string; url: string }[]);
    });

    return () => { active = false; };
  }, [isLoggedIn]);

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

      {/* Persistent Official Portals Footer */}
      <footer className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-7 mt-auto mb-14 lg:mb-0 transition-colors">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <img src="/ip-sakti-logo.png" alt="IP-SAKTI logo" className="w-full h-full object-contain" />
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

          {/* Official Statutory Portal Links — URLs are resolved from manifest-backed document metadata. */}
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-x-5 gap-y-2 text-[11px]">
              {officialPortalLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-slate-800 dark:hover:text-slate-200 hover:underline flex items-center gap-1"
                >
                  <span>{link.label}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
              <span className="hidden lg:inline text-slate-300 dark:text-slate-700">|</span>
              <button type="button" onClick={() => setLegalDocument("terms")} className="font-semibold hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline">Terms & Conditions</button>
              <button type="button" onClick={() => setLegalDocument("privacy")} className="font-semibold hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline">Privacy Policy</button>
            </div>
          </div>
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-4 text-[10px] text-slate-400 dark:text-slate-500">
            <span>AI-assisted research and decision support • Verify important information against current official sources.</span>
            <span>© {new Date().getFullYear()} IP-SAKTI Sahayak</span>
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
