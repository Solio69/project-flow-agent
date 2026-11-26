import type { App, TFile } from "obsidian";
import { resolveLink } from "../../../shared/api/obsidian";
import type { LinkedTaskGroup, TasksSnapshot } from "../model/linked-tasks";
import { projectFolder } from "../model/project-folder";
import { updateCompletionMark } from "../model/task-completion";
import { TASK_EDIT_COPY, TaskEditError, type EditableTask } from "../model/task-edit";
import { isTodayGroup } from "../model/task-group";
import { moveTaskRow, TASK_MOVE_COPY } from "../model/task-move";
import { reorderTaskRow } from "../model/task-reorder";
import { assertCurrentSource, requireSource } from "./source-note";
import { readTaskId } from "./task-note-id";

const { conflict, taskChanged, duplicateTask } = TASK_EDIT_COPY;
const { activeTaskRequired, projectSection, todaySection } = TASK_MOVE_COPY;

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
