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
import { SearchAddon } from '@xterm/addon-search';
import classNames from 'classnames';
import { RefObject } from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Popover from '@/elements/Popover.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import UserSettingScopeMenu from '@/elements/UserSettingScopeMenu.tsx';
import { useUserSetting } from '@/lib/userSettings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export const CONSOLE_FONT_SIZE_KEY = 'console::font_size';
export const consoleFontSizeSchema = z.number();

interface TerminalHeaderProps {
  websocketPing: number;
  openModal: 'search' | 'commandHistory' | 'sshDetails' | null;
  setOpenModal: (modal: 'search' | 'commandHistory' | 'sshDetails' | null) => void;
  searchText: string;
  setSearchText: (value: string) => void;
  searchAddonRef: RefObject<SearchAddon | null>;
}

export default function TerminalHeader({
  websocketPing,
  openModal,
  setOpenModal,
  searchText,
  setSearchText,
  searchAddonRef,
}: TerminalHeaderProps) {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const socketConnected = useServerStore((state) => state.socketConnected);
  const socketInstance = useServerStore((state) => state.socketInstance);
  const [consoleFontSize, setConsoleFontSize] = useUserSetting(CONSOLE_FONT_SIZE_KEY, consoleFontSizeSchema, 14);

  return (
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
          <UserSettingScopeMenu settingKey={CONSOLE_FONT_SIZE_KEY} value={consoleFontSize}>
            <span className='text-sm'>{consoleFontSize}px</span>
          </UserSettingScopeMenu>
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
  );
}
