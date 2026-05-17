import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';

export default function OAuthProviderRow({
  oauthProvider,
}: {
  oauthProvider: z.infer<typeof adminOAuthProviderSchema>;
}) {
  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/oauth-providers/${oauthProvider.uuid}`}>
          <Code>{oauthProvider.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{oauthProvider.name}</TableData>
      <TableData>{oauthProvider.enabled ? 'Yes' : 'No'}</TableData>
      <TableData>{oauthProvider.loginOnly ? 'Yes' : 'No'}</TableData>
      <TableData>{oauthProvider.linkViewable ? 'Yes' : 'No'}</TableData>
      <TableData>{oauthProvider.userManageable ? 'Yes' : 'No'}</TableData>
      <TableData>
        <FormattedTimestamp timestamp={oauthProvider.created} />
      </TableData>
    </TableRow>
  );
}
