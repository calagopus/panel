import { faNetworkWired, faShareNodes, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import SubNavigation from '@/elements/navigation/SubNavigation.tsx';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function NetworkSubNavigation() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const canReadAllocations = useServerCan('allocations.read');
  const canReadFirewall = useServerCan('firewall.read');
  const canReadTunnel = useServerCan('connections.read');

  return (
    <SubNavigation
      baseUrl={`/server/${server.uuidShort}/network`}
      registry={window.extensionContext.extensionRegistry.pages.server.network.subNavigation}
      registryProps={{}}
      hideWhenSingle
      items={[
        {
          name: t('pages.server.network.allocations.title', {}),
          icon: faNetworkWired,
          link: `/server/${server.uuidShort}/network`,
          hidden: !canReadAllocations,
        },
        {
          name: t('pages.server.firewall.title', {}),
          icon: faShieldHalved,
          link: `/server/${server.uuidShort}/network/firewall`,
          hidden: !canReadFirewall,
        },
        {
          name: t('pages.server.tunnel.title', {}),
          icon: faShareNodes,
          link: `/server/${server.uuidShort}/network/connections`,
          hidden: !canReadTunnel,
        },
      ]}
    />
  );
}
