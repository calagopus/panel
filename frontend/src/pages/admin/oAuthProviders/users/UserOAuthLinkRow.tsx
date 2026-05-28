import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
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
        {!userOAuthLink.lastUsed ? 'N/A' : <FormattedTimestamp timestamp={userOAuthLink.lastUsed} />}
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={userOAuthLink.created} />
      </TableData>
    </TableRow>
  );
}
