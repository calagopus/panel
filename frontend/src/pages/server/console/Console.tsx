import {
  faArrowDown,
  faArrowUp,
  faClockRotateLeft,
  faMagnifyingGlass,
  faMinus,
  faPlus,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ComboboxItem, OptionsFilter } from '@mantine/core';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ITerminalInitOnlyOptions, ITerminalOptions, Terminal as XTerm } from '@xterm/xterm';
import classNames from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'react';
import getServer from '@/api/server/getServer.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import Autocomplete from '@/elements/input/Autocomplete.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Popover from '@/elements/Popover.tsx';
import Progress from '@/elements/Progress.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { useKeyboardShortcut } from '@/plugins/useKeyboardShortcuts.ts';
import { SocketEvent, SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import CommandHistoryDrawer from './drawers/CommandHistoryDrawer.tsx';
import FeatureProvider from './features/FeatureProvider.tsx';
import SshDetailsModal from './modals/SshDetailsModal.tsx';

import '@xterm/xterm/css/xterm.css';
import './xterm.css';

const RAW_PRELUDE = '\u001b[1m\u001b[33mcontainer@calagopus~ \u001b[0m';

const commandSnippetFilter: OptionsFilter = ({ options, search }) => {
  if (!search.startsWith('!')) {
    return [];
  }

  const splittedSearch = search.toLowerCase().trim().split(' ');
  return (options as ComboboxItem[]).filter((option) => {
    const words = option.label.toLowerCase().trim().split(' ');
    return splittedSearch.every((searchWord) => words.some((word) => word.includes(searchWord)));
  });
};

export default function Terminal() {
  const { t } = useTranslations();
  const { server, updateServer, commandSnippets, imagePulls, socketConnected, socketInstance, state } =
    useServerStore();

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [inputValue, setInputValue] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [websocketPing, setWebsocketPing] = useState(0);
  const [consoleFontSize, setConsoleFontSize] = useState(14);
  const [openModal, setOpenModal] = useState<'search' | 'commandHistory' | 'sshDetails' | null>(null);

  const inputValueRef = useRef(inputValue);
  const inputValueUpdatedRef = useRef(false);
  const inputValueCompletedRef = useRef(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const isFirstLine = useRef(true);

  const HISTORY_STORAGE_KEY = `terminal_command_history_${server.uuid}`;
  const CONSOLE_FONT_SIZE_KEY = 'terminal_console_font_size';

  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) setHistory(parsed);
      } catch (e) {
        console.error('Failed to parse terminal history:', e);
      }
    }
    const savedFontSize = localStorage.getItem(CONSOLE_FONT_SIZE_KEY);
    if (savedFontSize) {
      const size = parseInt(savedFontSize, 10);
      if (!isNaN(size)) setConsoleFontSize(size);
    }
  }, [HISTORY_STORAGE_KEY, CONSOLE_FONT_SIZE_KEY]);

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history, HISTORY_STORAGE_KEY]);

  useEffect(() => {
    localStorage.setItem(CONSOLE_FONT_SIZE_KEY, consoleFontSize.toString());
    if (xtermInstance.current) {
      xtermInstance.current.options.fontSize = consoleFontSize;
      fitAddonRef.current?.fit();
    }
  }, [consoleFontSize, CONSOLE_FONT_SIZE_KEY]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const initOptions: ITerminalOptions & ITerminalInitOnlyOptions = {
      fontSize: consoleFontSize,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: {
        background: '#00000000',
        cursor: '#00000000',
        cursorAccent: '#00000000',
        selectionBackground: '#FFFFFF4D',
        selectionInactiveBackground: '#FFFFFF80',
      },
      allowTransparency: true,
      lineHeight: 1.2,
      disableStdin: true,
      convertEol: true,
      smoothScrollDuration: 250,
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

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(terminalRef.current);

    term.onScroll(() => {
      setIsAtBottom(term.buffer.active.viewportY === term.buffer.active.baseY);
    });

    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection());
          term.clearSelection();

          return false;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        return false;
      }

      return true;
    });

    return () => {
      resizeObserver.disconnect();
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
    const terminalElement = terminalRef.current;
    if (!terminalElement) return;

    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();

      const currentY = e.touches[0].clientY;
      const deltaY = touchStartY - currentY;

      const pixelsPerLine = consoleFontSize + 4;

      if (Math.abs(deltaY) > pixelsPerLine) {
        const linesToScroll = Math.trunc(deltaY / pixelsPerLine);
        xtermInstance.current?.scrollLines(linesToScroll);

        touchStartY -= linesToScroll * pixelsPerLine;
      }
    };

    terminalElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    terminalElement.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      terminalElement.removeEventListener('touchstart', handleTouchStart);
      terminalElement.removeEventListener('touchmove', handleTouchMove);
    };
  }, [consoleFontSize]);

  useEffect(() => {
    let pingInterval: ReturnType<typeof setInterval>;

    if (socketConnected && socketInstance) {
      const pingFn = () => {
        const start = Date.now();
        socketInstance.send(SocketRequest.PING);

        let timeout: ReturnType<typeof setTimeout> | null = null;
        const handlePong = () => {
          const latency = Date.now() - start;
          setWebsocketPing(latency);
          socketInstance.removeListener(SocketEvent.PONG, handlePong);
          if (timeout) clearTimeout(timeout);
        };

        timeout = setTimeout(() => {
          socketInstance.removeListener(SocketEvent.PONG, handlePong);
        }, 10000);

        socketInstance.addListener(SocketEvent.PONG, handlePong);
      };

      pingInterval = setInterval(pingFn, 10000);
      pingFn();
    }

    return () => {
      if (pingInterval) clearInterval(pingInterval);
    };
  }, [socketConnected, socketInstance]);

  const scrollToBottom = useCallback(() => {
    if (xtermInstance.current) {
      xtermInstance.current.scrollToBottom();
      setIsAtBottom(true);
    }
  }, []);

  const addLine = useCallback((text: string, prelude = false) => {
    if (!xtermInstance.current) return;

    let processed = text.replaceAll('\x1b[?25h', '').replaceAll('\x1b[?25l', '');

    if (processed.includes('container@pterodactyl~')) {
      processed = processed.replace('container@pterodactyl~', 'container@calagopus~');
    }

    if (prelude && !processed.includes('\u001b[1m\u001b[41m')) {
      processed = RAW_PRELUDE.concat(processed);
    }

    if (isFirstLine.current) {
      xtermInstance.current.write(processed);
      isFirstLine.current = false;
    } else {
      xtermInstance.current.write('\n'.concat(processed));
    }
  }, []);

  useEffect(() => {
    if (!socketConnected || !socketInstance || !xtermInstance.current) return;

    xtermInstance.current.reset();
    setIsAtBottom(true);
    isFirstLine.current = true;

    const listeners: Record<string, (msg: string) => void> = {
      [SocketEvent.STATUS]: (s) => {
        const statusMapping: Record<string, string> = {
          offline: t('common.enum.serverState.offline', {}),
          running: t('common.enum.serverState.running', {}),
          starting: t('common.enum.serverState.starting', {}),
          stopping: t('common.enum.serverState.stopping', {}),
        };

        addLine(
          t('pages.server.console.message.serverMarkedAs', {
            state: statusMapping[s] || s,
          }),
          true,
        );
      },
      [SocketEvent.CONSOLE_OUTPUT]: (l) => addLine(l),
      [SocketEvent.INSTALL_OUTPUT]: (l) => addLine(l),
      [SocketEvent.INSTALL_COMPLETED]: (s) => {
        if (s === 'false') addLine(t('pages.server.console.message.installFailed', {}), true);
        else addLine(t('pages.server.console.message.installCompleted', {}), true);
      },
      [SocketEvent.TRANSFER_LOGS]: (l) => addLine(l),
      [SocketEvent.TRANSFER_STATUS]: (s) => {
        if (s === 'failure') addLine(t('pages.server.console.message.transferFailed', {}), true);
        else if (s === 'completed') {
          addLine(t('pages.server.console.message.transferCompleted', {}), true);
          setTimeout(() => {
            getServer(server.uuid).then(updateServer);
          }, 5000);
        } else {
          updateServer({ isTransferring: true });
        }
      },
      [SocketEvent.DAEMON_MESSAGE]: (l) => addLine(l, true),
      [SocketEvent.DAEMON_ERROR]: (l) => addLine(`\u001b[1m\u001b[41m${l}\u001b[0m`, true),
    };

    Object.entries(listeners).forEach(([k, fn]) => socketInstance.addListener(k, fn));
    socketInstance.send(SocketRequest.SEND_LOGS);

    return () => {
      Object.entries(listeners).forEach(([k, fn]) => socketInstance.removeListener(k, fn));
    };
  }, [socketConnected, socketInstance]);

  useEffect(() => {
    if (!openModal) {
      searchAddonRef.current?.clearDecorations();
    }
  }, [openModal]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowUp' && !inputValueRef.current.startsWith('!')) {
        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        setInputValue(history[newIndex] || '');
        inputValueRef.current = history[newIndex] || '';
        e.preventDefault();
      }

      if (e.key === 'ArrowDown' && !inputValueRef.current.startsWith('!')) {
        const newIndex = Math.max(historyIndex - 1, -1);
        setHistoryIndex(newIndex);
        setInputValue(history[newIndex] || '');
        inputValueRef.current = history[newIndex] || '';
        e.preventDefault();
      }

      setTimeout(() => {
        if (inputValueCompletedRef.current) {
          inputValueCompletedRef.current = false;
          return;
        }

        if (e.key === 'Enter') {
          const command = inputValueRef.current.trim();
          if (!command) return;

          if (history[0] !== command) {
            setHistory((prev) => [command, ...prev].slice(0, 32));
          }
          setHistoryIndex(-1);
          socketInstance?.send(SocketRequest.SEND_COMMAND, command);
          setInputValue('');
          inputValueRef.current = '';
        }
      });
    },
    [history, historyIndex, socketInstance],
  );

  useKeyboardShortcut(
    'f',
    () => {
      if (openModal && openModal !== 'search') return;

      setOpenModal(openModal ? null : 'search');
    },
    {
      modifiers: ['ctrlOrMeta'],
      allowWhenInputFocused: true,
      deps: [openModal],
    },
  );

  return (
    <>
      <FeatureProvider />
      <CommandHistoryDrawer opened={openModal === 'commandHistory'} onClose={() => setOpenModal(null)} />
      <SshDetailsModal opened={openModal === 'sshDetails'} onClose={() => setOpenModal(null)} />

      <Card className='h-full flex flex-col font-mono text-sm relative p-2!'>
        <div className='flex flex-row justify-between items-center mb-2 text-xs'>
          <div className='flex flex-row items-center'>
            {window.extensionContext.extensionRegistry.pages.server.console.terminalHeaderLeftComponents.prependedComponents.map(
              (Component, i) => (
                <Component key={`console-terminalHeaderLeft-prepended-${i}`} />
              ),
            )}
            <span
              className={classNames(
                'rounded-full size-3 animate-pulse mr-2',
                socketConnected ? 'bg-green-500' : 'bg-red-500',
              )}
            />
            {socketConnected && socketInstance
              ? t('pages.server.console.socketConnected', {
                  ping: websocketPing,
                })
              : t('pages.server.console.socketDisconnected', {})}
            {window.extensionContext.extensionRegistry.pages.server.console.terminalHeaderLeftComponents.appendedComponents.map(
              (Component, i) => (
                <Component key={`console-terminalHeaderLeft-appended-${i}`} />
              ),
            )}
          </div>
          <div className='flex flex-row items-center gap-2'>
            {window.extensionContext.extensionRegistry.pages.server.console.terminalHeaderRightComponents.prependedComponents.map(
              (Component, i) => (
                <Component key={`console-terminalHeaderRight-prepended-${i}`} />
              ),
            )}
            <Popover
              trapFocus
              opened={openModal === 'search'}
              onChange={(opened) => setOpenModal(opened ? 'search' : null)}
            >
              <Popover.Target>
                <Tooltip label={t('pages.server.console.tooltip.search', {})}>
                  <ActionIcon size='xs' variant='subtle' color='gray' onClick={() => setOpenModal('search')}>
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                  </ActionIcon>
                </Tooltip>
              </Popover.Target>
              <Popover.Dropdown className='flex flex-row gap-2' p='xs'>
                <TextInput
                  placeholder={t('common.input.search', {})}
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.currentTarget.value);
                    searchAddonRef.current?.findNext(e.currentTarget.value, {
                      incremental: true,
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (e.shiftKey) {
                        searchAddonRef.current?.findPrevious(searchText);
                      } else {
                        searchAddonRef.current?.findNext(searchText);
                      }
                    }
                  }}
                />
                <ActionIcon
                  size='input-sm'
                  variant='light'
                  color='gray'
                  onClick={() => searchAddonRef.current?.findPrevious(searchText)}
                >
                  <FontAwesomeIcon icon={faArrowUp} />
                </ActionIcon>
                <ActionIcon
                  size='input-sm'
                  variant='light'
                  color='gray'
                  onClick={() => searchAddonRef.current?.findNext(searchText)}
                >
                  <FontAwesomeIcon icon={faArrowDown} />
                </ActionIcon>
              </Popover.Dropdown>
            </Popover>
            <Tooltip label={t('pages.server.console.tooltip.sshDetails', {})}>
              <ActionIcon
                size='xs'
                variant='subtle'
                color='gray'
                disabled={server.status !== null || server.isSuspended || server.isTransferring}
                onClick={() => setOpenModal('sshDetails')}
              >
                <FontAwesomeIcon icon={faServer} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('pages.server.console.tooltip.commandHistory', {})}>
              <ActionIcon
                size='xs'
                variant='subtle'
                color='gray'
                disabled={server.status !== null || server.isSuspended || server.isTransferring}
                onClick={() => setOpenModal('commandHistory')}
              >
                <FontAwesomeIcon icon={faClockRotateLeft} />
              </ActionIcon>
            </Tooltip>
            <div className='flex flex-row items-center'>
              <Tooltip label={t('pages.server.console.tooltip.decreaseFontSize', {})}>
                <ActionIcon
                  className='mr-2'
                  size='xs'
                  variant='subtle'
                  color='gray'
                  onClick={() => setConsoleFontSize((size) => Math.max(10, size - 1))}
                >
                  <FontAwesomeIcon icon={faMinus} />
                </ActionIcon>
              </Tooltip>
              {consoleFontSize}px
              <Tooltip label={t('pages.server.console.tooltip.increaseFontSize', {})}>
                <ActionIcon
                  className='ml-2'
                  size='xs'
                  variant='subtle'
                  color='gray'
                  onClick={() => setConsoleFontSize((size) => Math.min(24, size + 1))}
                >
                  <FontAwesomeIcon icon={faPlus} />
                </ActionIcon>
              </Tooltip>
            </div>
            {window.extensionContext.extensionRegistry.pages.server.console.terminalHeaderRightComponents.appendedComponents.map(
              (Component, i) => (
                <Component key={`console-terminalHeaderRight-appended-${i}`} />
              ),
            )}
          </div>
        </div>

        {!socketConnected && <Spinner.Centered />}

        <div className='flex-1 min-h-0 relative overflow-hidden'>
          <div ref={terminalRef} className='absolute inset-0' />
        </div>

        {imagePulls.size > 0 && (
          <span className='flex flex-col justify-end mt-4'>
            {t('pages.server.console.message.pullingImage', {})}
            {imagePulls.entries().map(([id, progress]) => (
              <span key={id} className='flex flex-row w-full items-center whitespace-pre-wrap break-all'>
                {progress.status === 'pulling'
                  ? t('pages.server.console.message.pulling', {})
                  : t('pages.server.console.message.extracting', {})}{' '}
                <Progress
                  hourglass={false}
                  value={(progress.progress / progress.total) * 100}
                  className='flex-1 ml-2'
                />
              </span>
            ))}
          </span>
        )}

        {!isAtBottom && (
          <div className='absolute bottom-16 right-4 z-90 w-fit'>
            <Button onClick={scrollToBottom} variant='transparent'>
              <FontAwesomeIcon icon={faArrowDown} />
            </Button>
          </div>
        )}

        <div className='w-full mt-4 flex flex-row'>
          <Autocomplete
            value={inputValue}
            onChange={(value) => {
              if (inputValueUpdatedRef.current) {
                inputValueUpdatedRef.current = false;
                return;
              }

              inputValueRef.current = value;
              setInputValue(value);
            }}
            placeholder={t('pages.server.console.input.placeholder', {})}
            aria-label={t('pages.server.console.input.ariaLabel', {})}
            disabled={!socketConnected || state === 'offline'}
            onKeyDown={handleKeyDown}
            autoCorrect='off'
            autoCapitalize='none'
            className='w-full'
            data={commandSnippets.map((s) => `!${s.name}`)}
            filter={commandSnippetFilter}
            onOptionSubmit={(option) => {
              const snippet = commandSnippets.find((s) => `!${s.name}` === option);
              if (snippet) {
                inputValueUpdatedRef.current = true;
                inputValueCompletedRef.current = true;
                inputValueRef.current = snippet.command;
                setInputValue(snippet.command);
              }
            }}
          />
          {window.extensionContext.extensionRegistry.pages.server.console.terminalInputRowComponents.map(
            (Component, i) => (
              <Component key={`console-terminalInputRow-${i}`} />
            ),
          )}
        </div>
      </Card>
    </>
  );
}
