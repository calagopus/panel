import { ReactNode } from 'react';
import { makeComponentHookable } from 'shared';
import Copyright from '@/elements/Copyright.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import Alert from './Alert.tsx';

interface LayoutProps {
  children: ReactNode;
  isNormal: boolean;
}

function Container({ children, isNormal }: LayoutProps) {
  const { t } = useTranslations();
  const { impersonating } = useAuth();

  return (
    <div
      className={
        isNormal
          ? 'flex flex-col justify-between min-w-full h-full'
          : 'flex flex-col justify-between h-full overflow-auto p-4'
      }
    >
      <div>
        {impersonating && (
          <Alert color='yellow' className='mt-2 mx-2'>
            {t('elements.container.alert.impersonating', {})}
          </Alert>
        )}

        {children}
      </div>
      <div className='my-2 ml-auto mr-12'>
        <Copyright className='justify-end' />
      </div>
    </div>
  );
}

export default makeComponentHookable(Container);
