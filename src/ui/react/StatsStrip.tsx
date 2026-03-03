import React, { useMemo, type CSSProperties } from "react";
import type { DayEntry } from "../../types";
import { calcSleepMinutes, parseTimeToMinutes } from "../../services/date-utils";

const PIE_SIZE = 26;
const PIE_R = PIE_SIZE / 2;

function PieStat({
  rate,
  label,
  color,
  title,
}: {
  rate: number;
  label: string;
  color: string;
  title: string;
}) {
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
      <svg
        width={PIE_SIZE}
        height={PIE_SIZE}
        viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
        style={{ display: "block" } as CSSProperties}
      >
        <circle cx={cx} cy={cy} r={r} fill="var(--background-modifier-border)" opacity={0.5} />
        {rate > 0 && <path d={piePath} fill={color} />}
      </svg>
      <span className="ld-stat-info">
        <span className="ld-stat-label">{label}</span>
        <span className="ld-stat-value">{rate}%</span>
      </span>
    </span>
  );
}

const BAR_W = 10;
const BAR_H = 26;

function BarStat({
  avgMinutes,
  maxHours,
  thresholdHours,
  label,
  title,
  goodAbove,
}: {
  avgMinutes: number;
  maxHours: number;
  thresholdHours: number;
  label: string;
  title: string;
  /** true = above threshold is good (sleep), false = below is good (screen) */
  goodAbove: boolean;
}) {
  const maxMin = maxHours * 60;
  const fillRatio = Math.min(avgMinutes / maxMin, 1);
  const thresholdRatio = thresholdHours / maxHours;
  const thresholdMin = thresholdHours * 60;
  const isGood = goodAbove ? avgMinutes >= thresholdMin : avgMinutes < thresholdMin;
  const fillColor = isGood ? "#4CAF50" : "#FF9800";

  const h = Math.floor(avgMinutes / 60);
  const mm = avgMinutes % 60;
  const timeStr = `${h}:${mm.toString().padStart(2, "0")}`;

  const fillH = fillRatio * BAR_H;
  const thresholdY = BAR_H - thresholdRatio * BAR_H;

  return (
    <span className="ld-stat-bar" title={title}>
      <svg
        width={BAR_W}
        height={BAR_H}
        viewBox={`0 0 ${BAR_W} ${BAR_H}`}
        style={{ display: "block" } as CSSProperties}
      >
        {/* Background track */}
        <rect x={1} y={0} width={BAR_W - 2} height={BAR_H} rx={2} fill="var(--background-modifier-border)" opacity={0.5} />
        {/* Filled portion (bottom-up) */}
        {fillRatio > 0 && (
          <rect x={1} y={BAR_H - fillH} width={BAR_W - 2} height={fillH} rx={2} fill={fillColor} opacity={0.85} />
        )}
        {/* Threshold marker (horizontal dashed line) */}
        <line
          x1={0}
          y1={thresholdY}
          x2={BAR_W}
          y2={thresholdY}
          stroke="var(--text-normal)"
          strokeWidth={1.2}
          strokeDasharray="1.5 1"
          opacity={0.9}
        />
      </svg>
      <span className="ld-stat-info">
        <span className="ld-stat-label">{label}</span>
        <span className="ld-stat-value" style={{ color: fillColor }}>{timeStr}</span>
      </span>
    </span>
  );
}

const STAR_COUNT = 5;
const STAR_SIZE = 5;
const STAR_TOTAL_W = 26;

