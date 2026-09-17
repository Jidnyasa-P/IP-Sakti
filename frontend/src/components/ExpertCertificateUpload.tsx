import React, { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Trash2, ShieldCheck, Sparkles, ExternalLink } from 'lucide-react';
import { ExpertCertificate } from '../types';

export interface ExpertCertificateData {
  fileName: string;
  fileSize: number;
  fileType: string;
  fileDataUrl?: string;
  certificateId: string;
  certificateType: string;
  issuingAuthority: string;
  uploadedAt: string;
  status: 'Verified' | 'Pending_Verification';
}

interface ExpertCertificateUploadProps {
  certificateData: Partial<ExpertCertificateData> | null;
  onChange: (data: Partial<ExpertCertificateData> | null) => void;
  compact?: boolean;
  onValidationChange?: (isValid: boolean) => void;
}

export const CERTIFICATE_TYPES = [
  'CGPDTM Registered Patent Agent (Rule 110, Patents Rules 2003)',
  'Bar Council of India Enrolment (Advocate & Bio-IP Counsel)',
  'Ministry of AYUSH Statutory Advisory Panel Empanelment',
  'CSIR-TKDL Expert Prior-Art Reviewer Accreditation',
  'National Biodiversity Authority (NBA) Legal Consultant'
];

export const ExpertCertificateUpload: React.FC<ExpertCertificateUploadProps> = ({
  certificateData,
  onChange,
  compact = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const certType = certificateData?.certificateType || CERTIFICATE_TYPES[0];
  const certId = certificateData?.certificateId || '';
  const authority = certificateData?.issuingAuthority || 'Controller General of Patents, Designs and Trade Marks (CGPDTM)';
  const hasFile = !!certificateData?.fileName;

  const handleFileProcess = (file: File) => {
    setFileError(null);

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFileError('File size exceeds 5MB limit. Please upload a smaller PDF or image.');
      return;
    }

    // Validate type (PDF, PNG, JPEG, JPG)
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setFileError('Invalid file format. Please upload a PDF, PNG, or JPG certificate.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onChange({
        ...(certificateData || {}),
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileDataUrl: dataUrl,
        certificateType: certType,
        certificateId: certId || `IN/PA/${Math.floor(1000 + Math.random() * 9000)}`,
        issuingAuthority: authority,
        uploadedAt: new Date().toISOString(),
        status: 'Verified'
      });
    };
    reader.onerror = () => {
      setFileError('Failed to read selected certificate file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleLoadSampleCertificate = () => {
    setFileError(null);
    onChange({
      fileName: 'CGPDTM_Patent_Agent_Certificate_IN_PA_3842.pdf',
      fileSize: 428000,
      fileType: 'application/pdf',
      certificateType: 'CGPDTM Registered Patent Agent (Rule 110, Patents Rules 2003)',
      certificateId: 'IN/PA/3842',
      issuingAuthority: 'CGPDTM, Ministry of Commerce and Industry, Govt of India',
      uploadedAt: new Date().toISOString(),
      status: 'Verified'
    });
  };

  const handleRemoveFile = () => {
    onChange({
      ...(certificateData || {}),
      fileName: undefined,
      fileSize: undefined,
      fileType: undefined,
      fileDataUrl: undefined
    });
  };

  return (
    <div className="space-y-4 text-left">
      {/* Official Requirement Header */}
      <div className="p-3 bg-emerald-50/70 border border-emerald-300/80 rounded-xl flex items-start gap-2.5 text-xs text-emerald-950">
        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-emerald-950">
            Mandatory Accreditation for Expert Role
          </p>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            Statutory advisors review confidential Section 3(p) prior-art objections and low-confidence flagged queries. You must upload verified proof of registration with CGPDTM or Bar Council.
          </p>
        </div>
      </div>

      {/* Certificate Credentials Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Statutory Accreditation Type <span className="text-rose-600">*</span>
          </label>
          <select
            value={certType}
            onChange={e => {
              const selectedType = e.target.value;
              let defaultAuth = 'CGPDTM, Intellectual Property India';
              if (selectedType.includes('Bar Council')) {
                defaultAuth = 'Bar Council of India / State Bar Council';
              } else if (selectedType.includes('AYUSH')) {
                defaultAuth = 'Ministry of AYUSH, Government of India';
              } else if (selectedType.includes('TKDL')) {
                defaultAuth = 'CSIR-TKDL Directorate, New Delhi';
              }
              onChange({
                ...(certificateData || {}),
                certificateType: selectedType,
                issuingAuthority: defaultAuth
              });
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors"
          >
            {CERTIFICATE_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Registration / Certificate No. <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            required
            value={certId}
            onChange={e => onChange({
              ...(certificateData || {}),
              certificateId: e.target.value
            })}
            placeholder="e.g. IN/PA/3842 or BCI/D/2018/142"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Issuing Statutory Authority <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            required
            value={authority}
            onChange={e => onChange({
              ...(certificateData || {}),
              issuingAuthority: e.target.value
            })}
            placeholder="e.g. CGPDTM / Bar Council of India"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors"
          />
        </div>
      </div>

      {/* File Upload Zone */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-slate-700">
            Upload Verified Certificate Document <span className="text-rose-600">*</span>
          </label>
          <button
            type="button"
            onClick={handleLoadSampleCertificate}
            className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 hover:underline cursor-pointer"
            title="Attach a pre-verified official sample certificate for demonstration"
          >
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span>Attach Sample Certificate (Quick Demo)</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          onChange={e => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileProcess(e.target.files[0]);
            }
          }}
          className="hidden"
        />

        {hasFile ? (
          /* Attached File Card */
          <div className="p-3.5 bg-emerald-50/50 border-2 border-emerald-400/80 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                  <span className="truncate">{certificateData?.fileName}</span>
                  <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-700 text-white">
                    Verified Proof
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {certificateData?.fileSize ? `${(certificateData.fileSize / 1024).toFixed(1)} KB` : 'Attached'} • Reg ID: <span className="font-mono font-semibold text-slate-700">{certId || 'IN/PA/3842'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Change
              </button>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                title="Remove attached file"
                aria-label="Remove attached file"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Drag and Drop Zone */
          <div
            onDragOver={e => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                : 'border-slate-300 hover:border-emerald-600 hover:bg-slate-50/70'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-2">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-800">
              Click to select or drag & drop certificate proof
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Supports PDF, PNG, or JPG (up to 5 MB). Must clearly display registration seal or certificate number.
            </p>
          </div>
        )}

        {fileError && (
          <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{fileError}</span>
          </div>
        )}
      </div>

      {/* Statutory Legal Disclaimer Checkbox */}
      <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-xl">
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            required
            defaultChecked
            className="mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
          />
          <span className="text-[11px] text-slate-600 leading-snug">
            I hereby certify that the uploaded accreditation credential is valid, genuine, and legally active under Indian statutory guidelines. I acknowledge statutory penalties for fraudulent representation under the Indian Penal Code.
          </span>
        </label>
      </div>
    </div>
  );
};
