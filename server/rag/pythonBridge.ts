/**
 * Bridge to the Python RAG microservice (ip_sakti_rag). Falls back to the
 * existing local engine (searchStatutoryKnowledge + generateRAGAnswer) if
 * RAG_SERVICE_URL isn't set, the call times out, or it errors — the same
 * "resilience engine" philosophy the rest of this backend already follows,
 * so the platform never goes fully silent just because the Python service
 * (on its own free Render instance) is cold-starting or briefly down.
 *
 * Drop-in usage in routes.ts — replaces the previous two-step
 *   const retrieval = searchStatutoryKnowledge(userQuery, 3);
 *   const ragAnswer = await generateRAGAnswer(userQuery, retrieval.chunks, language);
 * with:
 *   const grounded = await getGroundedAnswer(userQuery, language, conversation_id);
 * See DEPLOYMENT_GUIDE.md for the exact routes.ts diff.
 */
import { searchStatutoryKnowledge } from './retrieval.js';
import { generateRAGAnswer } from '../gemini.js';

export interface GroundedCitation {
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

export interface GroundedAnswer {
  content: string;
  relevant_considerations: string[];
  recommended_next_steps: string[];
  citations: GroundedCitation[];
  confidenceLevel: 'High' | 'Moderate' | 'Low' | 'Insufficient evidence';
  confidenceScore: number;
  reasons: string[];
}

const RAG_URL = process.env.RAG_SERVICE_URL; // e.g. https://ip-sakti-rag.onrender.com
const RAG_SECRET = process.env.RAG_SERVICE_SHARED_SECRET ?? '';
const RAG_TIMEOUT_MS = Number(process.env.RAG_SERVICE_TIMEOUT_MS ?? 20000);

export async function getGroundedAnswer(
  query: string,
  language: string,
  conversationId?: string,
): Promise<GroundedAnswer> {
  if (RAG_URL) {
    try {
      return await callPythonService(query, language, conversationId);
    } catch (err) {
      console.error('[pythonBridge] RAG service call failed, falling back to local engine:', err);
    }
  }
  return callLocalEngine(query, language);
}

async function callPythonService(
  query: string,
  language: string,
  conversationId?: string,
): Promise<GroundedAnswer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);
  try {
    const res = await fetch(`${RAG_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': RAG_SECRET,
      },
      body: JSON.stringify({ query, language, conversation_id: conversationId }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`RAG service responded ${res.status}`);
    }
    const data: any = await res.json();

    // Python's RAGResponse uses `answer`, not `content`; everything else
    // (citations, confidence.level/score, needs_clarification/needs_expert
    // if you want to surface those later) already matches what the
    // frontend's Citation/ConfidenceMetric types expect.
    return {
      content: data.answer ?? '',
      relevant_considerations: data.relevant_considerations ?? [],
      recommended_next_steps: data.recommended_next_steps ?? [],
      citations: data.citations ?? [],
      confidenceLevel: data.confidence?.level ?? 'Low',
      confidenceScore: data.confidence?.score ?? 0,
      reasons: data.confidence?.reasons ?? [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callLocalEngine(query: string, language: string): Promise<GroundedAnswer> {
  const retrieval = searchStatutoryKnowledge(query, 3);
  const ragAnswer = await generateRAGAnswer(query, retrieval.chunks, language);
  return {
    content: ragAnswer.content,
    relevant_considerations: ragAnswer.relevant_considerations,
    recommended_next_steps: ragAnswer.recommended_next_steps,
    citations: retrieval.citations,
    confidenceLevel: retrieval.confidenceLevel,
    confidenceScore: retrieval.confidenceScore,
    reasons: retrieval.reasons,
  };
}
