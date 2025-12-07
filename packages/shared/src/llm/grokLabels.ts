import { z } from "zod";

export const grokLabelSchema = z.object({
  stance_label: z.string(),
  credibility_label: z.string(),
  reason: z.string()
});

export const grokLabelBatchResponseSchema = z.object({
  labels: z.record(z.string(), grokLabelSchema)
});

export type GrokLabelBatchResponse = z.infer<typeof grokLabelBatchResponseSchema>;

