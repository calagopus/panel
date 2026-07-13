import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteCommandSnippet from '@/api/me/command-snippets/deleteCommandSnippet.ts';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userCommandSnippetSchema } from '@/lib/schemas/user/commandSnippets.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import CommandSnippetEditModal from './modals/CommandSnippetEditModal.tsx';

export default function CommandSnippetRow({
  commandSnippet,
}: {
  commandSnippet: z.infer<typeof userCommandSnippetSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'edit' | 'delete' | null>(null);

  const doDelete = async () => {
    await deleteCommandSnippet(commandSnippet.uuid)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.user.commandSnippets.all() });
        addToast(t('pages.account.commandSnippets.modal.deleteCommandSnippet.toast.removed', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <CommandSnippetEditModal
        commandSnippet={commandSnippet}
        opened={openModal === 'edit'}
        onClose={() => setOpenModal(null)}
      />
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.account.commandSnippets.modal.deleteCommandSnippet.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.account.commandSnippets.modal.deleteCommandSnippet.content', {
          name: commandSnippet.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faPencil,
            label: t('common.button.edit', {}),
            onClick: () => setOpenModal('edit'),
            color: 'gray',
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.dashboard.commandSnippets.commandSnippetContextMenu}
        registryProps={{ commandSnippet }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>!{commandSnippet.name}</TableData>

            <TableData>{commandSnippet.eggs.length}</TableData>

            <TableData>
              <FormattedTimestamp timestamp={commandSnippet.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
