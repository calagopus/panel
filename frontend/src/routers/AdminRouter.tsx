import { faReply } from '@fortawesome/free-solid-svg-icons';
import { Suspense, useEffect, useMemo } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import getUpdates from '@/api/admin/system/updates/getUpdates.ts';
import AppIcon from '@/elements/AppIcon.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Container from '@/elements/Container.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import Sidebar from '@/elements/Sidebar.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { to } from '@/lib/routes.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import adminRoutes from '@/routers/routes/adminRoutes.ts';
import { useAdminStore } from '@/stores/admin.tsx';

export default function AdminRouter({ isNormal }: { isNormal: boolean }) {
  const { t } = useTranslations();
  const { setUpdateInformation } = useAdminStore();

  useEffect(() => {
    getUpdates().then(setUpdateInformation).catch(console.error);
  }, []);

  const allAdminRoutes = useMemo(() => {
    const routes = [...adminRoutes, ...window.extensionContext.extensionRegistry.routes.adminRoutes];

    for (const interceptor of window.extensionContext.extensionRegistry.routes.adminRouteInterceptors) {
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
              <Sidebar.Link to='/' end icon={faReply} name='Back' />
              <Sidebar.Divider />
            </>
          }
        >
          {allAdminRoutes
            .filter((route) => !!route.name && (!route.filter || route.filter()))
            .map((route) =>
              route.permission ? (
                <AdminCan key={route.path} action={route.permission} matchAny>
                  <Sidebar.Link
                    key={route.path}
                    to={to(route.path, '/admin')}
                    end={route.exact}
                    icon={route.icon}
                    name={typeof route.name === 'function' ? route.name() : route.name}
                    activeMatches={route.activeMatches}
                  />
                </AdminCan>
              ) : (
                <Sidebar.Link
                  key={route.path}
                  to={to(route.path, '/admin')}
                  end={route.exact}
                  icon={route.icon}
                  name={typeof route.name === 'function' ? route.name() : route.name}
                  activeMatches={route.activeMatches}
                />
              ),
            )}

          <Sidebar.Footer />
        </Sidebar>
      )}

      <div
        id='admin-root'
        className={isNormal ? 'max-w-[100vw] flex-1 lg:ml-0' : 'flex-1 lg:ml-0 overflow-auto h-full'}
      >
        <Container isNormal={isNormal}>
          {window.extensionContext.extensionRegistry.pages.admin.prependedComponents.map((Component, i) => (
            <Component key={`admin-prepended-component-${i}`} />
          ))}

          <Suspense fallback={<Spinner.Centered />}>
            <Routes>
              {allAdminRoutes
                .filter((route) => !route.filter || route.filter())
                .map(({ path, element: Element, permission }) => (
                  <Route key={path} element={<AdminPermissionGuard permission={permission ?? []} />}>
                    <Route path={path} element={<Element />} />
                  </Route>
                ))}
              <Route
                path='*'
                element={
                  <AdminContentContainer title={t('elements.screenBlock.notFound.title', {})} hideTitleComponent>
                    <ScreenBlock
                      title={t('elements.screenBlock.notFound.title', {})}
                      content={t('elements.screenBlock.notFound.content', {})}
                    />
                  </AdminContentContainer>
                }
              />
            </Routes>
          </Suspense>

          {window.extensionContext.extensionRegistry.pages.admin.appendedComponents.map((Component, i) => (
            <Component key={`admin-appended-component-${i}`} />
          ))}
        </Container>
      </div>
    </div>
  );
}
