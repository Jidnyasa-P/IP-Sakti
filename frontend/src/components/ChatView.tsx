import React, { useState, useEffect, useRef } from "react";
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
  MessageSquare,
  User,
  X,
  Globe,
  ExternalLink,
  Pencil,
  Share2,
  Paperclip,
  ImagePlus,
} from "lucide-react";
import {
  Citation,
  ConfidenceLevel,
  Conversation,
  Language,
  StructuredChatMessage,
  Jurisdiction,
} from "../types";
import { VoiceInputButton } from "./VoiceInputButton";
import { DisclaimerBanner } from "./DisclaimerBanner";
import { useTranslation } from "../context/LanguageContext";
import {
  evaluateQueryJurisdiction,
  JurisdictionCheckResult,
} from "../utils/jurisdictionValidation";
import {
  evaluateQueryRelevance,
  QueryRelevanceResult,
} from "../utils/queryRelevance";
import { authFetch } from "./auth/authStorage";
import { useAuth } from "../context/AuthContext";

interface ChatViewProps {
  language: Language;
  onOpenCitation: (citation: Citation) => void;
  onRaiseGrievance: (context: {
    conversationId?: string;
    messageId?: string;
    query?: string;
    response?: string;
  }) => void;
}

const LOCAL_STORAGE_CONVS_KEY = "ipsakti_sahayak_conversations_v2";
const LOCAL_STORAGE_ACTIVE_KEY = "ipsakti_sahayak_active_conv_id_v2";
const LOCAL_STORAGE_ACTIVE_INDIA_KEY = "ipsakti_sahayak_active_india_id";
const LOCAL_STORAGE_ACTIVE_INTL_KEY = "ipsakti_sahayak_active_intl_id";
const LOCAL_STORAGE_JURISDICTION_KEY = "ipsakti_sahayak_jurisdiction_toggle";
const LOCAL_STORAGE_DRAFT_INDIA_KEY = "ipsakti_sahayak_draft_india";
const LOCAL_STORAGE_DRAFT_INTL_KEY = "ipsakti_sahayak_draft_intl";
const LOCAL_STORAGE_DELETED_CONVS_KEY = "ipsakti_sahayak_deleted_conversation_ids_v1";

function scopedStorageKey(baseKey: string, userId?: string): string {
  return `${baseKey}:${userId || "guest"}`;
}

function getDeletedConversationIds(userId?: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(scopedStorageKey(LOCAL_STORAGE_DELETED_CONVS_KEY, userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function rememberDeletedConversationIds(ids: string[], userId?: string) {
  if (typeof window === "undefined" || ids.length === 0) return;
  try {
    const deleted = getDeletedConversationIds(userId);
    ids.forEach((id) => deleted.add(String(id)));
    localStorage.setItem(scopedStorageKey(LOCAL_STORAGE_DELETED_CONVS_KEY, userId), JSON.stringify([...deleted]));
  } catch {}
}

const DEFAULT_INITIAL_CONV: Conversation = {
  id: "conv-india-default-1",
  user_id: "user-default",
  title: "Patentability of Polyherbal Formulation (Section 3p/3e)",
  language: "en",
  jurisdiction: "india",
  created_at: new Date(Date.now() - 3600000).toISOString(),
  updated_at: new Date().toISOString(),
  messages: [
    {
      id: "msg-init-1",
      conversation_id: "conv-india-default-1",
      role: "user",
      content:
        "Can an Ayurvedic formulation combining Ashwagandha and Turmeric extract be patented in India?",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      language: "en",
      jurisdiction: "india",
    },
    {
      id: "msg-init-2",
      conversation_id: "conv-india-default-1",
      role: "assistant",
      content:
        "Under Section 3(p) of the Patents Act, 1970, an invention which in effect is traditional knowledge or an aggregation/duplication of known properties of traditionally known component(s) is strictly non-patentable. Furthermore, under Section 3(e), combining Ashwagandha and Turmeric is deemed a mere admixture unless the applicant provides empirical comparative biological assay data establishing unexpected therapeutic synergy (combination index < 1). Additionally, because biological materials sourced from India are used, prior approval from the National Biodiversity Authority (NBA Form III) under Section 6(1) of the Biological Diversity Act, 2002 is mandatory before patent grant.",
      relevant_considerations: [
        "Section 3(p) statutory bar: CSIR-TKDL prior art citation risks for classical AYUSH herbs.",
        "Section 3(e) admixture hurdle: Mandatory requirement of synergistic combination index < 1.",
        "Section 6(1) Biological Diversity Act: Mandatory NBA Form III clearance prior to patent grant.",
      ],
      recommended_next_steps: [
        "Conduct comprehensive CSIR-TKDL and patent database clearance search (CGPDTM / InPASS).",
        "Generate quantitative synergy assay data to overcome Section 3(e).",
        "Submit Form III application to the National Biodiversity Authority (NBA).",
        "Register distinctive brand name under Trade Marks Act, 1999 (Class 5).",
      ],
      citations: [
        {
          index: 1,
          chunk_id: "CHUNK-PAT-001",
          document_id: "DOC-PATENTS-ACT-1970",
          title: "The Patents Act, 1970 — Section 3(p)",
          authority: "Office of the CGPDTM",
          section: "Section 3(p)",
          source: "Official Gazette of India",
          excerpt:
            "Section 3(p) establishes an absolute statutory bar against patenting any herbal medicine or formulation already recorded in traditional knowledge systems...",
        },
        {
          index: 2,
          chunk_id: "CHUNK-PAT-002",
          document_id: "DOC-PATENTS-ACT-1970",
          title: "The Patents Act, 1970 — Section 3(e)",
          authority: "Office of the CGPDTM",
          section: "Section 3(e)",
          source: "Official Gazette of India",
          excerpt:
            "Section 3(e) prohibits patenting substances obtained by mere admixture resulting only in aggregation of properties unless unexpected synergy is demonstrated...",
        },
        {
          index: 3,
          chunk_id: "CHUNK-BD-001",
          document_id: "DOC-BIOLOGICAL-DIVERSITY-ACT-2002",
          title: "Biological Diversity Act, 2002 — Section 6(1)",
          authority: "National Biodiversity Authority (NBA)",
          section: "Section 6(1)",
          source: "Gazette of India",
          excerpt:
            "No person shall apply for any intellectual property right in or outside India based on Indian biological resources without prior NBA approval...",
        },
      ],
      confidence: {
        level: "High",
        score: 0.96,
        reasons: [
          "Corroborated by primary statutory provisions of The Patents Act, 1970.",
          "Directly verified against Section 6 of Biological Diversity Act, 2002.",
          "Supported by established CGPDTM examination guidelines.",
        ],
      },
      created_at: new Date(Date.now() - 3500000).toISOString(),
      jurisdiction: "india",
    },
  ],
};

const DEFAULT_INITIAL_INTL_CONV: Conversation = {
  id: "conv-intl-default-1",
  user_id: "user-default",
  title: "International Patentability under PCT, USPTO & Nagoya Protocol",
  language: "en",
  jurisdiction: "international",
  created_at: new Date(Date.now() - 3600000).toISOString(),
  updated_at: new Date().toISOString(),
  messages: [
    {
      id: "msg-intl-1",
      conversation_id: "conv-intl-default-1",
      role: "user",
      content:
        "Can an Ayurvedic polyherbal formulation (Ashwagandha and Curcumin) be patented internationally under the Patent Cooperation Treaty (PCT), USPTO, and EPO?",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      language: "en",
      jurisdiction: "international",
    },
    {
      id: "msg-intl-2",
      conversation_id: "conv-intl-default-1",
      role: "assistant",
      content:
        'Under International Patent frameworks (PCT, USPTO, and EPO), patenting polyherbal formulations requires addressing key eligibility, prior art, and biodiversity compliance standards:\n\n1. **United States (USPTO)**: Under 35 U.S.C. § 101 and the Supreme Court decisions (Association for Molecular Pathology v. Myriad Genetics and Mayo v. Prometheus), naturally occurring plant extracts and mere aggregations are non-patentable subject matter unless modified into a markedly different composition or synergistic derivative with novel delivery kinetics. Under 35 U.S.C. § 102, USPTO examiners routinely cite India\'s CSIR Traditional Knowledge Digital Library (TKDL) as anticipatory prior art.\n\n2. **European Patent Office (EPO)**: Under EPC Articles 52 and 53, biological compositions must demonstrate novelty, non-obvious inventive step supported by unexpected technical efficacy, and industrial applicability. Claims for therapeutic treatments must be formatted as second medical indications ("Substance X for use in treating disease Y").\n\n3. **Patent Cooperation Treaty (PCT / WIPO)**: Filing a PCT application reserves your priority date across 157 member states. The International Searching Authority (ISA) carries out international searches querying global patent databases and TKDL.\n\n4. **Nagoya Protocol & 2024 WIPO Treaty**: In accordance with the Nagoya Protocol on Access and Benefit Sharing (ABS) and Article 3 of the 2024 WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge, applicants filing foreign patents based on Indian genetic resources must formally disclose country of origin and furnish evidence of Prior Informed Consent (PIC) and Mutually Agreed Terms (MAT).',
      relevant_considerations: [
        "USPTO 35 U.S.C. § 101 natural product doctrine: Must show markedly different characteristics or non-obvious synergistic bioavailability.",
        "EPO EPC Articles 52/53: Therapeutic method claims barred; second medical use claim format required.",
        "Nagoya Protocol & 2024 WIPO GRATK Treaty Article 3: Mandatory disclosure of country of origin and genetic resources provenance.",
        "WIPO PCT Chapter I/II: International Searching Authority (ISA) cites CSIR-TKDL repository prior art.",
      ],
      recommended_next_steps: [
        "File a PCT international application to preserve priority across 157 countries before foreign national phase entry.",
        "Secure mandatory NBA Form III clearance under Section 6 of Indian Biological Diversity Act before any foreign filing.",
        "Perform worldwide clearance search in USPTO Patent Public Search, EPO Espacenet, and WIPO Patentscope.",
        "Draft claims targeting purified active fractions, standardized dosage forms, or synergistic bioavailability formulations.",
      ],
      citations: [
        {
          index: 1,
          chunk_id: "CHUNK-WIPO-001",
          document_id: "DOC-WIPO-GRATK-2024",
          title:
            "WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge (2024)",
          authority: "World Intellectual Property Organization (WIPO)",
          section: "Article 3: Mandatory Disclosure",
          source: "WIPO Diplomatic Conference",
          excerpt:
            "Under Article 3, Contracting Parties shall require patent applicants whose inventions are materially or directly based on genetic resources to disclose the country of origin and source community.",
        },
        {
          index: 2,
          chunk_id: "CHUNK-PCT-001",
          document_id: "DOC-PCT-WIPO",
          title: "Patent Cooperation Treaty (PCT / WIPO Regulations)",
          authority: "WIPO International Bureau",
          section: "Article 15 & Rule 33: International Search",
          source: "WIPO PCT Gazette",
          excerpt:
            "The International Searching Authority shall discover relevant prior art, including documented traditional medicine repositories accessible under bilateral search agreements such as CSIR-TKDL.",
        },
        {
          index: 3,
          chunk_id: "CHUNK-NAGOYA-001",
          document_id: "DOC-CBD-NAGOYA",
          title:
            "Nagoya Protocol on Access to Genetic Resources and the Fair and Equitable Sharing of Benefits (CBD)",
          authority: "Secretariat of the Convention on Biological Diversity",
          section: "Articles 5, 6 & 15: Compliance and ABS",
          source: "United Nations Treaty Series",
          excerpt:
            "Parties shall take measures to ensure that genetic resources utilized within their jurisdiction have been accessed in accordance with prior informed consent and mutually agreed terms.",
        },
      ],
      confidence: {
        level: "High",
        score: 0.95,
        reasons: [
          "Directly grounded in Patent Cooperation Treaty (PCT) and WIPO international search standards.",
          "Corroborated by USPTO 35 U.S.C. 101 natural products eligibility guidelines and MPEP 2106.",
          "Verified against European Patent Convention (EPC Articles 52/53).",
          "Harmonized with Nagoya Protocol and 2024 WIPO GRATK Treaty mandatory disclosure rules.",
        ],
      },
      created_at: new Date(Date.now() - 3500000).toISOString(),
      jurisdiction: "international",
    },
  ],
};

function normalizeConversation(c: Conversation): Conversation | null {
  const messages = (c.messages || []).map((m) => ({
    ...m,
    jurisdiction: (m.jurisdiction || c.jurisdiction || "india") as Jurisdiction,
  }));

  const firstMessageTitle = messages
    .map((m) => (m.content || "").trim())
    .find(Boolean) || "";

  const title = (c.title || "").trim() || firstMessageTitle;

  // Do not keep completely empty conversation records. These are the
  // records that appear in the sidebar as a chat icon with no text.
  if (!title && messages.length === 0) {
    return null;
  }

  return {
    ...c,
    title: title.slice(0, 48),
    jurisdiction: (c.jurisdiction || "india") as Jurisdiction,
    messages,
  };
}

function createClientConversationId(jurisdiction: Jurisdiction): string {
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `conv-${jurisdiction}-${randomId}`;
}

function getInitialConversations(userId?: string): Conversation[] {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(scopedStorageKey(LOCAL_STORAGE_CONVS_KEY, userId));
      // FIXED ("2 chats keep appearing after deleting everything"): this
      // used to check `parsed.length > 0` and fall through to reseeding the
      // two hardcoded demo conversations whenever the stored list was
      // empty -- which is exactly what happens right after the user
      // deletes every conversation (persistConversations writes `[]`).
      // Deleting everything should mean everything, so an explicit,
      // already-initialized empty list (`stored !== null`) is now returned
      // as-is. The demo conversations are only ever seeded on a true first
      // run, when nothing has been saved to this browser yet.
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const deleted = getDeletedConversationIds(userId);
          return parsed
            .map((c: Conversation) => normalizeConversation(c))
            .filter((c): c is Conversation => c !== null && !deleted.has(String(c.id)));
        }
      }
    } catch (e) {}
  }
  return [];
}

