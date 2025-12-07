"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  outcomes: Outcome[];
}

export default function HomePage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);

  useEffect(() => {
    fetchMarkets();
  }, []);

  async function fetchMarkets() {
    try {
      const res = await fetch("/api/markets");
      const data = await res.json();
      console.log("[fetchMarkets] Response:", data);
      if (res.ok) {
        setMarkets(data.markets || []);
      } else {
        console.error("[fetchMarkets] Error:", data.error);
      }
    } catch (e) {
      console.error("Failed to fetch markets:", e);
    } finally {
      setLoadingMarkets(false);
    }
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/markets/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        // Refresh markets list before navigating
        await fetchMarkets();
        router.push(`/markets/${data.market.id}`);
      } else {
        const err = await res.json();
        alert(err.error?.message || "Failed to create market");
      }
    } catch (e) {
      alert("Network error");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function formatProb(prob: number | null): string {
    if (prob === null || prob === undefined) return "—";
    return `${(prob * 100).toFixed(1)}%`;
  }

  return (
    <main>
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <h1>Predict the Future with AI</h1>
          <p>
            Ask any question about future events. Our AI analyzes real-time X posts 
            to generate continuously updating probability estimates.
          </p>

          {/* Ask Form */}
          <form className="ask-form" onSubmit={handleAsk} style={{ margin: "0 auto" }}>
            <input
              type="text"
              className="ask-input"
              placeholder="Who will win the 2028 presidential election?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="ask-button" disabled={loading || !question.trim()}>
              {loading ? "Creating..." : "Ask Question"}
            </button>
          </form>
        </div>
      </section>

      {/* Active Markets */}
      <section className="container">
        <div className="section-header">
          <h2 className="section-title">Active Markets</h2>
          <Link href="/markets" style={{ color: "var(--accent-blue)" }}>
            View all →
          </Link>
        </div>

        {loadingMarkets ? (
          <div className="loading">
            <div className="spinner" />
            Loading markets...
          </div>
        ) : markets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📈</div>
            <p>No markets yet. Ask a question to create the first one!</p>
          </div>
        ) : (
          <div className="market-grid">
            {markets.slice(0, 6).map((market) => (
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
                    {market.outcomes.slice(0, 3).map((outcome) => (
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Features */}
      <section className="container" style={{ padding: "60px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
          <div style={{ background: "var(--bg-card)", borderRadius: "16px", padding: "24px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🔮</div>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>AI-Powered Analysis</h3>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Grok AI scores posts for relevance, stance, and credibility to generate accurate predictions.
            </p>
          </div>
          <div style={{ background: "var(--bg-card)", borderRadius: "16px", padding: "24px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⚡</div>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Real-Time Updates</h3>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Probabilities update continuously as new evidence flows in from X's global conversation.
            </p>
          </div>
          <div style={{ background: "var(--bg-card)", borderRadius: "16px", padding: "24px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>📊</div>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Transparent Evidence</h3>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              See the curated posts driving each prediction with AI-generated stance and credibility labels.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
