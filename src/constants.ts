import type { ColumnDef, PluginSettings } from "./types";

export const VIEW_TYPE_DASHBOARD = "log-day-dashboard";

export const DEFAULT_SETTINGS: PluginSettings = {
  dailyNotesFolder: "Area/Daily/Days",
  weeklyNotesFolder: "Area/Daily/Weeks",
  monthlyNotesFolder: "Area/Daily/Months",
  dailyFormat: "YYYY-MM-DD ddd",
  weeklyFormat: "YYYY [Week] WW",
  monthlyFormat: "YYYY-MM",
};

/** 최근 N일 뷰 기본값 */
export const RECENT_DAYS = 15;

/** 수면시간 목표 보조선 (분) */
export const SLEEP_TARGET_MINUTES = 7 * 60;

/** 스크린타임 목표 보조선 (분) */
export const SCREEN_TIME_TARGET_MINUTES = 4 * 60;

/** 테이블 컬럼 순서 */
export const TABLE_COLUMNS: ColumnDef[] = [
  { key: "date", label: "DATE", type: "date", editable: false, width: "110px" },
  { key: "bedtime", label: "취침", type: "time", editable: true, width: "65px" },
  { key: "wakeTime", label: "기상", type: "time", editable: true, width: "65px" },
  // SLEEP (computed) inserted dynamically after 기상
  { key: "reading", label: "독서", type: "boolean", editable: true, width: "35px" },
  { key: "exercise", label: "운동", type: "boolean", editable: true, width: "35px" },
  { key: "sobriety", label: "금주", type: "boolean", editable: true, width: "35px" },
  { key: "screenTime", label: "스크린", type: "time", editable: true, width: "65px" },
  { key: "tasks", label: "TASKS", type: "text", editable: true, width: "180px" },
  { key: "rating", label: "평가", type: "number", editable: true, width: "55px" },
  { key: "journal", label: "JOURNAL", type: "text", editable: true, width: "250px" },
];

/** frontmatter에서 읽을 property 키 매핑 (한글 property → DayEntry 필드) */
export const FRONTMATTER_MAP: Record<string, keyof import("./types").DayEntry> = {
  취침: "bedtime",
  기상: "wakeTime",
  스크린타임: "screenTime",
  운동: "exercise",
  독서: "reading",
  금주: "sobriety",
  평가: "rating",
};

/** DayEntry 필드명 -> 한글 property 키 매핑 (저장 시 사용) */
export const INTERNAL_TO_FRONTMATTER_MAP: Record<string, string> = {
  bedtime: "취침",
  wakeTime: "기상",
  screenTime: "스크린타임",
  exercise: "운동",
  reading: "독서",
  sobriety: "금주",
  rating: "평가",
};

/** body에서 파싱할 섹션 헤더 (Daily Note는 "Todo" 사용, Weekly/Monthly는 "Goal") */
export const BODY_SECTIONS = ["Todo", "Tasks", "Journal", "Goal"] as const;
