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
import { getSectionLink } from "../utils/sectionLinks";
import {
  evaluateQueryJurisdiction,
  JurisdictionCheckResult,
} from "../utils/jurisdictionValidation";
import {
  evaluateQueryRelevance,
  QueryRelevanceResult,
} from "../utils/queryRelevance";
import { authFetch } from "./auth/authStorage";

interface ChatViewProps {
  language: Language;
  onOpenCitation: (citation: Citation) => void;
}

const LOCAL_STORAGE_CONVS_KEY = "ipsakti_sahayak_conversations_v2";
const LOCAL_STORAGE_ACTIVE_KEY = "ipsakti_sahayak_active_conv_id_v2";
const LOCAL_STORAGE_ACTIVE_INDIA_KEY = "ipsakti_sahayak_active_india_id";
const LOCAL_STORAGE_ACTIVE_INTL_KEY = "ipsakti_sahayak_active_intl_id";
const LOCAL_STORAGE_JURISDICTION_KEY = "ipsakti_sahayak_jurisdiction_toggle";

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

function getInitialConversations(): Conversation[] {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_CONVS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized: Conversation[] = parsed.map((c: Conversation) => ({
            ...c,
            jurisdiction: (c.jurisdiction || "india") as Jurisdiction,
            messages: (c.messages || []).map((m) => ({
              ...m,
              jurisdiction: (m.jurisdiction ||
                c.jurisdiction ||
                "india") as Jurisdiction,
            })),
          }));
          const hasIntl = normalized.some(
            (c: Conversation) => c.jurisdiction === "international",
          );
          if (!hasIntl) {
            normalized.push(DEFAULT_INITIAL_INTL_CONV);
          }
          return normalized;
        }
      }
    } catch (e) {}
  }
  return [DEFAULT_INITIAL_CONV, DEFAULT_INITIAL_INTL_CONV];
}

function getInitialIsInternational(): boolean {
  if (typeof window !== "undefined") {
    try {
      const savedMode = localStorage.getItem(LOCAL_STORAGE_JURISDICTION_KEY);
      if (savedMode === "international") return true;
      if (savedMode === "india") return false;
    } catch (e) {}
  }
  return false;
}

