import React, { useState } from 'react';
import { Shield, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Language, UserRole, USER_ROLE_OPTIONS } from '../types';

interface RegisterViewProps {
  onSwitchToLogin: () => void;
}

const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
];

export const RegisterView: React.FC<RegisterViewProps> = ({ onSwitchToLogin }) => {
  const { register, authLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<Language>('en');
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(['Practitioner']);
  const [error, setError] = useState<string | null>(null);

  const toggleRole = (role: UserRole) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (selectedRoles.length === 0) {
      setError('Please select at least one profile type.');
      return;
    }

    try {
      await register({ name, email, password, preferred_language: preferredLanguage, roles: selectedRoles });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-16 sm:py-24">
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto flex items-center justify-center mb-4">
          <img src="/ip-sakti-logo.png" alt="IP-SAKTI logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-slate-900">Create your account</h1>
        <p className="text-sm text-slate-500 mt-1">Join IP-SAKTI Sahayak</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 sm:p-8 space-y-5">
        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="register-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Full name
          </label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          />
        </div>

        <div>
          <label htmlFor="register-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Email
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="register-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="register-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Confirm password
            </label>
            <input
              id="register-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Profile type <span className="text-slate-400 font-medium normal-case">(select one or more)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {USER_ROLE_OPTIONS.map(opt => {
              const isChecked = selectedRoles.includes(opt);
              return (
                <label
                  key={opt}
                  htmlFor={`register-role-${opt}`}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                    isChecked
                      ? 'border-emerald-700 bg-emerald-50/60 text-emerald-900'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    id={`register-role-${opt}`}
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleRole(opt)}
                    className="w-3.5 h-3.5 text-emerald-800 rounded-sm focus:ring-emerald-700"
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="register-language" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Preferred language
          </label>
          <select
            id="register-language"
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value as Language)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          >
            {LANGUAGE_OPTIONS.map(opt => (
              <option key={opt.code} value={opt.code}>{opt.label}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          id="register-submit-btn"
          disabled={authLoading}
          className="w-full px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm transition-all shadow-md flex items-center justify-center gap-2"
        >
          {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          <span>{authLoading ? 'Creating account…' : 'Create Account'}</span>
        </button>

        <p className="text-center text-xs text-slate-500 pt-2">
          Already have an account?{' '}
          <button
            type="button"
            id="go-to-login-btn"
            onClick={onSwitchToLogin}
            className="font-semibold text-emerald-800 hover:text-emerald-900 hover:underline"
          >
            Sign in
          </button>
        </p>
      </form>
    </div>
  );
};
