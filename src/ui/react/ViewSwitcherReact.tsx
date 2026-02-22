import React from "react";
import type { ViewMode } from "../../types";
import { useViewStore } from "../../store/view-store";

const MODES: { mode: ViewMode; label: string }[] = [
  { mode: "weekly", label: "W" },
  { mode: "monthly", label: "M" },
  { mode: "yearly", label: "Y" },
];

export function ViewSwitcherReact() {
  const viewMode = useViewStore((s) => s.config.viewMode);
  const { setViewMode } = useViewStore();

  return (
    <div className="ld-view-switcher">
      {MODES.map(({ mode, label }) => (
        <button
          key={mode}
          className={`ld-view-btn${viewMode === mode ? " active" : ""}`}
          onClick={() => setViewMode(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
