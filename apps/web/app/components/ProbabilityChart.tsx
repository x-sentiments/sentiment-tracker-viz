"use client";

import { useEffect, useRef, memo } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineData,
  Time,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";

interface Outcome {
  id: string;
  outcome_id: string;
  label: string;
}

interface Snapshot {
  timestamp: string;
  probabilities: Record<string, number>;
}

interface ProbabilityChartProps {
  outcomes: Outcome[];
  history: Snapshot[];
  outcomeColors: string[];
}

function ProbabilityChartInner({
  outcomes,
  history,
  outcomeColors,
}: ProbabilityChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.5)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.06)" },
        horzLines: { color: "rgba(255, 255, 255, 0.06)" },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: "rgba(255, 255, 255, 0.3)",
          width: 1,
          style: 2,
          labelBackgroundColor: "rgba(30, 30, 30, 0.9)",
        },
        horzLine: {
          color: "rgba(255, 255, 255, 0.3)",
          width: 1,
          style: 2,
          labelBackgroundColor: "rgba(30, 30, 30, 0.9)",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
    });

    chartRef.current = chart;

    // Create a line series for each outcome
    const resolvedColors = outcomeColors.map((color) => {
      // Resolve CSS variables to actual colors
      if (color.startsWith("var(")) {
        const varName = color.slice(4, -1);
        const computed = getComputedStyle(
          document.documentElement
        ).getPropertyValue(varName);
        return computed.trim() || "#4ade80";
      }
      return color;
    });

    outcomes.forEach((outcome, index) => {
      const series = chart.addLineSeries({
        color: resolvedColors[index % resolvedColors.length],
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 5,
        crosshairMarkerBorderColor: "rgba(0, 0, 0, 0.8)",
        crosshairMarkerBackgroundColor:
          resolvedColors[index % resolvedColors.length],
        priceFormat: {
          type: "custom",
          formatter: (price: number) => `${(price * 100).toFixed(1)}%`,
        },
        title: outcome.label,
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
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current.clear();
    };
  }, [outcomes.length]); // Only recreate chart when outcomes change

  // Update data when history changes
  useEffect(() => {
    if (!chartRef.current || seriesRef.current.size === 0) return;

    outcomes.forEach((outcome) => {
      const series = seriesRef.current.get(outcome.outcome_id);
      if (!series) return;

      const data: LineData[] = history.map((snapshot) => ({
        time: (new Date(snapshot.timestamp).getTime() / 1000) as Time,
        value: snapshot.probabilities[outcome.outcome_id] ?? 0,
      }));

      series.setData(data);
    });

    // Fit content to view
    if (history.length > 0) {
      chartRef.current.timeScale().fitContent();
    }
  }, [history, outcomes]);

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={chartContainerRef}
        style={{
          width: "100%",
          height: "300px",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      />
      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginTop: "12px",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        {outcomes.map((outcome, i) => (
          <div
            key={outcome.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.85rem",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "3px",
                borderRadius: "2px",
                background: outcomeColors[i % outcomeColors.length],
              }}
            />
            <span style={{ color: "var(--text-secondary)" }}>
              {outcome.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ProbabilityChart = memo(ProbabilityChartInner);
