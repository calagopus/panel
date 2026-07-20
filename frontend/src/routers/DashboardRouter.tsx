import { faArrowUpRightFromSquare, faGraduationCap, faServer } from '@fortawesome/free-solid-svg-icons';
import { Suspense, useMemo } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import AppIcon from '@/elements/AppIcon.tsx';
import Container from '@/elements/Container.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import ServerSwitcher from '@/elements/ServerSwitcher.tsx';
import Sidebar from '@/elements/Sidebar.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { resolveString } from '@/lib/lazy.ts';
import { isAdmin } from '@/lib/permissions.ts';
import { getAccessibleRoutePaths, to } from '@/lib/routes.ts';
import DashboardHomeAll from '@/pages/dashboard/home/DashboardHomeAll.tsx';
import DashboardHomeGrouped from '@/pages/dashboard/home/DashboardHomeGrouped.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import accountRoutes from '@/routers/routes/accountRoutes.ts';
import { useGlobalStore } from '@/stores/global.ts';

export default function DashboardRouter({ isNormal }: { isNormal: boolean }) {
  const { t, language } = useTranslations();
  const { user } = useAuth();
  const routeOrder = useGlobalStore((state) => state.settings.user?.routeOrder);

  const allAccountRoutes = useMemo(() => {
    const routes = [...accountRoutes, ...window.extensionContext.extensionRegistry.routes.accountRoutes];

    for (const interceptor of window.extensionContext.extensionRegistry.routes.accountRouteInterceptors) {
      interceptor(routes);
    }

    return routes;
  }, []);

  const sidebarItems = useMemo(() => {
    if (!routeOrder) {
      return allAccountRoutes
        .filter((route) => !!route.name && (!route.filter || route.filter()))
        .map((route) => ({ type: 'route' as const, route }));
    }

    return routeOrder
      .map((item) => {
        if (item.type === 'route') {
          const route = allAccountRoutes.find((r) => r.path === item.path);
          if (!route || !route.name || (route.filter && !route.filter())) return null;
          return { type: 'route' as const, route };
        }

        if (item.type === 'divider') {
          const label = (language !== 'en' && item.nameTranslations[language]) || item.name || undefined;
          return { type: 'divider' as const, label };
        }

        if (item.type === 'redirect') {
          const name = (language !== 'en' && item.nameTranslations[language]) || item.name;
          return { type: 'redirect' as const, name, destination: item.destination };
        }

        return null;
      })
      .filter(Boolean);
  }, [routeOrder, allAccountRoutes, language]);

  const accessibleRoutePaths = useMemo(
    () => getAccessibleRoutePaths(allAccountRoutes, routeOrder),
    [allAccountRoutes, routeOrder],
  );

  return (
    <div className='lg:flex h-full'>
      {isNormal && (
        <Sidebar
          header={
            <>
              <NavLink to='/' className='w-full'>
                <AppIcon />
              </NavLink>
              {!user?.suspended && (
                <>
                  <Sidebar.Divider />
                  <Sidebar.Link
                    to='/'
                    end
                    icon={faServer}
                    name={t('pages.account.home.title', {})}
                    activeMatches={['/grouped']}
                  />
                  {isAdmin(user) && (
                    <Sidebar.Link to='/admin' end icon={faGraduationCap} name={t('pages.account.admin.title', {})} />
                  )}
                  <Sidebar.Divider />
                </>
              )}
            </>
          }
          footer={
            <>
              {!user?.suspended && <ServerSwitcher className='mb-2' />}
              <Sidebar.Footer />
            </>
          }
        >
          {!user?.suspended &&
            sidebarItems.map((item, index) => {
              if (!item) return null;

              if (item.type === 'divider') {
                return <Sidebar.Divider key={`divider-${index}`} label={item.label} />;
              }

              if (item.type === 'redirect') {
                return (
                  <Sidebar.Link
                    key={`redirect-${index}`}
                    to={item.destination}
                    icon={faArrowUpRightFromSquare}
                    name={item.name}
                  />
                );
              }

              const { route } = item;

              return (
                <Sidebar.Link
                  key={route.path}
                  to={to(route.path, '/account')}
                  end={route.exact}
                  icon={route.icon}
                  name={resolveString(route.name)}
                  activeMatches={route.activeMatches}
                />
              );
            })}
        </Sidebar>
      )}

      <div
        id='dashboard-root'
        className={isNormal ? 'max-w-[100vw] flex-1 lg:ml-0' : 'flex-1 lg:ml-0 overflow-auto h-full'}
      >
        <Container isNormal={isNormal}>
          {user?.suspended ? (
            <ScreenBlock
              title={t('elements.screenBlock.suspended.title', {})}
              content={t('elements.screenBlock.suspended.content', {})}
            />
          ) : (
            <>
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
                    .filter((route) => !accessibleRoutePaths || accessibleRoutePaths.has(route.path))
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
            </>
          )}
        </Container>
      </div>
    </div>
  );
}
