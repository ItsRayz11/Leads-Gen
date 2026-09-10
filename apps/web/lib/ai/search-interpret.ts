import {
  FRESHNESS_VALUES,
  STATUSES,
  TIERS,
  VERTICALS,
  normalizeFilters,
  type StructuredSearchFilters,
} from "./search-filters";

/**
 * Builds the prompt that turns a natural-language "what am I looking for"
 * query into the structured filter shape. Deliberately strict: the model is
 * only allowed to fill fields the query actually implies, because a filter
 * the user never asked for silently hides leads.
 */
export function buildSearchInterpretPrompt(queryText: string, vertical?: string | null): string {
  return [
    "You convert a natural-language lead-search request into a strict JSON filter object.",
    "",
    "Output rules:",
    "- Respond with ONLY a JSON object. No prose, no markdown fences, no explanation.",
    "- Fill a field ONLY if the request actually implies it. Leave arrays empty and scalars null otherwise.",
    "- Never invent a country, industry, or role the request does not mention or clearly imply.",
    "- Keep every array item short (1-3 words), lowercase unless it is a proper noun.",
    "",
    "JSON shape (all keys required):",
    "{",
    '  "keywords": string[],        // free-text terms to match against the lead title / buying signal / notes',
    '  "excludeKeywords": string[], // terms that disqualify a lead',
    '  "roleKeywords": string[],    // job titles/roles, when the request is about who a company is hiring',
    '  "industries": string[],      // company industry, e.g. "defi", "gaming", "e-commerce"',
    '  "countries": string[],       // full country names, e.g. "Singapore", "United States"',
    '  "regions": string[],         // broader areas, e.g. "Southeast Asia", "MENA"',
    '  "companySizes": string[],    // e.g. "1-10", "11-50", "startup"',
    '  "signalTypes": string[],     // e.g. "hiring", "launch", "fundraising", "expansion", "partnership"',
    '  "serviceTypes": string[],    // the service being sold into them, e.g. "community management", "kol marketing"',
    `  "tiers": string[],           // only from: ${TIERS.join(", ")}`,
    `  "statuses": string[],        // only from: ${STATUSES.join(", ")}`,
    `  "freshness": string[],       // only from: ${FRESHNESS_VALUES.join(", ")}`,
    '  "minScore": number | null,   // 0-100, only if the request mentions a score/quality threshold',
    `  "vertical": string | null    // only from: ${VERTICALS.join(", ")}`,
    "}",
    "",
    vertical
      ? `The user already picked the "${vertical}" vertical, so set "vertical" to "${vertical}".`
      : 'If the request does not clearly indicate a vertical, set "vertical" to null.',
    "",
    "Request:",
    queryText,
  ].join("\n");
}

/**
 * Pulls the first JSON object out of a model response, tolerating the two
 * things models do anyway: markdown fences and a sentence of preamble.
 */
