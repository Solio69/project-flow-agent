import { UNCHECKED_MARK, WIKI_LINK_DELIMITERS } from "../parse-current-tasks.constants";

const [wikiLinkStart, wikiLinkEnd] = WIKI_LINK_DELIMITERS;

export const TASK_CREATE_COPY = {
  emptyTitle: "Введите название задачи.",
  invalidTitle: "Введите название без недопустимых символов, пробелов по краям и расширения .md.",
  occupiedPath: "В этой папке уже есть файл или папка с таким названием.",
  projectMissing: "Не удалось однозначно определить карточку проекта.",
  inboxMissing: "В выбранном проекте не найдена папка project inbox.",
  retryChanged: "Файл, созданный ранее, или его ID изменился. Проверьте файл перед повтором.",
  failed: "Не удалось создать задачу.",
  busy: "Дождитесь окончания предыдущей записи и повторите действие.",
  partial: (path: string, cause: string) => `Файл «${path}» создан. Добавление в список можно повторить. ${cause}`,
} as const;

export const PROJECT_INBOX = "project inbox";
export const TASK_CREATE_TITLE = "Новая задача";
export const TASK_TITLE_LIMIT = 200;
export const FILENAME_DOT = ".";
export const INVALID_TITLE_CHARACTERS = /[<>:"/\\|?*#[\]^\x00-\x1f]|%%/u;
export const RESERVED_FILENAME = /^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/iu;
export const UUID_SEPARATOR = "-";
export const NEW_TASK_ROW_PREFIX = `- [${UNCHECKED_MARK}] ${wikiLinkStart}`;
export const NEW_TASK_ROW_SUFFIX = wikiLinkEnd;
export const YAML_PROPERTY_SEPARATOR = ": ";
export const DEFAULT_LINE_ENDING = "\n";
