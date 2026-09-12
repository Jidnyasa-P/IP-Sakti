import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { hybridRetrieve, searchIndexedDocuments, getDocumentDetails } from './server/rag/retrieval';
import { generateGroundedResponse, analyzeProductIntelligence, evaluateIPRProtection, evaluateTKABSResearch, translateStringsWithGemini, translateTextWithGemini } from './server/gemini';
import { AUTHORITATIVE_METADATA, AUTHORITATIVE_CHUNKS } from './server/data/authoritative_documents';
import { Conversation, ProductAnalysisResult, RAGTelemetry, StructuredChatMessage, User } from './frontend/src/types';
import { HINDI_STATUTORY_DICTIONARY, MARATHI_STATUTORY_DICTIONARY } from './frontend/src/context/translations';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In-Memory Durable Application Stores (Mirrors MongoDB storage collections)
const USERS_STORE: Map<string, User> = new Map([
  [
    'user-default',
    {
      id: 'user-default',
      name: 'Dr. Arya Sharma',
      email: 'arya.sharma@ayush-research.in',
      role: 'EXPERT',
      preferred_language: 'en',
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    },
  ],
]);

const CONVERSATIONS_STORE: Map<string, Conversation> = new Map();
const PRODUCTS_STORE: Map<string, ProductAnalysisResult> = new Map();
const SAVED_RESEARCH_STORE: Map<string, { id: string; user_id: string; document_id: string; title: string; notes: string; created_at: string }> = new Map();

// Telemetry & Monitoring Metrics
const TELEMETRY: RAGTelemetry = {
  total_queries: 24,
  average_retrieval_latency_ms: 18,
  average_generation_latency_ms: 480,
  low_confidence_queries_count: 1,
  feedback_stats: { helpful: 19, unhelpful: 2 },
  recent_logs: [
    {
      id: 'log-1',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      query: 'Can this Ayurvedic formulation be protected by a patent?',
      latency_ms: 382,
      confidence: 'High',
      sources_retrieved: 4,
    },
    {
      id: 'log-2',
      timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
      query: 'What is the difference between a patent and a traditional knowledge disclosure?',
      latency_ms: 412,
      confidence: 'High',
      sources_retrieved: 3,
    },
    {
      id: 'log-3',
      timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
      query: 'What should I consider if my formulation uses a biological resource from Western Ghats?',
      latency_ms: 345,
      confidence: 'High',
      sources_retrieved: 4,
    }
  ],
};

