import React, { useEffect, useState } from 'react';
import { authFetch } from './auth/authStorage';
import { X, ExternalLink, BookOpen, ShieldCheck, FileText } from 'lucide-react';
import { Citation, DocumentMetadata, DocumentChunk } from '../types';

interface CitationModalProps {
  citation: Citation | null;
  onClose: () => void;
}

export const CitationModal: React.FC<CitationModalProps> = ({ citation, onClose }) => {
  const [docDetails, setDocDetails] = useState<{ metadata: DocumentMetadata; chunks: DocumentChunk[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!citation) return;
    setLoading(true);
    authFetch(`/api/documents/${citation.document_id}`)
      .then(res => res.json())
      .then(data => {
        setDocDetails(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load document details:', err);
        setLoading(false);
      });
  }, [citation]);

  if (!citation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="citation-inspector-modal"
        className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-700 text-white font-semibold text-xs">
              [{citation.index}]
            </span>
            <h3 className="font-semibold text-slate-900 text-base line-clamp-1">
              {citation.title}
            </h3>
          </div>
          <button
            id="close-citation-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Metadata chips */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-medium">
              Authority: {citation.authority}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-medium">
              Section: {citation.section}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200/60 font-medium">
              Source: {citation.source}
            </span>
            {citation.page && (
              <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 font-medium">
                Page {citation.page}
              </span>
            )}
          </div>

          {/* Cited Passage */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              <FileText className="w-4 h-4 text-emerald-700" />
              Retrieved Statutory Passage
            </div>
            <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-serif">
              "{citation.excerpt}"
            </p>
          </div>

          {/* Extended Document Information */}
          {loading ? (
            <div className="flex items-center justify-center py-6 text-slate-500 text-sm">
              <div className="w-5 h-5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin mr-2" />
              Loading authoritative document details...
            </div>
          ) : docDetails?.metadata ? (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-slate-500" />
                Document Metadata & Statutory Context
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                {docDetails.metadata.summary}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                <div>
                  <span className="text-slate-400 block">Jurisdiction:</span>
                  <span className="font-medium text-slate-800">{docDetails.metadata.jurisdiction}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Publication Date:</span>
                  <span className="font-medium text-slate-800">{docDetails.metadata.publication_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Effective Date:</span>
                  <span className="font-medium text-slate-800">{docDetails.metadata.effective_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Indexed Chunks:</span>
                  <span className="font-medium text-slate-800">{docDetails.metadata.chunk_count} verified chunks</span>
                </div>
              </div>

              {docDetails.metadata.url && (
                <a
                  href={docDetails.metadata.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:text-emerald-950 hover:underline pt-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View official portal ({docDetails.metadata.authority})
                </a>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Verified Authoritative Repository Chunk
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
