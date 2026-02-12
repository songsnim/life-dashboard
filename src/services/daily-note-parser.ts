import { App, TFile, parseYaml } from "obsidian";
import type { DayEntry, GoalEntry } from "../types";
import { FRONTMATTER_MAP } from "../constants";
import { normalizeTimeString } from "./date-utils";

/**
 * Daily Note 파일을 파싱하여 DayEntry를 생성한다.
 * frontmatter → 구조화된 속성, body → Tasks/Journal 섹션 추출.
 */
export class DailyNoteParser {
  constructor(private app: App) {}

  async parse(file: TFile, date: string): Promise<DayEntry> {
    const content = await this.app.vault.read(file);
    const frontmatter = this.parseFrontmatter(content);
    const sections = this.parseSections(content);

    const entry: DayEntry = {
      date,
      filePath: file.path,
      bedtime: null,
      wakeTime: null,
      screenTime: null,
      exercise: false,
      reading: false,
      sobriety: false,
      rating: null,
      tasks: "",
      journal: "",
    };

    // frontmatter 매핑
    for (const [fmKey, entryKey] of Object.entries(FRONTMATTER_MAP)) {
      if (fmKey in frontmatter) {
        const raw = frontmatter[fmKey];
        this.assignProperty(entry, entryKey, raw);
      }
    }

    // body 섹션 (Daily Note에서는 "### Todo"를 Tasks로 사용)
    entry.tasks = sections["Todo"] ?? sections["Tasks"] ?? "";
    entry.journal = sections["Journal"] ?? "";

    return entry;
  }

  /** Weekly/Monthly Note에서 Goal 섹션을 파싱 */
  async parseGoal(file: TFile, period: string): Promise<GoalEntry> {
    const content = await this.app.vault.read(file);
    const sections = this.parseSections(content);
    return {
      filePath: file.path,
      period,
      content: sections["Goal"] ?? "",
    };
  }

  private parseFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    try {
      return (parseYaml(match[1]) as Record<string, unknown>) ?? {};
    } catch {
      return {};
    }
  }

  /**
   * ### 헤더 아래 텍스트를 섹션별로 추출.
   * 다음 ### 헤더 또는 파일 끝까지를 해당 섹션의 내용으로 본다.
   */
  private parseSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    // frontmatter 이후 본문
    const body = content.replace(/^---\n[\s\S]*?\n---\n?/, "");
    const regex = /^### (.+)$/gm;
    let match: RegExpExecArray | null;
    const headers: { name: string; start: number }[] = [];

    while ((match = regex.exec(body)) !== null) {
      headers.push({ name: match[1].trim(), start: match.index + match[0].length });
    }

    for (let i = 0; i < headers.length; i++) {
      const end = i + 1 < headers.length ? headers[i + 1].start - headers[i + 1].name.length - 5 : body.length;
      sections[headers[i].name] = body.slice(headers[i].start, end).trim();
    }

    return sections;
  }

  private assignProperty(entry: DayEntry, key: keyof DayEntry, raw: unknown): void {
    switch (key) {
      case "bedtime":
      case "wakeTime":
      case "screenTime":
        // ISO datetime → "HH:mm" 정규화
        entry[key] = normalizeTimeString(raw);
        break;
      case "exercise":
      case "reading":
      case "sobriety":
        entry[key] = Boolean(raw);
        break;
      case "rating":
        entry[key] = typeof raw === "number" ? raw : null;
        break;
    }
  }
}
