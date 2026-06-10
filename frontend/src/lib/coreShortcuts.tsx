import { faFolder, faTable, faTerminal } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModifierKey, ShortcutCategory, ShortcutDefinition } from '@/lib/shortcuts.ts';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export const CORE_SHORTCUT_CATEGORIES = {
  files: 'files',
  table: 'table',
  console: 'console',
} as const;

function binding(key: string, modifiers: ModifierKey[] = []) {
  return { key, modifiers };
}

export function buildCoreShortcutCategories(): Record<string, ShortcutCategory> {
  return {
    files: {
      id: CORE_SHORTCUT_CATEGORIES.files,
      label: () => getTranslations().t('pages.account.shortcuts.fileManager.title', {}),
      icon: <FontAwesomeIcon icon={faFolder} size='sm' />,
    },
    table: {
      id: CORE_SHORTCUT_CATEGORIES.table,
      label: () => getTranslations().t('pages.account.shortcuts.table.title', {}),
      icon: <FontAwesomeIcon icon={faTable} size='sm' />,
    },
    console: {
      id: CORE_SHORTCUT_CATEGORIES.console,
      label: () => getTranslations().t('pages.account.shortcuts.console.title', {}),
      icon: <FontAwesomeIcon icon={faTerminal} size='sm' />,
    },
  };
}

let coreDefinitions: ShortcutDefinition[] | null = null;

export function getShortcutDefinitions(): ShortcutDefinition[] {
  coreDefinitions ??= buildCoreShortcutDefinitions();
  return [...coreDefinitions, ...window.extensionContext.extensionRegistry.shortcuts.definitions];
}

export function getShortcutDefinition(id: string): ShortcutDefinition | undefined {
  return getShortcutDefinitions().find((definition) => definition.id === id);
}

function buildCoreShortcutDefinitions(): ShortcutDefinition[] {
  const fileManager = CORE_SHORTCUT_CATEGORIES.files;
  const table = CORE_SHORTCUT_CATEGORIES.table;
  const console = CORE_SHORTCUT_CATEGORIES.console;

  return [
    {
      id: 'files.selectAll',
      category: fileManager,
      description: () => getTranslations().t('pages.account.shortcuts.fileManager.selectAll', {}),
      defaultBinding: binding('a', ['ctrlOrMeta']),
    },
    {
      id: 'files.cut',
      category: fileManager,
      description: () => getTranslations().t('pages.account.shortcuts.fileManager.cutFiles', {}),
      defaultBinding: binding('x', ['ctrlOrMeta']),
    },
    {
      id: 'files.copy',
      category: fileManager,
      description: () => getTranslations().t('pages.account.shortcuts.fileManager.copyFiles', {}),
      defaultBinding: binding('c', ['ctrlOrMeta']),
    },
    {
      id: 'files.paste',
      category: fileManager,
      description: () => getTranslations().t('pages.account.shortcuts.fileManager.pasteFiles', {}),
      defaultBinding: binding('v', ['ctrlOrMeta']),
    },
    {
      id: 'files.duplicate',
      category: fileManager,
      description: () => getTranslations().t('pages.account.shortcuts.fileManager.duplicateFile', {}),
      defaultBinding: binding('d'),
    },
    {
      id: 'files.search',
      category: fileManager,
      description: () => getTranslations().t('pages.account.shortcuts.fileManager.searchFiles', {}),
      defaultBinding: binding('k', ['ctrlOrMeta']),
    },
    {
      id: 'files.moveUpDirectory',
      category: fileManager,
      description: () => getTranslations().t('pages.account.shortcuts.fileManager.moveUpDirectory', {}),
      defaultBinding: binding('ArrowUp', ['alt']),
    },
    {
      id: 'files.moveUpSelection',
      category: fileManager,
      description: () => getTranslations().t('pages.account.shortcuts.fileManager.moveUpSelection', {}),
      defaultBinding: binding('ArrowUp'),
    },
    {
      id: 'files.moveDownSelection',
      category: fileManager,
      description: () => getTranslations().t('pages.account.shortcuts.fileManager.moveDownSelection', {}),
      defaultBinding: binding('ArrowDown'),
    },
    {
      id: 'files.rename',
      category: fileManager,
      description: () => getTranslations().t('pages.account.shortcuts.fileManager.renameFile', {}),
      defaultBinding: binding('F2'),
    },
    {
      id: 'files.deselectAll',
      category: fileManager,
      description: () => getTranslations().t('pages.account.shortcuts.fileManager.deselectAll', {}),
      defaultBinding: binding('Escape'),
    },
    {
      id: 'files.delete',
      category: fileManager,
      description: () => getTranslations().t('pages.account.shortcuts.fileManager.deleteFiles', {}),
      defaultBinding: binding('Delete'),
    },
    {
      id: 'table.previousPage',
      category: table,
      description: () => getTranslations().t('pages.account.shortcuts.table.previousPage', {}),
      defaultBinding: binding('ArrowLeft'),
    },
    {
      id: 'table.nextPage',
      category: table,
      description: () => getTranslations().t('pages.account.shortcuts.table.nextPage', {}),
      defaultBinding: binding('ArrowRight'),
    },
    {
      id: 'table.firstPage',
      category: table,
      description: () => getTranslations().t('pages.account.shortcuts.table.firstPage', {}),
      defaultBinding: binding('ArrowLeft', ['shift']),
    },
    {
      id: 'table.lastPage',
      category: table,
      description: () => getTranslations().t('pages.account.shortcuts.table.lastPage', {}),
      defaultBinding: binding('ArrowRight', ['shift']),
    },
    {
      id: 'console.search',
      category: console,
      description: () => getTranslations().t('pages.account.shortcuts.console.searchContent', {}),
      defaultBinding: binding('f', ['ctrlOrMeta']),
      allowWhenInputFocused: true,
    },
    {
      id: 'console.previousCommand',
      category: console,
      description: () => getTranslations().t('pages.account.shortcuts.console.previousCommand', {}),
      defaultBinding: binding('ArrowUp'),
      allowWhenInputFocused: true,
    },
    {
      id: 'console.nextCommand',
      category: console,
      description: () => getTranslations().t('pages.account.shortcuts.console.nextCommand', {}),
      defaultBinding: binding('ArrowDown'),
      allowWhenInputFocused: true,
    },
  ];
}
