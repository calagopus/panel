import {
  faBan,
  faCheck,
  faClone,
  faCopy,
  faInfoCircle,
  faPencil,
  faRefresh,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteApiKey from '@/api/me/api-keys/deleteApiKey.ts';
import recreateApiKey from '@/api/me/api-keys/recreateApiKey.ts';
import updateApiKey from '@/api/me/api-keys/updateApiKey.ts';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { handleRawCopyToClipboard } from '@/lib/clipboard/copy.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userApiKeySchema } from '@/lib/schemas/user/apiKeys.ts';
import ApiKeyCreateOrUpdateModal from '@/pages/dashboard/api-keys/modals/ApiKeyCreateOrUpdateModal.tsx';
import ApiKeyDuplicateModal from '@/pages/dashboard/api-keys/modals/ApiKeyDuplicateModal.tsx';
import ApiKeyTokenModal from '@/pages/dashboard/api-keys/modals/ApiKeyTokenModal.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface ApiKeyRowProps {
  apiKey: z.infer<typeof userApiKeySchema>;
  atLimit?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
}

const ApiKeyRow = forwardRef<HTMLTableRowElement, ApiKeyRowProps>(function ApiKeyRow(
  { apiKey, atLimit = false, isSelected = false, onSelectionChange },
  ref,
) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'edit' | 'duplicate' | 'recreate' | 'delete' | null>(null);
  const [recreatedToken, setRecreatedToken] = useState<string | null>(null);
  const [duplicatedToken, setDuplicatedToken] = useState<string | null>(null);

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
      <ApiKeyDuplicateModal
        apiKey={apiKey}
        opened={openModal === 'duplicate'}
        onClose={() => setOpenModal(null)}
        onDuplicated={setDuplicatedToken}
      />
      <ApiKeyTokenModal recreated token={recreatedToken} onClose={() => setRecreatedToken(null)} />
      <ApiKeyTokenModal token={duplicatedToken} onClose={() => setDuplicatedToken(null)} />
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
        {t('common.modal.deleteFromAccount.content', {
          name: apiKey.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faCopy,
            label: t('pages.account.apiKeys.button.copyUuid', {}),
            onClick: () => handleRawCopyToClipboard(apiKey.uuid, addToast),
            color: 'gray',
          },
          {
            type: 'action',
            icon: faPencil,
            label: t('common.button.edit', {}),
            onClick: () => setOpenModal('edit'),
            color: 'gray',
          },
          {
            type: 'action',
            icon: faClone,
            label: t('common.button.duplicate', {}),
            onClick: () => setOpenModal('duplicate'),
            disabled: atLimit,
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
            ref={ref}
            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            {onSelectionChange !== undefined && (
              <TableSelectionCell id={apiKey.uuid} checked={isSelected} onChange={onSelectionChange} />
            )}

            <TableData>
              <div className='flex flex-row items-center gap-2'>
                {apiKey.name}
                {apiKey.unrestrictedAdmin && (
                  <Badge color='red' className='w-max!'>
                    {t('pages.account.apiKeys.badge.unrestrictedAdmin', {})}
                  </Badge>
                )}
              </div>
            </TableData>

            <TableData>
              <div className='flex flex-row items-center gap-2'>
                <CopyOnClick content={apiKey.keyStart}>
                  <Code>{apiKey.keyStart}...</Code>
                </CopyOnClick>
                <Tooltip label={t('pages.account.apiKeys.tooltip.keyStartOnly', {})}>
                  <FontAwesomeIcon size='sm' icon={faInfoCircle} className='shrink-0' />
                </Tooltip>
              </div>
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
              <FormattedTimestamp timestamp={apiKey.lastUsed} showNA />
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={apiKey.expires} showNA />
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
});

export default ApiKeyRow;
