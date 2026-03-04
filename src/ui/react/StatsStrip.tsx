import React, { useMemo, type CSSProperties } from "react";
import type { DayEntry } from "../../types";
import { calcSleepMinutes, parseTimeToMinutes } from "../../services/date-utils";

type StatusLevel = "good" | "warn" | "danger";

const STATUS_COLORS = {
  good:   "#4CAF50",
  warn:   "#FF9800",
  danger: "#EF4444",
} as const;

function getRateStatus(rate: number): StatusLevel {
  if (rate >= 70) return "good";
  if (rate >= 50) return "warn";
  return "danger";
}

function getSleepStatus(avgMin: number): StatusLevel {
  if (avgMin >= 420) return "good";
  if (avgMin >= 360) return "warn";
  return "danger";
}

function getScreenStatus(avgMin: number): StatusLevel {
  if (avgMin < 240) return "good";
  if (avgMin < 300) return "warn";
  return "danger";
}

const PIE_SIZE = 21;   // 23 * 0.9 ≈ 21
const PIE_R = PIE_SIZE / 2;

function PieStat({ rate, label, title }: { rate: number; label: string; title: string }) {
  const color = STATUS_COLORS[getRateStatus(rate)];
  const cx = PIE_SIZE / 2;
  const cy = PIE_SIZE / 2;
  const r = PIE_R - 0.5;
  const angle = (rate / 100) * 360;
  const rad = ((angle - 90) * Math.PI) / 180;
  const largeArc = angle > 180 ? 1 : 0;
  const ex = cx + r * Math.cos(rad);
  const ey = cy + r * Math.sin(rad);
  const startX = cx;
  const startY = cy - r;

  const piePath =
    rate >= 100
      ? `M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx - 0.001},${cy - r} Z`
      : rate <= 0
        ? ""
        : `M ${cx},${cy} L ${startX},${startY} A ${r},${r} 0 ${largeArc},1 ${ex},${ey} Z`;

  return (
    <span className="ld-stat-donut" title={title}>
      <svg width={PIE_SIZE} height={PIE_SIZE} viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
           style={{ display: "block" } as CSSProperties}>
        <circle cx={cx} cy={cy} r={r} fill="var(--background-modifier-border)" opacity={0.5} />
        {rate > 0 && <path d={piePath} fill={color} />}
      </svg>
      <span className="ld-stat-info">
        <span className="ld-stat-label">{label}</span>
        <span className="ld-stat-value" style={{ color }}>{rate}%</span>
      </span>
    </span>
  );
}

function TimePieStat({
  avgMinutes,
  maxMinutes,
  label,
  title,
  getStatus,
}: {
  avgMinutes: number;
  maxMinutes: number;
  label: string;
  title: string;
  getStatus: (avgMin: number) => StatusLevel;
}) {
  const color = STATUS_COLORS[getStatus(avgMinutes)];
  const rate  = Math.min((avgMinutes / maxMinutes) * 100, 100);
  const cx = PIE_SIZE / 2;
  const cy = PIE_SIZE / 2;
  const r  = PIE_R - 0.5;
  const angle    = (rate / 100) * 360;
  const rad      = ((angle - 90) * Math.PI) / 180;
  const largeArc = angle > 180 ? 1 : 0;
  const ex = cx + r * Math.cos(rad);
  const ey = cy + r * Math.sin(rad);

  const piePath =
    rate >= 100
      ? `M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx - 0.001},${cy - r} Z`
      : rate <= 0
        ? ""
        : `M ${cx},${cy} L ${cx},${cy - r} A ${r},${r} 0 ${largeArc},1 ${ex},${ey} Z`;

  const h  = Math.floor(avgMinutes / 60);
  const mm = avgMinutes % 60;
  const timeStr = `${h}:${mm.toString().padStart(2, "0")}`;

  return (
    <span className="ld-stat-donut" title={title}>
      <svg width={PIE_SIZE} height={PIE_SIZE} viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
           style={{ display: "block" } as CSSProperties}>
        <circle cx={cx} cy={cy} r={r} fill="var(--background-modifier-border)" opacity={0.5} />
        {rate > 0 && <path d={piePath} fill={color} />}
      </svg>
      <span className="ld-stat-info">
        <span className="ld-stat-label">{label}</span>
        <span className="ld-stat-value" style={{ color }}>{timeStr}</span>
      </span>
    </span>
  );
}

