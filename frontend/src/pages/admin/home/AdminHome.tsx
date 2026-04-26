import { faCog, faHeartPulse, faRefresh } from '@fortawesome/free-solid-svg-icons';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import AdminOverviewHealth from './health/AdminOverviewHealth.tsx';
import AdminOverview from './overview/AdminOverview.tsx';
import AdminOverviewUpdates from './updates/AdminOverviewUpdates.tsx';

export default function AdminHome() {
  return (
    <AdminContentContainer title='Admin'>
      <SubNavigation
        baseUrl='/admin'
        items={[
          {
            name: 'Overview',
            icon: faCog,
            path: `/`,
            element: <AdminOverview />,
          },
          {
            name: 'Updates',
            icon: faRefresh,
            path: `/updates`,
            element: <AdminOverviewUpdates />,
            permission: 'stats.read',
          },
          {
            name: 'Health',
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
