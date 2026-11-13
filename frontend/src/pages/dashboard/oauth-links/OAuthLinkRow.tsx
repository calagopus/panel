import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteOAuthLink from '@/api/me/oauth-links/deleteOAuthLink.ts';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userOAuthLinkSchema } from '@/lib/schemas/user/oAuth.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface OAuthLinkRowProps {
  oauthLink: z.infer<typeof userOAuthLinkSchema>;
  isSelected?: boolean;
  isLastLoginMethod?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
}

const OAuthLinkRow = forwardRef<HTMLTableRowElement, OAuthLinkRowProps>(function OAuthLinkRow(
  { oauthLink, isSelected = false, isLastLoginMethod = false, onSelectionChange },
  ref,
) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const doDelete = async () => {
    await deleteOAuthLink(oauthLink.uuid)
      .then(() => {
        setOpenModal(null);
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
            type: 'action',
            icon: faTrash,
            disabled: !oauthLink.oauthProvider.userManageable || isLastLoginMethod,
            tooltip: !oauthLink.oauthProvider.userManageable
              ? t('pages.account.oauthLinks.tooltip.notManageable', {})
              : isLastLoginMethod
                ? t('pages.account.oauthLinks.tooltip.lastLoginMethod', {})
                : undefined,
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
            ref={ref}
            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            {onSelectionChange !== undefined && (
              <TableSelectionCell id={oauthLink.uuid} checked={isSelected} onChange={onSelectionChange} />
            )}

            <TableData>{oauthLink.oauthProvider.name}</TableData>

            <TableData>
              <Code>{oauthLink.identifier}</Code>
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={oauthLink.lastUsed} showNA />
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
});

export default OAuthLinkRow;
