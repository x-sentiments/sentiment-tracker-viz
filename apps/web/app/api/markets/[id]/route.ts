import { NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../src/lib/supabase";

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

    // Fetch outcomes
    const { data: outcomes, error: outcomesError } = await supabase
      .from("outcomes")
      .select("*")
      .eq("market_id", id);

    if (outcomesError) {
      throw new Error(outcomesError.message);
    }

    // Fetch latest market state probabilities
    const { data: state } = await supabase
      .from("market_state")
      .select("probabilities, updated_at")
      .eq("market_id", id)
      .maybeSingle();

    const probabilities: Record<string, number> =
      state?.probabilities ?? {};

    return NextResponse.json(
      {
        market,
        outcomes: outcomes || [],
        probabilities,
        updated_at: state?.updated_at ?? null,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
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
