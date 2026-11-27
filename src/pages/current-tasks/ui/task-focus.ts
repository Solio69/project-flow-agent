import { HIDDEN_SELECTOR } from "../../../shared/lib/dom";

export function hasTaskControlFocus(control: HTMLElement) {
  const { ownerDocument } = control;
  return ownerDocument.activeElement === control;
}

export function canRestoreTaskFocus(control: HTMLElement) {
  const { ownerDocument: { activeElement, body } } = control;
  return activeElement === control || activeElement === body;
}

export function focusTaskControl(control?: HTMLInputElement | HTMLButtonElement | null, options?: FocusOptions) {
  return !control?.disabled && focusTaskElement(control, options);
}

export function focusTaskElement(element?: HTMLElement | null, options?: FocusOptions) {
  if (!element?.isConnected || element.closest(HIDDEN_SELECTOR)) return false;
  element.focus(options);
  return hasTaskControlFocus(element);
}
