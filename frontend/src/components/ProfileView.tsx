import React, { useState, useRef, useEffect } from 'react';
import {
  Mail,
  Shield,
  Globe,
  Calendar,
  LogOut,
  Edit2,
  Check,
  Camera,
  Trash2,
  Upload,
  ArrowLeft,
  BadgeCheck,
  Sparkles,
  FlaskConical,
  Compass,
  FolderArchive,
  BookOpen,
  UserCheck,
  Plus,
  ChevronDown,
  X,
  FileText,
  Scale
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ActiveTab } from './Header';
import { Language, UserRole, ALL_ROLES, ROLE_DEFINITIONS, normalizeRole, SUPPORTED_LANGUAGES, LANGUAGES_MAP, ExpertCertificate, OrganizationRole } from '../types';
import { useTranslation } from '../context/LanguageContext';
import { CameraCaptureModal } from './CameraCaptureModal';
import { ExpertVerificationModal } from './ExpertVerificationModal';
import { authFetch } from './auth/authStorage';

interface ProfileViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ setActiveTab }) => {
  const { currentUser, logout, updateProfile, setActiveRole, addRole, removeRole, requestChangePassword, confirmChangePassword, requestDeleteAccount, confirmDeleteAccount } = useAuth();
  const { setLanguage } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editDropdownRef = useRef<HTMLDivElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [preferredLanguage, setPreferredLanguage] = useState<Language>(currentUser?.preferred_language || 'en');
  const [role, setRole] = useState<UserRole>(currentUser?.role ? normalizeRole(currentUser.role) : 'Practitioner');
  const [editSelectedRoles, setEditSelectedRoles] = useState<UserRole[]>(
    currentUser?.roles && currentUser.roles.length > 0
      ? currentUser.roles.map(normalizeRole)
      : [currentUser?.role ? normalizeRole(currentUser.role) : 'Practitioner']
  );
  const [editDropdownOpen, setEditDropdownOpen] = useState(false);
  const isExpertRole = currentUser?.role ? normalizeRole(currentUser.role) === 'Expert' : false;
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(currentUser?.photo_url);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isExpertModalOpen, setIsExpertModalOpen] = useState(false);
  const [securityMode, setSecurityMode] = useState<'change' | 'delete' | null>(null);
  const [securityStep, setSecurityStep] = useState<1 | 2>(1);
  const [currentPassword, setCurrentPassword] = useState('');
  const [securityOtp, setSecurityOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);

  const [organizationRoles, setOrganizationRoles] = useState<OrganizationRole[]>([]);
  const [organizationRoleName, setOrganizationRoleName] = useState('');
  const [organizationRoleDescription, setOrganizationRoleDescription] = useState('');
  const [organizationRoleLoading, setOrganizationRoleLoading] = useState(false);
  const [organizationRoleError, setOrganizationRoleError] = useState<string | null>(null);
  const hasOrganizationRole = Boolean(
    currentUser?.roles?.some((item) => normalizeRole(item) === 'Organization') ||
    normalizeRole(currentUser?.role) === 'Organization'
  );

  // Sync state with currentUser changes
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setPreferredLanguage(currentUser.preferred_language);
      const normRole = normalizeRole(currentUser.role);
      setRole(normRole);
      setPhotoUrl(currentUser.photo_url);
      const currentRoles = (currentUser.roles && currentUser.roles.length > 0)
        ? Array.from(new Set(currentUser.roles.map(normalizeRole)))
        : [normRole];
      setEditSelectedRoles(currentRoles);
    }
  }, [currentUser]);

  useEffect(() => {
    let active = true;

    if (!hasOrganizationRole) {
      setOrganizationRoles([]);
      setOrganizationRoleError(null);
      return () => { active = false; };
    }

    authFetch('/api/auth/organization-roles')
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load organization roles.');
        return res.json();
      })
      .then((data) => {
        if (active) {
          setOrganizationRoles(Array.isArray(data?.roles) ? data.roles : []);
          setOrganizationRoleError(null);
        }
      })
      .catch((err) => {
        if (active) setOrganizationRoleError(err instanceof Error ? err.message : 'Could not load organization roles.');
      });

    return () => { active = false; };
  }, [hasOrganizationRole]);

  const handleAddOrganizationRole = async (event: React.FormEvent) => {
    event.preventDefault();
    if (organizationRoleLoading) return;
    const nameValue = organizationRoleName.trim();
    if (nameValue.length < 2) {
      setOrganizationRoleError('Role name must contain at least 2 characters.');
      return;
    }

    setOrganizationRoleLoading(true);
    setOrganizationRoleError(null);
    try {
      const res = await authFetch('/api/auth/organization-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameValue, description: organizationRoleDescription.trim() }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.detail || 'Could not add organization role.');
      }
      const payload = await res.json();
      if (payload?.role) setOrganizationRoles((previous) => [...previous, payload.role]);
      setOrganizationRoleName('');
      setOrganizationRoleDescription('');
    } catch (err) {
      setOrganizationRoleError(err instanceof Error ? err.message : 'Could not add organization role.');
    } finally {
      setOrganizationRoleLoading(false);
    }
  };

  const handleDeleteOrganizationRole = async (roleId: string) => {
    if (organizationRoleLoading) return;
    setOrganizationRoleLoading(true);
    setOrganizationRoleError(null);
    try {
      const res = await authFetch(`/api/auth/organization-roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.detail || 'Could not remove organization role.');
      }
      setOrganizationRoles((previous) => previous.filter((item) => item.id !== roleId));
    } catch (err) {
      setOrganizationRoleError(err instanceof Error ? err.message : 'Could not remove organization role.');
    } finally {
      setOrganizationRoleLoading(false);
    }
  };

  // Close edit dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editDropdownRef.current && !editDropdownRef.current.contains(event.target as Node)) {
        setEditDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (cap at ~4MB for browser storage)
    if (file.size > 4 * 1024 * 1024) {
      setPhotoError('Image size exceeds 4MB. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      setPhotoUrl(result);
      // Immediately persist photo update to profile
      await updateProfile({ photo_url: result });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    };
    reader.onerror = () => {
      setPhotoError('Could not process selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureLivePhoto = async (capturedDataUrl: string) => {
    setPhotoUrl(capturedDataUrl);
    await updateProfile({ photo_url: capturedDataUrl });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleRemovePhoto = async () => {
    setPhotoUrl(undefined);
    await updateProfile({ photo_url: undefined });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalRoles = editSelectedRoles.length > 0 ? editSelectedRoles : [role];
    const finalRole = finalRoles.includes(role) ? role : finalRoles[0];

    await updateProfile({
      name: name.trim() || currentUser.name,
      preferred_language: preferredLanguage,
      role: finalRole,
      roles: finalRoles,
      photo_url: photoUrl
    });

    setLanguage(preferredLanguage);
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleLogout = () => {
    logout();
    setActiveTab('landing');
  };

  const languagesMap = LANGUAGES_MAP;

  if (!currentUser) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 bg-slate-50">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xs p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto"><Shield className="w-6 h-6" /></div>
          <div><h2 className="text-base font-semibold text-slate-900">Sign In Required</h2><p className="text-xs text-slate-500 mt-1">Please sign in or register to view and customize your statutory profile.</p></div>
          <div className="pt-2 flex flex-col gap-2"><button type="button" onClick={() => setActiveTab('login')} className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl">Sign In to Your Account</button><button type="button" onClick={() => setActiveTab('landing')} className="w-full py-2 px-4 text-xs text-slate-600 hover:text-slate-900 font-medium">Return to Landing Page</button></div>
        </div>
      </div>
    );
  }

  const activeRoleNormalized = normalizeRole(currentUser.role);
  const roleMeta = ROLE_DEFINITIONS[activeRoleNormalized] || {
    id: activeRoleNormalized, label: activeRoleNormalized, badge: activeRoleNormalized,
    title: `${activeRoleNormalized} Profile`,
    desc: 'Authorized access to the IP-SAKTI AYUSH and Patent Decision Engine.',
    pillBg: 'bg-emerald-50 text-emerald-900 border-emerald-200'
  };

  const closeSecurity = () => {
    setSecurityMode(null); setSecurityStep(1); setCurrentPassword(''); setSecurityOtp(''); setNewPassword(''); setSecurityMessage(null); setSecurityError(null);
  };

  const startSecurityAction = async () => {
    if (securityLoading) return;
    setSecurityError(null); setSecurityMessage(null);
    if (!currentPassword) { setSecurityError('Enter your current password.'); return; }
    setSecurityLoading(true);
    try {
      const result = securityMode === 'change' ? await requestChangePassword(currentPassword) : await requestDeleteAccount(currentPassword);
      if (result.success) { setSecurityStep(2); setSecurityMessage('A verification code has been sent to your email.'); }
      else setSecurityError(result.error || 'Could not start this security action.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const finishSecurityAction = async () => {
    if (securityLoading) return;
    setSecurityError(null);
    if (!securityOtp || securityOtp.length !== 6) { setSecurityError('Enter the 6-digit verification code.'); return; }
    if (securityMode === 'change' && newPassword.length < 8) { setSecurityError('New password must be at least 8 characters.'); return; }

    setSecurityLoading(true);
    try {
      if (securityMode === 'change') {
        const result = await confirmChangePassword(securityOtp, newPassword);
        if (result.success) { setSecurityMessage('Password changed successfully.'); setTimeout(closeSecurity, 900); }
        else setSecurityError(result.error || 'Could not change password.');
      } else {
        const result = await confirmDeleteAccount(securityOtp);
        if (result.success) { setActiveTab('landing'); }
        else setSecurityError(result.error || 'Could not delete account.');
      }
    } finally {
      setSecurityLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-4 sm:py-8 md:py-10 px-3 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
        {/* Top Navigation & Breadcrumbs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            id="profile-back-btn"
            onClick={() => setActiveTab('chat')}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Sahayak Assistant</span>
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
            <BadgeCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Active Session • IPR & AYUSH Gateway</span>
          </div>
        </div>

        {/* Success Alert */}
        {savedSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-medium text-emerald-950 shadow-2xs">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Your profile details and preferences have been updated successfully.</span>
            </div>
          </div>
        )}

        {/* Photo Upload Error */}
        {photoError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
            {photoError}
          </div>
        )}

        {/* Main Profile Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {/* Subtle Institutional Surface Header */}
          <div className="bg-slate-100/70 border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
                Statutory Researcher Identity
              </span>
              <h1 className="text-base font-serif font-semibold text-slate-900">
                User Profile & Credentials
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {!isEditing ? (
                <button
                  type="button"
                  id="edit-profile-btn"
                  onClick={() => setIsEditing(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setName(currentUser.name);
                    setPreferredLanguage(currentUser.preferred_language);
                    setRole(currentUser.role);
                    setPhotoUrl(currentUser.photo_url);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
              )}

              <button
                type="button"
                id="profile-logout-btn"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Profile Identity & Photo Row */}
          <div className="p-4 sm:p-6 md:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 pb-6 border-b border-slate-100">
              {/* Profile Photo with Camera / Edit Overlay */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-emerald-800 to-teal-950 border-2 border-white shadow-md flex items-center justify-center overflow-hidden text-amber-200 font-bold text-3xl select-none">
                  {currentUser.photo_url ? (
                    <img
                      src={currentUser.photo_url}
                      alt={currentUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{currentUser.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png, image/jpeg, image/webp, image/jpg"
                  className="hidden"
                  id="profile-photo-file-input"
                />

                {/* Edit Photo Trigger Button: opens camera modal to capture live photo */}
                <button
                  type="button"
                  id="open-camera-avatar-btn"
                  onClick={() => setIsCameraOpen(true)}
                  title="Open camera to capture live photo"
                  aria-label="Open camera to capture live photo"
                  className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-md border-2 border-white transition-all hover:scale-105 flex items-center justify-center cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-amber-300" />
                </button>
              </div>

              {/* Identity Details */}
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight truncate">
                    {currentUser.name}
                  </h2>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${roleMeta.pillBg}`}>
                    {roleMeta.badge}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{currentUser.email}</span>
                  </span>

                  <span className="flex items-center gap-1.5 text-slate-600">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>{languagesMap[currentUser.preferred_language]?.native || currentUser.preferred_language}</span>
                  </span>

                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      Registered {new Date(currentUser.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 font-normal leading-relaxed pt-1">
                  {roleMeta.desc}
                </p>

                {/* Photo Action Bar */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Upload Photo</span>
                  </button>

                  {currentUser.photo_url && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Photo</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* View Mode or Edit Mode */}
            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="pt-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Edit Profile Details
                  </h3>

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Full Legal / Professional Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors"
                      placeholder="e.g. Dr. Aarav Sharma"
                    />
                  </div>

                  {/* Profile Type Multi-Select Dropdown in Edit Mode */}
                  <div className="relative" ref={editDropdownRef}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-slate-700">
                        Profile Type <span className="text-[11px] text-emerald-800 font-normal">(Multi-select enabled)</span>
                      </label>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {editSelectedRoles.length} of 5 selected
                      </span>
                    </div>

                    {/* Trigger Box with Chips */}
                    <div
                      id="profile-edit-roles-trigger"
                      onClick={() => setEditDropdownOpen(!editDropdownOpen)}
                      className={`w-full min-h-[42px] px-2.5 py-1.5 bg-slate-50 border rounded-xl text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        editDropdownOpen
                          ? 'border-emerald-700 ring-1 ring-emerald-700 bg-white'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                        {editSelectedRoles.length === 0 ? (
                          <span className="text-slate-400 text-xs px-1">
                            Select one or more profile types...
                          </span>
                        ) : (
                          editSelectedRoles.map(r => (
                            <span
                              key={r}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-950 border border-emerald-200 text-xs font-medium shadow-2xs"
                            >
                              <span>{r}</span>
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  if (editSelectedRoles.length <= 1) return;
                                  setEditSelectedRoles(prev => prev.filter(item => item !== r));
                                  if (role === r) {
                                    const remaining = editSelectedRoles.filter(item => item !== r);
                                    if (remaining.length > 0) setRole(remaining[0]);
                                  }
                                }}
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
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${editDropdownOpen ? 'rotate-180 text-emerald-700' : ''}`} />
                      </div>
                    </div>

                    {/* Multi-Select Dropdown Menu */}
                    {editDropdownOpen && (
                      <div
                        id="profile-edit-roles-dropdown"
                        className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-2 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150"
                      >
                        <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Select All That Apply
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Check multiple roles
                          </span>
                        </div>

                        <div className="py-1 space-y-1 max-h-60 overflow-y-auto">
                          {ALL_ROLES.map(roleOption => {
                            const isChecked = editSelectedRoles.includes(roleOption);
                            const meta = ROLE_DEFINITIONS[roleOption];

                            return (
                              <div
                                key={roleOption}
                                onClick={() => {
                                  if (roleOption === 'Expert' && !isChecked && !currentUser.expertCertificate) {
                                    setIsExpertModalOpen(true);
                                    return;
                                  }

                                  setEditSelectedRoles(prev => {
                                    if (prev.includes(roleOption)) {
                                      if (prev.length <= 1) return prev;
                                      const next = prev.filter(r => r !== roleOption);
                                      if (role === roleOption && next.length > 0) {
                                        setRole(next[0]);
                                      }
                                      return next;
                                    } else {
                                      return Array.from(new Set([...prev, roleOption]));
                                    }
                                  });
                                }}
                                className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                  isChecked
                                    ? 'bg-emerald-50/70 text-slate-900'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
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

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between px-1">
                          <span className="text-[11px] text-slate-500">
                            {editSelectedRoles.length} role{editSelectedRoles.length !== 1 ? 's' : ''} active
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditDropdownOpen(false)}
                            className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition-colors cursor-pointer"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active Role in Edit Mode */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Active Role (Primary Operational Identity)
                    </label>
                    <select
                      value={role}
                      onChange={e => {
                        const newActive = e.target.value as UserRole;
                        setRole(newActive);
                        if (!editSelectedRoles.includes(newActive)) {
                          setEditSelectedRoles(prev => [...prev, newActive]);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors"
                    >
                      {ALL_ROLES.map(r => (
                        <option key={r} value={r}>
                          {r} — {ROLE_DEFINITIONS[r]?.title || r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Preferred Language */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Preferred Interface Language / भाषा
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
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setName(currentUser.name);
                      setPreferredLanguage(currentUser.preferred_language);
                      setRole(currentUser.role);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="pt-6 space-y-6">
                {/* Information Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Official Full Name
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {currentUser.name}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Used on generated patent dossiers and TKDL queries
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Authorized Email
                    </div>
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {currentUser.email}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Primary sign-in credential & workspace sync
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Interface Language
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {languagesMap[currentUser.preferred_language]?.native || currentUser.preferred_language}{' '}
                      <span className="text-xs text-slate-500 font-normal">
                        ({languagesMap[currentUser.preferred_language]?.label || currentUser.preferred_language})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Sahayak responses and citations are formatted in this language
                    </p>
                  </div>
                </div>

                {hasOrganizationRole && (
                  <section className="p-4 sm:p-5 bg-white border border-purple-200 rounded-2xl shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-purple-700 shrink-0" />
                          <h3 className="text-sm font-semibold text-slate-900">Organization Role Monitor</h3>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                          Define and monitor organization-specific roles. These roles are separate from platform-level access roles.
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-900 border border-purple-200 shrink-0 self-start">
                        {organizationRoles.length} Organization Roles
                      </span>
                    </div>

                    {organizationRoleError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800" role="alert">{organizationRoleError}</div>
                    )}

                    <form onSubmit={handleAddOrganizationRole} className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto] gap-2.5 items-end">
                      <label className="min-w-0">
                        <span className="block text-[11px] font-semibold text-slate-700 mb-1">Role name</span>
                        <input value={organizationRoleName} onChange={(e) => setOrganizationRoleName(e.target.value)} maxLength={60} placeholder="e.g. IP Counsel" className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-1 focus:ring-purple-600" />
                      </label>
                      <label className="min-w-0">
                        <span className="block text-[11px] font-semibold text-slate-700 mb-1">Responsibilities / description</span>
                        <input value={organizationRoleDescription} onChange={(e) => setOrganizationRoleDescription(e.target.value)} maxLength={240} placeholder="What this role monitors or manages" className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-1 focus:ring-purple-600" />
                      </label>
                      <button type="submit" disabled={organizationRoleLoading} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-800 hover:bg-purple-900 disabled:opacity-60 text-white text-xs font-semibold transition-colors whitespace-nowrap">
                        <Plus className="w-3.5 h-3.5" />
                        {organizationRoleLoading ? 'Saving...' : 'Add Role'}
                      </button>
                    </form>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {organizationRoles.map((item) => (
                        <div key={item.id} className="min-w-0 p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">{item.name}</div>
                              {item.is_default && <span className="inline-flex mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">Default</span>}
                            </div>
                            {!item.is_default && (
                              <button type="button" onClick={() => handleDeleteOrganizationRole(item.id)} disabled={organizationRoleLoading} title="Remove organization role" className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug break-words">{item.description || 'Organization-defined role.'}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Statutory Accreditation Card (Expert Role) */}
                {((currentUser.roles || [currentUser.role]).map(normalizeRole).includes('Expert') || currentUser.expertCertificate) && (
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 border border-emerald-700/50 rounded-2xl text-white shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-800/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/10 text-amber-300 flex items-center justify-center border border-white/20">
                          <Scale className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white tracking-wide">
                              Statutory Expert Accreditation
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500 text-slate-950">
                              {currentUser.expertCertificate ? 'Verified Certificate' : 'Proof Required'}
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-200/80">
                            Empaneled under Indian Patent Rules / Bar Council for Section 3(p) statutory reviews
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsExpertModalOpen(true)}
                        className="self-start sm:self-auto px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-300" />
                        <span>{currentUser.expertCertificate ? 'Update Certificate' : 'Upload Proof'}</span>
                      </button>
                    </div>

                    {currentUser.expertCertificate ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                        <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
                          <span className="text-[10px] text-emerald-200 block font-medium">Accreditation Category</span>
                          <span className="font-semibold text-white text-[11px] line-clamp-1 mt-0.5" title={currentUser.expertCertificate.certificateType}>
                            {currentUser.expertCertificate.certificateType}
                          </span>
                        </div>

                        <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
                          <span className="text-[10px] text-emerald-200 block font-medium">Registration / Certificate ID</span>
                          <span className="font-mono font-bold text-amber-300 text-[11px] block mt-0.5">
                            {currentUser.expertCertificate.certificateId}
                          </span>
                        </div>

                        <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
                          <span className="text-[10px] text-emerald-200 block font-medium">Issuing Authority & Attached Proof</span>
                          <span className="text-emerald-100 text-[11px] truncate block mt-0.5" title={currentUser.expertCertificate.fileName}>
                            📄 {currentUser.expertCertificate.fileName}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-500/10 border border-amber-400/30 rounded-xl flex items-center justify-between text-xs text-amber-200">
                        <span>No certificate proof attached yet. Please upload your statutory certificate to complete empanelment verification.</span>
                        <button
                          type="button"
                          onClick={() => setIsExpertModalOpen(true)}
                          className="px-2.5 py-1 bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shrink-0 cursor-pointer ml-2 hover:bg-amber-300"
                        >
                          Upload Proof
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ================= Role Governance Hub ================= */}
                <div className="p-5 bg-gradient-to-br from-slate-50 to-emerald-50/20 border border-slate-200 rounded-2xl space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Statutory Role Governance
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Professional Roles & Authority Matrix
                      </h3>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-200">
                      {(currentUser.roles || [currentUser.role]).length} of 5 Roles Assigned
                    </span>
                  </div>

                  {/* Profile → Your Roles */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-emerald-700" />
                        <span>Your Roles</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {ALL_ROLES.length} total roles supported in system
                      </span>
                    </div>

                    {/* Assigned Roles Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(currentUser.roles || [currentUser.role]).map(normalizeRole).map((assignedRole) => {
                        const isActive = normalizeRole(currentUser.role) === assignedRole;
                        const meta = ROLE_DEFINITIONS[assignedRole];
                        const canRemove = (currentUser.roles || [currentUser.role]).length > 1;

                        return (
                          <div
                            key={assignedRole}
                            className={`p-3.5 rounded-xl border transition-all ${
                              isActive
                                ? 'bg-white border-emerald-700 ring-1 ring-emerald-700 shadow-2xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-slate-900">
                                {assignedRole}
                              </span>
                              <div className="flex items-center gap-1">
                                {isActive ? (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-700 stroke-[3]" />
                                    <span>Active Role</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setActiveRole(assignedRole)}
                                    className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer"
                                  >
                                    Set as Active
                                  </button>
                                )}

                                {canRemove && (
                                  <button
                                    type="button"
                                    onClick={() => removeRole(assignedRole)}
                                    title={`Remove ${assignedRole} role`}
                                    aria-label={`Remove ${assignedRole} role`}
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className={`text-[10px] font-semibold inline-block px-1.5 py-0.5 rounded mb-1.5 ${meta?.pillBg || 'bg-slate-100 text-slate-700'}`}>
                              {meta?.title || assignedRole}
                            </div>

                            <p className="text-[11px] text-slate-500 leading-snug">
                              {meta?.desc}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick overview of all 5 available roles */}
                    <div className="pt-2 border-t border-slate-200/60">
                      <div className="text-[11px] font-medium text-slate-600 mb-2 flex items-center justify-between">
                        <span>All 5 Platform Roles Overview:</span>
                        <span className="text-[10px] text-slate-400">Click to add any role</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_ROLES.map(r => {
                          const isAssigned = (currentUser.roles || [currentUser.role]).map(normalizeRole).includes(r);
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => {
                                if (!isAssigned) {
                                  if (r === 'Expert' && !currentUser.expertCertificate) {
                                    setIsExpertModalOpen(true);
                                  } else {
                                    addRole(r);
                                  }
                                } else {
                                  setActiveRole(r);
                                }
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer border ${
                                isAssigned
                                  ? normalizeRole(currentUser.role) === r
                                    ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
                                    : 'bg-emerald-50 text-emerald-950 border-emerald-200 font-medium'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                              }`}
                            >
                              {isAssigned ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Plus className="w-3 h-3 text-slate-400" />
                              )}
                              <span>{r}</span>
                              {normalizeRole(currentUser.role) === r && (
                                <span className="text-[9px] opacity-80">(Active)</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Statutory Permissions & Tool Matrix — Hidden for Expert users */}
                {!isExpertRole && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                        Authorized Portal Capabilities
                      </h3>
                      <span className="text-[11px] text-emerald-800 font-medium">
                        Verified Clearance Level
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div
                        onClick={() => setActiveTab('chat')}
                        className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer transition-colors flex items-start gap-3 group"
                      >
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 shrink-0 group-hover:scale-105 transition-transform">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                            <span>AI Sahayak Assistant</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">Active</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                            Dual jurisdiction Indian & International legal chat with statute grounding
                          </p>
                        </div>
                      </div>

                      <div
                        onClick={() => setActiveTab('product')}
                        className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer transition-colors flex items-start gap-3 group"
                      >
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 shrink-0 group-hover:scale-105 transition-transform">
                          <FlaskConical className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                            <span>Product Analyzer</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">Active</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                            Ayurvedic formulation assessment & Drug & Cosmetics Rule 158-B vetting
                          </p>
                        </div>
                      </div>

                      <div
                        onClick={() => setActiveTab('ipr')}
                        className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer transition-colors flex items-start gap-3 group"
                      >
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 shrink-0 group-hover:scale-105 transition-transform">
                          <Compass className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                            <span>Section 3(p) Navigator</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">Active</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                            Patent eligibility, Section 3(e) synergies & Form-1 NBA clearances
                          </p>
                        </div>
                      </div>

                      <div
                        onClick={() => setActiveTab('workspace')}
                        className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer transition-colors flex items-start gap-3 group"
                      >
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 shrink-0 group-hover:scale-105 transition-transform">
                          <FolderArchive className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                            <span>Dossier Workspace</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">Active</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                            Persistent query history, saved formulation analyses, and patent exports
                          </p>
                        </div>
                      </div>

                      <div
                        onClick={() => setActiveTab('research')}
                        className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer transition-colors flex items-start gap-3 group"
                      >
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 shrink-0 group-hover:scale-105 transition-transform">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                            <span>Statutory Research</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">Active</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                            Search gazettes, CGPDTM manuals, Pharmacopoeias, and judicial precedents
                          </p>
                        </div>
                      </div>

                      {(currentUser.role === 'Admin' || currentUser.role === 'ADMIN' || currentUser.roles?.some(r => r === 'Admin' || r === 'ADMIN')) ? (
                        <div
                          onClick={() => setActiveTab('admin')}
                          className="p-3.5 bg-amber-50/60 hover:bg-amber-50 border border-amber-200 rounded-xl cursor-pointer transition-colors flex items-start gap-3 group"
                        >
                          <div className="p-2 rounded-lg bg-amber-200 text-amber-900 shrink-0 group-hover:scale-105 transition-transform">
                            <UserCheck className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                              <span>Admin Console</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 font-semibold">Authorized</span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                              Institutional audit logging, compliance verification, and usage telemetry
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl flex items-start gap-3 opacity-60">
                          <div className="p-2 rounded-lg bg-slate-200 text-slate-500 shrink-0">
                            <Shield className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-500">
                              Institutional Admin Console
                            </div>
                            <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                              Requires ADMIN authority tier credentials for compliance oversight
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Account Security */}
      <div className="max-w-4xl mx-auto mt-5 bg-white border border-slate-200 rounded-2xl shadow-xs p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Account Security</h2>
            <p className="text-[11px] text-slate-500 mt-1">Manage your password or permanently delete your account.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setSecurityMode('change'); setSecurityStep(1); setSecurityMessage(null); setSecurityError(null); }} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold">Change Password</button>
            <button type="button" onClick={() => { setSecurityMode('delete'); setSecurityStep(1); setSecurityMessage(null); setSecurityError(null); }} className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">Delete Account</button>
          </div>
        </div>
      </div>

      {securityMode && (
        <div className="fixed inset-0 z-[100] bg-slate-950/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-slate-900">{securityMode === 'change' ? 'Change Password' : 'Delete Account'}</h3><button type="button" onClick={closeSecurity} className="text-slate-400 hover:text-slate-800">✕</button></div>
            {securityError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">{securityError}</div>}
            {securityMessage && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">{securityMessage}</div>}
            {securityStep === 1 ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">First verify your current password. We will then send a one-time code to your registered email.</p>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Current password" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" />
                <button type="button" disabled={securityLoading} onClick={startSecurityAction} className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed">{securityLoading ? 'Sending verification code…' : 'Send OTP'}</button>
              </div>
            ) : (
              <div className="space-y-3">
                <input inputMode="numeric" maxLength={6} value={securityOtp} onChange={e => setSecurityOtp(e.target.value.replace(/\D/g, ''))} placeholder="6-digit OTP" className="w-full text-center tracking-[0.3em] px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm" />
                {securityMode === 'change' && <input type="password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs" />}
                {securityMode === 'delete' && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">This action permanently deletes your account and cannot be undone.</p>}
                <button type="button" disabled={securityLoading} onClick={finishSecurityAction} className={`w-full py-2.5 rounded-xl text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed ${securityMode === 'delete' ? 'bg-rose-700 hover:bg-rose-800' : 'bg-slate-900 hover:bg-slate-800'}`}>{securityLoading ? 'Verifying…' : (securityMode === 'delete' ? 'Delete Account' : 'Change Password')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCaptureLivePhoto}
        onFallbackUpload={() => fileInputRef.current?.click()}
      />

      {/* Expert Statutory Verification Modal */}
      <ExpertVerificationModal
        isOpen={isExpertModalOpen}
        onClose={() => setIsExpertModalOpen(false)}
        onVerified={(verifiedCert) => {
          addRole('Expert', verifiedCert);
          setEditSelectedRoles(prev => Array.from(new Set([...prev, 'Expert'])));
        }}
        existingCertificate={currentUser.expertCertificate}
      />
    </div>
  );
};
