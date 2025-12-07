import { NextResponse } from "next/server";
import { scorePostsForMarket } from "../../../../src/lib/grokClient";

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x_internal_secret");
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) throw new Error("Unauthorized");

    const payload = await req.json();
    const result = await scorePostsForMarket(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: { code: "SCORE_ERROR", message: (error as Error).message } },
      { status: 400 }
    );
  }
}


