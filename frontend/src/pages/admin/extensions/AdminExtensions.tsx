import { faFileText, faRefresh, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Title } from '@mantine/core';
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
import Code from '@/elements/Code.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';
import { useImportDragAndDrop } from '@/plugins/useImportDragAndDrop.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import ExtensionCard from './ExtensionCard.tsx';
import ExtensionInstallOverlay from './ExtensionInstallOverlay.tsx';
import BuildLogsModal from './modals/BuildLogsModal.tsx';

export default function AdminExtensions() {
  const { addToast } = useToast();

  const [backendExtensions, setBackendExtensions] = useState<z.infer<typeof adminBackendExtensionSchema>[] | null>(
    null,
  );
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);
  const [removalExtension, setRemovalExtension] = useState<z.infer<typeof adminBackendExtensionSchema> | null>(null);
  const [openModal, setOpenModal] = useState<'logs' | null>(null);
  const [removeMigrations, setRemoveMigrations] = useState(false);
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
                addToast('Extension build completed. You may need to refresh the page.', 'success');
                setOpenModal(null);
              })
              .catch((err) => {
                addToast(httpErrorToHuman(err), 'error');
              });
          }
        })
        .catch((err) => {
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

    getExtensionStatus().then((status) => {
      setExtensionStatus(status);

      if (status.isBuilding) {
        createStatusInterval();
      }
    });

    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, []);

  const handleRebuild = () => {
    rebuildExtensions()
      .then(() => {
        addToast('Extension rebuild started successfully.', 'success');
        setExtensionStatus((prev) => prev && { ...prev, isBuilding: true });

        createStatusInterval();
        setOpenModal('logs');
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      });
  };

  const handleRemove = (backendExtension: z.infer<typeof adminBackendExtensionSchema>) => {
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
        addToast(`Extension \`${backendExtension.metadataToml.packageName}\` removed successfully.`.md(), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const handleAdd = async (file: File) => {
    addExtension(file)
      .then((extension) => {
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
        addToast(`Extension \`${extension.metadataToml.packageName}\` added successfully.`.md(), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const { isDragging } = useImportDragAndDrop({
    onDrop: (files) => Promise.all(files.map(handleAdd)),
    enabled: extensionStatus ? !extensionStatus.isBuilding : false,
    filterFile: (file) => file.name.toLowerCase().endsWith('.zip'),
  });

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
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
      title='Extensions'
      contentRight={
        <AdminCan action='extensions.manage'>
          <Group hidden={!extensionStatus} gap='xs'>
            <Button
              variant='default'
              leftSection={<FontAwesomeIcon icon={faFileText} />}
              onClick={() => setOpenModal('logs')}
            >
              View build logs
            </Button>
            <ConditionalTooltip
              enabled={extensionStatus?.isBuilding || false}
              label='The panel is currently building extension code. Please wait.'
            >
              <Button
                color='blue'
                leftSection={<FontAwesomeIcon icon={faUpload} />}
                onClick={() => fileInputRef.current?.click()}
                disabled={extensionStatus?.isBuilding}
              >
                Install extension
              </Button>
            </ConditionalTooltip>

            <input type='file' accept='.zip' ref={fileInputRef} className='hidden' onChange={handleFileUpload} />
          </Group>
        </AdminCan>
      }
    >
      <BuildLogsModal opened={openModal === 'logs'} onClose={() => setOpenModal(null)} />
      <Modal opened={!!removalExtension} onClose={() => setRemovalExtension(null)} title='Remove extension'>
        <p>
          Are you sure you want to remove the extension <Code>{removalExtension?.metadataToml.packageName}</Code>? This
          action cannot be undone.
        </p>

        <Stack mt='md'>
          <Switch
            label='Do you want to remove & rollback the database migrations of this extension?'
            name='remove_migrations'
            defaultChecked={removeMigrations}
            onChange={(e) => setRemoveMigrations(e.target.checked)}
          />
        </Stack>

        <ModalFooter>
          <Button color='red'>Delete</Button>
          <Button variant='default' onClick={() => setRemovalExtension(null)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      <ExtensionInstallOverlay visible={isDragging} />

      {!backendExtensions ? (
        <Spinner.Centered />
      ) : installedCount === 0 ? (
        <span>
          No extensions installed.{' '}
          {!extensionStatus && (
            <span>
              You don't seem to be using the heavy image required to install extensions, see{' '}
              <a
                href='https://calagopus.com/docs/panel/extensions/switching-to-the-heavy-image'
                className='underline text-blue-400'
                target='_blank'
                rel='noopener noreferrer'
              >
                here
              </a>{' '}
              on how to switch to it.
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
                isRemoved={
                  extensionStatus?.removedExtensions.some(
                    (e) => e.metadataToml.packageName === extension.packageName,
                  ) && false
                }
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
              Pending extensions
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
                    ? 'The panel is currently building extension code. Please wait.'
                    : 'No pending extensions to build.'
                }
              >
                <Button
                  color='red'
                  leftSection={<FontAwesomeIcon icon={faRefresh} />}
                  loading={extensionStatus.isBuilding}
                  onClick={handleRebuild}
                >
                  Rebuild extensions
                </Button>
              </ConditionalTooltip>
            </AdminCan>
          </div>

          {!extensionStatus.pendingExtensions.length ? (
            <p className='text-sm text-zinc-500'>No pending extensions.</p>
          ) : (
            <div className='grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3'>
              {extensionStatus.pendingExtensions.map((extension) => (
                <ExtensionCard
                  key={extension.metadataToml.packageName}
                  backendExtension={extension}
                  isPending
                  onRemove={extensionStatus ? () => handleRemove(extension) : undefined}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </AdminContentContainer>
  );
}
