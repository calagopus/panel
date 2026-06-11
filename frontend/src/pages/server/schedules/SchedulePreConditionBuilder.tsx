import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Text } from '@mantine/core';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import {
  scheduleComparatorLabelMapping,
  schedulePreConditionLabelMapping,
  serverPowerStateLabelMapping,
} from '@/lib/enums.ts';
import { serverScheduleComparator, serverSchedulePreConditionSchema } from '@/lib/schemas/server/schedules.ts';
import { serverPowerState } from '@/lib/schemas/server/server.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const maxConditionDepth = 3;

interface PreConditionBuilderProps {
  condition: z.infer<typeof serverSchedulePreConditionSchema>;
  onChange: (condition: z.infer<typeof serverSchedulePreConditionSchema>) => void;
  depth?: number;
}

export default function SchedulePreConditionBuilder({ condition, onChange, depth = 0 }: PreConditionBuilderProps) {
  const { t } = useTranslations();
  const handleTypeChange = (type: string) => {
    switch (type) {
      case 'none':
        onChange({ type: 'none' });
        break;
      case 'and':
        onChange({ type: 'and', conditions: [] });
        break;
      case 'or':
        onChange({ type: 'or', conditions: [] });
        break;
      case 'not':
        onChange({ type: 'not', condition: { type: 'none' } });
        break;
      case 'server_state':
        onChange({ type: 'server_state', state: 'running' });
        break;
      case 'uptime':
        onChange({ type: 'uptime', comparator: 'greater_than', value: 0 });
        break;
      case 'cpu_usage':
        onChange({ type: 'cpu_usage', comparator: 'greater_than', value: 0 });
        break;
      case 'memory_usage':
        onChange({ type: 'memory_usage', comparator: 'greater_than', value: 0 });
        break;
      case 'disk_usage':
        onChange({ type: 'disk_usage', comparator: 'greater_than', value: 0 });
        break;
      case 'file_exists':
        onChange({ type: 'file_exists', file: '' });
    }
  };

  const handleNestedConditionChange = (
    index: number,
    newCondition: z.infer<typeof serverSchedulePreConditionSchema>,
  ) => {
    if (condition.type === 'and' || condition.type === 'or') {
      const newConditions = [...condition.conditions];
      newConditions[index] = newCondition;
      onChange({ ...condition, conditions: newConditions });
    }
  };

  const addNestedCondition = () => {
    if (condition.type === 'and' || condition.type === 'or') {
      onChange({
        ...condition,
        conditions: [...condition.conditions, { type: 'none' }],
      });
    }
  };

  const removeNestedCondition = (index: number) => {
    if (condition.type === 'and' || condition.type === 'or') {
      const newConditions = condition.conditions.filter((_, i) => i !== index);
      onChange({ ...condition, conditions: newConditions });
    }
  };

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <Stack>
        <Select
          label={t('pages.server.schedules.form.conditionType', {})}
          withAsterisk
          value={condition.type}
          onChange={(value) => value && handleTypeChange(value)}
          data={Object.entries(schedulePreConditionLabelMapping)
            .map(([value, label]) => ({
              value,
              label: label(),
            }))
            .filter((c) => depth < maxConditionDepth || !['and', 'or', 'not'].includes(c.value))}
        />

        {condition.type === 'server_state' && (
          <Select
            label={t('pages.server.schedules.form.serverState', {})}
            value={condition.state}
            onChange={(value) => value && onChange({ ...condition, state: value as z.infer<typeof serverPowerState> })}
            data={Object.entries(serverPowerStateLabelMapping).map(([value, label]) => ({
              value,
              label: label(),
            }))}
          />
        )}

        {(condition.type === 'uptime' ||
          condition.type === 'cpu_usage' ||
          condition.type === 'memory_usage' ||
          condition.type === 'disk_usage') && (
          <Group grow>
            <Select
              label={t('pages.server.schedules.form.comparator', {})}
              value={condition.comparator}
              onChange={(value) =>
                value && onChange({ ...condition, comparator: value as z.infer<typeof serverScheduleComparator> })
              }
              data={Object.entries(scheduleComparatorLabelMapping).map(([value, label]) => ({
                value,
                label: label(),
              }))}
            />
            {condition.type === 'uptime' && (
              <NumberInput
                label={t('pages.server.schedules.preCondition.valueSeconds', {})}
                value={Number(condition.value) / 1000}
                onChange={(value) => onChange({ ...condition, value: Number(value) * 1000 || 0 })}
                min={0}
              />
            )}
            {condition.type === 'cpu_usage' && (
              <NumberInput
                label={t('pages.server.schedules.preCondition.valuePercent', {})}
                value={condition.value}
                onChange={(value) => onChange({ ...condition, value: Number(value) || 0 })}
                min={0}
              />
            )}
            {(condition.type === 'memory_usage' || condition.type === 'disk_usage') && (
              <SizeInput
                label={t('pages.server.schedules.preCondition.value', {})}
                mode='b'
                min={0}
                value={condition.value}
                onChange={(value) => onChange({ ...condition, value })}
              />
            )}
          </Group>
        )}

        {condition.type === 'file_exists' && (
          <TextInput
            label={t('common.form.filePath', {})}
            value={condition.file}
            onChange={(e) => onChange({ ...condition, file: e.target.value })}
          />
        )}

        {(condition.type === 'and' || condition.type === 'or') && (
          <>
            {depth < maxConditionDepth && (
              <Group>
                <Text size='sm'>
                  {condition.type === 'and'
                    ? t('pages.server.schedules.condition.allMustBeTrue', {})
                    : t('pages.server.schedules.condition.anyMustBeTrue', {})}
                </Text>
                <Button
                  size='xs'
                  variant='light'
                  leftSection={<FontAwesomeIcon icon={faPlus} />}
                  onClick={addNestedCondition}
                >
                  {t('pages.server.schedules.button.addCondition', {})}
                </Button>
              </Group>
            )}

            {condition.conditions.map((nestedCondition, index) => (
              <Group key={index} align='flex-start'>
                <div style={{ flex: 1 }}>
                  <SchedulePreConditionBuilder
                    condition={nestedCondition}
                    onChange={(newCondition) => handleNestedConditionChange(index, newCondition)}
                    depth={depth + 1}
                  />
                </div>
                <ActionIcon color='red' variant='light' onClick={() => removeNestedCondition(index)}>
                  <FontAwesomeIcon icon={faMinus} />
                </ActionIcon>
              </Group>
            ))}
          </>
        )}
        {condition.type === 'not' && (
          <>
            <Text size='sm'>{t('pages.server.schedules.condition.mustNotBeTrue', {})}</Text>

            <div style={{ flex: 1 }}>
              <SchedulePreConditionBuilder
                condition={condition.condition}
                onChange={(nestedCondition) => onChange({ ...condition, condition: nestedCondition })}
                depth={depth + 1}
              />
            </div>
          </>
        )}
      </Stack>
    </div>
  );
}
