# North Star Directive: Project "Life Dashboard 2.0" (Notion-ified Quantified Self)

## 1. Project Overview & Objective
"Life Dashboard 2.0" is an architectural upgrade to the existing Obsidian quantified-self plugin. The objective is to merge domain-specific Daily Note tracking (Sleep calculation, Chart.js visualizations, `### Tasks` parsing) with a highly interactive, Notion-like Database UI.

**Key Upgrades:**
- **Dynamic Views:** Replace static tables with a virtualized, React-based grid.
- **Rich Interactions:** Implement drag-and-drop (DnD) column reordering, arbitrary multi-column sorting, and dynamic filtering.
- **Korean UI:** All UI text, tooltips, and default configurations must be in Korean.

## 2. Tech Stack & Build Constraints
```bash
npm run build        # esbuild (main.js + styles.css)
npm run dev          # Watch mode
npm run typecheck    # tsc --noEmit (Target: ES2020+)
npm run lint         # ESLint (@typescript-eslint/no-explicit-any is warn)
```
**Dependency Rules:**
- **External:** `obsidian`, `electron`.
- **Bundled:** `react`, `react-dom`, `zustand` (State), `@dnd-kit/core` (Drag & Drop), `@tanstack/react-virtual` (Table Virtualization), `chart.js` (Visualizations).
- **No External YAML Libs:** Strictly use Obsidian's `parseYaml` / `stringifyYaml` or `app.vault.process`.

## 3. Architecture Blueprint

### A. Data & Synchronization Layer
- **Source of Truth:** Obsidian Daily/Weekly/Monthly `.md` files.
- **The Indexer:** Listen to `app.metadataCache.on('changed')` combined with `app.vault.read()` to parse both YAML Frontmatter (time, boolean stats) AND Body content (`### Tasks`, `### Journal`).
- **Atomic Mutations:** Table edits MUST write back via `app.vault.process(file, fn)`. Never mutate via raw string replacement.

### B. State Management Layer (Zustand)
Move away from stateless DOM re-renders. Implement a central store:
1.  **Data Store:** Caches parsed `DayEntry` and `GoalEntry` objects.
2.  **View State Store:** Manages the active view configuration (filters, sorts, column width, and column render order). This state is periodically persisted to the plugin's `data.json`.

### C. Presentation Layer (React within Obsidian)
- **DashboardView (`ItemView`):** Mounts the React Root.
- **Table Renderer:** A virtualized grid. Uses `@dnd-kit/sortable` for the column headers to allow users to drag columns left/right. Inputs (checkbox/time/number/text) trigger Optimistic UI updates in Zustand before syncing to the file.
- **Chart Renderer:** Listens to the *filtered and sorted* Zustand data to render Chart.js line plots (incorporating the custom target-line plugin for sleep/screen time).

## 4. Object Schema (The "Notion" Data Model)
```typescript
// types/schema.ts
export enum ColumnType {
    DATE = 'date',
    TIME = 'time',           // 취침/기상
    DURATION = 'duration',   // 수면시간 (Derived)
    BOOLEAN = 'boolean',     // 운동/독서/금주
    NUMBER = 'number',       // 스크린타임, 평점
    TEXT = 'text',           // Journal (Body section)
    CHECKLIST = 'checklist'  // Tasks (Body section)
}

export interface ColumnDef {
    id: string;              // e.g., 'sleep-time', 'journal'
    name: string;            // Display name (Korean)
    type: ColumnType;
    source: 'frontmatter' | 'body-section' | 'computed';
    frontmatterKey?: string; // For FRONTMATTER_MAP resolution
    width: number;
    visible: boolean;
}

export interface ViewConfig {
    viewMode: '15days' | 'weekly' | 'monthly' | 'yearly';
    columnOrder: string[];   // Array of ColumnDef IDs defining render sequence
    sorts: { columnId: string; direction: 'asc' | 'desc' }[];
    filters: FilterRule[];
}
```

## 5. Execution Rules for Claude Code

1.  **Strict React + DOM Separation:** Do not mix raw Obsidian DOM manipulation (`createEl`) with React. Use `createEl('div')` only once in `DashboardView.onOpen()` to mount the React tree.
2.  **Drag and Drop Implementation:** Use `@dnd-kit`. The `onDragEnd` event must mutate the column order array in the Zustand store and immediately trigger a plugin config save (`app.saveData()`).
3.  **Derived Columns (수면시간):** Sleep duration (기상시간 − 전날 취침시간) is a computed column. Sorting by this column must compute the value on the fly or rely on a pre-computed field in the Zustand store. Do NOT write this value back to the Markdown file unless explicitly configured.
4.  **Optimistic UI:** When a user checks a "운동" (Exercise) checkbox in the table:
    * *Immediate:* Toggle value in Zustand store (UI updates instantly).
    * *Async:* Call the note writer module -> `app.vault.process()`.
    * *Reconciliation:* If the file write fails, revert the Zustand state and show an Obsidian `Notice`.
5.  **Chart Sync:** The Chart.js instance must dynamically re-render if the user applies a Filter to the table (e.g., "평점 > 3").

## 6. Implementation Milestones

- **Phase 1: Foundation.** Setup esbuild for React, configure Zustand store with the schema model, and map existing parsing logic to the store.
- **Phase 2: The Virtual Table.** Implement Tanstack Virtual grid rendering the Zustand state.
- **Phase 3: Interactive Notion UI.** Integrate `@dnd-kit` for column reordering. Implement multi-column sorting logic in the store.
- **Phase 4: Mutations.** Connect table inline inputs to the note writer module with Optimistic UI updates.
- **Phase 5: Charts & Goals.** Re-integrate Chart.js and Goal panels, ensuring they react to the filtered Zustand state.