export const TASK_TRANSFER_ICON = "folder-input";
export const TASK_TRANSFER_COPY = {
  action: "Перенести в другой проект",
  title: "Перенести задачу",
  destination: "Куда перенести",
  origin: (project: string) => `Из проекта «${project}»`,
  submit: "Перенести",
  saving: "Переношу…",
  sameProject: "Задача уже принадлежит этому проекту.",
  failed: "Не удалось перенести задачу. Список обновится, затем повторите действие.",
  partial: (path: string) => `Файл уже перенесён в «${path}». Можно повторить обновление списка.`,
} as const;
