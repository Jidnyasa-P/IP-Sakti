import React from 'react';
import { Sparkles, FlaskConical, Compass, BookOpen, ArrowRight, ShieldCheck, Scale, FileText } from 'lucide-react';
import { ActiveTab } from './Header';
import { DisclaimerBanner } from './DisclaimerBanner';
import { useTranslation } from '../context/LanguageContext';

interface LandingViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ setActiveTab }) => {
  const { t } = useTranslation();

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
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-12">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs font-semibold tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          <span>{t('landing.badge', 'Authoritative AYUSH & Intellectual Property Decision Support')}</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-slate-900 tracking-tight leading-tight">
          {t('landing.hero_title', 'IP-SAKTI Sahayak')}
        </h1>

        <p className="text-lg sm:text-xl text-slate-600 font-normal leading-relaxed max-w-2xl mx-auto">
          {t(
            'landing.hero_subtitle',
            'AI-powered assistance for AYUSH, intellectual property, traditional knowledge and regulatory research.'
          )}
        </p>

        {/* Primary and Secondary CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            type="button"
            id="hero-ask-sahayak-btn"
            onClick={() => setActiveTab('chat')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
          >
            <span>{t('landing.btn_ask', 'Ask Sahayak')}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            type="button"
            id="hero-analyze-product-btn"
            onClick={() => setActiveTab('product')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-medium text-sm transition-all shadow-xs hover:shadow flex items-center justify-center gap-2"
          >
            <FlaskConical className="w-4 h-4 text-emerald-800" />
            <span>{t('landing.btn_analyze', 'Analyze a Product')}</span>
          </button>
        </div>
      </section>

      {/* Four Concise Capabilities */}
      <section className="pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {capabilities.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                id={`capability-card-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className="group relative p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-800 group-hover:bg-emerald-50 group-hover:text-emerald-800 group-hover:border-emerald-200/60 transition-colors mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-800 tracking-wider uppercase mb-1">
                    {item.tag}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-emerald-950 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center text-xs font-semibold text-slate-800 group-hover:text-emerald-800 transition-colors">
                  <span>{item.title}</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust & Authority Overview */}
      <section className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-xs">
            <Scale className="w-5 h-5 text-emerald-800" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              {t('landing.framework_title', 'Statutory Decision Support Framework')}
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              {t('landing.framework_subtitle', 'Comprehensive retrieval across Acts, Rules, Guidelines, and Official Compendia.')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('research')}
          className="text-xs font-medium px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shadow-xs flex items-center gap-1.5 whitespace-nowrap"
        >
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          <span>{t('landing.cap_res_title', 'Research')}</span>
        </button>
      </section>

      {/* Mandatory Disclaimer */}
      <DisclaimerBanner />
    </div>
  );
};
