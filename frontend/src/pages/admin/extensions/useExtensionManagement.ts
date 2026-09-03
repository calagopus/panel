import { useQueryClient } from '@tanstack/react-query';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import getAdminExtensions, { AdminExtensionList } from '@/api/admin/extensions/getAdminExtensions.ts';
import addExtension from '@/api/admin/extensions/manage/addExtension.ts';
import cancelExtensionRebuild from '@/api/admin/extensions/manage/cancelExtensionRebuild.ts';
import getExtensionStatus, { ExtensionStatus } from '@/api/admin/extensions/manage/getExtensionStatus.ts';
import rebuildExtensions from '@/api/admin/extensions/manage/rebuildExtensions.ts';
import removeExtension from '@/api/admin/extensions/manage/removeExtension.ts';
import restartPanel from '@/api/admin/extensions/manage/restartPanel.ts';
import setExtensionEnabled from '@/api/admin/extensions/setExtensionEnabled.ts';
import { computePendingRestart, getBuildPhase, removeByPackageName, upsertByPackageName } from '@/lib/extensions.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminBackendExtension } from '@/lib/schemas/admin/backendExtension.ts';
import { useImportDragAndDrop } from '@/plugins/import/useImportDragAndDrop.ts';
import { usePollingResource } from '@/plugins/resource/usePollingResource.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useMutateWithToast } from '@/plugins/toast/useMutateWithToast.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type PendingLicense = {
  file: File;
  extension: Awaited<ReturnType<typeof addExtension>>['extension'];
};

export function useExtensionManagement() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const mutate = useMutateWithToast();

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

  const [removalExtension, setRemovalExtension] = useState<AdminBackendExtension | null>(null);
  const [pendingLicense, setPendingLicense] = useState<PendingLicense | null>(null);
  const [openModal, setOpenModal] = useState<'logs' | null>(null);
  const [cancellingBuild, setCancellingBuild] = useState<number | null>(null);
  const watchedBuildRef = useRef<number | null>(null);

  const supervisor = extensionStatus?.supervisor ?? null;
  const supervisorState = supervisor?.state ?? null;
  const buildId = supervisor?.buildId ?? null;
  const buildFailed = supervisorState?.type === 'failed';
  const failureReason = supervisor?.failureReason ?? null;
  const isBuilding = extensionStatus?.isBuilding ?? false;
  const phase = supervisorState ? getBuildPhase(t, supervisorState) : null;
  const pendingRestart = useMemo(() => computePendingRestart(adminExtensions), [adminExtensions]);

  const setExtensionStatus = (updater: (prev: ExtensionStatus | undefined) => ExtensionStatus | undefined) => {
    queryClient.setQueryData<ExtensionStatus>(queryKeys.admin.extensions.status(), (prev) => updater(prev));
  };

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
    mutate(rebuildExtensions(force), (rebuild) => {
      watchedBuildRef.current = rebuild.buildId;
      addToast(t('pages.admin.extensions.toast.buildStarted', {}), 'success');
      setExtensionStatus((prev) => prev && { ...prev, isBuilding: true });
      refetchStatus();
      setOpenModal('logs');
    });
  };

  const handleCancelBuild = () => {
    mutate(
      cancelExtensionRebuild(buildId),
      (cancel) => {
        setCancellingBuild(cancel.buildId);
        addToast(t('pages.admin.extensions.toast.cancelRequested', {}), 'success');
      },
      () => refetchStatus(),
    );
  };

  const handleRemove = (backendExtension: AdminBackendExtension, removeMigrations: boolean) => {
    mutate(removeExtension(backendExtension.metadataToml.packageName, removeMigrations), () => {
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

  const applyExtension = (extension: PendingLicense['extension']) => {
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
    mutate(setExtensionEnabled(packageName, enabled), () => {
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
    mutate(restartPanel(), () => {
      addToast(t('pages.admin.extensions.toast.restarting', {}), 'success');
    });
  };

  const handleAdd = (file: File, acceptLicense = false) => {
    mutate(addExtension(file, acceptLicense), ({ extension, needsLicenseAcceptance }) => {
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

  return {
    adminExtensions,
    extensionStatus,
    supervisor,
    buildId,
    buildFailed,
    failureReason,
    isBuilding,
    phase,
    pendingRestart,
    cancellingBuild,
    removalExtension,
    setRemovalExtension,
    pendingLicense,
    setPendingLicense,
    openModal,
    setOpenModal,
    handleRebuild,
    handleCancelBuild,
    handleRemove,
    handleToggle,
    handleRestart,
    handleAdd,
    handleLicenseAccept,
    handleFileUpload,
    isDragging,
  };
}
