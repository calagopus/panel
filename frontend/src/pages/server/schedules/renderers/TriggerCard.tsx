import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue/i18n';
import { z } from 'zod';
import getSchedule from '@/api/server/schedules/getSchedule.ts';
import Card from '@/elements/data-display/Card.tsx';
import ThemeIcon from '@/elements/data-display/ThemeIcon.tsx';
import Group from '@/elements/layout/Group.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import Text from '@/elements/typography/Text.tsx';
import {
  scheduleComparatorLabelMapping,
  scheduleResourceMetricLabelMapping,
  scheduleTriggerColorMapping,
  scheduleTriggerIconMapping,
} from '@/lib/enums.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverScheduleTriggerSchema } from '@/lib/schemas/server/schedules.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { getTranslations, useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

function cronTooltip(cron: string) {
  const { t, language } = getTranslations();

  let description: string;
  try {
    description = cronstrue.toString(cron, { locale: language });
  } catch {
    description = t('pages.server.schedules.triggers.cron.invalidCron', {});
  }

  return description;
}

interface TriggerCardProps {
  date: Date;
  timezone: string;
  trigger: z.infer<typeof serverScheduleTriggerSchema>;
}

export default function TriggerCard({ date, timezone, trigger }: TriggerCardProps) {
  const { t, tReact } = useTranslations();
  const server = useServerStore((state) => state.server);

  const completionScheduleUuid = trigger.type === 'schedule_completion' ? trigger.schedule : null;
  const { data: completionSchedule } = useResource({
    queryKey: queryKeys.server(server.uuid).schedules.detail(completionScheduleUuid ?? ''),
    queryFn: () => getSchedule(server.uuid, completionScheduleUuid!),
    enabled: completionScheduleUuid !== null,
  });

  return (
    <Card>
      <Group>
        <ThemeIcon color={scheduleTriggerColorMapping[trigger.type]}>
          <FontAwesomeIcon icon={scheduleTriggerIconMapping[trigger.type]} />
        </ThemeIcon>
        {trigger.type === 'cron' ? (
          <Text component='div' className='mr-1!'>
            {tReact('pages.server.schedules.triggers.cron.card.content', {
              schedule: (
                <Tooltip label={cronTooltip(trigger.schedule)} className='inline-block'>
                  <Code>{trigger.schedule}</Code>
                </Tooltip>
              ),
              timestamp: (
                <FormattedTimestamp
                  timestamp={CronExpressionParser.parse(trigger.schedule, {
                    currentDate: date,
                    tz: timezone,
                  })
                    .next()
                    .toDate()}
                  autoUpdate={false}
                  precise
                  tooltipClassName='inline-block'
                />
              ),
              lastTimestamp: (
                <FormattedTimestamp
                  timestamp={CronExpressionParser.parse(trigger.schedule, {
                    currentDate: date,
                    tz: timezone,
                  })
                    .prev()
                    .toDate()}
                  autoUpdate={false}
                  precise
                  tooltipClassName='inline-block'
                />
              ),
            })}
          </Text>
        ) : trigger.type === 'power_action' ? (
          <Text component='div'>
            {t('pages.server.schedules.triggers.powerAction.card.content', {
              action: trigger.action,
            }).md()}
          </Text>
        ) : trigger.type === 'server_state' ? (
          <Text component='div'>
            {t('pages.server.schedules.triggers.serverState.card.content', {
              state: t(`common.enum.serverState.${trigger.state}`, {}),
            }).md()}
          </Text>
        ) : trigger.type === 'backup_status' ? (
          <Text component='div'>
            {t('pages.server.schedules.triggers.backupStatus.card.content', {
              status: trigger.status,
            }).md()}
          </Text>
        ) : trigger.type === 'schedule_completion' ? (
          <Text component='div'>
            {t('pages.server.schedules.triggers.scheduleCompletion.card.content', {
              schedule: completionSchedule?.name ?? trigger.schedule,
              status: t(trigger.successful ? 'common.badge.successful' : 'common.badge.failed', {}),
            }).md()}
          </Text>
        ) : trigger.type === 'resource_usage' ? (
          <Text component='div'>
            {t('pages.server.schedules.triggers.resourceUsage.card.content', {
              metric: scheduleResourceMetricLabelMapping[trigger.metric](),
              comparator: scheduleComparatorLabelMapping[trigger.comparator](),
              value: trigger.metric === 'cpu' ? `${trigger.value}%` : bytesToString(trigger.value),
            }).md()}
          </Text>
        ) : trigger.type === 'console_line' ? (
          <Text component='div'>
            {t('pages.server.schedules.triggers.consoleLine.card.content', {
              contains: trigger.contains,
            }).md()}
          </Text>
        ) : trigger.type === 'crash' ? (
          <Text component='div'>{t('pages.server.schedules.triggers.crash.card.content', {}).md()}</Text>
        ) : null}
      </Group>
    </Card>
  );
}
