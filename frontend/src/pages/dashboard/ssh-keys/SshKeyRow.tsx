import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteSshKey from '@/api/me/ssh-keys/deleteSshKey.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userSshKeySchema } from '@/lib/schemas/user/sshKeys.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SshKeyEditModal from './modals/SshKeyEditModal.tsx';

export default function SshKeyRow({ sshKey }: { sshKey: z.infer<typeof userSshKeySchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'edit' | 'delete' | null>(null);

  const doDelete = async () => {
    await deleteSshKey(sshKey.uuid)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.user.sshKeys.all() });
        addToast(t('pages.account.sshKeys.modal.deleteSshKey.toast.removed', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <SshKeyEditModal sshKey={sshKey} opened={openModal === 'edit'} onClose={() => setOpenModal(null)} />

      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.account.sshKeys.modal.deleteSshKey.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.account.sshKeys.modal.deleteSshKey.content', {
          name: sshKey.name,
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
        registry={window.extensionContext.extensionRegistry.pages.dashboard.sshKeys.sshKeyContextMenu}
        registryProps={{ sshKey }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>{sshKey.name}</TableData>

            <TableData>
              <CopyOnClick content={sshKey.fingerprint}>
                <Code>{sshKey.fingerprint}</Code>
              </CopyOnClick>
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={sshKey.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
