import {
  faCheck,
  faChevronLeft,
  faChevronRight,
  faFolder,
  faFolderPlus,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Anchor } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { join } from 'pathe';
import { useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import createDirectory from '@/api/server/files/createDirectory.ts';
import loadDirectory from '@/api/server/files/loadDirectory.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Breadcrumbs from '@/elements/Breadcrumbs.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DirectoryBrowser({
  serverUuid,
  path,
  onNavigate,
  withCreateDirectory = false,
}: {
  serverUuid: string;
  path: string;
  onNavigate: (path: string) => void;
  withCreateDirectory?: boolean;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [pagination, setPagination] = useState({ serverUuid, path, page: 1 });
  const page = pagination.serverUuid === serverUuid && pagination.path === path ? pagination.page : 1;

  const [newDirectory, setNewDirectory] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, loading: isLoading } = useResource({
    queryKey: ['directory-browser', serverUuid, path, page],
    queryFn: () => loadDirectory(serverUuid, path, page, 'name_asc'),
    keepPrevious: true,
  });

  const pathSegments = path.split('/').filter(Boolean);
  const directories = data?.entries.data.filter((entry) => entry.directory) ?? [];
  const hasNextPage = !!data && directories.length === data.entries.perPage;
  const canCreateDirectory = withCreateDirectory && !!data?.isFilesystemWritable;

  const handleCreateDirectory = async () => {
    const name = newDirectory?.trim();
    if (!name) return;

    setCreating(true);
    try {
      await createDirectory(serverUuid, path, name);
      queryClient.invalidateQueries({ queryKey: ['directory-browser', serverUuid] });
      queryClient.invalidateQueries({ queryKey: queryKeys.server(serverUuid).files.all() });
      setNewDirectory(null);
      onNavigate(join(path, name));
    } catch (error) {
      addToast(httpErrorToHuman(error), 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className='border border-(--mantine-color-default-border) rounded-md overflow-hidden'>
      <div className='flex items-center gap-2 px-3 py-2 border-b border-(--mantine-color-default-border) bg-(--mantine-color-body)'>
        {canCreateDirectory && newDirectory !== null ? (
          <>
            <TextInput
              size='xs'
              autoFocus
              className='grow'
              styles={{ input: { height: 'calc(1.375rem * var(--mantine-scale))', minHeight: 0 } }}
              placeholder={t('common.form.directoryName', {})}
              value={newDirectory}
              onChange={(event) => setNewDirectory(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleCreateDirectory();
                }
              }}
            />

            <ActionIcon
              variant='subtle'
              color='green'
              size='sm'
              loading={creating}
              disabled={!newDirectory.trim()}
              onClick={handleCreateDirectory}
            >
              <FontAwesomeIcon icon={faCheck} />
            </ActionIcon>

            <ActionIcon variant='subtle' color='gray' size='sm' onClick={() => setNewDirectory(null)}>
              <FontAwesomeIcon icon={faXmark} />
            </ActionIcon>
          </>
        ) : (
          <>
            <Breadcrumbs separatorMargin='xs' className='grow'>
              <Anchor component='button' type='button' size='sm' onClick={() => onNavigate('/')}>
                container
              </Anchor>
              {pathSegments.map((seg, i) => {
                const segPath = '/' + pathSegments.slice(0, i + 1).join('/');
                return i === pathSegments.length - 1 ? (
                  <span key={segPath} className='text-sm'>
                    {seg}
                  </span>
                ) : (
                  <Anchor component='button' type='button' key={segPath} size='sm' onClick={() => onNavigate(segPath)}>
                    {seg}
                  </Anchor>
                );
              })}
            </Breadcrumbs>

            {canCreateDirectory && (
              <ActionIcon
                variant='subtle'
                color='gray'
                size='sm'
                title={t('pages.server.files.modal.createDirectory.title', {})}
                onClick={() => setNewDirectory('')}
              >
                <FontAwesomeIcon icon={faFolderPlus} />
              </ActionIcon>
            )}
          </>
        )}
      </div>

      <div className='overflow-y-auto max-h-52 bg-(--mantine-color-default)'>
        {isLoading ? (
          <Spinner.Centered size={20} />
        ) : directories.length === 0 ? (
          <p className='text-sm text-(--mantine-color-dimmed) px-3 py-2'>{t('common.label.noSubdirectories', {})}</p>
        ) : (
          directories.map((entry) => (
            <button
              key={entry.name}
              type='button'
              onClick={() => onNavigate(join(path, entry.name))}
              className='w-full flex items-center gap-3 px-3 py-1.5 text-sm text-left hover:bg-(--mantine-color-default-hover)'
            >
              <FontAwesomeIcon icon={faFolder} className='text-(--mantine-color-dimmed)' />
              <span className='truncate'>{entry.name}</span>
            </button>
          ))
        )}
      </div>

      {(page > 1 || hasNextPage) && (
        <div className='flex items-center justify-between gap-2 px-3 py-1.5 border-t border-(--mantine-color-default-border) bg-(--mantine-color-body)'>
          <ActionIcon
            variant='subtle'
            color='gray'
            size='sm'
            disabled={page <= 1}
            onClick={() => setPagination({ serverUuid, path, page: page - 1 })}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </ActionIcon>

          <p className='text-xs text-(--mantine-color-dimmed)'>{t('common.label.page', { page })}</p>

          <ActionIcon
            variant='subtle'
            color='gray'
            size='sm'
            disabled={!hasNextPage}
            onClick={() => setPagination({ serverUuid, path, page: page + 1 })}
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </ActionIcon>
        </div>
      )}
    </div>
  );
}
