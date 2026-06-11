import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { z } from 'zod';
import deleteNodeMount from '@/api/admin/nodes/mounts/deleteNodeMount.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminNodeMountSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function NodeMountRow({
  node,
  mount,
}: {
  node: z.infer<typeof adminNodeSchema>;
  mount: z.infer<typeof adminNodeMountSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { removeNodeMount } = useAdminStore();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteNodeMount(node.uuid, mount.mount.uuid)
      .then(() => {
        removeNodeMount(mount);
        addToast(t('pages.admin.nodes.tabs.mounts.page.toast.removed', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'remove'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.nodes.tabs.mounts.page.modal.remove.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.nodes.tabs.mounts.page.modal.remove.content', {
          mount: mount.mount.name,
          name: node.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
          },
        ]}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <TableLink to={`/admin/mounts/${mount.mount.uuid}`}>
                <Code>{mount.mount.uuid}</Code>
              </TableLink>
            </TableData>
            <TableData>{mount.mount.name}</TableData>
            <TableData>
              <Code>{mount.mount.source}</Code>
            </TableData>
            <TableData>
              <Code>{mount.mount.target}</Code>
            </TableData>
            <TableData>
              <FormattedTimestamp timestamp={mount.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
