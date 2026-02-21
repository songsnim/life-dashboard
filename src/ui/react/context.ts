import { createContext, useContext } from "react";
import type { App } from "obsidian";
import type { DataService } from "../../service";
import type { NoteWriter } from "../../services/note-writer";
import type { PluginSettings } from "../../types";

export interface AppContextValue {
  app: App;
  settings: PluginSettings;
  dataService: DataService;
  noteWriter: NoteWriter;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside AppContext.Provider");
  return ctx;
}
