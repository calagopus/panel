import { faFingerprint, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type ReactNode, useState } from 'react';
import { z } from 'zod';
import getOAuthProviders from '@/api/admin/oauth-providers/getOAuthProviders.ts';
import getOAuthProviderUserByIdentifier from '@/api/admin/oauth-providers/users/getOAuthProviderUserByIdentifier.ts';
import getUserByExternalId from '@/api/admin/users/getUserByExternalId.ts';
import Button from '@/elements/buttons/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import Group from '@/elements/layout/Group.tsx';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import ResourceLookup from '@/elements/ResourceLookup.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type LookupMode = 'externalId' | 'oauth';

export default function UserLookupPopover() {
  const { t } = useTranslations();
  const tr = 'pages.admin.users.lookup';
  const canExternalId = useAdminCan('users.read');
  const canOAuth = useAdminCan('oauth-providers.read');

  const [opened, setOpened] = useState(false);
  const [mode, setMode] = useState<LookupMode>(canExternalId ? 'externalId' : 'oauth');
  const [oauthProviderUuid, setOAuthProviderUuid] = useState<string | null>(null);

  const oauthProviders = useInfiniteSearchableResource<z.infer<typeof adminOAuthProviderSchema>>({
    queryKey: queryKeys.admin.oAuthProviders.all(),
    fetcher: (page, search) => getOAuthProviders(page, search),
    canRequest: canOAuth && opened && mode === 'oauth',
  });

  if (!canExternalId && !canOAuth) return null;

  const close = () => setOpened(false);
  const renderActions = (viewButton: ReactNode) => viewButton && <Group justify='flex-end'>{viewButton}</Group>;

  return (
    <Popover opened={opened} onChange={setOpened} width={380} position='bottom-end' shadow='md' withinPortal>
      <Popover.Target>
        <Button
          onClick={() => setOpened((o) => !o)}
          variant='default'
          leftSection={<FontAwesomeIcon icon={faFingerprint} />}
        >
          {t(`${tr}.button`, {})}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap='sm'>
          {canExternalId && canOAuth && (
            <SegmentedControl
              fullWidth
              value={mode}
              onChange={(value) => setMode(value as LookupMode)}
              data={[
                { value: 'externalId', label: t(`${tr}.mode.externalId`, {}) },
                { value: 'oauth', label: t(`${tr}.mode.oauth`, {}) },
              ]}
            />
          )}

          {mode === 'externalId' ? (
            <ResourceLookup
              key='externalId'
              labels={{
                inputLabel: t('common.form.externalId', {}),
                inputPlaceholder: t(`${tr}.form.externalIdPlaceholder`, {}),
                search: t(`${tr}.form.search`, {}),
                notFound: t(`${tr}.notFound.externalId`, {}),
                resultTitle: t(`${tr}.result.title`, {}),
                viewResult: t(`${tr}.result.viewUser`, {}),
              }}
              resultIcon={faUser}
              lookup={(externalId) => getUserByExternalId(externalId)}
              fields={(user) => [
                { label: t(`${tr}.result.username`, {}), value: user.username },
                { label: t(`${tr}.result.email`, {}), value: user.email },
                { label: t(`${tr}.result.role`, {}), value: user.role?.name ?? t('common.na', {}) },
              ]}
              href={(user) => `/admin/users/${user.uuid}`}
              onNavigate={close}
              renderActions={renderActions}
            />
          ) : (
            <ResourceLookup
              key='oauth'
              labels={{
                inputLabel: t('common.form.identifier', {}),
                inputPlaceholder: t(`${tr}.form.identifierPlaceholder`, {}),
                search: t(`${tr}.form.search`, {}),
                notFound: t(`${tr}.notFound.oauth`, {}),
                resultTitle: t(`${tr}.result.title`, {}),
                viewResult: t(`${tr}.result.viewUser`, {}),
              }}
              resultIcon={faUser}
              lookup={(identifier) => getOAuthProviderUserByIdentifier(oauthProviderUuid!, identifier)}
              fields={(link) => [
                { label: t(`${tr}.result.username`, {}), value: link.user.username },
                { label: t(`${tr}.result.email`, {}), value: link.user.email },
                { label: t(`${tr}.result.identifier`, {}), value: link.identifier },
              ]}
              href={(link) => `/admin/users/${link.user.uuid}`}
              disabled={!oauthProviderUuid}
              resetKey={oauthProviderUuid}
              onNavigate={close}
              renderActions={renderActions}
            >
              <Select
                label={t(`${tr}.form.oauthProvider`, {})}
                value={oauthProviderUuid}
                onChange={setOAuthProviderUuid}
                data={oauthProviders.items.map((oauthProvider) => ({
                  label: oauthProvider.name,
                  value: oauthProvider.uuid,
                }))}
                searchable
                searchValue={oauthProviders.search}
                onSearchChange={oauthProviders.setSearch}
                infiniteScroll={oauthProviders.infiniteScroll}
                loading={oauthProviders.loading}
                comboboxProps={{ withinPortal: false }}
              />
            </ResourceLookup>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
