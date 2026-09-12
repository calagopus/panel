import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faClipboard,
  faFolderOpen,
  faThumbtack,
  faWindowRestore,
  faXmark,
  faXmarksLines,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { join } from 'pathe';
import { handleRawCopyToClipboard } from '@/lib/clipboard/copy.ts';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/quickActions/coreQuickActions.tsx';
import {
  FileTreeEditorSelection,
  FileTreeTabCloseAction,
  getFileTreeEditorTabId,
  getRelativeFileTreeTabId,
} from '@/pages/server/files/tree/fileTreeEditor.ts';
import { useQuickActions } from '@/plugins/quick-actions/useQuickActions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface FileTreeTabQuickActionsOptions {
  enabled: boolean;
  tabs: FileTreeEditorSelection[];
  activeTabId: string | null;
  previewTabId?: string;
  dirtyTabIds: ReadonlySet<string>;
  onClose: (tabId: string, action?: FileTreeTabCloseAction) => void;
  onSelect: (tabId: string) => void;
  onReveal: (tabId: string) => void;
  onKeepOpen: (tabId: string) => void;
}

export default function useFileTreeTabQuickActions({
  enabled,
  tabs,
  activeTabId,
  previewTabId,
  dirtyTabIds,
  onClose,
  onSelect,
  onReveal,
  onKeepOpen,
}: FileTreeTabQuickActionsOptions) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const tabIds = tabs.map(getFileTreeEditorTabId);
  const index = tabIds.indexOf(activeTabId ?? '');
  const tab = tabs[index];
  const hasPath = !!tab && tab.action !== 'new';
  const category = CORE_QUICK_ACTION_CATEGORIES.page;
  const closeActions = [
    {
      action: undefined,
      icon: faXmark,
      label: () => t('pages.server.files.tree.closeEditorTab', { name: tab?.file.name ?? '' }),
      visible: true,
    },
    {
      action: 'others',
      icon: faWindowRestore,
      label: () => t('pages.server.files.tree.closeOtherTabs', {}),
      visible: tabs.length > 1,
    },
    {
      action: 'right',
      icon: faArrowRight,
      label: () => t('pages.server.files.tree.closeTabsToRight', {}),
      visible: index < tabs.length - 1,
    },
    {
      action: 'saved',
      icon: faCheck,
      label: () => t('pages.server.files.tree.closeSavedTabs', {}),
      visible: tabs.some((entry) => entry.action !== 'new' && !dirtyTabIds.has(getFileTreeEditorTabId(entry))),
    },
    { action: 'all', icon: faXmarksLines, label: () => t('pages.server.files.tree.closeAllTabs', {}), visible: true },
  ] as const;

  useQuickActions(
    [
      ...closeActions.map(({ action, icon, label, visible }) => ({
        id: `files.tree.close.${action ?? 'current'}`,
        category,
        label,
        icon: <FontAwesomeIcon icon={icon} />,
        keywords: ['tab', 'editor'],
        isVisible: () => visible,
        perform: () => {
          if (activeTabId) onClose(activeTabId, action);
        },
      })),
      ...([-1, 1] as const).map((offset) => ({
        id: `files.tree.${offset === -1 ? 'previous' : 'next'}Tab`,
        category,
        label: () =>
          t(
            offset === -1
              ? 'pages.account.shortcuts.fileManager.previousEditorTab'
              : 'pages.account.shortcuts.fileManager.nextEditorTab',
            {},
          ),
        icon: <FontAwesomeIcon icon={offset === -1 ? faArrowLeft : faArrowRight} />,
        isVisible: () => tabs.length > 1,
        perform: () => {
          const next = getRelativeFileTreeTabId(tabIds, activeTabId, offset);
          if (next) onSelect(next);
        },
      })),
      {
        id: 'files.tree.reveal',
        category,
        label: () => t('pages.server.files.tree.revealInTree', {}),
        icon: <FontAwesomeIcon icon={faFolderOpen} />,
        keywords: ['locate', 'active', 'file'],
        permission: 'files.read',
        isVisible: () => hasPath,
        perform: () => {
          if (activeTabId) onReveal(activeTabId);
        },
      },
      {
        id: 'files.tree.keepOpen',
        category,
        label: () => t('pages.server.files.quickAction.keepFileOpen', {}),
        icon: <FontAwesomeIcon icon={faThumbtack} />,
        keywords: ['preview', 'tab'],
        isVisible: () => activeTabId === previewTabId,
        perform: () => {
          if (activeTabId) onKeepOpen(activeTabId);
        },
      },
      {
        id: 'files.tree.copyFilePath',
        category,
        label: () => t('pages.server.files.quickAction.copyFilePath', {}),
        icon: <FontAwesomeIcon icon={faClipboard} />,
        keywords: ['clipboard', 'active'],
        isVisible: () => hasPath,
        perform: () => {
          if (hasPath) handleRawCopyToClipboard(join('/', tab.directory, tab.file.name), addToast);
        },
      },
    ],
    enabled && !!tab,
  );
}
