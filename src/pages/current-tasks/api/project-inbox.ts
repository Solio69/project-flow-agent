import type { App } from "obsidian";
import { VAULT_PATH_SEPARATOR, vaultParentPath } from "../../../shared/lib/note-path";
import { resolveLink } from "../../../shared/api/obsidian";
import { PROJECT_INBOX, TASK_CREATE_COPY } from "../model/task-create";
import { TaskEditError } from "../model/task-edit";
import { isTodayGroup } from "../model/task-group";
import { assertCurrentSource, requireSource } from "./source-note";
import type { TasksSnapshot } from "../model/linked-tasks";

const { inboxMissing, projectMissing } = TASK_CREATE_COPY;

export function resolveProjectInbox(app: App, { groups, sourcePath }: TasksSnapshot, projectPath: string) {
  const { vault } = app;
  const [project, duplicate] = groups.filter((group) => !isTodayGroup(group) && group.notePath === projectPath);
  if (!project || duplicate) throw new TaskEditError(projectMissing);

  const { link } = project;
  const parent = vaultParentPath(projectPath);
  if (!link || !parent) throw new TaskEditError(projectMissing);
  const { file: projectFile } = resolveLink(app, sourcePath, link);
  if (!projectFile || projectFile.path !== projectPath) throw new TaskEditError(projectMissing);

  const inboxPath = parent + VAULT_PATH_SEPARATOR + PROJECT_INBOX;
  const inbox = vault.getFolderByPath(inboxPath);
  if (!inbox) throw new TaskEditError(inboxMissing);
  const source = requireSource(app, sourcePath);

  const assertCurrent = () => {
    assertCurrentSource(app, source, sourcePath);
    const { file } = resolveLink(app, sourcePath, link);
    if (file !== projectFile || file?.path !== projectPath) throw new TaskEditError(projectMissing);
    if (vault.getFolderByPath(inboxPath) !== inbox) throw new TaskEditError(inboxMissing);
  };

  return { inbox, project, source, assertCurrent, inboxPath };
}
