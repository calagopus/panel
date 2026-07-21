import { faChevronDown, faChevronUp, faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Card from '@/elements/Card.tsx';
import CloseButton from '@/elements/CloseButton.tsx';
import Progress from '@/elements/Progress.tsx';
import RingProgress from '@/elements/RingProgress.tsx';
import Text from '@/elements/Text.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { bytesToString } from '@/lib/size.ts';
import {
  cancelAllUploads,
  cancelFileUpload,
  cancelFolderUpload,
  getFolderFileCount,
  setUploadManagerExternals,
} from '@/lib/uploadManager.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import {
  AggregatedUploadProgress,
  UploadDestination,
  UploadItem,
  uploadScopeKey,
  useUploadsStore,
} from '@/stores/uploads.ts';

function destinationPath(destination: UploadDestination): string {
  return destination.type === 'server'
    ? `/server/${destination.routeId}/files?directory=${encodeURIComponent(destination.directory)}`
    : `/admin/assets${destination.directory ? `?directory=${encodeURIComponent(destination.directory)}` : ''}`;
}

function isCoveredByPage(pathname: string, destination: UploadDestination): boolean {
  const normalized = pathname.replace(/\/+$/, '');
  return destination.type === 'server'
    ? normalized === `/server/${destination.routeId}/files`
    : normalized === '/admin/assets';
}

interface UploadGroup {
  destination: UploadDestination;
  files: Array<[string, UploadItem]>;
  folders: Map<string, AggregatedUploadProgress>;
  totalSize: number;
  uploadedSize: number;
}

