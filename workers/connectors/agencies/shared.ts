const AD_SPEND_REGEX = /\$\s?([\d,.]+)\s*([MmKkBb])?\+?\s*(?:in\s+)?(?:ad|media|managed)\s+spend/i;

const CHANNEL_KEYWORDS = ["meta ads", "facebook ads", "google ads", "tiktok ads", "programmatic", "instagram ads", "paid social", "ppc"];

export const CRYPTO_KEYWORDS = ["web3", "crypto", "blockchain", "defi", "nft", "token launch"];

const TEAM_SIZE_REGEX = /(?:team of|we are|over)\s+(\d{1,4})\+?\s*(?:people|employees|experts|marketers|specialists)/i;

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSpendToUsd(amount: string, unit?: string): number {
  const n = parseFloat(amount.replace(/,/g, ""));
  if (!unit) return n;
  const u = unit.toLowerCase();
  if (u === "k") return n * 1_000;
  if (u === "m") return n * 1_000_000;
  if (u === "b") return n * 1_000_000_000;
  return n;
}

export interface SiteSignals {
  adSpendMentioned: boolean;
  adSpendUsd?: number;
  channelsCount: number;
  hasCryptoClientHistory: boolean;
  teamSizeEstimate?: number;
  matchedSnippet?: string;
}

export function extractSiteSignals(text: string): SiteSignals {
  const spendMatch = text.match(AD_SPEND_REGEX);
  const channelsCount = CHANNEL_KEYWORDS.filter((k) => text.toLowerCase().includes(k)).length;
  const hasCryptoClientHistory = CRYPTO_KEYWORDS.some((k) => text.toLowerCase().includes(k));
  const teamSizeMatch = text.match(TEAM_SIZE_REGEX);

  return {
    adSpendMentioned: Boolean(spendMatch),
    adSpendUsd: spendMatch ? parseSpendToUsd(spendMatch[1], spendMatch[2]) : undefined,
    channelsCount,
    hasCryptoClientHistory,
    teamSizeEstimate: teamSizeMatch ? parseInt(teamSizeMatch[1], 10) : undefined,
    matchedSnippet: spendMatch?.[0],
  };
}
