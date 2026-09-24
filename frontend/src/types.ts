// Core TypeScript types for IP-SAKTI Sahayak

export type Language =
  | 'en'
  | 'as'  // Assamese
  | 'bn'  // Bengali
  | 'brx' // Bodo
  | 'doi' // Dogri
  | 'gu'  // Gujarati
  | 'hi'  // Hindi
  | 'kn'  // Kannada
  | 'ks'  // Kashmiri
  | 'kok' // Konkani
  | 'mai' // Maithili
  | 'ml'  // Malayalam
  | 'mni' // Manipuri
  | 'mr'  // Marathi
  | 'ne'  // Nepali
  | 'or'  // Odia
  | 'pa'  // Punjabi
  | 'sa'  // Sanskrit
  | 'sat' // Santali
  | 'sd'  // Sindhi
  | 'ta'  // Tamil
  | 'te'  // Telugu
  | 'ur'; // Urdu

export interface LanguageInfo {
  code: Language;
  label: string;
  native: string;
  speechCode: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', label: 'English', native: 'English', speechCode: 'en-IN' },
  { code: 'as', label: 'Assamese', native: 'অসমীয়া', speechCode: 'as-IN' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', speechCode: 'bn-IN' },
  { code: 'brx', label: 'Bodo', native: 'बड़ो', speechCode: 'brx-IN' },
  { code: 'doi', label: 'Dogri', native: 'डोगरी', speechCode: 'doi-IN' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', speechCode: 'gu-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', speechCode: 'hi-IN' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', speechCode: 'kn-IN' },
  { code: 'ks', label: 'Kashmiri', native: 'कश्मीरी (كٲشُر)', speechCode: 'ks-IN' },
  { code: 'kok', label: 'Konkani', native: 'कोंकणी', speechCode: 'kok-IN' },
  { code: 'mai', label: 'Maithili', native: 'मैथिली', speechCode: 'mai-IN' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം', speechCode: 'ml-IN' },
  { code: 'mni', label: 'Manipuri', native: 'মৈতৈলোন্', speechCode: 'mni-IN' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', speechCode: 'mr-IN' },
  { code: 'ne', label: 'Nepali', native: 'नेपाली', speechCode: 'ne-NP' },
  { code: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ', speechCode: 'or-IN' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', speechCode: 'pa-IN' },
  { code: 'sa', label: 'Sanskrit', native: 'संस्कृतम्', speechCode: 'sa-IN' },
  { code: 'sat', label: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ', speechCode: 'sat-IN' },
  { code: 'sd', label: 'Sindhi', native: 'सिंधी (سنڌي)', speechCode: 'sd-IN' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', speechCode: 'ta-IN' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', speechCode: 'te-IN' },
  { code: 'ur', label: 'Urdu', native: 'اردو', speechCode: 'ur-IN' },
];

export const LANGUAGES_MAP: Record<Language, LanguageInfo> = SUPPORTED_LANGUAGES.reduce(
  (acc, item) => ({ ...acc, [item.code]: item }),
  {} as Record<Language, LanguageInfo>
);

export type UserRole =
  | 'Practitioner'
  | 'Researcher'
  | 'Expert'
  | 'Admin'
  | 'Organization'
  | 'USER'
  | 'EXPERT'
  | 'ADMIN';

export type JurisdictionMode = 'India' | 'International';

export const ALL_ROLES: UserRole[] = [
  'Practitioner',
  'Researcher',
  'Expert',
  'Admin',
  'Organization'
];

export const USER_ROLE_OPTIONS = ALL_ROLES;

export interface RoleMetaInfo {
  id: UserRole;
  label: string;
  badge: string;
  title: string;
  desc: string;
  pillBg: string;
}

export const ROLE_DEFINITIONS: Record<string, RoleMetaInfo> = {
  Practitioner: {
    id: 'Practitioner',
    label: 'Practitioner',
    badge: 'Practitioner',
    title: 'AYUSH Clinician & Vaidya',
    desc: 'Access to AYUSH formulation clearance, clinical Section 3(p) prior-art checks, and formulation documentation.',
    pillBg: 'bg-teal-50 text-teal-900 border-teal-200'
  },
  Researcher: {
    id: 'Researcher',
    label: 'Researcher',
    badge: 'Researcher',
    title: 'Scientific & Ethnobotanical Researcher',
    desc: 'Access to deep chemical-structure analysis, pharmacological literature retrieval, and scientific study archiving.',
    pillBg: 'bg-blue-50 text-blue-900 border-blue-200'
  },
  Expert: {
    id: 'Expert',
    label: 'Expert',
    badge: 'Expert',
    title: 'Bio-Patent Attorney & IPR Counsel',
    desc: 'Advanced Section 3(e) synergistic data analytics, TKDL citation cross-matching, and formal patent dossier exports.',
    pillBg: 'bg-emerald-50 text-emerald-900 border-emerald-200'
  },
  Admin: {
    id: 'Admin',
    label: 'Admin',
    badge: 'Admin',
    title: 'Statutory Admin & Regulatory Authority',
    desc: 'Full administrative rights with statutory verification audits, usage telemetry, and compliance logging.',
    pillBg: 'bg-amber-50 text-amber-900 border-amber-200'
  },
  Organization: {
    id: 'Organization',
    label: 'Organization',
    badge: 'Organization',
    title: 'Institutional Enterprise & Council',
    desc: 'Enterprise multi-user governance, institutional ABS benefit-sharing tracking, and portfolio-wide IP audits.',
    pillBg: 'bg-purple-50 text-purple-900 border-purple-200'
  }
};

export function normalizeRole(r?: string): UserRole {
  if (!r) return 'Practitioner';
  if (r === 'USER') return 'Practitioner';
  if (r === 'EXPERT') return 'Expert';
  if (r === 'ADMIN') return 'Admin';
  if (ALL_ROLES.includes(r as UserRole)) return r as UserRole;
  return 'Practitioner';
}

export interface ExpertCertificate {
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

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roles: UserRole[];
  preferred_language: Language;
  created_at: string;
  photo_url?: string;
  organization?: string;
  expertCertificate?: ExpertCertificate;
  expert_type?: 'ayurveda' | 'legal' | 'regulatory';
}

export interface DocumentMetadata {
  id: string;
  title: string;
  source: string;
  authority: string;
  url?: string;
  document_type: 'Act' | 'Rules' | 'Guidelines' | 'Treaty' | 'Notification' | 'Regulation';
  jurisdiction: string;
  publication_date: string;
  effective_date: string;
  language: string;
  topic: 'IPR' | 'AYUSH' | 'Traditional Knowledge' | 'Biological Resources & ABS' | 'Regulatory & GMP';
  summary: string;
  status: 'Indexed' | 'Processing' | 'Chunking' | 'Failed';
  chunk_count: number;
}

export interface DocumentChunk {
  chunk_id: string;
  document_id: string;
  title: string;
  source: string;
  authority: string;
  jurisdiction: string;
  document_type: string;
  section: string;
  page: number;
  paragraph?: string;
  language: string;
  publication_date: string;
  effective_date: string;
  topic: string;
  chunk_text: string;
  score?: number;
  semantic_score?: number;
  keyword_score?: number;
}

export interface Citation {
  index: number;
  chunk_id: string;
  document_id: string;
  title: string;
  authority: string;
  section: string;
  source: string;
  excerpt: string;
  page?: number;
  url?: string;
}

export type ConfidenceLevel = 'High' | 'Moderate' | 'Low' | 'Insufficient evidence';

export interface ConfidenceMetric {
  level: ConfidenceLevel;
  score: number; // 0.0 to 1.0
  reasons: string[];
}

export type Jurisdiction = 'india' | 'international';

export interface StructuredChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  answer?: string;
  relevant_considerations?: string[];
  recommended_next_steps?: string[];
  citations?: Citation[];
  confidence?: ConfidenceMetric;
  created_at: string;
  feedback?: 'helpful' | 'unhelpful' | null;
  feedback_notes?: string;
  language?: Language;
  jurisdiction?: Jurisdiction;
  // True when the backend's scope guard blocked this before retrieval/
  // generation ran (off-topic, prompt injection, or wrong jurisdiction
  // toggle) -- `answer`/`content` is then only the warning/redirect
  // message. Rendered as a plain warning bubble, not the full
  // citations/confidence "grounded opinion" card. See ChatView.tsx.
  scope_blocked?: boolean;
  expert_escalation?: {
    recommended?: boolean;
    reason?: string;
    case_summary?: string;
  };
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  language: Language;
  jurisdiction?: Jurisdiction;
  created_at: string;
  updated_at: string;
  messages: StructuredChatMessage[];
}

// Product Analyzer Types
export type ProductCategory = 
  | 'Classical Ayurvedic Medicine'
  | 'Proprietary Ayurvedic Medicine'
  | 'New Drug'
  | 'Phytopharmaceutical'
  | 'Ayurveda-Aahar'
  | 'Cosmetic'
  | 'Other / Needs Further Review';

export interface ProductInformation {
  product_name: string;
  product_type: string;
  dosage_form: string;
  ingredients: string;
  classical_reference?: string;
  manufacturing_info: string;
  intended_use: string;
  claims: string;
  target_market: 'Domestic (India)' | 'Export' | 'Both';
  biological_source_details?: string;
  target_symptoms?: string;
  distribution_channels?: string;
}

export interface ProductAnalysisResult {
  id: string;
  user_id: string;
  product_information: ProductInformation;
  likely_category: ProductCategory;
  category_reasoning: string;
  confidence: ConfidenceMetric;
  regulatory_considerations: {
    title: string;
    description: string;
    governing_statute: string;
    actionable_requirement: string;
  }[];
  ipr_considerations: {
    patent_assessment: string;
    section_3p_tk_bar: string;
    section_3e_admixture_bar: string;
    trademark_recommendation: string;
    industrial_design: string;
    trade_secret_potential: string;
  };
  traditional_knowledge_abs_flags: {
    tk_prior_art_risk: 'High' | 'Medium' | 'Low';
    tk_details: string;
    biological_resource_status: string;
    nba_abs_requirements: string;
    form_required: string;
  };
  recommended_next_steps: string[];
  evidence: Citation[];
  created_at: string;
}

// Low Confidence Flagged Query & Expert Legal Advisory Types
export interface ExpertReview {
  expert_id: string;
  expert_name: string;
  expert_title: string;
  reviewed_at: string;
  legal_opinion: string;
  statutory_clauses: string[];
  actionable_guidance: string[];
  assessment: 'Approved with Modifications' | 'Section 3(p) Barred' | 'Alternative IP Pathway' | 'Requires Empirical Data';
}

export interface LowConfidenceQuery {
  id: string;
  conversation_id?: string;
  inquirer_name: string;
  inquirer_role: UserRole;
  inquirer_organization?: string;
  topic: string;
  query: string;
  created_at: string;
  jurisdiction?: 'india' | 'international';
  ai_response: {
    content: string;
    relevant_considerations?: string[];
    recommended_next_steps?: string[];
    citations?: Citation[];
    confidence: {
      level: 'Low' | 'Insufficient evidence' | 'Moderate' | 'High';
      score: number;
      reasons: string[];
    };
  };
  status: 'pending_review' | 'in_review' | 'resolved';
  expert_review?: ExpertReview;
}



export interface Grievance {
  id: string;
  user_id: string;
  category: string;
  subject: string;
  description: string;
  conversation_id?: string;
  message_id?: string;
  related_query?: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

// IPR Navigator Types
export type ProtectableAssetType = 
  | 'New invention'
  | 'New formulation'
  | 'Manufacturing process'
  | 'Brand name'
  | 'Logo'
  | 'Packaging/design'
  | 'Traditional knowledge'
  | 'Plant variety'
  | 'Creative content'
  | 'Other';

export type IPRAssetType = ProtectableAssetType;

export interface IPRNavigatorQuery {
  asset_type?: ProtectableAssetType | string;
  asset_types?: ProtectableAssetType[];
  description: string;
  is_classical_text_derived?: boolean;
  has_synergistic_data?: boolean;
  is_biological_sourced_india?: boolean;
  is_novel_extraction_process?: boolean;
  uses_biological_resource?: boolean;
  has_traditional_basis?: boolean;
  has_synergy_data?: boolean;
  is_already_commercialized?: boolean;
}

export interface IPRNavigatorResult {
  potential_protection: string[];
  primary_protection: string;
  why_relevant: string;
  important_considerations: string[];
  relevant_authority: string;
  documents_to_prepare: string[];
  possible_next_steps: string[];
  sources: Citation[];
  disclaimer: string;
}

// Traditional Knowledge & ABS Types
export interface TKABSQuery {
  biological_resource: string;
  plant_material: string;
  geographic_origin: string;
  traditional_use: string;
  source_community_info: string;
  intended_use:
    | 'Domestic commercial utilization'
    | 'Foreign entity utilization'
    | 'Collaborative research'
    | 'IP filing'
    | 'Academic research';
}

export interface TKABSResult {
  traditional_knowledge_overview: string;
  biological_resource_assessment: string;
  abs_considerations: {
    nba_approval_needed: boolean;
    sbb_notification_needed: boolean;
    statutory_sections: string[];
    benefit_sharing_rate: string;
    exemptions_applicable?: string;
  };
  prior_art_tk_considerations: string;
  potential_ip_implications: string[];
  recommended_next_steps: string[];
  sources: Citation[];
}

// Research Search Types
export interface ResearchFilter {
  query?: string;
  authority?: string;
  topic?: string;
  jurisdiction?: string;
  document_type?: string;
  language?: string;
}

// Admin / Telemetry
export interface RAGTelemetry {
  total_queries: number;
  average_retrieval_latency_ms: number;
  average_generation_latency_ms: number;
  low_confidence_queries_count: number;
  feedback_stats: { helpful: number; unhelpful: number };
  recent_logs: {
    id: string;
    timestamp: string;
    query: string;
    latency_ms: number;
    confidence: ConfidenceLevel;
    sources_retrieved: number;
  }[];
}
