import { useSearchParams } from 'react-router';
import { z } from 'zod';
import Avatar from '@/elements/Avatar.tsx';
import ActivityInfoButton from '@/elements/activity/ActivityInfoButton.tsx';
import Code from '@/elements/Code.tsx';
import Group from '@/elements/Group.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { activitySchema } from '@/lib/schemas/activity.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ActivityRow({ activity }: { activity: z.infer<typeof activitySchema> }) {
  const { t } = useTranslations();
  const [searchParams] = useSearchParams();

  return (
    <TableRow>
      <TableData>
        <Avatar size={20} className='select-none' src={activity.user?.avatar} name={activity.user?.username} />
      </TableData>

      <TableData>
        {activity.user ? (
          <>
            <TableLink to={{ search: `?${searchParams.toString()}&user=${activity.user.uuid}` }}>
              {activity.user.username}
            </TableLink>{' '}
            ({activity.isApi ? t('common.api', {}) : t('common.web', {})})
          </>
        ) : (
          'System'
        )}
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
