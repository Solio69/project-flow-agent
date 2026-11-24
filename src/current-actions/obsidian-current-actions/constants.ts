import { CURRENT_ACTIONS_FILENAME } from "../current-actions.constants";

export const SOURCE_PATHS = [CURRENT_ACTIONS_FILENAME, "Проекты/" + CURRENT_ACTIONS_FILENAME];
export const TASK_ID_PATTERN = /^tsk_\S+$/;
export const VAULT_EVENTS = { create: "create", modify: "modify", remove: "delete", rename: "rename" } as const;
export const DIAGNOSTIC_COPY = {
  missingProjectNote: (title: string) => "Не найдена заметка проекта «" + title + "».",
  missingTaskNote: (link: string) => "Не найдена заметка «" + link + "».",
  invalidTaskId: "Не удалось прочитать ID задачи.",
  unknownTaskProject: "Не удалось определить проект задачи.",
  missingLinkedNote: "Связанная заметка не найдена.",
};
