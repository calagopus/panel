import { faArrowLeft, faDownload, faSkull, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteCrash from '@/api/server/logs/deleteCrash.ts';
import getCrashes from '@/api/server/logs/getCrashes.ts';
import getCrashLog from '@/api/server/logs/getCrashLog.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import LogTerminal from '@/elements/data-display/LogTerminal.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Paper from '@/elements/layout/Paper.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import NavLink from '@/elements/navigation/NavLink.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Text from '@/elements/typography/Text.tsx';
import { downloadTextFile } from '@/lib/download/download.ts';
import { exitCodeSignal } from '@/lib/format/exitCode.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverCrashSchema } from '@/lib/schemas/server/server.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useContainerAutoHeight } from '@/plugins/viewport/useContainerAutoHeight.ts';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Crash = z.infer<typeof serverCrashSchema>;

function useExitCodeLabel() {
  const { t } = useTranslations();

  return (exitCode: number) => {
    const signal = exitCodeSignal(exitCode);
    return signal
      ? t('pages.server.console.crashes.exitCodeSignal', { exitCode, signal })
      : t('pages.server.console.crashes.exitCode', { exitCode });
  };
}

function CrashDetail({ crash, onDelete }: { crash: Crash; onDelete: () => void }) {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);
  const registry = window.extensionContext.extensionRegistry.pages.server.console.crashes;
  const exitCodeLabel = useExitCodeLabel();

  const { data: log } = useResource({
    queryKey: queryKeys.server(server.uuid).crashes.log(crash.id),
    queryFn: () => getCrashLog(server.uuid, crash.id),
  });
  const lines = useMemo(() => {
    const split = log ? log.replace(/\n$/, '').split('\n') : [];
    for (const interceptor of registry.logInterceptors) {
      interceptor(split, { crash });
    }
    return split;
  }, [log, crash]);
  const detailProps = { crash, log, lines };

  return (
    <>
      <div className='flex items-start justify-between gap-3 px-4 py-3 bg-(--mantine-color-default) shrink-0'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <Text fw={600}>{formatDateTime(crash.timestamp)}</Text>
            {crash.oomKilled && (
              <Badge size='sm' variant='light' color='red'>
                {t('pages.server.console.crashes.badge.oomKilled', {})}
              </Badge>
            )}
            {crash.truncated && (
              <Tooltip label={t('pages.server.console.crashes.tooltip.truncated', {})}>
                <Badge size='sm' variant='light' color='gray'>
                  {t('pages.server.console.crashes.badge.truncated', {})}
                </Badge>
              </Tooltip>
            )}
          </div>
          <Text size='sm' c='dimmed'>
            {[exitCodeLabel(crash.exitCode), tItem('line', crash.lines), bytesToString(crash.bytes)].join(' · ')}
          </Text>
        </div>

        <div className='flex items-center gap-1 shrink-0'>
          <ExtensionSlot
            components={registry.actionComponents.prependedComponents}
            name='console-crashes-actions-prepended'
            props={detailProps}
          />
          <Tooltip label={t('common.button.download', {})}>
            <ActionIcon
              variant='subtle'
              color='gray'
              aria-label={t('common.button.download', {})}
              disabled={log === undefined}
              onClick={() => {
                if (log !== undefined) downloadTextFile(log, `crash-${server.uuidShort}-${crash.id}.log`);
              }}
            >
              <FontAwesomeIcon icon={faDownload} />
            </ActionIcon>
          </Tooltip>
          <ServerCan action='control.delete-crashes'>
            <Tooltip label={t('common.button.delete', {})}>
              <ActionIcon variant='subtle' color='red' aria-label={t('common.button.delete', {})} onClick={onDelete}>
                <FontAwesomeIcon icon={faTrashCan} />
              </ActionIcon>
            </Tooltip>
          </ServerCan>
          <ExtensionSlot
            components={registry.actionComponents.appendedComponents}
            name='console-crashes-actions-appended'
            props={detailProps}
          />
        </div>
      </div>
      <Divider />
      <ExtensionSlot
        components={registry.detailComponents.prependedComponents}
        name='console-crashes-detail-prepended'
        props={detailProps}
      />
      <div className='flex flex-col flex-1 min-h-0 relative p-2 font-mono text-sm'>
        {log === undefined && (
          <div className='absolute inset-0 z-10 flex items-center justify-center'>
            <Spinner />
          </div>
        )}
        <LogTerminal key={crash.id} lines={lines} xterm={{ registry: registry.xterm, props: { crash } }} />
      </div>
      <ExtensionSlot
        components={registry.detailComponents.appendedComponents}
        name='console-crashes-detail-appended'
        props={detailProps}
      />
    </>
  );
}

