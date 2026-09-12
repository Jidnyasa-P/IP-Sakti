// Core TypeScript types for IP-SAKTI Sahayak

export type Language = 'en' | 'hi' | 'mr';

// Profile / account type. These five values are also the exact display
// labels used throughout the UI (Register, Profile, Header).
export type UserRole = 'Practitioner' | 'Researcher' | 'Expert' | 'Admin' | 'Organization';

export const USER_ROLE_OPTIONS: UserRole[] = ['Practitioner', 'Researcher', 'Expert', 'Admin', 'Organization'];

// Dual jurisdiction toggle: Domestic (India) vs International/Export.
// Mirrors the domestic/international distinction already used by the
// backend's jurisdiction_service.py and the ProductAnalyzerView's
// target_market field, so this can later be passed straight through to
// backend APIs without a data-shape mismatch.
export type JurisdictionMode = 'India' | 'International';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  preferred_language: Language;
  created_at: string;
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
}

export type ConfidenceLevel = 'High' | 'Moderate' | 'Low' | 'Insufficient evidence';

export interface ConfidenceMetric {
  level: ConfidenceLevel;
  score: number; // 0.0 to 1.0
  reasons: string[];
}

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
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  language: Language;
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
  asset_type: ProtectableAssetType;
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
  intended_use: 'Domestic commercial utilization' | 'Foreign entity utilization' | 'Collaborative research' | 'IP filing';
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
