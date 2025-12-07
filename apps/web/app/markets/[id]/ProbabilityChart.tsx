"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, LineData, Time } from "lightweight-charts";

interface Outcome {
  id: string;
  outcome_id: string;
  label: string;
  current_probability: number | null;
}

interface Snapshot {
  timestamp: string;
  probabilities: Record<string, number>;
}

interface ProbabilityChartProps {
  outcomes: Outcome[];
  history: Snapshot[];
  currentProbabilities?: Record<string, number>;
  colors: string[];
}

export default function ProbabilityChart({ outcomes, history, currentProbabilities, colors }: ProbabilityChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.6)",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        horzLine: {
          color: "rgba(255, 255, 255, 0.2)",
          labelBackgroundColor: "rgba(30, 30, 40, 0.9)",
        },
        vertLine: {
          color: "rgba(255, 255, 255, 0.2)",
          labelBackgroundColor: "rgba(30, 30, 40, 0.9)",
        },
      },
    });

    chartRef.current = chart;

    // Create a line series for each outcome
    outcomes.forEach((outcome, index) => {
      const series = chart.addLineSeries({
        color: colors[index % colors.length],
        lineWidth: 2,
        title: outcome.label,
        priceFormat: {
          type: "custom",
          formatter: (price: number) => `${(price * 100).toFixed(1)}%`,
        },
      });
      seriesRef.current.set(outcome.outcome_id, series);
    });

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      seriesRef.current.clear();
    };
  }, [outcomes, colors]);

  // Update data when history or currentProbabilities changes
  useEffect(() => {
    if (!chartRef.current) return;

    // If no history and no current data, do nothing
    if (history.length === 0 && (!currentProbabilities || Object.keys(currentProbabilities).length === 0)) return;

    // Prepare data for each outcome
    outcomes.forEach((outcome) => {
      const series = seriesRef.current.get(outcome.outcome_id);
      if (!series) return;

      // Map history to points
      const data: LineData<Time>[] = history
        .map((snapshot) => ({
          time: (Math.floor(new Date(snapshot.timestamp).getTime() / 1000)) as Time,
          value: snapshot.probabilities[outcome.outcome_id] ?? 0,
        }))
        .sort((a, b) => (a.time as number) - (b.time as number));
      
      // If we have current probabilities, append a "now" point
      // Only append if it's newer than the last history point
      if (currentProbabilities && typeof currentProbabilities[outcome.outcome_id] === "number") {
        const nowTimeVal = Math.floor(Date.now() / 1000);
        const nowTime = nowTimeVal as Time;
        const lastTime = data.length > 0 ? (data[data.length - 1].time as number) : 0;
        
        // Ensure strictly ascending time (Graph will error if not)
        if (nowTimeVal > lastTime) {
          data.push({
            time: nowTime,
            value: currentProbabilities[outcome.outcome_id],
          });
        } else if (data.length > 0) {
            // Update the last point if it's essentially "now"
            data[data.length - 1].value = currentProbabilities[outcome.outcome_id];
        }
      }

      if (data.length > 0) {
        series.setData(data);
      }
    });

    // Fit content
    chartRef.current.timeScale().fitContent();
  }, [history, outcomes, currentProbabilities]);

  if (history.length === 0 && (!currentProbabilities || Object.keys(currentProbabilities || {}).length === 0)) {
    return (
      <div style={{ 
        color: "var(--text-muted)", 
        textAlign: "center", 
        padding: "48px",
        background: "rgba(255, 255, 255, 0.02)",
        borderRadius: "8px",
        border: "1px dashed rgba(255, 255, 255, 0.1)"
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "12px" }}>📊</div>
        No history data yet. Probabilities will appear here as posts are analyzed.
      </div>
    );
  }

  return (
    <div>
      <div ref={chartContainerRef} style={{ width: "100%", height: "300px" }} />
      {/* Legend */}
      <div style={{ 
        display: "flex", 
        gap: "16px", 
        marginTop: "16px", 
        justifyContent: "center",
        flexWrap: "wrap"
      }}>
        {outcomes.map((outcome, i) => (
          <div 
            key={outcome.id} 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px", 
              fontSize: "0.85rem" 
            }}
          >
            <div 
              style={{ 
                width: "12px", 
                height: "3px", 
                borderRadius: "2px", 
                background: colors[i % colors.length] 
              }} 
            />
            <span style={{ color: "var(--text-secondary)" }}>{outcome.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
