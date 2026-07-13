import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import createAnnouncement from '@/api/admin/announcements/createAnnouncement.ts';
import deleteAnnouncement from '@/api/admin/announcements/deleteAnnouncement.ts';
import duplicateAnnouncement from '@/api/admin/announcements/duplicateAnnouncement.ts';
import updateAnnouncement from '@/api/admin/announcements/updateAnnouncement.ts';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import getLocations from '@/api/admin/locations/getLocations.ts';
import getAllEggs from '@/api/admin/nests/getAllEggs.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { type FieldDef, FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
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
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type AnnouncementFormValues = z.infer<typeof adminAnnouncementUpdateSchema>;

export default function AnnouncementCreateOrUpdate({
  contextAnnouncement,
}: {
  contextAnnouncement?: z.infer<typeof adminAnnouncementSchema>;
}) {
  const languages = useGlobalStore((state) => state.languages);
  const { addToast } = useToast();
  const { t, tReact } = useTranslations();

  const canReadLocations = useAdminCan('locations.read');
  const canReadNodes = useAdminCan('nodes.read');
  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');

  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);
  const navigate = useNavigate();
  const [eggs, setEggs] = useState<{ group: string; items: { label: string; value: string }[] }[]>([]);

  const form = useFormEngine<AnnouncementFormValues>('admin.announcements.createOrUpdate', {
    schema: adminAnnouncementUpdateSchema,
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
  });

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<
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

  const doDuplicate = () => {
    if (!contextAnnouncement) {
      return;
    }

    setLoading(true);

    duplicateAnnouncement(contextAnnouncement.uuid)
      .then((duplicated) => {
        addToast(
          t('common.toast.duplicated', { resource: t('pages.admin.announcements.resourceName', {}) }),
          'success',
        );
        setOpenModal(null);
        navigate(`/admin/announcements/${duplicated.uuid}`);
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

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

  const fields: FieldDef<AnnouncementFormValues>[] = [
    {
      type: 'select',
      name: 'type',
      label: t('common.form.type', {}),
      required: true,
      options: Object.entries(announcementTypeLabelMapping).map(([value, label]) => ({ value, label: label() })),
    },
    {
      type: 'localizedtext',
      name: 'title',
      label: t('common.form.title', {}),
      required: true,
      translationsName: 'titleTranslations',
      languages,
    },
    {
      type: 'localizedtextarea',
      name: 'content',
      label: t('common.form.content', {}),
      required: true,
      colSpan: 'full',
      translationsName: 'contentTranslations',
      languages,
    },
    {
      type: 'date',
      name: 'dismissibleEnd',
      label: t('pages.admin.announcements.tabs.general.page.form.dismissibleEnd', {}),
      props: { clearable: true },
    },
    {
      type: 'date',
      name: 'enabledStart',
      label: t('pages.admin.announcements.tabs.general.page.form.enabledStart', {}),
      props: { clearable: true },
    },
    {
      type: 'date',
      name: 'enabledEnd',
      label: t('pages.admin.announcements.tabs.general.page.form.enabledEnd', {}),
      props: { clearable: true },
    },
    {
      type: 'multiselect',
      name: 'locations',
      label: t('pages.admin.announcements.tabs.general.page.form.locations', {}),
      description: t('pages.admin.announcements.tabs.general.page.form.locationsDescription', {}),
      options: locations.items.map((l) => ({ label: l.name, value: l.uuid })),
      props: {
        searchable: true,
        searchValue: locations.search,
        onSearchChange: locations.setSearch,
        disabled: !canReadLocations,
        loading: locations.loading,
      },
    },
    {
      type: 'multiselect',
      name: 'nodes',
      label: t('pages.admin.announcements.tabs.general.page.form.nodes', {}),
      description: t('pages.admin.announcements.tabs.general.page.form.nodesDescription', {}),
      options: nodes.items.map((n) => ({ label: n.name, value: n.uuid })),
      props: {
        searchable: true,
        searchValue: nodes.search,
        onSearchChange: nodes.setSearch,
        disabled: !canReadNodes,
        loading: nodes.loading,
      },
    },
    {
      type: 'multiselect',
      name: 'backupConfigurations',
      label: t('pages.admin.announcements.tabs.general.page.form.backupConfigurations', {}),
      description: t('pages.admin.announcements.tabs.general.page.form.backupConfigurationsDescription', {}),
      options: backupConfigurations.items.map((b) => ({ label: b.name, value: b.uuid })),
      props: {
        searchable: true,
        searchValue: backupConfigurations.search,
        onSearchChange: backupConfigurations.setSearch,
        disabled: !canReadBackupConfigurations,
        loading: backupConfigurations.loading,
      },
    },
    {
      type: 'multiselectgroup',
      name: 'eggs',
      label: t('common.form.eggs', {}),
      data: eggs,
      props: {
        placeholder: t('pages.admin.announcements.tabs.general.page.form.eggsPlaceholder', {}),
        searchable: true,
        loading: !eggs.length,
      },
    },
    { type: 'switch', name: 'enabled', label: t('common.form.enabled', {}) },
    {
      type: 'switch',
      name: 'dismissible',
      label: t('pages.admin.announcements.tabs.general.page.form.dismissible', {}),
    },
  ];

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

      <ConfirmationModal
        opened={openModal === 'duplicate'}
        onClose={() => setOpenModal(null)}
        title={t('common.modal.duplicate.title', { resource: t('pages.admin.announcements.resourceName', {}) })}
        confirm={t('common.button.duplicate', {})}
        onConfirmed={doDuplicate}
      >
        {t('pages.admin.announcements.tabs.general.page.modal.duplicate.content', {
          title: form.getValues().title,
        }).md()}
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, [queryKeys.admin.announcements.all()]))}>
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
