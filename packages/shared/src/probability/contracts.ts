import { z } from "zod";

export const probabilityEngineInputSchema = z.object({
  market_id: z.string(),
  outcomes: z.array(
    z.object({
      id: z.string(),
      label: z.string()
    })
  ),
  posts: z.array(
    z.object({
      id: z.string(),
      scores: z.record(
        z.string(),
        z.object({
          relevance: z.number(),
          stance: z.number(),
          strength: z.number(),
          credibility: z.number()
        })
      ),
      metrics: z
        .object({
          author_followers: z.number().nullable(),
          author_verified: z.boolean().nullable(),
          initial_metrics: z
            .object({
              likes: z.number().nullable(),
              reposts: z.number().nullable(),
              replies: z.number().nullable(),
              quotes: z.number().nullable()
            })
            .partial()
        })
        .partial()
    })
  ),
  formula_version: z.string().default("placeholder-v0")
});

export const probabilityEngineResultSchema = z.object({
  market_id: z.string(),
  probabilities: z.record(z.string(), z.number()),
  algorithm: z.string(),
  notes: z.string().optional()
});

export type ProbabilityEngineInput = z.infer<typeof probabilityEngineInputSchema>;
export type ProbabilityEngineResult = z.infer<typeof probabilityEngineResultSchema>;

