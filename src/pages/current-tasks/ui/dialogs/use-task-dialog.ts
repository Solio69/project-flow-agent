import { useLayoutEffect, useRef, type MouseEvent, type RefObject, type SyntheticEvent } from "react";

function isDialogBackdrop({ target, currentTarget, clientX, clientY }: MouseEvent<HTMLDialogElement>) {
  if (target !== currentTarget) return false;
  const { left, right, top, bottom } = currentTarget.getBoundingClientRect();
  return clientX < left || clientX > right || clientY < top || clientY > bottom;
}

export function useTaskDialog<Result, Element extends HTMLElement>(
  onClose: (result?: Result) => void,
  isSubmitting: RefObject<boolean>,
  initialFocus: RefObject<Element | null>,
  afterFocus?: (element: Element) => void,
) {
  const dialog = useRef<HTMLDialogElement>(null);
  const isBackdropPressed = useRef(false);

  useLayoutEffect(() => {
    const { current: element } = dialog;
    if (element && !element.open) {
      element.showModal();
      const { current: control } = initialFocus;
      if (control) {
        control.focus({ preventScroll: true });
        afterFocus?.(control);
      }
    }
    return () => (element?.open ? element.close() : undefined);
  }, [afterFocus, initialFocus]);

  function close(result?: Result) {
    dialog.current?.close();
    onClose(result);
  }

  function requestClose() {
    if (!isSubmitting.current) close();
  }

  function cancelDialog(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    requestClose();
  }

  function captureBackdropPress(event: MouseEvent<HTMLDialogElement>) {
    isBackdropPressed.current = isDialogBackdrop(event);
  }

  function dismissFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    const isBackdropDismissal = isBackdropPressed.current && isDialogBackdrop(event);
    isBackdropPressed.current = false;
    if (isBackdropDismissal) requestClose();
  }

  return {
    close,
    requestClose,
    dialogProps: {
      ref: dialog,
      onCancel: cancelDialog,
      onPointerDown: captureBackdropPress,
      onClick: dismissFromBackdrop,
    },
  };
}
