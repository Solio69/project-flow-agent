export const TASK_RENAME_TITLE = "Переименовать задачу";
export const TASK_RENAME_ICON = "pencil";

export const TASK_RENAME_COPY = {
  action: "Переименовать",
  save: "Сохранить",
  caseOnly: "Изменение только регистра пока недоступно. Введите название, которое отличается не только регистром.",
  failed: "Не удалось переименовать задачу. Проверьте файл и повторите попытку.",
  linksIncomplete: (path: string) => `Файл уже переименован в «${path}». Обновление ссылок прервалось. Проверьте ссылки в Obsidian.`,
} as const;
