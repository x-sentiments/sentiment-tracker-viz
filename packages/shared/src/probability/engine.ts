import {
  probabilityEngineInputSchema,
  probabilityEngineResultSchema,
  ProbabilityEngineInput,
  ProbabilityEngineResult,
  PostInput,
  OutcomeDef
} from "./contracts";

// ============================================================================
// Constants
// ============================================================================

const EPS = 1e-12;
const LN2 = Math.log(2);

// Time decay parameters
const GRACE_SEC = 300; // 5 minutes immunity
const HALF_LIFE_SEC = 6 * 3600; // 6 hours
const MAX_AGE_SEC = 72 * 3600; // 72 hours hard cutoff

// Evidence calculation parameters
const GAMMA = 1.15; // superlinear reward for strong evidence
const STANCE_K = 1.6; // tanh squashing factor

// Thresholds for accepting posts
const W_MIN = 0.018; // minimum effective weight after grace period

// Author metrics normalization (sigmoid centers)
const MU_F = 8; // ~3k followers center
const SIG_F = 1.5;
const MU_E = 2; // engagement center
const SIG_E = 1.5;

// Temperature and inertia
const T0 = 1.0;
const ALPHA = 0.6;
const TAU = 0.65;

// ============================================================================
// Utility Functions
// ============================================================================

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Numerically stable softmax
 */
function softmaxStable(logits: number[]): number[] {
  const m = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - m));
  const s = exps.reduce((a, b) => a + b, 0) + EPS;
  return exps.map((e) => e / s);
}

/**
 * Apply probability floor and renormalize
 */
function renormFloor(probs: number[], floor: number): number[] {
  const floored = probs.map((p) => Math.max(p, floor));
  const s = floored.reduce((a, b) => a + b, 0) + EPS;
  return floored.map((p) => p / s);
}

/**
 * Convert probabilities to centered logits for stable updates
 */
function centeredLogitsFromProbs(probs: number[]): number[] {
  const logs = probs.map((p) => Math.log(p + EPS));
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
  return logs.map((l) => l - mean);
}

// ============================================================================
// Time Decay
// ============================================================================

/**
 * Time decay function with 5-minute grace period
 * - Within grace: D = 1.0
 * - After grace: exponential decay with 6h half-life
 */
function timeDecay(ageSec: number): number {
  if (ageSec <= GRACE_SEC) return 1;
  return Math.exp(-LN2 * ((ageSec - GRACE_SEC) / HALF_LIFE_SEC));
}

// ============================================================================
// Author & Engagement Weight
// ============================================================================

/**
 * Compute metric weight M from author stats and initial engagement
 * M = (0.75 + 0.25*f) * (0.85 + 0.15*e) * verifiedMult
 */
function computeMetricWeight(post: PostInput): number {
  const followers = Math.max(0, post.author_followers ?? 0);
  const verified = !!post.author_verified;

  const likes = post.initial_metrics?.likes ?? 0;
  const reposts = post.initial_metrics?.reposts ?? 0;
  const replies = post.initial_metrics?.replies ?? 0;
  const quotes = post.initial_metrics?.quotes ?? 0;

  // Engagement score (weighted log)
  const E = Math.log1p(likes + 2 * reposts + 1.5 * replies + 2.5 * quotes);

  // Normalized follower and engagement scores via sigmoid
  const f = sigmoid((Math.log1p(followers) - MU_F) / SIG_F);
  const e = sigmoid((E - MU_E) / SIG_E);

  // Combined metric weight with verified multiplier (1.2x for verified)
  const M = (0.75 + 0.25 * f) * (0.85 + 0.15 * e) * (verified ? 1.2 : 1.0);
  return M;
}

// ============================================================================
// Same-Author Dilution
// ============================================================================

/**
 * Compute author dilution factor A
 * First post = 1.0, subsequent posts get diminishing weight
 * A = max(0.35, 1 / sqrt(1 + 0.75 * max(0, n-1)))
 */
function authorDilution(authorPostCount: number): number {
  return Math.max(0.35, 1 / Math.sqrt(1 + 0.75 * Math.max(0, authorPostCount - 1)));
}

// ============================================================================
// Spam / Manipulation Penalties
// ============================================================================

/**
 * Compute spam penalty S from post features
 * - Cashtag penalty: 6+ → 0.55, 4+ → 0.75, else 1.0
 * - URL penalty: 2+ → 0.85, else 1.0
 * - Caps penalty: >60% caps → 0.9, else 1.0
 */
