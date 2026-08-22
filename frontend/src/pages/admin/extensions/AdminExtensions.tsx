import { faBan, faExclamationTriangle, faFileText, faRefresh, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import getAdminExtensions from '@/api/admin/extensions/getAdminExtensions.ts';
import addExtension from '@/api/admin/extensions/manage/addExtension.ts';
import cancelExtensionRebuild from '@/api/admin/extensions/manage/cancelExtensionRebuild.ts';
import getExtensionStatus, {
  ExtensionStatus,
  ExtensionSupervisorState,
} from '@/api/admin/extensions/manage/getExtensionStatus.ts';
import rebuildExtensions from '@/api/admin/extensions/manage/rebuildExtensions.ts';
import removeExtension from '@/api/admin/extensions/manage/removeExtension.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Title from '@/elements/Title.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';
import { useImportDragAndDrop } from '@/plugins/useImportDragAndDrop.ts';
import { usePollingResource } from '@/plugins/usePollingResource.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ExtensionCard from './ExtensionCard.tsx';
import ExtensionInstallOverlay from './ExtensionInstallOverlay.tsx';
import BuildLogsModal from './modals/BuildLogsModal.tsx';
import LicenseModal from './modals/LicenseModal.tsx';
import RemoveExtensionModal from './modals/RemoveExtensionModal.tsx';

export default function AdminExtensions() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { data: backendExtensions, refetch: refetchExtensions } = useResource({
    queryKey: queryKeys.admin.extensions.all(),
    queryFn: getAdminExtensions,
  });
  const { data: extensionStatus, refetch: refetchStatus } = usePollingResource({
    queryKey: queryKeys.admin.extensions.status(),
    queryFn: getExtensionStatus,
    interval: 5000,
    pollInBackground: true,
    silent: true,
    retryOnError: 60,
  });

  const [removalExtension, setRemovalExtension] = useState<z.infer<typeof adminBackendExtensionSchema> | null>(null);
  const [pendingLicense, setPendingLicense] = useState<{
    file: File;
    extension: Awaited<ReturnType<typeof addExtension>>['extension'];
  } | null>(null);
  const [openModal, setOpenModal] = useState<'logs' | null>(null);
  const [cancellingBuild, setCancellingBuild] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const watchedBuildRef = useRef<number | null>(null);

  const supervisor = extensionStatus?.supervisor ?? null;
  const supervisorState = supervisor?.state ?? null;
  const buildId = supervisor?.buildId ?? null;
  const buildFailed = supervisorState?.type === 'failed';
  const failureReason = supervisor?.failureReason ?? null;
  const isBuilding = extensionStatus?.isBuilding ?? false;

  const setExtensionStatus = (updater: (prev: ExtensionStatus | undefined) => ExtensionStatus | undefined) => {
    queryClient.setQueryData<ExtensionStatus>(queryKeys.admin.extensions.status(), (prev) => updater(prev));
  };

  const buildPhase = (state: ExtensionSupervisorState): string | null => {
    if (state.type === 'queued') return t('pages.admin.extensions.phase.queued', {});
    if (state.type !== 'building') return null;

    switch (state.phase.type) {
      case 'preparing':
        return t('pages.admin.extensions.phase.preparing', {});
      case 'clearing':
        return t('pages.admin.extensions.phase.clearing', {});
      case 'adding':
        return t('pages.admin.extensions.phase.adding', { done: state.phase.done, total: state.phase.total });
      case 'resync':
        return t('pages.admin.extensions.phase.resync', {});
      case 'staging_translations':
        return t('pages.admin.extensions.phase.stagingTranslations', {});
      case 'building':
        return t('pages.admin.extensions.phase.compiling', {});
      case 'verifying':
        return t('pages.admin.extensions.phase.verifying', {});
      case 'installing':
        return t('pages.admin.extensions.phase.installing', {});
      case 'restarting':
        return t('pages.admin.extensions.phase.restarting', {});
    }
  };

  const phase = supervisorState ? buildPhase(supervisorState) : null;

  useEffect(() => {
    if (!supervisorState) return;

    if (supervisorState.type === 'queued' || supervisorState.type === 'building') {
      watchedBuildRef.current = buildId;
      return;
    }

    setCancellingBuild(null);

    if (watchedBuildRef.current === null || watchedBuildRef.current !== buildId) return;
    watchedBuildRef.current = null;

    if (supervisorState.type === 'failed') {
      addToast(
        failureReason
          ? t('pages.admin.extensions.toast.buildFailed', { reason: failureReason })
          : t('pages.admin.extensions.alert.buildFailed.title', {}),
        'error',
      );
      return;
    }

    refetchExtensions();
    addToast(t('pages.admin.extensions.toast.buildCompleted', {}), 'success');
    setOpenModal(null);
  }, [supervisorState?.type, buildId]);

  const handleRebuild = (force: boolean) => {
    rebuildExtensions(force)
      .then((rebuild) => {
        watchedBuildRef.current = rebuild.buildId;
        addToast(t('pages.admin.extensions.toast.buildStarted', {}), 'success');
        setExtensionStatus((prev) => prev && { ...prev, isBuilding: true });
        refetchStatus();

        setOpenModal('logs');
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      });
  };

  const handleCancelBuild = () => {
    cancelExtensionRebuild(buildId)
      .then((cancel) => {
        setCancellingBuild(cancel.buildId);
        addToast(t('pages.admin.extensions.toast.cancelRequested', {}), 'success');
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
        refetchStatus();
      });
  };

  const handleRemove = (backendExtension: z.infer<typeof adminBackendExtensionSchema>, removeMigrations: boolean) => {
    removeExtension(backendExtension.metadataToml.packageName, removeMigrations)
      .then(() => {
        setExtensionStatus((prev) =>
          prev
            ? {
                ...prev,
                pendingExtensions: prev.pendingExtensions.filter(
                  (e) => e.metadataToml.packageName !== backendExtension.metadataToml.packageName,
                ),
                removedExtensions: [
                  ...prev.removedExtensions.filter(
                    (e) => e.metadataToml.packageName !== backendExtension.metadataToml.packageName,
                  ),
                  backendExtension,
                ],
              }
            : prev,
        );
        addToast(
          t('pages.admin.extensions.toast.removed', { packageName: backendExtension.metadataToml.packageName }).md(),
          'success',
        );
        setRemovalExtension(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const applyExtension = (extension: Awaited<ReturnType<typeof addExtension>>['extension']) => {
    setExtensionStatus((prev) => {
      if (!prev) return prev;

      const appliedMatch = backendExtensions?.find(
        (e) => e.metadataToml.packageName === extension.metadataToml.packageName && e.version === extension.version,
      );

      return {
        ...prev,
        pendingExtensions: appliedMatch
          ? prev.pendingExtensions.filter((e) => e.metadataToml.packageName !== extension.metadataToml.packageName)
          : [
              ...prev.pendingExtensions.filter(
                (e) => e.metadataToml.packageName !== extension.metadataToml.packageName,
              ),
              extension,
            ],
        removedExtensions: prev.removedExtensions.filter(
          (e) => e.metadataToml.packageName !== extension.metadataToml.packageName,
        ),
      };
    });
    addToast(
      t('pages.admin.extensions.toast.added', { packageName: extension.metadataToml.packageName }).md(),
      'success',
    );
  };

  const handleAdd = (file: File, acceptLicense = false) => {
    addExtension(file, acceptLicense)
      .then(({ extension, needsLicenseAcceptance }) => {
        if (needsLicenseAcceptance) {
          setPendingLicense({ file, extension });
          return;
        }
        applyExtension(extension);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const handleLicenseAccept = () => {
    if (!pendingLicense) return;
    setPendingLicense(null);
    handleAdd(pendingLicense.file, true);
  };

  const { isDragging } = useImportDragAndDrop({
    onDrop: (files) => Promise.all(files.map((file) => handleAdd(file))),
    enabled: extensionStatus ? !extensionStatus.isBuilding : false,
    filterFile: (file) => file.name.toLowerCase().endsWith('.zip'),
  });

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';

    handleAdd(file);
  };

  const installedCount =
    (window.extensionContext.extensions?.length || 0) +
    (backendExtensions?.filter(
      (be) => !window.extensionContext.extensions.find((e) => e.packageName === be.metadataToml.packageName),
    ).length || 0);

  return (
    <AdminContentContainer
      title={t('pages.admin.extensions.title', {})}
      contentRight={
        <AdminCan action='extensions.manage'>
          <Group hidden={!extensionStatus} gap='xs'>
            <Button
              variant='default'
              leftSection={<FontAwesomeIcon icon={faFileText} />}
              onClick={() => setOpenModal('logs')}
            >
              {t('pages.admin.extensions.button.viewBuildLogs', {})}
            </Button>
            <ConditionalTooltip enabled={isBuilding} label={t('pages.admin.extensions.tooltip.building', {})}>
              <Button
                color='blue'
                leftSection={<FontAwesomeIcon icon={faUpload} />}
                onClick={() => fileInputRef.current?.click()}
                disabled={isBuilding}
              >
                {t('pages.admin.extensions.button.install', {})}
              </Button>
            </ConditionalTooltip>

            <input type='file' accept='.zip' ref={fileInputRef} className='hidden' onChange={handleFileUpload} />
          </Group>
        </AdminCan>
      }
    >
      <BuildLogsModal opened={openModal === 'logs'} buildId={buildId} onClose={() => setOpenModal(null)} />
      <LicenseModal
        opened={!!pendingLicense}
        packageName={pendingLicense?.extension.metadataToml.packageName}
        licenseText={pendingLicense?.extension.metadataToml.licenseText ?? ''}
        onAccept={handleLicenseAccept}
        onClose={() => setPendingLicense(null)}
      />
      <RemoveExtensionModal
        opened={!!removalExtension}
        extension={removalExtension}
        onRemove={(removeMigrations) => handleRemove(removalExtension!, removeMigrations)}
        onClose={() => setRemovalExtension(null)}
      />

      <ExtensionInstallOverlay visible={isDragging} />

      {extensionStatus && !supervisor && (
        <Alert
          color='red'
          icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          title={t('pages.admin.extensions.alert.supervisorUnreachable.title', {})}
          mb='md'
        >
          {t('pages.admin.extensions.alert.supervisorUnreachable.content', {})}
        </Alert>
      )}

      {buildFailed && (
        <Alert
          color='red'
          icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          title={t('pages.admin.extensions.alert.buildFailed.title', {})}
          mb='md'
        >
          <div className='flex flex-col items-start gap-2'>
            {failureReason && <Code>{failureReason}</Code>}
            <span>{t('pages.admin.extensions.alert.buildFailed.content', {})}</span>
          </div>
        </Alert>
      )}

      {!backendExtensions ? (
        <Spinner.Centered />
      ) : installedCount === 0 ? (
        <span>
          {t('pages.admin.extensions.alert.noExtensions', {})}{' '}
          {!extensionStatus && (
            <span>
              {t('pages.admin.extensions.alert.heavyImageMissing', {
                docsUrl: 'https://calagopus.com/docs/panel/extensions/switching-to-the-heavy-image',
              }).md()}
            </span>
          )}
        </span>
      ) : (
        <div className='grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3'>
          {window.extensionContext.extensions.map((extension) => {
            const backendExtension = backendExtensions.find(
              (e) => e.metadataToml.packageName === extension.packageName,
            );

            return (
              <ExtensionCard
                key={extension.packageName}
                extension={extension}
                backendExtension={backendExtension}
                isRemoved={extensionStatus?.removedExtensions.some(
                  (e) => e.metadataToml.packageName === extension.packageName,
                )}
                onRemove={extensionStatus && backendExtension ? () => setRemovalExtension(backendExtension) : undefined}
              />
            );
          })}
          {backendExtensions
            .filter(
              (be) => !window.extensionContext.extensions.find((e) => e.packageName === be.metadataToml.packageName),
            )
            .map((backendExtension) => (
              <ExtensionCard
                key={backendExtension.metadataToml.packageName}
                backendExtension={backendExtension}
                isRemoved={extensionStatus?.removedExtensions.some(
                  (e) => e.metadataToml.packageName === backendExtension.metadataToml.packageName,
                )}
                onRemove={extensionStatus ? () => setRemovalExtension(backendExtension) : undefined}
              />
            ))}
        </div>
      )}

      {extensionStatus && (
        <section className='mt-10'>
          <div className='mb-4 flex items-center justify-between border-b border-zinc-700/60 pb-3'>
            <Title order={2}>
              {t('pages.admin.extensions.section.pendingExtensions', {})}
              {extensionStatus.pendingExtensions.length > 0 && (
                <span className='ml-2 text-xs text-zinc-500'>({extensionStatus.pendingExtensions.length})</span>
              )}
            </Title>

            <AdminCan action='extensions.manage'>
              <Group gap='xs'>
                {phase && <span className='text-sm text-zinc-400'>{phase}</span>}

                {isBuilding && (
                  <ConditionalTooltip
                    enabled={cancellingBuild !== null}
                    label={t('pages.admin.extensions.tooltip.cancelling', {})}
                  >
                    <Button
                      variant='default'
                      leftSection={<FontAwesomeIcon icon={faBan} />}
                      disabled={cancellingBuild !== null}
                      onClick={handleCancelBuild}
                    >
                      {t('pages.admin.extensions.button.cancelBuild', {})}
                    </Button>
                  </ConditionalTooltip>
                )}

                <ConditionalTooltip
                  enabled={
                    (!extensionStatus.pendingExtensions.length &&
                      !extensionStatus.removedExtensions.length &&
                      !buildFailed) ||
                    isBuilding
                  }
                  label={
                    isBuilding
                      ? t('pages.admin.extensions.tooltip.building', {})
                      : t('pages.admin.extensions.tooltip.noPendingBuild', {})
                  }
                >
                  <Button
                    color='red'
                    leftSection={<FontAwesomeIcon icon={faRefresh} />}
                    loading={isBuilding}
                    onClick={() => handleRebuild(buildFailed)}
                  >
                    {buildFailed
                      ? t('pages.admin.extensions.button.retryBuild', {})
                      : t('pages.admin.extensions.button.rebuild', {})}
                  </Button>
                </ConditionalTooltip>
              </Group>
            </AdminCan>
          </div>

          {!extensionStatus.pendingExtensions.length ? (
            <p className='text-sm text-zinc-500'>{t('pages.admin.extensions.section.noPendingExtensions', {})}</p>
          ) : (
            <div className='grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3'>
              {extensionStatus.pendingExtensions.map((extension) => (
                <ExtensionCard
                  key={extension.metadataToml.packageName}
                  backendExtension={extension}
                  isPending
                  onRemove={extensionStatus ? () => handleRemove(extension, false) : undefined}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </AdminContentContainer>
  );
}
