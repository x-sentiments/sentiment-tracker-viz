import { NextResponse } from "next/server";
import { z } from "zod";
import { createMarketFromQuestion } from "../../../src/lib/grokClient";

const askSchema = z.object({
  question: z.string().min(8)
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { question } = askSchema.parse(json);
    const market = await createMarketFromQuestion(question);

    // TODO: Persist market/outcomes and dedupe against existing markets.
    return NextResponse.json({ market });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: (error as Error).message } },
      { status: 400 }
    );
  }
}


