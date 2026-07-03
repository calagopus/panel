import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import {
  scheduleComparatorLabelMapping,
  scheduleConditionLabelMapping,
  scheduleResourceMetricLabelMapping,
  serverPowerStateLabelMapping,
} from '@/lib/enums.ts';
import {
  serverScheduleComparator,
  serverScheduleConditionSchema,
  serverScheduleResourceMetric,
} from '@/lib/schemas/server/schedules.ts';
import { serverPowerState } from '@/lib/schemas/server/server.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from './ScheduleDynamicParameterInput.tsx';

const maxConditionDepth = 3;

interface ConditionBuilderProps {
  condition: z.infer<typeof serverScheduleConditionSchema>;
  onChange: (condition: z.infer<typeof serverScheduleConditionSchema>) => void;
  depth?: number;
}

export default function ScheduleConditionBuilder({ condition, onChange, depth = 0 }: ConditionBuilderProps) {
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
      case 'resource_usage':
        onChange({ type: 'resource_usage', metric: 'cpu', comparator: 'greater_than', value: 0 });
        break;
      case 'file_exists':
        onChange({ type: 'file_exists', file: '' });
        break;
      case 'variable_exists':
        onChange({ type: 'variable_exists', variable: { variable: '' } });
        break;
      case 'variable_equals':
        onChange({ type: 'variable_equals', variable: { variable: '' }, equals: '' });
        break;
      case 'variable_contains':
        onChange({ type: 'variable_contains', variable: { variable: '' }, contains: '' });
        break;
      case 'variable_starts_with':
        onChange({ type: 'variable_starts_with', variable: { variable: '' }, startsWith: '' });
        break;
      case 'variable_ends_with':
        onChange({ type: 'variable_ends_with', variable: { variable: '' }, endsWith: '' });
        break;
    }
  };

  const handleNestedConditionChange = (index: number, newCondition: z.infer<typeof serverScheduleConditionSchema>) => {
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
          value={condition.type}
          onChange={(value) => value && handleTypeChange(value)}
          data={Object.entries(scheduleConditionLabelMapping)
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

        {(condition.type === 'uptime' || condition.type === 'resource_usage') && (
          <Group grow>
            {condition.type === 'resource_usage' && (
              <Select
                label={t('pages.server.schedules.condition.metric', {})}
                value={condition.metric}
                onChange={(value) =>
                  value && onChange({ ...condition, metric: value as z.infer<typeof serverScheduleResourceMetric> })
                }
                data={Object.entries(scheduleResourceMetricLabelMapping).map(([value, label]) => ({
                  value,
                  label: label(),
                }))}
              />
            )}
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
            {condition.type === 'resource_usage' && condition.metric === 'cpu' && (
              <NumberInput
                label={t('pages.server.schedules.preCondition.valuePercent', {})}
                value={condition.value}
                onChange={(value) => onChange({ ...condition, value: Number(value) || 0 })}
                min={0}
              />
            )}
            {condition.type === 'resource_usage' && condition.metric !== 'cpu' && (
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

        {(condition.type === 'variable_exists' ||
          condition.type === 'variable_equals' ||
          condition.type === 'variable_contains' ||
          condition.type === 'variable_starts_with' ||
          condition.type === 'variable_ends_with') && (
          <ScheduleDynamicParameterInput
            label={t('pages.server.schedules.condition.variable', {})}
            allowString={false}
            value={condition.variable}
            onChange={(v) => onChange({ ...condition, variable: v })}
          />
        )}

        {condition.type === 'variable_equals' && (
          <ScheduleDynamicParameterInput
            label={t('pages.server.schedules.condition.equals', {})}
            value={condition.equals}
            onChange={(v) => onChange({ ...condition, equals: v })}
          />
        )}
        {condition.type === 'variable_contains' && (
          <ScheduleDynamicParameterInput
            label={t('pages.server.schedules.condition.contains', {})}
            value={condition.contains}
            onChange={(v) => onChange({ ...condition, contains: v })}
          />
        )}
        {condition.type === 'variable_starts_with' && (
          <ScheduleDynamicParameterInput
            label={t('pages.server.schedules.condition.startsWith', {})}
            value={condition.startsWith}
            onChange={(v) => onChange({ ...condition, startsWith: v })}
          />
        )}
        {condition.type === 'variable_ends_with' && (
          <ScheduleDynamicParameterInput
            label={t('pages.server.schedules.condition.endsWith', {})}
            value={condition.endsWith}
            onChange={(v) => onChange({ ...condition, endsWith: v })}
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
                  <ScheduleConditionBuilder
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
              <ScheduleConditionBuilder
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
