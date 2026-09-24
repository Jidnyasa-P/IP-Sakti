import React, { useState } from 'react';
import {
  Sparkles,
  FlaskConical,
  Compass,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  LogIn,
  UserPlus,
  CheckCircle2,
  HelpCircle,
  Users,
  Scale,
  Globe2,
  Send,
  Mail,
  FileText,
} from 'lucide-react';
import { ActiveTab } from './Header';
import { DisclaimerBanner } from './DisclaimerBanner';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface LandingViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenWalkthrough?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  setActiveTab,
  onOpenWalkthrough,
}) => {
  const { t } = useTranslation();
  const { currentUser, isLoggedIn } = useAuth();

  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

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

  const handleContactSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}/api/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.get('name'), email: data.get('email'), subject: data.get('subject'), message: data.get('message') }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || 'Could not send your message.');
      setContactSent(true); form.reset();
    } catch (err) { setContactError(err instanceof Error ? err.message : 'Could not send your message.'); }
  };

  return (
    <div className="w-full overflow-hidden">
      {/* Hero */}
      <section className="relative isolate px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 lg:pt-16 pb-14 sm:pb-20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent_32%),radial-gradient(circle_at_15%_45%,rgba(20,184,166,0.10),transparent_28%)]" />
        <div className="absolute top-8 right-[-5rem] -z-10 h-48 w-48 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-900/20" />
        <div className="absolute bottom-0 left-[-4rem] -z-10 h-40 w-40 rounded-full bg-teal-200/30 blur-3xl dark:bg-teal-900/20" />

        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-14 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold tracking-wide shadow-sm dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>{t('landing.badge', 'Authoritative AYUSH & Intellectual Property Decision Support')}</span>
            </div>

            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-serif font-semibold tracking-tight leading-[1.05] text-slate-950 dark:text-white">
              IP-SAKTI <span className="text-emerald-700 dark:text-emerald-400">Sahayak</span>
            </h1>

            <p className="mt-5 max-w-2xl mx-auto lg:mx-0 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              {t(
                'landing.hero_subtitle',
                'AI-powered assistance for AYUSH, intellectual property, traditional knowledge and regulatory research.'
              )}
            </p>

            <p className="mt-4 max-w-xl mx-auto lg:mx-0 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              One place to explore regulations, understand product pathways, research intellectual property and work with authoritative knowledge sources.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3">
              {isLoggedIn ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleActionClick('chat')}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-950 hover:bg-emerald-900 text-white font-semibold text-sm transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 group"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                    <span>Open Sahayak</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleActionClick('product')}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/90 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <FlaskConical className="w-4 h-4 text-emerald-700" />
                    Analyze a Product
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('login')}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-950 hover:bg-emerald-900 text-white font-semibold text-sm transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 group"
                  >
                    <LogIn className="w-4 h-4 text-amber-300" />
                    Sign In
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/90 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4 text-emerald-700" />
                    Create Account
                  </button>
                </>
              )}

              {onOpenWalkthrough && (
                <button
                  type="button"
                  onClick={onOpenWalkthrough}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <HelpCircle className="w-4 h-4" />
                  How to Use
                </button>
              )}
            </div>

            {isLoggedIn && currentUser ? (
              <div className="mt-5 inline-flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                Welcome back, <strong>{currentUser.name}</strong>. Your portal is ready.
              </div>
            ) : (
              <div className="mt-5 inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Scale className="w-4 h-4 text-emerald-700" />
                Decision support grounded in legal and regulatory knowledge sources.
              </div>
            )}
          </div>

          {/* Visual portal summary */}
          <div className="relative max-w-md w-full mx-auto lg:ml-auto">
            <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-emerald-300/30 via-transparent to-teal-300/20 blur-xl" />
            <div className="relative rounded-[2rem] border border-emerald-200/80 dark:border-emerald-800/70 bg-white/85 dark:bg-slate-900/90 backdrop-blur-xl p-5 sm:p-6 shadow-2xl shadow-emerald-900/10">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-emerald-700 dark:text-emerald-400">Sahayak Portal</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Your IP & AYUSH research workspace</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  ['Ask', 'Regulatory and IPR questions', Sparkles],
                  ['Analyze', 'Classify and assess products', FlaskConical],
                  ['Navigate', 'Explore protection pathways', Compass],
                  ['Research', 'Search authoritative sources', BookOpen],
                ].map(([title, desc, Icon]) => {
                  const CapabilityIcon = Icon as React.ElementType;
                  return (
                    <div key={title as string} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                        <CapabilityIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title as string}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{desc as string}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 ml-auto text-slate-400 shrink-0" />
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <Globe2 className="w-3.5 h-3.5 text-emerald-700" />
                India & international jurisdiction-aware research
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 bg-white/70 dark:bg-slate-900/40 border-y border-slate-200/70 dark:border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Explore the platform</p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-serif font-semibold text-slate-950 dark:text-white">Everything you need to move from question to informed action.</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => handleActionClick(item.id)}
                  className="group text-left p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/70 hover:border-emerald-400 dark:hover:border-emerald-600 hover:-translate-y-1 transition-all shadow-sm hover:shadow-lg"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase mb-1">{item.tag}</div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.description}</p>
                  <span className="mt-5 inline-flex items-center text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                    {isLoggedIn ? 'Open module' : 'Sign in to explore'}
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* About Us */}
      <section id="about-us" className="px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-14 items-start">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">About Us</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-serif font-semibold text-slate-950 dark:text-white">Making complex IP & AYUSH information easier to navigate.</h2>
          </div>

          <div className="space-y-5 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              IP-SAKTI Sahayak is a decision-support platform designed for AYUSH innovators, researchers, practitioners, startups and institutions working with intellectual property and regulatory questions.
            </p>
            <p>
              The platform brings together AI-assisted question answering, product analysis, IPR navigation, traditional-knowledge research and statutory information in one workspace. Its goal is to reduce the friction between discovering relevant information and understanding how that information applies to a real-world idea or product.
            </p>
            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <Scale className="w-5 h-5 text-emerald-700 mb-2" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Source-aware</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Designed around authoritative knowledge.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <Globe2 className="w-5 h-5 text-emerald-700 mb-2" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Multilingual</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Built for accessible research across languages.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <FileText className="w-5 h-5 text-emerald-700 mb-2" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Decision support</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Helps users investigate before they act.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact-us" className="px-4 sm:px-6 lg:px-8 py-14 sm:py-20 bg-slate-950 dark:bg-black text-white">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Contact Us</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-serif font-semibold">Have a question or want to work with us?</h2>
            <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed max-w-md">
              Share your query, feedback or collaboration idea. We will use your message to understand what you need from IP-SAKTI Sahayak.
            </p>
          </div>

          <form onSubmit={handleContactSubmit} className="rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-7 text-slate-900 dark:text-white shadow-2xl">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm font-medium">
                Name
                <input required name="name" type="text" placeholder="Your name" className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm outline-none focus:border-emerald-500" />
              </label>
              <label className="text-sm font-medium">
                Email
                <input required name="email" type="email" placeholder="you@example.com" className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm outline-none focus:border-emerald-500" />
              </label>
            </div>

            <label className="block mt-4 text-sm font-medium">
              Subject
              <input required name="subject" type="text" placeholder="How can we help?" className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm outline-none focus:border-emerald-500" />
            </label>

            <label className="block mt-4 text-sm font-medium">
              Message
              <textarea required name="message" rows={5} placeholder="Tell us a little about your question..." className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm outline-none focus:border-emerald-500 resize-y" />
            </label>

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-3 text-sm font-semibold transition-colors">
                <Send className="w-4 h-4" />
                Send Message
              </button>
              {contactSent && (
                <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Confirmation sent to your email.
                </span>
              )}
              {contactError && <span className="text-sm text-rose-700 dark:text-rose-400 font-medium">{contactError}</span>}
            </div>
          </form>
        </div>
      </section>

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <DisclaimerBanner />
        </div>
      </div>
    </div>
  );
};
