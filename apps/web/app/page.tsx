"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

interface SimilarQuestion {
  id: string;
  question: string;
  similarity_score: number;
}

interface DuplicateResponse {
  blocked?: boolean;
  warning?: boolean;
  reason: string;
  similarity_score: number;
  existing_market?: Market;
  existing_outcomes?: Outcome[];
  similar_market?: SimilarQuestion;
  message: string;
}

interface SimilarityCheckResponse {
  question: string;
  similarity: {
    has_duplicate: boolean;
    most_similar: {
      existing_question_id: string;
      existing_question_text: string;
      similarity_score: number;
      is_semantically_identical: boolean;
      reasoning: string;
    } | null;
    all_similar: Array<{
      existing_question_id: string;
      existing_question_text: string;
      similarity_score: number;
      is_semantically_identical: boolean;
      reasoning: string;
    }>;
    recommendation: "block" | "warn" | "allow";
    recommendation_reason: string;
  };
  can_create: boolean;
  existing_market: {
    id: string;
    question: string;
    similarity_score: number;
  } | null;
}

export default function HomePage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  
  // Similarity dropdown state
  const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSimilar, setSelectedSimilar] = useState<SimilarQuestion | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Duplicate detection state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateData, setDuplicateData] = useState<DuplicateResponse | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);

  // Debounce timer ref
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchMarkets();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      setLoadingMarkets(false);
    }
  }

  // Live similarity search as user types
  const checkSimilarityLive = useCallback(async (q: string) => {
    if (q.trim().length < 10) {
      setSimilarQuestions([]);
      setShowDropdown(false);
      return;
    }

    setLoadingSimilar(true);
    try {
      const res = await fetch("/api/markets/check-similarity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim() })
      });

      if (res.ok) {
        const data: SimilarityCheckResponse = await res.json();
        const similar = data.similarity.all_similar.map(s => ({
          id: s.existing_question_id,
          question: s.existing_question_text,
          similarity_score: s.similarity_score
        }));
        setSimilarQuestions(similar);
        setShowDropdown(similar.length > 0);
      }
    } catch (e) {
      console.error("Similarity check error:", e);
    } finally {
      setLoadingSimilar(false);
    }
  }, []);

  // Handle input change with debounce
  function handleQuestionChange(value: string) {
    setQuestion(value);
    setSelectedSimilar(null);

    // Clear previous timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new timer for debounced search
    debounceRef.current = setTimeout(() => {
      checkSimilarityLive(value);
    }, 500); // 500ms debounce
  }

  // Handle selecting a similar question from dropdown
  function handleSelectSimilar(similar: SimilarQuestion) {
    setSelectedSimilar(similar);
    setShowDropdown(false);
    router.push(`/markets/${similar.id}`);
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setShowDuplicateModal(false);
    setDuplicateData(null);
    setShowDropdown(false);
    
    try {
      const res = await fetch("/api/markets/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() })
      });

      const data = await res.json();

      // Handle blocked (duplicate detected)
      if (res.status === 409 && data.blocked) {
        setDuplicateData(data);
        setIsBlocked(true);
        setShowDuplicateModal(true);
        return;
      }

      // Handle warning (similar question found)
      if (res.ok && data.warning) {
        setDuplicateData(data);
        setIsBlocked(false);
        setShowDuplicateModal(true);
        return;
      }

      // Success - new market created
      if (res.ok && data.market) {
        router.push(`/markets/${data.market.id}`);
        return;
      }

      // Error
      alert(data.error?.message || "Failed to create market");
    } catch (e) {
      console.error("Network error:", e);
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForceCreate() {
    if (!question.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/markets/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), force_create: true })
      });

      const data = await res.json();

      if (res.ok && data.market) {
        setShowDuplicateModal(false);
        router.push(`/markets/${data.market.id}`);
      } else {
        alert(data.error?.message || "Failed to create market");
      }
    } catch (e) {
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleViewExisting() {
    const marketId = duplicateData?.existing_market?.id || duplicateData?.similar_market?.id;
    if (marketId) {
      setShowDuplicateModal(false);
      router.push(`/markets/${marketId}`);
    }
  }

  function formatProb(prob: number | null): string {
    if (prob === null || prob === undefined) return "—";
    return `${(prob * 100).toFixed(1)}%`;
  }

  function getSimilarityColor(score: number): string {
    if (score >= 0.75) return "#ef4444"; // red - will be blocked
    if (score >= 0.60) return "#f59e0b"; // orange - warning
    return "#22c55e"; // green - allowed
  }

  return (
    <main>
      {/* Duplicate Detection Modal */}
      {showDuplicateModal && duplicateData && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: "var(--bg-card)",
            borderRadius: "20px",
            padding: "32px",
            maxWidth: "500px",
            width: "100%",
            border: isBlocked ? "2px solid #ef4444" : "2px solid #f59e0b"
          }}>
            {/* Icon */}
            <div style={{ 
              fontSize: "3rem", 
              textAlign: "center", 
              marginBottom: "16px" 
            }}>
              {isBlocked ? "🚫" : "⚠️"}
            </div>

            {/* Title */}
            <h2 style={{ 
              textAlign: "center", 
              margin: "0 0 16px",
              color: isBlocked ? "#ef4444" : "#f59e0b"
            }}>
              {isBlocked ? "Duplicate Question Detected" : "Similar Question Found"}
            </h2>

            {/* Message */}
            <p style={{ 
              textAlign: "center", 
              color: "var(--text-secondary)",
              marginBottom: "20px"
            }}>
              {duplicateData.message}
            </p>

            {/* Similarity Score */}
            <div style={{
              background: "rgba(255,255,255,0.05)",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "20px"
            }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between",
                marginBottom: "8px"
              }}>
                <span style={{ color: "var(--text-muted)" }}>Similarity Score</span>
                <span style={{ 
                  fontWeight: 600,
                  color: duplicateData.similarity_score >= 0.75 ? "#ef4444" : "#f59e0b"
                }}>
                  {(duplicateData.similarity_score * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{
                height: "8px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "4px",
                overflow: "hidden"
              }}>
                <div style={{
                  height: "100%",
                  width: `${duplicateData.similarity_score * 100}%`,
                  background: duplicateData.similarity_score >= 0.75 
                    ? "linear-gradient(90deg, #ef4444, #dc2626)" 
                    : "linear-gradient(90deg, #f59e0b, #d97706)",
                  borderRadius: "4px"
                }} />
              </div>
            </div>

            {/* Existing Question */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "24px",
              border: "1px solid var(--border-color)"
            }}>
              <div style={{ 
                fontSize: "0.8rem", 
                color: "var(--text-muted)",
                marginBottom: "8px"
              }}>
                Existing Question:
              </div>
              <div style={{ fontWeight: 500 }}>
                {duplicateData.existing_market?.normalized_question || 
                 duplicateData.existing_market?.question ||
                 duplicateData.similar_market?.question}
              </div>
            </div>

            {/* Actions */}
            <div style={{ 
              display: "flex", 
              gap: "12px",
              flexDirection: "column"
            }}>
              <button
                onClick={handleViewExisting}
                style={{
                  padding: "14px 24px",
                  borderRadius: "12px",
                  border: "none",
                  background: "var(--accent-blue)",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "1rem"
                }}
              >
                View Existing Market →
              </button>
              
              {!isBlocked && (
                <button
                  onClick={handleForceCreate}
                  disabled={loading}
                  style={{
                    padding: "14px 24px",
                    borderRadius: "12px",
                    border: "1px solid var(--border-color)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontWeight: 500,
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: "0.95rem",
                    opacity: loading ? 0.5 : 1
                  }}
                >
                  {loading ? "Creating..." : "Create Anyway"}
                </button>
              )}
              
              <button
                onClick={() => setShowDuplicateModal(false)}
                style={{
                  padding: "12px 24px",
                  borderRadius: "12px",
                  border: "none",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "0.9rem"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <h1>Predict the Future with AI</h1>
          <p>
            Ask any question about future events. Our AI analyzes real-time X posts 
            to generate continuously updating probability estimates.
          </p>

          {/* Ask Form with Similarity Dropdown */}
          <form className="ask-form" onSubmit={handleAsk} style={{ margin: "0 auto", position: "relative" }}>
            <div ref={dropdownRef} style={{ position: "relative", flex: 1 }}>
              <input
                ref={inputRef}
                type="text"
                className="ask-input"
                placeholder="Who will win the 2028 presidential election?"
                value={question}
                onChange={(e) => handleQuestionChange(e.target.value)}
                onFocus={() => similarQuestions.length > 0 && setShowDropdown(true)}
                disabled={loading}
                style={{ width: "100%" }}
              />
              
              {/* Similarity Dropdown */}
              {showDropdown && similarQuestions.length > 0 && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: "8px",
                  background: "var(--bg-card)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                  overflow: "hidden",
                  zIndex: 100,
                  maxHeight: "300px",
                  overflowY: "auto"
                }}>
                  <div style={{ 
                    padding: "12px 16px", 
                    borderBottom: "1px solid var(--border-color)",
                    background: "rgba(255,255,255,0.02)"
                  }}>
                    <div style={{ 
                      fontSize: "0.75rem", 
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      fontWeight: 600
                    }}>
                      {loadingSimilar ? "Searching..." : "Similar Existing Questions"}
                    </div>
                  </div>
                  
                  {similarQuestions.map((similar) => (
                    <div
                      key={similar.id}
                      onClick={() => handleSelectSimilar(similar)}
                      style={{
                        padding: "14px 16px",
                        borderBottom: "1px solid var(--border-color)",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: 500, 
                          marginBottom: "4px",
                          lineHeight: 1.4
                        }}>
                          {similar.question}
                        </div>
                        <div style={{ 
                          fontSize: "0.8rem", 
                          color: "var(--text-muted)" 
                        }}>
                          Click to view this market
                        </div>
                      </div>
                      <div style={{
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: `${getSimilarityColor(similar.similarity_score)}20`,
                        color: getSimilarityColor(similar.similarity_score),
                        whiteSpace: "nowrap"
                      }}>
                        {(similar.similarity_score * 100).toFixed(0)}% match
                      </div>
                    </div>
                  ))}
                  
                  {similarQuestions.some(s => s.similarity_score >= 0.75) && (
                    <div style={{ 
                      padding: "12px 16px", 
                      background: "rgba(239, 68, 68, 0.1)",
                      borderTop: "1px solid rgba(239, 68, 68, 0.2)",
                      fontSize: "0.85rem",
                      color: "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}>
                      <span>⚠️</span>
                      <span>High similarity detected. Creating this question will likely be blocked.</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Loading indicator */}
              {loadingSimilar && (
                <div style={{
                  position: "absolute",
                  right: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "16px",
                  height: "16px",
                  border: "2px solid var(--border-color)",
                  borderTopColor: "var(--accent-blue)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite"
                }} />
              )}
            </div>
            
            <button type="submit" className="ask-button" disabled={loading || !question.trim()}>
              {loading ? "Checking..." : "Ask Question"}
            </button>
          </form>
          
          <p style={{ 
            fontSize: "0.85rem", 
            color: "var(--text-muted)", 
            marginTop: "12px",
            textAlign: "center"
          }}>
            Start typing to see similar existing questions • Our AI prevents duplicate markets
          </p>
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

      {/* Add spinner animation */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
