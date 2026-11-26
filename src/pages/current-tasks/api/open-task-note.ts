import type { App, TFile, WorkspaceLeaf } from "obsidian";
import { resolveLink, WORKSPACE_TAB } from "../../../shared/api/obsidian";
import { DIAGNOSTIC_COPY } from "./constants";

const { missingLinkedNote } = DIAGNOSTIC_COPY;

export async function openLinkedNote(
  app: App,
  sourceLeaf: WorkspaceLeaf,
  sourcePath: string,
  link: string,
  forceNewTab: boolean,
): Promise<void> {
  const { file, subpath } = resolveLink(app, sourcePath, link);
  if (!file) throw new Error(missingLinkedNote);
  const openInNewTab = forceNewTab || sourceLeaf.getViewState().pinned;
  await openTaskNote(app, file, openInNewTab ? undefined : sourceLeaf, subpath);
}

export async function openCurrentTasksSource(app: App, sourcePath: string) {
  const file = app.vault.getFileByPath(sourcePath);
  if (!file) throw new Error(missingLinkedNote);
  await openTaskNote(app, file);
}

async function openTaskNote(app: App, file: TFile, existingLeaf?: WorkspaceLeaf, subpath?: string) {
  const leaf = existingLeaf ?? app.workspace.getLeaf(WORKSPACE_TAB);
  try {
    await leaf.openFile(file, {
      active: true,
      eState: subpath ? { subpath } : undefined,
    });
  } catch (error) {
    if (!existingLeaf) leaf.detach();
    throw error;
  }
}
