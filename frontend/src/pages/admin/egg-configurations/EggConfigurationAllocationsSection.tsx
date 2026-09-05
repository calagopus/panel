import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Button from '@/elements/buttons/Button.tsx';
import AssignToVariableInput from '@/elements/input/AssignToVariableInput.tsx';
import PortRangeField from '@/elements/input/PortRangeField.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import { eggConfigurationDeploymentDefaultMapping } from '@/lib/enums.ts';
import {
  adminEggConfigurationUpdateSchema,
  EggConfigurationDeployment,
} from '@/lib/schemas/admin/eggConfigurations.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DeploymentItemEditor from './DeploymentItemEditor.tsx';
import { defaultEggConfigurationPrimaryAllocation } from './eggConfigurationFormValues.tsx';

type EggConfigFormValues = z.infer<typeof adminEggConfigurationUpdateSchema>;

const additionalPath = 'configAllocations.deployment.additional';

export default function EggConfigurationAllocationsSection({ form }: { form: UseFormReturnType<EggConfigFormValues> }) {
  const { t } = useTranslations();

  const additionalDeployments: EggConfigurationDeployment[] =
    form.values.configAllocations?.deployment?.additional ?? [];

  const primaryEnabled = form.values.configAllocations?.deployment?.primary != null;

  const handleAddDeployment = () =>
    form.insertListItem(additionalPath, {
      mode: eggConfigurationDeploymentDefaultMapping.random,
      assignToVariable: null,
    });

  const handleUpdateDeployment = (index: number, value: EggConfigurationDeployment) =>
    form.setFieldValue(`${additionalPath}.${index}`, value);

  const handleRemoveDeployment = (index: number) => form.removeListItem(additionalPath, index);

  const handlePrimaryToggle = (enabled: boolean) =>
    form.setFieldValue(
      'configAllocations.deployment.primary',
      enabled ? defaultEggConfigurationPrimaryAllocation : null,
    );

  return (
    <Stack>
      <Group grow>
        <Switch
          label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.userSelfAssign', {})}
          description={t(
            'pages.admin.eggConfigurations.tabs.general.page.allocation.form.userSelfAssignDescription',
            {},
          )}
          key={form.key('configAllocations.userSelfAssign.enabled')}
          {...form.getInputProps('configAllocations.userSelfAssign.enabled', { type: 'checkbox' })}
        />
        <Switch
          label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.requirePrimaryAllocation', {})}
          description={t(
            'pages.admin.eggConfigurations.tabs.general.page.allocation.form.requirePrimaryAllocationDescription',
            {},
          )}
          key={form.key('configAllocations.userSelfAssign.requirePrimaryAllocation')}
          {...form.getInputProps('configAllocations.userSelfAssign.requirePrimaryAllocation', { type: 'checkbox' })}
        />
      </Group>

      <PortRangeField
        form={form}
        startPath='configAllocations.userSelfAssign.startPort'
        endPath='configAllocations.userSelfAssign.endPort'
        startLabel={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.automaticAllocationStart', {})}
        endLabel={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.automaticAllocationEnd', {})}
      />

      <Divider
        label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.divider.deployment', {})}
        labelPosition='left'
      />

      <Switch
        label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.dedicatedIp', {})}
        description={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.dedicatedIpDescription', {})}
        key={form.key('configAllocations.deployment.dedicated')}
        {...form.getInputProps('configAllocations.deployment.dedicated', { type: 'checkbox' })}
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
            <PortRangeField
              form={form}
              startPath='configAllocations.deployment.primary.startPort'
              endPath='configAllocations.deployment.primary.endPort'
              startLabel={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.primaryStartPort', {})}
              endLabel={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.primaryEndPort', {})}
            />
            <AssignToVariableInput
              label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.form.assignToVariable', {})}
              description={t(
                'pages.admin.eggConfigurations.tabs.general.page.allocation.form.assignToVariableDescription',
                {},
              )}
              placeholder={t(
                'pages.admin.eggConfigurations.tabs.general.page.allocation.form.assignToVariablePlaceholder',
                {},
              )}
              key={form.key('configAllocations.deployment.primary.assignToVariable')}
              value={form.values.configAllocations?.deployment?.primary?.assignToVariable ?? null}
              onChange={(value) => form.setFieldValue('configAllocations.deployment.primary.assignToVariable', value)}
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
  );
}
