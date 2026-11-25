import {
  getFrontMatterInfo,
  parseYaml,
  type App,
  type TAbstractFile,
  type TFile,
  type WorkspaceLeaf,
} from "obsidian";
import { object, regex, string } from "zod/mini";
import { VAULT_PATH_SEPARATOR, WORKSPACE_TAB } from "../../obsidian/constants";
import { resolveLink } from "../../obsidian/resolve-link";
import { TASKS_FORMAT } from "../current-tasks.constants";
import { parseCurrentTasks } from "../parse-current-tasks";
import type { CurrentTask } from "../types";
import {
  COMPLETION_COPY,
  TaskCompletionError,
  updateCompletionMark,
  type CompletionTarget,
} from "../task-completion";
import { isTodayGroup } from "../task-group";
import {
  DIAGNOSTIC_COPY,
  SOURCE_PATHS,
  TASK_ID_PATTERN,
  VAULT_EVENTS,
} from "./constants";
import type { LinkedTask, LinkedTaskGroup, TasksSnapshot } from "./types";

const taskProperties = object({ id: string().check(regex(TASK_ID_PATTERN)) });
const {
  missingProjectNote,
  missingTaskNote,
  invalidTaskId,
  unknownTaskProject,
  missingLinkedNote,
} = DIAGNOSTIC_COPY;
const { create, modify, remove, rename } = VAULT_EVENTS;
const { conflict, taskChanged, duplicateTask } = COMPLETION_COPY;

function taskIdFromMarkdown(markdown: string) {
  const { exists, frontmatter } = getFrontMatterInfo(markdown);
  if (!exists) return;
  try {
    const properties = taskProperties.safeParse(parseYaml(frontmatter));
    if (properties.success) return properties.data.id;
  } catch {
    //TODO: Некорректный YAML не содержит подтверждённого ID задачи.
  }
}

async function readTaskId({ vault }: App, file: TFile) {
  try {
    return taskIdFromMarkdown(await vault.cachedRead(file));
  } catch {
    //TODO: Недоступный файл или некорректные свойства отмечаются в модели просмотра.
  }
}

function findSource({ vault }: App) {
  for (const path of SOURCE_PATHS) {
    const source = vault.getFileByPath(path);
    if (source) return source;
  }
}

export async function readCurrentTasks(
  app: App,
): Promise<TasksSnapshot | undefined> {
  const { vault } = app;
  const source = findSource(app);
  if (!source) return;

  const { path: sourcePath } = source;
  const parent = sourcePath.slice(
    0,
    sourcePath.lastIndexOf(VAULT_PATH_SEPARATOR) + VAULT_PATH_SEPARATOR.length,
  );
  const sourceMarkdown = await vault.cachedRead(source);
  const document = parseCurrentTasks(sourceMarkdown);
  const { format, groups: parsedGroups, diagnostics } = document;

  function projectFolder(path: string): string | undefined {
    const relative = path.startsWith(parent) ? path.slice(parent.length) : "";
    const separator = relative.indexOf(VAULT_PATH_SEPARATOR);
    if (separator !== -1) return relative.slice(0, separator);
  }

  const projects = new Map<string, { title: string; path: string }>();
  const linkedGroups: LinkedTaskGroup[] = parsedGroups.map((group) => {
    const { link, title, line } = group;
    if (!link) return group;
    const { file } = resolveLink(app, sourcePath, link);
    if (file) {
      const { path } = file;
      projects.set(projectFolder(path) ?? title, { title, path });
      return { ...group, notePath: path };
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

    linked.id = await readTaskId(app, file);
    if (!linked.id) {
      diagnostics.push({ line, message: invalidTaskId });
    }
    if (today) {
      const folder = projectFolder(path);
      const project = folder && projects.get(folder);
      if (project) {
        const { title, path: projectPath } = project;
        linked.project = title;
        linked.projectPath = projectPath;
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
  task: CompletionTarget,
  completed: boolean,
) {
  const { vault } = app;
  const { sourcePath, sourceMarkdown, groups } = snapshot;
  const { id, notePath, link } = task;
  const source = findSource(app);
  if (!source || source.path !== sourcePath)
    throw new TaskCompletionError(conflict);

  const tasks = groups.flatMap((group) => group.tasks);
  if (!tasks.includes(task)) throw new TaskCompletionError(conflict);
  const nextMarkdown = updateCompletionMark(sourceMarkdown, task, completed);

  const filesByLink = new Map<string, TFile | null>();
  for (const { link: rowLink } of tasks) {
    if (!rowLink || filesByLink.has(rowLink)) continue;
    const { file } = resolveLink(app, sourcePath, rowLink);
    filesByLink.set(rowLink, file);
  }
  const selectedFile = filesByLink.get(link);
  if (!selectedFile || selectedFile.path !== notePath)
    throw new TaskCompletionError(taskChanged);

  const files = [...new Set(filesByLink.values())].filter(
    (file) => file !== null,
  );
  const versions = await Promise.all(
    files.map(async (file) => {
      const {
        path,
        stat: { mtime, size },
      } = file;
      const id = taskIdFromMarkdown(await vault.read(file));
      return { file, path, mtime, size, id };
    }),
  );
  const ids = new Map(versions.map(({ file, id }) => [file, id]));
  if (ids.get(selectedFile) !== id) throw new TaskCompletionError(taskChanged);

  const matchingRows = tasks.filter(({ link: rowLink }) => {
    if (!rowLink) return false;
    const file = filesByLink.get(rowLink);
    return file && (file === selectedFile || ids.get(file) === id);
  });
  if (matchingRows.length > 1) throw new TaskCompletionError(duplicateTask);

  const saved = await vault.process(source, (current) => {
    if (source.path !== sourcePath || findSource(app) !== source)
      throw new TaskCompletionError(conflict);
    for (const [rowLink, expectedFile] of filesByLink) {
      const { file } = resolveLink(app, sourcePath, rowLink);
      if (file !== expectedFile) throw new TaskCompletionError(taskChanged);
    }
    for (const { file, path, mtime, size } of versions) {
      const {
        path: currentPath,
        stat: { mtime: currentMtime, size: currentSize },
      } = file;
      const sameFile =
        currentPath === path && vault.getFileByPath(path) === file;
      if (!sameFile || currentMtime !== mtime || currentSize !== size)
        throw new TaskCompletionError(taskChanged);
    }
    if (current === nextMarkdown) return current;
    if (current !== sourceMarkdown) throw new TaskCompletionError(conflict);
    return nextMarkdown;
  });
  if (saved !== nextMarkdown) throw new TaskCompletionError(conflict);
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
  const leaf = openInNewTab ? app.workspace.getLeaf(WORKSPACE_TAB) : sourceLeaf;
  try {
    await leaf.openFile(file, {
      active: true,
      eState: subpath ? { subpath } : undefined,
    });
  } catch (error) {
    if (openInNewTab) leaf.detach();
    throw error;
  }
}
