import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";
import type { ViewConfig, PersistedViewConfig, FilterRule, ViewMode, DateRangePreset } from "../types";
import { DEFAULT_VIEW_CONFIG, TABLE_COLUMNS } from "../constants";

interface ViewState {
  config: ViewConfig;
  columnWidths: Record<string, number>;
  columnVisible: Record<string, boolean>;

  // Lifecycle
  injectSaveFn: (fn: () => Promise<void>) => void;
  hydrate: (saved: PersistedViewConfig) => void;
  serialize: () => PersistedViewConfig;
  triggerSave: () => void;

  // View mode
  setViewMode: (mode: ViewMode) => void;
  setDateRangePreset: (preset: DateRangePreset) => void;

  // Column order
  setColumnOrder: (order: string[]) => void;
  reorderColumn: (activeId: string, overId: string) => void;

  // Sorts
  addSort: (columnId: string, direction: "asc" | "desc") => void;
  removeSort: (columnId: string) => void;
  toggleSortDirection: (columnId: string) => void;
  clearSorts: () => void;
  cycleSort: (columnId: string) => void;

  // Filters
  addFilter: (filter: FilterRule) => void;
  removeFilter: (columnId: string) => void;
  clearFilters: () => void;

  // Column display
  setColumnWidth: (columnId: string, width: number) => void;
  setColumnVisible: (columnId: string, visible: boolean) => void;
}

let saveFn: (() => Promise<void>) | null = null;

function triggerSaveImpl() {
  if (saveFn) {
    void saveFn();
  }
}

const defaultColumnWidths: Record<string, number> = Object.fromEntries(
  TABLE_COLUMNS.map((c) => [c.id, c.width]),
);

const defaultColumnVisible: Record<string, boolean> = Object.fromEntries(
  TABLE_COLUMNS.map((c) => [c.id, c.visible]),
);

export const useViewStore = create<ViewState>((set, get) => ({
  config: { ...DEFAULT_VIEW_CONFIG },
  columnWidths: { ...defaultColumnWidths },
  columnVisible: { ...defaultColumnVisible },

  injectSaveFn: (fn) => {
    saveFn = fn;
  },

  hydrate: (saved) => {
    // Migrate "recent" / "15days" → viewMode="weekly", preset="15days"
    let viewMode: ViewMode = saved.viewMode;
    let dateRangePreset: DateRangePreset = saved.dateRangePreset ?? "15days";

    if ((saved.viewMode as string) === "recent" || (saved.viewMode as string) === "15days") {
      viewMode = "weekly";
      dateRangePreset = "15days";
    }

    set({
      config: {
        viewMode,
        dateRangePreset,
        columnOrder: saved.columnOrder?.length ? saved.columnOrder : DEFAULT_VIEW_CONFIG.columnOrder,
        sorts: saved.sorts ?? [],
        filters: saved.filters ?? [],
      },
      columnWidths: { ...defaultColumnWidths, ...saved.columnWidths },
      columnVisible: { ...defaultColumnVisible, ...saved.columnVisible },
    });
  },

  serialize: (): PersistedViewConfig => {
    const { config, columnWidths, columnVisible } = get();
    return { ...config, columnWidths, columnVisible };
  },

  triggerSave: () => {
    triggerSaveImpl();
  },

  setViewMode: (mode) => {
    set((s) => {
      const newConfig = { ...s.config, viewMode: mode };
      // Auto-set default preset per view mode
      if (mode === "monthly") newConfig.dateRangePreset = "month";
      else if (mode === "yearly") newConfig.dateRangePreset = "year";
      else if (mode === "weekly") newConfig.dateRangePreset = "15days";
      return { config: newConfig };
    });
    triggerSaveImpl();
  },

  setDateRangePreset: (preset) => {
    set((s) => ({ config: { ...s.config, dateRangePreset: preset } }));
    triggerSaveImpl();
  },

  setColumnOrder: (order) => {
    set((s) => ({ config: { ...s.config, columnOrder: order } }));
    triggerSaveImpl();
  },

  reorderColumn: (activeId, overId) => {
    const { config } = get();
    const oldOrder = config.columnOrder;
    const activeIdx = oldOrder.indexOf(activeId);
    const overIdx = oldOrder.indexOf(overId);
    if (activeIdx === -1 || overIdx === -1) return;
    const newOrder = arrayMove(oldOrder, activeIdx, overIdx);
    set((s) => ({ config: { ...s.config, columnOrder: newOrder } }));
    triggerSaveImpl();
  },

  addSort: (columnId, direction) => {
    set((s) => {
      const existing = s.config.sorts.filter((x) => x.columnId !== columnId);
      return { config: { ...s.config, sorts: [...existing, { columnId, direction }] } };
    });
    triggerSaveImpl();
  },

  removeSort: (columnId) => {
    set((s) => ({
      config: { ...s.config, sorts: s.config.sorts.filter((x) => x.columnId !== columnId) },
    }));
    triggerSaveImpl();
  },

  toggleSortDirection: (columnId) => {
    set((s) => ({
      config: {
        ...s.config,
        sorts: s.config.sorts.map((x) =>
          x.columnId === columnId
            ? { ...x, direction: x.direction === "asc" ? "desc" : "asc" }
            : x,
        ),
      },
    }));
    triggerSaveImpl();
  },

  clearSorts: () => {
    set((s) => ({ config: { ...s.config, sorts: [] } }));
    triggerSaveImpl();
  },

  /**
   * Click cycle: none → desc → asc → none
   */
  cycleSort: (columnId) => {
    const { config } = get();
    const existing = config.sorts.find((x) => x.columnId === columnId);

    if (!existing) {
      get().addSort(columnId, "desc");
    } else if (existing.direction === "desc") {
      get().toggleSortDirection(columnId);
    } else {
      get().removeSort(columnId);
    }
  },

  addFilter: (filter) => {
    set((s) => {
      const existing = s.config.filters.filter((x) => x.columnId !== filter.columnId);
      return { config: { ...s.config, filters: [...existing, filter] } };
    });
    triggerSaveImpl();
  },

  removeFilter: (columnId) => {
    set((s) => ({
      config: { ...s.config, filters: s.config.filters.filter((x) => x.columnId !== columnId) },
    }));
    triggerSaveImpl();
  },

  clearFilters: () => {
    set((s) => ({ config: { ...s.config, filters: [] } }));
    triggerSaveImpl();
  },

  setColumnWidth: (columnId, width) => {
    set((s) => ({ columnWidths: { ...s.columnWidths, [columnId]: width } }));
    triggerSaveImpl();
  },

  setColumnVisible: (columnId, visible) => {
    set((s) => ({ columnVisible: { ...s.columnVisible, [columnId]: visible } }));
    triggerSaveImpl();
  },
}));
