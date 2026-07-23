import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import copyFilesRemote from '@/api/server/files/copyFilesRemote.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import DirectoryBrowser from '@/elements/DirectoryBrowser.tsx';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { serverDirectoryEntrySchema, serverFilesCopyRemoteSchema } from '@/lib/schemas/server/files.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { nullableString } from '@/lib/transformers.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useServerCanFor } from '@/plugins/usePermissions.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  files: z.infer<typeof serverDirectoryEntrySchema>[];
};

const formSchema = serverFilesCopyRemoteSchema.extend({
  name: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
});

export default function FileCopyRemoteModal({ files, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const doSelectFiles = useFileManager((state) => state.doSelectFiles);

  const [destinationServer, setDestinationServer] = useState<z.infer<typeof serverSchema> | null>(null);
  const canCreate = useServerCanFor(destinationServer?.permissions, 'files.create');

  const isSingleFile = files.length === 1;

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof formSchema>>({
    initialValues: {
      destination: '',
      destinationServer: '',
      name: '',
    },
    validate: zod4Resolver(formSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await copyFilesRemote(server.uuid, {
        destination: values.destination,
        destinationServer: values.destinationServer,
        root: browsingDirectory,
        files: files.map((f) => ({
          from: f.name,
          to: (isSingleFile && values.name) || f.name,
        })),
      });
      doSelectFiles([]);
      addToast(t('pages.server.files.toast.fileCopyingStarted', {}), 'success');
    },
  });

  useEffect(() => {
    if (form.values.destinationServer) {
      form.setFieldValue('destination', '');
    }
  }, [form.values.destinationServer]);

  return (
    <FormModal
      title={t('pages.server.files.modal.copyRemote.title', {})}
      isDirty={isDirty}
      loading={loading}
      size='lg'
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <ServerSelect
          withAsterisk
          label={t('pages.server.files.modal.copyRemote.form.server', {})}
          exclude={[server.uuid]}
          groupBy={(s) => s.nodeName}
          withOthersSwitch
          allowDeselect
          value={form.values.destinationServer}
          error={form.errors.destinationServer}
          onChange={(value, selected) => {
            form.setFieldValue('destinationServer', value || '');
            setDestinationServer(selected);
          }}
        />

        {form.values.destinationServer && (
          <DirectoryBrowser
            serverUuid={form.values.destinationServer}
            path={join('/', form.values.destination)}
            withCreateDirectory={canCreate}
            onNavigate={(path) => form.setFieldValue('destination', path.replace(/^\/+/, ''))}
          />
        )}

        <TextInput label={t('common.form.destination', {})} {...form.getInputProps('destination')} />

        {isSingleFile && (
          <TextInput
            label={t('common.form.fileName', {})}
            placeholder={files[0].name}
            {...form.getInputProps('name')}
          />
        )}
      </Stack>

      <p className='mt-2 text-sm md:text-base break-all'>
        <span>{t('pages.server.files.modal.copyRemote.createdAs', {})}</span>
        <Code>
          /home/container/
          <span className='text-cyan-200'>
            {(isSingleFile
              ? join(form.values.destination, form.values.name || files[0].name)
              : form.values.destination
            ).replace(/^(\.\.\/|\/)+/, '')}
          </span>
        </Code>
      </p>

      <ModalFooter>
        <Button type='submit' loading={loading}>
          {t('pages.server.files.button.copy', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
