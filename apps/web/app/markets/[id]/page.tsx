"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

// Dynamic import for chart component to ensure client-side only rendering
const ProbabilityChart = dynamic(() => import("./ProbabilityChart"), {
  ssr: false,
  loading: () => (
    <div style={{ 
      height: "400px", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      background: "rgba(17, 24, 39, 0.6)",
      borderRadius: "16px",
      border: "1px solid rgba(255,255,255,0.08)"
    }}>
      <div style={{ color: "var(--text-muted)" }}>Loading chart...</div>
    </div>
  )
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
  resolution_date: string | null;
  resolution_reason: string | null;
  resolved_outcome_id: string | null;
  resolution_source: string | null;
  stream_active: boolean;
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

  // Color palette for outcomes (hex for chart library)
  const outcomeColors = [
    "#22c55e", // green
    "#3b82f6", // blue
    "#a855f7", // purple
    "#f97316", // orange
    "#ef4444", // red
    "#06b6d4", // cyan
    "#eab308", // yellow
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

      {/* Resolution Status Panel */}
      {(market.status === "resolved" || market.resolution_date || market.resolved_outcome_id) && (
        <div style={{
          background: market.status === "resolved" 
            ? "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))"
            : "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))",
          border: market.status === "resolved"
            ? "1px solid rgba(34, 197, 94, 0.3)"
            : "1px solid rgba(59, 130, 246, 0.3)",
          borderRadius: "16px",
          padding: "20px 24px",
          marginBottom: "24px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <span style={{ fontSize: "1.5rem" }}>
              {market.status === "resolved" ? "✅" : "⏳"}
            </span>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
              {market.status === "resolved" ? "Market Resolved" : "Resolution Info"}
            </h3>
          </div>
          
          {market.status === "resolved" && market.resolved_outcome_id && (
            <div style={{ 
              background: "rgba(34, 197, 94, 0.2)", 
              borderRadius: "12px", 
              padding: "16px",
              marginBottom: "12px"
            }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                Winning Outcome
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 600, color: "#22c55e" }}>
                {outcomes.find(o => o.outcome_id === market.resolved_outcome_id)?.label || market.resolved_outcome_id}
              </div>
              {market.resolution_source && (
                <div style={{ marginTop: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Source: {market.resolution_source}
                </div>
              )}
            </div>
          )}
          
          {market.resolution_date && market.status !== "resolved" && (
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px"
            }}>
              <div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Expected Resolution
                </div>
                <div style={{ fontWeight: 500 }}>
                  {new Date(market.resolution_date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Stream Status
                </div>
                <div style={{ 
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  background: market.stream_active ? "rgba(34, 197, 94, 0.2)" : "rgba(156, 163, 175, 0.2)",
                  fontSize: "0.9rem"
                }}>
                  <span style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: market.stream_active ? "#22c55e" : "#9ca3af",
                    animation: market.stream_active ? "pulse 2s infinite" : "none"
                  }} />
                  {market.stream_active ? "Monitoring X" : "Stream Stopped"}
                </div>
              </div>
            </div>
          )}
          
          {market.resolution_reason && (
            <div style={{ marginTop: "12px", fontSize: "0.9rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
              "{market.resolution_reason}"
            </div>
          )}
        </div>
      )}

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
      {history.length > 0 ? (
        <ProbabilityChart history={history} outcomes={outcomes} />
      ) : (
        <div className="chart-container" style={{ 
          background: "rgba(17, 24, 39, 0.6)", 
          borderRadius: "16px", 
          padding: "24px", 
          border: "1px solid rgba(255,255,255,0.08)" 
        }}>
          <div className="chart-title" style={{ marginBottom: "16px" }}>Probability Over Time</div>
          <div style={{ 
            color: "var(--text-muted)", 
            textAlign: "center", 
            padding: "80px 24px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: "12px",
            border: "1px dashed rgba(255,255,255,0.1)"
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px", opacity: 0.5 }}>📈</div>
            No history data yet. Probabilities will appear here as posts are analyzed.
          </div>
        </div>
      )}

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
