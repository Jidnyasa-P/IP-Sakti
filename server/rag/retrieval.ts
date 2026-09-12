import { AUTHORITATIVE_CHUNKS, AUTHORITATIVE_METADATA } from '../data/authoritative_documents';
import { Citation, ConfidenceLevel, ConfidenceMetric, DocumentChunk, Language } from '../../src/types';

export interface RAGSearchOptions {
  query: string;
  language?: Language;
  semanticWeight?: number; // default 0.65
  keywordWeight?: number;  // default 0.35
  topK?: number;           // default 6
  topicFilter?: string;
  authorityFilter?: string;
}

export interface RetrievalResult {
  topChunks: DocumentChunk[];
  citations: Citation[];
  confidence: ConfidenceMetric;
  detectedIntent: string;
  detectedLanguage: Language;
  retrievalLatencyMs: number;
}

// Multilingual Stopwords & Tokenizer
const STOPWORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with',
  'as', 'by', 'from', 'this', 'that', 'or', 'be', 'are', 'was', 'were', 'it', 'can',
  'का', 'की', 'के', 'में', 'और', 'से', 'पर', 'को', 'है', 'हैं', 'या', 'एक', 'ने', 'हो',
  'आणि', 'च्या', 'चे', 'ची', 'मध्ये', 'व', 'आहे', 'नाही', 'यांचे', 'त्यांचे', 'करणे'
]);

// Multilingual Intent Detection
export function detectIntent(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('patent') || q.includes('पेटेंट') || q.includes('3(p)') || q.includes('3(e)') || q.includes('admixture') || q.includes('synerg')) {
    return 'IPR_PATENTABILITY';
  }
  if (q.includes('trademark') || q.includes('brand') || q.includes('ट्रेडमार्क') || q.includes('class 5') || q.includes('class 3') || q.includes('logo') || q.includes('design')) {
    return 'IPR_BRAND_DESIGN';
  }
  if (q.includes('abs') || q.includes('biological') || q.includes('biodiversity') || q.includes('nba') || q.includes('sbb') || q.includes('जैव विविधता') || q.includes('जैविक संसाधन')) {
    return 'ABS_BIODIVERSITY';
  }
  if (q.includes('traditional knowledge') || q.includes('tkdl') || q.includes('पारंपरिक ज्ञान') || q.includes('पारंपारिक') || q.includes('prior art') || q.includes('charaka')) {
    return 'TRADITIONAL_KNOWLEDGE';
  }
  if (q.includes('classical') || q.includes('proprietary') || q.includes('ayush') || q.includes('schedule t') || q.includes('gmp') || q.includes('rule 158') || q.includes('aahar') || q.includes('आयुष')) {
    return 'AYUSH_REGULATORY';
  }
  return 'GENERAL_AYUSH_IP_RESEARCH';
}

export function detectLanguage(query: string, preferred?: Language): Language {
  if (preferred && preferred !== 'en') return preferred;
  // Check Devanagari script presence
  const devanagariRegex = /[\u0900-\u097F]/;
  if (devanagariRegex.test(query)) {
    // Distinguish Marathi vs Hindi via specific Marathi morphemes
    const marathiWords = ['आहे', 'नाही', 'कसे', 'पेटंट', 'झाले', 'करणे', 'औषध', 'माहिती', 'पारंपारिक'];
    const hasMarathi = marathiWords.some(w => query.includes(w));
    return hasMarathi ? 'mr' : 'hi';
  }
  return preferred || 'en';
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

// Inverted Index for BM25 Lexical Retrieval
class BM25Index {
  private chunks: DocumentChunk[];
  private docLengths: number[] = [];
  private avgDocLength: number = 0;
  private termDocFreq: Map<string, number> = new Map();
  private docTermFreqs: Map<string, number>[] = [];

  constructor(chunks: DocumentChunk[]) {
    this.chunks = chunks;
    this.build();
  }

  private build() {
    let totalLength = 0;
    this.chunks.forEach((chunk, i) => {
      const fullText = `${chunk.title} ${chunk.section} ${chunk.chunk_text} ${chunk.topic} ${chunk.authority}`;
      const tokens = tokenize(fullText);
      const len = tokens.length;
      this.docLengths.push(len);
      totalLength += len;

      const tf = new Map<string, number>();
      const seen = new Set<string>();
      for (const t of tokens) {
        tf.set(t, (tf.get(t) || 0) + 1);
        if (!seen.has(t)) {
          this.termDocFreq.set(t, (this.termDocFreq.get(t) || 0) + 1);
          seen.add(t);
        }
      }
      this.docTermFreqs.push(tf);
    });
    this.avgDocLength = totalLength / Math.max(1, this.chunks.length);
  }

  public score(query: string, k1 = 1.5, b = 0.75): number[] {
    const queryTokens = tokenize(query);
    const N = this.chunks.length;
    const scores = new Array(N).fill(0);

    for (const qToken of queryTokens) {
      const df = this.termDocFreq.get(qToken) || 0;
      if (df === 0) continue;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));

      for (let i = 0; i < N; i++) {
        const tf = this.docTermFreqs[i].get(qToken) || 0;
        if (tf === 0) continue;
        const docLen = this.docLengths[i];
        const denom = tf + k1 * (1 - b + b * (docLen / this.avgDocLength));
        scores[i] += idf * ((tf * (k1 + 1)) / denom);
      }
    }
    return scores;
  }
}

