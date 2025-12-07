import { z } from "zod";

export const grokPerOutcomeScoreSchema = z.object({
  relevance: z.number().min(0).max(1),
  stance: z.number().min(-1).max(1),
  strength: z.number().min(0).max(1),
  credibility: z.number().min(0).max(1)
});

export const grokScoresSchema = z.record(z.string(), grokPerOutcomeScoreSchema);

export const grokScoreBatchResponseSchema = z.object({
  scores: z.record(z.string(), grokScoresSchema)
});

export type GrokScoreBatchResponse = z.infer<typeof grokScoreBatchResponseSchema>;

