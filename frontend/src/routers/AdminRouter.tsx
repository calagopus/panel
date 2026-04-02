import { faReply } from '@fortawesome/free-solid-svg-icons';
import { Suspense, useEffect, useMemo } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import getLatest from '@/api/admin/system/getLatest.ts';
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
import { useGlobalStore } from '@/stores/global.ts';

export default function AdminRouter({ isNormal }: { isNormal: boolean }) {
  const { t } = useTranslations();
  const { settings } = useGlobalStore();
  const { setLatestVersions } = useAdminStore();

  useEffect(() => {
    getLatest().then(setLatestVersions);
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
        <Sidebar>
          <NavLink to='/' className='w-full'>
            <div className='h-16 w-full flex flex-row items-center justify-between mt-1 select-none cursor-pointer'>
              <img src={settings.app.icon} className='h-12 w-12' alt='Calagopus Icon' />
              <h1 className='grow text-md font-bold! ml-2'>{settings.app.name}</h1>
            </div>
          </NavLink>

          <Sidebar.Divider />

          <Sidebar.Link to='/' end icon={faReply} name='Back' />

          <Sidebar.Divider />

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
                  />
                </AdminCan>
              ) : (
                <Sidebar.Link
                  key={route.path}
                  to={to(route.path, '/admin')}
                  end={route.exact}
                  icon={route.icon}
                  name={typeof route.name === 'function' ? route.name() : route.name}
                />
              ),
            )}

          <Sidebar.Footer />
        </Sidebar>
      )}

      <div id='admin-root' className={isNormal ? 'max-w-[100vw] flex-1 lg:ml-0' : 'flex-1 lg:ml-0 overflow-auto'}>
        <Container isNormal={isNormal}>
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
        </Container>
      </div>
    </div>
  );
}
