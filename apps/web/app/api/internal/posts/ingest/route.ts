import { NextResponse } from "next/server";
import { z } from "zod";

const ingestSchema = z.object({
  market_id: z.string(),
  posts: z.array(
    z.object({
      x_post_id: z.string(),
      text: z.string(),
      author_id: z.string().optional(),
      metrics: z.record(z.any()).optional()
    })
  )
});

function assertSecret(req: Request) {
  const secret = req.headers.get("x_internal_secret");
  if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    throw new Error("Unauthorized");
  }
}

export async function POST(req: Request) {
  try {
    assertSecret(req);
    const payload = ingestSchema.parse(await req.json());
    // TODO: Write to Supabase posts inbox with idempotency.
    return NextResponse.json({ status: "accepted", count: payload.posts.length });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "INGEST_ERROR", message: (error as Error).message } },
      { status: 400 }
    );
  }
}


