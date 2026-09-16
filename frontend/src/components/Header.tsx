import React, { useState } from 'react';
import {
  Shield,
  BookOpen,
  Compass,
  FlaskConical,
  Sparkles,
  FolderArchive,
  Settings,
  Globe,
  ChevronDown,
  Check,
  Menu,
  X,
  Home,
  User as UserIcon,
  LogIn,
  LogOut,
  Scale,
  Search,
  Sun,
  Moon,
  HelpCircle
} from 'lucide-react';
import { Language, UserRole, normalizeRole, SUPPORTED_LANGUAGES, LANGUAGES_MAP } from '../types';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useExpertAdvisory } from '../context/ExpertAdvisoryContext';
import { useTheme } from '../context/ThemeContext';

export type ActiveTab = 'landing' | 'chat' | 'product' | 'ipr' | 'tk' | 'research' | 'workspace' | 'admin' | 'login' | 'register' | 'profile' | 'expert';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  userRole?: UserRole;
  onOpenWalkthrough?: () => void;
  isTourActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  language,
  setLanguage,
  userRole = 'EXPERT',
  onOpenWalkthrough,
  isTourActive = false
}) => {
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [langSearchTerm, setLangSearchTerm] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTranslation();
  const { currentUser, isLoggedIn, logout } = useAuth();
  const { pendingCount } = useExpertAdvisory();
  const { theme, toggleTheme, isDark } = useTheme();

  // Normalize role check for Expert
  const isExpert = isLoggedIn && currentUser && normalizeRole(currentUser.role) === 'Expert';

  const standardNavItems = [
    { id: 'chat' as ActiveTab, label: t('nav.chat', 'Sahayak'), icon: Sparkles, badge: 'AI' },
    { id: 'product' as ActiveTab, label: t('nav.product', 'Product Analyzer'), icon: FlaskConical },
    { id: 'ipr' as ActiveTab, label: t('nav.ipr', 'IPR Navigator'), icon: Compass },
    { id: 'tk' as ActiveTab, label: t('nav.tk', 'TK & ABS'), icon: Shield },
    { id: 'research' as ActiveTab, label: t('nav.research', 'Research'), icon: BookOpen },
    { id: 'workspace' as ActiveTab, label: t('nav.workspace', 'My Workspace'), icon: FolderArchive },
  ];

  const expertNavItems = [
    {
      id: 'expert' as ActiveTab,
      label: 'Low-Confidence Legal Queries',
      icon: Scale,
      badge: pendingCount > 0 ? `${pendingCount} Flagged` : undefined
    }
  ];

  // Restrict navigation: Expert role ONLY sees the low-confidence query advisory queue
  const navItems = isExpert ? expertNavItems : standardNavItems;

  const currentLang = LANGUAGES_MAP[language] || SUPPORTED_LANGUAGES[0];

  const filteredLanguages = SUPPORTED_LANGUAGES.filter(l => {
    if (!langSearchTerm.trim()) return true;
    const term = langSearchTerm.toLowerCase();
    return (
      l.label.toLowerCase().includes(term) ||
      l.native.toLowerCase().includes(term) ||
      l.code.toLowerCase().includes(term)
    );
  });

  const handleNavClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Primary Top Header */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs transition-all">
        <div className="w-full px-3 sm:px-4 lg:px-4 xl:px-6">
          <div className="flex flex-wrap items-center justify-between min-h-[3.5rem] sm:min-h-[4rem] h-auto py-1 sm:py-1.5 gap-y-1.5 gap-x-2">
            {/* Logo & Brand */}
            <div
              id="brand-logo-btn"
              onClick={() => handleNavClick(isExpert ? 'expert' : 'landing')}
              className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group select-none min-w-0 shrink-0 order-1"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 min-w-[2rem] sm:min-w-[2.25rem] aspect-square rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-800 to-teal-950 flex items-center justify-center text-amber-300 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              </div>
              <div className="min-w-0 flex items-center">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-serif font-semibold text-base sm:text-lg xl:text-xl tracking-tight text-slate-900 leading-none whitespace-nowrap">
                    {t('brand.name', 'IP-SAKTI')}
                  </span>
                  <span className="hidden xl:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase tracking-wider shrink-0 whitespace-nowrap leading-tight">
                    {isExpert ? 'Legal Advisor Console' : t('brand.badge', 'Sahayak')}
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            {(isLoggedIn || isTourActive) && (
              <nav className="hidden lg:flex flex-wrap items-center justify-center gap-1 xl:gap-1.5 order-3 2xl:order-2 w-full 2xl:w-auto mt-0.5 2xl:mt-0 pt-1.5 2xl:pt-0 border-t 2xl:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`nav-${item.id}-btn`}
                      onClick={() => handleNavClick(item.id)}
                      className={`flex items-center gap-1 xl:gap-1.5 px-2 xl:px-2.5 2xl:px-3 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-medium transition-all shrink-0 ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
                      <span className="whitespace-nowrap">{item.label}</span>
                      {item.badge && (
                        <span className={`hidden xl:inline-block text-[10px] px-1.5 py-0.2 rounded font-medium uppercase tracking-wider ${isActive ? 'bg-slate-800 text-amber-200 border border-amber-400/30' : 'bg-emerald-100 text-emerald-800'}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            )}

            {/* Right Utilities: Language, Admin, Role Badge & Mobile Menu Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 order-2 2xl:order-3">
              {/* Language Switcher */}
              <div className="relative">
                <button
                  type="button"
                  id="language-selector-btn"
                  onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 xl:px-3 xl:py-1.5 rounded-lg border text-xs font-medium transition-all shrink-0 ${
                    language !== 'en'
                      ? 'border-emerald-300 bg-emerald-50/80 text-emerald-900 font-semibold shadow-2xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                  title="Switch Language / भाषा बदलें"
                >
                  <Globe className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${language !== 'en' ? 'text-emerald-700' : 'text-slate-500'}`} />
                  <span className="font-semibold hidden xl:inline">{currentLang.native}</span>
                  <span className="font-semibold inline xl:hidden uppercase">{currentLang.code}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden xl:inline-block shrink-0" />
                </button>

                {langDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-1">
                    <div className="px-3 pb-2 border-b border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        22 Eighth Schedule Languages / भाषा
                      </div>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={langSearchTerm}
                          onChange={e => setLangSearchTerm(e.target.value)}
                          placeholder="Search language / भाषा खोजें..."
                          className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 p-1">
                      {filteredLanguages.map(l => (
                        <button
                          key={l.code}
                          type="button"
                          onClick={() => {
                            setLanguage(l.code);
                            setLangDropdownOpen(false);
                            setLangSearchTerm('');
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left rounded-lg transition-colors cursor-pointer ${
                            language === l.code
                              ? 'bg-emerald-50 text-emerald-950 font-semibold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm leading-tight">{l.native}</span>
                            <span className="text-[11px] text-slate-500">{l.label}</span>
                          </div>
                          {language === l.code && <Check className="w-4 h-4 text-emerald-700 shrink-0" />}
                        </button>
                      ))}
                      {filteredLanguages.length === 0 && (
                        <div className="p-3 text-center text-xs text-slate-400">
                          No language found matching "{langSearchTerm}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Working Dark / Light Mode Toggle */}
              <button
                type="button"
                id="theme-toggle-btn"
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDark ? 'Switch to Light Mode / लाइट मोड चालू करें' : 'Switch to Dark Mode / डार्क मोड चालू करें'}
                className={`flex items-center gap-1.5 px-2 py-1.5 xl:px-2.5 xl:py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer shadow-2xs select-none shrink-0 ${
                  isDark
                    ? 'border-amber-400/40 bg-slate-800 text-amber-300 hover:bg-slate-750 hover:border-amber-400 focus:ring-2 focus:ring-amber-400/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-300 focus:ring-2 focus:ring-emerald-600/30'
                }`}
              >
                {isDark ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400 shrink-0 transition-transform duration-300 hover:rotate-45" />
                    <span className="hidden 2xl:inline font-semibold">Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-slate-600 shrink-0 transition-transform duration-300 hover:-rotate-12" />
                    <span className="hidden 2xl:inline font-semibold">Dark</span>
                  </>
                )}
              </button>

              {/* How to Use / Walkthrough Button (Desktop/Tablet) */}
              {onOpenWalkthrough && (
                <button
                  type="button"
                  id="header-walkthrough-btn"
                  onClick={onOpenWalkthrough}
                  title="How to Use IP-SAKTI Sahayak / उपयोग मार्गदर्शिका"
                  className="flex items-center gap-1.5 px-2 py-1.5 xl:px-2.5 xl:py-1.5 rounded-lg border border-emerald-300/80 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-950 font-medium text-xs transition-all cursor-pointer shadow-2xs shrink-0 select-none"
                >
                  <HelpCircle className="w-4 h-4 text-emerald-800 shrink-0" />
                  <span className="hidden xl:inline font-semibold whitespace-nowrap">How to Use</span>
                </button>
              )}

              {/* Admin Button (Desktop/Tablet) - Hidden for Expert */}
              {isLoggedIn && !isExpert && currentUser?.role === 'ADMIN' && (
                <button
                  type="button"
                  id="admin-nav-btn"
                  onClick={() => handleNavClick('admin')}
                  title={t('nav.admin', 'Admin & Telemetry')}
                  className={`p-1.5 xl:p-2 rounded-xl transition-colors border shrink-0 ${
                    activeTab === 'admin'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <Settings className="w-4 h-4 xl:w-4.5 xl:h-4.5" />
                </button>
              )}

              {/* User Profile / Auth Button (Desktop) */}
              {isLoggedIn && currentUser ? (
                <div className="hidden md:flex items-center gap-1.5 pl-1.5 xl:pl-2 border-l border-slate-200 shrink-0">
                  <button
                    type="button"
                    id="user-profile-header-btn"
                    onClick={() => handleNavClick('profile')}
                    className={`flex items-center gap-1.5 xl:gap-2 px-2 xl:px-2.5 py-1.5 rounded-xl border transition-all shrink-0 ${
                      activeTab === 'profile'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold ring-1 ring-emerald-700 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                    title="View Account Profile"
                  >
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-800 to-teal-950 text-amber-300 flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
                      {currentUser.photo_url ? (
                        <img src={currentUser.photo_url} alt={currentUser.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{currentUser.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="text-left text-xs leading-tight min-w-0">
                      <div className="font-semibold text-slate-900 truncate max-w-[65px] lg:max-w-[85px] xl:max-w-[110px]">
                        {currentUser.name}
                      </div>
                    </div>
                    <span className="hidden 2xl:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 shrink-0">
                      {normalizeRole(currentUser.role)}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-1.5 xl:gap-2 pl-1.5 xl:pl-2 border-l border-slate-200 shrink-0">
                  <button
                    type="button"
                    id="header-login-btn"
                    onClick={() => handleNavClick('login')}
                    className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0 ${
                      activeTab === 'login'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                  <button
                    type="button"
                    id="header-register-btn"
                    onClick={() => handleNavClick('register')}
                    className={`flex items-center gap-1 px-2.5 xl:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0 ${
                      activeTab === 'register'
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-2xs'
                        : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <span>Register</span>
                  </button>
                </div>
              )}

              {/* Prominent Mobile Hamburger Menu Button (Guaranteed visible on mobile and compact screens) */}
              <button
                type="button"
                id="mobile-menu-toggle-btn"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 sm:p-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center justify-center shadow-xs shrink-0"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Out Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div
            id="mobile-nav-drawer"
            className="fixed inset-y-0 right-0 w-[85%] max-w-xs sm:max-w-sm bg-white shadow-2xl z-50 flex flex-col p-4 sm:p-5 overflow-y-auto animate-in slide-in-from-right duration-200"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 min-w-[2rem] aspect-square rounded-lg bg-emerald-800 text-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
                  <Shield className="w-4.5 h-4.5 shrink-0" />
                </div>
                <div className="flex items-center">
                  <span className="font-serif font-bold text-lg text-slate-900 leading-none">
                    IP-SAKTI
                  </span>
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                    Sahayak
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Card in Drawer */}
            <div className="py-3 border-b border-slate-200">
              {isLoggedIn && currentUser ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div
                    onClick={() => handleNavClick('profile')}
                    className="flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-800 to-teal-950 text-amber-300 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                        {currentUser.photo_url ? (
                          <img src={currentUser.photo_url} alt={currentUser.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{currentUser.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 group-hover:text-emerald-900 truncate">
                          {currentUser.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {currentUser.email}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200 shrink-0">
                      {normalizeRole(currentUser.role)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 text-xs">
                    <button
                      type="button"
                      onClick={() => handleNavClick('profile')}
                      className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium text-center"
                    >
                      My Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        handleNavClick('landing');
                      }}
                      className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-rose-700 font-medium flex items-center gap-1"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleNavClick('login')}
                      className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('register')}
                      className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold text-center"
                    >
                      Register
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 text-center">
                    Sign in to unlock Sahayak AI and research tools
                  </p>
                </div>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="py-4 space-y-1.5 flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
                {isExpert ? 'Legal Advisor Navigation' : 'Navigation Modules'}
              </div>

              {/* Home - Hidden for Expert */}
              {!isExpert && (
                <button
                  type="button"
                  onClick={() => handleNavClick('landing')}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    activeTab === 'landing'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Home className="w-5 h-5" />
                  <span>Overview & Portal Home</span>
                </button>
              )}

              {/* How to Use Walkthrough Option */}
              {onOpenWalkthrough && (
                <button
                  type="button"
                  id="drawer-walkthrough-btn"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenWalkthrough();
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold text-emerald-950 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-emerald-700" />
                    <span>How to Use / Guide</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-emerald-200/70 text-emerald-900">
                    Walkthrough
                  </span>
                </button>
              )}

              {isLoggedIn ? (
                <>
                  {navItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors ${
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-5 h-5 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                            isActive ? 'bg-slate-800 text-amber-200' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {!isExpert && currentUser?.role === 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => handleNavClick('admin')}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors ${
                        activeTab === 'admin'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Settings className="w-5 h-5" />
                      <span>Admin & System Telemetry</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mt-2">
                  <div className="text-xs font-semibold text-slate-700">
                    Locked Research Modules
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    AI Assistant, Product Analyzer, IPR Navigator, TKDL & Dossier Workspace require sign in.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleNavClick('login')}
                    className="w-full py-2 px-3 bg-slate-900 text-white rounded-lg text-xs font-semibold text-center"
                  >
                    Sign In to Unlock
                  </button>
                </div>
              )}
            </div>

            {/* Language Switcher in Drawer */}
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select Language / भाषा
                </div>
                <span className="text-[10px] text-emerald-800 font-semibold">22 Languages</span>
              </div>
              <div className="max-h-56 overflow-y-auto grid grid-cols-2 gap-2 pr-1">
                {SUPPORTED_LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLanguage(l.code);
                      setMobileMenuOpen(false);
                    }}
                    className={`py-2 px-2.5 rounded-lg text-left border transition-all ${
                      language === l.code
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-semibold text-xs leading-tight">{l.native}</div>
                    <div className={`text-[10px] ${language === l.code ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {l.label}
                    </div>
                  </button>
                ))}
              </div>

              {/* Theme Toggle in Mobile Drawer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  {isDark ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-slate-600" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {isDark ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>
                <button
                  type="button"
                  id="drawer-theme-toggle-btn"
                  onClick={toggleTheme}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isDark
                      ? 'bg-slate-800 border-amber-400/40 text-amber-300 hover:bg-slate-700'
                      : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  {isDark ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>Light Mode</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-slate-600" />
                      <span>Dark Mode</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Account Status:</span>
                <span className="font-semibold text-emerald-800">{userRole} ACCESS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Mobile Bottom Navigation Bar (Guarantees instant 1-tap navigation on all mobile phones) */}
      <nav
        id="mobile-bottom-nav"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1 px-1 sm:px-2 flex justify-around items-center shadow-lg"
        aria-label="Mobile Bottom Navigation"
      >
        <button
          type="button"
          onClick={() => handleNavClick('landing')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-colors ${
            activeTab === 'landing' ? 'text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className="w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0" />
          <span className="text-[10px] mt-0.5 truncate w-full text-center">Home</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('chat')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-colors ${
            activeTab === 'chat' ? 'text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0" />
          <span className="text-[10px] mt-0.5 truncate w-full text-center">Sahayak</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('product')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-colors ${
            activeTab === 'product' ? 'text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FlaskConical className="w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0" />
          <span className="text-[10px] mt-0.5 truncate w-full text-center">Analyzer</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('ipr')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-colors ${
            activeTab === 'ipr' ? 'text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Compass className="w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0" />
          <span className="text-[10px] mt-0.5 truncate w-full text-center">IPR</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('tk')}
          className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-colors ${
            activeTab === 'tk' ? 'text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0" />
          <span className="text-[10px] mt-0.5 truncate w-full text-center">TK & ABS</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-lg text-slate-500 hover:text-slate-800"
          aria-label="More navigation options"
        >
          <Menu className="w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0" />
          <span className="text-[10px] mt-0.5 truncate w-full text-center">More</span>
        </button>
      </nav>
    </>
  );
};
