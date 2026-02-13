import { App, TFile, Modal } from "obsidian";
import type { DayEntry } from "../types";
import { TABLE_COLUMNS, INTERNAL_TO_FRONTMATTER_MAP } from "../constants";
import { DataService } from "../service";
import { calculateSleepMinutes } from "../service";

/**
 * 대시보드 테이블 렌더러.
 * 기존 dashboard-bundle.js의 gh-table 스타일 구현.
 * - Boolean: 커스텀 check indicator (rounded box, green active)
 * - Time: monospace input
 * - Sleep: badge (highlight when data present)
 * - Journal: 첫 줄만 표시, 클릭 시 모달 편집
 * - Date: YY.MM.DD ddd 포맷, 클릭 시 해당 노트 열기
 */
export class TableRenderer {
  constructor(
    private containerEl: HTMLElement,
    private dataService: DataService,
    private app: App,
    private onInteraction?: (interacting: boolean) => void,
  ) {}

  private async updateEntry(filePath: string, key: string, value: any) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      // Daily Note의 'tasks' 데이터는 'Todo' 섹션에 저장됩니다.
      let writeKey = key;
      if (key === "tasks") {
        writeKey = "todo";
      } else if (INTERNAL_TO_FRONTMATTER_MAP[key]) {
        writeKey = INTERNAL_TO_FRONTMATTER_MAP[key];
      }

