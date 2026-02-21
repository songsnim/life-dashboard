import React, { useState, useRef, useCallback } from "react";
import { Notice, Modal, App } from "obsidian";
import type { DayEntry, ColumnDef } from "../../types";
import { ColumnType } from "../../types";
import { useAppContext } from "./context";
import { useDataStore } from "../../store/data-store";
import { calcSleepMinutes, formatMinutesToHM } from "../../services/date-utils";
import { SECTION_MAP } from "../../constants";

interface CellProps {
  entry: DayEntry;
  col: ColumnDef;
  width: number;
}

export function TableCell({ entry, col, width }: CellProps) {
  const style: React.CSSProperties = { width, minWidth: width, maxWidth: width, flexShrink: 0 };

  switch (col.type) {
    case ColumnType.DATE:
      return <DateCell entry={entry} style={style} />;
    case ColumnType.DURATION:
      return <DurationCell entry={entry} style={style} />;
    case ColumnType.BOOLEAN:
      return <BoolCell entry={entry} col={col} style={style} />;
    case ColumnType.TIME:
      return <TimeCell entry={entry} col={col} style={style} />;
    case ColumnType.NUMBER:
      return <NumberCell entry={entry} col={col} style={style} />;
    case ColumnType.CHECKLIST:
      return <ChecklistCell entry={entry} col={col} style={style} />;
    case ColumnType.TEXT:
      return <TextCell entry={entry} col={col} style={style} />;
    default:
      return <div className="ld-td" style={style} />;
  }
}

// ─── Date Cell ────────────────────────────────────────────────────────────────

function DateCell({ entry, style }: { entry: DayEntry; style: React.CSSProperties }) {
  const { app } = useAppContext();
  const label = formatDisplayDate(entry.date);

  return (
    <div className="ld-td ld-date-cell" style={style}>
      <a
        className="ld-date-link"
        onClick={(e) => {
          e.preventDefault();
          void app.workspace.openLinkText(entry.filePath, "", false);
        }}
      >
        {label}
      </a>
    </div>
  );
}

// ─── Duration Cell ────────────────────────────────────────────────────────────

function DurationCell({ entry, style }: { entry: DayEntry; style: React.CSSProperties }) {
  const mins = calcSleepMinutes(entry.bedtime, entry.wakeTime);
  const text = mins && mins > 0 ? formatMinutesToHM(mins) : "-";
  return (
    <div className="ld-td" style={style}>
      <span className={`ld-sleep-badge${mins && mins > 0 ? " highlight" : ""}`}>{text}</span>
    </div>
  );
}

// ─── Bool Cell ────────────────────────────────────────────────────────────────

function BoolCell({
  entry,
  col,
  style,
}: {
  entry: DayEntry;
  col: ColumnDef;
  style: React.CSSProperties;
}) {
  const { noteWriter } = useAppContext();
  const field = col.entryKey as "exercise" | "reading" | "sobriety";
  const storeValue = useDataStore((s) => {
    const e = s.entries.find((x) => x.date === entry.date);
    return e ? (e[field] as boolean) : (entry[field] as boolean);
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggle = useCallback(() => {
    const newVal = !storeValue;
    const previous = useDataStore.getState().optimisticUpdate(entry.date, field, newVal);
    useDataStore.getState().incrementPendingWrites();

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          await noteWriter.updateProperty(entry.filePath, col.frontmatterKey!, newVal);
        } catch {
          useDataStore.getState().rollbackUpdate(entry.date, field, previous);
          new Notice(`저장 실패: ${col.name} 업데이트 중 오류가 발생했습니다.`);
        } finally {
          useDataStore.getState().decrementPendingWrites();
        }
      })();
    }, 100);
  }, [storeValue, entry, col, noteWriter, field]);

  return (
    <div
      className={`ld-td ld-bool-cell${storeValue ? " active" : ""}`}
      style={style}
      onClick={toggle}
    >
      <div className="ld-check-indicator" />
    </div>
  );
}

// ─── Time Cell ────────────────────────────────────────────────────────────────

function TimeCell({
  entry,
  col,
  style,
}: {
  entry: DayEntry;
  col: ColumnDef;
  style: React.CSSProperties;
}) {
  const { noteWriter } = useAppContext();
  const field = col.entryKey as "bedtime" | "wakeTime" | "screenTime";
  const storeValue = useDataStore((s) => {
    const e = s.entries.find((x) => x.date === entry.date);
    return e ? (e[field] as string | null) : (entry[field] as string | null);
  });
  const [localVal, setLocalVal] = useState(storeValue ?? "");
  const originalRef = useRef(storeValue ?? "");

  const handleBlur = useCallback(() => {
    const trimmed = localVal.trim();
    if (trimmed === originalRef.current) return;
    const newVal = trimmed === "" ? null : trimmed;

    const previous = useDataStore.getState().optimisticUpdate(
      entry.date,
      field,
      newVal as DayEntry[keyof DayEntry],
    );
    useDataStore.getState().incrementPendingWrites();
    originalRef.current = newVal ?? "";

    void (async () => {
      try {
        await noteWriter.updateProperty(entry.filePath, col.frontmatterKey!, newVal);
      } catch {
        useDataStore.getState().rollbackUpdate(entry.date, field, previous);
        setLocalVal(originalRef.current);
        new Notice(`저장 실패: ${col.name} 업데이트 중 오류가 발생했습니다.`);
      } finally {
        useDataStore.getState().decrementPendingWrites();
      }
    })();
  }, [localVal, entry, col, noteWriter, field]);

  return (
    <div className="ld-td" style={style}>
      <input
        className="ld-input"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </div>
  );
}

