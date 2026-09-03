import { faArrowUpRightFromSquare, faGraduationCap, faServer } from '@fortawesome/free-solid-svg-icons';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useParams } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import getEggCommandSnippets from '@/api/me/servers/eggs/getEggCommandSnippets.ts';
import getServerAnnouncements from '@/api/server/announcements/getAnnouncements.ts';
import getServer from '@/api/server/getServer.ts';
import AppIcon from '@/elements/AppIcon.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import ScreenBlock from '@/elements/feedback/ScreenBlock.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Container from '@/elements/layout/Container.tsx';
import ServerSwitcher from '@/elements/navigation/ServerSwitcher.tsx';
import Sidebar from '@/elements/navigation/Sidebar.tsx';
import QuickActionsTrigger from '@/elements/quickActions/QuickActionsTrigger.tsx';
import ServerQuickActions from '@/elements/quickActions/ServerQuickActions.tsx';
import ServerStatusIndicator from '@/elements/ServerStatusIndicator.tsx';
import { isAdmin } from '@/lib/auth/permissions.ts';
import { isConflictingState } from '@/lib/domain/server.ts';
import { resolveString } from '@/lib/lazy.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { getAccessibleRoutePaths, to } from '@/lib/routes.ts';
import ServerStatusPoller from '@/pages/server/ServerStatusPoller.tsx';
import WebsocketHandler from '@/pages/server/WebsocketHandler.tsx';
import WebsocketListener from '@/pages/server/WebsocketListener.tsx';
import WebsocketStatusBanner from '@/pages/server/WebsocketStatusBanner.tsx';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ServerPermissionGuard from '@/routers/guards/ServerPermissionGuard.tsx';
import serverRoutes from '@/routers/routes/serverRoutes.ts';
import { useServerStore } from '@/stores/server.ts';
import ServerStateGuard from './guards/ServerStateGuard.tsx';
import ServerSelectorModal from './ServerSelectorModal.tsx';