function computeSpamPenalty(post: PostInput): number {
  const cashtags = post.features?.cashtag_count ?? 0;
  const urls = post.features?.url_count ?? 0;
  const capsRatio = post.features?.caps_ratio ?? 0;

  const Sc = cashtags >= 6 ? 0.55 : cashtags >= 4 ? 0.75 : 1.0;
  const Su = urls >= 2 ? 0.85 : 1.0;
  const Scaps = capsRatio > 0.6 ? 0.9 : 1.0;

  return Sc * Su * Scaps;
}

// ============================================================================
// Post-Level Signal Calculations
// ============================================================================

interface PostSignals {
  maxRelevance: number;
  maxCredibility: number;
  Zp: number; // max semantic * stance magnitude
  Wp: number; // effective weight for thresholding
}

/**
 * Compute post-level signals for thresholding
 */
function computePostSignals(
  post: PostInput,
  outcomes: OutcomeDef[],
  M: number,
  A: number,
  D: number,
  S: number
): PostSignals {
  let maxRelevance = 0;
  let maxCredibility = 0;
  let Zp = 0;

  for (const outcome of outcomes) {
    const sc = post.scores[outcome.id];
    if (!sc) continue;

    const r = clamp(sc.relevance, 0, 1);
    const st = clamp(sc.strength, 0, 1);
    const cr = clamp(sc.credibility, 0, 1);
    const stance = clamp(sc.stance, -1, 1);

    maxRelevance = Math.max(maxRelevance, r);
    maxCredibility = Math.max(maxCredibility, cr);

    const sem = r * st * cr;
    Zp = Math.max(Zp, sem * Math.abs(stance));
  }

  const Wp = Math.pow(Zp, GAMMA) * M * A * D * S;

  return { maxRelevance, maxCredibility, Zp, Wp };
}

/**
 * Check if post passes acceptance thresholds
 */
function shouldAcceptPost(
  signals: PostSignals,
  ageSec: number
): boolean {
  const { maxRelevance, maxCredibility, Zp, Wp } = signals;

  // During grace period: lower thresholds
  if (ageSec <= GRACE_SEC) {
    return maxRelevance >= 0.1 && Zp >= 0.025;
  }

  // After grace: stricter thresholds
  return maxRelevance >= 0.2 && maxCredibility >= 0.15 && Wp >= W_MIN;
}

// ============================================================================
// Evidence Delta Calculation
// ============================================================================

/**
 * Compute per-outcome evidence deltas for an accepted post
 */
function computeEvidenceDeltas(
  post: PostInput,
  outcomes: OutcomeDef[],
  M: number,
  A: number,
  D: number,
  S: number,
  K: number
): number[] {
  const deltas = new Array(K).fill(0);

  for (let i = 0; i < K; i++) {
    const sc = post.scores[outcomes[i].id];
    if (!sc) continue;

    const r = clamp(sc.relevance, 0, 1);
    const st = clamp(sc.strength, 0, 1);
    const cr0 = clamp(sc.credibility, 0, 1);
    const conf = clamp(sc.confidence ?? 1, 0, 1);
    const cr = cr0 * conf; // credibility adjusted by confidence
    const stance = clamp(sc.stance, -1, 1);

    const sem = r * st * cr;
    const stanceAdj = Math.tanh(STANCE_K * stance);

    // Evidence delta normalized by sqrt(K) to keep volatility similar across market sizes
    deltas[i] = (stanceAdj * Math.pow(sem, GAMMA) * M * A * D * S) / Math.sqrt(K);
  }

  return deltas;
}

// ============================================================================
// Main Engine Function
// ============================================================================

/**
 * Compute probabilities using evidence-softmax-v1 algorithm
 *
 * Features:
 * - 5-minute immunity, then 6h half-life decay
 * - 72h hard cutoff
 * - Same-author dilution
 * - Spam/manipulation penalties
 * - Engagement + verified weighting
 * - Adaptive temperature based on evidence mass
 * - Inertia (mixing coefficient) based on evidence mass
 * - Probability floors with renormalization
 */
