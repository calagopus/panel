import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteSession from '@/api/me/sessions/deleteSession.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { userSessionSchema } from '@/lib/schemas/user/sessions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

export default function SessionRow({ session }: { session: z.infer<typeof userSessionSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { removeSession } = useUserStore();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const doDelete = async () => {
    await deleteSession(session.uuid)
      .then(() => {
        removeSession(session);
        addToast(t('pages.account.sessions.modal.deleteSession.toast.deleted', {}), 'success');
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
        title={t('pages.account.sessions.modal.deleteSession.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.account.sessions.modal.deleteSession.content', { ip: session.ip }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            icon: faTrash,
            label: t('common.button.remove', {}),
            disabled: session.isUsing,
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.dashboard.sessions.sessionContextMenu}
        registryProps={{ session }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.pageX, e.pageY);
            }}
          >
            <TableData>
              <CopyOnClick content={session.ip}>
                <Code>{session.ip}</Code>
              </CopyOnClick>
            </TableData>
            <TableData>{session.isUsing ? t('common.yes', {}) : t('common.no', {})}</TableData>
            <TableData>{session.userAgent}</TableData>
            <TableData>
              <FormattedTimestamp timestamp={session.lastUsed} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
