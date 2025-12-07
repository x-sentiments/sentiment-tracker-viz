import { Config } from "./config.js";
import { logger } from "./logger.js";

const STREAM_URL = "https://api.twitter.com/2/tweets/search/stream";
const RULES_URL = "https://api.twitter.com/2/tweets/search/stream/rules";

export interface XStreamRule {
  id: string;
  value: string;
  tag?: string;
}

export interface XStreamRulesResponse {
  data?: XStreamRule[];
  meta?: {
    sent: string;
    result_count: number;
  };
}

export interface XTweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
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
  created_at?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

export interface XStreamData {
  data: XTweet;
  includes?: {
    users?: XUser[];
  };
  matching_rules?: { id: string; tag?: string }[];
}

/**
 * Get current stream rules from X API
 */
export async function getStreamRules(config: Config): Promise<XStreamRule[]> {
  const response = await fetch(RULES_URL, {
    headers: {
      Authorization: `Bearer ${config.X_BEARER_TOKEN}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get stream rules: ${response.status} ${error}`);
  }

  const json: XStreamRulesResponse = await response.json();
  return json.data || [];
}

/**
 * Add rules to the stream
 */
export async function addStreamRules(
  config: Config,
  rules: { value: string; tag: string }[]
): Promise<XStreamRule[]> {
  const response = await fetch(RULES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.X_BEARER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ add: rules }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add stream rules: ${response.status} ${error}`);
  }

  const json = await response.json();
  
  if (json.errors) {
    logger.warn("Some rules had errors", { errors: json.errors });
  }

  return json.data || [];
}

/**
 * Delete rules from the stream
 */
export async function deleteStreamRules(
  config: Config,
  ruleIds: string[]
): Promise<void> {
  if (ruleIds.length === 0) return;

  const response = await fetch(RULES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.X_BEARER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ delete: { ids: ruleIds } }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete stream rules: ${response.status} ${error}`);
  }
}

/**
 * Connect to the filtered stream and yield tweets
 */
export async function* connectToStream(
  config: Config
): AsyncGenerator<XStreamData> {
  const params = new URLSearchParams({
    "tweet.fields": "id,text,author_id,created_at,public_metrics",
    "user.fields": "id,username,name,verified,created_at,public_metrics",
    expansions: "author_id",
  });

  const response = await fetch(`${STREAM_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${config.X_BEARER_TOKEN}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to connect to stream: ${response.status} ${error}`);
  }

  if (!response.body) {
    throw new Error("No response body from stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        logger.info("Stream ended");
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\r\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "") continue; // heartbeat

        try {
          const data: XStreamData = JSON.parse(line);
          yield data;
        } catch (e) {
          logger.warn("Failed to parse stream line", { line, error: String(e) });
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

