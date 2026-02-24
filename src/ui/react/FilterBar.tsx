import React, { useState, useRef, useEffect } from "react";
import type { FilterRule, DateRangePreset } from "../../types";
import { ColumnType } from "../../types";
import { TABLE_COLUMNS } from "../../constants";
import { useViewStore } from "../../store/view-store";

/* ===== DatePresetBar ===== */

interface PresetOption {
  preset: DateRangePreset;
  label: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  { preset: "15days", label: "최근 15일" },
  { preset: "week", label: "이번 주" },
  { preset: "month", label: "이번 달" },
  { preset: "year", label: "올해" },
  { preset: null, label: "전체" },
];

export function DatePresetBar() {
  const dateRangePreset = useViewStore((s) => s.config.dateRangePreset);
  const { setDateRangePreset } = useViewStore();

  return (
    <div className="ld-date-preset-bar">
      <span className="ld-date-preset-label">날짜:</span>
      {PRESET_OPTIONS.map(({ preset, label }) => (
        <button
          key={String(preset)}
          className={`ld-date-preset-btn${dateRangePreset === preset ? " active" : ""}`}
          onClick={() => setDateRangePreset(preset)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type Operator = FilterRule["operator"];

const OPERATOR_LABELS: Record<Operator, string> = {
  eq: "=",
  neq: "≠",
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
  contains: "포함",
  isEmpty: "비어있음",
};

function getOperatorsForType(type: ColumnType): Operator[] {
  switch (type) {
    case ColumnType.BOOLEAN:
      return ["eq", "isEmpty"];
    case ColumnType.NUMBER:
    case ColumnType.DURATION:
      return ["eq", "neq", "gt", "lt", "gte", "lte", "isEmpty"];
    case ColumnType.TIME:
      return ["eq", "neq", "isEmpty"];
    case ColumnType.TEXT:
    case ColumnType.CHECKLIST:
      return ["contains", "isEmpty"];
    case ColumnType.DATE:
      return ["eq", "neq", "gt", "lt", "gte", "lte"];
    default:
      return ["eq", "neq", "contains", "isEmpty"];
  }
}

/* ===== DatePresetPills (inline, no wrapper div) ===== */

function DatePresetPills() {
  const dateRangePreset = useViewStore((s) => s.config.dateRangePreset);
  const { setDateRangePreset } = useViewStore();
  return (
    <>
      {PRESET_OPTIONS.map(({ preset, label }) => (
        <button
          key={String(preset)}
          className={`ld-date-preset-btn${dateRangePreset === preset ? " active" : ""}`}
          onClick={() => setDateRangePreset(preset)}
        >
          {label}
        </button>
      ))}
    </>
  );
}

export function FilterBar() {
  const filters = useViewStore((s) => s.config.filters);
  const { removeFilter, clearFilters, addFilter } = useViewStore();
  const [showAdder, setShowAdder] = useState(false);

  return (
    <div className="ld-filter-bar">
      {filters.map((filter) => {
        const col = TABLE_COLUMNS.find((c) => c.id === filter.columnId);
        return (
          <FilterChip
            key={filter.columnId}
            filter={filter}
            label={col?.name ?? filter.columnId}
            onRemove={() => removeFilter(filter.columnId)}
          />
        );
      })}
      {filters.length > 1 && (
        <button className="ld-filter-clear-btn" onClick={clearFilters}>
          전체 초기화
        </button>
      )}
      {showAdder ? (
        <FilterAdder
          onAdd={(f) => {
            addFilter(f);
            setShowAdder(false);
          }}
          onCancel={() => setShowAdder(false)}
        />
      ) : (
        <button className="ld-filter-add-btn" onClick={() => setShowAdder(true)}>
          + 필터
        </button>
      )}
      <span className="ld-filter-sep" />
      <DatePresetPills />
    </div>
  );
}

function FilterChip({
  filter,
  label,
  onRemove,
}: {
  filter: FilterRule;
  label: string;
  onRemove: () => void;
}) {
  const opLabel = OPERATOR_LABELS[filter.operator] ?? filter.operator;
  const valStr = filter.operator === "isEmpty" ? "" : ` ${filter.value}`;
  return (
    <div className="ld-filter-chip">
      <span>
        {label} {opLabel}
        {valStr}
      </span>
      <button className="ld-filter-chip-remove" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}

function FilterAdder({
  onAdd,
  onCancel,
}: {
  onAdd: (f: FilterRule) => void;
  onCancel: () => void;
}) {
  const [columnId, setColumnId] = useState(TABLE_COLUMNS[0].id);
  const [operator, setOperator] = useState<Operator>("eq");
  const [value, setValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCol = TABLE_COLUMNS.find((c) => c.id === columnId) ?? TABLE_COLUMNS[0];
  const operators = getOperatorsForType(selectedCol.type);

  // Reset operator when column changes
  useEffect(() => {
    setOperator(getOperatorsForType(selectedCol.type)[0]);
    setValue("");
  }, [columnId, selectedCol.type]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  const handleApply = () => {
    const parsedValue =
      operator === "isEmpty"
        ? true
        : selectedCol.type === ColumnType.NUMBER || selectedCol.type === ColumnType.DURATION
          ? Number(value)
          : selectedCol.type === ColumnType.BOOLEAN
            ? value === "true"
            : value;

    onAdd({ columnId, operator, value: parsedValue as FilterRule["value"] });
  };

  return (
    <div className="ld-filter-adder" ref={containerRef}>
      <select value={columnId} onChange={(e) => setColumnId(e.target.value)}>
        {TABLE_COLUMNS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select value={operator} onChange={(e) => setOperator(e.target.value as Operator)}>
        {operators.map((op) => (
          <option key={op} value={op}>
            {OPERATOR_LABELS[op]}
          </option>
        ))}
      </select>

      {operator !== "isEmpty" && (
        <input
          className="ld-filter-value-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="값 입력..."
          onKeyDown={(e) => {
            if (e.key === "Enter") handleApply();
            if (e.key === "Escape") onCancel();
          }}
        />
      )}

      <button className="ld-btn ld-btn-save" onClick={handleApply}>
        적용
      </button>
      <button className="ld-btn" onClick={onCancel}>
        취소
      </button>
    </div>
  );
}
