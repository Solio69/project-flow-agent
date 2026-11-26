import type { App, TFile, TFolder } from "obsidian";
import { VAULT_PATH_SEPARATOR } from "../../../obsidian/constants";
import { resolveLink } from "../../../obsidian/resolve-link";
import { vaultParentPath } from "../../../obsidian/vault-path";
import { PROJECT_INBOX, TASK_CREATE_COPY, taskFilename, type CreateTaskRequest } from "../../task-create";
import { TaskEditError } from "../../task-edit";
import { isTodayGroup } from "../../task-group";
import { assertCurrentSource, requireSource } from "../source-note";
import type { LinkedTaskGroup, TasksSnapshot } from "../types";

const { inboxMissing, projectMissing } = TASK_CREATE_COPY;

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
  { groups, sourcePath }: TasksSnapshot,
  { title, projectPath }: CreateTaskRequest,
): CreationTarget {
  const { vault } = app;
  const filename = taskFilename(title);
  const projects = groups.filter((group) => {
    const { notePath } = group;
    return !isTodayGroup(group) && notePath === projectPath;
  });
  const [project, otherProject] = projects;
  if (!project || otherProject) throw new TaskEditError(projectMissing);

  const { link: projectLink } = project;
  const parent = vaultParentPath(projectPath);
  if (!projectLink || !parent) throw new TaskEditError(projectMissing);
  const { file: projectFile } = resolveLink(app, sourcePath, projectLink);
  if (!projectFile || projectFile.path !== projectPath) throw new TaskEditError(projectMissing);

  const inboxPath = parent + VAULT_PATH_SEPARATOR + PROJECT_INBOX;
  const inbox = vault.getFolderByPath(inboxPath);
  if (!inbox) throw new TaskEditError(inboxMissing);

  const path = inboxPath + VAULT_PATH_SEPARATOR + filename;
  const source = requireSource(app, sourcePath);

  const assertCurrent = () => {
    assertCurrentSource(app, source, sourcePath);
    const { file } = resolveLink(app, sourcePath, projectLink);
    if (file !== projectFile || file.path !== projectPath) throw new TaskEditError(projectMissing);
    if (vault.getFolderByPath(inboxPath) !== inbox) throw new TaskEditError(inboxMissing);
  };

  return { filename, inbox, path, project, source, assertCurrent };
}
