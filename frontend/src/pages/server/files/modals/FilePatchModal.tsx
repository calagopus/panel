import { ModalProps } from '@mantine/core';
import { join, relative } from 'pathe';
import { useEffect } from 'react';
import { z } from 'zod';
import patchFiles from '@/api/server/files/patchFiles.ts';
import Button from '@/elements/buttons/Button.tsx';
import DirectoryBrowser from '@/elements/files/DirectoryBrowser.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { patchFormatLabelMapping } from '@/lib/enums.ts';
import { patchFormat, serverDirectoryEntrySchema, serverFilesPatchSchema } from '@/lib/schemas/server/files.ts';
import FilePathPreview from '@/pages/server/files/modals/FilePathPreview.tsx';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  file: z.infer<typeof serverDirectoryEntrySchema> | null;
};

const BSDIFF_EXTENSION = /\.(bsdiff|bsdiff4|bsdpatch)$/i;

function initialValues(
  file: z.infer<typeof serverDirectoryEntrySchema> | null,
  browsingDirectory: string,
): z.infer<typeof serverFilesPatchSchema> {
  const bsdiff = !!file && BSDIFF_EXTENSION.test(file.name);

  return {
    root: browsingDirectory,
    format: bsdiff ? 'bsdiff' : 'git',
    file: bsdiff ? file.name.replace(BSDIFF_EXTENSION, '') : null,
    strip: 1,
  };
}

export default function FilePatchModal({ file, ...props }: Props) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const doSelectFiles = useFileManager((state) => state.doSelectFiles);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverFilesPatchSchema>>({
    initialValues: initialValues(file, browsingDirectory),
    schema: serverFilesPatchSchema,
    onClose: props.onClose,
    onSubmit: async (values) => {
      if (!file) return;

      const patchPath = join(browsingDirectory, file.name);
      const relativePath = relative(values.root, patchPath);
      const patched = await patchFiles(server.uuid, {
        root: values.root,
        format: values.format,
        source: { type: 'file', path: relativePath.startsWith('..') ? patchPath : relativePath },
        file: values.format === 'bsdiff' ? values.file : null,
        strip: values.strip,
      });
      doSelectFiles([]);
      addToast(t('pages.server.files.toast.filesPatched', { files: tItem('file', patched) }), 'success');
    },
  });

  useEffect(() => {
    if (props.opened) {
      form.setValues(initialValues(file, browsingDirectory));
      form.resetDirty();
    }
  }, [props.opened]);

  return (
    <FormModal
      title={t('pages.server.files.modal.patchFile.title', {})}
      isDirty={isDirty}
      loading={loading}
      size='lg'
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Select
          withAsterisk
          label={t('pages.server.files.modal.patchFile.form.format', {})}
          data={Object.entries(patchFormatLabelMapping).map(([value, label]) => ({ label, value }))}
          {...form.getInputProps('format')}
          onChange={(value) => value && form.setFieldValue('format', value as z.infer<typeof patchFormat>)}
        />

        <DirectoryBrowser
          serverUuid={server.uuid}
          path={form.values.root}
          onNavigate={(path) => form.setFieldValue('root', path)}
        />

        <TextInput
          withAsterisk
          label={t('pages.server.files.modal.patchFile.form.directory', {})}
          {...form.getInputProps('root')}
        />

        {form.values.format === 'git' ? (
          <NumberInput
            withAsterisk
            label={t('pages.server.files.modal.patchFile.form.strip', {})}
            description={t('pages.server.files.modal.patchFile.form.stripDescription', {})}
            min={0}
            allowDecimal={false}
            {...form.getInputProps('strip')}
          />
        ) : (
          <TextInput
            withAsterisk
            label={t('pages.server.files.modal.patchFile.form.file', {})}
            description={t('pages.server.files.modal.patchFile.form.fileDescription', {})}
            {...form.getInputProps('file')}
          />
        )}
      </Stack>

      <FilePathPreview
        label={t('pages.server.files.modal.patchFile.appliedIn', { file: file?.name ?? '' })}
        path={
          form.values.format === 'bsdiff' && form.values.file
            ? join(form.values.root, form.values.file)
            : form.values.root
        }
      />

      <ModalFooter>
        <Button type='submit' loading={loading}>
          {t('pages.server.files.button.applyPatch', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
