import { NextResponse } from "next/server";
import { z } from "zod";
import { probabilityEngineInputSchema } from "@shared/probability/contracts";
import { computeProbabilities, computeProbabilitiesDirect } from "../../../../src/lib/probabilityAdapter";

const requestSchema = z.object({
  market_id: z.string(),
  // If mode is "direct", use the full payload; otherwise fetch from DB
  mode: z.enum(["fetch", "direct"]).default("fetch"),
  // Optional: override input for direct mode
  payload: probabilityEngineInputSchema.optional()
});

export async function POST(req: Request) {
  try {
    // Verify internal secret
    const secret = req.headers.get("x-internal-secret") ?? req.headers.get("x_internal_secret");
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or missing internal secret" } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = requestSchema.parse(body);

    let result;

    if (parsed.mode === "direct" && parsed.payload) {
      // Direct mode: use the provided payload directly
      result = await computeProbabilitiesDirect(parsed.payload);
    } else {
      // Fetch mode: load data from Supabase and compute
      result = await computeProbabilities(parsed.market_id);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Probability compute error:", error);
    return NextResponse.json(
      {
        error: {
          code: "PROBABILITY_ERROR",
          message: error instanceof Error ? error.message : "Unknown error"
        }
      },
      { status: 400 }
    );
  }
}
