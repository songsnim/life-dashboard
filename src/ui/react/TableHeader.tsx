import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ColumnDef, SortRule } from "../../types";
import { useViewStore } from "../../store/view-store";
import { SortIndicator } from "./SortIndicator";

const MIN_COL_WIDTH = 40;

interface TableHeaderProps {
  columns: ColumnDef[];
  sorts: SortRule[];
  columnWidths: Record<string, number>;
  totalWidth: number;
}

export function TableHeader({ columns, sorts, columnWidths, totalWidth }: TableHeaderProps) {
  const { reorderColumn } = useViewStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require 5px movement before drag activates — prevents click/resize interference
        distance: 5,
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderColumn(String(active.id), String(over.id));
  };

  return (
    <div
      className="ld-table-header-row"
      style={{ width: totalWidth, minWidth: totalWidth, display: "flex" }}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={columns.map((c) => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          {columns.map((col) => (
            <SortableHeaderCell
              key={col.id}
              col={col}
              sorts={sorts}
              width={columnWidths[col.id] ?? col.width}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface SortableHeaderCellProps {
  col: ColumnDef;
  sorts: SortRule[];
  width: number;
}

function SortableHeaderCell({ col, sorts, width }: SortableHeaderCellProps) {
  const { cycleSort, setColumnWidth } = useViewStore();
  // Live width tracks resize drag; syncs from store on commit
  const [liveWidth, setLiveWidth] = useState(width);
  const isResizingRef = useRef(false);

  useEffect(() => {
    if (!isResizingRef.current) setLiveWidth(width);
  }, [width]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    // Suppress dnd-kit's transition while resizing to avoid jitter
    transition: isResizingRef.current ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
    width: liveWidth,
    minWidth: liveWidth,
    maxWidth: liveWidth,
    flexShrink: 0,
    cursor: "grab",
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="ld-th"
      data-dnd-dragging={isDragging ? "true" : undefined}
      {...attributes}
      {...listeners}
      // dnd-kit with activationConstraint:distance suppresses click after drag,
      // so we can use onClick directly for sort cycling.
      onClick={() => {
        if (!isResizingRef.current) cycleSort(col.id);
      }}
    >
      <span className="ld-th-label">{col.name}</span>
      <SortIndicator columnId={col.id} sorts={sorts} />
      <ResizeHandle
        currentWidth={liveWidth}
        onResizeStart={() => {
          isResizingRef.current = true;
        }}
        onResize={(w) => setLiveWidth(w)}
        onResizeEnd={(w) => {
          setLiveWidth(w);
          setColumnWidth(col.id, w);
          // Reset flag after a tick so the onClick guard fires correctly
          setTimeout(() => {
            isResizingRef.current = false;
          }, 0);
        }}
      />
    </div>
  );
}

// ─── Resize Handle ────────────────────────────────────────────────────────────

interface ResizeHandleProps {
  currentWidth: number;
  onResizeStart: () => void;
  onResize: (width: number) => void;
  onResizeEnd: (width: number) => void;
}

function ResizeHandle({ currentWidth, onResizeStart, onResize, onResizeEnd }: ResizeHandleProps) {
  const [isActive, setIsActive] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Stop the native event so @dnd-kit's PointerSensor doesn't start a column drag
      e.nativeEvent.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();

      startXRef.current = e.clientX;
      startWidthRef.current = currentWidth;
      setIsActive(true);
      onResizeStart();

      const handleMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startXRef.current;
        onResize(Math.max(MIN_COL_WIDTH, startWidthRef.current + delta));
      };

      const handleUp = (ev: PointerEvent) => {
        const delta = ev.clientX - startXRef.current;
        const finalWidth = Math.max(MIN_COL_WIDTH, startWidthRef.current + delta);
        onResizeEnd(finalWidth);
        setIsActive(false);
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
      };

      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    [currentWidth, onResizeStart, onResize, onResizeEnd],
  );

  return (
    <div
      className={`ld-col-resize-handle${isActive ? " active" : ""}`}
      onPointerDown={handlePointerDown}
      // Prevent the sort click from firing after a resize release
      onClick={(e) => e.stopPropagation()}
    />
  );
}
