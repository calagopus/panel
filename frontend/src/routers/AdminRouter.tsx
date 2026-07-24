import { faReply } from '@fortawesome/free-solid-svg-icons';
import { Fragment, Suspense, useEffect, useMemo } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import type { AdminRouteDefinition } from 'shared';
import getUpdates from '@/api/admin/system/updates/getUpdates.ts';
import AppIcon from '@/elements/AppIcon.tsx';
import Container from '@/elements/Container.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import Sidebar from '@/elements/Sidebar.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { resolveString } from '@/lib/lazy.ts';
import { to } from '@/lib/routes.ts';
import { checkPermissions } from '@/plugins/usePermissions.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import adminRoutes, { adminSidebarCategoryOrder } from '@/routers/routes/adminRoutes.ts';
import { useAdminStore } from '@/stores/admin.tsx';

export default function AdminRouter({ isNormal }: { isNormal: boolean }) {
  const { t } = useTranslations();
  const { user } = useAuth();
  const setUpdateInformation = useAdminStore((state) => state.setUpdateInformation);

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

  const sidebarGroups = useMemo(() => {
    const isVisible = (route: AdminRouteDefinition) => {
      if (!route.name || (route.filter && !route.filter())) return false;
      if (!route.permission) return true;
      if (user?.admin) return true;

      return checkPermissions(user?.role?.adminPermissions ?? [], route.permission).some(Boolean);
    };

    const visible = allAdminRoutes.filter(isVisible);
    const baseUncategorized = new Set(adminRoutes.filter((route) => !route.category).map((route) => route.path));
    const knownCategories = new Set(adminSidebarCategoryOrder.map((category) => category.key));

    const top = visible.filter((route) => !route.category && baseUncategorized.has(route.path));

    const categories = adminSidebarCategoryOrder
      .map((category) => ({
        key: category.key,
        label: category.label,
        routes: visible.filter((route) => route.category === category.key),
      }))
      .filter((group) => group.routes.length > 0);

    const other = visible.filter(
      (route) =>
        (!route.category && !baseUncategorized.has(route.path)) ||
        (!!route.category && !knownCategories.has(route.category)),
    );

    return { top, categories, other };
  }, [allAdminRoutes, user]);

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
                  <Sidebar.Link to='/' end icon={faReply} name={t('common.button.back', {})} />
                  <Sidebar.Divider />
                </>
              )}
            </>
          }
          footer={<Sidebar.Footer />}
        >
          {!user?.suspended && (
            <>
              {sidebarGroups.top.map((route) => (
                <Sidebar.Link
                  key={route.path}
                  to={to(route.path, '/admin')}
                  end={route.exact}
                  icon={route.icon}
                  name={resolveString(route.name)}
                  activeMatches={route.activeMatches}
                />
              ))}

              {sidebarGroups.categories.map((group) => (
                <Fragment key={group.key}>
                  <Sidebar.Divider label={resolveString(group.label)} />
                  {group.routes.map((route) => (
                    <Sidebar.Link
                      key={route.path}
                      to={to(route.path, '/admin')}
                      end={route.exact}
                      icon={route.icon}
                      name={resolveString(route.name)}
                      activeMatches={route.activeMatches}
                    />
                  ))}
                </Fragment>
              ))}

              {sidebarGroups.other.length > 0 && (
                <>
                  <Sidebar.Divider />
                  {sidebarGroups.other.map((route) => (
                    <Sidebar.Link
                      key={route.path}
                      to={to(route.path, '/admin')}
                      end={route.exact}
                      icon={route.icon}
                      name={resolveString(route.name)}
                      activeMatches={route.activeMatches}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </Sidebar>
      )}

      <div
        id='admin-root'
        className={isNormal ? 'max-w-[100vw] min-w-0 flex-1 lg:ml-0' : 'flex-1 lg:ml-0 overflow-auto h-full'}
      >
        <Container isNormal={isNormal}>
          {user?.suspended ? (
            <ScreenBlock
              title={t('elements.screenBlock.suspended.title', {})}
              content={t('elements.screenBlock.suspended.content', {})}
            />
          ) : (
            <>
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
            </>
          )}
        </Container>
      </div>
    </div>
  );
}
