import { faGraduationCap, faServer } from '@fortawesome/free-solid-svg-icons';
import { Suspense, useMemo } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import AppIcon from '@/elements/AppIcon.tsx';
import Container from '@/elements/Container.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import ServerSwitcher from '@/elements/ServerSwitcher.tsx';
import Sidebar from '@/elements/Sidebar.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { isAdmin } from '@/lib/permissions.ts';
import { to } from '@/lib/routes.ts';
import DashboardHomeAll from '@/pages/dashboard/home/DashboardHomeAll.tsx';
import DashboardHomeGrouped from '@/pages/dashboard/home/DashboardHomeGrouped.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import accountRoutes from '@/routers/routes/accountRoutes.ts';

export default function DashboardRouter({ isNormal }: { isNormal: boolean }) {
  const { t } = useTranslations();
  const { user } = useAuth();

  const allAccountRoutes = useMemo(() => {
    const routes = [...accountRoutes, ...window.extensionContext.extensionRegistry.routes.accountRoutes];

    for (const interceptor of window.extensionContext.extensionRegistry.routes.accountRouteInterceptors) {
      interceptor(routes);
    }

    return routes;
  }, []);

  return (
    <div className='lg:flex h-full'>
      {isNormal && (
        <Sidebar
          header={
            <>
              <NavLink to='/' className='w-full'>
                <AppIcon />
              </NavLink>
              <Sidebar.Divider />
              <Sidebar.Link to='/' end icon={faServer} name={t('pages.account.home.title', {})} />
              {isAdmin(user) && (
                <Sidebar.Link to='/admin' end icon={faGraduationCap} name={t('pages.account.admin.title', {})} />
              )}
              <Sidebar.Divider />
            </>
          }
        >
          {allAccountRoutes
            .filter((route) => !!route.name && (!route.filter || route.filter()))
            .map((route) => (
              <Sidebar.Link
                key={route.path}
                to={to(route.path, '/account')}
                end={route.exact}
                icon={route.icon}
                name={typeof route.name === 'function' ? route.name() : route.name}
                activeMatches={route.activeMatches}
              />
            ))}

          <div className='mt-auto pt-4'>
            <ServerSwitcher className='mb-2' />
            <Sidebar.Footer />
          </div>
        </Sidebar>
      )}

      <div
        id='dashboard-root'
        className={isNormal ? 'max-w-[100vw] flex-1 lg:ml-0' : 'flex-1 lg:ml-0 overflow-auto h-full'}
      >
        <Container isNormal={isNormal}>
          {window.extensionContext.extensionRegistry.pages.dashboard.prependedComponents.map((Component, i) => (
            <Component key={`dashboard-prepended-component-${i}`} />
          ))}

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
              {allAccountRoutes
                .filter((route) => !route.filter || route.filter())
                .map(({ path, element: Element }) => (
                  <Route key={path} path={`/account/${path}`.replace('//', '/')} element={<Element />} />
                ))}
              <Route
                path='*'
                element={
                  <AccountContentContainer title={t('elements.screenBlock.notFound.title', {})}>
                    <ScreenBlock
                      title={t('elements.screenBlock.notFound.title', {})}
                      content={t('elements.screenBlock.notFound.content', {})}
                    />
                  </AccountContentContainer>
                }
              />
            </Routes>
          </Suspense>

          {window.extensionContext.extensionRegistry.pages.dashboard.appendedComponents.map((Component, i) => (
            <Component key={`dashboard-appended-component-${i}`} />
          ))}
        </Container>
      </div>
    </div>
  );
}
