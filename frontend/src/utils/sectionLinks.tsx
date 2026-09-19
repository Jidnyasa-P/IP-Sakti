import React from 'react';
import { ExternalLink } from 'lucide-react';

export interface StatutoryLinkInfo {
  section: string;
  documentTitle: string;
  authority: string;
  url: string;
  description: string;
}

/**
 * Registry of authoritative statutory sources and official gazettes/portals.
 *
 * CHANGED: every `indiankanoon.org/doc/<id>/` link in this file has been
 * removed. Those IDs were specific-looking but wrong -- e.g. the ID
 * previously attached to Section 3(p)/3(e)/3(d)/3(b) (all four subsections
 * pointed at the exact same ID, which was already a red flag) actually
 * resolves to "Tirupati vs Laxmanbhai", an unrelated 2010 Gujarat High
 * Court judgment with nothing to do with the Patents Act. IndianKanoon
 * mostly indexes case law, not clean per-section statute text, so guessing
 * a document ID for a bare section reference was never going to be
 * reliable -- confirmed wrong is worse than admittedly-general, for a
 * product whose whole value proposition is trustworthy citations.
 *
 * Replaced with:
 *   - Two links verified against a real search of india code.nic.in (the
 *     official Government of India statute repository) at the time of this
 *     fix: the Patents Act, 1970 full-text PDF, and the Biological
 *     Diversity Act, 2002 handle page.
 *   - Everywhere else, a link to the correct REGULATING AUTHORITY's
 *     homepage (ipindia.gov.in, ayush.gov.in, cdsco.gov.in, wipo.int,
 *     etc.) instead of a guessed deep link. Less convenient than a working
 *     direct link would be, but never confidently wrong.
 *
 * RECOMMENDED NEXT STEP (not done here -- needs access to the live
 * `Citation` objects your RAG API already returns, which this file's
 * plain-text regex matcher doesn't have): wire `StatutorySectionLink`
 * to open the app's existing `CitationModal` with the real, verified
 * excerpt/page/chunk_id your own ingested corpus retrieved for that
 * citation, instead of linking out to any third-party site at all. That's
 * the actually-robust fix -- this file's static registry is a stopgap that
 * only handles the ~20 sections listed below and can't reason about
 * anything the corpus doesn't have a hardcoded entry for.
 */
