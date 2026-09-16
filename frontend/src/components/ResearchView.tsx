import React, { useState, useEffect } from 'react';
import { authFetch } from './auth/authStorage';
import {
  BookOpen,
  Search,
  Filter,
  ExternalLink,
  Bookmark,
  FileText,
  ShieldCheck,
  Check,
  ChevronRight
} from 'lucide-react';
import { Citation, DocumentChunk, DocumentMetadata } from '../types';
import { DisclaimerBanner } from './DisclaimerBanner';
import { useTranslation } from '../context/LanguageContext';

interface ResearchViewProps {
  onOpenCitation: (citation: Citation) => void;
  onSaveBookmark?: (docId: string, title: string) => void;
}

export const ResearchView: React.FC<ResearchViewProps> = ({ onOpenCitation, onSaveBookmark }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState('ALL');
  const [authorityFilter, setAuthorityFilter] = useState('ALL');
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');

  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [matchingChunks, setMatchingChunks] = useState<DocumentChunk[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDocChunks, setSelectedDocChunks] = useState<DocumentChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (topicFilter !== 'ALL') params.set('topic', topicFilter);
      if (authorityFilter !== 'ALL') params.set('authority', authorityFilter);
      if (docTypeFilter !== 'ALL') params.set('document_type', docTypeFilter);

      const res = await authFetch(`/api/research/search?${params.toString()}`);
      const data = await res.json();
      setDocuments(data.documents || []);
      setMatchingChunks(data.matching_chunks || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [topicFilter, authorityFilter, docTypeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocuments();
  };

  const handleInspectDoc = async (id: string) => {
    setSelectedDocId(id);
    try {
      const res = await authFetch(`/api/documents/${id}`);
      const data = await res.json();
      setSelectedDocChunks(data.chunks || []);
    } catch (e) {
      console.error('Failed to inspect document chunks:', e);
    }
  };

  const handleSaveToWorkspace = async (doc: DocumentMetadata) => {
    try {
      await authFetch('/api/workspace/save-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: doc.id,
          title: doc.title,
          notes: `Authority: ${doc.authority}. Jurisdiction: ${doc.jurisdiction}.`,
        }),
      });
      setSavedDocId(doc.id);
      setTimeout(() => setSavedDocId(null), 2500);
      if (onSaveBookmark) onSaveBookmark(doc.id, doc.title);
    } catch (err) {
      console.error('Failed to save bookmark:', err);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-xs font-semibold">
          <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
          <span>Statutory Knowledge Base & Legislative Library</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-slate-900">
          {t('research.title', 'Authoritative Research Repository')}
        </h1>
        <p className="text-sm text-slate-600 max-w-3xl">
          {t('research.subtitle', 'Search indexed Indian statutes, treaties, and official guidelines from IP India (CGPDTM), the Ministry of AYUSH, the National Biodiversity Authority (NBA), CSIR-TKDL, and WIPO.')}
        </p>
      </div>

      {/* Search Bar & Filter Controls */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              id="research-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by keywords, sections (e.g. '3(p)', 'Rule 158-B', 'Form III', 'Synergy', 'Schedule T')..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
            />
          </div>
          <button
            type="submit"
            id="research-search-btn"
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>Search</span>
          </button>
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="ALL">All Topics</option>
            <option value="IPR">IPR & Patents</option>
            <option value="AYUSH">AYUSH Regulations</option>
            <option value="Traditional Knowledge">Traditional Knowledge & TKDL</option>
            <option value="Biological Resources & ABS">Biological Resources & ABS</option>
            <option value="Regulatory & GMP">GMP & Schedule T</option>
          </select>

          <select
            value={authorityFilter}
            onChange={(e) => setAuthorityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="ALL">All Authorities</option>
            <option value="IP India">IP India (CGPDTM)</option>
            <option value="AYUSH">Ministry of AYUSH</option>
            <option value="National Biodiversity Authority">NBA (Biodiversity)</option>
            <option value="CSIR">CSIR-TKDL</option>
            <option value="WIPO">WIPO</option>
            <option value="FSSAI">FSSAI</option>
          </select>

          <select
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="ALL">All Document Types</option>
            <option value="Act">Statutory Acts</option>
            <option value="Rules">Rules & Schedules</option>
            <option value="Guidelines">Guidelines & Manuals</option>
            <option value="Treaty">International Treaties</option>
            <option value="Regulation">Regulations</option>
          </select>

          {(topicFilter !== 'ALL' || authorityFilter !== 'ALL' || docTypeFilter !== 'ALL' || query) && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setTopicFilter('ALL');
                setAuthorityFilter('ALL');
                setDocTypeFilter('ALL');
              }}
              className="text-xs text-emerald-800 hover:underline font-semibold ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Document Cards List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
            <span>Showing {documents.length} Authoritative Statutes</span>
            {matchingChunks.length > 0 && (
              <span className="text-emerald-700">{matchingChunks.length} matching passages</span>
            )}
          </div>

          {documents.map((doc) => {
            const isSelected = selectedDocId === doc.id;
            return (
              <div
                key={doc.id}
                id={`doc-card-${doc.id}`}
                className={`p-5 rounded-2xl bg-white border transition-all ${
                  isSelected
                    ? 'border-emerald-700 shadow-md ring-1 ring-emerald-700'
                    : 'border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200 uppercase">
                        {doc.document_type}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {doc.authority}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 line-clamp-1">
                      {doc.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveToWorkspace(doc)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Bookmark document"
                  >
                    {savedDocId === doc.id ? (
                      <Check className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <Bookmark className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mt-2 font-serif">
                  {doc.summary}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{doc.jurisdiction}</span>
                    <span>•</span>
                    <span>{doc.publication_date}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold">{doc.chunk_count} passages</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleInspectDoc(doc.id)}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-emerald-800 transition-colors"
                  >
                    <span>Inspect Sections</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Document Passages Inspector Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs sticky top-20">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-700" />
              Indexed Statutory Sections
            </h3>

            {selectedDocId && selectedDocChunks.length > 0 ? (
              <div className="space-y-3 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
                {selectedDocChunks.map((chunk, idx) => (
                  <div
                    key={chunk.chunk_id}
                    onClick={() =>
                      onOpenCitation({
                        index: idx + 1,
                        chunk_id: chunk.chunk_id,
                        document_id: chunk.document_id,
                        title: chunk.title,
                        authority: chunk.authority,
                        section: chunk.section,
                        source: chunk.source,
                        excerpt: chunk.chunk_text,
                        page: chunk.page,
                      })
                    }
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-emerald-50/50 hover:border-emerald-300 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-900 group-hover:text-emerald-950 mb-1">
                      <span>{chunk.section}</span>
                      <span className="text-[10px] text-slate-400">Page {chunk.page}</span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-3 font-serif">
                      "{chunk.chunk_text}"
                    </p>
                    <span className="text-[10px] text-emerald-700 font-medium block mt-1">
                      Click to view full statutory context →
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <FileText className="w-8 h-8 mx-auto text-slate-300" />
                <p>Select any statute to view its indexed provisions and sections.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <DisclaimerBanner />
    </div>
  );
};
