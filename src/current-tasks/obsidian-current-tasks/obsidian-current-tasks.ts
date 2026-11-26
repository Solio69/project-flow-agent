import type { App, TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
import { VAULT_PATH_SEPARATOR, WORKSPACE_TAB } from "../../obsidian/constants";
import { resolveLink } from "../../obsidian/resolve-link";
import { TASKS_FORMAT } from "../current-tasks.constants";
import { parseCurrentTasks } from "../parse-current-tasks";
import type { CurrentTask } from "../types";
import { updateCompletionMark } from "../task-completion";
import { TASK_EDIT_COPY, TaskEditError, type EditableTask } from "../task-edit";
import { isTodayGroup } from "../task-group";
import { moveTaskRow, TASK_MOVE_COPY } from "../task-move";
import { reorderTaskRow } from "../task-reorder";
import {
  DIAGNOSTIC_COPY,
  SOURCE_PATHS,
  VAULT_EVENTS,
} from "./constants";
import { emojiForProject, readProjectEmojis } from "./project-emojis";
import { assertCurrentSource, findSource, requireSource } from "./source-note";
import { readCachedTaskId, readTaskId } from "./task-note-id";
import type { LinkedTask, LinkedTaskGroup, TasksSnapshot } from "./types";

const {
  missingProjectNote,
  missingTaskNote,
  invalidTaskId,
  unknownTaskProject,
  missingLinkedNote,
} = DIAGNOSTIC_COPY;
const { create, modify, remove, rename } = VAULT_EVENTS;
const { conflict, taskChanged, duplicateTask } = TASK_EDIT_COPY;
const { activeTaskRequired, projectSection, todaySection } = TASK_MOVE_COPY;

function projectFolder(path: string, sourcePath: string): string | undefined {
  const parent = sourcePath.slice(
    0,
    sourcePath.lastIndexOf(VAULT_PATH_SEPARATOR) + VAULT_PATH_SEPARATOR.length,
  );
  const relative = path.startsWith(parent) ? path.slice(parent.length) : "";
  const separator = relative.indexOf(VAULT_PATH_SEPARATOR);
  if (separator !== -1) return relative.slice(0, separator);
}

export async function readCurrentTasks(
  app: App,
): Promise<TasksSnapshot | undefined> {
  const { vault } = app;
  const source = findSource(app);
  if (!source) return;

  const { path: sourcePath } = source;
  const sourceMarkdown = await vault.cachedRead(source);
  const document = parseCurrentTasks(sourceMarkdown);
  const { format, groups: parsedGroups, diagnostics } = document;
  const projectEmojis = await readProjectEmojis(vault);

  const projects = new Map<string, { title: string; path: string; emoji?: string }>();
  const linkedGroups: LinkedTaskGroup[] = parsedGroups.map((group) => {
    const { link, title, line } = group;
    if (!link) return group;
    const { file } = resolveLink(app, sourcePath, link);
    if (file) {
      const { path } = file;
      const emoji = emojiForProject(projectEmojis, path);
      projects.set(projectFolder(path, sourcePath) ?? title, { title, path, emoji });
      return { ...group, notePath: path, projectEmoji: emoji };
    }
    diagnostics.push({ line, message: missingProjectNote(title) });
    projects.set(title, { title, path: link });
    return group;
  });

  async function linkTask(
    task: CurrentTask,
    today: boolean,
  ): Promise<LinkedTask> {
    const { link, line } = task;
    if (!link) return task;
    const { file } = resolveLink(app, sourcePath, link);
    if (!file) {
      diagnostics.push({ line, message: missingTaskNote(link) });
      return task;
    }
    const { path } = file;
    const linked: LinkedTask = { ...task, notePath: path };
    if (format === TASKS_FORMAT.legacy) return linked;

    linked.id = await readCachedTaskId(vault, file);
    if (!linked.id) {
      diagnostics.push({ line, message: invalidTaskId });
    }
    if (today) {
      const folder = projectFolder(path, sourcePath);
      const project = folder && projects.get(folder);
      if (project) {
        const { title, path: projectPath, emoji } = project;
        linked.project = title;
        linked.projectPath = projectPath;
        linked.projectEmoji = emoji;
      } else {
        diagnostics.push({ line, message: unknownTaskProject });
      }
    }
    return linked;
  }

  async function linkGroupTasks(group: LinkedTaskGroup) {
    const { tasks } = group;
    const today = isTodayGroup(group);
    return {
      ...group,
      tasks: await Promise.all(tasks.map((task) => linkTask(task, today))),
    };
  }

  const groups = await Promise.all(linkedGroups.map(linkGroupTasks));
  diagnostics.sort((first, second) => (first.line ?? 0) - (second.line ?? 0));
  return { ...document, sourcePath, sourceMarkdown, groups };
}

export async function setTaskCompletion(
  app: App,
  snapshot: TasksSnapshot,
  task: EditableTask,
  completed: boolean,
) {
  await writeTaskEdit(app, snapshot, task, (markdown) => updateCompletionMark(markdown, task, completed));
}

export async function reorderCurrentTask(app: App, snapshot: TasksSnapshot, task: EditableTask, destinationLine: number) {
  if (task.line === destinationLine) return;
  await writeTaskEdit(app, snapshot, task, (markdown) => reorderTaskRow(markdown, task, destinationLine));
}

function findProjectGroup(
  groups: readonly LinkedTaskGroup[],
  sourcePath: string,
  taskPath: string,
  pathOf: (group: LinkedTaskGroup) => string | undefined,
) {
  const folder = projectFolder(taskPath, sourcePath);
  if (!folder) throw new TaskEditError(projectSection);

  const matches = groups.filter((group) => {
    const path = pathOf(group);
    return path && projectFolder(path, sourcePath) === folder;
  });
  const [project] = matches;
  if (matches.length !== 1) throw new TaskEditError(projectSection);
  return project;
}

function resolveMoveProject(app: App, { sourcePath, groups }: TasksSnapshot, taskPath: string, project: LinkedTaskGroup): TFile {
  const files = new Map<LinkedTaskGroup, TFile>();
  for (const group of groups) {
    const { link } = group;
    if (!link) continue;
    const { file } = resolveLink(app, sourcePath, link);
    if (file) files.set(group, file);
  }

  const currentProject = findProjectGroup(groups, sourcePath, taskPath, (group) => files.get(group)?.path);
  const { notePath } = project;
  const file = files.get(project);
  if (currentProject !== project || !file || file.path !== notePath) throw new TaskEditError(projectSection);
  return file;
}

export async function moveCurrentTask(app: App, snapshot: TasksSnapshot, task: EditableTask) {
  const { groups, sourcePath } = snapshot;
  const { completed, notePath } = task;
  if (completed) throw new TaskEditError(activeTaskRequired);

  const origin = groups.find(({ tasks }) => tasks.includes(task));
  if (!origin) throw new TaskEditError(conflict);
  const todayGroups = groups.filter(isTodayGroup);
  if (todayGroups.length !== 1) throw new TaskEditError(todaySection);
  const [today] = todayGroups;

  const project = findProjectGroup(groups, sourcePath, notePath, ({ notePath: path }) => path);
  if (origin !== today && origin !== project) throw new TaskEditError(projectSection);

  const destination = origin === today ? project : today;
  const { line: headingLine, tasks: destinationTasks } = destination;
  let afterLine = headingLine;
  if (destination === today) {
    const { notePath: targetProjectPath } = project;
    let lastActive: number | undefined;
    let lastFromProject: number | undefined;
    for (const { completed: done, line, projectPath } of destinationTasks) {
      if (done) continue;
      lastActive = line;
      if (projectPath === targetProjectPath) lastFromProject = line;
    }
    afterLine = lastFromProject ?? lastActive ?? headingLine;
  }

  const edit = (markdown: string) => moveTaskRow(markdown, task, { headingLine, afterLine });
  await writeTaskEdit(app, snapshot, task, edit, project);
}

async function writeTaskEdit(
  app: App,
  snapshot: TasksSnapshot,
  task: EditableTask,
  edit: (markdown: string) => string,
  project?: LinkedTaskGroup,
) {
  const { vault } = app;
  const { sourcePath, sourceMarkdown, groups } = snapshot;
  const { id, notePath, link } = task;
  const source = requireSource(app, sourcePath);

  const tasks = groups.flatMap((group) => group.tasks);
  if (!tasks.includes(task)) throw new TaskEditError(conflict);
  const nextMarkdown = edit(sourceMarkdown);
  const projectFile = project ? resolveMoveProject(app, snapshot, notePath, project) : undefined;

  const filesByLink = new Map<string, TFile | null>();
  for (const { link: rowLink, notePath: rowPath } of tasks) {
    if (!rowLink) continue;
    const file = filesByLink.has(rowLink)
      ? filesByLink.get(rowLink) ?? null
      : resolveLink(app, sourcePath, rowLink).file;
    if (project && file?.path !== rowPath) throw new TaskEditError(taskChanged);
    filesByLink.set(rowLink, file);
  }
  const selectedFile = filesByLink.get(link);
  if (!selectedFile || selectedFile.path !== notePath)
    throw new TaskEditError(taskChanged);

  const files = [...new Set(filesByLink.values())].filter(
    (file) => file !== null,
  );
  const versions = await Promise.all(
    files.map(async (file) => {
      const {
        path,
        stat: { mtime, size },
      } = file;
      const id = await readTaskId(vault, file);
      return { file, path, mtime, size, id };
    }),
  );
  const ids = new Map(versions.map(({ file, id }) => [file, id]));
  if (ids.get(selectedFile) !== id) throw new TaskEditError(taskChanged);

  const matchingRows = tasks.filter(({ link: rowLink }) => {
    if (!rowLink) return false;
    const file = filesByLink.get(rowLink);
    return file && (file === selectedFile || ids.get(file) === id);
  });
  if (matchingRows.length > 1) throw new TaskEditError(duplicateTask);

  const saved = await vault.process(source, (current) => {
    assertCurrentSource(app, source, sourcePath);
    if (project && resolveMoveProject(app, snapshot, notePath, project) !== projectFile)
      throw new TaskEditError(projectSection);
    for (const [rowLink, expectedFile] of filesByLink) {
      const { file } = resolveLink(app, sourcePath, rowLink);
      if (file !== expectedFile) throw new TaskEditError(taskChanged);
    }
    for (const { file, path, mtime, size } of versions) {
      const {
        path: currentPath,
        stat: { mtime: currentMtime, size: currentSize },
      } = file;
      const sameFile =
        currentPath === path && vault.getFileByPath(path) === file;
      if (!sameFile || currentMtime !== mtime || currentSize !== size)
        throw new TaskEditError(taskChanged);
    }
    if (current === nextMarkdown) return current;
    if (current !== sourceMarkdown) throw new TaskEditError(conflict);
    return nextMarkdown;
  });
  if (saved !== nextMarkdown) throw new TaskEditError(conflict);
}

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
