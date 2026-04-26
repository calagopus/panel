import { faServer } from '@fortawesome/free-solid-svg-icons';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DashboardHomeTitle() {
  const { t } = useTranslations();
  const { user } = useAuth();

  return (
    <>
      <SubNavigation
        baseUrl='/'
        items={
          user?.startOnGroupedServers
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