// Semantic Vector Matcher (High-Dimensional Term Space with N-gram Overlap & Authority Density)
class SemanticVectorMatcher {
  private chunks: DocumentChunk[];
  private chunkVectors: Map<string, number>[] = [];
  private vocab: Map<string, number> = new Map();

  constructor(chunks: DocumentChunk[]) {
    this.chunks = chunks;
    this.build();
  }

  private build() {
    this.chunks.forEach(chunk => {
      const text = `${chunk.title} ${chunk.authority} ${chunk.section} ${chunk.chunk_text} ${chunk.topic}`;
      const tokens = tokenize(text);
      const vec = new Map<string, number>();
      for (const t of tokens) {
        vec.set(t, (vec.get(t) || 0) + 1);
      }
      // Add character n-grams (tri-grams) for subword & cross-lingual resilience
      for (let i = 0; i < text.length - 3; i += 2) {
        const trigram = text.substring(i, i + 3).toLowerCase();
        vec.set(trigram, (vec.get(trigram) || 0) + 0.5);
      }
      this.chunkVectors.push(vec);
    });
  }

  public score(query: string): number[] {
    const queryTokens = tokenize(query);
    const queryVec = new Map<string, number>();
    for (const t of queryTokens) {
      queryVec.set(t, (queryVec.get(t) || 0) + 1);
    }
    for (let i = 0; i < query.length - 3; i += 2) {
      const trigram = query.substring(i, i + 3).toLowerCase();
      queryVec.set(trigram, (queryVec.get(trigram) || 0) + 0.5);
    }

    const scores = new Array(this.chunks.length).fill(0);
    const qNorm = Math.sqrt([...queryVec.values()].reduce((sum, v) => sum + v * v, 0));
    if (qNorm === 0) return scores;

    this.chunkVectors.forEach((cVec, idx) => {
      let dot = 0;
      let cNormSq = 0;
      for (const [k, v] of cVec.entries()) {
        cNormSq += v * v;
        if (queryVec.has(k)) {
          dot += v * (queryVec.get(k) || 0);
        }
      }
      const cNorm = Math.sqrt(cNormSq);
      scores[idx] = cNorm > 0 ? dot / (qNorm * cNorm) : 0;
    });

    return scores;
  }
}

// Global Singletons
const bm25 = new BM25Index(AUTHORITATIVE_CHUNKS);
const semanticMatcher = new SemanticVectorMatcher(AUTHORITATIVE_CHUNKS);

