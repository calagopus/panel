import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import attachTeamServer from '@/api/admin/teams/servers/attachTeamServer.ts';
import getAvailableTeamServers from '@/api/admin/teams/servers/getAvailableTeamServers.ts';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function TeamServerAttachModal({
  team,
  ...props
}: ModalProps & { team: z.infer<typeof adminTeamSchema> }) {
  const { t } = useTranslations();

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.admin.teams.tabs.servers.page.modal.attach.title', {})}
      label={t('common.form.server', {})}
      addedToast={t('pages.admin.teams.tabs.servers.page.toast.attached', {})}
      invalidateKeys={[queryKeys.admin.teams.all()]}
      onConfirm={(serverUuid) => attachTeamServer(team.uuid, serverUuid)}
      renderSelect={({ value, onChange }) => (
        <ServerSelect<z.infer<typeof adminServerSchema>>
          withAsterisk
          label={t('common.form.server', {})}
          description={t('pages.admin.teams.tabs.servers.page.modal.attach.form.serverDescription', {})}
          placeholder={t('common.form.server', {})}
          queryKey={queryKeys.admin.teams.availableServers(team.uuid)}
          paginatedFetcher={(page, search) => getAvailableTeamServers(team.uuid, page, search)}
          value={value}
          onChange={(uuid) => onChange(uuid)}
        />
      )}
    />
  );
}
