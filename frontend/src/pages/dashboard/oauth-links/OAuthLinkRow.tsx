import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteOAuthLink from '@/api/me/oauth-links/deleteOAuthLink.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userOAuthLinkSchema } from '@/lib/schemas/user/oAuth.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function OAuthLinkRow({ oauthLink }: { oauthLink: z.infer<typeof userOAuthLinkSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const doDelete = async () => {
    await deleteOAuthLink(oauthLink.uuid)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.user.oauthLinks.all() });
        addToast(t('pages.account.oauthLinks.modal.deleteOAuthLink.toast.removed', {}), 'success');
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
        title={t('pages.account.oauthLinks.modal.deleteOAuthLink.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.account.oauthLinks.modal.deleteOAuthLink.content', {
          provider: oauthLink.oauthProvider.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            icon: faTrash,
            disabled: !oauthLink.oauthProvider.userManageable,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.dashboard.oauthLinks.oauthLinkContextMenu}
        registryProps={{ oauthLink }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>{oauthLink.oauthProvider.name}</TableData>

            <TableData>
              <Code>{oauthLink.identifier}</Code>
            </TableData>

            <TableData>
              {!oauthLink.lastUsed ? t('common.na', {}) : <FormattedTimestamp timestamp={oauthLink.lastUsed} />}
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={oauthLink.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
