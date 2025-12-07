/**
 * X (Twitter) API Client
 * 
 * Uses the X API v2 for:
 * - Recent search (fetching tweets matching keywords)
 * - Filtered stream rules management
 */

const X_API_BASE = "https://api.twitter.com/2";
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;

// ============================================================================
// Types
// ============================================================================

export interface XPost {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
}

export interface XUser {
  id: string;
  username: string;
  name: string;
  verified?: boolean;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
  created_at?: string;
}

export interface XSearchResult {
  posts: Array<{
    x_post_id: string;
    text: string;
    created_at: string;
    author_id: string;
    author_username?: string;
    author_followers?: number;
    author_verified?: boolean;
    author_created_at?: string;
    metrics?: {
      likes: number;
      reposts: number;
      replies: number;
      quotes: number;
    };
  }>;
  meta?: {
    newest_id?: string;
    oldest_id?: string;
    result_count: number;
    next_token?: string;
  };
}

export interface XRule {
  id?: string;
  value: string;
  tag?: string;
}

// ============================================================================
// HTTP Helpers
// ============================================================================

async function xGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (!X_BEARER_TOKEN) {
    throw new Error("X_BEARER_TOKEN not configured");
  }

  const url = new URL(`${X_API_BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${X_BEARER_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X API error: ${res.status} ${text}`);
  }

  return (await res.json()) as T;
}

async function xPost<T>(path: string, payload: unknown): Promise<T> {
  if (!X_BEARER_TOKEN) {
    throw new Error("X_BEARER_TOKEN not configured");
  }

  const res = await fetch(`${X_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${X_BEARER_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X API error: ${res.status} ${text}`);
  }

  return (await res.json()) as T;
}

// ============================================================================
// Search API
// ============================================================================

/**
 * Search recent tweets (last 7 days) matching a query
 * 
 * @param query - X search query (e.g., "bitcoin -is:retweet lang:en")
 * @param maxResults - Number of results (10-100, default 20)
 * @param sinceId - Only return tweets after this ID
 */
export async function searchRecentTweets(
  query: string,
  maxResults = 20,
  sinceId?: string
): Promise<XSearchResult> {
  const params: Record<string, string> = {
    query,
    max_results: String(Math.min(100, Math.max(10, maxResults))),
    "tweet.fields": "created_at,public_metrics,author_id",
    "user.fields": "verified,public_metrics,created_at",
    expansions: "author_id"
  };

  if (sinceId) {
    params.since_id = sinceId;
  }

  interface SearchResponse {
    data?: Array<{
      id: string;
      text: string;
      created_at: string;
      author_id: string;
      public_metrics?: {
        retweet_count: number;
        reply_count: number;
        like_count: number;
        quote_count: number;
      };
    }>;
    includes?: {
      users?: Array<{
        id: string;
        username: string;
        name: string;
        verified?: boolean;
        public_metrics?: {
          followers_count: number;
          following_count: number;
          tweet_count: number;
        };
        created_at?: string;
      }>;
    };
    meta?: {
      newest_id?: string;
      oldest_id?: string;
      result_count: number;
      next_token?: string;
    };
  }

  const response = await xGet<SearchResponse>("/tweets/search/recent", params);

  // Build user lookup map
  const userMap = new Map<string, XUser>();
  if (response.includes?.users) {
    for (const user of response.includes.users) {
      userMap.set(user.id, user);
    }
  }

  // Transform to our format
  const posts = (response.data ?? []).map((tweet) => {
    const user = userMap.get(tweet.author_id);
    return {
      x_post_id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      author_id: tweet.author_id,
      author_username: user?.username,
      author_followers: user?.public_metrics?.followers_count,
      author_verified: user?.verified,
      author_created_at: user?.created_at,
      metrics: tweet.public_metrics
        ? {
            likes: tweet.public_metrics.like_count,
            reposts: tweet.public_metrics.retweet_count,
            replies: tweet.public_metrics.reply_count,
            quotes: tweet.public_metrics.quote_count
          }
        : undefined
    };
  });

  return {
    posts,
    meta: response.meta
  };
}

/**
 * Build a search query from market's X rule templates
 * Combines templates with standard filters to avoid spam
 */
export function buildSearchQuery(templates: string[]): string {
  if (!templates || templates.length === 0) {
    throw new Error("No search templates provided");
  }

  // Combine templates with OR if multiple
  const baseQuery = templates.length === 1
    ? templates[0]
    : `(${templates.join(") OR (")})`;

  // Add standard filters to reduce spam
  const filters = [
    "-is:retweet",      // No retweets
    "-is:reply",        // No replies (often low quality)
    "lang:en"           // English only for now
  ];

  return `${baseQuery} ${filters.join(" ")}`;
}

// ============================================================================
// Filtered Stream Rules (for worker use)
// ============================================================================

/**
 * Get current filtered stream rules
 */
export async function getStreamRules(): Promise<XRule[]> {
  interface RulesResponse {
    data?: Array<{ id: string; value: string; tag?: string }>;
    meta?: { sent: string; result_count: number };
  }

  const response = await xGet<RulesResponse>("/tweets/search/stream/rules");
  return (response.data ?? []).map((r) => ({
    id: r.id,
    value: r.value,
    tag: r.tag
  }));
}

/**
 * Add filtered stream rules for a market
 */
export async function addStreamRules(
  marketId: string,
  templates: string[]
): Promise<XRule[]> {
  const rules = templates.map((tpl) => ({
    value: tpl,
    tag: `market:${marketId}`
  }));

  interface AddRulesResponse {
    data?: Array<{ id: string; value: string; tag?: string }>;
    meta?: { sent: string; summary: { created: number; not_created: number } };
  }

  const response = await xPost<AddRulesResponse>("/tweets/search/stream/rules", {
    add: rules
  });

  return (response.data ?? []).map((r) => ({
    id: r.id,
    value: r.value,
    tag: r.tag
  }));
}

/**
 * Delete filtered stream rules by IDs
 */
export async function deleteStreamRules(ruleIds: string[]): Promise<void> {
  if (ruleIds.length === 0) return;

  await xPost("/tweets/search/stream/rules", {
    delete: { ids: ruleIds }
  });
}

/**
 * Delete all rules for a specific market
 */
export async function deleteMarketRules(marketId: string): Promise<number> {
  const allRules = await getStreamRules();
  const marketRuleIds = allRules
    .filter((r) => r.tag === `market:${marketId}`)
    .map((r) => r.id!)
    .filter(Boolean);

  if (marketRuleIds.length > 0) {
    await deleteStreamRules(marketRuleIds);
  }

  return marketRuleIds.length;
}

// ============================================================================
// Legacy exports for compatibility
// ============================================================================

export async function createFilteredRulesForMarket(
  marketId: string,
  templates: string[]
): Promise<XRule[]> {
  return addStreamRules(marketId, templates);
}

export async function connectStream(
  handler: (post: unknown) => Promise<void>
): Promise<void> {
  // Placeholder: stream connection is implemented in the worker service
  // This function exists for interface compatibility
  console.warn("connectStream should be called from the ingestion worker, not web app");
  void handler;
}
