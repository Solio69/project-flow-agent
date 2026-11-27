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
import { appendExternalListEdit, createClipboardFixture, createCurrentTasksFixture } from "./fixtures/current-tasks.mjs";
import {
  createTaskAlreadyToday, createTaskMarkdown, danglingCreateTaskMarkdown, danglingHeadingTaskMarkdown, duplicateCases,
  aliasedBlogTasks, ambiguousCompletion, ambiguousMoveCases, completedBeforeAnnotation, completedMove, completionAcrossAnnotation, completionAlongsideAnnotation,
  completionBeforeBrokenHeading, completionCases, completionOrderCases, completionWithOneActiveTask,
  completionWithShortLink, completionWithTwoTasks, duplicatedCompletion, externalListEdit,
  moveAfterComment, moveCases, moveWithDuplicatePeriod, obsoleteTasks, propertyTasks,
  periodChange, periodWithYamlBlock, readOnlyPeriodCases, renameWithAlias, renameWithoutAliasCases, reorderCases, reorderInsideEdgeText, reorderWithEdgeText, repeatedBlogPanels, taskWithTitlePrefix, transferTaskCases,
  archiveTaskCases, transferWithAmbiguousToday, transferWithShortLink,
} from "./fixtures/current-tasks-markdown.mjs";
import {
  createTaskCase,
  aliasedBlogExpected, collapsedProjectSettings, completedVisibilityCases, completionFeedback, currentTasksExpected, differentTaskNoteMarkdown, iconizeFixture,
  moveFeedback, moveProjectConflict, notePathCopy, projectLinkCase, reorderTasks, repeatedProjectPanels, sourceNotePaths, taskCheckboxLabel, taskCompletionOrder, taskGripWithIcon, taskNoteMarkdown, tasksDesign,
  activeTaskOrder, archiveTaskCase, existingPluginSettings, renameTaskCase, transferTaskCase, visiblePluginSettings, visibleTaskOrderBeforeWrite, watchFixture,
} from "./fixtures/scaffold-data.mjs";

const require = createRequire(import.meta.url);
const project = fileURLToPath(new URL("../", import.meta.url));
const {
  buildScript, scriptFiles, environmentFile, environmentVariable, configuredWatchOption,
  explicitWatchOption, obsidianDirectory, expectedConfigDirectory, pluginsDirectory,
  pluginId, markerFile, scriptFile, manifestFile, styleFile, expectedViewType,
  expectedThemeVariable, originalHeadingContent, probe, componentPath,
} = watchFixture;
const {
  viewTitle, viewHeading, legacyTask, legacyProject, todayGroup, missingNote, obsoleteGroup,
  taskId, projectAlias, projectLink, missingProject, missingSource, noteOpenFailed,
} = currentTasksExpected;
const { note: projectLinkNote, middleButton, rightButton } = projectLinkCase;
const config = join(project, buildScript);

test("архивирование сохраняет файл и убирает только выбранную строку из обоих списков", async (t) => {
  const { taskPath } = archiveTaskCase;
  const { oldPath, body } = renameTaskCase;
  for (const { markdown, after, today, completed } of archiveTaskCases) {
    const { controls, mounts, note, renames, writes } = await openTasksFixture(t, markdown);
    controls.taskMarkdown = body;
    controls.updateLinksAfterRename = today;
    const { onArchiveTask, state: { document: { groups } } } = mounts.at(-1).element.props;
    const task = groups.flatMap(({ tasks }) => tasks).find(({ notePath }) => notePath === oldPath);
    assert.equal(task.completed, completed);
    assert.equal((await onArchiveTask({ task })).ok, true);
    assert.equal(note.path, taskPath);
    assert.equal(controls.taskMarkdown, body);
    assert.deepEqual(renames, [taskPath]);
    assert.deepEqual(writes, [after]);
    assert.equal(controls.markdown, after);
  }
});

test("архивирование защищает назначение и повторяет запись списка после внешней правки", async (t) => {
  const { taskPath, occupied, missing, partial } = archiveTaskCase;
  const { oldPath } = renameTaskCase;
  const [{ markdown, after }] = archiveTaskCases;
  const { controls, mounts, note, renames } = await openTasksFixture(t, markdown);
  const current = () => mounts.at(-1).element.props;
  const task = current().state.document.groups.flatMap(({ tasks }) => tasks).find(({ notePath }) => notePath === oldPath);
  const archive = (pending) => current().onArchiveTask({ task, pending });
  controls.archiveAvailable = false;
  assert.match((await archive()).message, missing);
  controls.archiveAvailable = true;
  controls.unindexedPaths = [taskPath];
  assert.match((await archive()).message, occupied);
  assert.equal(note.path, oldPath);
  assert.deepEqual(renames, []);
  controls.unindexedPaths = [];
  controls.updateLinksAfterRename = false;
  controls.beforeProcess = () => appendExternalListEdit(controls);
  const interrupted = await archive();
  assert.match(interrupted.message, partial);
  assert.ok(interrupted.message.includes(taskPath));
  assert.equal(note.path, taskPath);
  assert.equal(controls.markdown, `${markdown}${externalListEdit}`);
  controls.beforeProcess = undefined;
  assert.equal((await archive(interrupted.pending)).ok, true);
  assert.equal((await archive(interrupted.pending)).ok, true);
  assert.equal(controls.markdown, `${after}${externalListEdit}`);
  assert.deepEqual(renames, [taskPath]);
});

test("архивирование отказывает до переноса при неоднозначной строке в Сегодня", async (t) => {
  const { oldPath } = renameTaskCase;
  const { controls, mounts, note, renames, writes } = await openTasksFixture(t, transferWithAmbiguousToday);
  const { onArchiveTask, state: { document: { groups } } } = mounts.at(-1).element.props;
  const task = groups.flatMap(({ tasks }) => tasks).find(({ notePath }) => notePath === oldPath);
  assert.equal((await onArchiveTask({ task })).ok, false);
  assert.equal(note.path, oldPath);
  assert.equal(controls.markdown, transferWithAmbiguousToday);
  assert.deepEqual(renames, []);
  assert.deepEqual(writes, []);
});

