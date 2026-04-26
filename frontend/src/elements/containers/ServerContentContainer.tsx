import { faCancel } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Title, TitleOrder } from '@mantine/core';
import { Dispatch, ReactNode, SetStateAction, useEffect, useMemo, useState } from 'react';
import { ContainerRegistry, makeComponentHookable } from 'shared';
import cancelTransfer from '@/api/admin/servers/cancelTransfer.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import cancelServerInstall from '@/api/server/settings/cancelServerInstall.ts';
import TextInput from '@/elements/input/TextInput.tsx';
import { bytesToString } from '@/lib/size.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import Button from '../Button.tsx';
import { AdminCan, ServerCan } from '../Can.tsx';
import Notification from '../Notification.tsx';
import Progress from '../Progress.tsx';
import Tooltip from '../Tooltip.tsx';
import EstimatedTimeArrival from '../time/EstimatedTimeArrival.tsx';
import ContentContainer from './ContentContainer.tsx';

export interface Props {
  title: string;
  subtitle?: string;
  hideTitleComponent?: boolean;
  titleOrder?: TitleOrder;
  search?: string;
  setSearch?: Dispatch<SetStateAction<string>>;
  contentRight?: ReactNode;
  registry?: ContainerRegistry<Props>;
  children: ReactNode;
  fullscreen?: boolean;
}

