import { Group } from '@mantine/core';
import { z } from 'zod';
import ActivityInfoButton from '@/elements/activity/ActivityInfoButton.tsx';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { activitySchema } from '@/lib/schemas/activity.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ActivityRow({ activity }: { activity: z.infer<typeof activitySchema> }) {
  const { t } = useTranslations();

  return (
    <TableRow>
      <TableData>
        <div className='size-5 aspect-square relative'>
          <img
            src={activity.user?.avatar ?? '/icon.svg'}
            alt={activity.user?.username}
            className='object-cover rounded-full select-none'
          />
        </div>
      </TableData>

      <TableData>
        {activity.user
          ? `${activity.user.username} (${activity.isApi ? t('common.api', {}) : t('common.web', {})})`
          : 'System'}
        {activity.impersonator && ` (${t('common.impersonatedBy', { username: activity.impersonator.username })})`}
      </TableData>

      <TableData>
        <Code>{activity.event}</Code>
      </TableData>

      <TableData>
        <Code>{activity.ip ? activity.ip : t('common.na', {})}</Code>
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={activity.created} />
      </TableData>

      <TableData>
        <Group gap={4} justify='right' wrap='nowrap'>
          {Object.keys(activity.data ?? {}).length > 0 ? <ActivityInfoButton activity={activity} /> : null}
        </Group>
      </TableData>
    </TableRow>
  );
}
