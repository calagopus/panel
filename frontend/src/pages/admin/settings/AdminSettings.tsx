import {
  faAt,
  faBan,
  faDatabase,
  faEnvelopesBulk,
  faLayerGroup,
  faRobot,
  faServer,
  faToolbox,
  faUser,
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
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import ActivityContainer from './ActivityContainer.tsx';
import ApplicationContainer from './ApplicationContainer.tsx';
import CaptchaContainer from './CaptchaContainer.tsx';
import EmailContainer from './EmailContainer.tsx';
import RatelimitsContainer from './RatelimitsContainer.tsx';
import ServerContainer from './ServerContainer.tsx';
import StorageContainer from './StorageContainer.tsx';
import UserContainer from './UserContainer.tsx';
import WebauthnContainer from './WebauthnContainer.tsx';

export default function AdminSettings() {
  const { addToast } = useToast();
  const { t } = useTranslations();
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
    <AdminContentContainer title={t('pages.admin.settings.title', {})}>
      <SubNavigation
        baseUrl='/admin/settings'
        items={[
          {
            name: t('pages.admin.settings.tabs.application.title', {}),
            icon: faLayerGroup,
            path: '/',
            element: <ApplicationContainer />,
          },
          {
            name: t('pages.admin.settings.tabs.storage.title', {}),
            icon: faDatabase,
            path: '/storage',
            element: <StorageContainer />,
          },
          {
            name: t('pages.admin.settings.tabs.mail.title', {}),
            icon: faAt,
            path: '/mail',
            element: <EmailContainer />,
          },
          {
            name: t('pages.admin.settings.tabs.mailTemplates.title', {}),
            icon: faEnvelopesBulk,
            path: '/mail-templates',
            element: <EmailTemplatesContainer />,
          },
          {
            name: t('pages.admin.settings.tabs.captcha.title', {}),
            icon: faRobot,
            path: '/captcha',
            element: <CaptchaContainer />,
          },
          {
            name: t('pages.admin.settings.tabs.webauthn.title', {}),
            icon: faUserCheck,
            path: '/webauthn',
            element: <WebauthnContainer />,
          },
          {
            name: t('pages.admin.settings.tabs.server.title', {}),
            icon: faServer,
            path: '/server',
            element: <ServerContainer />,
          },
          {
            name: t('pages.admin.settings.tabs.user.title', {}),
            icon: faUser,
            path: '/user',
            element: <UserContainer />,
          },
          {
            name: t('pages.admin.settings.tabs.activity.title', {}),
            icon: faToolbox,
            path: '/activity',
            element: <ActivityContainer />,
          },
          {
            name: t('pages.admin.settings.tabs.ratelimits.title', {}),
            icon: faBan,
            path: '/ratelimits',
            element: <RatelimitsContainer />,
          },
        ]}
      />
    </AdminContentContainer>
  );
}