      await this.dataService.updateValue(file, writeKey, value);
    } else {
      console.error(`[log-day] File not found for entry: ${filePath}`);
    }
  }

  update(entries: DayEntry[]): void {
    this.containerEl.empty();

    const scrollWrapper = this.containerEl.createDiv({ cls: "ld-scroll-container" });
    const table = scrollWrapper.createEl("table", { cls: "ld-table" });

    this.renderHeader(table);
    this.renderBody(table, entries);
  }

  private renderHeader(table: HTMLTableElement): void {
    const thead = table.createEl("thead");
    const tr = thead.createEl("tr");

    const allCols = this.getDisplayColumns();
    for (const col of allCols) {
      const th = tr.createEl("th", { text: col.label, cls: `ld-th ld-col-${col.key}` });

      if (col.key === "date") {
        th.addClass("ld-th-clickable");
        th.addEventListener("click", () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this.app as any).commands?.executeCommandById?.("periodic-notes:open-daily-note");
        });
      }
    }
  }

  private renderBody(table: HTMLTableElement, entries: DayEntry[]): void {
    const tbody = table.createEl("tbody");

    for (const entry of entries) {
      const tr = tbody.createEl("tr");
      const allCols = this.getDisplayColumns();
      const rowRefs: Record<string, HTMLInputElement> = {};
      let sleepBadge: HTMLSpanElement | null = null;

      for (const col of allCols) {
        const td = tr.createEl("td", { cls: "ld-td" });

        if (col.key === "date") {
          this.renderDateCell(td, entry);
        } else if (col.key === "_sleep") {
          sleepBadge = this.renderSleepBadge(td, entry);
        } else if (col.type === "boolean") {
          this.renderBoolCell(td, entry, col.key as "exercise" | "reading" | "sobriety");
        } else if (col.type === "number") {
          this.renderNumberInput(td, entry, col.key as "rating");
        } else if (col.type === "time") {
          const input = this.renderTimeInput(td, entry, col.key as "bedtime" | "wakeTime" | "screenTime");
          rowRefs[col.key] = input;
          // 취침/기상 변경 시 수면 badge 재계산
          if (col.key === "bedtime" || col.key === "wakeTime") {
            input.addEventListener("blur", () => {
              if (sleepBadge) this.recalcSleepBadge(rowRefs, sleepBadge);
            });
          }
        } else if (col.key === "tasks") {
          this.renderTasksCell(td, entry);
        } else if (col.key === "journal") {
          this.renderJournalCell(td, entry);
        }
      }
    }
  }

  private renderDateCell(td: HTMLElement, entry: DayEntry): void {
    td.addClass("ld-date-cell");
    const link = td.createEl("a", {
      text: this.formatDisplayDate(entry.date),
      cls: "ld-date-link",
    });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      this.app.workspace.openLinkText(entry.filePath, "", false);
    });
  }

  private renderBoolCell(td: HTMLElement, entry: DayEntry, key: "exercise" | "reading" | "sobriety"): void {
    td.addClass("ld-bool-cell");
    if (entry[key]) td.addClass("active");

    td.createDiv({ cls: "ld-check-indicator" });

    td.addEventListener("click", async () => {
      const newState = !td.hasClass("active");
      td.toggleClass("active", newState);
      entry[key] = newState;
      await this.updateEntry(entry.filePath, key, newState);
    });
  }

  private renderSleepBadge(td: HTMLElement, entry: DayEntry): HTMLSpanElement {
    const badge = td.createEl("span", { cls: "ld-sleep-badge" });
    const mins = calculateSleepMinutes(entry.bedtime, entry.wakeTime);
    if (mins && mins > 0) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      badge.setText(`${h}h ${m}m`);
      badge.addClass("highlight");
    } else {
      badge.setText("-");
    }
    return badge;
  }

  private renderTimeInput(td: HTMLElement, entry: DayEntry, key: "bedtime" | "wakeTime" | "screenTime"): HTMLInputElement {
    const input = td.createEl("input", {
      cls: "ld-input",
      value: entry[key] ?? "",
    });
    const originalValue = entry[key] ?? "";

    input.addEventListener("blur", async () => {
      if (input.value.trim() === originalValue) return;
      const val = input.value.trim() === "" ? null : input.value.trim();
      entry[key] = val;
      await this.updateEntry(entry.filePath, key, val);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
    });

    return input;
  }

  private renderNumberInput(td: HTMLElement, entry: DayEntry, key: "rating"): void {
    const input = td.createEl("input", {
      cls: "ld-input",
      type: "number",
      value: entry[key]?.toString() ?? "",
    });
    input.setAttribute("min", "0");
    input.setAttribute("max", "10");

    input.addEventListener("blur", async () => {
      const val = input.value === "" ? null : Number(input.value);
      entry[key] = val;
      await this.updateEntry(entry.filePath, key, val);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
    });
  }

  /** Journal: 첫 줄만 truncate 표시, 클릭 시 모달로 전체 편집 */
  private renderJournalCell(td: HTMLElement, entry: DayEntry): void {
    td.addClass("ld-journal-cell");
    const span = td.createEl("span");
    const firstLine = entry.journal ? entry.journal.split("\n")[0].trim() : "-";
    span.setText(firstLine);

    td.addEventListener("click", () => {
      this.openJournalModal(
        this.formatDisplayDate(entry.date),
        entry.journal,
        async (newText) => {
          span.setText(newText ? newText.split("\n")[0].trim() : "-");
          entry.journal = newText;
          await this.updateEntry(entry.filePath, "journal", newText);
        },
      );
    });
  }

  /** Tasks: inline checkbox 리스트. 텍스트 클릭으로 즉석 수정, 하단 입력란으로 추가. */
  private renderTasksCell(td: HTMLElement, entry: DayEntry): void {
    td.addClass("ld-tasks-cell");
    const tasks = this.parseTasks(entry.tasks);

    const save = async () => {
      if (this.onInteraction) this.onInteraction(true);
      try {
        const serializedTasks = this.serializeTasks(tasks);
        entry.tasks = serializedTasks;
        await this.updateEntry(entry.filePath, "tasks", serializedTasks);
      } finally {
        if (this.onInteraction) this.onInteraction(false);
      }
    };

    const rebuild = (focusIndex: number = -1) => {
      td.empty();
      const listEl = td.createDiv({ cls: "ld-task-list" });
      
      for (let i = 0; i < tasks.length; i++) {
        this.renderTaskRow(listEl, tasks, i, save, rebuild, i === focusIndex);
      }

      // tasks가 없을 때만 추가 입력란 표시
      if (tasks.length === 0) {
        const addInput = td.createEl("input", {
          type: "text",
          placeholder: "+",
          cls: "ld-task-add-input",
        });
        addInput.addEventListener("keydown", async (e) => {
          if (e.key === "Enter" && !e.isComposing) {
            e.preventDefault();
            const text = addInput.value.trim();
            if (!text) return;
            tasks.push({ checked: false, text });
            await save();
            rebuild(0);
          }
        });
      }
    };

    rebuild();
  }

  private renderTaskRow(
    container: HTMLElement,
    tasks: Array<{ checked: boolean; text: string }>,
    index: number,
    save: () => Promise<void>,
    rebuild: (focusIndex?: number) => void,
    shouldFocus: boolean,
  ): void {
    const task = tasks[index];
    const row = container.createDiv({ cls: "ld-task-row" });

    // checkbox
    const cb = row.createEl("input", { type: "checkbox", cls: "ld-task-checkbox" });
    cb.checked = task.checked;
    cb.addEventListener("change", async () => {
      tasks[index].checked = cb.checked;
      await save();
      const span = row.querySelector("span.ld-task-text");
      if (span) span.toggleClass("ld-task-done", cb.checked);
    });

    const switchToEdit = () => {
      const editInput = row.ownerDocument.createElement("input");
      editInput.type = "text";
      editInput.value = task.text;
      editInput.className = "ld-task-edit-input";
      
      const onBlur = async () => {
        const newText = editInput.value.trim();
        tasks[index].text = newText;
        await save();
        rebuild();
      };

      editInput.addEventListener("blur", onBlur);
      
      editInput.addEventListener("keydown", async (ev) => {
        if (ev.key === "Enter" && !ev.isComposing) {
          ev.preventDefault();
          // Blur 이벤트 중복 실행 방지
          editInput.removeEventListener("blur", onBlur);

          const newText = editInput.value.trim();
          if (!newText) {
             tasks[index].text = "";
          } else {
             tasks[index].text = newText;
          }
          
          // 다음 줄에 새 항목 추가
          tasks.splice(index + 1, 0, { checked: false, text: "" });
          await save();
          rebuild(index + 1);
        } else if (ev.key === "Backspace" && editInput.value === "") {
          ev.preventDefault();
          editInput.removeEventListener("blur", onBlur);
          tasks.splice(index, 1);
          await save();
          rebuild(Math.max(0, index - 1));
        } else if (ev.key === "Escape" && !ev.isComposing) {
            ev.preventDefault();
            editInput.removeEventListener("blur", onBlur);
            rebuild();
        }
      });

      textEl.replaceWith(editInput);
      editInput.focus();
    };

    const textEl = row.createEl("span", {
      text: task.text || "\u00A0",
      cls: `ld-task-text${task.checked ? " ld-task-done" : ""}`,
    });
    textEl.addEventListener("click", switchToEdit);

    if (shouldFocus) {
      switchToEdit();
    }
  }

  private parseTasks(raw: string): Array<{ checked: boolean; text: string }> {
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- ["))
      .map((l) => {
        const m = l.match(/-\s*\[( |x|X)\]\s*(.*)/);
        if (!m) return null;
        return { checked: m[1] === "x" || m[1] === "X", text: m[2].trim() };
      })
      .filter((t): t is { checked: boolean; text: string } => t !== null);
  }

  private serializeTasks(tasks: Array<{ checked: boolean; text: string }>): string {
    return tasks.map((t) => `- [${t.checked ? "x" : " "}] ${t.text}`).join("\n");
  }

  private openJournalModal(title: string, currentText: string, onSave: (text: string) => void): void {
    new JournalModal(this.app, title, currentText, onSave).open();
  }

  private recalcSleepBadge(refs: Record<string, HTMLInputElement>, badge: HTMLSpanElement): void {
    const wake = refs["wakeTime"]?.value;
    const bed = refs["bedtime"]?.value;
    if (wake && bed && /^\d{2}:\d{2}$/.test(wake) && /^\d{2}:\d{2}$/.test(bed)) {
      const mins = calculateSleepMinutes(bed, wake);
      if (mins && mins > 0) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        badge.setText(`${h}h ${m}m`);
        badge.addClass("highlight");
        return;
      }
    }
    badge.setText("-");
    badge.removeClass("highlight");
  }

  /** YYYY-MM-DD → "YY.MM.DD ddd" (한국어 요일) */
  private formatDisplayDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    const yy = d.getFullYear().toString().slice(2);
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${yy}.${mm}.${dd} ${days[d.getDay()]}`;
  }

  private getDisplayColumns(): Array<{ key: string; label: string; type: string }> {
    const cols: Array<{ key: string; label: string; type: string }> = [];
    for (const col of TABLE_COLUMNS) {
      cols.push(col);
      if (col.key === "wakeTime") {
        cols.push({ key: "_sleep", label: "SLEEP", type: "computed" });
      }
    }
    return cols;
  }
}

class JournalModal extends Modal {
  constructor(
    app: App,
    private title: string,
    private content: string,
    private onSave: (text: string) => void,
  ) {
    super(app);
  }

  onOpen() {
    // 모바일 키보드 대응: CSS에서 이 클래스로 모달을 상단 배치
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
      this.onSave(textarea.value);
      this.close();
    });

    // 모바일: textarea focus 시 키보드 위로 모달 이동
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
