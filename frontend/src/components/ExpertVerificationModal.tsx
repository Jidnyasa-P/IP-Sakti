import React, { useState } from 'react';
import { Shield, X, Check, AlertCircle, Scale, ShieldCheck } from 'lucide-react';
import { ExpertCertificateUpload, ExpertCertificateData } from './ExpertCertificateUpload';
import { ExpertCertificate } from '../types';

interface ExpertVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (certificate: ExpertCertificate) => void;
  existingCertificate?: ExpertCertificate;
}

export const ExpertVerificationModal: React.FC<ExpertVerificationModalProps> = ({
  isOpen,
  onClose,
  onVerified,
  existingCertificate
}) => {
  const [certData, setCertData] = useState<Partial<ExpertCertificateData> | null>(() => {
    if (existingCertificate) {
      return { ...existingCertificate };
    }
    return {
      certificateType: 'CGPDTM Registered Patent Agent (Rule 110, Patents Rules 2003)',
      issuingAuthority: 'CGPDTM, Intellectual Property India',
      certificateId: ''
    };
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!certData?.fileName) {
      setError('A verified certificate file (PDF, PNG, JPG) is mandatory for the Expert role.');
      return;
    }

    if (!certData?.certificateId?.trim()) {
      setError('Registration / Certificate Number is mandatory.');
      return;
    }

    if (!certData?.issuingAuthority?.trim()) {
      setError('Issuing Statutory Authority is mandatory.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      onVerified({
        fileName: certData.fileName!,
        fileSize: certData.fileSize || 350000,
        fileType: certData.fileType || 'application/pdf',
        fileDataUrl: certData.fileDataUrl,
        certificateId: certData.certificateId!.trim(),
        certificateType: certData.certificateType || 'CGPDTM Registered Patent Agent (Rule 110, Patents Rules 2003)',
        issuingAuthority: certData.issuingAuthority!.trim(),
        uploadedAt: new Date().toISOString(),
        status: 'Verified'
      });
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-900 to-teal-950 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 text-amber-300 flex items-center justify-center border border-white/20">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <span>Expert Role Statutory Verification</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400 text-slate-950">
                  Proof Mandatory
                </span>
              </h2>
              <p className="text-[11px] text-emerald-200/80">
                Statutory accreditation check under Indian Patent Rules & Bar Council
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-xs text-slate-600 leading-relaxed">
            The <strong>Expert (Legal Advisor)</strong> role grants access to confidential low-confidence Section 3(p) objections, statutory review queues, and direct advisory clearances. To enable this role in your profile, please attach verified proof of your accreditation.
          </p>

          <ExpertCertificateUpload
            certificateData={certData}
            onChange={setCertData}
          />

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  <span>Verify & Grant Expert Role</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
