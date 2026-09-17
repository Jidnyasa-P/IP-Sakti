import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Compass,
  FlaskConical,
  Shield,
  BookOpen,
  FolderArchive,
  Download,
  Info
} from 'lucide-react';
import { ActiveTab } from './Header';

export interface TourStep {
  id: string;
  stepNumber: number; // 1 to 8
  title: string;
  badge: string;
  icon: React.ElementType;
  targetTab: ActiveTab;
  targetSelector?: string;
  content: string[];
  tip?: string;
}

interface GuidedTourProps {
  isOpen: boolean;
  activeTab: ActiveTab;
  onNavigateTab: (tab: ActiveTab) => void;
  onComplete: () => void;
  onSkip: () => void;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    stepNumber: 1,
    title: 'Welcome to IP-SAKTI',
    badge: 'Quick Tour',
    icon: Sparkles,
    targetTab: 'landing',
    targetSelector: undefined,
    content: [
      "Let's take a quick tour to see what each section of the platform can help you with."
    ]
  },
  {
    id: 'sahayak',
    stepNumber: 2,
    title: 'Sahayak',
    badge: 'AI Assistant',
    icon: Sparkles,
    targetTab: 'chat',
    targetSelector: '#sahayak-chat-form-container',
    content: [
      'Ask Ayurveda, AYUSH, IP or traditional-knowledge questions and get source-backed answers.'
    ]
  },
  {
    id: 'product',
    stepNumber: 3,
    title: 'Product Analyzer',
    badge: 'Formulation Check',
    icon: FlaskConical,
    targetTab: 'product',
    targetSelector: '#product-analyzer-presets',
    content: [
      'Analyze Ayurvedic or herbal formulations and review key regulatory considerations.'
    ]
  },
  {
    id: 'ipr',
    stepNumber: 4,
    title: 'IPR Navigator',
    badge: 'IP Strategy',
    icon: Compass,
    targetTab: 'ipr',
    targetSelector: '#ipr-asset-selection-card',
    content: [
      'Navigate key intellectual-property pathways and filing requirements for your innovations.'
    ]
  },
  {
    id: 'tk',
    stepNumber: 5,
    title: 'TK & ABS',
    badge: 'Biodiversity & TK',
    icon: Shield,
    targetTab: 'tk',
    targetSelector: '#tk-abs-form-card',
    content: [
      'Explore traditional knowledge prior art and check biological resource compliance.'
    ]
  },
  {
    id: 'research',
    stepNumber: 6,
    title: 'Research',
    badge: 'Legislative Library',
    icon: BookOpen,
    targetTab: 'research',
    targetSelector: '#research-search-card',
    content: [
      'Find and explore authoritative statutes, legal provisions, and guidelines in one place.'
    ]
  },
  {
    id: 'workspace',
    stepNumber: 7,
    title: 'Workspace',
    badge: 'Saved Research',
    icon: FolderArchive,
    targetTab: 'workspace',
    targetSelector: '#workspace-subtabs-container',
    content: [
      'Keep your research sessions, evaluations, and bookmarked provisions organized in one place.'
    ]
  },
  {
    id: 'export',
    stepNumber: 8,
    title: 'Reports & Export',
    badge: 'Dossier Export',
    icon: Download,
    targetTab: 'workspace',
    targetSelector: '#workspace-export-dossier-btn',
    content: [
      'Organize your research into a structured report and export it as a PDF or JSON dossier.'
    ]
  }
];

