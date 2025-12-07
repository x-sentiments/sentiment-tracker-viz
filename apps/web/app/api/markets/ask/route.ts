import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "../../../src/lib/supabase";

const askSchema = z.object({
  question: z.string().min(8, "Question must be at least 8 characters")
});

/**
 * Mock market creation when Grok API is not available
 * In production, this should call createMarketFromQuestion from grokClient
 */
function createMockMarket(question: string) {
  // Simple mock: create Yes/No outcomes for any question
  const normalized = question.trim();
  
  // Generate simple outcomes based on question structure
  let outcomes = [
    { id: "yes", label: "Yes", prior: 0.5 },
    { id: "no", label: "No", prior: 0.5 }
  ];

  // If question mentions "who will win" or similar, create candidate outcomes
  const lowerQ = question.toLowerCase();
  if (lowerQ.includes("who will win") || lowerQ.includes("presidential election")) {
    outcomes = [
      { id: "trump", label: "Donald Trump", prior: 0.4 },
      { id: "harris", label: "Kamala Harris", prior: 0.4 },
      { id: "other", label: "Other", prior: 0.2 }
    ];
  } else if (lowerQ.includes("super bowl")) {
    outcomes = [
      { id: "afc", label: "AFC Team", prior: 0.5 },
      { id: "nfc", label: "NFC Team", prior: 0.5 }
    ];
  }

  // Generate simple X rules
  const words = normalized.split(/\s+/).filter((w) => w.length > 3);
  const keywords = words.slice(0, 5).join(" OR ");
  
  return {
    normalized_question: normalized,
    outcomes,
    x_rule_templates: [keywords]
  };
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { question } = askSchema.parse(json);
    const supabase = createServiceRoleClient();

    // Check for existing similar markets (simple exact match for now)
    const normalizedQ = question.trim().toLowerCase();
    const { data: existing } = await supabase
      .from("markets")
      .select("id, question, normalized_question")
      .eq("status", "active")
      .limit(100);

    // Simple similarity check
    const similarMarket = existing?.find((m) => {
      const existingQ = (m.normalized_question || m.question).toLowerCase();
      return existingQ === normalizedQ || 
             existingQ.includes(normalizedQ) || 
             normalizedQ.includes(existingQ);
    });

    if (similarMarket) {
      // Return existing market
      const { data: outcomes } = await supabase
        .from("outcomes")
        .select("*")
        .eq("market_id", similarMarket.id);

      return NextResponse.json({
        market: {
          id: similarMarket.id,
          ...similarMarket
        },
        outcomes: outcomes || [],
        existing: true
      });
    }

    // Create new market using mock (replace with Grok when API is available)
    let marketData;
    try {
      // Try Grok first (will fail without API key)
      const { createMarketFromQuestion } = await import("../../../src/lib/grokClient");
      marketData = await createMarketFromQuestion(question);
    } catch {
      // Fall back to mock
      marketData = createMockMarket(question);
    }

    // Insert market
    const { data: market, error: marketError } = await supabase
      .from("markets")
      .insert({
        question,
        normalized_question: marketData.normalized_question,
        status: "active",
        x_rule_templates: marketData.x_rule_templates,
        total_posts_processed: 0
      })
      .select()
      .single();

    if (marketError || !market) {
      throw new Error(marketError?.message || "Failed to create market");
    }

    // Insert outcomes
    const outcomesToInsert = marketData.outcomes.map((o: { id: string; label: string; prior: number }) => ({
      market_id: market.id,
      outcome_id: o.id,
      label: o.label,
      current_probability: o.prior,
      prior_probability: o.prior,
      cumulative_support: 0,
      cumulative_oppose: 0,
      post_count: 0
    }));

    const { data: outcomes, error: outcomesError } = await supabase
      .from("outcomes")
      .insert(outcomesToInsert)
      .select();

    if (outcomesError) {
      console.error("Failed to create outcomes:", outcomesError);
    }

    // Initialize market_state
    const initialProbs: Record<string, number> = {};
    for (const o of marketData.outcomes) {
      initialProbs[o.id] = o.prior;
    }

    await supabase.from("market_state").insert({
      market_id: market.id,
      probabilities: initialProbs,
      post_counts: 0
    });

    // Insert initial probability snapshot
    await supabase.from("probability_snapshots").insert({
      market_id: market.id,
      probabilities: initialProbs
    });

    return NextResponse.json({
      market,
      outcomes: outcomes || [],
      existing: false
    });
  } catch (error) {
    console.error("Ask market error:", error);
    return NextResponse.json(
      {
        error: {
          code: "CREATE_ERROR",
          message: error instanceof Error ? error.message : "Failed to create market"
        }
      },
      { status: 400 }
    );
  }
}