const STAR_ICON_SIZE = 23;

function starPathAt(cx: number, cy: number, rOuter: number): string {
  const inner = rOuter * 0.38;
  let d = "";
  for (let i = 0; i < 5; i++) {
    const outerAngle = ((i * 72) - 90) * (Math.PI / 180);
    const innerAngle = (((i * 72) + 36) - 90) * (Math.PI / 180);
    const ox = cx + rOuter * Math.cos(outerAngle);
    const oy = cy + rOuter * Math.sin(outerAngle);
    const ix = cx + inner  * Math.cos(innerAngle);
    const iy = cy + inner  * Math.sin(innerAngle);
    d += `${i === 0 ? "M" : "L"} ${ox},${oy} L ${ix},${iy} `;
  }
  return d + "Z";
}

function StarStat({ rating, title }: { rating: number; title: string }) {
  const sz        = STAR_ICON_SIZE;
  const cx        = sz / 2;
  const cy        = sz / 2;
  const rOuter    = sz / 2 - 1;
  const fillRatio = Math.max(0, Math.min(rating / 5, 1));

  return (
    <span className="ld-stat-stars" title={title}>
      <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}
           style={{ display: "block" } as CSSProperties}>
        <defs>
          <clipPath id="ld-star1-clip">
            <rect x={0} y={0} width={sz * fillRatio} height={sz} />
          </clipPath>
        </defs>
        <path d={starPathAt(cx, cy, rOuter)} fill="var(--background-modifier-border)" opacity={0.55} />
        <g clipPath="url(#ld-star1-clip)">
          <path d={starPathAt(cx, cy, rOuter)} fill="#F59E0B" />
        </g>
      </svg>
      <span className="ld-stat-info">
        <span className="ld-stat-label">평가</span>
        <span className="ld-stat-value">{Number(rating).toFixed(1)}</span>
      </span>
    </span>
  );
}

interface StatsStripProps { entries: DayEntry[]; }

export function StatsStrip({ entries }: StatsStripProps) {
  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const n = entries.length;

    const sleepMins: number[] = [];
    for (const e of entries) {
      const m = calcSleepMinutes(e.bedtime, e.wakeTime);
      if (m !== null) sleepMins.push(m);
    }
    const avgSleepMin = sleepMins.length > 0
      ? Math.round(sleepMins.reduce((a, b) => a + b, 0) / sleepMins.length)
      : null;

    const readingRate  = Math.round((entries.filter((e) => e.reading).length  / n) * 100);
    const exerciseRate = Math.round((entries.filter((e) => e.exercise).length / n) * 100);
    const sobrietyRate = Math.round((entries.filter((e) => e.sobriety).length / n) * 100);

    const screenMins: number[] = [];
    for (const e of entries) {
      if (e.screenTime) {
        const m = parseTimeToMinutes(e.screenTime);
        if (m !== null) screenMins.push(m);
      }
    }
    const avgScreenMin = screenMins.length > 0
      ? Math.round(screenMins.reduce((a, b) => a + b, 0) / screenMins.length)
      : null;

    const ratings: number[] = [];
    for (const e of entries) {
      if (e.rating !== null && e.rating !== undefined) ratings.push(e.rating);
    }
    const avgRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null;

    return { avgSleepMin, readingRate, exerciseRate, sobrietyRate, avgScreenMin, avgRating };
  }, [entries]);

  if (!stats || entries.length === 0) return null;

  return (
    <div className="ld-stats-strip">
      <PieStat rate={stats.readingRate}  label="독서" title="독서 달성률" />
      <PieStat rate={stats.exerciseRate} label="운동" title="운동 달성률" />
      <PieStat rate={stats.sobrietyRate} label="금주" title="금주 달성률" />
      {stats.avgSleepMin !== null && (
        <TimePieStat
          avgMinutes={stats.avgSleepMin}
          maxMinutes={480}
          label="수면"
          title="평균 수면시간"
          getStatus={getSleepStatus}
        />
      )}
      {stats.avgScreenMin !== null && (
        <TimePieStat
          avgMinutes={stats.avgScreenMin}
          maxMinutes={300}
          label="스크린"
          title="평균 스크린타임"
          getStatus={getScreenStatus}
        />
      )}
      {stats.avgRating !== null && (
        <StarStat rating={stats.avgRating} title="평균 평가" />
      )}
    </div>
  );
}
