import { useState } from 'react';
import { z } from 'zod';
import createAnnouncement from '@/api/admin/announcements/createAnnouncement.ts';
import deleteAnnouncement from '@/api/admin/announcements/deleteAnnouncement.ts';
import updateAnnouncement from '@/api/admin/announcements/updateAnnouncement.ts';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import getLocations from '@/api/admin/locations/getLocations.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminAnnouncementCreateSchema,
  adminAnnouncementSchema,
  adminAnnouncementUpdateSchema,
} from '@/lib/schemas/admin/announcements.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useGroupedEggOptions } from '@/plugins/useGroupedEggOptions.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import {
  announcementEmptyFormValues,
  announcementToFormValues,
  useAnnouncementFormFields,
} from './announcementFormValues.tsx';
import AnnouncementDuplicateModal from './modals/AnnouncementDuplicateModal.tsx';

type AnnouncementFormValues = z.infer<typeof adminAnnouncementUpdateSchema>;

export default function AnnouncementCreateOrUpdate({
  contextAnnouncement,
}: {
  contextAnnouncement?: z.infer<typeof adminAnnouncementSchema>;
}) {
  const languages = useGlobalStore((state) => state.languages);
  const { t, tReact } = useTranslations();

  const canReadLocations = useAdminCan('locations.read');
  const canReadNodes = useAdminCan('nodes.read');
  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');

  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);

  const form = useFormEngine<AnnouncementFormValues>('admin.announcements.createOrUpdate', {
    schema: contextAnnouncement ? adminAnnouncementUpdateSchema : adminAnnouncementCreateSchema,
    initialValues: announcementEmptyFormValues,
    validateInputOnBlur: true,
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    AnnouncementFormValues,
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
    resourceName: t('pages.admin.announcements.resourceName', {}),
  });

  useHydrateForm(form, contextAnnouncement, announcementToFormValues, {
    key: (announcement) => announcement.uuid,
  });

  const { eggOptions, loading: eggsLoading } = useGroupedEggOptions();

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

  const fields = useAnnouncementFormFields({
    languages,
    canReadLocations,
    canReadNodes,
    canReadBackupConfigurations,
    locations,
    nodes,
    backupConfigurations,
    eggOptions,
    eggsLoading,
  });

  return (
    <AdminContentContainer
      title={t(
        contextAnnouncement
          ? 'pages.admin.announcements.tabs.general.page.titleUpdate'
          : 'pages.admin.announcements.tabs.general.page.titleCreate',
        {},
      )}
      fullscreen={!!contextAnnouncement}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.announcements.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {tReact('pages.admin.announcements.tabs.general.page.modal.delete.content', { title: form.getValues().title })}
      </ConfirmationModal>

      {contextAnnouncement && (
        <AnnouncementDuplicateModal
          announcement={contextAnnouncement}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.announcements.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan action={contextAnnouncement ? 'announcements.update' : 'announcements.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextAnnouncement && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextAnnouncement && (
            <AdminCan action='announcements.create'>
              <Button variant='default' onClick={() => setOpenModal('duplicate')} loading={loading}>
                {t('common.button.duplicate', {})}
              </Button>
            </AdminCan>
          )}
          {contextAnnouncement && (
            <AdminCan action='announcements.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                {t('common.button.delete', {})}
              </Button>
            </AdminCan>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
