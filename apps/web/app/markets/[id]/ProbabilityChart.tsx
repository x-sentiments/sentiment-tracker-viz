"use client";

import { useMemo } from "react";

interface Outcome {
  id: string;
  outcome_id: string;
  label: string;
  current_probability: number | null;
  prior_probability: number | null;
}

interface Snapshot {
  timestamp: string;
  probabilities: Record<string, number>;
}

interface ProbabilityChartProps {
  history: Snapshot[];
  outcomes: Outcome[];
}

// Color palette matching parent component
const outcomeColors = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#f97316", // orange
  "#ef4444", // red
  "#06b6d4", // cyan
  "#eab308", // yellow
];

export default function ProbabilityChart({ history, outcomes }: ProbabilityChartProps) {
  const chartData = useMemo(() => {
    if (history.length === 0) return { points: [], minTime: 0, maxTime: 0 };

    const sortedHistory = [...history].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const minTime = new Date(sortedHistory[0].timestamp).getTime();
    const maxTime = new Date(sortedHistory[sortedHistory.length - 1].timestamp).getTime();
    const timeRange = maxTime - minTime || 1;

    const points = sortedHistory.map((snapshot) => {
      const time = new Date(snapshot.timestamp).getTime();
      const x = ((time - minTime) / timeRange) * 100;
      return {
        x,
        timestamp: snapshot.timestamp,
        probabilities: snapshot.probabilities,
      };
    });

    return { points, minTime, maxTime };
  }, [history]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const outcomeIds = outcomes.map((o) => o.outcome_id);

  // Generate SVG path for each outcome
  const generatePath = (outcomeId: string) => {
    const validPoints = chartData.points.filter(
      (p) => p.probabilities[outcomeId] !== undefined
    );
    if (validPoints.length < 2) return "";

    return validPoints
      .map((point, i) => {
        const x = point.x;
        const y = 100 - point.probabilities[outcomeId] * 100;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  if (history.length === 0) {
    return (
      <div
        className="chart-container"
        style={{
          background: "rgba(17, 24, 39, 0.6)",
          borderRadius: "16px",
          padding: "24px",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="chart-title" style={{ marginBottom: "16px" }}>
          Probability Over Time
        </div>
        <div
          style={{
            color: "var(--text-muted)",
            textAlign: "center",
            padding: "80px 24px",
          }}
        >
          No history data yet
        </div>
      </div>
    );
  }

  return (
    <div
      className="chart-container"
      style={{
        background: "rgba(17, 24, 39, 0.6)",
        borderRadius: "16px",
        padding: "24px",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="chart-title" style={{ marginBottom: "16px" }}>
        Probability Over Time
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        {outcomes.map((outcome, i) => (
          <div
            key={outcome.id}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <div
              style={{
                width: "12px",
                height: "3px",
                borderRadius: "2px",
                background: outcomeColors[i % outcomeColors.length],
              }}
            />
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {outcome.label}
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ position: "relative", height: "300px" }}>
        {/* Y-axis labels */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "40px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            paddingRight: "8px",
          }}
        >
          {[100, 75, 50, 25, 0].map((val) => (
            <span
              key={val}
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                textAlign: "right",
              }}
            >
              {val}%
            </span>
          ))}
        </div>

        {/* SVG Chart Area */}
        <div style={{ marginLeft: "48px", height: "100%", position: "relative" }}>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{
              width: "100%",
              height: "100%",
              overflow: "visible",
            }}
          >
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="0.3"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Probability lines */}
            {outcomeIds.map((outcomeId, i) => {
              const path = generatePath(outcomeId);
              if (!path) return null;
              return (
                <path
                  key={outcomeId}
                  d={path}
                  fill="none"
                  stroke={outcomeColors[i % outcomeColors.length]}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {/* Data points */}
            {outcomeIds.map((outcomeId, i) =>
              chartData.points.map((point, j) => {
                const prob = point.probabilities[outcomeId];
                if (prob === undefined) return null;
                return (
                  <circle
                    key={`${outcomeId}-${j}`}
                    cx={point.x}
                    cy={100 - prob * 100}
                    r="1.5"
                    fill={outcomeColors[i % outcomeColors.length]}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })
            )}
          </svg>
        </div>

        {/* X-axis labels */}
        <div
          style={{
            marginLeft: "48px",
            marginTop: "8px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {chartData.points.length > 0 && (
            <>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {formatTime(chartData.points[0].timestamp)}
              </span>
              {chartData.points.length > 1 && (
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {formatTime(chartData.points[chartData.points.length - 1].timestamp)}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
