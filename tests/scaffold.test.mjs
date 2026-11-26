import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { createCurrentTasksFixture } from "./fixtures/current-tasks.mjs";
import {
  aliasedBlogTasks, ambiguousCompletion, ambiguousMoveCases, completedBeforeAnnotation, completedMove, completionAcrossAnnotation, completionAlongsideAnnotation,
  completionBeforeBrokenHeading, completionCases, completionOrderCases, completionWithOneActiveTask,
  completionWithShortLink, completionWithTwoTasks, duplicatedCompletion, externalListEdit,
  moveAfterComment, moveCases, moveWithDuplicatePeriod, obsoleteTasks, propertyTasks,
} from "./fixtures/current-tasks-markdown.mjs";
import {
  aliasedBlogExpected, completedVisibilityCases, completionFeedback, currentTasksExpected, differentTaskNoteMarkdown,
  moveFeedback, moveProjectConflict, projectLinkCase, sourceNotePaths, taskCheckboxLabel, taskCompletionOrder, taskGripWithIcon, taskNoteMarkdown, tasksDesign,
  visibleTaskOrderBeforeWrite, watchFixture,
} from "./fixtures/scaffold-data.mjs";

const require = createRequire(import.meta.url);
const project = fileURLToPath(new URL("../", import.meta.url));
const {
  buildScript, scriptFiles, environmentFile, environmentVariable, configuredWatchOption,
  explicitWatchOption, obsidianDirectory, expectedConfigDirectory, pluginsDirectory,
  pluginId, markerFile, scriptFile, manifestFile, styleFile, expectedViewType,
  expectedThemeVariable, originalHeading, probe, componentPath,
} = watchFixture;
const {
  viewTitle, viewHeading, legacyTask, legacyProject, todayGroup, missingNote, obsoleteGroup,
  taskId, projectAlias, projectLink, missingProject, missingSource, noteOpenFailed,
} = currentTasksExpected;
const { note: projectLinkNote, middleButton, rightButton } = projectLinkCase;
const config = join(project, buildScript);

async function removeFixture(directory, parent = tmpdir()) {
  const resolved = await realpath(directory);
  assert.equal(dirname(resolved), await realpath(parent));
  await rm(resolved, { recursive: true, force: true });
}

async function waitForBuild(child, ready) {
  const deadline = Date.now() + 10000;
  while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) {
    if (await ready()) return true;
    await setTimeout(50);
  }
  return false;
}

test("кнопка открывает, повторно активирует и позволяет переоткрыть вкладку", async () => {
  const fixture = await createCurrentTasksFixture();
  const { controls, views, leaves, mounts, notices, ribbonClick } = fixture;
  assert.equal(views.size, 1, "плагин регистрирует тип вкладки");
  assert.equal(typeof ribbonClick, "function", "плагин регистрирует кнопку");

  await Promise.all([ribbonClick(), ribbonClick()]);
  assert.equal(leaves.length, 1, "быстрые повторные нажатия открывают одну вкладку");
  assert.equal(fixture.activeLeaf, leaves[0]);
  assert.equal(fixture.activeLeaf.view.getDisplayText(), viewTitle);
  assert.match(mounts[0].markup, viewHeading);
  assert.match(mounts[0].markup, legacyTask);
  assert.match(mounts[0].markup, legacyProject);

  await ribbonClick();
  assert.equal(leaves.length, 1, "открытая вкладка используется повторно");

  await fixture.activeLeaf.view.onClose();
  leaves.pop();
  assert.equal(mounts[0].closed, true);
  await ribbonClick();
  assert.equal(mounts.length, 2);

  await fixture.activeLeaf.view.onClose();
  leaves.pop();
  controls.failNextOpen = true;
  await ribbonClick();
  assert.equal(notices.length, 1);
  assert.equal(leaves.length, 0, "после ошибки не остаётся пустая вкладка");
  await ribbonClick();
  assert.equal(mounts.length, 3, "после ошибки можно открыть вкладку повторно");
});

