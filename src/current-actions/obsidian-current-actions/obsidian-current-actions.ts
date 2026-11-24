import {
  getFrontMatterInfo,
  parseYaml,
  type App,
  type TAbstractFile,
  type TFile,
  type WorkspaceLeaf,
} from "obsidian";
import { object, regex, string } from "zod/mini";
import { WORKSPACE_TAB } from "../../obsidian/constants";
import { resolveLink } from "../../obsidian/resolve-link";
import { ACTION_GROUP_KIND, ACTIONS_FORMAT } from "../current-actions.constants";
import {
  parseCurrentActions,
  type CurrentAction,
  type CurrentActionGroup,
  type CurrentActionsDocument,
} from "../parse-current-actions";
import { DIAGNOSTIC_COPY, SOURCE_PATHS, TASK_ID_PATTERN, VAULT_EVENTS } from "./constants";

const taskProperties = object({ id: string().check(regex(TASK_ID_PATTERN)) });
const { missingProjectNote, missingTaskNote, invalidTaskId, unknownTaskProject, missingLinkedNote } = DIAGNOSTIC_COPY;
const { create, modify, remove, rename } = VAULT_EVENTS;

export type LinkedAction = CurrentAction & { notePath?: string; id?: string; project?: string };

export type ActionsSnapshot = Omit<CurrentActionsDocument, "groups"> & {
  sourcePath: string;
  groups: Array<Omit<CurrentActionGroup, "tasks"> & { notePath?: string; tasks: LinkedAction[] }>;
};

async function readTaskId({ vault }: App, file: TFile) {
  try {
    const { exists, frontmatter } = getFrontMatterInfo(await vault.cachedRead(file));
    if (!exists) return;
    const properties = taskProperties.safeParse(parseYaml(frontmatter));
    if (properties.success) return properties.data.id;
  } catch {
    // Недоступный файл или некорректные свойства отмечаются в модели просмотра.
  }
}

export async function readCurrentActions(app: App): Promise<ActionsSnapshot | undefined> {
  const { vault } = app;
  let source: TFile | null = null;
  for (const path of SOURCE_PATHS) {
    source = vault.getFileByPath(path);
    if (source) break;
  }
  if (!source) return;

  const { path: sourcePath } = source;
  const parent = sourcePath.slice(0, sourcePath.lastIndexOf("/") + 1);
  const document = parseCurrentActions(await vault.cachedRead(source));
  const { format, groups: parsedGroups, diagnostics } = document;

  function projectFolder(path: string): string | undefined {
    const relative = path.startsWith(parent) ? path.slice(parent.length) : "";
    if (relative.includes("/")) return relative.split("/", 1)[0];
  }

  const projects = new Map<string, string>();
  const linkedGroups: ActionsSnapshot["groups"] = parsedGroups.map((group) => {
    const { link, title, line } = group;
    if (!link) return group;
    const { file } = resolveLink(app, sourcePath, link);
    if (file) {
      projects.set(projectFolder(file.path) ?? title, title);
      return { ...group, notePath: file.path };
    }
    diagnostics.push({ line, message: missingProjectNote(title) });
    projects.set(title, title);
    return group;
  });

  async function linkTask(task: CurrentAction, { kind }: CurrentActionGroup): Promise<LinkedAction> {
    const { link, line } = task;
    if (!link) return task;
    const { file } = resolveLink(app, sourcePath, link);
    if (!file) {
      diagnostics.push({ line, message: missingTaskNote(link) });
      return task;
    }
    const { path } = file;
    const linked: LinkedAction = { ...task, notePath: path };
    if (format === ACTIONS_FORMAT.legacy) return linked;

    linked.id = await readTaskId(app, file);
    if (!linked.id) {
      diagnostics.push({ line, message: invalidTaskId });
    }
    if (kind === ACTION_GROUP_KIND.today) {
      const folder = projectFolder(path);
      const title = folder && projects.get(folder);
      if (title) {
        linked.project = title;
      } else {
        diagnostics.push({ line, message: unknownTaskProject });
      }
    }
    return linked;
  }

  const groups = await Promise.all(linkedGroups.map(async (group) => ({
    ...group,
    tasks: await Promise.all(group.tasks.map((task) => linkTask(task, group))),
  })));
  diagnostics.sort((first, second) => (first.line ?? 0) - (second.line ?? 0));
  return { ...document, sourcePath, groups };
}

export function watchCurrentActions(
  app: App,
  isRelated: (path: string) => boolean,
  refresh: () => void,
): () => void {
  const { vault } = app;
  const matches = (path: string) => SOURCE_PATHS.includes(path) || isRelated(path);
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
    await leaf.openFile(file, { active: true, eState: subpath ? { subpath } : undefined });
  } catch (error) {
    if (openInNewTab) leaf.detach();
    throw error;
  }
}
