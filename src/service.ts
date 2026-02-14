import { App } from "obsidian";
import type { TFile } from "obsidian";

export class DataService {
  constructor(private app: App) {}

  /**
   * 노트의 데이터를 업데이트하고 파일에 저장합니다.
   * @param file 수정할 파일 객체
   * @param key 수정할 컬럼 키 (frontmatter 키 또는 섹션 헤더)
   * @param value 저장할 값
   */
  async updateValue(file: TFile, key: string, value: string | number | boolean | null): Promise<void> {
    // 본문 섹션으로 처리해야 하는 키들 (소문자 기준)
    const sectionKeys = ["tasks", "journal", "goal", "todo"];
    
    if (sectionKeys.includes(key.toLowerCase())) {
      await this.updateSection(file, key, String(value ?? ""));
    } else {
      await this.updateFrontmatter(file, key, value);
    }
  }

  private async updateFrontmatter(file: TFile, key: string, value: string | number | boolean | null): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter[key] = value;
    });
  }

  private async updateSection(file: TFile, key: string, content: string): Promise<void> {
    // 키를 헤더 형식으로 변환 (예: tasks -> Tasks)
    const header = key.charAt(0).toUpperCase() + key.slice(1);

    await this.app.vault.process(file, (fileContent) => {
      return this.replaceHeaderSection(fileContent, header, content);
    });
  }

  private replaceHeaderSection(content: string, header: string, newBody: string): string {
    const lines = content.split("\n");
    // "### Header" 형식의 헤더 찾기 (대소문자 무시)
    const headerRegex = new RegExp(`^###\\s+${header}\\s*$`, "i");
    const headerIndex = lines.findIndex((line) => headerRegex.test(line));

    if (headerIndex === -1) {
      // 헤더가 없으면 파일 끝에 추가
      const prefix = content.trim().length > 0 ? "\n\n" : "";
      return `${content.trim()}${prefix}### ${header}\n${newBody}`;
    }

    // 다음 헤더 찾기 (현재 섹션의 끝)
    let nextHeaderIndex = lines.length;
    for (let i = headerIndex + 1; i < lines.length; i++) {
      if (lines[i].match(/^###\s+/)) {
        nextHeaderIndex = i;
        break;
      }
    }

    const before = lines.slice(0, headerIndex + 1).join("\n");
    const after = lines.slice(nextHeaderIndex).join("\n");
    
    return `${before}\n${newBody}\n${after}`;
  }
}

/**
 * 취침시간과 기상시간을 기반으로 수면 시간(분)을 계산합니다.
 * @param bedtime 취침시간 (HH:mm) - 전날 밤 기준일 수 있음
 * @param wakeTime 기상시간 (HH:mm)
 */
export function calculateSleepMinutes(bedtime: string, wakeTime: string): number {
  if (!bedtime || !wakeTime) return 0;

  const [bH, bM] = bedtime.split(":").map(Number);
  const [wH, wM] = wakeTime.split(":").map(Number);
  
  const bMin = bH * 60 + bM;
  const wMin = wH * 60 + wM;

  // 취침시간이 기상시간보다 늦으면(숫자가 크면) 전날 취침한 것으로 간주 (예: 23:00 -> 07:00)
  return bMin > wMin ? (wMin + 1440) - bMin : wMin - bMin;
}