test("макет показывает период, пустой блок «Сегодня» и доступные действия просмотра", async () => {
  const fixture = await createCurrentTasksFixture();
  const { mounts, ribbonClick } = fixture;
  const { period, emptyToday, todayPanel, projectPanel, disclosure, history } = tasksDesign;
  await ribbonClick();
  const { markup } = mounts.at(-1);
  assert.match(markup, period);
  assert.match(markup, emptyToday);
  assert.ok(markup.includes(todayPanel) && markup.includes(projectPanel));
  assert.ok(markup.indexOf(todayPanel) < markup.indexOf(projectPanel));
  assert.match(markup, disclosure);
  assert.match(markup, history);
  await fixture.activeLeaf.view.onClose();
});

test("список читает прежнюю заметку и переключается на новое имя при её появлении", async () => {
  const fixture = await createCurrentTasksFixture();
  const { controls, mounts, ribbonClick, emitModify, renamedSource } = fixture;
  await ribbonClick();
  assert.equal(mounts.at(-1).element.props.state.document.sourcePath, sourceNotePaths.legacy);

  controls.renamedSourceAvailable = true;
  await emitModify(renamedSource);
  assert.equal(mounts.at(-1).element.props.state.document.sourcePath, sourceNotePaths.renamed);
  assert.match(mounts.at(-1).markup, legacyTask);
  await fixture.activeLeaf.view.onClose();
});

test("галочки меняют только отметку и перечитывают оба списка", async () => {
  const fixture = await createCurrentTasksFixture();
  const { controls, leaves, mounts, ribbonClick, emitModify, writes } = fixture;
  const props = () => mounts.at(-1).element.props;
  const reopen = async () => {
    await fixture.activeLeaf.view.onClose();
    leaves.pop();
    await ribbonClick();
  };

  await ribbonClick();
  assert.equal(props().onSetCompleted, undefined, "старый формат остаётся в режиме просмотра");
  for (const { unchecked, checked } of completionCases) {
    controls.markdown = unchecked;
    await emitModify();
    const { state: { document }, onSetCompleted } = props();
    assert.equal(typeof onSetCompleted, "function", "галочка получает команду для согласованного формата");
    const [task] = document.groups.flatMap((group) => group.tasks);
    await onSetCompleted(task, true);
    assert.equal(controls.markdown, checked);
    assert.match(mounts.at(-1).markup, completionFeedback.checked);
    await onSetCompleted(task, true);
    await reopen();
    assert.match(mounts.at(-1).markup, completionFeedback.checked);
    const { state: { document: updated }, onSetCompleted: apply } = props();
    const [updatedTask] = updated.groups.flatMap((group) => group.tasks);
    await apply(updatedTask, false);
    assert.equal(controls.markdown, unchecked);
    await reopen();
    assert.doesNotMatch(mounts.at(-1).markup, completionFeedback.checked);
  }
  assert.deepEqual(writes, completionCases.flatMap(({ checked, unchecked }) => [checked, unchecked]));
  await fixture.activeLeaf.view.onClose();
});

async function completeFirstTask(mounts) {
  const { onSetCompleted, state: { document } } = mounts.at(-1).element.props;
  const [task] = document.groups.flatMap((group) => group.tasks);
  await onSetCompleted(task, true);
}

test("галочки защищены от дубликатов, внешних правок и смены ID", async () => {
  const fixture = await createCurrentTasksFixture();
  const { controls, mounts, notices, writes, note, ribbonClick, emitModify } = fixture;
  const first = completionCases[0];
  controls.markdown = first.unchecked;
  await ribbonClick();

  controls.beforeProcess = () => { controls.markdown += externalListEdit; };
  await completeFirstTask(mounts);
  assert.equal(controls.markdown, first.unchecked + externalListEdit);
  assert.match(notices.at(-1), completionFeedback.conflict);
  controls.beforeProcess = () => { note.stat.mtime++; };
  await completeFirstTask(mounts);
  assert.equal(controls.markdown, first.unchecked + externalListEdit);
  assert.match(notices.at(-1), completionFeedback.taskChanged);
  controls.beforeProcess = undefined;

  for (const [markdown, message] of [[ambiguousCompletion, completionFeedback.ambiguous], [duplicatedCompletion, completionFeedback.duplicate]]) {
    controls.markdown = markdown;
    await emitModify();
    await completeFirstTask(mounts);
    assert.equal(controls.markdown, markdown);
    assert.match(notices.at(-1), message);
  }

  controls.markdown = first.unchecked;
  await emitModify();
  controls.taskMarkdown = differentTaskNoteMarkdown;
  await completeFirstTask(mounts);
  assert.equal(controls.markdown, first.unchecked);
  assert.match(notices.at(-1), completionFeedback.taskChanged);
  assert.deepEqual(writes, []);
  await fixture.activeLeaf.view.onClose();
});

