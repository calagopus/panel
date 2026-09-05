import { z } from 'zod';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import BooleanText from '@/elements/typography/BooleanText.tsx';
import Code from '@/elements/typography/Code.tsx';
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
      <TableData>
        <BooleanText value={oauthProvider.enabled} />
      </TableData>
      <TableData>
        <BooleanText value={oauthProvider.loginOnly} />
      </TableData>
      <TableData>
        <BooleanText value={oauthProvider.linkViewable} />
      </TableData>
      <TableData>
        <BooleanText value={oauthProvider.userManageable} />
      </TableData>
      <TableData>
        <FormattedTimestamp timestamp={oauthProvider.created} />
      </TableData>
    </TableRow>
  );
}
