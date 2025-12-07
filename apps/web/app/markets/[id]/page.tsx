"use client";

// NOTE: This file was converted to a Server Component style fetch-and-render
// to avoid client-side loading stalls. The ProbabilityChart remains a client
// component, imported dynamically to avoid SSR issues.

import Link from "next/link";
import dynamic from "next/dynamic";
import { getSupabaseClient } from "../../../src/lib/supabase";

export const revalidate = 0;

// Dynamic import to avoid SSR issues with lightweight-charts
const ProbabilityChart = dynamic(() => import("./ProbabilityChart"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "300px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" />
    </div>
  ),
});

interface Outcome {
  id: string;
  outcome_id: string;
  label: string;
  current_probability: number | null;
  prior_probability: number | null;
}

interface Market {
  id: string;
  question: string;
  normalized_question: string | null;
  status: string;
  created_at: string;
  total_posts_processed: number | null;
}

interface Snapshot {
  timestamp: string;
  probabilities: Record<string, number>;
}

interface DisplayLabels {
  summary: string;
  reason: string;
  credibility_label: "High" | "Medium" | "Low";
  stance_label: string;
}

interface Post {
  id: string;
  text: string;
  author_id: string | null;
  author_followers: number | null;
  author_verified: boolean | null;
  post_created_at: string | null;
}

async function fetchServerData(id: string) {
  const supabase = getSupabaseClient();

  // Market
  const { data: market, error: marketError } = await supabase
    .from("markets")
    .select("*")
    .eq("id", id)
    .single();

  if (marketError || !market) {
    return { error: "Market not found" };
  }

  // Outcomes
  const { data: outcomes } = await supabase
    .from("outcomes")
    .select("*")
    .eq("market_id", id);

  // Market state probabilities
  const { data: state } = await supabase
    .from("market_state")
    .select("probabilities")
    .eq("market_id", id)
    .maybeSingle();

  // History
  const { data: snapshots } = await supabase
    .from("probability_snapshots")
    .select("timestamp,probabilities")
    .eq("market_id", id)
    .order("timestamp", { ascending: true });

  // Posts (latest 20)
  const { data: posts } = await supabase
    .from("raw_posts")
    .select("id,text,author_id,author_followers,author_verified,post_created_at")
    .eq("market_id", id)
    .order("post_created_at", { ascending: false })
    .limit(20);

  return {
    market,
    outcomes: outcomes || [],
    probabilities: (state?.probabilities as Record<string, number>) ?? {},
    snapshots: snapshots || [],
    posts: posts || [],
  };
}

export default async function MarketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id;
  const result = await fetchServerData(id);

  if ("error" in result) {
    return (
      <main className="container" style={{ padding: "32px 24px" }}>
        <div className="empty-state">
          <div className="empty-state-icon">❌</div>
          <p>{result.error}</p>
          <Link href="/markets" style={{ color: "var(--accent-blue)" }}>
            ← Back to markets
          </Link>
        </div>
      </main>
    );
  }

  const { market, outcomes, probabilities, snapshots, posts } = result;
  const historySnapshots = snapshots as Snapshot[];

  function formatProb(prob: number | null): string {
    if (prob === null || prob === undefined) return "—";
    return `${(prob * 100).toFixed(1)}%`;
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function formatFollowers(count: number | null): string {
    if (!count) return "";
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  }

  // Color palette for outcomes (hex for chart compatibility)
  const outcomeColors = [
    "#22c55e", // green
    "#3b82f6", // blue
    "#a855f7", // purple
    "#f97316", // orange
    "#ef4444", // red
  ];

  const displayOutcomes =
    Object.keys(probabilities || {}).length > 0
      ? Object.keys(probabilities).map((oid) => {
          const match = outcomes.find((o) => o.outcome_id === oid);
          return (
            match || {
              id: oid,
              outcome_id: oid,
              label: oid,
              current_probability: probabilities[oid],
              prior_probability: null,
            }
          );
        })
      : outcomes;

  if (!market) {
    return (
      <main className="container" style={{ padding: "32px 24px" }}>
        <div className="empty-state">
          <div className="empty-state-icon">❌</div>
          <p>Market not found</p>
          <Link href="/markets" style={{ color: "var(--accent-blue)" }}>
            ← Back to markets
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container market-detail">
      {/* Breadcrumb */}
      <div style={{ marginBottom: "24px" }}>
        <Link href="/markets" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          ← All Markets
        </Link>
      </div>

      {/* Header */}
      <div className="market-detail-header">
        <h1 className="market-detail-question">
          {market.normalized_question || market.question}
        </h1>
        <div className="market-meta">
          Created {formatDate(market.created_at)} • {market.total_posts_processed ?? 0} posts analyzed
        </div>
      </div>

      {/* Outcome Cards */}
      <div className="outcomes-grid">
        {displayOutcomes.map((outcome, i) => (
          <div
            key={outcome.id}
            className="outcome-card"
            style={{ borderTop: `3px solid ${outcomeColors[i % outcomeColors.length]}` }}
          >
            <div className="outcome-card-label">{outcome.label}</div>
            <div
              className="outcome-card-prob"
              style={{ color: outcomeColors[i % outcomeColors.length] }}
            >
              {formatProb(
                probabilities[outcome.outcome_id] ??
                  outcome.current_probability
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="chart-container">
        <div className="chart-title">Probability Over Time</div>
        <ProbabilityChart 
          outcomes={outcomes} 
          history={historySnapshots} 
          colors={outcomeColors} 
        />
      </div>

      {/* Curated Posts */}
      <div className="posts-section">
        <div className="posts-title">Influential Posts</div>
        {posts.length === 0 ? (
          <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "24px" }}>
            No posts scored yet. Posts will appear here as they are analyzed.
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="post-card">
              <p className="post-text">{post.text}</p>
              <div className="post-meta">
                <span>
                  @{post.author_id || "unknown"}
                  {post.author_verified && " ✓"}
                  {post.author_followers && ` • ${formatFollowers(post.author_followers)} followers`}
                </span>
                <span>{formatDate(post.post_created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
