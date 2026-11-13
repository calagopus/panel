const OVERLAY_SELECTOR = '[role="menu"], [role="menubar"], [role="tablist"], [role="listbox"], [role="dialog"]';

export function isOverlayActive(target: EventTarget | null = null, owner: Element | null = null): boolean {
  const element = target instanceof Element && target !== document.body ? target : document.activeElement;
  const scope = owner?.closest('[role="dialog"]') ?? null;

  if (document.querySelector('[role="menu"]')) return true;

  if (scope) {
    if (!element || !scope.contains(element)) return true;

    const overlay = element.closest(OVERLAY_SELECTOR);
    return overlay !== null && overlay !== scope;
  }

  if (element?.closest(OVERLAY_SELECTOR)) return true;

  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

export function isOverlayKeyEvent(event: KeyboardEvent, owner: Element | null = null): boolean {
  return event.defaultPrevented || isOverlayActive(event.target, owner);
}
