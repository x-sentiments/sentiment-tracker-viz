import { grokMarketResponseSchema, GrokMarketResponse } from "@shared/llm/grokMarket";
import {
  grokScoreBatchResponseSchema,
  GrokScoreBatchResponse,
  GrokScoringRequest
} from "@shared/llm/grokScoring";
import { grokLabelBatchResponseSchema, GrokLabelBatchResponse } from "@shared/llm/grokLabels";

const GROK_BASE_URL = process.env.GROK_BASE_URL || "https://api.x.ai/v1";
const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_MODEL = process.env.GROK_MODEL || "grok-3-mini";

// ============================================================================
// System Prompts
// ============================================================================

/**
 * System prompt for Grok scoring - aligned with evidence-softmax-v1 formula
 */
const SCORING_SYSTEM_PROMPT = `You are an evidence-scoring engine for a real-time prediction market.

Task:
Given (1) a market question, (2) a list of mutually exclusive outcomes, and (3) a batch of X posts with limited author/engagement metadata,
you must output STRICT JSON scoring each post for EACH outcome.

You must score ONLY based on the provided post text + provided metadata.
Do NOT assume external facts, do NOT browse the web, do NOT add outside context.

For every post and every outcome, output:

- relevance: 0..1
  Meaning: how much the post is actually about THIS market question (not merely mentions a name).

- stance: -1..1
  Meaning: whether the post implies this outcome becomes more likely (+) or less likely (-).
  If the post supports outcome A in a mutually exclusive set, stance for competing outcomes will often be negative, but do not force symmetry if unclear.

- strength: 0..1
  Meaning: how direct and decision-relevant the claim is.
  1.0 = explicit prediction or strong evidence ("X will win", cites poll, official filing, on-the-record source).
  0.5 = plausible analysis/speculation without hard evidence.
  0.0 = no actionable evidence.

- credibility: 0..1
  Meaning: trustworthiness of the claim *given only text + metadata*.
  Increase if: cites verifiable sources, neutral tone, domain expertise signals in bio, consistent reasoning.
  Decrease if: anonymous rumor, sensational language, obvious bias framing, meme/sarcasm, "insider info" claims, no source.

- confidence: 0..1
  Meaning: confidence that your own stance/strength/credibility scoring is reliable.
  Lower confidence for sarcasm, jokes, quotes of someone else, ambiguous wording, rhetorical questions, heavy slang, unclear referents.

IMPORTANT:
- Multiple stances in one post are allowed. A post may be bullish on one outcome and bearish on another.
- If an outcome is not implicated, set stance=0 and keep relevance low.
- If the post is a quote/repost of someone else without endorsement, reduce strength and credibility, and reduce confidence.
- Output MUST be valid JSON only. No prose, no markdown.

Output schema:
{
  "results": [
    {
      "post_id": "...",
      "per_outcome": {
        "<outcome_id>": { "relevance":0..1, "stance":-1..1, "strength":0..1, "credibility":0..1, "confidence":0..1 },
        ...
      },
      "flags": {
        "is_sarcasm": true/false,
        "is_question": true/false,
        "is_quote": true/false,
        "is_rumor_style": true/false
      },
      "display_labels": {
        "summary": "1 sentence neutral summary of the post",
        "reason": "1 sentence why it matters for this market",
        "credibility_label": "High|Medium|Low",
        "stance_label": "e.g. Bullish on <OutcomeLabel> / Bearish on <OutcomeLabel> / Mixed"
      }
    }
  ]
}`;

/**
 * System prompt for market creation from user questions
 */
const MARKET_CREATION_SYSTEM_PROMPT = `You are a prediction market creation assistant.

Given a user question about a future event, you must:
1. Normalize the question into a clear, unambiguous form
2. Generate a set of mutually exclusive, collectively exhaustive outcomes
3. Assign prior probabilities that sum to 1.0
4. Suggest X (Twitter) filtered stream rules to capture relevant posts

Rules:
- Outcomes must cover all possibilities (include "Other" if needed)
- Priors should reflect reasonable base rates, not certainty
- X rules should be specific enough to avoid spam but broad enough to capture signal
- Output MUST be valid JSON only. No prose, no markdown.

Output schema:
{
  "normalized_question": "Clear, unambiguous question text",
  "outcomes": [
    { "id": "outcome_a", "label": "Outcome A Label", "prior": 0.4 },
    { "id": "outcome_b", "label": "Outcome B Label", "prior": 0.4 },
    { "id": "other", "label": "Other", "prior": 0.2 }
  ],
  "x_rule_templates": [
    "keyword1 OR keyword2 -spam",
    "@handle1 OR @handle2"
  ]
}`;