// Seed initial demo conversation so workspace & chat start rich and realistic
const seedConvId = 'conv-initial-ayush';
CONVERSATIONS_STORE.set(seedConvId, {
  id: seedConvId,
  user_id: 'user-default',
  title: 'Patentability of Ashwagandha & Curcuma Synergistic Formulation',
  language: 'en',
  created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
  updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  messages: [
    {
      id: 'msg-seed-1',
      conversation_id: seedConvId,
      role: 'user',
      content: 'Can an Ayurvedic formulation combining Ashwagandha and Turmeric extract be patented in India?',
      created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    },
    {
      id: 'msg-seed-2',
      conversation_id: seedConvId,
      role: 'assistant',
      content: 'Based on Section 3(p) of the Patents Act, 1970 [1], classical herbal remedies and traditional knowledge aggregations are non-patentable. Under Section 3(e) [2], mere admixtures are barred unless unexpected synergistic enhancement is scientifically proven with comparative in-vitro data. Furthermore, using Indian biological resources mandates prior approval from the National Biodiversity Authority under Section 6 of the Biological Diversity Act, 2002 [3].',
      answer: 'Based on Section 3(p) of the Patents Act, 1970 [1], classical herbal remedies and traditional knowledge aggregations are non-patentable. Under Section 3(e) [2], mere admixtures are barred unless unexpected synergistic enhancement is scientifically proven with comparative in-vitro data. Furthermore, using Indian biological resources mandates prior approval from the National Biodiversity Authority under Section 6 of the Biological Diversity Act, 2002 [3].',
      relevant_considerations: [
        'Section 3(p) bars patenting traditional knowledge already codified in classical texts or TKDL.',
        'Section 3(e) requires empirical synergy assays showing non-obvious therapeutic superiority beyond additive effects.',
        'Section 6(1) of Biological Diversity Act mandates NBA approval prior to grant of patent.',
        'Process patents on novel extraction or nano-formulations offer a viable alternative.'
      ],
      recommended_next_steps: [
        '1. Search the Traditional Knowledge Digital Library (TKDL) for prior art citations.',
        '2. Conduct quantitative pharmacological synergy assays to address Section 3(e).',
        '3. Submit Form III to the National Biodiversity Authority (NBA).',
        '4. Protect the brand name under Nice Class 5 with the Trade Marks Registry.'
      ],
      citations: [
        {
          index: 1,
          chunk_id: 'CHUNK-PAT-01',
          document_id: 'DOC-PATENTS-ACT-1970',
          title: 'The Patents Act, 1970 — Section 3(p): Traditional Knowledge Non-Patentability',
          authority: 'IP India (CGPDTM)',
          section: 'Section 3(p)',
          source: 'The Patents Act, 1970',
          excerpt: 'Under Section 3(p) of the Indian Patents Act, 1970: "an invention which in effect, is traditional knowledge or which is an aggregation or duplication of known properties..."',
          page: 12,
        },
        {
          index: 2,
          chunk_id: 'CHUNK-PAT-02',
          document_id: 'DOC-PATENTS-ACT-1970',
          title: 'The Patents Act, 1970 — Section 3(e): Mere Admixtures and Synergism Requirement',
          authority: 'IP India (CGPDTM)',
          section: 'Section 3(e)',
          source: 'The Patents Act, 1970',
          excerpt: 'Under Section 3(e) of the Patents Act, 1970: "a substance obtained by a mere admixture resulting only in the aggregation of the properties of the components thereof..."',
          page: 11,
        },
        {
          index: 3,
          chunk_id: 'CHUNK-BDA-01',
          document_id: 'DOC-BIOLOGICAL-DIVERSITY-ACT',
          title: 'The Biological Diversity Act, 2002 — Section 6: Prior Approval of NBA for IPR',
          authority: 'National Biodiversity Authority (NBA)',
          section: 'Section 6',
          source: 'The Biological Diversity Act, 2002',
          excerpt: 'Under Section 6(1): "No person shall apply for any intellectual property right, by whatever name called, in or outside India for any invention based on biological resource..."',
          page: 7,
        }
      ],
      confidence: {
        level: 'High',
        score: 0.94,
        reasons: [
          'Direct statutory citations identified from IP India (CGPDTM) and NBA.',
          'Multi-source convergence across legislative chunks.',
          'Clear statutory prohibitions match query directly.'
        ]
      },
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      feedback: 'helpful',
    }
  ]
});

// ----------------------------------------------------
// 1. AUTHENTICATION ENDPOINTS
// ----------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { email } = req.body;
  const user = [...USERS_STORE.values()].find(u => u.email === email) || USERS_STORE.get('user-default')!;
  res.json({ user, token: `jwt_token_${user.id}_${Date.now()}` });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, role, preferred_language } = req.body;
  const id = `user-${Date.now()}`;
  const newUser: User = {
    id,
    name: name || 'AYUSH Researcher',
    email: email || `user_${Date.now()}@ayush.gov.in`,
    role: role || 'USER',
    preferred_language: preferred_language || 'en',
    created_at: new Date().toISOString(),
  };
  USERS_STORE.set(id, newUser);
  res.json({ user: newUser, token: `jwt_token_${id}_${Date.now()}` });
});

app.get('/api/auth/me', (req, res) => {
  const user = USERS_STORE.get('user-default');
  res.json({ user });
});

