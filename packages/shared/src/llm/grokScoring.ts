import { z } from "zod";

/**
 * Per-outcome scores from Grok
 */
export const grokPerOutcomeScoreSchema = z.object({
  relevance: z.number().min(0).max(1),
  stance: z.number().min(-1).max(1),
  strength: z.number().min(0).max(1),
  credibility: z.number().min(0).max(1),
  /** Confidence that the scoring is reliable (handles sarcasm, ambiguity, quotes) */
  confidence: z.number().min(0).max(1)
});

export type GrokPerOutcomeScore = z.infer<typeof grokPerOutcomeScoreSchema>;

/**
 * Flags indicating special post characteristics
 */
export const grokPostFlagsSchema = z.object({
  is_sarcasm: z.boolean(),
  is_question: z.boolean(),
  is_quote: z.boolean(),
  is_rumor_style: z.boolean()
});

export type GrokPostFlags = z.infer<typeof grokPostFlagsSchema>;

/**
 * Display labels for UI (human-readable)
 */
export const grokDisplayLabelsSchema = z.object({
  /** 1-sentence neutral summary of the post */
  summary: z.string(),
  /** 1-sentence why it matters for this market */
  reason: z.string(),
  /** Credibility assessment */
  credibility_label: z.enum(["High", "Medium", "Low"]),
  /** e.g. "Bullish on Trump", "Bearish on Harris", "Mixed" */
  stance_label: z.string()
});

export type GrokDisplayLabels = z.infer<typeof grokDisplayLabelsSchema>;

/**
 * Single post result from Grok scoring
 */
export const grokPostResultSchema = z.object({
  post_id: z.string(),
  per_outcome: z.record(z.string(), grokPerOutcomeScoreSchema),
  flags: grokPostFlagsSchema,
  display_labels: grokDisplayLabelsSchema
});

export type GrokPostResult = z.infer<typeof grokPostResultSchema>;

/**
 * Full Grok scoring batch response
 */
export const grokScoreBatchResponseSchema = z.object({
  results: z.array(grokPostResultSchema)
});

export type GrokScoreBatchResponse = z.infer<typeof grokScoreBatchResponseSchema>;

/**
 * Grok scoring request: market context + posts batch
 */
export const grokScoringRequestSchema = z.object({
  market: z.object({
    market_id: z.string(),
    question: z.string(),
    outcomes: z.array(
      z.object({
        id: z.string(),
        label: z.string()
      })
    )
  }),
  posts: z.array(
    z.object({
      post_id: z.string(),
      created_at_ms: z.number(),
      text: z.string(),
      author: z.object({
        verified: z.boolean().nullable().optional(),
        followers: z.number().nullable().optional(),
        bio: z.string().nullable().optional()
      }),
      initial_metrics: z
        .object({
          likes: z.number().optional(),
          reposts: z.number().optional(),
          replies: z.number().optional(),
          quotes: z.number().optional()
        })
        .optional()
    })
  )
});

export type GrokScoringRequest = z.infer<typeof grokScoringRequestSchema>;
