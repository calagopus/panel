import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default ({ location }: { location: z.infer<typeof adminLocationSchema> }) => {
  const { t } = useTranslations();

  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/locations/${location.uuid}`}>
          <Code>{location.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData className='flex flex-row items-center'>
        {location.flag && (
          <img
            src={`/flags/${location.flag}.svg`}
            alt={location.name}
            className='w-5 h-5 mr-1 rounded-md shrink-0 my-auto'
          />
        )}{' '}
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

      <TableData>
        <FormattedTimestamp timestamp={location.created} />
      </TableData>
    </TableRow>
  );
};
