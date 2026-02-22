import { ItemView, WorkspaceLeaf, TFile, normalizePath } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import type { PluginSettings, GoalBulkEntry } from "../types";
import { VIEW_TYPE_DASHBOARD } from "../constants";
import { DailyNoteParser } from "../services/daily-note-parser";
import { NoteWriter } from "../services/note-writer";
import {
  getPresetDateRange,
  generateDateRange,
  dailyNoteFileName,
  weeklyNoteFileName,
  monthlyNoteFileName,
  yearlyNoteFileName,
  getWeeksInMonth,
  getAllWeeksInYear,
  getWeekStartFromWeekNumber,
  getWeekRangeLabel,
} from "../services/date-utils";
import { DataService } from "../service";
import { useDataStore } from "../store/data-store";
import { useViewStore } from "../store/view-store";
import { DashboardApp } from "./react/DashboardApp";

/** debounce 간격 (ms) — 연속 편집 시 과도한 refresh 방지 */
const DEBOUNCE_MS = 300;

export class DashboardView extends ItemView {
  private parser: DailyNoteParser;
  private settings: PluginSettings;
  private dataService: DataService;
  private noteWriter: NoteWriter;

  private reactRoot: Root | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private viewStoreUnsubscribe: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, settings: PluginSettings, dataService: DataService) {
    super(leaf);
    this.settings = settings;
    this.dataService = dataService;
    this.parser = new DailyNoteParser(this.app);
    this.noteWriter = new NoteWriter(this.app);
  }

  getViewType(): string {
    return VIEW_TYPE_DASHBOARD;
  }

  getDisplayText(): string {
    return "Life dashboard";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("ld-container");

    // Single React mount point
    const reactMountEl = container.createEl("div", { cls: "ld-react-root" });
    this.reactRoot = createRoot(reactMountEl);
    this.reactRoot.render(
      createElement(DashboardApp, {
        app: this.app,
        settings: this.settings,
        dataService: this.dataService,
        noteWriter: this.noteWriter,
      }),
    );

    // Subscribe to viewMode + dateRangePreset changes → trigger data reload
    let prevViewMode = useViewStore.getState().config.viewMode;
    let prevPreset = useViewStore.getState().config.dateRangePreset;
    this.viewStoreUnsubscribe = useViewStore.subscribe((state) => {
      const modeChanged = state.config.viewMode !== prevViewMode;
      const presetChanged = state.config.dateRangePreset !== prevPreset;
      if (modeChanged || presetChanged) {
        prevViewMode = state.config.viewMode;
        prevPreset = state.config.dateRangePreset;
        this.scheduleRefresh();
      }
    });

    // Vault file change listeners
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (useDataStore.getState().pendingWrites > 0) return;
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

  onClose(): Promise<void> {
    this.viewStoreUnsubscribe?.();
    this.viewStoreUnsubscribe = null;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.reactRoot?.unmount();
    this.reactRoot = null;
    return Promise.resolve();
  }

  /** debounced refresh */
  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      void this.refresh();
    }, DEBOUNCE_MS);
  }

  /** 대시보드에 영향을 주는 파일인지 판별 */
  private isRelevantFile(file: TFile): boolean {
    const check = (dir: string) => file.path.startsWith(dir.endsWith("/") ? dir : dir + "/");
    return (
      check(this.settings.dailyNotesFolder) ||
      check(this.settings.weeklyNotesFolder) ||
      check(this.settings.monthlyNotesFolder) ||
      check(this.settings.yearlyNotesFolder)
    );
  }

  async refresh(): Promise<void> {
    // Skip refresh if there are pending writes (to avoid overwriting optimistic state)
    if (useDataStore.getState().pendingWrites > 0) return;

    useDataStore.getState().setLoading(true);

    const { viewMode, dateRangePreset } = useViewStore.getState().config;
    const now = new Date();

    // Determine date range for daily entries
    let entries;
    const presetRange = getPresetDateRange(dateRangePreset, now);
    if (presetRange) {
      const allDates = generateDateRange(presetRange[0], presetRange[1]);
      entries = await this.loadEntries(allDates);
    } else {
      // null preset = "전체": scan all files in daily notes folder
      entries = await this.loadAllEntries();
    }

    // Always load current week / month / year goals
    const weeklyGoal = await this.loadGoal("weekly");
    const monthlyGoal = await this.loadGoal("monthly");
    const yearlyGoal = await this.loadYearlyGoal();

    useDataStore.getState().setEntries(entries);
    useDataStore.getState().setGoals(weeklyGoal, monthlyGoal, yearlyGoal);

    // viewMode-specific bulk goal loading
    if (viewMode === "monthly") {
      const weeks = getWeeksInMonth(now.getFullYear(), now.getMonth());
      const monthWeeklyGoals = await this.loadWeeklyGoalsBulk(weeks);
      useDataStore.getState().setMonthWeeklyGoals(monthWeeklyGoals);
    } else if (viewMode === "yearly") {
      const months = Array.from({ length: 12 }, (_, i) => ({ year: now.getFullYear(), month: i }));
      const yearMonthlyGoals = await this.loadMonthlyGoalsBulk(months);

      const allWeekNums = getAllWeeksInYear(now.getFullYear());
      const yearWeeks = allWeekNums.map((wn) => ({ weekYear: now.getFullYear(), weekNum: wn }));
      const yearWeeklyGoals = await this.loadWeeklyGoalsBulk(yearWeeks);

      useDataStore.getState().setYearGoals(yearMonthlyGoals, yearWeeklyGoals);
    }

    useDataStore.getState().setLoading(false);
  }

  private async loadEntries(dates: string[]) {
    const entries = [];
    for (const date of dates) {
      const file = this.resolveDailyNote(date);
      if (file) {
        const entry = await this.parser.parse(file, date);
        entries.push(entry);
      }
    }
    return entries;
  }

  /** vault 내 daily notes 폴더의 모든 파일을 스캔하여 로드 ("전체" 프리셋) */
  private async loadAllEntries() {
    const folder = this.settings.dailyNotesFolder;
    const folderPrefix = folder.endsWith("/") ? folder : folder + "/";
    const files = this.app.vault.getFiles().filter(
      (f) => f.path.startsWith(folderPrefix) && f.extension === "md",
    );

    const entries = [];
    for (const file of files) {
      const dateMatch = file.basename.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const date = dateMatch[1];
        const entry = await this.parser.parse(file, date);
        entries.push(entry);
      }
    }
    return entries;
  }

  private resolveDailyNote(date: string): TFile | null {
    const fileName = dailyNoteFileName(date);
    const path = normalizePath(`${this.settings.dailyNotesFolder}/${fileName}.md`);
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  private async loadGoal(type: "weekly" | "monthly") {
    const now = new Date();
    const folder =
      type === "weekly" ? this.settings.weeklyNotesFolder : this.settings.monthlyNotesFolder;
    const fileName = type === "weekly" ? weeklyNoteFileName(now) : monthlyNoteFileName(now);
    const path = normalizePath(`${folder}/${fileName}.md`);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;
    return this.parser.parseGoal(file, fileName);
  }

  private async loadYearlyGoal() {
    const now = new Date();
    const fileName = yearlyNoteFileName(now);
    const path = normalizePath(`${this.settings.yearlyNotesFolder}/${fileName}.md`);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;
    return this.parser.parseGoal(file, fileName);
  }

  private async loadWeeklyGoalsBulk(
    weeks: { weekYear: number; weekNum: number }[],
  ): Promise<GoalBulkEntry[]> {
    const results: GoalBulkEntry[] = [];
    for (const { weekYear, weekNum } of weeks) {
      const monday = getWeekStartFromWeekNumber(weekYear, weekNum);
      const fileName = weeklyNoteFileName(monday);
      const label = getWeekRangeLabel(weekYear, weekNum);
      const path = normalizePath(`${this.settings.weeklyNotesFolder}/${fileName}.md`);
      const file = this.app.vault.getAbstractFileByPath(path);
      const goal = file instanceof TFile ? await this.parser.parseGoal(file, fileName) : null;
      results.push({ period: fileName, label, goal });
    }
    return results;
  }

  private async loadMonthlyGoalsBulk(
    months: { year: number; month: number }[],
  ): Promise<GoalBulkEntry[]> {
    const results: GoalBulkEntry[] = [];
    for (const { year, month } of months) {
      const refDate = new Date(year, month, 1);
      const fileName = monthlyNoteFileName(refDate);
      const label = `${month + 1}월`;
      const path = normalizePath(`${this.settings.monthlyNotesFolder}/${fileName}.md`);
      const file = this.app.vault.getAbstractFileByPath(path);
      const goal = file instanceof TFile ? await this.parser.parseGoal(file, fileName) : null;
      results.push({ period: fileName, label, goal });
    }
    return results;
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }
}
