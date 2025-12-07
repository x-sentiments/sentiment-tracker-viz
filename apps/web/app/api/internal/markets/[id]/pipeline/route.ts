import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "../../../../../../src/lib/supabase";
import { searchRecentTweets, buildSearchQuery } from "../../../../../../src/lib/xClient";
import { extractPostFeatures, scorePostsForMarket } from "../../../../../../src/lib/grokClient";
import { computeProbabilities } from "../../../../../../src/lib/probabilityAdapter";
import { GrokScoringRequest } from "shared/llm/grokScoring";

/**
 * Pipeline API - Orchestrates the full flow:
 * 1. Fetch tweets from X using market's rule templates
 * 2. Ingest posts into raw_posts
 * 3. Score posts using Grok
 * 4. Compute updated probabilities
 */

const pipelineSchema = z.object({
  // Number of tweets to fetch (max 100)
  max_tweets: z.number().min(10).max(100).default(25),
  // Number of posts to score per batch
  batch_size: z.number().min(1).max(20).default(10),
  // Skip fetching (just score existing posts)
  skip_fetch: z.boolean().default(false),
  // Skip scoring (just compute probabilities)
  skip_score: z.boolean().default(false)
});

function assertSecret(req: Request) {
  const secret = req.headers.get("x-internal-secret") ?? req.headers.get("x_internal_secret");
  if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    throw new Error("Unauthorized");
  }
}

interface Props {
  params: { id: string };
}

