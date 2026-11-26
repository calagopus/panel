import { useQueryClient } from '@tanstack/react-query';
import { Ref, useState } from 'react';
import { z } from 'zod';
import getNodeServers from '@/api/admin/nodes/servers/getNodeServers.ts';
import sendNodeServersPowerAction from '@/api/admin/nodes/servers/sendNodeServersPowerAction.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminNode } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import { serverTableColumns } from '@/lib/tableColumns.ts';
import ServerActionBar from '@/pages/admin/servers/ServerActionBar.tsx';
import ServerRow from '@/pages/admin/servers/ServerRow.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useSelectKeyHeld } from '@/plugins/selection/useSelectKeyHeld.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
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
  const queryClient = useQueryClient();

  const sKeyPressedRef = useSelectKeyHeld();
  const [allActionLoading, setAllActionLoading] = useState<PowerAction | null>(null);
  const [transferAllOpen, setTransferAllOpen] = useState(false);
  const [confirmPowerAction, setConfirmPowerAction] = useState<PowerAction | null>(null);

  const {
    data: nodeServers,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.servers(node.uuid),
    fetcher: (page, search, perPage) => getNodeServers(node.uuid, page, search, perPage),
  });

  const {
    selected: selectedServers,
    clear: clearSelectedServers,
    toggle: toggleServer,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection<z.infer<typeof adminServerSchema>>({ items: nodeServers?.data });

  const handleServerClick = (server: z.infer<typeof adminServerSchema>, event: React.MouseEvent) => {
    if (sKeyPressedRef.current || event.ctrlKey || event.metaKey || event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      toggleServer(server, !selectedServers.has(server), event.shiftKey);
    }
  };

  const runPowerAction = (action: PowerAction) => {
    const total = nodeServers?.total ?? 0;
    setAllActionLoading(action);

    sendNodeServersPowerAction(node.uuid, { type: 'all' }, action)
      .then((successful) => {
        const failed = total - successful;
        const pastTense = t(`common.bulkActions.verb.${ACTION_PAST_TENSE[action]}`, {});

        if (failed === 0) {
          addToast(
            t('common.bulkActions.success', { items: tItem('server', successful), action: pastTense }),
            'success',
          );
        } else {
          addToast(
            t('common.bulkActions.partial', {
              successfulItems: tItem('server', successful),
              failedItems: tItem('server', failed),
              action: pastTense,
            }),
            'warning',
          );
        }
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setAllActionLoading(null));
  };

  const searchActive = !!search;

  const onConfirmPowerAction = () => {
    if (!confirmPowerAction) {
      return;
    }

    setConfirmPowerAction(null);
    runPowerAction(confirmPowerAction);
  };

  const columns = [
    tableSelectionHeader({
      checked: allSelected,
      indeterminate: selectedServers.size > 0 && !allSelected,
      onChange: (checked) => (checked ? selectAll() : clearSelectedServers()),
    }),
    ...serverTableColumns(),
  ];

  return (
    <>
      <AdminCan action='nodes.transfers'>
        <ServersTransferModal
          contextNode={node}
          selector={{ type: 'all' }}
          count={nodeServers?.total ?? 0}
          clearSelected={clearSelectedServers}
          opened={transferAllOpen}
          onClose={() => setTransferAllOpen(false)}
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
              action: t(`common.enum.serverPowerAction.${confirmPowerAction}`, {}),
              servers: tItem('server', nodeServers?.total ?? 0),
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
          <ConditionalTooltip
            enabled={searchActive}
            label={t('pages.admin.nodes.tabs.servers.page.tooltip.searchActive', {})}
          >
            <Group gap='sm'>
              <ServerPowerButtons
                count={nodeServers?.total ?? 0}
                loading={allActionLoading}
                onAction={setConfirmPowerAction}
                disabled={searchActive || nodeServers?.total === 0}
              />
              <AdminCan action='nodes.transfers'>
                <Button
                  color='gray'
                  onClick={() => setTransferAllOpen(true)}
                  disabled={searchActive || allActionLoading !== null || nodeServers?.total === 0}
                >
                  {t('common.button.transfer', {})} ({nodeServers?.total})
                </Button>
              </AdminCan>
            </Group>
          </ConditionalTooltip>
        }
      >
        <SelectionArea {...selectionAreaProps}>
          <Table
            columns={columns}
            loading={loading}
            error={error}
            pagination={nodeServers}
            onPageSelect={setPage}
            onPerPageSelect={setPerPage}
          >
            {nodeServers?.data.map((server) => (
              <SelectionArea.Selectable key={server.uuid} item={server}>
                {(innerRef: Ref<HTMLElement>) => (
                  <ServerRow
                    key={server.uuid}
                    server={server}
                    ref={innerRef as Ref<HTMLTableRowElement>}
                    isSelected={selectedServers.has(server.uuid)}
                    onSelectionChange={(selected, range) => toggleServer(server, selected, range)}
                    onClick={(e) => handleServerClick(server, e)}
                  />
                )}
              </SelectionArea.Selectable>
            ))}
          </Table>
        </SelectionArea>
      </AdminSubContentContainer>

      <ServerActionBar
        selectedServers={selectedServers}
        clearSelectedServers={clearSelectedServers}
        invalidateServers={() => queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.servers(node.uuid) })}
      />
    </>
  );
}
