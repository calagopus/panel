import { faFileText, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import getAdminExtensions, { AdminExtensionList } from '@/api/admin/extensions/getAdminExtensions.ts';
import addExtension from '@/api/admin/extensions/manage/addExtension.ts';
import cancelExtensionRebuild from '@/api/admin/extensions/manage/cancelExtensionRebuild.ts';
import getExtensionStatus, {
  ExtensionStatus,
  ExtensionSupervisorState,
} from '@/api/admin/extensions/manage/getExtensionStatus.ts';
import rebuildExtensions from '@/api/admin/extensions/manage/rebuildExtensions.ts';
import removeExtension from '@/api/admin/extensions/manage/removeExtension.ts';
import restartPanel from '@/api/admin/extensions/manage/restartPanel.ts';
import setExtensionEnabled from '@/api/admin/extensions/setExtensionEnabled.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import { computePendingRestart, getBuildPhase, removeByPackageName, upsertByPackageName } from '@/lib/extensions.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';
import { useImportDragAndDrop } from '@/plugins/useImportDragAndDrop.ts';
import { usePollingResource } from '@/plugins/usePollingResource.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ExtensionInstallOverlay from './ExtensionInstallOverlay.tsx';
import ExtensionStatusAlerts from './ExtensionStatusAlerts.tsx';
import InstalledExtensionsGrid from './InstalledExtensionsGrid.tsx';
import BuildLogsModal from './modals/BuildLogsModal.tsx';
import LicenseModal from './modals/LicenseModal.tsx';
import RemoveExtensionModal from './modals/RemoveExtensionModal.tsx';
import PendingExtensionsSection from './PendingExtensionsSection.tsx';

export default function AdminExtensions() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { data: adminExtensions, refetch: refetchExtensions } = useResource({
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

  const runWithErrorToast = <T,>(promise: Promise<T>, onSuccess: (result: T) => void, onError?: () => void) => {
    promise.then(onSuccess).catch((err) => {
      addToast(httpErrorToHuman(err), 'error');
      onError?.();
    });
  };

  const buildPhase = (state: ExtensionSupervisorState): string | null => getBuildPhase(t, state);

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
    runWithErrorToast(rebuildExtensions(force), (rebuild) => {
      watchedBuildRef.current = rebuild.buildId;
      addToast(t('pages.admin.extensions.toast.buildStarted', {}), 'success');
      setExtensionStatus((prev) => prev && { ...prev, isBuilding: true });
      refetchStatus();

      setOpenModal('logs');
    });
  };

  const handleCancelBuild = () => {
    runWithErrorToast(
      cancelExtensionRebuild(buildId),
      (cancel) => {
        setCancellingBuild(cancel.buildId);
        addToast(t('pages.admin.extensions.toast.cancelRequested', {}), 'success');
      },
      () => refetchStatus(),
    );
  };

  const handleRemove = (backendExtension: z.infer<typeof adminBackendExtensionSchema>, removeMigrations: boolean) => {
    runWithErrorToast(removeExtension(backendExtension.metadataToml.packageName, removeMigrations), () => {
      setExtensionStatus((prev) =>
        prev
          ? {
              ...prev,
              pendingExtensions: removeByPackageName(prev.pendingExtensions, backendExtension.metadataToml.packageName),
              removedExtensions: upsertByPackageName(prev.removedExtensions, backendExtension),
            }
          : prev,
      );
      addToast(
        t('pages.admin.extensions.toast.removed', { packageName: backendExtension.metadataToml.packageName }).md(),
        'success',
      );
      setRemovalExtension(null);
    });
  };

  const applyExtension = (extension: Awaited<ReturnType<typeof addExtension>>['extension']) => {
    setExtensionStatus((prev) => {
      if (!prev) return prev;

      const appliedMatch = adminExtensions?.extensions.find(
        (e) => e.metadataToml.packageName === extension.metadataToml.packageName && e.version === extension.version,
      );

      return {
        ...prev,
        pendingExtensions: appliedMatch
          ? removeByPackageName(prev.pendingExtensions, extension.metadataToml.packageName)
          : upsertByPackageName(prev.pendingExtensions, extension),
        removedExtensions: removeByPackageName(prev.removedExtensions, extension.metadataToml.packageName),
      };
    });
    addToast(
      t('pages.admin.extensions.toast.added', { packageName: extension.metadataToml.packageName }).md(),
      'success',
    );
  };

  const handleToggle = (packageName: string, enabled: boolean) => {
    runWithErrorToast(setExtensionEnabled(packageName, enabled), () => {
      queryClient.setQueryData<AdminExtensionList>(queryKeys.admin.extensions.all(), (prev) =>
        prev
          ? {
              ...prev,
              pendingDisabled: enabled
                ? prev.pendingDisabled.filter((e) => e !== packageName)
                : [...prev.pendingDisabled, packageName],
            }
          : prev,
      );
      addToast(
        enabled
          ? t('pages.admin.extensions.toast.enabled', { packageName }).md()
          : t('pages.admin.extensions.toast.disabled', { packageName }).md(),
        'success',
      );
    });
  };

  const handleRestart = () => {
    runWithErrorToast(restartPanel(), () => {
      addToast(t('pages.admin.extensions.toast.restarting', {}), 'success');
    });
  };

  const handleAdd = (file: File, acceptLicense = false) => {
    runWithErrorToast(addExtension(file, acceptLicense), ({ extension, needsLicenseAcceptance }) => {
      if (needsLicenseAcceptance) {
        setPendingLicense({ file, extension });
        return;
      }
      applyExtension(extension);
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

  const pendingRestart = useMemo(() => computePendingRestart(adminExtensions), [adminExtensions]);

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

      <ExtensionStatusAlerts
        extensionStatus={extensionStatus}
        supervisor={supervisor}
        buildStatus={{ buildFailed, failureReason }}
        restart={{ pendingRestart, isBuilding, onRestart: handleRestart }}
      />

      <InstalledExtensionsGrid
        adminExtensions={adminExtensions}
        extensionStatus={extensionStatus}
        setRemovalExtension={setRemovalExtension}
        handleToggle={handleToggle}
      />

      {extensionStatus && (
        <PendingExtensionsSection
          extensionStatus={extensionStatus}
          buildState={{ phase, isBuilding, buildFailed, cancellingBuild }}
          buildActions={{ onCancelBuild: handleCancelBuild, onRebuild: handleRebuild }}
          handleRemove={handleRemove}
        />
      )}
    </AdminContentContainer>
  );
}
