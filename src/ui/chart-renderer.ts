import { Chart, registerables } from "chart.js";
import type { DayEntry } from "../types";
import { calcSleepMinutes, parseTimeToMinutes } from "../services/date-utils";

Chart.register(...registerables);

const CHART_COLORS = {
  sleepLine: "rgba(75, 192, 192, 1)",
  sleepFill: "rgba(75, 192, 192, 0.2)",
  screenLine: "rgba(255, 99, 132, 1)",
  screenFill: "rgba(255, 99, 132, 0.2)",
  target: "rgba(255, 206, 86, 0.7)",
  axis: "rgba(255, 255, 255, 0.4)",
};

/**
 * 수면 + 스크린타임을 하나의 차트에 합산 표시.
 * 목표선은 flat dataset으로 렌더링 (chartjs-plugin-annotation 불필요).
 * 기존 dashboard-bundle.js 스타일과 동일.
 */
export class ChartRenderer {
  private chart: Chart | null = null;

  constructor(private containerEl: HTMLElement) {}

  update(entries: DayEntry[]): void {
    this.destroy();
    this.containerEl.empty();

    // 시간순 정렬 (오래된 날짜 → 최신)
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const labels = sorted.map((e) => this.formatChartLabel(e.date));

    const sleepData: (number | null)[] = [];
    const screenData: (number | null)[] = [];

    for (const e of sorted) {
      const sleepMins = calcSleepMinutes(e.bedtime, e.wakeTime);
      sleepData.push(sleepMins !== null ? parseFloat((sleepMins / 60).toFixed(1)) : null);

      if (e.screenTime) {
        const screenMins = parseTimeToMinutes(e.screenTime);
        screenData.push(screenMins !== null ? parseFloat((screenMins / 60).toFixed(1)) : null);
      } else {
        screenData.push(null);
      }
    }

    // dynamic y-axis max
    const allVals = [...sleepData, ...screenData].filter((v): v is number => v !== null && v > 0);
    const yMax = allVals.length > 0 ? Math.ceil(Math.max(...allVals)) + 1 : 12;

    const wrapper = this.containerEl.createDiv({ cls: "ld-chart-wrapper" });
    const canvas = wrapper.createEl("canvas");

    this.chart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "수면 목표 (7h)",
            data: new Array(labels.length).fill(7),
            borderColor: CHART_COLORS.target,
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            tension: 0,
          },
          {
            label: "수면 (h)",
            data: sleepData,
            borderColor: CHART_COLORS.sleepLine,
            backgroundColor: CHART_COLORS.sleepFill,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
          },
          {
            label: "스크린 목표 (4h)",
            data: new Array(labels.length).fill(4),
            borderColor: CHART_COLORS.target,
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            tension: 0,
          },
          {
            label: "스크린 (h)",
            data: screenData,
            borderColor: CHART_COLORS.screenLine,
            backgroundColor: CHART_COLORS.screenFill,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 1,
            max: yMax,
            title: { display: true, text: "Hours", color: CHART_COLORS.axis },
            grid: { color: CHART_COLORS.axis },
            ticks: { color: CHART_COLORS.axis },
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
        },
      },
    });
  }

  destroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  /** YYYY-MM-DD → "MM.DD ddd" (한국어 요일) */
  private formatChartLabel(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${mm}.${dd} ${days[d.getDay()]}`;
  }
}
