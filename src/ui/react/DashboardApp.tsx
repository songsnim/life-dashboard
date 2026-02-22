import React, { useMemo, useRef, useEffect } from "react";
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
  /** .ld-body 요소 — VirtualTable의 세로 스크롤 컨테이너로 전달 */
  const bodyRef = useRef<HTMLDivElement>(null);

  /** .ld-app 요소 — iOS 키보드 대응 height/transform 조정 대상 */
  const appRef = useRef<HTMLDivElement>(null);

  /**
   * iOS WKWebView 키보드 대응 핵심 수정:
   *
   * 문제의 진짜 원인:
   *   키보드가 열리면 iOS WKWebView가 내부 UIScrollView의 contentInset.bottom을
   *   키보드 높이만큼 증가시킨다. 이로 인해 웹 콘텐츠 전체가 위로 스크롤된다
   *   (window.visualViewport.offsetTop > 0). .ld-app은 height:100%로 원래 높이를
   *   유지하지만, 스크롤된 만큼 하단에 '빈 공간(키보드 높이)'이 생긴다.
   *   모든 배경이 transparent이므로 이 빈 공간이 투명한 컴포넌트처럼 보인다.
   *
   * 해결:
   *   window.visualViewport의 resize/scroll 이벤트를 구독해:
   *   1) .ld-app height = vv.height (키보드 위 실제 가시 영역 높이)
   *   2) .ld-app translateY = vv.offsetTop (페이지 스크롤 상쇄)
   *
   *   이렇게 하면 .ld-app이 항상 키보드 위의 가시 영역을 정확히 채우고,
   *   아래에 투명한 빈 공간이 생기지 않는다.
   *
   * Android:
   *   뷰포트 자체가 리사이즈되므로 vv.offsetTop=0, vv.height=줄어든 높이.
   *   동일한 코드로 올바르게 동작한다.
   */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const el = appRef.current;
      if (!el) return;
      // 가시 영역 높이로 .ld-app 크기 제한 → 키보드 아래 투명 빈 공간 제거
      el.style.height = `${vv.height}px`;
      // 페이지 스크롤(iOS contentInset 조정으로 발생) 상쇄
      el.style.transform = `translateY(${vv.offsetTop}px)`;
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      const el = appRef.current;
      if (el) {
        el.style.height = "";
        el.style.transform = "";
      }
    };
  }, []);

  const entries = useDataStore((s) => s.entries);
  const weeklyGoal = useDataStore((s) => s.weeklyGoal);
  const monthlyGoal = useDataStore((s) => s.monthlyGoal);
  const yearlyGoal = useDataStore((s) => s.yearlyGoal);
  const monthWeeklyGoals = useDataStore((s) => s.monthWeeklyGoals);
  const yearMonthlyGoals = useDataStore((s) => s.yearMonthlyGoals);
  const yearWeeklyGoals = useDataStore((s) => s.yearWeeklyGoals);
  const isLoading = useDataStore((s) => s.isLoading);

  const sorts = useViewStore((s) => s.config.sorts);
  const filters = useViewStore((s) => s.config.filters);

  // Filtered + sorted entries (newest first by default when no sort applied)
  const filteredEntries: DayEntry[] = useMemo(() => {
    const result = useDataStore.getState().getFilteredSorted(filters, sorts);
    if (sorts.length === 0) {
      return [...result].sort((a, b) => b.date.localeCompare(a.date));
    }
    return result;
  }, [entries, sorts, filters]);

  return (
    <div className="ld-app" ref={appRef}>
      {/* ── Header ── */}
      <div className="ld-header">
        <div className="ld-header-top">
          <div className="ld-header-controls">
            <ViewSwitcherReact />
          </div>
          <ColumnVisibilityMenu />
        </div>
        <GoalPanelReact
          weeklyGoal={weeklyGoal}
          monthlyGoal={monthlyGoal}
          yearlyGoal={yearlyGoal}
          monthWeeklyGoals={monthWeeklyGoals}
          yearMonthlyGoals={yearMonthlyGoals}
          yearWeeklyGoals={yearWeeklyGoals}
        />
      </div>

      {/* ── Scrollable body (세로 스크롤 컨테이너) ── */}
      <div className="ld-body" ref={bodyRef}>
        {isLoading ? (
          <div className="ld-loading">불러오는 중...</div>
        ) : (
          <>
            <ChartSection entries={filteredEntries} />
            <FilterBar />
            <VirtualTable entries={filteredEntries} bodyRef={bodyRef} />
          </>
        )}
      </div>
    </div>
  );
}
