import { create } from "zustand";
import type { DayEntry, GoalEntry, GoalBulkEntry, FilterRule, SortRule } from "../types";
import { ColumnType } from "../types";
import { TABLE_COLUMNS } from "../constants";
import { calcSleepMinutes, parseTimeToMinutes } from "../services/date-utils";

interface DataState {
  entries: DayEntry[];
  weeklyGoal: GoalEntry | null;
  monthlyGoal: GoalEntry | null;
  yearlyGoal: GoalEntry | null;
  /** 이번 달에 속하는 주간 goal (monthly view 전용) */
  monthWeeklyGoals: GoalBulkEntry[];
  /** 올해 12개 월간 goal (yearly view 전용) */
  yearMonthlyGoals: GoalBulkEntry[];
  /** 올해 모든 주간 goal (yearly view 전용) */
  yearWeeklyGoals: GoalBulkEntry[];
  isLoading: boolean;
  pendingWrites: number;

  // Actions
  setEntries: (entries: DayEntry[]) => void;
  setGoals: (weekly: GoalEntry | null, monthly: GoalEntry | null, yearly: GoalEntry | null) => void;
  setMonthWeeklyGoals: (goals: GoalBulkEntry[]) => void;
  setYearGoals: (monthlyGoals: GoalBulkEntry[], weeklyGoals: GoalBulkEntry[]) => void;
  setLoading: (loading: boolean) => void;
  incrementPendingWrites: () => void;
  decrementPendingWrites: () => void;

  // Optimistic UI
  optimisticUpdate: (date: string, field: keyof DayEntry, value: DayEntry[keyof DayEntry]) => DayEntry[keyof DayEntry] | undefined;
  rollbackUpdate: (date: string, field: keyof DayEntry, previous: DayEntry[keyof DayEntry] | undefined) => void;

  // Derived
  getFilteredSorted: (filters: FilterRule[], sorts: SortRule[]) => DayEntry[];
}

function getCellValue(entry: DayEntry, columnId: string): string | number | boolean | null {
  const col = TABLE_COLUMNS.find((c) => c.id === columnId);
  if (!col) return null;

  if (col.type === ColumnType.DURATION) {
    return calcSleepMinutes(entry.bedtime, entry.wakeTime);
  }

  if (col.entryKey) {
    const val = entry[col.entryKey];
    if (col.type === ColumnType.TIME && typeof val === "string") {
      return parseTimeToMinutes(val) ?? null;
    }
    return val as string | number | boolean | null;
  }

  return null;
}

function applyFilter(entry: DayEntry, filter: FilterRule): boolean {
  const val = getCellValue(entry, filter.columnId);

  if (filter.operator === "isEmpty") {
    return val === null || val === "" || val === false;
  }

  if (val === null || val === undefined) return false;

  switch (filter.operator) {
    case "eq":
      return String(val) === String(filter.value);
    case "neq":
      return String(val) !== String(filter.value);
    case "gt":
      return Number(val) > Number(filter.value);
    case "lt":
      return Number(val) < Number(filter.value);
    case "gte":
      return Number(val) >= Number(filter.value);
    case "lte":
      return Number(val) <= Number(filter.value);
    case "contains":
      return String(val).toLowerCase().includes(String(filter.value).toLowerCase());
    default:
      return true;
  }
}

function compareValues(
  a: DayEntry,
  b: DayEntry,
  columnId: string,
  direction: "asc" | "desc",
): number {
  const aVal = getCellValue(a, columnId);
  const bVal = getCellValue(b, columnId);

  // Nulls always last
  if (aVal === null && bVal === null) return 0;
  if (aVal === null) return 1;
  if (bVal === null) return -1;

  let cmp = 0;
  if (typeof aVal === "boolean" && typeof bVal === "boolean") {
    cmp = (aVal === bVal ? 0 : aVal ? -1 : 1);
  } else if (typeof aVal === "number" && typeof bVal === "number") {
    cmp = aVal - bVal;
  } else {
    cmp = String(aVal).localeCompare(String(bVal));
  }

  return direction === "asc" ? cmp : -cmp;
}

export const useDataStore = create<DataState>((set, get) => ({
  entries: [],
  weeklyGoal: null,
  monthlyGoal: null,
  yearlyGoal: null,
  monthWeeklyGoals: [],
  yearMonthlyGoals: [],
  yearWeeklyGoals: [],
  isLoading: false,
  pendingWrites: 0,

  setEntries: (entries) => set({ entries }),
  setGoals: (weekly, monthly, yearly) => set({ weeklyGoal: weekly, monthlyGoal: monthly, yearlyGoal: yearly }),
  setMonthWeeklyGoals: (goals) => set({ monthWeeklyGoals: goals }),
  setYearGoals: (monthlyGoals, weeklyGoals) => set({ yearMonthlyGoals: monthlyGoals, yearWeeklyGoals: weeklyGoals }),
  setLoading: (isLoading) => set({ isLoading }),
  incrementPendingWrites: () => set((s) => ({ pendingWrites: s.pendingWrites + 1 })),
  decrementPendingWrites: () => set((s) => ({ pendingWrites: Math.max(0, s.pendingWrites - 1) })),

  optimisticUpdate: (date, field, value) => {
    const entries = get().entries;
    const idx = entries.findIndex((e) => e.date === date);
    if (idx === -1) return undefined;

    const previous = entries[idx][field];
    const updated = entries.map((e, i) =>
      i === idx ? { ...e, [field]: value } : e,
    );
    set({ entries: updated });
    return previous;
  },

  rollbackUpdate: (date, field, previous) => {
    const entries = get().entries;
    const updated = entries.map((e) =>
      e.date === date ? { ...e, [field]: previous } : e,
    );
    set({ entries: updated });
  },

  getFilteredSorted: (filters, sorts) => {
    let result = [...get().entries];

    // Apply filters
    for (const filter of filters) {
      result = result.filter((e) => applyFilter(e, filter));
    }

    // Apply sorts (multi-column)
    if (sorts.length > 0) {
      result.sort((a, b) => {
        for (const sort of sorts) {
          const cmp = compareValues(a, b, sort.columnId, sort.direction);
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
    }

    return result;
  },
}));
