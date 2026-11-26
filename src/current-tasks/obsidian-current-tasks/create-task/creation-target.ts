import type { App, TFile, TFolder } from "obsidian";
import { VAULT_PATH_SEPARATOR } from "../../../obsidian/constants";
import { taskFilename, type CreateTaskRequest } from "../../task-create";
import { resolveProjectInbox } from "../project-inbox";
import type { LinkedTaskGroup, TasksSnapshot } from "../types";


export type CreationTarget = {
  filename: string;
  inbox: TFolder;
  path: string;
  project: LinkedTaskGroup;
  source: TFile;
  assertCurrent: () => void;
};

export function resolveCreationTarget(
  app: App,
  snapshot: TasksSnapshot,
  { title, projectPath }: CreateTaskRequest,
): CreationTarget {
  const filename = taskFilename(title);
  const { inbox, inboxPath, project, source, assertCurrent } = resolveProjectInbox(app, snapshot, projectPath);
  const path = inboxPath + VAULT_PATH_SEPARATOR + filename;
  return { filename, inbox, path, project, source, assertCurrent };
}
