import type { App, TFile } from "obsidian";
import { TASK_EDIT_COPY, TaskEditError } from "../model/task-edit";
import { SOURCE_PATHS } from "./constants";

const { conflict } = TASK_EDIT_COPY;

export function findSource({ vault }: App) {
  for (const path of SOURCE_PATHS) {
    const source = vault.getFileByPath(path);
    if (source) return source;
  }
}

export function requireSource(app: App, expectedPath: string) {
  const source = findSource(app);
  if (!source || source.path !== expectedPath) throw new TaskEditError(conflict);
  return source;
}

export function assertCurrentSource(app: App, source: TFile, expectedPath: string) {
  if (source.path !== expectedPath || findSource(app) !== source) throw new TaskEditError(conflict);
}
