import { faFileText, faRefresh, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import getAdminExtensions from '@/api/admin/extensions/getAdminExtensions.ts';
import addExtension from '@/api/admin/extensions/manage/addExtension.ts';
import getExtensionStatus, { ExtensionStatus } from '@/api/admin/extensions/manage/getExtensionStatus.ts';
import rebuildExtensions from '@/api/admin/extensions/manage/rebuildExtensions.ts';
import removeExtension from '@/api/admin/extensions/manage/removeExtension.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Title from '@/elements/Title.tsx';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';
import { useImportDragAndDrop } from '@/plugins/useImportDragAndDrop.ts';
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

  const [backendExtensions, setBackendExtensions] = useState<z.infer<typeof adminBackendExtensionSchema>[] | null>(
    null,
  );
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);
  const [removalExtension, setRemovalExtension] = useState<z.infer<typeof adminBackendExtensionSchema> | null>(null);
  const [pendingLicense, setPendingLicense] = useState<{
    file: File;
    extension: Awaited<ReturnType<typeof addExtension>>['extension'];
  } | null>(null);
  const [openModal, setOpenModal] = useState<'logs' | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createStatusInterval = () => {
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);

    statusIntervalRef.current = setInterval(() => {
      getExtensionStatus()
        .then((status) => {
          setExtensionStatus(status);
          if (!status.isBuilding && statusIntervalRef.current) {
            clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
            getAdminExtensions()
              .then((extensions) => {
                setBackendExtensions(extensions);
                addToast(t('pages.admin.extensions.toast.buildCompleted', {}), 'success');
                setOpenModal(null);
              })
              .catch((err) => {
                addToast(httpErrorToHuman(err), 'error');
              });
          }
        })
        .catch((err) => {
          // stop polling instead of toasting the same error every 5 seconds
          if (statusIntervalRef.current) {
            clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
          }
          addToast(httpErrorToHuman(err), 'error');
        });
    }, 5000);
  };

  useEffect(() => {
    getAdminExtensions()
      .then((extensions) => {
        setBackendExtensions(extensions);
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      });

    getExtensionStatus()
      .then((status) => {
        setExtensionStatus(status);

        if (status.isBuilding) {
          createStatusInterval();
        }
      })
      .catch((err) => {
        console.error('Failed to get extension status:', err);
      });

    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, []);

  const handleRebuild = () => {
    rebuildExtensions()
      .then(() => {
        addToast(t('pages.admin.extensions.toast.buildStarted', {}), 'success');
        setExtensionStatus((prev) => prev && { ...prev, isBuilding: true });

        createStatusInterval();
        setOpenModal('logs');
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
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
            <ConditionalTooltip
              enabled={extensionStatus?.isBuilding || false}
              label={t('pages.admin.extensions.tooltip.building', {})}
            >
              <Button
                color='blue'
                leftSection={<FontAwesomeIcon icon={faUpload} />}
                onClick={() => fileInputRef.current?.click()}
                disabled={extensionStatus?.isBuilding}
              >
                {t('pages.admin.extensions.button.install', {})}
              </Button>
            </ConditionalTooltip>

            <input type='file' accept='.zip' ref={fileInputRef} className='hidden' onChange={handleFileUpload} />
          </Group>
        </AdminCan>
      }
    >
      <BuildLogsModal opened={openModal === 'logs'} onClose={() => setOpenModal(null)} />
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
          {window.extensionContext.extensions.map(
            (
              extension,
              _,
              __,
              backendExtension = backendExtensions.find((e) => e.metadataToml.packageName === extension.packageName),
            ) => (
              <ExtensionCard
                key={extension.packageName}
                extension={extension}
                backendExtension={backendExtension}
                isRemoved={extensionStatus?.removedExtensions.some(
                  (e) => e.metadataToml.packageName === extension.packageName,
                )}
                onRemove={extensionStatus && backendExtension ? () => setRemovalExtension(backendExtension) : undefined}
              />
            ),
          )}
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
              <ConditionalTooltip
                enabled={
                  (!extensionStatus.pendingExtensions.length && !extensionStatus.removedExtensions.length) ||
                  extensionStatus.isBuilding
                }
                label={
                  extensionStatus.isBuilding
                    ? t('pages.admin.extensions.tooltip.building', {})
                    : t('pages.admin.extensions.tooltip.noPendingBuild', {})
                }
              >
                <Button
                  color='red'
                  leftSection={<FontAwesomeIcon icon={faRefresh} />}
                  loading={extensionStatus.isBuilding}
                  onClick={handleRebuild}
                >
                  {t('pages.admin.extensions.button.rebuild', {})}
                </Button>
              </ConditionalTooltip>
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