test("перенос в другой проект меняет папку и оставляет задачу в нужном списке", async (t) => {
  const { projectPath, taskPath } = transferTaskCase;
  const { oldPath, oldTitle, body } = renameTaskCase;
  for (const { markdown, today, completed, updateLinks } of transferTaskCases) {
    const { controls, mounts, note, renames } = await openTasksFixture(t, markdown);
    controls.taskMarkdown = body;
    controls.updateLinksAfterRename = updateLinks;
    const { onTransferTask, state: { document: { groups } } } = mounts.at(-1).element.props;
    const task = groups.flatMap(({ tasks }) => tasks).find(({ notePath }) => notePath === oldPath);
    const result = await onTransferTask({ task, projectPath });
    assert.equal(result.ok, true);
    assert.deepEqual(renames, [taskPath]);
    assert.equal(note.path, taskPath);
    assert.equal(controls.taskMarkdown, body);
    assert.ok(controls.markdown.includes(`[[${taskPath}|${oldTitle}]]`));
    const { state: { document: { groups: updatedGroups } } } = mounts.at(-1).element.props;
    const owners = updatedGroups.filter(({ tasks }) => tasks.some(({ notePath }) => notePath === taskPath));
    assert.equal(owners.length, 1);
    const [owner] = owners;
    const updated = owner.tasks.find(({ notePath }) => notePath === taskPath);
    assert.equal(updated.id, task.id);
    assert.equal(updated.completed, completed);
    if (today) {
      assert.equal(owner.kind, "today");
      assert.equal(updated.line, task.line);
      assert.equal(updated.projectPath, projectPath);
    } else {
      assert.equal(owner.notePath, projectPath);
      assert.equal(owner.tasks.at(-1), updated);
    }
  }
});

test("перенос защищает занятый путь и повторяет запись списка с тем же файлом", async (t) => {
  const { projectPath, taskPath, outsidePeriod, occupied, partial } = transferTaskCase;
  const { oldPath } = renameTaskCase;
  const [{ markdown }] = transferTaskCases;
  const { controls, mounts, note, renames } = await openTasksFixture(t, markdown);
  const props = () => mounts.at(-1).element.props;
  const task = props().state.document.groups.flatMap(({ tasks }) => tasks).find(({ notePath }) => notePath === oldPath);
  const transfer = (pending) => props().onTransferTask({ task, projectPath, pending });
  assert.equal((await props().onTransferTask({ task, projectPath: outsidePeriod })).ok, false);
  assert.deepEqual(renames, []);
  controls.unindexedPaths = [taskPath];
  assert.match((await transfer()).message, occupied);
  assert.equal(note.path, oldPath);
  controls.unindexedPaths = [];
  controls.updateLinksAfterRename = false;
  controls.beforeProcess = () => appendExternalListEdit(controls);
  const missed = await transfer();
  assert.match(missed.message, partial);
  assert.equal(note.path, taskPath);
  controls.beforeProcess = undefined;
  assert.equal((await transfer(missed.pending)).ok, true);
  assert.equal((await transfer(missed.pending)).ok, true);
  assert.ok(controls.markdown.endsWith(externalListEdit));
  assert.deepEqual(renames, [taskPath]);
});

test("перенос не переписывает короткую ссылку, сменившую цель перед записью", async (t) => {
  const { projectPath, taskPath, partial } = transferTaskCase;
  const { controls, emitModify, mounts, note, replacementNote, renames, writes } = await openTasksFixture(t, transferWithShortLink);
  const current = () => mounts.at(-1).element.props;
  const { state: { document: { groups } } } = current();
  const [task] = groups.flatMap(({ tasks }) => tasks);
  const transfer = (pending) => current().onTransferTask({ task, projectPath, pending });
  controls.updateLinksAfterRename = false;
  controls.beforeProcess = () => { controls.shortLinkDestination = replacementNote; };

  const result = await transfer();
  assert.equal(result.ok, false);
  assert.match(result.message, partial);
  assert.equal(note.path, taskPath);
  assert.equal(controls.markdown, transferWithShortLink);
  assert.deepEqual(writes, []);

  controls.beforeProcess = undefined;
  controls.shortLinkDestination = null;
  await emitModify();
  assert.equal((await transfer(result.pending)).ok, true);
  assert.equal(writes.length, 1);
  assert.deepEqual(renames, [taskPath]);
});

test("перенос из «Сегодня» отклоняет неоднозначную строку до записи", async (t) => {
  const { projectPath } = transferTaskCase;
  const { oldPath } = renameTaskCase;
  const { controls, mounts, note, renames, writes } = await openTasksFixture(t, transferWithAmbiguousToday);
  const { onTransferTask, state: { document: { groups } } } = mounts.at(-1).element.props;
  const [task] = groups.flatMap(({ tasks }) => tasks);

  const result = await onTransferTask({ task, projectPath });
  assert.equal(result.ok, false);
  assert.match(result.message, completionFeedback.ambiguous);
  assert.equal(note.path, oldPath);
  assert.equal(controls.markdown, transferWithAmbiguousToday);
  assert.deepEqual(renames, []);
  assert.deepEqual(writes, []);
});

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

  controls.beforeProcess = () => appendExternalListEdit(controls);
  await completeFirstTask(mounts);
  assert.equal(controls.markdown, `${first.unchecked}${externalListEdit}`);
  assert.match(notices.at(-1), completionFeedback.conflict);
  controls.beforeProcess = () => { note.stat.mtime++; };
  await completeFirstTask(mounts);
  assert.equal(controls.markdown, `${first.unchecked}${externalListEdit}`);
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