async function openTasksFixture(t, markdown) {
  const fixture = await createCurrentTasksFixture();
  const { controls, ribbonClick } = fixture;
  controls.markdown = markdown;
  await ribbonClick();
  t.after(() => fixture.activeLeaf.view.onClose());
  return fixture;
}

function moveShownTask(mounts, taskTitle = moveFeedback.title) {
  const { onMoveTask, state: { document } } = mounts.at(-1).element.props;
  const tasks = document.groups.flatMap(({ tasks }) => tasks);
  const task = tasks.find(({ title }) => title === taskTitle);
  assert.ok(task);
  assert.equal(typeof onMoveTask, "function", "вкладка подключает команду переноса");
  return () => onMoveTask(task);
}

test("активная задача переносится в «Сегодня» по проекту и возвращается в начало проекта", async (t) => {
  for (const { initial, moved, returned } of moveCases) {
    const fixture = await openTasksFixture(t, initial);
    const { mounts, writes, leaves, ribbonClick } = fixture;
    const move = moveShownTask(mounts);
    assert.match(mounts.at(-1).markup, moveFeedback.toToday);
    await move();
    await move();
    assert.deepEqual(writes, [moved]);

    await fixture.activeLeaf.view.onClose();
    leaves.pop();
    await ribbonClick();
    assert.match(mounts.at(-1).markup, moveFeedback.toProject);
    await moveShownTask(mounts)();
    assert.deepEqual(writes, [moved, returned]);
  }
});

test("перенос отменяется при внешней правке, дубле, пояснении и повторном блоке «Сегодня»", async (t) => {
  const { initial } = moveCases[0];
  const { mounts, notices, controls, writes, emitModify, projectNote } = await openTasksFixture(t, initial);
  controls.beforeProcess = () => { controls.markdown += externalListEdit; };
  await moveShownTask(mounts)();
  assert.equal(controls.markdown, initial + externalListEdit);
  assert.match(notices.at(-1), completionFeedback.conflict);

  controls.beforeProcess = () => { controls.projectLinkDestination = null; };
  await moveShownTask(mounts)();
  assert.equal(controls.markdown, initial + externalListEdit);
  assert.match(notices.at(-1), moveFeedback.projectSection);

  controls.projectLinkDestination = projectNote;
  controls.beforeProcess = undefined;

  const { duplicate, annotation, todayHeading } = ambiguousMoveCases;
  for (const [markdown, notice] of [
    [duplicate, completionFeedback.duplicate],
    [annotation, moveFeedback.annotation],
    [todayHeading, moveFeedback.todayHeading],
  ]) {
    controls.markdown = markdown;
    await emitModify();
    await moveShownTask(mounts)();
    assert.equal(controls.markdown, markdown);
    assert.match(notices.at(-1), notice);
  }
  assert.deepEqual(writes, []);
});

test("перенос отложен для уже выполненной задачи", async (t) => {
  const { mounts, writes } = await openTasksFixture(t, completedMove);
  const { markup } = mounts.at(-1);
  assert.match(markup, moveFeedback.disabledMove);
  assert.deepEqual(writes, []);
});

test("перенос сохраняет задачу рядом с предшествующим комментарием", async (t) => {
  const { controls, mounts, notices, writes } = await openTasksFixture(t, moveAfterComment);
  await moveShownTask(mounts)();
  assert.deepEqual(writes, []);
  assert.equal(controls.markdown, moveAfterComment);
  assert.match(notices.at(-1), moveFeedback.annotation);
});

