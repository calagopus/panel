import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteFiles from '@/api/server/files/deleteFiles.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  files: z.infer<typeof serverDirectoryEntrySchema>[];
};

export default function FileDeleteModal({ files, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const doSelectFiles = useFileManager((state) => state.doSelectFiles);
  const invalidateFilemanager = useFileManager((state) => state.invalidateFilemanager);

  const [loading, setLoading] = useState(false);

  const doDelete = () => {
    setLoading(true);

    deleteFiles(
      server.uuid,
      browsingDirectory,
      files.map((f) => f.name),
    )
      .then(() => {
        addToast(t('pages.server.files.toast.filesDeleted', {}), 'success');
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
    <Modal title={t('pages.server.files.modal.deleteFile.title', {})} {...props}>
      {files.length === 1 ? (
        <p>{t('pages.server.files.modal.deleteFile.singleFileWarning', { file: files[0].name }).md()}</p>
      ) : (
        <>
          <p>{t('pages.server.files.modal.deleteFile.multipleFilesWarning', {}).md()}</p>
          <Code block className='mt-1'>
            <ul>
              {files.map((file) => (
                <li key={file.name}>
                  <span>{file.name}</span>
                </li>
              ))}
            </ul>
          </Code>
        </>
      )}

      <ModalFooter>
        <Button color='red' onClick={doDelete} loading={loading}>
          {t('common.button.delete', {})}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
