import { ModalProps, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getOAuthProviders from '@/api/admin/oauth-providers/getOAuthProviders.ts';
import createUserOAuthLink from '@/api/admin/users/oauthLinks/createUserOAuthLink.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function UserOAuthLinkAddModal({
  user,
  opened,
  onClose,
}: ModalProps & { user: z.infer<typeof fullUserSchema> }) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const { addUserOAuthLink } = useAdminStore();

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
    if (!opened) {
      oauthProviders.setSearch('');
      setSelectedOAuthProvider(null);
    }
  }, [opened]);

  const doAdd = () => {
    if (!selectedOAuthProvider) {
      return;
    }

    setLoading(true);

    createUserOAuthLink(user.uuid, selectedOAuthProvider.uuid, identifier)
      .then((oauthLink) => {
        addToast(t('pages.admin.users.oauthLinks.toast.added', {}), 'success');

        onClose();
        addUserOAuthLink(oauthLink);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.users.oauthLinks.modal.add.title', {})} onClose={onClose} opened={opened}>
      <Stack>
        <Select
          withAsterisk
          label={t('pages.admin.users.oauthLinks.modal.add.form.oauthProvider', {})}
          placeholder={t('pages.admin.users.oauthLinks.modal.add.form.oauthProvider', {})}
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
          <Button onClick={doAdd} loading={loading} disabled={!selectedOAuthProvider || !identifier}>
            {t('common.button.add', {})}
          </Button>
          <Button variant='default' onClick={onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
