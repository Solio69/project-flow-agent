const taskId = "tsk_example";
const draftFolder = "Мастерская/project inbox";
const draftTitle = "Черновик";
const renamedDraftTitle = "Правки к черновику";
const draftLink = `${draftFolder}/${draftTitle}`;
const renamedDraftLink = `${draftFolder}/${renamedDraftTitle}`;

export const taskNoteMarkdown = `---\nid: ${taskId}\n---\n`;
export const archiveTaskCase = {
  folder: "Мастерская/archive",
  taskPath: "Мастерская/archive/Черновик.md",
  occupied: /уже есть файл/,
  missing: /не найдена папка archive/,
  partial: /файл уже в архиве/i,
};
export const transferTaskCase = {
  projectPath: "Блог/Блог.md",
  inboxPath: "Блог/project inbox",
  taskPath: "Блог/project inbox/Черновик.md",
  outsidePeriod: "Вне плана/Вне плана.md",
  occupied: /уже есть файл/,
  partial: /файл уже перенесён/i,
};
export const renameTaskCase = {
  oldPath: `${draftLink}.md`,
  oldLink: draftLink,
  oldTitle: draftTitle,
  newPath: `${renamedDraftLink}.md`,
  newLink: renamedDraftLink,
  newTitle: renamedDraftTitle,
  caseOnlyTitle: "черновик",
  invalidTitle: "Черновик: правки",
  body: `${taskNoteMarkdown}\nРабочий текст задачи\n`,
  action: /<button(?=[^>]*aria-label="Действия: Черновик")(?![^>]*disabled="")[^>]*>/,
  invalid: /недопустим/,
  occupied: /уже есть файл/,
  unsupportedCase: /только регистра/,
  changed: /изменилась/,
  failed: /не удалось переименовать/i,
  partial: /файл уже переименован/i,
};
export const differentTaskNoteMarkdown = "---\nid: tsk_replaced\n---\n";
export const blogTaskMarkdown = "---\nid: tsk_blog_example\n---\n";

export const completionReviewNotes = {
  second: { path: "Мастерская/project inbox/Вторая задача.md", link: "Вторая задача" },
  replacement: { path: "Мастерская/Черновик.md" },
  blog: { path: "Блог/Блог.md", link: "Блог/Блог" },
  blogTask: { path: "Блог/Черновик блога.md", link: "Блог/Черновик блога" },
};

export const aliasedBlogExpected = {
  panel: /data-project-tone="blog"[^>]+aria-label="Контент"/,
  todayPrefix: /class="pfa-project-emoji"[^>]*>📝<\/span><strong class="pfa-task-project">Контент:/,
};

export const iconizeFixture = {
  defaultIcons: { "Блог/Блог.md": "📝" },
  projectIcons: { "Мастерская/Мастерская.md": "💼", "Мастерская": "👩‍🎓" },
  emojiMatches: /class="pfa-project-emoji"[^>]*>💼<\/span>/g,
  fallbackMatches: /class="pfa-project-icon"/g,
  rootNote: { path: "Мастерская.md", unrelated: { "Мастерская.m": "💼" }, emoji: /💼/ },
};

export const completionFeedback = {
  checked: /<input(?=[^>]*type="checkbox")(?=[^>]*checked="")(?=[^>]*aria-label="Выполнено: Черновик")/,
  disabled: /<input(?=[^>]*type="checkbox")(?=[^>]*disabled="")/,
  ambiguous: /Неоднозначная запись/,
  interleaved: /текст между задачами/i,
  conflict: /заметка изменилась/i,
  duplicate: /повторяется/i,
  taskChanged: /Файл или ID задачи изменился/i,
};

export const sourceNotePaths = {
  legacy: "Текущие действия.md",
  renamed: "Текущие задачи.md",
};

export const moveFeedback = {
  title: "Вторая задача",
  toToday: /<button(?=[^>]*aria-label="Добавить в «Сегодня»: Вторая задача")(?![^>]*disabled="")[^>]*>/,
  toProject: /<button(?=[^>]*aria-label="Вернуть в список проекта: Вторая задача")(?![^>]*disabled="")[^>]*>/,
  disabledMove: /<button(?=[^>]*aria-label="Добавить в «Сегодня»: Вторая задача")(?=[^>]*disabled="")[^>]*>/,
  annotation: /текст.*строк/i,
  todayHeading: /один раздел «Сегодня»/i,
  projectSection: /определить список проекта/i,
  duplicatePeriod: /Свойство периода повторяется/,
};

export const moveProjectConflict = {
  taskTitle: "Черновик блога",
  renamedProjectPath: "Блог/Мастерская.md",
};

const reorderTitles = {
  first: "Черновик",
  second: moveFeedback.title,
  last: "Другая активная задача",
  completed: "Готовая задача",
  otherGroup: "Черновик блога",
};
export const reorderTasks = {
  ...reorderTitles,
  expectedOrder: [reorderTitles.second, reorderTitles.completed, reorderTitles.last, reorderTitles.first],
};

export const tasksDesign = {
  period: /23–29 ноября/,
  emptyToday: /На сегодня пока нет задач/,
  todayPanel: 'data-section="today"',
  projectPanel: 'data-section="project"',
  disclosure: /aria-expanded="true"/,
  history: /<button(?=[^>]*disabled="")(?=[^>]*aria-label="Перенести выполненные в историю")[^>]*>/,
  showCompleted: /<button[^>]*aria-label="Скрыть выполненные"/,
  hideCompleted: /<button[^>]*aria-label="Показать выполненные"/,
  expandProjects: /<button[^>]*aria-label="Развернуть все проекты"/,
  collapseProjects: /<button[^>]*aria-label="Свернуть все проекты"/,
};

