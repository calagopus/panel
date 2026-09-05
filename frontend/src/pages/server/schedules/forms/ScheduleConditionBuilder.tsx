import { z } from 'zod';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import RecursiveGroupBuilder from '@/elements/RecursiveGroupBuilder.tsx';
import {
  mappingToSelectData,
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

type Condition = z.infer<typeof serverScheduleConditionSchema>;

const conditionDefaults: Record<Condition['type'], () => Condition> = {
  none: () => ({ type: 'none' }),
  and: () => ({ type: 'and', conditions: [] }),
  or: () => ({ type: 'or', conditions: [] }),
  not: () => ({ type: 'not', condition: { type: 'none' } }),
  server_state: () => ({ type: 'server_state', state: 'running' }),
  uptime: () => ({ type: 'uptime', comparator: 'greater_than', value: 0 }),
  resource_usage: () => ({ type: 'resource_usage', metric: 'cpu', comparator: 'greater_than', value: 0 }),
  file_exists: () => ({ type: 'file_exists', file: '' }),
  variable_exists: () => ({ type: 'variable_exists', variable: { variable: '' } }),
  variable_equals: () => ({ type: 'variable_equals', variable: { variable: '' }, equals: '' }),
  variable_contains: () => ({ type: 'variable_contains', variable: { variable: '' }, contains: '' }),
  variable_starts_with: () => ({ type: 'variable_starts_with', variable: { variable: '' }, startsWith: '' }),
  variable_ends_with: () => ({ type: 'variable_ends_with', variable: { variable: '' }, endsWith: '' }),
};

interface ConditionBuilderProps {
  condition: Condition;
  onChange: (condition: Condition) => void;
  depth?: number;
}

export default function ScheduleConditionBuilder({ condition, onChange, depth = 0 }: ConditionBuilderProps) {
  const { t } = useTranslations();

  const renderLeaf = (node: Condition, change: (next: Condition) => void) => (
    <>
      {node.type === 'server_state' && (
        <Select
          label={t('pages.server.schedules.form.serverState', {})}
          value={node.state}
          onChange={(value) => value && change({ ...node, state: value as z.infer<typeof serverPowerState> })}
          data={mappingToSelectData(serverPowerStateLabelMapping)}
        />
      )}

      {(node.type === 'uptime' || node.type === 'resource_usage') && (
        <div className='flex flex-col gap-2 sm:flex-row sm:[&>*]:flex-1 sm:[&>*]:min-w-0'>
          {node.type === 'resource_usage' && (
            <Select
              label={t('pages.server.schedules.condition.metric', {})}
              value={node.metric}
              onChange={(value) =>
                value && change({ ...node, metric: value as z.infer<typeof serverScheduleResourceMetric> })
              }
              data={mappingToSelectData(scheduleResourceMetricLabelMapping)}
            />
          )}
          <Select
            label={t('pages.server.schedules.form.comparator', {})}
            value={node.comparator}
            onChange={(value) =>
              value && change({ ...node, comparator: value as z.infer<typeof serverScheduleComparator> })
            }
            data={mappingToSelectData(scheduleComparatorLabelMapping)}
          />
          {node.type === 'uptime' && (
            <NumberInput
              label={t('pages.server.schedules.preCondition.valueSeconds', {})}
              value={Number(node.value) / 1000}
              onChange={(value) => change({ ...node, value: Number(value) * 1000 || 0 })}
              min={0}
            />
          )}
          {node.type === 'resource_usage' && node.metric === 'cpu' && (
            <NumberInput
              label={t('pages.server.schedules.preCondition.valuePercent', {})}
              value={node.value}
              onChange={(value) => change({ ...node, value: Number(value) || 0 })}
              min={0}
            />
          )}
          {node.type === 'resource_usage' && node.metric !== 'cpu' && (
            <SizeInput
              label={t('pages.server.schedules.preCondition.value', {})}
              mode='b'
              min={0}
              value={node.value}
              onChange={(value) => change({ ...node, value })}
            />
          )}
        </div>
      )}

      {node.type === 'file_exists' && (
        <TextInput
          label={t('common.form.filePath', {})}
          value={node.file}
          onChange={(e) => change({ ...node, file: e.target.value })}
        />
      )}

      {(node.type === 'variable_exists' ||
        node.type === 'variable_equals' ||
        node.type === 'variable_contains' ||
        node.type === 'variable_starts_with' ||
        node.type === 'variable_ends_with') && (
        <ScheduleDynamicParameterInput
          label={t('pages.server.schedules.condition.variable', {})}
          allowString={false}
          value={node.variable}
          onChange={(v) => change({ ...node, variable: v })}
        />
      )}

      {node.type === 'variable_equals' && (
        <ScheduleDynamicParameterInput
          label={t('pages.server.schedules.condition.equals', {})}
          value={node.equals}
          onChange={(v) => change({ ...node, equals: v })}
        />
      )}
      {node.type === 'variable_contains' && (
        <ScheduleDynamicParameterInput
          label={t('pages.server.schedules.condition.contains', {})}
          value={node.contains}
          onChange={(v) => change({ ...node, contains: v })}
        />
      )}
      {node.type === 'variable_starts_with' && (
        <ScheduleDynamicParameterInput
          label={t('pages.server.schedules.condition.startsWith', {})}
          value={node.startsWith}
          onChange={(v) => change({ ...node, startsWith: v })}
        />
      )}
      {node.type === 'variable_ends_with' && (
        <ScheduleDynamicParameterInput
          label={t('pages.server.schedules.condition.endsWith', {})}
          value={node.endsWith}
          onChange={(v) => change({ ...node, endsWith: v })}
        />
      )}
    </>
  );

  return (
    <RecursiveGroupBuilder<Condition>
      node={condition}
      onChange={onChange}
      depth={depth}
      typeData={mappingToSelectData(scheduleConditionLabelMapping)}
      makeDefault={(type) => conditionDefaults[type as Condition['type']]()}
      getChildren={(node) => (node.type === 'and' || node.type === 'or' ? node.conditions : null)}
      withChildren={(node, conditions) => ({ ...node, conditions }) as Condition}
      getNotChild={(node) => (node.type === 'not' ? node.condition : null)}
      withNotChild={(node, child) => ({ ...node, condition: child }) as Condition}
      emptyNode={{ type: 'none' }}
      renderLeaf={renderLeaf}
      labels={{
        type: t('pages.server.schedules.form.conditionType', {}),
        allMustMatch: t('pages.server.schedules.condition.allMustBeTrue', {}),
        anyMustMatch: t('pages.server.schedules.condition.anyMustBeTrue', {}),
        mustNotMatch: t('pages.server.schedules.condition.mustNotBeTrue', {}),
        addChild: t('pages.server.schedules.button.addCondition', {}),
      }}
    />
  );
}
