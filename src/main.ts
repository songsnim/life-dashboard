import { Plugin, PluginSettingTab, App, Setting } from "obsidian";
import type { PluginSettings } from "./types";
import { VIEW_TYPE_DASHBOARD, DEFAULT_SETTINGS } from "./constants";
import { DashboardView } from "./ui/dashboard-view";
import { DataService } from "./service";

export default class LifeDashboardPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_SETTINGS };
  dataService: DataService;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.dataService = new DataService(this.app);

    this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this.settings, this.dataService));

    this.addRibbonIcon("layout-dashboard", "Life Dashboard", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-life-dashboard",
      name: "Open Life Dashboard",
      callback: () => this.activateView(),
    });

    this.addSettingTab(new LifeDashboardSettingTab(this.app, this));
  }

  async onunload(): Promise<void> {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_DASHBOARD);
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);

    // 열려있는 뷰에 설정 변경 반영
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)) {
      const view = leaf.view;
      if (view instanceof DashboardView) {
        view.updateSettings(this.settings);
      }
    }
  }
}

class LifeDashboardSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: LifeDashboardPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Daily Notes 폴더")
      .setDesc("Daily Note 파일들이 위치한 폴더 경로")
      .addText((text) =>
        text
          .setPlaceholder("Daily")
          .setValue(this.plugin.settings.dailyNotesFolder)
          .onChange(async (value) => {
            this.plugin.settings.dailyNotesFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Weekly Notes 폴더")
      .setDesc("Weekly Note 파일들이 위치한 폴더 경로")
      .addText((text) =>
        text
          .setPlaceholder("Weekly")
          .setValue(this.plugin.settings.weeklyNotesFolder)
          .onChange(async (value) => {
            this.plugin.settings.weeklyNotesFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Monthly Notes 폴더")
      .setDesc("Monthly Note 파일들이 위치한 폴더 경로")
      .addText((text) =>
        text
          .setPlaceholder("Monthly")
          .setValue(this.plugin.settings.monthlyNotesFolder)
          .onChange(async (value) => {
            this.plugin.settings.monthlyNotesFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Daily Note 파일명 포맷")
      .setDesc("moment.js 포맷 (기본: YYYY-MM-DD)")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.plugin.settings.dailyFormat)
          .onChange(async (value) => {
            this.plugin.settings.dailyFormat = value.trim();
            await this.plugin.saveSettings();
          }),
      );
  }
}
