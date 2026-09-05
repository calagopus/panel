import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { uploadDestinationPath } from '@/lib/files/uploadDestination.ts';
import { cancelAllUploads } from '@/lib/files/uploadManager.ts';
import { ToastType } from '@/providers/contexts/toastContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { UploadDestination, uploadScopeKey, useUploadsStore } from '@/stores/uploads.ts';

interface UploadProgressGroup {
  destination: UploadDestination;
  activeCount: number;
  totalSize: number;
  uploadedSize: number;
  hasError: boolean;
  isRateLimited: boolean;
}

export function useUploadProgressToasts() {
  const { t, tItem } = useTranslations();
  const { addProgressToast, updateToast, dismissToast } = useToast();
  const navigate = useNavigate();
  const uploads = useUploadsStore((state) => state.uploads);

  const groups = useMemo(() => {
    const map = new Map<string, UploadProgressGroup>();

    uploads.forEach((item) => {
      const scope = uploadScopeKey(item.destination);
      let group = map.get(scope);
      if (!group) {
        group = {
          destination: item.destination,
          activeCount: 0,
          totalSize: 0,
          uploadedSize: 0,
          hasError: false,
          isRateLimited: false,
        };
        map.set(scope, group);
      }

      group.totalSize += item.size;
      group.uploadedSize += item.uploaded;

      if (item.status === 'pending' || item.status === 'uploading') group.activeCount++;
      if (item.status === 'error') group.hasError = true;
      if (item.retryAttempt > 0 && item.status === 'uploading') group.isRateLimited = true;
    });

    return map;
  }, [uploads]);

  const raised = useRef(new Map<string, { id: number; message: string }>());

  useEffect(() => {
    for (const [scope, group] of groups) {
      if (group.activeCount === 0) continue;

      const message =
        group.destination.type === 'server'
          ? t('elements.fileUpload.toast.progressServer', {
              files: tItem('file', group.activeCount),
              server: group.destination.serverName,
            })
          : t('elements.fileUpload.toast.progressAssets', { files: tItem('file', group.activeCount) });

      const type: ToastType = group.hasError ? 'error' : group.isRateLimited ? 'warning' : 'info';
      const progress = group.totalSize > 0 ? Math.round((group.uploadedSize / group.totalSize) * 1000) / 10 : null;

      const existing = raised.current.get(scope);
      if (existing) {
        updateToast(existing.id, {
          message: existing.message === message ? undefined : message.md(),
          type,
          progress,
        });
        existing.message = message;
        continue;
      }

      const id = addProgressToast(message.md(), {
        type,
        progress,
        withCloseButton: true,
        onClose: () => cancelAllUploads(scope),
        actions: [
          {
            name: t('elements.fileUpload.toast.showFiles', {}),
            icon: faFolderOpen,
            onClick: () => navigate(uploadDestinationPath(group.destination)),
          },
        ],
      });

      raised.current.set(scope, { id, message });
    }

    for (const [scope, entry] of raised.current) {
      if (groups.get(scope)?.activeCount) continue;

      dismissToast(entry.id);
      raised.current.delete(scope);
    }
  }, [groups]);

  useEffect(() => {
    const tracked = raised.current;

    return () => {
      for (const entry of tracked.values()) {
        dismissToast(entry.id);
      }

      tracked.clear();
    };
  }, []);
}
