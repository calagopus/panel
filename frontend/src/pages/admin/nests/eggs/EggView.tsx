import { faCodeCommit, faCog, faComputer, faFolderTree, faTerminal } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import { z } from 'zod';
import getEgg from '@/api/admin/nests/eggs/getEgg.ts';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import Title from '@/elements/Title.tsx';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import EggCreateOrUpdate from '@/pages/admin/nests/eggs/EggCreateOrUpdate.tsx';
import AdminEggMounts from '@/pages/admin/nests/eggs/mounts/AdminEggMounts.tsx';
import AdminEggVariables from '@/pages/admin/nests/eggs/variables/AdminEggVariables.tsx';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggInstallationScriptContainer from './installationScript/EggInstallationScriptContainer.tsx';
import AdminEggServers from './servers/AdminEggServers.tsx';

export default function EggView({ contextNest }: { contextNest: z.infer<typeof adminNestSchema> }) {
  const params = useParams<'eggId'>();
  const { t } = useTranslations();

  const { data: egg, loading: isLoading } = useResource({
    queryKey: ['admin', 'eggs', { uuid: params.eggId }],
    queryFn: () => getEgg(contextNest.uuid, params.eggId!),
  });

  return !contextNest || isLoading || !egg ? (
    <Spinner.Centered />
  ) : (
    <>
      <Title order={2}>{egg.name}</Title>

      <SubNavigation
        baseUrl={`/admin/nests/${contextNest.uuid}/eggs/${params.eggId}`}
        items={[
          {
            name: t('common.tabs.general', {}),
            icon: faCog,
            path: '/',
            element: <EggCreateOrUpdate contextNest={contextNest} contextEgg={egg} />,
          },
          {
            name: t('pages.admin.nests.tabs.eggs.page.tabs.installationScript.title', {}),
            icon: faTerminal,
            path: '/installation-script',
            element: <EggInstallationScriptContainer contextNest={contextNest} contextEgg={egg} />,
          },
          {
            name: t('pages.admin.nests.tabs.eggs.page.tabs.variables.title', {}),
            icon: faCodeCommit,
            path: `/variables`,
            element: <AdminEggVariables contextNest={contextNest} contextEgg={egg} />,
          },
          {
            name: t('pages.admin.nests.tabs.eggs.page.tabs.mounts.title', {}),
            icon: faFolderTree,
            path: `/mounts`,
            element: <AdminEggMounts contextNest={contextNest} contextEgg={egg} />,
            permission: 'eggs.mounts',
          },
          {
            name: t('pages.admin.nests.tabs.eggs.page.tabs.servers.title', {}),
            icon: faComputer,
            path: `/servers`,
            element: <AdminEggServers contextNest={contextNest} contextEgg={egg} />,
            permission: 'servers.read',
          },
        ]}
      />
    </>
  );
}
