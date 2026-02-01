import { faArrowUpRightFromSquare, faCancel, faGraduationCap, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Suspense, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useParams } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import getServer from '@/api/server/getServer.ts';
import cancelServerInstall from '@/api/server/settings/cancelServerInstall.ts';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import Container from '@/elements/Container.tsx';
import Notification from '@/elements/Notification.tsx';
import Progress from '@/elements/Progress.tsx';
import ServerStatusIndicator from '@/elements/ServerStatusIndicator.tsx';
import ServerSwitcher from '@/elements/ServerSwitcher.tsx';
import Sidebar from '@/elements/Sidebar.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { isAdmin } from '@/lib/permissions.ts';
import { to } from '@/lib/routes.ts';
import NotFound from '@/pages/NotFound.tsx';
import WebsocketHandler from '@/pages/server/WebsocketHandler.tsx';
import WebsocketListener from '@/pages/server/WebsocketListener.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ServerPermissionGuard from '@/routers/guards/ServerPermissionGuard.tsx';
import serverRoutes from '@/routers/routes/serverRoutes.ts';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

export default function ServerRouter({ isNormal }: { isNormal: boolean }) {
  const { t } = useTranslations();
  const { settings } = useGlobalStore();
  const { addToast } = useToast();
  const { user } = useAuth();

  const params = useParams<'id'>();
  const [loading, setLoading] = useState(true);
  const [abortLoading, setAbortLoading] = useState(false);

  const { server, updateServer, backupRestoreProgress } = useServerStore();
  const resetState = useServerStore((state) => state.reset);
  const setServer = useServerStore((state) => state.setServer);

  useEffect(() => {
    return () => {
      resetState();
    };
  }, []);

  useEffect(() => {
    if (!server?.status && abortLoading) {
      addToast(t('pages.server.console.toast.installCancelled', {}), 'success');
      setAbortLoading(false);
    }
  }, [abortLoading, server?.status]);

  useEffect(() => {
    if (params.id) {
      getServer(params.id)
        .then((data) => setServer(data))
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  const doAbortInstall = () => {
    setAbortLoading(true);

    cancelServerInstall(server.uuid)
      .then((instantCancel) => {
        if (instantCancel) {
          updateServer({ status: null });
        }
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'));
  };

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

          <div className='flex flex-col gap-2 mt-2 mb-1'>
            <ServerSwitcher />
            <ServerStatusIndicator />
          </div>

          <Sidebar.Divider />

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

          {[...serverRoutes, ...window.extensionContext.extensionRegistry.routes.serverRoutes]
            .filter((route) => !!route.name && (!route.filter || route.filter()))
            .map((route) =>
              route.permission ? (
                <ServerCan key={route.path} action={route.permission} matchAny>
                  <Sidebar.Link
                    to={to(route.path, `/server/${params.id}`)}
                    end={route.exact}
                    icon={route.icon}
                    name={typeof route.name === 'function' ? route.name() : route.name}
                  />
                </ServerCan>
              ) : (
                <Sidebar.Link
                  key={route.path}
                  to={to(route.path, `/server/${params.id}`)}
                  end={route.exact}
                  icon={route.icon}
                  name={typeof route.name === 'function' ? route.name() : route.name}
                />
              ),
            )}

          <Sidebar.Footer />
        </Sidebar>
      )}

      <div id='server-root' className={isNormal ? 'max-w-[100vw] flex-1 lg:ml-0' : 'flex-1 lg:ml-0 overflow-auto'}>
        <Container isNormal={isNormal}>
          {loading ? (
            <Spinner.Centered />
          ) : server ? (
            <>
              <WebsocketHandler />
              <WebsocketListener />
              {window.extensionContext.extensionRegistry.pages.server.prependedComponents.map((Component, i) => (
                <Component key={`server-prepended-component-${i}`} />
              ))}
              {server.status === 'restoring_backup' ? (
                <Notification loading>
                  {t('pages.server.console.notification.restoringBackup', {})}
                  <Progress value={backupRestoreProgress} />
                </Notification>
              ) : server.status === 'installing' ? (
                <Notification loading>
                  {t('pages.server.console.notification.installing', {})}
                  <ServerCan action='settings.cancel-install'>
                    <Button
                      className='ml-2'
                      leftSection={<FontAwesomeIcon icon={faCancel} />}
                      variant='subtle'
                      loading={abortLoading}
                      onClick={doAbortInstall}
                    >
                      {t('common.button.cancel', {})}
                    </Button>
                  </ServerCan>
                </Notification>
              ) : null}

              <Suspense fallback={<Spinner.Centered />}>
                <Routes>
                  {[...serverRoutes, ...window.extensionContext.extensionRegistry.routes.serverRoutes]
                    .filter((route) => !route.filter || route.filter())
                    .map(({ path, element: Element, permission }) => (
                      <Route key={path} element={<ServerPermissionGuard permission={permission ?? []} />}>
                        <Route path={path} element={<Element />} />
                      </Route>
                    ))}
                  <Route path='*' element={<NotFound />} />
                </Routes>
              </Suspense>

              {window.extensionContext.extensionRegistry.pages.server.appendedComponents.map((Component, i) => (
                <Component key={`server-appended-component-${i}`} />
              ))}
            </>
          ) : (
            <NotFound />
          )}
        </Container>
      </div>
    </div>
  );
}
