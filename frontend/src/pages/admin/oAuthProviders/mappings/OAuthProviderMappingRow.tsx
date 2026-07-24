import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { z } from 'zod';
import deleteOAuthProviderMapping from '@/api/admin/oauth-providers/mappings/deleteOAuthProviderMapping.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Badge from '@/elements/Badge.tsx';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { oauthProviderMappingMatcherLabelMapping } from '@/lib/enums.ts';
import { adminOAuthProviderMappingSchema, adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import OAuthProviderMappingModal from './modals/OAuthProviderMappingModal.tsx';

export default function OAuthProviderMappingRow({
  oauthProvider,
  mapping,
  onChanged,
}: {
  oauthProvider: z.infer<typeof adminOAuthProviderSchema>;
  mapping: z.infer<typeof adminOAuthProviderMappingSchema>;
  onChanged: () => void;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'edit' | 'delete' | null>(null);

  const doDelete = async () => {
    await deleteOAuthProviderMapping(oauthProvider.uuid, mapping.uuid)
      .then(() => {
        addToast(t('pages.admin.oAuthProviders.tabs.mappings.page.toast.deleted', {}), 'success');
        onChanged();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.oAuthProviders.tabs.mappings.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.oAuthProviders.tabs.mappings.page.modal.delete.content', {})}
      </ConfirmationModal>

      <OAuthProviderMappingModal
        oauthProvider={oauthProvider}
        mapping={mapping}
        opened={openModal === 'edit'}
        onClose={() => setOpenModal(null)}
        onSaved={onChanged}
      />

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faPencil,
            label: t('common.button.edit', {}),
            onClick: () => setOpenModal('edit'),
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.oauthProviders.view.mappings.contextMenu}
        registryProps={{ oauthProvider, mapping }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <Code>{mapping.uuid}</Code>
            </TableData>

            <TableData>
              <Badge color={mapping.mapping.type === 'role' ? 'blue' : 'grape'}>
                {mapping.mapping.type === 'role'
                  ? t('pages.admin.oAuthProviders.tabs.mappings.page.enum.mappingType.role', {})
                  : t('pages.admin.oAuthProviders.tabs.mappings.page.enum.mappingType.serverSubuser', {})}
              </Badge>
            </TableData>

            <TableData>
              {mapping.mapping.type === 'role' ? (
                <TableLink to={`/admin/roles/${mapping.mapping.roleUuid}`}>
                  <Code>{mapping.mapping.roleUuid}</Code>
                </TableLink>
              ) : (
                <TableLink to={`/admin/servers/${mapping.mapping.serverUuid}`}>
                  <Code>{mapping.mapping.serverUuid}</Code>
                </TableLink>
              )}
            </TableData>

            <TableData>
              {oauthProviderMappingMatcherLabelMapping[mapping.matcher.type]()}
              {mapping.matcher.type === 'and' || mapping.matcher.type === 'or'
                ? ` (${mapping.matcher.matchers.length})`
                : ''}
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={mapping.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