test("копирование использует полный путь с расширением и проверяет ссылку", async (t) => {
  const { mounts, controls, notices, writes } = await openTasksFixture(t, transferWithShortLink);
  const { onCopyTaskPath, state: { document: { groups } } } = mounts.at(-1).element.props;
  const [task] = groups[0].tasks;
  const { clipboard, copied } = createClipboardFixture();
  await onCopyTaskPath(task, clipboard);
  assert.deepEqual(copied, [notePathCopy.absolute]);
  assert.match(notices.at(-1), notePathCopy.copied);
  controls.shortLinkDestination = null;
  await onCopyTaskPath(task, clipboard);
  assert.deepEqual(copied, [notePathCopy.absolute]);
  assert.match(notices.at(-1), notePathCopy.inaccessible);
  assert.deepEqual(writes, []);
});

test("копирование пути отклоняет ссылку задачи на вложение", async (t) => {
  const { controls, emitModify, mounts, notices, taskAttachment, writes } = await openTasksFixture(t, transferWithShortLink);
  const { clipboard, copied } = createClipboardFixture();
  controls.shortLinkDestination = taskAttachment;
  await emitModify();
  const { onCopyTaskPath, state: { document: { groups } } } = mounts.at(-1).element.props;
  const [task] = groups[0].tasks;
  assert.equal(task.notePath, notePathCopy.attachment);
  await onCopyTaskPath(task, clipboard);
  assert.deepEqual(copied, []);
  assert.match(notices.at(-1), notePathCopy.unsupported);
  assert.deepEqual(writes, []);
});

test("дублирование создаёт пустой файл с новым ID в исходном проекте и списке", async (t) => {
  const { today, todaySaved, project, projectSaved, occupied } = duplicateCases;
  for (const [initial, saved] of [[today, todaySaved], [project, projectSaved]]) {
    const { controls, createdNotes, mounts, writes } = await openTasksFixture(t, initial);
    controls.taskMarkdown = renameTaskCase.body;
    const { onDuplicateTask, state: { document: { groups } } } = mounts.at(-1).element.props;
    const original = groups.flatMap(({ tasks }) => tasks).find(({ notePath }) => notePath === renameTaskCase.oldPath);
    assert.equal(await onDuplicateTask(original), occupied);
    assert.deepEqual([...createdNotes.keys()], [occupied]);
    const { markdown } = createdNotes.get(occupied);
    assert.match(markdown, /^---\nid: tsk_[a-f\d]{32}\n---\n$/u);
    assert.ok(!markdown.includes(original.id));
    assert.equal(controls.taskMarkdown, renameTaskCase.body);
    assert.deepEqual(writes, [saved]);
  }
});

test("дублирование пропускает занятое имя и повторяет запись уже созданной копии", async (t) => {
  const { today, occupied, next, savedAfterRetry } = duplicateCases;
  const { mounts, controls, createdNotes, writes } = await openTasksFixture(t, today);
  const duplicate = () => {
    const { onDuplicateTask, state: { document: { groups } } } = mounts.at(-1).element.props;
    return onDuplicateTask(groups[0].tasks[0]);
  };
  controls.unindexedPaths = [occupied];
  controls.beforeProcess = () => appendExternalListEdit(controls);
  assert.equal(await duplicate(), undefined);
  assert.deepEqual([...createdNotes.keys()], [next]);
  assert.deepEqual(writes, []);
  controls.beforeProcess = undefined;
  assert.equal(await duplicate(), next);
  assert.deepEqual([...createdNotes.keys()], [next]);
  assert.deepEqual(writes, [`${savedAfterRetry}${externalListEdit}`]);
});

test("дублирование отменяет запись, если исходная ссылка перестала вести к выбранной заметке", async (t) => {
  const { controls, mounts, createdNotes, writes } = await openTasksFixture(t, transferWithShortLink);
  const { onDuplicateTask, state: { document: { groups } } } = mounts.at(-1).element.props;
  controls.beforeReadSource = () => { controls.shortLinkDestination = null; };
  assert.equal(await onDuplicateTask(groups[0].tasks[0]), undefined);
  assert.equal(createdNotes.size, 0);
  assert.deepEqual(writes, []);
});

test("дублирование отменяет создание после изменения ID исходной задачи", async (t) => {
  const { today } = duplicateCases;
  const { controls, mounts, note, createdNotes, writes } = await openTasksFixture(t, today);
  const { onDuplicateTask, state: { document: { groups } } } = mounts.at(-1).element.props;
  controls.beforeReadSource = () => {
    note.stat.mtime++;
    controls.taskMarkdown = differentTaskNoteMarkdown;
  };

  assert.equal(await onDuplicateTask(groups[0].tasks[0]), undefined);
  assert.equal(createdNotes.size, 0);
  assert.deepEqual(writes, []);
});

test("дублирование прекращает запись после смены ID и повторно использует файл", async (t) => {
  const { today, todaySaved, occupied } = duplicateCases;
  const { controls, emitModify, mounts, note, createdNotes, writes } = await openTasksFixture(t, today);
  const duplicate = () => {
    const { onDuplicateTask, state: { document: { groups } } } = mounts.at(-1).element.props;
    return onDuplicateTask(groups[0].tasks[0]);
  };
  controls.beforeProcess = () => {
    note.stat.mtime++;
    controls.taskMarkdown = differentTaskNoteMarkdown;
  };

  assert.equal(await duplicate(), undefined);
  assert.deepEqual([...createdNotes.keys()], [occupied]);
  assert.deepEqual(writes, []);
  const copy = createdNotes.get(occupied);

  controls.beforeProcess = undefined;
  controls.taskMarkdown = taskNoteMarkdown;
  note.stat.mtime++;
  await emitModify();
  assert.equal(await duplicate(), occupied);
  assert.equal(createdNotes.get(occupied), copy);
  assert.deepEqual(writes, [todaySaved]);
});

