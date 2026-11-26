import { HIDDEN_SELECTOR } from "../constants/html-attributes";

export function hasTaskControlFocus(control: HTMLElement) {
  const { ownerDocument } = control;
  return ownerDocument.activeElement === control;
}

export function canRestoreTaskFocus(control: HTMLElement) {
  const { ownerDocument: { activeElement, body } } = control;
  return activeElement === control || activeElement === body;
}

export function focusTaskControl(control?: HTMLInputElement | HTMLButtonElement | null) {
  return !control?.disabled && focusTaskElement(control);
}

export function focusTaskElement(element?: HTMLElement | null) {
  if (!element?.isConnected || element.closest(HIDDEN_SELECTOR)) return false;
  element.focus();
  return hasTaskControlFocus(element);
}
