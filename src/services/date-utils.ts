import type { ViewMode } from "../types";
import { RECENT_DAYS } from "../constants";

/**
 * 뷰 모드에 따른 날짜 범위 계산 유틸리티.
 * moment.js 대신 네이티브 Date 사용 (Obsidian이 moment를 번들하지만 직접 의존 최소화).
 */

/** 뷰 모드에 따른 [startDate, endDate] (YYYY-MM-DD) 반환 */
export function getDateRange(mode: ViewMode, refDate: Date = new Date()): [string, string] {
  const end = formatDate(refDate);

  switch (mode) {
    case "recent": {
      const start = new Date(refDate);
      start.setDate(start.getDate() - RECENT_DAYS + 1);
      return [formatDate(start), end];
    }
    case "weekly": {
      const start = getWeekStart(refDate);
      const weekEnd = new Date(start);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return [formatDate(start), formatDate(weekEnd)];
    }
    case "monthly": {
      const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      const monthEnd = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
      return [formatDate(start), formatDate(monthEnd)];
    }
    case "yearly": {
      const start = new Date(refDate.getFullYear(), 0, 1);
      const yearEnd = new Date(refDate.getFullYear(), 11, 31);
      return [formatDate(start), formatDate(yearEnd)];
    }
  }
}

/** 두 시각 문자열(HH:mm)로부터 수면시간(분)을 계산. bedtime은 전날 밤이라고 가정. */
export function calcSleepMinutes(bedtime: string | null, wakeTime: string | null): number | null {
  if (!bedtime || !wakeTime) return null;
  const bed = parseTimeToMinutes(bedtime);
  const wake = parseTimeToMinutes(wakeTime);
  if (bed === null || wake === null) return null;

  // bedtime이 자정 이후(0~6시)면 같은 날로 간주, 아니면 전날 밤
  let diff: number;
  if (bed > wake) {
    // 일반 케이스: 23:00 → 07:00
    diff = (24 * 60 - bed) + wake;
  } else {
    // bedtime이 자정 이후: 01:00 → 09:00
    diff = wake - bed;
  }
  return diff;
}

/**
 * 모든 시간 값을 "HH:mm" 형태로 정규화한다.
 * - "2026-02-07T10:30:00.000+09:00" → "10:30"
 * - Luxon-style .toFormat 객체 → "HH:mm"
 * - 이미 "23:30" 형태면 그대로 반환
 * - 파싱 불가 시 null 반환
 */
export function normalizeTimeString(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "object" && val !== null && "toFormat" in val) {
    return (val as { toFormat: (f: string) => string }).toFormat("HH:mm");
  }
  if (typeof val === "string") {
    // ISO datetime: 2026-02-07T10:30:00.000+09:00
    if (val.includes("T")) {
      const timePart = val.split("T")[1];
      if (timePart) return timePart.substring(0, 5);
    }
    // 이미 HH:mm
    if (/^\d{1,2}:\d{2}$/.test(val)) return val;
  }
  return null;
}

/** HH:mm 문자열을 분(minutes from midnight)으로 변환 */
export function parseTimeToMinutes(time: string): number | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** 분을 "Xh Ym" 형식으로 표시 */
export function formatMinutesToHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

/** Date → YYYY-MM-DD */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 해당 날짜가 포함된 주의 월요일을 반환 (ISO week: 월요일 시작) */
export function getWeekStart(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day; // 일요일이면 -6, 그 외 1-day
  result.setDate(result.getDate() + diff);
  return result;
}

/** YYYY-MM-DD → "YY-MM-DD 월" 같은 표시용 문자열 */
export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const yy = d.getFullYear().toString().slice(2);
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = days[d.getDay()];
  return `${yy}-${mm}-${dd} ${dayName}`;
}

const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** YYYY-MM-DD → Daily Note 파일명 (e.g. "2023-01-18 Wed") */
export function dailyNoteFileName(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${dateStr} ${EN_DAYS[d.getDay()]}`;
}

/** 현재 날짜 기준 Weekly Note 파일명 (e.g. "2023 Week 06") — zero-padded WW */
export function weeklyNoteFileName(refDate: Date = new Date()): string {
  const wk = getISOWeekNumber(refDate).toString().padStart(2, "0");
  return `${refDate.getFullYear()} Week ${wk}`;
}

/** 현재 날짜 기준 Monthly Note 파일명 (e.g. "2024-01") */
export function monthlyNoteFileName(refDate: Date = new Date()): string {
  return `${refDate.getFullYear()}-${(refDate.getMonth() + 1).toString().padStart(2, "0")}`;
}

/** ISO week number 계산 */
export function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** startDate ~ endDate 사이의 모든 날짜 배열 (YYYY-MM-DD) */
export function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");

  while (current <= last) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
