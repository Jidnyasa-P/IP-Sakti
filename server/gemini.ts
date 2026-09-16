import { GoogleGenAI } from '@google/genai';
import { DocumentChunk } from './data/authoritative_documents.js';

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI | null {
  if (!aiInstance && process.env.GEMINI_API_KEY) {
    aiInstance = new GoogleGenAI();
  }
  return aiInstance;
}

export async function generateRAGAnswer(
  query: string,
  contextChunks: DocumentChunk[],
  language: string = 'en'
): Promise<{
  content: string;
  relevant_considerations: string[];
  recommended_next_steps: string[];
}> {
  const ai = getAI();

  const statutoryContext = contextChunks.map((c, i) => 
    `[Citation ${i + 1}] Title: ${c.title}\nAuthority: ${c.authority}\nSection: ${c.section}\nText: ${c.chunk_text}`
  ).join('\n\n');

  const langPrompt = language === 'hi'
    ? 'Respond in clear, professional Hindi (हिन्दी) appropriate for Indian regulatory and legal guidance.'
    : language === 'mr'
    ? 'Respond in clear, professional Marathi (मराठी) appropriate for legal and AYUSH business guidance.'
    : 'Respond in clear, authoritative English with precise legal terminology.';

  const prompt = `You are IP-SAKTI Sahayak, an authoritative decision-support AI assistant specialized in Indian Intellectual Property (Patents, Trademarks, Designs, Plant Varieties), AYUSH regulatory compliance (Drugs and Cosmetics Rules Schedule T), and the Biological Diversity Act, 2002 (National Biodiversity Authority NBA & Access & Benefit Sharing ABS).

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
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        return {
          content: parsed.content || response.text,
          relevant_considerations: Array.isArray(parsed.relevant_considerations) ? parsed.relevant_considerations : [],
          recommended_next_steps: Array.isArray(parsed.recommended_next_steps) ? parsed.recommended_next_steps : []
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed or timed out, using grounded statutory fallback:', err);
    }
  }

  // Grounded statutory fallback when API key is unconfigured or in offline demo mode
  const isPatents = query.toLowerCase().includes('patent') || query.toLowerCase().includes('invent') || query.toLowerCase().includes('formula');
  const isNBA = query.toLowerCase().includes('nba') || query.toLowerCase().includes('biodiversity') || query.toLowerCase().includes('export') || query.toLowerCase().includes('abs');
  const isGMP = query.toLowerCase().includes('schedule t') || query.toLowerCase().includes('gmp') || query.toLowerCase().includes('manufacturing') || query.toLowerCase().includes('license');

  let defaultContent = '';
  let defaultConsiderations: string[] = [];
  let defaultNextSteps: string[] = [];

  if (isPatents) {
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
