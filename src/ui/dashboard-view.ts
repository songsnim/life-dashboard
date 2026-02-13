import { ItemView, WorkspaceLeaf, TFile, normalizePath } from "obsidian";
import type { DayEntry, GoalEntry, ViewMode, PluginSettings } from "../types";
import { VIEW_TYPE_DASHBOARD } from "../constants";
import { DailyNoteParser } from "../services/daily-note-parser";
import { getDateRange, generateDateRange, dailyNoteFileName, weeklyNoteFileName, monthlyNoteFileName } from "../services/date-utils";
import { DataService } from "../service";
import { TableRenderer } from "./table-renderer";
import { ChartRenderer } from "./chart-renderer";
import { ViewSwitcher } from "./view-switcher";
import { GoalPanel } from "./goal-panel";

/** debounce 간격 (ms) — 연속 편집 시 과도한 refresh 방지 */
const DEBOUNCE_MS = 300;

export class DashboardView extends ItemView {
  private parser: DailyNoteParser;
  private settings: PluginSettings;
  private dataService: DataService;

  private entries: DayEntry[] = [];
  private weeklyGoal: GoalEntry | null = null;
  private monthlyGoal: GoalEntry | null = null;
  private currentMode: ViewMode = "recent";

  private viewSwitcher!: ViewSwitcher;
  private goalPanel!: GoalPanel;
  private chartRenderer!: ChartRenderer;
  private tableRenderer!: TableRenderer;

  private bodyEl!: HTMLElement;
  private isInteracting = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings, dataService: DataService) {
    super(leaf);
    this.settings = settings;
    this.dataService = dataService;
    this.parser = new DailyNoteParser(this.app);
  }

  getViewType(): string {
    return VIEW_TYPE_DASHBOARD;
  }

  getDisplayText(): string {
    return "Life Dashboard";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("ld-container");

    // 상단 고정 영역: 뷰 전환 + 골
    const headerEl = container.createDiv({ cls: "ld-header" });

    this.viewSwitcher = new ViewSwitcher(headerEl, this.currentMode, (mode) => {
      this.currentMode = mode;
      this.refresh();
    });

    this.goalPanel = new GoalPanel(headerEl, this.dataService, this.app);

    // 스크롤 영역: 차트 + 테이블 (header는 밖에 위치하여 고정)
    this.bodyEl = container.createDiv({ cls: "ld-body" });
    const bodyEl = this.bodyEl;

    // 차트 영역
    const chartEl = bodyEl.createDiv({ cls: "ld-charts" });
    this.chartRenderer = new ChartRenderer(chartEl);

    // 테이블 영역
    const tableEl = bodyEl.createDiv({ cls: "ld-table-wrapper" });
    this.tableRenderer = new TableRenderer(tableEl, this.dataService, this.app, (interacting) => {
      this.isInteracting = interacting;
    });

    // vault 파일 변경 감지 → 다른 디바이스 동기화 + 로컬 편집 후 차트 갱신
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (this.isInteracting) return;
        if (file instanceof TFile && this.isRelevantFile(file)) {
          this.scheduleRefresh();
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && this.isRelevantFile(file)) {
          this.scheduleRefresh();
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && this.isRelevantFile(file)) {
          this.scheduleRefresh();
        }
      }),
    );

    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.chartRenderer?.destroy();
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
  }

  /** debounced refresh — 연속 변경 시 마지막 변경 후 DEBOUNCE_MS 뒤 1회만 실행 */
  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refresh();
    }, DEBOUNCE_MS);
  }

  /** 대시보드에 영향을 주는 파일인지 판별 */
  private isRelevantFile(file: TFile): boolean {
    const check = (dir: string) => file.path.startsWith(dir.endsWith("/") ? dir : dir + "/");
    return (
      check(this.settings.dailyNotesFolder) ||
      check(this.settings.weeklyNotesFolder) ||
      check(this.settings.monthlyNotesFolder)
    );
  }

  async refresh(): Promise<void> {
    // 스크롤 위치 저장 (refresh 후 DOM 재생성으로 초기화되는 것 방지)
    const bodyScrollTop = this.bodyEl?.scrollTop ?? 0;
    const oldScrollContainer = this.bodyEl?.querySelector(".ld-scroll-container");
    const tableScrollLeft = oldScrollContainer?.scrollLeft ?? 0;
    const tableScrollTop = oldScrollContainer?.scrollTop ?? 0;

    const [startDate, endDate] = getDateRange(this.currentMode);
    const allDates = generateDateRange(startDate, endDate);

    this.entries = await this.loadEntries(allDates);
    this.weeklyGoal = await this.loadGoal("weekly");
    this.monthlyGoal = await this.loadGoal("monthly");

    this.viewSwitcher.update(this.currentMode);
    this.goalPanel.update(this.weeklyGoal, this.monthlyGoal, this.currentMode);
    this.chartRenderer.update(this.entries);
    // 테이블은 최신 날짜가 상단 (내림차순)
    const descEntries = [...this.entries].sort((a, b) => b.date.localeCompare(a.date));
    this.tableRenderer.update(descEntries);

    // 스크롤 위치 복원
    if (this.bodyEl) this.bodyEl.scrollTop = bodyScrollTop;
    const newScrollContainer = this.bodyEl?.querySelector(".ld-scroll-container");
    if (newScrollContainer) {
      newScrollContainer.scrollLeft = tableScrollLeft;
      newScrollContainer.scrollTop = tableScrollTop;
    }
  }

  private async loadEntries(dates: string[]): Promise<DayEntry[]> {
    const entries: DayEntry[] = [];

    for (const date of dates) {
      const file = this.resolveDailyNote(date);
      if (file) {
        const entry = await this.parser.parse(file, date);
        entries.push(entry);
      }
    }

    return entries;
  }

  private resolveDailyNote(date: string): TFile | null {
    // "2023-01-18" → "Area/Daily/Days/2023-01-18 Wed.md"
    const fileName = dailyNoteFileName(date);
    const path = normalizePath(`${this.settings.dailyNotesFolder}/${fileName}.md`);
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  private async loadGoal(type: "weekly" | "monthly"): Promise<GoalEntry | null> {
    const now = new Date();
    const folder = type === "weekly" ? this.settings.weeklyNotesFolder : this.settings.monthlyNotesFolder;

    // 실제 파일명 생성: "2023 Week 42" 또는 "2024-01"
    const fileName = type === "weekly" ? weeklyNoteFileName(now) : monthlyNoteFileName(now);
    const path = normalizePath(`${folder}/${fileName}.md`);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;

    return this.parser.parseGoal(file, fileName);
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }
}