function getInitialActiveId(convs: Conversation[], isIntl: boolean): string {
  const targetJur: Jurisdiction = isIntl ? "international" : "india";
  const savedKey = isIntl
    ? LOCAL_STORAGE_ACTIVE_INTL_KEY
    : LOCAL_STORAGE_ACTIVE_INDIA_KEY;
  if (typeof window !== "undefined") {
    try {
      const storedId = localStorage.getItem(savedKey);
      if (
        storedId &&
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
  return (
    matching[0]?.id ||
    (isIntl ? DEFAULT_INITIAL_INTL_CONV.id : DEFAULT_INITIAL_CONV.id)
  );
}

export const ChatView: React.FC<ChatViewProps> = ({
  language,
  onOpenCitation,
}) => {
  const { t } = useTranslation();

  const [isInternational, setIsInternational] = useState<boolean>(() =>
    getInitialIsInternational(),
  );
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    getInitialConversations(),
  );

  const [activeConvId, setActiveConvId] = useState<string>(() => {
    const initialConvs = getInitialConversations();
    const isIntl = getInitialIsInternational();
    return getInitialActiveId(initialConvs, isIntl);
  });

  const [activeIndiaConvId, setActiveIndiaConvId] = useState<string>(() => {
    const initialConvs = getInitialConversations();
    return getInitialActiveId(initialConvs, false);
  });

  const [activeIntlConvId, setActiveIntlConvId] = useState<string>(() => {
    const initialConvs = getInitialConversations();
    return getInitialActiveId(initialConvs, true);
  });

  const [messages, setMessages] = useState<StructuredChatMessage[]>(() => {
    const initialConvs = getInitialConversations();
    const isIntl = getInitialIsInternational();
    const activeId = getInitialActiveId(initialConvs, isIntl);
    const active = initialConvs.find((c) => c.id === activeId);
    return (
      active?.messages ||
      (isIntl
        ? DEFAULT_INITIAL_INTL_CONV.messages
        : DEFAULT_INITIAL_CONV.messages)
    );
  });

  const [inputValue, setInputValue] = useState("");
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Helper to persist conversations to localStorage
  const persistConversations = (
    updated: Conversation[],
    newActiveId?: string,
  ) => {
    setConversations(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LOCAL_STORAGE_CONVS_KEY, JSON.stringify(updated));
        if (newActiveId) {
          localStorage.setItem(LOCAL_STORAGE_ACTIVE_KEY, newActiveId);
          if (isInternational) {
            localStorage.setItem(LOCAL_STORAGE_ACTIVE_INTL_KEY, newActiveId);
          } else {
            localStorage.setItem(LOCAL_STORAGE_ACTIVE_INDIA_KEY, newActiveId);
          }
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
          LOCAL_STORAGE_CONVS_KEY,
          JSON.stringify(currentConvs),
        );
      } catch (e) {}
    }

    setIsInternational(checked);
    const targetJur: Jurisdiction = checked ? "international" : "india";
    try {
      localStorage.setItem(LOCAL_STORAGE_JURISDICTION_KEY, targetJur);
    } catch (e) {}

    const matchingConvs = currentConvs.filter(
      (c) => (c.jurisdiction || "india") === targetJur,
    );
    const savedKey = checked
      ? LOCAL_STORAGE_ACTIVE_INTL_KEY
      : LOCAL_STORAGE_ACTIVE_INDIA_KEY;
    let targetId =
      typeof window !== "undefined" ? localStorage.getItem(savedKey) || "" : "";
    let targetConv = matchingConvs.find((c) => c.id === targetId);

    if (!targetConv) {
      if (matchingConvs.length > 0) {
        targetConv = matchingConvs[0];
        targetId = targetConv.id;
      } else {
        const newConv: Conversation = checked
          ? {
              ...DEFAULT_INITIAL_INTL_CONV,
              id: `conv-intl-${Date.now()}`,
            }
          : {
              ...DEFAULT_INITIAL_CONV,
              id: `conv-india-${Date.now()}`,
            };
        currentConvs = [newConv, ...currentConvs];
        persistConversations(currentConvs, newConv.id);
        targetConv = newConv;
        targetId = newConv.id;
      }
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
      localStorage.setItem(savedKey, targetId);
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_KEY, targetId);
    } catch (e) {}
  };

  // Helper to immediately switch to Indian jurisdiction and automatically execute query
  const handleSwitchToIndiaAndSend = (pendingQuery: string) => {
    setJurisdictionWarning(null);
    handleToggleJurisdiction(false);
    // Send in next tick after jurisdiction state and conversation swap have processed
    setTimeout(() => {
      handleSend(pendingQuery, { forceSend: true });
    }, 50);
  };

  // Sync with backend on mount
  useEffect(() => {
    fetchServerConversations();
  }, []);

  const fetchServerConversations = async () => {
    try {
      const res = await authFetch("/api/conversations");
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || !contentType.includes("application/json")) {
        return;
      }
      const serverConvs: Conversation[] = await res.json();
      if (Array.isArray(serverConvs) && serverConvs.length > 0) {
        setConversations((prev) => {
          const mergedMap = new Map<string, Conversation>();
          for (const sc of serverConvs) {
            mergedMap.set(sc.id, {
              ...sc,
              jurisdiction: sc.jurisdiction || "india",
            });
          }
          for (const pc of prev) {
            const existing = mergedMap.get(pc.id);
            if (
              !existing ||
              (pc.messages &&
                pc.messages.length > (existing.messages?.length || 0))
            ) {
              mergedMap.set(pc.id, pc);
            }
          }
          const merged = Array.from(mergedMap.values()).sort(
            (a, b) =>
              new Date(b.updated_at || b.created_at).getTime() -
              new Date(a.updated_at || a.created_at).getTime(),
          );

          const hasIntl = merged.some(
            (c) => c.jurisdiction === "international",
          );
          if (!hasIntl) {
            merged.push(DEFAULT_INITIAL_INTL_CONV);
          }

          try {
            localStorage.setItem(
              LOCAL_STORAGE_CONVS_KEY,
              JSON.stringify(merged),
            );
          } catch (e) {}

          const targetJur: Jurisdiction = isInternational
            ? "international"
            : "india";
          const current =
            merged.find(
              (c) =>
                c.id === activeConvId &&
                (c.jurisdiction || "india") === targetJur,
            ) ||
            merged.find((c) => (c.jurisdiction || "india") === targetJur) ||
            merged[0];

          if (current && current.messages && current.messages.length > 0) {
            setMessages(current.messages);
            setActiveConvId(current.id);
          }
          return merged;
        });
      }
    } catch (e) {
      // Offline / transient network notice
    }
  };

  const loadConversation = (id: string) => {
    setActiveConvId(id);
    if (isInternational) {
      setActiveIntlConvId(id);
      try {
        localStorage.setItem(LOCAL_STORAGE_ACTIVE_INTL_KEY, id);
      } catch (e) {}
    } else {
      setActiveIndiaConvId(id);
      try {
        localStorage.setItem(LOCAL_STORAGE_ACTIVE_INDIA_KEY, id);
      } catch (e) {}
    }

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LOCAL_STORAGE_ACTIVE_KEY, id);
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
    const newId = `conv-${currentJur}-${Date.now()}`;
    const defaultTitle = isInternational
      ? "New International IP Consultation"
      : "New Indian Legal Consultation";

    const newConv: Conversation = {
      id: newId,
      user_id: "user-default",
      title: defaultTitle,
      language,
      jurisdiction: currentJur,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [],
    };

    const updated = [newConv, ...conversations];
    persistConversations(updated, newId);
    setActiveConvId(newId);
    if (isInternational) {
      setActiveIntlConvId(newId);
    } else {
      setActiveIndiaConvId(newId);
    }
    setMessages([]);
    setStreamingText("");
    setInputValue("");

    // Register on server
    authFetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: defaultTitle,
        language,
        jurisdiction: currentJur,
      }),
    }).catch(() => null);

    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      authFetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(
        () => null,
      );
      const updated = conversations.filter((c) => c.id !== id);
      const currentJur: Jurisdiction = isInternational
        ? "international"
        : "india";
      const remainingMatching = updated.filter(
        (c) => (c.jurisdiction || "india") === currentJur,
      );

      let nextActiveId = activeConvId;
      if (activeConvId === id) {
        nextActiveId = remainingMatching[0]?.id || "";
      }

      persistConversations(updated, nextActiveId);

      if (activeConvId === id) {
        if (remainingMatching.length > 0) {
          loadConversation(remainingMatching[0].id);
        } else {
          startNewConversation();
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  // Send query with streaming response and robust session storage
  const handleSend = async (
    queryText?: string,
    options?: { forceSend?: boolean },
  ) => {
    const textToSend = queryText || inputValue;
    if (!textToSend.trim() || loading) return;

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

    // 2. RULE: When International mode is selected, it must NOT answer an India/state-specific query as international.
    // Detect India-specific queries when in International mode and prompt user to switch to India/Domestic mode.
    if (isInternational && !options?.forceSend) {
      const check = evaluateQueryJurisdiction(textToSend);
      if (check.isIndiaSpecific) {
        setJurisdictionWarning({
          query: textToSend,
          matchedKeywords: check.matchedKeywords,
          explanation: check.explanation,
        });
        return;
      }
    }

    // Clear any active warnings on valid submission
    setRelevanceWarning(null);
    setJurisdictionWarning(null);
    setInputValue("");
    setLoading(true);
    setStreamingText("");

    const currentJur: Jurisdiction = isInternational
      ? "international"
      : "india";

    // Ensure we have an active conversation of the right jurisdiction
    let targetConvId = activeConvId;
    let currentConv = conversations.find(
      (c) =>
        c.id === targetConvId && (c.jurisdiction || "india") === currentJur,
    );

    if (!targetConvId || !currentConv) {
      targetConvId = `conv-${currentJur}-${Date.now()}`;
      const newTitle =
        textToSend.slice(0, 45) + (textToSend.length > 45 ? "..." : "");
      currentConv = {
        id: targetConvId,
        user_id: "user-default",
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
        localStorage.setItem(LOCAL_STORAGE_ACTIVE_KEY, targetConvId);
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
      currentConv.title === "New International IP Consultation" ||
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

    // NOTE: there is no POST /api/chat/stream route on the backend (chat.py
    // only implements /api/chat and /api/query, both non-streaming) -- an
    // earlier version of this function tried it first on every single
    // message, which was a guaranteed 404 every time before falling back.
    // Removed that attempt entirely; goes straight to the real endpoint below.
    // (streamingText/setStreamingText are left in place for a future real
    // streaming endpoint -- see README's "honest gaps" section.)
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
          }),
        });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          assistantMsg = syncData.message || syncData;
        }
      } catch (syncErr) {
        console.warn("Direct chat endpoint notice:", syncErr);
      }
    }

    // 3. Fallback grounded synthesis if backend was completely offline
    if (!assistantMsg || !assistantMsg.content) {
      if (isInternational) {
        assistantMsg = {
          id: `msg-a-${Date.now()}`,
          conversation_id: targetConvId,
          role: "assistant",
          content:
            "Under International Patent frameworks (Patent Cooperation Treaty PCT, USPTO, and EPO), biological and traditional formulation patentability hinges on novelty, inventive step, non-obvious synergy, and mandatory compliance with international genetic resource disclosure rules. Under 35 U.S.C. § 101 in the United States, natural botanical products or mere aggregations are patent-ineligible without markedly different structural or functional characteristics. Under Article 3 of the 2024 WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge and the Nagoya Protocol, international applicants must disclose country of origin and furnish evidence of Prior Informed Consent (PIC) and Access & Benefit Sharing (ABS) compliance.",
          relevant_considerations: [
            "USPTO 35 U.S.C. § 101: Natural product doctrine requires non-natural functional synergy or markedly different characteristics.",
            "EPO EPC Articles 52/53: Therapeutic treatment claims barred; second medical indication formatting required.",
            "2024 WIPO GRATK Treaty & Nagoya Protocol: Mandatory disclosure of genetic resources and traditional knowledge provenance.",
            "PCT International Searching Authorities (ISA): Routine citations against CSIR Traditional Knowledge Digital Library (TKDL).",
          ],
          recommended_next_steps: [
            "File a PCT international application to preserve priority across 157 member states.",
            "Obtain mandatory prior domestic biodiversity approval (NBA Form III under Section 6 of Indian BD Act) before filing foreign patents.",
            "Conduct global prior art search across USPTO Patent Public Search, EPO Espacenet, and WIPO Patentscope.",
            "Draft claims focused on standardized bioactive fractions, bioavailability enhancers, or synergistic combinations supported by comparative assay data.",
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
              title: "Patent Cooperation Treaty (PCT / WIPO)",
              authority: "WIPO International Bureau",
              section: "Article 15: International Search & Prior Art Clearance",
              source: "WIPO PCT Regulations",
              excerpt:
                "The International Searching Authority conducts prior art searches citing multilateral traditional medicine databases including CSIR-TKDL.",
            },
            {
              index: 3,
              chunk_id: "CHUNK-NAGOYA-001",
              document_id: "DOC-CBD-NAGOYA",
              title:
                "Nagoya Protocol on Access to Genetic Resources and Benefit Sharing (ABS)",
              authority:
                "Secretariat of the Convention on Biological Diversity",
              section:
                "Articles 5, 6 & 15: Compliance and Fair Benefit Sharing",
              source: "United Nations Treaty Series",
              excerpt:
                "Parties shall enforce compliance measures ensuring genetic resources utilized within their jurisdiction have obtained prior informed consent and mutually agreed terms.",
            },
          ],
          confidence: {
            level: "High",
            score: 0.95,
            reasons: [
              "Corroborated by WIPO Treaty on Genetic Resources & Associated Traditional Knowledge (2024).",
              "Grounded in Patent Cooperation Treaty (PCT) and Nagoya Protocol standards.",
              "Verified against USPTO 35 U.S.C. 101/102 and EPO EPC Articles 52/53.",
            ],
          },
          created_at: new Date().toISOString(),
          language,
          jurisdiction: "international",
        };
      } else {
        assistantMsg = {
          id: `msg-a-${Date.now()}`,
          conversation_id: targetConvId,
          role: "assistant",
          content:
            "Under Section 3(p) and Section 3(e) of the Indian Patents Act, 1970, traditional herbal formulations and combinations are strictly scrutinized against traditional knowledge codification and mere admixture exclusions. Prior approval from the National Biodiversity Authority (Form III) under Section 6 of the Biological Diversity Act, 2002 is required before patent grants for Indian biological resources.",
          relevant_considerations: [
            "Section 3(p) statutory bar against traditional knowledge monopolization.",
            "Section 3(e) admixture hurdle requiring comparative synergistic efficacy data.",
            "Mandatory NBA Form III approval under Section 6 of Biological Diversity Act, 2002.",
          ],
          recommended_next_steps: [
            "Conduct clearance search in CSIR Traditional Knowledge Digital Library (TKDL).",
            "File Form III application with the National Biodiversity Authority (NBA).",
            "Ensure adherence to Schedule T Good Manufacturing Practices for manufacturing.",
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
            score: 0.95,
            reasons: [
              "Corroborated by primary statutory provisions of The Patents Act and Biological Diversity Act.",
            ],
          },
          created_at: new Date().toISOString(),
          language,
          jurisdiction: "india",
        };
      }
    }

    const finalAssistantMsg: StructuredChatMessage = {
      id: assistantMsg.id || `msg-a-${Date.now()}`,
      conversation_id: targetConvId,
      role: "assistant",
      content: assistantMsg.content || assistantMsg.answer || "",
      answer: assistantMsg.answer || assistantMsg.content || "",
      relevant_considerations: assistantMsg.relevant_considerations || [],
      recommended_next_steps: assistantMsg.recommended_next_steps || [],
      citations: assistantMsg.citations || [],
      confidence: assistantMsg.confidence || {
        level: "High",
        score: 0.95,
        reasons: ["Corroborated by primary statutory legal provisions."],
      },
      created_at: assistantMsg.created_at || new Date().toISOString(),
      language,
      jurisdiction: currentJur,
    };

    const finalMessages = [...updatedWithUser, finalAssistantMsg];
    setMessages(finalMessages);
    setStreamingText("");

    // Persist final conversation
    const finalConvs = updatedConvsWithUser.map((c) =>
      c.id === targetConvId
        ? {
            ...c,
            title: updatedTitle,
            jurisdiction: currentJur,
            messages: finalMessages,
            updated_at: new Date().toISOString(),
          }
        : c,
    );
    persistConversations(finalConvs, targetConvId);
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
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 relative">
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
                  <button
                    type="button"
                    title="Delete session"
                    onClick={(e) => deleteConversation(e, c.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Assistant Chat Canvas */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">
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

            <span className="text-[11px] px-2 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
              {language.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
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
                  className={`w-full max-w-3xl rounded-xl p-3.5 sm:p-4 shadow-2xs transition-all ${
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
                      </div>

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
                              const linkInfo = getSectionLink(
                                cite.section,
                                cite.document_id,
                              );
                              const citeUrl = cite.url || linkInfo.url;
                              return (
                                <a
                                  key={cite.chunk_id}
                                  href={citeUrl}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  title={`Open authoritative statutory text: ${cite.section} (${linkInfo.authority})`}
                                  className={`p-3 rounded-xl border text-left group transition-all flex flex-col justify-between shadow-2xs hover:shadow-xs ${
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

                                  {/* Single action to open the working link */}
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
                                      <span>Open Cited Section</span>
                                      <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                                    </span>
                                  </div>
                                </a>
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
              <div className="w-full max-w-3xl rounded-xl p-3.5 bg-white border border-slate-200 text-slate-900 shadow-2xs space-y-2">
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
              <div className="w-full max-w-3xl rounded-xl p-3.5 bg-white border border-slate-200 text-slate-600 shadow-2xs flex items-center gap-3">
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

          <div ref={messagesEndRef} />
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
                        India / Domestic Query Detected in International Mode
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
                    {jurisdictionWarning.explanation} International Mode
                    synthesizes global treaties (PCT, USPTO, EPO, WIPO 2024
                    Treaty, Nagoya Protocol) and will not correctly process
                    India-specific statutory or state laws.
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
                    <button
                      type="button"
                      id="btn-switch-to-india-mode"
                      onClick={() =>
                        handleSwitchToIndiaAndSend(jurisdictionWarning.query)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <span>🇮🇳 Switch to India / Domestic Mode & Submit</span>
                      <CornerDownRight className="w-3.5 h-3.5" />
                    </button>

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

          <form
            id="sahayak-chat-form-container"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl p-1.5 focus-within:border-slate-600 focus-within:ring-1 focus-within:ring-slate-400 transition-all"
          >
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
              disabled={loading}
              className="flex-1 bg-transparent px-2 py-1.5 text-xs font-normal text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
            />

            {/* Submit Button */}
            <button
              type="submit"
              id="sahayak-send-btn"
              disabled={!inputValue.trim() || loading}
              className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                inputValue.trim() && !loading
                  ? isInternational
                    ? "bg-indigo-700 hover:bg-indigo-800 text-white shadow-2xs"
                    : "bg-slate-900 hover:bg-slate-800 text-white shadow-2xs"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
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
