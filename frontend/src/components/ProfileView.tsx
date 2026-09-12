import React from 'react';
import { UserCircle, Mail, ShieldCheck, Globe2, CalendarDays, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ActiveTab } from './Header';

interface ProfileViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  hi: 'हिन्दी (Hindi)',
  mr: 'मराठी (Marathi)',
};

export const ProfileView: React.FC<ProfileViewProps> = ({ setActiveTab }) => {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    setActiveTab('landing');
  };

  const formattedCreatedAt = (() => {
    try {
      return new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return user.created_at;
    }
  })();

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-xs font-semibold">
          <UserCircle className="w-3.5 h-3.5 text-emerald-700" />
          <span>My Profile</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-slate-900">Account Details</h1>
        <p className="text-sm text-slate-600">Your IP-SAKTI Sahayak account information.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Profile header strip */}
        <div className="p-6 sm:p-8 bg-gradient-to-br from-emerald-800 to-teal-950 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 flex-shrink-0">
            <span className="text-2xl font-serif font-bold">
              {user.name.trim().charAt(0).toUpperCase() || '?'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user.name}</h2>
            <p className="text-emerald-100 text-sm">{user.email}</p>
          </div>
        </div>

        {/* Details grid */}
        <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 flex-shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Email</div>
              <div className="text-sm font-medium text-slate-900 break-all">{user.email}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Role</div>
              <div className="text-sm font-medium text-slate-900">{user.role}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 flex-shrink-0">
              <Globe2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Preferred Language</div>
              <div className="text-sm font-medium text-slate-900">
                {LANGUAGE_LABELS[user.preferred_language] || user.preferred_language}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 flex-shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Member Since</div>
              <div className="text-sm font-medium text-slate-900">{formattedCreatedAt}</div>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-6 sm:pb-8">
          <button
            type="button"
            id="profile-logout-btn"
            onClick={handleLogout}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white hover:bg-red-50 text-red-700 border border-red-200 font-medium text-sm transition-all shadow-xs flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Account data is currently stored locally in this browser (dummy authentication) and will be
        migrated to the backend once live authentication is available.
      </p>
    </div>
  );
};
