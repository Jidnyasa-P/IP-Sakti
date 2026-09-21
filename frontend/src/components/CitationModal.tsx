import React, { useEffect, useState } from 'react';
import { X, ExternalLink, BookOpen, ShieldCheck, FileText } from 'lucide-react';
import { Citation, DocumentMetadata, DocumentChunk } from '../types';
import { authFetch } from './auth/authStorage';

interface CitationModalProps {
  citation: Citation | null;
  onClose: () => void;
}

export const CitationModal: React.FC<CitationModalProps> = ({ citation, onClose }) => {
  const [docDetails, setDocDetails] = useState<{ metadata: DocumentMetadata; chunks: DocumentChunk[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sourcePdfLoading, setSourcePdfLoading] = useState(false);

  // NEW: opens the real ingested source PDF. Uses authFetch + a blob URL
  // rather than a plain <a href> -- a normal browser navigation to a
  // protected URL can't attach the Authorization header, so a direct link
  // to this endpoint would just 401 (the same bug class fixed elsewhere in
  // this app: see PATCHES.md from an earlier round of fixes).
  const handleViewSourcePdf = async (documentId: string) => {
    setSourcePdfLoading(true);
    try {
      const res = await authFetch(`/api/documents/${documentId}/source`);
      if (!res.ok) {
        throw new Error(`Source PDF not available (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      // Revoke after a delay rather than immediately -- the new tab needs
      // the blob URL to still be valid by the time it finishes loading it.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      console.error('Failed to open source PDF:', err);
      alert('Could not open the source PDF. It may not have been ingested yet, or the RAG service may be temporarily unavailable.');
    } finally {
      setSourcePdfLoading(false);
    }
  };

  useEffect(() => {
    if (!citation) return;
    setLoading(true);
    authFetch(`/api/documents/${citation.document_id}`)
      .then(res => (res.ok ? res.json() : null))
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

  // IMPORTANT: the official citation URL must come from manifest.json only.
  // /api/documents/{document_id} is backed by ip_sakti_rag's manifest-loaded
  // DocumentMetadata, so this avoids any frontend-hardcoded legal URLs.
  const officialUrl = docDetails?.metadata?.url || "";

  // FIXED: this used to always render `citation.excerpt`, which is
  // deliberately truncated to 400 characters server-side (see
  // ip_sakti_rag/app/retrieval/hybrid.py's _EXCERPT_CHARS) -- that's the
  // right length for the small inline citation card in a chat message, but
  // not for this modal, whose whole point is to let someone read the full
  // cited passage. `/api/documents/{document_id}` (already being fetched
  // above for the metadata section) returns every chunk for that document
  // with its COMPLETE, untruncated chunk_text -- so instead of a second
  // network call, we just find the one matching this citation's chunk_id
  // and prefer its full text, falling back to the short excerpt only while
  // that request is still loading or if it fails.
  const fullChunk = docDetails?.chunks.find(c => c.chunk_id === citation.chunk_id);
  const passageText = fullChunk?.chunk_text ?? citation.excerpt;
  const isFullText = Boolean(fullChunk?.chunk_text);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="citation-inspector-modal"
        className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-700 text-white font-semibold text-xs">
              [{citation.index}]
            </span>
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base line-clamp-1">
              {citation.title}
            </h3>
          </div>
          <button
            id="close-citation-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Metadata chips & Official Link Action */}
          <div className="flex flex-wrap items-center justify-between gap-2">
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

            <div className="flex flex-wrap gap-2 shrink-0">
              {/* Links to the actual PDF we ingested (verification that this
                  citation traces to a specific file we indexed) and to the
                  official government source -- two separate, distinct
                  verification links as requested. */}
              <button
                type="button"
                onClick={() => handleViewSourcePdf(citation.document_id)}
                disabled={sourcePdfLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-xs shadow-2xs transition-colors"
                title="Open the actual PDF this citation was indexed from"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{sourcePdfLoading ? 'Loading PDF...' : 'View Source PDF'}</span>
              </button>
              {officialUrl && (
                <a
                  href={officialUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs shadow-2xs transition-colors"
                  title="Visit the official source recorded in manifest.json"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Official Source from Manifest</span>
                </a>
              )}
            </div>
          </div>

          {/* Cited Passage */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <FileText className="w-4 h-4 text-emerald-700" />
                Retrieved Statutory Passage
              </div>
              {loading && !fullChunk && (
                <span className="text-[11px] text-slate-400 italic">Loading full section text...</span>
              )}
              {!loading && !isFullText && (
                <span className="text-[11px] text-amber-600 italic">Showing short excerpt only -- full section unavailable</span>
              )}
            </div>
            <div className="text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-serif max-h-72 overflow-y-auto">
              "{passageText}"
            </div>
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
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
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
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Verified Authoritative Repository Chunk
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium transition-colors ml-auto sm:ml-0"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
