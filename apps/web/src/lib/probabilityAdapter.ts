import { computeProbabilities as sharedCompute } from "@shared/probability/engine";
import { ProbabilityEngineInput, ProbabilityEngineResult } from "@shared/probability/contracts";

export async function computeProbabilities(_marketId: string, payload: ProbabilityEngineInput): Promise<ProbabilityEngineResult> {
  // Placeholder adapter; in future, enrich with market context and persistence.
  return sharedCompute(payload);
}