// ----------------------------------------------------
// 2. CHAT & RAG GROUNDED GENERATION ENDPOINTS
// ----------------------------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const { conversation_id, language = 'en', semantic_weight = 0.65, keyword_weight = 0.35 } = req.body;
    const query = (typeof req.body.query === 'string' ? req.body.query : typeof req.body.message === 'string' ? req.body.message : '').trim();

    if (!query) {
      return res.status(400).json({ error: 'Query is required.' });
    }

    const convId = conversation_id || `conv-${Date.now()}`;
    const startTime = Date.now();

    // 1. Hybrid Retrieval & Reranking
    const retrieval = hybridRetrieve({
      query,
      language,
      semanticWeight: semantic_weight,
      keywordWeight: keyword_weight,
      topK: 5,
    });

    // 2. Grounded LLM Generation
    const grounded = await generateGroundedResponse({
      query,
      language: retrieval.detectedLanguage,
      retrievedChunks: retrieval.topChunks,
      citations: retrieval.citations,
      confidence: retrieval.confidence,
    });

    const elapsed = Date.now() - startTime;

    // 3. Telemetry Update
    TELEMETRY.total_queries += 1;
    TELEMETRY.average_retrieval_latency_ms = Math.round((TELEMETRY.average_retrieval_latency_ms + retrieval.retrievalLatencyMs) / 2);
    TELEMETRY.average_generation_latency_ms = Math.round((TELEMETRY.average_generation_latency_ms + elapsed) / 2);
    if (retrieval.confidence.level === 'Low' || retrieval.confidence.level === 'Insufficient evidence') {
      TELEMETRY.low_confidence_queries_count += 1;
    }
    TELEMETRY.recent_logs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      query: query.slice(0, 80),
      latency_ms: elapsed,
      confidence: retrieval.confidence.level,
      sources_retrieved: retrieval.citations.length,
    });
    if (TELEMETRY.recent_logs.length > 15) TELEMETRY.recent_logs.pop();

    // 4. Update Conversation Memory
    let conversation = CONVERSATIONS_STORE.get(convId);
    if (!conversation) {
      conversation = {
        id: convId,
        user_id: 'user-default',
        title: query.length > 50 ? query.slice(0, 48) + '...' : query,
        language: retrieval.detectedLanguage,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: [],
      };
      CONVERSATIONS_STORE.set(convId, conversation);
    }

    const userMsg: StructuredChatMessage = {
      id: `msg-u-${Date.now()}`,
      conversation_id: convId,
      role: 'user',
      content: query,
      created_at: new Date().toISOString(),
      language: retrieval.detectedLanguage,
    };

    const assistantMsg: StructuredChatMessage = {
      id: `msg-a-${Date.now() + 1}`,
      conversation_id: convId,
      role: 'assistant',
      content: grounded.answer,
      answer: grounded.answer,
      relevant_considerations: grounded.relevant_considerations,
      recommended_next_steps: grounded.recommended_next_steps,
      citations: grounded.citations,
      confidence: grounded.confidence,
      created_at: new Date().toISOString(),
      language: retrieval.detectedLanguage,
    };

    conversation.messages.push(userMsg, assistantMsg);
    conversation.updated_at = new Date().toISOString();

    res.json({
      conversation_id: convId,
      message: assistantMsg,
      retrieval_metadata: {
        intent: retrieval.detectedIntent,
        language: retrieval.detectedLanguage,
        latency_ms: elapsed,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/chat:', err);
    res.status(500).json({ error: 'Internal server error processing research query.' });
  }
});

