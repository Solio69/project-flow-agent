import {
  useLayoutEffect, useRef, useState,
  type DragEvent, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent,
} from "react";
import { DOM_EVENT, POINTER_ID_FIELD, KEYBOARD_KEY } from "../../../../shared/lib/dom";
import { EMPTY_STRING } from "../../../../shared/lib";
import type { LinkedTask, LinkedTaskGroup } from "../../model/linked-tasks";
import { isEditableTask, type EditableTask } from "../../model/task-edit";
import { canRestoreTaskFocus, focusTaskControl } from "../task-focus";
import type { ReorderTask } from "../../model/task-reorder";
import { CSS_FUNCTION_END, CSS_PIXEL, CSS_TRANSLATE_Y_START, TASK_REORDER } from "./constants";

const {
  row: rowSelector, handle, otherControl, listDragging, gap, ghost: ghostClass,
  mouse, touch, primaryButton, activationDistance, overlap,
} = TASK_REORDER;
const { arrowUp, arrowDown, escape } = KEYBOARD_KEY;
const { pointerMove, pointerUp, pointerCancel, lostPointerCapture, keyDown, scroll, blur } = DOM_EVENT;

function findRowIndex(tasks: readonly LinkedTask[], row: HTMLElement | null) {
  const line = Number(row?.dataset.taskLine);
  return tasks.findIndex(({ line: taskLine }) => taskLine === line);
}

function translateVertically(offset: number) {
  return offset ? `${CSS_TRANSLATE_Y_START}${offset}${CSS_PIXEL}${CSS_FUNCTION_END}` : EMPTY_STRING;
}

function insertionSlot(bounds: readonly DOMRect[], from: number, offset: number) {
  const source = bounds[from];
  const step = offset > 0 ? 1 : -1;
  let slot = from;
  //TODO: Порог сдвига считается по исходным позициям, чтобы анимация не меняла его.
  for (let index = from + step; index >= 0 && index < bounds.length; index += step) {
    const next = bounds[index];
    const threshold = next.height * overlap;
    const crossed = step > 0
      ? source.bottom + offset > next.top + threshold
      : source.top + offset < next.bottom - threshold;
    if (!crossed) break;
    slot = index;
  }
  return slot;
}

