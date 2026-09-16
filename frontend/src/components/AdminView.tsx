import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Plus,
  RefreshCw,
  Trash2,
  Activity,
  CheckCircle2,
  Clock,
  Shield,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { DocumentMetadata, RAGTelemetry } from '../types';
import { DisclaimerBanner } from './DisclaimerBanner';

export const AdminView: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [telemetry, setTelemetry] = useState<RAGTelemetry | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Document Form State
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocSource, setNewDocSource] = useState('Official Gazette of India');
  const [newDocAuthority, setNewDocAuthority] = useState('Ministry of AYUSH');
  const [newDocTopic, setNewDocTopic] = useState('AYUSH');
  const [newDocType, setNewDocType] = useState('Guidelines');
  const [newDocSummary, setNewDocSummary] = useState('');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [docsRes, telRes] = await Promise.all([
        fetch('/api/admin/documents').catch(() => null),
        fetch('/api/admin/telemetry').catch(() => null),
      ]);

      if (docsRes && docsRes.ok && docsRes.headers.get('content-type')?.includes('application/json')) {
        const docsData = await docsRes.json();
        setDocuments(Array.isArray(docsData) ? docsData : (docsData.documents || []));
      }

      if (telRes && telRes.ok && telRes.headers.get('content-type')?.includes('application/json')) {
        const telData = await telRes.json();
        setTelemetry(telData);
      }
    } catch (e) {
      console.warn('Failed to load admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    try {
      const res = await fetch('/api/admin/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newDocTitle,
          source: newDocSource,
          authority: newDocAuthority,
          topic: newDocTopic,
          document_type: newDocType,
          summary: newDocSummary,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setNewDocTitle('');
        setNewDocSummary('');
        loadAdminData();
      }
    } catch (err) {
      console.error('Failed to add document:', err);
    }
  };

  const handleReindex = async (id: string) => {
    try {
      await fetch(`/api/admin/documents/${id}/index`, { method: 'POST' });
      loadAdminData();
    } catch (e) {
      console.error('Re-indexing failed:', e);
    }
  };

  return (
    <div className="w-full px-3 sm:px-5 lg:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold">
            <Settings className="w-3.5 h-3.5" />
            <span>Administrative Control & Telemetry</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">
            Knowledge Base & RAG Management
          </h1>
          <p className="text-sm text-slate-600">
            Monitor hybrid vector-lexical retrieval performance, inspect statutory document chunks, and manage authoritative repositories.
          </p>
        </div>

        <button
          type="button"
          id="admin-add-document-btn"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Ingest New Statutory Document</span>
        </button>
      </div>

      {/* Telemetry Metrics Cards */}
      {telemetry && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Total RAG Queries</span>
              <Activity className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl font-bold text-slate-900 font-serif">
              {telemetry.total_queries}
            </div>
            <p className="text-[11px] text-emerald-700 font-medium">Hybrid Search Active (0.65 Sem / 0.35 BM25)</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Retrieval Latency</span>
              <Clock className="w-4 h-4 text-blue-700" />
            </div>
            <div className="text-2xl font-bold text-slate-900 font-serif">
              {telemetry.average_retrieval_latency_ms} ms
            </div>
            <p className="text-[11px] text-slate-500">Qdrant vector + BM25 inverted index</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Generation Latency</span>
              <Activity className="w-4 h-4 text-purple-700" />
            </div>
            <div className="text-2xl font-bold text-slate-900 font-serif">
              {telemetry.average_generation_latency_ms} ms
            </div>
            <p className="text-[11px] text-slate-500">Gemini 3.8 Flash grounded synthesis</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Researcher Feedback</span>
              <ThumbsUp className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl font-bold text-slate-900 font-serif flex items-center gap-3">
              <span className="text-emerald-700">{telemetry.feedback_stats.helpful} 👍</span>
              <span className="text-slate-400 text-lg">/</span>
              <span className="text-rose-700">{telemetry.feedback_stats.unhelpful} 👎</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Low-confidence queries: {telemetry.low_confidence_queries_count}
            </p>
          </div>
        </div>
      )}

      {/* Authoritative Documents Table */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 font-serif">
            Authoritative Legal Repositories ({documents.length})
          </h3>
          <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
            All Repositories Online
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-800 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Title & Statute</th>
                <th className="py-3 px-4">Authority</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Jurisdiction</th>
                <th className="py-3 px-4">Passages</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 max-w-xs truncate">
                    {doc.title}
                  </td>
                  <td className="py-3 px-4">{doc.authority}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                      {doc.document_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">{doc.jurisdiction}</td>
                  <td className="py-3 px-4 font-semibold text-emerald-800">
                    {doc.chunk_count}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-emerald-800 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {doc.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => handleReindex(doc.id)}
                      className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                      title="Re-index document"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent RAG Logs Table */}
      {telemetry && telemetry.recent_logs && telemetry.recent_logs.length > 0 && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 font-serif">
            Recent Grounded Query Logs
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Query</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Evidence Chunks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {telemetry.recent_logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 max-w-sm truncate">
                      {log.query}
                    </td>
                    <td className="py-3 px-4 font-mono">{log.latency_ms} ms</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.confidence === 'High' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {log.confidence}
                      </span>
                    </td>
                    <td className="py-3 px-4">{log.sources_retrieved} sources</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Document Ingestion Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base font-serif">
                Ingest New Authoritative Document
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddDocument} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Document Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Guidelines for Clinical Evaluation of AYUSH Interventions"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Authority</label>
                  <input
                    type="text"
                    value={newDocAuthority}
                    onChange={(e) => setNewDocAuthority(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Topic</label>
                  <input
                    type="text"
                    value={newDocTopic}
                    onChange={(e) => setNewDocTopic(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Statutory Summary / Text Excerpt</label>
                <textarea
                  rows={3}
                  placeholder="Summary of statutory provisions and relevance to AYUSH / IPR..."
                  value={newDocSummary}
                  onChange={(e) => setNewDocSummary(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                >
                  Save & Index
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DisclaimerBanner />
    </div>
  );
};
