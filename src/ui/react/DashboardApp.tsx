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
   * 키보드 대응 — iOS / Android 통합 처리
   *
   * ■ iOS WKWebView (adjustPan + contentInset 스크롤)
   *   키보드가 열리면 contentInset.bottom이 증가, 콘텐츠 전체가 위로 스크롤된다.
   *   → vv.offsetTop > 0 (문서가 스크롤된 양)
   *   → translateY(vv.offsetTop) 으로 상쇄
   *
   * ■ Android adjustResize
   *   WebView 자체가 리사이즈: window.innerHeight == vv.height (둘 다 줄어듦)
   *   → vv.offsetTop = 0, translateY 불필요
   *   → height = vv.height 만 적용 (== 100% 와 동일, 무해)
   *
   * ■ Android adjustPan (window-level pan)
   *   WebView가 위로 밀려 올라가지만 JS document는 스크롤되지 않는다.
   *   → window.innerHeight 불변, vv.height 만 줄어든다
   *   → vv.offsetTop = 0 (문서 스크롤 없음)
   *   → translateY 값을 window.innerHeight - vv.height 로 계산해야 한다
   *      (= 키보드 높이 = WebView가 위로 밀린 양)
   *
   * 세 케이스 공통 공식:
   *   offset = vv.offsetTop > 0
   *            ? vv.offsetTop                    (iOS / Android doc-scroll pan)
   *            : window.innerHeight - vv.height  (Android window-pan)
   *   → adjustResize 시 offset = innerHeight - innerHeight = 0  (no-op ✓)
   */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let rafId: ReturnType<typeof requestAnimationFrame> | null = null;

    const update = () => {
      // 연속 resize 이벤트를 1프레임으로 배치 → layout thrashing 방지
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const el = appRef.current;
        if (!el) return;

        /**
         * .ld-app은 CSS에서 body.is-mobile 시 position:fixed 로 지정되므로
         * height를 JS로 변경하지 않는다.
         *  - height 변경 시 → .ld-body 축소 → virtualizer가 focused row를
         *    unmount → 포커스 잃음 → 키보드 닫힘 (Android table input bug)
         *
         * 대신 translateY만으로 Android adjustPan pan 보정:
         *  - iOS adjustPan (contentInset scroll):  vv.offsetTop > 0
         *  - Android window-level pan:             vv.offsetTop = 0, vv.height < innerHeight
         *  - Android adjustResize:                 vv.height = innerHeight → offset = 0 (no-op)
         */
        const offset =
          vv.offsetTop > 0
            ? vv.offsetTop                       // iOS / Android doc-scroll pan
            : window.innerHeight - vv.height;    // Android window-pan  /  adjustResize=0

        el.style.transform = offset > 0 ? `translateY(${offset}px)` : "";
      });
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    // document scroll 폴백 (일부 Android WebView에서 vv.scroll 미발화)
    window.addEventListener("scroll", update, { passive: true });
    update();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
      const el = appRef.current;
      if (el) {
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
