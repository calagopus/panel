import { faPencil, faRefresh, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteApiKey from '@/api/me/api-keys/deleteApiKey.ts';
import recreateApiKey from '@/api/me/api-keys/recreateApiKey.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { userApiKeySchema } from '@/lib/schemas/user/apiKeys.ts';
import ApiKeyCreateOrUpdateModal from '@/pages/dashboard/api-keys/modals/ApiKeyCreateOrUpdateModal.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

export default function ApiKeyRow({ apiKey }: { apiKey: z.infer<typeof userApiKeySchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { updateApiKey, removeApiKey } = useUserStore();

  const [openModal, setOpenModal] = useState<'edit' | 'recreate' | 'delete' | null>(null);

  const doRecreate = async () => {
    await recreateApiKey(apiKey.uuid)
      .then((newKey) => {
        updateApiKey(apiKey.uuid, { keyStart: newKey });
        addToast(t('pages.account.apiKeys.modal.recreateApiKey.toast.recreated', {}), 'success');
        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doDelete = async () => {
    await deleteApiKey(apiKey.uuid)
      .then(() => {
        removeApiKey(apiKey);
        addToast(t('pages.account.apiKeys.modal.deleteApiKey.toast.removed', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ApiKeyCreateOrUpdateModal
        contextApiKey={apiKey}
        opened={openModal === 'edit'}
        onClose={() => setOpenModal(null)}
      />
      <ConfirmationModal
        opened={openModal === 'recreate'}
        onClose={() => setOpenModal(null)}
        title={t('pages.account.apiKeys.modal.recreateApiKey.title', {})}
        confirm={t('common.button.recreate', {})}
        onConfirmed={doRecreate}
      >
        {t('pages.account.apiKeys.modal.recreateApiKey.content', { name: apiKey.name }).md()}
      </ConfirmationModal>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.account.apiKeys.modal.deleteApiKey.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.account.apiKeys.modal.deleteApiKey.content', { name: apiKey.name }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          { icon: faPencil, label: t('common.button.edit', {}), onClick: () => setOpenModal('edit'), color: 'gray' },
          {
            icon: faRefresh,
            label: t('common.button.recreate', {}),
            onClick: () => setOpenModal('recreate'),
            color: 'red',
          },
          { icon: faTrash, label: t('common.button.remove', {}), onClick: () => setOpenModal('delete'), color: 'red' },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.dashboard.apiKeys.apiKeyContextMenu}
        registryProps={{ apiKey }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.pageX, e.pageY);
            }}
          >
            <TableData>{apiKey.name}</TableData>

            <TableData>
              <CopyOnClick content={apiKey.keyStart}>
                <Code>{apiKey.keyStart}</Code>
              </CopyOnClick>
            </TableData>

            <TableData>
              {apiKey.userPermissions.length} / {apiKey.serverPermissions.length} / {apiKey.adminPermissions.length}
            </TableData>

            <TableData>
              {!apiKey.lastUsed ? t('common.na', {}) : <FormattedTimestamp timestamp={apiKey.lastUsed} />}
            </TableData>

            <TableData>
              {!apiKey.expires ? t('common.na', {}) : <FormattedTimestamp timestamp={apiKey.expires} />}
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={apiKey.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
