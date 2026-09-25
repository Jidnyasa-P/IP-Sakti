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

// Terms indicating international / non-Indian jurisdiction
const INTERNATIONAL_INDICATORS: { regex: RegExp; label: string }[] = [
  // International organizations / treaties / frameworks
  {
    regex: /\b(international|internationally|pct|patent\s*cooperation\s*treaty)\b/i,
    label: "PCT / International Patent System",
  },
  {
    regex: /\b(wipo|world\s*intellectual\s*property\s*organization)\b/i,
    label: "WIPO",
  },
  {
    regex: /\b(uspto|united\s*states\s*patent)\b/i,
    label: "USPTO / United States",
  },
  {
    regex: /\b(epo|european\s*patent\s*office|epc\s*article)\b/i,
    label: "EPO / European Patent System",
  },
  {
    regex: /\b(jpo|japan\s*patent\s*office)\b/i,
    label: "JPO / Japan",
  },
  {
    regex: /\b(ukipo|uk\s*intellectual\s*property\s*office)\b/i,
    label: "UKIPO / United Kingdom",
  },
  {
    regex: /\b(cnipa|china\s*national\s*intellectual\s*property)\b/i,
    label: "CNIPA / China",
  },
  {
    regex: /\b(cipo|canadian\s*intellectual\s*property\s*office)\b/i,
    label: "CIPO / Canada",
  },
  {
    regex:
      /\b(nagoya\s*protocol|convention\s*on\s*biological\s*diversity)\b/i,
    label: "Nagoya Protocol / CBD",
  },
  {
    regex: /\b(trips|wto\s*trips|world\s*trade\s*organization)\b/i,
    label: "WTO / TRIPS",
  },

  // Countries outside India
  {
    regex:
      /\b(united\s*states|usa|u\.s\.a\.|america|canada|mexico|brazil|argentina|chile|colombia|peru|germany|france|italy|spain|portugal|netherlands|belgium|switzerland|austria|sweden|norway|denmark|finland|ireland|poland|czech\s*republic|hungary|romania|greece|russia|ukraine|turkey|israel|south\s*africa|egypt|nigeria|kenya|china|japan|south\s*korea|korea|singapore|malaysia|indonesia|thailand|vietnam|philippines|australia|new\s*zealand|united\s*kingdom|uk|england|scotland|wales)\b/i,
    label: "International Country / Region",
  },

  // Major international cities / jurisdictions
  {
    regex:
      /\b(washington\s*d\.?c\.?|new\s*york|boston|san\s*francisco|los\s*angeles|chicago|london|paris|berlin|munich|frankfurt|rome|milan|madrid|barcelona|amsterdam|brussels|geneva|zurich|vienna|stockholm|oslo|copenhagen|helsinki|dublin|warsaw|athens|moscow|kyiv|istanbul|tel\s*aviv|cairo|johannesburg|nairobi|beijing|shanghai|tokyo|osaka|seoul|singapore|kuala\s*lumpur|bangkok|jakarta|manila|sydney|melbourne|auckland|toronto|vancouver|montreal|mexico\s*city|sao\s*paulo|buenos\s*aires)\b/i,
    label: "International City / Jurisdiction",
  },

  // Foreign / international filing terminology
  {
    regex:
      /\b(foreign\s*patent|foreign\s*jurisdiction|foreign\s*filing|international\s*filing|international\s*patent|overseas\s*filing|national\s*phase|regional\s*phase|foreign\s*entity)\b/i,
    label: "International / Foreign Filing",
  },
];

// Evaluate whether a query is specific to India, international jurisdictions,
// or contains references to both.
export function evaluateQueryJurisdiction(
  query: string
): JurisdictionCheckResult {
  const normalized = query.trim();

  const indiaMatches: string[] = [];
  const internationalMatches: string[] = [];

  // Detect India / Domestic jurisdiction
  for (const item of INDIA_SPECIFIC_TERMS) {
    if (item.regex.test(normalized)) {
      indiaMatches.push(item.label);
    }
  }

  // Detect International / Foreign jurisdiction
  for (const item of INTERNATIONAL_INDICATORS) {
    if (item.regex.test(normalized)) {
      internationalMatches.push(item.label);
    }
  }

  const uniqueIndiaMatches = Array.from(new Set(indiaMatches));
  const uniqueInternationalMatches = Array.from(
    new Set(internationalMatches)
  );

  const isIndiaSpecific = uniqueIndiaMatches.length > 0;
  const isInternationalSpecific = uniqueInternationalMatches.length > 0;

  let explanation = "";

  if (isIndiaSpecific && isInternationalSpecific) {
    explanation =
      "This query contains both India-specific and international jurisdiction references. Please edit the query or use the jurisdiction section relevant to the specific question.";
  } else if (isIndiaSpecific) {
    const matches = uniqueIndiaMatches.slice(0, 3).join(", ");

    explanation =
      `This query involves India-specific regulatory, statutory, or regional jurisdiction (${matches}).`;
  } else if (isInternationalSpecific) {
    const matches = uniqueInternationalMatches.slice(0, 3).join(", ");

    explanation =
      `This query involves an international or foreign jurisdiction (${matches}).`;
  }

  return {
    isIndiaSpecific,
    isInternationalSpecific,
    matchedKeywords: Array.from(
      new Set([
        ...uniqueIndiaMatches,
        ...uniqueInternationalMatches,
      ])
    ),
    explanation,
  };
}