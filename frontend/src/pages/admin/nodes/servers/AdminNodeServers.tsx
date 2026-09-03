import { Ref, useEffect, useState } from 'react';
import { z } from 'zod';
import getNodeServers from '@/api/admin/nodes/servers/getNodeServers.ts';
import sendNodeServersPowerAction from '@/api/admin/nodes/servers/sendNodeServersPowerAction.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { eventKeyMatches } from '@/lib/quickActions/shortcuts.ts';
import { AdminNode } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { serverSelectorSchema } from '@/lib/schemas/generic.ts';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import { serverTableColumns } from '@/lib/tableColumns.ts';
import ServerRow from '@/pages/admin/servers/ServerRow.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminTableSelection } from '@/plugins/selection/useAdminTableSelection.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import BulkActionBar from './BulkActionBar.tsx';
import ServersTransferModal from './modals/ServersTransferModal.tsx';
import ServerPowerButtons from './ServerPowerButtons.tsx';

type PowerAction = z.infer<typeof serverPowerAction>;

const ACTION_PAST_TENSE: Record<PowerAction, 'started' | 'stopped' | 'restarted' | 'killed'> = {
  start: 'started',
  stop: 'stopped',
  restart: 'restarted',
  kill: 'killed',
};

export default function AdminNodeServers({ node }: { node: AdminNode }) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();

  const [sKeyPressed, setSKeyPressed] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState<PowerAction | null>(null);
  const [allActionLoading, setAllActionLoading] = useState<PowerAction | null>(null);
  const [openModal, setOpenModal] = useState<'transfer' | null>(null);
  const [confirmPowerAction, setConfirmPowerAction] = useState<{ action: PowerAction; scope: 'bulk' | 'all' } | null>(
    null,
  );

  const {
    data: nodeServers,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.servers(node.uuid),
    fetcher: (page, search) => getNodeServers(node.uuid, page, search),
  });

  const {
    selected: selectedServers,
    clear: clearSelectedServers,
    toggle: toggleServer,
    selectionAreaProps,
  } = useAdminTableSelection<z.infer<typeof adminServerSchema>>({ items: nodeServers?.data });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (eventKeyMatches(e, 's')) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          setSKeyPressed(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (eventKeyMatches(e, 's')) {
        setSKeyPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleServerClick = (server: z.infer<typeof adminServerSchema>, event: React.MouseEvent) => {
    if (sKeyPressed || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      toggleServer(server, !selectedServers.has(server));
    }
  };

  const runPowerAction = (
    selector: z.infer<typeof serverSelectorSchema>,
    total: number,
    setLoading: (action: PowerAction | null) => void,
    action: PowerAction,
  ) => {
    setLoading(action);

    sendNodeServersPowerAction(node.uuid, selector, action)
      .then((successful) => {
        const failed = total - successful;
        const pastTense = t(`common.enum.bulkActionServerAction.${ACTION_PAST_TENSE[action]}`, {});

        if (failed === 0) {
          addToast(
            t('pages.account.home.bulkActions.success', { servers: tItem('server', successful), action: pastTense }),
            'success',
          );
        } else {
          addToast(
            t('pages.account.home.bulkActions.partial', {
              successfulServers: tItem('server', successful),
              failedServers: tItem('server', failed),
              action: pastTense,
            }),
            'warning',
          );
        }
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => {
        setLoading(null);
        if (selector.type === 'uuids') {
          clearSelectedServers();
        }
      });
  };

  const confirmCount = confirmPowerAction?.scope === 'all' ? (nodeServers?.total ?? 0) : selectedServers.size;

  const onConfirmPowerAction = () => {
    if (!confirmPowerAction) {
      return;
    }

    const { action, scope } = confirmPowerAction;
    setConfirmPowerAction(null);

    if (scope === 'all') {
      runPowerAction({ type: 'all' }, nodeServers?.total ?? 0, setAllActionLoading, action);
    } else {
      runPowerAction(
        { type: 'uuids', uuids: selectedServers.keys() },
        selectedServers.size,
        setBulkActionLoading,
        action,
      );
    }
  };

  const columns = ['', ...serverTableColumns()];

  return (
    <>
      <AdminCan action='nodes.transfers'>
        <ServersTransferModal
          contextNode={node}
          servers={selectedServers}
          clearSelected={clearSelectedServers}
          opened={openModal === 'transfer'}
          onClose={() => setOpenModal(null)}
        />
      </AdminCan>

      <ConfirmationModal
        opened={confirmPowerAction !== null}
        onClose={() => setConfirmPowerAction(null)}
        title={t('pages.admin.nodes.tabs.servers.page.modal.powerAction.title', {})}
        confirm={t('common.button.continue', {})}
        onConfirmed={onConfirmPowerAction}
      >
        {confirmPowerAction
          ? t('pages.admin.nodes.tabs.servers.page.modal.powerAction.content', {
              action: t(`common.enum.serverPowerAction.${confirmPowerAction.action}`, {}),
              servers: tItem('server', confirmCount),
            }).md()
          : null}
      </ConfirmationModal>

      <AdminSubContentContainer
        title={t('pages.admin.nodes.tabs.servers.page.title', {})}
        titleOrder={2}
        search={search}
        setSearch={setSearch}
        registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.servers.subContainer}
        registryProps={{ node }}
        contentRight={
          <Group gap='sm'>
            <ServerPowerButtons
              count={nodeServers?.total ?? 0}
              loading={allActionLoading}
              onAction={(action) => setConfirmPowerAction({ action, scope: 'all' })}
              disabled={nodeServers?.total === 0}
            />
            <AdminCan action='nodes.transfers'>
              <Button
                color='gray'
                onClick={() => setOpenModal('transfer')}
                disabled={allActionLoading !== null || nodeServers?.total === 0}
              >
                {t('common.button.transfer', {})} ({nodeServers?.total})
              </Button>
            </AdminCan>
          </Group>
        }
      >
        <SelectionArea {...selectionAreaProps}>
          <Table
            columns={columns}
            loading={loading}
            error={error}
            pagination={nodeServers}
            onPageSelect={setPage}
            allowSelect={false}
          >
            {nodeServers?.data.map((server) => (
              <SelectionArea.Selectable key={server.uuid} item={server}>
                {(innerRef: Ref<HTMLElement>) => (
                  <ServerRow
                    key={server.uuid}
                    server={server}
                    ref={innerRef as Ref<HTMLTableRowElement>}
                    showSelection={true}
                    isSelected={selectedServers.has(server.uuid)}
                    onSelectionChange={(selected) => toggleServer(server, selected)}
                    onClick={(e) => handleServerClick(server, e)}
                  />
                )}
              </SelectionArea.Selectable>
            ))}
          </Table>
        </SelectionArea>
      </AdminSubContentContainer>

      <BulkActionBar
        selectedCount={selectedServers.size}
        onClear={clearSelectedServers}
        onPowerAction={(action) => setConfirmPowerAction({ action, scope: 'bulk' })}
        onTransfer={() => setOpenModal('transfer')}
        loading={bulkActionLoading}
      />
    </>
  );
}
