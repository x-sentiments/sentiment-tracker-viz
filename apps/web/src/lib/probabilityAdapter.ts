import { computeProbabilities as sharedCompute } from "@xai/shared/probability/engine";
import {
  ProbabilityEngineInput,
  ProbabilityEngineResult,
  PostInput
} from "@xai/shared/probability/contracts";
import { createServiceRoleClient } from "./supabase";
import { Database } from "@xai/shared/db/types";

type RawPost = Database["public"]["Tables"]["raw_posts"]["Row"];
type ScoredPost = Database["public"]["Tables"]["scored_posts"]["Row"];
type Outcome = Database["public"]["Tables"]["outcomes"]["Row"];
type MarketState = Database["public"]["Tables"]["market_state"]["Row"];

/**
 * Transform DB rows into PostInput for the probability engine
 */
function transformToPostInput(
  rawPost: RawPost,
  scoredPosts: ScoredPost[]
): PostInput | null {
  // Need at least one scored entry
  if (scoredPosts.length === 0) return null;

  // Build scores map from scored_posts rows
  const scores: Record<string, {
    relevance: number;
    stance: number;
    strength: number;
    credibility: number;
    confidence?: number;
  }> = {};

  for (const sp of scoredPosts) {
    const s = sp.scores as {
      relevance?: number;
      stance?: number;
      strength?: number;
      credibility?: number;
      confidence?: number;
    };

    scores[sp.outcome_id] = {
      relevance: s.relevance ?? 0,
      stance: s.stance ?? 0,
      strength: s.strength ?? 0,
      credibility: s.credibility ?? 0,
      confidence: s.confidence ?? 1
    };
  }

  // Parse features
  const features = rawPost.features as {
    cashtag_count?: number;
    mention_count?: number;
    url_count?: number;
    caps_ratio?: number;
  } | null;

  // Parse metrics
  const metrics = rawPost.metrics as {
    likes?: number;
    reposts?: number;
    replies?: number;
    quotes?: number;
  } | null;

  return {
    id: rawPost.id,
    created_at_ms: rawPost.post_created_at
      ? new Date(rawPost.post_created_at).getTime()
      : new Date(rawPost.ingested_at).getTime(),
    author_id: rawPost.author_id ?? "unknown",
    author_created_at_ms: rawPost.author_created_at
      ? new Date(rawPost.author_created_at).getTime()
      : null,
    author_followers: rawPost.author_followers,
    author_verified: rawPost.author_verified,
    initial_metrics: metrics
      ? {
          likes: metrics.likes ?? null,
          reposts: metrics.reposts ?? null,
          replies: metrics.replies ?? null,
          quotes: metrics.quotes ?? null
        }
      : undefined,
    features: features
      ? {
          cashtag_count: features.cashtag_count,
          mention_count: features.mention_count,
          url_count: features.url_count,
          caps_ratio: features.caps_ratio
        }
      : undefined,
    scores
  };
}

/**
 * Compute probabilities for a market, fetching data from Supabase
 * and persisting results back to market_state and probability_snapshots
 */
export async function computeProbabilities(
  marketId: string,
  overrideInput?: Partial<ProbabilityEngineInput>
): Promise<ProbabilityEngineResult> {
  const supabase = createServiceRoleClient();
  const now = Date.now();

  // Fetch outcomes for this market
  const { data: outcomes, error: outcomesError } = await supabase
    .from("outcomes")
    .select("*")
    .eq("market_id", marketId);

  if (outcomesError) throw new Error(`Failed to fetch outcomes: ${outcomesError.message}`);
  if (!outcomes || outcomes.length === 0) {
    throw new Error(`No outcomes found for market ${marketId}`);
  }

  // Fetch current market state (previous probabilities)
  const { data: marketState } = await supabase
    .from("market_state")
    .select("*")
    .eq("market_id", marketId)
    .single();

  const prevProbabilities = marketState?.probabilities as Record<string, number> | null;

  // Fetch raw posts within the 72h window (hard cutoff in engine)
  const cutoffTime = new Date(now - 72 * 3600 * 1000).toISOString();
  const { data: rawPosts, error: rawPostsError } = await supabase
    .from("raw_posts")
    .select("*")
    .eq("market_id", marketId)
    .gte("post_created_at", cutoffTime)
    .order("post_created_at", { ascending: false });

  if (rawPostsError) throw new Error(`Failed to fetch raw_posts: ${rawPostsError.message}`);

  // Fetch scored posts for these raw posts
  const rawPostIds = (rawPosts ?? []).map((p) => p.id);
  let scoredPosts: ScoredPost[] = [];

  if (rawPostIds.length > 0) {
    const { data: sp, error: spError } = await supabase
      .from("scored_posts")
      .select("*")
      .in("raw_post_id", rawPostIds);

    if (spError) throw new Error(`Failed to fetch scored_posts: ${spError.message}`);
    scoredPosts = sp ?? [];
  }

  // Group scored posts by raw_post_id
  const scoredByRawPost = new Map<string, ScoredPost[]>();
  for (const sp of scoredPosts) {
    const existing = scoredByRawPost.get(sp.raw_post_id) ?? [];
    existing.push(sp);
    scoredByRawPost.set(sp.raw_post_id, existing);
  }

  // Transform to PostInput format
  const posts: PostInput[] = [];
  for (const rawPost of rawPosts ?? []) {
    const spForPost = scoredByRawPost.get(rawPost.id) ?? [];
    const postInput = transformToPostInput(rawPost, spForPost);
    if (postInput) posts.push(postInput);
  }

  // Build engine input
  const engineInput: ProbabilityEngineInput = {
    market_id: marketId,
    now_ms: now,
    outcomes: outcomes.map((o) => ({
      id: o.outcome_id,
      label: o.label,
      prior_probability: o.prior_probability
    })),
    prev_probabilities: prevProbabilities ?? undefined,
    posts,
    formula_version: overrideInput?.formula_version ?? "evidence-softmax-v1",
    ...overrideInput
  };

  // Run the probability engine
  const result = sharedCompute(engineInput);

  // Persist to market_state (upsert)
  const { error: upsertError } = await supabase.from("market_state").upsert(
    {
      market_id: marketId,
      probabilities: result.probabilities,
      updated_at: new Date().toISOString(),
      post_counts: result.notes?.accepted_posts ?? 0
    },
    { onConflict: "market_id" }
  );

  if (upsertError) {
    console.error("Failed to upsert market_state:", upsertError);
  }

  // Persist probability snapshot
  const { error: snapshotError } = await supabase.from("probability_snapshots").insert({
    market_id: marketId,
    probabilities: result.probabilities,
    timestamp: new Date().toISOString()
  });

  if (snapshotError) {
    console.error("Failed to insert probability_snapshot:", snapshotError);
  }

  // Update outcome current_probability values
  for (const outcome of outcomes) {
    const prob = result.probabilities[outcome.outcome_id];
    if (prob !== undefined) {
      await supabase
        .from("outcomes")
        .update({ current_probability: prob })
        .eq("id", outcome.id);
    }
  }

  return result;
}

/**
 * Compute probabilities with a direct payload (for testing or internal use)
 */
export async function computeProbabilitiesDirect(
  payload: ProbabilityEngineInput
): Promise<ProbabilityEngineResult> {
  return sharedCompute(payload);
}
