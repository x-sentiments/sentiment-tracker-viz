import { NextResponse } from "next/server";
import { createServiceRoleClient } from "../../../../src/lib/supabase";
import { searchRecentTweets, buildSearchQuery } from "../../../../src/lib/xClient";
import { extractPostFeatures, scorePostsForMarket } from "../../../../src/lib/grokClient";
import { computeProbabilities } from "../../../../src/lib/probabilityAdapter";
import { GrokScoringRequest } from "shared/llm/grokScoring";

/**
 * Cron Job: Refresh all active markets
 * 
 * This endpoint is called by Vercel Cron to periodically fetch new tweets,
 * score them, and update probabilities for all active markets.
 * 
 * Configure in vercel.json with a cron schedule.
 */

// Vercel Cron sends this header to authenticate
const CRON_SECRET = process.env.CRON_SECRET;

// Delay between X API calls to avoid rate limiting (X Basic tier: 10 requests per 15 min)
const X_API_DELAY_MS = 2000; // 2 seconds between API calls

/**
 * Helper to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is a rate limit error from X API
 */
function isRateLimitError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('429') || message.includes('rate limit') || message.includes('too many requests');
}

export async function GET(req: Request) {
  const startTime = Date.now();
  
  // Verify this is a legitimate cron request
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    // In development, allow without auth
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results = {
    markets_processed: 0,
    total_tweets_fetched: 0,
    total_posts_scored: 0,
    errors: [] as string[],
    market_details: [] as Array<{ id: string; question: string; tweets: number; scored: number }>,
    duration_ms: 0
  };

  try {
    const supabase = createServiceRoleClient();

    // Get all active markets
    const { data: markets, error: marketsError } = await supabase
      .from("markets")
      .select("id, question, normalized_question, x_rule_templates, status")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(10); // Process up to 10 markets per cron run

    if (marketsError) {
      throw new Error(`Failed to fetch markets: ${marketsError.message}`);
    }

    if (!markets || markets.length === 0) {
      console.log("[cron] No active markets to refresh");
      return NextResponse.json({ 
        status: "success", 
        message: "No active markets",
        ...results,
        duration_ms: Date.now() - startTime 
      });
    }

    console.log(`[cron] Refreshing ${markets.length} markets`);

    // Process each market
    for (let i = 0; i < markets.length; i++) {
      const market = markets[i];
      const marketLabel = `[${i + 1}/${markets.length}] "${market.question.slice(0, 50)}${market.question.length > 50 ? '...' : ''}"`;
      
      try {
        const templates = market.x_rule_templates as string[] | null;
        
        // Skip markets without X rules
        if (!templates || templates.length === 0) {
          console.log(`[cron] ${marketLabel} - skipping (no X rules)`);
          continue;
        }
        
        console.log(`[cron] ${marketLabel} - processing with ${templates.length} search templates`);

        // Fetch outcomes
        const { data: outcomes } = await supabase
          .from("outcomes")
          .select("id, outcome_id, label")
          .eq("market_id", market.id);

        if (!outcomes || outcomes.length === 0) {
          console.log(`[cron] Skipping market ${market.id} - no outcomes`);
          continue;
        }

        let marketTweets = 0;
        let marketScored = 0;

        // Step 1: Fetch tweets
        if (process.env.X_BEARER_TOKEN) {
          try {
            const query = buildSearchQuery(templates);
            console.log(`[cron] Market ${market.id} search query: ${query}`);
            
            // Get most recent post to avoid duplicates (don't use .single() as it throws on 0 rows)
            const { data: lastPosts } = await supabase
              .from("raw_posts")
              .select("x_post_id")
              .eq("market_id", market.id)
              .order("ingested_at", { ascending: false })
              .limit(1);

            const sinceId = lastPosts?.[0]?.x_post_id;
            console.log(`[cron] Market ${market.id} since_id: ${sinceId ?? 'none (first fetch)'}`);

            const searchResult = await searchRecentTweets(query, 15, sinceId);
            console.log(`[cron] Market ${market.id} X API returned ${searchResult.posts.length} tweets`);

            // Add delay after X API call to avoid rate limiting
            await delay(X_API_DELAY_MS);
            
            // Ingest tweets
            for (const tweet of searchResult.posts) {
              const features = extractPostFeatures(tweet.text);
              
              const { error } = await supabase
                .from("raw_posts")
                .upsert({
                  market_id: market.id,
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
                marketTweets++;
              }
            }

            results.total_tweets_fetched += marketTweets;
          } catch (fetchError) {
            const err = fetchError as Error;
            const isRateLimit = isRateLimitError(err);
            const msg = `Market ${market.id} fetch: ${err.message}${isRateLimit ? ' (RATE LIMITED)' : ''}`;
            results.errors.push(msg);
            console.error(`[cron] ${msg}`);
            
            // If rate limited, add extra delay before next market
            if (isRateLimit) {
              console.log(`[cron] Rate limit hit, waiting 30 seconds before continuing...`);
              await delay(30000);
            }
          }
        }

        // Step 2: Score unscored posts
        if (process.env.GROK_API_KEY) {
          try {
            // Get unscored posts
            const { data: scoredPostIds } = await supabase
              .from("scored_posts")
              .select("raw_post_id")
              .eq("market_id", market.id);

            const scoredIds = (scoredPostIds ?? []).map((s) => s.raw_post_id);

            let query = supabase
              .from("raw_posts")
              .select("id, x_post_id, text, post_created_at, author_id, author_followers, author_verified, metrics")
              .eq("market_id", market.id)
              .order("ingested_at", { ascending: false })
              .limit(8); // Score up to 8 posts per market per cron

            if (scoredIds.length > 0) {
              query = query.not("id", "in", `(${scoredIds.join(",")})`);
            }

            const { data: postsToScore } = await query;

            if (postsToScore && postsToScore.length > 0) {
              const scoringRequest: GrokScoringRequest = {
                market: {
                  market_id: market.id,
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
                    market_id: market.id,
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

              marketScored = grokResponse.results.length;
              results.total_posts_scored += marketScored;
            }
          } catch (scoreError) {
            const msg = `Market ${market.id} score: ${(scoreError as Error).message}`;
            results.errors.push(msg);
            console.error(`[cron] ${msg}`);
          }
        }

        // Step 3: Compute probabilities
        try {
          await computeProbabilities(market.id);
          
          // Update post count
          const { count } = await supabase
            .from("raw_posts")
            .select("id", { count: "exact", head: true })
            .eq("market_id", market.id);

          await supabase
            .from("markets")
            .update({ total_posts_processed: count ?? 0 })
            .eq("id", market.id);

        } catch (probError) {
          const msg = `Market ${market.id} probability: ${(probError as Error).message}`;
          results.errors.push(msg);
          console.error(`[cron] ${msg}`);
        }

        results.markets_processed++;
        results.market_details.push({
          id: market.id,
          question: market.question,
          tweets: marketTweets,
          scored: marketScored
        });
        console.log(`[cron] ${marketLabel} - complete: ${marketTweets} tweets fetched, ${marketScored} posts scored`);

      } catch (marketError) {
        const msg = `${marketLabel}: ${(marketError as Error).message}`;
        results.errors.push(msg);
        console.error(`[cron] ${msg}`);
      }
    }

    results.duration_ms = Date.now() - startTime;
    console.log(`[cron] Complete: ${results.markets_processed} markets, ${results.total_tweets_fetched} tweets, ${results.total_posts_scored} scored in ${results.duration_ms}ms`);

    return NextResponse.json({
      status: results.errors.length === 0 ? "success" : "partial",
      ...results
    });

  } catch (error) {
    console.error("[cron] Fatal error:", error);
    results.duration_ms = Date.now() - startTime;
    results.errors.push((error as Error).message);

    return NextResponse.json(
      { status: "error", ...results },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export { GET as POST };