test("дублирование не создаёт файл после изменения списка во время проверки имени", async (t) => {
  const { today, occupied } = duplicateCases;
  const { controls, mounts, createdNotes, writes } = await openTasksFixture(t, today);
  const { onDuplicateTask, state: { document: { groups } } } = mounts.at(-1).element.props;
  let checks = 0;
  controls.beforeCheckPath = (path) => {
    if (path === occupied && ++checks === 2) appendExternalListEdit(controls);
  };

  assert.equal(await onDuplicateTask(groups[0].tasks[0]), undefined);
  assert.equal(controls.markdown, `${today}${externalListEdit}`);
  assert.equal(createdNotes.size, 0);
  assert.deepEqual(writes, []);
});

test("выбор периода пишет только две даты, а очистка оставляет задачи редактируемыми", async (t) => {
  const { initial, next, saved, crossYear, crossYearSaved, crossYearLabel, empty, checked } = periodChange;
  const { controls, mounts, writes } = await openTasksFixture(t, initial);
  const props = () => mounts.at(-1).element.props;
  assert.equal((await props().onChangePeriod(next)).ok, true);
  assert.equal(controls.markdown, saved);
  assert.deepEqual({ ...props().state.document.period }, next);
  assert.equal((await props().onChangePeriod(crossYear)).ok, true);
  assert.equal(controls.markdown, crossYearSaved);
  assert.match(mounts.at(-1).markup, crossYearLabel);
  assert.equal((await props().onChangePeriod(undefined)).ok, true);
  assert.equal(controls.markdown, empty);
  assert.equal(props().state.document.period, undefined);
  assert.equal(props().state.document.diagnostics.length, 0);
  await completeFirstTask(mounts);
  assert.equal(controls.markdown, checked);
  assert.deepEqual(writes, [saved, crossYearSaved, empty, checked]);
});

test("выбор периода сохраняет внешнюю правку и отклоняет ошибочные даты", async (t) => {
  const { initial, next, invalid, reversed } = periodChange;
  const { controls, emitModify, mounts, writes } = await openTasksFixture(t, initial);
  const props = () => mounts.at(-1).element.props;
  const original = props().state.document;
  const change = (period, expectedSource) => props().onChangePeriod(period, expectedSource);
  assert.equal((await change(invalid)).ok, false);
  assert.equal((await change(reversed)).ok, false);
  assert.equal(controls.markdown, initial);
  controls.beforeProcess = () => appendExternalListEdit(controls);
  assert.equal((await change(next)).ok, false);
  assert.equal(controls.markdown, `${initial}${externalListEdit}`);
  controls.beforeProcess = undefined;
  await emitModify();
  assert.equal((await change(next, original)).ok, false);
  assert.equal(controls.markdown, `${initial}${externalListEdit}`);
  assert.deepEqual(writes, []);
});

test("календарь не меняет старую шапку, вложенные или повторяющиеся свойства", async (t) => {
  for (const markdown of readOnlyPeriodCases) {
    const { mounts, writes } = await openTasksFixture(t, markdown);
    assert.equal(mounts.at(-1).element.props.onChangePeriod, undefined);
    assert.deepEqual(writes, []);
  }
});

test("календарь сохраняет соседнее многострочное свойство с вложенным разделителем", async (t) => {
  const { initial, saved } = periodWithYamlBlock;
  const { controls, mounts, writes } = await openTasksFixture(t, initial);
  const { onChangePeriod } = mounts.at(-1).element.props;
  assert.equal(typeof onChangePeriod, "function");
  assert.equal((await onChangePeriod(periodChange.next)).ok, true);
  assert.equal(controls.markdown, saved);
  assert.deepEqual(writes, [saved]);
});

test("календарь учитывает дубль свойства после вложенного разделителя", async (t) => {
  const { mounts, writes } = await openTasksFixture(t, periodWithYamlBlock.duplicate);
  const { markup, element: { props: { onChangePeriod } } } = mounts.at(-1);
  assert.equal(onChangePeriod, undefined);
  assert.match(markup, moveFeedback.duplicatePeriod);
  assert.deepEqual(writes, []);
});

test("календарь отклоняет незакрытый YAML с вложенным разделителем", async (t) => {
  const { mounts, writes } = await openTasksFixture(t, periodWithYamlBlock.unclosed);
  assert.equal(mounts.at(-1).element.props.onChangePeriod, undefined);
  assert.deepEqual(writes, []);
});

test("заголовок открывает точный источник в новой вкладке", async (t) => {
  const fixture = await openTasksFixture(t, propertyTasks);
  const { controls, emitModify, mounts, leaves, openedNotes, notices, renamedSource, workspace } = fixture;
  const viewLeaf = fixture.activeLeaf;
  t.after(() => workspace.revealLeaf(viewLeaf));

  const firstRender = mounts.at(-1);
  assert.match(firstRender.markup, currentTasksExpected.linkedSourceHeading);
  await firstRender.element.props.onOpenSource();
  assert.equal(openedNotes.at(-1), sourceNotePaths.legacy);
  assert.equal(fixture.activeLeaf, leaves[1]);

  await workspace.revealLeaf(viewLeaf);
  controls.renamedSourceAvailable = true;
  await emitModify(renamedSource);
  const newRender = mounts.at(-1);
  viewLeaf.pinned = true;
  await newRender.element.props.onOpenSource();
  assert.equal(openedNotes.at(-1), sourceNotePaths.renamed);
  assert.equal(fixture.activeLeaf, leaves[2]);

  await workspace.revealLeaf(viewLeaf);
  controls.failNextNoteOpen = true;
  await newRender.element.props.onOpenSource();
  assert.equal(leaves.length, 3);
  assert.equal(notices.at(-1), noteOpenFailed);
});

