import { Group } from '@mantine/core';
import { Ref, useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import getNodeServers from '@/api/admin/nodes/servers/getNodeServers.ts';
import sendNodeServersPowerAction from '@/api/admin/nodes/servers/sendNodeServersPowerAction.ts';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Table from '@/elements/Table.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
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

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.servers(node.uuid),
    fetcher: (page, search) => getNodeServers(node.uuid, page, search),
  });

  const nodeServers = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

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
      if (e.key === 's' || e.key === 'S') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          setSKeyPressed(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') {
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
        const failed = nodeServers.total - successful;

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

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: () => setSelectedServers(new ObjectSet('uuid', nodeServers.data)),
      },
      {
        key: 'Escape',
        callback: () => setSelectedServers(new ObjectSet('uuid')),
      },
    ],
    deps: [nodeServers.data],
  });

  const columns = ['', ...serverTableColumns];

  return (
    <>
      <ServersTransferModal
        contextNode={node}
        servers={selectedServers}
        clearSelected={() => setSelectedServers(new ObjectSet('uuid'))}
        opened={openModal === 'transfer'}
        onClose={() => setOpenModal(null)}
      />

      <AdminSubContentContainer
        title='Node Servers'
        titleOrder={2}
        search={search}
        setSearch={setSearch}
        contentRight={
          <Group gap='sm'>
            <Button
              color='green'
              onClick={() => handleAllPowerAction('start')}
              loading={allActionLoading === 'start'}
              disabled={(allActionLoading !== null && allActionLoading !== 'start') || nodeServers.total === 0}
            >
              {t('common.enum.serverPowerAction.start', {})} ({nodeServers.total})
            </Button>
            <Button
              color='gray'
              onClick={() => handleAllPowerAction('restart')}
              loading={allActionLoading === 'restart'}
              disabled={(allActionLoading !== null && allActionLoading !== 'restart') || nodeServers.total === 0}
            >
              {t('common.enum.serverPowerAction.restart', {})} ({nodeServers.total})
            </Button>
            <Button
              color='red'
              onClick={() => handleAllPowerAction('stop')}
              loading={allActionLoading === 'stop'}
              disabled={(allActionLoading !== null && allActionLoading !== 'stop') || nodeServers.total === 0}
            >
              {t('common.enum.serverPowerAction.stop', {})} ({nodeServers.total})
            </Button>
            <Button
              color='gray'
              onClick={() => setOpenModal('transfer')}
              disabled={allActionLoading !== null || nodeServers.total === 0}
            >
              Transfer ({nodeServers.total})
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
            {nodeServers.data.map((server) => (
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
        onPowerAction={handleBulkPowerAction}
        onTransfer={() => setOpenModal('transfer')}
        loading={bulkActionLoading}
      />
    </>
  );
}
