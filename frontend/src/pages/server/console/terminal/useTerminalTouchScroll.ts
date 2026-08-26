import { Terminal as XTerm } from '@xterm/xterm';
import { RefObject, useEffect } from 'react';
import { attachTouchScrolling } from '@/lib/xterm.ts';

interface UseTerminalTouchScrollOptions {
  terminalRef: RefObject<HTMLDivElement | null>;
  xtermInstance: RefObject<XTerm | null>;
  touchSelectionRef: RefObject<boolean>;
  updateSelectionMenuRef: RefObject<() => void>;
  consoleFontSize: number;
}

export function useTerminalTouchScroll({
  terminalRef,
  xtermInstance,
  touchSelectionRef,
  updateSelectionMenuRef,
  consoleFontSize,
}: UseTerminalTouchScrollOptions) {
  useEffect(() => {
    const terminalElement = terminalRef.current;
    if (!terminalElement) return;

    return attachTouchScrolling(terminalElement, () => xtermInstance.current, {
      fallbackFontSize: consoleFontSize + 4,
      setSelecting: (value) => {
        touchSelectionRef.current = value;
      },
      onSelectionSettled: () => updateSelectionMenuRef.current(),
    });
  }, [consoleFontSize]);
}
