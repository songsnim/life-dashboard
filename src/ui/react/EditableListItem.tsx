/**
 * EditableListItem — 주간/월간/올해 목표(GoalRow)와 할 일(TaskRow)에 공통으로
 * 사용되는 체크박스 + 편집 가능 텍스트 아이템 컴포넌트.
 *
 * 모든 모바일 IME 간섭 방지 속성이 단일 컴포넌트에서 관리된다.
 */
import React, { useState, useEffect } from "react";

// ─── 공통 모바일 입력 속성 ─────────────────────────────────────────────────────
// Android WebView에서 자동완성·자동교정·자동대문자 등 IME 간섭 방지.
// TableCell(TimeCell, NumberCell)에서도 import해서 사용한다.
export const MOBILE_INPUT_ATTRS = {
  autoComplete: "off" as const,
  autoCorrect: "off" as const,
  autoCapitalize: "none" as const,
  spellCheck: false,
} as const;

// ─── EditableListItem ─────────────────────────────────────────────────────────

interface EditableListItemProps {
  checked: boolean;
  text: string;
  isEditing: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onSaveText: (text: string) => void;
  /** Enter 키 입력 시 — 다음 아이템 추가 */
  onAddAfter: (currentText: string) => void;
  onCancelEdit: () => void;
  /**
   * "task"  → .ld-task-row / .ld-task-checkbox / .ld-task-text 등 사용
   * "goal"  → .ld-goal-row / .ld-goal-checkbox / .ld-goal-text 등 + 삭제 버튼
   */
  variant: "task" | "goal";
}

export function EditableListItem({
  checked,
  text,
  isEditing,
  onToggle,
  onStartEdit,
  onSaveText,
  onAddAfter,
  onCancelEdit,
  variant,
}: EditableListItemProps) {
  const [editVal, setEditVal] = useState(text);

  // 편집 중이 아닐 때 외부 text 변경(다른 저장 등)을 editVal에 반영
  useEffect(() => {
    if (!isEditing) setEditVal(text);
  }, [text, isEditing]);

  const isTask = variant === "task";
  const rowClass    = isTask ? "ld-task-row"        : "ld-goal-row";
  const cbClass     = isTask ? "ld-task-checkbox"   : "ld-goal-checkbox";
  const textClass   = isTask ? "ld-task-text"       : "ld-goal-text";
  const doneClass   = isTask ? "ld-task-done"       : "ld-goal-done";
  const inputClass  = isTask ? "ld-task-edit-input" : "ld-goal-edit-input";

  return (
    <div className={rowClass}>
      <input
        type="checkbox"
        className={cbClass}
        checked={checked}
        onChange={onToggle}
      />

      {isEditing ? (
        <input
          autoFocus
          type="text"
          className={inputClass}
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
          {...MOBILE_INPUT_ATTRS}
          enterKeyHint="next"
        />
      ) : (
        <span
          className={`${textClass}${checked ? ` ${doneClass}` : ""}`}
          onClick={onStartEdit}
        >
          {text || "\u00A0"}
        </span>
      )}

      {/* goal variant에만 삭제 버튼 */}
      {!isTask && (
        <button className="ld-goal-delete" onClick={() => onSaveText("")}>
          ×
        </button>
      )}
    </div>
  );
}

// ─── AddListItemInput ─────────────────────────────────────────────────────────
// 빈 목록일 때 보여주는 '+' placeholder 입력 (task / goal 공용).

interface AddListItemInputProps {
  onAdd: (text: string) => void;
}

export function AddListItemInput({ onAdd }: AddListItemInputProps) {
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
      {...MOBILE_INPUT_ATTRS}
      enterKeyHint="done"
    />
  );
}
