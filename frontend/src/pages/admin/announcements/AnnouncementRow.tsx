import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { announcementTypeLabelMapping } from '@/lib/enums.ts';
import { adminAnnouncementSchema } from '@/lib/schemas/admin/announcements.ts';

export default function AnnouncementRow({ announcement }: { announcement: z.infer<typeof adminAnnouncementSchema> }) {
  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/announcements/${announcement.uuid}`}>
          <Code>{announcement.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{announcementTypeLabelMapping[announcement.type]}</TableData>

      <TableData>{announcement.title}</TableData>

      <TableData>{announcement.enabled ? 'Yes' : 'No'}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={announcement.created} />
      </TableData>
    </TableRow>
  );
}
