import { ComboboxItem, OptionsFilter } from '@mantine/core';
import { Terminal as XTerm } from '@xterm/xterm';

export const commandSnippetFilter: OptionsFilter = ({ options, search }) => {
  if (!search.startsWith('!')) {
    return [];
  }

  const splittedSearch = search.toLowerCase().trim().split(' ');
  return (options as ComboboxItem[]).filter((option) => {
    const words = option.label.toLowerCase().trim().split(' ');
    return splittedSearch.every((searchWord) => words.some((word) => word.includes(searchWord)));
  });
};

export function getCellHeight(term: XTerm, fallback: number): number {
  const core = (
    term as unknown as {
      _core?: { _renderService?: { dimensions?: { css?: { cell?: { height?: number } } } } };
    }
  )._core;

  return core?._renderService?.dimensions?.css?.cell?.height || fallback;
}

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE = 10;

export function attachTouchScrolling(
  terminalElement: HTMLElement,
  getTerm: () => XTerm | null,
  options: {
    fallbackFontSize: number;
    setSelecting: (value: boolean) => void;
    onSelectionSettled: () => void;
  },
): () => void {
  const { fallbackFontSize, setSelecting, onSelectionSettled } = options;

  const pixelsPerLine = () => {
    const term = getTerm();
    return term ? getCellHeight(term, fallbackFontSize) : fallbackFontSize;
  };

  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  let lineRemainder = 0;
  let momentumFrame: number | null = null;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let selectionAnchor: number | null = null;
  let touchStartX = 0;
  let touchStartY = 0;

  const stopMomentum = () => {
    if (momentumFrame !== null) {
      cancelAnimationFrame(momentumFrame);
      momentumFrame = null;
    }
  };

  const cancelLongPress = () => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const touchLine = (clientY: number) => {
    const term = getTerm();
    if (!term) return null;

    const rect = terminalElement.getBoundingClientRect();
    const row = Math.min(term.rows - 1, Math.floor((clientY - rect.top) / pixelsPerLine()));
    const buffer = term.buffer.active;

    return Math.max(0, Math.min(buffer.baseY + term.rows - 1, buffer.viewportY + row));
  };

  const canScroll = (direction: number) => {
    const buffer = getTerm()?.buffer.active;
    if (!buffer) return false;

    return direction > 0 ? buffer.viewportY < buffer.baseY : buffer.viewportY > 0;
  };

  const scrollByLines = (lines: number) => {
    lineRemainder += lines;
    const wholeLines = Math.trunc(lineRemainder);
    if (wholeLines !== 0) {
      getTerm()?.scrollLines(wholeLines);
      lineRemainder -= wholeLines;
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    stopMomentum();
    cancelLongPress();
    if (e.touches.length > 1) return;

    selectionAnchor = null;
    const touch = e.touches[0];
    lastY = touch.clientY;
    lastTime = e.timeStamp;
    velocity = 0;
    lineRemainder = 0;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    const pressY = touch.clientY;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;

      const line = touchLine(pressY);
      if (line === null) return;

      selectionAnchor = line;
      setSelecting(true);
      getTerm()?.selectLines(line, line);
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 1) return;

    const touch = e.touches[0];

    if (selectionAnchor !== null) {
      if (e.cancelable) e.preventDefault();

      const line = touchLine(touch.clientY);
      if (line !== null) {
        getTerm()?.selectLines(Math.min(selectionAnchor, line), Math.max(selectionAnchor, line));
      }
      return;
    }

    if (
      longPressTimer !== null &&
      (Math.abs(touch.clientX - touchStartX) > LONG_PRESS_MOVE_TOLERANCE ||
        Math.abs(touch.clientY - touchStartY) > LONG_PRESS_MOVE_TOLERANCE)
    ) {
      cancelLongPress();
    }

    const currentY = touch.clientY;
    const deltaY = lastY - currentY;
    const deltaTime = e.timeStamp - lastTime;
    lastY = currentY;
    lastTime = e.timeStamp;

    if (deltaTime > 0) {
      velocity = 0.8 * velocity + 0.2 * (deltaY / deltaTime);
    }

    if (deltaY !== 0 && !canScroll(deltaY)) {
      lineRemainder = 0;
      return;
    }

    if (!e.cancelable) return;

    e.preventDefault();
    scrollByLines(deltaY / pixelsPerLine());
  };

  const handleTouchEnd = (e: TouchEvent) => {
    cancelLongPress();

    if (e.touches.length > 0) {
      lastY = e.touches[0].clientY;
      lastTime = e.timeStamp;
      velocity = 0;
      return;
    }

    if (selectionAnchor !== null) {
      selectionAnchor = null;
      if (e.cancelable) e.preventDefault();
      return;
    }

    setTimeout(() => onSelectionSettled(), 150);

    if (Math.abs(velocity) < 0.05) return;

    let previousTime = performance.now();
    const step = (now: number) => {
      momentumFrame = null;

      const deltaTime = now - previousTime;
      previousTime = now;

      if (!canScroll(velocity)) {
        velocity = 0;
        return;
      }

      scrollByLines((velocity * deltaTime) / pixelsPerLine());
      velocity *= Math.pow(0.95, deltaTime / (1000 / 60));

      if (Math.abs(velocity) > 0.01) {
        momentumFrame = requestAnimationFrame(step);
      }
    };
    momentumFrame = requestAnimationFrame(step);
  };

  const handleTouchCancel = () => {
    cancelLongPress();
    selectionAnchor = null;
  };

  const handleMouseDown = () => {
    setSelecting(false);
  };

  const handleContextMenu = (e: Event) => {
    if (selectionAnchor !== null || longPressTimer !== null) e.preventDefault();
  };

  terminalElement.addEventListener('touchstart', handleTouchStart, { passive: true });
  terminalElement.addEventListener('touchmove', handleTouchMove, { passive: false });
  terminalElement.addEventListener('touchend', handleTouchEnd, { passive: false });
  terminalElement.addEventListener('touchcancel', handleTouchCancel, { passive: true });
  terminalElement.addEventListener('contextmenu', handleContextMenu);
  terminalElement.addEventListener('mousedown', handleMouseDown);

  return () => {
    stopMomentum();
    cancelLongPress();
    terminalElement.removeEventListener('touchstart', handleTouchStart);
    terminalElement.removeEventListener('touchmove', handleTouchMove);
    terminalElement.removeEventListener('touchend', handleTouchEnd);
    terminalElement.removeEventListener('touchcancel', handleTouchCancel);
    terminalElement.removeEventListener('contextmenu', handleContextMenu);
    terminalElement.removeEventListener('mousedown', handleMouseDown);
  };
}

export const getXtermTheme = (isDark: boolean) => ({
  background: isDark ? '#00000000' : '#ffffff',
  foreground: isDark ? '#f8f8f2' : '#1a1a1a',
  cursor: '#00000000',
  cursorAccent: '#00000000',
  selectionBackground: isDark ? '#FFFFFF4D' : '#0000004D',
  selectionInactiveBackground: isDark ? '#FFFFFF80' : '#00000080',
  // Light-mode ANSI palette
  ...(!isDark && {
    black: '#1c1c1c',
    red: '#b22222',
    green: '#005f00',
    yellow: '#8b6800',
    blue: '#0000cc',
    magenta: '#7d0070',
    cyan: '#005f5f',
    white: '#6c6c6c',
    brightBlack: '#505050',
    brightRed: '#c0392b',
    brightGreen: '#1e8449',
    brightYellow: '#b07d00',
    brightBlue: '#2471a3',
    brightMagenta: '#7d3c98',
    brightCyan: '#148f77',
    brightWhite: '#909090',
  }),
});
