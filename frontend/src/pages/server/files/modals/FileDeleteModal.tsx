import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteFiles from '@/api/server/files/deleteFiles.ts';
import restoreTrashEntries from '@/api/server/files/trash/restoreTrashEntries.ts';
import Button from '@/elements/buttons/Button.tsx';
import ItemPreviewList from '@/elements/data-display/ItemPreviewList.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { isTrashEnabled } from '@/lib/domain/server.ts';
import { createUndoAction } from '@/lib/files/undoableFileMutation.ts';
import { formatSeconds } from '@/lib/format/time.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import FileListItem from '@/pages/server/files/list/FileListItem.tsx';
import { useUndoableToast } from '@/plugins/toast/useUndoableToast.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { fileManagerUndoScope } from '@/stores/undoHistory.ts';

type Props = ModalProps & {
  files: z.infer<typeof serverDirectoryEntrySchema>[];
};

export default function FileDeleteModal({ files, ...props }: Props) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const addUndoableToast = useUndoableToast(fileManagerUndoScope(server.uuid));
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const browsingPrimaryFilesystem = useFileManager((state) => state.browsingPrimaryFilesystem);
  const doSelectFiles = useFileManager((state) => state.doSelectFiles);
  const invalidateFilemanager = useFileManager((state) => state.invalidateFilemanager);

  const [loading, setLoading] = useState(false);
  const [permanent, setPermanent] = useState(false);

  useEffect(() => {
    if (props.opened) {
      setPermanent(false);
    }
  }, [props.opened]);

  const trashAvailable = isTrashEnabled(server, browsingPrimaryFilesystem);
  const trash = trashAvailable && !permanent;
  const retention = formatSeconds(server.trash.retention ?? 0);

  const doDelete = () => {
    if (files.length === 0) return;

    setLoading(true);

    deleteFiles(
      server.uuid,
      browsingDirectory,
      files.map((f) => f.name),
      permanent,
    )
      .then(({ deleted, entries }) => {
        if (entries.length > 0) {
          const trashedFiles = tItem('file', entries.length);

          addUndoableToast(
            deleted > entries.length
              ? t('pages.server.files.toast.filesTrashedPartiallyDeleted', {
                  files: trashedFiles,
                  deleted: tItem('file', deleted - entries.length),
                })
              : t('pages.server.files.toast.filesTrashed', { files: trashedFiles }),
            createUndoAction(
              () => restoreTrashEntries({ uuid: server.uuid, entries: entries.map((entry) => ({ uuid: entry.uuid })) }),
              (result) => result.restored.length,
              {
                addToast,
                invalidateFilemanager,
                cannotUndoMessage: t('pages.server.files.toast.trashCouldNotBeUndone', {}),
                undoneMessage: (count) => t('pages.server.files.toast.trashUndone', { files: tItem('file', count) }),
                onError: (msg) => addToast(httpErrorToHuman(msg), 'error'),
              },
            ),
          );
        } else {
          addToast(t('pages.server.files.toast.filesDeleted', {}), 'success');
        }

        props.onClose();
        doSelectFiles([]);
        invalidateFilemanager();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={t(
        trash ? 'pages.server.files.modal.deleteFile.trashTitle' : 'pages.server.files.modal.deleteFile.title',
        {},
      )}
      {...props}
    >
      {files.length === 1 ? (
        trash ? (
          t('pages.server.files.modal.deleteFile.singleFileTrash', { file: files[0].name, retention }).md()
        ) : (
          t('pages.server.files.modal.deleteFile.singleFileWarning', { file: files[0].name }).md()
        )
      ) : (
        <>
          {trash
            ? t('pages.server.files.modal.deleteFile.multipleFilesTrash', { retention }).md()
            : t('pages.server.files.modal.deleteFile.multipleFilesWarning', {}).md()}
          <ItemPreviewList
            className='mt-2'
            items={files}
            getKey={(file) => file.name}
            renderItem={(file) => <FileListItem file={file} />}
          />
        </>
      )}

      {trashAvailable && (
        <Switch
          className='mt-4'
          label={t('pages.server.files.modal.deleteFile.permanent', {})}
          color='red'
          checked={permanent}
          onChange={(e) => setPermanent(e.target.checked)}
        />
      )}

      <ModalFooter>
        <Button color={trash ? 'blue' : 'red'} onClick={doDelete} loading={loading}>
          {t(trash ? 'pages.server.files.button.moveToTrash' : 'common.button.delete', {})}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
