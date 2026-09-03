import { faBoxArchive, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import getSystemBackups from '@/api/server/backups/getSystemBackups.ts';
import SubNavigation from '@/elements/navigation/SubNavigation.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function BackupsSubNavigation() {
  const { t } = useTranslations();
  const location = useLocation();
  const server = useServerStore((state) => state.server);

  const systemLink = `/server/${server.uuidShort}/backups/system`;

  const { data: systemBackups } = useQuery({
    queryKey: queryKeys.server(server.uuid).backups.system(),
    queryFn: () => getSystemBackups(server.uuid, 1),
  });

  return (
    <SubNavigation
      baseUrl={`/server/${server.uuidShort}/backups`}
      registry={window.extensionContext.extensionRegistry.pages.server.backups.subNavigation}
      registryProps={{}}
      hideWhenSingle
      items={[
        {
          name: t('pages.server.backups.title', {}),
          icon: faBoxArchive,
          link: `/server/${server.uuidShort}/backups`,
        },
        {
          name: t('pages.server.systemBackups.title', {}),
          icon: faClockRotateLeft,
          link: systemLink,
          hidden: !location.pathname.endsWith(systemLink) && (systemBackups?.total ?? 0) === 0,
        },
      ]}
    />
  );
}
