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
  Sparkles,
  Bell,
  X,
  AlertCircle,
} from 'lucide-react';
import { Conversation, ProductAnalysisResult, Grievance } from '../types';
import { ActiveTab } from './Header';
import { DisclaimerBanner } from './DisclaimerBanner';
import { useTranslation } from '../context/LanguageContext';
import { authFetch } from './auth/authStorage';
import { useAuth } from '../context/AuthContext';

const LOCAL_STORAGE_CONVS_KEY = 'ipsakti_sahayak_conversations_v2';
const LOCAL_STORAGE_ACTIVE_KEY = 'ipsakti_sahayak_active_conv_id_v2';
const LOCAL_STORAGE_ACTIVE_INDIA_KEY = 'ipsakti_sahayak_active_india_id';
const LOCAL_STORAGE_ACTIVE_INTL_KEY = 'ipsakti_sahayak_active_intl_id';
const LOCAL_STORAGE_DELETED_CONVS_KEY = 'ipsakti_sahayak_deleted_conversation_ids_v1';

function scopedStorageKey(baseKey: string, userId?: string): string {
  return `${baseKey}:${userId || 'guest'}`;
}

function rememberDeletedConversationIds(ids: string[], userId?: string) {
  if (typeof window === 'undefined' || ids.length === 0) return;
  try {
    const raw = localStorage.getItem(scopedStorageKey(LOCAL_STORAGE_DELETED_CONVS_KEY, userId));
    const parsed = raw ? JSON.parse(raw) : [];
    const deleted = new Set<string>(Array.isArray(parsed) ? parsed.map(String) : []);
    ids.forEach((id) => deleted.add(String(id)));
    localStorage.setItem(scopedStorageKey(LOCAL_STORAGE_DELETED_CONVS_KEY, userId), JSON.stringify([...deleted]));
  } catch {}
}

function clearDeletedConversationClientState(userId?: string) {
  try {
    localStorage.setItem(scopedStorageKey(LOCAL_STORAGE_CONVS_KEY, userId), JSON.stringify([]));
    localStorage.removeItem(scopedStorageKey(LOCAL_STORAGE_ACTIVE_KEY, userId));
    localStorage.removeItem(scopedStorageKey(LOCAL_STORAGE_ACTIVE_INDIA_KEY, userId));
    localStorage.removeItem(scopedStorageKey(LOCAL_STORAGE_ACTIVE_INTL_KEY, userId));
  } catch {}
}

