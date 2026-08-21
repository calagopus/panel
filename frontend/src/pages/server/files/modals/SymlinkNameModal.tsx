import { faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useEffect } from 'react';
import { z } from 'zod';
import createSymlink from '@/api/server/files/createSymlink.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverDirectoryEntrySchema, serverFilesSymlinkCreateSchema } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  file: z.infer<typeof serverDirectoryEntrySchema> | null;
};

export default function SymlinkNameModal({ file, ...props }: Props) {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const invalidateFilemanager = useFileManager((state) => state.invalidateFilemanager);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverFilesSymlinkCreateSchema>
  >({
    initialValues: {
      link: '',
      target: '',
    },
    validate: zod4Resolver(serverFilesSymlinkCreateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await createSymlink(server.uuid, browsingDirectory, values.link, values.target);
      invalidateFilemanager();
    },
  });

  useEffect(() => {
    if (props.opened) {
      form.setValues({ link: '', target: file ? join(browsingDirectory, file.name) : '' });
      form.resetDirty();
    }
  }, [props.opened, file?.name]);

  const linkPath = join(browsingDirectory, form.values.link);
  const targetPath = form.values.target.startsWith('/') ? form.values.target : join(linkPath, '..', form.values.target);

  return (
    <FormModal
      title={t('pages.server.files.modal.createSymlink.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <TextInput withAsterisk label={t('common.form.symlinkName', {})} data-autofocus {...form.getInputProps('link')} />

      <div className='flex justify-center mt-2'>
        <FontAwesomeIcon icon={faArrowDown} className='w-3 h-3 text-(--mantine-color-dimmed)' />
      </div>

      <TextInput
        withAsterisk
        className='mt-2'
        label={t('common.form.symlinkTarget', {})}
        description={t('pages.server.files.modal.createSymlink.targetDescription', {})}
        {...form.getInputProps('target')}
      />

      <p className='mt-2 text-sm md:text-base break-all'>
        <span>{t('pages.server.files.modal.createSymlink.createdAs', {})}</span>
        <Code>
          /home/container/
          <span className='text-cyan-200'>{linkPath.replace(/^(\.\.\/|\/)+/, '')}</span>
        </Code>
      </p>

      <p className='mt-2 text-sm md:text-base break-all'>
        <span>{t('pages.server.files.modal.createSymlink.pointsTo', {})}</span>
        <Code>
          /home/container/
          <span className='text-cyan-200'>{targetPath.replace(/^(\.\.\/|\/)+/, '')}</span>
        </Code>
      </p>

      <ModalFooter>
        <Button type='submit' loading={loading} disabled={!form.isValid()}>
          {t('common.button.create', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
