import { NextResponse } from "next/server";
import { computeProbabilities } from "../../../../../../src/lib/probabilityAdapter";

interface Params {
  params: Promise<{ id: string }>;
}

function assertSecret(req: Request) {
  const secret = req.headers.get("x-internal-secret") ?? req.headers.get("x_internal_secret");
  if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    throw new Error("Unauthorized");
  }
}

/**
 * Trigger probability recomputation for a market
 * This fetches all relevant posts from Supabase and runs the evidence-softmax-v1 formula
 */
export async function POST(req: Request, { params }: Params) {
  try {
    assertSecret(req);

    const { id } = await params;

    // Run probability computation (fetches data from Supabase)
    const result = await computeProbabilities(id);

    return NextResponse.json({
      status: "updated",
      market_id: id,
      probabilities: result.probabilities,
      algorithm: result.algorithm,
      notes: result.notes
    });
  } catch (error) {
    console.error("Market update error:", error);
    return NextResponse.json(
      {
        error: {
          code: "UPDATE_ERROR",
          message: error instanceof Error ? error.message : "Unknown error"
        }
      },
      { status: 400 }
    );
  }
}
