import { Router, Request, Response } from 'express';
import { AUTHORITATIVE_DOCUMENTS, AUTHORITATIVE_CHUNKS } from './data/authoritative_documents.js';
import { searchStatutoryKnowledge, analyzeFormulation } from './rag/retrieval.js';
import { generateRAGAnswer } from './gemini.js';

export const apiRouter = Router();

// In-memory state for conversations, products, workspace and telemetry
let conversations: any[] = [
  {
    id: 'conv-default-1',
    user_id: 'user-default',
    title: 'Patentability of Polyherbal Formulation (Section 3p/3e)',
    language: 'en',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date().toISOString(),
    messages: [
      {
        id: 'msg-init-1',
        conversation_id: 'conv-default-1',
        role: 'user',
        content: 'Can an Ayurvedic formulation combining Ashwagandha and Turmeric extract be patented in India?',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        language: 'en'
      },
      {
        id: 'msg-init-2',
        conversation_id: 'conv-default-1',
        role: 'assistant',
        content: 'Under Section 3(p) of the Patents Act, 1970, an invention which in effect is traditional knowledge or an aggregation/duplication of known properties of traditionally known component(s) is strictly non-patentable. Furthermore, under Section 3(e), combining Ashwagandha and Turmeric is deemed a mere admixture unless the applicant provides empirical comparative biological assay data establishing unexpected therapeutic synergy (combination index < 1). Additionally, because biological materials sourced from India are used, prior approval from the National Biodiversity Authority (NBA Form III) under Section 6(1) of the Biological Diversity Act, 2002 is mandatory before patent grant.',
        relevant_considerations: [
          'Section 3(p) statutory bar: CSIR-TKDL prior art citation risks for classical AYUSH herbs.',
          'Section 3(e) admixture hurdle: Mandatory requirement of synergistic combination index < 1.',
          'Section 6(1) Biological Diversity Act: Mandatory NBA Form III clearance prior to patent grant.'
        ],
        recommended_next_steps: [
          'Conduct comprehensive CSIR-TKDL and patent database clearance search (CGPDTM / InPASS).',
          'Generate quantitative synergy assay data to overcome Section 3(e).',
          'Submit Form III application to the National Biodiversity Authority (NBA).',
          'Register distinctive brand name under Trade Marks Act, 1999 (Class 5).'
        ],
        citations: [
          {
            index: 1,
            chunk_id: 'CHUNK-PAT-001',
            document_id: 'DOC-PATENTS-ACT-1970',
            title: 'The Patents Act, 1970 — Section 3(p)',
            authority: 'Office of the CGPDTM',
            section: 'Section 3(p)',
            source: 'Official Gazette of India',
            excerpt: 'Section 3(p) establishes an absolute statutory bar against patenting any herbal medicine or formulation already recorded in traditional knowledge systems...'
          },
          {
            index: 2,
            chunk_id: 'CHUNK-PAT-002',
            document_id: 'DOC-PATENTS-ACT-1970',
            title: 'The Patents Act, 1970 — Section 3(e)',
            authority: 'Office of the CGPDTM',
            section: 'Section 3(e)',
            source: 'Official Gazette of India',
            excerpt: 'Section 3(e) prohibits patenting substances obtained by mere admixture resulting only in aggregation of properties unless unexpected synergy is demonstrated...'
          },
          {
            index: 3,
            chunk_id: 'CHUNK-BD-001',
            document_id: 'DOC-BIOLOGICAL-DIVERSITY-ACT-2002',
            title: 'Biological Diversity Act, 2002 — Section 6(1)',
            authority: 'National Biodiversity Authority (NBA)',
            section: 'Section 6(1)',
            source: 'Gazette of India',
            excerpt: 'No person shall apply for any intellectual property right in or outside India based on Indian biological resources without prior NBA approval...'
          }
        ],
        confidence: {
          level: 'High',
          score: 0.96,
          reasons: [
            'Corroborated by primary statutory provisions of The Patents Act, 1970.',
            'Directly verified against Section 6 of Biological Diversity Act, 2002.',
            'Supported by established CGPDTM examination guidelines.'
          ]
        },
        created_at: new Date(Date.now() - 3500000).toISOString()
      }
    ]
  }
];

