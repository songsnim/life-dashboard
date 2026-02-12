import type { ViewMode } from "../types";

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  recent: "15",
  weekly: "W",
  monthly: "M",
  yearly: "Y",
};

/**
 * 뷰 모드 전환 버튼 그룹.
 * 좌상단에 고정, 모바일 스크롤에 영향 받지 않음.
 */
export class ViewSwitcher {
  private buttons: Map<ViewMode, HTMLButtonElement> = new Map();

  constructor(
    private containerEl: HTMLElement,
    private currentMode: ViewMode,
    private onChange: (mode: ViewMode) => void,
  ) {
    this.render();
  }

  update(mode: ViewMode): void {
    this.currentMode = mode;
    for (const [m, btn] of this.buttons) {
      btn.toggleClass("ld-view-btn--active", m === mode);
    }
  }

  private render(): void {
    const wrapper = this.containerEl.createDiv({ cls: "ld-view-wrapper" });
    wrapper.createEl("span", { text: "VIEW", cls: "ld-view-label" });
    const group = wrapper.createDiv({ cls: "ld-view-switcher" });

    for (const mode of Object.keys(VIEW_MODE_LABELS) as ViewMode[]) {
      const btn = group.createEl("button", {
        text: VIEW_MODE_LABELS[mode],
        cls: "ld-view-btn",
      });

      if (mode === this.currentMode) {
        btn.addClass("ld-view-btn--active");
      }

      btn.addEventListener("click", () => {
        this.onChange(mode);
      });

      this.buttons.set(mode, btn);
    }
  }
}
