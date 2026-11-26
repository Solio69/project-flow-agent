import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";
import {
  aliasedProjectHeading,
  brokenProjectHeading,
  legacyFormat,
  malformedActions,
  propertiesFormat,
  reversedPeriod,
} from "./fixtures/current-tasks-parser.mjs";

const require = createRequire(import.meta.url);
const { outputFiles: [bundle] } = await build({
  absWorkingDir: fileURLToPath(new URL("../", import.meta.url)),
  entryPoints: ["src/pages/current-tasks/model/parse-current-tasks.ts"],
  bundle: true,
  external: ["zod"],
  platform: "node",
  format: "cjs",
  write: false,
});
const module = { exports: {} };
new Function("module", "exports", "require", bundle.text)(module, module.exports, require);
const { parseCurrentTasks } = module.exports;

const groupTitles = (groups) => groups.map(({ title }) => title);
const diagnosticLines = (diagnostics) => diagnostics.map(({ line }) => line);

test("чтение действующего формата сохраняет группы, галочки и текст строк", () => {
  const { markdown, expected } = legacyFormat;
  const { format, period, groups, diagnostics } = parseCurrentTasks(markdown);
  const tasks = groups.flatMap((group) => group.tasks);
  const taskDetails = tasks.map(({ title, completed, link }) => [title, completed, link]);

  assert.equal(format, expected.format);
  assert.deepEqual(period, expected.period);
  assert.deepEqual(groupTitles(groups), expected.groupTitles);
  assert.deepEqual(groups.map(({ link }) => link), expected.groupLinks);
  assert.deepEqual(taskDetails, expected.tasks);
  assert.deepEqual(diagnostics, expected.diagnostics);
});

test("чтение дат из свойств и группы «Сегодня»", () => {
  const { markdown, expected } = propertiesFormat;
  const { format, period, groups, diagnostics } = parseCurrentTasks(markdown);

  assert.equal(format, expected.format);
  assert.deepEqual(period, expected.period);
  assert.deepEqual(groups.map(({ kind, title }) => [kind, title]), expected.groups);
  assert.deepEqual(diagnostics, expected.diagnostics);
});

test("ошибочная дата и строки с нарушенным форматом не скрывают читаемые задачи", () => {
  const { markdown, expected } = malformedActions;
  const { period, diagnostics, groups: [group] } = parseCurrentTasks(markdown);
  const { tasks } = group;

  assert.equal(period, expected.period);
  assert.deepEqual(diagnosticLines(diagnostics), expected.diagnosticLines);
  assert.deepEqual(tasks.map(({ title }) => title), expected.taskTitles);
});

test("перевёрнутый период получает диагностику", () => {
  const { markdown, expected } = reversedPeriod;
  const { period, diagnostics: [{ line, message }] } = parseCurrentTasks(markdown);

  assert.equal(period, expected.period);
  assert.equal(line, expected.diagnosticLine);
  assert.match(message, expected.diagnosticMessage);
});

test("оборванный заголовок проекта виден в диагностике", () => {
  const { markdown, expected } = brokenProjectHeading;
  const { diagnostics, groups } = parseCurrentTasks(markdown);

  assert.deepEqual(diagnosticLines(diagnostics), expected.diagnosticLines);
  assert.deepEqual(groupTitles(groups), expected.groupTitles);
});

test("проектный заголовок сохраняет путь и псевдоним ссылки", () => {
  const { markdown, expected } = aliasedProjectHeading;
  const { groups: [group] } = parseCurrentTasks(markdown);

  assert.equal(group?.title, expected.title);
  assert.equal(group?.link, expected.link);
});