export async function POST(req: Request, { params }: Props) {
  const startTime = Date.now();
  const results = {
    market_id: params.id,
    fetch: { tweets_found: 0, tweets_ingested: 0, skipped: false },
    score: { posts_scored: 0, skipped: false },
    probability: { updated: false, probabilities: {} as Record<string, number> },
    duration_ms: 0,
    errors: [] as string[]
  };

  try {
    assertSecret(req);

    const body = await req.json().catch(() => ({}));
    const options = pipelineSchema.parse(body);
    const supabase = createServiceRoleClient();

    // =========================================================================
    // Step 0: Fetch market details
    // =========================================================================
    const { data: market, error: marketError } = await supabase
      .from("markets")
      .select("id, question, normalized_question, x_rule_templates, status")
      .eq("id", params.id)
      .single();

    if (marketError || !market) {
      throw new Error(`Market not found: ${params.id}`);
    }

    if (market.status !== "active") {
      throw new Error(`Market is not active: ${market.status}`);
    }

    const templates = market.x_rule_templates as string[] | null;
    if (!templates || templates.length === 0) {
      throw new Error("Market has no X rule templates configured");
    }

    // Fetch outcomes
    const { data: outcomes, error: outcomesError } = await supabase
      .from("outcomes")
      .select("id, outcome_id, label")
      .eq("market_id", params.id);

    if (outcomesError || !outcomes || outcomes.length === 0) {
      throw new Error("No outcomes found for market");
    }

    // =========================================================================
    // Step 1: Fetch tweets from X
    // =========================================================================
    if (!options.skip_fetch) {
      try {
        console.log(`[pipeline] Fetching tweets for market ${params.id}`);
        
        // Build search query from templates
        const query = buildSearchQuery(templates);
        console.log(`[pipeline] Search query: ${query}`);

        // Get the most recent ingested post to avoid duplicates
        const { data: lastPost } = await supabase
          .from("raw_posts")
          .select("x_post_id")
          .eq("market_id", params.id)
          .order("ingested_at", { ascending: false })
          .limit(1)
          .single();

        // Search for recent tweets
        const searchResult = await searchRecentTweets(
          query,
          options.max_tweets,
          lastPost?.x_post_id
        );

        results.fetch.tweets_found = searchResult.posts.length;
        console.log(`[pipeline] Found ${searchResult.posts.length} tweets`);

        // Ingest tweets
        for (const tweet of searchResult.posts) {
          const features = extractPostFeatures(tweet.text);
          
          const row = {
            market_id: params.id,
            x_post_id: tweet.x_post_id,
            text: tweet.text,
            post_created_at: tweet.created_at,
            author_id: tweet.author_id,
            author_followers: tweet.author_followers ?? null,
            author_verified: tweet.author_verified ?? null,
            author_created_at: tweet.author_created_at ?? null,
            metrics: tweet.metrics ?? null,
            features,
            is_active: true
          };

          const { error } = await supabase
            .from("raw_posts")
            .upsert(row, {
              onConflict: "x_post_id,market_id",
              ignoreDuplicates: true
            });

          if (!error) {
            results.fetch.tweets_ingested++;
          }
        }

        console.log(`[pipeline] Ingested ${results.fetch.tweets_ingested} tweets`);
      } catch (fetchError) {
        const msg = fetchError instanceof Error ? fetchError.message : "Unknown fetch error";
        results.errors.push(`Fetch: ${msg}`);
        console.error("[pipeline] Fetch error:", fetchError);
      }
    } else {
      results.fetch.skipped = true;
    }

    // =========================================================================
    // Step 2: Score unscored posts using Grok
    // =========================================================================
    if (!options.skip_score) {
      try {
        console.log(`[pipeline] Scoring posts for market ${params.id}`);

        // Get posts that haven't been scored yet
        const { data: scoredPostIds } = await supabase
          .from("scored_posts")
          .select("raw_post_id")
          .eq("market_id", params.id);

        const scoredIds = (scoredPostIds ?? []).map((s) => s.raw_post_id);

        let query = supabase
          .from("raw_posts")
          .select("id, x_post_id, text, post_created_at, author_id, author_followers, author_verified, metrics")
          .eq("market_id", params.id)
          .order("ingested_at", { ascending: false })
          .limit(options.batch_size);

        if (scoredIds.length > 0) {
          query = query.not("id", "in", `(${scoredIds.join(",")})`);
        }

        const { data: postsToScore, error: postsError } = await query;

        if (postsError) {
          throw new Error(`Failed to fetch posts: ${postsError.message}`);
        }

        if (postsToScore && postsToScore.length > 0) {
          console.log(`[pipeline] Scoring ${postsToScore.length} posts`);

          // Build Grok scoring request
          const scoringRequest: GrokScoringRequest = {
            market: {
              market_id: params.id,
              question: market.normalized_question ?? market.question,
              outcomes: outcomes.map((o) => ({ id: o.outcome_id, label: o.label }))
            },
            posts: postsToScore.map((p) => ({
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
          console.log(`[pipeline] Grok scored ${grokResponse.results.length} posts`);

          // Store results
          const insertRows = [];
          for (const result of grokResponse.results) {
            for (const [outcomeId, scores] of Object.entries(result.per_outcome)) {
              insertRows.push({
                raw_post_id: result.post_id,
                market_id: params.id,
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
              console.error("[pipeline] Failed to insert scored_posts:", insertError);
            }
          }

          results.score.posts_scored = grokResponse.results.length;
        } else {
          console.log("[pipeline] No posts to score");
        }
      } catch (scoreError) {
        const msg = scoreError instanceof Error ? scoreError.message : "Unknown score error";
        results.errors.push(`Score: ${msg}`);
        console.error("[pipeline] Score error:", scoreError);
      }
    } else {
      results.score.skipped = true;
    }

    // =========================================================================
    // Step 3: Compute updated probabilities
    // =========================================================================
    try {
      console.log(`[pipeline] Computing probabilities for market ${params.id}`);
      
      const probResult = await computeProbabilities(params.id);
      results.probability.updated = true;
      results.probability.probabilities = probResult.probabilities;

      // Update total_posts_processed on market
      const { data: postCount } = await supabase
        .from("raw_posts")
        .select("id", { count: "exact" })
        .eq("market_id", params.id);

      await supabase
        .from("markets")
        .update({ total_posts_processed: postCount?.length ?? 0 })
        .eq("id", params.id);

      console.log(`[pipeline] Probabilities updated:`, probResult.probabilities);
    } catch (probError) {
      const msg = probError instanceof Error ? probError.message : "Unknown probability error";
      results.errors.push(`Probability: ${msg}`);
      console.error("[pipeline] Probability error:", probError);
    }

    results.duration_ms = Date.now() - startTime;

    return NextResponse.json({
      status: results.errors.length === 0 ? "success" : "partial",
      ...results
    });
  } catch (error) {
    console.error("[pipeline] Error:", error);
    results.duration_ms = Date.now() - startTime;
    results.errors.push(error instanceof Error ? error.message : "Unknown error");

    return NextResponse.json(
      {
        status: "error",
        ...results
      },
      { status: 400 }
    );
  }
}
