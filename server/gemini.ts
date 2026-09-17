import { GoogleGenAI } from '@google/genai';
import { DocumentChunk } from './data/authoritative_documents.js';

let aiInstance: GoogleGenAI | null = null;

export function getAI(): GoogleGenAI | null {
  if (!aiInstance && process.env.GEMINI_API_KEY) {
    aiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

// Fallback models in priority order per @google/genai guidelines - flash-lite first for rapid sub-second latency
const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash'
];

export function getGroundedStatutoryFallback(
  query: string,
  contextChunks: DocumentChunk[],
  jurisdiction: 'india' | 'international' = 'india'
): {
  content: string;
  relevant_considerations: string[];
  recommended_next_steps: string[];
} {
  if (jurisdiction === 'international') {
    return {
      content: `Under International Intellectual Property and regulatory frameworks (Patent Cooperation Treaty PCT, USPTO, EPO, and Nagoya Protocol), botanical formulations and traditional knowledge assets encounter specialized eligibility and prior art barriers. In the United States under 35 U.S.C. § 101 (and Supreme Court precedents in Myriad and Mayo), naturally occurring plant products or mere aggregations are patent-ineligible unless modified to display markedly different characteristics or non-natural functional synergy. In Europe under the European Patent Convention (EPC Articles 52/53), claims cannot monopolize standard herbal remedies or direct methods of medical treatment, requiring second medical indication format. Furthermore, under Article 3 of the 2024 WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge, as well as the Nagoya Protocol, international patent applications utilizing genetic resources must disclose country of origin and prove Prior Informed Consent (PIC) and Access & Benefit Sharing (ABS) compliance. Major international patent offices (USPTO, EPO, JPO, UKIPO) actively search India's CSIR-TKDL repository as anticipatory prior art.`,
      relevant_considerations: [
        'USPTO 35 U.S.C. § 101 & MPEP 2106: Natural product doctrine requires markedly different characteristics or non-obvious synergistic bioavailability.',
        'EPO EPC Articles 52/53: Inventive step requirements and exclusion of diagnostic/therapeutic treatment methods.',
        '2024 WIPO GRATK Treaty & Nagoya Protocol: Mandatory disclosure of genetic resources and indigenous traditional knowledge provenance.',
        'WIPO PCT International Searching Authority (ISA): Comprehensive citations against CSIR-TKDL and global patent classifications (TKRC).'
      ],
      recommended_next_steps: [
        'Evaluate filing a PCT international application to preserve priority across 157 member states prior to national phase entry.',
        'Ensure mandatory prior domestic biodiversity clearance (e.g., NBA Form III under India BD Act Section 6) before filing any foreign application.',
        'Conduct international prior art clearance across USPTO Patent Public Search, EPO Espacenet, and WIPO Patentscope.',
        'Formulate claims around purified bioactive fractions, specific delivery kinetics, or synergistic drug combinations with empirical comparative assays.'
      ]
    };
  }

  const isPatents = query.toLowerCase().includes('patent') || query.toLowerCase().includes('invent') || query.toLowerCase().includes('formula');
  const isNBA = query.toLowerCase().includes('nba') || query.toLowerCase().includes('biodiversity') || query.toLowerCase().includes('export') || query.toLowerCase().includes('abs');
  const isGMP = query.toLowerCase().includes('schedule t') || query.toLowerCase().includes('gmp') || query.toLowerCase().includes('manufacturing') || query.toLowerCase().includes('license');

  let defaultContent = '';
  let defaultConsiderations: string[] = [];
  let defaultNextSteps: string[] = [];

  if (contextChunks && contextChunks.length > 0) {
    const chunkTitles = contextChunks.map(c => `${c.title} (${c.section})`).join(', ');
    const primaryChunk = contextChunks[0];

    if (isPatents) {
      defaultContent = `Under Section 3(p) of the Patents Act, 1970, traditional knowledge or combinations thereof are non-patentable subject matter. As specified in ${primaryChunk.title}, statutory requirements dictate demonstrating verifiable synergistic efficacy beyond mere admixture under Section 3(e). Additionally, under Section 6 of the Biological Diversity Act, 2002, inventions utilizing biological resources obtained from India require mandatory prior approval (Form III) from the National Biodiversity Authority (NBA) prior to the grant of patents.`;
    } else if (isNBA) {
      defaultContent = `Pursuant to the Biological Diversity Act, 2002 and governing NBA guidelines (${primaryChunk.title}), accessing Indian biological resources or associated traditional knowledge for commercial utilization or intellectual property filings necessitates mandatory regulatory compliance. Section 6(1) mandates prior approval from the National Biodiversity Authority (Form III) before applying for intellectual property rights, while Section 3 and Section 4 oversee commercial utilization and export authorizations.`;
    } else if (isGMP) {
      defaultContent = `Under Schedule T of the Drugs and Cosmetics Rules, 1945, manufacturers of Ayurvedic, Siddha, and Unani (ASU) medicines must strictly comply with Good Manufacturing Practices (GMP). As outlined in ${primaryChunk.title}, requirements include rigorous environmental controls, batch manufacturing records (BMR), raw material botanical standardization, and mandatory testing for heavy metals, microbial count, and pesticide residues.`;
    } else {
      defaultContent = `Based on governing Indian statutory frameworks including ${chunkTitles}, regulatory compliance and intellectual property protection require harmonious alignment across patent eligibility exclusions (Section 3(p) and 3(e) of the Patents Act), biodiversity access authorizations (NBA Form III / SBB intimation), and statutory drug licensing standards under the Drugs and Cosmetics Act.`;
    }

    defaultConsiderations = contextChunks.map(c => `${c.authority} - ${c.section}: ${c.chunk_text.slice(0, 120)}...`);
    defaultNextSteps = [
      'Review statutory provisions cited in the retrieved legal references.',
      'Consult the National Biodiversity Authority (NBA) portal for Form III filing requirements.',
      'Verify prior art in the CSIR Traditional Knowledge Digital Library (TKDL) and CGPDTM databases.',
      'Ensure standard operating procedures align with Schedule T Good Manufacturing Practices.'
    ];
  } else if (isPatents) {
    defaultContent = `Under Section 3(p) of the Patents Act, 1970, an invention which in effect is traditional knowledge or an aggregation/duplication of known properties of traditionally known components is strictly non-patentable. Furthermore, under Section 3(e), polyherbal combinations are deemed mere admixtures unless the applicant provides empirical comparative biological assay data establishing a synergistic therapeutic index exceeding individual additive effects. If biological resources sourced from India are utilized, mandatory prior approval from the National Biodiversity Authority (NBA Form III) under Section 6(1) of the Biological Diversity Act, 2002 must be secured before patent grant.`;
    defaultConsiderations = [
      'Section 3(p) statutory bar: CSIR-TKDL prior art citation risks for classical AYUSH herbs.',
      'Section 3(e) admixture hurdle: Mandatory requirement of synergistic combination index < 1 in vitro/in vivo.',
      'Section 10(4)(d)(ii): Mandatory disclosure of Indian biological resource geographical origin.'
    ];
    defaultNextSteps = [
      'Conduct a specialized CSIR-TKDL and patent database clearance search (CGPDTM / InPASS).',
      'Generate quantitative synergy assay data to satisfy Section 3(e) requirements.',
      'Submit Form III application to the National Biodiversity Authority (NBA) before patent sealing.',
      'Evaluate Trademark (Class 5) and Trade Secret protection for proprietary manufacturing extraction methods.'
    ];
  } else if (isNBA) {
    defaultContent = `Under Section 6(1) of the Biological Diversity Act, 2002, any person or entity applying for an intellectual property right (in India or abroad) based on research conducted on biological resources or associated traditional knowledge obtained from India must obtain prior approval from the National Biodiversity Authority (NBA) in Form III. Export of Indian biological material for research or commercial use also triggers Section 3/Section 4 approvals. The Biological Diversity (Amendment) Act, 2023 provides exemptions for registered AYUSH practitioners and cultivated medicinal plants for domestic commercial utilization, but strict NBA oversight remains for IPR and exports.`;
    defaultConsiderations = [
      'Section 6(1) NBA prior approval requirement for Indian and international patent filings.',
      'Access and Benefit Sharing (ABS) liability: 0.1% to 0.5% ex-factory sale levy or upfront royalty.',
      'State Biodiversity Board (SBB) prior intimation under Section 7 for domestic Indian commercial entities.'
    ];
    defaultNextSteps = [
      'File Form III with the National Biodiversity Authority at Chennai (online portal).',
      'Maintain verifiable chain-of-custody documentation and purchase invoices from licensed cultivators.',
      'Execute ABS benefit-sharing agreement with NBA prior to commercial export or patent issuance.'
    ];
  } else if (isGMP) {
    defaultContent = `Under Schedule T of the Drugs and Cosmetics Rules, 1945, manufacturing of Ayurvedic, Siddha, and Unani (ASU) formulations requires adherence to Good Manufacturing Practices (GMP). Premises must provide dedicated segregated zones for raw herb sorting, cleaning, drying, extraction, compounding, and sterile packaging. Manufacturers must maintain an in-house quality control laboratory or tie up with an approved government testing laboratory for heavy metals (lead, arsenic, cadmium, mercury), pesticide residues, microbial contamination, and TLC/HPTLC botanical finger-printing.`;
    defaultConsiderations = [
      'Schedule T compliance: Segregated raw material quarantine, manufacturing, and QA laboratory.',
      'Mandatory batch testing: Heavy metals, microbial load, aflatoxins, and pesticide limits.',
      'State Licensing Authority (SLA) AYUSH manufacturing license validation and triennial renewal.'
    ];
    defaultNextSteps = [
      'Conduct a gap audit of manufacturing facility against Schedule T layout guidelines.',
      'Establish standard operating procedures (SOPs) and batch manufacturing records (BMR).',
      'Submit license application to the State AYUSH Licensing Authority with product dossiers.'
    ];
  } else {
    defaultContent = `Based on Indian statutory law (The Patents Act, 1970; The Biological Diversity Act, 2002; and the Drugs and Cosmetics Rules, 1945), AYUSH formulations and traditional knowledge assets require careful navigational alignment across patentability exclusions (Section 3(p) & Section 3(e)), biodiversity compliance (NBA Form III), and state licensing under Schedule T. Traditional knowledge codified in texts like Charaka Samhita is protected against monopolization through the CSIR-TKDL repository.`;
    defaultConsiderations = [
      'Intersection of patent law exclusions (Section 3(p)) with biodiversity ABS requirements.',
      'Brand and commercialization protection via the Trade Marks Act, 1999 (Class 5 / Class 3).',
      'Mandatory quality compliance under AYUSH statutory standards.'
    ];
    defaultNextSteps = [
      'Formulate an integrated IP strategy combining trademark protection, patent filing for novel extraction processes, and trade secret protocols.',
      'Verify National Biodiversity Authority compliance status for all sourced botanical raw materials.'
    ];
  }

  return {
    content: defaultContent,
    relevant_considerations: defaultConsiderations,
    recommended_next_steps: defaultNextSteps
  };
}

export const LANGUAGE_PROMPTS: Record<string, string> = {
  as: 'Respond in clear, professional Assamese (অসমীয়া) appropriate for legal and AYUSH regulatory guidance.',
  bn: 'Respond in clear, professional Bengali (বাংলা) appropriate for legal and AYUSH regulatory guidance.',
  brx: 'Respond in clear, professional Bodo (बड़ो) appropriate for legal and AYUSH regulatory guidance.',
  doi: 'Respond in clear, professional Dogri (डोगरी) appropriate for legal and AYUSH regulatory guidance.',
  gu: 'Respond in clear, professional Gujarati (ગુજરાતી) appropriate for legal and AYUSH regulatory guidance.',
  hi: 'Respond in clear, professional Hindi (हिन्दी) appropriate for legal and AYUSH regulatory guidance.',
  kn: 'Respond in clear, professional Kannada (ಕನ್ನಡ) appropriate for legal and AYUSH regulatory guidance.',
  ks: 'Respond in clear, professional Kashmiri (कश्मीरी / كٲشُر) appropriate for legal and AYUSH regulatory guidance.',
  kok: 'Respond in clear, professional Konkani (कोंकणी) appropriate for legal and AYUSH regulatory guidance.',
  mai: 'Respond in clear, professional Maithili (मैथिली) appropriate for legal and AYUSH regulatory guidance.',
  ml: 'Respond in clear, professional Malayalam (മലയാളം) appropriate for legal and AYUSH regulatory guidance.',
  mni: 'Respond in clear, professional Manipuri (মৈতৈলোন্ / Meitei) appropriate for legal and AYUSH regulatory guidance.',
  mr: 'Respond in clear, professional Marathi (मराठी) appropriate for legal and AYUSH business guidance.',
  ne: 'Respond in clear, professional Nepali (नेपाली) appropriate for legal and AYUSH regulatory guidance.',
  or: 'Respond in clear, professional Odia (ଓଡ଼ିଆ) appropriate for legal and AYUSH regulatory guidance.',
  pa: 'Respond in clear, professional Punjabi (ਪੰਜਾਬੀ) appropriate for legal and AYUSH regulatory guidance.',
  sa: 'Respond in clear, professional Sanskrit (संस्कृतम्) appropriate for classical AYUSH and legal research.',
  sat: 'Respond in clear, professional Santali (ᱥᱟᱱᱛᱟᱲᱤ) appropriate for legal and AYUSH regulatory guidance.',
  sd: 'Respond in clear, professional Sindhi (सिंधी / سنڌي) appropriate for legal and AYUSH regulatory guidance.',
  ta: 'Respond in clear, professional Tamil (தமிழ்) appropriate for legal, Siddha, and AYUSH regulatory guidance.',
  te: 'Respond in clear, professional Telugu (తెలుగు) appropriate for legal and AYUSH regulatory guidance.',
  ur: 'Respond in clear, professional Urdu (اردو) appropriate for legal, Unani, and AYUSH regulatory guidance.',
  en: 'Respond in clear, authoritative English with precise legal terminology.'
};

export async function generateRAGAnswer(
  query: string,
  contextChunks: DocumentChunk[],
  language: string = 'en',
  jurisdiction: 'india' | 'international' = 'india'
): Promise<{
  content: string;
  relevant_considerations: string[];
  recommended_next_steps: string[];
}> {
  const ai = getAI();

  const statutoryContext = contextChunks.map((c, i) => 
    `[Citation ${i + 1}] Title: ${c.title}\nAuthority: ${c.authority}\nSection: ${c.section}\nText: ${c.chunk_text}`
  ).join('\n\n');

  const langPrompt = LANGUAGE_PROMPTS[language] ||
    `Respond in clear, authoritative ${language} with precise legal and AYUSH terminology.`;

  const prompt = jurisdiction === 'international'
    ? `You are IP-SAKTI Sahayak, an authoritative decision-support AI assistant specialized in International Intellectual Property and Global Regulatory Frameworks.
Analyze the user query through the lens of International Jurisdiction:
1. Patent Cooperation Treaty (PCT / WIPO): International search standards, Chapter I/II, and entering national phases across foreign patent jurisdictions.
2. The Nagoya Protocol on Access and Benefit Sharing (ABS) & Convention on Biological Diversity (CBD): Prior Informed Consent (PIC), Mutually Agreed Terms (MAT), and internationally recognized certificates of compliance.
3. Comparative international patent eligibility:
   - United States (USPTO): 35 U.S.C. § 101 patent eligibility of natural products / Mayo/Myriad/Alice test, Section 102 prior art citations, and FDA botanical drug development guidance.
   - European Patent Office (EPO): EPC Article 52 (patentable inventions) and Article 53 exceptions (methods of treatment / plant varieties), non-obviousness/inventive step for botanical extracts.
   - WTO TRIPS Agreement: Article 27.3(b) exemptions and traditional knowledge defenses.
4. Mandatory country-of-origin disclosure under the 2024 WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge (Article 3).
5. Traditional Knowledge Digital Library (TKDL) recognition at international patent offices (USPTO, EPO, JPO, UKIPO, CIPO) as non-patentable prior art.
Language instruction: ${langPrompt}

STATUTORY CONTEXT:
${statutoryContext}

USER QUERY:
"${query}"

Provide your answer in the following structured JSON format:
{
  "content": "A comprehensive, legally grounded answer explaining the international treaties, foreign patent eligibility criteria (USPTO/EPO/PCT), genetic resources compliance, and cross-border protection strategies.",
  "relevant_considerations": [
    "Key international legal consideration 1",
    "Key international legal consideration 2",
    "Key international legal consideration 3"
  ],
  "recommended_next_steps": [
    "Concrete actionable international compliance step 1",
    "Concrete actionable international compliance step 2",
    "Concrete actionable international compliance step 3"
  ]
}
Return ONLY valid JSON.`
    : `You are IP-SAKTI Sahayak, an authoritative decision-support AI assistant specialized in Indian Intellectual Property (Patents, Trademarks, Designs, Plant Varieties), AYUSH regulatory compliance (Drugs and Cosmetics Rules Schedule T), and the Biological Diversity Act, 2002 (National Biodiversity Authority NBA & Access & Benefit Sharing ABS).

CRITICAL GROUNDING RULES:
1. Base your answer directly on the statutory provisions provided in the context below.
2. Specifically address whether Section 3(p) [Traditional Knowledge Bar], Section 3(e) [Mere Admixture / Synergistic proof requirement], or Section 6 of Biological Diversity Act [NBA Form III approval] apply.
3. Be precise, objective, and cite the relevant section numbers.
4. Language instruction: ${langPrompt}

STATUTORY CONTEXT:
${statutoryContext}

USER QUERY:
"${query}"

Provide your answer in the following structured JSON format:
{
  "content": "A comprehensive, legally grounded answer explaining the statutory provisions, patentability assessment, regulatory requirements, and compliance implications.",
  "relevant_considerations": [
    "Key legal consideration 1",
    "Key legal consideration 2",
    "Key legal consideration 3"
  ],
  "recommended_next_steps": [
    "Concrete actionable compliance step 1",
    "Concrete actionable compliance step 2",
    "Concrete actionable compliance step 3"
  ]
}
Return ONLY valid JSON.`;

  if (ai) {
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${modelName} timed out`)), 3500)
        );

        const response = await Promise.race([
          ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
          timeoutPromise
        ]);

        if (response.text) {
          let cleanText = response.text.trim();
          if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
          }
          const parsed = JSON.parse(cleanText);
          return {
            content: parsed.content || cleanText,
            relevant_considerations: Array.isArray(parsed.relevant_considerations) ? parsed.relevant_considerations : [],
            recommended_next_steps: Array.isArray(parsed.recommended_next_steps) ? parsed.recommended_next_steps : []
          };
        }
      } catch (err: any) {
        // Fast failover to next model or instant grounded fallback
        continue;
      }
    }
  }

  // Graceful instantaneous statutory synthesis grounded in retrieved sections
  return getGroundedStatutoryFallback(query, contextChunks, jurisdiction);
}

export async function translateWithGemini(
  targetLanguage: string,
  text?: string,
  strings?: Record<string, string>
): Promise<{ translated_text?: string; translated_strings?: Record<string, string>; source: string }> {
  const ai = getAI();
  const langPromptDesc = LANGUAGE_PROMPTS[targetLanguage] || `target language (${targetLanguage})`;

  if (text) {
    if (ai) {
      for (const modelName of CANDIDATE_MODELS) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Model ${modelName} timed out`)), 4000)
          );
          const prompt = `Translate the following text accurately and authoritatively into ${langPromptDesc}. Preserve legal, patent, and AYUSH regulatory terms where appropriate (such as Section 3(p), Schedule T, NBA Form III, TKDL). Return ONLY the translated text without introductory commentary:\n\n${text}`;
          const response = await Promise.race([
            ai.models.generateContent({
              model: modelName,
              contents: prompt,
            }),
            timeoutPromise
          ]);
          if (response.text) {
            return { translated_text: response.text.trim(), source: modelName };
          }
        } catch (e) {
          continue;
        }
      }
    }
    return { translated_text: text, source: 'fallback' };
  }

  if (strings && Object.keys(strings).length > 0) {
    if (ai) {
      for (const modelName of CANDIDATE_MODELS) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Model ${modelName} timed out`)), 7000)
          );
          const prompt = `You are a legal translator specializing in Indian statutory, intellectual property, and AYUSH terminology.
Translate the values in this JSON key-value dictionary into the language described: ${langPromptDesc}.
Keep the EXACT same JSON keys. Only translate the string values.
Keep statutory numbers and references like "Section 3(p)", "Form III", "Schedule T", "TKDL", "NBA" clear and accurate.
JSON TO TRANSLATE:
${JSON.stringify(strings)}

Return ONLY valid JSON matching the schema with the exact same keys.`;
          const response = await Promise.race([
            ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
              },
            }),
            timeoutPromise
          ]);
          if (response.text) {
            let cleanText = response.text.trim();
            if (cleanText.startsWith('```')) {
              cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
            }
            const parsed = JSON.parse(cleanText);
            return { translated_strings: parsed, source: modelName };
          }
        } catch (e) {
          continue;
        }
      }
    }
  }

  return { source: 'statutory-dictionary' };
}