interface RectState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({
  isOpen,
  activeTab,
  onNavigateTab,
  onComplete,
  onSkip,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<RectState | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({
    left: 16,
    width: 380,
  });
  const [isLocatingElement, setIsLocatingElement] = useState(false);

  // Reset to step 0 whenever the tour is launched
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
  }, [isOpen]);

  const currentStep = TOUR_STEPS[currentStepIndex];
  const totalSteps = TOUR_STEPS.length;
  const retryTimerRef = useRef<number | null>(null);
  const trackIntervalRef = useRef<number | null>(null);

  // Position recalculation logic
  const updateElementPosition = useCallback(() => {
    if (!currentStep.targetSelector) {
      // Welcome step: centered modal, no spotlight
      setSpotlightRect(null);
      return;
    }

    const element = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    // Add gentle padding around target
    const padding = 8;
    const sX = Math.max(0, rect.left - padding);
    const sY = Math.max(0, rect.top - padding);
    const sWidth = Math.min(window.innerWidth - sX, rect.width + padding * 2);
    const sHeight = rect.height + padding * 2;

    setSpotlightRect({
      x: sX,
      y: sY,
      width: sWidth,
      height: sHeight,
    });

    // Determine tooltip position
    const isMobile = window.innerWidth < 640;
    const tooltipWidth = isMobile ? Math.min(380, window.innerWidth - 32) : 420;
    const targetCenterX = rect.left + rect.width / 2;

    let left = targetCenterX - tooltipWidth / 2;
    // Keep tooltip within screen boundaries
    left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, left));

    const spaceBelow = window.innerHeight - (rect.bottom + padding);
    const spaceAbove = rect.top - padding;
    const estimatedTooltipHeight = 180;

    if (isMobile) {
      // On mobile, anchor at bottom if target is in upper half, else top
      if (rect.top < window.innerHeight / 2) {
        setTooltipPos({ bottom: 16, left: 16, width: tooltipWidth });
      } else {
        setTooltipPos({ top: 72, left: 16, width: tooltipWidth });
      }
    } else {
      if (spaceBelow >= estimatedTooltipHeight + 20) {
        // Place below
        setTooltipPos({
          top: rect.bottom + padding + 12,
          left,
          width: tooltipWidth,
        });
      } else if (spaceAbove >= estimatedTooltipHeight + 20) {
        // Place above
        setTooltipPos({
          top: Math.max(16, rect.top - padding - estimatedTooltipHeight - 12),
          left,
          width: tooltipWidth,
        });
      } else {
        // Side-by-side or best fit
        setTooltipPos({
          top: Math.max(20, Math.min(window.innerHeight - estimatedTooltipHeight - 20, rect.top)),
          left,
          width: tooltipWidth,
        });
      }
    }
  }, [currentStep]);

  // Handle step activation & navigation
  useEffect(() => {
    if (!isOpen) return;

    if (currentStep.targetTab !== activeTab) {
      onNavigateTab(currentStep.targetTab);
    }

    if (!currentStep.targetSelector) {
      setSpotlightRect(null);
      setIsLocatingElement(false);
      return;
    }

    setIsLocatingElement(true);
    let attempts = 0;
    const maxAttempts = 20; // try for up to 2 seconds

    const findAndHighlight = () => {
      attempts++;
      const el = document.querySelector(currentStep.targetSelector!) as HTMLElement | null;
      if (el && el.getBoundingClientRect().width > 0) {
        setIsLocatingElement(false);
        // Scroll into view smoothly
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        updateElementPosition();

        if (trackIntervalRef.current) clearInterval(trackIntervalRef.current);
        const startTime = Date.now();
        trackIntervalRef.current = window.setInterval(() => {
          updateElementPosition();
          if (Date.now() - startTime > 600) {
            if (trackIntervalRef.current) clearInterval(trackIntervalRef.current);
            trackIntervalRef.current = null;
          }
        }, 50);
      } else if (attempts < maxAttempts) {
        retryTimerRef.current = window.setTimeout(findAndHighlight, 100);
      } else {
        setIsLocatingElement(false);
        setSpotlightRect(null);
      }
    };

    const initialTimer = window.setTimeout(findAndHighlight, 120);

    return () => {
      clearTimeout(initialTimer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (trackIntervalRef.current) clearInterval(trackIntervalRef.current);
    };
  }, [isOpen, currentStepIndex, activeTab, currentStep, onNavigateTab, updateElementPosition]);

  // Window resize and scroll listener
  useEffect(() => {
    if (!isOpen) return;

    const handleResizeOrScroll = () => {
      updateElementPosition();
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll);
    };
  }, [isOpen, updateElementPosition]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStepIndex < totalSteps - 1) {
          setCurrentStepIndex(prev => prev + 1);
        } else {
          onComplete();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentStepIndex > 0) {
          setCurrentStepIndex(prev => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, totalSteps, onComplete, onSkip]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const StepIcon = currentStep.icon;

  return (
    <div id="ipsakti-guided-tour-root" className="fixed inset-0 z-[9990] select-none">
      {/* SVG Spotlight Mask */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none z-[9991]"
        aria-hidden="true"
      >
        <defs>
          <mask id="tour-spotlight-mask">
            {/* White covers everything */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cuts out the spotlight area */}
            {spotlightRect && (
              <rect
                x={spotlightRect.x}
                y={spotlightRect.y}
                width={spotlightRect.width}
                height={spotlightRect.height}
                rx="14"
                ry="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Dark overlay with mask applied */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.72)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Pulsing ring around spotlighted target */}
      {spotlightRect && (
        <div
          style={{
            position: 'fixed',
            left: `${spotlightRect.x}px`,
            top: `${spotlightRect.y}px`,
            width: `${spotlightRect.width}px`,
            height: `${spotlightRect.height}px`,
            pointerEvents: 'none',
            zIndex: 9993,
          }}
          className="rounded-xl border-2 border-emerald-400 ring-4 ring-emerald-500/30 transition-all duration-250 animate-pulse"
        />
      )}

      {/* Welcome Step: Centered Modal */}
      {currentStep.id === 'welcome' && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[9995] pointer-events-auto">
          <div
            id="tour-welcome-modal"
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="bg-slate-900 px-6 py-5 text-white flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-amber-300 shadow-sm shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                    {currentStep.badge}
                  </div>
                  <h2 className="text-xl font-serif font-bold text-white mt-0.5">
                    {currentStep.title}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onSkip}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Skip Tour"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="space-y-2.5 text-sm text-slate-700 leading-relaxed">
                {currentStep.content.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>

              {currentStep.tip && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2">
                  <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>{currentStep.tip}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                id="tour-welcome-skip-btn"
                onClick={onSkip}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors px-3 py-2"
              >
                Skip Tour
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="tour-welcome-start-btn"
                  onClick={handleNext}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <span>Start Tour</span>
                  <ArrowRight className="w-4 h-4 text-amber-300" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Steps 2-8: Contextual Popover Tooltip */}
      {currentStep.id !== 'welcome' && (
        <div
          id={`tour-tooltip-step-${currentStep.stepNumber}`}
          style={{
            position: 'fixed',
            ...(tooltipPos.bottom !== undefined
              ? { bottom: `${tooltipPos.bottom}px` }
              : { top: `${tooltipPos.top ?? 80}px` }),
            left: `${tooltipPos.left}px`,
            width: `${tooltipPos.width}px`,
            zIndex: 9995,
          }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200 max-h-[85vh] flex flex-col"
        >
          {/* Popover Header */}
          <div className="bg-slate-900 px-4 sm:px-5 py-3.5 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center text-amber-300 shrink-0">
                <StepIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                  {currentStep.badge}
                </span>
                <h3 className="text-sm sm:text-base font-serif font-bold text-white truncate">
                  {currentStep.title}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                {currentStep.stepNumber} of {totalSteps}
              </span>
              <button
                type="button"
                onClick={onSkip}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
                title="Skip Tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Popover Content */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5">
            {isLocatingElement && (
              <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg">
                <div className="w-3.5 h-3.5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                <span>Navigating to section and highlighting controls...</span>
              </div>
            )}

            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {currentStep.content.map((point, idx) => (
                <p key={idx}>{point}</p>
              ))}
            </div>

            {currentStep.tip && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                <span>{currentStep.tip}</span>
              </div>
            )}
          </div>

          {/* Popover Footer with Step Controls */}
          <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <button
              type="button"
              id="tour-step-skip-btn"
              onClick={onSkip}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Skip Tour
            </button>

            {/* Step indicator dots */}
            <div className="hidden sm:flex items-center gap-1">
              {TOUR_STEPS.map((s, idx) => (
                <div
                  key={s.id}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === currentStepIndex
                      ? 'w-4 bg-emerald-700'
                      : idx < currentStepIndex
                      ? 'bg-slate-400'
                      : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="tour-step-back-btn"
                onClick={handleBack}
                disabled={currentStepIndex === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                id="tour-step-next-btn"
                onClick={handleNext}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <span>{currentStepIndex === totalSteps - 1 ? 'Finish Tour' : 'Next'}</span>
                {currentStepIndex === totalSteps - 1 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