export default function ServerRouter({ isNormal }: { isNormal: boolean }) {
  const { t, language } = useTranslations();
  const { user } = useAuth();
  const { addToast } = useToast();

  const params = useParams<'id'>();
  const [loading, setLoading] = useState(true);

  const { server, setSocketInstance, resetState, setServer, setCommandSnippets, setServerAnnouncements } =
    useServerStore(
      useShallow((state) => ({
        server: state.server,
        setSocketInstance: state.setSocketInstance,
        resetState: state.reset,
        setServer: state.setServer,
        setCommandSnippets: state.setCommandSnippets,
        setServerAnnouncements: state.setServerAnnouncements,
      })),
    );

  const { data: announcements } = useResource({
    queryKey: queryKeys.server(server.uuid).announcements.all(),
    queryFn: () => getServerAnnouncements(server.uuid),
    enabled: !!server.uuid && !isConflictingState(server, user),
  });

  useEffect(() => {
    if (announcements) setServerAnnouncements(announcements);
  }, [announcements]);

  const allServerRoutes = useMemo(() => {
    const routes = [...serverRoutes, ...window.extensionContext.extensionRegistry.routes.serverRoutes];

    for (const interceptor of window.extensionContext.extensionRegistry.routes.serverRouteInterceptors) {
      interceptor(routes);
    }

    return routes;
  }, []);

  const sidebarItems = useMemo(() => {
    const routeOrder = server.eggConfiguration?.routeOrder;

    if (!routeOrder) {
      return allServerRoutes
        .filter((route) => !!route.name && (!route.filter || route.filter()))
        .map((route) => ({
          type: 'route' as const,
          route,
        }));
    }

    return routeOrder
      .map((item) => {
        if (item.type === 'route') {
          const route = allServerRoutes.find((r) => r.path === item.path);
          if (!route || !route.name || (route.filter && !route.filter())) return null;
          return { type: 'route' as const, route };
        }

        if (item.type === 'divider') {
          const label = (language !== 'en' && item.nameTranslations[language]) || item.name || undefined;
          return { type: 'divider' as const, label };
        }

        if (item.type === 'redirect') {
          const name = (language !== 'en' && item.nameTranslations[language]) || item.name;
          return {
            type: 'redirect' as const,
            name,
            destination: item.destination,
          };
        }

        return null;
      })
      .filter(Boolean);
  }, [server.eggConfiguration?.routeOrder, allServerRoutes, language]);

  const accessibleRoutePaths = useMemo(
    () => getAccessibleRoutePaths(allServerRoutes, server.eggConfiguration?.routeOrder),
    [allServerRoutes, server.eggConfiguration?.routeOrder],
  );

  useEffect(() => {
    return () => {
      resetState();
    };
  }, []);

  useEffect(() => {
    if (params.id && params.id !== ':id') {
      setLoading(true);
      getServer(params.id)
        .then((data) => {
          setSocketInstance(null);
          setServer(data);

          getEggCommandSnippets(data.egg.uuid)
            .then((snippets) => {
              setCommandSnippets(snippets);
            })
            .catch((error) => {
              addToast(httpErrorToHuman(error), 'error');
            });
        })
        .catch((error) => {
          addToast(httpErrorToHuman(error), 'error');
        })
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  if (params.id === ':id') {
    return <ServerSelectorModal />;
  }

  return (
    <div className='lg:flex h-full'>
      <ServerQuickActions />
      {isNormal && (
        <Sidebar
          header={
            <>
              <NavLink to='/' className='w-full'>
                <AppIcon />
              </NavLink>
              {!user?.suspended && (
                <>
                  <QuickActionsTrigger />
                  <div className='mt-2' />
                  <ServerStatusIndicator />
                </>
              )}
            </>
          }
          footer={
            <>
              {!user?.suspended && <ServerSwitcher isServer className='mb-2' />}
              <Sidebar.Footer />
            </>
          }
        >
          {!user?.suspended && (
            <>
              <div className='mt-2' />
              <Sidebar.Link to='/' end icon={faServer} name={t('pages.account.home.title', {})} />
              {isAdmin(user) && (
                <Sidebar.Link to='/admin' end icon={faGraduationCap} name={t('pages.account.admin.title', {})} />
              )}
              {isAdmin(user, 'servers.read') && (
                <Sidebar.Link
                  to={`/admin/servers/${params.id}`}
                  end
                  icon={faArrowUpRightFromSquare}
                  name={t('pages.server.viewAdmin.title', {})}
                />
              )}

              <Sidebar.Divider />

              {loading ? (
                <Spinner.Centered />
              ) : (
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

                  if (item.type === 'route') {
                    const { route } = item;
                    const name = resolveString(route.name)!;

                    return route.permission ? (
                      <ServerCan key={route.path} action={route.permission} matchAny>
                        <Sidebar.Link
                          to={to(route.path, `/server/${params.id}`)}
                          end={route.exact}
                          icon={route.icon}
                          name={name}
                          activeMatches={route.activeMatches}
                        />
                      </ServerCan>
                    ) : (
                      <Sidebar.Link
                        key={route.path}
                        to={to(route.path, `/server/${params.id}`)}
                        end={route.exact}
                        icon={route.icon}
                        name={name}
                        activeMatches={route.activeMatches}
                      />
                    );
                  }

                  return null;
                })
              )}
            </>
          )}
        </Sidebar>
      )}

      <div
        id='server-root'
        className={
          isNormal
            ? 'max-w-[100vw] min-w-0 flex-1 lg:ml-0'
            : 'flex-1 lg:ml-0 overflow-auto h-full scrollbar-gutter-stable'
        }
      >
        <Container isNormal={isNormal}>
          {user?.suspended ? (
            <ScreenBlock
              title={t('elements.screenBlock.suspended.title', {})}
              content={t('elements.screenBlock.suspended.content', {})}
            />
          ) : loading ? (
            <Spinner.Centered />
          ) : server.uuid ? (
            <>
              <WebsocketHandler />
              <WebsocketListener />
              <ServerStatusPoller />
              <ExtensionSlot
                components={window.extensionContext.extensionRegistry.pages.server.prependedComponents}
                name='server-prepended-component'
              />

              <WebsocketStatusBanner />

              <Suspense fallback={<Spinner.Centered />}>
                <Routes>
                  <Route element={<ServerStateGuard />}>
                    {allServerRoutes
                      .filter((route) => !route.filter || route.filter())
                      .filter((route) => !accessibleRoutePaths || accessibleRoutePaths.has(route.path))
                      .map(({ path, element: Element, permission }) => (
                        <Route
                          key={path}
                          element={<ServerPermissionGuard permission={permission ?? []} matchAny={!!permission} />}
                        >
                          <Route path={path} element={<Element />} />
                        </Route>
                      ))}
                  </Route>
                  <Route
                    path='*'
                    element={
                      <ServerContentContainer title={t('elements.screenBlock.notFound.title', {})} hideTitleComponent>
                        <ScreenBlock
                          title={t('elements.screenBlock.notFound.title', {})}
                          content={t('elements.screenBlock.notFound.content', {})}
                        />
                      </ServerContentContainer>
                    }
                  />
                </Routes>
              </Suspense>

              <ExtensionSlot
                components={window.extensionContext.extensionRegistry.pages.server.appendedComponents}
                name='server-appended-component'
              />
            </>
          ) : (
            <ServerContentContainer title={t('elements.screenBlock.notFound.title', {})} hideTitleComponent>
              <ScreenBlock
                title={t('elements.screenBlock.notFound.title', {})}
                content={t('elements.screenBlock.notFound.content', {})}
              />
            </ServerContentContainer>
          )}
        </Container>
      </div>
    </div>
  );
}
