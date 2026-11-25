import { faBriefcase, faCog, faIdBadge, faServer, faUsers } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getTeam from '@/api/admin/teams/getTeam.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SubNavigation from '@/elements/navigation/SubNavigation.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import AdminTeamActivity from '@/pages/admin/teams/activity/AdminTeamActivity.tsx';
import AdminTeamMembers from '@/pages/admin/teams/members/AdminTeamMembers.tsx';
import AdminTeamPresets from '@/pages/admin/teams/presets/AdminTeamPresets.tsx';
import AdminTeamServers from '@/pages/admin/teams/servers/AdminTeamServers.tsx';
import TeamCreateOrUpdate from '@/pages/admin/teams/TeamCreateOrUpdate.tsx';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function TeamView() {
  const { t } = useTranslations();
  const { id } = useParams<'id'>();

  const resource = useResource({
    queryKey: queryKeys.admin.teams.detail(id!),
    queryFn: () => getTeam(id!),
  });

  return (
    <ResourceView resource={resource}>
      {(team) => (
        <AdminContentContainer
          title={team.name}
          registry={window.extensionContext.extensionRegistry.pages.admin.teams.container}
        >
          <SubNavigation
            baseUrl={`/admin/teams/${id}`}
            registry={window.extensionContext.extensionRegistry.pages.admin.teams.view.subNavigation}
            registryProps={{ team }}
            items={[
              {
                name: t('common.tabs.general', {}),
                icon: faCog,
                path: `/`,
                element: <TeamCreateOrUpdate contextTeam={team} />,
              },
              {
                name: t('pages.admin.teams.tabs.presets.title', {}),
                icon: faIdBadge,
                path: `/presets`,
                element: <AdminTeamPresets team={team} />,
              },
              {
                name: t('pages.admin.teams.tabs.members.title', {}),
                icon: faUsers,
                path: `/members`,
                element: <AdminTeamMembers team={team} />,
                permission: 'users.read',
              },
              {
                name: t('pages.admin.teams.tabs.servers.title', {}),
                icon: faServer,
                path: `/servers`,
                element: <AdminTeamServers team={team} />,
                permission: 'servers.read',
              },
              {
                name: t('pages.admin.teams.tabs.activity.title', {}),
                icon: faBriefcase,
                path: `/activity`,
                element: <AdminTeamActivity team={team} />,
                permission: 'teams.activity',
              },
            ]}
          />
        </AdminContentContainer>
      )}
    </ResourceView>
  );
}
