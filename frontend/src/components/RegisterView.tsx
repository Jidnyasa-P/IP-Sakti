import React, { useState, useRef, useEffect } from "react";
import {
  Shield,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  LogIn,
  AlertCircle,
  Check,
  ChevronDown,
  X,
  Scale,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ActiveTab } from "./Header";
import {
  Language,
  SUPPORTED_LANGUAGES,
  UserRole,
  ALL_ROLES,
  ROLE_DEFINITIONS,
  ExpertCertificate,
} from "../types";
import {
  ExpertCertificateUpload,
  ExpertCertificateData,
} from "./ExpertCertificateUpload";

interface RegisterViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

const REGISTER_LANGUAGES = SUPPORTED_LANGUAGES;

const passwordChecks = [
  {
    key: "length",
    label: "8 or more characters",
    test: (value: string) => value.length >= 8,
  },
  {
    key: "upper",
    label: "One uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    key: "lower",
    label: "One lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    key: "number",
    label: "One number",
    test: (value: string) => /\d/.test(value),
  },
  {
    key: "special",
    label: "One special character",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const;

export const RegisterView: React.FC<RegisterViewProps> = ({ setActiveTab }) => {
  const { register, verifyRegistration, resendRegistrationOtp, isLoading } =
    useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([
    "Practitioner",
  ]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<Language>("en");
  const [expertCertificate, setExpertCertificate] =
    useState<Partial<ExpertCertificateData> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationOtp, setVerificationOtp] = useState("");
  const [resending, setResending] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(
    null,
  );

  const isExpertSelected = selectedRoles.includes("Expert");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const strength = passwordChecks.filter((check) =>
    check.test(password),
  ).length;
  const strengthLabel =
    password.length === 0
      ? ""
      : strength <= 2
        ? "Weak"
        : strength <= 4
          ? "Good"
          : "Strong";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleRole = (role: UserRole) => {
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        if (prev.length <= 1) return prev;
        return prev.filter((r) => r !== role);
      }
      return Array.from(new Set([...prev, role]));
    });
  };

  const handleRemoveRoleChip = (
    e: React.MouseEvent,
    roleToRemove: UserRole,
  ) => {
    e.stopPropagation();
    if (selectedRoles.length <= 1) return;
    setSelectedRoles((prev) => prev.filter((r) => r !== roleToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please complete all required fields.");
      return;
    }

    if (strength < passwordChecks.length) {
      setError(
        "Please choose a stronger password that meets all the requirements shown below.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (selectedRoles.length === 0) {
      setError("Please select at least one Profile Type.");
      return;
    }

    if (isExpertSelected) {
      if (!expertCertificate?.fileName) {
        setError(
          "Mandatory Proof Required: You must upload a verified certificate file (PDF, PNG, JPG) to register with the Expert role.",
        );
        return;
      }
      if (!expertCertificate?.certificateId?.trim()) {
        setError(
          "Mandatory Proof Required: Registration / Certificate Number is mandatory for Expert.",
        );
        return;
      }
      if (!expertCertificate?.issuingAuthority?.trim()) {
        setError(
          "Mandatory Proof Required: Issuing Statutory Authority is mandatory for Expert.",
        );
        return;
      }
    }

    const certPayload: ExpertCertificate | undefined =
      isExpertSelected && expertCertificate?.fileName
        ? {
            fileName: expertCertificate.fileName,
            fileSize: expertCertificate.fileSize || 428000,
            fileType: expertCertificate.fileType || "application/pdf",
            fileDataUrl: expertCertificate.fileDataUrl,
            certificateId: expertCertificate.certificateId!.trim(),
            certificateType:
              expertCertificate.certificateType ||
              "CGPDTM Registered Patent Agent (Rule 110, Patents Rules 2003)",
            issuingAuthority: expertCertificate.issuingAuthority!.trim(),
            uploadedAt:
              expertCertificate.uploadedAt || new Date().toISOString(),
            status: "Verified",
          }
        : undefined;

    const result = await register({
      name,
      email,
      roles: selectedRoles,
      role: selectedRoles[0],
      preferred_language: preferredLanguage,
      password,
      expertCertificate: certPayload,
    });

    if (result.success) {
      setVerificationStep(true);
      setVerificationOtp("");
      setVerificationMessage(
        `A 6-digit verification code has been sent to ${result.email || email.trim()}.`,
      );
      setError(null);
    } else {
      setError(result.error || "Registration failed.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center">
            <img
              src="/ip-sakti-logo.png"
              alt="IP-SAKTI logo"
              className="h-full w-full object-contain"
            />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
            IP-SAKTI Sahayak
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Set up your profile to access IP and regulatory guidance.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {verificationStep ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {verificationMessage ||
                  `Enter the verification code sent to ${email.trim()}.`}
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="register-otp"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Verification code
                </label>
                <input
                  id="register-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={verificationOtp}
                  onChange={(e) =>
                    setVerificationOtp(
                      e.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  placeholder="Enter 6-digit OTP"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm tracking-[0.3em] text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                />
              </div>

              <button
                type="button"
                disabled={isLoading || verificationOtp.length !== 6}
                onClick={async () => {
                  setError(null);
                  const result = await verifyRegistration(
                    email.trim(),
                    verificationOtp,
                  );
                  if (result.success) {
                    setActiveTab("login");
                  } else {
                    setError(result.error || "Verification failed.");
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                Verify email and continue to sign in
              </button>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
                <button
                  type="button"
                  disabled={resending}
                  onClick={async () => {
                    setError(null);
                    setVerificationMessage(null);
                    setResending(true);
                    const result = await resendRegistrationOtp(email.trim());
                    setResending(false);
                    if (result.success)
                      setVerificationMessage(
                        "A new verification code has been sent to your email.",
                      );
                    else
                      setError(
                        result.error ||
                          "Could not resend the verification code.",
                      );
                  }}
                  className="font-semibold text-emerald-800 hover:underline disabled:opacity-50"
                >
                  {resending ? "Sending…" : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVerificationStep(false);
                    setError(null);
                  }}
                  className="font-semibold text-slate-600 hover:underline"
                >
                  Back to registration
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="register-name"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Full name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="register-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="register-email"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="register-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@organization.in"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Profile type{" "}
                  <span className="font-normal text-slate-400">
                    (select one or more)
                  </span>
                </label>

                <div className="relative" ref={dropdownRef}>
                  <div
                    id="register-profile-type-trigger"
                    onClick={() => setIsDropdownOpen((open) => !open)}
                    className={`flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm transition ${
                      isDropdownOpen
                        ? "border-emerald-700 ring-2 ring-emerald-700/10"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      {selectedRoles.map((role) => (
                        <span
                          key={role}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900"
                        >
                          {role}
                          <button
                            type="button"
                            onClick={(e) => handleRemoveRoleChip(e, role)}
                            title={`Remove ${role}`}
                            aria-label={`Remove ${role}`}
                            className="rounded-full p-0.5 text-emerald-700 hover:bg-emerald-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                        isDropdownOpen ? "rotate-180 text-emerald-700" : ""
                      }`}
                    />
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                      <div className="border-b border-slate-100 px-2 pb-2 text-[11px] text-slate-500">
                        Choose the profile types relevant to your work.
                      </div>
                      <div className="max-h-60 space-y-1 overflow-y-auto py-2">
                        {ALL_ROLES.map((role) => {
                          const isChecked = selectedRoles.includes(role);
                          const meta = ROLE_DEFINITIONS[role];

                          return (
                            <div
                              key={role}
                              onClick={() => handleToggleRole(role)}
                              className={`flex cursor-pointer items-start gap-3 rounded-md p-2.5 transition ${
                                isChecked
                                  ? "bg-emerald-50"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              <div
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                  isChecked
                                    ? "border-emerald-700 bg-emerald-700 text-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {isChecked && <Check className="h-3 w-3" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800">
                                  {role}
                                </p>
                                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                                  {meta?.desc || meta?.title}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-100 px-1 pt-2">
                        <span className="text-[11px] text-slate-500">
                          {selectedRoles.length} selected
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsDropdownOpen(false)}
                          className="rounded-md bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="register-language"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Preferred language
                  </label>
                  <select
                    id="register-language"
                    value={preferredLanguage}
                    onChange={(e) =>
                      setPreferredLanguage(e.target.value as Language)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                  >
                    {REGISTER_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.native} ({lang.label})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hidden sm:block" />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="register-password"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="mt-2.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500">
                        Password strength
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          strength === 5
                            ? "text-emerald-700"
                            : strength > 2
                              ? "text-amber-700"
                              : "text-rose-700"
                        }`}
                      >
                        {strengthLabel || "Not set"}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {passwordChecks.map((check) => (
                        <div
                          key={check.key}
                          className={`h-1.5 flex-1 rounded-full ${
                            check.test(password)
                              ? "bg-emerald-600"
                              : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-1 text-[10px] text-slate-500 sm:grid-cols-2">
                      {passwordChecks.map((check) => {
                        const passed = check.test(password);
                        return (
                          <span
                            key={check.key}
                            className={
                              passed ? "text-emerald-700" : "text-slate-500"
                            }
                          >
                            {passed ? "✓" : "•"} {check.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="register-confirm-password"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="register-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && (
                    <p
                      className={`mt-2 text-[11px] ${
                        password === confirmPassword
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {password === confirmPassword
                        ? "Passwords match."
                        : "Passwords do not match."}
                    </p>
                  )}
                </div>
              </div>

              {isExpertSelected && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-emerald-800" />
                      <span className="text-xs font-semibold text-slate-800">
                        Expert statutory certificate
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                      Required
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
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                <span>
                  {isLoading ? "Creating account…" : "Create account"}
                </span>
              </button>
            </form>
          )}

          <div className="mt-5 border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setActiveTab("login")}
              className="font-semibold text-emerald-800 hover:underline"
            >
              Sign in
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab("landing")}
          className="mx-auto mt-4 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          ← Back to landing page
        </button>
      </div>
    </div>
  );
};