function ServerContentContainer(props: Props) {
  props = useMemo(() => {
    let modifiedProps = props;

    if (props.registry) {
      for (const interceptor of props.registry.propsInterceptors) {
        modifiedProps = interceptor(modifiedProps);
      }
    }

    return modifiedProps;
  }, [props]);

  const {
    title,
    subtitle,
    hideTitleComponent = false,
    titleOrder = 1,
    search,
    setSearch,
    contentRight,
    registry,
    children,
    fullscreen = false,
  } = props;

  const { t } = useTranslations();
  const {
    server,
    updateServer,
    backupRestoreProgress,
    transferProgressArchive,
    backupRestoreTotal,
    transferProgressTotal,
  } = useServerStore();
  const { user } = useAuth();
  const { id } = useCurrentWindow();
  const { addToast } = useToast();

  const [abortLoading, setAbortLoading] = useState<'install' | 'transfer' | null>(null);

  useEffect(() => {
    if (!server?.status && abortLoading === 'install') {
      addToast(t('pages.server.console.toast.installCancelled', {}), 'success');
      setAbortLoading(null);
    }
  }, [abortLoading, server?.status]);

  const doAbortInstall = () => {
    setAbortLoading('install');

    cancelServerInstall(server.uuid)
      .then((instantCancel) => {
        if (instantCancel) {
          updateServer({ status: null });
        }
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
        setAbortLoading(null);
      });
  };

  const doAbortTransfer = () => {
    setAbortLoading('transfer');

    cancelTransfer(server.uuid)
      .then(() => {
        addToast(t('pages.server.console.toast.transferCancelled', {}), 'success');
        setAbortLoading(null);
        updateServer({ isTransferring: false });
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
        setAbortLoading(null);
      });
  };

  return (
    <ContentContainer title={`${title} | ${server.name}`}>
      {fullscreen ? null : server.isTransferring ? (
        <div className='mt-2 px-4 lg:px-6 mb-4'>
          <Notification loading>
            <div className='flex flex-row items-center'>
              <div className='flex flex-col w-full'>
                <span className='flex flex-row items-center'>
                  {t('pages.server.console.notification.transferring', {})}
                  <EstimatedTimeArrival
                    className='ml-1'
                    progress={transferProgressArchive}
                    total={transferProgressTotal}
                  />
                </span>

                <Tooltip
                  label={`${bytesToString(transferProgressArchive)} / ${bytesToString(transferProgressTotal)}`}
                  innerClassName='w-full'
                >
                  <Progress
                    value={transferProgressArchive > 0 ? (transferProgressArchive / transferProgressTotal) * 100 : 0}
                  />
                </Tooltip>
              </div>

              <AdminCan action='servers.transfer'>
                <Button
                  className='ml-4 min-w-fit'
                  leftSection={<FontAwesomeIcon icon={faCancel} />}
                  variant='subtle'
                  loading={abortLoading === 'transfer'}
                  onClick={doAbortTransfer}
                >
                  {t('common.button.cancel', {})}
                </Button>
              </AdminCan>
            </div>
          </Notification>
        </div>
      ) : server.isSuspended ? (
        <div className='mt-2 px-4 lg:px-6 mb-4'>
          <Notification color='red'>
            {user?.admin
              ? t('pages.server.console.notification.suspendedAdmin', {})
              : t('pages.server.console.notification.suspended', {})}
          </Notification>
        </div>
      ) : server.status === 'restoring_backup' ? (
        <div className='mt-2 px-4 lg:px-6 mb-4'>
          <Notification loading>
            <span className='flex flex-row items-center'>
              {t('pages.server.console.notification.restoringBackup', {})}
              <EstimatedTimeArrival className='ml-1' progress={backupRestoreProgress} total={backupRestoreTotal} />
            </span>

            <Tooltip
              label={`${bytesToString(backupRestoreProgress)} / ${bytesToString(backupRestoreTotal)}`}
              innerClassName='w-full'
            >
              <Progress value={backupRestoreTotal > 0 ? (backupRestoreProgress / backupRestoreTotal) * 100 : 0} />
            </Tooltip>
          </Notification>
        </div>
      ) : server.status === 'installing' ? (
        <div className='mt-2 px-4 lg:px-6 mb-4'>
          <Notification loading>
            <div className='flex flex-row items-center justify-between'>
              {t('pages.server.console.notification.installing', {})}
              <ServerCan action='settings.cancel-install'>
                <Button
                  className='ml-4 min-w-fit'
                  leftSection={<FontAwesomeIcon icon={faCancel} />}
                  variant='subtle'
                  loading={abortLoading === 'install'}
                  onClick={doAbortInstall}
                >
                  {t('common.button.cancel', {})}
                </Button>
              </ServerCan>
            </div>
          </Notification>
        </div>
      ) : server.nodeMaintenanceEnabled ? (
        <div className='mt-2 px-4 lg:px-6 mb-4'>
          <Notification>{t('pages.server.console.notification.nodeMaintenance', {})}</Notification>
        </div>
      ) : null}

      <div className={`${fullscreen || id ? 'mb-4' : 'px-4 lg:px-6 mb-4 lg:mt-6'}`}>
        {registry?.prependedComponents.map((Component, index) => (
          <Component key={`prepended-${index}`} {...props} />
        ))}

        {hideTitleComponent ? null : setSearch ? (
          <Group justify='space-between' mb='md'>
            <div>
              <Title order={titleOrder} c='white'>
                {title}
              </Title>
              {subtitle ? <p className='text-xs text-gray-300!'>{subtitle}</p> : null}
            </div>
            <Group>
              <TextInput
                placeholder={t('common.input.search', {})}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                w={250}
              />
              {contentRight}
            </Group>
          </Group>
        ) : contentRight ? (
          <Group justify='space-between' mb='md'>
            <div>
              <Title order={titleOrder} c='white'>
                {title}
              </Title>
              {subtitle ? <p className='text-xs text-gray-300!'>{subtitle}</p> : null}
            </div>
            <Group>{contentRight}</Group>
          </Group>
        ) : (
          <div className='mb-4'>
            <Title order={titleOrder} c='white'>
              {title}
            </Title>
            {subtitle ? <p className='text-xs text-gray-300!'>{subtitle}</p> : null}
          </div>
        )}
        {registry?.prependedContentComponents.map((Component, index) => (
          <Component key={`prepended-content-${index}`} {...props} />
        ))}

        {children}

        {registry?.appendedContentComponents.map((Component, index) => (
          <Component key={`appended-content-${index}`} {...props} />
        ))}
      </div>
    </ContentContainer>
  );
}

export default makeComponentHookable(ServerContentContainer) as typeof ServerContentContainer;