test("создание добавляет новый файл и строку в конец активных", async (t) => {
  const { mounts, controls, createdNotes, writes } = await openTasksFixture(t, createTaskMarkdown);
  const { title, invalidTitle, duplicateTitle, projectPath, notePath, row, note, action } = createTaskCase;
  const { markup, element } = mounts.at(-1);
  assert.match(markup, action);
  const create = (value) => mounts.at(-1).element.props.onCreateTask({ title: value, projectPath });
  assert.equal(typeof element.props.onCreateTask, "function");
  assert.equal((await create(invalidTitle)).ok, false);
  assert.equal((await create(duplicateTitle)).ok, false);
  assert.equal(createdNotes.size, 0);
  assert.deepEqual(writes, []);

  assert.deepEqual({ ...await create(title) }, { ok: true, taskPath: notePath });
  assert.match(createdNotes.get(notePath).markdown, note);
  const activeGroup = mounts.at(-1).element.props.state.document.groups.find(({ notePath }) => notePath === projectPath);
  assert.equal(activeGroup.tasks[1].title, title);
  assert.equal(activeGroup.tasks[1].completed, false);
  assert.equal(activeGroup.tasks[2].completed, true);
  assert.ok(controls.markdown.includes(row));
  assert.equal(writes.length, 1);
});

test("переименование сохраняет ID, содержание, положение и отметку задачи", async (t) => {
  const { newTitle, newPath, body, action } = renameTaskCase;
  for (const { before, after } of renameWithoutAliasCases) {
    const { controls, mounts, note, renames, writes } = await openTasksFixture(t, before);
    controls.taskMarkdown = body;
    const { markup, element: { props } } = mounts.at(-1);
    const { onRenameTask, state: { document: { groups } } } = props;
    const [task] = groups.flatMap(({ tasks }) => tasks);
    const { line } = task;
    assert.match(markup, action);
    const result = await onRenameTask({ task, title: newTitle, sourceMarkdown: before });
    assert.deepEqual({ ...result }, { ok: true, taskPath: newPath });
    assert.equal(note.path, newPath);
    assert.deepEqual(renames, [newPath]);
    assert.deepEqual(writes, []);
    assert.equal(controls.markdown, after);
    assert.equal(controls.taskMarkdown, body);
    const [updatedTask] = mounts.at(-1).element.props.state.document.groups.flatMap(({ tasks }) => tasks);
    assert.deepEqual({ line: updatedTask.line, id: updatedTask.id, completed: updatedTask.completed },
      { line, id: taskId, completed: true });
    assert.equal(updatedTask.title, newTitle);
  }
});

test("переименование обновляет путь и сохраняет псевдоним ссылки", async (t) => {
  const { newTitle, newPath } = renameTaskCase;
  const { before, after, title } = renameWithAlias;
  const { controls, mounts } = await openTasksFixture(t, before);
  const current = () => mounts.at(-1).element.props;
  const shownTask = () => current().state.document.groups.flatMap(({ tasks }) => tasks)[0];
  const task = shownTask();
  const result = await current().onRenameTask({ task, title: newTitle, sourceMarkdown: before });

  assert.equal(result.ok, true);
  assert.equal(task.title, title);
  assert.equal(shownTask().title, title);
  assert.equal(shownTask().notePath, newPath);
  assert.equal(controls.markdown, after);
});

test("чтение задачи с ID сохраняет префикс и псевдоним ссылки", async (t) => {
  const { markdown, title } = taskWithTitlePrefix;
  const { mounts } = await openTasksFixture(t, markdown);
  const { groups } = mounts.at(-1).element.props.state.document;
  const [task] = groups.flatMap(({ tasks }) => tasks);
  assert.equal(task.id, taskId);
  assert.equal(task.title, title);
});

test("переименование доступно рядом с недоступной заметкой", async (t) => {
  const { newTitle, newPath } = renameTaskCase;
  const { mounts, note } = await openTasksFixture(t, completionWithOneActiveTask);
  const { onRenameTask, state: { document: { groups, sourceMarkdown } } } = mounts.at(-1).element.props;
  const [task, neighbor] = groups.flatMap(({ tasks }) => tasks);
  assert.equal(neighbor.notePath, undefined);

  const result = await onRenameTask({ task, title: newTitle, sourceMarkdown });
  assert.equal(result.ok, true);
  assert.equal(note.path, newPath);
  const [, updatedNeighbor] = mounts.at(-1).element.props.state.document.groups.flatMap(({ tasks }) => tasks);
  assert.deepEqual(updatedNeighbor, neighbor);
});

test("переименование отклоняет неоднозначную строку исходного списка", async (t) => {
  const { oldPath, newTitle } = renameTaskCase;
  const { mounts, note, controls, renames } = await openTasksFixture(t, ambiguousCompletion);
  const { onRenameTask, state: { document: { groups, sourceMarkdown } } } = mounts.at(-1).element.props;
  const [task] = groups.flatMap(({ tasks }) => tasks);
  const result = await onRenameTask({ task, title: newTitle, sourceMarkdown });

  assert.equal(result.ok, false);
  assert.match(result.message, completionFeedback.ambiguous);
  assert.equal(note.path, oldPath);
  assert.equal(controls.markdown, sourceMarkdown);
  assert.deepEqual(renames, []);
});

test("переименование оставляет файл при занятом пути, недопустимом имени и сбое", async (t) => {
  const { oldPath, newPath, newTitle, invalidTitle, caseOnlyTitle, invalid, occupied, unsupportedCase, failed } = renameTaskCase;
  const { unchecked } = completionCases[0];
  const { controls, mounts, note, renames } = await openTasksFixture(t, unchecked);
  const { state: { document: { groups } } } = mounts.at(-1).element.props;
  const [task] = groups.flatMap(({ tasks }) => tasks);
  const rename = (title) => mounts.at(-1).element.props.onRenameTask({ task, title, sourceMarkdown: unchecked });
  assert.match((await rename(invalidTitle)).message, invalid);
  assert.match((await rename(caseOnlyTitle)).message, unsupportedCase);
  controls.unindexedPaths = [newPath];
  assert.match((await rename(newTitle)).message, occupied);
  controls.unindexedPaths = [];
  controls.renameFailure = true;
  assert.match((await rename(newTitle)).message, failed);
  assert.equal(note.path, oldPath);
  assert.equal(controls.markdown, unchecked);
  assert.deepEqual(renames, []);
});