export default function UploadsCard() {
  const { t, tItem } = useTranslations();
  const { addToast, toastPosition } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const uploads = useUploadsStore((state) => state.uploads);

  const [collapsed, setCollapsed] = useState(false);

  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    setUploadManagerExternals({
      queryClient,
      addToast,
      onUploadsComplete: (destination, fileCount) => {
        if (isCoveredByPage(locationRef.current.pathname, destination)) return;

        const message =
          destination.type === 'server'
            ? t('elements.fileUpload.toast.completedServer', {
                files: tItem('file', fileCount),
                server: destination.serverName,
              })
            : t('elements.fileUpload.toast.completedAssets', { files: tItem('file', fileCount) });

        addToast(message.md(), 'success', [
          {
            name: t('elements.fileUpload.toast.showFiles', {}),
            icon: faFolderOpen,
            onClick: () => navigate(destinationPath(destination)),
          },
        ]);
      },
    });
  }, [queryClient, addToast, navigate, t, tItem]);

  const groups = useMemo(() => {
    const map = new Map<string, UploadGroup>();

    uploads.forEach((item, key) => {
      if (isCoveredByPage(location.pathname, item.destination)) return;

      const scope = uploadScopeKey(item.destination);
      let group = map.get(scope);
      if (!group) {
        group = { destination: item.destination, files: [], folders: new Map(), totalSize: 0, uploadedSize: 0 };
        map.set(scope, group);
      }

      group.files.push([key, item]);
      group.totalSize += item.size;
      group.uploadedSize += item.uploaded;

      const parts = item.filePath.split('/');
      if (parts.length < 2) return;

      const folder = parts[0];
      const prev = group.folders.get(folder) ?? {
        totalSize: 0,
        uploadedSize: 0,
        fileCount: getFolderFileCount(scope, folder),
        erroredCount: 0,
        activeCount: 0,
      };
      group.folders.set(folder, {
        ...prev,
        totalSize: prev.totalSize + item.size,
        uploadedSize: prev.uploadedSize + item.uploaded,
        erroredCount: prev.erroredCount + (item.status === 'error' ? 1 : 0),
        activeCount: prev.activeCount + (item.status === 'pending' || item.status === 'uploading' ? 1 : 0),
      });
    });

    return map;
  }, [uploads, location.pathname]);

  const { totalFiles, overallProgress, isRateLimited, hasErrors } = useMemo(() => {
    let totalFiles = 0;
    let totalSize = 0;
    let uploadedSize = 0;
    let isRateLimited = false;
    let hasErrors = false;

    groups.forEach((group) => {
      totalFiles += group.files.length;
      totalSize += group.totalSize;
      uploadedSize += group.uploadedSize;

      for (const [, file] of group.files) {
        if (file.retryAttempt > 0 && file.status === 'uploading') isRateLimited = true;
        if (file.status === 'error') hasErrors = true;
      }
    });

    return {
      totalFiles,
      overallProgress: totalSize > 0 ? (uploadedSize / totalSize) * 100 : 0,
      isRateLimited,
      hasErrors,
    };
  }, [groups]);

  if (groups.size === 0) return null;

  return (
    <Card
      shadow='lg'
      padding='sm'
      withBorder
      className={classNames(
        'fixed bottom-4 z-998 w-80 max-h-96 overflow-y-auto',
        toastPosition === 'bottom_right' ? 'left-4' : 'right-4',
      )}
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <RingProgress
            size={36}
            thickness={3}
            roundCaps
            sections={[{ value: overallProgress, color: hasErrors ? 'red' : isRateLimited ? 'orange' : 'green' }]}
          />
          <Text fw={600} size='sm'>
            {t('elements.fileUpload.title', { files: tItem('file', totalFiles) })}
          </Text>
        </div>
        <ActionIcon variant='subtle' color='gray' onClick={() => setCollapsed((prev) => !prev)}>
          <FontAwesomeIcon icon={collapsed ? faChevronUp : faChevronDown} size='sm' />
        </ActionIcon>
      </div>

      {!collapsed && isRateLimited && (
        <Text size='xs' c='orange' mt='xs'>
          {t('elements.fileUpload.rateLimited', {})}
        </Text>
      )}

      {!collapsed &&
        Array.from(groups).map(([scope, group]) => (
          <div key={scope} className='mt-3'>
            <div className='flex items-center justify-between mb-1'>
              <Text size='xs' c='dimmed' className='break-all'>
                {group.destination.type === 'server'
                  ? group.destination.serverName
                  : t('elements.fileUpload.adminAssets', {})}
              </Text>
              <Tooltip label={t('elements.fileUpload.cancelAllUploads', {})}>
                <CloseButton size='sm' onClick={() => cancelAllUploads(scope)} />
              </Tooltip>
            </div>

            {Array.from(group.folders).map(([folderName, info]) => {
              const progress = info.totalSize > 0 ? (info.uploadedSize / info.totalSize) * 100 : 0;
              const failed = info.erroredCount > 0 && info.activeCount === 0;

              return (
                <div key={folderName} className='flex flex-row items-center mb-2'>
                  <div className='flex flex-col grow'>
                    <p className='break-all mb-1 text-sm'>
                      {failed
                        ? t('elements.fileUpload.failedFolder', {
                            folder: folderName,
                            files: tItem('file', info.erroredCount),
                          })
                        : t('elements.fileUpload.uploadingFolder', {
                            folder: folderName,
                            files: tItem('file', info.fileCount),
                          })}
                    </p>
                    <Tooltip
                      label={`${bytesToString(info.uploadedSize)} / ${bytesToString(info.totalSize)}`}
                      innerClassName='w-full'
                    >
                      <Progress
                        value={progress}
                        color={info.erroredCount > 0 ? 'red' : isRateLimited ? 'orange' : undefined}
                      />
                    </Tooltip>
                  </div>
                  <CloseButton className='ml-3' onClick={() => cancelFolderUpload(scope, folderName)} />
                </div>
              );
            })}

            {group.files.map(([key, file]) => {
              if (group.folders.size > 0 && file.filePath.includes('/')) {
                return null;
              }

              return (
                <div key={key} className='flex flex-row items-center mb-2'>
                  <div className='flex flex-col grow'>
                    <p className='break-all mb-1 text-sm'>
                      {file.status === 'error'
                        ? t('elements.fileUpload.failed', { file: file.filePath })
                        : file.status === 'pending'
                          ? t('elements.fileUpload.waiting', { file: file.filePath })
                          : t('elements.fileUpload.uploading', { file: file.filePath })}
                    </p>
                    <Tooltip
                      label={`${bytesToString(file.uploaded)} / ${bytesToString(file.size)}`}
                      innerClassName='w-full'
                    >
                      <Progress
                        value={file.progress}
                        color={file.status === 'error' ? 'red' : isRateLimited ? 'orange' : undefined}
                      />
                    </Tooltip>
                  </div>
                  <CloseButton className='ml-3' onClick={() => cancelFileUpload(key)} />
                </div>
              );
            })}
          </div>
        ))}
    </Card>
  );
}