function StarStat({
  rating,
  title,
}: {
  rating: number;
  title: string;
}) {
  const clampedRating = Math.max(0, Math.min(rating, STAR_COUNT));

  // Build star path centered at (0,0) with given size
  const starPath = (cx: number, cy: number, r: number) => {
    const inner = r * 0.38;
    let d = "";
    for (let i = 0; i < 5; i++) {
      const outerAngle = ((i * 72) - 90) * (Math.PI / 180);
      const innerAngle = (((i * 72) + 36) - 90) * (Math.PI / 180);
      const ox = cx + r * Math.cos(outerAngle);
      const oy = cy + r * Math.sin(outerAngle);
      const ix = cx + inner * Math.cos(innerAngle);
      const iy = cy + inner * Math.sin(innerAngle);
      d += `${i === 0 ? "M" : "L"} ${ox},${oy} L ${ix},${iy} `;
    }
    return d + "Z";
  };

  const starSpacing = STAR_TOTAL_W / STAR_COUNT;
  const starR = STAR_SIZE / 2;
  const svgH = STAR_SIZE + 1;

  return (
    <span className="ld-stat-stars" title={title}>
      <svg
        width={STAR_TOTAL_W}
        height={svgH}
        viewBox={`0 0 ${STAR_TOTAL_W} ${svgH}`}
        style={{ display: "block" } as CSSProperties}
      >
        <defs>
          <clipPath id="ld-star-clip">
            <rect x={0} y={0} width={clampedRating * starSpacing} height={svgH} />
          </clipPath>
        </defs>
        {/* Empty stars (background) */}
        {Array.from({ length: STAR_COUNT }, (_, i) => {
          const cx = starSpacing * i + starSpacing / 2;
          const cy = svgH / 2;
          return (
            <path
              key={`empty-${i}`}
              d={starPath(cx, cy, starR)}
              fill="var(--background-modifier-border)"
              opacity={0.55}
            />
          );
        })}
        {/* Filled stars (clipped by rating) */}
        <g clipPath="url(#ld-star-clip)">
          {Array.from({ length: STAR_COUNT }, (_, i) => {
            const cx = starSpacing * i + starSpacing / 2;
            const cy = svgH / 2;
            return (
              <path
                key={`fill-${i}`}
                d={starPath(cx, cy, starR)}
                fill="#F59E0B"
              />
            );
          })}
        </g>
      </svg>
      <span className="ld-stat-info">
        <span className="ld-stat-label">평가</span>
        <span className="ld-stat-value">{Number(rating).toFixed(1)}</span>
      </span>
    </span>
  );
}


interface StatsStripProps {
  entries: DayEntry[];
}

export function StatsStrip({ entries }: StatsStripProps) {
  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const n = entries.length;

    // 평균 수면시간 (minutes)
    const sleepMins: number[] = [];
    for (const e of entries) {
      const m = calcSleepMinutes(e.bedtime, e.wakeTime);
      if (m !== null) sleepMins.push(m);
    }
    const avgSleepMin =
      sleepMins.length > 0
        ? Math.round(sleepMins.reduce((a, b) => a + b, 0) / sleepMins.length)
        : null;

    // 독서 달성률
    const readingRate = Math.round(
      (entries.filter((e) => e.reading).length / n) * 100,
    );

    // 운동 달성률
    const exerciseRate = Math.round(
      (entries.filter((e) => e.exercise).length / n) * 100,
    );

    // 금주 달성률
    const sobrietyRate = Math.round(
      (entries.filter((e) => e.sobriety).length / n) * 100,
    );

    // 평균 스크린타임 (minutes)
    const screenMins: number[] = [];
    for (const e of entries) {
      if (e.screenTime) {
        const m = parseTimeToMinutes(e.screenTime);
        if (m !== null) screenMins.push(m);
      }
    }
    const avgScreenMin =
      screenMins.length > 0
        ? Math.round(screenMins.reduce((a, b) => a + b, 0) / screenMins.length)
        : null;

    // 평균 평가
    const ratings: number[] = [];
    for (const e of entries) {
      if (e.rating !== null && e.rating !== undefined) ratings.push(e.rating);
    }
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : null;

    return {
      avgSleepMin,
      readingRate,
      exerciseRate,
      sobrietyRate,
      avgScreenMin,
      avgRating,
    };
  }, [entries]);

  if (!stats || entries.length === 0) return null;

  return (
    <div className="ld-stats-strip">
      <PieStat rate={stats.readingRate} label="독서" color="#4CAF50" title="독서 달성률" />
      <PieStat rate={stats.exerciseRate} label="운동" color="#2196F3" title="운동 달성률" />
      <PieStat rate={stats.sobrietyRate} label="금주" color="#9C27B0" title="금주 달성률" />
      {stats.avgSleepMin !== null && (
        <BarStat
          avgMinutes={stats.avgSleepMin}
          maxHours={12}
          thresholdHours={7}
          label="수면"
          title="평균 수면시간"
          goodAbove={true}
        />
      )}
      {stats.avgScreenMin !== null && (
        <BarStat
          avgMinutes={stats.avgScreenMin}
          maxHours={8}
          thresholdHours={4}
          label="스크린"
          title="평균 스크린타임"
          goodAbove={false}
        />
      )}
      {stats.avgRating !== null && (
        <StarStat rating={stats.avgRating} title="평균 평가" />
      )}
    </div>
  );
}
