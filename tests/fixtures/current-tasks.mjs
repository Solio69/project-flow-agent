import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { legacyTasks } from "./current-tasks-markdown.mjs";
import {
  blogTaskMarkdown, completionReviewNotes, currentTasksExpected, differentTaskNoteMarkdown,
  projectLinkCase, sourceNotePaths, taskNoteMarkdown,
} from "./scaffold-data.mjs";

const require = createRequire(import.meta.url);
const project = fileURLToPath(new URL("../../", import.meta.url));
const { viewTitle } = currentTasksExpected;
const { note: { title: projectTitle, link: projectLink, notePath: projectNotePath } } = projectLinkCase;
const projectLinks = [projectTitle, projectLink];
const { second, replacement, blog, blogTask } = completionReviewNotes;

function taskFile(path) {
  return { path, stat: { mtime: 0, size: taskNoteMarkdown.length } };
}

export async function createCurrentTasksFixture() {
  const { outputFiles: [bundle] } = await build({
    absWorkingDir: project,
    entryPoints: ["src/main.ts"],
    bundle: true,
    format: "cjs",
    external: ["obsidian", "react", "react-dom", "zod"],
    write: false,
  });

  let ribbonClick;
  const views = new Map();
  const leaves = [];
  const mounts = [];
  const notices = [];
  const listeners = new Map();
  const openedNotes = [];
  const writes = [];
  const source = { path: sourceNotePaths.legacy };
  const renamedSource = { path: sourceNotePaths.renamed };
  const note = taskFile("Мастерская/project inbox/Черновик.md");
  const secondNote = taskFile(second.path);
  const replacementNote = taskFile(replacement.path);
  const blogTaskNote = taskFile(blogTask.path);
  const blogNote = { path: blog.path };
  const projectNote = { path: projectNotePath };
  const controls = {
    markdown: legacyTasks,
    sourceAvailable: true,
    renamedSourceAvailable: false,
    nextRead: undefined,
    failNextOpen: false,
    failNextNoteOpen: false,
    taskMarkdown: taskNoteMarkdown,
    secondTaskMarkdown: differentTaskNoteMarkdown,
    shortLinkDestination: note,
    projectLinkDestination: projectNote,
    beforeProcess: undefined,
  };
  const noteReaders = new Map([
    [note, () => controls.taskMarkdown],
    [secondNote, () => controls.secondTaskMarkdown],
    [replacementNote, () => differentTaskNoteMarkdown],
    [blogTaskNote, () => blogTaskMarkdown],
  ]);
  const relatedNotes = new Map([
    projectNote, blogNote, ...noteReaders.keys(),
  ].map((file) => [file.path, file]));
  const readTaskNote = (file) => noteReaders.get(file)?.();
  let activeLeaf;

  class Plugin {
    constructor(app) {
      this.app = app;
    }

    registerView(type, makeView) {
      views.set(type, makeView);
    }

    addRibbonIcon(_icon, title, onClick) {
      assert.equal(title, viewTitle);
      ribbonClick = onClick;
    }
  }

  class ItemView {
    contentEl = {};
    navigation = false;

    constructor(leaf) {
      this.app = leaf.app;
      this.leaf = leaf;
    }
  }

  class Notice {
    constructor(message) {
      notices.push(message);
    }
  }

  const workspace = {
    getLeavesOfType(type) {
      return leaves.filter((leaf) => leaf.view?.getViewType() === type);
    },
    getLeaf(kind) {
      assert.equal(kind, "tab");
      const leaf = {
        app,
        history: [],
        pinned: false,
        getViewState() {
          return { pinned: this.pinned };
        },
        async setViewState({ type }) {
          await Promise.resolve();
          if (controls.failNextOpen) {
            controls.failNextOpen = false;
            throw new Error("Вкладка недоступна");
          }
          this.view = views.get(type)(this);
          await this.view.onOpen();
        },
        detach() {
          leaves.splice(leaves.indexOf(this), 1);
        },
        async openFile(file, { active } = {}) {
          if (controls.failNextNoteOpen) {
            controls.failNextNoteOpen = false;
            throw new Error("Заметка недоступна");
          }
          openedNotes.push(file.path);
          if (this.view?.navigation) this.history.push(this.view.getViewType());
          await this.view?.onClose?.();
          this.view = undefined;
          if (active) activeLeaf = this;
        },
        async goBack() {
          await this.setViewState({ type: this.history.pop() });
        },
      };
      leaves.push(leaf);
      return leaf;
    },
    async revealLeaf(leaf) {
      activeLeaf = leaf;
    },
  };

  const vault = {
    getFileByPath(path) {
      if (controls.renamedSourceAvailable && renamedSource.path === path) return renamedSource;
      if (controls.sourceAvailable && source.path === path) return source;
      return relatedNotes.get(path) ?? null;
    },
    async cachedRead(file) {
      const taskText = readTaskNote(file);
      if (taskText !== undefined) return taskText;
      const pending = controls.nextRead;
      controls.nextRead = undefined;
      return pending ?? controls.markdown;
    },
    async read(file) {
      return readTaskNote(file) ?? controls.markdown;
    },
    async process(file, update) {
      assert.ok(file === source || file === renamedSource);
      await controls.beforeProcess?.();
      const previous = controls.markdown;
      const next = update(previous);
      if (next !== previous) writes.push(next);
      controls.markdown = next;
      return next;
    },
    on(event, callback) {
      const ref = { event, callback };
      listeners.set(ref, callback);
      return ref;
    },
    offref(ref) {
      listeners.delete(ref);
    },
  };
  const emitModify = (file = source) => {
    for (const [ref, callback] of listeners) {
      if (ref.event === "modify") callback(file);
    }
    return new Promise(setImmediate);
  };

  const module = { exports: {} };
  runInNewContext(bundle.text, {
    module,
    exports: module.exports,
    console: { error() {} },
    require(name) {
      if (name === "obsidian") {
        return {
          Plugin, ItemView, Notice,
          parseLinktext: (link) => ({ path: link, subpath: "" }),
          getFrontMatterInfo: (text) => ({ exists: true, frontmatter: text.split("---")[1] }),
          parseYaml: (text) => ({ id: text.match(/^id: (.+)$/m)?.[1] }),
        };
      }
      if (name === "react-dom/client") {
        return {
          createRoot() {
            const mount = {
              render(element) {
                this.element = element;
                this.markup = renderToStaticMarkup(element);
              },
              unmount() {
                this.closed = true;
              },
            };
            mounts.push(mount);
            return mount;
          },
        };
      }
      return require(name);
    },
  });

  const metadataCache = {
    getFirstLinkpathDest(link, from) {
      assert.ok([source.path, renamedSource.path].includes(from));
      if (projectLinks.includes(link)) return controls.projectLinkDestination;
      if (link === second.link) return secondNote;
      if (link === blog.link) return blogNote;
      if (link === blogTask.link) return blogTaskNote;
      if (link === "Черновик") return controls.shortLinkDestination;
      return link === "Мастерская/project inbox/Черновик" ? note : null;
    },
  };
  const app = { workspace, vault, metadataCache };
  const plugin = new module.exports.default(app);
  await plugin.onload?.();

  return {
    controls,
    views,
    leaves,
    mounts,
    notices,
    listeners,
    openedNotes,
    writes,
    note,
    replacementNote,
    projectNote,
    renamedSource,
    workspace,
    ribbonClick,
    emitModify,
    get activeLeaf() {
      return activeLeaf;
    },
  };
}
