import { faFileCode } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactNode } from 'react';
import Card from '@/elements/data-display/Card.tsx';
import Text from '@/elements/typography/Text.tsx';
import {
  FileTreeEditorSelection,
  FileTreeTabCloseAction,
  FileTreeTabPosition,
} from '@/pages/server/files/tree/fileTreeEditor.ts';
import FileTreeEditorTabs from '@/pages/server/files/tree/FileTreeEditorTabs.tsx';
import useFileTreeTabQuickActions from '@/pages/server/files/tree/useFileTreeTabQuickActions.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface FileTreeEditorPaneProps {
  paneId: string;
  active: boolean;
  tabs: FileTreeEditorSelection[];
  activeTabId: string | null;
  previewTabId?: string;
  dirtyTabIds: ReadonlySet<string>;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, action?: FileTreeTabCloseAction) => void;
  onDropOnTabs: (dataTransfer: DataTransfer, position: FileTreeTabPosition) => void;
  onRevealTab: (tabId: string) => void;
  onKeepTabOpen: (tabId: string) => void;
  children: ReactNode;
}

export default function FileTreeEditorPane({
  paneId,
  active,
  tabs,
  activeTabId,
  previewTabId,
  dirtyTabIds,
  onSelectTab,
  onCloseTab,
  onDropOnTabs,
  onRevealTab,
  onKeepTabOpen,
  children,
}: FileTreeEditorPaneProps) {
  const { t } = useTranslations();

  useFileTreeTabQuickActions({
    enabled: active,
    tabs,
    activeTabId,
    previewTabId,
    dirtyTabIds,
    onClose: onCloseTab,
    onSelect: onSelectTab,
    onReveal: onRevealTab,
    onKeepOpen: onKeepTabOpen,
  });

  return (
    <Card p={0} data-file-manager-editor className='flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden'>
      <FileTreeEditorTabs
        paneId={paneId}
        tabs={tabs}
        activeTabId={activeTabId}
        previewTabId={previewTabId}
        dirtyTabIds={dirtyTabIds}
        onSelect={onSelectTab}
        onClose={onCloseTab}
        onDrop={onDropOnTabs}
        onReveal={onRevealTab}
        onKeepOpen={onKeepTabOpen}
      />
      {!activeTabId && (
        <div data-file-manager-editor-empty className='flex min-h-0 flex-1 items-center justify-center'>
          <div className='flex max-w-sm flex-col items-center gap-3 text-center text-(--mantine-color-dimmed)'>
            <FontAwesomeIcon icon={faFileCode} size='2x' />
            <Text>{t('pages.server.files.tree.selectFileToOpen', {})}</Text>
          </div>
        </div>
      )}
      {children}
    </Card>
  );
}
