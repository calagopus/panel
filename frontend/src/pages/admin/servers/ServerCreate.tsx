import {
  faAddressCard,
  faCog,
  faIcons,
  faInfoCircle,
  faNetworkWired,
  faPlay,
  faStopwatch,
  faWrench,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { zones } from 'tzdata';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import getEggs from '@/api/admin/nests/eggs/getEggs.ts';
import getEggVariables from '@/api/admin/nests/eggs/variables/getEggVariables.ts';
import getNests from '@/api/admin/nests/getNests.ts';
import getAvailableNodeAllocations from '@/api/admin/nodes/allocations/getAvailableNodeAllocations.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import createServer from '@/api/admin/servers/createServer.ts';
import getUsers from '@/api/admin/users/getUsers.ts';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { AdvancedModeToggle, type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import Select from '@/elements/input/Select.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Popover from '@/elements/Popover.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import VariableContainer from '@/elements/VariableContainer.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminEggSchema, adminEggVariableSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { adminNodeAllocationSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerCreateSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { formatAllocation } from '@/lib/server.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const timezones = Object.keys(zones)
  .sort()
  .map((zone) => ({
    value: zone,
    label: zone,
  }));

type ServerCreateFormValues = z.infer<typeof adminServerCreateSchema>;

export default function ServerCreate() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const canReadNodes = useAdminCan('nodes.read');
  const canReadUsers = useAdminCan('users.read');
  const canReadNests = useAdminCan('nests.read');
  const canReadEggs = useAdminCan('eggs.read');
  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');

  const [isValid, setIsValid] = useState(false);
  const [openModal, setOpenModal] = useState<'confirm-no-allocation' | null>(null);

  const {
    formExtension,
    zodShape,
    initialValues: extInitialValues,
  } = useFormExtensions<ServerCreateFormValues>('admin.servers.create');
  const mergedSchema = adminServerCreateSchema.unwrap().extend(zodShape);

  const form = useForm<ServerCreateFormValues>({
    mode: 'uncontrolled',
    initialValues: {
      externalId: null,
      name: '',
      description: null,
      startOnCompletion: true,
      skipInstaller: false,
      limits: {
        cpu: 100,
        memory: 1024,
        memoryOverhead: 0,
        swap: 0,
        disk: 10240,
        ioWeight: null,
      },
      pinnedCpus: [],
      startup: '',
      image: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hugepagesPassthroughEnabled: false,
      kvmPassthroughEnabled: false,
      featureLimits: {
        allocations: 5,
        databases: 5,
        backups: 5,
        schedules: 5,
      },
      nodeUuid: '',
      ownerUuid: '',
      eggUuid: '',
      backupConfigurationUuid: null,
      allocationUuid: null,
      allocationUuids: [],
      variables: [],
      ...(extInitialValues as Partial<ServerCreateFormValues>),
    },
    onValuesChange: () => setIsValid(form.isValid()),
    validateInputOnBlur: true,
    validate: zod4Resolver(mergedSchema),
  });

  const { loading, doCreateOrUpdate } = useResourceForm<ServerCreateFormValues, z.infer<typeof adminServerSchema>>({
    form,
    createFn: () => createServer(form.getValues()),
    doUpdate: false,
    basePath: '/admin/servers',
    resourceName: t('pages.admin.servers.resourceName', {}),
    toResetOnStay: ['allocationUuid', 'allocationUuids'],
  });

  const [eggVariablesLoading, setEggVariablesLoading] = useState(false);
  const [selectedNestUuid, setSelectedNestUuid] = useState<string | null>('');
  const [eggVariables, setEggVariables] = useState<z.infer<typeof adminEggVariableSchema>[]>([]);

  const nodes = useSearchableResource<z.infer<typeof adminNodeSchema>>({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: (search) => getNodes(1, search),
    canRequest: canReadNodes,
  });
  const users = useSearchableResource<z.infer<typeof fullUserSchema>>({
    queryKey: queryKeys.admin.users.all(),
    fetcher: (search) => getUsers(1, search),
    canRequest: canReadUsers,
  });
  const nests = useSearchableResource<z.infer<typeof adminNestSchema>>({
    queryKey: queryKeys.admin.nests.all(),
    fetcher: (search) => getNests(1, search),
    canRequest: canReadNests,
  });
  const eggs = useSearchableResource<z.infer<typeof adminEggSchema>>({
    queryKey: selectedNestUuid ? queryKeys.admin.nests.eggs(selectedNestUuid) : ['admin', 'nests', 'eggs'],
    fetcher: (search) =>
      selectedNestUuid ? getEggs(selectedNestUuid, 1, search) : Promise.resolve(getEmptyPaginationSet()),
    deps: [selectedNestUuid],
    canRequest: canReadEggs,
  });
  const availablePrimaryAllocations = useSearchableResource<z.infer<typeof adminNodeAllocationSchema>>({
    queryKey: form.getValues().nodeUuid
      ? queryKeys.admin.nodes.allocations(form.getValues().nodeUuid)
      : ['admin', 'nodes', 'primary-allocations'],
    fetcher: (search) =>
      form.getValues().nodeUuid
        ? getAvailableNodeAllocations(form.getValues().nodeUuid, 1, search)
        : Promise.resolve(getEmptyPaginationSet()),
    deps: [form.getValues().nodeUuid],
  });
  const availableAllocations = useSearchableResource<z.infer<typeof adminNodeAllocationSchema>>({
    queryKey: form.getValues().nodeUuid
      ? queryKeys.admin.nodes.allocations(form.getValues().nodeUuid)
      : ['admin', 'nodes', 'allocations'],
    fetcher: (search) =>
      form.getValues().nodeUuid
        ? getAvailableNodeAllocations(form.getValues().nodeUuid, 1, search)
        : Promise.resolve(getEmptyPaginationSet()),
    deps: [form.getValues().nodeUuid],
  });
  const backupConfigurations = useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: (search) => getBackupConfigurations(1, search),
    canRequest: canReadBackupConfigurations,
  });

  useEffect(() => {
    const egg = eggs.items.find((egg) => egg.uuid === form.getValues().eggUuid);
    if (!egg) {
      return;
    }

    form.setFieldValue('image', Object.values(egg.dockerImages)[0] ?? '');
    form.setFieldValue('startup', egg.startupCommands['Default'] || Object.values(egg.startupCommands)[0] || '');
  }, [form.getValues().eggUuid, eggs.items]);

  useEffect(() => {
    if (!selectedNestUuid || !form.getValues().eggUuid) {
      return;
    }

    setEggVariablesLoading(true);
    getEggVariables(selectedNestUuid, form.getValues().eggUuid)
      .then((variables) => {
        setEggVariables(variables);
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setEggVariablesLoading(false));
  }, [selectedNestUuid, form.getValues().eggUuid]);

  const basicInfoFields: FieldDef<ServerCreateFormValues>[] = [
    {
      type: 'text',
      name: 'name',
      label: t('common.form.serverName', {}),
      required: true,
      props: { placeholder: t('pages.admin.servers.tabs.general.page.form.serverNamePlaceholder', {}) },
    },
    {
      type: 'text',
      name: 'externalId',
      label: t('common.form.externalId', {}),
      props: { placeholder: t('pages.admin.servers.tabs.general.page.form.externalIdPlaceholder', {}) },
    },
    {
      type: 'textarea',
      name: 'description',
      label: t('common.form.description', {}),
      colSpan: 'full',
      rows: 3,
      props: { placeholder: t('pages.admin.servers.tabs.general.page.form.descriptionPlaceholder', {}) },
    },
  ];

  const serverAssignmentFields: FieldDef<ServerCreateFormValues>[] = [
    {
      type: 'select',
      name: 'nodeUuid',
      label: t('common.form.node', {}),
      required: true,
      options: nodes.items.map((node) => ({ label: node.name, value: node.uuid })),
      props: {
        searchable: true,
        searchValue: nodes.search,
        onSearchChange: nodes.setSearch,
        disabled: !canReadNodes,
        loading: nodes.loading,
      },
    },
    {
      type: 'select',
      name: 'ownerUuid',
      label: t('pages.admin.servers.tabs.general.page.form.owner', {}),
      required: true,
      options: users.items.map((user) => ({ label: user.username, value: user.uuid })),
      props: {
        searchable: true,
        searchValue: users.search,
        onSearchChange: users.setSearch,
        loading: users.loading,
        disabled: !canReadUsers,
      },
    },
    {
      type: 'custom',
      name: '_nestSelect',
      render: () => (
        <Select
          withAsterisk
          label={t('common.form.nest', {})}
          value={selectedNestUuid}
          onChange={(value) => setSelectedNestUuid(value)}
          data={nests.items.map((nest) => ({ label: nest.name, value: nest.uuid }))}
          searchable
          searchValue={nests.search}
          onSearchChange={nests.setSearch}
          disabled={!canReadNests}
          loading={nests.loading}
        />
      ),
    },
    {
      type: 'select',
      name: 'eggUuid',
      label: t('pages.admin.servers.tabs.general.page.form.egg', {}),
      required: true,
      options: eggs.items.map((egg) => ({ label: egg.name, value: egg.uuid })),
      props: {
        searchable: true,
        searchValue: eggs.search,
        onSearchChange: eggs.setSearch,
        loading: eggs.loading,
        disabled: !canReadEggs || !selectedNestUuid,
      },
    },
    {
      type: 'select',
      name: 'backupConfigurationUuid',
      label: t('common.form.backupConfiguration', {}),
      options: backupConfigurations.items.map((bc) => ({ label: bc.name, value: bc.uuid })),
      props: {
        placeholder: t('pages.admin.servers.tabs.general.page.form.backupConfigurationPlaceholder', {}),
        searchable: true,
        searchValue: backupConfigurations.search,
        onSearchChange: backupConfigurations.setSearch,
        allowDeselect: true,
        clearable: true,
        disabled: !canReadBackupConfigurations,
        loading: backupConfigurations.loading,
      },
    },
  ];

  const resourceLimitsFields: FieldDef<ServerCreateFormValues>[] = [
    {
      type: 'number',
      name: 'limits.cpu',
      label: t('pages.admin.servers.tabs.general.page.form.cpuLimit', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.cpuLimitDescription', {}),
      props: { placeholder: '100', min: 0 },
    },
    {
      type: 'size',
      name: 'limits.swap',
      label: t('pages.admin.servers.tabs.general.page.form.swap', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.swapDescription', {}),
      mode: 'mb',
      min: -1,
      advanced: true,
    },
    {
      type: 'size',
      name: 'limits.memory',
      label: t('common.form.memory', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.memoryDescription', {}),
      mode: 'mb',
      min: 0,
    },
    {
      type: 'size',
      name: 'limits.memoryOverhead',
      label: t('pages.admin.servers.tabs.general.page.form.memoryOverhead', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.memoryOverheadDescription', {}),
      mode: 'mb',
      min: 0,
      advanced: true,
    },
    {
      type: 'size',
      name: 'limits.disk',
      label: t('pages.admin.servers.tabs.general.page.form.diskSpace', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.diskSpaceDescription', {}),
      mode: 'mb',
      min: 0,
    },
    {
      type: 'number',
      name: 'limits.ioWeight',
      label: t('pages.admin.servers.tabs.general.page.form.ioWeight', {}),
      description: t('pages.admin.servers.tabs.general.page.form.ioWeightDescription', {}),
      advanced: true,
    },
    {
      type: 'tags',
      name: 'pinnedCpus',
      label: t('pages.admin.servers.tabs.general.page.form.pinnedCpus', {}),
      description: t('pages.admin.servers.tabs.general.page.form.pinnedCpusDescription', {}),
      placeholder: '0',
      allowReordering: false,
      advanced: true,
    },
  ];

  const serverConfigFields: FieldDef<ServerCreateFormValues>[] = [
    {
      type: 'select',
      name: 'image',
      label: t('common.form.dockerImage', {}),
      required: true,
      options: Object.entries(eggs.items.find((egg) => egg.uuid === form.getValues().eggUuid)?.dockerImages || {}).map(
        ([label, value]) => ({ label, value }),
      ),
      props: {
        placeholder: t('pages.admin.servers.tabs.general.page.form.dockerImagePlaceholder', {}),
        searchable: true,
      },
    },
    {
      type: 'select',
      name: 'timezone',
      label: t('common.form.timezone', {}),
      options: [{ label: t('common.form.timezoneSystem', {}), value: '' }, ...timezones],
      props: {
        placeholder: t('pages.admin.servers.tabs.general.page.form.timezonePlaceholder', {}),
        searchable: true,
      },
    },
    {
      type: 'custom',
      name: 'startup',
      colSpan: 'full',
      render: (f) => (
        <TextArea
          label={t('common.form.startupCommand', {})}
          placeholder={t('pages.admin.servers.tabs.general.page.form.startupCommandPlaceholder', {})}
          required
          rows={2}
          rightSection={
            <Popover>
              <Popover.Target>
                <ActionIcon variant='subtle'>
                  <FontAwesomeIcon icon={faCog} />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown>
                <Select
                  data={[
                    {
                      label: t('pages.admin.servers.tabs.general.page.form.startupCommandCustom', {}),
                      value: '',
                    },
                    ...Object.entries(
                      eggs.items.find((egg) => egg.uuid === form.getValues().eggUuid)?.startupCommands || {},
                    ).map(([key, value]) => ({ value, label: key })),
                  ]}
                  value={
                    Object.values(
                      eggs.items.find((egg) => egg.uuid === form.getValues().eggUuid)?.startupCommands || {},
                    ).find((value) => value === form.getValues().startup) || ''
                  }
                  onChange={(value) => f.setFieldValue('startup', value ?? '')}
                />
              </Popover.Dropdown>
            </Popover>
          }
          key={f.key('startup')}
          {...f.getInputProps('startup')}
        />
      ),
    },
    {
      type: 'switch',
      name: 'startOnCompletion',
      label: t('pages.admin.servers.tabs.general.page.form.startOnCompletion', {}),
      description: t('pages.admin.servers.tabs.general.page.form.startOnCompletionDescription', {}),
    },
    {
      type: 'switch',
      name: 'skipInstaller',
      label: t('pages.admin.servers.tabs.general.page.form.skipInstaller', {}),
      description: t('pages.admin.servers.tabs.general.page.form.skipInstallerDescription', {}),
    },
    {
      type: 'switch',
      name: 'hugepagesPassthroughEnabled',
      label: t('pages.admin.servers.tabs.general.page.form.hugepagesPassthroughEnabled', {}),
      description: t('pages.admin.servers.tabs.general.page.form.hugepagesPassthroughEnabledDescription', {}),
      advanced: true,
    },
    {
      type: 'switch',
      name: 'kvmPassthroughEnabled',
      label: t('pages.admin.servers.tabs.general.page.form.kvmPassthroughEnabled', {}),
      description: t('pages.admin.servers.tabs.general.page.form.kvmPassthroughEnabledDescription', {}),
      advanced: true,
    },
  ];

  const featureLimitsFields: FieldDef<ServerCreateFormValues>[] = [
    {
      type: 'number',
      name: 'featureLimits.allocations',
      label: t('pages.admin.servers.tabs.general.page.form.allocationsLimit', {}),
      required: true,
      props: { placeholder: '0', min: 0 },
    },
    {
      type: 'number',
      name: 'featureLimits.databases',
      label: t('pages.admin.servers.tabs.general.page.form.databasesLimit', {}),
      required: true,
      props: { placeholder: '0', min: 0 },
    },
    {
      type: 'number',
      name: 'featureLimits.backups',
      label: t('pages.admin.servers.tabs.general.page.form.backupsLimit', {}),
      required: true,
      props: { placeholder: '0', min: 0 },
    },
    {
      type: 'number',
      name: 'featureLimits.schedules',
      label: t('pages.admin.servers.tabs.general.page.form.schedulesLimit', {}),
      required: true,
      props: { placeholder: '0', min: 0 },
    },
  ];

  return (
    <AdminContentContainer
      title={t('pages.admin.servers.tabs.general.page.titleCreate', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.create.container}
      contentRight={<AdvancedModeToggle />}
    >
      <ConfirmationModal
        opened={openModal === 'confirm-no-allocation'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.servers.tabs.general.page.modal.confirmNoAllocation.title', {})}
        confirm={t('pages.admin.servers.tabs.general.page.modal.confirmNoAllocation.button.confirm', {})}
        onConfirmed={() => doCreateOrUpdate(false)}
      >
        {t('pages.admin.servers.tabs.general.page.modal.confirmNoAllocation.content', {})}
      </ConfirmationModal>

      <form
        onSubmit={form.onSubmit((values) =>
          !values.allocationUuid ? setOpenModal('confirm-no-allocation') : doCreateOrUpdate(false),
        )}
      >
        <Stack mt='16'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.basicInformation', {})}
              icon={<FontAwesomeIcon icon={faInfoCircle} />}
            >
              <FormEngine form={form} fields={basicInfoFields} extensions={[formExtension]} />
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.serverAssignment', {})}
              icon={<FontAwesomeIcon icon={faAddressCard} />}
            >
              <FormEngine form={form} fields={serverAssignmentFields} extensions={[formExtension]} />
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.resourceLimits', {})}
              icon={<FontAwesomeIcon icon={faStopwatch} />}
            >
              <FormEngine form={form} fields={resourceLimitsFields} extensions={[formExtension]} />
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.serverConfiguration', {})}
              icon={<FontAwesomeIcon icon={faWrench} />}
            >
              <FormEngine form={form} fields={serverConfigFields} extensions={[formExtension]} />
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.featureLimits', {})}
              icon={<FontAwesomeIcon icon={faIcons} />}
            >
              <FormEngine form={form} fields={featureLimitsFields} extensions={[formExtension]} />
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.allocations', {})}
              icon={<FontAwesomeIcon icon={faNetworkWired} />}
            >
              <Stack>
                <Group grow>
                  <Select
                    label={t('common.form.primaryAllocation', {})}
                    disabled={!form.getValues().nodeUuid}
                    data={availablePrimaryAllocations.items
                      .filter((alloc) => !form.getValues().allocationUuids.includes(alloc.uuid))
                      .map((alloc) => ({
                        label: formatAllocation(alloc),
                        value: alloc.uuid,
                      }))}
                    searchable
                    searchValue={availablePrimaryAllocations.search}
                    onSearchChange={availablePrimaryAllocations.setSearch}
                    allowDeselect
                    key={form.key('allocationUuid')}
                    {...form.getInputProps('allocationUuid')}
                  />
                  <MultiSelect
                    label={t('common.form.additionalAllocations', {})}
                    disabled={!form.getValues().nodeUuid}
                    data={availableAllocations.items
                      .filter((alloc) => alloc.uuid !== form.getValues().allocationUuid)
                      .map((alloc) => ({
                        label: formatAllocation(alloc),
                        value: alloc.uuid,
                      }))}
                    searchable
                    searchValue={availableAllocations.search}
                    onSearchChange={availableAllocations.setSearch}
                    key={form.key('allocationUuids')}
                    {...form.getInputProps('allocationUuids')}
                  />
                </Group>
              </Stack>
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.variables', {})}
              icon={<FontAwesomeIcon icon={faPlay} />}
              className='col-span-full'
            >
              <Stack>
                {!selectedNestUuid || !form.getValues().eggUuid ? (
                  <Alert>{t('pages.admin.servers.tabs.general.page.alert.selectEggForVariables', {})}</Alert>
                ) : eggVariablesLoading ? (
                  <Spinner.Centered />
                ) : (
                  <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
                    {eggVariables.map((variable) => (
                      <VariableContainer
                        key={variable.envVariable}
                        variable={{
                          ...variable,
                          value: '',
                          isEditable: variable.userEditable,
                        }}
                        loading={loading}
                        overrideReadonly
                        value={
                          form.getValues().variables.find((v) => v.envVariable === variable.envVariable)?.value ??
                          variable.defaultValue ??
                          ''
                        }
                        setValue={(value) =>
                          form.setFieldValue('variables', (prev) => [
                            ...prev.filter((v) => v.envVariable !== variable.envVariable),
                            { envVariable: variable.envVariable, value },
                          ])
                        }
                      />
                    ))}
                  </div>
                )}
              </Stack>
            </TitleCard>
          </div>

          <Group>
            <AdminCan action='servers.create' cantSave>
              <Button type='submit' disabled={!isValid} loading={loading}>
                {t('common.button.save', {})}
              </Button>
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!isValid} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            </AdminCan>
          </Group>
        </Stack>
      </form>
    </AdminContentContainer>
  );
}
