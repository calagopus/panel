import { faArrowUpRightFromSquare, faGraduationCap, faServer } from '@fortawesome/free-solid-svg-icons';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useParams } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import getEggCommandSnippets from '@/api/me/servers/eggs/getEggCommandSnippets.ts';
import getServer from '@/api/server/getServer.ts';
import AppIcon from '@/elements/AppIcon.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import Container from '@/elements/Container.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import ServerStatusIndicator from '@/elements/ServerStatusIndicator.tsx';
import ServerSwitcher from '@/elements/ServerSwitcher.tsx';
import Sidebar from '@/elements/Sidebar.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { isAdmin } from '@/lib/permissions.ts';
import { to } from '@/lib/routes.ts';
import WebsocketHandler from '@/pages/server/WebsocketHandler.tsx';
import WebsocketListener from '@/pages/server/WebsocketListener.tsx';
import WebsocketStatusBanner from '@/pages/server/WebsocketStatusBanner.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ServerPermissionGuard from '@/routers/guards/ServerPermissionGuard.tsx';
import serverRoutes from '@/routers/routes/serverRoutes.ts';
import { useServerStore } from '@/stores/server.ts';
import ServerStateGuard from './guards/ServerStateGuard.tsx';

export default function ServerRouter({ isNormal }: { isNormal: boolean }) {
  const { t, language } = useTranslations();
  const { user } = useAuth();
  const { addToast } = useToast();

  const params = useParams<'id'>();
  const [loading, setLoading] = useState(true);

  const { server, setSocketInstance } = useServerStore();
  const resetState = useServerStore((state) => state.reset);
  const setServer = useServerStore((state) => state.setServer);
  const setCommandSnippets = useServerStore((state) => state.setCommandSnippets);

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
          return { type: 'redirect' as const, name, destination: item.destination };
        }

        return null;
      })
      .filter(Boolean);
  }, [server.eggConfiguration?.routeOrder, allServerRoutes, language]);

  useEffect(() => {
    return () => {
      resetState();
    };
  }, []);

  useEffect(() => {
    if (params.id) {
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

  return (
    <div className='lg:flex h-full'>
      {isNormal && (
        <Sidebar
          header={
            <>
              <NavLink to='/' className='w-full'>
                <AppIcon />
              </NavLink>
              <div className='flex flex-col gap-2 mt-2 mb-1'>
                <ServerStatusIndicator />
              </div>
              <Sidebar.Divider />
            </>
          }
        >
          <Sidebar.Link to='/' end icon={faServer} name={t('pages.account.home.title', {})} />
          {isAdmin(user) && (
            <>
              <Sidebar.Link to='/admin' end icon={faGraduationCap} name={t('pages.account.admin.title', {})} />
              <Sidebar.Link
                to={`/admin/servers/${params.id}`}
                end
                icon={faArrowUpRightFromSquare}
                name={t('pages.server.viewAdmin.title', {})}
              />
            </>
          )}

          <Sidebar.Divider />

          {sidebarItems.map((item, index) => {
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
              const name = typeof route.name === 'function' ? route.name() : route.name!;

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
          })}

          <div className='mt-auto pt-4'>
            <ServerSwitcher isServer className='mb-2' />
            <Sidebar.Footer />
          </div>
        </Sidebar>
      )}

      <div
        id='server-root'
        className={isNormal ? 'max-w-[100vw] flex-1 lg:ml-0' : 'flex-1 lg:ml-0 overflow-auto h-full'}
      >
        <Container isNormal={isNormal}>
          {loading ? (
            <Spinner.Centered />
          ) : server.uuid ? (
            <>
              <WebsocketHandler />
              <WebsocketListener />
              {window.extensionContext.extensionRegistry.pages.server.prependedComponents.map((Component, i) => (
                <Component key={`server-prepended-component-${i}`} />
              ))}

              <WebsocketStatusBanner />

              <Suspense fallback={<Spinner.Centered />}>
                <Routes>
                  <Route element={<ServerStateGuard />}>
                    {allServerRoutes
                      .filter((route) => !route.filter || route.filter())
                      .map(({ path, element: Element, permission }) => (
                        <Route key={path} element={<ServerPermissionGuard permission={permission ?? []} />}>
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

              {window.extensionContext.extensionRegistry.pages.server.appendedComponents.map((Component, i) => (
                <Component key={`server-appended-component-${i}`} />
              ))}
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
