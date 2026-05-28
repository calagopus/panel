import { faPause, faPlay, faReply, faSatellite, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import ServerDeleteModal from '@/pages/admin/servers/management/modals/ServerDeleteModal.tsx';
import ServerSuspendModal from '@/pages/admin/servers/management/modals/ServerSuspendModal.tsx';
import ServerTransferModal from '@/pages/admin/servers/management/modals/ServerTransferModal.tsx';
import ServerUnsuspendModal from '@/pages/admin/servers/management/modals/ServerUnsuspendModal.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import ServerClearStateModal from './modals/ServerClearStateModal.tsx';

export default function AdminServerManagement({ server }: { server: z.infer<typeof adminServerSchema> }) {
  const canTransfer = useAdminCan(['server.transfer', 'nodes.read'], false);

  const [openModal, setOpenModal] = useState<'transfer' | 'suspend' | 'unsuspend' | 'clear-state' | 'delete' | null>(
    null,
  );

  return (
    <AdminSubContentContainer
      title='Server Management'
      hideTitleComponent
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.management.subContainer}
      registryProps={{ server }}
    >
      {canTransfer && (
        <ServerTransferModal server={server} opened={openModal === 'transfer'} onClose={() => setOpenModal(null)} />
      )}
      <ServerSuspendModal server={server} opened={openModal === 'suspend'} onClose={() => setOpenModal(null)} />
      <ServerUnsuspendModal server={server} opened={openModal === 'unsuspend'} onClose={() => setOpenModal(null)} />
      <ServerClearStateModal server={server} opened={openModal === 'clear-state'} onClose={() => setOpenModal(null)} />
      <ServerDeleteModal server={server} opened={openModal === 'delete'} onClose={() => setOpenModal(null)} />

      <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
        {window.extensionContext.extensionRegistry.pages.admin.servers.view.management.managementContainers.prependedComponents.map(
          (Component, i) => (
            <Component key={`management-managementContainer-prepended-${i}`} server={server} />
          ),
        )}

        {canTransfer && (
          <TitleCard title='Transfer' icon={<FontAwesomeIcon icon={faReply} />} className='order-10'>
            <Stack h='100%'>
              Transfer this server and it's data to another node within this system.
              <Group mt='auto'>
                <Button onClick={() => setOpenModal('transfer')}>Transfer</Button>
              </Group>
            </Stack>
          </TitleCard>
        )}
        <AdminCan action='servers.update'>
          <TitleCard
            title={server.isSuspended ? 'Unsuspend' : 'Suspend'}
            icon={<FontAwesomeIcon icon={server.isSuspended ? faPlay : faPause} />}
            className='order-20'
          >
            <Stack h='100%'>
              {server.isSuspended ? (
                <>
                  This will unsuspend the server, allowing it to start again. The user will be able to access their
                  files and otherwise manage the server through the panel or API.
                  <Group mt='auto'>
                    <Button onClick={() => setOpenModal('unsuspend')} color='green'>
                      Unsuspend
                    </Button>
                  </Group>
                </>
              ) : (
                <>
                  This will suspend the server, stop any running processes, and immediately block the user from being
                  able to access their files or otherwise manage the server through the panel or API.
                  <Group mt='auto'>
                    <Button onClick={() => setOpenModal('suspend')} color='red'>
                      Suspend
                    </Button>
                  </Group>
                </>
              )}
            </Stack>
          </TitleCard>
        </AdminCan>
        <AdminCan action='servers.update'>
          <TitleCard title='Clear State' icon={<FontAwesomeIcon icon={faSatellite} />} className='order-30'>
            <Stack h='100%'>
              This will clear the server state known by the panel.
              <Group mt='auto'>
                <Button onClick={() => setOpenModal('clear-state')} color='red'>
                  Clear State
                </Button>
              </Group>
            </Stack>
          </TitleCard>
        </AdminCan>
        <AdminCan action='servers.delete'>
          <TitleCard title='Delete' icon={<FontAwesomeIcon icon={faTrash} />} className='order-40'>
            <Stack h='100%'>
              This will delete the server and all of its data. This action cannot be undone.
              <Group mt='auto'>
                <Button onClick={() => setOpenModal('delete')} color='red'>
                  Delete
                </Button>
              </Group>
            </Stack>
          </TitleCard>
        </AdminCan>

        {window.extensionContext.extensionRegistry.pages.admin.servers.view.management.managementContainers.appendedComponents.map(
          (Component, i) => (
            <Component key={`management-managementContainer-appended-${i}`} server={server} />
          ),
        )}
      </div>
    </AdminSubContentContainer>
  );
}