test("перенос отменяется, когда другой проект переезжает в ту же папку перед записью", async (t) => {
  const { initial } = moveCases[0];
  const { controls, mounts, notices, projectNote, writes } = await openTasksFixture(t, initial);
  const { taskTitle, renamedProjectPath } = moveProjectConflict;
  controls.beforeProcess = () => { projectNote.path = renamedProjectPath; };

  await moveShownTask(mounts, taskTitle)();
  assert.deepEqual(writes, []);
  assert.equal(controls.markdown, initial);
  assert.match(notices.at(-1), moveFeedback.projectSection);
});

test("дубль свойства периода оставляет просмотр и отключает команды записи", async (t) => {
  const { mounts, writes } = await openTasksFixture(t, moveWithDuplicatePeriod);
  const { markup, element: { props } } = mounts.at(-1);
  const { onMoveTask, onSetCompleted } = props;
  assert.match(markup, moveFeedback.duplicatePeriod);
  assert.match(markup, moveFeedback.disabledMove);
  assert.equal(onMoveTask, undefined);
  assert.equal(onSetCompleted, undefined);
  assert.deepEqual(writes, []);
});

test("переключатель называет следующее действие с выполненными задачами", async () => {
  const { outputFiles: [bundle] } = await build({
    absWorkingDir: project,
    entryPoints: ["src/current-tasks/TasksToolbar/index.ts"],
    bundle: true,
    format: "cjs",
    external: ["obsidian", "react"],
    write: false,
  });
  const module = { exports: {} };
  const requireToolbar = (name) => name === "obsidian" ? {} : require(name);
  runInNewContext(bundle.text, { module, exports: module.exports, require: requireToolbar });
  const { TasksToolbar } = module.exports;

  for (const { visible, next, label } of completedVisibilityCases) {
    let requested;
    const toolbar = TasksToolbar({ showCompleted: visible, onShowCompletedChange: (value) => { requested = value; } });
    assert.ok(renderToStaticMarkup(toolbar).includes(label));
    const toggle = toolbar.props.children.find(({ props }) => typeof props.onClick === "function");
    assert.ok(toggle);
    toggle.props.onClick();
    assert.equal(requested, next);
  }
});

test("отметка записывает порядок выполненных, снятие возвращает задачу в конец активных", async (t) => {
  const [first, second] = taskCompletionOrder;
  for (const [initial, firstChecked, secondChecked, secondRestored] of completionOrderCases) {
    const fixture = await openTasksFixture(t, initial);
    const { mounts, writes, leaves, ribbonClick } = fixture;
    const setCompletion = async (title, checked) => {
      const { onSetCompleted, state: { document } } = mounts.at(-1).element.props;
      const task = document.groups.flatMap(({ tasks }) => tasks).find((row) => row.title === title);
      assert.ok(task, title);
      await onSetCompleted(task, checked);
    };

    await setCompletion(first, true);
    await setCompletion(second, true);
    await setCompletion(second, true);
    assert.deepEqual(writes, [firstChecked, secondChecked]);

    await fixture.activeLeaf.view.onClose();
    leaves.pop();
    await ribbonClick();
    await setCompletion(second, false);
    assert.deepEqual(writes, [firstChecked, secondChecked, secondRestored]);
  }
});

test("выполненные видны по умолчанию после активных даже в смешанном списке", async (t) => {
  const [[initial]] = completionOrderCases;
  const { mounts, writes } = await openTasksFixture(t, initial);
  const { markup } = mounts.at(-1);
  assert.match(markup, tasksDesign.showCompleted);
  const labels = [...markup.matchAll(taskCheckboxLabel)].map(([, title]) => title);
  assert.deepEqual(labels, visibleTaskOrderBeforeWrite);
  assert.deepEqual(writes, []);
});

