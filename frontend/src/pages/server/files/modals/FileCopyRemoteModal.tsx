import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import copyFilesRemote from '@/api/server/files/copyFilesRemote.ts';
import getServers from '@/api/server/getServers.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverDirectoryEntrySchema, serverFilesCopyRemoteSchema } from '@/lib/schemas/server/files.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  files: z.infer<typeof serverDirectoryEntrySchema>[];
};

export default function FileCopyRemoteModal({ files, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const { browsingDirectory, doSelectFiles } = useFileManager();

  const [loading, setLoading] = useState(false);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof serverFilesCopyRemoteSchema>>(
    {
      initialValues: {
        destination: '',
        destinationServer: '',
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(serverFilesCopyRemoteSchema),
    },
    onClose,
  );

  const servers = useSearchableResource<z.infer<typeof serverSchema>>({
    fetcher: (search) => getServers(1, search),
  });

  const doCopy = () => {
    setLoading(true);

    copyFilesRemote(server.uuid, {
      ...form.values,
      root: browsingDirectory,
      files: files.map((f) => f.name),
    })
      .then(() => {
        doSelectFiles([]);
        addToast(t('pages.server.files.toast.fileCopyingStarted', {}), 'success');
        handleClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.files.modal.copyRemote.title', {})} onClose={handleClose} opened={opened}>
      <form onSubmit={form.onSubmit(() => doCopy())}>
        <Stack>
          <Select
            withAsterisk
            label={t('pages.server.files.modal.copyRemote.form.server', {})}
            placeholder={t('pages.server.files.modal.copyRemote.form.server', {})}
            data={servers.items
              .filter((s) => s.uuid !== server.uuid)
              .reduce(
                (acc, server) => {
                  const group = acc.find((g) => g.group === server.nodeName);
                  const serverItem = { label: server.name, value: server.uuid };

                  if (group) {
                    group.items.push(serverItem);
                  } else {
                    acc.push({ group: server.nodeName, items: [serverItem] });
                  }

                  return acc;
                },
                [] as Array<{ group: string; items: Array<{ label: string; value: string }> }>,
              )}
            searchable
            searchValue={servers.search}
            onSearchChange={servers.setSearch}
            loading={servers.loading}
            allowDeselect
            {...form.getInputProps('destinationServer')}
            onChange={(value) => form.setFieldValue('destinationServer', value || '')}
          />

          <TextInput
            label={t('pages.server.files.modal.copyRemote.form.destination', {})}
            placeholder={t('pages.server.files.modal.copyRemote.form.destination', {})}
            {...form.getInputProps('destination')}
          />
        </Stack>

        <p className='mt-2 text-sm md:text-base break-all'>
          <span className='text-neutral-200'>{t('pages.server.files.modal.copyRemote.createdAs', {})}</span>
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
      </form>
    </Modal>
  );
}
