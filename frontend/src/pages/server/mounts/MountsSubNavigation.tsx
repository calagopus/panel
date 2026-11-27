import { faFolderTree, faMicrochip } from '@fortawesome/free-solid-svg-icons';
import { ReactNode } from 'react';
import SubNavigation from '@/elements/navigation/SubNavigation.tsx';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function MountsSubNavigation({ children }: { children?: ReactNode }) {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const canReadMounts = useServerCan('mounts.read');
  const canReadDevices = useServerCan('devices.read');

  return (
    <SubNavigation
      baseUrl={`/server/${server.uuidShort}/mounts`}
      registry={window.extensionContext.extensionRegistry.pages.server.mounts.subNavigation}
      registryProps={{}}
      hideWhenSingle
      items={[
        {
          name: t('pages.server.mounts.title', {}),
          icon: faFolderTree,
          link: `/server/${server.uuidShort}/mounts`,
          hidden: !canReadMounts,
        },
        {
          name: t('pages.server.devices.title', {}),
          icon: faMicrochip,
          link: `/server/${server.uuidShort}/mounts/devices`,
          hidden: !canReadDevices,
        },
      ]}
    >
      {children}
    </SubNavigation>
  );
}
