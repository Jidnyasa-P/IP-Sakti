import React, { useState, useRef, useEffect } from 'react';
import { Shield, Lock, Mail, User as UserIcon, ArrowRight, LogIn, AlertCircle, Check, ChevronDown, X, Scale } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ActiveTab } from './Header';
import { Language, UserRole, ALL_ROLES, ROLE_DEFINITIONS, SUPPORTED_LANGUAGES, LANGUAGES_MAP, ExpertCertificate } from '../types';
import { ExpertCertificateUpload, ExpertCertificateData } from './ExpertCertificateUpload';

interface RegisterViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ setActiveTab }) => {
  const { register, isLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(['Practitioner']);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<Language>('en');
  const [expertCertificate, setExpertCertificate] = useState<Partial<ExpertCertificateData> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isExpertSelected = selectedRoles.includes('Expert');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleRole = (role: UserRole) => {
    setSelectedRoles(prev => {
      if (prev.includes(role)) {
        if (prev.length <= 1) {
          // Prevent deselecting all roles
          return prev;
        }
        return prev.filter(r => r !== role);
      } else {
        return Array.from(new Set([...prev, role]));
      }
    });
  };

  const handleRemoveRoleChip = (e: React.MouseEvent, roleToRemove: UserRole) => {
    e.stopPropagation();
    if (selectedRoles.length <= 1) return;
    setSelectedRoles(prev => prev.filter(r => r !== roleToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password && confirmPassword && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (selectedRoles.length === 0) {
      setError('Please select at least one Profile Type.');
      return;
    }

    if (isExpertSelected) {
      if (!expertCertificate?.fileName) {
        setError('Mandatory Proof Required: You must upload a verified certificate file (PDF, PNG, JPG) to register with the Expert role.');
        return;
      }
      if (!expertCertificate?.certificateId?.trim()) {
        setError('Mandatory Proof Required: Registration / Certificate Number is mandatory for Expert.');
        return;
      }
      if (!expertCertificate?.issuingAuthority?.trim()) {
        setError('Mandatory Proof Required: Issuing Statutory Authority is mandatory for Expert.');
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

    const result = await register({
      name,
      email,
      roles: selectedRoles,
      role: selectedRoles[0],
      preferred_language: preferredLanguage,
      password: password || 'demo1234',
      expertCertificate: certPayload
    });

    if (result.success) {
      setActiveTab('profile');
    } else {
      setError(result.error || 'Registration failed.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-3 sm:p-6 bg-slate-50">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-800 to-teal-950 text-amber-300 mx-auto flex items-center justify-center shadow-xs">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
              Create an IP-SAKTI Sahayak Account
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Access statutory patent analysis, TKDL dossiers, and biodiversity approvals
            </p>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Full Legal / Professional Name
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Dr. Priya Kulkarni"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Official Email Address
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

          {/* Profile Type Multi-Select Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Profile Type <span className="text-[11px] text-emerald-800 font-normal">(Multi-select enabled)</span>
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {selectedRoles.length} of 5 selected
              </span>
            </div>

            {/* Dropdown Trigger Box with Chips */}
            <div
              id="register-profile-type-trigger"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`w-full min-h-[42px] px-2.5 py-1.5 bg-slate-50 border rounded-xl text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                isDropdownOpen
                  ? 'border-emerald-700 ring-1 ring-emerald-700 bg-white'
                  : 'border-slate-300 hover:border-slate-400'
              }`}
            >
              <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                {selectedRoles.length === 0 ? (
                  <span className="text-slate-400 text-xs px-1">
                    Select one or more profile types...
                  </span>
                ) : (
                  selectedRoles.map(r => (
                    <span
                      key={r}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-950 border border-emerald-200 text-xs font-medium shadow-2xs animate-in fade-in duration-100"
                    >
                      <span>{r}</span>
                      <button
                        type="button"
                        onClick={e => handleRemoveRoleChip(e, r)}
                        title={`Remove ${r}`}
                        aria-label={`Remove ${r}`}
                        className="p-0.5 rounded-full hover:bg-emerald-200 text-emerald-800 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0 text-slate-400 pl-1">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-emerald-700' : ''}`} />
              </div>
            </div>

            {/* Multi-Select Dropdown Menu */}
            {isDropdownOpen && (
              <div
                id="register-profile-type-dropdown"
                className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-2 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Select Any Combination of Roles
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Check all that apply
                  </span>
                </div>

                <div className="py-1 space-y-1 max-h-60 overflow-y-auto">
                  {ALL_ROLES.map(roleOption => {
                    const isChecked = selectedRoles.includes(roleOption);
                    const meta = ROLE_DEFINITIONS[roleOption];

                    return (
                      <div
                        key={roleOption}
                        onClick={() => handleToggleRole(roleOption)}
                        className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-50/70 text-slate-900'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className="pt-0.5 shrink-0">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              isChecked
                                ? 'bg-emerald-700 border-emerald-700 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>

                        {/* Role Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-900">
                              {roleOption}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${meta?.pillBg || 'bg-slate-100 text-slate-700'}`}>
                              {meta?.badge || roleOption}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                            {meta?.desc || meta?.title}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dropdown Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between px-1">
                  <span className="text-[11px] text-slate-500">
                    {selectedRoles.length} profile{selectedRoles.length !== 1 ? 's' : ''} active
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(false)}
                    className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mandatory Expert Certificate Upload when Expert role is selected */}
          {isExpertSelected && (
            <div className="p-4 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border-2 border-emerald-500/40 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-800" />
                  <span className="text-xs font-bold text-emerald-950">
                    Expert Statutory Accreditation Proof
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
                  Mandatory for Expert
                </span>
              </div>

              <ExpertCertificateUpload
                certificateData={expertCertificate}
                onChange={setExpertCertificate}
              />
            </div>
          )}

          {/* Preferred Language */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Default Interface Language / भाषा
            </label>
            <select
              value={preferredLanguage}
              onChange={e => setPreferredLanguage(e.target.value as Language)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors"
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.native} ({lang.label})
                </option>
              ))}
            </select>
          </div>

          {/* Password (Optional for dummy demo, but standard) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-center sm:text-left">
          <button
            type="button"
            onClick={() => setActiveTab('landing')}
            className="text-slate-500 hover:text-slate-800"
          >
            ← Back to Portal Home
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className="text-emerald-800 font-semibold hover:underline flex items-center gap-1"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Already have an account? Sign In</span>
          </button>
        </div>
      </div>
    </div>
  );
};
