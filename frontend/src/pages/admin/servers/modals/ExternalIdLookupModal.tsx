import { faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import getServerByExternalId from '@/api/admin/servers/getServerByExternalId.ts';
import ResourceLookupModal from '@/elements/modals/ResourceLookupModal.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ExternalIdLookupModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const tr = 'pages.admin.servers.externalIdLookup';

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
        viewResult: t(`${tr}.modal.result.viewServer`, {}),
      }}
      resultIcon={<FontAwesomeIcon icon={faServer} />}
      lookup={(externalId) => getServerByExternalId(externalId)}
      fields={(server) => [
        { label: t(`${tr}.modal.result.name`, {}), value: server.name },
        { label: t(`${tr}.modal.result.owner`, {}), value: server.owner.username },
        { label: t(`${tr}.modal.result.node`, {}), value: server.node.name },
      ]}
      href={(server) => `/admin/servers/${server.uuid}`}
    />
  );
}
