import React, { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { DayEntry, ColumnDef } from "../../types";
import { TABLE_COLUMNS } from "../../constants";
import { useViewStore } from "../../store/view-store";
import { TableHeader } from "./TableHeader";
import { TableCell } from "./TableCell";

interface VirtualTableProps {
  entries: DayEntry[];
}

export function VirtualTable({ entries }: VirtualTableProps) {
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

  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 8,
  });

  return (
    <div className="ld-table-scroll-container" ref={scrollRef}>
      {/* Inner container sets the minimum width for horizontal scroll */}
      <div style={{ minWidth: totalWidth }}>
        {/* Sticky header row — not virtualized */}
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
                  transform: `translateY(${virtualRow.start}px)`,
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
