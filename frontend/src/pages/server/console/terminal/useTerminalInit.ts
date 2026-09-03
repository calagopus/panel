import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ITerminalInitOnlyOptions, ITerminalOptions, Terminal as XTerm } from '@xterm/xterm';
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { handleRawCopyToClipboard } from '@/lib/clipboard/copy.ts';
import { getCellHeight, getXtermTheme } from '@/lib/editor/xterm.ts';
import { eventKeyMatches } from '@/lib/quickActions/shortcuts.ts';
import type { AddToast } from '@/providers/contexts/toastContext.ts';

interface UseTerminalInitOptions {
  terminalRef: RefObject<HTMLDivElement | null>;
  touchSelectionRef: RefObject<boolean>;
  setIsAtBottom: (value: boolean) => void;
  addToast: AddToast;
  initialFontSize: number;
  initialIsDark: boolean;
  fontSize: number;
  isDark: boolean;
}

export function useTerminalInit({
  terminalRef,
  touchSelectionRef,
  setIsAtBottom,
  addToast,
  initialFontSize,
  initialIsDark,
  fontSize,
  isDark,
}: UseTerminalInitOptions) {
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const updateSelectionMenuRef = useRef<() => void>(() => void 0);
  const [selectionMenuTop, setSelectionMenuTop] = useState<number | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const initOptions: ITerminalOptions & ITerminalInitOnlyOptions = {
      fontSize: initialFontSize,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: getXtermTheme(initialIsDark),
      allowTransparency: true,
      lineHeight: 1.2,
      disableStdin: true,
      convertEol: true,
      smoothScrollDuration: 0,
      allowProposedApi: true,
      fontWeightBold: '500',
      rescaleOverlappingGlyphs: true,
    };

    for (const handler of window.extensionContext.extensionRegistry.pages.server.console.xterm.initHandlers) {
      handler(initOptions, {});
    }

    const term = new XTerm(initOptions);

    for (const handler of window.extensionContext.extensionRegistry.pages.server.console.xterm.beforePluginsHandlers) {
      handler(term, {});
    }

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(new Unicode11Addon());

    term.unicode.activeVersion = '11';

    for (const handler of window.extensionContext.extensionRegistry.pages.server.console.xterm.afterPluginsHandlers) {
      handler(term, {});
    }

    term.open(terminalRef.current);
    fitAddon.fit();

    for (const handler of window.extensionContext.extensionRegistry.pages.server.console.xterm.afterOpenHandlers) {
      handler(term, {});
    }

    // prevent cursor
    term.write('\x1b[?25l');

    document.fonts.ready.then(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    });

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    let fitFrame: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (fitFrame !== null) return;
      fitFrame = requestAnimationFrame(() => {
        fitFrame = null;
        const dims = fitAddon.proposeDimensions();
        if (dims && (dims.cols !== term.cols || dims.rows !== term.rows)) {
          fitAddon.fit();
        }
      });
    });
    resizeObserver.observe(terminalRef.current);

    const updateSelectionMenu = () => {
      const range = term.hasSelection() ? term.getSelectionPosition() : undefined;
      if (!range || !touchSelectionRef.current) {
        touchSelectionRef.current = false;
        setSelectionMenuTop(null);
        return;
      }

      const cellHeight = getCellHeight(term, (term.options.fontSize ?? 14) * 1.2);
      const lastLineTop = (range.end.y - term.buffer.active.viewportY) * cellHeight;

      let top = lastLineTop - 40;
      if (top < 4) top = lastLineTop + cellHeight + 8;
      setSelectionMenuTop(Math.max(4, Math.min(top, term.rows * cellHeight - 44)));
    };
    updateSelectionMenuRef.current = updateSelectionMenu;

    term.onScroll(() => {
      setIsAtBottom(term.buffer.active.viewportY === term.buffer.active.baseY);
      updateSelectionMenu();
    });

    term.onSelectionChange(updateSelectionMenu);
    term.onResize(updateSelectionMenu);

    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && eventKeyMatches(e, 'c')) {
        if (term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection());
          term.clearSelection();

          return false;
        }
      }

      if ((e.ctrlKey || e.metaKey) && eventKeyMatches(e, 'f')) {
        return false;
      }

      return true;
    });

    return () => {
      resizeObserver.disconnect();
      if (fitFrame !== null) cancelAnimationFrame(fitFrame);
      term.dispose();
      xtermInstance.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;

      for (const handler of window.extensionContext.extensionRegistry.pages.server.console.xterm.onUnmountHandlers) {
        handler(term, {});
      }
    };
  }, []);

  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.fontSize = fontSize;
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        xtermInstance.current?.refresh(0, xtermInstance.current.rows - 1);
      });
    }
  }, [fontSize]);

  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.theme = getXtermTheme(isDark);
    }
  }, [isDark]);

  const resetTerminal = useCallback(() => {
    if (!xtermInstance.current) return false;
    xtermInstance.current.reset();
    return true;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (!xtermInstance.current) return;
    xtermInstance.current.scrollToBottom();
    setIsAtBottom(true);
  }, [setIsAtBottom]);

  const hasSelection = useCallback(() => xtermInstance.current?.hasSelection() ?? false, []);

  const copySelection = useCallback(() => {
    const term = xtermInstance.current;
    if (!term?.hasSelection()) return;

    handleRawCopyToClipboard(term.getSelection(), addToast);
    term.clearSelection();
  }, [addToast]);

  const writeLine = useCallback((text: string, isFirstLine: boolean) => {
    if (!xtermInstance.current) return false;
    xtermInstance.current.write(isFirstLine ? text : '\n'.concat(text));
    return true;
  }, []);

  return {
    xtermInstance,
    fitAddonRef,
    searchAddonRef,
    selectionMenuTop,
    updateSelectionMenuRef,
    resetTerminal,
    scrollToBottom,
    hasSelection,
    copySelection,
    writeLine,
  };
}
