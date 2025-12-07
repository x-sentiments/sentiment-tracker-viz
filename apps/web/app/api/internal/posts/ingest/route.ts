import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "../../../../../src/lib/supabase";
import { extractPostFeatures } from "../../../../../src/lib/grokClient";

/**
 * Schema for incoming post data from X stream or mock
 */
const postSchema = z.object({
  x_post_id: z.string(),
  text: z.string(),
  // X post creation timestamp (ISO string or ms)
  created_at: z.union([z.string(), z.number()]).optional(),
  author_id: z.string().optional(),
  author_followers: z.number().optional(),
  author_verified: z.boolean().optional(),
  author_created_at: z.union([z.string(), z.number()]).optional(),
  metrics: z
    .object({
      likes: z.number().optional(),
      reposts: z.number().optional(),
      replies: z.number().optional(),
      quotes: z.number().optional(),
    })
    .optional(),
});

const ingestSchema = z.object({
  market_id: z.string(),
  posts: z.array(postSchema),
});

function assertSecret(req: Request) {
  const secret =
    req.headers.get("x-internal-secret") ??
    req.headers.get("x_internal_secret");
  if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    throw new Error("Unauthorized");
  }
}

/**
 * Convert timestamp input to ISO string
 */
function toISOString(input: string | number | undefined): string | null {
  if (!input) return null;
  if (typeof input === "number") {
    return new Date(input).toISOString();
  }
  // Already a string, validate it's a date
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function POST(req: Request) {
  try {
    assertSecret(req);

    const payload = ingestSchema.parse(await req.json());
    const supabase = createServiceRoleClient();

    const results = {
      accepted: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const post of payload.posts) {
      try {
        // Extract features for spam detection
        const features = extractPostFeatures(post.text);

        // Prepare row for insertion
        const row = {
          market_id: payload.market_id,
          x_post_id: post.x_post_id,
          text: post.text,
          post_created_at: toISOString(post.created_at),
          author_id: post.author_id ?? null,
          author_followers: post.author_followers ?? null,
          author_verified: post.author_verified ?? null,
          author_created_at: toISOString(post.author_created_at),
          metrics: post.metrics ?? null,
          features,
          is_active: true,
        };

        // Upsert to handle idempotency (on conflict with x_post_id + market_id)
        const { error } = await supabase.from("raw_posts").upsert(row, {
          onConflict: "x_post_id,market_id",
          ignoreDuplicates: true,
        });

        if (error) {
          results.errors.push(`${post.x_post_id}: ${error.message}`);
        } else {
          results.accepted++;
        }
      } catch (e) {
        results.errors.push(`${post.x_post_id}: ${(e as Error).message}`);
      }
    }

    // Chain to scoring and probability update if we accepted any posts
    if (results.accepted > 0) {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const secret = process.env.INTERNAL_WEBHOOK_SECRET || "";

      // Trigger scoring for this market (fire and forget for speed)
      fetch(`${baseUrl}/api/internal/posts/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": secret,
        },
        body: JSON.stringify({
          market_id: payload.market_id,
          batch_size: 16,
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            // After scoring, trigger probability recomputation
            await fetch(`${baseUrl}/api/internal/markets/${payload.market_id}/update`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-internal-secret": secret,
              },
            });
          }
        })
        .catch((e) => console.error("Pipeline chain error:", e));
    }

    return NextResponse.json({
      status: "processed",
      accepted: results.accepted,
      skipped: results.skipped,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INGEST_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 400 }
    );
  }
}
