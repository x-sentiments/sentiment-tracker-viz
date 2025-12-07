import "dotenv/config";
import { loadConfig, Config } from "./config.js";
import { logger, setLogLevel } from "./logger.js";
import {
  getActiveMarkets,
  getStreamRules as getDbStreamRules,
  saveStreamRule,
  deleteStreamRule,
  Market,
} from "./supabase.js";
import {
  getStreamRules as getXStreamRules,
  addStreamRules,
  deleteStreamRules,
  connectToStream,
  XStreamData,
  XStreamRule,
} from "./x-api.js";

let config: Config;
let isShuttingDown = false;
let reconnectAttempts = 0;

/**
 * Send a tweet to the ingest endpoint
 */
async function ingestTweet(data: XStreamData): Promise<void> {
  const tweet = data.data;
  const author = data.includes?.users?.find((u) => u.id === tweet.author_id);
  const matchingRules = data.matching_rules || [];

  // Get market IDs from matching rule tags
  const marketIds = matchingRules
    .map((r) => r.tag)
    .filter((tag): tag is string => !!tag);

  if (marketIds.length === 0) {
    logger.warn("Tweet matched no tagged rules", { tweet_id: tweet.id });
    return;
  }

  // Send to ingest endpoint for each matching market
  for (const marketId of marketIds) {
    try {
      // Endpoint expects { market_id, posts: [...] }
      const payload = {
        market_id: marketId,
        posts: [
          {
            x_post_id: tweet.id,
            text: tweet.text,
            created_at: tweet.created_at || new Date().toISOString(),
            author_id: tweet.author_id || "unknown",
            author_followers: author?.public_metrics?.followers_count || null,
            author_verified: author?.verified || false,
            author_created_at: author?.created_at || null,
            metrics: tweet.public_metrics
              ? {
                  likes: tweet.public_metrics.like_count,
                  reposts: tweet.public_metrics.retweet_count,
                  replies: tweet.public_metrics.reply_count,
                  quotes: tweet.public_metrics.quote_count,
                }
              : null,
          },
        ],
      };

      const response = await fetch(
        `${config.WEBHOOK_URL}/api/internal/posts/ingest`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": config.INTERNAL_WEBHOOK_SECRET,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        logger.error("Failed to ingest tweet", {
          tweet_id: tweet.id,
          market_id: marketId,
          status: response.status,
          error,
        });
      } else {
        logger.info("Tweet ingested", {
          tweet_id: tweet.id,
          market_id: marketId,
          author: author?.username,
        });
      }
    } catch (error) {
      logger.error("Error ingesting tweet", {
        tweet_id: tweet.id,
        market_id: marketId,
        error: String(error),
      });
    }
  }
}

/**
 * Sync stream rules with active markets
 */
async function syncRules(): Promise<void> {
  logger.info("Syncing stream rules with active markets...");

  // Get active markets from DB
  const markets = await getActiveMarkets(config);
  logger.info("Active markets", { count: markets.length });

  // Get current rules from X
  const xRules = await getXStreamRules(config);
  logger.info("Current X stream rules", { count: xRules.length });

  // Get rules we've saved in DB
  const dbRules = await getDbStreamRules(config);
  const dbRulesByMarket = new Map<string, typeof dbRules>();
  for (const rule of dbRules) {
    const existing = dbRulesByMarket.get(rule.market_id) || [];
    existing.push(rule);
    dbRulesByMarket.set(rule.market_id, existing);
  }

  // Find markets that need rules added
  const marketsNeedingRules: Market[] = [];
  for (const market of markets) {
    if (!dbRulesByMarket.has(market.id)) {
      marketsNeedingRules.push(market);
    }
  }

  // Find rules that should be removed (market no longer active)
  const activeMarketIds = new Set(markets.map((m) => m.id));
  const rulesToRemove: string[] = [];
  for (const rule of dbRules) {
    if (!activeMarketIds.has(rule.market_id) && rule.x_rule_id) {
      rulesToRemove.push(rule.x_rule_id);
    }
  }

  // Delete stale rules from X
  if (rulesToRemove.length > 0) {
    logger.info("Removing stale rules", { count: rulesToRemove.length });
    await deleteStreamRules(config, rulesToRemove);
    for (const ruleId of rulesToRemove) {
      await deleteStreamRule(config, ruleId);
    }
  }

  // Add rules for new markets
  if (marketsNeedingRules.length > 0) {
    logger.info("Adding rules for new markets", { count: marketsNeedingRules.length });

    for (const market of marketsNeedingRules) {
      const templates = market.x_rule_templates || [];
      if (templates.length === 0) {
        logger.warn("Market has no rule templates", { market_id: market.id });
        continue;
      }

      // Use first template as the rule value
      const ruleValue = templates[0];
      const ruleTag = market.id; // Use market ID as tag to link tweets back

      try {
        const addedRules = await addStreamRules(config, [
          { value: ruleValue, tag: ruleTag },
        ]);

        for (const rule of addedRules) {
          await saveStreamRule(config, market.id, rule.id, rule.value, rule.tag || "");
          logger.info("Added rule for market", {
            market_id: market.id,
            rule_id: rule.id,
            rule_value: rule.value,
          });
        }
      } catch (error) {
        logger.error("Failed to add rule for market", {
          market_id: market.id,
          error: String(error),
        });
      }
    }
  }

  logger.info("Rule sync complete");
}

/**
 * Main stream loop with reconnection logic
 */
async function runStream(): Promise<void> {
  while (!isShuttingDown) {
    try {
      logger.info("Connecting to X filtered stream...");
      reconnectAttempts = 0;

      for await (const data of connectToStream(config)) {
        if (isShuttingDown) break;

        logger.debug("Received tweet", { tweet_id: data.data.id });
        await ingestTweet(data);
      }
    } catch (error) {
      reconnectAttempts++;
      logger.error("Stream error", {
        error: String(error),
        attempt: reconnectAttempts,
      });

      if (reconnectAttempts >= config.MAX_RECONNECT_ATTEMPTS) {
        logger.error("Max reconnect attempts reached, exiting");
        process.exit(1);
      }

      // Exponential backoff
      const delay = config.RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1);
      logger.info("Reconnecting...", { delay_ms: delay });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Graceful shutdown
 */
function setupShutdownHandlers(): void {
  const shutdown = async () => {
    logger.info("Shutting down...");
    isShuttingDown = true;
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Load config
  config = loadConfig();
  setLogLevel(config.LOG_LEVEL);

  logger.info("Starting ingestion worker...");
  setupShutdownHandlers();

  // Initial rule sync
  await syncRules();

  // Set up periodic rule sync (every 5 minutes)
  setInterval(async () => {
    try {
      await syncRules();
    } catch (error) {
      logger.error("Rule sync failed", { error: String(error) });
    }
  }, 5 * 60 * 1000);

  // Start the stream
  await runStream();
}

main().catch((error) => {
  logger.error("Fatal error", { error: String(error) });
  process.exit(1);
});

