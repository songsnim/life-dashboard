import { App, TFile } from "obsidian";
import type { DayEntry, GoalEntry } from "../types";
import { FRONTMATTER_MAP } from "../constants";
import { normalizeTimeString } from "./date-utils";

/** frontmatter에 시간으로 저장되는 필드 */
const TIME_FIELDS = new Set(["취침", "기상", "스크린타임", "bedtime", "wakeTime", "screenTime"]);

/**
 * DayEntry의 변경사항을 원본 Daily Note에 반영한다.
 * frontmatter → app.fileManager.processFrontMatter() (Obsidian 공식 API)
 * body 섹션 → app.vault.process() (atomic)
 */
export class NoteWriter {
  constructor(private app: App) {}

  /** frontmatter property 하나를 업데이트 (Obsidian 공식 API 사용) */
  async updateProperty(filePath: string, propertyKey: string, value: unknown): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;

    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (value === null || value === undefined) {
        delete fm[propertyKey];
      } else {
        // 시간 필드는 항상 "HH:mm" 형태로 저장 (ISO datetime 방지)
        fm[propertyKey] = TIME_FIELDS.has(propertyKey) ? (normalizeTimeString(value) ?? value) : value;
      }
    });
  }

  /** body 섹션(### Tasks, ### Journal) 내용을 업데이트 */
  async updateSection(filePath: string, sectionName: string, newContent: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;

    await this.app.vault.process(file, (content) => {
      return this.replaceSectionContent(content, sectionName, newContent);
    });
  }

  /** DayEntry 필드 키로부터 실제 frontmatter property 이름을 역으로 찾는다 */
  getFrontmatterKey(entryKey: keyof DayEntry): string | null {
    for (const [fmKey, mapped] of Object.entries(FRONTMATTER_MAP)) {
      if (mapped === entryKey) return fmKey;
    }
    return null;
  }

  /** Weekly/Monthly goal 업데이트 (체크리스트 형식) */
  async updateGoal(goal: GoalEntry): Promise<void> {
    await this.updateSection(goal.filePath, "Goal", goal.content);
  }

  private replaceSectionContent(content: string, sectionName: string, newText: string): string {
    const regex = new RegExp(
      `(### ${this.escapeRegex(sectionName)}\\s*)[\\s\\S]*?(?=\\s*###|\\s*$)`,
      "i",
    );

    if (regex.test(content)) {
      return content.replace(regex, `### ${sectionName}\n${newText.trim()}`);
    }

    // 섹션이 없으면 파일 끝에 추가
    const separator = content.trim() === "" ? "" : "\n\n";
    return content + separator + `### ${sectionName}\n${newText.trim()}`;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
