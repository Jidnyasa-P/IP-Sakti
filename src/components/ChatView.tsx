import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Plus,
  Trash2,
  Bookmark,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Info,
  CornerDownRight,
  RefreshCw,
  Search,
  MessageSquare
} from 'lucide-react';
import { Citation, ConfidenceLevel, Conversation, Language, StructuredChatMessage } from '../types';
import { VoiceInputButton } from './VoiceInputButton';
import { DisclaimerBanner } from './DisclaimerBanner';
import { useTranslation } from '../context/LanguageContext';

interface ChatViewProps {
  language: Language;
  onOpenCitation: (citation: Citation) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ language, onOpenCitation }) => {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('');
  const [messages, setMessages] = useState<StructuredChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    t('chat.suggested_1', 'Can an Ayurvedic formulation combining Ashwagandha and Turmeric extract be patented in India?'),
    t('chat.suggested_2', 'What is the difference between a patent and a traditional knowledge disclosure under TKDL?'),
    t('chat.suggested_3', 'What statutory approvals are required from the National Biodiversity Authority for exporting neem extract?'),
    t('chat.suggested_4', 'What are the mandatory Schedule T Good Manufacturing Practices for Ayurvedic medicines?'),
  ];

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      const data: Conversation[] = await res.json();
      setConversations(data);
      if (data.length > 0 && !activeConvId) {
        setActiveConvId(data[0].id);
        setMessages(data[0].messages || []);
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data: Conversation = await res.json();
      setActiveConvId(id);
      setMessages(data.messages || []);
    } catch (e) {
      console.error('Failed to load conversation:', e);
    }
  };

  const startNewConversation = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New AYUSH & IP Session', language }),
      });
      const newConv: Conversation = await res.json();
      setConversations([newConv, ...conversations]);
      setActiveConvId(newConv.id);
      setMessages([]);
    } catch (e) {
      console.error('Failed to create new conversation:', e);
    }
  };

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      const updated = conversations.filter(c => c.id !== id);
      setConversations(updated);
      if (activeConvId === id) {
        if (updated.length > 0) {
          loadConversation(updated[0].id);
        } else {
          setActiveConvId('');
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  // Send query with streaming response
  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputValue;
    if (!textToSend.trim() || loading) return;

    setInputValue('');
    setLoading(true);
    setStreamingText('');

    const tempUserMsg: StructuredChatMessage = {
      id: `msg-u-${Date.now()}`,
      conversation_id: activeConvId,
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // Use SSE streaming endpoint for live research retrieval & token rendering
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
          conversation_id: activeConvId,
          language,
        }),
      });

      if (!response.body) throw new Error('Readable stream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunkStr = decoder.decode(value);
          const lines = chunkStr.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (!dataStr) continue;

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === 'token') {
                  accumulated += parsed.token;
                  setStreamingText(accumulated);
                } else if (parsed.type === 'done') {
                  const finalMsg: StructuredChatMessage = parsed.message;
                  setMessages(prev => [...prev.filter(m => m.id !== 'temp-assistant'), finalMsg]);
                  setStreamingText('');
                  if (parsed.conversation_id && !activeConvId) {
                    setActiveConvId(parsed.conversation_id);
                  }
                  fetchConversations();
                }
              } catch (parseErr) {
                // Ignore chunk parse edges
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Streaming interrupted, recovering with synchronous chat:', err);
      // Direct request to standard POST /api/chat
      try {
        const syncRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: textToSend,
            conversation_id: activeConvId,
            language,
          }),
        });
        const syncData = await syncRes.json();
        if (syncData.message) {
          setMessages(prev => [...prev, syncData.message]);
          fetchConversations();
        }
      } catch (syncErr) {
        console.error('Failed to generate response:', syncErr);
      }
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  };

  const copyResponse = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2500);
  };

  const handleFeedback = async (msgId: string, feedback: 'helpful' | 'unhelpful') => {
    try {
      await fetch(`/api/conversations/${activeConvId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: msgId, feedback }),
      });
      setMessages(prev =>
        prev.map(m => (m.id === msgId ? { ...m, feedback } : m))
      );
    } catch (e) {
      console.error('Feedback error:', e);
    }
  };

  const renderConfidenceBadge = (confidence?: { level: ConfidenceLevel; score: number; reasons: string[] }) => {
    if (!confidence) return null;
    const { level, reasons } = confidence;

    let badgeClasses = 'bg-slate-100 text-slate-700 border-slate-200';
    let icon = <Info className="w-3.5 h-3.5 text-slate-500" />;

    if (level === 'High') {
      badgeClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      icon = <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />;
    } else if (level === 'Moderate') {
      badgeClasses = 'bg-blue-50 text-blue-800 border-blue-200';
      icon = <Info className="w-3.5 h-3.5 text-blue-700" />;
    } else if (level === 'Low') {
      badgeClasses = 'bg-amber-50 text-amber-800 border-amber-200';
      icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />;
    } else {
      badgeClasses = 'bg-rose-50 text-rose-800 border-rose-200';
      icon = <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />;
    }

    return (
      <div className="group relative inline-flex items-center">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${badgeClasses} cursor-help`}
        >
          {icon}
          <span>Evidence Confidence: <strong>{level}</strong></span>
        </span>

        {reasons && reasons.length > 0 && (
          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl z-30 space-y-1">
            <p className="font-semibold text-slate-300">Confidence Determination:</p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchHistory.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-4.25rem)] w-full max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1560px] mx-auto overflow-hidden bg-slate-50 border-x border-slate-200">
      {/* Sidebar / Conversation History */}
      <aside
        id="chat-history-sidebar"
        className={`${
          sidebarOpen ? 'w-72 sm:w-80' : 'w-0'
        } shrink-0 bg-white border-r border-slate-200 transition-all duration-300 flex flex-col overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            id="new-chat-btn"
            onClick={startNewConversation}
            className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Research Session</span>
          </button>
        </div>

        {/* Search Past Sessions */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchHistory}
              onChange={e => setSearchHistory(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No saved sessions found.
            </div>
          ) : (
            filteredConversations.map(c => {
              const isActive = c.id === activeConvId;
              return (
                <div
                  key={c.id}
                  onClick={() => loadConversation(c.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-medium'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-1">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <span className="truncate">{c.title}</span>
                  </div>
                  <button
                    type="button"
                    title="Delete session"
                    onClick={e => deleteConversation(e, c.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer info */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            RAG Hybrid Index Active
          </span>
          <span className="text-slate-400">v2.4</span>
        </div>
      </aside>

      {/* Main Assistant Chat Canvas */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {/* Chat Header Toolbar */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
              title="Toggle sidebar"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Sahayak Research Assistant
              </h2>
              <p className="text-[11px] text-slate-500">
                Authoritative IPR, AYUSH, Traditional Knowledge & ABS Decision Support
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
              Lang: {language.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 ? (
            /* Empty State with Suggested Research Questions */
            <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 mx-auto flex items-center justify-center shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-serif font-bold text-slate-900">
                  {t('chat.header_title', 'Ask Sahayak')}
                </h3>
                <p className="text-sm text-slate-600 max-w-lg mx-auto">
                  {t('chat.header_subtitle', 'Submit inquiries on patentability under Sections 3(p) & 3(e), Ayurvedic formulation licensing, NBA Form III approvals, or TKDL prior art.')}
                </p>
              </div>

              {/* Suggested Questions Grid */}
              <div className="space-y-2 pt-2 text-left max-w-xl mx-auto">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
                  {t('chat.suggested_title', 'Suggested Research Inquiries')}:
                </p>
                <div className="space-y-2">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(q)}
                      className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-emerald-700/50 hover:bg-emerald-50/40 text-xs font-medium text-slate-800 transition-all flex items-center justify-between group shadow-2xs"
                    >
                      <span>{q}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>

              <DisclaimerBanner compact />
            </div>
          ) : (
            /* Active Conversation Thread */
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* Message Bubble */}
                <div
                  className={`max-w-3xl rounded-2xl p-5 shadow-xs ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-900 space-y-4'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  ) : (
                    /* Structured AI Response Design (Section 5) */
                    <div className="space-y-4">
                      {/* 1. Answer Header & Text */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            Grounded Answer
                          </span>
                          {renderConfidenceBadge(msg.confidence)}
                        </div>
                        <p className="text-sm text-slate-800 leading-relaxed font-serif">
                          {msg.answer || msg.content}
                        </p>
                      </div>

                      {/* 2. Relevant Considerations */}
                      {msg.relevant_considerations && msg.relevant_considerations.length > 0 && (
                        <div className="pt-3 border-t border-slate-100">
                          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            {t('chat.relevant_considerations', 'Relevant Statutory Considerations')}
                          </h4>
                          <ul className="space-y-1.5">
                            {msg.relevant_considerations.map((item, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-xs text-slate-700 leading-normal"
                              >
                                <span className="text-emerald-700 font-bold shrink-0 mt-0.5">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 3. Recommended Next Steps */}
                      {msg.recommended_next_steps && msg.recommended_next_steps.length > 0 && (
                        <div className="pt-3 border-t border-slate-100">
                          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <CornerDownRight className="w-3.5 h-3.5 text-slate-500" />
                            {t('chat.recommended_next_steps', 'Recommended Next Steps')}
                          </h4>
                          <ol className="space-y-1.5">
                            {msg.recommended_next_steps.map((step, i) => (
                              <li
                                key={i}
                                className="text-xs text-slate-700 flex items-start gap-2 leading-normal"
                              >
                                <span className="font-semibold text-slate-900 shrink-0">
                                  {i + 1}.
                                </span>
                                <span>{step.replace(/^\d+\.\s*/, '')}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* 4. Evidence / Authoritative Sources */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="pt-3 border-t border-slate-100">
                          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                            {t('chat.citations_heading', 'Authoritative Citations & Legal Provisions')} ({msg.citations.length})
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {msg.citations.map((cite) => (
                              <div
                                key={cite.chunk_id}
                                onClick={() => onOpenCitation(cite)}
                                className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-emerald-50/50 hover:border-emerald-300 transition-colors cursor-pointer text-left group"
                              >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className="text-[11px] font-semibold text-slate-900 group-hover:text-emerald-900 line-clamp-1">
                                    [{cite.index}] {cite.section}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 group-hover:bg-emerald-200 font-medium">
                                    {cite.authority.split(',')[0]}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 line-clamp-2 italic">
                                  "{cite.excerpt}"
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Utility Footer: Copy, Feedback */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => copyResponse(msg.id, msg.answer || msg.content)}
                            className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                          >
                            {copiedMsgId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-600">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Response</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Feedback */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px]">Was this grounded response helpful?</span>
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, 'helpful')}
                            className={`p-1 rounded hover:bg-slate-100 transition-colors ${
                              msg.feedback === 'helpful' ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                            title="Helpful"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, 'unhelpful')}
                            className={`p-1 rounded hover:bg-slate-100 transition-colors ${
                              msg.feedback === 'unhelpful' ? 'text-rose-600' : 'text-slate-400'
                            }`}
                            title="Unhelpful"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}

          {/* Live Streaming Token Output */}
          {loading && streamingText && (
            <div className="flex flex-col items-start">
              <div className="max-w-3xl rounded-2xl p-5 bg-white border border-slate-200 text-slate-900 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Grounded Evidence...</span>
                </div>
                <p className="text-sm font-serif leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {streamingText}
                  <span className="inline-block w-1.5 h-4 bg-emerald-700 ml-1 animate-pulse" />
                </p>
              </div>
            </div>
          )}

          {/* Loading Indicator when starting */}
          {loading && !streamingText && (
            <div className="flex items-center gap-2.5 text-xs text-slate-500 p-2">
              <div className="w-4 h-4 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
              <span>Retrieving and reranking authoritative statutory evidence...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar Section */}
        <div className="p-4 border-t border-slate-200 bg-white space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl p-1.5 focus-within:border-emerald-700 focus-within:ring-1 focus-within:ring-emerald-700 transition-all"
          >
            {/* Voice Input */}
            <VoiceInputButton
              onTranscript={(transcript) => {
                setInputValue(transcript);
                handleSend(transcript);
              }}
              language={language}
              disabled={loading}
            />

            {/* Query Input */}
            <input
              type="text"
              id="sahayak-chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t('chat.input_placeholder', `Ask questions about IPR, AYUSH, or Traditional Knowledge in ${language.toUpperCase()}...`)}
              disabled={loading}
              className="flex-1 bg-transparent px-2 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
            />

            {/* Submit Button */}
            <button
              type="submit"
              id="sahayak-send-btn"
              disabled={!inputValue.trim() || loading}
              className={`p-2.5 rounded-lg transition-colors flex items-center justify-center ${
                inputValue.trim() && !loading
                  ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Legal Footnote */}
          <p className="text-[10px] text-center text-slate-400">
            IP-SAKTI Sahayak synthesizes indexed statutory provisions from IP India, AYUSH, and NBA. Always verify before formal filing.
          </p>
        </div>
      </main>
    </div>
  );
};
