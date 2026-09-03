import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getOAuthProviders from '@/api/admin/oauth-providers/getOAuthProviders.ts';
import createUserOAuthLink from '@/api/admin/users/oauthLinks/createUserOAuthLink.ts';
import TextInput from '@/elements/input/TextInput.tsx';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function UserOAuthLinkAddModal({
  user,
  ...props
}: ModalProps & { user: z.infer<typeof adminFullUserSchema> }) {
  const { t } = useTranslations();

  const [identifier, setIdentifier] = useState('');

  const oauthProviders = useSearchableResource<z.infer<typeof adminOAuthProviderSchema>>({
    queryKey: queryKeys.admin.oAuthProviders.all(),
    fetcher: (search) => getOAuthProviders(1, search),
  });

  useEffect(() => {
    if (!props.opened) {
      setIdentifier('');
    }
  }, [props.opened]);

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.users.tabs.oauthLinks.page.modal.add.title', {})}
      label={t('pages.admin.users.tabs.oauthLinks.page.modal.add.form.oauthProvider', {})}
      data={oauthProviders.items.map((oauthProvider) => ({ label: oauthProvider.name, value: oauthProvider.uuid }))}
      loading={oauthProviders.loading}
      searchValue={oauthProviders.search}
      onSearchChange={oauthProviders.setSearch}
      disabled={!identifier}
      addedToast={t('pages.admin.users.tabs.oauthLinks.page.toast.added', {})}
      invalidateKeys={[queryKeys.admin.users.oauthLinks(user.uuid)]}
      onConfirm={(oauthProviderUuid) => createUserOAuthLink(user.uuid, oauthProviderUuid, identifier)}
    >
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
