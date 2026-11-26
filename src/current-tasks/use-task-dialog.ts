import { useLayoutEffect, useRef, type MouseEvent, type RefObject, type SyntheticEvent } from "react";

type TaskDialogOptions = {
  dismissOnBackdrop?: boolean;
  afterFocus?: (input: HTMLInputElement) => void;
};

function isDialogBackdrop({ target, currentTarget, clientX, clientY }: MouseEvent<HTMLDialogElement>) {
  if (target !== currentTarget) return false;
  const { left, right, top, bottom } = currentTarget.getBoundingClientRect();
  return clientX < left || clientX > right || clientY < top || clientY > bottom;
}

export function useTaskDialog<Result>(
  onClose: (result?: Result) => void,
  submitting: RefObject<boolean>,
  initialFocus: RefObject<HTMLInputElement | null>,
  { dismissOnBackdrop = true, afterFocus }: TaskDialogOptions = {},
) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);

  useLayoutEffect(() => {
    const { current: element } = dialog;
    if (element && !element.open) {
      element.showModal();
      const { current: input } = initialFocus;
      if (input) {
        input.focus({ preventScroll: true });
        afterFocus?.(input);
      }
    }
    return () => (element?.open ? element.close() : undefined);
  }, [afterFocus, initialFocus]);

  function close(result?: Result) {
    dialog.current?.close();
    onClose(result);
  }

  function requestClose() {
    if (!submitting.current) close();
  }

  function cancelDialog(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    requestClose();
  }

  function captureBackdropPress(event: MouseEvent<HTMLDialogElement>) {
    pressedBackdrop.current = isDialogBackdrop(event);
  }

  function dismissFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    const dismiss = pressedBackdrop.current && isDialogBackdrop(event);
    pressedBackdrop.current = false;
    if (dismiss) requestClose();
  }

  return {
    close,
    requestClose,
    dialogProps: {
      ref: dialog,
      onCancel: cancelDialog,
      onPointerDown: dismissOnBackdrop ? captureBackdropPress : undefined,
      onClick: dismissOnBackdrop ? dismissFromBackdrop : undefined,
    },
  };
}
