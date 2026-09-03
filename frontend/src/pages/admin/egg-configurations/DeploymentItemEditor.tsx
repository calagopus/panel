import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import AssignToVariableInput from '@/elements/input/AssignToVariableInput.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import {
  eggConfigurationDeploymentDefaultMapping,
  eggConfigurationDeploymentTypeLabelMapping,
  mappingToSelectData,
} from '@/lib/enums.ts';
import { EggConfigurationDeployment } from '@/lib/schemas/admin/eggConfigurations.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type DeploymentModeType = EggConfigurationDeployment['mode']['type'];
type DeploymentMode = EggConfigurationDeployment['mode'];

interface DeploymentItemEditorProps {
  index: number;
  value: EggConfigurationDeployment;
  onChange: (value: EggConfigurationDeployment) => void;
  onRemove: () => void;
}

export default function DeploymentItemEditor({ index, value, onChange, onRemove }: DeploymentItemEditorProps) {
  const { t } = useTranslations();
  const mode = value.mode;

  const handleTypeChange = (type: DeploymentModeType | null) => {
    if (!type) return;
    onChange({ mode: eggConfigurationDeploymentDefaultMapping[type], assignToVariable: value.assignToVariable });
  };

  const patchMode = (patch: Partial<Record<'startPort' | 'endPort' | 'value', number>>) =>
    onChange({ ...value, mode: { ...mode, ...patch } as DeploymentMode });

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
          value={mode.type}
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

      {mode.type === 'range' && (
        <Group grow>
          <NumberInput
            label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.deployment.form.startPort', {})}
            placeholder='1'
            min={1}
            max={65535}
            value={mode.startPort}
            onChange={(v) => patchMode({ startPort: Number(v) })}
          />
          <NumberInput
            label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.deployment.form.endPort', {})}
            placeholder='65535'
            min={1}
            max={65535}
            value={mode.endPort}
            onChange={(v) => patchMode({ endPort: Number(v) })}
          />
        </Group>
      )}

      {mode.type !== 'random' && mode.type !== 'range' && (
        <NumberInput
          label={t('common.form.value', {})}
          placeholder='0'
          value={mode.value}
          onChange={(v) => patchMode({ value: Number(v) })}
        />
      )}

      <AssignToVariableInput
        label={t('pages.admin.eggConfigurations.tabs.general.page.allocation.deployment.form.assignToVariable', {})}
        description={t(
          'pages.admin.eggConfigurations.tabs.general.page.allocation.deployment.form.assignToVariableDescription',
          {},
        )}
        placeholder={t(
          'pages.admin.eggConfigurations.tabs.general.page.allocation.deployment.form.assignToVariablePlaceholder',
          {},
        )}
        value={value.assignToVariable}
        onChange={(assignToVariable) => onChange({ ...value, assignToVariable })}
      />
    </Stack>
  );
}