test("галочка сохраняет текст между задачами и блокирует перестановку через него", async (t) => {
  const { mounts, notices, writes } = await openTasksFixture(t, completionAcrossAnnotation);
  await completeFirstTask(mounts);
  assert.deepEqual(writes, []);
  assert.match(notices.at(-1), completionFeedback.interleaved);

  const { onSetCompleted, state: { document } } = mounts.at(-1).element.props;
  const [group] = document.groups;
  await onSetCompleted(group.tasks.at(-1), true);
  assert.deepEqual(writes, [completionAlongsideAnnotation]);
});

test("одна активная и одна выполненная задача не показывают ручки перетаскивания", async (t) => {
  const { mounts } = await openTasksFixture(t, completionWithOneActiveTask);
  assert.doesNotMatch(mounts.at(-1).markup, taskGripWithIcon);
});

test("снятие галочки не меняет соседей комментария при перестановке по одну сторону", async (t) => {
  const { mounts, notices, writes } = await openTasksFixture(t, completedBeforeAnnotation);
  const { onSetCompleted, state: { document } } = mounts.at(-1).element.props;
  const [group] = document.groups;
  const [, task] = group.tasks;

  await onSetCompleted(task, false);

  assert.deepEqual(writes, []);
  assert.match(notices.at(-1), completionFeedback.interleaved);
});

test("галочка отвергает ID, продублированный после загрузки списка", async (t) => {
  const { controls, mounts, notices, writes } = await openTasksFixture(t, completionWithTwoTasks);
  controls.secondTaskMarkdown = taskNoteMarkdown;

  await completeFirstTask(mounts);

  assert.deepEqual(writes, []);
  assert.match(notices.at(-1), completionFeedback.duplicate);
});

test("галочка отвергает короткую ссылку, сменившую цель перед записью", async (t) => {
  const { controls, mounts, notices, replacementNote, writes } = await openTasksFixture(t, completionWithShortLink);
  controls.beforeProcess = () => { controls.shortLinkDestination = replacementNote; };

  await completeFirstTask(mounts);

  assert.deepEqual(writes, []);
  assert.match(notices.at(-1), completionFeedback.taskChanged);
});

test("оборванный заголовок следующего блока не мешает отметить задачу корректного проекта", async (t) => {
  const { unchecked, checked } = completionBeforeBrokenHeading;
  const { mounts, writes } = await openTasksFixture(t, unchecked);

  await completeFirstTask(mounts);

  assert.deepEqual(writes, [checked]);
});

test("псевдоним проекта сохраняет его цвет и эмодзи в карточке и в Сегодня", async (t) => {
  const { mounts } = await openTasksFixture(t, aliasedBlogTasks);
  const { markup } = mounts.at(-1);
  const { panel, todayPrefix } = aliasedBlogExpected;

  assert.match(markup, panel);
  assert.match(markup, todayPrefix);
});

test("галочки недоступны, пока предыдущая запись не закончилась", async () => {
  const fixture = await createCurrentTasksFixture();
  const { controls, mounts, ribbonClick, writes } = fixture;
  const { unchecked, checked } = completionCases[0];
  controls.markdown = unchecked;
  await ribbonClick();
  const { onSetCompleted, state: { document } } = mounts.at(-1).element.props;
  const [task] = document.groups.flatMap((group) => group.tasks);
  const entered = Promise.withResolvers();
  const continueWrite = Promise.withResolvers();
  controls.beforeProcess = () => {
    entered.resolve();
    return continueWrite.promise;
  };
  const write = onSetCompleted(task, true);
  await entered.promise;
  assert.equal(mounts.at(-1).element.props.onSetCompleted, undefined);
  assert.match(mounts.at(-1).markup, completionFeedback.disabled);
  await onSetCompleted(task, false);
  continueWrite.resolve();
  await write;
  assert.deepEqual(writes, [checked]);
  await fixture.activeLeaf.view.onClose();
});

test("обычная вкладка включает галочки, а открытие только читает Markdown", async () => {
  const fixture = await createCurrentTasksFixture();
  const { controls, mounts, ribbonClick, writes } = fixture;
  controls.markdown = completionCases[0].unchecked;
  await ribbonClick();
  assert.equal(typeof mounts.at(-1).element.props.onSetCompleted, "function");
  assert.doesNotMatch(mounts.at(-1).markup, completionFeedback.disabled);
  assert.deepEqual(writes, []);
  await fixture.activeLeaf.view.onClose();
});

