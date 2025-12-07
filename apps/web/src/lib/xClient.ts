type Rule = { value: string; tag?: string };

const X_API_BASE = "https://api.x.com/2";
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;

async function xPost<T>(path: string, payload: unknown): Promise<T> {
  if (!X_BEARER_TOKEN) throw new Error("X_BEARER_TOKEN not configured");

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

export async function createFilteredRulesForMarket(marketId: string, templates: string[]): Promise<Rule[]> {
  // Placeholder: convert templates directly to rules.
  const rules = templates.map((tpl) => ({ value: tpl, tag: `market:${marketId}` }));
  await xPost("/tweets/search/stream/rules", { add: rules });
  return rules;
}

export async function connectStream(handler: (post: unknown) => Promise<void>): Promise<void> {
  // Placeholder: this will be implemented in a long-lived worker; for now, no-op.
  void handler;
}


