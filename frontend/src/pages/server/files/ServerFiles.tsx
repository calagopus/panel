import { faCheck, faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Menu, Title, UnstyledButton } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { join } from 'pathe';
import { type Ref, useCallback, useEffect, useRef, useState } from 'react';
import { createSearchParams, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import copyFile from '@/api/server/files/copyFile.ts';
import loadDirectory from '@/api/server/files/loadDirectory.ts';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Table from '@/elements/Table.tsx';
import { isEditableFile, isViewableArchive, isViewableImage } from '@/lib/files.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { FILE_COLUMNS, type FileSortColumn } from '@/providers/contexts/fileManagerContext.ts';
import FileActionBar from '@/pages/server/files/FileActionBar.tsx';
import FileBreadcrumbs from '@/pages/server/files/FileBreadcrumbs.tsx';
import FileModals from '@/pages/server/files/FileModals.tsx';
import FileOperationsProgress from '@/pages/server/files/FileOperationsProgress.tsx';
import FileRow from '@/pages/server/files/FileRow.tsx';
import FileSearchBanner from '@/pages/server/files/FileSearchBanner.tsx';
import FileSettings from '@/pages/server/files/FileSettings.tsx';
import FileToolbar from '@/pages/server/files/FileToolbar.tsx';
import FileUpload from '@/pages/server/files/FileUpload.tsx';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { FileManagerProvider } from '@/providers/FileManagerProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

function SortableHeader({
  column,
  label,
  active,
  direction,
  onSort,
}: {
  column: FileSortColumn;
  label: string;
  active: FileSortColumn | null;
  direction: 'asc' | 'desc';
  onSort: (column: FileSortColumn) => void;
}) {
  const isActive = active === column;

  return (
    <UnstyledButton onClick={() => onSort(column)} className='flex items-center gap-1 w-full font-normal'>
      <span>{label}</span>
      <FontAwesomeIcon
        icon={isActive ? (direction === 'asc' ? faSortUp : faSortDown) : faSort}
        size='sm'
        className={isActive ? 'text-white' : 'text-gray-500'}
      />
    </UnstyledButton>
  );
}

function ServerFilesComponent() {
  const { t } = useTranslations();
  const { settings } = useGlobalStore();
  const { server } = useServerStore();
  const {
    actingFiles,
    actingFilesSource,
    selectedFiles,
    browsingDirectory,
    browsingEntries,
    page,
    openModal,
    browsingFastDirectory,
    browsingWritableDirectory,
    sortColumn,
    setSortColumn,
    sortDirection,
    setSortDirection,
    visibleColumns,
    toggleColumn,
    doSelectFiles,
    setBrowsingEntries,
    setBrowsingWritableDirectory,
    setBrowsingFastDirectory,
    doOpenModal,
  } = useFileManager();
  const { addToast } = useToast();
  const [_, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const canOpenFile = useServerCan('files.read-content');
  const typeAheadBuffer = useRef('');
  const typeAheadTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const [columnMenu, setColumnMenu] = useState<{ opened: boolean; x: number; y: number }>({ opened: false, x: 0, y: 0 });

  const handleSort = (column: FileSortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        // Third click — disable sorting
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedEntries = sortColumn
    ? [...browsingEntries.data].sort((a, b) => {
        // Directories always come first
        if (a.directory !== b.directory) return a.directory ? -1 : 1;

        let cmp = 0;
        switch (sortColumn) {
          case 'name':
            cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            break;
          case 'size':
            cmp = a.size - b.size;
            break;
          case 'modified':
            cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
            break;
          case 'created':
            cmp = new Date(a.created).getTime() - new Date(b.created).getTime();
            break;
          case 'type': {
            const extA = a.directory ? '' : (a.name.includes('.') ? a.name.split('.').pop()! : '');
            const extB = b.directory ? '' : (b.name.includes('.') ? b.name.split('.').pop()! : '');
            cmp = extA.localeCompare(extB, undefined, { sensitivity: 'base' });
            break;
          }
          case 'mime':
            cmp = a.mime.localeCompare(b.mime, undefined, { sensitivity: 'base' });
            break;
          case 'permissions':
            cmp = a.mode.localeCompare(b.mode);
            break;
        }

        return sortDirection === 'asc' ? cmp : -cmp;
      })
    : browsingEntries.data;

  const { data, isLoading } = useQuery({
    queryKey: ['server', server.uuid, 'files', { browsingDirectory, page }],
    queryFn: () => loadDirectory(server.uuid, browsingDirectory, page),
  });

  useEffect(() => {
    if (!data) return;

    setBrowsingEntries(data.entries);
    setBrowsingWritableDirectory(data.isFilesystemWritable);
    setBrowsingFastDirectory(data.isFilesystemFast);
  }, [data]);

  const resetEntries = () => {
    if (!data) return;

    setBrowsingEntries(data.entries);
  };

  const previousSelected = useRef<z.infer<typeof serverDirectoryEntrySchema>[]>([]);

  const onSelectedStart = (event: React.MouseEvent | MouseEvent) => {
    previousSelected.current = event.shiftKey ? selectedFiles.values() : [];
  };

  const onSelected = (selected: z.infer<typeof serverDirectoryEntrySchema>[]) => {
    doSelectFiles([...previousSelected.current, ...selected.values()]);
  };

  const onPageSelect = (page: number) => setSearchParams({ directory: browsingDirectory, page: page.toString() });

  const handleOpen = useCallback(
    (file: z.infer<typeof serverDirectoryEntrySchema>) => {
      if (
        isEditableFile(file) ||
        isViewableImage(file) ||
        file.directory ||
        (isViewableArchive(file) && browsingFastDirectory)
      ) {
        if (typeAheadTimeout.current) clearTimeout(typeAheadTimeout.current);
        typeAheadBuffer.current = '';

        if (file.directory || (isViewableArchive(file) && browsingFastDirectory)) {
          setSearchParams({
            directory: join(browsingDirectory, file.name),
          });
        } else {
          if (!canOpenFile) return;

          navigate(
            `/server/${server.uuidShort}/files/${isViewableImage(file) ? 'image' : 'edit'}?${createSearchParams({
              directory: browsingDirectory,
              file: file.name,
            })}`,
          );
        }
      }
    },
    [server.uuidShort, settings, browsingDirectory, browsingFastDirectory, canOpenFile],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || openModal !== null) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key.length !== 1) return;

      e.preventDefault();

      if (typeAheadTimeout.current) clearTimeout(typeAheadTimeout.current);
      typeAheadBuffer.current += e.key.toLowerCase();

      const match = browsingEntries.data.find((entry) => entry.name.toLowerCase().startsWith(typeAheadBuffer.current));

      if (match) {
        doSelectFiles([match]);
      }

      typeAheadTimeout.current = setTimeout(() => {
        typeAheadBuffer.current = '';
      }, 1000);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (typeAheadTimeout.current) clearTimeout(typeAheadTimeout.current);
    };
  }, [browsingEntries.data, openModal, doSelectFiles]);

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: () => doSelectFiles(browsingEntries.data),
      },
      {
        key: 'k',
        modifiers: ['ctrlOrMeta'],
        callback: () => doOpenModal('search'),
      },
      {
        key: 'ArrowUp',
        callback: () => {
          if (selectedFiles.size === 0) return;

          const selectedIndices = selectedFiles
            .keys()
            .map((file) => browsingEntries.data.findIndex((value) => value.name === file))
            .filter((index) => index !== -1);

          if (selectedIndices.length === 0) return;

          const nextFiles = selectedIndices.map((index) => {
            const newIndex = (index - 1 + browsingEntries.data.length) % browsingEntries.data.length;
            return browsingEntries.data[newIndex];
          });

          doSelectFiles(nextFiles);
        },
      },
      {
        key: 'ArrowDown',
        callback: () => {
          if (selectedFiles.size === 0) return;

          const selectedIndices = selectedFiles
            .keys()
            .map((file) => browsingEntries.data.findIndex((value) => value.name === file))
            .filter((index) => index !== -1);

          if (selectedIndices.length === 0) return;

          const nextFiles = selectedIndices.map((index) => {
            const newIndex = (index + 1) % browsingEntries.data.length;
            return browsingEntries.data[newIndex];
          });

          doSelectFiles(nextFiles);
        },
      },
      {
        key: 'ArrowUp',
        modifiers: ['alt'],
        callback: () =>
          setSearchParams({
            directory: join(browsingDirectory, '..'),
          }),
      },
      {
        key: 'd',
        callback: () => {
          if (selectedFiles.size === 1 && browsingWritableDirectory) {
            const file = selectedFiles.values()[0];

            copyFile(server.uuid, join(browsingDirectory, file.name), null)
              .then(() => {
                addToast(t('pages.server.files.toast.fileCopyingStarted', {}), 'success');
              })
              .catch((msg) => {
                addToast(httpErrorToHuman(msg), 'error');
              });
          }
        },
      },
      {
        key: 'f2',
        callback: () => {
          if (selectedFiles.size === 1 && browsingWritableDirectory) {
            doOpenModal('rename', [selectedFiles.values()[0]]);
          }
        },
      },
      {
        key: 'Enter',
        callback: () => {
          if (selectedFiles.size === 1 && openModal === null) {
            handleOpen(selectedFiles.values()[0]);
          }
        },
      },
    ],
    deps: [browsingEntries.data, selectedFiles, handleOpen, browsingWritableDirectory],
  });

  return (
    <div className='h-fit relative'>
      <FileModals />
      <FileUpload />
      <FileActionBar />

      <Group justify='space-between' align='center' mb='md'>
        <Group>
          <Title order={1} c='white'>
            {t('pages.server.files.title', {})}
          </Title>

          <FileSettings />
        </Group>
        <Group>
          <FileOperationsProgress />
          <FileToolbar />
        </Group>
      </Group>

      <div className='bg-[#282828] border border-[#424242] rounded-lg mb-2 p-4'>
        <FileBreadcrumbs path={decodeURIComponent(browsingDirectory)} />
      </div>

      <FileSearchBanner resetEntries={resetEntries} />

      {!data || isLoading ? (
        <Spinner.Centered />
      ) : (
        <SelectionArea onSelectedStart={onSelectedStart} onSelected={onSelected} fireEvents={false} className='h-full'>
          <ContextMenuProvider>
            <Table
              columns={
                window.innerWidth < 768
                  ? ['', t('common.table.columns.name', {}), t('common.table.columns.size', {}), '']
                  : ['', ...FILE_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((c) => c.label), '']
              }
              columnHeaders={
                window.innerWidth < 768
                  ? undefined
                  : [
                      undefined,
                      ...FILE_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((c) =>
                        c.sortable ? (
                          <SortableHeader key={c.key} column={c.key} label={c.label} active={sortColumn} direction={sortDirection} onSort={handleSort} />
                        ) : undefined,
                      ),
                      undefined,
                    ]
              }
              pagination={browsingEntries}
              onPageSelect={onPageSelect}
              onHeaderContextMenu={(e) => {
                e.preventDefault();
                setColumnMenu({ opened: true, x: e.clientX, y: e.clientY });
              }}
              allowSelect={false}
            >
              {sortedEntries.map((entry) => (
                <SelectionArea.Selectable key={entry.name} item={entry}>
                  {(innerRef: Ref<HTMLElement>) => (
                    <FileRow
                      ref={innerRef as Ref<HTMLTableRowElement>}
                      file={entry}
                      handleOpen={() => handleOpen(entry)}
                      isSelected={selectedFiles.has(entry)}
                      isActing={actingFiles.has(entry) && actingFilesSource === browsingDirectory}
                      multipleSelected={selectedFiles.size > 1}
                      visibleColumns={visibleColumns}
                    />
                  )}
                </SelectionArea.Selectable>
              ))}
            </Table>
          </ContextMenuProvider>
        </SelectionArea>
      )}

      <Menu
        opened={columnMenu.opened}
        onClose={() => setColumnMenu((s) => ({ ...s, opened: false }))}
        shadow='md'
        width={200}
        withinPortal
        closeOnClickOutside
        transitionProps={{ transition: 'scale-y', duration: 200 }}
      >
        <Menu.Target>
          <div
            style={{
              position: 'fixed',
              top: columnMenu.y,
              left: columnMenu.x,
              width: 1,
              height: 1,
              pointerEvents: 'none',
            }}
          />
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Visible Columns</Menu.Label>
          {FILE_COLUMNS.map((col) => (
            <Menu.Item
              key={col.key}
              disabled={col.alwaysVisible}
              leftSection={
                visibleColumns.includes(col.key) ? (
                  <FontAwesomeIcon icon={faCheck} size='sm' />
                ) : (
                  <span className='w-[14px]' />
                )
              }
              onClick={() => toggleColumn(col.key)}
            >
              {col.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}

export default function ServerFiles() {
  const { t } = useTranslations();

  return (
    <ServerContentContainer
      title={t('pages.server.files.title', {})}
      hideTitleComponent
      registry={window.extensionContext.extensionRegistry.pages.server.files.container}
    >
      <FileManagerProvider>
        <ServerFilesComponent />
      </FileManagerProvider>
    </ServerContentContainer>
  );
}