test("список применяет только актуальное чтение и освобождает подписки при закрытии", async () => {
  const fixture = await createCurrentTasksFixture();
  const { controls, mounts, listeners, ribbonClick, emitModify } = fixture;
  await ribbonClick();

  let finishOldRead;
  controls.nextRead = new Promise((resolve) => { finishOldRead = resolve; });
  await emitModify();
  controls.markdown = propertyTasks;
  await emitModify();
  finishOldRead(obsoleteTasks);
  await new Promise(setImmediate);

  const { markup, element } = mounts.at(-1);
  assert.match(markup, todayGroup);
  assert.match(markup, missingNote);
  assert.doesNotMatch(markup, obsoleteGroup);
  const [today] = element.props.state.document.groups;
  const [task] = today.tasks;
  assert.equal(task.id, taskId);
  assert.equal(task.project, projectAlias);
  assert.match(markup, missingProject);

  controls.sourceAvailable = false;
  await emitModify();
  assert.match(mounts.at(-1).markup, missingSource);
  await fixture.activeLeaf.view.onClose();
  assert.equal(listeners.size, 0);
});

test("ссылки учитывают закрепление, модификатор и историю вкладки", async () => {
  const fixture = await createCurrentTasksFixture();
  const { controls, leaves, mounts, notices, listeners, openedNotes, note, projectNote, workspace, ribbonClick } = fixture;
  controls.markdown = propertyTasks;
  await ribbonClick();

  const { element } = mounts.at(-1);
  const [today, projectGroup] = element.props.state.document.groups;
  const [task] = today.tasks;
  const actionLeaf = fixture.activeLeaf;
  const destinations = [[task.link, note.path], [projectGroup.link, projectNote.path]];

  for (const [link, expectedPath] of destinations) {
    await mounts.at(-1).element.props.onOpenNote(link);
    assert.equal(openedNotes.at(-1), expectedPath);
    assert.equal(leaves.length, 1, "незакреплённый список открывает заметку в той же вкладке");
    assert.equal(fixture.activeLeaf, actionLeaf);
    await actionLeaf.goBack();
    assert.match(mounts.at(-1).markup, viewHeading);
  }

  openedNotes.length = 0;
  const actionView = actionLeaf.view;
  const { element: pinnedElement, markup } = mounts.at(-1);
  const { onOpenNote } = pinnedElement.props;
  actionLeaf.pinned = true;
  assert.equal(actionView.navigation, true, "страница участвует в истории Obsidian");
  await onOpenNote(task.link);
  assert.deepEqual(openedNotes, [note.path]);
  assert.equal(leaves.length, 2, "обычная ссылка задачи открывает отдельную вкладку");
  assert.equal(fixture.activeLeaf, leaves[1], "заметка задачи получает фокус");

  await workspace.revealLeaf(actionLeaf);
  await onOpenNote(projectGroup.link);
  assert.deepEqual(openedNotes, [note.path, projectNote.path]);
  assert.equal(leaves.length, 3, "заголовок проекта открывает отдельную вкладку");
  assert.equal(fixture.activeLeaf, leaves[2], "заметка проекта получает фокус");
  assert.equal(actionLeaf.view, actionView, "список остаётся открытым в исходной вкладке");
  assert.equal(actionLeaf.history.length, 0, "переходы не попадают в историю исходной вкладки");
  assert.equal(listeners.size, 4, "список продолжает получать обновления");
  assert.match(markup, projectLink);

  await workspace.revealLeaf(actionLeaf);
  controls.failNextNoteOpen = true;
  await onOpenNote(task.link);
  assert.equal(leaves.length, 3, "после ошибки не остаётся пустая вкладка");
  assert.equal(fixture.activeLeaf, actionLeaf);
  assert.equal(notices.at(-1), noteOpenFailed);

  actionLeaf.pinned = false;
  await onOpenNote(task.link, true);
  assert.equal(leaves.length, 4, "Ctrl/Cmd+клик открывает вкладку без закрепления списка");
  assert.equal(fixture.activeLeaf, leaves[3]);
});

