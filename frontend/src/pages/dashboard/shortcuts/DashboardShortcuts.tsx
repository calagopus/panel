import { faApple, faWindows } from '@fortawesome/free-brands-svg-icons';
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faFolder,
  faServer,
  faTable,
  faTerminal,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Flex, Text } from '@mantine/core';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { ShortcutItemProps } from './ShortcutItem.tsx';
import ShortcutSection from './ShortcutSection.tsx';

export default function DashboardShortcuts() {
  const { t } = useTranslations();

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? 'Cmd' : 'Ctrl';

  const fileManagerShortcuts: ShortcutItemProps[] = [
    { keys: [modKey, 'A'], description: t('pages.account.shortcuts.fileManager.selectAll', {}) },
    { keys: [modKey, 'X'], description: t('pages.account.shortcuts.fileManager.cutFiles', {}) },
    { keys: [modKey, 'C'], description: t('pages.account.shortcuts.fileManager.copyFiles', {}) },
    { keys: [modKey, 'D'], description: t('pages.account.shortcuts.fileManager.duplicateFile', {}) },
    { keys: [modKey, 'V'], description: t('pages.account.shortcuts.fileManager.pasteFiles', {}) },
    { keys: [modKey, 'K'], description: t('pages.account.shortcuts.fileManager.searchFiles', {}) },
    { keys: ['Alt', { icon: faArrowUp }], description: t('pages.account.shortcuts.fileManager.moveUpDirectory', {}) },
    { keys: [{ icon: faArrowUp }], description: t('pages.account.shortcuts.fileManager.moveUpSelection', {}) },
    { keys: [{ icon: faArrowDown }], description: t('pages.account.shortcuts.fileManager.moveDownSelection', {}) },
    { keys: ['F2'], description: t('pages.account.shortcuts.fileManager.renameFile', {}) },
    { keys: ['Esc'], description: t('pages.account.shortcuts.fileManager.deselectAll', {}) },
    { keys: ['Del'], description: t('pages.account.shortcuts.fileManager.deleteFiles', {}) },
  ];

  const tableShortcuts: ShortcutItemProps[] = [
    { keys: [{ icon: faArrowLeft }], description: t('pages.account.shortcuts.table.previousPage', {}) },
    { keys: [{ icon: faArrowRight }], description: t('pages.account.shortcuts.table.nextPage', {}) },
    { keys: ['Shift', { icon: faArrowLeft }], description: t('pages.account.shortcuts.table.firstPage', {}) },
    { keys: ['Shift', { icon: faArrowRight }], description: t('pages.account.shortcuts.table.lastPage', {}) },
  ];

  const consoleShortcuts: ShortcutItemProps[] = [
    { keys: [modKey, 'F'], description: t('pages.account.shortcuts.console.searchContent', {}) },
    { keys: [{ icon: faArrowUp }], description: t('pages.account.shortcuts.console.previousCommand', {}) },
    { keys: [{ icon: faArrowDown }], description: t('pages.account.shortcuts.console.nextCommand', {}) },
  ];

  const serverListShortcuts: ShortcutItemProps[] = [
    { keys: ['S', 'Click'], description: t('pages.account.shortcuts.serverList.selectServer', {}) },
  ];

  return (
    <AccountContentContainer
      title={t('pages.account.shortcuts.title', {})}
      subtitle={t('pages.account.shortcuts.subtitle', {})}
      contentRight={
        <Flex
          align='center'
          gap='xs'
          px='sm'
          py={6}
          style={{
            background: 'var(--mantine-color-dark-6)',
            borderRadius: 6,
            border: '1px solid var(--mantine-color-dark-5)',
          }}
        >
          <FontAwesomeIcon icon={isMac ? faApple : faWindows} style={{ color: 'var(--mantine-color-gray-5)' }} />
          <Text size='sm' c='gray.5'>
            {isMac ? t('pages.account.shortcuts.detectedMac', {}) : t('pages.account.shortcuts.detectedWindows', {})}
          </Text>
        </Flex>
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.keyboardShortcuts.container}
    >
      <div className='md:columns-2 gap-4 space-y-4'>
        {window.extensionContext.extensionRegistry.pages.dashboard.keyboardShortcuts.shortcutSections.prependedComponents.map(
          (Component, i) => (
            <Component key={`shortcuts-shortcutSection-prepended-${i}`} />
          ),
        )}

        <ShortcutSection
          title={t('pages.account.shortcuts.fileManager.title', {})}
          icon={faFolder}
          shortcuts={fileManagerShortcuts}
        />
        <ShortcutSection
          title={t('pages.account.shortcuts.table.title', {})}
          icon={faTable}
          shortcuts={tableShortcuts}
        />
        <ShortcutSection
          title={t('pages.account.shortcuts.console.title', {})}
          icon={faTerminal}
          shortcuts={consoleShortcuts}
        />
        <ShortcutSection
          title={t('pages.account.shortcuts.serverList.title', {})}
          icon={faServer}
          shortcuts={serverListShortcuts}
        />

        {window.extensionContext.extensionRegistry.pages.dashboard.keyboardShortcuts.shortcutSections.appendedComponents.map(
          (Component, i) => (
            <Component key={`shortcuts-shortcutSection-appended-${i}`} />
          ),
        )}
      </div>
    </AccountContentContainer>
  );
}
