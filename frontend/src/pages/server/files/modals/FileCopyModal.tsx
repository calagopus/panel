import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import copyFile from '@/api/server/files/copyFile.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import DirectoryBrowser from '@/elements/files/DirectoryBrowser.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import {
  serverDirectoryEntrySchema,
  serverFilesCopySchema,
  serverFilesCopyToDirectorySchema,
} from '@/lib/schemas/server/files.ts';
import FilePathPreview from '@/pages/server/files/modals/FilePathPreview.tsx';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  file: z.infer<typeof serverDirectoryEntrySchema> | null;
};

type CopyValues = {
  name: string;
  destination: string;
};

export default function FileCopyModal({ file, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const browsingEntries = useFileManager((state) => state.browsingEntries);
  const browsingWritableDirectory = useFileManager((state) => state.browsingWritableDirectory);
  const canCreate = useServerCan('files.create');

  const readOnly = !browsingWritableDirectory;

  const [conflict, setConflict] = useState(false);
  const [overwriting, setOverwriting] = useState(false);

  const buildDestination = (values: CopyValues): string | null =>
    readOnly ? join(values.destination, values.name) : values.name || null;

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<CopyValues>({
    initialValues: {
      name: '',
      destination: '/',
    },
    validate: zod4Resolver(readOnly ? serverFilesCopyToDirectorySchema : serverFilesCopySchema),
    onClose: () => {
      setConflict(false);
      props.onClose();
    },
    onSubmit: async (values) => {
      if (!file) return;
      await copyFile(server.uuid, join(browsingDirectory, file.name), buildDestination(values));
      addToast(t('pages.server.files.toast.fileCopyingStarted', {}), 'success');
    },
    onError: (err) => {
      const status =
        err && typeof err === 'object' && 'response' in err && (err as { response?: { status?: number } }).response
          ? (err as { response: { status: number } }).response.status
          : null;

      if (status === 409) {
        setConflict(true);
      } else {
        addToast(httpErrorToHuman(err), 'error');
      }
    },
  });

  useEffect(() => {
    if (props.opened && readOnly) {
      form.setValues({ name: file?.name ?? '', destination: '/' });
      form.resetDirty();
      setConflict(false);
    }
  }, [props.opened, readOnly, file?.name]);

  const doOverwrite = () => {
    if (!file) return;

    setOverwriting(true);
    copyFile(server.uuid, join(browsingDirectory, file.name), buildDestination(form.getValues()), true)
      .then(() => {
        addToast(t('pages.server.files.toast.fileCopyingStarted', {}), 'success');
        handleClose();
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setOverwriting(false));
  };

  const generateNewName = () => {
    if (!file) return '';

    const lastDotIndex = file.name.lastIndexOf('.');
    let extension = lastDotIndex > 0 ? file.name.slice(lastDotIndex) : '';
    let baseName = lastDotIndex > 0 ? file.name.slice(0, lastDotIndex) : file.name;

    if (baseName.endsWith('.tar')) {
      extension = '.tar' + extension;
      baseName = baseName.slice(0, -4);
    }

    const lastSlashIndex = file.name.lastIndexOf('/');
    const parent = lastSlashIndex > -1 ? file.name.slice(0, lastSlashIndex + 1) : '';

    let suffix = ' copy';

    for (let i = 0; i <= 50; i++) {
      if (i > 0) {
        suffix = ` copy ${i}`;
      }

      const newName = baseName.concat(suffix, extension);
      const newPath = parent + newName;

      const exists = browsingEntries.data.some((entry) => entry.name === newPath);

      if (!exists) {
        return newName;
      }

      if (i === 50) {
        const timestamp = new Date().toISOString();
        suffix = `copy.${timestamp}`;

        const finalName = baseName.concat(suffix, extension);
        return finalName;
      }
    }

    return baseName.concat(suffix, extension);
  };

  const previewPath = readOnly
    ? join(form.getValues().destination, form.getValues().name)
    : join(browsingDirectory, form.getValues().name || generateNewName());

  return (
    <FormModal
      title={t('pages.server.files.modal.copyFile.title', {})}
      isDirty={isDirty}
      loading={loading}
      size={readOnly ? 'lg' : undefined}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      {readOnly ? (
        <Stack>
          <DirectoryBrowser
            serverUuid={server.uuid}
            path={form.values.destination}
            onNavigate={(path) => {
              setConflict(false);
              form.setFieldValue('destination', path);
            }}
            withCreateDirectory={canCreate}
          />

          <TextInput
            label={t('common.form.fileName', {})}
            data-autofocus
            {...form.getInputProps('name')}
            onChange={(e) => {
              setConflict(false);
              form.getInputProps('name').onChange(e);
            }}
          />
        </Stack>
      ) : (
        <TextInput
          label={t('common.form.fileName', {})}
          data-autofocus
          {...form.getInputProps('name')}
          onChange={(e) => {
            setConflict(false);
            form.getInputProps('name').onChange(e);
          }}
        />
      )}

      <FilePathPreview label={t('pages.server.files.modal.copyFile.createdAs', {})} path={previewPath} />

      {conflict && (
        <Alert color='yellow' icon={<FontAwesomeIcon icon={faTriangleExclamation} />} className='mt-3'>
          {t('pages.server.files.modal.copyFile.conflict', {})}
        </Alert>
      )}

      <ModalFooter>
        {conflict ? (
          <Button color='red' loading={overwriting} onClick={doOverwrite}>
            {t('pages.server.files.modal.copyConflict.overwrite', {})}
          </Button>
        ) : (
          <Button type='submit' loading={loading}>
            {t('pages.server.files.button.copy', {})}
          </Button>
        )}
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
