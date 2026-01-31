import { faGraduationCap, faServer } from '@fortawesome/free-solid-svg-icons';
import { Suspense } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import Container from '@/elements/Container.tsx';
import Sidebar from '@/elements/Sidebar.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { isAdmin } from '@/lib/permissions.ts';
import { to } from '@/lib/routes.ts';
import DashboardHomeAll from '@/pages/dashboard/home/DashboardHomeAll.tsx';
import DashboardHomeGrouped from '@/pages/dashboard/home/DashboardHomeGrouped.tsx';
import NotFound from '@/pages/NotFound.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import accountRoutes from '@/routers/routes/accountRoutes.ts';
import { useGlobalStore } from '@/stores/global.ts';

export default function DashboardRouter({ isNormal }: { isNormal: boolean }) {
  const { t } = useTranslations();
  const { user } = useAuth();
  const { settings } = useGlobalStore();

  return (
    <div className='lg:flex h-full'>
      {isNormal && (
        <Sidebar>
          <NavLink to='/' className='w-full'>
            <div className='h-16 w-full flex flex-row items-center justify-between mt-1 select-none cursor-pointer'>
              <img src='/icon.svg' className='h-12 w-12' alt='Calagopus Icon' />
              <h1 className='grow text-md font-bold! ml-2'>{settings.app.name}</h1>
            </div>
          </NavLink>

          <Sidebar.Divider />

          <Sidebar.Link to='/' end icon={faServer} name={t('pages.account.home.title', {})} />
          {isAdmin(user) && (
            <Sidebar.Link to='/admin' end icon={faGraduationCap} name={t('pages.account.admin.title', {})} />
          )}

          <Sidebar.Divider />

          {[...accountRoutes, ...window.extensionContext.extensionRegistry.routes.accountRoutes]
            .filter((route) => !!route.name && (!route.filter || route.filter()))
            .map((route) => (
              <Sidebar.Link
                key={route.path}
                to={to(route.path, '/account')}
                end={route.exact}
                icon={route.icon}
                name={typeof route.name === 'function' ? route.name() : route.name}
              />
            ))}

          <Sidebar.Footer />
        </Sidebar>
      )}

      <div id='dashboard-root' className={isNormal ? 'max-w-[100vw] flex-1 lg:ml-0' : 'flex-1 lg:ml-0 overflow-auto'}>
        <Container isNormal={isNormal}>
          <Suspense fallback={<Spinner.Centered />}>
            <Routes>
              {user?.startOnGroupedServers ? (
                <>
                  <Route path='' element={<DashboardHomeGrouped />} />
                  <Route path='/all' element={<DashboardHomeAll />} />
                </>
              ) : (
                <>
                  <Route path='' element={<DashboardHomeAll />} />
                  <Route path='/grouped' element={<DashboardHomeGrouped />} />
                </>
              )}
              {[...accountRoutes, ...window.extensionContext.extensionRegistry.routes.accountRoutes]
                .filter((route) => !route.filter || route.filter())
                .map(({ path, element: Element }) => (
                  <Route key={path} path={`/account/${path}`.replace('//', '/')} element={<Element />} />
                ))}
              <Route path='*' element={<NotFound />} />
            </Routes>
          </Suspense>
        </Container>
      </div>
    </div>
  );
}
