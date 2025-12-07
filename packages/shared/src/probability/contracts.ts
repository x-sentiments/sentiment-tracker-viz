import { z } from "zod";

/**
 * Per-outcome scores from Grok scoring
 */
export const outcomeScoresSchema = z.object({
  relevance: z.number().min(0).max(1),
  stance: z.number().min(-1).max(1),
  strength: z.number().min(0).max(1),
  credibility: z.number().min(0).max(1),
  /** Confidence that the scoring is reliable (handles sarcasm, ambiguity) */
  confidence: z.number().min(0).max(1).optional().default(1)
});

export type OutcomeScores = z.infer<typeof outcomeScoresSchema>;

/**
 * Post features for spam/manipulation detection
 */
export const postFeaturesSchema = z.object({
  cashtag_count: z.number().optional(),
  mention_count: z.number().optional(),
  url_count: z.number().optional(),
  is_reply: z.boolean().optional(),
  is_quote: z.boolean().optional(),
  caps_ratio: z.number().optional()
});

export type PostFeatures = z.infer<typeof postFeaturesSchema>;

/**
 * Initial engagement metrics captured at ingestion time
 */
export const initialMetricsSchema = z.object({
  likes: z.number().nullable().optional(),
  reposts: z.number().nullable().optional(),
  replies: z.number().nullable().optional(),
  quotes: z.number().nullable().optional()
});

export type InitialMetrics = z.infer<typeof initialMetricsSchema>;

/**
 * Single post input to the probability engine
 */
export const postInputSchema = z.object({
  id: z.string(),
  /** X post creation timestamp in milliseconds */
  created_at_ms: z.number(),
  /** X author ID for same-author dilution */
  author_id: z.string(),
  /** Author account creation timestamp (optional, helps credibility) */
  author_created_at_ms: z.number().nullable().optional(),
  /** Author follower count */
  author_followers: z.number().nullable().optional(),
  /** Author verified status */
  author_verified: z.boolean().nullable().optional(),
  /** Initial engagement metrics at ingestion */
  initial_metrics: initialMetricsSchema.optional(),
  /** Extracted features for spam detection */
  features: postFeaturesSchema.optional(),
  /** Per-outcome scores from Grok */
  scores: z.record(z.string(), outcomeScoresSchema)
});

export type PostInput = z.infer<typeof postInputSchema>;

/**
 * Outcome definition with optional prior probability
 */
export const outcomeDefSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Prior probability for new/unexpected outcomes (defaults to uniform) */
  prior_probability: z.number().min(0).max(1).nullable().optional()
});

export type OutcomeDef = z.infer<typeof outcomeDefSchema>;

/**
 * Full input to the probability engine
 */
export const probabilityEngineInputSchema = z.object({
  market_id: z.string(),
  /** Current timestamp in milliseconds (for time decay calculations) */
  now_ms: z.number(),
  outcomes: z.array(outcomeDefSchema),
  /** Previous probabilities (if updating incrementally) */
  prev_probabilities: z.record(z.string(), z.number()).optional(),
  posts: z.array(postInputSchema),
  /** Formula version for algorithm selection */
  formula_version: z.string().default("evidence-softmax-v1")
});

export type ProbabilityEngineInput = z.infer<typeof probabilityEngineInputSchema>;

/**
 * Engine result notes (diagnostic info, not exposed to users)
 */
export const engineNotesSchema = z.object({
  accepted_posts: z.number(),
  Wbatch: z.number(),
  beta: z.number(),
  temperature: z.number(),
  floor: z.number()
});

export type EngineNotes = z.infer<typeof engineNotesSchema>;

/**
 * Probability engine output
 */
export const probabilityEngineResultSchema = z.object({
  market_id: z.string(),
  probabilities: z.record(z.string(), z.number()),
  algorithm: z.string(),
  notes: engineNotesSchema.optional()
});

export type ProbabilityEngineResult = z.infer<typeof probabilityEngineResultSchema>;
