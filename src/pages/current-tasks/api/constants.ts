import { CURRENT_TASKS_FILENAME, TASK_ID_PREFIX } from "../model/current-tasks.constants";

//TODO: Старое имя общей заметки поддерживается до переименования во фреймворке.
const LEGACY_SOURCE_FILENAME = "Текущие действия.md";
const VAULT_PROJECTS_FOLDER = "Проекты/";
export const SOURCE_PATHS = [CURRENT_TASKS_FILENAME, LEGACY_SOURCE_FILENAME]
  .flatMap((filename) => [filename, VAULT_PROJECTS_FOLDER + filename]);
export const TASK_ID_PATTERN = new RegExp(`^${TASK_ID_PREFIX}\\S+$`, "u");
export const VAULT_EVENTS = { create: "create", modify: "modify", remove: "delete", rename: "rename" } as const;
export const DIAGNOSTIC_COPY = {
  missingProjectNote: (title: string) => "Не найдена заметка проекта «" + title + "».",
  missingTaskNote: (link: string) => "Не найдена заметка «" + link + "».",
  invalidTaskId: "Не удалось прочитать ID задачи.",
  unknownTaskProject: "Не удалось определить проект задачи.",
  missingLinkedNote: "Связанная заметка не найдена.",
};
