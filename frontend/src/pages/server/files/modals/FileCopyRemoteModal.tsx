import { ModalProps } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getServerGroupServers from '@/api/me/servers/groups/getServerGroupServers.ts';
import getServerGroups from '@/api/me/servers/groups/getServerGroups.ts';
import copyFilesRemoteMany from '@/api/server/files/copyFilesRemoteMany.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import DirectoryBrowser from '@/elements/files/DirectoryBrowser.tsx';
import Select from '@/elements/input/Select.tsx';
import ServerMultiSelect from '@/elements/input/ServerMultiSelect.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDirectoryEntrySchema, serverFilesCopyRemoteManySchema } from '@/lib/schemas/server/files.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { nullableString } from '@/lib/serialization/transformers.ts';
import FilePathPreview from '@/pages/server/files/modals/FilePathPreview.tsx';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { checkPermissions } from '@/plugins/usePermissions.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  files: z.infer<typeof serverDirectoryEntrySchema>[];
};

const formSchema = serverFilesCopyRemoteManySchema.extend({
  name: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
});

export default function FileCopyRemoteModal({ files, ...props }: Props) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const { user } = useAuth();
  const server = useServerStore((state) => state.server);
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const doSelectFiles = useFileManager((state) => state.doSelectFiles);

  const [destinationServers, setDestinationServers] = useState<z.infer<typeof serverSchema>[]>([]);
  const [addingGroup, setAddingGroup] = useState(false);

  const serverGroups = useQuery({
    queryKey: queryKeys.user.serverGroups.all(),
    queryFn: getServerGroups,
    enabled: props.opened,
  });

  const roleServerPermissions = user?.role?.serverPermissions || [];
  const canCreateOn = (target: z.infer<typeof serverSchema>) => {
    const permissions = [...target.permissions, ...roleServerPermissions];
    return permissions.includes('*') || checkPermissions(permissions, 'files.create')[0];
  };
  const serversWithoutCreate = destinationServers.filter((s) => !canCreateOn(s));
  const browseServer = destinationServers[0] ?? null;

  const isSingleFile = files.length === 1;

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof formSchema>>({
    initialValues: {
      destination: '',
      destinationServers: [],
      name: '',
    },
    validate: zod4Resolver(formSchema),
    onClose: () => {
      setDestinationServers([]);
      props.onClose();
    },
    onSubmit: async (values) => {
      const results = await copyFilesRemoteMany(server.uuid, {
        destination: values.destination,
        destinationServers: values.destinationServers,
        root: browsingDirectory,
        files: files.map((f) => ({
          from: f.name,
          to: (isSingleFile && values.name) || f.name,
        })),
      });
      doSelectFiles([]);

      const failed = results.filter((r) => r.error);
      if (failed.length === 0) {
        addToast(
          t('pages.server.files.toast.fileCopyingStartedMany', { servers: tItem('server', results.length) }),
          'success',
        );
      } else {
        addToast(
          <div>
            {t('pages.server.files.toast.fileCopyingStartedPartial', {
              successfulServers: tItem('server', results.length - failed.length),
              failedServers: tItem('server', failed.length),
            })}
            <ul className='list-disc pl-4 mt-1'>
              {failed.map((r) => (
                <li key={r.server}>
                  {destinationServers.find((s) => s.uuid === r.server)?.name ?? r.server}: {r.error}
                </li>
              ))}
            </ul>
          </div>,
          'warning',
        );
      }
    },
  });

  useEffect(() => {
    if (props.opened) {
      form.setValues({ destination: browsingDirectory.replace(/^\/+/, ''), destinationServers: [], name: '' });
      form.resetDirty();
    }
  }, [props.opened, browsingDirectory]);

  const updateDestinationServers = (servers: z.infer<typeof serverSchema>[]) => {
    setDestinationServers(servers);
    form.setFieldValue(
      'destinationServers',
      servers.map((s) => s.uuid),
    );
  };

  const addServerGroup = async (groupUuid: string) => {
    setAddingGroup(true);
    try {
      const { data } = await getServerGroupServers(groupUuid, 1, undefined, 100);
      updateDestinationServers([
        ...destinationServers,
        ...data.filter((s) => s.uuid !== server.uuid && !destinationServers.some((d) => d.uuid === s.uuid)),
      ]);
    } catch (err) {
      addToast(httpErrorToHuman(err), 'error');
    }

    setAddingGroup(false);
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
        <ServerMultiSelect
          withAsterisk
          label={t('pages.server.files.modal.copyRemote.servers', {})}
          exclude={[server.uuid]}
          groupBy={(s) => s.nodeName}
          withOthersSwitch
          value={destinationServers}
          error={form.errors.destinationServers}
          onChange={updateDestinationServers}
        />

        {serverGroups.data && serverGroups.data.length > 0 && (
          <Select
            placeholder={t('pages.server.files.modal.copyRemote.addFromGroup', {})}
            data={serverGroups.data.map((group) => ({ label: group.name, value: group.uuid }))}
            value={null}
            disabled={addingGroup}
            onChange={(value) => value && addServerGroup(value)}
          />
        )}

        {serversWithoutCreate.length > 0 && (
          <Alert color='red'>
            {t('pages.server.files.modal.copyRemote.noCreatePermission', {
              servers: serversWithoutCreate.map((s) => s.name).join(', '),
            })}
          </Alert>
        )}

        {browseServer && (
          <div>
            <Text size='xs' c='dimmed' mb={4}>
              {t('pages.server.files.modal.copyRemote.browsingOn', { server: browseServer.name })}
            </Text>
            <DirectoryBrowser
              serverUuid={browseServer.uuid}
              path={join('/', form.values.destination)}
              withCreateDirectory={canCreateOn(browseServer)}
              onNavigate={(path) => form.setFieldValue('destination', path.replace(/^\/+/, ''))}
            />
          </div>
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

      <FilePathPreview
        label={t('pages.server.files.modal.copyRemote.createdAs', {
          servers: tItem('server', destinationServers.length),
        })}
        path={isSingleFile ? join(form.values.destination, form.values.name || files[0].name) : form.values.destination}
      />

      <ModalFooter>
        <Button type='submit' loading={loading} disabled={!form.isValid() || serversWithoutCreate.length > 0}>
          {t('pages.server.files.button.copy', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
