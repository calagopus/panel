import { faChevronDown, faFingerprint } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getOAuthProviders from '@/api/auth/getOAuthProviders.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import getOAuthLinks from '@/api/me/oauth-links/getOAuthLinks.ts';
import Button from '@/elements/Button.tsx';
import ContextMenu, { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { oAuthProviderSchema } from '@/lib/schemas/generic.ts';
import { userOAuthLinkSchema } from '@/lib/schemas/user/oAuth.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import OAuthLinkRow from './OAuthLinkRow.tsx';

export default function DashboardOAuthLinks() {
  const { t } = useTranslations();
  const [oAuthProviders, setOAuthProviders] = useState<z.infer<typeof oAuthProviderSchema>[]>([]);

  useEffect(() => {
    getOAuthProviders().then((oAuthProviders) => {
      setOAuthProviders(oAuthProviders);
    });
  }, []);

  const { data, loading, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.oauthLinks.all(),
    fetcher: getOAuthLinks,
  });

  const oauthLinks = data ?? getEmptyPaginationSet<z.infer<typeof userOAuthLinkSchema>>();

  return (
    <AccountContentContainer
      title={t('pages.account.oauthLinks.title', {})}
      contentRight={
        <ContextMenuProvider>
          <ContextMenu
            items={oAuthProviders
              .filter((p) => p.userManageable && !oauthLinks.data.some((l) => l.oauthProvider.uuid === p.uuid))
              .map(
                (oauthProvider) =>
                  ({
                    icon: faFingerprint,
                    label: t('pages.account.oauthLinks.button.connectTo', { provider: oauthProvider.name }),
                    onClick: () => window.location.replace(`/api/auth/oauth/redirect/${oauthProvider.uuid}`),
                    disabled: !oauthProvider.linkViewable,
                    color: 'gray',
                  }) as const,
              )}
          >
            {({ openMenu }) => (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  openMenu(rect.left, rect.bottom);
                }}
                disabled={
                  !oAuthProviders.filter((p) => !oauthLinks.data.some((l) => l.oauthProvider.uuid === p.uuid)).length
                }
                color='blue'
                rightSection={<FontAwesomeIcon icon={faChevronDown} />}
              >
                {t('pages.account.oauthLinks.button.connect', {})}
              </Button>
            )}
          </ContextMenu>
        </ContextMenuProvider>
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.oauthLinks.container}
    >
      <ContextMenuProvider>
        <Table
          columns={[
            t('pages.account.oauthLinks.table.columns.providerName', {}),
            t('pages.account.oauthLinks.table.columns.identifier', {}),
            t('common.table.columns.lastUsed', {}),
            t('common.table.columns.created', {}),
            '',
          ]}
          loading={loading}
          pagination={oauthLinks}
          onPageSelect={setPage}
        >
          {oauthLinks.data.map((link) => (
            <OAuthLinkRow key={link.uuid} oauthLink={link} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AccountContentContainer>
  );
}
