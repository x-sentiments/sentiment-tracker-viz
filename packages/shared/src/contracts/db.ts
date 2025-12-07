import { z } from "zod";

export const marketRowSchema = z.object({
  id: z.string().uuid(),
  question: z.string(),
  normalized_question: z.string().nullable(),
  status: z.enum(["active", "closed", "resolved"]),
  created_at: z.string(),
  x_rule_templates: z.unknown().nullable(),
  total_posts_processed: z.number().int().nullable()
});

export const outcomeRowSchema = z.object({
  id: z.string().uuid(),
  market_id: z.string().uuid(),
  outcome_id: z.string(),
  label: z.string(),
  current_probability: z.number().nullable(),
  cumulative_support: z.number().nullable(),
  cumulative_oppose: z.number().nullable(),
  post_count: z.number().int().nullable(),
  prior_probability: z.number().nullable()
});

export const postFeaturesSchema = z.object({
  cashtag_count: z.number().optional(),
  mention_count: z.number().optional(),
  url_count: z.number().optional(),
  caps_ratio: z.number().optional(),
  is_reply: z.boolean().optional(),
  is_quote: z.boolean().optional()
});

export const postMetricsSchema = z.object({
  likes: z.number().optional(),
  reposts: z.number().optional(),
  replies: z.number().optional(),
  quotes: z.number().optional()
});

export const rawPostRowSchema = z.object({
  id: z.string().uuid(),
  market_id: z.string().uuid(),
  x_post_id: z.string(),
  ingested_at: z.string(),
  expires_at: z.string().nullable(),
  post_created_at: z.string().nullable(),
  text: z.string(),
  author_id: z.string().nullable(),
  author_followers: z.number().int().nullable(),
  author_verified: z.boolean().nullable(),
  author_created_at: z.string().nullable(),
  metrics: postMetricsSchema.nullable(),
  features: postFeaturesSchema.nullable(),
  is_active: z.boolean().nullable()
});

export const postFlagsSchema = z.object({
  is_sarcasm: z.boolean(),
  is_question: z.boolean(),
  is_quote: z.boolean(),
  is_rumor_style: z.boolean()
});

export const displayLabelsSchema = z.object({
  summary: z.string(),
  reason: z.string(),
  credibility_label: z.enum(["High", "Medium", "Low"]),
  stance_label: z.string()
});

export const perOutcomeScoresSchema = z.object({
  relevance: z.number(),
  stance: z.number(),
  strength: z.number(),
  credibility: z.number(),
  confidence: z.number().optional()
});

export const scoredPostRowSchema = z.object({
  id: z.string().uuid(),
  raw_post_id: z.string().uuid(),
  market_id: z.string().uuid(),
  outcome_id: z.string(),
  scores: perOutcomeScoresSchema,
  scored_at: z.string(),
  flags: postFlagsSchema.nullable(),
  display_labels: displayLabelsSchema.nullable()
});

export const probabilitySnapshotSchema = z.object({
  id: z.string().uuid(),
  market_id: z.string().uuid(),
  timestamp: z.string(),
  probabilities: z.record(z.number())
});

export const marketStateSchema = z.object({
  market_id: z.string().uuid(),
  probabilities: z.record(z.number()),
  updated_at: z.string(),
  post_counts: z.number().int().nullable()
});

export const marketXRuleSchema = z.object({
  id: z.string().uuid(),
  market_id: z.string().uuid(),
  rule: z.string(),
  created_at: z.string()
});

export type MarketRow = z.infer<typeof marketRowSchema>;
export type OutcomeRow = z.infer<typeof outcomeRowSchema>;
export type RawPostRow = z.infer<typeof rawPostRowSchema>;
export type ScoredPostRow = z.infer<typeof scoredPostRowSchema>;
export type ProbabilitySnapshotRow = z.infer<typeof probabilitySnapshotSchema>;
export type MarketStateRow = z.infer<typeof marketStateSchema>;
export type MarketXRuleRow = z.infer<typeof marketXRuleSchema>;
export type PostFeatures = z.infer<typeof postFeaturesSchema>;
export type PostMetrics = z.infer<typeof postMetricsSchema>;
export type PostFlags = z.infer<typeof postFlagsSchema>;
export type DisplayLabels = z.infer<typeof displayLabelsSchema>;
export type PerOutcomeScores = z.infer<typeof perOutcomeScoresSchema>;
