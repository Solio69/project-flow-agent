export const PROJECT_ARCHIVE = "archive";
export const TASK_ARCHIVE_ICON = "trash-2";

export const TASK_ARCHIVE_COPY = {
  action: "Удалить задачу",
  hint: "Файл переместится в архив",
  title: "Удалить задачу?",
  detail: (title: string) => `Файл «${title}» переместится в архив проекта.`,
  submit: "В архив",
  saving: "Архивируем…",
  updating: "Обновляем список…",
  archiveMissing: "В проекте не найдена папка archive.",
  failed: "Не удалось перенести задачу в архив. Список обновится.",
  partial: (path: string) => `Файл уже в архиве: «${path}». Повторите обновление списка.`,
} as const;
