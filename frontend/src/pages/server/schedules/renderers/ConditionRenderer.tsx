import { z } from 'zod';
import Stack from '@/elements/layout/Stack.tsx';
import Code from '@/elements/typography/Code.tsx';
import Text from '@/elements/typography/Text.tsx';
import {
  scheduleComparatorOperatorMapping,
  scheduleResourceMetricLabelMapping,
  serverPowerStateLabelMapping,
} from '@/lib/enums.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { formatMilliseconds } from '@/lib/format/time.ts';
import { serverScheduleConditionSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterRenderer from '../renderers/ScheduleDynamicParameterRenderer.tsx';

type Condition = z.infer<typeof serverScheduleConditionSchema>;

function Nested({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginLeft: 'clamp(6px, 3vw, 20px)',
        paddingLeft: 10,
        borderLeft: '2px solid var(--mantine-color-default-border)',
      }}
    >
      {children}
    </div>
  );
}

export default function ConditionRenderer({ condition }: { condition: Condition }) {
  const { t, tReact } = useTranslations();

  switch (condition.type) {
    case 'none':
      return (
        <Text size='sm' c='dimmed'>
          {t('pages.server.schedules.condition.renderer.none', {})}
        </Text>
      );

    case 'and':
    case 'or':
      return (
        <Stack gap={4}>
          <Text size='sm'>
            {t(
              condition.type === 'and'
                ? 'pages.server.schedules.condition.allMustBeTrue'
                : 'pages.server.schedules.condition.anyMustBeTrue',
              {},
            )}
          </Text>
          {condition.conditions.length === 0 ? (
            <Nested>
              <Text size='sm' c='dimmed'>
                {t('pages.server.schedules.condition.renderer.empty', {})}
              </Text>
            </Nested>
          ) : (
            condition.conditions.map((nested, index) => (
              <Nested key={index}>
                <ConditionRenderer condition={nested} />
              </Nested>
            ))
          )}
        </Stack>
      );

    case 'not':
      return (
        <Stack gap={4}>
          <Text size='sm'>{t('pages.server.schedules.condition.mustNotBeTrue', {})}</Text>
          <Nested>
            <ConditionRenderer condition={condition.condition} />
          </Nested>
        </Stack>
      );

    case 'server_state':
      return (
        <Text size='sm'>
          {tReact('pages.server.schedules.condition.renderer.serverState', {
            state: <Code>{serverPowerStateLabelMapping[condition.state]()}</Code>,
          })}
        </Text>
      );

    case 'uptime':
      return (
        <Text size='sm'>
          {tReact('pages.server.schedules.condition.renderer.uptime', {
            comparator: <Code>{scheduleComparatorOperatorMapping[condition.comparator]}</Code>,
            value: <Code>{formatMilliseconds(condition.value)}</Code>,
          })}
        </Text>
      );

    case 'resource_usage':
      return (
        <Text size='sm'>
          {tReact('pages.server.schedules.condition.renderer.resourceUsage', {
            metric: <Code>{scheduleResourceMetricLabelMapping[condition.metric]()}</Code>,
            comparator: <Code>{scheduleComparatorOperatorMapping[condition.comparator]}</Code>,
            value: <Code>{condition.metric === 'cpu' ? `${condition.value}%` : bytesToString(condition.value)}</Code>,
          })}
        </Text>
      );

    case 'file_exists':
      return (
        <Text size='sm'>
          {tReact('pages.server.schedules.condition.renderer.fileExists', {
            file: <Code>{condition.file}</Code>,
          })}
        </Text>
      );

    case 'variable_exists':
      return (
        <Text size='sm'>
          {tReact('pages.server.schedules.condition.renderer.variableExists', {
            variable: <ScheduleDynamicParameterRenderer value={condition.variable} />,
          })}
        </Text>
      );

    case 'variable_equals':
    case 'variable_contains':
    case 'variable_starts_with':
    case 'variable_ends_with': {
      const [key, value] =
        condition.type === 'variable_equals'
          ? (['equals', condition.equals] as const)
          : condition.type === 'variable_contains'
            ? (['contains', condition.contains] as const)
            : condition.type === 'variable_starts_with'
              ? (['startsWith', condition.startsWith] as const)
              : (['endsWith', condition.endsWith] as const);

      return (
        <Text size='sm'>
          {tReact(`pages.server.schedules.condition.renderer.${key}`, {
            variable: <ScheduleDynamicParameterRenderer value={condition.variable} />,
            value: <ScheduleDynamicParameterRenderer value={value} />,
          })}
        </Text>
      );
    }
  }
}