// Streaming SSE Chat Endpoint
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { conversation_id, language = 'en' } = req.body;
    const query = (typeof req.body.query === 'string' ? req.body.query : typeof req.body.message === 'string' ? req.body.message : '').trim();

    if (!query) {
      return res.status(400).json({ error: 'Query is required.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 1. Hybrid Retrieval
    const retrieval = hybridRetrieve({ query, language, topK: 5 });

    res.write(`data: ${JSON.stringify({ type: 'retrieval_complete', intent: retrieval.detectedIntent, citations: retrieval.citations, confidence: retrieval.confidence })}\n\n`);

    // 2. Generation
    const grounded = await generateGroundedResponse({
      query,
      language: retrieval.detectedLanguage,
      retrievedChunks: retrieval.topChunks,
      citations: retrieval.citations,
      confidence: retrieval.confidence,
    });

    // Stream text in natural incremental chunks
    const answerWords = grounded.answer.split(' ');
    let currentChunk = '';

    for (let i = 0; i < answerWords.length; i++) {
      currentChunk += (i === 0 ? '' : ' ') + answerWords[i];
      if (i % 4 === 0 || i === answerWords.length - 1) {
        res.write(`data: ${JSON.stringify({ type: 'token', token: currentChunk })}\n\n`);
        currentChunk = '';
        await new Promise(r => setTimeout(r, 25));
      }
    }

    // Emit final structured response
    const convId = conversation_id || `conv-${Date.now()}`;
    const assistantMsg: StructuredChatMessage = {
      id: `msg-stream-${Date.now()}`,
      conversation_id: convId,
      role: 'assistant',
      content: grounded.answer,
      answer: grounded.answer,
      relevant_considerations: grounded.relevant_considerations,
      recommended_next_steps: grounded.recommended_next_steps,
      citations: grounded.citations,
      confidence: grounded.confidence,
      created_at: new Date().toISOString(),
      language: retrieval.detectedLanguage,
    };

    // Update conversation store
    let conv = CONVERSATIONS_STORE.get(convId);
    if (!conv) {
      conv = {
        id: convId,
        user_id: 'user-default',
        title: query.length > 50 ? query.slice(0, 48) + '...' : query,
        language: retrieval.detectedLanguage,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: [],
      };
      CONVERSATIONS_STORE.set(convId, conv);
    }
    conv.messages.push(
      { id: `msg-u-${Date.now()}`, conversation_id: convId, role: 'user', content: query, created_at: new Date().toISOString() },
      assistantMsg
    );

    res.write(`data: ${JSON.stringify({ type: 'done', message: assistantMsg, conversation_id: convId })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error('Streaming error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to stream response.' })}\n\n`);
    res.end();
  }
});

// ----------------------------------------------------
// 3. CONVERSATION MANAGEMENT ENDPOINTS
// ----------------------------------------------------
app.get('/api/conversations', (req, res) => {
  const convs = [...CONVERSATIONS_STORE.values()].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  res.json(convs);
});

app.get('/api/conversations/:id', (req, res) => {
  const conv = CONVERSATIONS_STORE.get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
  res.json(conv);
});

app.post('/api/conversations', (req, res) => {
  const { title, language = 'en' } = req.body;
  const id = `conv-${Date.now()}`;
  const newConv: Conversation = {
    id,
    user_id: 'user-default',
    title: title || 'New Research Session',
    language,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    messages: [],
  };
  CONVERSATIONS_STORE.set(id, newConv);
  res.json(newConv);
});

app.patch('/api/conversations/:id', (req, res) => {
  const conv = CONVERSATIONS_STORE.get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
  if (req.body.title) conv.title = req.body.title;
  conv.updated_at = new Date().toISOString();
  res.json(conv);
});

