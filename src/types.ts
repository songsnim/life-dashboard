/** 대시보드 뷰 모드 */
export type ViewMode = "recent" | "weekly" | "monthly" | "yearly";

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

/** 테이블 컬럼 정의 */
export interface ColumnDef {
  key: keyof DayEntry;
  label: string;
  type: "date" | "time" | "boolean" | "number" | "text";
  editable: boolean;
  width?: string;
}
