import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function OAuthProviderRow({
  oauthProvider,
}: {
  oauthProvider: z.infer<typeof adminOAuthProviderSchema>;
}) {
  const { t } = useTranslations();

  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/oauth-providers/${oauthProvider.uuid}`}>
          <Code>{oauthProvider.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{oauthProvider.name}</TableData>
      <TableData>{oauthProvider.enabled ? t('common.yes', {}) : t('common.no', {})}</TableData>
      <TableData>{oauthProvider.loginOnly ? t('common.yes', {}) : t('common.no', {})}</TableData>
      <TableData>{oauthProvider.linkViewable ? t('common.yes', {}) : t('common.no', {})}</TableData>
      <TableData>{oauthProvider.userManageable ? t('common.yes', {}) : t('common.no', {})}</TableData>
      <TableData>
        <FormattedTimestamp timestamp={oauthProvider.created} />
      </TableData>
    </TableRow>
  );
}
