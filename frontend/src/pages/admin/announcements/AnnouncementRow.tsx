import { z } from 'zod';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import BooleanText from '@/elements/typography/BooleanText.tsx';
import Code from '@/elements/typography/Code.tsx';
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

      <TableData>{announcementTypeLabelMapping[announcement.type]()}</TableData>

      <TableData>{announcement.title}</TableData>

      <TableData>
        <BooleanText value={announcement.enabled} />
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={announcement.created} />
      </TableData>
    </TableRow>
  );
}
