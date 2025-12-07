import { NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../src/lib/supabase";

// Force dynamic rendering - don't cache this route
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // Fetch market
    const { data: market, error: marketError } = await supabase
      .from("markets")
      .select("*")
      .eq("id", id)
      .single();

    if (marketError || !market) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Market not found" } },
        { status: 404 }
      );
    }

    // Fetch market_state (authoritative probability source)
    const { data: marketState } = await supabase
      .from("market_state")
      .select("probabilities, updated_at")
      .eq("market_id", id)
      .single();

    const stateProbs = marketState?.probabilities as Record<string, number> | null;

    // Fetch outcomes
    const { data: outcomes, error: outcomesError } = await supabase
      .from("outcomes")
      .select("*")
      .eq("market_id", id);

    if (outcomesError) {
      throw new Error(outcomesError.message);
    }

    // Merge market_state probabilities into outcomes for consistency
    const outcomesWithProbs = (outcomes || []).map((o) => ({
      ...o,
      // Use market_state probability if available, otherwise fall back to outcomes table
      current_probability: stateProbs?.[o.outcome_id] ?? o.current_probability,
    }));

    return NextResponse.json(
      {
        market,
        outcomes: outcomesWithProbs,
        // Also return probabilities map directly for convenience
        probabilities: stateProbs || {},
        probabilities_updated_at: marketState?.updated_at || null,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("Market detail error:", error);
    return NextResponse.json(
      { error: { code: "FETCH_ERROR", message: (error as Error).message } },
      { status: 500 }
    );
  }
}
