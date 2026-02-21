/** 대시보드 뷰 모드 */
export type ViewMode = "15days" | "weekly" | "monthly" | "yearly";

/** Daily Note에서 파싱한 하루치 데이터 */
export interface DayEntry {
  /** YYYY-MM-DD */
  date: string;
  /** 파일 경로 (vault 내 상대경로) */
  filePath: string;

  // --- frontmatter properties ---
  /** 취침시간 (HH:mm) — 전날 밤 */
  bedtime: string | null;
  /** 기상시간 (HH:mm) */
  wakeTime: string | null;
  /** 스크린타임 (HH:mm 또는 분 단위) */
  screenTime: string | null;
  /** 운동 여부 */
  exercise: boolean;
  /** 독서 여부 */
  reading: boolean;
  /** 금주 여부 */
  sobriety: boolean;
  /** 그날의 평가 점수 (0–10) */
  rating: number | null;

  // --- body sections ---
  /** ### Tasks 아래 텍스트 */
  tasks: string;
  /** ### Journal 아래 텍스트 */
  journal: string;
}

/** 계산된 수면시간 (분 단위) */
export interface SleepData {
  date: string;
  durationMinutes: number;
}

/** Weekly/Monthly Note의 Goal 데이터 */
export interface GoalEntry {
  /** 파일 경로 */
  filePath: string;
  /** 기간 라벨 (e.g. "2024-W03", "2024-01") */
  period: string;
  /** ### Goal 아래 텍스트 */
  content: string;
}

/** 플러그인 설정 */
export interface PluginSettings {
  /** Daily Notes 폴더 경로 */
  dailyNotesFolder: string;
  /** Weekly Notes 폴더 경로 */
  weeklyNotesFolder: string;
  /** Monthly Notes 폴더 경로 */
  monthlyNotesFolder: string;
  /** Daily Note 파일명 포맷 (moment.js) */
  dailyFormat: string;
  /** Weekly Note 파일명 포맷 */
  weeklyFormat: string;
  /** Monthly Note 파일명 포맷 */
  monthlyFormat: string;
}

/** 컬럼 타입 */
export enum ColumnType {
  DATE = "date",
  TIME = "time",
  DURATION = "duration",
  BOOLEAN = "boolean",
  NUMBER = "number",
  TEXT = "text",
  CHECKLIST = "checklist",
}

/** 컬럼 정의 */
export interface ColumnDef {
  id: string;
  name: string;                   // Korean display name
  type: ColumnType;
  source: "frontmatter" | "body-section" | "computed";
  frontmatterKey?: string;        // e.g. "취침"
  entryKey?: keyof DayEntry;      // bridge to DayEntry field
  width: number;
  visible: boolean;
}

/** 필터 규칙 */
export interface FilterRule {
  columnId: string;
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains" | "isEmpty";
  value: string | number | boolean;
}

/** 정렬 규칙 */
export interface SortRule {
  columnId: string;
  direction: "asc" | "desc";
}

/** 뷰 설정 */
export interface ViewConfig {
  viewMode: ViewMode;
  columnOrder: string[];
  sorts: SortRule[];
  filters: FilterRule[];
}

/** data.json에 저장되는 뷰 설정 */
export interface PersistedViewConfig extends ViewConfig {
  columnWidths: Record<string, number>;
  columnVisible: Record<string, boolean>;
}
