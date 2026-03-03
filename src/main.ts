import { Plugin, PluginSettingTab, App, Setting } from "obsidian";
import type { PluginSettings } from "./types";
import { VIEW_TYPE_DASHBOARD, DEFAULT_SETTINGS } from "./constants";
import { DashboardView } from "./ui/dashboard-view";
import { DataService } from "./service";
import { useDataStore } from "./store/data-store";
import { useViewStore } from "./store/view-store";

export default class LifeDashboardPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_SETTINGS };
  dataService!: DataService;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.dataService = new DataService(this.app);

    this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this.settings, this.dataService));

    // Inject save function into view store so Zustand can persist view config
    useViewStore.getState().injectSaveFn(async () => {
      const viewConfig = useViewStore.getState().serialize();
      await this.saveData({ ...this.settings, viewConfig });
    });

    // Hydrate view config from saved data
    const data = await this.loadData();
    if (data?.viewConfig) {
      useViewStore.getState().hydrate(data.viewConfig);
    }
    // Merge settings separately (avoid overwriting with viewConfig keys)
    this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };

    this.addRibbonIcon("layout-dashboard", "Life dashboard", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-dashboard",
      name: "Open dashboard",
      callback: () => { void this.activateView(); },
    });

    this.addSettingTab(new LifeDashboardSettingTab(this.app, this));
  }

  onunload(): void {
    // Reset store state so hot-reload doesn't leave stale data
    useDataStore.getState().setEntries([]);
    useDataStore.getState().setGoals(null, null, null);
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    if (existing.length > 0) {
      void this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
    void this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
  }

  async saveSettings(): Promise<void> {
    const viewConfig = useViewStore.getState().serialize();
    await this.saveData({ ...this.settings, viewConfig });

    // Propagate settings change to open views
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
      .setName("Daily notes 폴더")
      .setDesc("Daily note 파일들이 위치한 폴더 경로")
      .addText((text) =>
        text
          .setPlaceholder("Daily")
          .setValue(this.plugin.settings.dailyNotesFolder)
          .onChange((value) => {
            this.plugin.settings.dailyNotesFolder = value.trim();
            void this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Weekly notes folder")
      .setDesc("Folder path where weekly note files are located")
      .addText((text) =>
        text
          .setPlaceholder("Weekly")
          .setValue(this.plugin.settings.weeklyNotesFolder)
          .onChange((value) => {
            this.plugin.settings.weeklyNotesFolder = value.trim();
            void this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Monthly notes folder")
      .setDesc("Folder path where monthly note files are located")
      .addText((text) =>
        text
          .setPlaceholder("Monthly")
          .setValue(this.plugin.settings.monthlyNotesFolder)
          .onChange((value) => {
            this.plugin.settings.monthlyNotesFolder = value.trim();
            void this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Yearly notes folder")
      .setDesc("Folder path where yearly note files are located (filename: year, e.g. 2026.md)")
      .addText((text) =>
        text
          .setPlaceholder("area/daily/years")
          .setValue(this.plugin.settings.yearlyNotesFolder)
          .onChange((value) => {
            this.plugin.settings.yearlyNotesFolder = value.trim();
            void this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Daily note filename format")
      .setDesc("Date format using Moment.js syntax (default: YYYY-MM-DD ddd)")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD ddd")
          .setValue(this.plugin.settings.dailyFormat)
          .onChange((value) => {
            this.plugin.settings.dailyFormat = value.trim();
            void this.plugin.saveSettings();
          }),
      );
  }
}
