import { faBriefcase, faCog, faIdBadge, faServer, faUsers } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getTeam from '@/api/me/teams/getTeam.ts';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import SubNavigation from '@/elements/navigation/SubNavigation.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import { canManageTeam, canManageTeamMembers } from '@/lib/domain/teams.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import TeamActivity from './activity/TeamActivity.tsx';
import TeamGeneral from './general/TeamGeneral.tsx';
import TeamMembers from './members/TeamMembers.tsx';
import TeamPresets from './presets/TeamPresets.tsx';
import TeamServers from './servers/TeamServers.tsx';

export default function DashboardTeamView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const resource = useResource({
    queryKey: queryKeys.user.teams.detail(params.id!),
    queryFn: () => getTeam(params.id!),
  });

  return (
    <ResourceView resource={resource}>
      {(team) => (
        <AccountContentContainer
          title={team.name}
          subtitle={team.description ?? undefined}
          registry={window.extensionContext.extensionRegistry.pages.dashboard.teams.container}
        >
          <SubNavigation
            baseUrl={`/account/teams/${params.id}`}
            registry={window.extensionContext.extensionRegistry.pages.dashboard.teams.view.subNavigation}
            registryProps={{ team }}
            items={[
              {
                name: t('pages.account.teams.tabs.servers.title', {}),
                icon: faServer,
                path: `/`,
                element: <TeamServers team={team} />,
              },
              {
                name: t('pages.account.teams.tabs.members.title', {}),
                icon: faUsers,
                path: `/members`,
                element: <TeamMembers team={team} />,
                hidden: !canManageTeamMembers(team),
              },
              {
                name: t('pages.account.teams.tabs.presets.title', {}),
                icon: faIdBadge,
                path: `/presets`,
                element: <TeamPresets team={team} />,
                hidden: !canManageTeam(team),
              },
              {
                name: t('common.tabs.general', {}),
                icon: faCog,
                path: `/general`,
                element: <TeamGeneral team={team} />,
              },
              {
                name: t('pages.account.teams.tabs.activity.title', {}),
                icon: faBriefcase,
                path: `/activity`,
                element: <TeamActivity team={team} />,
                hidden: !canManageTeam(team),
              },
            ]}
          />
        </AccountContentContainer>
      )}
    </ResourceView>
  );
}
