import { ColumnType, ViewConfig } from "./types";
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

/** 테이블 컬럼 정의 (Notion-style) */
export const TABLE_COLUMNS: ColumnDef[] = [
  { id: "date",           name: "날짜",   type: ColumnType.DATE,      source: "computed",      entryKey: "date",       width: 110, visible: true },
  { id: "bedtime",        name: "취침",   type: ColumnType.TIME,      source: "frontmatter",   frontmatterKey: "취침", entryKey: "bedtime",    width: 72,  visible: true },
  { id: "wake-time",      name: "기상",   type: ColumnType.TIME,      source: "frontmatter",   frontmatterKey: "기상", entryKey: "wakeTime",   width: 72,  visible: true },
  { id: "sleep-duration", name: "수면",   type: ColumnType.DURATION,  source: "computed",      width: 80,  visible: true },
  { id: "reading",        name: "독서",   type: ColumnType.BOOLEAN,   source: "frontmatter",   frontmatterKey: "독서", entryKey: "reading",    width: 56,  visible: true },
  { id: "exercise",       name: "운동",   type: ColumnType.BOOLEAN,   source: "frontmatter",   frontmatterKey: "운동", entryKey: "exercise",   width: 56,  visible: true },
  { id: "sobriety",       name: "금주",   type: ColumnType.BOOLEAN,   source: "frontmatter",   frontmatterKey: "금주", entryKey: "sobriety",   width: 56,  visible: true },
  { id: "screen-time",    name: "스크린", type: ColumnType.TIME,      source: "frontmatter",   frontmatterKey: "스크린타임", entryKey: "screenTime", width: 72, visible: true },
  { id: "tasks",          name: "할 일",  type: ColumnType.CHECKLIST, source: "body-section",  entryKey: "tasks",      width: 200, visible: true },
  { id: "rating",         name: "평가",   type: ColumnType.NUMBER,    source: "frontmatter",   frontmatterKey: "평가", entryKey: "rating",     width: 56,  visible: true },
  { id: "journal",        name: "저널",   type: ColumnType.TEXT,      source: "body-section",  entryKey: "journal",    width: 240, visible: true },
];

export const DEFAULT_COLUMN_ORDER: string[] = TABLE_COLUMNS.map((c) => c.id);

export const DEFAULT_VIEW_CONFIG: ViewConfig = {
  viewMode: "15days",
  columnOrder: DEFAULT_COLUMN_ORDER,
  sorts: [],
  filters: [],
};

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

/** tasks/journal → 노트 섹션 헤더 매핑 */
export const SECTION_MAP: Record<string, string> = {
  tasks: "Todo",
  journal: "Journal",
};
