import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import getOAuthProviders from '@/api/admin/oauth-providers/getOAuthProviders.ts';
import createUserOAuthLink from '@/api/admin/users/oauthLinks/createUserOAuthLink.ts';
import TextInput from '@/elements/input/TextInput.tsx';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function UserOAuthLinkAddModal({
  user,
  ...props
}: ModalProps & { user: z.infer<typeof adminFullUserSchema> }) {
  const { t, tReact } = useTranslations();
  const canCreateProvider = useAdminCan('oauth-providers.create');

  const [identifier, setIdentifier] = useState('');

  const oauthProviders = useInfiniteSearchableResource<z.infer<typeof adminOAuthProviderSchema>>({
    queryKey: queryKeys.admin.oAuthProviders.all(),
    fetcher: (page, search) => getOAuthProviders(page, search),
  });

  useEffect(() => {
    if (!props.opened) {
      setIdentifier('');
    }
  }, [props.opened]);

  const noProviders = !oauthProviders.loading && !oauthProviders.search && oauthProviders.items.length === 0;

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.users.tabs.oauthLinks.page.modal.add.title', {})}
      label={t('pages.admin.users.tabs.oauthLinks.page.modal.add.form.oauthProvider', {})}
      data={oauthProviders.items.map((oauthProvider) => ({ label: oauthProvider.name, value: oauthProvider.uuid }))}
      loading={oauthProviders.loading}
      searchValue={oauthProviders.search}
      onSearchChange={oauthProviders.setSearch}
      infiniteScroll={oauthProviders.infiniteScroll}
      disabled={!identifier}
      addedToast={t('pages.admin.users.tabs.oauthLinks.page.toast.added', {})}
      invalidateKeys={[queryKeys.admin.users.oauthLinks(user.uuid)]}
      onConfirm={(oauthProviderUuid) => createUserOAuthLink(user.uuid, oauthProviderUuid, identifier)}
    >
      {noProviders && (
        <Text size='sm' c='dimmed'>
          {canCreateProvider
            ? tReact('pages.admin.users.tabs.oauthLinks.page.modal.add.noProvidersCreate', {
                link: (
                  <Link to='/admin/oauth-providers/new' className='text-(--mantine-color-anchor) hover:underline'>
                    {t('pages.admin.users.tabs.oauthLinks.page.modal.add.createProvider', {})}
                  </Link>
                ),
              })
            : t('pages.admin.users.tabs.oauthLinks.page.modal.add.noProviders', {})}
        </Text>
      )}
      <TextInput
        withAsterisk
        label={t('common.form.identifier', {})}
        placeholder={t('common.form.identifier', {})}
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
      />
    </ResourceSelectModal>
  );
}
