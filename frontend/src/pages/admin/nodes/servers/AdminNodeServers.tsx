import { Ref, useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import getNodeServers from '@/api/admin/nodes/servers/getNodeServers.ts';
import sendNodeServersPowerAction from '@/api/admin/nodes/servers/sendNodeServersPowerAction.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Table from '@/elements/Table.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import { eventKeyMatches } from '@/lib/shortcuts.ts';
import { serverTableColumns } from '@/lib/tableColumns.ts';
import ServerRow from '@/pages/admin/servers/ServerRow.tsx';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import BulkActionBar from './BulkActionBar.tsx';
import ServersTransferModal from './modals/ServersTransferModal.tsx';

export default function AdminNodeServers({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const [selectedServers, setSelectedServers] = useState(
    new ObjectSet<z.infer<typeof adminServerSchema>, 'uuid'>('uuid'),
  );
  const selectedServersPreviousRef = useRef<z.infer<typeof adminServerSchema>[]>([]);
  const [sKeyPressed, setSKeyPressed] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState<z.infer<typeof serverPowerAction> | null>(null);
  const [allActionLoading, setAllActionLoading] = useState<z.infer<typeof serverPowerAction> | null>(null);
  const [openModal, setOpenModal] = useState<'transfer' | null>(null);
  const [confirmPowerAction, setConfirmPowerAction] = useState<{
    action: z.infer<typeof serverPowerAction>;
    scope: 'bulk' | 'all';
  } | null>(null);

  const {
    data: nodeServers,
    loading,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.servers(node.uuid),
    fetcher: (page, search) => getNodeServers(node.uuid, page, search),
  });

  const onSelectedStart = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      selectedServersPreviousRef.current = event.shiftKey ? selectedServers.values() : [];
    },
    [selectedServers],
  );

  const onSelected = useCallback((selected: z.infer<typeof adminServerSchema>[]) => {
    setSelectedServers(new ObjectSet('uuid', [...selectedServersPreviousRef.current, ...selected]));
  }, []);

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

  const handleServerSelectionChange = (server: z.infer<typeof adminServerSchema>, selected: boolean) => {
    setSelectedServers((prev) => {
      const newSet = new ObjectSet('uuid', prev.values());
      if (selected) {
        newSet.add(server);
      } else {
        newSet.delete(server);
      }
      return newSet;
    });
  };

  const handleServerClick = (server: z.infer<typeof adminServerSchema>, event: React.MouseEvent) => {
    if (sKeyPressed || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      handleServerSelectionChange(server, !selectedServers.has(server));
    }
  };

  const handleBulkPowerAction = async (action: z.infer<typeof serverPowerAction>) => {
    setBulkActionLoading(action);

    sendNodeServersPowerAction(node.uuid, selectedServers.keys(), action)
      .then((successful) => {
        const failed = selectedServers.size - successful;

        const actionPastTenseMap: Record<
          z.infer<typeof serverPowerAction>,
          'started' | 'stopped' | 'restarted' | 'killed'
        > = {
          start: 'started',
          stop: 'stopped',
          restart: 'restarted',
          kill: 'killed',
        };
        const actionPastTense = actionPastTenseMap[action];

        if (failed === 0) {
          addToast(
            t('pages.account.home.bulkActions.success', {
              servers: tItem('server', successful),
              action: t(`common.enum.bulkActionServerAction.${actionPastTense}`, {}),
            }),
            'success',
          );
        } else {
          addToast(
            t('pages.account.home.bulkActions.partial', {
              successfulServers: tItem('server', successful),
              failedServers: tItem('server', failed),
              action: t(`common.enum.bulkActionServerAction.${actionPastTense}`, {}),
            }),
            'warning',
          );
        }
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => {
        setBulkActionLoading(null);
        setSelectedServers(new ObjectSet('uuid'));
      });
  };

  const handleAllPowerAction = async (action: z.infer<typeof serverPowerAction>) => {
    setAllActionLoading(action);

    sendNodeServersPowerAction(node.uuid, [], action)
      .then((successful) => {
        const failed = (nodeServers?.total ?? 0) - successful;

        const actionPastTenseMap: Record<
          z.infer<typeof serverPowerAction>,
          'started' | 'stopped' | 'restarted' | 'killed'
        > = {
          start: 'started',
          stop: 'stopped',
          restart: 'restarted',
          kill: 'killed',
        };
        const actionPastTense = actionPastTenseMap[action];

        if (failed === 0) {
          addToast(
            t('pages.account.home.bulkActions.success', {
              servers: tItem('server', successful),
              action: t(`common.enum.bulkActionServerAction.${actionPastTense}`, {}),
            }),
            'success',
          );
        } else {
          addToast(
            t('pages.account.home.bulkActions.partial', {
              successfulServers: tItem('server', successful),
              failedServers: tItem('server', failed),
              action: t(`common.enum.bulkActionServerAction.${actionPastTense}`, {}),
            }),
            'warning',
          );
        }
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => {
        setAllActionLoading(null);
      });
  };

  const confirmCount = confirmPowerAction?.scope === 'all' ? (nodeServers?.total ?? 0) : selectedServers.size;

  const onConfirmPowerAction = async () => {
    if (!confirmPowerAction) {
      return;
    }

    const { action, scope } = confirmPowerAction;
    setConfirmPowerAction(null);

    if (scope === 'all') {
      await handleAllPowerAction(action);
    } else {
      await handleBulkPowerAction(action);
    }
  };

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: () => setSelectedServers(new ObjectSet('uuid', nodeServers?.data ?? [])),
      },
      {
        key: 'Escape',
        callback: () => setSelectedServers(new ObjectSet('uuid')),
      },
    ],
    deps: [nodeServers?.data],
  });

  const columns = ['', ...serverTableColumns()];

  return (
    <>
      <ServersTransferModal
        contextNode={node}
        servers={selectedServers}
        clearSelected={() => setSelectedServers(new ObjectSet('uuid'))}
        opened={openModal === 'transfer'}
        onClose={() => setOpenModal(null)}
      />

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
        contentRight={
          <Group gap='sm'>
            <Button
              color='green'
              onClick={() => setConfirmPowerAction({ action: 'start', scope: 'all' })}
              loading={allActionLoading === 'start'}
              disabled={(allActionLoading !== null && allActionLoading !== 'start') || nodeServers?.total === 0}
            >
              {t('common.enum.serverPowerAction.start', {})} ({nodeServers?.total})
            </Button>
            <Button
              color='gray'
              onClick={() => setConfirmPowerAction({ action: 'restart', scope: 'all' })}
              loading={allActionLoading === 'restart'}
              disabled={(allActionLoading !== null && allActionLoading !== 'restart') || nodeServers?.total === 0}
            >
              {t('common.enum.serverPowerAction.restart', {})} ({nodeServers?.total})
            </Button>
            <Button
              color='red'
              onClick={() => setConfirmPowerAction({ action: 'stop', scope: 'all' })}
              loading={allActionLoading === 'stop'}
              disabled={(allActionLoading !== null && allActionLoading !== 'stop') || nodeServers?.total === 0}
            >
              {t('common.enum.serverPowerAction.stop', {})} ({nodeServers?.total})
            </Button>
            <Button
              color='gray'
              onClick={() => setOpenModal('transfer')}
              disabled={allActionLoading !== null || nodeServers?.total === 0}
            >
              {t('common.button.transfer', {})} ({nodeServers?.total})
            </Button>
          </Group>
        }
      >
        <SelectionArea onSelectedStart={onSelectedStart} onSelected={onSelected}>
          <Table
            columns={columns}
            loading={loading}
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
                    onSelectionChange={(selected) => handleServerSelectionChange(server, selected)}
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
        onClear={() => setSelectedServers(new ObjectSet('uuid'))}
        onPowerAction={(action) => setConfirmPowerAction({ action, scope: 'bulk' })}
        onTransfer={() => setOpenModal('transfer')}
        loading={bulkActionLoading}
      />
    </>
  );
}
