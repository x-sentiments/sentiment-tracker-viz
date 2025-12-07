"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

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
  display_labels: DisplayLabels | null;
}

export default function MarketDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [market, setMarket] = useState<Market | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [probabilities, setProbabilities] = useState<Record<string, number>>(
    {}
  );
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMarketData();
  }, [id]);

  async function fetchMarketData() {
    try {
      // Fetch market detail
      const marketRes = await fetch(`/api/markets/${id}`);
      if (!marketRes.ok) {
        setError("Market not found");
        setLoading(false);
        return;
      }
      const marketData = await marketRes.json();
      setMarket(marketData.market);
      setOutcomes(marketData.outcomes || []);
      setProbabilities(marketData.probabilities || {});

      // Fetch history
      const historyRes = await fetch(`/api/markets/${id}/history`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData.snapshots || []);
      }

      // Fetch posts
      const postsRes = await fetch(`/api/markets/${id}/posts`);
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setPosts(postsData.posts || []);
      }
    } catch (e) {
      console.error("Failed to fetch market data:", e);
      setError("Failed to load market");
    } finally {
      setLoading(false);
    }
  }

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

  if (loading) {
    return (
      <main className="container" style={{ padding: "32px 24px" }}>
        <div className="loading">
          <div className="spinner" />
          Loading market...
        </div>
      </main>
    );
  }

  if (error || !market) {
    return (
      <main className="container" style={{ padding: "32px 24px" }}>
        <div className="empty-state">
          <div className="empty-state-icon">❌</div>
          <p>{error || "Market not found"}</p>
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
        {outcomes.map((outcome, i) => (
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
          history={history} 
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
              {post.display_labels && (
                <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    className={`post-label ${
                      post.display_labels.stance_label.toLowerCase().includes("bullish")
                        ? "bullish"
                        : post.display_labels.stance_label.toLowerCase().includes("bearish")
                        ? "bearish"
                        : ""
                    }`}
                  >
                    {post.display_labels.stance_label}
                  </span>
                  <span
                    className={`post-label credibility-${post.display_labels.credibility_label.toLowerCase()}`}
                  >
                    {post.display_labels.credibility_label} credibility
                  </span>
                </div>
              )}
              {post.display_labels?.reason && (
                <p style={{ margin: "12px 0 0", fontSize: "0.9rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
                  "{post.display_labels.reason}"
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
