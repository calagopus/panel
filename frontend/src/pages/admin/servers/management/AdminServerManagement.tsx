import { faPause, faPlay, faReply, faSatellite, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { z } from 'zod';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import Stack from '@/elements/Stack.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function AdminServerManagement({ server }: { server: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const canTransfer = useAdminCan(['servers.transfer', 'nodes.read'], false);
  const doOpenModal = useAdminStore((state) => state.doOpenServerModal);

  return (
    <AdminSubContentContainer
      title={t('pages.admin.servers.tabs.management.page.title', {})}
      hideTitleComponent
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.management.subContainer}
      registryProps={{ server }}
    >
      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2'>
        {window.extensionContext.extensionRegistry.pages.admin.servers.view.management.managementContainers.prependedComponents.map(
          (Component, i) => (
            <Component key={`management-managementContainer-prepended-${i}`} server={server} />
          ),
        )}

        {canTransfer && (
          <TitleCard
            title={t('pages.admin.servers.tabs.management.page.transfer.title', {})}
            icon={<FontAwesomeIcon icon={faReply} />}
            className='order-10'
          >
            <Stack h='100%'>
              {t('pages.admin.servers.tabs.management.page.transfer.content', {})}
              <Group mt='auto'>
                <Button onClick={() => doOpenModal('transfer')}>{t('common.button.transfer', {})}</Button>
              </Group>
            </Stack>
          </TitleCard>
        )}
        <AdminCan action='servers.update'>
          <TitleCard
            title={
              server.isSuspended
                ? t('pages.admin.servers.tabs.management.page.unsuspend.title', {})
                : t('pages.admin.servers.tabs.management.page.suspend.title', {})
            }
            icon={<FontAwesomeIcon icon={server.isSuspended ? faPlay : faPause} />}
            className='order-20'
          >
            <Stack h='100%'>
              {server.isSuspended ? (
                <>
                  {t('pages.admin.servers.tabs.management.page.unsuspend.content', {})}
                  <Group mt='auto'>
                    <Button onClick={() => doOpenModal('unsuspend')} color='green'>
                      {t('pages.admin.servers.tabs.management.page.unsuspend.button', {})}
                    </Button>
                  </Group>
                </>
              ) : (
                <>
                  {t('pages.admin.servers.tabs.management.page.suspend.content', {})}
                  <Group mt='auto'>
                    <Button onClick={() => doOpenModal('suspend')} color='red'>
                      {t('pages.admin.servers.tabs.management.page.suspend.button', {})}
                    </Button>
                  </Group>
                </>
              )}
            </Stack>
          </TitleCard>
        </AdminCan>
        <AdminCan action='servers.update'>
          <TitleCard
            title={t('pages.admin.servers.tabs.management.page.clearState.title', {})}
            icon={<FontAwesomeIcon icon={faSatellite} />}
            className='order-30'
          >
            <Stack h='100%'>
              {t('pages.admin.servers.tabs.management.page.clearState.content', {})}
              <Group mt='auto'>
                <Button onClick={() => doOpenModal('clear-state')} color='red'>
                  {t('pages.admin.servers.tabs.management.page.clearState.button', {})}
                </Button>
              </Group>
            </Stack>
          </TitleCard>
        </AdminCan>
        <AdminCan action='servers.delete'>
          <TitleCard
            title={t('pages.admin.servers.tabs.management.page.delete.title', {})}
            icon={<FontAwesomeIcon icon={faTrash} />}
            className='order-40'
          >
            <Stack h='100%'>
              {t('pages.admin.servers.tabs.management.page.delete.content', {})}
              <Group mt='auto'>
                <Button onClick={() => doOpenModal('delete')} color='red'>
                  {t('common.button.delete', {})}
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
