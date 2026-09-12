import React, { useState } from 'react';
import { Shield, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Language, UserRole, USER_ROLE_OPTIONS } from '../../types';

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
  const [profileType, setProfileType] = useState<UserRole>('Practitioner');
  const [error, setError] = useState<string | null>(null);

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

    try {
      await register({ name, email, password, preferred_language: preferredLanguage, role: profileType });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-16 sm:py-24">
      <div className="text-center mb-8">
        <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-emerald-800 to-teal-950 flex items-center justify-center text-amber-300 shadow-md mb-4">
          <Shield className="w-6 h-6" />
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
          <label htmlFor="register-profile-type" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Profile type
          </label>
          <select
            id="register-profile-type"
            value={profileType}
            onChange={(e) => setProfileType(e.target.value as UserRole)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          >
            {USER_ROLE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
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
