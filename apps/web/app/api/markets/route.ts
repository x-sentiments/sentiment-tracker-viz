import { NextResponse } from "next/server";
import { createServiceRoleClient } from "../../../src/lib/supabase";

// Force dynamic rendering - don't cache this route
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Fetch all active markets
    const { data: markets, error: marketsError } = await supabase
      .from("markets")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (marketsError) {
      throw new Error(marketsError.message);
    }

    const marketIds = (markets || []).map((m) => m.id);

    // Fetch outcomes for all markets
    let outcomesMap: Record<
      string,
      Array<{
        outcome_id: string;
        label: string;
        current_probability: number | null;
      }>
    > = {};

    // Fetch market_state for all markets (authoritative probability source)
    let marketStateMap: Record<string, Record<string, number>> = {};

    if (marketIds.length > 0) {
      // Fetch market_state first - this is the source of truth for current probabilities
      const { data: marketStates, error: statesError } = await supabase
        .from("market_state")
        .select("market_id, probabilities")
        .in("market_id", marketIds);

      if (!statesError && marketStates) {
        for (const ms of marketStates) {
          marketStateMap[ms.market_id] = ms.probabilities as Record<string, number>;
        }
      }

      const { data: outcomes, error: outcomesError } = await supabase
        .from("outcomes")
        .select("market_id, outcome_id, label, current_probability")
        .in("market_id", marketIds);

      if (!outcomesError && outcomes) {
        for (const o of outcomes) {
          if (!outcomesMap[o.market_id]) {
            outcomesMap[o.market_id] = [];
          }
          // Use market_state probability if available, otherwise fall back to outcomes table
          const stateProbs = marketStateMap[o.market_id];
          const probability = stateProbs?.[o.outcome_id] ?? o.current_probability;

          outcomesMap[o.market_id].push({
            outcome_id: o.outcome_id,
            label: o.label,
            current_probability: probability,
          });
        }
      }
    }

    // Combine markets with their outcomes
    const result = (markets || []).map((m) => ({
      ...m,
      outcomes: outcomesMap[m.id] || [],
    }));

    console.log(`[markets] Returning ${result.length} markets`);
    return NextResponse.json(
      { markets: result },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("Markets list error:", error);
    return NextResponse.json(
      { error: { code: "FETCH_ERROR", message: (error as Error).message } },
      { status: 500 }
    );
  }
}
