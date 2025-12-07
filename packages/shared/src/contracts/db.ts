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
  post_count: z.number().int().nullable()
});

export const rawPostRowSchema = z.object({
  id: z.string().uuid(),
  market_id: z.string().uuid(),
  x_post_id: z.string(),
  ingested_at: z.string(),
  expires_at: z.string().nullable(),
  text: z.string(),
  author_id: z.string().nullable(),
  author_followers: z.number().int().nullable(),
  author_verified: z.boolean().nullable(),
  metrics: z.record(z.any()).nullable(),
  is_active: z.boolean().nullable()
});

export const scoredPostRowSchema = z.object({
  id: z.string().uuid(),
  raw_post_id: z.string().uuid(),
  market_id: z.string().uuid(),
  outcome_id: z.string(),
  scores: z.record(z.any()),
  scored_at: z.string(),
  display_labels: z
    .object({
      stance_label: z.string(),
      credibility_label: z.string(),
      reason: z.string()
    })
    .nullable()
});

export const probabilitySnapshotSchema = z.object({
  id: z.string().uuid(),
  market_id: z.string().uuid(),
  timestamp: z.string(),
  probabilities: z.record(z.number())
});

export type MarketRow = z.infer<typeof marketRowSchema>;
export type OutcomeRow = z.infer<typeof outcomeRowSchema>;
export type RawPostRow = z.infer<typeof rawPostRowSchema>;
export type ScoredPostRow = z.infer<typeof scoredPostRowSchema>;
export type ProbabilitySnapshotRow = z.infer<typeof probabilitySnapshotSchema>;

