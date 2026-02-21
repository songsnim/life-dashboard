import { ItemView, WorkspaceLeaf, TFile, normalizePath } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import type { PluginSettings } from "../types";
import { VIEW_TYPE_DASHBOARD } from "../constants";
import { DailyNoteParser } from "../services/daily-note-parser";
import { NoteWriter } from "../services/note-writer";
import {
  getDateRange,
  generateDateRange,
  dailyNoteFileName,
  weeklyNoteFileName,
  monthlyNoteFileName,
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

    // Subscribe to viewMode changes → trigger data reload
    let prevViewMode = useViewStore.getState().config.viewMode;
    this.viewStoreUnsubscribe = useViewStore.subscribe((state) => {
      if (state.config.viewMode !== prevViewMode) {
        prevViewMode = state.config.viewMode;
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
      check(this.settings.monthlyNotesFolder)
    );
  }

  async refresh(): Promise<void> {
    // Skip refresh if there are pending writes (to avoid overwriting optimistic state)
    if (useDataStore.getState().pendingWrites > 0) return;

    useDataStore.getState().setLoading(true);

    const viewMode = useViewStore.getState().config.viewMode;
    const [startDate, endDate] = getDateRange(viewMode);
    const allDates = generateDateRange(startDate, endDate);

    const entries = await this.loadEntries(allDates);
    const weeklyGoal = await this.loadGoal("weekly");
    const monthlyGoal = await this.loadGoal("monthly");

    useDataStore.getState().setEntries(entries);
    useDataStore.getState().setGoals(weeklyGoal, monthlyGoal);
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

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }
}
