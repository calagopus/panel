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
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

function FileActionBar() {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const {
    actingMode,
    actingFiles,
    selectedFiles,
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
      selectedFiles: state.selectedFiles,
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

  const [loading, setLoading] = useState(false);

  const doCopy = () => {
    setLoading(true);

    copyFiles({
      uuid: server.uuid,
      root: '/',
      files: actingFiles.values().map((f) => ({
        from: join(actingFilesSource!, f.name),
        to: join(browsingDirectory, f.name),
      })),
    })
      .then(() => {
        addToast(t('pages.server.files.toast.copyingStarted', { files: tItem('file', actingFiles.size) }), 'success');
        clearActingFiles();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
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
    setLoading(true);

    downloadFiles(
      server.uuid,
      browsingDirectory,
      selectedFiles.keys(),
      selectedFiles.size === 1 ? selectedFiles.values()[0].directory : false,
      'zip',
    )
      .then(({ url }) => {
        addToast(t('pages.server.files.toast.downloadStarted', {}), 'success');
        window.location.href = url;
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

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
          if (actingFiles.size === 0 && selectedFiles.size > 0 && browsingWritableDirectory) {
            doActFiles('move', selectedFiles.values());
            doSelectFiles([]);
          }
        },
      },
      {
        id: 'files.copy',
        callback: () => {
          if (actingFiles.size === 0 && selectedFiles.size > 0) {
            doActFiles('copy', selectedFiles.values());
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
            browsingDirectory !== actingFilesSource
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
          if (actingFiles.size === 0 && selectedFiles.size > 0 && browsingWritableDirectory) {
            doOpenModal('delete', selectedFiles.values());
          }
        },
      },
    ],
    deps: [
      actingMode,
      actingFiles,
      actingFilesSource,
      selectedFiles,
      loading,
      browsingWritableDirectory,
      browsingDirectory,
    ],
  });

  return (
    <ActionBar opened={actingFiles.size > 0 || selectedFiles.size > 0}>
      {window.extensionContext.extensionRegistry.pages.server.files.fileActionBar.prependedComponents.map(
        (Component, i) => (
          <Component key={`files-actionBar-prepended-${i}`} />
        ),
      )}

      {actingFiles.size > 0 ? (
        <>
          {actingMode === 'copy' ? (
            <Tooltip label={t('pages.server.files.actionBar.copyHere', { files: tItem('file', actingFiles.size) })}>
              <Button
                onClick={doCopy}
                loading={loading}
                disabled={!browsingWritableDirectory || browsingDirectory === actingFilesSource}
              >
                <FontAwesomeIcon icon={faAnglesDown} />
              </Button>
            </Tooltip>
          ) : (
            <Tooltip label={t('pages.server.files.actionBar.moveHere', { files: tItem('file', actingFiles.size) })}>
              <Button
                onClick={doMove}
                loading={loading}
                disabled={!browsingWritableDirectory || browsingDirectory === actingFilesSource}
              >
                <FontAwesomeIcon icon={faAnglesDown} />
              </Button>
            </Tooltip>
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
          <ServerCan action='files.read'>
            <Tooltip label={t('pages.server.files.button.remoteCopy', {})}>
              <Button onClick={() => doOpenModal('copy-remote', selectedFiles.values())}>
                <FontAwesomeIcon icon={faClone} />
              </Button>
            </Tooltip>
          </ServerCan>
          <ServerCan action='files.create'>
            <Tooltip label={t('pages.server.files.button.copy', {})}>
              <Button
                onClick={() => {
                  doActFiles('copy', selectedFiles.values());
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
                  <Button onClick={() => doOpenModal('archive', selectedFiles.values())}>
                    <FontAwesomeIcon icon={faArchive} />
                  </Button>
                </Tooltip>
              </ServerCan>
              <ServerCan action='files.update'>
                <Tooltip label={t('pages.server.files.button.rename', {})}>
                  <Button onClick={() => doOpenModal('mass-rename', selectedFiles.values())}>
                    <FontAwesomeIcon icon={faPen} />
                  </Button>
                </Tooltip>
              </ServerCan>
              <ServerCan action='files.update'>
                <Tooltip label={t('common.button.move', {})}>
                  <Button
                    onClick={() => {
                      doActFiles('move', selectedFiles.values());
                      doSelectFiles([]);
                    }}
                  >
                    <FontAwesomeIcon icon={faAnglesUp} />
                  </Button>
                </Tooltip>
              </ServerCan>
              <ServerCan action='files.delete'>
                <Tooltip label={t('common.button.delete', {})}>
                  <Button color='red' onClick={() => doOpenModal('delete', selectedFiles.values())}>
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
  );
}

export default memo(FileActionBar);
