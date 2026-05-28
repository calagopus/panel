import { faCog, faHeartPulse, faRefresh } from '@fortawesome/free-solid-svg-icons';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminOverviewHealth from './health/AdminOverviewHealth.tsx';
import AdminOverview from './overview/AdminOverview.tsx';
import AdminOverviewUpdates from './updates/AdminOverviewUpdates.tsx';

export default function AdminHome() {
  const { t } = useTranslations();

  return (
    <AdminContentContainer title={t('pages.account.admin.title', {})}>
      <SubNavigation
        baseUrl='/admin'
        items={[
          {
            name: t('pages.admin.home.tabs.overview.title', {}),
            icon: faCog,
            path: `/`,
            element: <AdminOverview />,
          },
          {
            name: t('pages.admin.home.tabs.updates.title', {}),
            icon: faRefresh,
            path: `/updates`,
            element: <AdminOverviewUpdates />,
            permission: 'stats.read',
          },
          {
            name: t('pages.admin.home.tabs.health.title', {}),
            icon: faHeartPulse,
            path: `/health`,
            element: <AdminOverviewHealth />,
            permission: 'stats.read',
          },
        ]}
      />
    </AdminContentContainer>
  );
}
