import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Scale,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ActiveTab } from './Header';
import { UserRole, ALL_ROLES, ExpertCertificate } from '../types';
import { ExpertCertificateUpload, ExpertCertificateData } from './ExpertCertificateUpload';

interface LoginViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  targetTabAfterLogin?: ActiveTab;
}

export const LoginView: React.FC<LoginViewProps> = ({
  setActiveTab,
  targetTabAfterLogin = 'chat',
}) => {
  const { login, isLoading, currentUser, requestForgotPassword, forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [selectedRole, setSelectedRole] = useState<UserRole>('Practitioner');
  const [expertCertificate, setExpertCertificate] =
    useState<Partial<ExpertCertificateData> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotPasswordValue, setForgotPasswordValue] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isExpertSelected = selectedRole === 'Expert';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setError('Please enter your email address and password.');
      return;
    }

    if (isExpertSelected) {
      if (!expertCertificate?.fileName) {
        setError(
          'Mandatory Proof Required: You must upload a verified certificate file (PDF, PNG, JPG) to sign in as an Expert.'
        );
        return;
      }
      if (!expertCertificate?.certificateId?.trim()) {
        setError('Mandatory Proof Required: Registration / Certificate Number is required.');
        return;
      }
      if (!expertCertificate?.issuingAuthority?.trim()) {
        setError('Mandatory Proof Required: Issuing Statutory Authority is required.');
        return;
      }
    }

    const certPayload: ExpertCertificate | undefined =
      isExpertSelected && expertCertificate?.fileName
        ? {
            fileName: expertCertificate.fileName,
            fileSize: expertCertificate.fileSize || 428000,
            fileType: expertCertificate.fileType || 'application/pdf',
            fileDataUrl: expertCertificate.fileDataUrl,
            certificateId: expertCertificate.certificateId!.trim(),
            certificateType:
              expertCertificate.certificateType ||
              'CGPDTM Registered Patent Agent (Rule 110, Patents Rules 2003)',
            issuingAuthority: expertCertificate.issuingAuthority!.trim(),
            uploadedAt: expertCertificate.uploadedAt || new Date().toISOString(),
            status: 'Verified',
          }
        : undefined;

    const result = await login(email, password, certPayload, rememberMe);

    if (result.success) {
      const userRole = result.user?.role;
      if (userRole === 'Expert' || userRole === 'EXPERT' || isExpertSelected) {
        setActiveTab('expert');
      } else {
        setActiveTab(targetTabAfterLogin || 'chat');
      }
    } else {
      setError(result.error || 'Failed to authenticate. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center">
            <img src="/ip-sakti-logo.png" alt="IP-SAKTI logo" className="h-full w-full object-contain" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
            IP-SAKTI Sahayak
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">
            Sign in to your account
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Continue to your IP and regulatory workspace.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          {currentUser && (
            <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-950">
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                <span className="truncate">
                  Signed in as <strong>{currentUser.name}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="shrink-0 font-semibold text-emerald-800 hover:underline"
              >
                Profile
              </button>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-emerald-900">
              {successMessage}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {forgotMode ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Forgot password</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">Use the OTP sent to your registered email to set a new password.</p>
              </div>

              {forgotMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-emerald-900">{forgotMessage}</div>}
              {error && <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" /><span>{error}</span></div>}

              <div>
                <label htmlFor="forgot-email" className="mb-1.5 block text-xs font-semibold text-slate-700">Email address</label>
                <div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="forgot-email" type="email" required autoComplete="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@organization.in" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10" /></div>
              </div>

              {forgotStep === 'reset' && (<>
                <div>
                  <label htmlFor="forgot-otp" className="mb-1.5 block text-xs font-semibold text-slate-700">Verification code</label>
                  <input id="forgot-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={forgotOtp} onChange={e => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter 6-digit OTP" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm tracking-[0.3em] text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label htmlFor="forgot-new-password" className="mb-1.5 block text-xs font-semibold text-slate-700">New password</label><input id="forgot-new-password" type="password" value={forgotPasswordValue} onChange={e => setForgotPasswordValue(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10" /></div>
                  <div><label htmlFor="forgot-confirm-password" className="mb-1.5 block text-xs font-semibold text-slate-700">Confirm password</label><input id="forgot-confirm-password" type="password" value={forgotConfirmPassword} onChange={e => setForgotConfirmPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10" /></div>
                </div>
              </>)}

              {forgotStep === 'request' ? (
                <button type="button" disabled={isLoading || !forgotEmail.trim()} onClick={async () => { setError(null); setForgotMessage(null); const result = await requestForgotPassword(forgotEmail.trim()); if (result.success) { setForgotStep('reset'); setForgotMessage('If the account exists, a 6-digit verification code has been sent to your email.'); } else setError(result.error || 'Could not start password reset.'); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60">{isLoading ? 'Sending verification code…' : 'Send verification code'}</button>
              ) : (
                <button type="button" disabled={isLoading || forgotOtp.length !== 6 || !forgotPasswordValue || forgotPasswordValue !== forgotConfirmPassword} onClick={async () => { setError(null); const result = await forgotPassword(forgotEmail.trim(), forgotOtp, forgotPasswordValue); if (result.success) { setForgotMode(false); setForgotStep('request'); setForgotOtp(''); setForgotPasswordValue(''); setForgotConfirmPassword(''); setForgotMessage(null); setSuccessMessage('Password reset successfully. Please sign in with your new password.'); setError(null); } else setError(result.error || 'Could not reset your password.'); }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60">Reset password</button>
              )}

              <div className="text-center pt-1"><button type="button" onClick={() => { setForgotMode(false); setForgotStep('request'); setForgotMessage(null); setError(null); setSuccessMessage(null); }} className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400">Back to sign in</button></div>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@organization.in"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Profile
                </label>
                <span className="text-[11px] text-slate-400">
                  Select only if applicable
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ALL_ROLES.map(role => {
                  const selected = selectedRole === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setSelectedRole(role);
                        setError(null);
                        if (role !== 'Expert') setExpertCertificate(null);
                      }}
                      className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition ${
                        selected
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>

            {isExpertSelected && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2.5">
                  <Scale className="h-4 w-4 text-emerald-800" />
                  <span className="text-xs font-semibold text-slate-800">
                    Expert certificate
                  </span>
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                    Required
                  </span>
                </div>
                <ExpertCertificateUpload
                  certificateData={expertCertificate}
                  onChange={setExpertCertificate}
                />
              </div>
            )}

            <button type="button" onClick={() => { setForgotMode(true); setForgotEmail(email); setError(null); setSuccessMessage(null); setForgotMessage(null); }} className="-mb-2 inline-flex w-fit items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-700/15">Forgot password?</button>

            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
              />
              <span>Remember me on this device</span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              <span>{isLoading ? 'Signing in…' : 'Sign in'}</span>
            </button>
          </form>
          )}

          <div className="mt-5 border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
            New to IP-SAKTI Sahayak?{' '}
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className="font-semibold text-emerald-800 hover:underline"
            >
              Create an account
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('landing')}
          className="mt-4 flex w-full items-center justify-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          ← Back to landing page
        </button>
      </div>
    </div>
  );
};
