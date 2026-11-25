import { CURRENT_TASKS_FILENAME } from "./current-tasks.constants";

export const ERROR_COPY = {
  sourceMissing: "Заметка «" + CURRENT_TASKS_FILENAME + "» не найдена в этом хранилище.",
  sourceUnreadable: "Не удалось прочитать «" + CURRENT_TASKS_FILENAME + "».",
  noteOpenFailed: "Не удалось открыть связанную заметку.",
  readLog: "Project Flow Agent: чтение текущих задач",
  openLog: "Project Flow Agent: открытие связанной заметки",
  completionLog: "Project Flow Agent: запись отметки выполнения",
  completionFailed: "Не удалось изменить отметку выполнения. Список обновится.",
};
