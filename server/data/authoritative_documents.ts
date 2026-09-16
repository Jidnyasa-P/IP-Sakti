// Authoritative Statutory Documents & Chunks for IP-SAKTI Sahayak
// Grounded in official acts, rules, notifications and WIPO treaties

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
  keywords: string[];
}

export const AUTHORITATIVE_DOCUMENTS: DocumentMetadata[] = [
  {
    id: 'DOC-PATENTS-ACT-1970',
    title: 'The Patents Act, 1970 (as amended)',
    source: 'Official Gazette of India / IP India (CGPDTM)',
    authority: 'Office of the Controller General of Patents, Designs & Trade Marks',
    url: 'https://ipindia.gov.in',
    document_type: 'Act',
    jurisdiction: 'India',
    publication_date: '1970-09-19',
    effective_date: '1972-04-20',
    language: 'English',
    topic: 'IPR',
    summary: 'Primary Indian patent statute establishing patentability criteria, non-patentable subject matter under Section 3 (including Section 3(p) for traditional knowledge and Section 3(e) for mere admixture), compulsory licensing, and revocation.',
    status: 'Indexed',
    chunk_count: 5
  },
  {
    id: 'DOC-PATENT-RULES-2024',
    title: 'The Patents (Amendment) Rules, 2024',
    source: 'Gazette of India, Part II Section 3(i), No. 197',
    authority: 'CGPDTM / DPIIT, Ministry of Commerce and Industry',
    url: 'https://ipindia.gov.in',
    document_type: 'Rules',
    jurisdiction: 'India',
    publication_date: '2024-03-15',
    effective_date: '2024-03-15',
    language: 'English',
    topic: 'IPR',
    summary: 'Amended patent examination timelines, concessions for educational institutions, revised statement of working (Form 27), and expedited examination protocols.',
    status: 'Indexed',
    chunk_count: 3
  },
  {
    id: 'DOC-BIOLOGICAL-DIVERSITY-ACT-2002',
    title: 'The Biological Diversity Act, 2002 & Amendment Act, 2023',
    source: 'Gazette of India (Ministry of Environment, Forest and Climate Change)',
    authority: 'National Biodiversity Authority (NBA) & State Biodiversity Boards (SBB)',
    url: 'http://nbaindia.org',
    document_type: 'Act',
    jurisdiction: 'India',
    publication_date: '2003-02-05',
    effective_date: '2004-07-01',
    language: 'English',
    topic: 'Biological Resources & ABS',
    summary: 'Regulates access to biological resources occurring in India and associated knowledge. Mandates prior NBA approval (Form III) before applying for IPR inside or outside India (Section 6), State Biodiversity Board intimation (Section 7), and ABS benefit-sharing mechanism.',
    status: 'Indexed',
    chunk_count: 5
  },
  {
    id: 'DOC-TKDL-GUIDELINES',
    title: 'CSIR-TKDL Prior Art Guidelines & Access Agreement',
    source: 'Council of Scientific & Industrial Research (CSIR) & Ministry of AYUSH',
    authority: 'CSIR-TKDL Unit, Government of India',
    url: 'http://www.tkdl.res.in',
    document_type: 'Guidelines',
    jurisdiction: 'India / International',
    publication_date: '2001-10-01',
    effective_date: '2001-10-01',
    language: 'English',
    topic: 'Traditional Knowledge',
    summary: 'Defines Traditional Knowledge Digital Library structure containing codified Ayurvedic, Unani, Siddha, and Yoga formulations translated into patent classification (IPC/TKRC) to defeat wrongful patent claims globally.',
    status: 'Indexed',
    chunk_count: 4
  },
  {
    id: 'DOC-SCHEDULE-T-GMP',
    title: 'Schedule T: Good Manufacturing Practices (GMP) for ASU Drugs',
    source: 'Drugs and Cosmetics Rules, 1945 (Ministry of Health and Family Welfare / AYUSH)',
    authority: 'Ministry of AYUSH, Government of India',
    url: 'https://ayush.gov.in',
    document_type: 'Rules',
    jurisdiction: 'India',
    publication_date: '2000-06-23',
    effective_date: '2000-06-23',
    language: 'English',
    topic: 'Regulatory & GMP',
    summary: 'Statutory requirements of factory premises, hygienic conditions, manufacturing equipment, raw material authentication, and quality control laboratories for Ayurvedic, Siddha, and Unani medicines.',
    status: 'Indexed',
    chunk_count: 4
  },
  {
    id: 'DOC-TRADE-MARKS-ACT-1999',
    title: 'The Trade Marks Act, 1999 & Trade Marks Rules, 2017',
    source: 'Gazette of India, Act No. 47 of 1999',
    authority: 'Trade Marks Registry (CGPDTM)',
    url: 'https://ipindia.gov.in',
    document_type: 'Act',
    jurisdiction: 'India',
    publication_date: '1999-12-30',
    effective_date: '2003-09-15',
    language: 'English',
    topic: 'IPR',
    summary: 'Governs trademark registration in India. Prohibits registration of descriptive Ayurvedic terms under Section 9, permits distinctive brand names, and protects collective and certification marks.',
    status: 'Indexed',
    chunk_count: 3
  },
  {
    id: 'DOC-WIPO-GRATK-2024',
    title: 'WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge',
    source: 'World Intellectual Property Organization (WIPO Diplomatic Conference)',
    authority: 'WIPO / Member States',
    url: 'https://www.wipo.int',
    document_type: 'Treaty',
    jurisdiction: 'International / India Signatory',
    publication_date: '2024-05-24',
    effective_date: '2024-05-24',
    language: 'English',
    topic: 'Traditional Knowledge',
    summary: 'Historic multilateral treaty obligating patent applicants whose inventions are based on genetic resources and associated traditional knowledge to disclose country of origin and indigenous source community.',
    status: 'Indexed',
    chunk_count: 3
  },
  {
    id: 'DOC-AYURVEDA-AAHAR-2022',
    title: 'Food Safety and Standards (Ayurveda Aahar) Regulations, 2022',
    source: 'Food Safety and Standards Authority of India (FSSAI) & Ministry of AYUSH',
    authority: 'FSSAI & Ministry of AYUSH',
    url: 'https://fssai.gov.in',
    document_type: 'Regulation',
    jurisdiction: 'India',
    publication_date: '2022-05-05',
    effective_date: '2022-05-05',
    language: 'English',
    topic: 'Regulatory & GMP',
    summary: 'Defines regulatory framework for food prepared in accordance with authoritative Ayurvedic texts, labelling standards, health claims verification, and mandatory prior approval for non-specified ingredients.',
    status: 'Indexed',
    chunk_count: 3
  }
];

