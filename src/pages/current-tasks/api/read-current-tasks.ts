import type { App } from "obsidian";
import { resolveLink } from "../../../shared/api/obsidian";
import { TASKS_FORMAT } from "../model/current-tasks.constants";
import type { LinkedTask, LinkedTaskGroup, TasksSnapshot } from "../model/linked-tasks";
import { parseCurrentTasks } from "../model/parse-current-tasks";
import { projectFolder } from "../model/project-folder";
import { isTodayGroup } from "../model/task-group";
import type { CurrentTask } from "../model/types";
import { DIAGNOSTIC_COPY } from "./constants";
import { emojiForProject, readProjectEmojis } from "./project-emojis";
import { findSource } from "./source-note";
import { readCachedTaskId } from "./task-note-id";

const { missingProjectNote, missingTaskNote, invalidTaskId, unknownTaskProject } = DIAGNOSTIC_COPY;

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
    isToday: boolean,
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
    if (!linked.id) diagnostics.push({ line, message: invalidTaskId });
    if (isToday) {
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
    const isToday = isTodayGroup(group);
    return {
      ...group,
      tasks: await Promise.all(tasks.map((task) => linkTask(task, isToday))),
    };
  }

  const groups = await Promise.all(linkedGroups.map(linkGroupTasks));
  diagnostics.sort((first, second) => (first.line ?? 0) - (second.line ?? 0));
  return { ...document, sourcePath, sourceMarkdown, groups };
}
