import { NextRequest, NextResponse } from "next/server";
import { generateText } from "../../../../lib/ai/client";
import {
  buildSearchInterpretPrompt,
  heuristicFilters,
  parseFilterJson,
} from "../../../../lib/ai/search-interpret";
import { isFiltersEmpty } from "../../../../lib/ai/search-filters";

interface InterpretInput {
  queryText: string;
  vertical?: string | null;
}

/**
 * Turns a natural-language query into structured filters. Always answers with
 * a usable filter set, but never pretends a keyword fallback was an AI
 * interpretation — `source` and `note` say exactly which one the caller got.
 */
export async function POST(req: NextRequest) {
  const { queryText, vertical } = (await req.json()) as InterpretInput;
  if (!queryText?.trim()) {
    return NextResponse.json({ error: "queryText is required." }, { status: 400 });
  }

  const fallback = heuristicFilters(queryText, vertical);
  const prompt = buildSearchInterpretPrompt(queryText, vertical);
  const result = await generateText("search_interpretation", prompt);

  if ("error" in result) {
    return NextResponse.json({
      filters: fallback,
      source: "keyword_fallback",
      note: `${result.error} Fell back to plain keyword parsing — geography/industry filters were not inferred.`,
    });
  }

  const parsed = parseFilterJson(result.text);
  if (!parsed || isFiltersEmpty(parsed)) {
    return NextResponse.json({
      filters: fallback,
      source: "keyword_fallback",
      note: parsed
        ? `${result.provider} returned no usable filters. Fell back to plain keyword parsing.`
        : `${result.provider} did not return valid JSON. Fell back to plain keyword parsing.`,
    });
  }

  return NextResponse.json({
    filters: parsed,
    source: "ai",
    provider: result.provider,
    model: result.model,
  });
}