test("переименование показывает целые снимки между событиями файла и ссылки", async (t) => {
  const { oldPath, newPath, newTitle } = renameTaskCase;
  const { unchecked } = completionCases[0];
  const { controls, mounts, emitModify } = await openTasksFixture(t, unchecked);
  const current = () => mounts.at(-1).element.props;
  const shownTask = () => current().state.document.groups.flatMap(({ tasks }) => tasks)[0];
  const { onRenameTask } = current();
  const delayedRead = Promise.withResolvers();
  const renamed = Promise.withResolvers();
  const updateLinks = Promise.withResolvers();
  controls.beforeRenameLinks = () => {
    renamed.resolve();
    return updateLinks.promise;
  };

  controls.nextRead = delayedRead.promise;
  await emitModify();
  const pending = onRenameTask({ task: shownTask(), title: newTitle, sourceMarkdown: unchecked });
  await renamed.promise;
  await new Promise(setImmediate);
  const { notePath: duringRename } = shownTask();
  delayedRead.resolve(unchecked);
  await new Promise(setImmediate);
  const { notePath: afterDelayedRead } = shownTask();
  updateLinks.resolve();
  assert.equal((await pending).ok, true);
  assert.equal(duringRename, oldPath);
  assert.equal(afterDelayedRead, oldPath);
  assert.equal(shownTask().notePath, newPath);

  appendExternalListEdit(controls);
  await emitModify();
  assert.equal(current().state.document.sourceMarkdown, controls.markdown);
});

test("переименование после внешней правки требует повторного подтверждения", async (t) => {
  const { oldPath, newPath, newTitle, changed } = renameTaskCase;
  const { unchecked } = completionCases[0];
  const { controls, mounts, note, renames } = await openTasksFixture(t, unchecked);
  const { state: { document: { groups } } } = mounts.at(-1).element.props;
  const [task] = groups.flatMap(({ tasks }) => tasks);
  const rename = (sourceMarkdown) => mounts.at(-1).element.props.onRenameTask({ task, title: newTitle, sourceMarkdown });
  appendExternalListEdit(controls);
  const first = await rename(unchecked);
  assert.match(first.message, changed);
  assert.equal(first.latestSourceMarkdown, controls.markdown);
  assert.equal(note.path, oldPath);
  assert.deepEqual(renames, []);
  const next = await rename(first.latestSourceMarkdown);
  assert.deepEqual({ ...next }, { ok: true, taskPath: newPath });
  assert.ok(controls.markdown.endsWith(externalListEdit));
});

test("отказ обновления ссылок сообщает об уже переименованном файле", async (t) => {
  const { newPath, newTitle, partial } = renameTaskCase;
  const { unchecked } = completionCases[0];
  const { controls, mounts, note, renames, writes } = await openTasksFixture(t, unchecked);
  const { onRenameTask, state: { document: { groups } } } = mounts.at(-1).element.props;
  const [task] = groups.flatMap(({ tasks }) => tasks);
  controls.renameLinkFailure = true;
  const request = { task, title: newTitle, sourceMarkdown: unchecked };
  const result = await onRenameTask(request);
  assert.match(result.message, partial);
  assert.ok(result.message.includes(newPath));
  assert.equal(note.path, newPath);
  assert.equal(controls.markdown, unchecked);
  const retry = await mounts.at(-1).element.props.onRenameTask(request);
  assert.equal(retry.ok, false);
  assert.deepEqual(renames, [newPath]);
  assert.deepEqual(writes, []);
});

test("частичный сбой создания допускает добавление того же файла и ID", async (t) => {
  const { mounts, controls, writes, createdNotes } = await openTasksFixture(t, createTaskMarkdown);
  const { title, projectPath, notePath, row } = createTaskCase;
  const create = (pending) => mounts.at(-1).element.props.onCreateTask({ title, projectPath, pending });
  controls.beforeProcess = () => appendExternalListEdit(controls);
  const result = await create();
  assert.equal(result.ok, false);
  assert.equal(result.pending.path, notePath);
  assert.equal(createdNotes.size, 1);
  assert.equal(controls.markdown, `${createTaskMarkdown}${externalListEdit}`);
  const { markdown } = createdNotes.get(notePath);
  assert.deepEqual(writes, []);

  controls.beforeProcess = undefined;
  assert.deepEqual({ ...await create(result.pending) }, { ok: true, taskPath: notePath });
  assert.deepEqual({ ...await create(result.pending) }, { ok: true, taskPath: notePath });
  assert.equal(createdNotes.get(notePath).markdown, markdown);
  assert.equal(writes.length, 1);
  assert.equal(controls.markdown.split(row).length, 2);
});

test("создание останавливается при уже существующей неразрешённой ссылке", async (t) => {
  const { mounts, createdNotes, writes } = await openTasksFixture(t, danglingCreateTaskMarkdown);
  const { title, projectPath } = createTaskCase;
  const result = await mounts.at(-1).element.props.onCreateTask({ title, projectPath });
  assert.equal(result.ok, false);
  assert.equal(createdNotes.size, 0);
  assert.deepEqual(writes, []);
});

test("создание сверяет проект перед созданием заметки после чтения исходника", async (t) => {
  const { mounts, controls, createdNotes, writes, projectNote } = await openTasksFixture(t, createTaskMarkdown);
  const { title, projectPath, redirectedProjectPath } = createTaskCase;
  controls.beforeReadSource = () => { projectNote.path = redirectedProjectPath; };
  const { onCreateTask } = mounts.at(-1).element.props;
  const result = await onCreateTask({ title, projectPath });
  assert.equal(result.ok, false);
  assert.equal(result.pending, undefined);
  assert.equal(createdNotes.size, 0);
  assert.deepEqual(writes, []);
});

