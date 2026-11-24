import { CURRENT_ACTIONS_FILENAME } from "./current-actions.constants";

export const ERROR_COPY = {
  sourceMissing: "Заметка «" + CURRENT_ACTIONS_FILENAME + "» не найдена в этом хранилище.",
  sourceUnreadable: "Не удалось прочитать «" + CURRENT_ACTIONS_FILENAME + "».",
  noteOpenFailed: "Не удалось открыть связанную заметку.",
  readLog: "Project Flow Agent: чтение текущих действий",
  openLog: "Project Flow Agent: открытие связанной заметки",
};