// Hybrid Retrieval with Reranking
export function hybridRetrieve(options: RAGSearchOptions): RetrievalResult {
  const startTime = Date.now();
  const semanticWeight = options.semanticWeight ?? 0.65;
  const keywordWeight = options.keywordWeight ?? 0.35;
  const topK = options.topK ?? 5;
  const intent = detectIntent(options.query);
  const language = detectLanguage(options.query, options.language);

  // 1. BM25 scores
  const bm25Scores = bm25.score(options.query);
  // Normalize BM25
  const maxBM25 = Math.max(...bm25Scores, 1);
  const normBM25 = bm25Scores.map(s => s / maxBM25);

  // 2. Semantic vector scores
  const semScores = semanticMatcher.score(options.query);
  const maxSem = Math.max(...semScores, 1);
  const normSem = semScores.map(s => (maxSem > 0 ? s / maxSem : 0));

  // 3. Fusion & Intent Affinity
  const candidateScores = AUTHORITATIVE_CHUNKS.map((chunk, idx) => {
    let baseScore = (normSem[idx] * semanticWeight) + (normBM25[idx] * keywordWeight);

    // Topic alignment boost
    if (options.topicFilter && chunk.topic.toLowerCase().includes(options.topicFilter.toLowerCase())) {
      baseScore += 0.20;
    }
    if (options.authorityFilter && chunk.authority.toLowerCase().includes(options.authorityFilter.toLowerCase())) {
      baseScore += 0.20;
    }

    // Intent-specific boosting
    if (intent === 'IPR_PATENTABILITY' && (chunk.section.includes('3(p)') || chunk.section.includes('3(e)') || chunk.title.includes('Patent'))) {
      baseScore += 0.25;
    } else if (intent === 'IPR_BRAND_DESIGN' && (chunk.title.includes('Trade Marks') || chunk.title.includes('Designs'))) {
      baseScore += 0.25;
    } else if (intent === 'ABS_BIODIVERSITY' && (chunk.title.includes('Biological Diversity') || chunk.authority.includes('NBA'))) {
      baseScore += 0.25;
    } else if (intent === 'TRADITIONAL_KNOWLEDGE' && (chunk.title.includes('Traditional Knowledge') || chunk.title.includes('TKDL'))) {
      baseScore += 0.25;
    } else if (intent === 'AYUSH_REGULATORY' && (chunk.title.includes('Drugs and Cosmetics') || chunk.title.includes('Ayurveda Aahar'))) {
      baseScore += 0.25;
    }

    return {
      chunk: { ...chunk, score: baseScore, semantic_score: normSem[idx], keyword_score: normBM25[idx] },
      score: baseScore,
    };
  });

  // 4. Reranker: Sort and filter down
  candidateScores.sort((a, b) => b.score - a.score);

  // Take top candidates
  const topCandidates = candidateScores.slice(0, Math.min(topK * 2, candidateScores.length));

  // Secondary reranker pass: exact section number matches, legal keyword density
  const queryWords = tokenize(options.query);
  const reranked = topCandidates.map(item => {
    let rerankScore = item.score;
    // Check if query mentions specific section or statute like "3(p)", "rule 158", "nba", "gmp"
    for (const word of queryWords) {
      if (item.chunk.section.toLowerCase().includes(word)) rerankScore += 0.15;
      if (item.chunk.title.toLowerCase().includes(word)) rerankScore += 0.10;
    }
    return { ...item, score: rerankScore };
  });

  reranked.sort((a, b) => b.score - a.score);
  const topChunks = reranked.slice(0, topK).map(item => item.chunk);

  // 5. Build Citations
  const citations: Citation[] = topChunks.map((chunk, index) => ({
    index: index + 1,
    chunk_id: chunk.chunk_id,
    document_id: chunk.document_id,
    title: chunk.title,
    authority: chunk.authority,
    section: chunk.section,
    source: chunk.source,
    excerpt: chunk.chunk_text.slice(0, 240) + '...',
    page: chunk.page,
  }));

  // 6. Calculate Confidence Metric
  const topScore = topChunks.length > 0 ? (topChunks[0].score || 0) : 0;
  let level: ConfidenceLevel = 'Insufficient evidence';
  const reasons: string[] = [];

  if (topScore > 0.45 && topChunks.length >= 3) {
    level = 'High';
    reasons.push(`Direct statutory citations identified from ${topChunks[0].authority}.`);
    reasons.push(`Multi-source convergence across ${topChunks.length} relevant legislative chunks.`);
    reasons.push('Clear authoritative provisions match query terms.');
  } else if (topScore > 0.28 && topChunks.length >= 2) {
    level = 'Moderate';
    reasons.push('Relevant regulatory principles retrieved, partial textual alignment.');
    reasons.push('Sufficient basis for analytical decision-support.');
  } else if (topScore > 0.15) {
    level = 'Low';
    reasons.push('Limited direct textual overlap with indexed statutory provisions.');
    reasons.push('Recommendation to consult official gazettes or specialized counsel.');
  } else {
    level = 'Insufficient evidence';
    reasons.push('No direct legislative provisions or official guidelines matched in the indexed knowledge base.');
  }

  const latency = Date.now() - startTime;

  return {
    topChunks,
    citations,
    confidence: {
      level,
      score: Math.min(1.0, Math.max(0.1, topScore)),
      reasons,
    },
    detectedIntent: intent,
    detectedLanguage: language,
    retrievalLatencyMs: latency,
  };
}

export function searchIndexedDocuments(query: string, filter?: { topic?: string; authority?: string; documentType?: string }) {
  let docs = [...AUTHORITATIVE_METADATA];
  if (filter?.topic && filter.topic !== 'ALL') {
    docs = docs.filter(d => d.topic.toLowerCase() === filter.topic?.toLowerCase());
  }
  if (filter?.authority && filter.authority !== 'ALL') {
    docs = docs.filter(d => d.authority.toLowerCase().includes(filter.authority?.toLowerCase() || ''));
  }
  if (filter?.documentType && filter.documentType !== 'ALL') {
    docs = docs.filter(d => d.document_type.toLowerCase() === filter.documentType?.toLowerCase());
  }

  if (query.trim()) {
    const q = query.toLowerCase();
    docs = docs.filter(d => 
      d.title.toLowerCase().includes(q) ||
      d.summary.toLowerCase().includes(q) ||
      d.authority.toLowerCase().includes(q) ||
      d.topic.toLowerCase().includes(q)
    );
  }

  return docs;
}

export function getDocumentDetails(documentId: string) {
  const meta = AUTHORITATIVE_METADATA.find(d => d.id === documentId);
  const chunks = AUTHORITATIVE_CHUNKS.filter(c => c.document_id === documentId);
  return { metadata: meta, chunks };
}
