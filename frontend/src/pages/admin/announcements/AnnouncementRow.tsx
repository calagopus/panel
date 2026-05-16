import { NavLink } from 'react-router';
import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { announcementTypeLabelMapping } from '@/lib/enums.ts';
import { adminAnnouncementSchema } from '@/lib/schemas/admin/announcements.ts';

export default function AnnouncementRow({ announcement }: { announcement: z.infer<typeof adminAnnouncementSchema> }) {
  return (
    <TableRow>
      <TableData>
        <NavLink
          to={`/admin/announcements/${announcement.uuid}`}
          className='text-blue-400 hover:text-blue-200 hover:underline'
        >
          <Code>{announcement.uuid}</Code>
        </NavLink>
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
