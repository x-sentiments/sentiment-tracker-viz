import { grokMarketResponseSchema, GrokMarketResponse } from "@shared/llm/grokMarket";
import { grokScoreBatchResponseSchema, GrokScoreBatchResponse } from "@shared/llm/grokScoring";
import { grokLabelBatchResponseSchema, GrokLabelBatchResponse } from "@shared/llm/grokLabels";

const GROK_BASE_URL = process.env.GROK_BASE_URL || "https://api.x.ai/v1";
const GROK_API_KEY = process.env.GROK_API_KEY;

async function postJson<T>(path: string, payload: unknown, schema: (input: unknown) => T): Promise<T> {
  if (!GROK_API_KEY) {
    throw new Error("GROK_API_KEY not configured");
  }

  const res = await fetch(`${GROK_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROK_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  return schema(json);
}

export async function createMarketFromQuestion(question: string): Promise<GrokMarketResponse> {
  // Placeholder: wire prompt once available.
  return postJson("/grok/market", { question }, (data) => grokMarketResponseSchema.parse(data));
}

export async function scorePostsForMarket(payload: unknown): Promise<GrokScoreBatchResponse> {
  // Placeholder endpoint until prompt is finalized.
  return postJson("/grok/score-posts", payload, (data) => grokScoreBatchResponseSchema.parse(data));
}

export async function labelPostsForDisplay(payload: unknown): Promise<GrokLabelBatchResponse> {
  return postJson("/grok/label-posts", payload, (data) => grokLabelBatchResponseSchema.parse(data));
}


