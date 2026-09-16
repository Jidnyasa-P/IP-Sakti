import { LowConfidenceQuery } from '../types';

export const INITIAL_LOW_CONFIDENCE_QUERIES: LowConfidenceQuery[] = [
  {
    id: 'lc-query-001',
    conversation_id: 'conv-practitioner-trikatu',
    inquirer_name: 'Vaidya Radhika Sen',
    inquirer_role: 'Practitioner',
    inquirer_organization: 'AyurMed Chikitsalaya & Research, Pune',
    topic: 'Section 3(p) Patentability: Trikatu Fortified with 95% Pure Piperine Nanocrystals',
    query: 'We have prepared an Ayurvedic formulation combining classical Trikatu (Sunthi, Maricha, Pippali) with an ultra-pure (95%) piperine nanocrystal fraction to enhance oral bioavailability 4-fold. Can we obtain an Indian product patent for this enhanced formulation, or will the patent examiner reject it under Section 3(p) as traditional knowledge aggregation?',
    created_at: new Date(Date.now() - 14400000).toISOString(),
    jurisdiction: 'india',
    ai_response: {
      content: 'Under Section 3(p) of the Patents Act, 1970, an invention that is traditionally known or an aggregation/duplication of known properties is strictly non-patentable. Classical Ayurvedic treatises (Charaka Samhita, Bhavaprakasha) already document Trikatu and its individual constituents as Yogavahi (bioavailability enhancers). While isolating piperine into nanocrystals may exhibit enhanced pharmacokinetic bioavailability, Controller General decisions have repeatedly rejected similar claims where the enhanced effect is merely attributed to known properties of Pippali and Maricha. To overcome Section 3(p) and Section 3(d), empirical comparative data demonstrating a new therapeutic efficacy profile—rather than simply increased absorption—is required, but legal standards for AYUSH nanoparticles remain contentious.',
      relevant_considerations: [
        'Section 3(p) bar: CSIR-TKDL prior art citation risk for classical Trikatu formulations.',
        'Section 3(d) requirement: Enhanced bioavailability alone does not automatically equate to enhanced therapeutic efficacy under Novartis AG v. Union of India.',
        'Section 3(e) admixture hurdle: Synergy index data must show interaction beyond expected addition of individual herbs.'
      ],
      recommended_next_steps: [
        'Perform comparative in-vivo clinical/anti-inflammatory assays comparing nanocrystals with crude extract.',
        'Consider claiming the specific novel nanotechnology method of manufacturing rather than the composition.',
        'Register a distinctive proprietary trademark under Class 5.'
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
          excerpt: 'Section 3(p) establishes an absolute statutory bar against patenting an invention which in effect is traditional knowledge or which is an aggregation or duplication of known properties of traditionally known component or components.'
        },
        {
          index: 2,
          chunk_id: 'CHUNK-PAT-002',
          document_id: 'DOC-PATENTS-ACT-1970',
          title: 'The Patents Act, 1970 — Section 3(e)',
          authority: 'Office of the CGPDTM',
          section: 'Section 3(e)',
          source: 'Official Gazette of India',
          excerpt: 'Section 3(e) prohibits patenting substances obtained by a mere admixture resulting only in aggregation of the properties of the components thereof.'
        },
        {
          index: 3,
          chunk_id: 'CHUNK-TKDL-001',
          document_id: 'DOC-TKDL-GUIDELINES',
          title: 'TKDL Examination Guidelines for Patent Examiners',
          authority: 'CSIR-TKDL / CGPDTM',
          section: 'Clause 4.2: Classical Bio-enhancers & Yogavahi Herbs',
          source: 'Ministry of Commerce & Industry Guidelines',
          excerpt: 'Formulations incorporating known Yogavahi herbs (Pippali, Maricha, Sunthi) must demonstrate unexpected synergy over traditional dosages cited in classical Ayurvedic texts.'
        }
      ],
      confidence: {
        level: 'Low',
        score: 0.52,
        reasons: [
          'Conflicting Controller decisions regarding whether isolating natural bio-enhancers overcomes Section 3(p)',
          'Novartis v. UOI precedent limits mere pharmacokinetic bioavailability under Section 3(d)',
          'Requires human bio-patent legal advisor assessment to structure composition vs process claims'
        ]
      }
    },
    status: 'pending_review'
  },
  {
    id: 'lc-query-002',
    conversation_id: 'conv-researcher-gymnema',
    inquirer_name: 'Dr. Vikramaditya Joshi',
    inquirer_role: 'Researcher',
    inquirer_organization: 'Centre for Ethnobotanical Phytochemistry, Bangalore',
    topic: 'Foreign PCT Filing & Section 6 NBA Prerequisite with Foreign Co-Applicant',
    query: 'Our research institute partnered with a German university to patent a novel isolated bioactive peptide from wild Gymnema sylvestre (Gurmar) collected in Karnataka forests. We plan to file a PCT international patent application first naming both institutions. Does Section 6(1) of the Biological Diversity Act require National Biodiversity Authority approval BEFORE the international filing, or only before grant?',
    created_at: new Date(Date.now() - 28800000).toISOString(),
    jurisdiction: 'india',
    ai_response: {
      content: 'Under Section 6(1) of the Biological Diversity Act, 2002, no person shall apply for any intellectual property right by whatever name called in or outside India for any invention based on any biological resource obtained from India without obtaining the previous approval of the National Biodiversity Authority. While the Biological Diversity (Amendment) Act, 2023 introduced Section 6(1A) allowing Indian applicants to apply for IPR and seek NBA approval before the grant of the patent, Section 3 of the Act strictly applies to foreign entities and collaborative research where foreign nationals/institutions are co-applicants. In cases with foreign co-applicants, filing an international PCT application prior to securing Section 3 approval or NBA Form III clearance poses severe penal risks under Section 55.',
      relevant_considerations: [
        'Section 6(1) vs 6(1A) Biological Diversity Act: Timing of NBA approval before filing vs before grant.',
        'Section 3 mandate: Mandatory prior approval for foreign entities or foreign collaborative partners.',
        'Section 39 Patents Act: Foreign filing license (FFL) requirement if filing outside India without filing in India first.'
      ],
      recommended_next_steps: [
        'File an Indian provisional patent application first to establish priority date without violating Section 39.',
        'Simultaneously submit NBA Form III (for IPR grant approval) and Form I (if foreign entity is transferring biological material).',
        'Request expedited written permission from CGPDTM under Section 39 before PCT filing.'
      ],
      citations: [
        {
          index: 1,
          chunk_id: 'CHUNK-BD-001',
          document_id: 'DOC-BIOLOGICAL-DIVERSITY-ACT-2002',
          title: 'Biological Diversity Act, 2002 — Section 6(1)',
          authority: 'National Biodiversity Authority (NBA)',
          section: 'Section 6(1) & 6(1A)',
          source: 'Gazette of India',
          excerpt: 'No person shall apply for any intellectual property right, by whatever name called, in or outside India for any invention based on any biological resource obtained from India without previous approval of the National Biodiversity Authority.'
        },
        {
          index: 2,
          chunk_id: 'CHUNK-BD-002',
          document_id: 'DOC-BIOLOGICAL-DIVERSITY-ACT-2002',
          title: 'Biological Diversity Act, 2002 — Section 3',
          authority: 'National Biodiversity Authority (NBA)',
          section: 'Section 3: Approval for Non-Citizens & Foreign Entities',
          source: 'Gazette of India',
          excerpt: 'No person who is not a citizen of India, or a body corporate not incorporated in India, shall obtain any biological resource occurring in India for research or commercial utilization without approval of NBA.'
        },
        {
          index: 3,
          chunk_id: 'CHUNK-PAT-005',
          document_id: 'DOC-PATENTS-ACT-1970',
          title: 'The Patents Act, 1970 — Section 39',
          authority: 'Office of the CGPDTM',
          section: 'Section 39: Residents not to apply for patents outside India without prior permission',
          source: 'Official Gazette of India',
          excerpt: 'No person resident in India shall apply for the grant of a patent for an invention outside India without written permit from the Controller unless an application in India has been filed six weeks prior.'
        }
      ],
      confidence: {
        level: 'Low',
        score: 0.56,
        reasons: [
          'High Court precedents diverge on international PCT filing jurisdiction prior to formal NBA grant approval',
          'Interplay between BDA 2023 Amendment and Section 39 Patents Act requires seasoned bio-patent attorney review',
          'Risk of severe Section 55 penalties necessitates customized filing sequence roadmap'
        ]
      }
    },
    status: 'pending_review'
  },
  {
    id: 'lc-query-003',
    conversation_id: 'conv-org-asava',
    inquirer_name: 'Himalayan Bio-Wellness Private Limited',
    inquirer_role: 'Organization',
    inquirer_organization: 'AYUSH GMP Certified Manufacturer, Dehradun',
    topic: 'Closed-Loop Bioreactor Process for Classical Asava/Arishta Fermentation',
    query: 'We developed an automated closed-loop stainless steel bioreactor with automated temperature and CO2 regulation for traditional Asava and Arishta fermentation using Woodfordia fruticosa (Dhataki) flowers. Can we file a patent claim for the fermentation process parameters, or will it be rejected under Section 3(p) as traditional fermentation?',
    created_at: new Date(Date.now() - 43200000).toISOString(),
    jurisdiction: 'india',
    ai_response: {
      content: 'Under Section 3(p) of the Patents Act, 1970, classical fermentation methods like Sandhana Kalpana recorded in the Ayurvedic Pharmacopoeia of India cannot be patented in themselves. However, novel apparatus hardware (the automated bioreactor container, sensor array) and specific novel operational control steps that are distinct from open earthen-pot fermentation can be patentable if claimed properly. The difficulty lies in drafting process claims: if the claims specify fermentation of herbal sugars into self-generated alcohol, the examiner will cite Section 3(p) and Section 3(b). The patent specification must strictly decouple the technological engineering innovation from the classical microbiological transformation.',
      relevant_considerations: [
        'Section 3(p) bar against traditional Sandhana Kalpana fermentation protocols.',
        'Patents Act Section 2(1)(j): Inventive step in bioreactor automation and sensor-based aeration/temperature feedback.',
        'Schedule T GMP compliance alignment: Demonstrating improved batch-to-batch repeatability and safety.'
      ],
      recommended_next_steps: [
        'Focus independent claims strictly on the automated bioreactor apparatus and physical sensor-driven feedback system.',
        'File dependent claims on process parameters (dissolved oxygen, thermal gradients) without claiming the biological formulation.',
        'Obtain Industrial Design registration for the bioreactor chassis under the Designs Act, 2000.'
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
          excerpt: 'Section 3(p) bars inventions which in effect are traditional knowledge or aggregation of known properties of traditionally known components.'
        },
        {
          index: 2,
          chunk_id: 'CHUNK-GMP-001',
          document_id: 'DOC-DRUGS-COSMETICS-ACT-1940',
          title: 'Drugs and Cosmetics Rules, 1945 — Schedule T',
          authority: 'Ministry of Ayush / CDSCO',
          section: 'Good Manufacturing Practices for Ayurvedic, Siddha and Unani Medicines',
          source: 'Official Gazette of India',
          excerpt: 'Schedule T prescribes mandatory manufacturing conditions, clean room requirements, and quality validation for fermentation (Asava-Arishta) manufacturing units.'
        }
      ],
      confidence: {
        level: 'Low',
        score: 0.61,
        reasons: [
          'Delicate boundary between classical Sandhana Kalpana prior art and novel automated hardware claims',
          'Examination guidelines require expert legal structuring to decouple device hardware from biological broth',
          'Requires legal advisor review of draft patent claims'
        ]
      }
    },
    status: 'pending_review'
  },
  {
    id: 'lc-query-004',
    conversation_id: 'conv-practitioner-taila',
    inquirer_name: 'Vaidya Suresh Deshmukh',
    inquirer_role: 'Practitioner',
    inquirer_organization: 'Deshmukh Ayurveda Chikitsalaya, Nagpur',
    topic: 'Trade Mark Registration for Classical Formulation Name with Suffix',
    query: 'I want to register "Maha Narayana Taila Ultra-Relief" under Class 5 to prevent other clinics in my district from using the Narayana Taila name. Will the Trademark Registry grant exclusive rights to "Maha Narayana"?',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    jurisdiction: 'india',
    ai_response: {
      content: 'Under Section 9(1)(b) of the Trade Marks Act, 1999, marks consisting exclusively of designations that serve in trade to indicate the kind, quality, or intended purpose are non-registrable. "Maha Narayana Taila" is a classical Ayurvedic formulation name codified in the Ayurvedic Formulary of India (AFI). Under Section 13 of the Trade Marks Act, names of declared Ayurvedic drugs cannot be monopolized. The Trademark Registry will issue an examination report requiring a disclaimer of exclusive rights to the words "Maha Narayana Taila".',
      relevant_considerations: [
        'Trade Marks Act Section 13: Prohibition of registration of names of single Ayurvedic chemical/herbal drugs codified in pharmacopoeias.',
        'Trade Marks Act Section 9(1)(b): Descriptiveness objection for classical names.',
        'Right to practice: Other AYUSH practitioners cannot be restrained from selling classical Maha Narayana Taila.'
      ],
      recommended_next_steps: [
        'Coin a distinctive brand name (e.g., DESHMUKH\'S AYUR-RELIEF) with Maha Narayana Taila listed descriptively.',
        'File Form TM-A with an explicit voluntary disclaimer on classical words.'
      ],
      citations: [
        {
          index: 1,
          chunk_id: 'CHUNK-TM-001',
          document_id: 'DOC-TRADE-MARKS-ACT-1999',
          title: 'The Trade Marks Act, 1999 — Section 9 & 13',
          authority: 'Trade Marks Registry (TMR / CGPDTM)',
          section: 'Section 13: Prohibition of registration of names of chemical elements or international non-proprietary names',
          source: 'Trade Marks Journal',
          excerpt: 'No word which is the commonly used and accepted name of any single chemical element or single chemical compound or Ayurvedic text formulation name shall be registered as a trade mark.'
        }
      ],
      confidence: {
        level: 'Low',
        score: 0.64,
        reasons: [
          'High likelihood of Section 9 and Section 13 objections on classical text terms',
          'Nuance between device mark with disclaimer vs word mark refusal'
        ]
      }
    },
    status: 'resolved',
    expert_review: {
      expert_id: 'user-expert-aarav',
      expert_name: 'Dr. Aarav Sharma',
      expert_title: 'Bio-Patent Attorney & Legal Advisor (Bar Council D/1842/2012)',
      reviewed_at: new Date(Date.now() - 72000000).toISOString(),
      legal_opinion: 'Under Section 13 and Section 9(1)(b) of the Trade Marks Act, 1999, "Maha Narayana Taila" is a publici juris classical formulation name codified in Part I (8:36) of the Ayurvedic Formulary of India (AFI). No enterprise or clinician can monopolize this generic Ayurvedic designation. Any attempt to file a word mark for "Maha Narayana Taila" will face immediate statutory rejection under Section 13. However, you can protect your goodwill by creating a composite brand mark (e.g. "DESHMUKH’S ORO-RELIEF") featuring a unique logo and packaging trade dress, while mentioning "Maha Narayana Taila" as the generic product descriptor with a voluntary disclaimer in Form TM-A.',
      statutory_clauses: [
        'Trade Marks Act, 1999 — Section 13 (Prohibition of registration of codified public domain formulation names)',
        'Trade Marks Act, 1999 — Section 9(1)(b) & 9(1)(c) (Absolute grounds for refusal: descriptive and customary trade terms)',
        'Drugs and Cosmetics Act, 1940 — Section 3(a) (Statutory definition of classical Ayurvedic formulation)'
      ],
      actionable_guidance: [
        'Do NOT file a trademark claiming exclusive rights to "Maha Narayana Taila"; the Trade Marks Registry will issue a refusal notice.',
        'File Form TM-A under Class 5 for a coined house mark (e.g. "DESHMUKH\'S AYUR-RELIEF") with a distinctive visual device/logo.',
        'Include an explicit statement in the application: "No exclusive right is claimed to the words Maha Narayana Taila separately."',
        'Ensure Schedule T batch records and AYUSH drug license accurately reference the AFI classical formula.'
      ],
      assessment: 'Alternative IP Pathway'
    }
  }
];