test("повтор сохраняет частичный результат, если созданный файл уже в другой группе", async (t) => {
  const { mounts, controls, emitModify, createdNotes, writes } = await openTasksFixture(t, createTaskMarkdown);
  const { title, projectPath } = createTaskCase;
  const create = (pending) => mounts.at(-1).element.props.onCreateTask({ title, projectPath, pending });
  controls.beforeProcess = () => appendExternalListEdit(controls);
  const { pending } = await create();
  assert.ok(pending);

  controls.beforeProcess = undefined;
  controls.markdown = createTaskAlreadyToday;
  await emitModify();
  const retry = await create(pending);
  assert.equal(retry.ok, false);
  assert.deepEqual(retry.pending, pending);
  assert.match(retry.message, completionFeedback.duplicate);
  assert.deepEqual(writes, []);
  assert.equal(createdNotes.size, 1);
});

test("создание учитывает неразрешённую ссылку на заголовок той же заметки", async (t) => {
  const { mounts, createdNotes, writes } = await openTasksFixture(t, danglingHeadingTaskMarkdown);
  const { title, projectPath } = createTaskCase;
  const { onCreateTask } = mounts.at(-1).element.props;
  const result = await onCreateTask({ title, projectPath });
  assert.equal(result.ok, false);
  assert.match(result.message, completionFeedback.duplicate);
  assert.deepEqual(writes, []);
  assert.equal(createdNotes.size, 0);
});

test("настроенный значок проекта виден в карточке и в «Сегодня»", async (t) => {
  const { controls, mounts, emitModify } = await openTasksFixture(t, completionCases[0].unchecked);
  const { projectIcons, emojiMatches, fallbackMatches } = iconizeFixture;
  controls.iconize = projectIcons;
  await emitModify();
  assert.equal([...mounts.at(-1).markup.matchAll(emojiMatches)].length, 2);

  controls.iconize = undefined;
  await emitModify();
  assert.equal([...mounts.at(-1).markup.matchAll(fallbackMatches)].length, 2);
});

test("значок проекта в корне игнорирует настройки несвязанного пути", async (t) => {
  const { controls, mounts, emitModify, projectNote } = await openTasksFixture(t, createTaskMarkdown);
  const { rootNote: { path, unrelated, emoji }, fallbackMatches } = iconizeFixture;
  projectNote.path = path;
  controls.iconize = unrelated;
  await emitModify();
  const { markup } = mounts.at(-1);
  assert.doesNotMatch(markup, emoji);
  assert.match(markup, fallbackMatches);
});

function findShownTask(groups, taskTitle) {
  const task = groups.flatMap(({ tasks }) => tasks).find(({ title }) => title === taskTitle);
  assert.ok(task);
  return task;
}

function moveShownTask(mounts, taskTitle = moveFeedback.title) {
  const { onMoveTask, state: { document: { groups } } } = mounts.at(-1).element.props;
  const task = findShownTask(groups, taskTitle);
  assert.equal(typeof onMoveTask, "function", "вкладка подключает команду переноса");
  return () => onMoveTask(task);
}

function reorderShownTask(mounts, destinationTitle, sourceTitle = reorderTasks.first) {
  const { onReorderTask, state: { document: { groups } } } = mounts.at(-1).element.props;
  const source = findShownTask(groups, sourceTitle);
  const { line } = findShownTask(groups, destinationTitle);
  assert.equal(typeof onReorderTask, "function", "вкладка подключает перестановку активных задач");
  return onReorderTask(source, line);
}

test("перестановка сохраняет активный порядок «Сегодня» и проекта после переоткрытия", async (t) => {
  const { first, last, expectedOrder } = reorderTasks;
  for (const { initial, reordered } of reorderCases) {
    const fixture = await openTasksFixture(t, initial);
    const { mounts, writes, leaves, ribbonClick } = fixture;
    await reorderShownTask(mounts, first);
    assert.deepEqual(writes, []);
    await reorderShownTask(mounts, last);
    assert.deepEqual(writes, [reordered]);

    await fixture.activeLeaf.view.onClose();
    leaves.pop();
    await ribbonClick();
    const { state: { document: { groups: [{ tasks }] } } } = mounts.at(-1).element.props;
    assert.deepEqual(Array.from(tasks, ({ title }) => title), expectedOrder);
  }
});

test("перестановка отвергает другую группу, выполненную задачу, комментарий и внешний конфликт", async (t) => {
  const { initial, annotated } = reorderCases[0];
  const { otherGroup, completed, second } = reorderTasks;
  const { mounts, notices, controls, writes, emitModify } = await openTasksFixture(t, initial);
  await reorderShownTask(mounts, otherGroup);
  await reorderShownTask(mounts, completed);
  assert.equal(controls.markdown, initial);

  controls.beforeProcess = () => appendExternalListEdit(controls);
  await reorderShownTask(mounts, second);
  assert.equal(controls.markdown, `${initial}${externalListEdit}`);
  assert.match(notices.at(-1), completionFeedback.conflict);

  controls.beforeProcess = undefined;
  controls.markdown = annotated;
  await emitModify();
  await reorderShownTask(mounts, second);
  assert.equal(controls.markdown, annotated);
  assert.match(notices.at(-1), moveFeedback.annotation);
  assert.deepEqual(writes, []);
});

test("перестановка сохраняет соседство комментариев на краях блока", async (t) => {
  const { second } = reorderTasks;
  for (const { title, markdown } of reorderWithEdgeText) {
    await t.test(title, async (subtest) => {
      const { mounts, notices, controls, writes } = await openTasksFixture(subtest, markdown);
      await reorderShownTask(mounts, second);
      assert.deepEqual(writes, []);
      assert.equal(controls.markdown, markdown);
      assert.match(notices.at(-1), moveFeedback.annotation);
    });
  }
});

test("комментарии на краях не мешают перестановке внутри блока", async (t) => {
  const { initial, reordered } = reorderInsideEdgeText;
  const { last, second } = reorderTasks;
  const { mounts, writes } = await openTasksFixture(t, initial);
  await reorderShownTask(mounts, last, second);
  assert.deepEqual(writes, [reordered]);
});

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
  controls.beforeProcess = () => appendExternalListEdit(controls);
  await moveShownTask(mounts)();
  assert.equal(controls.markdown, `${initial}${externalListEdit}`);
  assert.match(notices.at(-1), completionFeedback.conflict);

  controls.beforeProcess = () => { controls.projectLinkDestination = null; };
  await moveShownTask(mounts)();
  assert.equal(controls.markdown, `${initial}${externalListEdit}`);
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
  const { onMoveTask, onSetCompleted, onChangePeriod } = props;
  assert.match(markup, moveFeedback.duplicatePeriod);
  assert.match(markup, moveFeedback.disabledMove);
  assert.equal(onMoveTask, undefined);
  assert.equal(onSetCompleted, undefined);
  assert.equal(onChangePeriod, undefined);
  assert.deepEqual(writes, []);
});

