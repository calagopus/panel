import { faChevronDown, faFingerprint, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getOAuthLinkProviders from '@/api/me/oauth-links/getOAuthLinkProviders.ts';
import getOAuthLinks from '@/api/me/oauth-links/getOAuthLinks.ts';
import Button from '@/elements/buttons/Button.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import Anchor from '@/elements/typography/Anchor.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { oAuthProviderSchema } from '@/lib/schemas/generic.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import OAuthLinkActionBar from './OAuthLinkActionBar.tsx';
import OAuthLinkRow from './OAuthLinkRow.tsx';
import { useOAuthLinkRemoval } from './useOAuthLinkRemoval.ts';

export default function DashboardOAuthLinks() {
  const { t, tReact } = useTranslations();
  const navigate = useNavigate();
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

  const { isLastLoginMethod } = useOAuthLinkRemoval(oauthLinks?.total ?? 0);

  const connectableProviders = oAuthProviders.filter(
    (p) => p.userManageable && !oauthLinks?.data.some((l) => l.oauthProvider.uuid === p.uuid),
  );

  return (
    <AccountContentContainer
      title={t('pages.account.oauthLinks.title', {})}
      contentRight={
        <ContextMenu
          items={connectableProviders.map(
            (oauthProvider) =>
              ({
                type: 'action',
                icon: faFingerprint,
                label: t('pages.account.oauthLinks.button.connectTo', { provider: oauthProvider.name }),
                onClick: () => window.location.replace(`/api/auth/oauth/redirect/${oauthProvider.uuid}`),
                disabled: !oauthProvider.linkViewable,
                tooltip: !oauthProvider.linkViewable
                  ? t('pages.account.oauthLinks.tooltip.notLinkable', {})
                  : undefined,
                color: 'gray',
              }) as const,
          )}
        >
          {({ openMenu }) => (
            <ConditionalTooltip
              enabled={connectableProviders.length === 0}
              label={t('pages.account.oauthLinks.tooltip.nothingToConnect', {})}
            >
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  openMenu(rect.left, rect.bottom);
                }}
                disabled={connectableProviders.length === 0}
                color='blue'
                rightSection={<FontAwesomeIcon icon={faChevronDown} />}
              >
                {t('pages.account.oauthLinks.button.connect', {})}
              </Button>
            </ConditionalTooltip>
          )}
        </ContextMenu>
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.oauthLinks.container}
    >
      {isLastLoginMethod && (
        <Alert
          icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
          title={t('pages.account.oauthLinks.alert.lastLoginMethod.title', {})}
          color='yellow'
          mb='md'
        >
          {tReact('pages.account.oauthLinks.alert.lastLoginMethod.description', {
            passwordLink: (
              <Anchor
                href='/account'
                inherit
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/account');
                }}
              >
                {t('pages.account.oauthLinks.alert.lastLoginMethod.passwordLink', {})}
              </Anchor>
            ),
          })}
        </Alert>
      )}

      <OAuthLinkActionBar
        selectedOAuthLinks={selectedOAuthLinks}
        totalOAuthLinks={oauthLinks?.total ?? 0}
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
                  isLastLoginMethod={isLastLoginMethod}
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
