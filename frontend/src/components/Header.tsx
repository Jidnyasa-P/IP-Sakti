import React, { useState } from 'react';
import { Shield, BookOpen, Compass, FlaskConical, Sparkles, FolderArchive, Settings, Globe, ChevronDown, Check, UserCircle } from 'lucide-react';
import { Language, User } from '../types';
import { useTranslation } from '../context/LanguageContext';

export type ActiveTab = 'landing' | 'chat' | 'product' | 'ipr' | 'tk' | 'research' | 'workspace' | 'admin' | 'profile';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  user?: User | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  language,
  setLanguage,
  user
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
      <div className="max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Brand: IP-SAKTI Sahayak */}
          <div
            id="brand-logo-btn"
            onClick={() => setActiveTab('landing')}
            className="flex items-center gap-3 cursor-pointer group select-none min-w-0 flex-shrink-0"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-800 to-teal-950 flex items-center justify-center text-amber-300 shadow-md group-hover:scale-105 transition-transform flex-shrink-0">
              <Shield className="w-[1.375rem] h-[1.375rem]" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-serif font-bold text-xl tracking-tight text-slate-900 truncate">
                {t('brand.name', 'IP-SAKTI')}
              </span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300/60 uppercase tracking-wide whitespace-nowrap">
                {t('brand.badge', 'Sahayak')}
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}-btn`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-[1.125rem] h-[1.125rem] ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
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

          {/* Right Utilities: Language Selector, Admin & User Profile */}
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

            {/* User Profile */}
            {user && (
              <button
                type="button"
                id="profile-nav-btn"
                onClick={() => setActiveTab('profile')}
                title={`${user.name} — ${user.role}`}
                className={`flex items-center gap-2 pl-2 sm:pl-2.5 ml-0.5 border-l border-slate-200 transition-colors ${
                  activeTab === 'profile' ? 'text-emerald-800' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCircle className="w-5 h-5" />
                <span className="hidden sm:flex flex-col items-start leading-tight max-w-[130px]">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 truncate max-w-full">
                    {user.name}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium px-2 truncate max-w-full">
                    {user.role}
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="lg:hidden flex items-center justify-between overflow-x-auto py-2.5 border-t border-slate-100 no-scrollbar gap-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
