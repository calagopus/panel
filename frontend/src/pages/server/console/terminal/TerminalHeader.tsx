import {
  faArrowDown,
  faArrowUp,
  faClockRotateLeft,
  faMagnifyingGlass,
  faMinus,
  faPlus,
  faServer,
  faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SearchAddon } from '@xterm/addon-search';
import classNames from 'classnames';
import { RefObject } from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import UserSettingScopeMenu from '@/elements/UserSettingScopeMenu.tsx';
import { useUserSetting } from '@/lib/userSettings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import openConsolePopout from '../openConsolePopout.ts';

export const CONSOLE_FONT_SIZE_KEY = 'console::font_size';
export const consoleFontSizeSchema = z.number();

interface TerminalHeaderProps {
  websocketPing: number;
  openModal: 'search' | 'commandHistory' | 'sshDetails' | null;
  setOpenModal: (modal: 'search' | 'commandHistory' | 'sshDetails' | null) => void;
  searchText: string;
  setSearchText: (value: string) => void;
  searchAddonRef: RefObject<SearchAddon | null>;
  popout?: boolean;
}

export default function TerminalHeader({
  websocketPing,
  openModal,
  setOpenModal,
  searchText,
  setSearchText,
  searchAddonRef,
  popout = false,
}: TerminalHeaderProps) {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const socketConnected = useServerStore((state) => state.socketConnected);
  const socketInstance = useServerStore((state) => state.socketInstance);
  const [consoleFontSize, setConsoleFontSize] = useUserSetting(CONSOLE_FONT_SIZE_KEY, consoleFontSizeSchema, 14);

  return (
    <div className='flex flex-row justify-between items-center mb-2 text-xs'>
      <div className='flex flex-row items-center'>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.server.console.terminalHeaderLeftComponents
              .prependedComponents
          }
          name='console-terminalHeaderLeft-prepended'
        />
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
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.server.console.terminalHeaderLeftComponents
              .appendedComponents
          }
          name='console-terminalHeaderLeft-appended'
        />
      </div>
      <div className='flex flex-row items-center gap-2'>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.server.console.terminalHeaderRightComponents
              .prependedComponents
          }
          name='console-terminalHeaderRight-prepended'
        />
        <Popover
          trapFocus
          opened={openModal === 'search'}
          onChange={(opened) => setOpenModal(opened ? 'search' : null)}
        >
          <Popover.Target>
            <Tooltip label={t('pages.server.console.tooltip.search', {})}>
              <ActionIcon
                className='group'
                size='xs'
                radius={0}
                variant='transparent'
                onClick={() => setOpenModal('search')}
              >
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className='text-(--mantine-color-dimmed) group-hover:text-(--mantine-color-text)'
                />
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
              radius={0}
              variant='light'
              color='gray'
              onClick={() => searchAddonRef.current?.findPrevious(searchText)}
            >
              <FontAwesomeIcon icon={faArrowUp} />
            </ActionIcon>
            <ActionIcon
              size='input-sm'
              radius={0}
              variant='light'
              color='gray'
              onClick={() => searchAddonRef.current?.findNext(searchText)}
            >
              <FontAwesomeIcon icon={faArrowDown} />
            </ActionIcon>
          </Popover.Dropdown>
        </Popover>
        {!popout && (
          <Tooltip label={t('pages.server.console.tooltip.popout', {})}>
            <ActionIcon
              className='group'
              size='xs'
              radius={0}
              variant='transparent'
              onClick={() => openConsolePopout(server.uuidShort)}
            >
              <FontAwesomeIcon
                icon={faUpRightFromSquare}
                className='text-(--mantine-color-dimmed) group-hover:text-(--mantine-color-text)'
              />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label={t('pages.server.console.tooltip.sshDetails', {})}>
          <ActionIcon
            className='group'
            size='xs'
            radius={0}
            variant='transparent'
            disabled={server.status !== null || server.isSuspended || server.isTransferring}
            onClick={() => setOpenModal('sshDetails')}
          >
            <FontAwesomeIcon
              icon={faServer}
              className='text-(--mantine-color-dimmed) group-hover:text-(--mantine-color-text)'
            />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('pages.server.console.tooltip.commandHistory', {})}>
          <ActionIcon
            className='group'
            size='xs'
            radius={0}
            variant='transparent'
            disabled={server.status !== null || server.isSuspended || server.isTransferring}
            onClick={() => setOpenModal('commandHistory')}
          >
            <FontAwesomeIcon
              icon={faClockRotateLeft}
              className='text-(--mantine-color-dimmed) group-hover:text-(--mantine-color-text)'
            />
          </ActionIcon>
        </Tooltip>
        <div className='flex flex-row items-center'>
          <Tooltip label={t('pages.server.console.tooltip.decreaseFontSize', {})}>
            <ActionIcon
              className='group mr-2'
              size='xs'
              radius={0}
              variant='transparent'
              onClick={() => setConsoleFontSize((size) => Math.max(10, size - 1))}
            >
              <FontAwesomeIcon
                icon={faMinus}
                className='text-(--mantine-color-dimmed) group-hover:text-(--mantine-color-text)'
              />
            </ActionIcon>
          </Tooltip>
          <UserSettingScopeMenu settingKey={CONSOLE_FONT_SIZE_KEY} value={consoleFontSize}>
            <span className='text-sm'>{consoleFontSize}px</span>
          </UserSettingScopeMenu>
          <Tooltip label={t('pages.server.console.tooltip.increaseFontSize', {})}>
            <ActionIcon
              className='group ml-2'
              size='xs'
              radius={0}
              variant='transparent'
              onClick={() => setConsoleFontSize((size) => Math.min(24, size + 1))}
            >
              <FontAwesomeIcon
                icon={faPlus}
                className='text-(--mantine-color-dimmed) group-hover:text-(--mantine-color-text)'
              />
            </ActionIcon>
          </Tooltip>
        </div>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.server.console.terminalHeaderRightComponents
              .appendedComponents
          }
          name='console-terminalHeaderRight-appended'
        />
      </div>
    </div>
  );
}