export const STATUTORY_REGISTRY: Record<string, StatutoryLinkInfo> = {
  // --- Indian Patents Act, 1970 ---
  // Verified: https://www.indiacode.nic.in/handle/123456789/1392 (Act ID 1970-39,
  // Ministry of Commerce and Industry) links to this PDF.
  'section 3(p)': {
    section: 'Section 3(p)',
    documentTitle: 'The Patents Act, 1970',
    authority: 'Office of the CGPDTM (IP India)',
    url: 'https://www.indiacode.nic.in/bitstream/123456789/1392/1/a197039.pdf',
    description: 'Statutory bar against patenting traditional knowledge or aggregation of known properties of traditional components.',
  },
  'section 3(e)': {
    section: 'Section 3(e)',
    documentTitle: 'The Patents Act, 1970',
    authority: 'Office of the CGPDTM (IP India)',
    url: 'https://www.indiacode.nic.in/bitstream/123456789/1392/1/a197039.pdf',
    description: 'Exclusion of substances obtained by mere admixture resulting only in aggregation of properties; demands synergistic bio-efficacy proof.',
  },
  'section 3(d)': {
    section: 'Section 3(d)',
    documentTitle: 'The Patents Act, 1970',
    authority: 'Office of the CGPDTM (IP India)',
    url: 'https://www.indiacode.nic.in/bitstream/123456789/1392/1/a197039.pdf',
    description: 'Mere discovery of new form or new property of known substance unless it demonstrates significantly enhanced therapeutic efficacy.',
  },
  'section 3(b)': {
    section: 'Section 3(b)',
    documentTitle: 'The Patents Act, 1970',
    authority: 'Office of the CGPDTM (IP India)',
    url: 'https://www.indiacode.nic.in/bitstream/123456789/1392/1/a197039.pdf',
    description: 'Inventions contrary to public order or morality or causing serious prejudice to human, animal or plant life.',
  },
  'section 10(4)': {
    section: 'Section 10(4)(d)(ii)',
    documentTitle: 'The Patents Act, 1970',
    authority: 'Office of the CGPDTM (IP India)',
    url: 'https://www.indiacode.nic.in/bitstream/123456789/1392/1/a197039.pdf',
    description: 'Mandatory disclosure of source and geographical origin of biological material utilized in the invention.',
  },
  'section 10(4)(d)(ii)': {
    section: 'Section 10(4)(d)(ii)',
    documentTitle: 'The Patents Act, 1970',
    authority: 'Office of the CGPDTM (IP India)',
    url: 'https://www.indiacode.nic.in/bitstream/123456789/1392/1/a197039.pdf',
    description: 'Mandatory statutory disclosure of source and geographical origin of biological materials.',
  },
  'section 25': {
    section: 'Section 25',
    documentTitle: 'The Patents Act, 1970',
    authority: 'Office of the CGPDTM (IP India)',
    url: 'https://www.indiacode.nic.in/bitstream/123456789/1392/1/a197039.pdf',
    description: 'Pre-grant and post-grant opposition grounds including non-disclosure of geographical origin and traditional knowledge anticipation.',
  },
  'section 39': {
    section: 'Section 39',
    documentTitle: 'The Patents Act, 1970',
    authority: 'Office of the CGPDTM (IP India)',
    url: 'https://www.indiacode.nic.in/bitstream/123456789/1392/1/a197039.pdf',
    description: 'Prohibition on Indian residents applying for patents outside India without prior written permit from the Controller (Foreign Filing License).',
  },
  'section 64': {
    section: 'Section 64',
    documentTitle: 'The Patents Act, 1970',
    authority: 'Office of the CGPDTM (IP India)',
    url: 'https://www.indiacode.nic.in/bitstream/123456789/1392/1/a197039.pdf',
    description: 'Revocation of patents on grounds of wrongful disclosure or violation of Section 3(p) / traditional knowledge.',
  },

  // --- Biological Diversity Act, 2002 & 2023 Amendment ---
  // Verified: https://www.indiacode.nic.in/handle/123456789/2046 (Act ID
  // 200318, Ministry of Environment, Forest and Climate Change -- the
  // CENTRAL act; india code also has several unrelated STATE-level
  // biodiversity rules under the same short title, don't confuse them).
  'section 6': {
    section: 'Section 6',
    documentTitle: 'The Biological Diversity Act, 2002',
    authority: 'National Biodiversity Authority (NBA)',
    url: 'https://www.indiacode.nic.in/handle/123456789/2046',
    description: 'Mandatory prior approval of NBA before applying for IPR in or outside India based on Indian biological resources.',
  },
  'section 6(1)': {
    section: 'Section 6(1)',
    documentTitle: 'The Biological Diversity Act, 2002',
    authority: 'National Biodiversity Authority (NBA)',
    url: 'https://www.indiacode.nic.in/handle/123456789/2046',
    description: 'Prior approval of the National Biodiversity Authority before filing IPR based on Indian biological resources.',
  },
  'section 6(1a)': {
    section: 'Section 6(1A)',
    documentTitle: 'Biological Diversity (Amendment) Act, 2023',
    authority: 'National Biodiversity Authority (NBA)',
    url: 'https://www.indiacode.nic.in/handle/123456789/2046',
    description: 'Provisions governing approval timeline before patent grant for Indian applicants.',
  },
  'section 3': {
    section: 'Section 3',
    documentTitle: 'The Biological Diversity Act, 2002',
    authority: 'National Biodiversity Authority (NBA)',
    url: 'https://www.indiacode.nic.in/handle/123456789/2046',
    description: 'Certain persons not to undertake biodiversity-related activities without approval of National Biodiversity Authority.',
  },
  'section 7': {
    section: 'Section 7',
    documentTitle: 'The Biological Diversity Act, 2002',
    authority: 'National Biodiversity Authority & State Biodiversity Boards',
    url: 'https://www.indiacode.nic.in/handle/123456789/2046',
    description: 'Prior intimation to State Biodiversity Board for obtaining biological resources for commercial utilization.',
  },
  'section 55': {
    section: 'Section 55',
    documentTitle: 'The Biological Diversity Act, 2002',
    authority: 'National Biodiversity Authority (NBA)',
    url: 'https://www.indiacode.nic.in/handle/123456789/2046',
    description: 'Penalties and enforcement for contravention of Section 3, Section 4, or Section 6.',
  },
  'form iii': {
    section: 'NBA Form III',
    documentTitle: 'National Biodiversity Authority Rules, 2004',
    authority: 'National Biodiversity Authority (NBA)',
    url: 'http://nbaindia.org/content/26/28/1/form3.html',
    description: 'Official statutory application form to apply for IPR based on biological resources/knowledge.',
  },
  'form 3': {
    section: 'NBA Form III',
    documentTitle: 'National Biodiversity Authority Rules, 2004',
    authority: 'National Biodiversity Authority (NBA)',
    url: 'http://nbaindia.org/content/26/28/1/form3.html',
    description: 'Application for approval of NBA for obtaining intellectual property rights.',
  },

  // --- AYUSH Regulations & Drugs and Cosmetics (already safe -- ministry
  //     homepages, not a guessed deep link -- unchanged) ---
  'schedule t': {
    section: 'Schedule T (GMP)',
    documentTitle: 'Drugs and Cosmetics Rules, 1945',
    authority: 'Ministry of AYUSH, Government of India',
    url: 'https://ayush.gov.in',
    description: 'Good Manufacturing Practices (GMP) factory hygiene, equipment, testing, and quality control requirements for ASU drugs.',
  },
  'rule 158-b': {
    section: 'Rule 158-B',
    documentTitle: 'Drugs and Cosmetics Rules, 1945',
    authority: 'Ministry of AYUSH & State Licensing Authorities',
    url: 'https://ayush.gov.in',
    description: 'Statutory evidence requirements for safety and efficacy for issuance of ASU manufacturing licenses.',
  },
  'section 3(a)': {
    section: 'Section 3(a)',
    documentTitle: 'Drugs and Cosmetics Act, 1940',
    authority: 'Ministry of Health & Family Welfare / Ministry of AYUSH',
    url: 'https://cdsco.gov.in',
    description: 'Statutory definition and categorization of Ayurvedic, Siddha or Unani drugs.',
  },

  // --- Trade Marks Act, 1999 ---
  // No verified per-section or per-Act india code link found -- linking to
  // the Trade Marks Registry's own homepage instead of guessing one.
  'section 9': {
    section: 'Section 9',
    documentTitle: 'The Trade Marks Act, 1999',
    authority: 'Trade Marks Registry (CGPDTM)',
    url: 'https://ipindia.gov.in',
    description: 'Absolute grounds for refusal of registration, prohibiting generic and descriptive herbal designations.',
  },
  'section 9(1)(b)': {
    section: 'Section 9(1)(b)',
    documentTitle: 'The Trade Marks Act, 1999',
    authority: 'Trade Marks Registry (CGPDTM)',
    url: 'https://ipindia.gov.in',
    description: 'Exclusion of marks consisting exclusively of indications of kind, quality, or intended purpose of goods.',
  },
  'section 13': {
    section: 'Section 13',
    documentTitle: 'The Trade Marks Act, 1999',
    authority: 'Trade Marks Registry (CGPDTM)',
    url: 'https://ipindia.gov.in',
    description: 'Prohibition of registration of names of chemical elements or international non-proprietary names / classical formulations.',
  },

  // --- Treaties & International Conventions (already safe -- unchanged) ---
  'wipo gratk': {
    section: 'WIPO GRATK Treaty (2024)',
    documentTitle: 'WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge',
    authority: 'World Intellectual Property Organization (WIPO)',
    url: 'https://www.wipo.int/treaties/en/ip/gratk/',
    description: 'Mandatory international patent disclosure requirement for inventions based on genetic resources and associated traditional knowledge.',
  },
  'nagoya protocol': {
    section: 'Nagoya Protocol on ABS',
    documentTitle: 'Convention on Biological Diversity (CBD)',
    authority: 'Secretariat of the Convention on Biological Diversity',
    url: 'https://www.cbd.int/abs/text/',
    description: 'International agreement on Access to Genetic Resources and the Fair and Equitable Sharing of Benefits Arising from their Utilization.',
  },
  'patent cooperation treaty': {
    section: 'Patent Cooperation Treaty (PCT)',
    documentTitle: 'WIPO Patent Cooperation Treaty',
    authority: 'WIPO',
    url: 'https://www.wipo.int/pct/en/',
    description: 'Unified patent filing procedure to protect inventions simultaneously across over 155 contracting countries.',
  },
  'tkdl': {
    section: 'CSIR-TKDL Guidelines',
    documentTitle: 'Traditional Knowledge Digital Library Access Protocols',
    authority: 'CSIR & Ministry of AYUSH',
    url: 'https://www.tkdl.res.in',
    description: 'Codified digital repository of Indian traditional formulations protecting against biopiracy internationally.',
  },
  'ayurveda aahar': {
    section: 'Ayurveda Aahar Regulations, 2022',
    documentTitle: 'Food Safety and Standards (Ayurveda Aahar) Regulations, 2022',
    authority: 'FSSAI & Ministry of AYUSH',
    url: 'https://fssai.gov.in',
    description: 'Regulatory standards for foods prepared in accordance with classical Ayurvedic authorative recipes.',
  },
};

