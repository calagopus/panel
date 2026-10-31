import { faChevronDown, faFingerprint } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useEffect, useState } from 'react';
import { z } from 'zod';
import getOAuthLinkProviders from '@/api/me/oauth-links/getOAuthLinkProviders.ts';
import getOAuthLinks from '@/api/me/oauth-links/getOAuthLinks.ts';
import Button from '@/elements/buttons/Button.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { oAuthProviderSchema } from '@/lib/schemas/generic.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import OAuthLinkActionBar from './OAuthLinkActionBar.tsx';
import OAuthLinkRow from './OAuthLinkRow.tsx';

export default function DashboardOAuthLinks() {
  const { t } = useTranslations();
  const [oAuthProviders, setOAuthProviders] = useState<z.infer<typeof oAuthProviderSchema>[]>([]);

  useEffect(() => {
    getOAuthLinkProviders().then((oAuthProviders) => {
      setOAuthProviders(oAuthProviders);
    });
  }, []);

  const {
    data: oauthLinks,
    loading,
    error,
    setPage,
    setPerPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.oauthLinks.all(),
    fetcher: (page, _search, perPage) => getOAuthLinks(page, perPage),
  });

  const {
    selected: selectedOAuthLinks,
    toggle: toggleOAuthLink,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({ items: oauthLinks?.data });

  return (
    <AccountContentContainer
      title={t('pages.account.oauthLinks.title', {})}
      contentRight={
        <ContextMenu
          items={oAuthProviders
            .filter((p) => p.userManageable && !oauthLinks?.data.some((l) => l.oauthProvider.uuid === p.uuid))
            .map(
              (oauthProvider) =>
                ({
                  type: 'action',
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
                !oAuthProviders.filter((p) => !oauthLinks?.data.some((l) => l.oauthProvider.uuid === p.uuid)).length
              }
              color='blue'
              rightSection={<FontAwesomeIcon icon={faChevronDown} />}
            >
              {t('pages.account.oauthLinks.button.connect', {})}
            </Button>
          )}
        </ContextMenu>
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.oauthLinks.container}
    >
      <OAuthLinkActionBar
        selectedOAuthLinks={selectedOAuthLinks}
        clearSelection={clearSelection}
        onFinished={refetch}
      />

      <SelectionArea {...selectionAreaProps}>
        <Table
          columns={[
            tableSelectionHeader({
              checked: allSelected,
              indeterminate: selectedOAuthLinks.size > 0 && !allSelected,
              onChange: (checked) => (checked ? selectAll() : clearSelection()),
            }),
            t('pages.account.oauthLinks.table.columns.providerName', {}),
            t('common.form.identifier', {}),
            t('common.table.columns.lastUsed', {}),
            t('common.table.columns.created', {}),
            '',
          ]}
          loading={loading}
          pagination={oauthLinks}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
          error={error}
        >
          {oauthLinks?.data.map((link) => (
            <SelectionArea.Selectable key={link.uuid} item={link}>
              {(innerRef: Ref<HTMLElement>) => (
                <OAuthLinkRow
                  oauthLink={link}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedOAuthLinks.has(link.uuid)}
                  onSelectionChange={(selected, range) => toggleOAuthLink(link, selected, range)}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AccountContentContainer>
  );
}
