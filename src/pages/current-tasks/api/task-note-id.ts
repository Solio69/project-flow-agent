import { getFrontMatterInfo, parseYaml, type TFile, type Vault } from "obsidian";
import { object, regex, string } from "zod/mini";
import { TASK_ID_FIELD } from "../model/current-tasks.constants";
import { TaskEditError } from "../model/task-edit";
import { TASK_ID_PATTERN } from "./constants";

const taskProperties = object({ [TASK_ID_FIELD]: string().check(regex(TASK_ID_PATTERN)) });

function taskIdFromMarkdown(markdown: string) {
  const { exists, frontmatter } = getFrontMatterInfo(markdown);
  if (!exists) return;
  try {
    const properties = taskProperties.safeParse(parseYaml(frontmatter));
    if (properties.success) return properties.data[TASK_ID_FIELD];
  } catch {
    //TODO: Некорректный YAML не содержит подтверждённого ID задачи.
  }
}

export async function readTaskId(vault: Vault, file: TFile) {
  return taskIdFromMarkdown(await vault.read(file));
}

export async function verifyTaskNote(vault: Vault, path: string, id: string, message: string) {
  const file = vault.getFileByPath(path);
  if (!file) throw new TaskEditError(message);
  const { stat: { mtime, size } } = file;

  const assertUnchanged = () => {
    const { path: currentPath, stat: { mtime: currentMtime, size: currentSize } } = file;
    const isSameFile = currentPath === path && vault.getFileByPath(path) === file;
    const isSameVersion = currentMtime === mtime && currentSize === size;
    if (!isSameFile || !isSameVersion) throw new TaskEditError(message);
  };

  if (await readTaskId(vault, file) !== id) throw new TaskEditError(message);
  assertUnchanged();
  return { file, assertUnchanged };
}

export async function readCachedTaskId(vault: Vault, file: TFile) {
  try {
    return taskIdFromMarkdown(await vault.cachedRead(file));
  } catch {
    //TODO: Недоступный файл или некорректные свойства отмечаются в модели просмотра.
  }
}