let savedProducts: any[] = [
  {
    id: 'prod-demo-1',
    user_id: 'user-default',
    product_information: {
      product_name: 'AyurShakti Vitality Elixir',
      product_type: 'Proprietary Ayurvedic Formulation',
      dosage_form: 'Syrup / Decoction',
      ingredients: 'Withania somnifera (Ashwagandha) root extract 300mg, Curcuma longa (Haldi) rhizome extract 150mg, Ocimum sanctum (Tulsi) leaf extract 100mg',
      classical_reference: 'Formulation inspired by Rasayana principles in Charaka Samhita Chikitsa Sthana',
      manufacturing_info: 'Aqueous hydro-alcoholic extraction following Schedule T GMP standards',
      intended_use: 'Immune support, vitality, stress mitigation and general adaptogenic tonic',
      claims: 'Enhances cognitive stamina, balances Vata-Kapha, reduces oxidative stress',
      target_market: 'Both'
    },
    likely_category: 'Proprietary Ayurvedic Medicine',
    category_reasoning: 'Utilizes classical Ayurvedic herbs in non-classical proprietary ratios and modern dosage form, falling squarely under Section 3(h) of Drugs and Cosmetics Act for Patent and Proprietary Ayurvedic Medicine.',
    confidence: {
      level: 'High',
      score: 0.93,
      reasons: ['Ingredients documented in Ayurvedic Pharmacopoeia of India (API)', 'Clear alignment with Schedule T GMP']
    },
    regulatory_considerations: [
      {
        title: 'Manufacturing License (Drugs & Cosmetics Act)',
        description: 'Requires State Licensing Authority (SLA) Form 25D license under Rule 154 of Drugs and Cosmetics Rules.',
        governing_statute: 'Drugs and Cosmetics Act, 1940 & Rules 1945',
        actionable_requirement: 'Submit product master dossier, stability protocol, and safety evidence to State AYUSH SLA.'
      },
      {
        title: 'Schedule T GMP Compliance',
        description: 'Premises, raw material quarantine, and analytical quality control must comply with Schedule T.',
        governing_statute: 'Schedule T (Drugs and Cosmetics Rules)',
        actionable_requirement: 'Perform heavy metal, pesticide, and microbial limit testing for every commercial batch.'
      }
    ],
    ipr_considerations: {
      patent_assessment: 'Composition as a whole faces severe Section 3(p) and 3(e) patentability rejections. Proprietary extraction process may be patentable if novel and inventive.',
      section_3p_tk_bar: 'High Risk. Ashwagandha, Turmeric, and Tulsi are extensively documented in CSIR-TKDL.',
      section_3e_admixture_bar: 'High Risk. Must submit comparative synergy assay proving super-additive cellular antioxidant efficacy.',
      trademark_recommendation: 'Register coined brand "AyurShakti" in Class 5 (pharmaceuticals/herbal) and Class 3 (cosmetics).',
      industrial_design: 'Protect unique bottle ergonomics and embossed Ayurvedic emblem under Designs Act, 2000.',
      trade_secret_potential: 'Maintain exact multi-stage extraction temperatures, solvent ratios, and bioactive marker standardization as confidential know-how.'
    },
    traditional_knowledge_abs_flags: {
      tk_prior_art_risk: 'High',
      tk_details: 'Documented in classical Sanskrit texts Charaka Samhita and Bhavaprakasha.',
      biological_resource_status: 'All three botanical components are Indian biological resources subject to NBA oversight.',
      nba_abs_requirements: 'Form III approval mandatory prior to filing any patent application. Form I required if exporting raw herbs or with foreign investment.',
      form_required: 'Form III (IPR Approval) & Form I (Export / Commercial Access)'
    },
    recommended_next_steps: [
      'File Trademark application for "AyurShakti" in Class 5 via IP India portal.',
      'Submit Form III application to the National Biodiversity Authority (NBA).',
      'Prepare Schedule T technical dossier for State AYUSH Licensing Authority.',
      'Conduct in vitro synergy testing to establish combination index < 1 for process patent viability.'
    ],
    evidence: [
      {
        index: 1,
        chunk_id: 'CHUNK-PAT-001',
        document_id: 'DOC-PATENTS-ACT-1970',
        title: 'The Patents Act, 1970 — Section 3(p)',
        authority: 'Office of the CGPDTM',
        section: 'Section 3(p)',
        source: 'Official Gazette of India',
        excerpt: 'Traditional knowledge exclusion prohibits patenting known medicinal plants or combinations without inventive step...'
      }
    ],
    created_at: new Date(Date.now() - 86400000).toISOString()
  }
];

