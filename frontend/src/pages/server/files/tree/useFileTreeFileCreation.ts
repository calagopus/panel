import { basename, dirname, join } from 'pathe';
import { useRef } from 'react';
import saveFileContent from '@/api/server/files/saveFileContent.ts';
import { readFileDraft } from '@/lib/files/fileDrafts.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';
import { TreeDirectoryCapabilities } from './fileTreeData.ts';
import { FileTreeEditorSelection, getFileTreeEditorDraftPath, getFileTreeEditorTabId } from './fileTreeEditor.ts';

interface FileTreeFileCreationOptions {
  initialTabCount: number;
  getTabs: () => FileTreeEditorSelection[];
  getDraftContent: (tabId: string) => string | undefined;
  onSaved: (tab: FileTreeEditorSelection, nextTab: FileTreeEditorSelection, submitted: string) => void;
}

export default function useFileTreeFileCreation({
  initialTabCount,
  getTabs,
  getDraftContent,
  onSaved,
}: FileTreeFileCreationOptions) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const store = useFileManagerApi();
  const canCreate = useServerCan('files.create');
  const pending = useRef(new Map<string, string>());
  const sequence = useRef(initialTabCount);

  const createFile = (directory: string, capabilities: TreeDirectoryCapabilities): FileTreeEditorSelection | null => {
    if (!canCreate || !capabilities.writable) return null;
    sequence.current += 1;
    const now = new Date();
    return {
      directory,
      action: 'new',
      params: { draftId: crypto.randomUUID() },
      primary: capabilities.primary,
      writable: capabilities.writable,
      file: {
        name: `${t('pages.server.files.titleEditorNew', {})} ${sequence.current}`,
        mode: '',
        modeBits: '',
        size: 0,
        sizePhysical: 0,
        editable: true,
        innerEditable: false,
        directory: false,
        file: true,
        symlink: false,
        virtual: false,
        mime: 'text/plain',
        modified: now,
        created: now,
      },
    };
  };

  const saveNewFile = async (tabId: string, name: string) => {
    const tab = getTabs().find((entry) => getFileTreeEditorTabId(entry) === tabId);
    if (!canCreate || !tab?.writable || tab.action !== 'new' || pending.current.has(tabId)) return;
    const filePath = join(tab.directory, name);
    if (
      Array.from(pending.current.values()).includes(filePath) ||
      getTabs().some((entry) => entry.action !== 'new' && join(entry.directory, entry.file.name) === filePath)
    ) {
      throw new Error(t('pages.server.files.toast.closeDestinationBeforeCreate', {}));
    }
    const submitted =
      getDraftContent(tabId) ?? readFileDraft(server.uuid, getFileTreeEditorDraftPath(tab))?.content ?? '';
    pending.current.set(tabId, filePath);
    return saveFileContent(server.uuid, filePath, submitted)
      .then(() => {
        store.getState().invalidateFilemanager();
        if (!getTabs().some((entry) => getFileTreeEditorTabId(entry) === tabId)) return;
        onSaved(
          tab,
          {
            ...tab,
            directory: dirname(filePath),
            action: 'edit',
            params: {},
            file: { ...tab.file, name: basename(filePath), size: new Blob([submitted]).size, modified: new Date() },
          },
          submitted,
        );
        addToast(t('pages.server.files.toast.fileSaved', {}), 'success');
      })
      .finally(() => {
        pending.current.delete(tabId);
      });
  };

  return { createFile, saveNewFile };
}
