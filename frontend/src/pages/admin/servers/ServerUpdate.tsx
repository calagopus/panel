import {
  faAddressCard,
  faCircleInfo,
  faIcons,
  faInfoCircle,
  faStopwatch,
  faWrench,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import getEggs from '@/api/admin/nests/eggs/getEggs.ts';
import getNests from '@/api/admin/nests/getNests.ts';
import updateServer from '@/api/admin/servers/updateServer.ts';
import getUsers from '@/api/admin/users/getUsers.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import { AdvancedModeToggle, FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { AdminServer, adminServerUpdateSchema } from '@/lib/schemas/admin/servers.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import {
  serverToFormValues,
  serverUpdateEmptyFormValues,
  useEggDefaults,
  useServerFormFields,
} from './serverFormValues.tsx';

type ServerUpdateFormValues = z.infer<typeof adminServerUpdateSchema>;

export default function ServerUpdate({ contextServer }: { contextServer: AdminServer }) {
  const { t } = useTranslations();
  const canReadUsers = useAdminCan('users.read');
  const canReadNests = useAdminCan('nests.read');
  const canReadEggs = useAdminCan('eggs.read');
  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');

  const [isValid, setIsValid] = useState(false);
  const [selectedNestUuid, setSelectedNestUuid] = useState<string | null>(contextServer?.nest.uuid ?? '');

  const form = useFormEngine<ServerUpdateFormValues>('admin.servers.update', {
    schema: adminServerUpdateSchema.unwrap(),
    mode: 'uncontrolled',
    initialValues: serverUpdateEmptyFormValues,
    onValuesChange: () => setIsValid(form.isValid()),
    validateInputOnBlur: true,
  });

  const [selectedEggUuid, setSelectedEggUuid] = useState(contextServer?.egg.uuid ?? '');
  form.watch('eggUuid', ({ value }) => setSelectedEggUuid(value));

  const { loading, doCreateOrUpdate } = useResourceForm<ServerUpdateFormValues, AdminServer>({
    form,
    updateFn: () => updateServer(contextServer.uuid, form.getValues()),
    doUpdate: true,
    basePath: '/admin/servers',
    resourceName: t('pages.admin.servers.resourceName', {}),
  });

  useHydrateForm(form, contextServer, serverToFormValues);

  const users = useSearchableResource<z.infer<typeof fullUserSchema>>({
    queryKey: queryKeys.admin.users.all(),
    fetcher: (search) => getUsers(1, search),
    defaultSearchValue: contextServer?.owner.username,
    canRequest: canReadUsers,
  });
  const nests = useSearchableResource<z.infer<typeof adminNestSchema>>({
    queryKey: queryKeys.admin.nests.all(),
    fetcher: (search) => getNests(1, search),
    defaultSearchValue: contextServer?.nest.name,
    canRequest: canReadNests,
  });
  const eggs = useSearchableResource<z.infer<typeof adminEggSchema>>({
    queryKey: selectedNestUuid ? queryKeys.admin.nests.eggs(selectedNestUuid) : ['admin', 'nests', 'eggs'],
    fetcher: (search) =>
      selectedNestUuid ? getEggs(selectedNestUuid, 1, search) : Promise.resolve(getEmptyPaginationSet()),
    defaultSearchValue: contextServer?.egg.name,
    deps: [selectedNestUuid],
    canRequest: canReadEggs,
  });
  const backupConfigurations = useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: (search) => getBackupConfigurations(1, search),
    defaultSearchValue: contextServer?.backupConfiguration?.name,
    canRequest: canReadBackupConfigurations,
  });

  const eggImages = eggs.items.find((egg) => egg.uuid === selectedEggUuid)?.dockerImages || {};

  useEggDefaults(form, eggs, selectedEggUuid, { skip: selectedEggUuid === contextServer.egg.uuid });

  const { basicInfoFields, serverAssignmentFields, resourceLimitsFields, serverConfigFields, featureLimitsFields } =
    useServerFormFields<ServerUpdateFormValues>({
      mode: 'update',
      form,
      users,
      nests,
      eggs,
      backupConfigurations,
      canReadUsers,
      canReadNests,
      canReadEggs,
      canReadBackupConfigurations,
      selectedNestUuid,
      setSelectedNestUuid,
      eggImages,
    });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.servers.tabs.general.page.titleUpdate', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.update.subContainer}
      registryProps={{ server: contextServer }}
      contentRight={<AdvancedModeToggle />}
    >
      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.servers.all()))}>
        <Stack>
          {contextServer.isSuspended && (
            <Alert
              title={t('pages.admin.servers.tabs.general.page.badge.serverSuspended', {})}
              color='orange'
              icon={<FontAwesomeIcon icon={faCircleInfo} />}
            >
              {t('pages.admin.servers.tabs.general.page.alert.suspended', {})}
            </Alert>
          )}

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.basicInformation', {})}
              icon={<FontAwesomeIcon icon={faInfoCircle} />}
            >
              <FormEngine form={form} fields={basicInfoFields} />
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.serverAssignment', {})}
              icon={<FontAwesomeIcon icon={faAddressCard} />}
            >
              <FormEngine form={form} fields={serverAssignmentFields} />
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.resourceLimits', {})}
              icon={<FontAwesomeIcon icon={faStopwatch} />}
            >
              <FormEngine form={form} fields={resourceLimitsFields} />
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.serverConfiguration', {})}
              icon={<FontAwesomeIcon icon={faWrench} />}
            >
              <FormEngine form={form} fields={serverConfigFields} />
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.featureLimits', {})}
              icon={<FontAwesomeIcon icon={faIcons} />}
            >
              <FormEngine form={form} fields={featureLimitsFields} />
            </TitleCard>
          </div>

          <Group>
            <AdminCan action='servers.update' cantSave>
              <Button type='submit' disabled={!isValid} loading={loading}>
                {t('common.button.save', {})}
              </Button>
            </AdminCan>
          </Group>
        </Stack>
      </form>
    </AdminSubContentContainer>
  );
}
