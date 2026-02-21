import React, { useState, useRef, useEffect } from "react";
import { TABLE_COLUMNS } from "../../constants";
import { useViewStore } from "../../store/view-store";

export function ColumnVisibilityMenu() {
  const columnVisible = useViewStore((s) => s.columnVisible);
  const { setColumnVisible } = useViewStore();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="ld-col-visibility" ref={containerRef}>
      <button className="ld-col-visibility-btn" onClick={() => setOpen((v) => !v)}>
        컬럼
      </button>
      {open && (
        <div className="ld-col-visibility-menu">
          {TABLE_COLUMNS.map((col) => (
            <label key={col.id} className="ld-col-visibility-item">
              <input
                type="checkbox"
                checked={columnVisible[col.id] !== false}
                onChange={(e) => setColumnVisible(col.id, e.target.checked)}
              />
              {col.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