export default function ServerCrashes() {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getParent } = useCurrentWindow();
  const server = useServerStore((state) => state.server);
  const registry = window.extensionContext.extensionRegistry.pages.server.console.crashes;
  const exitCodeLabel = useExitCodeLabel();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deleting, setDeleting] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);

  const {
    data: crashes,
    error,
    refetch,
  } = useResource({
    queryKey: queryKeys.server(server.uuid).crashes.all(),
    queryFn: () => getCrashes(server.uuid),
    silent: true,
  });

  const sortedCrashes = useMemo(
    () => (crashes ? [...crashes].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) : undefined),
    [crashes],
  );

  const requestedId = searchParams.has('crash') ? Number(searchParams.get('crash')) : null;
  const selected =
    sortedCrashes?.find((crash) => crash.id === requestedId) ?? (requestedId === null ? sortedCrashes?.[0] : undefined);

  const hasCrashes = !!sortedCrashes?.length;
  const hasListItemComponents =
    registry.listItemComponents.prependedComponents.length + registry.listItemComponents.appendedComponents.length > 0;

  useContainerAutoHeight({
    containerRef: layoutRef,
    loading: !hasCrashes,
    getParent,
    layout: () => undefined,
    minHeightFraction: 0.6,
    deps: [hasCrashes, getParent],
  });

  const selectCrash = (id: number) =>
    setSearchParams(
      (params) => {
        params.set('crash', String(id));
        return params;
      },
      { replace: true },
    );

  const doDelete = async () => {
    if (!selected) return;

    await deleteCrash(server.uuid, selected.id)
      .then(() => {
        setDeleting(false);
        addToast(t('pages.server.console.crashes.toast.deleted', {}), 'success');
        setSearchParams(
          (params) => {
            params.delete('crash');
            return params;
          },
          { replace: true },
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).crashes.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const unavailable = isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 417);

  return (
    <ServerContentContainer
      title={t('pages.server.console.crashes.title', {})}
      registry={registry.container}
      contentRight={
        <Button
          variant='default'
          onClick={() => navigate(`/server/${server.uuidShort}`)}
          leftSection={<FontAwesomeIcon icon={faArrowLeft} />}
        >
          {t('pages.server.console.crashes.button.backToConsole', {})}
        </Button>
      }
    >
      {selected && (
        <ConfirmationModal
          opened={deleting}
          onClose={() => setDeleting(false)}
          title={t('pages.server.console.crashes.modal.delete.title', {})}
          confirm={t('common.button.delete', {})}
          onConfirmed={doDelete}
        >
          {t('pages.server.console.crashes.modal.delete.content', {
            timestamp: formatDateTime(selected.timestamp),
          }).md()}
        </ConfirmationModal>
      )}

      {unavailable ? (
        <EmptyState
          icon={faSkull}
          title={t('pages.server.console.crashes.unavailable.title', {})}
          description={t('pages.server.console.crashes.unavailable.description', {})}
        />
      ) : error && !sortedCrashes ? (
        <ErrorState error={httpErrorToHuman(error)} onRetry={refetch} />
      ) : !sortedCrashes ? (
        <Spinner.Centered />
      ) : !hasCrashes ? (
        <EmptyState
          icon={faSkull}
          title={t('pages.server.console.crashes.empty.title', {})}
          description={t('pages.server.console.crashes.empty.description', {})}
        />
      ) : (
        <div className='relative'>
          <div
            ref={layoutRef}
            className='absolute w-full flex flex-col lg:flex-row gap-4 pb-4 bg-(--mantine-color-body)'
          >
            <Paper withBorder radius='md' className='flex! flex-col overflow-hidden shrink-0 lg:w-72 max-lg:max-h-48'>
              <div className='flex items-center justify-between px-3 py-2.5 bg-(--mantine-color-default)'>
                <Text size='xs' fw={600} c='dimmed' tt='uppercase' style={{ letterSpacing: '0.05em' }}>
                  {t('pages.server.console.crashes.sidebar.title', {})}
                </Text>
                <Text size='xs' c='dimmed'>
                  {sortedCrashes.length}
                </Text>
              </div>
              <Divider />
              <div className='flex-1 min-h-0 overflow-y-auto p-2'>
                {sortedCrashes.map((crash) => (
                  <NavLink
                    key={crash.id}
                    active={crash.id === selected?.id}
                    aria-current={crash.id === selected?.id ? 'true' : undefined}
                    onClick={() => selectCrash(crash.id)}
                    className='rounded-sm'
                    label={<FormattedTimestamp timestamp={crash.timestamp} withTooltip={false} />}
                    description={`${exitCodeLabel(crash.exitCode)} · ${tItem('line', crash.lines)}`}
                    rightSection={
                      crash.oomKilled || hasListItemComponents ? (
                        <div className='flex items-center gap-1'>
                          <ExtensionSlot
                            components={registry.listItemComponents.prependedComponents}
                            name='console-crashes-list-item-prepended'
                            props={{ crash }}
                          />
                          {crash.oomKilled && (
                            <Badge size='xs' variant='light' color='red'>
                              {t('pages.server.console.crashes.badge.oomKilled', {})}
                            </Badge>
                          )}
                          <ExtensionSlot
                            components={registry.listItemComponents.appendedComponents}
                            name='console-crashes-list-item-appended'
                            props={{ crash }}
                          />
                        </div>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </Paper>

            <Paper withBorder radius='md' className='flex! flex-col flex-1 min-w-0 min-h-0 overflow-hidden'>
              {selected ? (
                <CrashDetail crash={selected} onDelete={() => setDeleting(true)} />
              ) : (
                <div className='flex flex-1 items-center justify-center'>
                  <EmptyState
                    flush
                    icon={faSkull}
                    title={t('pages.server.console.crashes.missing.title', {})}
                    description={t('pages.server.console.crashes.missing.description', {})}
                  />
                </div>
              )}
            </Paper>
          </div>
        </div>
      )}
    </ServerContentContainer>
  );
}
