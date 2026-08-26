import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { join } from 'pathe';
import ActionIcon from '@/elements/ActionIcon.tsx';
import UnstyledButton from '@/elements/UnstyledButton.tsx';
import FileRowIcon from '@/pages/server/files/browser/FileRowIcon.tsx';
import FileTreeName from '@/pages/server/files/workspace/FileTreeName.tsx';
import {
  FileTreeEditorSelection,
  getFileTreeEditorTabId,
  setFileTreeEditorTabDragData,
} from '@/pages/server/files/workspace/fileTreeEditor.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface FileTreeEditorTabsProps {
  paneId: string;
  tabs: FileTreeEditorSelection[];
  activeTabId: string | null;
  dirtyTabIds: ReadonlySet<string>;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
}

export default function FileTreeEditorTabs({
  paneId,
  tabs,
  activeTabId,
  dirtyTabIds,
  onSelect,
  onClose,
}: FileTreeEditorTabsProps) {
  const { t } = useTranslations();

  if (tabs.length === 0) return null;

  return (
    <div
      role='tablist'
      aria-label={t('pages.server.files.tree.editorTabsLabel', {})}
      data-file-manager-editor-tabs
      className='file-manager-editor-tabs flex h-[3.375rem] min-h-[2.625rem] shrink-0 overflow-x-scroll overflow-y-hidden border-b border-(--mantine-color-default-border)'
    >
      {tabs.map((tab) => {
        const tabId = getFileTreeEditorTabId(tab);
        const active = tabId === activeTabId;
        const dirty = dirtyTabIds.has(tabId);
        const path = join(tab.directory, tab.file.name);

        return (
          <div
            key={tabId}
            data-file-manager-editor-tab
            data-active={active || undefined}
            data-dirty={dirty || undefined}
            draggable
            onDragStart={(event) => setFileTreeEditorTabDragData(event.dataTransfer, { tabId, paneId })}
            onMouseDown={(event) => {
              if (event.button === 1) event.preventDefault();
            }}
            onAuxClick={(event) => {
              if (event.button !== 1) return;

              event.preventDefault();
              event.stopPropagation();
              onClose(tabId);
            }}
            className={classNames(
              'group flex h-[2.625rem] min-h-[2.625rem] min-w-0 max-w-56 shrink-0 cursor-grab items-center gap-2 overflow-hidden border-r border-b-2 border-(--mantine-color-default-border) active:cursor-grabbing',
              active
                ? 'border-b-(--mantine-primary-color-filled) bg-(--mantine-color-default-hover)'
                : 'border-b-transparent hover:bg-(--mantine-color-default-hover)',
            )}
          >
            <UnstyledButton
              role='tab'
              type='button'
              title={path}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(tabId)}
              className='flex min-w-0 flex-1 items-center gap-2 overflow-hidden py-2 pl-4! text-sm'
            >
              <FileRowIcon file={tab.file} className='w-4 shrink-0' />
              <FileTreeName name={tab.file.name} className='flex-1' />
              {dirty && (
                <span
                  aria-label={t('pages.server.files.tree.unsavedTab', { name: tab.file.name })}
                  className='h-2 w-2 shrink-0 rounded-full bg-(--mantine-primary-color-filled)'
                />
              )}
            </UnstyledButton>

            <ActionIcon
              type='button'
              size='xs'
              variant='subtle'
              color='gray'
              className='mr-1.5 shrink-0'
              aria-label={t('pages.server.files.tree.closeEditorTab', { name: tab.file.name })}
              onClick={() => onClose(tabId)}
            >
              <FontAwesomeIcon icon={faXmark} />
            </ActionIcon>
          </div>
        );
      })}
    </div>
  );
}
