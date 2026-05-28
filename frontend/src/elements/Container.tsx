import { faUserCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactNode } from 'react';
import { makeComponentHookable } from 'shared';
import Copyright from '@/elements/Copyright.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import Alert from './Alert.tsx';
import DismissibleAnnouncementAlert from './DismissibleAnnouncementAlert.tsx';

interface LayoutProps {
  children: ReactNode;
  isNormal: boolean;
}

function Container({ children, isNormal }: LayoutProps) {
  const { t } = useTranslations();
  const { impersonating } = useAuth();
  const { id } = useCurrentWindow();
  const { announcements } = useGlobalStore();

  return (
    <div
      className={
        isNormal
          ? 'flex flex-col justify-between min-w-full h-full'
          : 'flex flex-col justify-between h-full overflow-auto'
      }
    >
      <div>
        {impersonating && (
          <Alert icon={<FontAwesomeIcon icon={faUserCheck} />} color='yellow' className='mt-2 mx-6'>
            {t('elements.container.alert.impersonating', {})}
          </Alert>
        )}
        {!id &&
          announcements.map((announcement) => (
            <DismissibleAnnouncementAlert key={announcement.uuid} announcement={announcement} />
          ))}

        {children}
      </div>
      <div className='my-2 ml-auto mr-12'>
        <Copyright className='justify-end' />
      </div>
    </div>
  );
}

export default makeComponentHookable(Container);
