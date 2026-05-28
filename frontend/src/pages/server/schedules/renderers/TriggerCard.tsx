import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Text, ThemeIcon } from '@mantine/core';
import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue/i18n';
import { z } from 'zod';
import Card from '@/elements/Card.tsx';
import Code from '@/elements/Code.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { scheduleTriggerColorMapping, scheduleTriggerIconMapping } from '@/lib/enums.ts';
import { serverScheduleTriggerSchema } from '@/lib/schemas/server/schedules.ts';
import { getTranslations, useTranslations } from '@/providers/TranslationProvider.tsx';

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

  return (
    <Card>
      <Group>
        <ThemeIcon color={scheduleTriggerColorMapping[trigger.type]}>
          <FontAwesomeIcon icon={scheduleTriggerIconMapping[trigger.type]} />
        </ThemeIcon>
        {trigger.type === 'cron' ? (
          <Text className='mr-1!'>
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
          <Text>
            {t('pages.server.schedules.triggers.powerAction.card.content', {
              action: trigger.action,
            }).md()}
          </Text>
        ) : trigger.type === 'server_state' ? (
          <Text>
            {t('pages.server.schedules.triggers.serverState.card.content', {
              state: t(`common.enum.serverState.${trigger.state}`, {}),
            }).md()}
          </Text>
        ) : trigger.type === 'backup_status' ? (
          <Text>
            {t('pages.server.schedules.triggers.backupStatus.card.content', {
              status: trigger.status,
            }).md()}
          </Text>
        ) : trigger.type === 'console_line' ? (
          <Text>
            {t('pages.server.schedules.triggers.consoleLine.card.content', {
              contains: trigger.contains,
            }).md()}
          </Text>
        ) : trigger.type === 'crash' ? (
          <Text>{t('pages.server.schedules.triggers.crash.card.content', {}).md()}</Text>
        ) : null}
      </Group>
    </Card>
  );
}
