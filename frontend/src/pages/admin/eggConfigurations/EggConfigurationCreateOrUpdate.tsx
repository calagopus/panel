import { faList, faNetworkWired, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { ServerRouteDefinition } from 'shared';
import { z } from 'zod';
import createEggConfiguration from '@/api/admin/egg-configurations/createEggConfiguration.ts';
import deleteEggConfiguration from '@/api/admin/egg-configurations/deleteEggConfiguration.ts';
import updateEggConfiguration from '@/api/admin/egg-configurations/updateEggConfiguration.ts';
import getAllEggs from '@/api/admin/nests/getAllEggs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Divider from '@/elements/Divider.tsx';
import MultiSelectGroup from '@/elements/input/MultiSelectGroup.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { eggConfigurationDeploymentDefaultMapping, eggConfigurationDeploymentTypeLabelMapping } from '@/lib/enums.ts';
import {
  adminEggConfigurationDeploymentAddPrimarySchema,
  adminEggConfigurationDeploymentRangeSchema,
  adminEggConfigurationSchema,
  adminEggConfigurationUpdateSchema,
  EggConfigurationDeployment,
} from '@/lib/schemas/admin/eggConfigurations.ts';
import { eggConfigurationRouteItemSchema } from '@/lib/schemas/generic.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import RouteOrderEditor from './RouteOrderEditor.tsx';

type DeploymentModeType = EggConfigurationDeployment['mode']['type'];

interface DeploymentItemEditorProps {
  index: number;
  value: EggConfigurationDeployment;
  onChange: (value: EggConfigurationDeployment) => void;
  onRemove: () => void;
}

function DeploymentItemEditor({ index, value, onChange, onRemove }: DeploymentItemEditorProps) {
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
          label='Type'
          data={Object.entries(eggConfigurationDeploymentTypeLabelMapping).map(([value, label]) => ({
            label,
            value,
          }))}
          value={value.mode.type}
          onChange={(v) => handleTypeChange(v as DeploymentModeType | null)}
        />

        <ActionIcon color='red' variant='subtle' mt='lg' onClick={onRemove} aria-label='Remove deployment rule'>
          <FontAwesomeIcon icon={faTrash} />
        </ActionIcon>
      </Group>

      {value.mode.type === 'random' ? null : value.mode.type === 'range' ? (
        <Group grow>
          <NumberInput
            label='Start Port'
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
            label='End Port'
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
            label='Value'
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
        label='Assign to Variable'
        description='Optional environment variable to receive the assigned port from this rule.'
        placeholder='e.g. SERVER_PORT'
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

export default function EggConfigurationCreateOrUpdate({
  contextEggConfiguration,
}: {
  contextEggConfiguration?: z.infer<typeof adminEggConfigurationSchema>;
}) {
  const { addToast } = useToast();
  const { languages } = useGlobalStore();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);
  const [eggs, setEggs] = useState<{ group: string; items: { label: string; value: string }[] }[]>([]);
  const [defaultRoutes, setDefaultRoutes] = useState<{
    order: z.infer<typeof eggConfigurationRouteItemSchema>[];
    entries: ServerRouteDefinition[];
  }>({ order: [], entries: [] });

  const form = useForm<z.infer<typeof adminEggConfigurationUpdateSchema>>({
    initialValues: {
      name: '',
      description: null,
      order: 0,
      eggs: [],
      configAllocations: null,
      configRoutes: null,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminEggConfigurationUpdateSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminEggConfigurationUpdateSchema>,
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
    resourceName: 'Egg Configuration',
  });

  useEffect(() => {
    if (contextEggConfiguration) {
      form.setValues({
        name: contextEggConfiguration.name,
        description: contextEggConfiguration.description,
        order: contextEggConfiguration.order,
        eggs: contextEggConfiguration.eggs,
        configAllocations: contextEggConfiguration.configAllocations,
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
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'));
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

  return (
    <AdminContentContainer
      title={`${contextEggConfiguration ? 'Update' : 'Create'} Egg Configuration`}
      fullscreen={!!contextEggConfiguration}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Egg Configuration Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.getValues().name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, ['admin', 'eggConfigurations']))}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label='Name'
            placeholder='Name'
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <NumberInput
            withAsterisk
            label='Order'
            placeholder='Order'
            key={form.key('order')}
            {...form.getInputProps('order')}
          />

          <MultiSelectGroup
            label='Eggs'
            placeholder='Select Eggs'
            data={eggs}
            searchable
            loading={!eggs.length}
            {...form.getInputProps('eggs')}
          />
          <TextArea
            label='Description'
            placeholder='Description'
            rows={3}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />

          <CollapsibleSection
            icon={<FontAwesomeIcon icon={faNetworkWired} />}
            title='Allocation Configuration'
            enabled={form.values.configAllocations !== null}
            className='col-span-full'
            onToggle={(enabled) =>
              form.setFieldValue(
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
                  label='User Self Assign'
                  description='Allow users to create their own allocations from a specified port range.'
                  key={form.key('configAllocations.userSelfAssign.enabled')}
                  {...form.getInputProps('configAllocations.userSelfAssign.enabled', {
                    type: 'checkbox',
                  })}
                />
                <Switch
                  label='Require Primary Allocation'
                  description='Whether users must always have a primary allocation.'
                  key={form.key('configAllocations.userSelfAssign.requirePrimaryAllocation')}
                  {...form.getInputProps('configAllocations.userSelfAssign.requirePrimaryAllocation', {
                    type: 'checkbox',
                  })}
                />
              </Group>

              <Group grow>
                <NumberInput
                  label='Automatic Allocation Start'
                  placeholder='Automatic Allocation Start'
                  key={form.key('configAllocations.userSelfAssign.startPort')}
                  {...form.getInputProps('configAllocations.userSelfAssign.startPort')}
                />
                <NumberInput
                  label='Automatic Allocation End'
                  placeholder='Automatic Allocation End'
                  key={form.key('configAllocations.userSelfAssign.endPort')}
                  {...form.getInputProps('configAllocations.userSelfAssign.endPort')}
                />
              </Group>

              <Divider label='Deployment' labelPosition='left' />

              <Switch
                label='Dedicated IP'
                description='Assign a dedicated ip address for servers using this egg configuration.'
                key={form.key('configAllocations.deployment.dedicated')}
                {...form.getInputProps('configAllocations.deployment.dedicated', {
                  type: 'checkbox',
                })}
              />

              <Stack gap='xs'>
                <Switch
                  label='Primary Allocation'
                  description='Configure a primary port assignment for deployment.'
                  checked={primaryEnabled}
                  onChange={(e) => handlePrimaryToggle(e.currentTarget.checked)}
                />

                {primaryEnabled && (
                  <Stack gap='xs' pl='sm'>
                    <Group grow>
                      <NumberInput
                        label='Primary Start Port'
                        placeholder='1024'
                        min={0}
                        max={65535}
                        key={form.key('configAllocations.deployment.primary.startPort')}
                        {...form.getInputProps('configAllocations.deployment.primary.startPort')}
                      />
                      <NumberInput
                        label='Primary End Port'
                        placeholder='65535'
                        min={0}
                        max={65535}
                        key={form.key('configAllocations.deployment.primary.endPort')}
                        {...form.getInputProps('configAllocations.deployment.primary.endPort')}
                      />
                    </Group>
                    <TextInput
                      label='Assign to Variable'
                      description='Optional environment variable to receive the assigned primary port.'
                      placeholder='e.g. SERVER_PORT'
                      key={form.key('configAllocations.deployment.primary.assignToVariable')}
                      {...form.getInputProps('configAllocations.deployment.primary.assignToVariable')}
                      onChange={(e) =>
                        form.setFieldValue(
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
                    Additional Ports
                  </Text>
                  <Button
                    size='xs'
                    variant='subtle'
                    leftSection={<FontAwesomeIcon icon={faPlus} />}
                    onClick={handleAddDeployment}
                  >
                    Add Rule
                  </Button>
                </Group>

                {additionalDeployments.length === 0 && (
                  <Text size='sm' c='dimmed'>
                    No additional port rules configured.
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

          <CollapsibleSection
            icon={<FontAwesomeIcon icon={faList} />}
            title='Route Configuration'
            className='col-span-full'
            enabled={form.values.configRoutes !== null}
            onToggle={(enabled) => form.setFieldValue('configRoutes', enabled ? { order: defaultRoutes.order } : null)}
          >
            {form.values.configRoutes && (
              <RouteOrderEditor
                value={form.values.configRoutes.order}
                onChange={(order) => form.setFieldValue('configRoutes.order', order)}
                serverRoutes={defaultRoutes.entries}
                languages={languages}
              />
            )}
          </CollapsibleSection>

          <Group>
            <AdminCan
              action={contextEggConfiguration ? 'egg-configurations.update' : 'egg-configurations.create'}
              cantSave
            >
              <Button type='submit' disabled={!form.isValid()} loading={loading}>
                Save
              </Button>
              {!contextEggConfiguration && (
                <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                  Save & Stay
                </Button>
              )}
            </AdminCan>
            {contextEggConfiguration && (
              <AdminCan action='egg-configurations.delete' cantDelete>
                <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                  Delete
                </Button>
              </AdminCan>
            )}
          </Group>
        </div>
      </form>
    </AdminContentContainer>
  );
}
