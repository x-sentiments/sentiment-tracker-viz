import { NextResponse } from "next/server";
import { probabilityEngineInputSchema } from "@shared/probability/contracts";
import { computeProbabilities } from "../../../../src/lib/probabilityAdapter";

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x_internal_secret");
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) throw new Error("Unauthorized");

    const parsed = probabilityEngineInputSchema.parse(await req.json());
    const result = await computeProbabilities(parsed.market_id, parsed);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: { code: "PROBABILITY_ERROR", message: (error as Error).message } },
      { status: 400 }
    );
  }
}


