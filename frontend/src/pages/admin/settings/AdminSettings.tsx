import {
  faAt,
  faBan,
  faDatabase,
  faEnvelopesBulk,
  faLayerGroup,
  faRobot,
  faServer,
  faToolbox,
  faUserCheck,
} from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';
import getSettings from '@/api/admin/settings/getSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import EmailTemplatesContainer from '@/pages/admin/settings/EmailTemplatesContainer.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import ActivityContainer from './ActivityContainer.tsx';
import ApplicationContainer from './ApplicationContainer.tsx';
import CaptchaContainer from './CaptchaContainer.tsx';
import EmailContainer from './EmailContainer.tsx';
import RatelimitsContainer from './RatelimitsContainer.tsx';
import ServerContainer from './ServerContainer.tsx';
import StorageContainer from './StorageContainer.tsx';
import WebauthnContainer from './WebauthnContainer.tsx';

export default function AdminSettings() {
  const { addToast } = useToast();
  const { setSettings } = useAdminStore();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  }, []);

  return loading ? (
    <Spinner.Centered />
  ) : (
    <AdminContentContainer title='Settings'>
      <SubNavigation
        baseUrl='/admin/settings'
        items={[
          {
            name: 'Application',
            icon: faLayerGroup,
            path: '/',
            element: <ApplicationContainer />,
          },
          {
            name: 'Storage',
            icon: faDatabase,
            path: '/storage',
            element: <StorageContainer />,
          },
          {
            name: 'Mail',
            icon: faAt,
            path: '/mail',
            element: <EmailContainer />,
          },
          {
            name: 'Mail Templates',
            icon: faEnvelopesBulk,
            path: '/mail-templates',
            element: <EmailTemplatesContainer />,
          },
          {
            name: 'Captcha',
            icon: faRobot,
            path: '/captcha',
            element: <CaptchaContainer />,
          },
          {
            name: 'Webauthn',
            icon: faUserCheck,
            path: '/webauthn',
            element: <WebauthnContainer />,
          },
          {
            name: 'Server',
            icon: faServer,
            path: '/server',
            element: <ServerContainer />,
          },
          {
            name: 'Activity',
            icon: faToolbox,
            path: '/activity',
            element: <ActivityContainer />,
          },
          {
            name: 'Ratelimits',
            icon: faBan,
            path: '/ratelimits',
            element: <RatelimitsContainer />,
          },
        ]}
      />
    </AdminContentContainer>
  );
}
