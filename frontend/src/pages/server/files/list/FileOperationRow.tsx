import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { skipToken, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import getServer from '@/api/server/getServer.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import FailedOperationProgress from '@/elements/feedback/FailedOperationProgress.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { bytesProgressString } from '@/lib/format/size.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverFileOperationSchema } from '@/lib/schemas/server/files.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { FAILED_OPERATION_LINGER_MS } from '@/stores/slices/server/files.ts';

export default function FileOperationRow({
  uuid,
  operation,
  failedAt,
  onCancel,
  onRemove,
}: {
  uuid: string;
  operation: z.infer<typeof serverFileOperationSchema>;
  failedAt: number | undefined;
  onCancel: (uuid: string) => void;
  onRemove: (uuid: string) => void;
}) {
  const { t, tItem } = useTranslations();
  const serverUuid = useServerStore((state) => state.server.uuid);
  const canUpdate = useServerCan('files.update');

  const remoteServerUuid =
    operation.type === 'copy_remote'
      ? operation.destinationServer === serverUuid
        ? operation.server
        : operation.destinationServer
      : null;
  const { data: remoteServer } = useQuery({
    queryKey: queryKeys.user.servers.detail(remoteServerUuid ?? ''),
    queryFn: remoteServerUuid ? () => getServer(remoteServerUuid) : skipToken,
    staleTime: Infinity,
    retry: false,
  });

  const progress = (operation.bytesProcessed / operation.bytesTotal) * 100;

  return (
    <div className='flex flex-row items-center mb-2'>
      <div className='flex flex-col grow'>
        <p className='break-all mb-1'>
          {operation.type === 'compress'
            ? t('pages.server.files.operations.compressing', {
                files: tItem('file', operation.files.length),
                path: operation.path,
              })
            : operation.type === 'decompress'
              ? t('pages.server.files.operations.decompressing', { path: operation.path })
              : operation.type === 'pull'
                ? t('pages.server.files.operations.pulling', { destination: operation.destinationPath })
                : operation.type === 'copy'
                  ? t('pages.server.files.operations.copying', {
                      path: operation.path,
                      destination: operation.destinationPath,
                    })
                  : operation.type === 'copy_many'
                    ? t('pages.server.files.operations.copyingMany', {
                        files: tItem('file', operation.files.length),
                      })
                    : operation.type === 'copy_remote'
                      ? operation.destinationServer === serverUuid
                        ? remoteServer
                          ? t('pages.server.files.operations.receivingRemoteFrom', {
                              files: tItem('file', operation.files.length),
                              server: remoteServer.name,
                            })
                          : t('pages.server.files.operations.receivingRemote', {
                              files: tItem('file', operation.files.length),
                            })
                        : remoteServer
                          ? t('pages.server.files.operations.sendingRemoteTo', {
                              files: tItem('file', operation.files.length),
                              server: remoteServer.name,
                            })
                          : t('pages.server.files.operations.sendingRemote', {
                              files: tItem('file', operation.files.length),
                            })
                      : operation.type === 'export_backup'
                        ? t('pages.server.files.operations.exportingBackup', {
                            destination: operation.destinationPath,
                          })
                        : null}
        </p>
        {failedAt === undefined ? (
          <Tooltip
            label={`${bytesProgressString(operation.bytesProcessed, operation.bytesTotal)}${
              operation.type === 'compress' ||
              operation.type === 'decompress' ||
              operation.type === 'copy' ||
              operation.type === 'copy_remote' ||
              operation.type === 'copy_many'
                ? ` · ${tItem('file', operation.filesProcessed)}`
                : ''
            }`}
            innerClassName='w-full'
          >
            <Progress indeterminate={!operation.bytesTotal} value={progress} />
          </Tooltip>
        ) : (
          <FailedOperationProgress failedAt={failedAt} lingerMs={FAILED_OPERATION_LINGER_MS} />
        )}
      </div>
      {(failedAt !== undefined || canUpdate) && (
        <Tooltip label={failedAt === undefined ? t('common.button.cancel', {}) : t('common.button.close', {})}>
          <ActionIcon
            variant='light'
            color='red'
            className='ml-3'
            onClick={() => (failedAt === undefined ? onCancel(uuid) : onRemove(uuid))}
          >
            <FontAwesomeIcon icon={faXmark} size='sm' />
          </ActionIcon>
        </Tooltip>
      )}
    </div>
  );
}
