import { z } from 'zod';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { adminOAuthUserLinkSchema } from '@/lib/schemas/admin/oauthProviders.ts';

export default function UserOAuthLinkRow({
  userOAuthLink,
}: {
  userOAuthLink: z.infer<typeof adminOAuthUserLinkSchema>;
}) {
  return (
    <TableRow>
      <TableData>
        <Code>{userOAuthLink.uuid}</Code>
      </TableData>

      <TableData>
        <TableLink to={`/admin/users/${userOAuthLink.user.uuid}`}>
          <Code>{userOAuthLink.user.username}</Code>
        </TableLink>
      </TableData>

      <TableData>
        <Code>{userOAuthLink.identifier}</Code>
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={userOAuthLink.lastUsed} showNA />
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={userOAuthLink.created} />
      </TableData>
    </TableRow>
  );
}
