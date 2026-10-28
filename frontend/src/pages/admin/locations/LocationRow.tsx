import { z } from 'zod';
import getLocationCounts from '@/api/admin/locations/getLocationCounts.ts';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default ({ location }: { location: z.infer<typeof adminLocationSchema> }) => {
  const { t } = useTranslations();
  const { data: counts, loading: countsLoading } = useResource({
    queryKey: queryKeys.admin.locations.counts(),
    queryFn: getLocationCounts,
    silent: true,
  });
  const locationCounts = counts?.[location.uuid];

  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/locations/${location.uuid}`}>
          <Code>{location.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData className='flex flex-row items-center gap-1'>
        {location.flag && (
          <img
            src={`/flags/${location.flag}.svg`}
            alt={location.name}
            className='w-5 h-5 rounded-md shrink-0 my-auto'
          />
        )}
        {location.name}
      </TableData>

      <TableData>
        <Code>
          {location.backupConfiguration ? (
            <TableLink to={`/admin/backup-configurations/${location.backupConfiguration.uuid}`}>
              {location.backupConfiguration.name}
            </TableLink>
          ) : (
            t('common.na', {})
          )}
        </Code>
      </TableData>

      <TableData>{counts ? (locationCounts?.locationNodes ?? 0) : countsLoading && <Spinner size={16} />}</TableData>

      <TableData>{counts ? (locationCounts?.locationServers ?? 0) : countsLoading && <Spinner size={16} />}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={location.created} />
      </TableData>
    </TableRow>
  );
};