export function computeProbabilitiesV1(input: ProbabilityEngineInput): ProbabilityEngineResult {
  const { market_id, now_ms, outcomes, prev_probabilities, posts } = input;
  const K = outcomes.length;

  if (K === 0) {
    return {
      market_id,
      probabilities: {},
      algorithm: "evidence-softmax-v1",
      notes: { accepted_posts: 0, Wbatch: 0, beta: 0, temperature: T0, floor: 0 }
    };
  }

  // -------------------------------------------------------------------------
  // Initialize previous probabilities (from priors or uniform)
  // -------------------------------------------------------------------------
  const priors = outcomes.map((o) => clamp(o.prior_probability ?? 1 / K, 1e-6, 1));
  const priorsNorm = (() => {
    const s = priors.reduce((a, b) => a + b, 0) + EPS;
    return priors.map((p) => p / s);
  })();

  const prev = outcomes.map((o, i) => {
    const p = prev_probabilities?.[o.id];
    return p == null ? priorsNorm[i] : clamp(p, 1e-6, 1);
  });
  const prevNorm = (() => {
    const s = prev.reduce((a, b) => a + b, 0) + EPS;
    return prev.map((p) => p / s);
  })();

  // -------------------------------------------------------------------------
  // Count posts per author in last 24h for dilution
  // -------------------------------------------------------------------------
  const authorCounts = new Map<string, number>();
  const DAY_MS = 24 * 3600 * 1000;

  for (const p of posts) {
    if (now_ms - p.created_at_ms <= DAY_MS) {
      authorCounts.set(p.author_id, (authorCounts.get(p.author_id) ?? 0) + 1);
    }
  }

  // -------------------------------------------------------------------------
  // Process each post and accumulate evidence
  // -------------------------------------------------------------------------
  const deltaE = new Array(K).fill(0);
  let Wbatch = 0;
  let accepted = 0;

  for (const p of posts) {
    const ageSec = Math.max(0, (now_ms - p.created_at_ms) / 1000);

    // Hard age cutoff
    if (ageSec > MAX_AGE_SEC) continue;

    // Time decay
    const D = timeDecay(ageSec);

    // Metric weight (engagement + followers + verified)
    const M = computeMetricWeight(p);

    // Author dilution
    const n = authorCounts.get(p.author_id) ?? 1;
    const A = authorDilution(n);

    // Spam penalty
    const S = computeSpamPenalty(p);

    // Post-level signals for thresholding
    const signals = computePostSignals(p, outcomes, M, A, D, S);

    // Threshold check
    if (!shouldAcceptPost(signals, ageSec)) continue;

    // Compute evidence deltas
    const deltas = computeEvidenceDeltas(p, outcomes, M, A, D, S, K);

    for (let i = 0; i < K; i++) {
      deltaE[i] += deltas[i];
    }

    Wbatch += signals.Wp;
    accepted++;
  }

  // -------------------------------------------------------------------------
  // Convert previous probs to centered logits and apply evidence
  // -------------------------------------------------------------------------
  const prevLogits = centeredLogitsFromProbs(prevNorm);
  const instLogits = prevLogits.map((l, i) => l + deltaE[i]);

  // -------------------------------------------------------------------------
  // Adaptive temperature (wider when evidence is weak)
  // -------------------------------------------------------------------------
  const T = T0 * (1 + ALPHA / Math.sqrt(1 + Wbatch));

  // -------------------------------------------------------------------------
  // Softmax to get instantaneous probabilities
  // -------------------------------------------------------------------------
  const pInst = softmaxStable(instLogits.map((x) => x / T));

  // -------------------------------------------------------------------------
  // Inertia: mix previous and instantaneous based on evidence mass
  // -------------------------------------------------------------------------
  const beta = 1 - Math.exp(-Wbatch / TAU);
  const pNew = prevNorm.map((p, i) => (1 - beta) * p + beta * pInst[i]);

  // -------------------------------------------------------------------------
  // Apply floor and renormalize
  // -------------------------------------------------------------------------
  const floor = Math.max(0.001, 0.01 / K);
  const pFinal = renormFloor(pNew, floor);

  // -------------------------------------------------------------------------
  // Build output
  // -------------------------------------------------------------------------
  const probabilities: Record<string, number> = {};
  outcomes.forEach((o, i) => {
    probabilities[o.id] = pFinal[i];
  });

  return {
    market_id,
    probabilities,
    algorithm: "evidence-softmax-v1",
    notes: {
      accepted_posts: accepted,
      Wbatch,
      beta,
      temperature: T,
      floor
    }
  };
}

/**
 * Main entry point - dispatches to the appropriate algorithm version
 */
export function computeProbabilities(input: ProbabilityEngineInput): ProbabilityEngineResult {
  const parsed = probabilityEngineInputSchema.parse(input);

  // Route to appropriate algorithm
  switch (parsed.formula_version) {
    case "evidence-softmax-v1":
    default:
      return computeProbabilitiesV1(parsed);
  }
}