test("переключатель называет следующее действие с выполненными задачами", async () => {
  const { outputFiles: [bundle] } = await build({
    absWorkingDir: project,
    entryPoints: ["src/pages/current-tasks/ui/TasksToolbar/index.ts"],
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
    const tools = toolbar.props.children.find(({ props }) => props.role === "group");
    const toggle = tools?.props.children.find(({ props }) => props["aria-label"] === label);
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

function visibleTaskLabels(markup) {
  return [...markup.matchAll(taskCheckboxLabel)].map(([, title]) => title);
}

test("выполненные видны по умолчанию после активных даже в смешанном списке", async (t) => {
  const [[initial]] = completionOrderCases;
  const { mounts, writes } = await openTasksFixture(t, initial);
  const { markup } = mounts.at(-1);
  assert.match(markup, tasksDesign.showCompleted);
  assert.deepEqual(visibleTaskLabels(markup), visibleTaskOrderBeforeWrite);
  assert.deepEqual(writes, []);
});

async function openWithViewSettings(settings, markdown) {
  const fixture = await createCurrentTasksFixture({ settings });
  const { controls, mounts, ribbonClick, writes } = fixture;
  controls.markdown = markdown;
  await ribbonClick();
  const { markup, element: { props: { preferences } } } = mounts.at(-1);
  return { fixture, markup, preferences, writes };
}

function pauseSettingsSave(settings, isVisible) {
  const { promise: started, resolve: announceStart } = Promise.withResolvers();
  const { promise: paused, resolve: resume } = Promise.withResolvers();
  settings.beforeSave = ({ showCompleted: isCompletedVisible }) => {
    if (isCompletedVisible !== isVisible) return;
    announceStart();
    return paused;
  };
  return { started, resume };
}

test("видимость выполненных восстанавливается после перезапуска плагина", async () => {
  const [[markdown]] = completionOrderCases;
  const settings = { data: existingPluginSettings };
  const initial = await openWithViewSettings(settings, markdown);
  assert.match(initial.markup, tasksDesign.hideCompleted);
  assert.deepEqual(visibleTaskLabels(initial.markup), activeTaskOrder);

  const { started, resume } = pauseSettingsSave(settings, true);
  const show = initial.preferences.setCompletedVisible(true);
  await started;
  const hide = initial.preferences.setCompletedVisible(false);
  resume();
  await Promise.all([show, hide]);
  await initial.fixture.activeLeaf.view.onClose();

  const hidden = await openWithViewSettings(settings, markdown);
  assert.match(hidden.markup, tasksDesign.hideCompleted);
  assert.deepEqual(visibleTaskLabels(hidden.markup), activeTaskOrder);
  assert.deepEqual(settings.data, existingPluginSettings);
  settings.beforeSave = undefined;
  await hidden.preferences.setCompletedVisible(true);
  await hidden.fixture.activeLeaf.view.onClose();

  const visible = await openWithViewSettings(settings, markdown);
  assert.match(visible.markup, tasksDesign.showCompleted);
  assert.deepEqual(visibleTaskLabels(visible.markup), visibleTaskOrderBeforeWrite);
  assert.deepEqual(settings.data, visiblePluginSettings);
  assert.deepEqual([...initial.writes, ...hidden.writes, ...visible.writes], []);
  await visible.fixture.activeLeaf.view.onClose();
});

test("свёрнутые проекты и видимость выполненных сохраняются вместе и восстанавливаются", async () => {
  const [{ markdown }] = transferTaskCases;
  const { both, first, second, afterSave } = collapsedProjectSettings;
  const settings = { data: existingPluginSettings };
  const initial = await openWithViewSettings(settings, markdown);
  assert.match(initial.markup, tasksDesign.collapseProjects);
  const { started, resume } = pauseSettingsSave(settings, false);
  const collapse = initial.preferences.setProjectsCollapsed(both, true);
  await started;
  const show = initial.preferences.setCompletedVisible(true);
  resume();
  await Promise.all([collapse, show]);
  await initial.fixture.activeLeaf.view.onClose();

  const reopened = await openWithViewSettings(settings, markdown);
  assert.match(reopened.markup, tasksDesign.expandProjects);
  assert.match(reopened.markup, tasksDesign.showCompleted);
  assert.equal(reopened.preferences.get().showCompleted, true);
  assert.deepEqual([...reopened.preferences.get().collapsedProjects], both);
  assert.deepEqual(settings.data, afterSave);
  await reopened.preferences.setProjectsCollapsed(first, false);
  assert.deepEqual([...reopened.preferences.get().collapsedProjects], second);
  await reopened.fixture.activeLeaf.view.onClose();
  assert.deepEqual([...initial.writes, ...reopened.writes], []);
});

test("сохранённое сворачивание применяется к одной карточке из двух с общей проектной заметкой", async (t) => {
  const { settings, firstCollapsed, secondExpanded } = repeatedProjectPanels;
  const { fixture, markup, writes } = await openWithViewSettings({ data: settings }, repeatedBlogPanels);
  t.after(() => fixture.activeLeaf.view.onClose());

  assert.match(markup, firstCollapsed);
  assert.match(markup, secondExpanded);
  assert.match(markup, tasksDesign.collapseProjects);
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
    entryPoints: ["src/pages/current-tasks/ui/NoteLink/index.ts"],
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
    errors = `${errors}${text}`;
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
  const after = before.replace(originalHeadingContent, probe);
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
