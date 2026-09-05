import { faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import getUserByExternalId from '@/api/admin/users/getUserByExternalId.ts';
import ResourceLookupModal from '@/elements/modals/ResourceLookupModal.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ExternalIdLookupModal(props: ModalProps) {
  const { t } = useTranslations();
  const tr = 'pages.admin.users.externalIdLookup';

  return (
    <ResourceLookupModal
      {...props}
      labels={{
        title: t(`${tr}.modal.title`, {}),
        inputLabel: t('common.form.externalId', {}),
        inputPlaceholder: t(`${tr}.modal.form.externalIdPlaceholder`, {}),
        search: t(`${tr}.modal.form.search`, {}),
        notFound: t(`${tr}.modal.notFound`, {}),
        resultTitle: t(`${tr}.modal.result.title`, {}),
        viewResult: t(`${tr}.modal.result.viewUser`, {}),
      }}
      resultIcon={<FontAwesomeIcon icon={faUser} />}
      lookup={(externalId) => getUserByExternalId(externalId)}
      fields={(user) => [
        { label: t(`${tr}.modal.result.username`, {}), value: user.username },
        { label: t(`${tr}.modal.result.email`, {}), value: user.email },
        { label: t(`${tr}.modal.result.role`, {}), value: user.role?.name ?? t('common.na', {}) },
      ]}
      href={(user) => `/admin/users/${user.uuid}`}
    />
  );
}