export const AUTHORITATIVE_CHUNKS: DocumentChunk[] = [
  {
    chunk_id: 'CHUNK-PAT-001',
    document_id: 'DOC-PATENTS-ACT-1970',
    title: 'The Patents Act, 1970 — Section 3(p): Traditional Knowledge Exclusion',
    source: 'Official Gazette of India / IP India (CGPDTM)',
    authority: 'Office of the Controller General of Patents, Designs & Trade Marks',
    jurisdiction: 'India',
    document_type: 'Act',
    section: 'Section 3(p)',
    page: 12,
    paragraph: 'Clause (p)',
    language: 'English',
    publication_date: '1970-09-19',
    effective_date: '2003-05-20',
    topic: 'IPR',
    chunk_text: 'Section 3(p) states: "The following are not inventions within the meaning of this Act: an invention which in effect, is traditional knowledge or which is an aggregation or duplication of known properties of traditionally known component or components." This establishes an absolute statutory bar against patenting any herbal medicine, decoction, formulation, or usage that is already recorded or known in traditional medical systems like Ayurveda, Siddha, Unani, or tribal folklore.',
    keywords: ['section 3(p)', 'traditional knowledge', 'ayurveda', 'ayush', 'herbal', 'aggregation', 'patents act', 'statutory bar']
  },
  {
    chunk_id: 'CHUNK-PAT-002',
    document_id: 'DOC-PATENTS-ACT-1970',
    title: 'The Patents Act, 1970 — Section 3(e): Mere Admixture & Synergy Proof',
    source: 'Official Gazette of India / IP India (CGPDTM)',
    authority: 'Office of the Controller General of Patents, Designs & Trade Marks',
    jurisdiction: 'India',
    document_type: 'Act',
    section: 'Section 3(e)',
    page: 11,
    paragraph: 'Clause (e)',
    language: 'English',
    publication_date: '1970-09-19',
    effective_date: '1972-04-20',
    topic: 'IPR',
    chunk_text: 'Section 3(e) states: "The following are not inventions within the meaning of this Act: a substance obtained by a mere admixture resulting only in the aggregation of the properties of the components thereof or a process for producing such substance." To overcome Section 3(e) for polyherbal compositions, applicants must furnish rigorous comparative biological assay and quantitative synergy data (e.g. combination index < 1 or isobologram data) proving the combination achieves an unexpected therapeutic result beyond the sum of individual known herbal ingredients.',
    keywords: ['section 3(e)', 'mere admixture', 'synergy', 'synergistic', 'formulation', 'polyherbal', 'combination index', 'biological assay']
  },
  {
    chunk_id: 'CHUNK-PAT-003',
    document_id: 'DOC-PATENTS-ACT-1970',
    title: 'The Patents Act, 1970 — Section 10(4)(d)(ii): Disclosure of Biological Source',
    source: 'Official Gazette of India / IP India (CGPDTM)',
    authority: 'Office of the Controller General of Patents, Designs & Trade Marks',
    jurisdiction: 'India',
    document_type: 'Act',
    section: 'Section 10(4)(d)(ii)',
    page: 24,
    paragraph: 'Clause (d)(ii)',
    language: 'English',
    publication_date: '1970-09-19',
    effective_date: '2003-05-20',
    topic: 'IPR',
    chunk_text: 'Every complete specification must disclose the source and geographical origin of the biological material in the specification, when that biological material is used in an invention. Failure to disclose or wrongful disclosure of source/origin constitutes valid grounds for pre-grant opposition, post-grant opposition (Section 25), and patent revocation (Section 64(1)(p)).',
    keywords: ['section 10(4)', 'geographical origin', 'biological material', 'disclosure', 'revocation', 'section 64', 'opposition']
  },
  {
    chunk_id: 'CHUNK-BD-001',
    document_id: 'DOC-BIOLOGICAL-DIVERSITY-ACT-2002',
    title: 'Biological Diversity Act, 2002 — Section 6(1): Prior Approval for IPR (Form III)',
    source: 'Gazette of India (Act No. 18 of 2003)',
    authority: 'National Biodiversity Authority (NBA)',
    jurisdiction: 'India',
    document_type: 'Act',
    section: 'Section 6(1)',
    page: 6,
    paragraph: 'Sub-section (1)',
    language: 'English',
    publication_date: '2003-02-05',
    effective_date: '2004-07-01',
    topic: 'Biological Resources & ABS',
    chunk_text: 'Section 6(1) provides: "No person shall apply for any intellectual property right, by whatever name called, in or outside India for any invention based on any research or information on a biological resource obtained from India without obtaining the previous approval of the National Biodiversity Authority before making such application." For patents, an application for NBA Form III approval may be made after filing the patent application, but MUST be granted before the patent is sealed by the patent office.',
    keywords: ['section 6', 'section 6(1)', 'nba', 'national biodiversity authority', 'form iii', 'form 3', 'ipr approval', 'biological resource', 'prior approval']
  },
  {
    chunk_id: 'CHUNK-BD-002',
    document_id: 'DOC-BIOLOGICAL-DIVERSITY-ACT-2002',
    title: 'Biological Diversity Act, 2002 — Section 3 & 7: Access Regulations & SBB Intimation',
    source: 'Gazette of India (Act No. 18 of 2003)',
    authority: 'National Biodiversity Authority (NBA) & State Biodiversity Boards (SBB)',
    jurisdiction: 'India',
    document_type: 'Act',
    section: 'Section 3 & Section 7',
    page: 4,
    paragraph: 'Sections 3, 7',
    language: 'English',
    publication_date: '2003-02-05',
    effective_date: '2004-07-01',
    topic: 'Biological Resources & ABS',
    chunk_text: 'Section 3 mandates foreign persons, non-residents, and Indian entities having any non-Indian participation in share capital or management to obtain prior NBA approval (Form I) before accessing any biological resource occurring in India for research or commercial utilization. Section 7 mandates Indian citizens and Indian companies to give prior intimation in prescribed format to the concerned State Biodiversity Board (SBB) before obtaining biological resources for commercial utilization, subject to statutory exemptions for local vaids and hakims practicing indigenous medicine.',
    keywords: ['section 3', 'section 7', 'sbb', 'state biodiversity board', 'form i', 'foreign entity', 'commercial utilization', 'vaids', 'hakims']
  },
  {
    chunk_id: 'CHUNK-BD-003',
    document_id: 'DOC-BIOLOGICAL-DIVERSITY-ACT-2002',
    title: 'Biological Diversity (Amendment) Act, 2023: Key Exemptions & Codified TK',
    source: 'Gazette of India (Act No. 10 of 2023)',
    authority: 'Ministry of Environment, Forest and Climate Change / NBA',
    jurisdiction: 'India',
    document_type: 'Act',
    section: 'Amendment Section 7 & 40',
    page: 3,
    paragraph: 'Amended Sections',
    language: 'English',
    publication_date: '2023-08-03',
    effective_date: '2023-09-01',
    topic: 'Biological Resources & ABS',
    chunk_text: 'The Biological Diversity (Amendment) Act, 2023 exempts registered AYUSH practitioners, folk healers, and Indian entities cultivating medicinal plants and manufacturing codified traditional knowledge products from prior intimation to State Biodiversity Boards (SBBs) for domestic commercial utilization. However, any entity applying for IPR (including patents) or exporting biological resources/traditional knowledge still strictly requires prior National Biodiversity Authority (NBA) approval.',
    keywords: ['amendment 2023', 'biodiversity amendment act', 'ayush practitioner exemption', 'cultivated medicinal plants', 'codified traditional knowledge']
  },
  {
    chunk_id: 'CHUNK-TKDL-001',
    document_id: 'DOC-TKDL-GUIDELINES',
    title: 'CSIR-TKDL: Purpose, Prior Art Search & Defensive Protection',
    source: 'Council of Scientific & Industrial Research (CSIR) & Ministry of AYUSH',
    authority: 'CSIR-TKDL Unit',
    jurisdiction: 'India / International',
    document_type: 'Guidelines',
    section: 'Operational Framework',
    page: 2,
    paragraph: 'Para 1-4',
    language: 'English',
    publication_date: '2001-10-01',
    effective_date: '2001-10-01',
    topic: 'Traditional Knowledge',
    summary: 'TKDL bridges traditional Indian medicine (Charaka Samhita, Sushruta Samhita, Ashtanga Hridaya, etc.) and international patent examiners by transcribing classical formulations into English, German, French, Japanese, and Spanish with Traditional Knowledge Resource Classification (TKRC). Patent examiners at EPO, USPTO, JPO, and CGPDTM cite TKDL to reject invalid patent claims.',
    chunk_text: 'The Traditional Knowledge Digital Library (TKDL) contains over 400,000 formulations from classical texts of Ayurveda, Unani, Siddha, and Sowa-Rigpa translated into international patent classification language (TKRC). When an applicant files a patent for an Ayurvedic herb combination or extract, patent examiners cross-reference TKDL. If the composition or indication matches a classical citation, the patent is rejected for lack of novelty and as unpatentable traditional knowledge under Section 3(p).',
    keywords: ['tkdl', 'csir', 'charaka samhita', 'sushruta', 'traditional knowledge digital library', 'tkrc', 'prior art', 'epo', 'uspto']
  },
  {
    chunk_id: 'CHUNK-SCH-001',
    document_id: 'DOC-SCHEDULE-T-GMP',
    title: 'Schedule T (Drugs and Cosmetics Rules): Good Manufacturing Practices for ASU Drugs',
    source: 'Drugs and Cosmetics Rules, 1945',
    authority: 'Ministry of AYUSH / Central Drugs Standard Control Organization',
    jurisdiction: 'India',
    document_type: 'Rules',
    section: 'Schedule T — Part I & Part II',
    page: 1,
    paragraph: 'General Requirements',
    language: 'English',
    publication_date: '2000-06-23',
    effective_date: '2000-06-23',
    topic: 'Regulatory & GMP',
    chunk_text: 'Schedule T mandates that Ayurvedic, Siddha, and Unani (ASU) manufacturing premises shall be hygienically clean, free from cobwebs, dust, insects, and rodents. It specifies minimum space requirements for raw material stores, processing sections, packaging, and finished goods warehouse. It mandates an in-house or approved testing laboratory staffed by qualified chemists and botanists/pharmacognosists for batch identification, heavy metal testing (lead, cadmium, arsenic, mercury), microbial limits, and pesticide residue verification.',
    keywords: ['schedule t', 'gmp', 'good manufacturing practices', 'asu drugs', 'ayurvedic gmp', 'heavy metal testing', 'quality control', 'ayush license']
  },
  {
    chunk_id: 'CHUNK-TM-001',
    document_id: 'DOC-TRADE-MARKS-ACT-1999',
    title: 'Trade Marks Act, 1999 — Section 9 & 11: Absolute & Relative Grounds for Refusal',
    source: 'Gazette of India (Act No. 47 of 1999)',
    authority: 'Trade Marks Registry (CGPDTM)',
    jurisdiction: 'India',
    document_type: 'Act',
    section: 'Section 9(1) & Section 11',
    page: 8,
    paragraph: 'Sub-section (1)',
    language: 'English',
    publication_date: '1999-12-30',
    effective_date: '2003-09-15',
    topic: 'IPR',
    chunk_text: 'Section 9(1)(b) prohibits registration of trade marks which consist exclusively of marks or indications which serve in trade to designate the kind, quality, quantity, intended purpose, or geographical origin of the goods. In AYUSH commerce, botanical herb names (e.g. "Ashwagandha", "Triphala", "Neem", "Tulsi") or classical formulation names (e.g. "Chyawanprash") cannot be monopolized as trademarks. However, coined, arbitrary, or composite marks (e.g. combining a distinctive coined prefix with an herb reference) are eligible for registration in Class 5 (pharmaceuticals/herbal) or Class 3 (cosmetics).',
    keywords: ['trademark', 'trade marks act', 'section 9', 'descriptive mark', 'ashwagandha', 'generic term', 'class 5', 'coined mark']
  },
  {
    chunk_id: 'CHUNK-WIPO-001',
    document_id: 'DOC-WIPO-GRATK-2024',
    title: 'WIPO Treaty (2024): Mandatory Disclosure of Genetic Resources & Traditional Knowledge',
    source: 'WIPO Diplomatic Conference on Genetic Resources and Associated Traditional Knowledge',
    authority: 'World Intellectual Property Organization (WIPO)',
    jurisdiction: 'International / India',
    document_type: 'Treaty',
    section: 'Article 3: Disclosure Requirement',
    page: 4,
    paragraph: 'Article 3',
    language: 'English',
    publication_date: '2024-05-24',
    effective_date: '2024-05-24',
    topic: 'Traditional Knowledge',
    chunk_text: 'Under Article 3 of the 2024 WIPO Treaty, Contracting Parties shall require patent applicants whose inventions are materially or directly based on genetic resources to disclose the country of origin of the genetic resources. Where the invention is based on associated traditional knowledge, the applicant shall disclose the Indigenous Peoples or local community that provided the traditional knowledge. This treaty provides an international multilateral enforcement shield aligning with India\'s statutory Section 10(4) and Section 6 of the Biological Diversity Act.',
    keywords: ['wipo gratk', 'genetic resources', 'mandatory disclosure', 'treaty 2024', 'indigenous community', 'international patent']
  }
];