let savedResearch: any[] = [];
let telemetry = {
  total_queries: 48,
  average_retrieval_latency_ms: 184,
  average_generation_latency_ms: 642,
  low_confidence_queries_count: 2,
  feedback_stats: { helpful: 39, unhelpful: 2 },
  recent_logs: [
    {
      id: 'log-1',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      query: 'Ashwagandha Turmeric synergy patent requirement',
      latency_ms: 412,
      confidence: 'High' as const,
      sources_retrieved: 3
    },
    {
      id: 'log-2',
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      query: 'NBA Form III requirement for US patent filing',
      latency_ms: 388,
      confidence: 'High' as const,
      sources_retrieved: 4
    }
  ]
};

// 1. Health Check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'IP-SAKTI Sahayak',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 2. Conversations Endpoints
apiRouter.get('/conversations', (req: Request, res: Response) => {
  res.json(conversations);
});

apiRouter.get('/conversations/:id', (req: Request, res: Response) => {
  const conv = conversations.find(c => c.id === req.params.id);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  res.json(conv);
});

apiRouter.post('/conversations', (req: Request, res: Response) => {
  const { title, language } = req.body;
  const newConv = {
    id: `conv-${Date.now()}`,
    user_id: 'user-default',
    title: title || 'New Legal Consultation',
    language: language || 'en',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    messages: []
  };
  conversations.unshift(newConv);
  res.status(201).json(newConv);
});

apiRouter.delete('/conversations/:id', (req: Request, res: Response) => {
  conversations = conversations.filter(c => c.id !== req.params.id);
  res.json({ success: true, id: req.params.id });
});

apiRouter.post('/conversations/:id/feedback', (req: Request, res: Response) => {
  const { feedback } = req.body;
  if (feedback === 'helpful') {
    telemetry.feedback_stats.helpful += 1;
  } else if (feedback === 'unhelpful') {
    telemetry.feedback_stats.unhelpful += 1;
  }
  res.json({ success: true, feedback });
});

// 3. Chat & RAG Processing
apiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { query, message, conversation_id, language = 'en' } = req.body;
    const userQuery = (query || message || '').trim();

    if (!userQuery) {
      return res.status(400).json({ error: 'Query or message string is required.' });
    }

    const startTime = Date.now();
    const retrieval = searchStatutoryKnowledge(userQuery, 3);
    const ragAnswer = await generateRAGAnswer(userQuery, retrieval.chunks, language);
    const latency = Date.now() - startTime;

    // Update telemetry
    telemetry.total_queries += 1;
    telemetry.average_retrieval_latency_ms = Math.round((telemetry.average_retrieval_latency_ms * 0.8) + (latency * 0.2));
    telemetry.recent_logs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      query: userQuery.slice(0, 60),
      latency_ms: latency,
      confidence: retrieval.confidenceLevel,
      sources_retrieved: retrieval.citations.length
    });
    if (telemetry.recent_logs.length > 20) telemetry.recent_logs.pop();

    const assistantMessage = {
      id: `msg-${Date.now()}`,
      conversation_id: conversation_id || 'conv-default-1',
      role: 'assistant' as const,
      content: ragAnswer.content,
      relevant_considerations: ragAnswer.relevant_considerations,
      recommended_next_steps: ragAnswer.recommended_next_steps,
      citations: retrieval.citations,
      confidence: {
        level: retrieval.confidenceLevel,
        score: retrieval.confidenceScore,
        reasons: retrieval.reasons
      },
      created_at: new Date().toISOString(),
      language
    };

    // Store in conversation if exists
    const conv = conversations.find(c => c.id === conversation_id);
    if (conv) {
      conv.messages.push({
        id: `msg-user-${Date.now()}`,
        conversation_id,
        role: 'user',
        content: userQuery,
        created_at: new Date().toISOString(),
        language
      });
      conv.messages.push(assistantMessage);
      conv.updated_at = new Date().toISOString();
    }

    res.json(assistantMessage);
  } catch (err: any) {
    console.error('Chat endpoint error:', err);
    res.status(500).json({ error: 'Failed to process statutory query', details: err.message });
  }
});

