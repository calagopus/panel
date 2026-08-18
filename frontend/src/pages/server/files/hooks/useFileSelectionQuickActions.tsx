import {
  faAnglesDown,
  faAnglesUp,
  faArchive,
  faBan,
  faClone,
  faCopy,
  faEnvelopesBulk,
  faFileDownload,
  faFileShield,
  faFingerprint,
  faPen,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/coreQuickActions.tsx';
import { isArchiveType } from '@/lib/files.ts';
import { canMoveFilesToDirectory } from '@/pages/server/files/fileMove.ts';
import { useQuickActions } from '@/plugins/useQuickActions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi } from '@/stores/fileManager.ts';

interface UseFileSelectionQuickActionsOptions {
  doCopy: () => void;
  doMove: () => void;
  doDownload: () => void;
  loading: boolean;
}

export function useFileSelectionQuickActions({
  doCopy,
  doMove,
  doDownload,
  loading,
}: UseFileSelectionQuickActionsOptions) {
  const { t, tItem } = useTranslations();
  const store = useFileManagerApi();

  const page = CORE_QUICK_ACTION_CATEGORIES.page;
  const actingMode = store.getState().actingMode;

  const hasSelection = () => {
    const state = store.getState();
    return state.actingFiles.size === 0 && state.selectedFiles.size > 0;
  };

  const hasWritableSelection = () => hasSelection() && store.getState().browsingWritableDirectory;

  const singleSelected = () => {
    const { selectedFiles } = store.getState();
    return selectedFiles.size === 1 ? selectedFiles.values()[0] : null;
  };

  useQuickActions([
    {
      id: 'files.paste',
      category: page,
      label: () => {
        const { actingMode, actingFiles } = store.getState();

        return t(
          actingMode === 'copy' ? 'pages.server.files.actionBar.copyHere' : 'pages.server.files.actionBar.moveHere',
          {
            files: tItem(actingFiles.values().every((file) => file.directory) ? 'directory' : 'file', actingFiles.size),
          },
        );
      },
      icon: <FontAwesomeIcon icon={faAnglesDown} />,
      permission: actingMode === 'copy' ? 'files.create' : 'files.update',
      isVisible: () => {
        const { actingFiles, actingFilesSource, actingMode, browsingDirectory, browsingWritableDirectory } =
          store.getState();

        return (
          actingFiles.size > 0 &&
          !loading &&
          browsingWritableDirectory &&
          (actingMode === 'copy' || canMoveFilesToDirectory(actingFiles.values(), actingFilesSource, browsingDirectory))
        );
      },
      perform: () => (store.getState().actingMode === 'copy' ? doCopy() : doMove()),
    },
    {
      id: 'files.cancelPaste',
      category: page,
      label: () => t('pages.server.files.quickAction.cancelPaste', {}),
      icon: <FontAwesomeIcon icon={faBan} />,
      isVisible: () => store.getState().actingFiles.size > 0,
      perform: () => store.getState().clearActingFiles(),
    },
    {
      id: 'files.downloadSelection',
      category: page,
      label: () => t('pages.server.files.quickAction.downloadSelection', {}),
      icon: <FontAwesomeIcon icon={faFileDownload} />,
      permission: 'files.read-content',
      isVisible: hasSelection,
      perform: doDownload,
    },
    {
      id: 'files.copySelection',
      category: page,
      label: () => t('pages.server.files.quickAction.copySelection', {}),
      icon: <FontAwesomeIcon icon={faCopy} />,
      permission: 'files.create',
      isVisible: hasSelection,
      perform: () => {
        const state = store.getState();
        state.doActFiles('copy', state.selectedFiles.values());
        state.doSelectFiles([]);
      },
    },
    {
      id: 'files.moveSelection',
      category: page,
      label: () => t('pages.server.files.quickAction.moveSelection', {}),
      keywords: ['cut'],
      icon: <FontAwesomeIcon icon={faAnglesUp} />,
      permission: 'files.update',
      isVisible: hasWritableSelection,
      perform: () => {
        const state = store.getState();
        state.doActFiles('move', state.selectedFiles.values());
        state.doSelectFiles([]);
      },
    },
    {
      id: 'files.remoteCopySelection',
      category: page,
      label: () => t('pages.server.files.quickAction.remoteCopySelection', {}),
      keywords: ['transfer'],
      icon: <FontAwesomeIcon icon={faClone} />,
      permission: 'files.read-content',
      isVisible: hasSelection,
      perform: () => {
        const state = store.getState();
        state.doOpenModal('copy-remote', state.selectedFiles.values());
      },
    },
    {
      id: 'files.archiveSelection',
      category: page,
      label: () => t('pages.server.files.quickAction.archiveSelection', {}),
      keywords: ['compress', 'zip', 'tar'],
      icon: <FontAwesomeIcon icon={faArchive} />,
      permission: 'files.archive',
      isVisible: hasWritableSelection,
      perform: () => {
        const state = store.getState();
        state.doOpenModal('archive', state.selectedFiles.values());
      },
    },
    {
      id: 'files.extractSelection',
      category: page,
      label: () => t('pages.server.files.quickAction.extractSelection', {}),
      keywords: ['decompress', 'unzip'],
      icon: <FontAwesomeIcon icon={faEnvelopesBulk} />,
      permission: 'files.archive',
      isVisible: () => {
        const file = singleSelected();
        return hasWritableSelection() && file !== null && isArchiveType(file);
      },
      perform: () => store.getState().doOpenModal('extract', [singleSelected()!]),
    },
    {
      id: 'files.renameSelection',
      category: page,
      label: () => t('pages.server.files.quickAction.renameSelection', {}),
      icon: <FontAwesomeIcon icon={faPen} />,
      permission: 'files.update',
      isVisible: hasWritableSelection,
      perform: () => {
        const state = store.getState();
        const files = state.selectedFiles.values();

        state.doOpenModal(files.length === 1 ? 'rename' : 'mass-rename', files);
      },
    },
    {
      id: 'files.permissionsSelection',
      category: page,
      label: () => t('pages.server.files.quickAction.permissionsSelection', {}),
      keywords: ['chmod'],
      icon: <FontAwesomeIcon icon={faFileShield} />,
      permission: 'files.update',
      isVisible: () => hasSelection() && singleSelected() !== null,
      perform: () => store.getState().doOpenModal('permissions', [singleSelected()!]),
    },
    {
      id: 'files.fingerprintSelection',
      category: page,
      label: () => t('pages.server.files.quickAction.fingerprintSelection', {}),
      keywords: ['hash', 'checksum', 'sha256', 'md5'],
      icon: <FontAwesomeIcon icon={faFingerprint} />,
      permission: 'files.read-content',
      isVisible: () => hasSelection() && (singleSelected()?.file ?? false),
      perform: () => store.getState().doOpenModal('fingerprint', [singleSelected()!]),
    },
    {
      id: 'files.deleteSelection',
      category: page,
      label: () => t('pages.server.files.quickAction.deleteSelection', {}),
      icon: <FontAwesomeIcon icon={faTrash} />,
      danger: true,
      permission: 'files.delete',
      isVisible: hasWritableSelection,
      perform: () => {
        const state = store.getState();
        state.doOpenModal('delete', state.selectedFiles.values());
      },
    },
  ]);
}
