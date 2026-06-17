import { faDoorOpen, faMagnifyingGlassChart, faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { join } from 'pathe';
import { ReactNode, useEffect } from 'react';
import { createSearchParams, NavLink } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import getBackup from '@/api/server/backups/getBackup.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Breadcrumbs from '@/elements/Breadcrumbs.tsx';
import Button from '@/elements/Button.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { useDraggedFileMove } from '@/pages/server/files/hooks/useDraggedFileMove.ts';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function FileBreadcrumbs({ path, inFileEditor }: { path: string; inFileEditor?: boolean }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const { isDropTarget, getDropHandlers } = useDraggedFileMove({ disabled: !!inFileEditor });
  const {
    selectedFiles,
    browsingBackup,
    browsingEntries,
    browsingPrimaryFilesystem,
    setBrowsingDirectory,
    actingFiles,
    doSelectFiles,
    setBrowsingBackup,
    doOpenModal,
  } = useFileManager();

  const splittedPath = path.split('/').filter(Boolean);
  const pathItems = splittedPath.map((item, index) => {
    return {
      name: item,
      path: splittedPath.slice(0, index + 1).join('/'),
    };
  });

  useEffect(() => {
    if (path.startsWith('/.backups/') && !browsingBackup) {
      let backupUuid = path.slice('/.backups/'.length);
      if (backupUuid.includes('/')) {
        backupUuid = backupUuid.slice(0, backupUuid.indexOf('/'));
      }

      getBackup(server.uuid, backupUuid)
        .then((data) => {
          setBrowsingBackup(data);
        })
        .catch((msg) => {
          addToast(httpErrorToHuman(msg), 'error');
        });
    } else if (!path.startsWith('/.backups/') && browsingBackup) {
      setBrowsingBackup(null);
    }
  }, [path, browsingBackup]);

  const breadcrumbClassName = (targetDirectory: string) =>
    classNames(
      'text-(--mantine-color-anchor) hover:underline rounded-sm',
      isDropTarget(targetDirectory) && 'bg-(--mantine-color-green-light)',
    );

  const items: ReactNode[] = [
    browsingBackup ? 'backups' : 'home',
    <NavLink
      key='first-segment'
      to={
        browsingBackup
          ? `/server/${server?.uuidShort}/files?${createSearchParams({
              directory: `/.backups/${browsingBackup.uuid}`,
            })}`
          : `/server/${server?.uuidShort}/files`
      }
      className={breadcrumbClassName(browsingBackup ? `/.backups/${browsingBackup.uuid}` : '/')}
      {...getDropHandlers(browsingBackup ? `/.backups/${browsingBackup.uuid}` : '/')}
    >
      {browsingBackup ? browsingBackup.name : 'container'}
    </NavLink>,
    ...pathItems.slice(browsingBackup ? 2 : 0).map((item, index) =>
      index === pathItems.length - 1 && inFileEditor ? (
        item.name
      ) : (
        <NavLink
          key={item.path}
          to={`/server/${server?.uuidShort}/files?${createSearchParams({ directory: join('/', item.path) })}`}
          className={breadcrumbClassName(join('/', item.path))}
          onClick={() => setBrowsingDirectory(item.path)}
          {...getDropHandlers(join('/', item.path))}
        >
          {item.name}
        </NavLink>
      ),
    ),
  ];

  return (
    <div
      id='file-breadcrumbs-inner'
      className='flex flex-col gap-4 sm:gap-0 sm:flex-row sm:items-center sm:justify-between'
    >
      <Breadcrumbs separatorMargin='xs'>
        <Checkbox
          disabled={actingFiles.size > 0}
          checked={!inFileEditor && selectedFiles.size > 0 && selectedFiles.size >= browsingEntries.data.length}
          indeterminate={selectedFiles.size > 0 && selectedFiles.size < browsingEntries.data.length}
          className='mr-2'
          classNames={{ input: 'cursor-pointer!' }}
          hidden={inFileEditor}
          onChange={() => {
            if (selectedFiles.size >= browsingEntries.data.length) {
              doSelectFiles([]);
            } else {
              doSelectFiles(browsingEntries.data);
            }
          }}
        />
        {items}
      </Breadcrumbs>

      <div className='flex flex-row space-x-2'>
        <NavLink to={`/server/${server?.uuidShort}/files`} hidden={!browsingBackup || inFileEditor}>
          <Button variant='light' leftSection={<FontAwesomeIcon icon={faDoorOpen} />}>
            {t('pages.server.files.button.exitBackup', {})}
          </Button>
        </NavLink>
        <span hidden={inFileEditor} className='flex flex-row space-x-2'>
          <Tooltip label={t('pages.server.files.tooltip.largestDirectories', {})}>
            <ActionIcon
              variant='light'
              size='input-sm'
              hidden={!browsingPrimaryFilesystem}
              onClick={() => doOpenModal('largestDirectories')}
            >
              <FontAwesomeIcon icon={faMagnifyingGlassChart} />
            </ActionIcon>
          </Tooltip>
          <Button
            variant='outline'
            leftSection={<FontAwesomeIcon icon={faSearch} />}
            onClick={() => doOpenModal('search')}
          >
            {t('pages.server.files.button.search', {})}
          </Button>
        </span>
      </div>
    </div>
  );
}
