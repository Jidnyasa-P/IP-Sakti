import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, UserPlus, AlertCircle, CheckCircle2, Scale, FileText, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ActiveTab } from './Header';
import { useTranslation } from '../context/LanguageContext';
import { UserRole, ALL_ROLES, ROLE_DEFINITIONS, ExpertCertificate } from '../types';
import { ExpertCertificateUpload, ExpertCertificateData } from './ExpertCertificateUpload';

interface LoginViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  targetTabAfterLogin?: ActiveTab;
}

export const LoginView: React.FC<LoginViewProps> = ({ setActiveTab, targetTabAfterLogin = 'chat' }) => {
  const { login, isLoading, currentUser } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Practitioner');
  const [expertCertificate, setExpertCertificate] = useState<Partial<ExpertCertificateData> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isExpertSelected = selectedRole === 'Expert';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Mandatory certificate verification for Expert role
    if (isExpertSelected) {
      if (!expertCertificate?.fileName) {
        setError('Mandatory Proof Required: You must upload a verified certificate file (PDF, PNG, JPG) to sign in as an Expert.');
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

    const certPayload: ExpertCertificate | undefined = isExpertSelected && expertCertificate?.fileName
      ? {
          fileName: expertCertificate.fileName,
          fileSize: expertCertificate.fileSize || 428000,
          fileType: expertCertificate.fileType || 'application/pdf',
          fileDataUrl: expertCertificate.fileDataUrl,
          certificateId: expertCertificate.certificateId!.trim(),
          certificateType: expertCertificate.certificateType || 'CGPDTM Registered Patent Agent (Rule 110, Patents Rules 2003)',
          issuingAuthority: expertCertificate.issuingAuthority!.trim(),
          uploadedAt: expertCertificate.uploadedAt || new Date().toISOString(),
          status: 'Verified'
        }
      : undefined;

    const result = await login(email, password, certPayload);
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

  const handleQuickLogin = async (demoEmail: string, role: UserRole) => {
    setEmail(demoEmail);
    setPassword('demo123');
    setSelectedRole(role);
    setError(null);

    if (role === 'Expert') {
      // Pre-populate with Dr. Aarav Sharma's verified CGPDTM Patent Agent certificate
      setExpertCertificate({
        fileName: 'CGPDTM_Patent_Agent_Certificate_IN_PA_3842.pdf',
        fileSize: 428000,
        fileType: 'application/pdf',
        certificateId: 'IN/PA/3842',
        certificateType: 'CGPDTM Registered Patent Agent (Rule 110, Patents Rules 2003)',
        issuingAuthority: 'CGPDTM, Ministry of Commerce and Industry, Govt of India',
        uploadedAt: new Date().toISOString(),
        status: 'Verified'
      });
    } else {
      setExpertCertificate(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 bg-slate-50 transition-colors">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6 transition-colors">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-800 to-teal-950 text-amber-300 mx-auto flex items-center justify-center shadow-xs">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
              Sign In to IP-SAKTI Sahayak
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Access your AYUSH formulation analysis, statutory patent navigators, and TKDL research dossiers
            </p>
          </div>
        </div>

        {/* Current logged in prompt if already logged in */}
        {currentUser && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950">
            <div className="flex items-center gap-2 truncate pr-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="truncate">
                Signed in as <strong>{currentUser.name}</strong> ({currentUser.role})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="text-xs font-semibold text-emerald-800 hover:underline shrink-0 cursor-pointer"
            >
              My Profile
            </button>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Role Selection Tabs */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Sign In Role Identity
            </label>
            <span className="text-[10px] text-slate-500">Select operational profile</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {ALL_ROLES.map(r => {
              const isSelected = selectedRole === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setSelectedRole(r);
                    setError(null);
                    if (r === 'Expert') {
                      if (!email) setEmail('aarav.sharma@ayush-research.in');
                    } else if (r === 'Practitioner') {
                      if (!email || email.includes('aarav')) setEmail('radhika.sen@ayurveda-clinic.in');
                    } else if (r === 'Researcher') {
                      if (!email || email.includes('aarav')) setEmail('v.joshi@bioayush-research.in');
                    }
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                    isSelected
                      ? r === 'Expert'
                        ? 'bg-emerald-800 text-white shadow-xs'
                        : 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span className="block truncate">{r}</span>
                  {r === 'Expert' && (
                    <span className="text-[9px] block text-amber-300 font-normal">Proof req.</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Registered Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@organization.in"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-700">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors"
              />
            </div>
          </div>

          {/* ================= MANDATORY EXPERT CERTIFICATE UPLOAD ================= */}
          {isExpertSelected && (
            <div className="p-4 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border-2 border-emerald-500/40 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-800" />
                  <span className="text-xs font-bold text-emerald-950">
                    Expert Statutory Certificate Proof
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
                  Mandatory
                </span>
              </div>

              <ExpertCertificateUpload
                certificateData={expertCertificate}
                onChange={setExpertCertificate}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In as {selectedRole}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Quick One-Click Demo Role Accounts */}
        <div className="pt-4 border-t border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Quick Role Sign-In (Demo Profiles)
            </span>
            <span className="text-[10px] text-slate-400">One-click test</span>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickLogin('aarav.sharma@ayush-research.in', 'Expert')}
              className="w-full p-2.5 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-300/80 text-left transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <span>⚖️ Dr. Aarav Sharma</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-700 text-white">Expert (Legal Advisor)</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-200 text-amber-950 border border-amber-300">Proof Included</span>
                </div>
                <div className="text-[10px] text-emerald-800 truncate mt-0.5">
                  aarav.sharma@ayush-research.in • Verified Patent Agent IN/PA/3842 attached
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleQuickLogin('radhika.sen@ayurveda-clinic.in', 'Practitioner')}
                className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-left transition-colors cursor-pointer"
              >
                <div className="text-[11px] font-bold text-teal-950 truncate">🌿 Vaidya Radhika</div>
                <div className="text-[10px] text-teal-700 truncate">Practitioner</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('v.joshi@bioayush-research.in', 'Researcher')}
                className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-left transition-colors cursor-pointer"
              >
                <div className="text-[11px] font-bold text-blue-950 truncate">🔬 Dr. Vikramaditya</div>
                <div className="text-[10px] text-blue-700 truncate">Researcher</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('landing')}
            className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
          >
            ← Back to Landing Page
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className="text-emerald-800 font-semibold hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create New Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
};
