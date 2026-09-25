import React from "react";
import { X, ShieldCheck, FileText } from "lucide-react";

export type LegalDocument = "terms" | "privacy";

interface LegalPolicyModalProps {
  document: LegalDocument | null;
  onClose: () => void;
}

const LAST_UPDATED = "25 September 2026";

export const LegalPolicyModal: React.FC<LegalPolicyModalProps> = ({ document, onClose }) => {
  if (!document) return null;

  const isPrivacy = document === "privacy";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              {isPrivacy ? <ShieldCheck className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="legal-modal-title" className="text-lg font-semibold text-slate-950 dark:text-white">
                {isPrivacy ? "Privacy Policy" : "Terms & Conditions"}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Last updated: {LAST_UPDATED}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 text-sm leading-6 text-slate-700 dark:text-slate-300">
          {isPrivacy ? (
            <div className="space-y-5">
              <p>IP-SAKTI Sahayak is a research and decision-support platform for intellectual-property, AYUSH and regulatory information. This policy explains what information the application processes, why it is used, and the controls available to users.</p>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">1. Information we process</h3><p className="mt-1">Depending on the features you use, the application may process your name, email address, selected role and language, authentication records, conversations and queries, saved research, product/TK-ABS analyses, grievances, feedback and security/verification records. Information supplied in Contact Us messages is transmitted to the configured support mailbox for responding to the request.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">2. Uploaded documents and images</h3><p className="mt-1">When you attach a document or image to a chat, the file is processed transiently to extract relevant text or visual information for the current answer. The current application does not save the raw attachment as a permanent user file. Extracted attachment context is used for the request and is not written into the stored chat message by the application.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">3. How information is used</h3><p className="mt-1">Information is used to authenticate accounts, provide the requested research and analysis features, preserve your workspace, process grievances and support/security requests, and maintain service reliability. The application does not implement advertising or a mechanism to sell user information.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">4. Service providers</h3><p className="mt-1">The deployed application can use third-party infrastructure and services such as MongoDB for application data, Render for hosting, Qdrant/Neo4j for retrieval and knowledge services, an LLM provider for answer generation or image understanding, and Brevo for transactional email. Data sent to those services is limited to what is necessary for the enabled feature and is subject to the provider's own terms and privacy practices.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">5. Security</h3><p className="mt-1">Accounts use password hashing, authenticated sessions and OTP verification for registration and sensitive account actions. No online service can guarantee absolute security, so users should avoid uploading confidential information that they are not authorized to disclose.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">6. Retention and deletion</h3><p className="mt-1">Account and workspace records are retained while the account is active for the features that require them. The Delete Account flow is designed to remove the account and account-owned application records, including conversations, analyses, saved research, grievances, audit records and security OTP records. Some copies may remain temporarily in infrastructure backups or third-party service logs according to their retention controls.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">7. User choices</h3><p className="mt-1">You can use the account security controls to change your password or permanently delete your account. Where processing depends on consent, applicable Indian data-protection requirements govern withdrawal and related rights. Indian data-protection law may provide additional notice, consent, security and user-rights requirements depending on how the service is operated; the production operator should update this notice for the applicable legal framework.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">8. Important limitation</h3><p className="mt-1">This policy describes the current hackathon/deployed implementation and is not a substitute for a formal legal privacy notice prepared for a production organization. For a production deployment, the operator should designate the responsible privacy/contact function and update this notice for its final infrastructure, retention periods and legal obligations.</p></section>
            </div>
          ) : (
            <div className="space-y-5">
              <p>By using IP-SAKTI Sahayak, you agree to use the platform lawfully and only for legitimate research, education, compliance-support and intellectual-property information purposes.</p>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">1. Nature of the service</h3><p className="mt-1">IP-SAKTI Sahayak provides AI-assisted research and decision-support. It is not a government authority, patent office, law firm, regulatory authority or substitute for a registered patent agent, lawyer, regulatory professional or other qualified expert.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">2. No legal or regulatory guarantee</h3><p className="mt-1">Answers are generated from the application's indexed sources and may contain omissions, interpretation errors or outdated information. Citations and source links should be checked against the latest official publication before filing, commercializing a product, making a disclosure or taking a compliance decision. The platform does not guarantee that an invention is patentable, that an approval is required or that a particular filing will succeed.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">3. User responsibilities</h3><p className="mt-1">You are responsible for the accuracy of information you provide, for having permission to upload or disclose documents, and for independently verifying material advice before acting on it. Do not use the service to upload information you are prohibited from sharing.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">4. AI-generated content</h3><p className="mt-1">The service may use automated retrieval, knowledge-graph context and language/vision models. AI output should be treated as research assistance, not as a final professional opinion. Low-confidence cases may be routed toward human expert consultation where that feature is enabled.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">5. Acceptable use</h3><p className="mt-1">You must not attempt unauthorized access, interfere with the service, submit malicious content, impersonate another person, or use the platform for unlawful activity. The application may restrict requests that fall outside its intended IP, AYUSH and regulatory scope.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">6. Availability and third-party services</h3><p className="mt-1">The platform depends on hosting, database, retrieval, AI and email services. Those services may experience downtime, rate limits, network failures or changes outside the application's control. Features may therefore be temporarily unavailable.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">7. Grievances and support</h3><p className="mt-1">Users can submit support requests through Contact Us and, when signed in, raise a grievance from Workspace. Grievances are associated with the authenticated account and can include relevant query or response context when the user chooses to provide it.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">8. Governing legal framework</h3><p className="mt-1">The service is designed for use in India and should be operated in accordance with applicable Indian law, including applicable information-technology, data-protection and intellectual-property requirements. Nothing in these terms removes rights or protections that cannot lawfully be excluded.</p></section>
              <section><h3 className="font-semibold text-slate-950 dark:text-white">9. Changes</h3><p className="mt-1">These terms may be updated as the application changes. The date shown at the top identifies the current version for this deployment.</p></section>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-950/50">
          <button type="button" onClick={onClose} className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-900">Close</button>
        </div>
      </div>
    </div>
  );
};