export const completedVisibilityCases = [
  { visible: true, next: false, label: "Скрыть выполненные" },
  { visible: false, next: true, label: "Показать выполненные" },
];

export const taskCompletionOrder = ["Черновик", "Вторая задача"];
export const visibleTaskOrderBeforeWrite = ["Черновик", "Вторая задача", "Другая активная задача", "Готовая задача"];
export const activeTaskOrder = visibleTaskOrderBeforeWrite.slice(0, -1);
export const existingPluginSettings = { sampleSetting: "существующее значение", showCompleted: false };
export const visiblePluginSettings = { ...existingPluginSettings, showCompleted: true };
const firstProjectKeys = ["Мастерская/Мастерская.md"];
const secondProjectKeys = [transferTaskCase.projectPath];
const bothProjectKeys = [...firstProjectKeys, ...secondProjectKeys];
export const collapsedProjectSettings = {
  both: bothProjectKeys,
  first: firstProjectKeys,
  second: secondProjectKeys,
  afterSave: { ...visiblePluginSettings, collapsedProjects: bothProjectKeys },
};
export const repeatedProjectPanels = {
  settings: { ...existingPluginSettings, collapsedProjects: [transferTaskCase.projectPath] },
  firstCollapsed: /aria-label="Развернуть список проекта «Контент»"[^>]*aria-expanded="false"/,
  secondExpanded: /aria-label="Свернуть список проекта «Редакция»"[^>]*aria-expanded="true"/,
};
export const taskCheckboxLabel = /<input\s[^>]*aria-label="Выполнено: ([^"]+)"/g;
export const taskGripWithIcon = /class="pfa-task-grip"[^>]*><span/g;

export const currentTasksExpected = {
  viewTitle: "Текущие задачи",
  viewHeading: /<h2\b[^>]*>(?:<a [^>]+>)?Текущие задачи(?:<\/a>)?<\/h2>/,
  linkedSourceHeading: /<h2\b[^>]*><a [^>]*>Текущие задачи<\/a><\/h2>/,
  legacyTask: /Проверить Черновик/,
  legacyProject: /<h3[^>]*><a [^>]+>Мастерская<\/a><\/h3>/,
  todayGroup: /Сегодня/,
  missingNote: /Пропавшая заметка/,
  obsoleteGroup: /Старое чтение/,
  taskId,
  projectAlias: "Творчество",
  projectLink: /<h3[^>]*><a [^>]+>Творчество<\/a><\/h3>/,
  missingProject: /<h3[^>]*>Пропавший проект<\/h3>/,
  missingSource: /не найдена в этом хранилище/,
  noteOpenFailed: "Не удалось открыть связанную заметку.",
};

export const createTaskCase = {
  title: "Сверить описание",
  invalidTitle: "Проверить: описание",
  duplicateTitle: "Черновик",
  projectPath: "Мастерская/Мастерская.md",
  inboxPath: "Мастерская/project inbox",
  notePath: "Мастерская/project inbox/Сверить описание.md",
  row: "- [ ] [[Мастерская/project inbox/Сверить описание.md]]",
  danglingLink: "- [ ] [[Мастерская/project inbox/Сверить описание]]",
  danglingHeadingLink: "- [ ] [[Мастерская/project inbox/Сверить описание#Описание]]",
  redirectedProjectPath: "Архив/Мастерская.md",
  note: /^---\nid: (tsk_[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15})\n---\n$/,
  action: /<button(?=[^>]*aria-label="Новая задача: Мастерская")(?![^>]*disabled="")[^>]*>/,
};

export const projectLinkCase = {
  note: { title: "Мастерская", link: "Мастерская/Мастерская", notePath: "Мастерская/Мастерская.md" },
  middleButton: 1,
  rightButton: 2,
};

const buildScript = "esbuild.config.mjs";
const manifestFile = "manifest.json";

export const notePathCopy = {
  root: "D:\\Тестовое хранилище\\Проекты",
  absolute: "D:\\Тестовое хранилище\\Проекты\\Мастерская\\project inbox\\Черновик.md",
  attachment: "Мастерская/project inbox/Файл.pdf",
  copied: /скопирован/i,
  inaccessible: /изменился или недоступен/i,
  unsupported: /Markdown-заметке/u,
};

export const watchFixture = {
  buildScript,
  scriptFiles: ["src", buildScript, "esbuild.constants.mjs", "tsconfig.json", manifestFile],
  environmentFile: ".env.local",
  environmentVariable: "PFA_OBSIDIAN_VAULT",
  explicitWatchOption: "--watch",
  configuredWatchOption: "--watch-obsidian",
  obsidianDirectory: ".obsidian",
  expectedConfigDirectory: /\.obsidian/,
  pluginsDirectory: "plugins",
  pluginId: "project-flow-agent",
  markerFile: ".hotreload",
  scriptFile: "main.js",
  manifestFile,
  styleFile: "styles.css",
  expectedViewType: /project-flow-agent-current-actions/,
  expectedThemeVariable: /--text-muted/,
  originalHeadingContent: "<NoteLink note={sourceNote} onOpenNote={onOpenSource} />",
  probe: "pfa-watch-probe",
  componentPath: ["src", "pages", "current-tasks", "ui", "CurrentTasks", "CurrentTasks.tsx"],
};
