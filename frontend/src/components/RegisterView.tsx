import React, { useState } from "react";
import {
  Shield,
  UserPlus,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Mail,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Language, UserRole, USER_ROLE_OPTIONS } from "../types";
import {
  resendRegistrationOtp,
  verifyRegistrationEmail,
} from "./auth/authStorage";
import { ActiveTab } from "./Header";

interface RegisterViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "mr", label: "मराठी (Marathi)" },
];

const EXPERT_TYPES = [
  { id: "ayurveda", label: "Ayurveda Expert" },
  { id: "legal", label: "Legal / IP Expert" },
  { id: "regulatory", label: "Regulatory Affairs Expert" },
] as const;

export const RegisterView: React.FC<RegisterViewProps> = ({ setActiveTab }) => {
  const { register, authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<Language>("en");
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([
    "Practitioner",
  ]);
  const [expertType, setExpertType] = useState<
    "ayurveda" | "legal" | "regulatory"
  >("legal");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpMode, setOtpMode] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isExpert = selectedRoles.includes("Expert");
  const requirements = [
    { label: "8 characters", ok: password.length >= 8 },
    { label: "Uppercase", ok: /[A-Z]/.test(password) },
    { label: "Lowercase", ok: /[a-z]/.test(password) },
    { label: "Number", ok: /\d/.test(password) },
    { label: "Special character", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const strength = requirements.filter((r) => r.ok).length;

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!name.trim() || !email.trim() || !password || !confirmPassword)
      return setError("Please fill in all required fields.");
    if (strength < 5) return setError("Please meet all password requirements.");
    if (password !== confirmPassword)
      return setError("Passwords do not match.");
    if (!selectedRoles.length)
      return setError("Please select at least one profile type.");
    try {
      const result = await register({
        name,
        email,
        password,
        preferred_language: preferredLanguage,
        roles: selectedRoles,
        expert_type: isExpert ? expertType : undefined,
      });
      if (result.success) {
        setOtpMode(true);
        setMessage("A 6-digit verification code has been sent to your email.");
      } else setError(result.error || "Registration failed.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again.",
      );
    }
  };

  const verify = async () => {
    setError(null);
    setMessage(null);
    if (!/^\d{6}$/.test(otp))
      return setError("Enter the 6-digit OTP sent to your email.");
    try {
      await verifyRegistrationEmail(email, otp);
      setVerified(true);
      setMessage("Email verified successfully. Redirecting you to sign in…");
      setTimeout(() => setActiveTab("login"), 900);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not verify the OTP.",
      );
    }
  };

  if (otpMode)
    return (
      <div className="w-full max-w-md mx-auto px-4 py-16 sm:py-24">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto flex items-center justify-center mb-4">
            <img
              src="/ip-sakti-logo.png"
              alt="IP-SAKTI logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Verify your email
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter the code sent to <strong>{email}</strong>.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-5">
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          {message && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              {message}
            </div>
          )}
          <label className="block text-xs font-semibold text-slate-700">
            Verification code
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="w-full pl-9 pr-3 py-3 rounded-lg border border-slate-300 text-center text-lg tracking-[0.35em] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <button
            type="button"
            onClick={verify}
            disabled={verified}
            className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold"
          >
            {verified ? "Email verified" : "Verify email"}
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await resendRegistrationOtp(email);
                setMessage("A new OTP has been sent.");
                setError(null);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not resend OTP.",
                );
              }
            }}
            className="w-full text-xs font-semibold text-emerald-800 hover:underline"
          >
            Resend OTP
          </button>
          <button
            type="button"
            onClick={() => setOtpMode(false)}
            className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to registration
          </button>
        </div>
      </div>
    );

  return (
    <div className="w-full max-w-md mx-auto px-4 py-16 sm:py-24">
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto flex items-center justify-center mb-4">
          <img
            src="/ip-sakti-logo.png"
            alt="IP-SAKTI logo"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-2xl font-serif font-bold text-slate-900">
          Create your account
        </h1>
        <p className="text-sm text-slate-500 mt-1">Join IP-SAKTI Sahayak</p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-5"
      >
        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Full name
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Email
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Confirm password
            </label>
            <div className="relative">
              <input
                required
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Password strength</span>
            <span>
              {strength === 5
                ? "Strong"
                : strength >= 3
                  ? "Moderate"
                  : "Needs improvement"}
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all"
              style={{ width: `${strength * 20}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
            {requirements.map((r) => (
              <span
                key={r.label}
                className={r.ok ? "text-emerald-700" : "text-slate-500"}
              >
                {r.ok ? "✓" : "○"} {r.label}
              </span>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Profile type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {USER_ROLE_OPTIONS.map((opt) => {
              const checked = selectedRoles.includes(opt);
              return (
                <label
                  key={opt}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium cursor-pointer ${checked ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRole(opt)}
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        </div>
        {isExpert && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Type of expert
            </label>
            <select
              value={expertType}
              onChange={(e) =>
                setExpertType(e.target.value as typeof expertType)
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              {EXPERT_TYPES.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Preferred language
          </label>
          <select
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value as Language)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={authLoading}
          className="w-full px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-medium text-sm flex items-center justify-center gap-2"
        >
          {authLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4" />
          )}{" "}
          {authLoading ? "Creating account…" : "Create Account"}
        </button>
        <p className="text-center text-xs text-slate-500 pt-2">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => setActiveTab("login")}
            className="font-semibold text-emerald-800 hover:underline"
          >
            Sign in
          </button>
        </p>
      </form>
    </div>
  );
};