interface WorkspaceViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  openGrievanceOnLoad?: {
    conversationId?: string;
    messageId?: string;
    query?: string;
    response?: string;
  } | null;
  onGrievanceOpened?: () => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  setActiveTab,
  openGrievanceOnLoad,
  onGrievanceOpened,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const userId = currentUser?.id;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [products, setProducts] = useState<ProductAnalysisResult[]>([]);
  const [savedResearch, setSavedResearch] = useState<any[]>([]);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [grievanceModalOpen, setGrievanceModalOpen] = useState(false);
  const [grievanceSubmitting, setGrievanceSubmitting] = useState(false);
  const [grievanceError, setGrievanceError] = useState<string | null>(null);
  const [grievanceForm, setGrievanceForm] = useState({
    category: 'Low-confidence AI response',
    subject: '',
    description: '',
    conversationId: '',
    messageId: '',
    relatedQuery: '',
  });
  // NEW: this view had no loading state at all -- while the 3 parallel
  // fetches were in flight (which can take a while on free-tier hosting,
  // see the message below), the page just showed empty "no items found"
  // messages, which looks identical to a broken/frozen page. Now shows an
  // actual spinner instead.
  const [isLoading, setIsLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'conversations' | 'products' | 'bookmarks' | 'notifications' | 'grievances'>('conversations');

  useEffect(() => {
    if (userId) loadWorkspaceData();
    else {
      setConversations([]);
      setProducts([]);
      setSavedResearch([]);
      setGrievances([]);
    }
  }, [userId]);

  const loadWorkspaceData = async () => {
    setIsLoading(true);
    try {
      const [convRes, prodRes, savedRes, grievanceRes] = await Promise.all([
        authFetch('/api/conversations').catch(() => null),
        authFetch('/api/products').catch(() => null),
        authFetch('/api/workspace/saved-research').catch(() => null),
        authFetch('/api/workspace/grievances').catch(() => null),
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
      const grievanceData =
        grievanceRes && grievanceRes.ok && grievanceRes.headers.get('content-type')?.includes('application/json')
          ? await grievanceRes.json()
          : [];

      setConversations(Array.isArray(convData) ? convData : []);
      setProducts(Array.isArray(prodData) ? prodData : []);
      setSavedResearch(Array.isArray(savedData) ? savedData : []);
      setGrievances(Array.isArray(grievanceData) ? grievanceData : []);
    } catch (e) {
      console.warn('Failed to load workspace data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!openGrievanceOnLoad) return;
    setActiveSubTab('grievances');
    setGrievanceForm({
      category: openGrievanceOnLoad.query || openGrievanceOnLoad.response ? 'Low-confidence AI response' : 'General query',
      subject: openGrievanceOnLoad.query
        ? `Concern about response: ${openGrievanceOnLoad.query.slice(0, 80)}`
        : '',
      description: openGrievanceOnLoad.response
        ? `I would like this response to be reviewed.\n\nAI response:\n${openGrievanceOnLoad.response}`
        : '',
      conversationId: openGrievanceOnLoad.conversationId || '',
      messageId: openGrievanceOnLoad.messageId || '',
      relatedQuery: openGrievanceOnLoad.query || '',
    });
    setGrievanceError(null);
    setGrievanceModalOpen(true);
    onGrievanceOpened?.();
  }, [openGrievanceOnLoad]);

  const openBlankGrievanceForm = () => {
    setActiveSubTab('grievances');
    setGrievanceForm({
      category: 'General query',
      subject: '',
      description: '',
      conversationId: '',
      messageId: '',
      relatedQuery: '',
    });
    setGrievanceError(null);
    setGrievanceModalOpen(true);
  };

  const submitGrievance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grievanceForm.subject.trim() || !grievanceForm.description.trim()) {
      setGrievanceError('Please enter a subject and describe your query or grievance.');
      return;
    }
    setGrievanceSubmitting(true);
    setGrievanceError(null);
    try {
      const res = await authFetch('/api/workspace/grievances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: grievanceForm.category.trim(),
          subject: grievanceForm.subject.trim(),
          description: grievanceForm.description.trim(),
          conversation_id: grievanceForm.conversationId || undefined,
          message_id: grievanceForm.messageId || undefined,
          related_query: grievanceForm.relatedQuery || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || 'Unable to submit the grievance.');
      }
      setGrievances((prev) => [data, ...prev]);
      setGrievanceModalOpen(false);
    } catch (err) {
      setGrievanceError(err instanceof Error ? err.message : 'Unable to submit the grievance.');
    } finally {
      setGrievanceSubmitting(false);
    }
  };

  const deleteGrievance = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this grievance? This cannot be undone.')) return;

    setGrievances((prev) => prev.filter((g) => g.id !== id));
    try {
      const res = await authFetch(`/api/workspace/grievances/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Delete failed with status ${res.status}`);
      }
    } catch (err) {
      console.error('Failed to delete grievance:', err);
      await loadWorkspaceData();
    }
  };

  const deleteSavedItem = async (id: string) => {
    try {
      await authFetch(`/api/workspace/saved-research/${id}`, { method: 'DELETE' });
      setSavedResearch(savedResearch.filter(s => s.id !== id));
    } catch (e) {
      console.error('Failed to delete saved item:', e);
    }
  };

  // NEW: Research Sessions had no delete option at all, so sessions could
  // only ever accumulate here (including any that briefly appeared from the
  // now-fixed blank-conversation bug in ChatView/backend). Deletes both the
  // server record and its messages, then removes it from view immediately.
  const deleteConversationItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this research session? This cannot be undone.')) return;

    rememberDeletedConversationIds([id], userId);
    setConversations((prev) => prev.filter((c) => String(c.id) !== String(id)));

    try {
      const res = await authFetch(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || `Delete failed with status ${res.status}`);
      }

      // Remove every browser-side copy. Backend tombstones are the permanent
      // source of truth, while this cache prevents an already-mounted Chat
      // view from restoring the deleted session before the next sync.
      try {
        const cached = localStorage.getItem(scopedStorageKey(LOCAL_STORAGE_CONVS_KEY, userId));
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            localStorage.setItem(scopedStorageKey(LOCAL_STORAGE_CONVS_KEY, userId), JSON.stringify(parsed.filter((c: any) => String(c?.id) !== String(id))));
          }
        }
        for (const baseKey of [LOCAL_STORAGE_ACTIVE_KEY, LOCAL_STORAGE_ACTIVE_INDIA_KEY, LOCAL_STORAGE_ACTIVE_INTL_KEY]) {
          const key = scopedStorageKey(baseKey, userId);
          if (localStorage.getItem(key) === id) localStorage.removeItem(key);
        }
      } catch {}

      await loadWorkspaceData();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      await loadWorkspaceData();
    }
  };

  const deleteAllConversationItems = async () => {
    if (conversations.length === 0) return;
    if (!window.confirm('Remove all research sessions? This permanently deletes all chat sessions and their messages.')) return;

    rememberDeletedConversationIds(conversations.map((c) => String(c.id)), userId);
    setConversations([]);
    clearDeletedConversationClientState(userId);

    try {
      const res = await authFetch('/api/conversations', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || `Delete all failed with status ${res.status}`);
      }
      await loadWorkspaceData();
    } catch (err) {
      console.error('Failed to remove all research sessions:', err);
      await loadWorkspaceData();
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

  // NEW: shown instead of the whole page while the 3 workspace fetches are
  // in flight. See the note in the message itself for why this can take a
  // while -- worth setting the expectation rather than leaving it silent.
  if (isLoading) {
    return (
      <div className="w-full px-3 sm:px-5 lg:px-6 py-20 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-10 h-10 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" />
        <div className="space-y-1 max-w-sm">
          <p className="text-sm font-semibold text-slate-700">Loading your workspace...</p>
          <p className="text-xs text-slate-400">
            This can take up to a minute or two the first time, if the backend has
            been idle for a while and needs to wake back up.
          </p>
        </div>
      </div>
    );
  }

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

        <button
  type="button"
  onClick={() => setActiveSubTab('notifications')}
  className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
    activeSubTab === 'notifications'
      ? 'border-emerald-700 text-slate-900 font-bold'
      : 'border-transparent text-slate-500 hover:text-slate-800'
  }`}
>
  <Bell className="w-4 h-4" />

  <span>Notifications ({Notification.length})</span>
</button>
        <button
          type="button"
          onClick={() => setActiveSubTab('grievances')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeSubTab === 'grievances'
              ? 'border-emerald-700 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>Grievances ({grievances.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeSubTab === 'conversations' && (
          <>
            {conversations.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={deleteAllConversationItems}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
                  title="Permanently remove all research sessions"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove All
                </button>
              </div>
            )}
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
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => deleteConversationItem(e, conv.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete research session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                </div>
              ))
            )}
            </div>
          </>
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

        {activeSubTab === 'notifications' && (
  <div className="mt-6">

    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">

      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">

          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Bell className="w-5 h-5 text-emerald-700" />
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900">
              Notifications
            </h2>

            <p className="text-xs text-slate-500 mt-0.5">
              Stay updated with your latest notifications
            </p>
          </div>

        </div>
      </div>

      {/* Notifications List */}
      <div className="divide-y divide-slate-100">

        {/* Notification 1 */}
        <div className="px-5 py-4 hover:bg-slate-50 transition-colors">
          <div className="flex gap-3">

            <span className="w-2 h-2 mt-1.5 rounded-full bg-emerald-600 shrink-0" />

            <div className="flex-1 min-w-0">

              <h3 className="text-sm font-semibold text-slate-900">
                Welcome to IP-SAKTI Sahayak
              </h3>

              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Your account has been successfully created.
              </p>

              <p className="text-[10px] text-slate-400 mt-2">
                Just now
              </p>

            </div>
          </div>
        </div>

        {/* Notification 2 */}
        <div className="px-5 py-4 hover:bg-slate-50 transition-colors">
          <div className="flex gap-3">

            <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" />

            <div className="flex-1 min-w-0">

              <h3 className="text-sm font-semibold text-slate-900">
                New guidance available
              </h3>

              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                New information is available for your recent query.
              </p>

              <p className="text-[10px] text-slate-400 mt-2">
                10 minutes ago
              </p>

            </div>
          </div>
        </div>

        {/* Notification 3 */}
        <div className="px-5 py-4 hover:bg-slate-50 transition-colors">
          <div className="flex gap-3">

            <span className="w-2 h-2 mt-1.5 rounded-full bg-amber-500 shrink-0" />

            <div className="flex-1 min-w-0">

              <h3 className="text-sm font-semibold text-slate-900">
                System update
              </h3>

              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                IP-SAKTI Sahayak has received a new system update.
              </p>

              <p className="text-[10px] text-slate-400 mt-2">
                1 hour ago
              </p>

            </div>
          </div>
        </div>

        {/* Notification 4 */}
        <div className="px-5 py-4 hover:bg-slate-50 transition-colors">
          <div className="flex gap-3">

            <span className="w-2 h-2 mt-1.5 rounded-full bg-purple-500 shrink-0" />

            <div className="flex-1 min-w-0">

              <h3 className="text-sm font-semibold text-slate-900">
                Expert guidance request updated
              </h3>

              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Your expert guidance request has been updated.
              </p>

              <p className="text-[10px] text-slate-400 mt-2">
                2 hours ago
              </p>

            </div>
          </div>
        </div>

        {/* Notification 5 */}
        <div className="px-5 py-4 hover:bg-slate-50 transition-colors">
          <div className="flex gap-3">

            <span className="w-2 h-2 mt-1.5 rounded-full bg-orange-500 shrink-0" />

            <div className="flex-1 min-w-0">

              <h3 className="text-sm font-semibold text-slate-900">
                New FAQ available
              </h3>

              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                New frequently asked questions have been added.
              </p>

              <p className="text-[10px] text-slate-400 mt-2">
                Yesterday
              </p>

            </div>
          </div>
        </div>

      </div>

    </div>

  </div>
)}

        {activeSubTab === 'grievances' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Grievances & Queries</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Submit a query or report a concern. Your submitted grievances are stored here.
                </p>
              </div>
              <button
                type="button"
                onClick={openBlankGrievanceForm}
                className="px-4 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 transition-colors whitespace-nowrap"
              >
                Raise Your Query
              </button>
            </div>

            {grievances.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-2xl">
                No grievances have been submitted yet.
              </div>
            ) : (
              <div className="space-y-3">
                {grievances.map((g) => (
                  <div key={g.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {g.category}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                            {g.status}
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-900 text-sm mt-2">{g.subject}</h3>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {g.created_at ? new Date(g.created_at).toLocaleString() : ''}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => deleteGrievance(e, g.id)}
                          title="Delete grievance"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-3 whitespace-pre-wrap">{g.description}</p>
                    {g.related_query && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Related query</p>
                        <p className="text-xs text-slate-700 mt-1">{g.related_query}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {grievanceModalOpen && (
              <div className="fixed inset-0 z-[80] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Raise Your Query</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Provide the details so your query can be recorded and reviewed.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGrievanceModalOpen(false)}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      aria-label="Close grievance form"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={submitGrievance} className="p-5 space-y-4">
                    {grievanceError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                        {grievanceError}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Query Type</label>
                      <select
                        value={grievanceForm.category}
                        onChange={(e) => setGrievanceForm((f) => ({ ...f, category: e.target.value }))}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      >
                        <option>Low-confidence AI response</option>
                        <option>Incorrect or incomplete information</option>
                        <option>Source or citation concern</option>
                        <option>Technical issue</option>
                        <option>General query</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Subject</label>
                      <input
                        required
                        maxLength={160}
                        value={grievanceForm.subject}
                        onChange={(e) => setGrievanceForm((f) => ({ ...f, subject: e.target.value }))}
                        placeholder="Briefly describe your query"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>

                    {grievanceForm.relatedQuery && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Related Chat Query</label>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                          {grievanceForm.relatedQuery}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Describe Your Query / Grievance</label>
                      <textarea
                        required
                        maxLength={5000}
                        rows={6}
                        value={grievanceForm.description}
                        onChange={(e) => setGrievanceForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Explain what you need reviewed or what went wrong..."
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setGrievanceModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={grievanceSubmitting}
                        className="px-5 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 disabled:opacity-60"
                      >
                        {grievanceSubmitting ? 'Submitting...' : 'Submit Query'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <DisclaimerBanner />
    </div>
  );
};
