import React, { useState, useCallback, useRef, useEffect } from "react";
import type { GoalEntry } from "../../types";
import { useViewStore } from "../../store/view-store";
import { useDataStore } from "../../store/data-store";
import { useAppContext } from "./context";

interface GoalItem {
  checked: boolean;
  text: string;
}

function parseGoals(content: string): GoalItem[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ["))
    .map((line) => {
      const match = line.match(/-\s*\[( |x|X)\]\s*(.*)/);
      if (!match) return null;
      return { checked: match[1] === "x" || match[1] === "X", text: match[2].trim() };
    })
    .filter((g): g is GoalItem => g !== null);
}

function serializeGoals(goals: GoalItem[]): string {
  return goals.map((g) => `- [${g.checked ? "x" : " "}] ${g.text}`).join("\n");
}

interface GoalSectionProps {
  goalEntry: GoalEntry;
  label: string;
}

function GoalSection({ goalEntry, label }: GoalSectionProps) {
  const { noteWriter } = useAppContext();
  const [goals, setGoals] = useState<GoalItem[]>(() => parseGoals(goalEntry.content));
  const [addText, setAddText] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // Track last synced content to detect external file changes (e.g., direct note edits or refresh)
  const lastSyncedContent = useRef(goalEntry.content);

  useEffect(() => {
    if (goalEntry.content !== lastSyncedContent.current) {
      lastSyncedContent.current = goalEntry.content;
      setGoals(parseGoals(goalEntry.content));
    }
  }, [goalEntry]);

  const persist = useCallback(
    async (nextGoals: GoalItem[]) => {
      const newContent = serializeGoals(nextGoals);
      // Track that we wrote this content so the sync effect ignores our own write
      lastSyncedContent.current = newContent;
      const { incrementPendingWrites, decrementPendingWrites } = useDataStore.getState();
      incrementPendingWrites();
      try {
        await noteWriter.updateGoal({ ...goalEntry, content: newContent });
      } finally {
        decrementPendingWrites();
      }
    },
    [goalEntry, noteWriter],
  );

  const handleToggle = (idx: number) => {
    const next = goals.map((g, i) => (i === idx ? { ...g, checked: !g.checked } : g));
    setGoals(next);
    void persist(next);
  };

  const handleSaveEdit = (idx: number, newText: string) => {
    setEditingIdx(null);
    if (!newText.trim()) {
      const next = goals.filter((_, i) => i !== idx);
      setGoals(next);
      void persist(next);
    } else {
      const next = goals.map((g, i) => (i === idx ? { ...g, text: newText } : g));
      setGoals(next);
      void persist(next);
    }
  };

  const handleDelete = (idx: number) => {
    const next = goals.filter((_, i) => i !== idx);
    setGoals(next);
    void persist(next);
  };

  const handleAdd = () => {
    const text = addText.trim();
    if (!text) return;
    const next = [...goals, { checked: false, text }];
    setGoals(next);
    setAddText("");
    void persist(next);
  };

  return (
    <div className="ld-goal-section">
      <span className="ld-goal-label">{label}</span>
      <div className="ld-goal-list">
        {goals.map((g, idx) => (
          <div key={idx} className="ld-goal-row">
            <input
              type="checkbox"
              className="ld-goal-checkbox"
              checked={g.checked}
              onChange={() => handleToggle(idx)}
            />
            {editingIdx === idx ? (
              <GoalEditInput
                initialValue={g.text}
                onSave={(text) => handleSaveEdit(idx, text)}
                onCancel={() => setEditingIdx(null)}
              />
            ) : (
              <span className="ld-goal-text" onClick={() => setEditingIdx(idx)}>
                {g.text}
              </span>
            )}
            <button className="ld-goal-delete" onClick={() => handleDelete(idx)}>
              🗑️
            </button>
          </div>
        ))}
      </div>
      <div className="ld-goal-add-row">
        <input
          type="text"
          placeholder="New goal..."
          className="ld-goal-add-input"
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          onKeyDown={(e) => {
            // e.nativeEvent.isComposing: true when Korean/CJK IME is mid-composition
            // Prevent handleAdd() from firing on the composition-commit Enter press
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button className="ld-btn ld-btn-save" onClick={handleAdd}>
          Add
        </button>
      </div>
    </div>
  );
}

function GoalEditInput({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(initialValue);
  return (
    <input
      autoFocus
      type="text"
      className="ld-goal-edit-input"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onSave(val);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    />
  );
}

interface GoalPanelProps {
  weeklyGoal: GoalEntry | null;
  monthlyGoal: GoalEntry | null;
}

export function GoalPanelReact({ weeklyGoal, monthlyGoal }: GoalPanelProps) {
  const viewMode = useViewStore((s) => s.config.viewMode);

  if (viewMode === "weekly" && weeklyGoal) {
    return (
      <div className="ld-goal-panel">
        <GoalSection goalEntry={weeklyGoal} label="Weekly goal" />
      </div>
    );
  }

  if (viewMode === "monthly" && monthlyGoal) {
    return (
      <div className="ld-goal-panel">
        <GoalSection goalEntry={monthlyGoal} label="Monthly goal" />
      </div>
    );
  }

  return null;
}
