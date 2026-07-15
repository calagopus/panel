import { Anchor, ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import copyFilesRemote from '@/api/server/files/copyFilesRemote.ts';
import loadDirectory from '@/api/server/files/loadDirectory.ts';
import Breadcrumbs from '@/elements/Breadcrumbs.tsx';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import { serverDirectoryEntrySchema, serverFilesCopyRemoteSchema } from '@/lib/schemas/server/files.ts';
import FileRowIcon from '@/pages/server/files/FileRowIcon.tsx';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

function RemoteFileBrowser({ serverUuid, onNavigate }: { serverUuid: string; onNavigate: (path: string) => void }) {
  const [remotePath, setRemotePath] = useState('/');

  useEffect(() => {
    setRemotePath('/');
    onNavigate('/');
  }, [serverUuid]);

  const { data, loading: isLoading } = useResource({
    queryKey: ['remote-file-browser', serverUuid, remotePath],
    queryFn: () => loadDirectory(serverUuid, remotePath, 1, 'name_asc'),
  });

  const navigateTo = (path: string) => {
    setRemotePath(path);
    onNavigate(path);
  };

  const pathSegments = remotePath.split('/').filter(Boolean);

  return (
    <div className='border border-(--mantine-color-default-border) rounded-md overflow-hidden'>
      <div className='px-3 py-2 border-b border-(--mantine-color-default-border) bg-(--mantine-color-body)'>
        <Breadcrumbs separatorMargin='xs'>
          <Anchor component='button' type='button' size='sm' onClick={() => navigateTo('/')}>
            container
          </Anchor>
          {pathSegments.map((seg, i) => {
            const segPath = '/' + pathSegments.slice(0, i + 1).join('/');
            const isLast = i === pathSegments.length - 1;
            return isLast ? (
              <span key={segPath} className='text-sm'>
                {seg}
              </span>
            ) : (
              <Anchor component='button' type='button' key={segPath} size='sm' onClick={() => navigateTo(segPath)}>
                {seg}
              </Anchor>
            );
          })}
        </Breadcrumbs>
      </div>

      <div className='overflow-y-auto max-h-52 bg-(--mantine-color-default)'>
        {isLoading ? (
          <Spinner.Centered size={20} />
        ) : !data || data.entries.data.length === 0 ? (
          <p className='text-sm text-(--mantine-color-dimmed) px-3 py-2'>Empty directory</p>
        ) : (
          data.entries.data.map((entry) => (
            <button
              key={entry.name}
              type='button'
              disabled={!entry.directory}
              onClick={() => navigateTo(join(remotePath, entry.name))}
              className='w-full flex items-center gap-3 px-3 py-1.5 text-sm text-left hover:bg-(--mantine-color-default-hover) disabled:opacity-40 disabled:cursor-default'
            >
              <FileRowIcon file={entry} />
              <span className='truncate'>{entry.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

type Props = ModalProps & {
  files: z.infer<typeof serverDirectoryEntrySchema>[];
};

export default function FileCopyRemoteModal({ files, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const doSelectFiles = useFileManager((state) => state.doSelectFiles);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverFilesCopyRemoteSchema>
  >({
    initialValues: {
      destination: '',
      destinationServer: '',
    },
    validate: zod4Resolver(serverFilesCopyRemoteSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await copyFilesRemote(server.uuid, {
        ...values,
        root: browsingDirectory,
        files: files.map((f) => f.name),
      });
      doSelectFiles([]);
      addToast(t('pages.server.files.toast.fileCopyingStarted', {}), 'success');
    },
  });

  const handleBrowserNavigate = (path: string) => {
    form.setFieldValue('destination', path.replace(/^\/+/, ''));
  };

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
          onChange={(value) => form.setFieldValue('destinationServer', value || '')}
        />

        {form.values.destinationServer && (
          <RemoteFileBrowser serverUuid={form.values.destinationServer} onNavigate={handleBrowserNavigate} />
        )}

        <TextInput label={t('common.form.destination', {})} {...form.getInputProps('destination')} />
      </Stack>

      <p className='mt-2 text-sm md:text-base break-all'>
        <span>{t('pages.server.files.modal.copyRemote.createdAs', {})}</span>
        <Code>
          /home/container/
          <span className='text-cyan-200'>{form.values.destination.replace(/^(\.\.\/|\/)+/, '')}</span>
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
