import { ReactNode } from 'react';
import AppIcon from '@/elements/AppIcon.tsx';
import Copyright from '@/elements/Copyright.tsx';
import ContentContainer from '@/elements/containers/ContentContainer.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function AuthWrapper({ title, children }: { title?: string; children: ReactNode }) {
  const { settings } = useGlobalStore();

  return (
    <ContentContainer title={settings.app.name}>
      <div className='flex items-center justify-center h-screen'>
        <div className='flex flex-col items-center justify-center h-full px-2 md:px-0 max-w-100 w-full'>
          <AppIcon className='mb-5 w-full sm:w-fit' />
          {title && <h1 className='text-3xl font-bold text-white mb-4'>{title}</h1>}
          {children}
          <Copyright className='mt-4 text-sm' />
        </div>
      </div>
    </ContentContainer>
  );
}
