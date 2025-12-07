import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Config } from "./config.js";

let client: SupabaseClient | null = null;

export function getSupabaseClient(config: Config): SupabaseClient {
  if (!client) {
    client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
  }
  return client;
}

export interface Market {
  id: string;
  question: string;
  normalized_question: string;
  status: string;
  x_rule_templates: string[];
}

export interface StreamRule {
  id: string;
  market_id: string;
  rule: string;
  x_rule_id: string | null;
  rule_tag: string | null;
}

export async function getActiveMarkets(config: Config): Promise<Market[]> {
  const supabase = getSupabaseClient(config);
  
  const { data, error } = await supabase
    .from("markets")
    .select("id, question, normalized_question, status, x_rule_templates")
    .eq("status", "active");

  if (error) {
    throw new Error(`Failed to fetch markets: ${error.message}`);
  }

  return data || [];
}

export async function getStreamRules(config: Config): Promise<StreamRule[]> {
  const supabase = getSupabaseClient(config);
  
  const { data, error } = await supabase
    .from("market_x_rules")
    .select("*");

  if (error) {
    throw new Error(`Failed to fetch stream rules: ${error.message}`);
  }

  return data || [];
}

export async function saveStreamRule(
  config: Config,
  marketId: string,
  xRuleId: string,
  ruleValue: string,
  ruleTag: string
): Promise<void> {
  const supabase = getSupabaseClient(config);
  
  const { error } = await supabase.from("market_x_rules").insert({
    market_id: marketId,
    x_rule_id: xRuleId,
    rule: ruleValue,
    rule_tag: ruleTag,
  });

  if (error) {
    throw new Error(`Failed to save stream rule: ${error.message}`);
  }
}

export async function deleteStreamRule(config: Config, xRuleId: string): Promise<void> {
  const supabase = getSupabaseClient(config);
  
  const { error } = await supabase
    .from("market_x_rules")
    .delete()
    .eq("x_rule_id", xRuleId);

  if (error) {
    throw new Error(`Failed to delete stream rule: ${error.message}`);
  }
}

