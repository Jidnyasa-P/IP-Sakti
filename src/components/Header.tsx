import React, { useState } from 'react';
import { Shield, BookOpen, Compass, FlaskConical, Sparkles, FolderArchive, Settings, Globe, ChevronDown, Check } from 'lucide-react';
import { Language, UserRole } from '../types';
import { useTranslation } from '../context/LanguageContext';

export type ActiveTab = 'landing' | 'chat' | 'product' | 'ipr' | 'tk' | 'research' | 'workspace' | 'admin';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  userRole?: UserRole;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  language,
  setLanguage,
  userRole = 'EXPERT'
}) => {
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const { t } = useTranslation();

  const navItems = [
    { id: 'chat' as ActiveTab, label: t('nav.chat', 'Sahayak'), icon: Sparkles, badge: 'AI' },
    { id: 'product' as ActiveTab, label: t('nav.product', 'Product Analyzer'), icon: FlaskConical },
    { id: 'ipr' as ActiveTab, label: t('nav.ipr', 'IPR Navigator'), icon: Compass },
    { id: 'tk' as ActiveTab, label: t('nav.tk', 'TK & ABS'), icon: Shield },
    { id: 'research' as ActiveTab, label: t('nav.research', 'Research'), icon: BookOpen },
    { id: 'workspace' as ActiveTab, label: t('nav.workspace', 'My Workspace'), icon: FolderArchive },
  ];

  const languages: { code: Language; label: string; native: string }[] = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
    { code: 'mr', label: 'Marathi', native: 'मराठी' },
  ];

  const currentLang = languages.find(l => l.code === language) || languages[0];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="w-full max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            id="brand-logo-btn"
            onClick={() => setActiveTab('landing')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-800 to-teal-950 flex items-center justify-center text-amber-300 shadow-md group-hover:scale-105 transition-transform">
              {/* Subtle AYUSH & IP Emblem */}
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-bold text-lg tracking-tight text-slate-900">
                  {t('brand.name', 'IP-SAKTI')}
                </span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300/60 uppercase tracking-wide">
                  {t('brand.badge', 'Sahayak')}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}-btn`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] px-1 rounded font-semibold ${isActive ? 'bg-slate-800 text-amber-200' : 'bg-slate-100 text-slate-600'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Utilities: Language Selector, Admin & User Role */}
          <div className="flex items-center gap-2.5">
            {/* Language Switcher */}
            <div className="relative">
              <button
                type="button"
                id="language-selector-btn"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  language !== 'en'
                    ? 'border-emerald-300 bg-emerald-50/70 text-emerald-900 font-semibold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Globe className={`w-3.5 h-3.5 ${language !== 'en' ? 'text-emerald-700' : 'text-slate-500'}`} />
                <span>{currentLang.native}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
                  <div className="px-3 py-1 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Select Language / भाषा
                  </div>
                  {languages.map(l => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setLanguage(l.code);
                        setLangDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                        language === l.code
                          ? 'bg-emerald-50 text-emerald-900 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700 font-medium'
                      }`}
                    >
                      <span>
                        {l.native} <span className="text-slate-400 text-[10px]">({l.label})</span>
                      </span>
                      {language === l.code && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Admin button */}
            <button
              type="button"
              id="admin-nav-btn"
              onClick={() => setActiveTab('admin')}
              title={t('nav.admin', 'Admin & Telemetry')}
              className={`p-2 rounded-lg transition-colors border ${
                activeTab === 'admin'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* User Role Badge */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                {t('nav.role_expert', userRole)}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="lg:hidden flex items-center justify-between overflow-x-auto py-2 border-t border-slate-100 no-scrollbar gap-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
