import { NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../../src/lib/supabase";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // Parse query params for time range
    const url = new URL(req.url);
    const hours = parseInt(url.searchParams.get("hours") || "24", 10);
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);

    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    // Fetch probability snapshots
    const { data: snapshots, error } = await supabase
      .from("probability_snapshots")
      .select("timestamp, probabilities")
      .eq("market_id", id)
      .gte("timestamp", cutoff)
      .order("timestamp", { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      market_id: id,
      snapshots: snapshots || []
    });
  } catch (error) {
    console.error("Market history error:", error);
    return NextResponse.json(
      { error: { code: "FETCH_ERROR", message: (error as Error).message } },
      { status: 500 }
    );
  }
}
