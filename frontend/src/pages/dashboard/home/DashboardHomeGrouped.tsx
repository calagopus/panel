import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ComponentProps, memo, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getServerGroups from '@/api/me/servers/groups/getServerGroups.ts';
import updateServerGroupsOrder from '@/api/me/servers/groups/updateServerGroupsOrder.ts';
import Button from '@/elements/Button.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import { DndContainer, DndItem, SortableItem } from '@/elements/DragAndDrop.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverPowerAction, serverSchema } from '@/lib/schemas/server/server.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import { eventKeyMatches } from '@/lib/shortcuts.ts';
import { useBulkPowerActions } from '@/plugins/useBulkPowerActions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';
import BulkActionBar from './BulkActionBar.tsx';
import DashboardHomeTitle from './DashboardHomeTitle.tsx';
import ServerGroupCreateModal from './modals/ServerGroupCreateModal.tsx';
import ServerGroupItem from './ServerGroupItem.tsx';

interface DndServerGroup extends z.infer<typeof userServerGroupSchema>, DndItem {
  id: string;
}

const MemoizedServerGroupItem = memo(ServerGroupItem);

export default function DashboardHomeGrouped() {
  const { t } = useTranslations();
  const { serverGroups, setServerGroups } = useUserStore();
  const { addToast } = useToast();

  const [selectedServers, setSelectedServers] = useState(new ObjectSet<z.infer<typeof serverSchema>, 'uuid'>('uuid'));
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState<'create' | null>(null);
  const sKeyPressedRef = useRef(false);

  const { handleBulkPowerAction, bulkActionLoading } = useBulkPowerActions();

  useEffect(() => {
    getServerGroups()
      .then((response) => {
        setServerGroups(response);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [addToast, setServerGroups]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (eventKeyMatches(e, 's')) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          sKeyPressedRef.current = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (eventKeyMatches(e, 's')) {
        sKeyPressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleServerSelectionChange = (server: z.infer<typeof serverSchema>, selected: boolean) => {
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

  const handleServerClick = (server: z.infer<typeof serverSchema>, event: React.MouseEvent) => {
    if (sKeyPressedRef.current) {
      event.preventDefault();
      event.stopPropagation();
      handleServerSelectionChange(server, !selectedServers.has(server));
    }
  };

  const onBulkAction = async (action: z.infer<typeof serverPowerAction>) => {
    await handleBulkPowerAction(selectedServers.keys(), action);
    setSelectedServers(new ObjectSet('uuid'));
  };

  const sortedServerGroups = useMemo(() => [...serverGroups].sort((a, b) => a.order - b.order), [serverGroups]);

  const dndServerGroups: DndServerGroup[] = sortedServerGroups.map((g) => ({ ...g, id: g.uuid }));

  return (
    <AccountContentContainer
      title={t('pages.account.home.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.dashboard.home.containerGrouped}
    >
      <ServerGroupCreateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />

      <DashboardHomeTitle />

      <BulkActionBar
        selectedCount={selectedServers.size}
        onClear={() => setSelectedServers(new ObjectSet('uuid'))}
        onAction={onBulkAction}
        loading={bulkActionLoading}
      />

      {loading ? (
        <Spinner.Centered />
      ) : serverGroups.length === 0 ? (
        <p className='text-gray-400 light:text-gray-600!'>
          {t('pages.account.home.tabs.groupedServers.page.noGroups', {})}
        </p>
      ) : (
        <DndContainer
          items={dndServerGroups}
          callbacks={{
            onDragEnd: async (items) => {
              const reorderedGroups = items.map((g, i) => ({ ...g, order: i }));

              startTransition(() => {
                setServerGroups(reorderedGroups);
              });

              await updateServerGroupsOrder(items.map((g) => g.uuid)).catch((err) => {
                addToast(httpErrorToHuman(err), 'error');
                setServerGroups(serverGroups);
              });
            },
          }}
          renderOverlay={(activeItem) =>
            activeItem ? (
              <div style={{ cursor: 'grabbing', opacity: 0.95 }} className='shadow-xl rounded-lg'>
                <MemoizedServerGroupItem
                  serverGroup={activeItem}
                  dragHandleProps={{
                    style: { cursor: 'grabbing' },
                  }}
                  sKeyPressedRef={sKeyPressedRef}
                />
              </div>
            ) : null
          }
        >
          {(items) => (
            <div className='flex flex-col gap-3'>
              {items.map((serverGroup) => (
                <SortableItem
                  key={serverGroup.id}
                  id={serverGroup.id}
                  renderItem={({ dragHandleProps }) => (
                    <MemoizedServerGroupItem
                      serverGroup={serverGroup}
                      dragHandleProps={dragHandleProps as unknown as ComponentProps<'button'>}
                      selectedServers={selectedServers}
                      onServerSelectionChange={handleServerSelectionChange}
                      onServerClick={handleServerClick}
                      sKeyPressedRef={sKeyPressedRef}
                    />
                  )}
                />
              ))}
            </div>
          )}
        </DndContainer>
      )}

      <div className='flex justify-center mt-4'>
        <Button onClick={() => setOpenModal('create')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          {t('pages.account.home.tabs.groupedServers.page.button.createGroup', {})}
        </Button>
      </div>
    </AccountContentContainer>
  );
}
