import React from "react";
import type { SortRule } from "../../types";

interface Props {
  columnId: string;
  sorts: SortRule[];
}

export function SortIndicator({ columnId, sorts }: Props) {
  const idx = sorts.findIndex((s) => s.columnId === columnId);
  if (idx === -1) return null;

  const sort = sorts[idx];
  const arrow = sort.direction === "asc" ? "↑" : "↓";

  return (
    <span className="ld-sort-indicator">
      {arrow}
      {sorts.length > 1 && <sup>{idx + 1}</sup>}
    </span>
  );
}
