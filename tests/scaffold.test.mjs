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
import { createCurrentActionsFixture } from "./fixtures/current-actions.mjs";
import { obsoleteActions, propertyActions } from "./fixtures/current-actions-markdown.mjs";
import { currentActionsExpected, projectLinkCase, watchFixture } from "./fixtures/scaffold-data.mjs";

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
} = currentActionsExpected;
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
  const fixture = await createCurrentActionsFixture();
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

test("список применяет только актуальное чтение и освобождает подписки при закрытии", async () => {
  const fixture = await createCurrentActionsFixture();
  const { controls, mounts, listeners, ribbonClick, emitModify } = fixture;
  await ribbonClick();

  let finishOldRead;
  controls.nextRead = new Promise((resolve) => { finishOldRead = resolve; });
  await emitModify();
  controls.markdown = propertyActions;
  await emitModify();
  finishOldRead(obsoleteActions);
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
  const fixture = await createCurrentActionsFixture();
  const { controls, leaves, mounts, notices, listeners, openedNotes, note, projectNote, workspace, ribbonClick } = fixture;
  controls.markdown = propertyActions;
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
    entryPoints: ["src/current-actions/NoteLink/index.ts"],
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
