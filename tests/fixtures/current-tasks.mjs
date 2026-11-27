import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { externalListEdit, legacyTasks } from "./current-tasks-markdown.mjs";
import {
  archiveTaskCase, blogTaskMarkdown, completionReviewNotes, createTaskCase, currentTasksExpected, differentTaskNoteMarkdown,
  iconizeFixture, notePathCopy, projectLinkCase, renameTaskCase, sourceNotePaths, taskNoteMarkdown, transferTaskCase,
} from "./scaffold-data.mjs";

const require = createRequire(import.meta.url);

export function createClipboardFixture() {
  const copied = [];
  const clipboard = { async writeText(value) { copied.push(value); } };
  return { clipboard, copied };
}

export function appendExternalListEdit(controls) {
  controls.markdown = `${controls.markdown}${externalListEdit}`;
}
const project = fileURLToPath(new URL("../../", import.meta.url));
const { viewTitle } = currentTasksExpected;
const { note: { title: projectTitle, link: projectLink, notePath: projectNotePath } } = projectLinkCase;
const projectLinks = [projectTitle, projectLink];
const { second, replacement, blog, blogTask } = completionReviewNotes;

function taskFile(path) {
  return { path, stat: { mtime: 0, size: taskNoteMarkdown.length } };
}

export async function createCurrentTasksFixture({ settings = {} } = {}) {
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
  const renames = [];
  const createdNotes = new Map();
  const source = taskFile(sourceNotePaths.legacy);
  const renamedSource = taskFile(sourceNotePaths.renamed);
  const note = taskFile(renameTaskCase.oldPath);
  const taskAttachment = taskFile(notePathCopy.attachment);
  const secondNote = taskFile(second.path);
  const replacementNote = taskFile(replacement.path);
  const blogTaskNote = taskFile(blogTask.path);
  const blogNote = { path: blog.path };
  const projectNote = { path: projectNotePath };
  const inbox = { path: createTaskCase.inboxPath, children: [] };
  const archive = { path: archiveTaskCase.folder, children: [] };
  const blogInbox = { path: transferTaskCase.inboxPath, children: [] };
  const controls = {
    iconize: iconizeFixture.defaultIcons,
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
    beforeReadSource: undefined,
    beforeCheckPath: undefined,
    beforeProcess: undefined,
    unindexedPaths: [],
    archiveAvailable: true,
    renameFailure: false,
    renameLinkFailure: false,
    updateLinksAfterRename: true,
    beforeRenameLinks: undefined,
  };
  const noteReaders = new Map([
    [note, () => controls.taskMarkdown],
    [secondNote, () => controls.secondTaskMarkdown],
    [replacementNote, () => differentTaskNoteMarkdown],
    [blogTaskNote, () => blogTaskMarkdown],
  ]);
  const relatedNotes = new Map([
    projectNote, blogNote, taskAttachment, ...noteReaders.keys(),
  ].map((file) => [file.path, file]));
  const readTaskNote = (file) => noteReaders.get(file)?.();
  let activeLeaf;

  class Plugin {
    constructor(app) {
      this.app = app;
    }

    async loadData() {
      return structuredClone(settings.data);
    }

    async saveData(data) {
      await settings.beforeSave?.(data);
      settings.data = structuredClone(data);
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
    contentEl = { ownerDocument: { defaultView: null } };
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

  class FileSystemAdapter {
    getFullPath(path) {
      return `${notePathCopy.root}\\${path.replaceAll("/", "\\")}`;
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
    configDir: ".obsidian",
    adapter: Object.assign(new FileSystemAdapter(), {
      async exists(path) {
        await controls.beforeCheckPath?.(path);
        const comparable = path.toLowerCase();
        return controls.unindexedPaths.some((entry) => entry.toLowerCase() === comparable);
      },
      async read(path) {
        assert.equal(path, ".obsidian/plugins/obsidian-icon-folder/data.json");
        if (!controls.iconize) throw new Error("Iconize data unavailable");
        return JSON.stringify(controls.iconize);
      },
    }),
    getFolderByPath(path) {
      if (path === archive.path) return controls.archiveAvailable ? archive : null;
      return path === inbox.path ? inbox : path === blogInbox.path ? blogInbox : null;
    },
    getAbstractFileByPath(path) {
      return this.getFileByPath(path) ?? this.getFolderByPath(path);
    },
    getFileByPath(path) {
      if (controls.renamedSourceAvailable && renamedSource.path === path) return renamedSource;
      if (controls.sourceAvailable && source.path === path) return source;
      return createdNotes.get(path)?.file ?? relatedNotes.get(path) ?? null;
    },
    async create(path, markdown) {
      assert.equal(this.getAbstractFileByPath(path), null);
      const file = taskFile(path);
      createdNotes.set(path, { file, markdown });
      return file;
    },
    async cachedRead(file) {
      const taskText = createdNotes.get(file.path)?.markdown ?? readTaskNote(file);
      if (taskText !== undefined) return taskText;
      const pending = controls.nextRead;
      controls.nextRead = undefined;
      return pending ?? controls.markdown;
    },
    async read(file) {
      if (file === source || file === renamedSource) await controls.beforeReadSource?.();
      return createdNotes.get(file.path)?.markdown ?? readTaskNote(file) ?? controls.markdown;
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
  const emit = (event, file, oldPath) => {
    for (const [ref, callback] of listeners) {
      if (ref.event === event) callback(file, oldPath);
    }
  };
  const emitModify = (file = source) => {
    emit("modify", file);
    return new Promise(setImmediate);
  };

  const module = { exports: {} };
  runInNewContext(bundle.text, {
    module,
    exports: module.exports,
    crypto: webcrypto,
    console: { error() {} },
    require(name) {
      if (name === "obsidian") {
        return {
          FileSystemAdapter,
          Plugin, ItemView, Notice,
          parseLinktext(link) {
            const fragmentStart = link.indexOf("#");
            return fragmentStart === -1
              ? { path: link, subpath: "" }
              : { path: link.slice(0, fragmentStart), subpath: link.slice(fragmentStart) };
          },
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
      if (createdNotes.has(link)) return createdNotes.get(link).file;
      return relatedNotes.get(link) ?? relatedNotes.get(`${link}.md`) ?? null;
    },
  };
  const fileManager = {
    async renameFile(file, path) {
      if (controls.renameFailure) throw new Error("Filesystem rejected rename");
      assert.equal(vault.getAbstractFileByPath(path), null);
      const { path: previous } = file;
      relatedNotes.delete(previous);
      file.path = path;
      relatedNotes.set(path, file);
      renames.push(path);
      emit("rename", file, previous);
      await controls.beforeRenameLinks?.();
      if (controls.renameLinkFailure) throw new Error("Link update rejected");
      if (controls.updateLinksAfterRename) {
        controls.markdown = controls.markdown
          .replaceAll(renameTaskCase.oldLink, path.slice(0, -3))
          .replaceAll("[[Черновик]]", `[[${path.slice(0, -3)}]]`);
        emit("modify", source);
      }
    },
  };
  const app = { workspace, vault, metadataCache, fileManager };
  const plugin = new module.exports.default(app);
  await plugin.onload?.();

  return {
    controls,
    taskAttachment,
    views,
    leaves,
    mounts,
    notices,
    listeners,
    openedNotes,
    writes,
    renames,
    createdNotes,
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
