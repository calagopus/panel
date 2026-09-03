import { faCancel, faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Text, Title, TitleOrder } from '@mantine/core';
import { Dispatch, ReactNode, SetStateAction, useEffect, useMemo, useState } from 'react';
import { ContainerRegistry, makeComponentHookable } from 'shared';
import { useShallow } from 'zustand/react/shallow';
import cancelTransfer from '@/api/admin/servers/cancelTransfer.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import cancelServerInstall from '@/api/server/settings/cancelServerInstall.ts';
import Button from '@/elements/buttons/Button.tsx';
import DismissibleAnnouncementAlert from '@/elements/DismissibleAnnouncementAlert.tsx';
import Notification from '@/elements/feedback/Notification.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { bytesProgressString } from '@/lib/format/size.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { AdminCan, ServerCan } from '../Can.tsx';
import ExtensionSlot from '../ExtensionSlot.tsx';
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
  const modifiedProps = useMemo(() => {
    let currentProps = props;

    if (props.registry) {
      for (const interceptor of props.registry.propsInterceptors) {
        currentProps = interceptor(currentProps);
      }
    }

    return currentProps;
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
  } = modifiedProps;

  const { t, tItem } = useTranslations();
  const {
    server,
    serverAnnouncements,
    updateServer,
    pendingRestart,
    backupRestoreProgress,
    transferProgressArchive,
    backupRestoreTotal,
    transferProgressTotal,
    transferProgressFiles,
    backupRestoreFiles,
    installProgress,
  } = useServerStore(
    useShallow((state) => ({
      server: state.server,
      serverAnnouncements: state.serverAnnouncements,
      updateServer: state.updateServer,
      pendingRestart: state.pendingRestart,
      backupRestoreProgress: state.backupRestoreProgress,
      transferProgressArchive: state.transferProgressArchive,
      backupRestoreTotal: state.backupRestoreTotal,
      transferProgressTotal: state.transferProgressTotal,
      transferProgressFiles: state.transferProgressFiles,
      backupRestoreFiles: state.backupRestoreFiles,
      installProgress: state.installProgress,
    })),
  );
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
      {!id &&
        serverAnnouncements.map((announcement) => (
          <DismissibleAnnouncementAlert key={announcement.uuid} announcement={announcement} />
        ))}

      {fullscreen || id ? null : server.isTransferring ? (
        <div className='mt-2 px-4 lg:px-6 mb-4'>
          <Notification>
            <div className='flex flex-col md:flex-row items-center gap-2'>
              <div className='flex flex-col w-full gap-2 md:gap-0'>
                <span className='flex flex-col md:flex-row md:items-center gap-1'>
                  {t('pages.server.console.notification.transferring', {})}
                  <EstimatedTimeArrival progress={transferProgressArchive} total={transferProgressTotal} />
                </span>

                <Tooltip
                  label={`${bytesProgressString(transferProgressArchive, transferProgressTotal)} · ${tItem('file', transferProgressFiles)}`}
                  innerClassName='w-full'
                >
                  <Progress
                    indeterminate={!transferProgressTotal}
                    value={(transferProgressArchive / transferProgressTotal) * 100}
                  />
                </Tooltip>
              </div>

              <AdminCan action='servers.transfer'>
                <Button
                  className='min-w-fit'
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
              label={`${bytesProgressString(backupRestoreProgress, backupRestoreTotal)} · ${tItem('file', backupRestoreFiles)}`}
              innerClassName='w-full'
            >
              <Progress
                indeterminate={!backupRestoreTotal}
                value={(backupRestoreProgress / backupRestoreTotal) * 100}
              />
            </Tooltip>
          </Notification>
        </div>
      ) : server.status === 'installing' ? (
        <div className='mt-2 px-4 lg:px-6 mb-4'>
          <Notification loading>
            <div className='flex flex-row items-center justify-between'>
              <span className='flex flex-col md:flex-row md:items-center gap-1'>
                {t('pages.server.console.notification.installing', {})}
                {installProgress?.label ? (
                  <Text size='sm' c='dimmed'>
                    {installProgress.label}
                  </Text>
                ) : null}
              </span>

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

            {installProgress === null ? null : installProgress.total === 100 ? (
              <Progress value={installProgress.progress} />
            ) : (
              <Tooltip
                label={bytesProgressString(installProgress.progress, installProgress.total)}
                innerClassName='w-full'
              >
                <Progress value={(installProgress.progress / installProgress.total) * 100} />
              </Tooltip>
            )}
          </Notification>
        </div>
      ) : server.nodeMaintenanceEnabled ? (
        <div className='mt-2 px-4 lg:px-6 mb-4'>
          <Notification color='yellow'>{t('pages.server.console.notification.nodeMaintenance', {})}</Notification>
        </div>
      ) : pendingRestart ? (
        <div className='mt-2 px-4 lg:px-6 mb-4'>
          <Notification color='yellow'>{t('pages.server.console.notification.pendingRestart', {})}</Notification>
        </div>
      ) : null}

      <div className={`${fullscreen || id ? 'mb-4' : 'px-4 lg:px-6 mb-4 lg:mt-6 mt-2'}`}>
        <ExtensionSlot components={registry?.prependedComponents ?? []} name='prepended' props={modifiedProps} />

        {hideTitleComponent ? null : setSearch ? (
          <Group justify='space-between' mb='md'>
            <div>
              <Title order={titleOrder}>{title}</Title>
              {subtitle ? (
                <Text size='xs' c='dimmed'>
                  {subtitle}
                </Text>
              ) : null}
            </div>
            <Group>
              <TextInput
                placeholder={t('common.input.search', {})}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftSection={<FontAwesomeIcon icon={faSearch} />}
                w={250}
              />
              {contentRight}
            </Group>
          </Group>
        ) : contentRight ? (
          <Group justify='space-between' mb='md'>
            <div>
              <Title order={titleOrder}>{title}</Title>
              {subtitle ? (
                <Text size='xs' c='dimmed'>
                  {subtitle}
                </Text>
              ) : null}
            </div>
            <Group>{contentRight}</Group>
          </Group>
        ) : (
          <div className='mb-4'>
            <Title order={titleOrder}>{title}</Title>
            {subtitle ? (
              <Text size='xs' c='dimmed'>
                {subtitle}
              </Text>
            ) : null}
          </div>
        )}
        <ExtensionSlot
          components={registry?.prependedContentComponents ?? []}
          name='prepended-content'
          props={modifiedProps}
        />

        {children}

        <ExtensionSlot
          components={registry?.appendedContentComponents ?? []}
          name='appended-content'
          props={modifiedProps}
        />
      </div>
    </ContentContainer>
  );
}

export default makeComponentHookable(ServerContentContainer) as typeof ServerContentContainer;
