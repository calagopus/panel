import { faDoorOpen, faMagnifyingGlassChart, faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { join } from 'pathe';
import { ReactNode } from 'react';
import { createSearchParams, NavLink } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Breadcrumbs from '@/elements/data-display/Breadcrumbs.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { pathSegments } from '@/lib/path.ts';
import { useDraggedFileMove } from '@/pages/server/files/hooks/useDraggedFileMove.ts';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function FileBreadcrumbs({ path, inFileEditor }: { path: string; inFileEditor?: boolean }) {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const { isDropTarget, getDropHandlers } = useDraggedFileMove({ disabled: !!inFileEditor });
  const {
    selectedFilesCount,
    browsingBackup,
    browsingEntries,
    browsingPrimaryFilesystem,
    setBrowsingDirectory,
    anyActing,
    doSelectFiles,
    doOpenModal,
  } = useFileManager(
    useShallow((state) => ({
      selectedFilesCount: state.selectedFiles.size,
      browsingBackup: state.browsingBackup,
      browsingEntries: state.browsingEntries,
      browsingPrimaryFilesystem: state.browsingPrimaryFilesystem,
      setBrowsingDirectory: state.setBrowsingDirectory,
      anyActing: state.actingFiles.size > 0,
      doSelectFiles: state.doSelectFiles,
      doOpenModal: state.doOpenModal,
    })),
  );

  const splittedPath = path.split('/').filter(Boolean);
  const pathItems = pathSegments(path);

  const isBackupPath = path.startsWith('/.backups/');
  const backupUuid = isBackupPath ? (splittedPath[1] ?? '') : null;

  const breadcrumbClassName = (targetDirectory: string) =>
    classNames(
      'text-(--mantine-color-anchor) hover:underline rounded-sm',
      isDropTarget(targetDirectory) && 'bg-(--mantine-color-green-light)',
    );

  const items: ReactNode[] = [
    isBackupPath ? 'backups' : 'home',
    <NavLink
      key='first-segment'
      to={
        isBackupPath
          ? `/server/${server?.uuidShort}/files?${createSearchParams({
              directory: `/.backups/${backupUuid}`,
            })}`
          : `/server/${server?.uuidShort}/files`
      }
      className={breadcrumbClassName(isBackupPath ? `/.backups/${backupUuid}` : '/')}
      {...getDropHandlers(isBackupPath ? `/.backups/${backupUuid}` : '/')}
    >
      {isBackupPath ? (browsingBackup?.name ?? backupUuid) : 'container'}
    </NavLink>,
    ...pathItems.slice(isBackupPath ? 2 : 0).map((item, index) =>
      index === pathItems.length - 1 && inFileEditor ? (
        item.name
      ) : (
        <NavLink
          key={item.path}
          to={`/server/${server?.uuidShort}/files?${createSearchParams({ directory: join('/', item.path) })}`}
          className={breadcrumbClassName(join('/', item.path))}
          onClick={inFileEditor ? undefined : () => setBrowsingDirectory(join('/', item.path))}
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
          disabled={anyActing}
          checked={!inFileEditor && selectedFilesCount > 0 && selectedFilesCount >= browsingEntries.data.length}
          indeterminate={selectedFilesCount > 0 && selectedFilesCount < browsingEntries.data.length}
          className='mr-2'
          classNames={{ input: 'cursor-pointer!' }}
          hidden={inFileEditor}
          onChange={() => {
            if (selectedFilesCount >= browsingEntries.data.length) {
              doSelectFiles([]);
            } else {
              doSelectFiles(browsingEntries.data);
            }
          }}
        />
        {items}
      </Breadcrumbs>

      {!inFileEditor && (
        <div className='flex flex-row space-x-2'>
          <NavLink to={`/server/${server?.uuidShort}/files`} hidden={!isBackupPath}>
            <Button variant='light' leftSection={<FontAwesomeIcon icon={faDoorOpen} />}>
              {t('pages.server.files.button.exitBackup', {})}
            </Button>
          </NavLink>
          <span className='flex flex-row space-x-2'>
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
      )}
    </div>
  );
}
