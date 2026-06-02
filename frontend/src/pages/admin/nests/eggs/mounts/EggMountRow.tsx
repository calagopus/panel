import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { z } from 'zod';
import deleteEggMount from '@/api/admin/nests/eggs/mounts/deleteEggMount.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { adminNodeMountSchema } from '@/lib/schemas/admin/nodes.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function EggMountRow({
  nest,
  egg,
  mount,
}: {
  nest: z.infer<typeof adminNestSchema>;
  egg: z.infer<typeof adminEggSchema>;
  mount: z.infer<typeof adminNodeMountSchema>;
}) {
  const { addToast } = useToast();
  const { removeEggMount } = useAdminStore();
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteEggMount(nest.uuid, egg.uuid, mount.mount.uuid)
      .then(() => {
        removeEggMount(mount);
        addToast(t('pages.admin.nests.tabs.eggs.page.tabs.mounts.page.toast.deleted', {}), 'success');
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
        title={t('pages.admin.nests.tabs.eggs.page.tabs.mounts.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.nests.tabs.eggs.page.tabs.mounts.page.modal.delete.content', {
          mount: mount.mount.name,
          egg: egg.name,
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
