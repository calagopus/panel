import { faServer } from '@fortawesome/free-solid-svg-icons';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { useStartOnGroupedServers } from '@/plugins/useStartOnGroupedServers.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DashboardHomeTitle() {
  const { t } = useTranslations();
  const [startOnGroupedServers] = useStartOnGroupedServers();

  return (
    <>
      <SubNavigation
        baseUrl='/'
        items={
          startOnGroupedServers
            ? [
                {
                  name: t('pages.account.home.tabs.groupedServers.title', {}),
                  icon: faServer,
                  link: '/',
                },
                {
                  name: t('pages.account.home.tabs.allServers.title', {}),
                  icon: faServer,
                  link: '/all',
                },
              ]
            : [
                {
                  name: t('pages.account.home.tabs.allServers.title', {}),
                  icon: faServer,
                  link: '/',
                },
                {
                  name: t('pages.account.home.tabs.groupedServers.title', {}),
                  icon: faServer,
                  link: '/grouped',
                },
              ]
        }
      />
    </>
  );
}
