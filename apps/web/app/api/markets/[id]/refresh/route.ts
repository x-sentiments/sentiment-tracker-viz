import { NextResponse } from "next/server";
import { createServiceRoleClient } from "../../../../../src/lib/supabase";
import { searchRecentTweets, buildSearchQuery } from "../../../../../src/lib/xClient";
import { extractPostFeatures, scorePostsForMarket } from "../../../../../src/lib/grokClient";
import { computeProbabilities } from "../../../../../src/lib/probabilityAdapter";
import { GrokScoringRequest } from "shared/llm/grokScoring";

/**
 * Public Refresh API - Triggers the pipeline for a market
 * 
 * This is a simplified version of the internal pipeline that can be
 * called from the frontend to refresh a market's data.
 * 
 * Rate limiting: Checks last refresh timestamp to avoid abuse
 */

const MIN_REFRESH_INTERVAL_MS = 30 * 1000; // 30 seconds between refreshes

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: Props) {
  const startTime = Date.now();

  try {
    const { id: marketId } = await params;
    const supabase = createServiceRoleClient();

    // =========================================================================
    // Fetch market and check refresh eligibility
    // =========================================================================
    const { data: market, error: marketError } = await supabase
      .from("markets")
      .select("id, question, normalized_question, x_rule_templates, status")
      .eq("id", marketId)
      .single();

    if (marketError || !market) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Market not found" } },
        { status: 404 }
      );
    }

    if (market.status !== "active") {
      return NextResponse.json(
        { error: { code: "INACTIVE", message: "Market is not active" } },
        { status: 400 }
      );
    }

    // Check last refresh time (using market_state.updated_at)
    // Skip rate limiting for fresh markets with no posts
    const { data: marketState } = await supabase
      .from("market_state")
      .select("updated_at, post_counts")
      .eq("market_id", marketId)
      .single();

    const hasExistingPosts = (marketState?.post_counts ?? 0) > 0;
    
    if (hasExistingPosts && marketState?.updated_at) {
      const lastUpdate = new Date(marketState.updated_at).getTime();
      const elapsed = Date.now() - lastUpdate;
      
      if (elapsed < MIN_REFRESH_INTERVAL_MS) {
        const waitSecs = Math.ceil((MIN_REFRESH_INTERVAL_MS - elapsed) / 1000);
        return NextResponse.json(
          { 
            error: { 
              code: "RATE_LIMITED", 
              message: `Please wait ${waitSecs} seconds before refreshing again` 
            } 
          },
          { status: 429 }
        );
      }
    }

    const templates = market.x_rule_templates as string[] | null;
    
    // Fetch outcomes
    const { data: outcomes, error: outcomesError } = await supabase
      .from("outcomes")
      .select("id, outcome_id, label")
      .eq("market_id", marketId);

    if (outcomesError || !outcomes || outcomes.length === 0) {
      return NextResponse.json(
        { error: { code: "NO_OUTCOMES", message: "No outcomes found for market" } },
        { status: 400 }
      );
    }

    const results = {
      tweets_fetched: 0,
      tweets_ingested: 0,
      posts_scored: 0,
      probabilities: {} as Record<string, number>,
      x_api_available: false
    };

    // =========================================================================
    // Step 1: Try to fetch tweets from X (if configured)
    // =========================================================================
    if (templates && templates.length > 0 && process.env.X_BEARER_TOKEN) {
      results.x_api_available = true;
      
      try {
        const query = buildSearchQuery(templates);
        
        // Get the most recent post to avoid duplicates
        const { data: lastPost } = await supabase
          .from("raw_posts")
          .select("x_post_id")
          .eq("market_id", marketId)
          .order("ingested_at", { ascending: false })
          .limit(1)
          .single();

        const searchResult = await searchRecentTweets(query, 20, lastPost?.x_post_id);
        results.tweets_fetched = searchResult.posts.length;

        // Ingest tweets
        for (const tweet of searchResult.posts) {
          const features = extractPostFeatures(tweet.text);
          
          const { error } = await supabase
            .from("raw_posts")
            .upsert({
              market_id: marketId,
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
            }, {
              onConflict: "x_post_id,market_id",
              ignoreDuplicates: true
            });

          if (!error) {
            results.tweets_ingested++;
          }
        }
      } catch (fetchError) {
        console.error("[refresh] X API error:", fetchError);
        // Continue without X data
      }
    }

    // =========================================================================
    // Step 2: Score unscored posts
    // =========================================================================
    if (process.env.GROK_API_KEY) {
      try {
        // Get unscored posts
        const { data: scoredPostIds } = await supabase
          .from("scored_posts")
          .select("raw_post_id")
          .eq("market_id", marketId);

        const scoredIds = (scoredPostIds ?? []).map((s) => s.raw_post_id);

        let query = supabase
          .from("raw_posts")
          .select("id, x_post_id, text, post_created_at, author_id, author_followers, author_verified, metrics")
          .eq("market_id", marketId)
          .order("ingested_at", { ascending: false })
          .limit(10);

        if (scoredIds.length > 0) {
          query = query.not("id", "in", `(${scoredIds.join(",")})`);
        }

        const { data: postsToScore } = await query;

        if (postsToScore && postsToScore.length > 0) {
          const scoringRequest: GrokScoringRequest = {
            market: {
              market_id: marketId,
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

          const grokResponse = await scorePostsForMarket(scoringRequest);
          
          // Store results
          const insertRows = [];
          for (const result of grokResponse.results) {
            for (const [outcomeId, scores] of Object.entries(result.per_outcome)) {
              insertRows.push({
                raw_post_id: result.post_id,
                market_id: marketId,
                outcome_id: outcomeId,
                scores: scores,
                flags: result.flags,
                display_labels: result.display_labels
              });
            }
          }

          if (insertRows.length > 0) {
            await supabase
              .from("scored_posts")
              .upsert(insertRows, {
                onConflict: "raw_post_id,market_id,outcome_id",
                ignoreDuplicates: false
              });
          }

          results.posts_scored = grokResponse.results.length;
        }
      } catch (scoreError) {
        console.error("[refresh] Scoring error:", scoreError);
        // Continue without scoring
      }
    }

    // =========================================================================
    // Step 3: Compute updated probabilities
    // =========================================================================
    const probResult = await computeProbabilities(marketId);
    results.probabilities = probResult.probabilities;

    // Update total_posts_processed
    const { count } = await supabase
      .from("raw_posts")
      .select("id", { count: "exact", head: true })
      .eq("market_id", marketId);

    await supabase
      .from("markets")
      .update({ total_posts_processed: count ?? 0 })
      .eq("id", marketId);

    return NextResponse.json({
      status: "success",
      market_id: marketId,
      ...results,
      duration_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error("[refresh] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "REFRESH_ERROR",
          message: error instanceof Error ? error.message : "Unknown error"
        }
      },
      { status: 500 }
    );
  }
}
