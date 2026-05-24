import { Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createAnnouncement from '@/api/admin/announcements/createAnnouncement.ts';
import deleteAnnouncement from '@/api/admin/announcements/deleteAnnouncement.ts';
import updateAnnouncement from '@/api/admin/announcements/updateAnnouncement.ts';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import getLocations from '@/api/admin/locations/getLocations.ts';
import getAllEggs from '@/api/admin/nests/getAllEggs.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import DateTimePicker from '@/elements/input/DateTimePicker.tsx';
import LocalizedTextArea from '@/elements/input/LocalizedTextArea.tsx';
import LocalizedTextInput from '@/elements/input/LocalizedTextInput.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import MultiSelectGroup from '@/elements/input/MultiSelectGroup.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { announcementTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminAnnouncementCreateSchema,
  adminAnnouncementSchema,
  adminAnnouncementUpdateSchema,
} from '@/lib/schemas/admin/announcements.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function AnnouncementCreateOrUpdate({
  contextAnnouncement,
}: {
  contextAnnouncement?: z.infer<typeof adminAnnouncementSchema>;
}) {
  const { languages } = useGlobalStore();
  const { addToast } = useToast();

  const canReadLocations = useAdminCan('locations.read');
  const canReadNodes = useAdminCan('nodes.read');
  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');

  const [openModal, setOpenModal] = useState<'delete' | null>(null);
  const [eggs, setEggs] = useState<{ group: string; items: { label: string; value: string }[] }[]>([]);

  const form = useForm<z.infer<typeof adminAnnouncementUpdateSchema>>({
    initialValues: {
      type: 'info',
      enabled: true,
      enabledStart: null,
      enabledEnd: null,
      dismissible: false,
      dismissibleEnd: null,
      title: '',
      titleTranslations: {},
      content: '',
      contentTranslations: {},
      locations: [],
      nodes: [],
      backupConfigurations: [],
      eggs: [],
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminAnnouncementUpdateSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminAnnouncementUpdateSchema>,
    z.infer<typeof adminAnnouncementSchema>
  >({
    form,
    createFn: () => createAnnouncement(adminAnnouncementCreateSchema.parse(form.getValues())),
    updateFn: contextAnnouncement
      ? () => updateAnnouncement(contextAnnouncement.uuid, adminAnnouncementUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextAnnouncement ? () => deleteAnnouncement(contextAnnouncement.uuid) : undefined,
    doUpdate: !!contextAnnouncement,
    basePath: '/admin/announcements',
    resourceName: 'Announcement',
  });

  useEffect(() => {
    if (contextAnnouncement) {
      form.setValues({
        type: contextAnnouncement.type,
        enabled: contextAnnouncement.enabled,
        enabledStart: contextAnnouncement.enabledStart ? new Date(contextAnnouncement.enabledStart) : null,
        enabledEnd: contextAnnouncement.enabledEnd ? new Date(contextAnnouncement.enabledEnd) : null,
        dismissible: contextAnnouncement.dismissible,
        dismissibleEnd: contextAnnouncement.dismissibleEnd ? new Date(contextAnnouncement.dismissibleEnd) : null,
        title: contextAnnouncement.title,
        titleTranslations: contextAnnouncement.titleTranslations,
        content: contextAnnouncement.content,
        contentTranslations: contextAnnouncement.contentTranslations,
        locations: contextAnnouncement.locations,
        nodes: contextAnnouncement.nodes,
        backupConfigurations: contextAnnouncement.backupConfigurations,
        eggs: contextAnnouncement.eggs,
      });
    }
  }, [contextAnnouncement]);

  useEffect(() => {
    getAllEggs()
      .then((eggs) => {
        setEggs(
          eggs.map((v) => ({
            group: v.nest.name,
            items: v.eggs.map((e) => ({
              label: e.name,
              value: e.uuid,
            })),
          })),
        );
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'));
  }, []);

  const locations = useSearchableResource({
    queryKey: queryKeys.admin.locations.all(),
    fetcher: (search) => getLocations(1, search),
    canRequest: canReadLocations,
  });

  const nodes = useSearchableResource({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: (search) => getNodes(1, search),
    canRequest: canReadNodes,
  });

  const backupConfigurations = useSearchableResource({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: (search) => getBackupConfigurations(1, search),
    canRequest: canReadBackupConfigurations,
  });

  return (
    <AdminContentContainer
      title={`${contextAnnouncement ? 'Update' : 'Create'} Announcement`}
      fullscreen={!!contextAnnouncement}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Announcement Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.getValues().title}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, [queryKeys.admin.announcements.all()]))}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <Select
            withAsterisk
            label='Type'
            data={Object.entries(announcementTypeLabelMapping).map(([value, label]) => ({ value, label }))}
            key={form.key('type')}
            {...form.getInputProps('type')}
          />

          <LocalizedTextInput
            withAsterisk
            label='Title'
            placeholder='Title'
            value={form.values.title}
            setValue={(value) => form.setFieldValue('title', value ?? '')}
            valueTranslations={form.values.titleTranslations}
            setValueTranslations={(translations) => form.setFieldValue('titleTranslations', translations)}
            languages={languages}
            error={form.errors.title}
          />

          <LocalizedTextArea
            withAsterisk
            label='Content'
            placeholder='Content'
            value={form.values.content}
            setValue={(value) => form.setFieldValue('content', value ?? '')}
            valueTranslations={form.values.contentTranslations}
            setValueTranslations={(translations) => form.setFieldValue('contentTranslations', translations)}
            languages={languages}
            error={form.errors.content}
            className='col-span-full'
          />

          <DateTimePicker
            label='Dismissible End'
            clearable
            value={form.values.dismissibleEnd}
            onChange={(value) => form.setFieldValue('dismissibleEnd', value ? new Date(value) : null)}
          />

          <DateTimePicker
            label='Enabled Start'
            clearable
            value={form.values.enabledStart}
            onChange={(value) => form.setFieldValue('enabledStart', value ? new Date(value) : null)}
          />

          <DateTimePicker
            label='Enabled End'
            clearable
            value={form.values.enabledEnd}
            onChange={(value) => form.setFieldValue('enabledEnd', value ? new Date(value) : null)}
          />

          <MultiSelect
            label='Locations'
            description='Leave empty to apply to all locations.'
            data={locations.items.map((l) => ({ label: l.name, value: l.uuid }))}
            searchable
            searchValue={locations.search}
            onSearchChange={locations.setSearch}
            disabled={!canReadLocations}
            loading={locations.loading}
            key={form.key('locations')}
            {...form.getInputProps('locations')}
          />

          <MultiSelect
            label='Nodes'
            description='Leave empty to apply to all nodes.'
            data={nodes.items.map((n) => ({ label: n.name, value: n.uuid }))}
            searchable
            searchValue={nodes.search}
            onSearchChange={nodes.setSearch}
            disabled={!canReadNodes}
            loading={nodes.loading}
            key={form.key('nodes')}
            {...form.getInputProps('nodes')}
          />

          <MultiSelect
            label='Backup Configurations'
            description='Leave empty to apply to all backup configurations.'
            data={backupConfigurations.items.map((b) => ({ label: b.name, value: b.uuid }))}
            searchable
            searchValue={backupConfigurations.search}
            onSearchChange={backupConfigurations.setSearch}
            disabled={!canReadBackupConfigurations}
            loading={backupConfigurations.loading}
            key={form.key('backupConfigurations')}
            {...form.getInputProps('backupConfigurations')}
          />

          <MultiSelectGroup
            label='Eggs'
            placeholder='Select Eggs'
            data={eggs}
            searchable
            loading={!eggs.length}
            {...form.getInputProps('eggs')}
          />

          <Switch label='Enabled' key={form.key('enabled')} {...form.getInputProps('enabled', { type: 'checkbox' })} />

          <Switch
            label='Dismissible'
            key={form.key('dismissible')}
            {...form.getInputProps('dismissible', { type: 'checkbox' })}
          />
        </div>

        <Group mt='md'>
          <AdminCan action={contextAnnouncement ? 'announcements.update' : 'announcements.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              Save
            </Button>
            {!contextAnnouncement && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                Save & Stay
              </Button>
            )}
          </AdminCan>
          {contextAnnouncement && (
            <AdminCan action='announcements.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                Delete
              </Button>
            </AdminCan>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
