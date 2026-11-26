import { getFrontMatterInfo, parseYaml, type TFile, type Vault } from "obsidian";
import { object, regex, string } from "zod/mini";
import { TASK_ID_FIELD } from "../current-tasks.constants";
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

export async function readCachedTaskId(vault: Vault, file: TFile) {
  try {
    return taskIdFromMarkdown(await vault.cachedRead(file));
  } catch {
    //TODO: Недоступный файл или некорректные свойства отмечаются в модели просмотра.
  }
}
