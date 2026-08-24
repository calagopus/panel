import { faBan, faCheck, faPencil, faRefresh, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteApiKey from '@/api/me/api-keys/deleteApiKey.ts';
import recreateApiKey from '@/api/me/api-keys/recreateApiKey.ts';
import updateApiKey from '@/api/me/api-keys/updateApiKey.ts';
import Badge from '@/elements/Badge.tsx';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userApiKeySchema } from '@/lib/schemas/user/apiKeys.ts';
import ApiKeyCreateOrUpdateModal from '@/pages/dashboard/api-keys/modals/ApiKeyCreateOrUpdateModal.tsx';
import ApiKeyTokenModal from '@/pages/dashboard/api-keys/modals/ApiKeyTokenModal.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ApiKeyRow({ apiKey }: { apiKey: z.infer<typeof userApiKeySchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'edit' | 'recreate' | 'delete' | null>(null);
  const [recreatedToken, setRecreatedToken] = useState<string | null>(null);

  const doToggleEnabled = async () => {
    await updateApiKey(apiKey.uuid, { enabled: !apiKey.enabled })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.user.apiKeys.all() });
        addToast(
          apiKey.enabled ? t('pages.account.apiKeys.toast.disabled', {}) : t('pages.account.apiKeys.toast.enabled', {}),
          'success',
        );
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doRecreate = async () => {
    await recreateApiKey(apiKey.uuid)
      .then((newKey) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.user.apiKeys.all() });
        addToast(t('pages.account.apiKeys.modal.recreateApiKey.toast.recreated', {}), 'success');
        setOpenModal(null);
        setRecreatedToken(newKey);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doDelete = async () => {
    await deleteApiKey(apiKey.uuid)
      .then(() => {
        setOpenModal(null);
        queryClient.invalidateQueries({ queryKey: queryKeys.user.apiKeys.all() });
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
      <ApiKeyTokenModal recreated token={recreatedToken} onClose={() => setRecreatedToken(null)} />
      <ConfirmationModal
        opened={openModal === 'recreate'}
        onClose={() => setOpenModal(null)}
        title={t('pages.account.apiKeys.modal.recreateApiKey.title', {})}
        confirm={t('common.button.recreate', {})}
        onConfirmed={doRecreate}
      >
        {t('pages.account.apiKeys.modal.recreateApiKey.content', {
          name: apiKey.name,
        }).md()}
      </ConfirmationModal>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.account.apiKeys.modal.deleteApiKey.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.account.apiKeys.modal.deleteApiKey.content', {
          name: apiKey.name,
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
            icon: apiKey.enabled ? faBan : faCheck,
            label: apiKey.enabled ? t('common.button.disable', {}) : t('common.button.enable', {}),
            onClick: doToggleEnabled,
            color: apiKey.enabled ? 'red' : 'gray',
          },
          {
            type: 'action',
            icon: faRefresh,
            label: t('common.button.recreate', {}),
            onClick: () => setOpenModal('recreate'),
            color: 'red',
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.dashboard.apiKeys.apiKeyContextMenu}
        registryProps={{ apiKey }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
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
              <Badge color={apiKey.enabled ? 'green' : 'red'}>
                {apiKey.enabled ? t('common.badge.enabled', {}) : t('common.badge.disabled', {})}
              </Badge>
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
