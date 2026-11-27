import type { App } from "obsidian";
import { VAULT_PATH_SEPARATOR, vaultParentPath } from "../../../shared/lib/note-path";
import { resolveLink } from "../../../shared/api/obsidian";
import { PROJECT_INBOX, TASK_CREATE_COPY } from "../model/task-create";
import { TaskEditError } from "../model/task-edit";
import { isTodayGroup } from "../model/task-group";
import { assertCurrentSource, requireSource } from "./source-note";
import type { TasksSnapshot } from "../model/linked-tasks";

const { inboxMissing, projectMissing } = TASK_CREATE_COPY;

export function resolveProjectFolder(
  app: App,
  { groups, sourcePath }: TasksSnapshot,
  projectPath: string,
  folderName: string,
  missingFolder: string,
) {
  const { vault } = app;
  const [project, duplicate] = groups.filter((group) => !isTodayGroup(group) && group.notePath === projectPath);
  if (!project || duplicate) throw new TaskEditError(projectMissing);

  const { link } = project;
  const parent = vaultParentPath(projectPath);
  if (!link || !parent) throw new TaskEditError(projectMissing);
  const { file: projectFile } = resolveLink(app, sourcePath, link);
  if (!projectFile || projectFile.path !== projectPath) throw new TaskEditError(projectMissing);

  const folderPath = `${parent}${VAULT_PATH_SEPARATOR}${folderName}`;
  const folder = vault.getFolderByPath(folderPath);
  if (!folder) throw new TaskEditError(missingFolder);
  const source = requireSource(app, sourcePath);

  const assertCurrent = () => {
    assertCurrentSource(app, source, sourcePath);
    const { file } = resolveLink(app, sourcePath, link);
    if (file !== projectFile || file?.path !== projectPath) throw new TaskEditError(projectMissing);
    if (vault.getFolderByPath(folderPath) !== folder) throw new TaskEditError(missingFolder);
  };

  return { folder, project, source, assertCurrent, folderPath };
}

export function resolveProjectInbox(app: App, snapshot: TasksSnapshot, projectPath: string) {
  const { folder, folderPath, project, source, assertCurrent } = resolveProjectFolder(
    app, snapshot, projectPath, PROJECT_INBOX, inboxMissing,
  );
  return { inbox: folder, inboxPath: folderPath, project, source, assertCurrent };
}