// ============================================================================
// API Helpers
// ============================================================================

interface GrokChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GrokChatRequest {
  model: string;
  messages: GrokChatMessage[];
  temperature?: number;
  response_format?: { type: "json_object" };
}

async function callGrokChat<T>(
  messages: GrokChatMessage[],
  schema: (input: unknown) => T,
  temperature = 0.1
): Promise<T> {
  if (!GROK_API_KEY) {
    throw new Error("GROK_API_KEY not configured");
  }

  const payload: GrokChatRequest = {
    model: GROK_MODEL,
    messages,
    temperature,
    response_format: { type: "json_object" }
  };

  const res = await fetch(`${GROK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROK_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Grok API error: ${res.status} ${errorText}`);
  }

  const json = await res.json();

  // Extract content from chat completion response
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in Grok response");
  }

  // Parse JSON content
  const parsed = JSON.parse(content);
  return schema(parsed);
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Create a market structure from a user question using Grok
 */
export async function createMarketFromQuestion(question: string): Promise<GrokMarketResponse> {
  const messages: GrokChatMessage[] = [
    { role: "system", content: MARKET_CREATION_SYSTEM_PROMPT },
    { role: "user", content: `Create a prediction market for this question: "${question}"` }
  ];

  return callGrokChat(messages, (data) => grokMarketResponseSchema.parse(data));
}

/**
 * Score a batch of posts for a market using Grok
 * Returns per-post, per-outcome scores aligned with evidence-softmax-v1 formula
 */
export async function scorePostsForMarket(request: GrokScoringRequest): Promise<GrokScoreBatchResponse> {
  const messages: GrokChatMessage[] = [
    { role: "system", content: SCORING_SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(request) }
  ];

  return callGrokChat(messages, (data) => grokScoreBatchResponseSchema.parse(data));
}

/**
 * Label posts for display (separate from scoring for UI-specific labels)
 * Note: The scoring prompt already includes display_labels, so this may be redundant
 * but is kept for cases where we want to re-label without re-scoring
 */
export async function labelPostsForDisplay(payload: unknown): Promise<GrokLabelBatchResponse> {
  const messages: GrokChatMessage[] = [
    {
      role: "system",
      content: `You are a post labeling assistant for a prediction market UI.
Given scored posts, generate human-readable labels for display.
Output MUST be valid JSON only.

Output schema:
{
  "labels": [
    {
      "post_id": "...",
      "stance_label": "Bullish on X / Bearish on Y / Mixed",
      "credibility_label": "High|Medium|Low",
      "reason": "1 sentence why this post matters"
    }
  ]
}`
    },
    { role: "user", content: JSON.stringify(payload) }
  ];

  return callGrokChat(messages, (data) => grokLabelBatchResponseSchema.parse(data));
}

/**
 * Extract post features for spam detection
 * Can be done locally but Grok can help with edge cases
 */
export function extractPostFeatures(text: string): {
  cashtag_count: number;
  mention_count: number;
  url_count: number;
  caps_ratio: number;
} {
  // Count cashtags ($SYMBOL)
  const cashtagMatches = text.match(/\$[A-Z]{1,5}/g);
  const cashtag_count = cashtagMatches?.length ?? 0;

  // Count @mentions
  const mentionMatches = text.match(/@\w+/g);
  const mention_count = mentionMatches?.length ?? 0;

  // Count URLs
  const urlMatches = text.match(/https?:\/\/\S+/g);
  const url_count = urlMatches?.length ?? 0;

  // Calculate caps ratio (excluding URLs and mentions)
  const cleanText = text.replace(/https?:\/\/\S+/g, "").replace(/@\w+/g, "").replace(/\$[A-Z]+/g, "");
  const letters = cleanText.replace(/[^a-zA-Z]/g, "");
  const upperCount = (letters.match(/[A-Z]/g) || []).length;
  const caps_ratio = letters.length > 0 ? upperCount / letters.length : 0;

  return { cashtag_count, mention_count, url_count, caps_ratio };
}