function getInitialIsInternational(userId?: string): boolean {
  if (typeof window !== "undefined") {
    try {
      const savedMode = localStorage.getItem(scopedStorageKey(LOCAL_STORAGE_JURISDICTION_KEY, userId));
      if (savedMode === "international") return true;
      if (savedMode === "india") return false;
    } catch (e) {}
  }
  return false;
}

function getStoredDraft(isIntl: boolean, userId?: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(
      scopedStorageKey(isIntl ? LOCAL_STORAGE_DRAFT_INTL_KEY : LOCAL_STORAGE_DRAFT_INDIA_KEY, userId),
    ) || "";
  } catch {
    return "";
  }
}

function persistStoredDraft(isIntl: boolean, value: string, userId?: string) {
  if (typeof window === "undefined") return;
  try {
    const key = scopedStorageKey(isIntl ? LOCAL_STORAGE_DRAFT_INTL_KEY : LOCAL_STORAGE_DRAFT_INDIA_KEY, userId);
    if (value.trim()) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

function getInitialActiveId(convs: Conversation[], isIntl: boolean, userId?: string): string {
  const targetJur: Jurisdiction = isIntl ? "international" : "india";
  const savedKey = isIntl
    ? LOCAL_STORAGE_ACTIVE_INTL_KEY
    : LOCAL_STORAGE_ACTIVE_INDIA_KEY;
  if (typeof window !== "undefined") {
    try {
      const storedId = localStorage.getItem(scopedStorageKey(savedKey, userId));
      if (
        storedId &&
        !getDeletedConversationIds(userId).has(String(storedId)) &&
        convs.some(
          (c) => c.id === storedId && (c.jurisdiction || "india") === targetJur,
        )
      ) {
        return storedId;
      }
    } catch (e) {}
  }
  const matching = convs.filter(
    (c) => (c.jurisdiction || "india") === targetJur,
  );
  // Only fall back to a hardcoded demo id when that demo conversation is
  // actually present in `convs` (true first run). Returning it
  // unconditionally used to point activeConvId at a demo chat that no
  // longer existed once the user had deleted everything, leaving the chat
  // panel in a confusing half-empty state instead of the clean "no active
  // session" state deleteConversation() already handles.
  if (matching.length > 0) {
    return matching[0].id;
  }
  const fallbackDefault = isIntl ? DEFAULT_INITIAL_INTL_CONV : DEFAULT_INITIAL_CONV;
  return convs.some((c) => c.id === fallbackDefault.id) ? fallbackDefault.id : "";
}

export const ChatView: React.FC<ChatViewProps> = ({
  language,
  onOpenCitation,
  onRaiseGrievance,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const userId = currentUser?.id;

  const [isInternational, setIsInternational] = useState<boolean>(() =>
    getInitialIsInternational(userId),
  );
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    getInitialConversations(userId),
  );

  const [activeConvId, setActiveConvId] = useState<string>(() => {
    const initialConvs = getInitialConversations(userId);
    const isIntl = getInitialIsInternational(userId);
    return getInitialActiveId(initialConvs, isIntl, userId);
  });

  const [activeIndiaConvId, setActiveIndiaConvId] = useState<string>(() => {
    const initialConvs = getInitialConversations(userId);
    return getInitialActiveId(initialConvs, false, userId);
  });

  const [activeIntlConvId, setActiveIntlConvId] = useState<string>(() => {
    const initialConvs = getInitialConversations(userId);
    return getInitialActiveId(initialConvs, true, userId);
  });

  const [messages, setMessages] = useState<StructuredChatMessage[]>(() => {
    const initialConvs = getInitialConversations(userId);
    const isIntl = getInitialIsInternational(userId);
    const activeId = getInitialActiveId(initialConvs, isIntl, userId);
    const active = initialConvs.find((c) => c.id === activeId);
    return active?.messages || [];
  });

  const [inputValue, setInputValue] = useState(() => getStoredDraft(getInitialIsInternational(userId), userId));

  const storageKey = (baseKey: string) => scopedStorageKey(baseKey, userId);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false,
  );
  const [jurisdictionWarning, setJurisdictionWarning] = useState<{
    query: string;
    matchedKeywords: string[];
    explanation: string;
  } | null>(null);
  const [relevanceWarning, setRelevanceWarning] = useState<{
    query: string;
    reason: string;
  } | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
  const [attachmentContext, setAttachmentContext] = useState("");
  const [attachmentProcessing, setAttachmentProcessing] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [attachmentKind, setAttachmentKind] = useState<"document" | "image" | null>(null);
  const [grievanceNotice, setGrievanceNotice] = useState<string | null>(null);
  const [expertRequestingMsgId, setExpertRequestingMsgId] = useState<string | null>(null);
  const [expertRequestedMsgIds, setExpertRequestedMsgIds] = useState<Set<string>>(new Set());
  // Which low-confidence message's "choose an expert" picker is currently
  // open (its list of expert-type buttons), keyed by message id.
  const [expertPickerOpenMsgId, setExpertPickerOpenMsgId] = useState<string | null>(null);

  const EXPERT_TYPES: { id: string; label: string }[] = [
    { id: "ayurveda", label: "Ayurveda Expert" },
    { id: "legal", label: "Legal / IP Expert" },
    { id: "regulatory", label: "Regulatory Affairs Expert" },
  ];

  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(false);
  const deletedConversationIdsRef = useRef<Set<string>>(new Set());

  const suggestedQuestions = isInternational
    ? [
        "Can an Ayurvedic polyherbal formulation be patented under PCT, USPTO, and EPO?",
        "What are the mandatory disclosure rules for genetic resources under the 2024 WIPO Treaty?",
        "How does the Nagoya Protocol affect commercialization of bio-extracts across international borders?",
        "How do USPTO examiners cite the CSIR-TKDL repository under 35 U.S.C. 102 prior art?",
      ]
    : [
        t(
          "chat.suggested_1",
          "Can an Ayurvedic formulation combining Ashwagandha and Turmeric extract be patented in India?",
        ),
        t(
          "chat.suggested_2",
          "What is the difference between a patent and a traditional knowledge disclosure under TKDL?",
        ),
        t(
          "chat.suggested_3",
          "What statutory approvals are required from the National Biodiversity Authority for exporting neem extract?",
        ),
        t(
          "chat.suggested_4",
          "What are the mandatory Schedule T Good Manufacturing Practices for Ayurvedic medicines?",
        ),
      ];

  useEffect(() => {
    persistStoredDraft(isInternational, inputValue, userId);
  }, [inputValue, isInternational]);

  // Restore the last scroll position for this conversation only. This deliberately
  // does not call scrollIntoView(), which used to move the whole website to its
  // footer whenever ChatView mounted or messages changed.
  useEffect(() => {
    const node = messagesScrollRef.current;
    if (!node || !activeConvId) return;
    const key = storageKey(`ipsakti_sahayak_scroll_${activeConvId}`);
    let saved = 0;
    try {
      saved = Number(localStorage.getItem(key) || 0);
    } catch {}
    requestAnimationFrame(() => {
      node.scrollTop = Number.isFinite(saved) && saved > 0 ? saved : 0;
    });
  }, [activeConvId]);

  // Helper to persist conversations to localStorage
  const persistConversations = (
    updated: Conversation[],
    newActiveId?: string,
  ) => {
    const deleted = getDeletedConversationIds(userId);
    const cleaned = updated
      .map((c) => normalizeConversation(c))
      .filter((c): c is Conversation => c !== null && !deleted.has(String(c.id)));

    setConversations(cleaned);
    if (typeof window !== "undefined") {
      try {
        // Keep a compatibility snapshot for an offline refresh, but never
        // use it as the authoritative source when the backend is reachable.
        localStorage.setItem(storageKey(LOCAL_STORAGE_CONVS_KEY), JSON.stringify(cleaned));
        if (newActiveId) {
          localStorage.setItem(storageKey(LOCAL_STORAGE_ACTIVE_KEY), newActiveId);
          if (isInternational) {
            localStorage.setItem(storageKey(LOCAL_STORAGE_ACTIVE_INTL_KEY), newActiveId);
          } else {
            localStorage.setItem(storageKey(LOCAL_STORAGE_ACTIVE_INDIA_KEY), newActiveId);
          }
        } else {
          localStorage.removeItem(storageKey(LOCAL_STORAGE_ACTIVE_KEY));
          localStorage.removeItem(
            storageKey(
              isInternational
                ? LOCAL_STORAGE_ACTIVE_INTL_KEY
                : LOCAL_STORAGE_ACTIVE_INDIA_KEY,
            ),
          );
        }
      } catch (e) {}
    }
  };

  // Switch between Indian and International jurisdictions
  const handleToggleJurisdiction = (checked: boolean) => {
    // 1. Immediately save current active conversation messages to avoid losing in-flight state
    let currentConvs = conversations;
    if (activeConvId && messages.length > 0) {
      currentConvs = conversations.map((c) =>
        c.id === activeConvId
          ? { ...c, messages, updated_at: new Date().toISOString() }
          : c,
      );
      setConversations(currentConvs);
      try {
        localStorage.setItem(
          storageKey(LOCAL_STORAGE_CONVS_KEY),
          JSON.stringify(currentConvs),
        );
      } catch (e) {}
    }

    setIsInternational(checked);
    setInputValue(getStoredDraft(checked, userId));
    const targetJur: Jurisdiction = checked ? "international" : "india";
    try {
      localStorage.setItem(storageKey(LOCAL_STORAGE_JURISDICTION_KEY), targetJur);
    } catch (e) {}

    const deletedIds = getDeletedConversationIds(userId);
    const matchingConvs = currentConvs.filter(
      (c) => (c.jurisdiction || "india") === targetJur && !deletedIds.has(String(c.id)),
    );
    const savedKey = checked
      ? LOCAL_STORAGE_ACTIVE_INTL_KEY
      : LOCAL_STORAGE_ACTIVE_INDIA_KEY;
    let targetId =
      typeof window !== "undefined" ? localStorage.getItem(storageKey(savedKey)) || "" : "";
    let targetConv = matchingConvs.find((c) => c.id === targetId);

    if (!targetConv && matchingConvs.length > 0) {
      targetConv = matchingConvs[0];
      targetId = targetConv.id;
    }

    if (checked) {
      setActiveIntlConvId(targetId);
    } else {
      setActiveIndiaConvId(targetId);
    }
    setActiveConvId(targetId);
    setMessages(targetConv?.messages || []);
    setStreamingText("");
    setInputValue("");
    setJurisdictionWarning(null);

    try {
      localStorage.setItem(storageKey(savedKey), targetId);
      localStorage.setItem(storageKey(LOCAL_STORAGE_ACTIVE_KEY), targetId);
    } catch (e) {}
  };

  // Helper to immediately switch to Indian jurisdiction and automatically execute query
  const handleSwitchToIndiaAndSend = (pendingQuery: string) => {
    setJurisdictionWarning(null);
    handleToggleJurisdiction(false);
    // Send in next tick after jurisdiction state and conversation swap have processed
    setTimeout(() => {
      handleSend(pendingQuery, {
        forceSend: true,
        jurisdictionOverride: "india",
      });
    }, 50);
  };

  const handleSwitchToInternationalAndSend = (pendingQuery: string) => {
    setJurisdictionWarning(null);
    handleToggleJurisdiction(true);
    // Send in next tick after jurisdiction state and conversation swap have processed
    setTimeout(() => {
      handleSend(pendingQuery, {
        forceSend: true,
        jurisdictionOverride: "international",
      });
    }, 50);
  };

  // A chat cache is account-scoped. When the authenticated account changes,
  // immediately replace the visible state before syncing with the server.
  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setActiveConvId("");
      setActiveIndiaConvId("");
      setActiveIntlConvId("");
      setMessages([]);
      return;
    }
    const localConvs = getInitialConversations(userId);
    const intl = getInitialIsInternational(userId);
    const activeId = getInitialActiveId(localConvs, intl, userId);
    const active = localConvs.find((c) => c.id === activeId);
    setConversations(localConvs);
    setIsInternational(intl);
    setActiveConvId(activeId);
    setActiveIndiaConvId(getInitialActiveId(localConvs, false, userId));
    setActiveIntlConvId(getInitialActiveId(localConvs, true, userId));
    setMessages(active?.messages || []);
    fetchServerConversations();
  }, [userId]);

  const fetchServerConversations = async () => {
    try {
      const res = await authFetch("/api/conversations");
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || !contentType.includes("application/json")) {
        return;
      }
      const serverConvs: Conversation[] = await res.json();
      const deletedIds = getDeletedConversationIds(userId);
      const cleanedServerConvs = Array.isArray(serverConvs)
        ? serverConvs
            .map((c) => normalizeConversation(c))
            .filter((c): c is Conversation => c !== null && !deletedIds.has(String(c.id)))
        : [];

      // The authenticated backend is the source of truth. In particular,
      // an empty server list is meaningful: it means the user deleted all
      // of their conversations and the old local cache must not resurrect
      // them.
      setConversations(cleanedServerConvs);
      try {
        localStorage.setItem(
          storageKey(LOCAL_STORAGE_CONVS_KEY),
          JSON.stringify(cleanedServerConvs),
        );
      } catch (e) {}

      const targetJur: Jurisdiction = isInternational
        ? "international"
        : "india";
      const current =
        cleanedServerConvs.find(
          (c) =>
            c.id === activeConvId &&
            (c.jurisdiction || "india") === targetJur,
        ) ||
        cleanedServerConvs.find(
          (c) => (c.jurisdiction || "india") === targetJur,
        ) ||
        cleanedServerConvs[0];

      if (current) {
        setActiveConvId(current.id);
        if (isInternational) {
          setActiveIntlConvId(current.id);
        } else {
          setActiveIndiaConvId(current.id);
        }
        setMessages(current.messages || []);
      } else {
        setActiveConvId("");
        if (isInternational) {
          setActiveIntlConvId("");
        } else {
          setActiveIndiaConvId("");
        }
        setMessages([]);
        try {
          localStorage.removeItem(storageKey(LOCAL_STORAGE_ACTIVE_KEY));
          localStorage.removeItem(
            storageKey(
              isInternational
                ? LOCAL_STORAGE_ACTIVE_INTL_KEY
                : LOCAL_STORAGE_ACTIVE_INDIA_KEY,
            ),
          );
        } catch (e) {}
      }
    } catch (e) {
      // Offline / transient network notice
    }
  };

  const loadConversation = (id: string) => {
    if (getDeletedConversationIds(userId).has(String(id))) return;
    setActiveConvId(id);
    if (isInternational) {
      setActiveIntlConvId(id);
      try {
        localStorage.setItem(storageKey(LOCAL_STORAGE_ACTIVE_INTL_KEY), id);
      } catch (e) {}
    } else {
      setActiveIndiaConvId(id);
      try {
        localStorage.setItem(storageKey(LOCAL_STORAGE_ACTIVE_INDIA_KEY), id);
      } catch (e) {}
    }

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey(LOCAL_STORAGE_ACTIVE_KEY), id);
      } catch (e) {}
    }
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
    const local = conversations.find((c) => c.id === id);
    if (local && local.messages) {
      setMessages(local.messages);
    }
    authFetch(`/api/conversations/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages);
        }
      })
      .catch(() => null);
  };

  const startNewConversation = () => {
    const currentJur: Jurisdiction = isInternational
      ? "international"
      : "india";
    const newId = createClientConversationId(currentJur);

    // FIXED ("blank chats piling up"): this used to immediately add a
    // placeholder conversation (0 messages, a default "New ... Session"
    // title) into `conversations` and localStorage. Since the title was
    // never empty, normalizeConversation's blank-record filter never
    // caught these, so every "+ New Session" click that wasn't followed by
    // an actual message left another empty entry behind permanently. Now
    // this only switches the active draft id/empty message list -- no
    // conversation record is created (locally or on the server) until
    // handleSend() actually sends a first message, reusing this same id.
    setActiveConvId(newId);
    if (isInternational) {
      setActiveIntlConvId(newId);
    } else {
      setActiveIndiaConvId(newId);
    }
    setMessages([]);
    setStreamingText("");
    setInputValue("");

    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deletedConversationIdsRef.current.add(id);
    rememberDeletedConversationIds([id], userId);

    const updated = conversations.filter((c) => c.id !== id);
    const currentJur: Jurisdiction = isInternational
      ? "international"
      : "india";
    const remainingMatching = updated.filter(
      (c) => (c.jurisdiction || "india") === currentJur,
    );
    const nextActiveId =
      activeConvId === id ? (remainingMatching[0]?.id || "") : activeConvId;

    // Remove it from the UI/cache immediately. A 404 below simply means the
    // server record was already absent (common for an old local-only session).
    persistConversations(updated, nextActiveId);

    try {
      const deleteRes = await authFetch(`/api/conversations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (deleteRes.ok || deleteRes.status === 404 || deleteRes.status === 410) {
      } else {
        throw new Error(`Delete failed with status ${deleteRes.status}`);
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }

    // The backend tombstone is the permanent source of truth. A later sync
    // therefore cannot resurrect this id, even if an earlier request was stale.

    // Delete every client-side copy of the session so changing sections or
    // reopening Sahayak cannot resurrect it.
    try {
      const cached = localStorage.getItem(storageKey(LOCAL_STORAGE_CONVS_KEY));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          localStorage.setItem(
            storageKey(LOCAL_STORAGE_CONVS_KEY),
            JSON.stringify(parsed.filter((c: any) => String(c?.id) !== String(id))),
          );
        }
      }
      for (const baseKey of [
        LOCAL_STORAGE_ACTIVE_KEY,
        LOCAL_STORAGE_ACTIVE_INDIA_KEY,
        LOCAL_STORAGE_ACTIVE_INTL_KEY,
      ]) {
        const key = storageKey(baseKey);
        if (localStorage.getItem(key) === id) localStorage.removeItem(key);
      }
    } catch (cacheErr) {}

    if (activeConvId === id) {
      if (remainingMatching.length > 0) {
        loadConversation(remainingMatching[0].id);
      } else {
        setActiveConvId("");
        if (isInternational) setActiveIntlConvId("");
        else setActiveIndiaConvId("");
        setMessages([]);
        setInputValue("");
      }
    }

    // Reconcile with the backend after the mutation so Workspace and Sahayak
    // immediately share exactly the same session list.
    await fetchServerConversations();
  };


  const renameConversation = async (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation();
    const nextTitle = window.prompt("Rename chat", conversation.title || "");
    const title = nextTitle?.trim();
    if (!title || title === conversation.title) return;

    const updated = conversations.map((c) =>
      c.id === conversation.id
        ? { ...c, title: title.slice(0, 80), updated_at: new Date().toISOString() }
        : c,
    );
    persistConversations(updated, activeConvId);

    try {
      await authFetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.slice(0, 80) }),
      });
    } catch (err) {
      console.warn("Failed to save renamed conversation:", err);
    }
  };

  const shareConversation = async () => {
    const current = conversations.find((c) => c.id === activeConvId);
    if (!current) return;

    const transcript = (current.messages || [])
      .map((m) => `${m.role === "user" ? "You" : "IP-SAKTI Sahayak"}: ${m.answer || m.content || ""}`)
      .join("\n\n");
    const shareText = `${current.title}\n\n${transcript || "No messages yet."}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: current.title, text: shareText });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setCopiedMsgId("__conversation_share__");
        setTimeout(() => setCopiedMsgId(null), 2500);
      }
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") {
        console.warn("Conversation share failed:", err);
      }
    }
  };

  const openAttachmentPicker = (kind: "document" | "image") => {
    setAttachmentKind(kind);
    setAttachmentMenuOpen(false);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.accept =
        kind === "image" ? "image/*" : ".pdf,.docx,.txt,.md,.csv,.json";
      attachmentInputRef.current.click();
    }
  };

  const handleAttachmentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (e.target) e.target.value = "";
    if (!file) return;

    setSelectedAttachment(file);
    setAttachmentContext("");
    setAttachmentError(null);

    try {
      const context = await extractAttachmentContext(file);
      setAttachmentContext(context);
      if (!context) {
        setAttachmentError("No readable content was found in this attachment.");
      }
    } catch (err) {
      setAttachmentError(
        err instanceof Error ? err.message : "Could not read the attachment.",
      );
    }
  };

  const requestExpertReview = async (msg: StructuredChatMessage, expertType: string) => {
    if (!activeConvId || !msg.confidence || expertRequestingMsgId === msg.id) return;
    setExpertRequestingMsgId(msg.id);
    try {
      const res = await authFetch("/api/expert-escalation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeConvId,
          query: messages.find((m) => m.role === "user")?.content || "Low-confidence consultation",
          reason: `Confidence score below 70% (${Math.round((msg.confidence.score <= 1 ? msg.confidence.score * 100 : msg.confidence.score))}%).`,
          expert_type: expertType,
        }),
      });
      if (res.ok) {
        setExpertRequestedMsgIds((prev) => new Set(prev).add(msg.id));
        setExpertPickerOpenMsgId(null);
      }
    } catch (err) {
      console.warn("Expert review request failed:", err);
    } finally {
      setExpertRequestingMsgId(null);
    }
  };

  const raiseGrievance = (msg: StructuredChatMessage) => {
    const messageIndex = messages.findIndex((m) => m.id === msg.id);
    let relatedQuery = "";
    for (let i = messageIndex - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        relatedQuery = messages[i].content || messages[i].answer || "";
        break;
      }
    }
    onRaiseGrievance({
      conversationId: msg.conversation_id || activeConvId || undefined,
      messageId: msg.id,
      query: relatedQuery,
      response: msg.answer || msg.content || "",
    });
  };

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    const node = messagesScrollRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
      // Keep following the same user-submitted turn until its answer is
      // finished, but never enable automatic scrolling merely by mounting
      // the chat or switching sections.
      if (!loading) shouldAutoScrollRef.current = false;
    });
  }, [messages, streamingText, loading]);

  const extractAttachmentContext = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    setAttachmentProcessing(true);
    try {
      const res = await authFetch("/api/chat/attachment-context", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || "Could not read the attachment.");
      }
      return String(data?.context || "").trim();
    } finally {
      setAttachmentProcessing(false);
    }
  };

  // Send query with streaming response and robust session storage
  const handleSend = async (
    queryText?: string,
    options?: {
      forceSend?: boolean;
      jurisdictionOverride?: Jurisdiction;
    },
  ) => {
    const textToSend = queryText || inputValue;
    if (!textToSend.trim() || loading) return;

    let attachmentContextForRequest = attachmentContext;
    if (selectedAttachment && !attachmentContextForRequest && !attachmentProcessing) {
      try {
        attachmentContextForRequest = await extractAttachmentContext(selectedAttachment);
        setAttachmentContext(attachmentContextForRequest);
      } catch (err) {
        setRelevanceWarning(null);
        setJurisdictionWarning(null);
        setLoading(false);
        setAttachmentProcessing(false);
        setAttachmentError(
          err instanceof Error ? err.message : "Could not read the attachment.",
        );
        return;
      }
    }
    if (selectedAttachment && !attachmentContextForRequest) {
      setAttachmentError("The attachment has not been read successfully yet.");
      return;
    }

    // 1. RULE: Relevance Validation Check
    // Prevent clearly unrelated questions (e.g., general programming, pure math, entertainment, general shopping)
    // from being submitted to the specialized IP-SAKTI Sahayak research engine.
    if (!options?.forceSend) {
      const relevanceCheck = evaluateQueryRelevance(textToSend);
      if (!relevanceCheck.isRelevant) {
        setRelevanceWarning({
          query: textToSend,
          reason:
            relevanceCheck.reason ||
            "Query is outside the scope of IP-SAKTI Sahayak.",
        });
        return;
      }
    }

    // 2. RULE: Keep the query and selected jurisdiction aligned.
    // A mismatch is stopped here and shown to the user. The user can either
    // edit the query or explicitly switch to the matching chat and submit it.
    if (!options?.forceSend) {
      const check = evaluateQueryJurisdiction(textToSend);

      if (check.isIndiaSpecific && check.isInternationalSpecific) {
        setJurisdictionWarning({
          query: textToSend,
          matchedKeywords: check.matchedKeywords,
          explanation:
            "This query contains both India-specific and international jurisdiction references. Please edit the query or use the jurisdiction section relevant to the specific question.",
        });
        return;
      }

      if (!isInternational && check.isInternationalSpecific) {
        setJurisdictionWarning({
          query: textToSend,
          matchedKeywords: check.matchedKeywords,
          explanation:
            check.explanation ||
            "This query appears to require International jurisdiction.",
        });
        return;
      }

      if (isInternational && check.isIndiaSpecific) {
        setJurisdictionWarning({
          query: textToSend,
          matchedKeywords: check.matchedKeywords,
          explanation:
            check.explanation ||
            "This query appears to require India / Domestic jurisdiction.",
        });
        return;
      }
    }

    // Clear any active warnings on valid submission
    setRelevanceWarning(null);
    setJurisdictionWarning(null);
    setInputValue("");
    shouldAutoScrollRef.current = true;
    setLoading(true);
    setStreamingText("");

    const currentJur: Jurisdiction =
      options?.jurisdictionOverride ||
      (isInternational ? "international" : "india");

    // Ensure we have an active conversation of the right jurisdiction
    let targetConvId = getDeletedConversationIds(userId).has(String(activeConvId)) ? "" : activeConvId;
    let currentConv = conversations.find(
      (c) =>
        c.id === targetConvId && (c.jurisdiction || "india") === currentJur && !getDeletedConversationIds(userId).has(String(c.id)),
    );

    if (!currentConv) {
      // No stored conversation matches yet -- either there's no active id
      // at all, or (see startNewConversation) activeConvId is a fresh,
      // not-yet-persisted draft id. Reuse that draft id when we have one so
      // it becomes the real, stored session instead of spawning a second
      // entry; only mint a brand new id if there truly isn't one.
      if (!targetConvId) {
        targetConvId = createClientConversationId(currentJur);
      }
      const newTitle =
        textToSend.slice(0, 45) + (textToSend.length > 45 ? "..." : "");
      currentConv = {
        id: targetConvId,
        user_id: userId || "",
        title: newTitle,
        language,
        jurisdiction: currentJur,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: [],
      };
      setActiveConvId(targetConvId);
      if (isInternational) {
        setActiveIntlConvId(targetConvId);
      } else {
        setActiveIndiaConvId(targetConvId);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey(LOCAL_STORAGE_ACTIVE_KEY), targetConvId);
      }
    }

    const userMsg: StructuredChatMessage = {
      id: `msg-u-${Date.now()}`,
      conversation_id: targetConvId,
      role: "user",
      content: textToSend,
      created_at: new Date().toISOString(),
      language,
      jurisdiction: currentJur,
    };

    // Update conversation title if it was default
    let updatedTitle = currentConv.title;
    if (
      currentConv.title === "New Legal Consultation" ||
      currentConv.title === "New Indian Legal Consultation" ||
      currentConv.title === "New International Consultation" ||
      currentConv.messages.length === 0
    ) {
      updatedTitle =
        textToSend.slice(0, 45) + (textToSend.length > 45 ? "..." : "");
    }

    const updatedWithUser = [...messages, userMsg];
    setMessages(updatedWithUser);

    // Persist immediately with user message
    const updatedConvsWithUser = conversations.some(
      (c) => c.id === targetConvId,
    )
      ? conversations.map((c) =>
          c.id === targetConvId
            ? {
                ...c,
                title: updatedTitle,
                jurisdiction: currentJur,
                messages: updatedWithUser,
                updated_at: new Date().toISOString(),
              }
            : c,
        )
      : [
          {
            ...currentConv,
            title: updatedTitle,
            jurisdiction: currentJur,
            messages: updatedWithUser,
            updated_at: new Date().toISOString(),
          },
          ...conversations,
        ];

    persistConversations(updatedConvsWithUser, targetConvId);

    let assistantMsg: StructuredChatMessage | null = null;

    const requestConversationId = targetConvId;

    // NOTE: there is no POST /api/chat/stream route on the backend (chat.py
    // only implements /api/chat and /api/query, both non-streaming) -- an
    // earlier version of this function tried it first on every single
    // message, which was a guaranteed 404 every time before falling back.
    // Removed that attempt entirely; goes straight to the real endpoint below.
    // (streamingText/setStreamingText are left in place for a future real
    // streaming endpoint -- see README's "honest gaps" section.)
    let requestFailed = false;
    {
      try {
        const syncRes = await authFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: textToSend,
            conversation_id: targetConvId,
            language,
            jurisdiction: currentJur,
            attachment_context: attachmentContextForRequest || undefined,
            attachment_name: selectedAttachment?.name || undefined,
          }),
        });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (selectedAttachment) {
            setSelectedAttachment(null);
            setAttachmentContext("");
            setAttachmentError(null);
          }
          if (deletedConversationIdsRef.current.has(requestConversationId)) {
            setLoading(false);
            setStreamingText("");
            return;
          }
          assistantMsg = syncData.message || syncData;

          // The backend is authoritative for the persisted conversation ID.
          // Rebind the local draft/messages to that ID before any grievance or
          // workspace action can reference it.
          const canonicalConversationId =
            String(syncData.conversation_id || assistantMsg?.conversation_id || targetConvId);
          if (canonicalConversationId && canonicalConversationId !== targetConvId) {
            targetConvId = canonicalConversationId;
            setActiveConvId(canonicalConversationId);
            if (isInternational) setActiveIntlConvId(canonicalConversationId);
            else setActiveIndiaConvId(canonicalConversationId);
            localStorage.setItem(storageKey(LOCAL_STORAGE_ACTIVE_KEY), canonicalConversationId);
          }

          // Server-side scope guard is authoritative. If it blocks a
          // jurisdiction mismatch, surface the same edit-or-switch UX
          // instead of rendering an "Out of Scope" assistant message.
          if (assistantMsg?.scope_blocked) {
            const blockedText =
              assistantMsg.answer || assistantMsg.content || "";
            const blockedLooksIndia = /india|indian|indian statutes|indian mode|indian law/i.test(
              blockedText,
            );
            const blockedLooksInternational = /international|cross-border|pct|wipo|uspto|epo/i.test(
              blockedText,
            );

            if (blockedLooksIndia || blockedLooksInternational) {
              setJurisdictionWarning({
                query: textToSend,
                matchedKeywords: [],
                explanation: blockedText,
              });
              setInputValue(textToSend);
              setLoading(false);
              setStreamingText("");
              return;
            }
          }
        } else {
          requestFailed = true;
        }
      } catch (syncErr) {
        console.warn("Direct chat endpoint notice:", syncErr);
        requestFailed = true;
      }
    }

    if (deletedConversationIdsRef.current.has(requestConversationId)) {
      setLoading(false);
      setStreamingText("");
      return;
    }

    // FIXED: this used to silently swap in a hardcoded, fully fabricated
    // "95% confidence" answer with fake citations (CHUNK-WIPO-001 etc. --
    // ids that don't exist in the real corpus) whenever the real backend
    // call failed or returned no content. For a legal/compliance tool,
    // showing made-up citations at fake high confidence is actively
    // misleading, not a harmless demo fallback -- removed entirely. A
    // failed request now surfaces as an honest, clearly-labeled error with
    // no citations and no confidence score, never as a fabricated answer.
    if (!assistantMsg || !assistantMsg.content) {
      assistantMsg = {
        id: `msg-a-${Date.now()}`,
        conversation_id: targetConvId,
        role: "assistant",
        content: requestFailed
          ? "I couldn't reach the assistant service just now. Please try again in a moment -- if this keeps happening, the backend or RAG service may be temporarily down."
          : "I didn't get a usable response for that query. Please try rephrasing, or try again in a moment.",
        relevant_considerations: [],
        recommended_next_steps: [],
        citations: [],
        confidence: undefined,
        created_at: new Date().toISOString(),
        language,
        jurisdiction: currentJur,
      };
    }


    // Rebind the just-added user message to the authoritative conversation ID.
    const canonicalUserMessages = updatedWithUser.map((m) =>
      m.id === userMsg.id ? { ...m, conversation_id: targetConvId } : m,
    );
    const finalAssistantMsg: StructuredChatMessage = {
      id: assistantMsg.id || `msg-a-${Date.now()}`,
      conversation_id: targetConvId,
      role: "assistant",
      content: assistantMsg.content || assistantMsg.answer || "",
      answer: assistantMsg.answer || assistantMsg.content || "",
      relevant_considerations: assistantMsg.relevant_considerations || [],
      recommended_next_steps: assistantMsg.recommended_next_steps || [],
      citations: assistantMsg.citations || [],
      // FIXED: this used to fabricate a fake "High / 0.95" confidence badge
      // whenever the real response's confidence was missing/falsy, instead
      // of just leaving it unset. Leave it undefined here -- the badge
      // simply doesn't render rather than showing a made-up number (see
      // renderConfidenceBadge below, which already handles `undefined`).
      confidence: assistantMsg.confidence,
      created_at: assistantMsg.created_at || new Date().toISOString(),
      language,
      jurisdiction: currentJur,
      scope_blocked: assistantMsg.scope_blocked,
      expert_escalation: assistantMsg.expert_escalation,
      attachment_name: syncData.attachment_used ? syncData.attachment_name : undefined,
    };

    const finalMessages = [...canonicalUserMessages, finalAssistantMsg];
    setMessages(finalMessages);
    setStreamingText("");

    // Persist final conversation
    const finalConvs = updatedConvsWithUser.map((c) =>
      c.id === targetConvId || c.id === userMsg.conversation_id
        ? {
            ...c,
            id: targetConvId,
            title: updatedTitle,
            jurisdiction: currentJur,
            messages: finalMessages,
            updated_at: new Date().toISOString(),
          }
        : c,
    );
    persistConversations(
      finalConvs.some((c) => c.id === targetConvId)
        ? finalConvs
        : [
            {
              ...currentConv,
              id: targetConvId,
              title: updatedTitle,
              jurisdiction: currentJur,
              messages: finalMessages,
              updated_at: new Date().toISOString(),
            },
            ...finalConvs,
          ],
      targetConvId,
    );
    setLoading(false);
  };

  const copyResponse = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2500);
  };

  const handleFeedback = async (
    msgId: string,
    feedback: "helpful" | "unhelpful",
  ) => {
    try {
      authFetch(`/api/conversations/${activeConvId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: msgId, feedback }),
      }).catch(() => null);

      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, feedback } : m)),
      );
    } catch (e) {}
  };

  const renderConfidenceBadge = (confidence?: {
    level: ConfidenceLevel;
    score: number;
    reasons: string[];
  }) => {
    if (!confidence) return null;
    const { level, reasons, score } = confidence;

    let badgeClasses = "bg-slate-100 text-slate-700 border-slate-200";
    let icon = <Info className="w-3.5 h-3.5 text-slate-500" />;

    if (level === "High") {
      badgeClasses = isInternational
        ? "bg-indigo-50 text-indigo-800 border-indigo-200"
        : "bg-emerald-50 text-emerald-800 border-emerald-200";
      icon = (
        <ShieldCheck
          className={`w-3.5 h-3.5 ${isInternational ? "text-indigo-700" : "text-emerald-700"}`}
        />
      );
    } else if (level === "Moderate") {
      badgeClasses = "bg-blue-50 text-blue-800 border-blue-200";
      icon = <Info className="w-3.5 h-3.5 text-blue-700" />;
    } else if (level === "Low") {
      badgeClasses = "bg-amber-50 text-amber-800 border-amber-200";
      icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />;
    }

    const scoreDisplay =
      typeof score === "number"
        ? score <= 1
          ? `${Math.round(score * 100)}%`
          : `${score}%`
        : level || "95%";

    return (
      <div className="relative group inline-flex items-center">
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 cursor-help ${badgeClasses}`}
        >
          {icon}
          <span>Confidence Score: {scoreDisplay}</span>
        </span>
        {reasons && reasons.length > 0 && (
          <div className="absolute right-0 top-full mt-1 w-64 p-2 bg-slate-900 text-white text-[11px] rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
            <p className="font-medium mb-1">
              Confidence Factors & Statutory Grounds:
            </p>
            <ul className="list-disc pl-3 space-y-0.5 text-slate-300">
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Filter conversations strictly by current jurisdiction (Toggle ON = International; Toggle OFF = Indian)
  const currentJurisdiction: Jurisdiction = isInternational
    ? "international"
    : "india";
  const visibleConversations = conversations.filter(
    (c) => (c.jurisdiction || "india") === currentJurisdiction,
  );
  const filteredConversations = visibleConversations.filter((c) =>
    (c.title || "").toLowerCase().includes(searchHistory.toLowerCase()),
  );

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 overflow-hidden bg-slate-50 relative">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden backdrop-blur-xs"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* History Sidebar: Strictly separated by active jurisdiction */}
      <aside
        className={`${
          sidebarOpen
            ? "w-72 translate-x-0"
            : "w-0 -translate-x-full lg:translate-x-0 lg:w-72"
        } fixed lg:static inset-y-0 left-0 z-40 lg:z-auto shrink-0 bg-white border-r border-slate-200 transition-all duration-300 flex flex-col overflow-hidden h-full shadow-lg lg:shadow-none`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Jurisdiction History
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-slate-600 lg:hidden cursor-pointer"
              title="Close sidebar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Jurisdiction Selector Tabs in Sidebar */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg text-[11px] font-medium border border-slate-200">
            <button
              type="button"
              onClick={() => isInternational && handleToggleJurisdiction(false)}
              className={`py-1.5 px-2 rounded-md transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                !isInternational
                  ? "bg-white text-emerald-950 font-bold shadow-xs border border-emerald-300"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🇮🇳 Indian</span>
              <span className="text-[9px] px-1 rounded bg-slate-200 text-slate-700">
                {
                  conversations.filter(
                    (c) => (c.jurisdiction || "india") === "india",
                  ).length
                }
              </span>
            </button>
            <button
              type="button"
              onClick={() => !isInternational && handleToggleJurisdiction(true)}
              className={`py-1.5 px-2 rounded-md transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                isInternational
                  ? "bg-white text-indigo-950 font-bold shadow-xs border border-indigo-300"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🌐 Intl</span>
              <span className="text-[9px] px-1 rounded bg-slate-200 text-slate-700">
                {
                  conversations.filter(
                    (c) => c.jurisdiction === "international",
                  ).length
                }
              </span>
            </button>
          </div>

          <button
            type="button"
            id="new-chat-btn"
            onClick={startNewConversation}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer ${
              isInternational
                ? "bg-indigo-700 hover:bg-indigo-800"
                : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {isInternational
                ? "New International Session"
                : "New Indian Session"}
            </span>
          </button>
        </div>

        {/* Search Past Sessions */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${isInternational ? "international" : "Indian"} sessions...`}
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              {isInternational
                ? "No international sessions found."
                : "No Indian sessions found."}
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = c.id === activeConvId;
              return (
                <div
                  key={c.id}
                  onClick={() => loadConversation(c.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    isActive
                      ? isInternational
                        ? "bg-indigo-50 text-indigo-950 font-medium"
                        : "bg-slate-100 text-slate-900 font-medium"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-1">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive
                          ? isInternational
                            ? "text-indigo-600"
                            : "text-emerald-700"
                          : "text-slate-400"
                      }`}
                    />
                    <span className="truncate">{c.title}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      title="Rename session"
                      onClick={(e) => renameConversation(e, c)}
                      className="p-1 hover:text-slate-900 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete session"
                      onClick={(e) => deleteConversation(e, c.id)}
                      className="p-1 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Assistant Chat Canvas */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col h-full overflow-hidden bg-white">
        {/* Chat Header Toolbar with the Sahayak Jurisdiction Toggle */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
              title="Toggle sidebar"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900 truncate">
                  Sahayak Assistant
                </h2>
                <span
                  className={`hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium ${
                    isInternational
                      ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {isInternational ? "🌐 International" : "🇮🇳 Indian"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block truncate">
                {isInternational
                  ? "Global PCT, WIPO 2024 Treaty, USPTO 35 U.S.C. 101/102, EPO EPC & Nagoya Protocol"
                  : "Authoritative IPR, AYUSH, Traditional Knowledge & ABS Decision Support"}
              </p>
            </div>
          </div>

          {/* Controls: Jurisdiction Toggle + Language */}
          <div className="flex items-center gap-2 shrink-0">
            {/* The Toggle Button for Sahayak Research Assistant */}
            <div
              id="sahayak-jurisdiction-toggle-container"
              className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl p-1 sm:p-1.5 shadow-2xs"
            >
              <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline pl-1">
                Jurisdiction:
              </span>

              <button
                type="button"
                onClick={() =>
                  isInternational && handleToggleJurisdiction(false)
                }
                className={`text-xs px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                  !isInternational
                    ? "bg-emerald-100 text-emerald-950 font-bold border border-emerald-300 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                🇮🇳 Indian{" "}
                <span className="text-[10px] font-bold uppercase opacity-80">
                  (OFF)
                </span>
              </button>

              <button
                type="button"
                id="sahayak-jurisdiction-toggle"
                role="switch"
                aria-checked={isInternational}
                onClick={() => handleToggleJurisdiction(!isInternational)}
                title={
                  isInternational
                    ? "Toggle is ON (International). Click to turn OFF for Indian Jurisdiction."
                    : "Toggle is OFF (Indian). Click to turn ON for International Jurisdiction."
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-offset-1 ${
                  isInternational
                    ? "bg-indigo-600 focus:ring-indigo-500"
                    : "bg-slate-400 focus:ring-emerald-600"
                }`}
              >
                <span className="sr-only">
                  Toggle jurisdiction: ON for International, OFF for Indian
                </span>
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isInternational ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  !isInternational && handleToggleJurisdiction(true)
                }
                className={`text-xs px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                  isInternational
                    ? "bg-indigo-100 text-indigo-950 font-bold border border-indigo-300 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                🌐 International{" "}
                <span className="text-[10px] font-bold uppercase opacity-80">
                  (ON)
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={shareConversation}
              disabled={!activeConvId}
              title="Share this chat"
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] px-2 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
              {language.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Message Thread */}
        <div
          ref={messagesScrollRef}
          onScroll={(e) => {
            const node = e.currentTarget;
            if (!activeConvId) return;
            try {
              localStorage.setItem(storageKey(`ipsakti_sahayak_scroll_${activeConvId}`), String(node.scrollTop));
            } catch {}
          }}
          className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5 scroll-smooth"
        >
          {messages.length === 0 ? (
            /* Empty State with Suggested Research Questions */
            <div className="max-w-2xl mx-auto py-8 text-center space-y-4">
              <div
                className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center shadow-2xs ${
                  isInternational
                    ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}
              >
                {isInternational ? (
                  <Globe className="w-5 h-5" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">
                  {isInternational
                    ? "Ask Sahayak (International Jurisdiction)"
                    : t("chat.header_title", "Ask Sahayak")}
                </h3>
                <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
                  {isInternational
                    ? "Inquire on global patent eligibility under PCT, USPTO 35 U.S.C. 101/102, EPO EPC Articles 52/53, 2024 WIPO Treaty mandatory disclosure, or Nagoya Protocol ABS."
                    : t(
                        "chat.header_subtitle",
                        "Submit inquiries on patentability under Sections 3(p) & 3(e), Ayurvedic formulation licensing, NBA Form III approvals, or TKDL prior art.",
                      )}
                </p>
              </div>

              {/* Suggested Questions Grid */}
              <div className="space-y-2 pt-2 text-left max-w-xl mx-auto">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider px-1">
                  {t("chat.suggested_title", "Suggested Research Inquiries")}:
                </p>
                <div className="space-y-1.5">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(q)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs font-normal text-slate-800 transition-all flex items-center justify-between group shadow-2xs ${
                        isInternational
                          ? "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40"
                          : "border-slate-200 hover:border-emerald-700/50 hover:bg-emerald-50/40"
                      }`}
                    >
                      <span className="leading-snug">{q}</span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 ml-2 transition-all ${
                          isInternational
                            ? "text-slate-400 group-hover:text-indigo-700 group-hover:translate-x-0.5"
                            : "text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <DisclaimerBanner compact />
            </div>
          ) : (
            /* Active Conversation Thread */
            messages.map((msg) => (
              <div key={msg.id} className="flex flex-col items-start w-full">
                {/* Message Bubble */}
                <div
                  className={`w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl rounded-xl p-3.5 sm:p-4 shadow-2xs transition-all ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white border border-slate-800"
                      : "bg-white border border-slate-200 text-slate-900 space-y-3"
                  }`}
                >
                  {msg.role === "user" ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs text-slate-400">
                        <span className="font-medium uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 text-[11px]">
                          <User className="w-3.5 h-3.5 text-emerald-400" />
                          Question
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap font-normal text-slate-100">
                        {msg.content}
                      </p>
                    </div>
                  ) : msg.scope_blocked ? (
                    /* Scope guard blocked this query (off-topic, prompt-injection
                       attempt, or wrong jurisdiction toggle) -- render ONLY the
                       warning/redirect message: no citations panel, no confidence
                       badge, no "grounded opinion" framing, since no retrieval or
                       generation was attempted for this message at all. See
                       ip_sakti_rag/app/safety/scope_guard.py. */
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Outside Scope
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed font-normal whitespace-pre-line bg-amber-50 border border-amber-200 rounded-lg p-3">
                        {msg.answer || msg.content}
                      </p>
                    </div>
                  ) : (
                    /* Structured AI Response Design */
                    <div className="space-y-3">
                      {/* 1. Answer Header & Text */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                              msg.jurisdiction === "international" ||
                              isInternational
                                ? "text-indigo-900"
                                : "text-emerald-900"
                            }`}
                          >
                            <Sparkles
                              className={`w-3.5 h-3.5 ${
                                msg.jurisdiction === "international" ||
                                isInternational
                                  ? "text-indigo-700"
                                  : "text-emerald-700"
                              }`}
                            />
                            {msg.jurisdiction === "international" ||
                            isInternational
                              ? "International Statutory Grounded Opinion"
                              : "Statutory Grounded Answer"}
                          </span>
                          {renderConfidenceBadge(msg.confidence)}
                        </div>
                        <p className="text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-line">
                          {msg.answer || msg.content}
                        </p>
                        {msg.attachment_name && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-800">
                            <Paperclip className="w-3 h-3" />
                            Attachment referenced: {msg.attachment_name}
                          </div>
                        )}
                      </div>

                      {msg.confidence && (() => {
                        const rawScore = msg.confidence.score;
                        const score = rawScore <= 1 ? rawScore * 100 : rawScore;
                        if (score >= 70) return null;
                        const requested = expertRequestedMsgIds.has(msg.id);
                        const pickerOpen = expertPickerOpenMsgId === msg.id;
                        return (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2.5">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-amber-900">Low confidence — expert review recommended</p>
                                <p className="text-[11px] leading-relaxed text-amber-800 mt-0.5">
                                  The confidence score is below 70%. Choose how you'd like to proceed: get this reviewed by a qualified expert, or raise a grievance.
                                </p>
                              </div>
                            </div>

                            {!requested && (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setExpertPickerOpenMsgId(pickerOpen ? null : msg.id)}
                                  disabled={expertRequestingMsgId === msg.id}
                                  className="px-2.5 py-1.5 rounded-md bg-amber-700 text-white text-[11px] font-medium hover:bg-amber-800 disabled:opacity-60"
                                >
                                  {expertRequestingMsgId === msg.id ? "Requesting..." : "Choose an Expert"}
                                </button>
                                <button type="button" onClick={() => raiseGrievance(msg)} className="px-2.5 py-1.5 rounded-md border border-amber-300 bg-white text-amber-900 text-[11px] font-medium hover:bg-amber-100">
                                  Raise a Grievance
                                </button>
                              </div>
                            )}

                            {requested && (
                              <p className="text-[11px] font-medium text-amber-900">Expert review requested.</p>
                            )}

                            {!requested && pickerOpen && (
                              <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-200/70">
                                {EXPERT_TYPES.map((et) => (
                                  <button
                                    key={et.id}
                                    type="button"
                                    onClick={() => requestExpertReview(msg, et.id)}
                                    disabled={expertRequestingMsgId === msg.id}
                                    className="mt-1.5 px-2.5 py-1.5 rounded-md border border-amber-300 bg-white text-amber-900 text-[11px] font-medium hover:bg-amber-100 disabled:opacity-60"
                                  >
                                    {et.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {grievanceNotice && <p className="text-[10px] text-amber-800 bg-white/70 rounded-md p-2">{grievanceNotice}</p>}
                          </div>
                        );
                      })()}

                      {/* 2. Relevant Considerations */}
                      {msg.relevant_considerations &&
                        msg.relevant_considerations.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <h4 className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              {t(
                                "chat.relevant_considerations",
                                "Relevant Legal Considerations",
                              )}
                            </h4>
                            <ul className="space-y-1">
                              {msg.relevant_considerations.map((item, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 text-xs text-slate-700 leading-normal font-normal"
                                >
                                  <span
                                    className={`font-semibold shrink-0 mt-0.5 ${
                                      msg.jurisdiction === "international" ||
                                      isInternational
                                        ? "text-indigo-600"
                                        : "text-emerald-700"
                                    }`}
                                  >
                                    •
                                  </span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {/* 3. Recommended Next Steps */}
                      {msg.recommended_next_steps &&
                        msg.recommended_next_steps.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <h4 className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <CornerDownRight className="w-3.5 h-3.5 text-slate-500" />
                              {t(
                                "chat.recommended_next_steps",
                                "Recommended Next Steps",
                              )}
                            </h4>
                            <ol className="space-y-1">
                              {msg.recommended_next_steps.map((step, i) => (
                                <li
                                  key={i}
                                  className="text-xs text-slate-700 flex items-start gap-2 leading-normal font-normal"
                                >
                                  <span className="font-medium text-slate-900 shrink-0">
                                    {i + 1}.
                                  </span>
                                  <span>{step.replace(/^\d+\.\s*/, "")}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                      {/* 4. Evidence / Authoritative Sources - 1 Option per section to open working link */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <h4 className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <ShieldCheck
                              className={`w-3.5 h-3.5 ${
                                msg.jurisdiction === "international" ||
                                isInternational
                                  ? "text-indigo-700"
                                  : "text-emerald-700"
                              }`}
                            />
                            {t(
                              "chat.citations_heading",
                              "Authoritative Citations & Legal Provisions",
                            )}{" "}
                            ({msg.citations.length})
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {msg.citations.map((cite) => {
                              return (
                                /* FIXED: this was a plain <a href> straight to
                                   one external link -- the same bug already
                                   fixed in ProductAnalyzerView / IPRNavigatorView
                                   / ResearchView / TraditionalKnowledgeView (see
                                   their comments), just missed here. App.tsx
                                   already wires `onOpenCitation` into ChatView
                                   (see the prop above) -- it just wasn't being
                                   called. Now opens the same CitationModal
                                   everywhere else uses: full retrieved section
                                   text, plus BOTH the source-PDF and official-
                                   site links, instead of jumping straight to
                                   one external link (which was also often
                                   undefined/dead for citations with no
                                   hardcoded sectionLinks.tsx entry and no
                                   ingested `url`, making the card look
                                   completely broken). */
                                <button
                                  type="button"
                                  key={cite.chunk_id}
                                  onClick={() => onOpenCitation(cite)}
                                  title={`View full cited section: ${cite.section} (${cite.authority || "Authoritative source"})`}
                                  className={`p-3 rounded-xl border text-left group transition-all flex flex-col justify-between shadow-2xs hover:shadow-xs w-full ${
                                    msg.jurisdiction === "international" ||
                                    isInternational
                                      ? "border-indigo-200/80 bg-white hover:bg-indigo-50/60 hover:border-indigo-400"
                                      : "border-emerald-200/80 bg-white hover:bg-emerald-50/60 hover:border-emerald-400"
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                                      <span
                                        className={`text-xs font-bold line-clamp-1 ${
                                          msg.jurisdiction ===
                                            "international" || isInternational
                                            ? "text-slate-900 group-hover:text-indigo-950"
                                            : "text-slate-900 group-hover:text-emerald-950"
                                        }`}
                                      >
                                        [{cite.index}] {cite.section}
                                      </span>
                                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium shrink-0 border border-slate-200/70">
                                        {cite.authority.split(",")[0]}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 line-clamp-2 italic font-serif leading-relaxed">
                                      "{cite.excerpt}"
                                    </p>
                                  </div>

                                  {/* Single action to open the popup with both links */}
                                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      Official Reference
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1 font-semibold text-xs group-hover:underline ${
                                        msg.jurisdiction === "international" ||
                                        isInternational
                                          ? "text-indigo-800 group-hover:text-indigo-950"
                                          : "text-emerald-800 group-hover:text-emerald-950"
                                      }`}
                                    >
                                      <span>View Full Citation</span>
                                      <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Utility Footer: Copy, Feedback */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              copyResponse(msg.id, msg.answer || msg.content)
                            }
                            className="flex items-center gap-1 hover:text-slate-700 transition-colors text-xs font-normal"
                          >
                            {copiedMsgId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-600 text-xs">
                                  Copied
                                </span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span className="text-xs">Copy Response</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Feedback */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px]">Was this helpful?</span>
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "helpful")}
                            className={`p-1 rounded hover:bg-slate-100 transition-colors ${
                              msg.feedback === "helpful"
                                ? "text-emerald-700"
                                : "text-slate-400"
                            }`}
                            title="Helpful"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "unhelpful")}
                            className={`p-1 rounded hover:bg-slate-100 transition-colors ${
                              msg.feedback === "unhelpful"
                                ? "text-rose-600"
                                : "text-slate-400"
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
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))
          )}

          {/* Live Streaming Token Output */}
          {loading && streamingText && (
            <div className="flex flex-col items-start w-full">
              <div className="w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl rounded-xl p-3.5 bg-white border border-slate-200 text-slate-900 shadow-2xs space-y-2">
                <div
                  className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${
                    isInternational ? "text-indigo-800" : "text-emerald-800"
                  }`}
                >
                  <Sparkles
                    className={`w-3.5 h-3.5 animate-spin ${isInternational ? "text-indigo-700" : "text-emerald-700"}`}
                  />
                  <span>
                    {isInternational
                      ? "International Opinion (Synthesizing...)"
                      : "Statutory Grounded Answer (Synthesizing...)"}
                  </span>
                </div>
                <p className="text-xs font-normal leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {streamingText}
                  <span
                    className={`inline-block w-1.5 h-3.5 ml-1 animate-pulse ${isInternational ? "bg-indigo-700" : "bg-emerald-700"}`}
                  />
                </p>
              </div>
            </div>
          )}

          {/* Loading Indicator when starting */}
          {loading && !streamingText && (
            <div className="flex flex-col items-start w-full">
              <div className="w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl rounded-xl p-3.5 bg-white border border-slate-200 text-slate-600 shadow-2xs flex items-center gap-3">
                <div
                  className={`w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin shrink-0 ${
                    isInternational ? "border-indigo-700" : "border-emerald-700"
                  }`}
                />
                <span className="text-xs font-normal">
                  {isInternational
                    ? "Retrieving international treaties (PCT, WIPO, Nagoya) and synthesizing comparative global opinion..."
                    : "Retrieving Indian legal statutes and synthesizing grounded opinion..."}
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Input Bar Section */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white space-y-2.5">
          {/* Query Relevance Scope Warning Banner */}
          {relevanceWarning && (
            <div
              id="query-relevance-warning-banner"
              className="rounded-xl border border-sky-300 bg-sky-50/95 p-3 sm:p-3.5 shadow-sm text-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-800 shrink-0 mt-0.5">
                  <Info className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                      <span>Out of Research Scope</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setRelevanceWarning(null)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-colors"
                      title="Dismiss notice"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed font-normal">
                    {relevanceWarning.reason}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-sky-900 mr-1">
                      Intended Research Scope:
                    </span>
                    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-white text-sky-900 border border-sky-200 font-medium">
                      🌿 Ayurveda & AYUSH
                    </span>
                    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-white text-sky-900 border border-sky-200 font-medium">
                      📜 Traditional Knowledge & TKDL
                    </span>
                    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-white text-sky-900 border border-sky-200 font-medium">
                      ⚖️ Patents & IP Rights
                    </span>
                    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-white text-sky-900 border border-sky-200 font-medium">
                      🧬 Biodiversity & ABS (NBA)
                    </span>
                    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-white text-sky-900 border border-sky-200 font-medium">
                      📋 Schedule T GMP & Licensing
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1.5">
                    <button
                      type="button"
                      id="btn-edit-relevance-query"
                      onClick={() => {
                        setInputValue(relevanceWarning.query);
                        setRelevanceWarning(null);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-sky-300 bg-white hover:bg-sky-50 text-sky-900 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      Refine Query for IP-SAKTI
                    </button>
                    <button
                      type="button"
                      id="btn-dismiss-relevance"
                      onClick={() => setRelevanceWarning(null)}
                      className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Jurisdiction Mismatch Alert Banner */}
{jurisdictionWarning && (
  <div
    id="jurisdiction-mode-mismatch-banner"
    className="rounded-xl border border-amber-300 bg-amber-50/95 p-3 sm:p-3.5 shadow-sm text-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-200"
  >
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
        <AlertTriangle className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
            <span>
              {isInternational
                ? "India / Domestic Query Detected in International Mode"
                : "International Query Detected in Domestic Mode"}
            </span>
          </h4>

          <button
            type="button"
            onClick={() => setJurisdictionWarning(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-colors"
            title="Dismiss warning"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs text-slate-700 leading-relaxed font-normal">
          {jurisdictionWarning.explanation}
        </p>

        <p className="text-xs text-slate-700 leading-relaxed font-normal">
          {isInternational
            ? "This query appears to require India / Domestic jurisdiction. Please switch to India / Domestic Mode or edit your query."
            : "This query appears to require an international jurisdiction. Please switch to International Mode or edit your query."}
        </p>

        {jurisdictionWarning.matchedKeywords.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 mr-1">
              Detected:
            </span>

            {jurisdictionWarning.matchedKeywords.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1.5">
          {isInternational ? (
            <button
              type="button"
              id="btn-switch-to-india-mode"
              onClick={() =>
                handleSwitchToIndiaAndSend(jurisdictionWarning.query)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <span>
                🇮🇳 Switch to India / Domestic Mode & Submit
              </span>
              <CornerDownRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              id="btn-switch-to-international-mode"
              onClick={() =>
                handleSwitchToInternationalAndSend(
                  jurisdictionWarning.query
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <span>
                🌐 Switch to International Mode & Submit
              </span>
              <CornerDownRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            id="btn-dismiss-jurisdiction-warning"
            onClick={() => {
              setInputValue(jurisdictionWarning.query);
              setJurisdictionWarning(null);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
          >
            Edit Query
          </button>
        </div>
      </div>
    </div>
  </div>
)}

          <input
            ref={attachmentInputRef}
            type="file"
            className="hidden"
            onChange={handleAttachmentSelected}
          />

          {selectedAttachment && (
            <div className={`mb-2 flex items-center justify-between rounded-xl border px-3 py-2 text-xs shadow-sm ${
              attachmentError
                ? "border-rose-200 bg-rose-50/80 text-rose-800"
                : "border-emerald-200 bg-emerald-50/70 text-slate-700"
            }`}>
              <span className="flex min-w-0 items-center gap-1.5">
                {attachmentKind === "image" ? <ImagePlus className="w-3.5 h-3.5 shrink-0" /> : <Paperclip className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{selectedAttachment.name}</span>
                <span className={`ml-2 shrink-0 text-[10px] font-semibold ${attachmentError ? "text-rose-700" : "text-emerald-700"}`}>
                  {attachmentProcessing ? "Reading…" : attachmentError ? "Could not read" : attachmentContext ? "Read" : "Attached"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedAttachment(null);
                  setAttachmentContext("");
                  setAttachmentError(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700"
                title="Remove attachment"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {attachmentError && selectedAttachment && (
            <p className="mb-2 px-1 text-[10px] text-rose-700">{attachmentError}</p>
          )}

          <form
            id="sahayak-chat-form-container"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl p-1.5 focus-within:border-slate-600 focus-within:ring-1 focus-within:ring-slate-400 transition-all"
          >
            <div className="relative shrink-0">
              <button
                type="button"
                title="Add document or image"
                onClick={() => setAttachmentMenuOpen((open) => !open)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
              {attachmentMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-40 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg z-50">
                  <button type="button" onClick={() => openAttachmentPicker("document")} className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-slate-700 hover:bg-slate-50">
                    <Paperclip className="w-3.5 h-3.5" /> Add Document
                  </button>
                  <button type="button" onClick={() => openAttachmentPicker("image")} className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-slate-700 hover:bg-slate-50">
                    <ImagePlus className="w-3.5 h-3.5" /> Add Image
                  </button>
                </div>
              )}
            </div>

            {/* Voice Input */}
            <VoiceInputButton
              onTranscript={(transcript, isFinal) => {
                setInputValue(transcript);
                if (isFinal && transcript.trim()) {
                  handleSend(transcript.trim());
                }
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
              placeholder={
                isInternational
                  ? `Ask international patentability, PCT, WIPO 2024 Treaty, USPTO, or Nagoya Protocol questions...`
                  : t(
                      "chat.input_placeholder",
                      `Ask questions about IPR, AYUSH, or Traditional Knowledge in ${language.toUpperCase()}...`,
                    )
              }
              className="flex-1 min-w-0 bg-transparent px-2 py-1.5 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
            />

            {/* Submit Button */}
            <button
              type="submit"
              id="sahayak-send-btn"
              disabled={!inputValue.trim() || loading || attachmentProcessing || Boolean(attachmentError)}
              className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                inputValue.trim() && !loading
                  ? isInternational
                    ? "bg-indigo-700 hover:bg-indigo-800 text-white shadow-2xs"
                    : "bg-slate-900 hover:bg-slate-800 text-white shadow-2xs"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              {attachmentProcessing ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>

          {/* Quick Legal Footnote */}
          <p className="text-[10px] text-center text-slate-400 font-normal">
            {isInternational
              ? "IP-SAKTI Sahayak synthesizes PCT, WIPO 2024 Treaty, USPTO, EPO, and Nagoya Protocol provisions. Verify with local patent agents before foreign filings."
              : "IP-SAKTI Sahayak synthesizes indexed statutory provisions from IP India, AYUSH, and NBA. Always verify before formal filing."}
          </p>
        </div>
      </main>
    </div>
  );
};
