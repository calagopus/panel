import { useComputedColorScheme } from '@mantine/core';
import { FitAddon } from '@xterm/addon-fit';
import { ITerminalInitOnlyOptions, ITerminalOptions, Terminal as XTerm } from '@xterm/xterm';
import { useEffect, useRef } from 'react';
import Card from '@/elements/data-display/Card.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import { getXtermTheme } from '@/lib/editor/xterm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

import '@xterm/xterm/css/xterm.css';
import '@/lib/editor/xterm.css';

export default function DatabaseInstanceLogs() {
  const { t } = useTranslations();
  const computedColorScheme = useComputedColorScheme('dark');
  const logs = useServerStore((state) => state.databaseInstanceLogs);
  const imagePulls = useServerStore((state) => state.databaseInstanceImagePulls);

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const writtenLines = useRef(0);

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

    const term = new XTerm(initOptions);
    const fitAddon = new FitAddon();

    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    term.write('\x1b[?25l');

    xtermInstance.current = term;
    writtenLines.current = 0;

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

    if (logs.length < writtenLines.current) {
      term.reset();
      term.write('\x1b[?25l');
      writtenLines.current = 0;
    }

    for (const line of logs.slice(writtenLines.current)) {
      term.write(writtenLines.current === 0 ? line : '\n'.concat(line));
      writtenLines.current++;
    }
  }, [logs]);

  return (
    <Card className='h-[50vh] flex flex-col font-mono text-sm relative isolate p-2!'>
      <div className='flex-1 min-h-0 relative overflow-hidden'>
        <div ref={terminalRef} className='absolute inset-0' />
      </div>

      {imagePulls.size > 0 && (
        <span className='flex flex-col justify-end mt-4'>
          {[...imagePulls.entries()].map(([id, progress]) => (
            <span key={id} className='flex flex-row w-full items-center whitespace-pre-wrap break-all'>
              {progress.status === 'pulling'
                ? t('pages.server.databases.instance.message.pulling', {})
                : t('pages.server.databases.instance.message.extracting', {})}{' '}
              <Progress
                hourglass={false}
                indeterminate={progress.bytesTotal === 0}
                value={(progress.bytesProcessed / progress.bytesTotal) * 100}
                className='flex-1 ml-2'
              />
            </span>
          ))}
        </span>
      )}
    </Card>
  );
}