export function useTaskReorder(
  group: LinkedTaskGroup,
  active: LinkedTask[],
  expanded: boolean,
  onReorderTask?: ReorderTask,
) {
  const overlayRef = useRef<HTMLUListElement>(null);
  const cancelDrag = useRef<(() => void) | null>(null);
  const suppressClick = useRef(false);
  const pendingFocus = useRef<HTMLButtonElement | null>(null);
  const [projection, setProjection] = useState<{ group: LinkedTaskGroup; tasks: LinkedTask[] }>();
  const [hoverPaused, setHoverPaused] = useState(false);
  const tasks = projection?.group === group ? projection.tasks : active;

  useLayoutEffect(() => () => cancelDrag.current?.(), [group, expanded, onReorderTask]);

  useLayoutEffect(() => {
    const control = pendingFocus.current;
    if (!control || !canRestoreTaskFocus(control)) {
      pendingFocus.current = null;
      return;
    }
    focusTaskControl(control);
    if (onReorderTask && projection?.group !== group) pendingFocus.current = null;
  }, [group, projection, onReorderTask]);

  function commit(task: EditableTask, from: number, to: number) {
    if (!onReorderTask || from === to) return;
    const ordered = [...tasks];
    ordered.splice(from, 1);
    ordered.splice(to, 0, task);
    setProjection({ group, tasks: ordered });
    const { line } = tasks[to];
    void onReorderTask(task, line);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const { currentTarget, key } = event;
    if (!onReorderTask || cancelDrag.current || (key !== arrowUp && key !== arrowDown)) return;
    const from = findRowIndex(tasks, currentTarget.closest<HTMLElement>(rowSelector));
    const to = from + (key === arrowUp ? -1 : 1);
    const task = tasks[from];
    event.preventDefault();
    if (!task || !isEditableTask(task) || !tasks[to]) return;
    pendingFocus.current = currentTarget;
    commit(task, from, to);
  }

  function onClickCapture(event: MouseEvent<HTMLUListElement>) {
    const { detail } = event;
    if (!suppressClick.current || detail === 0) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function onDragStart(event: DragEvent<HTMLUListElement>) {
    if (cancelDrag.current) event.preventDefault();
  }

  function onPointerMove() {
    if (hoverPaused) setHoverPaused(false);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLUListElement>) {
    const {
      isPrimary, button, ctrlKey, metaKey, pointerType, currentTarget: list,
      target, clientY: startY, pointerId,
    } = event;
    if (!isPrimary || button !== primaryButton || cancelDrag.current) return;
    suppressClick.current = false;
    if (!onReorderTask || !expanded || ctrlKey || metaKey) return;

    const { ownerDocument } = list;
    const { defaultView: host } = ownerDocument;
    const overlay = overlayRef.current;
    if (!host || !overlay || !(target instanceof host.Element)) return;
    const row = target.closest<HTMLElement>(rowSelector);
    const usesHandle = target.closest(handle);
    if (!row || row.parentElement !== list) return;
    if (!usesHandle && (pointerType === touch || target.closest(otherControl))) return;

    const from = findRowIndex(tasks, row);
    const task = tasks[from];
    if (!task || !isEditableTask(task)) return;

    const rows = Array.from(list.querySelectorAll<HTMLElement>(rowSelector));
    const bounds = rows.map((element) => element.getBoundingClientRect());
    const source = bounds[from];
    const listTop = list.getBoundingClientRect().top;
    const lifetime = new AbortController();
    const { signal } = lifetime;
    let ghost: HTMLElement | undefined;
    let slot = from;
    let pointerY = startY;

    const finish = (save: boolean) => {
      lifetime.abort();
      cancelDrag.current = null;
      if (!ghost) return;
      suppressClick.current = true;
      if (pointerType === mouse) setHoverPaused(true);
      if (list.hasPointerCapture(pointerId)) list.releasePointerCapture(pointerId);
      ghost.remove();
      row.classList.remove(gap);
      list.classList.remove(listDragging);
      for (const { style } of rows) style.transform = EMPTY_STRING;
      if (save) commit(task, from, slot);
    };

    function liftRow(element: HTMLElement, layer: HTMLUListElement) {
      const clone = element.cloneNode(true) as HTMLElement;
      clone.inert = true;
      clone.classList.add(ghostClass);
      const { top, height } = source;
      clone.style.top = `${top - layer.getBoundingClientRect().top}${CSS_PIXEL}`;
      clone.style.height = `${height}${CSS_PIXEL}`;
      layer.appendChild(clone);
      element.classList.add(gap);
      list.classList.add(listDragging);
      if (pointerType !== mouse) list.setPointerCapture(pointerId);
      return clone;
    }

    function updatePosition() {
      if (!ghost) return;
      const offset = pointerY - startY + listTop - list.getBoundingClientRect().top;
      ghost.style.transform = translateVertically(offset);
      const next = insertionSlot(bounds, from, offset);
      if (next === slot) return;
      slot = next;
      rows.forEach(({ style }, index) => {
        const movesUp = index > from && index <= slot;
        const movesDown = index < from && index >= slot;
        const shift = movesUp ? -source.height : movesDown ? source.height : 0;
        style.transform = translateVertically(shift);
      });
    }

    cancelDrag.current = () => finish(false);
    host.addEventListener(pointerMove, (pointer) => {
      if (pointer.pointerId !== pointerId) return;
      if (pointerType === mouse && pointer.buttons === 0) {
        finish(false);
        return;
      }
      pointerY = pointer.clientY;
      if (!ghost) {
        if (Math.abs(pointerY - startY) < activationDistance || !row.isConnected) return;
        ghost = liftRow(row, overlay);
      }
      pointer.preventDefault();
      updatePosition();
    }, { passive: false, signal });
    host.addEventListener(pointerUp, (pointer) => {
      if (pointer.pointerId !== pointerId) return;
      const { clientX, clientY } = pointer;
      pointerY = clientY;
      updatePosition();
      const dropTarget = ownerDocument.elementFromPoint(clientX, clientY);
      finish(list.contains(dropTarget));
    }, { signal });
    host.addEventListener(pointerCancel, (pointer) => {
      if (pointer.pointerId === pointerId) finish(false);
    }, { signal });
    list.addEventListener(lostPointerCapture, (pointer) => {
      if (pointer.target === list && POINTER_ID_FIELD in pointer && pointer[POINTER_ID_FIELD] === pointerId) finish(false);
    }, { signal });
    host.addEventListener(keyDown, (keyEvent) => {
      if (keyEvent.key !== escape) return;
      if (ghost) {
        keyEvent.preventDefault();
        keyEvent.stopPropagation();
      }
      finish(false);
    }, { capture: true, signal });
    host.addEventListener(scroll, updatePosition, { capture: true, signal });
    host.addEventListener(blur, (event) => {
      if (event.target === host) finish(false);
    }, { signal });
  }

  return { tasks, overlayRef, hoverPaused, onPointerDown, onPointerMove, onClickCapture, onDragStart, onKeyDown };
}
