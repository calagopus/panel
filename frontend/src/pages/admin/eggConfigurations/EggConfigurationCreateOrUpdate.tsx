import {
  faList,
  faNetworkWired,
  faPlay,
  faPlus,
  faTrash,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { ServerRouteDefinition } from 'shared';
import { z } from 'zod';
import createEggConfiguration from '@/api/admin/egg-configurations/createEggConfiguration.ts';
import deleteEggConfiguration from '@/api/admin/egg-configurations/deleteEggConfiguration.ts';
import updateEggConfiguration from '@/api/admin/egg-configurations/updateEggConfiguration.ts';
import getAllEggs from '@/api/admin/nests/getAllEggs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Divider from '@/elements/Divider.tsx';
import { type FieldDef, FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import RouteOrderEditor from '@/elements/RouteOrderEditor.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { eggConfigurationDeploymentDefaultMapping, eggConfigurationDeploymentTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminEggConfigurationDeploymentAddPrimarySchema,
  adminEggConfigurationDeploymentRangeSchema,
  adminEggConfigurationSchema,
  adminEggConfigurationUpdateSchema,
  EggConfigurationDeployment,
} from '@/lib/schemas/admin/eggConfigurations.ts';
import { eggConfigurationRouteItemSchema } from '@/lib/schemas/generic.ts';
import EggConfigurationDuplicateModal from '@/pages/admin/eggConfigurations/modals/EggConfigurationDuplicateModal.tsx';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type DeploymentModeType = EggConfigurationDeployment['mode']['type'];

interface DeploymentItemEditorProps {
  index: number;
  value: EggConfigurationDeployment;
  onChange: (value: EggConfigurationDeployment) => void;
  onRemove: () => void;
}

function DeploymentItemEditor({ index, value, onChange, onRemove }: DeploymentItemEditorProps) {
  const { t } = useTranslations();

  const handleTypeChange = (type: DeploymentModeType | null) => {
    if (!type) return;
    onChange({ mode: eggConfigurationDeploymentDefaultMapping[type], assignToVariable: value.assignToVariable });
  };

  return (
    <Stack gap='xs'>
      <Group align='center'>
        <Text size='sm' fw={500} c='dimmed'>
          #{index + 1}
        </Text>

        <Select
          style={{ flex: 1 }}
          label={t('common.form.type', {})}
          data={Object.entries(eggConfigurationDeploymentTypeLabelMapping).map(([value, label]) => ({
            label: label(),
            value,
          }))}
          value={value.mode.type}
          onChange={(v) => handleTypeChange(v as DeploymentModeType | null)}
        />

        <ActionIcon
          color='red'
          variant='subtle'
          mt='lg'
          onClick={onRemove}
          aria-label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.deployment.removeRule', {})}
        >
          <FontAwesomeIcon icon={faTrash} />
        </ActionIcon>
      </Group>

      {value.mode.type === 'random' ? null : value.mode.type === 'range' ? (
        <Group grow>
          <NumberInput
            label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.deployment.form.startPort', {})}
            placeholder='1024'
            min={0}
            max={65535}
            value={value.mode.startPort}
            onChange={(v) =>
              onChange({
                ...value,
                mode: { ...value.mode, startPort: Number(v) } as z.infer<
                  typeof adminEggConfigurationDeploymentRangeSchema
                >,
              })
            }
          />
          <NumberInput
            label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.deployment.form.endPort', {})}
            placeholder='65535'
            min={0}
            max={65535}
            value={value.mode.endPort}
            onChange={(v) =>
              onChange({
                ...value,
                mode: { ...value.mode, endPort: Number(v) } as z.infer<
                  typeof adminEggConfigurationDeploymentRangeSchema
                >,
              })
            }
          />
        </Group>
      ) : (
        (value.mode.type === 'add_primary' ||
          value.mode.type === 'subtract_primary' ||
          value.mode.type === 'multiply_primary' ||
          value.mode.type === 'divide_primary') && (
          <NumberInput
            label={t('common.form.value', {})}
            placeholder='0'
            value={value.mode.value}
            onChange={(v) =>
              onChange({
                ...value,
                mode: { ...value.mode, value: Number(v) } as z.infer<
                  typeof adminEggConfigurationDeploymentAddPrimarySchema
                >,
              })
            }
          />
        )
      )}

      <TextInput
        label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.deployment.form.assignToVariable', {})}
        description={t(
          'pages.admin.eggConfigurations.tabs.general.page.allocation.deployment.form.assignToVariableDescription',
          {},
        )}
        placeholder={t(
          'pages.admin.eggConfigurations.tabs.general.page.allocation.deployment.form.assignToVariablePlaceholder',
          {},
        )}
        value={value.assignToVariable ?? ''}
        onChange={(e) =>
          onChange({
            ...value,
            assignToVariable: e.currentTarget.value.toUpperCase() || null,
          })
        }
      />
    </Stack>
  );
}

type EggConfigFormValues = z.infer<typeof adminEggConfigurationUpdateSchema>;

export default function EggConfigurationCreateOrUpdate({
  contextEggConfiguration,
}: {
  contextEggConfiguration?: z.infer<typeof adminEggConfigurationSchema>;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const languages = useGlobalStore((state) => state.languages);

  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);
  const [eggs, setEggs] = useState<{ group: string; items: { label: string; value: string }[] }[]>([]);
  const [eggsLoading, setEggsLoading] = useState(true);
  const [defaultRoutes, setDefaultRoutes] = useState<{
    order: z.infer<typeof eggConfigurationRouteItemSchema>[];
    entries: ServerRouteDefinition[];
  }>({ order: [], entries: [] });

  const form = useFormEngine<EggConfigFormValues>('admin.eggConfigurations.createOrUpdate', {
    schema: adminEggConfigurationUpdateSchema.unwrap(),
    initialValues: {
      name: '',
      description: null,
      order: 0,
      eggs: [],
      configAllocations: null,
      configStartup: null,
      configRoutes: null,
    },
    validateInputOnBlur: true,
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    EggConfigFormValues,
    z.infer<typeof adminEggConfigurationSchema>
  >({
    form,
    createFn: () => createEggConfiguration(adminEggConfigurationUpdateSchema.parse(form.getValues())),
    updateFn: contextEggConfiguration
      ? () =>
          updateEggConfiguration(
            contextEggConfiguration.uuid,
            adminEggConfigurationUpdateSchema.parse(form.getValues()),
          )
      : undefined,
    deleteFn: contextEggConfiguration ? () => deleteEggConfiguration(contextEggConfiguration.uuid) : undefined,
    doUpdate: !!contextEggConfiguration,
    basePath: '/admin/egg-configurations',
    resourceName: t('pages.admin.eggConfigurations.resourceName', {}),
  });

  useEffect(() => {
    if (contextEggConfiguration) {
      form.setValues({
        name: contextEggConfiguration.name,
        description: contextEggConfiguration.description,
        order: contextEggConfiguration.order,
        eggs: contextEggConfiguration.eggs,
        configAllocations: contextEggConfiguration.configAllocations,
        configStartup: contextEggConfiguration.configStartup,
        configRoutes: contextEggConfiguration.configRoutes,
      });
    }
  }, [contextEggConfiguration]);

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
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setEggsLoading(false));
  }, []);

  useEffect(() => {
    const serverRoutes = import('@/routers/routes/serverRoutes.ts');

    serverRoutes
      .then((module) => {
        const routes: z.infer<typeof eggConfigurationRouteItemSchema>[] = [];

        for (const route of [...module.default, ...window.extensionContext.extensionRegistry.routes.serverRoutes]) {
          if (route.name === undefined) continue;
          routes.push({ type: 'route', path: route.path });
        }

        setDefaultRoutes({
          order: routes,
          entries: [...module.default, ...window.extensionContext.extensionRegistry.routes.serverRoutes],
        });
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'));
  }, []);

  const additionalDeployments: EggConfigurationDeployment[] =
    form.values.configAllocations?.deployment?.additional ?? [];

  const handleAddDeployment = () => {
    const next: EggConfigurationDeployment[] = [
      ...additionalDeployments,
      { mode: eggConfigurationDeploymentDefaultMapping['random'], assignToVariable: null },
    ];
    form.setFieldValue('configAllocations.deployment.additional', next);
  };

  const handleUpdateDeployment = (index: number, value: EggConfigurationDeployment) => {
    const next = additionalDeployments.map((d, i) => (i === index ? value : d));
    form.setFieldValue('configAllocations.deployment.additional', next);
  };

  const handleRemoveDeployment = (index: number) => {
    const next = additionalDeployments.filter((_, i) => i !== index);
    form.setFieldValue('configAllocations.deployment.additional', next);
  };

  const primaryEnabled =
    form.values.configAllocations?.deployment?.primary !== null &&
    form.values.configAllocations?.deployment?.primary !== undefined;

  const handlePrimaryToggle = (enabled: boolean) => {
    form.setFieldValue(
      'configAllocations.deployment.primary',
      enabled ? { startPort: 1024, endPort: 65535, assignToVariable: null } : null,
    );
  };

  const formIsValid = form.isValid();

  const fields: FieldDef<EggConfigFormValues>[] = [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'number',
      name: 'order',
      label: t('pages.admin.eggConfigurations.tabs.general.page.form.order', {}),
      required: true,
    },
    {
      type: 'multiselectgroup',
      name: 'eggs',
      label: t('pages.admin.eggConfigurations.tabs.general.page.form.eggs', {}),
      data: eggs,
      props: {
        placeholder: t('pages.admin.eggConfigurations.tabs.general.page.form.eggsPlaceholder', {}),
        searchable: true,
        loading: !eggs.length,
      },
    },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3 },
    {
      type: 'custom',
      name: 'configAllocations',
      colSpan: 'full',
      render: (f) => (
        <CollapsibleSection
          icon={<FontAwesomeIcon icon={faNetworkWired} />}
          title={t('pages.admin.eggConfigurations.tabs.general.page.allocation.title', {})}
          enabled={f.values.configAllocations !== null}
          onToggle={(enabled) =>
            f.setFieldValue(
              'configAllocations',
              enabled
                ? {
                    deployment: {
                      additional: [] as EggConfigurationDeployment[],
                      dedicated: false,
                      primary: null as {
                        startPort: number;
                        endPort: number;
                        assignToVariable: string | null;
                      } | null,
                    },
                    userSelfAssign: {
                      enabled: false,
                      requirePrimaryAllocation: true,
                      startPort: 1024,
                      endPort: 65535,
                    },
                  }
                : null,
            )
          }
        >
          <Stack>
            <Group grow>
              <Switch
                label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.userSelfAssign', {})}
                description={t(
                  'pages.admin.eggConfigurations.tabs.general.page.allocation.form.userSelfAssignDescription',
                  {},
                )}
                key={f.key('configAllocations.userSelfAssign.enabled')}
                {...f.getInputProps('configAllocations.userSelfAssign.enabled', {
                  type: 'checkbox',
                })}
              />
              <Switch
                label={t(
                  'pages.admin.eggConfigurations.tabs.general.page.allocation.form.requirePrimaryAllocation',
                  {},
                )}
                description={t(
                  'pages.admin.eggConfigurations.tabs.general.page.allocation.form.requirePrimaryAllocationDescription',
                  {},
                )}
                key={f.key('configAllocations.userSelfAssign.requirePrimaryAllocation')}
                {...f.getInputProps('configAllocations.userSelfAssign.requirePrimaryAllocation', {
                  type: 'checkbox',
                })}
              />
            </Group>

            <Group grow>
              <NumberInput
                label={t(
                  'pages.admin.eggConfigurations.tabs.general.page.allocation.form.automaticAllocationStart',
                  {},
                )}
                key={f.key('configAllocations.userSelfAssign.startPort')}
                {...f.getInputProps('configAllocations.userSelfAssign.startPort')}
              />
              <NumberInput
                label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.automaticAllocationEnd', {})}
                key={f.key('configAllocations.userSelfAssign.endPort')}
                {...f.getInputProps('configAllocations.userSelfAssign.endPort')}
              />
            </Group>

            <Divider
              label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.divider.deployment', {})}
              labelPosition='left'
            />

            <Switch
              label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.dedicatedIp', {})}
              description={t(
                'pages.admin.eggConfigurations.tabs.general.page.allocation.form.dedicatedIpDescription',
                {},
              )}
              key={f.key('configAllocations.deployment.dedicated')}
              {...f.getInputProps('configAllocations.deployment.dedicated', {
                type: 'checkbox',
              })}
            />

            <Stack gap='xs'>
              <Switch
                label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.primaryAllocation', {})}
                description={t(
                  'pages.admin.eggConfigurations.tabs.general.page.allocation.form.primaryAllocationDescription',
                  {},
                )}
                checked={primaryEnabled}
                onChange={(e) => handlePrimaryToggle(e.currentTarget.checked)}
              />

              {primaryEnabled && (
                <Stack gap='xs' pl='sm'>
                  <Group grow>
                    <NumberInput
                      label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.primaryStartPort', {})}
                      placeholder='1024'
                      min={0}
                      max={65535}
                      key={f.key('configAllocations.deployment.primary.startPort')}
                      {...f.getInputProps('configAllocations.deployment.primary.startPort')}
                    />
                    <NumberInput
                      label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.primaryEndPort', {})}
                      placeholder='65535'
                      min={0}
                      max={65535}
                      key={f.key('configAllocations.deployment.primary.endPort')}
                      {...f.getInputProps('configAllocations.deployment.primary.endPort')}
                    />
                  </Group>
                  <TextInput
                    label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.assignToVariable', {})}
                    description={t(
                      'pages.admin.eggConfigurations.tabs.general.page.allocation.form.assignToVariableDescription',
                      {},
                    )}
                    placeholder={t(
                      'pages.admin.eggConfigurations.tabs.general.page.allocation.form.assignToVariablePlaceholder',
                      {},
                    )}
                    key={f.key('configAllocations.deployment.primary.assignToVariable')}
                    {...f.getInputProps('configAllocations.deployment.primary.assignToVariable')}
                    onChange={(e) =>
                      f.setFieldValue(
                        'configAllocations.deployment.primary.assignToVariable',
                        e.currentTarget.value.toUpperCase() || null,
                      )
                    }
                  />
                </Stack>
              )}
            </Stack>

            <Stack gap='xs'>
              <Group justify='space-between'>
                <Text size='sm' fw={500}>
                  {t('pages.admin.eggConfigurations.tabs.general.page.allocation.additionalPorts.title', {})}
                </Text>
                <Button
                  size='xs'
                  variant='subtle'
                  leftSection={<FontAwesomeIcon icon={faPlus} />}
                  onClick={handleAddDeployment}
                >
                  {t('pages.admin.eggConfigurations.tabs.general.page.allocation.additionalPorts.button', {})}
                </Button>
              </Group>

              {additionalDeployments.length === 0 && (
                <Text size='sm' c='dimmed'>
                  {t('pages.admin.eggConfigurations.tabs.general.page.allocation.additionalPorts.empty', {})}
                </Text>
              )}

              {additionalDeployments.map((deployment, index) => (
                <Stack key={index} gap='xs' pl='sm'>
                  {index > 0 && <Divider />}
                  <DeploymentItemEditor
                    index={index}
                    value={deployment}
                    onChange={(v) => handleUpdateDeployment(index, v)}
                    onRemove={() => handleRemoveDeployment(index)}
                  />
                </Stack>
              ))}
            </Stack>
          </Stack>
        </CollapsibleSection>
      ),
    },
    {
      type: 'custom',
      name: 'configStartup',
      colSpan: 'full',
      render: (f) => (
        <CollapsibleSection
          icon={<FontAwesomeIcon icon={faPlay} />}
          title={t('pages.admin.eggConfigurations.tabs.general.page.startup.title', {})}
          enabled={f.values.configStartup !== null}
          onToggle={(enabled) =>
            f.setFieldValue(
              'configStartup',
              enabled
                ? {
                    allowCustomStartupCommand: false,
                  }
                : null,
            )
          }
        >
          <Switch
            label={t('pages.admin.eggConfigurations.tabs.general.page.startup.form.allowCustomStartupCommand', {})}
            description={t(
              'pages.admin.eggConfigurations.tabs.general.page.startup.form.allowCustomStartupCommandDescription',
              {},
            )}
            key={f.key('configStartup.allowCustomStartupCommand')}
            {...f.getInputProps('configStartup.allowCustomStartupCommand', {
              type: 'checkbox',
            })}
          />
        </CollapsibleSection>
      ),
    },
    {
      type: 'custom',
      name: 'configRoutes',
      colSpan: 'full',
      render: (f) => (
        <CollapsibleSection
          icon={<FontAwesomeIcon icon={faList} />}
          title={t('elements.routeOrderEditor.title', {})}
          enabled={f.values.configRoutes !== null}
          onToggle={(enabled) => f.setFieldValue('configRoutes', enabled ? { order: defaultRoutes.order } : null)}
        >
          {f.values.configRoutes && (
            <RouteOrderEditor
              value={f.values.configRoutes.order}
              onChange={(order) => f.setFieldValue('configRoutes.order', order)}
              routes={defaultRoutes.entries}
              languages={languages}
            />
          )}
        </CollapsibleSection>
      ),
    },
  ];

  return (
    <AdminContentContainer
      title={
        contextEggConfiguration
          ? t('pages.admin.eggConfigurations.tabs.general.page.titleUpdate', {})
          : t('pages.admin.eggConfigurations.tabs.general.page.titleCreate', {})
      }
      fullscreen={!!contextEggConfiguration}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.eggConfigurations.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.eggConfigurations.tabs.general.page.modal.delete.content', {
          name: form.getValues().name,
        }).md()}
      </ConfirmationModal>

      {contextEggConfiguration && (
        <EggConfigurationDuplicateModal
          eggConfiguration={contextEggConfiguration}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      {!eggsLoading && eggs.length === 0 && (
        <Alert color='yellow' mb='xs' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
          {t('pages.admin.eggConfigurations.tabs.general.page.form.eggsEmpty', {})}
        </Alert>
      )}

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.eggConfigurations.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan
            action={contextEggConfiguration ? 'egg-configurations.update' : 'egg-configurations.create'}
            cantSave
          >
            <Button type='submit' disabled={!formIsValid} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextEggConfiguration && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!formIsValid} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextEggConfiguration && (
            <AdminCan action='egg-configurations.create'>
              <Button variant='default' onClick={() => setOpenModal('duplicate')} loading={loading}>
                {t('common.button.duplicate', {})}
              </Button>
            </AdminCan>
          )}
          {contextEggConfiguration && (
            <AdminCan action='egg-configurations.delete' cantDelete>
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
