import { z } from "zod";

export const grokOutcomeSchema = z.object({
  id: z.string(),
  label: z.string(),
  prior: z.number().min(0).max(1)
});

export const grokMarketResponseSchema = z.object({
  normalized_question: z.string(),
  outcomes: z.array(grokOutcomeSchema).min(2),
  x_rule_templates: z.array(z.string()).min(1)
});

export type GrokOutcome = z.infer<typeof grokOutcomeSchema>;
export type GrokMarketResponse = z.infer<typeof grokMarketResponseSchema>;
