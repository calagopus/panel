import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '@/elements/buttons/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { useServerManagementActions } from '@/pages/admin/servers/management/serverManagementActions.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function AdminServerManagement({ server }: { server: AdminServer }) {
  const { t } = useTranslations();
  const doOpenModal = useAdminStore((state) => state.doOpenServerModal);
  const actions = useServerManagementActions(server);

  return (
    <AdminSubContentContainer
      title={t('pages.admin.servers.tabs.management.page.title', {})}
      hideTitleComponent
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.management.subContainer}
      registryProps={{ server }}
    >
      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2'>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.admin.servers.view.management.managementContainers
              .prependedComponents
          }
          name='management-managementContainer-prepended'
          props={{ server }}
        />

        {actions.map((action) => (
          <TitleCard
            key={action.id}
            title={action.cardTitle}
            icon={<FontAwesomeIcon icon={action.icon} />}
            className={action.orderClass}
          >
            <Stack h='100%'>
              {action.cardContent}
              <Group mt='auto'>
                <Button color={action.color} onClick={() => doOpenModal(action.modal)}>
                  {action.cardButtonLabel}
                </Button>
              </Group>
            </Stack>
          </TitleCard>
        ))}

        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.admin.servers.view.management.managementContainers
              .appendedComponents
          }
          name='management-managementContainer-appended'
          props={{ server }}
        />
      </div>
    </AdminSubContentContainer>
  );
}