export function parseFilterJson(text: string): StructuredSearchFilters | null {
  const withoutFences = text.replace(/```(?:json)?/gi, "").trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    return normalizeFilters(JSON.parse(withoutFences.slice(start, end + 1)));
  } catch {
    return null;
  }
}

const STOPWORDS = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "but", "by", "find", "for", "from", "get",
  "has", "have", "i", "in", "is", "it", "leads", "looking", "me", "my", "need", "of", "on", "or",
  "show", "some", "that", "the", "their", "them", "there", "these", "they", "this", "to", "up",
  "want", "was", "we", "were", "what", "which", "who", "will", "with", "you",
]);

const VERTICAL_PHRASES: [RegExp, string][] = [
  [/\bcard affiliate\b|\bbitget card\b|\bcard referral\b/i, "card_affiliate"],
  [/\bhiring\b|\bjob post\b|\bopen role\b|\brecruit/i, "hiring"],
];

const SIGNAL_PHRASES: [RegExp, string][] = [
  [/\bhiring\b|\brecruit/i, "hiring"],
  [/\blaunch/i, "launch"],
  [/\bfundrais|\braised\b|\bfunding\b|\bseed round\b/i, "fundraising"],
  [/\bexpan|\bnew market\b/i, "expansion"],
  [/\bpartner/i, "partnership"],
];

/**
 * Deterministic fallback used when no AI provider is configured for
 * `lead_qualification`-style interpretation. It only reads tokens that carry
 * an unambiguous meaning (an explicit tier, an explicit freshness word, a
 * numeric score threshold, a `-term` exclusion, a quoted phrase) and dumps
 * everything else into `keywords`. It does not guess at geography or
 * industry — that is exactly the part that needs a model, and pretending
 * otherwise would silently narrow the search.
 */
/**
 * Whole-word, case-insensitive match. Built by concatenation rather than a
 * template literal on purpose: inside a template literal `\b` is a backspace
 * character, not a regex word boundary.
 */
function containsWord(haystack: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("\\b" + escaped + "\\b", "i").test(haystack);
}

export function heuristicFilters(queryText: string, vertical?: string | null): StructuredSearchFilters {
  const text = queryText.trim();
  const lower = text.toLowerCase();

  const tiers: string[] = [];
  const wantsAPlus = /\ba\+/i.test(lower);
  if (wantsAPlus) tiers.push("A+");
  for (const tier of ["A", "B", "C"]) {
    // "tier A+" already produced A+; don't also widen the search to plain A.
    if (tier === "A" && wantsAPlus) continue;
    if (containsWord(lower, "tier " + tier)) tiers.push(tier);
  }

  const freshness = FRESHNESS_VALUES.filter((f) => containsWord(lower, f));

  const scoreMatch =
    lower.match(/\bscore\D{0,12}(\d{1,3})\b/) ?? lower.match(/\b(\d{1,3})\+?\s*(?:score|points|pts)\b/);
  const minScore = scoreMatch ? Number(scoreMatch[1]) : null;

  const signalTypes = SIGNAL_PHRASES.filter(([re]) => re.test(lower)).map(([, type]) => type);
  const detectedVertical = vertical ?? VERTICAL_PHRASES.find(([re]) => re.test(lower))?.[1] ?? null;

  // Words already consumed as a structured filter must not also land in
  // `keywords`: keywords are OR-ed together, so leaving "tier" or "score" in
  // there would widen the match to any lead merely mentioning those words.
  const consumed = new Set<string>(["tier", "tiers", "score", "scoring", "points", "pts", ...freshness]);
  if (detectedVertical === "card_affiliate") {
    for (const word of ["card", "affiliate", "bitget"]) consumed.add(word);
  }

  const quotedPhrases = Array.from(text.matchAll(/"([^"]+)"/g)).map((m) => m[1].trim()).filter(Boolean);
  const withoutQuotes = text.replace(/"[^"]*"/g, " ");

  const excludeKeywords: string[] = [];
  const keywords: string[] = [...quotedPhrases];

  for (const token of withoutQuotes.split(/[\s,;.]+/)) {
    const cleaned = token.replace(/[^\w+-]/g, "");
    if (!cleaned) continue;
    if (cleaned.startsWith("-") && cleaned.length > 1) {
      excludeKeywords.push(cleaned.slice(1).toLowerCase());
      continue;
    }
    const word = cleaned.toLowerCase();
    if (word.length < 3 || STOPWORDS.has(word) || consumed.has(word) || /^\d+$/.test(word)) continue;
    if (!keywords.some((k) => k.toLowerCase() === word)) keywords.push(word);
  }

  return normalizeFilters({
    keywords,
    excludeKeywords,
    roleKeywords: [],
    industries: [],
    countries: [],
    regions: [],
    companySizes: [],
    signalTypes,
    serviceTypes: [],
    tiers,
    statuses: [],
    freshness,
    minScore,
    vertical: detectedVertical,
  });
}
