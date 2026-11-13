import { useComputedColorScheme } from '@mantine/core';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ITerminalInitOnlyOptions, ITerminalOptions, Terminal as XTerm } from '@xterm/xterm';
import { useEffect, useRef } from 'react';
import { XTermRegistry } from 'shared/src/registries/slices/xterm.ts';
import { getXtermTheme } from '@/lib/editor/xterm.ts';
import { redactConsoleLine } from '@/lib/network/redact.ts';
import { useRedactAddresses } from '@/plugins/privacy/useRedactAddresses.ts';

import '@xterm/xterm/css/xterm.css';
import '@/lib/editor/xterm.css';

/**
 * Read-only xterm that renders `lines` with their ANSI styling. When the new array keeps the old first and
 * last line in place only the appended lines are written, any other change rewrites the terminal.
 *
 * `xterm` handlers run once when the terminal is created, with the props given at that time.
 */
export default function LogTerminal<P = {}>({
  lines,
  xterm,
}: {
  lines: string[];
  xterm?: { registry: XTermRegistry<P>; props: P };
}) {
  const computedColorScheme = useComputedColorScheme('dark');
  const [redactAddresses] = useRedactAddresses();

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const writtenLines = useRef<string[]>([]);
  const writtenRedaction = useRef(redactAddresses);

  useEffect(() => {
    if (!terminalRef.current) return;

    const initOptions: ITerminalOptions & ITerminalInitOnlyOptions = {
      fontSize: 14,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: getXtermTheme(computedColorScheme === 'dark'),
      allowTransparency: true,
      lineHeight: 1.2,
      disableStdin: true,
      convertEol: true,
      smoothScrollDuration: 0,
      fontWeightBold: '500',
      rescaleOverlappingGlyphs: true,
    };

    for (const handler of xterm?.registry.initHandlers ?? []) {
      handler(initOptions, xterm!.props);
    }

    const term = new XTerm(initOptions);

    for (const handler of xterm?.registry.beforePluginsHandlers ?? []) {
      handler(term, xterm!.props);
    }

    const fitAddon = new FitAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    for (const handler of xterm?.registry.afterPluginsHandlers ?? []) {
      handler(term, xterm!.props);
    }

    term.open(terminalRef.current);
    fitAddon.fit();

    for (const handler of xterm?.registry.afterOpenHandlers ?? []) {
      handler(term, xterm!.props);
    }

    term.write('\x1b[?25l');

    xtermInstance.current = term;
    writtenLines.current = [];

    let fitFrame: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (fitFrame !== null) return;
      fitFrame = requestAnimationFrame(() => {
        fitFrame = null;
        const dimensions = fitAddon.proposeDimensions();
        if (dimensions && (dimensions.cols !== term.cols || dimensions.rows !== term.rows)) {
          fitAddon.fit();
        }
      });
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      if (fitFrame !== null) cancelAnimationFrame(fitFrame);
      for (const handler of xterm?.registry.onUnmountHandlers ?? []) {
        handler(term, xterm!.props);
      }
      term.dispose();
      xtermInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.theme = getXtermTheme(computedColorScheme === 'dark');
    }
  }, [computedColorScheme]);

  useEffect(() => {
    const term = xtermInstance.current;
    if (!term) return;

    const written = writtenLines.current;
    const appended =
      writtenRedaction.current === redactAddresses &&
      lines.length >= written.length &&
      lines[0] === written[0] &&
      lines[written.length - 1] === written[written.length - 1];

    if (!appended) {
      term.reset();
      term.write('\x1b[?25l');
      writtenRedaction.current = redactAddresses;
    }

    const start = appended ? written.length : 0;
    for (let index = start; index < lines.length; index++) {
      const text = redactAddresses ? redactConsoleLine(lines[index]) : lines[index];
      term.write(index === 0 ? text : '\n'.concat(text));
    }

    writtenLines.current = lines;
  }, [lines, redactAddresses]);

  return (
    <div className='flex-1 min-h-0 relative overflow-hidden'>
      <div ref={terminalRef} className='absolute inset-0' />
    </div>
  );
}
