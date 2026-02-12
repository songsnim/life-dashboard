# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Life Dashboard" — an Obsidian plugin that reads daily notes and renders a quantified-self dashboard with an editable table and Chart.js plots. All UI text and comments should be in Korean to match the README spec.

## Build & Development Commands

```bash
npm run build        # Bundle with esbuild → main.js
npm run dev          # Watch mode (rebuild on save)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
```

The plugin output is a single `main.js` file (bundled by esbuild). For local development, copy/symlink the repo folder into an Obsidian vault's `.obsidian/plugins/log-day/` directory and enable it.

## Architecture

```
src/
  main.ts                     — Plugin entry point (LifeDashboardPlugin extends Plugin)
  types.ts                    — All interfaces: DayEntry, GoalEntry, PluginSettings, ColumnDef
  constants.ts                — TABLE_COLUMNS, FRONTMATTER_MAP, defaults, reference-line targets
  services/
    daily-note-parser.ts      — Reads frontmatter + ### body sections → DayEntry/GoalEntry
    note-writer.ts            — Atomic writes back to notes via app.vault.process()
    date-utils.ts             — Date ranges, sleep calc, time parsing, formatting
  ui/
    dashboard-view.ts         — ItemView subclass: orchestrates all UI components
    table-renderer.ts         — Editable table with inline inputs (checkbox/time/number/text)
    chart-renderer.ts         — Chart.js line charts with custom target-line plugin
    view-switcher.ts          — View mode buttons (최근15일/주간/월간/연간)
    goal-panel.ts             — Inline-editable weekly/monthly goal display
```

Key decisions:
- **esbuild externals**: `obsidian`, `electron`, `@codemirror/*` are external. **Chart.js is bundled.**
- **Bidirectional sync**: Table edits write back to source Daily Notes via `app.vault.process(file, fn)` (atomic).
- **YAML**: Uses Obsidian's built-in `parseYaml` / `stringifyYaml` — no external YAML library.
- **Chart reference lines**: Drawn via Chart.js inline plugin (no chartjs-plugin-annotation dependency).
- **Frontmatter key mapping**: `FRONTMATTER_MAP` in constants.ts maps both English and Korean property names to DayEntry fields.

## Key Conventions

- CSS classes use `ld-` prefix to avoid Obsidian theme conflicts
- tsconfig should target **ES2020+** (not ES6) for `Object.entries`, `Object.fromEntries`, `String.padStart`
- Do not set `importHelpers: true` in tsconfig unless `tslib` is installed
- When casting a specific interface to `Record<string, unknown>`, use `unknown` as an intermediate cast
- ESLint: `@typescript-eslint/no-explicit-any` is warn, unused vars with `_` prefix are ignored

## Daily Note Schema (from README spec)

Table columns: date (YY-MM-DD 요일), 취침시간, 기상시간, Tasks, 운동, 독서, 금주, 스크린타임, 평점, Journal

- Boolean properties (운동/독서/금주) → checkbox in table
- Time properties (취침/기상/스크린타임) → line plots with reference lines (sleep ≥ 7h, screen time ≤ 4h)
- Sleep duration = 기상시간 − 전날 취침시간
- Tasks/Journal come from `### Tasks` / `### Journal` note body sections (not frontmatter)
- Views: 최근 15일, weekly, monthly, yearly — all switchable
- Weekly/Monthly notes have `### Goal` sections with bidirectional edit support
