"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

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

  // Color palette for outcomes
  const outcomeColors = [
    "var(--accent-green)",
    "var(--accent-blue)",
    "var(--accent-purple)",
    "var(--accent-orange)",
    "var(--accent-red)"
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
              {formatProb(outcome.current_probability)}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="chart-container">
        <div className="chart-title">Probability Over Time</div>
        {history.length === 0 ? (
          <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "48px" }}>
            No history data yet. Probabilities will appear here as posts are analyzed.
          </div>
        ) : (
          <div style={{ position: "relative", height: "250px" }}>
            {/* Simple SVG chart */}
            <svg width="100%" height="100%" viewBox="0 0 800 250" preserveAspectRatio="none">
              {outcomes.map((outcome, oi) => {
                const points = history.map((snap, i) => {
                  const x = (i / Math.max(history.length - 1, 1)) * 780 + 10;
                  const prob = snap.probabilities[outcome.outcome_id] ?? 0;
                  const y = 240 - prob * 220;
                  return `${x},${y}`;
                });
                return (
                  <polyline
                    key={outcome.id}
                    points={points.join(" ")}
                    fill="none"
                    stroke={outcomeColors[oi % outcomeColors.length]}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
              {/* X axis */}
              <line x1="10" y1="240" x2="790" y2="240" stroke="var(--border-color)" strokeWidth="1" />
              {/* Y axis labels */}
              <text x="5" y="25" fill="var(--text-muted)" fontSize="10">100%</text>
              <text x="5" y="130" fill="var(--text-muted)" fontSize="10">50%</text>
              <text x="5" y="238" fill="var(--text-muted)" fontSize="10">0%</text>
            </svg>
            {/* Legend */}
            <div style={{ display: "flex", gap: "16px", marginTop: "12px", justifyContent: "center" }}>
              {outcomes.map((outcome, i) => (
                <div key={outcome.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "2px", background: outcomeColors[i % outcomeColors.length] }} />
                  <span style={{ color: "var(--text-secondary)" }}>{outcome.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
