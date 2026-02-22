import React, { useRef, useMemo, useState, useLayoutEffect, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { DayEntry, ColumnDef } from "../../types";
import { TABLE_COLUMNS } from "../../constants";
import { useViewStore } from "../../store/view-store";
import { TableHeader } from "./TableHeader";
import { TableCell } from "./TableCell";

interface VirtualTableProps {
  entries: DayEntry[];
  /** .ld-body 요소에 대한 ref — 세로 스크롤의 scroll element로 사용 */
  bodyRef: React.RefObject<HTMLDivElement | null>;
}

export function VirtualTable({ entries, bodyRef }: VirtualTableProps) {
  const columnOrder = useViewStore((s) => s.config.columnOrder);
  const columnWidths = useViewStore((s) => s.columnWidths);
  const columnVisible = useViewStore((s) => s.columnVisible);
  const sorts = useViewStore((s) => s.config.sorts);

  const visibleColumns: ColumnDef[] = useMemo(() => {
    return columnOrder
      .map((id) => TABLE_COLUMNS.find((c) => c.id === id))
      .filter((c): c is ColumnDef => c !== undefined && columnVisible[c.id] !== false);
  }, [columnOrder, columnVisible]);

  const totalWidth = useMemo(
    () => visibleColumns.reduce((sum, c) => sum + (columnWidths[c.id] ?? c.width), 0),
    [visibleColumns, columnWidths],
  );

  /** 테이블 컨테이너(가로 스크롤 래퍼)에 대한 ref */
  const tableRef = useRef<HTMLDivElement>(null);

  /**
   * scrollMargin: body 상단에서 테이블 시작까지의 고정 오프셋 (chart + filter 높이).
   * react-virtual은 이 값으로 가시 행 범위를 계산한다.
   */
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const update = () => {
      // 테이블 내 input이 포커스된 상태(모바일 키보드 열림)에서는 scrollMargin을
      // 재계산하지 않는다. 재계산 시 rowVirtualizer의 가시 범위가 바뀌어
      // 포커스된 행이 unmount → 키보드 사라짐 버그 방지.
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement &&
        tableRef.current?.contains(active)
      ) {
        return;
      }

      const scrollEl = bodyRef.current;
      const tableEl = tableRef.current;
      if (!scrollEl || !tableEl) return;

      const scrollRect = scrollEl.getBoundingClientRect();
      const tableRect = tableEl.getBoundingClientRect();
      // body 상단 ~ 테이블 상단 거리 (스크롤 위치 보정 포함)
      const margin = tableRect.top - scrollRect.top + scrollEl.scrollTop;
      setScrollMargin(Math.max(0, margin));
    };

    update();

    // 레이아웃이 바뀔 때(차트 크기, 필터 토글 등) 재계산
    const ro = new ResizeObserver(update);
    if (bodyRef.current) ro.observe(bodyRef.current);
    return () => ro.disconnect();
  // entries.length가 바뀌면(데이터 변경) chart 높이도 바뀔 수 있으므로 재측정
  }, [bodyRef, entries.length]);

  /**
   * 모바일 키보드 열림 대응:
   * DashboardApp이 .ld-app을 vv.height로 맞춰주므로 .ld-body도 자연스럽게 줄어든다.
   * 포커스된 input이 줄어든 .ld-body 영역 밖에 있으면 내부 스크롤로 보정한다.
   * vv.offsetTop은 DashboardApp이 translateY로 상쇄하므로 여기서는 0으로 간주한다.
   */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleViewportResize = () => {
      const active = document.activeElement;
      if (!(active instanceof HTMLInputElement) || !tableRef.current?.contains(active)) {
        return;
      }
      requestAnimationFrame(() => {
        const rect = active.getBoundingClientRect();
        const scrollEl = bodyRef.current;
        if (!scrollEl) return;
        const bodyRect = scrollEl.getBoundingClientRect();
        // DashboardApp이 translateY로 offsetTop을 상쇄했으므로 visibleBottom = vv.height
        const visibleBottom = vv.height;
        const inputBottom = rect.bottom;
        if (inputBottom > visibleBottom - 16) {
          scrollEl.scrollTop += inputBottom - (visibleBottom - 16);
        }
        if (rect.top < bodyRect.top) {
          scrollEl.scrollTop += rect.top - bodyRect.top;
        }
      });
    };

    vv.addEventListener("resize", handleViewportResize);
    return () => vv.removeEventListener("resize", handleViewportResize);
  }, [bodyRef]);

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => 44,
    // overscan을 크게 설정: 모바일에서 키보드 열림 시 포커스 행이 virtual window 밖으로
    // 나가 unmount되는 현상 방지 (이전 overscan:8 에서는 실패했음)
    overscan: 30,
    scrollMargin,
  });

  return (
    /**
     * 가로 스크롤만 담당하는 wrapper.
     * 세로 스크롤은 부모 .ld-body 가 처리한다.
     * overflow-y: clip 을 사용해 CSS sticky 가 .ld-body 를 참조하도록 한다.
     */
    <div className="ld-table-h-scroll" ref={tableRef}>
      <div style={{ minWidth: totalWidth }}>
        {/* Sticky header — .ld-body 세로 스크롤 기준으로 상단 고정 */}
        <TableHeader
          columns={visibleColumns}
          sorts={sorts}
          columnWidths={columnWidths}
          totalWidth={totalWidth}
        />

        {/* Virtualized body */}
        <div
          style={{
            position: "relative",
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const entry = entries[virtualRow.index];
            return (
              <div
                key={entry.date}
                className="ld-table-row"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  // scrollMargin 만큼 빼서 list container 기준으로 위치 계산
                  transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {visibleColumns.map((col) => (
                  <TableCell
                    key={col.id}
                    entry={entry}
                    col={col}
                    width={columnWidths[col.id] ?? col.width}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
