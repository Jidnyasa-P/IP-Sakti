import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Globe,
  MessageSquare,
  Search,
  CheckCircle2,
  FileText,
  Download,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Shield,
  ExternalLink,
  HelpCircle,
  FlaskConical,
  Scale
} from 'lucide-react';
import { ActiveTab } from './Header';

interface HowToUseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: ActiveTab) => void;
}

interface WalkthroughStep {
  stepNumber: number;
  title: string;
  badge: string;
  description: string;
  keyPoints: string[];
  actionLabel?: string;
  targetTab?: ActiveTab;
  icon: React.ElementType;
}

export const HowToUseModal: React.FC<HowToUseModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);

  if (!isOpen) return null;

  const steps: WalkthroughStep[] = [
    {
      stepNumber: 1,
      title: 'Select Jurisdiction (India or International Mode)',
      badge: 'Step 1 • Mode Selection',
      icon: Globe,
      description:
        'IP-SAKTI Sahayak offers two distinct statutory research workflows via the Jurisdiction toggle in the top-right toolbar:',
      keyPoints: [
        '🇮🇳 India / Domestic Mode (Default): Analyzes queries under The Patents Act 1970 (Section 3(p), 3(e), 3(d)), AYUSH Drugs & Cosmetics Act rules, Schedule T GMP, CSIR-TKDL prior-art bars, and National Biodiversity Authority (NBA) Form III rules.',
        '🌐 International Mode: Researches international multi-jurisdictional IP standards including the PCT (Patent Cooperation Treaty), USPTO 35 U.S.C. 101/102 guidelines, EPO European Patent Convention, Nagoya Protocol cross-border ABS, and the 2024 WIPO Genetic Resources Treaty.',
        'Smart Mode Guard: In International mode, the system automatically detects domestic Indian state/statute queries and prompts you to switch to India Mode.'
      ],
      actionLabel: 'Go to Sahayak Assistant',
      targetTab: 'chat'
    },
    {
      stepNumber: 2,
      title: 'Enter an Ayurveda / AYUSH / IP Query',
      badge: 'Step 2 • Formulate Query',
      icon: MessageSquare,
      description:
        'Ask specific statutory, formulation, or patentability questions using natural language or regional speech:',
      keyPoints: [
        'AYUSH & Plant Formulations: E.g., "Can an Ayurvedic polyherbal formulation combining Ashwagandha and Turmeric extract be patented in India?"',
        'Section 3(p) & 3(e) Synergism: Ask about patent eligibility vs. traditional knowledge prior art and combination index requirements.',
        'Voice Input: Click the microphone icon to query using speech in any of the 22 Eighth Schedule Indian regional languages.',
        'Relevance Protection: Unrelated queries (e.g. general programming or consumer shopping) are cleanly prevented from consuming research quota.'
      ],
      actionLabel: 'Try a Sample Question',
      targetTab: 'chat'
    },
    {
      stepNumber: 3,
      title: 'Submit the Query & Observe Real-Time Synthesis',
      badge: 'Step 3 • Query Execution',
      icon: Search,
      description:
        'Submit your question by pressing Enter or clicking the Send button.',
      keyPoints: [
        'Real-time Statutory Retrieval: Sahayak queries codified statutory repositories (Patents Act, AYUSH guidelines, Biological Diversity Act, TKDL).',
        'Streaming Generation: The grounded legal-technical opinion streams directly into your chat thread.',
        'Multi-Session History: Sessions are automatically catalogued by jurisdiction in the left sidebar for instant recall.'
      ],
      actionLabel: 'Open Chat View',
      targetTab: 'chat'
    },
    {
      stepNumber: 4,
      title: 'Review the Grounded Legal Opinion & Confidence Metric',
      badge: 'Step 4 • Review Answer',
      icon: Sparkles,
      description:
        'Examine the comprehensive advisory crafted specifically for your query.',
      keyPoints: [
        'Structured Opinions: Answers outline patentability hurdles, synergistic data requirements, and filing pathways.',
        'Statutory Confidence Score: Look at the confidence badge (High 90%+, Medium, or Low Flagged).',
        'Expert Legal Advisory Fallback: Low-confidence or ambiguous edge cases are automatically routed to our verified IP legal advisory console for human attorney review.'
      ],
      actionLabel: 'View Sahayak Assistant',
      targetTab: 'chat'
    },
    {
      stepNumber: 5,
      title: 'Inspect Citations & Official Act Links',
      badge: 'Step 5 • Source Verification',
      icon: BookOpen,
      description:
        'Every factual and statutory assertion is tied to indexed official legal authorities.',
      keyPoints: [
        'Clickable Numbered Citations: Click any citation tag [1], [2] in the answer text to open the Citation Inspector Modal.',
        'Official Portal Links: Inspect exact Section excerpts, gazette dates, and click through to IP India (CGPDTM), Ministry of AYUSH, or NBA.',
        'Verification Evidence: View the exact statutory text chunk retrieved from the codified legal knowledge base.'
      ],
      actionLabel: 'Examine Citations in Chat',
      targetTab: 'chat'
    },
    {
      stepNumber: 6,
      title: 'Use Specialized Research & Navigation Tools',
      badge: 'Step 6 • Research Tools',
      icon: FlaskConical,
      description:
        'Explore the dedicated research modules accessible via the top navigation bar:',
      keyPoints: [
        '🧪 Product Analyzer: Enter an Ayurvedic product composition or upload a packaging photo to audit Section 3(p) risk, Schedule T GMP compliance, and heavy-metal limits.',
        '🧭 IPR Navigator: Follow step-by-step interactive filing pathways for Patents, Trademarks (Form TM-A Class 5), Copyrights, and Geographical Indications (GI).',
        '🌿 TKDL & ABS Compliance: Check biodiversity approvals under Biological Diversity Act 2002 (Form III / Form I clearances) and CSIR-TKDL prior art.',
        '📁 Dossier Workspace: View, search, and manage your saved legal consultations and product analyses.'
      ],
      actionLabel: 'Open Product Analyzer',
      targetTab: 'product'
    },
    {
      stepNumber: 7,
      title: 'Generate Comprehensive Dossier Reports',
      badge: 'Step 7 • Generate Report',
      icon: FileText,
      description:
        'Compile your formulation analysis or biodiversity query into an exhaustive statutory report.',
      keyPoints: [
        'Patentability Risk Assessment: Detailed breakdown of novelty, non-obviousness, and Section 3(p) objections.',
        'Regulatory Checklist: Form 25D/24D licensing requirements, Schedule T compliance, and testing protocols.',
        'Actionable Next Steps: Recommended IP filing sequences tailored to practitioners, MSMEs, and academic researchers.'
      ],
      actionLabel: 'Check IPR Navigator',
      targetTab: 'ipr'
    },
    {
      stepNumber: 8,
      title: 'Export Official Dossier as PDF',
      badge: 'Step 8 • PDF Export',
      icon: Download,
      description:
        'Download publication-grade PDF dossiers for patent attorneys, regulatory bodies, and investors.',
      keyPoints: [
        'One-Click PDF Generation: Click the "Extract as PDF" button in the Product Analyzer or Traditional Knowledge views.',
        'Official Formatting: Dossiers include official statutory headers, table of active ingredients, patentability risk matrices, and citations.',
        'Offline Archival: Store or submit PDF dossiers as part of your internal due diligence or regulatory submission packages.'
      ],
      actionLabel: 'Try Product Analyzer & PDF Export',
      targetTab: 'product'
    }
  ];

  const current = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleAction = () => {
    if (current.targetTab && onNavigateTab) {
      onNavigateTab(current.targetTab);
    }
    onClose();
  };

  return (
    <div
      id="how-to-use-walkthrough-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="how-to-use-walkthrough-modal"
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden max-h-[92vh] text-slate-900 dark:text-slate-100"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-800 text-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
              <BookOpen className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-slate-900 dark:text-white text-base sm:text-lg leading-tight">
                  How to Use IP-SAKTI Sahayak
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 uppercase tracking-wider">
                  Guide
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Step-by-step workflow guide for AYUSH & Intellectual Property research
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-walkthrough"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            aria-label="Close walkthrough"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicator Bar */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-semibold text-emerald-800 dark:text-emerald-400">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-[11px]">
              {Math.round(((currentStep + 1) / steps.length) * 100)}% Completed
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-700 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>

          {/* Quick Step Pills for direct jumping */}
          <div className="flex items-center justify-between gap-1 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
            {steps.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all shrink-0 cursor-pointer ${
                  currentStep === idx
                    ? 'bg-slate-900 text-white dark:bg-emerald-700 dark:text-white shadow-2xs'
                    : idx < currentStep
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
                }`}
              >
                {s.stepNumber}. {s.title.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0 shadow-2xs">
              <current.icon className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                {current.badge}
              </span>
              <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                {current.title}
              </h4>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {current.description}
          </p>

          <div className="space-y-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Key Instructions & Capabilities:
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              {current.keyPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-walkthrough-skip"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-colors cursor-pointer"
            >
              Skip / Close
            </button>
            {current.targetTab && (
              <button
                type="button"
                id="btn-walkthrough-jump"
                onClick={handleAction}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
              >
                <span>{current.actionLabel}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-walkthrough-prev"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              id="btn-walkthrough-next"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <span>{currentStep === steps.length - 1 ? 'Got it! Start Research' : 'Next Step'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
