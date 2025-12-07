import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "../../../../../src/lib/supabase";
import { scorePostsForMarket } from "../../../../../src/lib/grokClient";
import { GrokScoringRequest } from "shared/llm/grokScoring";

/**
 * Schema for score request
 */
const scoreRequestSchema = z.object({
  market_id: z.string(),
  // Optional: specific post IDs to score. If not provided, scores unscored posts.
  post_ids: z.array(z.string()).optional(),
  // Max posts to score in this batch
  batch_size: z.number().default(16)
});

function assertSecret(req: Request) {
  const secret = req.headers.get("x-internal-secret") ?? req.headers.get("x_internal_secret");
  if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    throw new Error("Unauthorized");
  }
}

export async function POST(req: Request) {
  try {
    assertSecret(req);

    const body = await req.json();
    const parsed = scoreRequestSchema.parse(body);
    const supabase = createServiceRoleClient();

    // Fetch market details
    const { data: market, error: marketError } = await supabase
      .from("markets")
      .select("id, question, normalized_question")
      .eq("id", parsed.market_id)
      .single();

    if (marketError || !market) {
      throw new Error(`Market not found: ${parsed.market_id}`);
    }

    // Fetch outcomes for this market
    const { data: outcomes, error: outcomesError } = await supabase
      .from("outcomes")
      .select("outcome_id, label")
      .eq("market_id", parsed.market_id);

    if (outcomesError || !outcomes) {
      throw new Error(`Failed to fetch outcomes: ${outcomesError?.message}`);
    }

    // Fetch posts to score
    let query = supabase
      .from("raw_posts")
      .select("id, x_post_id, text, post_created_at, author_id, author_followers, author_verified, metrics")
      .eq("market_id", parsed.market_id);

    if (parsed.post_ids && parsed.post_ids.length > 0) {
      query = query.in("id", parsed.post_ids);
    } else {
      // Fetch posts that haven't been scored yet
      // Using a left join approach - get posts without scored_posts entries
      const { data: scoredPostIds } = await supabase
        .from("scored_posts")
        .select("raw_post_id")
        .eq("market_id", parsed.market_id);

      const scoredIds = (scoredPostIds ?? []).map((s) => s.raw_post_id);

      if (scoredIds.length > 0) {
        query = query.not("id", "in", `(${scoredIds.join(",")})`);
      }
    }

    const { data: posts, error: postsError } = await query
      .order("ingested_at", { ascending: false })
      .limit(parsed.batch_size);

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`);
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ status: "no_posts_to_score", scored: 0 });
    }

    // Build Grok scoring request
    const scoringRequest: GrokScoringRequest = {
      market: {
        market_id: market.id,
        question: market.normalized_question ?? market.question,
        outcomes: outcomes.map((o) => ({ id: o.outcome_id, label: o.label }))
      },
      posts: posts.map((p) => ({
        post_id: p.id,
        created_at_ms: p.post_created_at ? new Date(p.post_created_at).getTime() : Date.now(),
        text: p.text,
        author: {
          verified: p.author_verified,
          followers: p.author_followers,
          bio: null
        },
        initial_metrics: p.metrics as {
          likes?: number;
          reposts?: number;
          replies?: number;
          quotes?: number;
        } | undefined
      }))
    };

    // Call Grok for scoring
    const grokResponse = await scorePostsForMarket(scoringRequest);

    // Store results in scored_posts
    const insertRows = [];
    for (const result of grokResponse.results) {
      for (const [outcomeId, scores] of Object.entries(result.per_outcome)) {
        insertRows.push({
          raw_post_id: result.post_id,
          market_id: parsed.market_id,
          outcome_id: outcomeId,
          scores: scores,
          flags: result.flags,
          display_labels: result.display_labels
        });
      }
    }

    if (insertRows.length > 0) {
      const { error: insertError } = await supabase
        .from("scored_posts")
        .upsert(insertRows, {
          onConflict: "raw_post_id,market_id,outcome_id",
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error("Failed to insert scored_posts:", insertError);
      }
    }

    return NextResponse.json({
      status: "scored",
      scored: grokResponse.results.length,
      rows_inserted: insertRows.length
    });
  } catch (error) {
    console.error("Score error:", error);
    return NextResponse.json(
      {
        error: {
          code: "SCORE_ERROR",
          message: error instanceof Error ? error.message : "Unknown error"
        }
      },
      { status: 400 }
    );
  }
}