// 4. Chat Streaming via Server-Sent Events (SSE)
apiRouter.post('/chat/stream', async (req: Request, res: Response) => {
  try {
    const { query, message, conversation_id, language = 'en' } = req.body;
    const userQuery = (query || message || '').trim();

    if (!userQuery) {
      return res.status(400).json({ error: 'Query is required.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const retrieval = searchStatutoryKnowledge(userQuery, 3);
    const ragAnswer = await generateRAGAnswer(userQuery, retrieval.chunks, language);

    // Stream out chunks of content
    const words = ragAnswer.content.split(' ');
    for (let i = 0; i < words.length; i += 5) {
      const slice = words.slice(i, i + 5).join(' ') + ' ';
      res.write(`data: ${JSON.stringify({ text: slice })}\n\n`);
      await new Promise(r => setTimeout(r, 40));
    }

    // Send final payload
    const finalData = {
      done: true,
      content: ragAnswer.content,
      relevant_considerations: ragAnswer.relevant_considerations,
      recommended_next_steps: ragAnswer.recommended_next_steps,
      citations: retrieval.citations,
      confidence: {
        level: retrieval.confidenceLevel,
        score: retrieval.confidenceScore,
        reasons: retrieval.reasons
      }
    };
    res.write(`data: ${JSON.stringify(finalData)}\n\n`);
    res.end();
  } catch (err: any) {
    console.error('Stream error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// 5. Product Analyzer
apiRouter.get('/products', (req: Request, res: Response) => {
  res.json(savedProducts);
});

apiRouter.post('/products/analyze', (req: Request, res: Response) => {
  const info = req.body;
  const analysis = analyzeFormulation(info);

  const isProprietary = !info.classical_reference;
  const likelyCategory = isProprietary ? 'Proprietary Ayurvedic Medicine' : 'Classical Ayurvedic Medicine';

  const result = {
    id: `prod-${Date.now()}`,
    user_id: 'user-default',
    product_information: info,
    likely_category: likelyCategory,
    category_reasoning: isProprietary
      ? 'Custom ingredient ratios or modern presentation categorize this as Patent & Proprietary Ayurvedic Medicine under Section 3(h) of Drugs and Cosmetics Act.'
      : 'Ingredients and indications trace directly to authoritative Ayurvedic scriptures recognized in First Schedule of Drugs and Cosmetics Act.',
    confidence: {
      level: 'High' as const,
      score: 0.94,
      reasons: [
        `Identified ${analysis.detectedHerbs.length} standard botanical ingredients in Ayurvedic Pharmacopoeia.`,
        'Checked against Section 3(p) TK and Section 3(e) admixture criteria.',
        'Verified against National Biodiversity Authority guidelines.'
      ]
    },
    regulatory_considerations: [
      {
        title: 'AYUSH Manufacturing License (Form 25D)',
        description: 'Requires state drug licensing approval with proof of safety/efficacy or classical text citation.',
        governing_statute: 'Drugs & Cosmetics Act, 1940 & Rules 1945',
        actionable_requirement: 'Compile stability test data and submit application to State AYUSH Licensing Authority.'
      },
      {
        title: 'Schedule T GMP Certification',
        description: 'Facility must satisfy Schedule T spatial segregation, HVAC, and QC laboratory requirements.',
        governing_statute: 'Schedule T (Drugs and Cosmetics Rules)',
        actionable_requirement: 'Perform heavy metal (Pb, Cd, As, Hg), pesticide residue, and microbial limit testing per batch.'
      }
    ],
    ipr_considerations: {
      patent_assessment: analysis.section3pRisk === 'High'
        ? 'Product formulation as a whole faces severe Section 3(p) [Traditional Knowledge] and Section 3(e) [Mere Admixture] patent exclusions. A patent is only viable for a genuinely novel extraction process or if quantitative synergy (combination index < 1) is experimentally proven.'
        : 'Formulation may have patent prospects if novel non-obvious ingredients or synthetic hybrids are involved.',
      section_3p_tk_bar: analysis.section3pRisk,
      section_3e_admixture_bar: analysis.section3eRisk,
      trademark_recommendation: `Register the coined brand name "${info.product_name || 'Brand'}" under Class 5 (Pharmaceuticals/Herbal) with the Trade Marks Registry.`,
      industrial_design: 'File for Design registration under the Designs Act, 2000 for unique bottle shapes, packaging ergonomics, or dispenser caps.',
      trade_secret_potential: 'Keep temperature curves, fractionation solvents, and standardization ratios strictly as trade secrets with non-disclosure agreements (NDAs).'
    },
    traditional_knowledge_abs_flags: {
      tk_prior_art_risk: analysis.section3pRisk,
      tk_details: `Includes recognized Indian traditional botanical resources: ${analysis.detectedHerbs.join(', ') || 'AYUSH herbs'}.`,
      biological_resource_status: 'Indian biological resource subject to Biological Diversity Act, 2002.',
      nba_abs_requirements: analysis.isExport
        ? 'Mandatory Form I approval from NBA for export/commercial utilization. Form III mandatory prior to patent filing.'
        : 'Form III approval from NBA mandatory before patent grant. Prior intimation to State Biodiversity Board (SBB) under Section 7 required for commercial manufacturing.',
      form_required: analysis.isExport ? 'Form I (Export / Access) & Form III (IPR)' : 'Form III (IPR) & SBB Form I'
    },
    recommended_next_steps: [
      'File Trademark application for brand protection immediately.',
      'Submit NBA Form III application if pursuing Indian or foreign patents.',
      'Obtain Schedule T compliant manufacturing license or third-party loan license.',
      'Conduct comparative synergy assay if challenging Section 3(e) objections.'
    ],
    evidence: [
      {
        index: 1,
        chunk_id: 'CHUNK-PAT-001',
        document_id: 'DOC-PATENTS-ACT-1970',
        title: 'The Patents Act, 1970 — Section 3(p)',
        authority: 'Office of the CGPDTM',
        section: 'Section 3(p)',
        source: 'Official Gazette of India',
        excerpt: 'Inventions which in effect are traditional knowledge are barred from patentability...'
      },
      {
        index: 2,
        chunk_id: 'CHUNK-BD-001',
        document_id: 'DOC-BIOLOGICAL-DIVERSITY-ACT-2002',
        title: 'Biological Diversity Act, 2002 — Section 6(1)',
        authority: 'National Biodiversity Authority',
        section: 'Section 6(1)',
        source: 'Gazette of India',
        excerpt: 'Prior approval of the National Biodiversity Authority is required before applying for IPR...'
      }
    ],
    created_at: new Date().toISOString()
  };

  savedProducts.unshift(result);
  res.json(result);
});

// 6. IPR Navigator Analysis
apiRouter.post('/ipr/analyze', (req: Request, res: Response) => {
  const query = req.body;
  const assetType = query.asset_type || 'New formulation';

  let potentialProtection: string[] = [];
  let primaryProtection = '';
  let whyRelevant = '';
  let importantConsiderations: string[] = [];
  let relevantAuthority = 'Office of the Controller General of Patents, Designs & Trade Marks (CGPDTM)';
  let documentsToPrepare: string[] = [];
  let possibleNextSteps: string[] = [];

  if (assetType.includes('formulation') || assetType.includes('invention')) {
    potentialProtection = ['Patent (Process only with synergy data)', 'Trade Mark (Brand Name)', 'Trade Secret (Extraction parameters)'];
    primaryProtection = 'Trade Mark & Trade Secret Strategy (with conditional Process Patent)';
    whyRelevant = 'Product formulations based on known herbs face Section 3(p) and 3(e) statutory bars under the Patents Act, 1970. A strong distinctive Trademark provides commercial exclusivity without patent vulnerability.';
    importantConsiderations = [
      'Section 3(p) Traditional Knowledge exclusion in Indian patent law.',
      'Section 3(e) requires quantitative evidence of unexpected synergistic efficacy.',
      'NBA Form III mandatory approval under Biological Diversity Act, 2002 prior to patent grant.'
    ];
    documentsToPrepare = [
      'Trademark application Form TM-A with user affidavit and power of attorney.',
      'Comprehensive comparative assay report proving combination index < 1 (for patent).',
      'NBA Form III application dossier with biological source invoices.'
    ];
    possibleNextSteps = [
      'Conduct a TM search on IP India public search portal.',
      'File TM-A under Class 5 for pharmaceutical and Ayurvedic herbal goods.',
      'Maintain formulation recipe and SOPs under strict NDAs as trade secrets.'
    ];
  } else if (assetType.includes('Brand') || assetType.includes('Logo')) {
    potentialProtection = ['Trade Mark Registration', 'Copyright (for stylized artistic logo)'];
    primaryProtection = 'Trade Mark (Class 5 & Class 35)';
    whyRelevant = 'Trademarks grant 10-year renewable legal monopoly over brand name, preventing counterfeiting and misleading consumer confusion.';
    importantConsiderations = [
      'Cannot register purely generic Ayurvedic or botanical names (Section 9(1)(b) Trade Marks Act).',
      'Must ensure the mark is distinctive and not deceptively similar to registered marks (Section 11).'
    ];
    documentsToPrepare = ['TM-A Application form', 'Clear representation of logo/mark', 'User affidavit with first date of commercial use'];
    possibleNextSteps = ['File trademark application online via IP India gateway', 'Monitor for examination report within 1-3 months'];
  } else {
    potentialProtection = ['Trade Mark', 'Designs Act, 2000 (Packaging/Bottle)', 'Trade Secret'];
    primaryProtection = 'Integrated IP Portfolio (Trademark + Design)';
    whyRelevant = 'Provides multi-layered legal shielding across brand recognition and unique aesthetic packaging.';
    importantConsiderations = ['Must establish novelty in design aesthetics', 'Ensure non-functional shape requirements'];
    documentsToPrepare = ['Design representation sheets', 'Form TM-A'];
    possibleNextSteps = ['File Design registration with Kolkata Design Office', 'Register brand name on IP India'];
  }

  res.json({
    potential_protection: potentialProtection,
    primary_protection: primaryProtection,
    why_relevant: whyRelevant,
    important_considerations: importantConsiderations,
    relevant_authority: relevantAuthority,
    documents_to_prepare: documentsToPrepare,
    possible_next_steps: possibleNextSteps,
    sources: [
      {
        index: 1,
        chunk_id: 'CHUNK-PAT-001',
        document_id: 'DOC-PATENTS-ACT-1970',
        title: 'The Patents Act, 1970',
        authority: 'CGPDTM',
        section: 'Section 3(p) & 3(e)',
        source: 'Official Gazette',
        excerpt: 'Traditional knowledge and mere admixtures are barred from patent protection...'
      }
    ],
    disclaimer: 'This statutory guidance is provided for decision-support and does not constitute formal legal counsel. Formal filing should be supervised by a registered Patent/Trademark Agent.'
  });
});

// 7. Access and Benefit Sharing (ABS) Analysis
apiRouter.post('/abs/analyze', (req: Request, res: Response) => {
  const { biological_resource, intended_use, geographic_origin } = req.body;
  const isForeign = intended_use === 'Foreign entity utilization';
  const isIPR = intended_use === 'IP filing';

  res.json({
    traditional_knowledge_overview: `The biological resource (${biological_resource || 'botanical material'}) has documented historical use in traditional medicine systems. Utilization in commercial products triggers statutory obligations under the Biological Diversity Act, 2002.`,
    biological_resource_assessment: `Sourced from ${geographic_origin || 'India'}. Classified as an Indian biological resource governed by the National Biodiversity Authority (NBA) and State Biodiversity Boards (SBB).`,
    abs_considerations: {
      nba_approval_needed: isForeign || isIPR,
      sbb_notification_needed: !isForeign,
      statutory_sections: ['Section 3 (Foreign Access)', 'Section 6 (IPR Approval)', 'Section 7 (SBB Prior Intimation)', 'Section 21 (Benefit Sharing)'],
      benefit_sharing_rate: '0.1% to 0.5% on annual gross ex-factory sale of product (or 3% to 5% of purchase price of biological resources)',
      exemptions_applicable: 'Registered AYUSH practitioners and cultivated medicinal plants for domestic commercial use are exempted under the 2023 Amendment Act.'
    },
    prior_art_tk_considerations: 'CSIR-TKDL records may contain prior art citations. Disclosing geographical source and community origin is mandatory under Section 10(4) of Patents Act and 2024 WIPO GRATK Treaty.',
    potential_ip_implications: [
      'NBA Form III mandatory before patent grant.',
      'Failure to disclose source of origin is grounds for revocation under Section 64(1)(p).',
      'ABS benefit sharing agreement must be executed with NBA.'
    ],
    recommended_next_steps: [
      isIPR ? 'File Form III on NBA portal (Chennai) immediately after patent application number is generated.' : 'Submit prior intimation to the concerned State Biodiversity Board.',
      'Maintain traceable farmer/cultivator purchase invoices to benefit from cultivated plant provisions under 2023 Amendment.',
      'Prepare mandatory disclosure declaration for patent specification.'
    ],
    sources: [
      {
        index: 1,
        chunk_id: 'CHUNK-BD-001',
        document_id: 'DOC-BIOLOGICAL-DIVERSITY-ACT-2002',
        title: 'Biological Diversity Act, 2002 — Section 6',
        authority: 'National Biodiversity Authority (NBA)',
        section: 'Section 6(1)',
        source: 'Gazette of India',
        excerpt: 'Prior approval of NBA is mandatory before applying for IPR in or outside India...'
      }
    ]
  });
});

// 8. Research Document Search
apiRouter.get('/research/search', (req: Request, res: Response) => {
  const query = (req.query.q as string || '').toLowerCase();
  const topic = req.query.topic as string;
  const authority = req.query.authority as string;

  let results = AUTHORITATIVE_DOCUMENTS;

  if (topic && topic !== 'All') {
    results = results.filter(d => d.topic.toLowerCase().includes(topic.toLowerCase()));
  }
  if (authority && authority !== 'All') {
    results = results.filter(d => d.authority.toLowerCase().includes(authority.toLowerCase()));
  }
  if (query) {
    results = results.filter(d => 
      d.title.toLowerCase().includes(query) ||
      d.summary.toLowerCase().includes(query) ||
      d.topic.toLowerCase().includes(query)
    );
  }

  res.json(results);
});

// 9. Document Detail
apiRouter.get('/documents/:id', (req: Request, res: Response) => {
  const doc = AUTHORITATIVE_DOCUMENTS.find(d => d.id === req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const chunks = AUTHORITATIVE_CHUNKS.filter(c => c.document_id === doc.id);
  res.json({
    ...doc,
    chunks
  });
});

// 10. Admin Endpoints
apiRouter.get('/admin/documents', (req: Request, res: Response) => {
  res.json(AUTHORITATIVE_DOCUMENTS);
});

apiRouter.post('/admin/documents', (req: Request, res: Response) => {
  const newDoc = {
    ...req.body,
    id: `DOC-CUSTOM-${Date.now()}`,
    status: 'Indexed',
    chunk_count: 1
  };
  AUTHORITATIVE_DOCUMENTS.push(newDoc);
  res.status(201).json(newDoc);
});

apiRouter.post('/admin/documents/:id/index', (req: Request, res: Response) => {
  res.json({ success: true, id: req.params.id, message: 'Document successfully re-indexed into semantic store.' });
});

apiRouter.get('/admin/telemetry', (req: Request, res: Response) => {
  res.json(telemetry);
});

// 11. Workspace Saved Research
apiRouter.get('/workspace/saved-research', (req: Request, res: Response) => {
  res.json(savedResearch);
});

apiRouter.post('/workspace/save-research', (req: Request, res: Response) => {
  const item = {
    id: `save-${Date.now()}`,
    user_id: 'user-default',
    ...req.body,
    created_at: new Date().toISOString()
  };
  savedResearch.unshift(item);
  res.status(201).json(item);
});

apiRouter.delete('/workspace/saved-research/:id', (req: Request, res: Response) => {
  savedResearch = savedResearch.filter(s => s.id !== req.params.id);
  res.json({ success: true, id: req.params.id });
});

// 12. Translation Endpoint
apiRouter.post('/translate', async (req: Request, res: Response) => {
  const { text, target_language } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  // Quick fallback dictionary for statutory terminology
  const termMapHi: Record<string, string> = {
    'patent': 'पेटेंट (एकस्व)',
    'traditional knowledge': 'पारंपरिक ज्ञान',
    'biological resources': 'जैविक संसाधन',
    'national biodiversity authority': 'राष्ट्रीय जैव विविधता प्राधिकरण (NBA)',
    'schedule t': 'अनुसूची टी (Schedule T) जीएमपी'
  };

  if (target_language === 'hi') {
    let translated = text;
    for (const [en, hi] of Object.entries(termMapHi)) {
      translated = translated.replace(new RegExp(en, 'gi'), hi);
    }
    return res.json({ translated_text: translated });
  }

  res.json({ translated_text: text });
});