// ─── Number Cell ──────────────────────────────────────────────────────────────

function NumberCell({
  entry,
  col,
  style,
}: {
  entry: DayEntry;
  col: ColumnDef;
  style: React.CSSProperties;
}) {
  const { noteWriter } = useAppContext();
  const field = col.entryKey as "rating";
  const storeValue = useDataStore((s) => {
    const e = s.entries.find((x) => x.date === entry.date);
    return e ? (e[field] as number | null) : (entry[field] as number | null);
  });
  const [localVal, setLocalVal] = useState(storeValue?.toString() ?? "");
  const originalRef = useRef(storeValue?.toString() ?? "");

  const handleBlur = useCallback(() => {
    const trimmed = localVal.trim();
    if (trimmed === originalRef.current) return;
    const newVal = trimmed === "" ? null : Number(trimmed);

    const previous = useDataStore.getState().optimisticUpdate(
      entry.date,
      field,
      newVal as DayEntry[keyof DayEntry],
    );
    useDataStore.getState().incrementPendingWrites();
    originalRef.current = trimmed;

    void (async () => {
      try {
        await noteWriter.updateProperty(entry.filePath, col.frontmatterKey!, newVal);
      } catch {
        useDataStore.getState().rollbackUpdate(entry.date, field, previous);
        setLocalVal(originalRef.current);
        new Notice(`저장 실패: ${col.name} 업데이트 중 오류가 발생했습니다.`);
      } finally {
        useDataStore.getState().decrementPendingWrites();
      }
    })();
  }, [localVal, entry, col, noteWriter, field]);

  return (
    <div className="ld-td" style={style}>
      <input
        className="ld-input"
        type="number"
        min={0}
        max={10}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </div>
  );
}

// ─── Checklist Cell ───────────────────────────────────────────────────────────

interface Task {
  checked: boolean;
  text: string;
}

function ChecklistCell({
  entry,
  col: _col,
  style,
}: {
  entry: DayEntry;
  col: ColumnDef;
  style: React.CSSProperties;
}) {
  const { noteWriter } = useAppContext();
  const storeRaw = useDataStore((s) => {
    const e = s.entries.find((x) => x.date === entry.date);
    return e ? e.tasks : entry.tasks;
  });

  const [tasks, setTasks] = useState<Task[]>(() => parseTasks(storeRaw));
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const persist = useCallback(
    async (nextTasks: Task[]) => {
      const serialized = serializeTasks(nextTasks);
      const previous = useDataStore.getState().optimisticUpdate(
        entry.date,
        "tasks",
        serialized as DayEntry[keyof DayEntry],
      );
      useDataStore.getState().incrementPendingWrites();
      try {
        await noteWriter.updateSection(entry.filePath, SECTION_MAP.tasks, serialized);
      } catch {
        useDataStore.getState().rollbackUpdate(entry.date, "tasks", previous);
        new Notice(`저장 실패: 할 일 업데이트 중 오류가 발생했습니다.`);
      } finally {
        useDataStore.getState().decrementPendingWrites();
      }
    },
    [entry, noteWriter],
  );

  const toggleTask = useCallback(
    (idx: number) => {
      const next = tasks.map((t, i) => (i === idx ? { ...t, checked: !t.checked } : t));
      setTasks(next);
      void persist(next);
    },
    [tasks, persist],
  );

  return (
    <div className="ld-td ld-tasks-cell" style={style}>
      <div className="ld-task-list">
        {tasks.map((task, i) => (
          <TaskRow
            key={i}
            task={task}
            isEditing={editingIdx === i}
            onToggle={() => toggleTask(i)}
            onStartEdit={() => setEditingIdx(i)}
            onSaveText={(text) => {
              setEditingIdx(null);
              if (text.trim() === "") {
                const next = tasks.filter((_, j) => j !== i);
                setTasks(next);
                void persist(next);
              } else {
                const next = tasks.map((t, j) => (j === i ? { ...t, text } : t));
                setTasks(next);
                void persist(next);
              }
            }}
            onAddAfter={(text) => {
              const next = [...tasks];
              if (text.trim()) next[i] = { ...tasks[i], text };
              next.splice(i + 1, 0, { checked: false, text: "" });
              setTasks(next);
              setEditingIdx(i + 1);
              void persist(next);
            }}
            onCancelEdit={() => setEditingIdx(null)}
          />
        ))}
        {tasks.length === 0 && (
          <AddTaskInput
            onAdd={(text) => {
              const next = [...tasks, { checked: false, text }];
              setTasks(next);
              void persist(next);
            }}
          />
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  isEditing,
  onToggle,
  onStartEdit,
  onSaveText,
  onAddAfter,
  onCancelEdit,
}: {
  task: Task;
  isEditing: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onSaveText: (text: string) => void;
  onAddAfter: (currentText: string) => void;
  onCancelEdit: () => void;
}) {
  const [editVal, setEditVal] = useState(task.text);

  return (
    <div className="ld-task-row">
      <input
        type="checkbox"
        className="ld-task-checkbox"
        checked={task.checked}
        onChange={onToggle}
      />
      {isEditing ? (
        <input
          autoFocus
          className="ld-task-edit-input"
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={() => onSaveText(editVal)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onAddAfter(editVal);
            } else if (e.key === "Backspace" && editVal === "") {
              e.preventDefault();
              onSaveText("");
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancelEdit();
            }
          }}
        />
      ) : (
        <span
          className={`ld-task-text${task.checked ? " ld-task-done" : ""}`}
          onClick={onStartEdit}
        >
          {task.text || "\u00A0"}
        </span>
      )}
    </div>
  );
}

function AddTaskInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <input
      type="text"
      placeholder="+"
      className="ld-task-add-input"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          const text = val.trim();
          if (!text) return;
          onAdd(text);
          setVal("");
        }
      }}
    />
  );
}

// ─── Text / Journal Cell ──────────────────────────────────────────────────────

function TextCell({
  entry,
  col,
  style,
}: {
  entry: DayEntry;
  col: ColumnDef;
  style: React.CSSProperties;
}) {
  const { app, noteWriter } = useAppContext();
  const field = col.entryKey as "journal";
  const storeValue = useDataStore((s) => {
    const e = s.entries.find((x) => x.date === entry.date);
    return e ? (e[field] as string) : (entry[field] as string);
  });

  const firstLine = storeValue ? storeValue.split("\n")[0].trim() : "-";

  const openModal = useCallback(() => {
    new JournalModal(app, formatDisplayDate(entry.date), storeValue, async (newText) => {
      const sectionName = SECTION_MAP[field] ?? field;
      const previous = useDataStore.getState().optimisticUpdate(
        entry.date,
        field,
        newText as DayEntry[keyof DayEntry],
      );
      useDataStore.getState().incrementPendingWrites();
      try {
        await noteWriter.updateSection(entry.filePath, sectionName, newText);
      } catch {
        useDataStore.getState().rollbackUpdate(entry.date, field, previous);
        new Notice(`저장 실패: ${col.name} 업데이트 중 오류가 발생했습니다.`);
      } finally {
        useDataStore.getState().decrementPendingWrites();
      }
    }).open();
  }, [app, entry, storeValue, noteWriter, col, field]);

  return (
    <div className="ld-td ld-journal-cell" style={style} onClick={openModal}>
      <span>{firstLine}</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const yy = d.getFullYear().toString().slice(2);
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${yy}.${mm}.${dd} ${days[d.getDay()]}`;
}

function parseTasks(raw: string): Task[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- ["))
    .map((l) => {
      const m = l.match(/-\s*\[( |x|X)\]\s*(.*)/);
      if (!m) return null;
      return { checked: m[1] === "x" || m[1] === "X", text: m[2].trim() };
    })
    .filter((t): t is Task => t !== null);
}

function serializeTasks(tasks: Task[]): string {
  return tasks.map((t) => `- [${t.checked ? "x" : " "}] ${t.text}`).join("\n");
}

// ─── Journal Modal ────────────────────────────────────────────────────────────

class JournalModal extends Modal {
  constructor(
    app: App,
    private title: string,
    private content: string,
    private onSave: (text: string) => Promise<void>,
  ) {
    super(app);
  }

  onOpen() {
    this.containerEl.addClass("ld-journal-modal-container");
    const { contentEl } = this;
    contentEl.addClass("ld-journal-modal");
    contentEl.createEl("h3", { text: this.title });

    const textarea = contentEl.createEl("textarea", {
      cls: "ld-modal-textarea",
      text: this.content,
    });
    textarea.value = this.content;
    textarea.placeholder = "오늘의 기록을 남겨보세요...";

    const actions = contentEl.createDiv({ cls: "ld-modal-actions" });

    const cancelBtn = actions.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = actions.createEl("button", { text: "Save", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      void this.onSave(textarea.value).then(() => this.close());
    });

    textarea.addEventListener("focus", () => {
      this.containerEl.addClass("ld-keyboard-open");
    });
    textarea.addEventListener("blur", () => {
      this.containerEl.removeClass("ld-keyboard-open");
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