/**
 * Resolves a section or document reference to authoritative metadata and verified link
 */
export function getSectionLink(sectionOrDoc: string, documentId?: string): StatutoryLinkInfo {
  const normalized = (sectionOrDoc || '').toLowerCase().trim();

  // 1. Direct match in registry
  for (const key of Object.keys(STATUTORY_REGISTRY)) {
    if (normalized.includes(key)) {
      return STATUTORY_REGISTRY[key];
    }
  }

  // 2. Check by documentId if provided
  if (documentId) {
    if (documentId.includes('PATENTS')) {
      return {
        section: sectionOrDoc || 'The Patents Act, 1970',
        documentTitle: 'The Patents Act, 1970',
        authority: 'Office of the CGPDTM (IP India)',
        url: 'https://www.indiacode.nic.in/bitstream/123456789/1392/1/a197039.pdf',
        description: 'Primary Indian patent statute and patentability guidelines.',
      };
    }
    if (documentId.includes('BIOLOGICAL') || documentId.includes('NBA') || documentId.includes('BD')) {
      return {
        section: sectionOrDoc || 'Biological Diversity Act, 2002',
        documentTitle: 'The Biological Diversity Act, 2002 & 2023 Amendment',
        authority: 'National Biodiversity Authority (NBA)',
        url: 'https://www.indiacode.nic.in/handle/123456789/2046',
        description: 'National Biodiversity Authority biological resource access and IPR approval framework.',
      };
    }
    if (documentId.includes('TKDL')) {
      return {
        section: sectionOrDoc || 'CSIR-TKDL Guidelines',
        documentTitle: 'Traditional Knowledge Digital Library Access Protocols',
        authority: 'CSIR & Ministry of AYUSH',
        url: 'https://www.tkdl.res.in',
        description: 'Codified Ayurvedic, Unani and Siddha prior art database.',
      };
    }
    if (documentId.includes('SCHEDULE-T') || documentId.includes('AYUSH')) {
      return {
        section: sectionOrDoc || 'Schedule T / AYUSH Rules',
        documentTitle: 'Drugs and Cosmetics Rules & AYUSH Guidelines',
        authority: 'Ministry of AYUSH',
        url: 'https://ayush.gov.in',
        description: 'Good Manufacturing Practices and licensing criteria for ASU drugs.',
      };
    }
    if (documentId.includes('WIPO') || documentId.includes('TREATY')) {
      return {
        section: sectionOrDoc || 'WIPO International Treaties',
        documentTitle: 'WIPO GRATK Treaty & PCT Regulations',
        authority: 'World Intellectual Property Organization',
        url: 'https://www.wipo.int/treaties/en/ip/gratk/',
        description: 'International IP treaties covering genetic resources and traditional knowledge.',
      };
    }
    if (documentId.includes('TRADE-MARKS')) {
      return {
        section: sectionOrDoc || 'The Trade Marks Act, 1999',
        documentTitle: 'The Trade Marks Act, 1999 & Rules, 2017',
        authority: 'Trade Marks Registry (CGPDTM)',
        url: 'https://ipindia.gov.in',
        description: 'Statutory provisions governing trademark registration and exclusions.',
      };
    }
  }

  // 3. Fallback for general references
  if (normalized.includes('patent') || normalized.includes('cgpdtm') || normalized.includes('ip india')) {
    return {
      section: sectionOrDoc || 'The Patents Act, 1970',
      documentTitle: 'The Patents Act, 1970',
      authority: 'Office of the CGPDTM (IP India)',
      url: 'https://www.indiacode.nic.in/bitstream/123456789/1392/1/a197039.pdf',
      description: 'Official Indian Patents Act reference portal.',
    };
  }

  if (normalized.includes('biodiversity') || normalized.includes('nba') || normalized.includes('abs')) {
    return {
      section: sectionOrDoc || 'Biological Diversity Act, 2002',
      documentTitle: 'The Biological Diversity Act, 2002',
      authority: 'National Biodiversity Authority (NBA)',
      url: 'https://www.indiacode.nic.in/handle/123456789/2046',
      description: 'Official National Biodiversity Authority reference portal.',
    };
  }

  if (normalized.includes('ayush') || normalized.includes('asu') || normalized.includes('gmp')) {
    return {
      section: sectionOrDoc || 'Ministry of AYUSH Guidelines',
      documentTitle: 'Ministry of AYUSH Statutory Directives',
      authority: 'Ministry of AYUSH, Government of India',
      url: 'https://ayush.gov.in',
      description: 'Official Ministry of AYUSH portal.',
    };
  }

  // Final fallback: India Code's own homepage (the correct central-government
  // statute repository) rather than any single Act's page, since we don't
  // know what this reference actually is.
  return {
    section: sectionOrDoc || 'Statutory Provision',
    documentTitle: 'India Code -- Government of India Digital Repository of Central & State Acts',
    authority: 'Government of India / Legislative Department',
    url: 'https://www.indiacode.nic.in',
    description: 'Official Government of India repository of central and state legislation.',
  };
}

