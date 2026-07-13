import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { z } from 'zod';
import getOAuthProviders from '@/api/admin/oauth-providers/getOAuthProviders.ts';
import createUserOAuthLink from '@/api/admin/users/oauthLinks/createUserOAuthLink.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function UserOAuthLinkAddModal({
  user,
  ...props
}: ModalProps & { user: z.infer<typeof fullUserSchema> }) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [selectedOAuthProvider, setSelectedOAuthProvider] = useState<z.infer<typeof adminOAuthProviderSchema> | null>(
    null,
  );

  const oauthProviders = useSearchableResource<z.infer<typeof adminOAuthProviderSchema>>({
    queryKey: queryKeys.admin.oAuthProviders.all(),
    fetcher: (search) => getOAuthProviders(1, search),
  });

  useEffect(() => {
    if (!props.opened) {
      oauthProviders.setSearch('');
      setSelectedOAuthProvider(null);
    }
  }, [props.opened]);

  const doAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedOAuthProvider) {
      return;
    }

    setLoading(true);

    createUserOAuthLink(user.uuid, selectedOAuthProvider.uuid, identifier)
      .then((oauthLink) => {
        addToast(t('pages.admin.users.tabs.oauthLinks.page.toast.added', {}), 'success');

        props.onClose();
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.oauthLinks(user.uuid) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <FormModal
      title={t('pages.admin.users.tabs.oauthLinks.page.modal.add.title', {})}
      loading={loading}
      {...props}
      onSubmit={doAdd}
    >
      <Stack>
        <Select
          withAsterisk
          label={t('pages.admin.users.tabs.oauthLinks.page.modal.add.form.oauthProvider', {})}
          placeholder={t('pages.admin.users.tabs.oauthLinks.page.modal.add.form.oauthProvider', {})}
          value={selectedOAuthProvider?.uuid}
          onChange={(value) => setSelectedOAuthProvider(oauthProviders.items.find((p) => p.uuid === value) || null)}
          data={oauthProviders.items.map((oauthProvider) => ({
            label: oauthProvider.name,
            value: oauthProvider.uuid,
          }))}
          searchable
          searchValue={oauthProviders.search}
          onSearchChange={oauthProviders.setSearch}
          loading={oauthProviders.loading}
        />

        <TextInput
          withAsterisk
          label={t('common.form.identifier', {})}
          placeholder={t('common.form.identifier', {})}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!selectedOAuthProvider || !identifier}>
            {t('common.button.add', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
