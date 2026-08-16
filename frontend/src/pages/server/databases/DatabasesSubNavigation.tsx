import { faDatabase, faServer } from '@fortawesome/free-solid-svg-icons';
import { useLocation } from 'react-router';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { useDatabaseRelevance } from './useDatabaseRelevance.ts';

export default function DatabasesSubNavigation() {
  const { t } = useTranslations();
  const location = useLocation();
  const server = useServerStore((state) => state.server);

  const { classicRelevant, agentRelevant } = useDatabaseRelevance();

  const instancesLink = `/server/${server.uuidShort}/databases/instances`;

  return (
    <SubNavigation
      baseUrl={`/server/${server.uuidShort}/databases`}
      registry={window.extensionContext.extensionRegistry.pages.server.databases.subNavigation}
      registryProps={{}}
      hideWhenSingle
      items={[
        {
          name: t('pages.server.databases.title', {}),
          icon: faDatabase,
          link: `/server/${server.uuidShort}/databases`,
          hidden: !classicRelevant,
        },
        {
          name: t('pages.server.databases.instance.title', {}),
          icon: faServer,
          link: instancesLink,
          hidden: !location.pathname.endsWith(instancesLink) && !agentRelevant,
        },
      ]}
    />
  );
}
