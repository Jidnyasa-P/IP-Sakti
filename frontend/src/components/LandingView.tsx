import React from 'react';
import { Sparkles, FlaskConical, Compass, BookOpen, ArrowRight, ShieldCheck, LogIn, UserPlus, CheckCircle2, HelpCircle } from 'lucide-react';
import { ActiveTab } from './Header';
import { DisclaimerBanner } from './DisclaimerBanner';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface LandingViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenWalkthrough?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ setActiveTab, onOpenWalkthrough }) => {
  const { t } = useTranslation();
  const { currentUser, isLoggedIn } = useAuth();

  const handleActionClick = (targetTab: ActiveTab) => {
    if (isLoggedIn) {
      setActiveTab(targetTab);
    } else {
      setActiveTab('login');
    }
  };

  const capabilities = [
    {
      id: 'chat' as ActiveTab,
      title: t('landing.cap_ask_title', 'Ask'),
      description: t('landing.cap_ask_desc', 'Ask questions about IPR, AYUSH and regulatory topics.'),
      icon: Sparkles,
      tag: t('landing.tag_grounded', 'Grounded Assistant'),
    },
    {
      id: 'product' as ActiveTab,
      title: t('landing.cap_prod_title', 'Analyze'),
      description: t('landing.cap_prod_desc', 'Understand product classification and relevant considerations.'),
      icon: FlaskConical,
      tag: t('landing.tag_ayurvedic', 'Ayurvedic Classification'),
    },
    {
      id: 'ipr' as ActiveTab,
      title: t('landing.cap_ipr_title', 'Navigate'),
      description: t('landing.cap_ipr_desc', 'Explore possible intellectual-property protection pathways.'),
      icon: Compass,
      tag: t('landing.tag_strategy', 'IP Strategy'),
    },
    {
      id: 'research' as ActiveTab,
      title: t('landing.cap_res_title', 'Research'),
      description: t('landing.cap_res_desc', 'Find relevant information from authoritative sources.'),
      icon: BookOpen,
      tag: t('landing.tag_library', 'Statutory Library'),
    },
  ];

  return (
    <div className="w-full px-3 sm:px-5 lg:px-6 py-6 sm:py-8 md:py-10 space-y-8 sm:space-y-12">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto space-y-3 sm:space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs font-medium tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span className="truncate">{t('landing.badge', 'Authoritative AYUSH & Intellectual Property Decision Support')}</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-serif font-semibold text-slate-900 tracking-tight leading-tight">
          {t('landing.hero_title', 'IP-SAKTI Sahayak')}
        </h1>

        <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed max-w-2xl mx-auto">
          {t(
            'landing.hero_subtitle',
            'AI-powered assistance for AYUSH, intellectual property, traditional knowledge and regulatory research.'
          )}
        </p>

        {/* User Session Banner / Login Prompt */}
        {isLoggedIn && currentUser ? (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Welcome, <strong>{currentUser.name}</strong> ({currentUser.role}). All portal tabs are unlocked.</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs">
            <span>Sign in to access Sahayak AI queries, product analyses, and statutory dossiers.</span>
          </div>
        )}

        {/* Primary and Secondary CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {isLoggedIn ? (
            <>
              <button
                type="button"
                id="hero-ask-sahayak-btn"
                onClick={() => handleActionClick('chat')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs sm:text-sm transition-all shadow-2xs flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>{t('landing.btn_ask', 'Open Sahayak AI Assistant')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                id="hero-analyze-product-btn"
                onClick={() => handleActionClick('product')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-medium text-xs sm:text-sm transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <FlaskConical className="w-4 h-4 text-emerald-800" />
                <span>{t('landing.btn_analyze', 'Analyze a Product')}</span>
              </button>

              {onOpenWalkthrough && (
                <button
                  type="button"
                  id="hero-walkthrough-btn"
                  onClick={onOpenWalkthrough}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 font-medium text-xs sm:text-sm transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-emerald-800" />
                  <span>How to Use</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                id="hero-signin-btn"
                onClick={() => setActiveTab('login')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs sm:text-sm transition-all shadow-2xs flex items-center justify-center gap-2 group cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-amber-300" />
                <span>Sign In to Access Tabs</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                id="hero-register-btn"
                onClick={() => setActiveTab('register')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-medium text-xs sm:text-sm transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-emerald-800" />
                <span>Create New Profile</span>
              </button>

              {onOpenWalkthrough && (
                <button
                  type="button"
                  id="hero-walkthrough-btn-guest"
                  onClick={onOpenWalkthrough}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 font-medium text-xs sm:text-sm transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-emerald-800" />
                  <span>How to Use</span>
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* Four Concise Capabilities */}
      <section className="pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {capabilities.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                id={`capability-card-${item.id}`}
                onClick={() => handleActionClick(item.id)}
                className="group relative p-5 rounded-xl transition-all cursor-pointer flex flex-col justify-between bg-emerald-50/30 border border-emerald-300 hover:border-emerald-400 shadow-2xs hover:shadow-xs hover:bg-emerald-50/60"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors mb-3 bg-emerald-100 border border-emerald-300 text-emerald-800 group-hover:bg-emerald-200/80 group-hover:text-emerald-950">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-800 tracking-wider uppercase mb-1">
                    {item.tag}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-1.5 group-hover:text-emerald-950 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-emerald-200/80 flex items-center text-xs font-medium text-emerald-800 group-hover:text-emerald-950 transition-colors">
                  <span>{isLoggedIn ? item.title : 'Sign In to ' + item.title}</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mandatory Disclaimer */}
      <DisclaimerBanner />
    </div>
  );
};
