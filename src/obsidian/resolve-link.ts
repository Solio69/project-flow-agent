import { parseLinktext, type App } from "obsidian";

export function resolveLink({ metadataCache, vault }: App, sourcePath: string, link: string) {
  const { path, subpath } = parseLinktext(link);
  const file = path
    ? metadataCache.getFirstLinkpathDest(path, sourcePath)
    : vault.getFileByPath(sourcePath);
  return { file, subpath };
}
