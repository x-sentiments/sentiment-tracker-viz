"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Outcome {
  outcome_id: string;
  label: string;
  current_probability: number | null;
}

interface Market {
  id: string;
  question: string;
  normalized_question: string | null;
  status: string;
  created_at: string;
  total_posts_processed: number | null;
  outcomes: Outcome[];
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarkets();
  }, []);

  async function fetchMarkets() {
    try {
      const res = await fetch("/api/markets");
      if (res.ok) {
        const data = await res.json();
        setMarkets(data.markets || []);
      }
    } catch (e) {
      console.error("Failed to fetch markets:", e);
    } finally {
      setLoading(false);
    }
  }

  function formatProb(prob: number | null): string {
    if (prob === null || prob === undefined) return "—";
    return `${(prob * 100).toFixed(1)}%`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  return (
    <main className="container" style={{ padding: "32px 24px" }}>
      <div className="section-header" style={{ marginTop: 0 }}>
        <h1 className="section-title" style={{ fontSize: "2rem" }}>All Markets</h1>
        <span style={{ color: "var(--text-muted)" }}>
          {markets.length} {markets.length === 1 ? "market" : "markets"}
        </span>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          Loading markets...
        </div>
      ) : markets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📈</div>
          <p>No markets yet.</p>
          <Link href="/" style={{ color: "var(--accent-blue)" }}>
            Ask a question to create one →
          </Link>
        </div>
      ) : (
        <div className="market-grid">
          {markets.map((market) => (
            <Link
              key={market.id}
              href={`/markets/${market.id}`}
              style={{ textDecoration: "none" }}
            >
              <div className="market-card">
                <h3 className="market-question">
                  {market.normalized_question || market.question}
                </h3>
                <div className="market-outcomes">
                  {market.outcomes.map((outcome) => (
                    <div key={outcome.outcome_id} className="outcome-row">
                      <span className="outcome-label">{outcome.label}</span>
                      <span
                        className={`outcome-prob ${
                          (outcome.current_probability ?? 0) > 0.5 ? "positive" : ""
                        }`}
                      >
                        {formatProb(outcome.current_probability)}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: "16px",
                    paddingTop: "12px",
                    borderTop: "1px solid var(--border-color)",
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    color: "var(--text-muted)"
                  }}
                >
                  <span>Created {formatDate(market.created_at)}</span>
                  <span>{market.total_posts_processed ?? 0} posts</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