test("нажатие колёсиком по ссылке открывает новую вкладку", async () => {
  const { outputFiles: [bundle] } = await build({
    absWorkingDir: project,
    entryPoints: ["src/current-tasks/NoteLink/index.ts"],
    bundle: true,
    format: "cjs",
    external: ["react/jsx-runtime"],
    write: false,
  });
  const module = { exports: {} };
  runInNewContext(bundle.text, { module, exports: module.exports, require });

  const opened = [];
  const link = module.exports.NoteLink({
    note: projectLinkNote,
    onOpenNote: async (...args) => opened.push(args),
  });
  const { onAuxClick } = link.props;
  assert.equal(typeof onAuxClick, "function", "ссылка обрабатывает нажатие колёсиком");
  onAuxClick({ button: rightButton, preventDefault: () => assert.fail("правый клик сохраняет стандартное действие") });
  assert.deepEqual(opened, []);

  let prevented = false;
  onAuxClick({ button: middleButton, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(opened, [[projectLinkNote.link, true]]);
});

test("режим VS Code читает локальный путь и пересобирает React после правки", async (t) => {
  const fixtureParent = join(project, "node_modules");
  const fixture = await mkdtemp(join(fixtureParent, ".pfa-watch-"));
  const vault = join(fixture, "vault");
  let child;
  let closed;
  t.after(async () => {
    if (child?.exitCode === null && child.signalCode === null) child.kill();
    await closed;
    await removeFixture(fixture, fixtureParent);
  });

  await mkdir(join(vault, obsidianDirectory), { recursive: true });
  for (const path of scriptFiles) {
    await cp(join(project, path), join(fixture, path), { recursive: true });
  }
  await writeFile(join(fixture, environmentFile), `${environmentVariable}='${vault}'\n`);
  const env = { ...process.env };
  delete env[environmentVariable];
  child = spawn(
    process.execPath,
    [`--env-file=${environmentFile}`, join(fixture, buildScript), configuredWatchOption],
    { cwd: fixture, env, timeout: 24000, stdio: ["ignore", "ignore", "pipe"] },
  );
  let errors = "";
  child.stderr.setEncoding("utf8").on("data", (text) => {
    errors += text;
  });
  closed = once(child, "close");

  const output = join(vault, obsidianDirectory, pluginsDirectory, pluginId);
  const marker = join(output, markerFile);
  const ready = await waitForBuild(child, () => existsSync(marker));
  assert.ok(ready, `после сборки должен появиться ${markerFile}\n${errors}`);
  const manifest = JSON.parse(await readFile(join(output, manifestFile), "utf8"));
  const pkg = JSON.parse(await readFile(join(project, "package.json"), "utf8"));
  assert.equal(manifest.id, pluginId);
  assert.equal(manifest.version, pkg.version);
  const bundle = join(output, scriptFile);
  assert.match(await readFile(bundle, "utf8"), expectedViewType);
  assert.match(await readFile(join(output, styleFile), "utf8"), expectedThemeVariable);

  const component = join(fixture, ...componentPath);
  const before = await readFile(component, "utf8");
  const after = before.replace(originalHeading, `<h2>${probe}</h2>`);
  assert.notEqual(after, before, "пробная правка меняет JSX");
  await writeFile(component, after);
  const rebuilt = await waitForBuild(child, async () =>
    (await readFile(bundle, "utf8")).includes(probe),
  );
  assert.ok(rebuilt, `новый текст должен появиться в ${scriptFile}\n${errors}`);
});

test("watch отклоняет путь без конфигурации Obsidian", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "pfa-invalid-"));
  t.after(() => removeFixture(directory));
  const result = spawnSync(process.execPath, [config, explicitWatchOption, directory], {
    cwd: project,
    encoding: "utf8",
    timeout: 10000,
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, expectedConfigDirectory);
  assert.equal(existsSync(join(directory, obsidianDirectory)), false);
});
