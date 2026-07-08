import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteSecurityKey from '@/api/me/security-keys/deleteSecurityKey.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { userSecurityKeySchema } from '@/lib/schemas/user/securityKeys.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';
import SecurityKeyEditModal from './modals/SecurityKeyEditModal.tsx';

export default function SecurityKeyRow({ securityKey }: { securityKey: z.infer<typeof userSecurityKeySchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const removeSecurityKey = useUserStore((state) => state.removeSecurityKey);

  const [openModal, setOpenModal] = useState<'edit' | 'delete' | null>(null);

  const doDelete = async () => {
    await deleteSecurityKey(securityKey.uuid)
      .then(() => {
        removeSecurityKey(securityKey);
        addToast(t('pages.account.securityKeys.modal.deleteSecurityKey.toast.deleted', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <SecurityKeyEditModal
        securityKey={securityKey}
        opened={openModal === 'edit'}
        onClose={() => setOpenModal(null)}
      />

      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.account.securityKeys.modal.deleteSecurityKey.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.account.securityKeys.modal.deleteSecurityKey.content', {
          key: securityKey.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            icon: faPencil,
            label: t('common.button.edit', {}),
            onClick: () => setOpenModal('edit'),
            color: 'gray',
          },
          {
            icon: faTrash,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.dashboard.securityKeys.securityKeyContextMenu}
        registryProps={{ securityKey }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>{securityKey.name}</TableData>

            <TableData>
              <Code>{securityKey.credentialId}</Code>
            </TableData>

            <TableData>
              {!securityKey.lastUsed ? t('common.na', {}) : <FormattedTimestamp timestamp={securityKey.lastUsed} />}
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={securityKey.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
