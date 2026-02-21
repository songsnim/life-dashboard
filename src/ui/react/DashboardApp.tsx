import React, { useMemo } from "react";
import type { App } from "obsidian";
import type { DayEntry } from "../../types";
import type { DataService } from "../../service";
import type { NoteWriter } from "../../services/note-writer";
import type { PluginSettings } from "../../types";
import { AppContext } from "./context";
import { useDataStore } from "../../store/data-store";
import { useViewStore } from "../../store/view-store";
import { ViewSwitcherReact } from "./ViewSwitcherReact";
import { GoalPanelReact } from "./GoalPanelReact";
import { FilterBar } from "./FilterBar";
import { ColumnVisibilityMenu } from "./ColumnVisibilityMenu";
import { ChartSection } from "./ChartSection";
import { VirtualTable } from "./VirtualTable";

interface DashboardAppProps {
  app: App;
  settings: PluginSettings;
  dataService: DataService;
  noteWriter: NoteWriter;
}

export function DashboardApp({ app, settings, dataService, noteWriter }: DashboardAppProps) {
  const contextValue = useMemo(
    () => ({ app, settings, dataService, noteWriter }),
    [app, settings, dataService, noteWriter],
  );

  return (
    <AppContext.Provider value={contextValue}>
      <DashboardInner />
    </AppContext.Provider>
  );
}

function DashboardInner() {
  const entries = useDataStore((s) => s.entries);
  const weeklyGoal = useDataStore((s) => s.weeklyGoal);
  const monthlyGoal = useDataStore((s) => s.monthlyGoal);
  const isLoading = useDataStore((s) => s.isLoading);

  const sorts = useViewStore((s) => s.config.sorts);
  const filters = useViewStore((s) => s.config.filters);

  // Filtered + sorted entries (newest first by default when no sort applied)
  const filteredEntries: DayEntry[] = useMemo(() => {
    const result = useDataStore.getState().getFilteredSorted(filters, sorts);
    // Default order: newest first (desc by date) when no sort rules
    if (sorts.length === 0) {
      return [...result].sort((a, b) => b.date.localeCompare(a.date));
    }
    return result;
  }, [entries, sorts, filters]);

  return (
    <div className="ld-app">
      {/* ── Header ── */}
      <div className="ld-header">
        <div className="ld-header-controls">
          <ViewSwitcherReact />
          <ColumnVisibilityMenu />
        </div>
        <GoalPanelReact weeklyGoal={weeklyGoal} monthlyGoal={monthlyGoal} />
      </div>

      {/* ── Scrollable body ── */}
      <div className="ld-body">
        {isLoading ? (
          <div className="ld-loading">불러오는 중...</div>
        ) : (
          <>
            <ChartSection entries={filteredEntries} />
            <FilterBar />
            <VirtualTable entries={filteredEntries} />
          </>
        )}
      </div>
    </div>
  );
}
