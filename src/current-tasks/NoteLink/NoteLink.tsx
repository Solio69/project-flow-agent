import type { MouseEvent } from "react";
import { LINK_FRAGMENT_PREFIX } from "../../obsidian/constants";
import { MIDDLE_MOUSE_BUTTON } from "./constants";

export type OpenNote = (link: string, forceNewTab?: boolean) => Promise<void>;

export function NoteLink({ note, onOpenNote, draggable }: {
  note: { title: string; link?: string; notePath?: string };
  onOpenNote: OpenNote;
  draggable?: boolean;
}) {
  const { title, link, notePath } = note;
  if (!link || !notePath) return title;

  const href = LINK_FRAGMENT_PREFIX + encodeURIComponent(link);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const { ctrlKey, metaKey } = event;
    event.preventDefault();
    void onOpenNote(link, ctrlKey || metaKey);
  };

  const handleAuxClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const { button } = event;
    if (button !== MIDDLE_MOUSE_BUTTON) return;
    event.preventDefault();
    void onOpenNote(link, true);
  };

  return (
    <a
      href={href}
      draggable={draggable}
      onClick={handleClick}
      onAuxClick={handleAuxClick}
    >{title}</a>
  );
}
