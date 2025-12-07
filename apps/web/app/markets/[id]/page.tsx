"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProbabilityChart } from "../../components/ProbabilityChart";

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
  const [currentProbabilities, setCurrentProbabilities] = useState<Record<string, number>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);

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
      // Fetch market detail (includes current probabilities from market_state)
      const marketRes = await fetch(`/api/markets/${id}`);
      if (!marketRes.ok) {
        setError("Market not found");
        setLoading(false);
        return;
      }
      const marketData = await marketRes.json();
      setMarket(marketData.market);
      setOutcomes(marketData.outcomes || []);
      // Store current probabilities from market_state (authoritative source)
      setCurrentProbabilities(marketData.probabilities || {});

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

  // Use current_probability from outcomes directly - it now comes from market_state via API
  // This ensures consistency with the main page which uses the same source
  function getCurrentProb(outcome: Outcome): number | null {
    return outcome.current_probability;
  }

  // Combine history with current probabilities to ensure chart ends at current values
  // This guarantees the chart's rightmost point matches the header values
  const chartHistory: Snapshot[] = (() => {
    try {
      // If no current probabilities, just return history as-is
      if (!currentProbabilities || Object.keys(currentProbabilities).length === 0) {
        return history;
      }

      // Create a "now" snapshot with current probabilities from market_state
      const nowSnapshot: Snapshot = {
        timestamp: new Date().toISOString(),
        probabilities: currentProbabilities,
      };

      // If no history, return just the current snapshot
      if (!history || history.length === 0) {
        return [nowSnapshot];
      }

      // Check if the last history snapshot matches current probabilities
      const lastSnapshot = history[history.length - 1];
      const lastProbs = lastSnapshot?.probabilities;

      // If last snapshot has no probabilities, append current
      if (!lastProbs || typeof lastProbs !== "object") {
        return [...history, nowSnapshot];
      }

      const currentProbs = currentProbabilities;

      // Check if they're the same (within floating point tolerance)
      const areSame = Object.keys(currentProbs).every((key) => {
        const curr = currentProbs[key];
        const last = lastProbs[key];
        if (last === undefined || last === null) return false;
        return Math.abs(curr - last) < 0.0001;
      });

      // If different, append the current snapshot to ensure chart ends at current values
      if (!areSame) {
        return [...history, nowSnapshot];
      }

      return history;
    } catch (e) {
      console.error("Error computing chartHistory:", e);
      return history;
    }
  })();

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
        {chartHistory.length === 0 ? (
          <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "48px" }}>
            No history data yet. Probabilities will appear here as posts are analyzed.
          </div>
        ) : (
          <ProbabilityChart
            outcomes={outcomes}
            history={chartHistory}
            outcomeColors={outcomeColors}
          />
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
