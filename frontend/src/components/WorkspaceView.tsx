import React, { useState, useEffect } from 'react';
import {
  FolderArchive,
  MessageSquare,
  FlaskConical,
  Bookmark,
  Trash2,
  ExternalLink,
  Download,
  Clock,
  Sparkles
} from 'lucide-react';
import { Conversation, ProductAnalysisResult } from '../types';
import { ActiveTab } from './Header';
import { DisclaimerBanner } from './DisclaimerBanner';
import { useTranslation } from '../context/LanguageContext';

interface WorkspaceViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ setActiveTab }) => {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [products, setProducts] = useState<ProductAnalysisResult[]>([]);
  const [savedResearch, setSavedResearch] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'conversations' | 'products' | 'bookmarks'>('conversations');

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const loadWorkspaceData = async () => {
    try {
      const [convRes, prodRes, savedRes] = await Promise.all([
        fetch('/api/conversations').catch(() => null),
        fetch('/api/products').catch(() => null),
        fetch('/api/workspace/saved-research').catch(() => null),
      ]);

      const convData =
        convRes && convRes.ok && convRes.headers.get('content-type')?.includes('application/json')
          ? await convRes.json()
          : [];
      const prodData =
        prodRes && prodRes.ok && prodRes.headers.get('content-type')?.includes('application/json')
          ? await prodRes.json()
          : [];
      const savedData =
        savedRes && savedRes.ok && savedRes.headers.get('content-type')?.includes('application/json')
          ? await savedRes.json()
          : [];

      setConversations(Array.isArray(convData) ? convData : []);
      setProducts(Array.isArray(prodData) ? prodData : []);
      setSavedResearch(Array.isArray(savedData) ? savedData : []);
    } catch (e) {
      console.warn('Failed to load workspace data:', e);
    }
  };

  const deleteSavedItem = async (id: string) => {
    try {
      await fetch(`/api/workspace/saved-research/${id}`, { method: 'DELETE' });
      setSavedResearch(savedResearch.filter(s => s.id !== id));
    } catch (e) {
      console.error('Failed to delete saved item:', e);
    }
  };

  const exportDossierJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
      exported_at: new Date().toISOString(),
      conversations,
      products,
      saved_research: savedResearch,
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `IP_SAKTI_Workspace_Dossier_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="w-full px-3 sm:px-5 lg:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-xs font-semibold">
            <FolderArchive className="w-3.5 h-3.5 text-emerald-700" />
            <span>Research Workspace</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">
            {t('workspace.title', 'My Workspace')}
          </h1>
          <p className="text-sm text-slate-600">
            {t('workspace.subtitle', 'Manage your past AYUSH research sessions, product evaluations, and bookmarked statutory provisions.')}
          </p>
        </div>

        <button
          type="button"
          id="workspace-export-dossier-btn"
          onClick={exportDossierJSON}
          className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-4 h-4 text-emerald-700" />
          <span>Export Research Dossier (JSON)</span>
        </button>
      </div>

      {/* Workspace Navigation Tabs */}
      <div id="workspace-subtabs-container" className="flex border-b border-slate-200 gap-4 sm:gap-6 text-xs sm:text-sm font-medium overflow-x-auto whitespace-nowrap pb-px">
        <button
          type="button"
          onClick={() => setActiveSubTab('conversations')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeSubTab === 'conversations'
              ? 'border-emerald-700 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Research Sessions ({conversations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('products')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeSubTab === 'products'
              ? 'border-emerald-700 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>Product Analyses ({products.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('bookmarks')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeSubTab === 'bookmarks'
              ? 'border-emerald-700 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span>Bookmarked Provisions ({savedResearch.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeSubTab === 'conversations' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {conversations.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-xs text-slate-400">
                No past research sessions found. Start a new query in Sahayak.
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(conv.updated_at).toLocaleDateString()}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold uppercase text-[10px]">
                        {conv.language}
                      </span>
                    </div>

                    <h3 className="font-semibold text-slate-900 text-sm line-clamp-2">
                      {conv.title}
                    </h3>

                    <p className="text-xs text-slate-500 line-clamp-2">
                      {conv.messages.length > 0
                        ? conv.messages[conv.messages.length - 1].content
                        : 'No messages yet.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">
                      {conv.messages.length} messages
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('chat')}
                      className="font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
                    >
                      <span>Open in Sahayak</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeSubTab === 'products' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-xs text-slate-400">
                No product analyses yet. Analyze a formulation in the Product Analyzer.
              </div>
            ) : (
              products.map((p) => (
                <div
                  key={p.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Product Dossier
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs">
                      {p.likely_category}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base">
                    {p.product_information.product_name}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-2 font-serif">
                    {p.category_reasoning}
                  </p>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('product')}
                      className="font-semibold text-slate-900 hover:text-emerald-800"
                    >
                      Inspect Analysis →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeSubTab === 'bookmarks' && (
          <div className="space-y-3">
            {savedResearch.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No saved research provisions yet. Click the bookmark icon in Research or Product Analyzer.
              </div>
            ) : (
              savedResearch.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-900 text-sm">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-500">{item.notes}</p>
                    <span className="text-[10px] text-slate-400">
                      Saved on {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteSavedItem(item.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                    title="Remove from workspace"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <DisclaimerBanner />
    </div>
  );
};
