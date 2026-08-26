import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Group from '@/elements/Group.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import {
  eggConfigurationDeploymentDefaultMapping,
  eggConfigurationDeploymentTypeLabelMapping,
  mappingToSelectData,
} from '@/lib/enums.ts';
import {
  adminEggConfigurationDeploymentAddPrimarySchema,
  adminEggConfigurationDeploymentRangeSchema,
  EggConfigurationDeployment,
} from '@/lib/schemas/admin/eggConfigurations.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type DeploymentModeType = EggConfigurationDeployment['mode']['type'];

interface DeploymentItemEditorProps {
  index: number;
  value: EggConfigurationDeployment;
  onChange: (value: EggConfigurationDeployment) => void;
  onRemove: () => void;
}

export default function DeploymentItemEditor({ index, value, onChange, onRemove }: DeploymentItemEditorProps) {
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
          data={mappingToSelectData(eggConfigurationDeploymentTypeLabelMapping)}
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
            placeholder='1'
            min={1}
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
            min={1}
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
