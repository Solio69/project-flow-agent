import { noteName } from "../../../../shared/lib/note-path";
import { PROJECT_APPEARANCES } from "./project-appearance.constants";

export function projectAppearance(path?: string) {
  const name = path && noteName(path);
  return name ? PROJECT_APPEARANCES.get(name.toLowerCase()) : undefined;
}
