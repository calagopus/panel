import { faArrowsLeftRight, faCodeCompare, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { DrawerProps, ScrollArea, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { createSearchParams, useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileRevisionContent from '@/api/server/files/getFileRevisionContent.ts';
import getFileRevisions from '@/api/server/files/getFileRevisions.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Badge from '@/elements/Badge.tsx';
import Card from '@/elements/Card.tsx';
import Drawer from '@/elements/Drawer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverFileRevisionSchema } from '@/lib/schemas/server/files.ts';
import { bytesToString } from '@/lib/size.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

interface Props extends DrawerProps {
  filePath: string;
  onRestore: (content: string) => void;
  getContent?: () => string | undefined;
}

function RevisionRow({
  revision,
  filePath,
  previousRevisionId,
  onRestore,
  getContent,
}: {
  revision: z.infer<typeof serverFileRevisionSchema>;
  filePath: string;
  previousRevisionId: number | null;
  onRestore: (content: string) => void;
  getContent?: () => string | undefined;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const server = useServerStore((state) => state.server);
  const [loading, setLoading] = useState(false);

  const handleRestore = () => {
    setLoading(true);
    getFileRevisionContent(server.uuid, revision.id)
      .then((content) => {
        onRestore(content);
        addToast(t('pages.server.files.drawer.revisions.restored', {}), 'success');
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setLoading(false));
  };

  const handleViewDiff = () => {
    const currentContent = getContent?.();
    navigate(
      `/server/${server.uuidShort}/files/diff?${createSearchParams({
        file: filePath,
        revision: String(revision.id),
      })}`,
      currentContent !== undefined ? { state: { currentContent } } : undefined,
    );
  };

  const handleCompareToPrevious = () => {
    navigate(
      `/server/${server.uuidShort}/files/diff?${createSearchParams({
        file: filePath,
        revision: String(revision.id),
        previousRevision: String(previousRevisionId),
      })}`,
    );
  };

  return (
    <Card className='p-3 rounded-md border border-gray-700'>
      <div className='flex items-start gap-3'>
        <img
          src={revision.user?.avatar ?? '/icon.svg'}
          alt={revision.user?.username ?? t('common.system', {})}
          className='size-6 rounded-full shrink-0 mt-0.5'
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/icon.svg';
          }}
        />
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 mb-1'>
            <span className='text-sm font-medium'>#{revision.id}</span>
            {revision.isSnapshot && (
              <Badge size='xs' variant='light' color='blue'>
                {t('pages.server.files.drawer.revisions.badge.fullSnapshot', {})}
              </Badge>
            )}
          </div>
          <div className='flex items-center gap-2 text-xs text-gray-400'>
            <span>{revision.user?.username ?? t('common.system', {})}</span>
            <span>•</span>
            <FormattedTimestamp timestamp={revision.created} />
            <span>•</span>
            <span>{bytesToString(revision.size)}</span>
          </div>
        </div>
        <div className='flex items-center gap-1'>
          <Tooltip label={t('pages.server.files.drawer.revisions.tooltip.viewDiff', {})}>
            <ActionIcon size='sm' variant='subtle' color='gray' onClick={handleViewDiff}>
              <FontAwesomeIcon icon={faCodeCompare} />
            </ActionIcon>
          </Tooltip>
          {previousRevisionId !== null && (
            <Tooltip label={t('pages.server.files.drawer.revisions.tooltip.compareToPrevious', {})}>
              <ActionIcon size='sm' variant='subtle' color='gray' onClick={handleCompareToPrevious}>
                <FontAwesomeIcon icon={faArrowsLeftRight} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label={t('pages.server.files.drawer.revisions.tooltip.restore', {})}>
            <ActionIcon size='sm' variant='subtle' color='gray' loading={loading} onClick={handleRestore}>
              <FontAwesomeIcon icon={faRotateLeft} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
}

export default function FileRevisionsDrawer({ filePath, onRestore, getContent, opened, onClose, ...props }: Props) {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const { data: revisions, isLoading } = useQuery({
    queryKey: queryKeys.server(server.uuid).files.fileRevisions(filePath),
    queryFn: () => getFileRevisions(server.uuid, filePath),
    enabled: opened && !!filePath,
  });

  return (
    <Drawer
      position='right'
      offset={8}
      radius='md'
      opened={opened}
      onClose={onClose}
      title={t('pages.server.files.drawer.revisions.title', {})}
      size='lg'
      {...props}
    >
      <Stack gap='md' className='h-full'>
        <ScrollArea className='flex-1' offsetScrollbars>
          {isLoading ? (
            <Spinner.Centered />
          ) : !revisions || revisions.length === 0 ? (
            <div className='flex items-center justify-center py-12 text-gray-400'>
              {t('pages.server.files.drawer.revisions.noRevisions', {})}
            </div>
          ) : (
            <Stack gap='xs'>
              {revisions.map((revision, index) => (
                <RevisionRow
                  key={revision.id}
                  revision={revision}
                  filePath={filePath}
                  previousRevisionId={revisions[index + 1]?.id ?? null}
                  getContent={getContent}
                  onRestore={(content) => {
                    onRestore(content);
                    onClose();
                  }}
                />
              ))}
            </Stack>
          )}
        </ScrollArea>
      </Stack>
    </Drawer>
  );
}
