import React, { useState } from 'react';
import { UserCircle, Mail, ShieldCheck, Globe2, CalendarDays, LogOut, ChevronDown, PlusCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ActiveTab } from './Header';
import { ALL_ROLE_OPTIONS, UserRole } from '../types';

interface ProfileViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  hi: 'हिन्दी (Hindi)',
  mr: 'मराठी (Marathi)',
};

export const ProfileView: React.FC<ProfileViewProps> = ({ setActiveTab }) => {
  const { user, logout, setActiveRole, addRole } = useAuth();
  const [addRoleSelection, setAddRoleSelection] = useState<UserRole | ''>('');
  const [addRoleError, setAddRoleError] = useState<string | null>(null);
  const [addingRole, setAddingRole] = useState(false);

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    setActiveTab('landing');
  };

  const handleActiveRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as UserRole;
    try {
      await setActiveRole(newRole);
    } catch (err) {
      // safe no-op fallback; existing role remains unchanged in dummy storage
      console.error('Failed to switch active role:', err);
    }
  };

  const availableRolesToAdd = ALL_ROLE_OPTIONS.filter(r => !user.roles.includes(r));

  const handleAddRole = async () => {
    if (!addRoleSelection) return;
    setAddRoleError(null);
    setAddingRole(true);
    try {
      await addRole(addRoleSelection);
      setAddRoleSelection('');
    } catch (err) {
      setAddRoleError(err instanceof Error ? err.message : 'Could not add this role. Please try again.');
    } finally {
      setAddingRole(false);
    }
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
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
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
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Active Role</div>
              {user.roles.length > 1 ? (
                <div className="relative mt-0.5">
                  <select
                    id="profile-active-role-select"
                    value={user.role}
                    onChange={handleActiveRoleChange}
                    className="appearance-none w-full pl-0 pr-6 py-0.5 text-sm font-medium text-slate-900 bg-transparent border-b border-slate-300 focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    {user.roles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 top-1 pointer-events-none" />
                </div>
              ) : (
                <div className="text-sm font-medium text-slate-900">{user.role}</div>
              )}
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

        {/* Roles Management */}
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-2 border-t border-slate-100 space-y-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Your Roles</div>

          <div className="flex flex-wrap gap-2">
            {user.roles.map(r => (
              <span
                key={r}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  r === user.role
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                {r}
              </span>
            ))}
          </div>

          {availableRolesToAdd.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
              <select
                id="profile-add-role-select"
                value={addRoleSelection}
                onChange={(e) => { setAddRoleSelection(e.target.value as UserRole); setAddRoleError(null); }}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              >
                <option value="">Select a role to add…</option>
                {availableRolesToAdd.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button
                type="button"
                id="profile-add-role-btn"
                onClick={handleAddRole}
                disabled={!addRoleSelection || addingRole}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5 text-amber-300" />
                <span>{addingRole ? 'Adding…' : 'Add Role'}</span>
              </button>
            </div>
          )}

          {addRoleError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{addRoleError}</span>
            </div>
          )}
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
