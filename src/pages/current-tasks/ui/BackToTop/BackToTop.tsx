import { useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { DOM_EVENT, FOCUS_WITHOUT_SCROLL } from "../../../../shared/lib/dom";
import { ActionButton } from "../../../../shared/ui";
import { focusTaskElement, hasTaskControlFocus } from "../task-focus";
import {
  BACK_TO_TOP_ICON, BACK_TO_TOP_LABEL, REDUCED_MOTION, SCROLL_BEHAVIOR, SCROLL_LISTENER_OPTIONS, SCROLL_START,
} from "./constants";

const { scroll } = DOM_EVENT;
const { instant, smooth } = SCROLL_BEHAVIOR;

function isButtonOverList(button: HTMLButtonElement, list: HTMLDivElement) {
  const { top: listTop, bottom: listBottom } = list.getBoundingClientRect();
  const { top: buttonTop, bottom: buttonBottom } = button.getBoundingClientRect();
  const isAboveListBottom = buttonTop < listBottom;
  const isBelowListTop = buttonBottom > listTop;
  return isAboveListBottom && isBelowListTop;
}

export function BackToTop({ container, heading, page, panels }: {
  container: HTMLElement;
  heading: RefObject<HTMLHeadingElement | null>;
  page: RefObject<HTMLElement | null>;
  panels: RefObject<HTMLDivElement | null>;
}) {
  const { ownerDocument: { defaultView } } = container;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isOverList, setIsOverList] = useState(false);

  useLayoutEffect(() => {
    const { current: button } = buttonRef;
    const { current: list } = panels;
    if (!button || !list) return;

    const update = () => {
      const isScrolled = container.scrollTop > SCROLL_START;
      const isButtonMeasurable = isScrolled && isVisible;
      setIsVisible(isScrolled);
      setIsOverList(isButtonMeasurable && isButtonOverList(button, list));
    };

    const ResizeObserver = defaultView?.ResizeObserver;
    const observer = ResizeObserver && new ResizeObserver(update);
    const observedElements = [container, page.current, button, list];
    for (const element of observedElements) {
      if (element) observer?.observe(element);
    }
    container.addEventListener(scroll, update, SCROLL_LISTENER_OPTIONS);
    update();
    return () => {
      observer?.disconnect();
      container.removeEventListener(scroll, update);
    };
  }, [container, defaultView, isVisible, page, panels]);

  function scrollToTop({ currentTarget }: MouseEvent<HTMLButtonElement>) {
    const isMotionReduced = defaultView?.matchMedia(REDUCED_MOTION).matches ?? false;
    const behavior = isMotionReduced ? instant : smooth;
    if (hasTaskControlFocus(currentTarget)) focusTaskElement(heading.current, FOCUS_WITHOUT_SCROLL);
    container.scrollTo({ top: SCROLL_START, behavior });
  }

  return (
    <div className="pfa-bottom-rail" hidden={!isVisible} data-over-list={isOverList}>
      <ActionButton ref={buttonRef} label={BACK_TO_TOP_LABEL} icon={BACK_TO_TOP_ICON} onClick={scrollToTop} />
    </div>
  );
}
