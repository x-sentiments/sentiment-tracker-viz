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

    return NextResponse.json({
      market,
      outcomes: outcomes || []
    });
  } catch (error) {
    console.error("Market detail error:", error);
    return NextResponse.json(
      { error: { code: "FETCH_ERROR", message: (error as Error).message } },
      { status: 500 }
    );
  }
}
