"use client";

import { useState, useEffect } from "react";
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

interface Props {
  params: { id: string };
}

export default function MarketDetailPage({ params }: Props) {
  const { id } = params;
  const [market, setMarket] = useState<Market | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  useEffect(() => {
    fetchMarketData();
  }, [id]);

  async function handleRefresh() {
    if (refreshing) return;
    
    setRefreshing(true);
    setRefreshStatus("Fetching tweets...");
    
    try {
      const res = await fetch(`/api/markets/${id}/refresh`, { method: "POST" });
      const data = await res.json();
      
      if (res.ok) {
        const parts = [];
        if (data.tweets_ingested > 0) parts.push(`${data.tweets_ingested} new tweets`);
        if (data.posts_scored > 0) parts.push(`${data.posts_scored} scored`);
        
        setRefreshStatus(parts.length > 0 ? `✓ ${parts.join(", ")}` : "✓ Up to date");
        
        // Reload market data
        await fetchMarketData();
      } else {
        setRefreshStatus(`⚠ ${data.error?.message || "Refresh failed"}`);
      }
    } catch (e) {
      setRefreshStatus("⚠ Refresh failed");
      console.error("Refresh error:", e);
    } finally {
      setRefreshing(false);
      // Clear status after 5 seconds
      setTimeout(() => setRefreshStatus(null), 5000);
    }
  }

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

  // Get the latest probabilities from history (most recent snapshot)
  const latestSnapshot = history.length > 0 ? history[history.length - 1] : null;
  
  // Helper to get the current probability for an outcome (prefer latest history snapshot)
  function getCurrentProb(outcome: Outcome): number | null {
    if (latestSnapshot && outcome.outcome_id in latestSnapshot.probabilities) {
      return latestSnapshot.probabilities[outcome.outcome_id];
    }
    return outcome.current_probability;
  }

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
          <h1 className="market-detail-question" style={{ flex: 1 }}>
            {market.normalized_question || market.question}
          </h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              padding: "10px 20px",
              background: refreshing ? "var(--bg-tertiary)" : "var(--accent-blue)",
              color: refreshing ? "var(--text-muted)" : "white",
              border: "none",
              borderRadius: "8px",
              cursor: refreshing ? "not-allowed" : "pointer",
              fontSize: "0.9rem",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              whiteSpace: "nowrap"
            }}
          >
            {refreshing ? (
              <>
                <span className="spinner" style={{ width: "14px", height: "14px" }} />
                Refreshing...
              </>
            ) : (
              <>🔄 Refresh</>
            )}
          </button>
        </div>
        <div className="market-meta" style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <span>Created {formatDate(market.created_at)} • {market.total_posts_processed ?? 0} posts analyzed</span>
          {refreshStatus && (
            <span style={{ 
              fontSize: "0.85rem", 
              color: refreshStatus.startsWith("✓") ? "var(--accent-green)" : "var(--accent-orange)"
            }}>
              {refreshStatus}
            </span>
          )}
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
              {formatProb(getCurrentProb(outcome))}
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
          <div style={{ position: "relative", height: "280px" }}>
            {/* Interactive SVG chart */}
            <svg 
              width="100%" 
              height="250" 
              viewBox="0 0 800 250" 
              preserveAspectRatio="xMidYMid meet"
              onMouseLeave={() => setHoveredPoint(null)}
              style={{ overflow: "visible" }}
            >
              {/* Grid lines */}
              <line x1="10" y1="20" x2="10" y2="240" stroke="var(--border-color)" strokeWidth="1" strokeOpacity="0.3" />
              <line x1="10" y1="130" x2="790" y2="130" stroke="var(--border-color)" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="4" />
              
              {/* Lines for each outcome */}
              {outcomes.map((outcome, oi) => {
                const points = history.map((snap, i) => {
                  const x = (i / Math.max(history.length - 1, 1)) * 760 + 30;
                  const prob = snap.probabilities[outcome.outcome_id] ?? 0;
                  const y = 230 - prob * 200;
                  return `${x},${y}`;
                });
                return (
                  <polyline
                    key={outcome.id}
                    points={points.join(" ")}
                    fill="none"
                    stroke={outcomeColors[oi % outcomeColors.length]}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ filter: hoveredPoint !== null ? "opacity(0.4)" : "none" }}
                  />
                );
              })}
              
              {/* Highlighted lines when hovering */}
              {hoveredPoint !== null && outcomes.map((outcome, oi) => {
                const points = history.map((snap, i) => {
                  const x = (i / Math.max(history.length - 1, 1)) * 760 + 30;
                  const prob = snap.probabilities[outcome.outcome_id] ?? 0;
                  const y = 230 - prob * 200;
                  return `${x},${y}`;
                });
                return (
                  <polyline
                    key={`highlight-${outcome.id}`}
                    points={points.join(" ")}
                    fill="none"
                    stroke={outcomeColors[oi % outcomeColors.length]}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
              
              {/* Vertical hover line */}
              {hoveredPoint !== null && (
                <line
                  x1={(hoveredPoint / Math.max(history.length - 1, 1)) * 760 + 30}
                  y1="20"
                  x2={(hoveredPoint / Math.max(history.length - 1, 1)) * 760 + 30}
                  y2="230"
                  stroke="var(--text-muted)"
                  strokeWidth="1"
                  strokeDasharray="4"
                />
              )}
              
              {/* Data points with hover circles */}
              {history.map((snap, i) => {
                const x = (i / Math.max(history.length - 1, 1)) * 760 + 30;
                return (
                  <g key={i}>
                    {/* Invisible hover area */}
                    <rect
                      x={x - 20}
                      y={0}
                      width={40}
                      height={250}
                      fill="transparent"
                      onMouseEnter={() => setHoveredPoint(i)}
                      style={{ cursor: "crosshair" }}
                    />
                    {/* Visible dots when hovered */}
                    {hoveredPoint === i && outcomes.map((outcome, oi) => {
                      const prob = snap.probabilities[outcome.outcome_id] ?? 0;
                      const y = 230 - prob * 200;
                      return (
                        <circle
                          key={`dot-${outcome.id}`}
                          cx={x}
                          cy={y}
                          r={6}
                          fill={outcomeColors[oi % outcomeColors.length]}
                          stroke="var(--bg-primary)"
                          strokeWidth="2"
                        />
                      );
                    })}
                  </g>
                );
              })}
              
              {/* X axis */}
              <line x1="30" y1="230" x2="790" y2="230" stroke="var(--border-color)" strokeWidth="1" />
              
              {/* Y axis labels */}
              <text x="5" y="35" fill="var(--text-muted)" fontSize="11" fontFamily="system-ui">100%</text>
              <text x="5" y="135" fill="var(--text-muted)" fontSize="11" fontFamily="system-ui">50%</text>
              <text x="5" y="235" fill="var(--text-muted)" fontSize="11" fontFamily="system-ui">0%</text>
            </svg>
            
            {/* Tooltip */}
            {hoveredPoint !== null && history[hoveredPoint] && (
              <div
                style={{
                  position: "absolute",
                  left: `${((hoveredPoint / Math.max(history.length - 1, 1)) * 95) + 2}%`,
                  top: "10px",
                  transform: hoveredPoint > history.length / 2 ? "translateX(-100%)" : "translateX(0)",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  zIndex: 10,
                  minWidth: "140px"
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "8px" }}>
                  {formatDate(history[hoveredPoint].timestamp)}
                </div>
                {outcomes.map((outcome, i) => {
                  const prob = history[hoveredPoint].probabilities[outcome.outcome_id] ?? 0;
                  return (
                    <div
                      key={outcome.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "4px"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: outcomeColors[i % outcomeColors.length]
                          }}
                        />
                        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                          {outcome.label}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.9rem",
                          fontWeight: 600,
                          color: outcomeColors[i % outcomeColors.length]
                        }}
                      >
                        {(prob * 100).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Legend */}
            <div style={{ display: "flex", gap: "16px", marginTop: "8px", justifyContent: "center" }}>
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
