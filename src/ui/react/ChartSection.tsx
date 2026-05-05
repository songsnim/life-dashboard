import React, { useRef, useEffect, useCallback } from "react";
import { Chart, registerables } from "chart.js";
import type { DayEntry } from "../../types";
import { parseTimeToMinutes } from "../../services/date-utils";
import { useViewStore } from "../../store/view-store";

Chart.register(...registerables);

const CHART_COLORS = {
  wakeLine:   "rgba(75, 192, 192, 1)",
  wakeFill:   "rgba(75, 192, 192, 0.2)",
  screenLine: "rgba(255, 99, 132, 1)",
  screenFill: "rgba(255, 99, 132, 0.2)",
  target:     "rgba(255, 206, 86, 0.7)",
  axis:       "rgba(255, 255, 255, 0.4)",
  axisRight:  "rgba(255, 99, 132, 0.6)",
};

// Dataset indices
const WAKE_GOAL_DS   = 0;
const SCREEN_GOAL_DS = 2;

const HIT_SLOP_PX = 8;

function minutesToHours(min: number): number {
  return parseFloat((min / 60).toFixed(4));
}

function formatHHMM(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function wakeGoalLabel(goalMin: number): string {
  return `기상 목표 (${formatHHMM(minutesToHours(goalMin))})`;
}

function screenGoalLabel(goalMin: number): string {
  const h = Math.floor(goalMin / 60);
  const m = goalMin % 60;
  return `스크린 목표 (${m === 0 ? `${h}h` : `${h}h${m}m`})`;
}

interface Props { entries: DayEntry[]; }

export function ChartSection({ entries }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  const screenTimeGoalMin = useViewStore((s) => s.screenTimeGoalMin);
  const setScreenTimeGoalMin = useViewStore((s) => s.setScreenTimeGoalMin);
  const wakeTimeGoalMin = useViewStore((s) => s.wakeTimeGoalMin);
  const setWakeTimeGoalMin = useViewStore((s) => s.setWakeTimeGoalMin);

  // 'wake' | 'screen' | null — which threshold line is being dragged
  const dragging = useRef<"wake" | "screen" | null>(null);

  const isMobile = window.innerWidth < 768;
  const ptNormal  = isMobile ? 2   : 3;
  const ptSuccess = isMobile ? 3.5 : 6;
  const lineWidth = isMobile ? 1.5 : 2;

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const labels = sorted.map((e) => formatChartLabel(e.date));

    const wakeData: (number | null)[] = [];
    const screenData: (number | null)[] = [];

    for (const e of sorted) {
      if (e.wakeTime) {
        const m = parseTimeToMinutes(e.wakeTime);
        wakeData.push(m !== null ? parseFloat(minutesToHours(m).toFixed(2)) : null);
      } else {
        wakeData.push(null);
      }

      if (e.screenTime) {
        const m = parseTimeToMinutes(e.screenTime);
        screenData.push(m !== null ? parseFloat((m / 60).toFixed(1)) : null);
      } else {
        screenData.push(null);
      }
    }

    const wakeGoalH   = minutesToHours(wakeTimeGoalMin);
    const screenGoalH = screenTimeGoalMin / 60;

    const SUCCESS = "rgba(74, 222, 128, 1)";

    // Per-point colors & sizes based on goal achievement
    const wakePointColor  = wakeData.map((v) =>
      v !== null && v <= wakeGoalH ? SUCCESS : CHART_COLORS.wakeLine,
    );
    const wakePointRadius = wakeData.map((v) =>
      v !== null && v <= wakeGoalH ? ptSuccess : ptNormal,
    );
    const screenPointColor  = screenData.map((v) =>
      v !== null && v <= screenGoalH ? SUCCESS : CHART_COLORS.screenLine,
    );
    const screenPointRadius = screenData.map((v) =>
      v !== null && v <= screenGoalH ? ptSuccess : ptNormal,
    );

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: wakeGoalLabel(wakeTimeGoalMin),
            data: new Array(labels.length).fill(wakeGoalH),
            borderColor: CHART_COLORS.target,
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            tension: 0,
            yAxisID: "y",
          },
          {
            label: "기상 시각",
            data: wakeData,
            borderColor: CHART_COLORS.wakeLine,
            backgroundColor: CHART_COLORS.wakeFill,
            tension: 0.3,
            borderWidth: lineWidth,
            pointRadius: wakePointRadius,
            pointBackgroundColor: wakePointColor,
            pointBorderColor: wakePointColor,
            segment: {
              borderColor: (ctx) => {
                const y0 = ctx.p0.parsed.y as number | undefined;
                const y1 = ctx.p1.parsed.y as number | undefined;
                return y0 != null && y1 != null && y0 <= wakeGoalH && y1 <= wakeGoalH
                  ? SUCCESS
                  : CHART_COLORS.wakeLine;
              },
            },
            yAxisID: "y",
          },
          {
            label: screenGoalLabel(screenTimeGoalMin),
            data: new Array(labels.length).fill(screenGoalH),
            borderColor: CHART_COLORS.target,
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            tension: 0,
            yAxisID: "y1",
          },
          {
            label: "스크린 (h)",
            data: screenData,
            borderColor: CHART_COLORS.screenLine,
            backgroundColor: CHART_COLORS.screenFill,
            tension: 0.3,
            borderWidth: lineWidth,
            pointRadius: screenPointRadius,
            pointBackgroundColor: screenPointColor,
            pointBorderColor: screenPointColor,
            segment: {
              borderColor: (ctx) => {
                const y0 = ctx.p0.parsed.y as number | undefined;
                const y1 = ctx.p1.parsed.y as number | undefined;
                return y0 != null && y1 != null && y0 <= screenGoalH && y1 <= screenGoalH
                  ? SUCCESS
                  : CHART_COLORS.screenLine;
              },
            },
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: {
            type: "linear",
            position: "left",
            reverse: true,
            min: 5,
            max: 15,
            title: { display: !isMobile, text: "기상 시각", color: CHART_COLORS.axis },
            grid: { color: CHART_COLORS.axis },
            ticks: {
              color: CHART_COLORS.axis,
              callback: (val) => formatHHMM(val as number),
            },
          },
          y1: {
            type: "linear",
            position: "right",
            min: 0,
            max: 10,
            title: { display: !isMobile, text: "스크린 (h)", color: CHART_COLORS.axisRight },
            grid: { drawOnChartArea: false },
            ticks: { color: CHART_COLORS.axisRight },
          },
          x: {
            grid: { display: false },
            ticks: { color: CHART_COLORS.axis },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: CHART_COLORS.axis,
              filter: (item) => !item.text.includes("목표"),
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const label = ctx.dataset.label ?? "";
                if (label.includes("목표")) return "";
                const y = ctx.parsed.y ?? 0;
                if (ctx.dataset.yAxisID === "y") {
                  return `${label}: ${formatHHMM(y)}`;
                }
                return `${label}: ${y.toFixed(1)}h`;
              },
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [entries, screenTimeGoalMin, wakeTimeGoalMin]);

  // Cursor hover: detect proximity to either threshold line
  const onCanvasMouseMove = useCallback((e: MouseEvent) => {
    if (dragging.current) return;
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    if (!chart || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    const wakeGoalH   = (chart.data.datasets[WAKE_GOAL_DS].data[0]   as number) ?? 7;
    const screenGoalH = (chart.data.datasets[SCREEN_GOAL_DS].data[0] as number) ?? 4;
    const wakeY   = chart.scales.y.getPixelForValue(wakeGoalH);
    const screenY = chart.scales.y1.getPixelForValue(screenGoalH);

    const nearWake   = Math.abs(mouseY - wakeY)   <= HIT_SLOP_PX;
    const nearScreen = Math.abs(mouseY - screenY) <= HIT_SLOP_PX;
    canvas.style.cursor = (nearWake || nearScreen) ? "ns-resize" : "default";
  }, []);

  const onMouseDown = useCallback((e: MouseEvent) => {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    if (!chart || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    const wakeGoalH   = (chart.data.datasets[WAKE_GOAL_DS].data[0]   as number) ?? 7;
    const screenGoalH = (chart.data.datasets[SCREEN_GOAL_DS].data[0] as number) ?? 4;
    const wakeY   = chart.scales.y.getPixelForValue(wakeGoalH);
    const screenY = chart.scales.y1.getPixelForValue(screenGoalH);

    if (Math.abs(mouseY - wakeY) <= HIT_SLOP_PX) {
      e.preventDefault();
      dragging.current = "wake";
      canvas.style.cursor = "ns-resize";
    } else if (Math.abs(mouseY - screenY) <= HIT_SLOP_PX) {
      e.preventDefault();
      dragging.current = "screen";
      canvas.style.cursor = "ns-resize";
    }
  }, []);

  const onWindowMouseMove = useCallback((e: MouseEvent) => {
    const which = dragging.current;
    if (!which) return;
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    if (!chart || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    if (which === "wake") {
      const rawH = chart.scales.y.getValueForPixel(mouseY);
      if (rawH == null) return;
      const snapped = Math.round(rawH * 4) / 4; // 15-min snap
      const clamped = Math.max(0, Math.min(23.75, snapped));
      const ds = chart.data.datasets[WAKE_GOAL_DS];
      ds.data = new Array((chart.data.labels ?? []).length).fill(clamped);
      ds.label = wakeGoalLabel(Math.round(clamped * 60));
      chart.update("none");
    } else {
      const rawH = chart.scales.y1.getValueForPixel(mouseY);
      if (rawH == null) return;
      const snapped = Math.round(rawH * 4) / 4;
      const clamped = Math.max(0.5, Math.min(12, snapped));
      const ds = chart.data.datasets[SCREEN_GOAL_DS];
      ds.data = new Array((chart.data.labels ?? []).length).fill(clamped);
      ds.label = screenGoalLabel(Math.round(clamped * 60));
      chart.update("none");
    }
  }, []);

  const onMouseUp = useCallback(() => {
    const which = dragging.current;
    if (!which) return;
    dragging.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
    const chart = chartRef.current;
    if (!chart) return;

    if (which === "wake") {
      const curH = (chart.data.datasets[WAKE_GOAL_DS].data[0] as number) ?? 7;
      setWakeTimeGoalMin(Math.round(curH * 60));
    } else {
      const curH = (chart.data.datasets[SCREEN_GOAL_DS].data[0] as number) ?? 4;
      setScreenTimeGoalMin(Math.round(curH * 60));
    }
  }, [setWakeTimeGoalMin, setScreenTimeGoalMin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onCanvasMouseMove);
    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onCanvasMouseMove);
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseDown, onCanvasMouseMove, onWindowMouseMove, onMouseUp]);

  return (
    <div className="ld-charts">
      <div className="ld-chart-wrapper">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

function formatChartLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${mm}.${dd} ${days[d.getDay()]}`;
}
