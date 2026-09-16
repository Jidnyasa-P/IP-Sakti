// Validation utility to ensure queries submitted to IP-SAKTI Sahayak fall within
// Ayurveda, AYUSH, Traditional Knowledge, Intellectual Property, Patents, Biodiversity, and Regulatory Research.

export interface QueryRelevanceResult {
  isRelevant: boolean;
  reason?: string;
  matchedDomain?: string;
}

// Positive indicators: If a query contains ANY of these domain patterns, it is relevant.
const DOMAIN_RELEVANCE_PATTERNS: { regex: RegExp; domain: string }[] = [
  // 1. AYUSH & Traditional Medicine Systems
  {
    regex: /\b(ayush|ayurveda|ayurvedic|siddha|unani|sowa[\s-]*rigpa|homeopath(y|ic)|naturopath(y|ic))\b/i,
    domain: 'AYUSH & Traditional Medicine'
  },
  {
    regex: /\b(herbal|herb|botanical|phytochemical|plant|medicinal|flora|fauna|extract|decoction|polyherbal|formulation|tincture|pharmacognosy|ethnopharmacology)\b/i,
    domain: 'Medicinal & Botanical Formulations'
  },
  {
    regex: /\b(ashwagandha|turmeric|haldi|curcuma|neem|tulsi|brahmi|shatavari|triphala|guggulu|amla|giloy|guduchi|sarpagandha|shankhpushpi|withania|azadirachta|ocimum|bacopa|tinospora|emblica|terminalia|commiphora)\b/i,
    domain: 'Medicinal Plants & Herbs'
  },
  {
    regex: /\b(rasayana|bhasma|asava|arishta|taila|churna|churnam|ghrita|gutika|vati|kashayam|lehyam|nighantu|charaka|sushruta|vagbhata|bhavaprakasha|sharngadhara|ashtanga\s*hridaya)\b/i,
    domain: 'Classical AYUSH Formulations & Treatises'
  },
  {
    regex: /\b(api|ayurvedic\s*pharmacopoeia|pharmacopoeia|unani\s*pharmacopoeia|siddha\s*pharmacopoeia)\b/i,
    domain: 'Pharmacopoeial Standards'
  },

  // 2. Traditional Knowledge & TKDL
  {
    regex: /\b(traditional\s*knowledge|tkdl|csir[\s-]tkdl|csir|indigenous\s*knowledge|folklore|prior\s*art|bio[\s-]*piracy|biopiracy|defensive\s*protection|misappropriation)\b/i,
    domain: 'Traditional Knowledge & TKDL'
  },

  // 3. Intellectual Property, Patents, Trademarks, Copyrights & Designs
  {
    regex: /\b(patent|patents|patented|patenting|patentability|patentable|inventive\s*step|novelty|non[\s-]obvious(ness)?|prior\s*art|claim|claims|prosecution|infringement|revocation|opposition|compulsory\s*licens(e|ing)|patent\s*cooperation\s*treaty|pct)\b/i,
    domain: 'Patents & Patentability'
  },
  {
    regex: /\b(intellectual\s*property|ipr|ip\s*rights|wipo|cgpdtm|inpass|uspto|epo|jpo|ukipo|cipo|patent\s*office)\b/i,
    domain: 'Intellectual Property Systems'
  },
  {
    regex: /\b(trademark|trademarks|trade\s*mark|brand\s*name|class\s*5|class\s*3|trade\s*secret|trade\s*secrets|copyright|copyrights|industrial\s*design|designs\s*act|geographical\s*indication|gi\s*tag|gi\s*registry)\b/i,
    domain: 'Trademarks, Designs, GI & IP Assets'
  },
  {
    regex: /\b(section\s*3\s*\(\s*[a-p]\s*\)|3\s*\(\s*[a-p]\s*\)|section\s*3[a-p]|mere\s*admixture|combination\s*index|synerg(y|istic)|therapeutic\s*efficacy|section\s*6|section\s*10|form\s*iii|form\s*3|form\s*1|form\s*i)\b/i,
    domain: 'Statutory Sections & Patent Provisions'
  },

  // 4. Biodiversity, Biological Resources & Access and Benefit Sharing (ABS)
  {
    regex: /\b(biodiversity|biological\s*resources?|biological\s*diversity|nba|national\s*biodiversity\s*authority|sbb|state\s*biodiversity\s*board|bmc|biodiversity\s*management\s*committee|abs|access\s*and\s*benefit\s*sharing|benefit[\s-]sharing|nagoya\s*protocol|cbd|convention\s*on\s*biological\s*diversity|prior\s*informed\s*consent|pic|mutually\s*agreed\s*terms|mat)\b/i,
    domain: 'Biodiversity & ABS Compliance'
  },

  // 5. Regulatory Compliance, Good Manufacturing Practices & Drug Laws
  {
    regex: /\b(schedule\s*t|gmp|good\s*manufacturing\s*practices?|quality\s*control|analytical\s*testing|heavy\s*metals?|microbial\s*limits?|pesticide\s*residues?|stability\s*testing|batch\s*manufacturing\s*records?|bmr|standardization)\b/i,
    domain: 'GMP & Quality Standards'
  },
  {
    regex: /\b(drugs\s*(and|&)\s*cosmetics|drugs\s*act|licens(e|ing)|state\s*licensing\s*authority|sla|form\s*25d|form\s*24d|cdsco|fssai|nutraceutical|dietary\s*supplement|fda\s*botanical|regulatory\s*compliance|approval|clearance)\b/i,
    domain: 'Drug Regulations & Licensing'
  },

  // 6. Research, Clinical Trials, Commercialization & Protection
  {
    regex: /\b(clinical\s*trial|bioassay|in\s*vitro|in\s*vivo|cytotoxicity|antioxidant|therapeutic|pharmacology|efficacy|safety\s*dossier|toxicity|commercializ(e|ation)|export\s*approval|royalty|benefit\s*sharing\s*agreement)\b/i,
    domain: 'Research & Clinical Validation'
  },
];

