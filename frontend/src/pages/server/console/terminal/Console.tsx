import {
  faArrowDown,
  faClockRotateLeft,
  faCopy,
  faMagnifyingGlass,
  faMinus,
  faPlus,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useComputedColorScheme } from '@mantine/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import Progress from '@/elements/Progress.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/quickActions/coreQuickActions.tsx';
import { useUserSetting } from '@/lib/userSettings.ts';
import { matchesShortcut, useKeyboardShortcut } from '@/plugins/useKeyboardShortcuts.ts';
import { useQuickActions } from '@/plugins/useQuickActions.ts';
import { SocketEvent, SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import ConsoleCommandInput from './ConsoleCommandInput.tsx';
import CommandHistoryDrawer from './drawers/CommandHistoryDrawer.tsx';
import FeatureProvider from './features/FeatureProvider.tsx';
import SshDetailsModal from './modals/SshDetailsModal.tsx';
import TerminalHeader, { CONSOLE_FONT_SIZE_KEY, consoleFontSizeSchema } from './TerminalHeader.tsx';
import TerminalSelectionMenu from './TerminalSelectionMenu.tsx';
import { useCommandHistory } from './useCommandHistory.ts';
import { useTerminalInit } from './useTerminalInit.ts';
import { useTerminalTouchScroll } from './useTerminalTouchScroll.ts';

import '@xterm/xterm/css/xterm.css';
import '@/lib/xterm.css';

export default function Terminal() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, imagePulls, socketConnected, socketInstance } = useServerStore(
    useShallow((s) => ({
      server: s.server,
      imagePulls: s.imagePulls,
      socketConnected: s.socketConnected,
      socketInstance: s.socketInstance,
    })),
  );
  const settings = useGlobalStore((state) => state.settings);
  const computedColorScheme = useComputedColorScheme('dark');

  const [inputValue, setInputValue] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [websocketPing, setWebsocketPing] = useState(0);
  const [consoleFontSize, setConsoleFontSize] = useUserSetting(CONSOLE_FONT_SIZE_KEY, consoleFontSizeSchema, 14);
  const [openModal, setOpenModal] = useState<'search' | 'commandHistory' | 'sshDetails' | null>(null);

  const inputValueRef = useRef(inputValue);
  const inputValueUpdatedRef = useRef(false);
  const inputValueCompletedRef = useRef(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const touchSelectionRef = useRef(false);
  const isFirstLine = useRef(true);

  const commandHistory = useCommandHistory(server.uuid);

  const {
    xtermInstance,
    searchAddonRef,
    selectionMenuTop,
    updateSelectionMenuRef,
    resetTerminal,
    scrollToBottom,
    hasSelection,
    copySelection,
    writeLine,
  } = useTerminalInit({
    terminalRef,
    touchSelectionRef,
    setIsAtBottom,
    addToast,
    initialFontSize: consoleFontSize,
    initialIsDark: computedColorScheme === 'dark',
    fontSize: consoleFontSize,
    isDark: computedColorScheme === 'dark',
  });

  useTerminalTouchScroll({
    terminalRef,
    xtermInstance,
    touchSelectionRef,
    updateSelectionMenuRef,
    consoleFontSize,
  });

  useEffect(() => {
    let pingInterval: ReturnType<typeof setInterval>;
    let pongTimeout: ReturnType<typeof setTimeout> | null = null;
    let activePongHandler: (() => void) | null = null;

    if (socketConnected && socketInstance) {
      const pingFn = () => {
        const start = Date.now();
        socketInstance.send(SocketRequest.PING);

        if (activePongHandler) socketInstance.removeListener(SocketEvent.PONG, activePongHandler);
        if (pongTimeout) clearTimeout(pongTimeout);

        const handlePong = () => {
          const latency = Date.now() - start;
          setWebsocketPing(latency);
          socketInstance.removeListener(SocketEvent.PONG, handlePong);
          if (pongTimeout) clearTimeout(pongTimeout);
          if (activePongHandler === handlePong) activePongHandler = null;
        };
        activePongHandler = handlePong;

        pongTimeout = setTimeout(() => {
          socketInstance.removeListener(SocketEvent.PONG, handlePong);
          if (activePongHandler === handlePong) activePongHandler = null;
        }, 10000);

        socketInstance.addListener(SocketEvent.PONG, handlePong);
      };

      pingInterval = setInterval(pingFn, 10000);
      pingFn();
    }

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (pongTimeout) clearTimeout(pongTimeout);
      if (activePongHandler && socketInstance) socketInstance.removeListener(SocketEvent.PONG, activePongHandler);
    };
  }, [socketConnected, socketInstance]);

  const containerPreludeRef = useRef(settings.server.containerPrelude);
  useEffect(() => {
    containerPreludeRef.current = settings.server.containerPrelude;
  }, [settings.server.containerPrelude]);

  const addLine = useCallback(
    (text: string, prelude = false) => {
      let processed = text.replaceAll('\x1b[?25h', '').replaceAll('\x1b[?25l', '');

      if (processed.includes('container@pterodactyl~')) {
        processed = processed.replace('container@pterodactyl~', containerPreludeRef.current);
      }

      if (prelude && !processed.includes('\x1b[1m\x1b[41m')) {
        processed = `\x1b[1m\x1b[33m${containerPreludeRef.current} \x1b[0m${processed}`;
      }

      if (writeLine(processed, isFirstLine.current)) {
        isFirstLine.current = false;
      }
    },
    [writeLine],
  );

  useEffect(() => {
    if (!socketConnected || !socketInstance || !resetTerminal()) return;

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
        else if (s === 'completed') addLine(t('pages.server.console.message.transferCompleted', {}), true);
      },
      [SocketEvent.DAEMON_MESSAGE]: (l) => addLine(l, true),
      [SocketEvent.DAEMON_ERROR]: (l) => addLine(`[1m[41m${l}[0m`, true),
    };

    Object.entries(listeners).forEach(([k, fn]) => socketInstance.addListener(k, fn));
    socketInstance.send(SocketRequest.SEND_LOGS);

    return () => {
      Object.entries(listeners).forEach(([k, fn]) => socketInstance.removeListener(k, fn));
    };
  }, [socketConnected, socketInstance, resetTerminal, addLine, t]);

  useEffect(() => {
    if (!openModal) {
      searchAddonRef.current?.clearDecorations();
    }
  }, [openModal]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (matchesShortcut(e.nativeEvent, 'console.previousCommand') && !inputValueRef.current.startsWith('!')) {
        const newValue = commandHistory.navigatePrevious();
        setInputValue(newValue);
        inputValueRef.current = newValue;
        e.preventDefault();
      }

      if (matchesShortcut(e.nativeEvent, 'console.nextCommand') && !inputValueRef.current.startsWith('!')) {
        const newValue = commandHistory.navigateNext();
        setInputValue(newValue);
        inputValueRef.current = newValue;
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

          commandHistory.recordCommand(command);
          socketInstance?.send(SocketRequest.SEND_COMMAND, command);
          setInputValue('');
          inputValueRef.current = '';
        }
      });
    },
    [commandHistory, socketInstance],
  );

  useKeyboardShortcut(
    'f',
    () => {
      if (openModal && openModal !== 'search') return;

      setOpenModal(openModal ? null : 'search');
    },
    {
      id: 'console.search',
      allowWhenInputFocused: true,
      deps: [openModal],
    },
  );

  const consoleAvailable = server.status === null && !server.isSuspended && !server.isTransferring;

  useQuickActions(
    useMemo(
      () => [
        {
          id: 'console.search',
          category: CORE_QUICK_ACTION_CATEGORIES.page,
          label: () => t('pages.server.console.quickAction.search', {}),
          keywords: ['find'],
          icon: <FontAwesomeIcon icon={faMagnifyingGlass} />,
          perform: () => setOpenModal('search'),
        },
        {
          id: 'console.sshDetails',
          category: CORE_QUICK_ACTION_CATEGORIES.page,
          label: () => t('pages.server.console.tooltip.sshDetails', {}),
          keywords: ['ssh', 'connect'],
          icon: <FontAwesomeIcon icon={faServer} />,
          isVisible: () => consoleAvailable,
          perform: () => setOpenModal('sshDetails'),
        },
        {
          id: 'console.commandHistory',
          category: CORE_QUICK_ACTION_CATEGORIES.page,
          label: () => t('pages.server.console.tooltip.commandHistory', {}),
          keywords: ['commands', 'previous'],
          icon: <FontAwesomeIcon icon={faClockRotateLeft} />,
          isVisible: () => consoleAvailable,
          perform: () => setOpenModal('commandHistory'),
        },
        {
          id: 'console.copySelection',
          category: CORE_QUICK_ACTION_CATEGORIES.page,
          label: () => t('pages.server.console.tooltip.copySelection', {}),
          keywords: ['clipboard'],
          icon: <FontAwesomeIcon icon={faCopy} />,
          isVisible: () => hasSelection(),
          perform: copySelection,
        },
        {
          id: 'console.scrollToBottom',
          category: CORE_QUICK_ACTION_CATEGORIES.page,
          label: () => t('pages.server.console.quickAction.scrollToBottom', {}),
          keywords: ['bottom', 'latest'],
          icon: <FontAwesomeIcon icon={faArrowDown} />,
          isVisible: () => !isAtBottom,
          perform: scrollToBottom,
        },
        {
          id: 'console.decreaseFontSize',
          category: CORE_QUICK_ACTION_CATEGORIES.page,
          label: () => t('pages.server.console.tooltip.decreaseFontSize', {}),
          keywords: ['zoom', 'smaller'],
          icon: <FontAwesomeIcon icon={faMinus} />,
          isVisible: () => consoleFontSize > 10,
          perform: () => setConsoleFontSize((size) => Math.max(10, size - 1)),
        },
        {
          id: 'console.increaseFontSize',
          category: CORE_QUICK_ACTION_CATEGORIES.page,
          label: () => t('pages.server.console.tooltip.increaseFontSize', {}),
          keywords: ['zoom', 'larger'],
          icon: <FontAwesomeIcon icon={faPlus} />,
          isVisible: () => consoleFontSize < 24,
          perform: () => setConsoleFontSize((size) => Math.min(24, size + 1)),
        },
      ],
      [
        t,
        setOpenModal,
        consoleAvailable,
        hasSelection,
        copySelection,
        isAtBottom,
        scrollToBottom,
        consoleFontSize,
        setConsoleFontSize,
      ],
    ),
  );

  return (
    <>
      <FeatureProvider />
      <CommandHistoryDrawer opened={openModal === 'commandHistory'} onClose={() => setOpenModal(null)} />
      <SshDetailsModal opened={openModal === 'sshDetails'} onClose={() => setOpenModal(null)} />

      <Card className='h-full flex flex-col font-mono text-sm relative isolate p-2!'>
        <TerminalHeader
          websocketPing={websocketPing}
          openModal={openModal}
          setOpenModal={setOpenModal}
          searchText={searchText}
          setSearchText={setSearchText}
          searchAddonRef={searchAddonRef}
        />

        {!socketConnected && <Spinner.Centered />}

        <div className='flex-1 min-h-0 relative overflow-hidden'>
          <div ref={terminalRef} className='absolute inset-0' />
          {selectionMenuTop !== null && <TerminalSelectionMenu top={selectionMenuTop} onCopy={copySelection} />}
        </div>

        {imagePulls.size > 0 && (
          <span className='flex flex-col justify-end mt-4'>
            {t('pages.server.console.message.pullingImage', {})}
            {[...imagePulls.entries()].map(([id, progress]) => (
              <span key={id} className='flex flex-row w-full items-center whitespace-pre-wrap break-all'>
                {progress.status === 'pulling'
                  ? t('pages.server.console.message.pulling', {})
                  : t('pages.server.console.message.extracting', {})}{' '}
                <Progress
                  hourglass={false}
                  indeterminate={progress.bytes_total === 0}
                  value={(progress.bytes_processed / progress.bytes_total) * 100}
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

        <ConsoleCommandInput
          inputValue={inputValue}
          setInputValue={setInputValue}
          inputValueRef={inputValueRef}
          inputValueUpdatedRef={inputValueUpdatedRef}
          inputValueCompletedRef={inputValueCompletedRef}
          onKeyDown={handleKeyDown}
        />
      </Card>
    </>
  );
}