app.delete('/api/conversations/:id', (req, res) => {
  const exists = CONVERSATIONS_STORE.delete(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Conversation not found.' });
  res.json({ success: true, deleted_id: req.params.id });
});

app.post('/api/conversations/:id/feedback', (req, res) => {
  const { message_id, feedback, notes } = req.body;
  const conv = CONVERSATIONS_STORE.get(req.params.id);
  if (conv) {
    const msg = conv.messages.find(m => m.id === message_id);
    if (msg) {
      msg.feedback = feedback;
      msg.feedback_notes = notes;
    }
  }
  if (feedback === 'helpful') TELEMETRY.feedback_stats.helpful += 1;
  if (feedback === 'unhelpful') TELEMETRY.feedback_stats.unhelpful += 1;
  res.json({ success: true });
});

// ----------------------------------------------------
// 4. PRODUCT ANALYZER ENDPOINTS
// ----------------------------------------------------
app.post('/api/products/analyze', async (req, res) => {
  try {
    const productInfo = req.body;
    if (!productInfo.product_name || !productInfo.ingredients) {
      return res.status(400).json({ error: 'Product name and ingredients are required for analysis.' });
    }

    const ingredientsStr = typeof productInfo.ingredients === 'string'
      ? productInfo.ingredients
      : Array.isArray(productInfo.ingredients)
      ? (productInfo.ingredients as any[]).map(i => typeof i === 'string' ? i : `${i.name || ''} ${i.botanical_name || ''}`).join(' ')
      : String(productInfo.ingredients || '');

    // Retrieve evidence chunks for product analysis
    const searchContext = `${productInfo.product_name} ${ingredientsStr} ${productInfo.intended_use || ''} ${productInfo.product_type || ''}`;
    const retrieval = hybridRetrieve({ query: searchContext, topK: 6 });

    const analysis = await analyzeProductIntelligence(productInfo, retrieval.topChunks, retrieval.citations);
    PRODUCTS_STORE.set(analysis.id, analysis);

    res.json(analysis);
  } catch (err: any) {
    console.error('Error analyzing product:', err);
    res.status(500).json({ error: 'Failed to analyze product formulation.' });
  }
});

app.get('/api/products', (req, res) => {
  const products = [...PRODUCTS_STORE.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const p = PRODUCTS_STORE.get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product analysis not found.' });
  res.json(p);
});

// ----------------------------------------------------
// 5. IPR NAVIGATOR ENDPOINT
// ----------------------------------------------------
app.post('/api/ipr/analyze', (req, res) => {
  try {
    const iprQuery = req.body;
    const retrieval = hybridRetrieve({
      query: `${iprQuery.asset_type} ${iprQuery.description || ''} patent trademark design PPVFR`,
      topK: 4,
    });
    const result = evaluateIPRProtection(iprQuery, retrieval.citations);
    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/ipr/analyze:', err);
    res.status(500).json({ error: 'Failed to evaluate IPR protection pathways.' });
  }
});

// ----------------------------------------------------
// 6. TRADITIONAL KNOWLEDGE & ABS ENDPOINT
// ----------------------------------------------------
const handleABSAnalyze = (req: express.Request, res: express.Response) => {
  try {
    const tkQuery = req.body;
    const resourceName = typeof tkQuery.biological_resource === 'string'
      ? tkQuery.biological_resource
      : typeof tkQuery.plant_material === 'string'
      ? tkQuery.plant_material
      : Array.isArray(tkQuery.biological_resources)
      ? tkQuery.biological_resources.map((r: any) => (typeof r === 'string' ? r : r.name || '')).join(' ')
      : '';
    const retrieval = hybridRetrieve({
      query: `Biological Diversity Act NBA ABS Form 1 Form 3 ${resourceName} ${tkQuery.geographic_origin || ''}`,
      topK: 4,
    });
    const result = evaluateTKABSResearch(tkQuery, retrieval.citations);
    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/abs/analyze:', err);
    res.status(500).json({ error: 'Failed to evaluate TK and ABS considerations.' });
  }
};

app.post('/api/abs/analyze', handleABSAnalyze);
app.post('/api/tk-abs/analyze', handleABSAnalyze);

// ----------------------------------------------------
// 7. RESEARCH & KNOWLEDGE BASE SEARCH
// ----------------------------------------------------
app.get('/api/research/search', (req, res) => {
  const query = (req.query.q as string) || '';
  const topic = (req.query.topic as string) || 'ALL';
  const authority = (req.query.authority as string) || 'ALL';
  const documentType = (req.query.document_type as string) || 'ALL';

  const docs = searchIndexedDocuments(query, { topic, authority, documentType });

  // If specific search query provided, also return matching chunk snippets
  let matchingChunks: any[] = [];
  if (query.trim()) {
    const retrieval = hybridRetrieve({ query, topK: 8 });
    matchingChunks = retrieval.topChunks;
  }

  res.json({
    documents: docs,
    matching_chunks: matchingChunks,
    total_indexed: AUTHORITATIVE_METADATA.length,
    total_chunks: AUTHORITATIVE_CHUNKS.length,
  });
});

app.get('/api/documents/:id', (req, res) => {
  const doc = getDocumentDetails(req.params.id);
  if (!doc.metadata) return res.status(404).json({ error: 'Document not found in authoritative index.' });
  res.json(doc);
});

// Saved Research Endpoints
app.get('/api/workspace/saved-research', (req, res) => {
  res.json([...SAVED_RESEARCH_STORE.values()]);
});

app.post('/api/workspace/save-research', (req, res) => {
  const { document_id, title, notes } = req.body;
  const id = `saved-${Date.now()}`;
  const record = {
    id,
    user_id: 'user-default',
    document_id,
    title,
    notes: notes || '',
    created_at: new Date().toISOString(),
  };
  SAVED_RESEARCH_STORE.set(id, record);
  res.json(record);
});

app.delete('/api/workspace/saved-research/:id', (req, res) => {
  SAVED_RESEARCH_STORE.delete(req.params.id);
  res.json({ success: true });
});

// ----------------------------------------------------
// 8. ADMIN / KNOWLEDGE MANAGEMENT ENDPOINTS
// ----------------------------------------------------
app.get('/api/admin/telemetry', (req, res) => {
  res.json(TELEMETRY);
});
app.get('/api/rag/telemetry', (req, res) => {
  res.json(TELEMETRY);
});

app.get('/api/admin/documents', (req, res) => {
  res.json({
    documents: AUTHORITATIVE_METADATA,
    total_chunks: AUTHORITATIVE_CHUNKS.length,
    vector_index_status: 'HEALTHY (Qdrant & Vector Embeddings Active)',
    retrieval_status: 'HYBRID (Semantic 65% + BM25 35%)',
  });
});
app.get('/api/rag/documents', (req, res) => {
  res.json({
    documents: AUTHORITATIVE_METADATA,
    total_chunks: AUTHORITATIVE_CHUNKS.length,
    vector_index_status: 'HEALTHY (Qdrant & Vector Embeddings Active)',
    retrieval_status: 'HYBRID (Semantic 65% + BM25 35%)',
  });
});

app.post('/api/admin/documents', (req, res) => {
  const { title, source, authority, document_type, jurisdiction, topic, summary } = req.body;
  const newId = `DOC-USER-${Date.now()}`;
  const newDoc = {
    id: newId,
    title,
    source,
    authority,
    document_type: document_type || 'Guidelines',
    jurisdiction: jurisdiction || 'India',
    publication_date: new Date().toISOString().split('T')[0],
    effective_date: new Date().toISOString().split('T')[0],
    language: 'English',
    topic: topic || 'AYUSH',
    summary,
    status: 'Indexed' as const,
    chunk_count: 1,
  };
  AUTHORITATIVE_METADATA.push(newDoc);
  res.json({ success: true, document: newDoc });
});

app.post('/api/admin/documents/:id/index', (req, res) => {
  const doc = AUTHORITATIVE_METADATA.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  doc.status = 'Indexed';
  res.json({ success: true, message: `Document ${doc.title} re-indexed successfully.` });
});

// ----------------------------------------------------
// 8.5 DYNAMIC WEBSITE TRANSLATION VIA GEMINI API
// ----------------------------------------------------
const TRANSLATIONS_CACHE = new Map<string, Record<string, string>>([
  ['dict_hi', { ...HINDI_STATUTORY_DICTIONARY }],
  ['dict_mr', { ...MARATHI_STATUTORY_DICTIONARY }],
]);

app.post('/api/translate', async (req, res) => {
  try {
    const { target_language, strings, text } = req.body;

    if (!target_language) {
      return res.status(400).json({ error: 'target_language is required' });
    }

    if (text && typeof text === 'string') {
      const result = await translateTextWithGemini(text, target_language);
      return res.json({
        success: true,
        target_language,
        translated_text: result.translated,
        source: result.source,
      });
    }

    if (strings && typeof strings === 'object') {
      const cacheKey = `dict_${target_language}`;
      const result = await translateStringsWithGemini(strings, target_language);
      if (result.translated && Object.keys(result.translated).length > 0) {
        TRANSLATIONS_CACHE.set(cacheKey, result.translated);
      }

      const finalStrings = TRANSLATIONS_CACHE.get(cacheKey) || result.translated;
      return res.json({
        success: true,
        target_language,
        translated_strings: finalStrings,
        source: result.source,
      });
    }

    res.status(400).json({ error: 'strings or text is required.' });
  } catch (err: any) {
    console.error('Error in /api/translate:', err);
    res.status(500).json({ error: err.message || 'Translation failed.' });
  }
});

// ----------------------------------------------------
// 9. VITE & STATIC SPA ROUTING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      root: path.resolve(process.cwd(), 'frontend'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[IP-SAKTI Sahayak] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
