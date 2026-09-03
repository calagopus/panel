import { faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import getOAuthProviderUserByIdentifier from '@/api/admin/oauth-providers/users/getOAuthProviderUserByIdentifier.ts';
import ResourceLookupModal from '@/elements/modals/ResourceLookupModal.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function IdentifierLookupModal({
  oauthProviderUuid,
  ...props
}: ModalProps & { oauthProviderUuid: string }) {
  const { t } = useTranslations();
  const tr = 'pages.admin.oAuthProviders.tabs.users.identifierLookup';

  return (
    <ResourceLookupModal
      {...props}
      labels={{
        title: t(`${tr}.modal.title`, {}),
        inputLabel: t(`${tr}.modal.form.identifier`, {}),
        inputPlaceholder: t(`${tr}.modal.form.identifierPlaceholder`, {}),
        search: t(`${tr}.modal.form.search`, {}),
        notFound: t(`${tr}.modal.notFound`, {}),
        resultTitle: t(`${tr}.modal.result.title`, {}),
        viewResult: t(`${tr}.modal.result.viewUser`, {}),
      }}
      resultIcon={<FontAwesomeIcon icon={faUser} />}
      lookup={(identifier) => getOAuthProviderUserByIdentifier(oauthProviderUuid, identifier)}
      fields={(link) => [
        { label: t(`${tr}.modal.result.username`, {}), value: link.user.username },
        { label: t(`${tr}.modal.result.email`, {}), value: link.user.email },
        { label: t(`${tr}.modal.result.identifier`, {}), value: link.identifier },
      ]}
      href={(link) => `/admin/users/${link.user.uuid}`}
    />
  );
}
