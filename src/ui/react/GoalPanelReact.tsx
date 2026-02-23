import React, { useState, useCallback, useRef, useEffect } from "react";
import type { GoalEntry, GoalBulkEntry } from "../../types";
import { useViewStore } from "../../store/view-store";
import { useDataStore } from "../../store/data-store";
import { useAppContext } from "./context";
import { EditableListItem, AddListItemInput } from "./EditableListItem";

/** 벌크 목표 목록에서 가장 최근 데이터가 있는 goalEntry 반환 (현재 주/월과 가장 가깝게 매칭) */
function findCurrentGoalFromBulk(entries: GoalBulkEntry[]): GoalEntry | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].goal) return entries[i].goal!;
  }
  return null;
}

/* ===== Hooks ===== */

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

/* ===== Goal Item Types ===== */

/** 벌크 목표 목록에서 가장 최근 데이터가 있는 goalEntry 반환 (현재 주/월과 가장 가깝게 매칭) */
function findCurrentGoalFromBulk(entries: GoalBulkEntry[]): GoalEntry | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].goal) return entries[i].goal!;
  }
  return null;
}

/* ===== Hooks ===== */

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

/* ===== Goal Item Types ===== */

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

/* ===== GoalSection ===== */

interface GoalSectionProps {
  goalEntry: GoalEntry;
}

