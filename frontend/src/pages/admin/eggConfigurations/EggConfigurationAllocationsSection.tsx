import { faNetworkWired, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Button from '@/elements/Button.tsx';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import Divider from '@/elements/Divider.tsx';
import Group from '@/elements/Group.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { eggConfigurationDeploymentDefaultMapping } from '@/lib/enums.ts';
import {
  adminEggConfigurationUpdateSchema,
  EggConfigurationDeployment,
} from '@/lib/schemas/admin/eggConfigurations.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DeploymentItemEditor from './DeploymentItemEditor.tsx';

type EggConfigFormValues = z.infer<typeof adminEggConfigurationUpdateSchema>;

export default function EggConfigurationAllocationsSection({ form }: { form: UseFormReturnType<EggConfigFormValues> }) {
  const { t } = useTranslations();
  const f = form;

  const additionalDeployments: EggConfigurationDeployment[] = f.values.configAllocations?.deployment?.additional ?? [];

  const handleAddDeployment = () => {
    const next: EggConfigurationDeployment[] = [
      ...additionalDeployments,
      { mode: eggConfigurationDeploymentDefaultMapping['random'], assignToVariable: null },
    ];
    f.setFieldValue('configAllocations.deployment.additional', next);
  };

  const handleUpdateDeployment = (index: number, value: EggConfigurationDeployment) => {
    const next = additionalDeployments.map((d, i) => (i === index ? value : d));
    f.setFieldValue('configAllocations.deployment.additional', next);
  };

  const handleRemoveDeployment = (index: number) => {
    const next = additionalDeployments.filter((_, i) => i !== index);
    f.setFieldValue('configAllocations.deployment.additional', next);
  };

  const primaryEnabled =
    f.values.configAllocations?.deployment?.primary !== null &&
    f.values.configAllocations?.deployment?.primary !== undefined;

  const handlePrimaryToggle = (enabled: boolean) => {
    f.setFieldValue(
      'configAllocations.deployment.primary',
      enabled ? { startPort: 1, endPort: 65535, assignToVariable: null } : null,
    );
  };

  return (
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
                  startPort: 1,
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
            label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.requirePrimaryAllocation', {})}
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
            label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.automaticAllocationStart', {})}
            min={1}
            max={65535}
            key={f.key('configAllocations.userSelfAssign.startPort')}
            {...f.getInputProps('configAllocations.userSelfAssign.startPort')}
          />
          <NumberInput
            label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.automaticAllocationEnd', {})}
            min={1}
            max={65535}
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
          description={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.dedicatedIpDescription', {})}
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
                  placeholder='1'
                  min={1}
                  max={65535}
                  key={f.key('configAllocations.deployment.primary.startPort')}
                  {...f.getInputProps('configAllocations.deployment.primary.startPort')}
                />
                <NumberInput
                  label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.primaryEndPort', {})}
                  placeholder='65535'
                  min={1}
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
  );
}