/**
 * Clickable statutory section badge/link component
 */
export const StatutorySectionLink: React.FC<{
  sectionText: string;
  className?: string;
  showIcon?: boolean;
}> = ({ sectionText, className = '', showIcon = true }) => {
  const linkInfo = getSectionLink(sectionText);

  return (
    <a
      href={linkInfo.url}
      target="_blank"
      rel="noreferrer noopener"
      title={`${linkInfo.section} (${linkInfo.documentTitle}) — ${linkInfo.authority}: ${linkInfo.description}\nClick to open official cited portal.`}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 font-medium text-emerald-800 hover:text-emerald-950 underline decoration-emerald-400 hover:decoration-emerald-700 underline-offset-2 transition-colors cursor-pointer ${className}`}
    >
      <span>{sectionText}</span>
      {showIcon && <ExternalLink className="w-3 h-3 inline-block shrink-0 opacity-80" />}
    </a>
  );
};

// Regex to capture statutory sections in text
const SECTION_REGEX = /\b(Section\s+\d+(?:\([a-zA-Z0-9]+\))*(?:\([a-zA-Z0-9]+\))*|Rule\s+\d+(?:-[a-zA-Z0-9]+)*|Schedule\s+[A-Z]|Form\s+(?:III|3|27|TM-A)|Nagoya\s+Protocol|WIPO\s+GRATK(?:(?:\s+Treaty)?)|TKDL)\b/gi;

/**
 * Helper to transform standard text paragraphs into rich text with live statutory links
 */
export function renderTextWithSectionLinks(text: string): React.ReactNode {
  if (!text) return text;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(SECTION_REGEX);

  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = regex.lastIndex;
    const matchedText = match[0];

    // Push preceding plain text
    if (matchStart > lastIndex) {
      parts.push(text.substring(lastIndex, matchStart));
    }

    // Push clickable statutory link
    parts.push(
      <StatutorySectionLink
        key={`${matchStart}-${matchedText}`}
        sectionText={matchedText}
      />
    );

    lastIndex = matchEnd;
  }

  // Push remainder
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
