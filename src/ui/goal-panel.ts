import { App, TFile } from "obsidian";
import type { GoalEntry, ViewMode } from "../types";
import type { DataService } from "../service";

interface GoalItem {
  checked: boolean;
  text: string;
}

/**
 * Weekly Goal / Monthly Goal 표시 및 편집 패널.
 * weekly view → weekly goal만, monthly view → monthly goal만 표시.
 * recent/yearly → goal 패널 숨김.
 * 체크리스트 형식 (- [x] / - [ ]) 으로 양방향 편집.
 */
export class GoalPanel {
  private wrapperEl!: HTMLElement;

  constructor(
    private containerEl: HTMLElement,
    private dataService: DataService,
    private app: App,
  ) {
    this.wrapperEl = this.containerEl.createDiv({ cls: "ld-goal-panel" });
  }

  update(weekly: GoalEntry | null, monthly: GoalEntry | null, mode: ViewMode): void {
    this.wrapperEl.empty();

    if (mode === "weekly" && weekly) {
      this.renderGoal(this.wrapperEl, weekly, "Weekly Goal");
    } else if (mode === "monthly" && monthly) {
      this.renderGoal(this.wrapperEl, monthly, "Monthly Goal");
    }
    // recent / yearly → goal 표시 안 함
  }

  private renderGoal(container: HTMLElement, goal: GoalEntry, label: string): void {
    const goalEl = container.createDiv({ cls: "ld-goal-section" });
    goalEl.createEl("span", { text: label, cls: "ld-goal-label" });

    const goals = this.parseGoals(goal.content);
    this.renderGoalList(goalEl, goals, goal);
  }

  private renderGoalList(container: HTMLElement, goals: GoalItem[], goalEntry: GoalEntry): void {
    const listEl = container.createDiv({ cls: "ld-goal-list" });

    goals.forEach((g, index) => {
      const row = listEl.createDiv({ cls: "ld-goal-row" });

      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = g.checked;
      checkbox.addClass("ld-goal-checkbox");
      checkbox.addEventListener("change", async () => {
        const file = this.app.vault.getAbstractFileByPath(goalEntry.filePath);
        if (file instanceof TFile) {
          goals[index].checked = checkbox.checked;
          const newContent = this.serializeGoals(goals);
          goalEntry.content = newContent;
          await this.dataService.updateValue(file, "goal", newContent);
        }
      });

      const labelEl = row.createEl("label", { text: g.text, cls: "ld-goal-text" });
      labelEl.addEventListener("click", (e) => {
        e.preventDefault();
        const editInput = row.createEl("input", {
          type: "text",
          value: g.text,
          cls: "ld-goal-edit-input",
        });
        labelEl.replaceWith(editInput);
        editInput.focus();

        const save = async () => {
          const file = this.app.vault.getAbstractFileByPath(goalEntry.filePath);
          if (file instanceof TFile) {
            const newText = editInput.value.trim();
            if (newText && newText !== g.text) {
              goals[index].text = newText;
            } else if (!newText) {
              goals.splice(index, 1);
            }
            const newContent = this.serializeGoals(goals);
            goalEntry.content = newContent;
            await this.dataService.updateValue(file, "goal", newContent);
          }
          // re-render
          container.empty();
          container.createEl("span", { text: container.querySelector(".ld-goal-label")?.textContent ?? "", cls: "ld-goal-label" });
          this.renderGoalList(container, goals, goalEntry);
        };

        editInput.addEventListener("blur", save);
        editInput.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") { ev.preventDefault(); save(); }
          if (ev.key === "Escape") { ev.preventDefault(); editInput.replaceWith(labelEl); }
        });
      });

      const deleteBtn = row.createEl("button", { text: "\u{1F5D1}\u{FE0F}", cls: "ld-goal-delete" });
      deleteBtn.addEventListener("click", async () => {
        const file = this.app.vault.getAbstractFileByPath(goalEntry.filePath);
        if (file instanceof TFile) {
          goals.splice(index, 1);
          const newContent = this.serializeGoals(goals);
          goalEntry.content = newContent;
          await this.dataService.updateValue(file, "goal", newContent);
          row.remove();
        }
      });
    });

    // 새 goal 추가 UI
    const addRow = listEl.createDiv({ cls: "ld-goal-add-row" });
    const addInput = addRow.createEl("input", {
      type: "text",
      placeholder: "New goal...",
      cls: "ld-goal-add-input",
    });
    const addBtn = addRow.createEl("button", { text: "Add", cls: "ld-btn ld-btn-save" });

    const handleAdd = async () => {
      const text = addInput.value.trim();
      const file = this.app.vault.getAbstractFileByPath(goalEntry.filePath);
      if (!text || !(file instanceof TFile)) return;

      goals.push({ checked: false, text });
      const newContent = this.serializeGoals(goals);
      goalEntry.content = newContent;
      await this.dataService.updateValue(file, "goal", newContent);
      addInput.value = "";
      // re-render list
      container.empty();
      this.renderGoal(container, goalEntry, "");
    };

    addBtn.addEventListener("click", handleAdd);
    addInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
    });
  }

  private parseGoals(content: string): GoalItem[] {
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

  private serializeGoals(goals: GoalItem[]): string {
    return goals.map((g) => `- [${g.checked ? "x" : " "}] ${g.text}`).join("\n");
  }
}