// Negative patterns: Clearly unrelated topic markers (programming, pure mathematics, entertainment, general shopping, consumer tech)
const UNRELATED_PATTERNS: { regex: RegExp; label: string }[] = [
  // Programming & Software Engineering
  {
    regex: /\b(write\s+(a\s+)?(python|javascript|typescript|c\+\+|java|rust|go|php|ruby|html|css|sql|react|vue|angular)\s+(code|script|program|function|algorithm)|how\s+to\s+install\s+(npm|pip|docker|kubernetes|linux|windows)|debug\s+this\s+(code|error|stacktrace)|binary\s+search\s+tree|linked\s+list|leetcode|github\s+action)\b/i,
    label: 'General Computer Programming'
  },
  // Pure Mathematics & Calculations unrelated to IP/synergy
  {
    regex: /\b(solve\s+(this\s+)?(equation|integral|derivative|differential|calculus|quadratic)|what\s+is\s+(\d+)\s*[\+\-\*\/x\^]\s*(\d+)|pythagorean\s+theorem|trigonometry|matrix\s+multiplication)\b/i,
    label: 'Pure Mathematics & Calculation'
  },
  // Entertainment, Movies, Sports, Pop Culture
  {
    regex: /\b(who\s+won\s+the\s+(world\s*cup|ipl|super\s*bowl|oscar|match)|latest\s+movie|movie\s+review|box\s+office|celebrity\s+gossip|actor\s+name|song\s+lyrics|video\s+game|fortnite|minecraft|playstation|xbox)\b/i,
    label: 'Entertainment & Sports'
  },
  // General E-commerce, Shopping & Consumer Tech
  {
    regex: /\b(best\s+smartphone\s+to\s+buy|best\s+laptop\s+under|cheap\s+flights\s+to|hotel\s+booking|discount\s+coupon|amazon\s+promo|iphone\s+vs\s+samsung|pizza\s+delivery|restaurant\s+near\s+me)\b/i,
    label: 'General Consumer Shopping & Services'
  },
  // Casual chit-chat / General unrelated trivia
  {
    regex: /\b(tell\s+me\s+a\s+joke|write\s+a\s+(poem|love\s+letter|song)\s+about|what\s+is\s+the\s+capital\s+of\s+(france|germany|italy|canada|brazil)|who\s+is\s+the\s+president\s+of\s+(france|russia|america)|horoscope\s+today|weather\s+in\s+london)\b/i,
    label: 'General Casual / Trivia'
  }
];

/**
 * Evaluates whether a user query is within the domain scope of IP-SAKTI Sahayak
 * (Ayurveda, AYUSH, Traditional Knowledge, Patents, Intellectual Property, Biodiversity, and Regulatory Compliance).
 * 
 * Design principle: Safe-by-default to prevent blocking legitimate queries.
 * Only flags queries that trigger clear unrelated markers AND lack domain relevance markers.
 */
export function evaluateQueryRelevance(query: string): QueryRelevanceResult {
  const trimmed = query.trim();

  // Very short query (e.g. "hi", "test") - allow standard conversational handling
  if (trimmed.length < 3) {
    return { isRelevant: true };
  }

  // 1. Check if ANY domain relevance keyword is present
  for (const item of DOMAIN_RELEVANCE_PATTERNS) {
    if (item.regex.test(trimmed)) {
      return {
        isRelevant: true,
        matchedDomain: item.domain
      };
    }
  }

  // 2. If NO domain keyword was matched, check if it matches an explicitly unrelated pattern
  for (const item of UNRELATED_PATTERNS) {
    if (item.regex.test(trimmed)) {
      return {
        isRelevant: false,
        reason: `Your query appears to be related to ${item.label}. IP-SAKTI Sahayak is a specialized research assistant dedicated exclusively to Ayurveda, AYUSH systems, Traditional Knowledge, Intellectual Property (patents, trademarks, designs), biodiversity (NBA / ABS), and related regulatory compliance.`,
      };
    }
  }

  // 3. For other non-keyword queries:
  // If the query contains generic words or open research phrasing without triggering explicit unrelated patterns,
  // we do not aggressively block it, ensuring legitimate research questions are never blocked.
  return { isRelevant: true };
}
