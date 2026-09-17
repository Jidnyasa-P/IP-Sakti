// Utility to evaluate jurisdiction specificity for queries in IP-SAKTI Sahayak

export interface JurisdictionCheckResult {
  isIndiaSpecific: boolean;
  isInternationalSpecific: boolean;
  matchedKeywords: string[];
  explanation: string;
}

// Terms indicating India / Domestic jurisdiction (statutes, states, agencies, classical texts)
const INDIA_SPECIFIC_TERMS: { regex: RegExp; label: string }[] = [
  // Geographic / Administrative
  { regex: /\b(india|indian|bharat|bharatiya)\b/i, label: 'Indian Jurisdiction' },
  { regex: /\b(maharashtra|kerala|tamil\s*nadu|karnataka|gujarat|uttar\s*pradesh|bihar|west\s*bengal|rajasthan|madhya\s*pradesh|andhra\s*pradesh|telangana|punjab|haryana|assam|odisha|delhi|jammu|kashmir)\b/i, label: 'Indian State / Region' },
  { regex: /\b(mumbai|delhi|bengaluru|bangalore|chennai|hyderabad|kolkata|pune|ahmedabad|nagpur|nashik)\b/i, label: 'Indian Territory / City' },

  // Indian Regulatory & Statutory Bodies
  { regex: /\b(ayush|ministry\s*of\s*ayush)\b/i, label: 'Ministry of AYUSH' },
  { regex: /\b(nba|national\s*biodiversity\s*authority)\b/i, label: 'National Biodiversity Authority (NBA)' },
  { regex: /\b(sbb|state\s*biodiversity\s*board|state\s*biodiversity\s*boards)\b/i, label: 'State Biodiversity Board (SBB)' },
  { regex: /\b(bmc|biodiversity\s*management\s*committee)\b/i, label: 'Biodiversity Management Committee (BMC)' },
  { regex: /\b(cgpdtm|controller\s*general|ip\s*india|inpass|patent\s*office\s*(delhi|mumbai|chennai|kolkata))\b/i, label: 'Indian Patent Office (CGPDTM)' },
  { regex: /\b(tkdl|csir[\s-]tkdl|csir)\b/i, label: 'CSIR Traditional Knowledge Digital Library (TKDL)' },
  { regex: /\b(cdsco|central\s*drugs\s*standard\s*control)\b/i, label: 'CDSCO (India)' },
  { regex: /\b(fssai)\b/i, label: 'FSSAI (Food Safety India)' },
  { regex: /\b(sla|state\s*licensing\s*authority)\b/i, label: 'State Licensing Authority (AYUSH)' },

  // Indian Statutes & Specific Sections
  { regex: /\b(patents?\s*act[,\s]*(1970)?)\b/i, label: 'The Patents Act, 1970 (India)' },
  { regex: /\bsection\s*3\s*\(\s*p\s*\)/i, label: 'Section 3(p) [Traditional Knowledge Bar]' },
  { regex: /\bsection\s*3\s*\(\s*e\s*\)/i, label: 'Section 3(e) [Mere Admixture Bar]' },
  { regex: /\bsection\s*3\s*\(\s*d\s*\)/i, label: 'Section 3(d) [Efficacy Requirement]' },
  { regex: /\bsection\s*3\s*\(\s*j\s*\)/i, label: 'Section 3(j) [Plants/Animals Bar]' },
  { regex: /\b(biological\s*diversity\s*act|bd\s*act|bda[,\s]*(2002|2023)?)\b/i, label: 'Biological Diversity Act (India)' },
  { regex: /\b(section\s*6(\(1\))?|form\s*iii|form\s*3|form\s*i|form\s*1|form\s*ii|form\s*2|form\s*iv|form\s*4)\s*(of\s*(the\s*)?(biological\s*diversity|nba|bd\s*act))?\b/i, label: 'NBA Clearance Forms (Section 6)' },
  { regex: /\b(drugs\s*(and|&)\s*cosmetics\s*(act|rules))\b/i, label: 'Drugs & Cosmetics Act, 1940' },
  { regex: /\bschedule\s*t\b/i, label: 'Schedule T GMP (India)' },
  { regex: /\bform\s*(25d|24d|25-d|24-d)\b/i, label: 'AYUSH Manufacturing License (Form 25D)' },
  { regex: /\b(protection\s*of\s*plant\s*varieties|ppv[\s-]*fra)\b/i, label: 'PPV&FRA (Plant Varieties Act India)' },
  { regex: /\b(geographical\s*indications\s*of\s*goods\s*act|gi\s*registry\s*chennai)\b/i, label: 'GI Registry (Chennai)' },

  // Classical Indian Medicine Systems & Pharmacopoeias
  { regex: /\b(ayurveda|ayurvedic|siddha|unani|sowa[\s-]*rigpa|homeopathy|naturopathy)\b/i, label: 'Indian AYUSH System' },
  { regex: /\b(charaka|sushruta|vagbhata|bhavaprakasha|sharngadhara|ashtanga\s*hridaya)\b/i, label: 'Classical Ayurvedic Treatises' },
  { regex: /\b(api|ayurvedic\s*pharmacopoeia\s*of\s*india|upi|unani\s*pharmacopoeia|spi|siddha\s*pharmacopoeia)\b/i, label: 'Ayurvedic Pharmacopoeia of India (API)' },
  { regex: /\b(rasayana|bhasma|asava|arishta|taila|churn?a|ghrita|gutika|vati)\b/i, label: 'Classical Ayurvedic Formulations' },
];

// Terms indicating pure international jurisdiction
const INTERNATIONAL_INDICATORS = [
  /\b(pct|patent\s*cooperation\s*treaty)\b/i,
  /\b(wipo|world\s*intellectual\s*property\s*organization)\b/i,
  /\b(uspto|united\s*states\s*patent|35\s*u\.?s\.?c\.?)\b/i,
  /\b(epo|european\s*patent\s*office|epc\s*article)\b/i,
  /\b(jpo|japan\s*patent\s*office|ukipo|cipo)\b/i,
  /\b(nagoya\s*protocol|cbd|convention\s*on\s*biological\s*diversity)\b/i,
  /\b(trips|wto\s*trips|world\s*trade\s*organization)\b/i,
  /\b(foreign\s*patent|international\s*filing|national\s*phase)\b/i,
  /\b(united\s*states|europe|germany|japan|united\s*kingdom|australia|canada)\b/i,
];

/**
 * Validates whether a query submitted in International mode is actually India-specific.
 * Returns detection info and helpful guidance.
 */
export function evaluateQueryJurisdiction(query: string): JurisdictionCheckResult {
  const normalized = query.trim();
  const matchedKeywords: string[] = [];

  for (const item of INDIA_SPECIFIC_TERMS) {
    if (item.regex.test(normalized)) {
      matchedKeywords.push(item.label);
    }
  }

  const isIndiaSpecific = matchedKeywords.length > 0;

  let isInternationalSpecific = false;
  for (const regex of INTERNATIONAL_INDICATORS) {
    if (regex.test(normalized)) {
      isInternationalSpecific = true;
      break;
    }
  }

  let explanation = '';
  if (isIndiaSpecific) {
    const uniqueMatches = Array.from(new Set(matchedKeywords)).slice(0, 3).join(', ');
    explanation = `This query involves India-specific regulatory, statutory, or regional frameworks (${uniqueMatches}).`;
  }

  return {
    isIndiaSpecific,
    isInternationalSpecific,
    matchedKeywords: Array.from(new Set(matchedKeywords)),
    explanation,
  };
}