function GoalSection({ goalEntry }: GoalSectionProps) {
  const { noteWriter } = useAppContext();
  const [goals, setGoals] = useState<GoalItem[]>(() => parseGoals(goalEntry.content));
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

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

  return (
    <div className="ld-goal-section">
      <div className="ld-goal-list">
        {goals.map((g, idx) => (
          <EditableListItem
            key={idx}
            variant="goal"
            checked={g.checked}
            text={g.text}
            isEditing={editingIdx === idx}
            onToggle={() => {
              const next = goals.map((g2, i) => (i === idx ? { ...g2, checked: !g2.checked } : g2));
              setGoals(next);
              void persist(next);
            }}
            onStartEdit={() => setEditingIdx(idx)}
            onSaveText={(text) => {
              setEditingIdx(null);
              if (!text.trim()) {
                const next = goals.filter((_, i) => i !== idx);
                setGoals(next);
                void persist(next);
              } else {
                const next = goals.map((g2, i) => (i === idx ? { ...g2, text } : g2));
                setGoals(next);
                void persist(next);
              }
            }}
            onAddAfter={(currentText) => {
              const next = [...goals];
              if (currentText.trim()) next[idx] = { ...goals[idx], text: currentText };
              next.splice(idx + 1, 0, { checked: false, text: "" });
              setGoals(next);
              setEditingIdx(idx + 1);
              void persist(next);
            }}
            onCancelEdit={() => setEditingIdx(null)}
          />
        ))}
        {/* 목표가 없을 때: TaskCell과 동일한 '+' placeholder */}
        {goals.length === 0 && (
          <AddListItemInput
            onAdd={(text) => {
              const next = [{ checked: false, text }];
              setGoals(next);
              void persist(next);
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ===== MobileCollapsedPreview ===== */

/**
 * 모바일에서 CollapsibleGoalGroup이 접힌 상태일 때 헤더에 인라인으로 표시되는
 * 첫 번째 목표 항목 (checkbox + 텍스트). 양방향 편집 지원.
 */
function MobileCollapsedPreview({ goalEntry }: { goalEntry: GoalEntry }) {
  const { noteWriter } = useAppContext();
  const [localGoals, setLocalGoals] = useState<GoalItem[]>(() => parseGoals(goalEntry.content));

  const lastContent = useRef(goalEntry.content);
  useEffect(() => {
    if (goalEntry.content !== lastContent.current) {
      lastContent.current = goalEntry.content;
      setLocalGoals(parseGoals(goalEntry.content));
    }
  }, [goalEntry.content]);

  const first = localGoals[0];
  if (!first) return null;

  const handleToggle = async () => {
    const next = localGoals.map((g, i) => (i === 0 ? { ...g, checked: !g.checked } : g));
    setLocalGoals(next);
    const newContent = serializeGoals(next);
    lastContent.current = newContent;
    const { incrementPendingWrites, decrementPendingWrites } = useDataStore.getState();
    incrementPendingWrites();
    try {
      await noteWriter.updateGoal({ ...goalEntry, content: newContent });
    } finally {
      decrementPendingWrites();
    }
  };

  return (
    <span
      className="ld-collapsible-preview"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        className="ld-goal-checkbox"
        checked={first.checked}
        onChange={() => void handleToggle()}
      />
      <span className={`ld-collapsible-preview-text${first.checked ? " ld-goal-done" : ""}`}>
        {first.text}
      </span>
    </span>
  );
}

/* ===== CollapsibleGoalGroup ===== */

interface CollapsibleGoalGroupProps {
  title: string;
  defaultOpen: boolean;
  isMobile: boolean;
  children: React.ReactNode;
  className?: string;
  /** 모바일에서 접힌 상태일 때 헤더에 표시할 목표 (첫 번째 항목) */
  previewGoal?: GoalEntry | null;
}

function CollapsibleGoalGroup({ title, defaultOpen, isMobile, children, className, previewGoal }: CollapsibleGoalGroupProps) {
  const [open, setOpen] = useState(isMobile ? false : defaultOpen);

  // When switching between mobile/desktop, update open state
  useEffect(() => {
    if (isMobile) setOpen(false);
    else setOpen(defaultOpen);
  }, [isMobile, defaultOpen]);

  return (
    <div className={`ld-collapsible${className ? ` ${className}` : ""}`}>
      <button className="ld-collapsible-header" onClick={() => setOpen((o) => !o)}>
        <span className="ld-collapsible-arrow">{open ? "▼" : "▶"}</span>
        <span className="ld-collapsible-title">{title}</span>
        {isMobile && !open && previewGoal && (
          <MobileCollapsedPreview goalEntry={previewGoal} />
        )}
      </button>
      {open && <div className="ld-collapsible-body">{children}</div>}
    </div>
  );
}

/* ===== BulkGoalList (weekly/monthly in monthly or yearly view) ===== */

function BulkGoalList({ entries }: { entries: GoalBulkEntry[] }) {
  if (entries.length === 0) {
    return <span className="ld-no-file">데이터 없음</span>;
  }
  return (
    <div className="ld-bulk-goal-list">
      {entries.map((entry) => (
        <div key={entry.period} className="ld-bulk-goal-entry">
          <div className="ld-bulk-goal-label">{entry.label}</div>
          {entry.goal ? (
            <GoalSection goalEntry={entry.goal} />
          ) : (
            <span className="ld-no-file">파일 없음</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ===== GoalPanelReact ===== */

interface GoalPanelProps {
  weeklyGoal: GoalEntry | null;
  monthlyGoal: GoalEntry | null;
  yearlyGoal: GoalEntry | null;
  monthWeeklyGoals: GoalBulkEntry[];
  yearMonthlyGoals: GoalBulkEntry[];
  yearWeeklyGoals: GoalBulkEntry[];
}

export function GoalPanelReact({
  weeklyGoal,
  monthlyGoal,
  yearlyGoal,
  monthWeeklyGoals,
  yearMonthlyGoals,
  yearWeeklyGoals,
}: GoalPanelProps) {
  const viewMode = useViewStore((s) => s.config.viewMode);
  const isMobile = useIsMobile();

  // CSS 미디어쿼리는 Obsidian 모바일 webview viewport 설정에 따라 발동하지 않을 수 있어
  // JS window.innerWidth 기반 감지(isMobile)로 클래스를 직접 결정한다.
  const grid3 = isMobile ? "ld-goal-grid-1" : "ld-goal-grid-3";
  const grid2 = isMobile ? "ld-goal-grid-1" : "ld-goal-grid-2";

  if (viewMode === "weekly") {
    return (
      <div className="ld-goal-panel">
        <div className={grid3}>
          <CollapsibleGoalGroup title="주간 목표" defaultOpen={true} isMobile={isMobile} previewGoal={weeklyGoal}>
            {weeklyGoal ? <GoalSection goalEntry={weeklyGoal} /> : <EmptyGoal />}
          </CollapsibleGoalGroup>
          <CollapsibleGoalGroup title="월간 목표" defaultOpen={true} isMobile={isMobile} previewGoal={monthlyGoal}>
            {monthlyGoal ? <GoalSection goalEntry={monthlyGoal} /> : <EmptyGoal />}
          </CollapsibleGoalGroup>
          <CollapsibleGoalGroup title="올해 목표" defaultOpen={true} isMobile={isMobile} previewGoal={yearlyGoal}>
            {yearlyGoal ? <GoalSection goalEntry={yearlyGoal} /> : <EmptyGoal />}
          </CollapsibleGoalGroup>
        </div>
      </div>
    );
  }

  if (viewMode === "monthly") {
    // Order: weekly → monthly → yearly
    const currentWeekGoal = findCurrentGoalFromBulk(monthWeeklyGoals);
    return (
      <div className="ld-goal-panel">
        <div className={grid3}>
          <CollapsibleGoalGroup title="주간 목표" defaultOpen={true} isMobile={isMobile} previewGoal={currentWeekGoal}>
            <BulkGoalList entries={monthWeeklyGoals} />
          </CollapsibleGoalGroup>
          <CollapsibleGoalGroup title="월간 목표" defaultOpen={true} isMobile={isMobile} previewGoal={monthlyGoal}>
            {monthlyGoal ? <GoalSection goalEntry={monthlyGoal} /> : <EmptyGoal />}
          </CollapsibleGoalGroup>
          <CollapsibleGoalGroup title="올해 목표" defaultOpen={true} isMobile={isMobile} previewGoal={yearlyGoal}>
            {yearlyGoal ? <GoalSection goalEntry={yearlyGoal} /> : <EmptyGoal />}
          </CollapsibleGoalGroup>
        </div>
      </div>
    );
  }

  if (viewMode === "yearly") {
    // Order: weekly → monthly → yearly
    // Weekly goals (52 weeks) as full-width collapsed row first,
    // then monthly + yearly as 2-col below.
    const currentWeekGoal = findCurrentGoalFromBulk(yearWeeklyGoals);
    const currentMonthGoal = findCurrentGoalFromBulk(yearMonthlyGoals);
    return (
      <div className="ld-goal-panel">
        <CollapsibleGoalGroup title="주간 목표" defaultOpen={false} isMobile={isMobile} previewGoal={currentWeekGoal}>
          <BulkGoalList entries={yearWeeklyGoals} />
        </CollapsibleGoalGroup>
        <div className={grid2} style={{ marginTop: 8 }}>
          <CollapsibleGoalGroup title="월간 목표" defaultOpen={true} isMobile={isMobile} previewGoal={currentMonthGoal}>
            <BulkGoalList entries={yearMonthlyGoals} />
          </CollapsibleGoalGroup>
          <CollapsibleGoalGroup title="올해 목표" defaultOpen={true} isMobile={isMobile} previewGoal={yearlyGoal}>
            {yearlyGoal ? <GoalSection goalEntry={yearlyGoal} /> : <EmptyGoal />}
          </CollapsibleGoalGroup>
        </div>
      </div>
    );
  }

  return null;
}

function EmptyGoal() {
  return <span className="ld-no-file">파일 없음</span>;
}
