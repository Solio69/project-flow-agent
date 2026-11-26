import type { App, TAbstractFile } from "obsidian";
import { SOURCE_PATHS, VAULT_EVENTS } from "./constants";

const { create, modify, remove, rename } = VAULT_EVENTS;

export function watchCurrentTasks(
  app: App,
  isRelated: (path: string) => boolean,
  refresh: () => void,
): () => void {
  const { vault } = app;
  const matches = (path: string) =>
    SOURCE_PATHS.includes(path) || isRelated(path);
  const check = ({ path }: TAbstractFile, oldPath?: string) => {
    if ((oldPath !== undefined && matches(oldPath)) || matches(path)) refresh();
  };
  const refs = [
    vault.on(create, check),
    vault.on(modify, check),
    vault.on(remove, check),
    vault.on(rename, check),
  ];
  return () => refs.forEach((ref) => vault.offref(ref));
}
