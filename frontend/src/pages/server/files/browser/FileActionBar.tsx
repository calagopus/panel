import {
  faAnglesDown,
  faAnglesUp,
  faArchive,
  faBan,
  faClone,
  faCopy,
  faFileDownload,
  faPen,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { join } from 'pathe';
import { memo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import copyFiles from '@/api/server/files/copyFiles.ts';
import downloadFiles from '@/api/server/files/downloadFiles.ts';
import renameFiles from '@/api/server/files/renameFiles.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { downloadFilesWithToast } from '@/pages/server/files/browser/downloadFilesWithToast.ts';
import { canMoveFilesToDirectory } from '@/pages/server/files/browser/fileMove.ts';
import { useFileSelectionQuickActions } from '@/pages/server/files/hooks/useFileSelectionQuickActions.tsx';
import FileCopyConflictModal, {
  ConflictResolutions,
  FileConflict,
} from '@/pages/server/files/modals/FileCopyConflictModal.tsx';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useFileManager, useFileManagerApi } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

function FileActionBar() {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const store = useFileManagerApi();
  const {
    actingMode,
    actingFiles,
    selectedFilesCount,
    actingFilesSource,
    browsingDirectory,
    browsingWritableDirectory,
    doActFiles,
    doSelectFiles,
    clearActingFiles,
    doOpenModal,
    invalidateFilemanager,
  } = useFileManager(
    useShallow((state) => ({
      actingMode: state.actingMode,
      actingFiles: state.actingFiles,
      selectedFilesCount: state.selectedFiles.size,
      actingFilesSource: state.actingFilesSource,
      browsingDirectory: state.browsingDirectory,
      browsingWritableDirectory: state.browsingWritableDirectory,
      doActFiles: state.doActFiles,
      doSelectFiles: state.doSelectFiles,
      clearActingFiles: state.clearActingFiles,
      doOpenModal: state.doOpenModal,
      invalidateFilemanager: state.invalidateFilemanager,
    })),
  );

  const canCreate = useServerCan('files.create');
  const canUpdate = useServerCan('files.update');
  const canDelete = useServerCan('files.delete');

  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<FileConflict[] | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);

  const actingFilesItemKey = actingFiles.values().every((f) => f.directory) ? 'directory' : 'file';

  const doCopy = () => {
    setLoading(true);

    const files = actingFiles.values().map((f) => ({
      from: join(actingFilesSource!, f.name),
      to: join(browsingDirectory, f.name),
      source: f,
    }));

    copyFiles({
      uuid: server.uuid,
      root: '/',
      files: files.map(({ from, to }) => ({ from, to })),
    })
      .then(({ skipped }) => {
        clearActingFiles();

        if (skipped.length === 0) {
          addToast(t('pages.server.files.toast.copyingStarted', { files: tItem('file', files.length) }), 'success');
          return;
        }

        setConflicts(
          skipped
            .map((destination) => {
              const match = files.find((f) => f.to === destination.name);
              if (!match) return null;

              return { from: match.from, to: match.to, source: match.source, destination };
            })
            .filter((c): c is FileConflict => c !== null),
        );
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const doResolveConflicts = ({ overwrite, rename }: ConflictResolutions) => {
    setConflictLoading(true);

    Promise.all([
      overwrite.length > 0
        ? copyFiles({ uuid: server.uuid, root: '/', files: overwrite, overwrite: true })
        : Promise.resolve(),
      rename.length > 0 ? copyFiles({ uuid: server.uuid, root: '/', files: rename }) : Promise.resolve(),
    ])
      .then(() => {
        addToast(
          t('pages.server.files.toast.copyingStarted', { files: tItem('file', overwrite.length + rename.length) }),
          'success',
        );
        setConflicts(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setConflictLoading(false));
  };

  const doMove = () => {
    setLoading(true);

    renameFiles({
      uuid: server.uuid,
      root: '/',
      files: actingFiles.values().map((f) => ({
        from: join(actingFilesSource!, f.name),
        to: join(browsingDirectory, f.name),
      })),
    })
      .then(({ renamed }) => {
        if (renamed < 1) {
          addToast(t('pages.server.files.toast.filesCouldNotBeMoved', {}), 'error');
          return;
        }

        addToast(t('pages.server.files.toast.filesMoved', { files: tItem('file', renamed) }), 'success');
        clearActingFiles();
        invalidateFilemanager();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const doDownload = () => {
    const { selectedFiles } = store.getState();
    setLoading(true);

    downloadFilesWithToast(
      downloadFiles(
        server.uuid,
        browsingDirectory,
        selectedFiles.keys(),
        selectedFiles.size === 1 ? selectedFiles.values()[0].directory : false,
        'zip',
      ),
      { addToast, t },
    ).finally(() => setLoading(false));
  };

  useFileSelectionQuickActions({ doCopy, doMove, doDownload, loading });

  useKeyboardShortcuts({
    shortcuts: [
      {
        id: 'files.deselectAll',
        callback: () => {
          clearActingFiles();
          doSelectFiles([]);
        },
      },
      {
        id: 'files.cut',
        callback: () => {
          if (canUpdate && actingFiles.size === 0 && selectedFilesCount > 0 && browsingWritableDirectory) {
            doActFiles('move', store.getState().selectedFiles.values());
            doSelectFiles([]);
          }
        },
      },
      {
        id: 'files.copy',
        callback: () => {
          if (canCreate && actingFiles.size === 0 && selectedFilesCount > 0) {
            doActFiles('copy', store.getState().selectedFiles.values());
            doSelectFiles([]);
          }
        },
      },
      {
        id: 'files.paste',
        callback: () => {
          if (
            actingFiles.size > 0 &&
            !loading &&
            browsingWritableDirectory &&
            (actingMode === 'copy' ? canCreate : canUpdate) &&
            (actingMode === 'copy' ||
              canMoveFilesToDirectory(actingFiles.values(), actingFilesSource, browsingDirectory))
          ) {
            if (actingMode === 'copy') {
              doCopy();
            } else {
              doMove();
            }
          }
        },
      },
      {
        id: 'files.delete',
        callback: () => {
          if (canDelete && actingFiles.size === 0 && selectedFilesCount > 0 && browsingWritableDirectory) {
            doOpenModal('delete', store.getState().selectedFiles.values());
          }
        },
      },
    ],
    deps: [
      actingMode,
      actingFiles,
      actingFilesSource,
      selectedFilesCount,
      loading,
      browsingWritableDirectory,
      browsingDirectory,
      canCreate,
      canUpdate,
      canDelete,
    ],
  });

  return (
    <>
      <FileCopyConflictModal
        opened={conflicts !== null}
        onClose={() => setConflicts(null)}
        conflicts={conflicts ?? []}
        loading={conflictLoading}
        onResolve={doResolveConflicts}
      />

      <ActionBar opened={actingFiles.size > 0 || selectedFilesCount > 0}>
        {window.extensionContext.extensionRegistry.pages.server.files.fileActionBar.prependedComponents.map(
          (Component, i) => (
            <Component key={`files-actionBar-prepended-${i}`} />
          ),
        )}

        {actingFiles.size > 0 ? (
          <>
            {actingMode === 'copy' ? (
              <ServerCan action='files.create'>
                <Tooltip
                  label={t('pages.server.files.actionBar.copyHere', {
                    files: tItem(actingFilesItemKey, actingFiles.size),
                  })}
                >
                  <Button onClick={doCopy} loading={loading} disabled={!browsingWritableDirectory}>
                    <FontAwesomeIcon icon={faAnglesDown} />
                  </Button>
                </Tooltip>
              </ServerCan>
            ) : (
              <ServerCan action='files.update'>
                <Tooltip
                  label={t('pages.server.files.actionBar.moveHere', {
                    files: tItem(actingFilesItemKey, actingFiles.size),
                  })}
                >
                  <Button
                    onClick={doMove}
                    loading={loading}
                    disabled={
                      !browsingWritableDirectory ||
                      !canMoveFilesToDirectory(actingFiles.values(), actingFilesSource, browsingDirectory)
                    }
                  >
                    <FontAwesomeIcon icon={faAnglesDown} />
                  </Button>
                </Tooltip>
              </ServerCan>
            )}
            <Tooltip label={t('common.button.cancel', {})}>
              <Button variant='default' onClick={clearActingFiles}>
                <FontAwesomeIcon icon={faBan} />
              </Button>
            </Tooltip>
          </>
        ) : (
          <>
            <ServerCan action='files.read-content'>
              <Tooltip label={t('common.button.download', {})}>
                <Button onClick={doDownload} loading={loading}>
                  <FontAwesomeIcon icon={faFileDownload} />
                </Button>
              </Tooltip>
            </ServerCan>
            <ServerCan action='files.read-content'>
              <Tooltip label={t('pages.server.files.button.remoteCopy', {})}>
                <Button onClick={() => doOpenModal('copy-remote', store.getState().selectedFiles.values())}>
                  <FontAwesomeIcon icon={faClone} />
                </Button>
              </Tooltip>
            </ServerCan>
            <ServerCan action='files.create'>
              <Tooltip label={t('pages.server.files.button.copy', {})}>
                <Button
                  onClick={() => {
                    doActFiles('copy', store.getState().selectedFiles.values());
                    doSelectFiles([]);
                  }}
                >
                  <FontAwesomeIcon icon={faCopy} />
                </Button>
              </Tooltip>
            </ServerCan>
            {browsingWritableDirectory && (
              <>
                <ServerCan action='files.archive'>
                  <Tooltip label={t('pages.server.files.button.archive', {})}>
                    <Button onClick={() => doOpenModal('archive', store.getState().selectedFiles.values())}>
                      <FontAwesomeIcon icon={faArchive} />
                    </Button>
                  </Tooltip>
                </ServerCan>
                <ServerCan action='files.update'>
                  <Tooltip label={t('pages.server.files.button.rename', {})}>
                    <Button onClick={() => doOpenModal('mass-rename', store.getState().selectedFiles.values())}>
                      <FontAwesomeIcon icon={faPen} />
                    </Button>
                  </Tooltip>
                </ServerCan>
                <ServerCan action='files.update'>
                  <Tooltip label={t('common.button.move', {})}>
                    <Button
                      onClick={() => {
                        doActFiles('move', store.getState().selectedFiles.values());
                        doSelectFiles([]);
                      }}
                    >
                      <FontAwesomeIcon icon={faAnglesUp} />
                    </Button>
                  </Tooltip>
                </ServerCan>
                <ServerCan action='files.delete'>
                  <Tooltip label={t('common.button.delete', {})}>
                    <Button color='red' onClick={() => doOpenModal('delete', store.getState().selectedFiles.values())}>
                      <FontAwesomeIcon icon={faTrash} />
                    </Button>
                  </Tooltip>
                </ServerCan>
              </>
            )}
          </>
        )}

        {window.extensionContext.extensionRegistry.pages.server.files.fileActionBar.appendedComponents.map(
          (Component, i) => (
            <Component key={`files-actionBar-appended-${i}`} />
          ),
        )}
      </ActionBar>
    </>
  );
}

export default memo(FileActionBar);
