import { faArrowUp, faFolderPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { Ref, useCallback, useEffect, useRef, useState } from 'react';
import { createSearchParams, useSearchParams } from 'react-router';
import getAssets from '@/api/admin/assets/getAssets.ts';
import searchAssets from '@/api/admin/assets/searchAssets.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Table from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import { parentPath } from '@/lib/path.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/quickActions/coreQuickActions.tsx';
import { StorageAsset } from '@/lib/schemas/admin/assets.ts';
import { assetTableColumns } from '@/lib/tableColumns.ts';
import AssetUpload from '@/pages/admin/assets/AssetUpload.tsx';
import AssetUploadProgress from '@/pages/admin/assets/AssetUploadProgress.tsx';
import { useAssetSelection } from '@/pages/admin/assets/hooks/useAssetSelection.ts';
import { useUploader } from '@/plugins/import/useUploader.ts';
import { useKeyboardShortcuts } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { useQuickActions } from '@/plugins/quick-actions/useQuickActions.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useSelectionArea } from '@/plugins/selection/useSelectionArea.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AssetActionBar from './AssetActionBar.tsx';
import AssetBreadcrumbs from './AssetBreadcrumbs.tsx';
import AssetRow from './AssetRow.tsx';
import NewDirectoryModal from './NewDirectoryModal.tsx';

interface AssetsQueryData {
  assets: StorageAsset[];
  pagination?: Pagination<StorageAsset>;
}

export default function AdminAssets() {
  const { t } = useTranslations();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentDirectory = searchParams.get('directory') ?? '';

  const [openModal, setOpenModal] = useState<'newDirectory' | null>(null);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable<AssetsQueryData>({
    queryKey: queryKeys.admin.assets.all(),
    deps: [currentDirectory],
    paginationKey: 'pagination',
    fetcher: (requestedPage, query) =>
      query
        ? searchAssets(currentDirectory, query).then((assets) => ({ assets }))
        : getAssets(requestedPage, currentDirectory).then((pagination) => ({ assets: pagination.data, pagination })),
  });

  const assets = data?.assets;

  const selection = useAssetSelection(assets);

  const invalidateAssets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.assets.all() }).catch((e) => console.error(e));
  }, [queryClient]);

  const { uploadingFiles, handleFileSelect, totalUploadProgress, cancelFileUpload, uploadFiles } = useUploader(
    'adminAsset',
    () => ({ type: 'adminAsset', directory: currentDirectory }),
  );

  const navigateToDirectory = useCallback(
    (dir: string) => setSearchParams(dir ? createSearchParams({ directory: dir }) : createSearchParams()),
    [setSearchParams],
  );

  const previousDirectory = useRef(currentDirectory);
  useEffect(() => {
    if (previousDirectory.current === currentDirectory) return;
    previousDirectory.current = currentDirectory;

    selection.clear();
    setSearch('');
    setPage(1);
  }, [currentDirectory]);

  const { onSelectedStart, onSelected } = useSelectionArea({
    identify: (asset: StorageAsset) => asset.name,
    getSelected: () => selection.selected.values(),
    setSelected: selection.replace,
  });

  useQuickActions([
    {
      id: 'assets.newDirectory',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.admin.assets.button.newDirectory', {}),
      keywords: ['folder', 'mkdir'],
      icon: <FontAwesomeIcon icon={faFolderPlus} />,
      adminPermission: 'assets.upload',
      perform: () => setOpenModal('newDirectory'),
    },
    {
      id: 'assets.parentDirectory',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.admin.assets.quickAction.parentDirectory', {}),
      keywords: ['up', 'back'],
      icon: <FontAwesomeIcon icon={faArrowUp} />,
      isVisible: () => currentDirectory !== '',
      perform: () => navigateToDirectory(parentPath(currentDirectory)),
    },
  ]);

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: () => selection.selectAll(),
      },
      {
        key: 'Escape',
        callback: () => selection.clear(),
      },
    ],
    deps: [selection.selectAll, selection.clear],
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.assets.title', {})}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='assets.upload'>
          <AssetUploadProgress
            uploadingFiles={uploadingFiles}
            totalUploadProgress={totalUploadProgress}
            cancelFileUpload={cancelFileUpload}
          />
          <Button
            color='gray'
            variant='default'
            onClick={() => setOpenModal('newDirectory')}
            leftSection={<FontAwesomeIcon icon={faFolderPlus} />}
          >
            {t('pages.admin.assets.button.newDirectory', {})}
          </Button>
          <AssetUpload handleFileSelect={handleFileSelect} uploadFiles={uploadFiles} />
        </AdminCan>
      }
    >
      <NewDirectoryModal
        opened={openModal === 'newDirectory'}
        onClose={() => setOpenModal(null)}
        currentDirectory={currentDirectory}
        onNavigate={navigateToDirectory}
      />

      <Card mb='sm'>
        <AssetBreadcrumbs directory={currentDirectory} />
      </Card>

      <AssetActionBar
        selectedAssets={selection.selected}
        onDeleted={() => {
          selection.clear();
          invalidateAssets();
        }}
      />

      <SelectionArea onSelectedStart={onSelectedStart} onSelected={onSelected}>
        <Table
          columns={assetTableColumns()}
          loading={loading}
          pagination={data?.pagination}
          onPageSelect={setPage}
          allowSelect={false}
        >
          {assets?.map((asset) => (
            <SelectionArea.Selectable key={asset.name} item={asset}>
              {(innerRef: Ref<HTMLElement>) => (
                <AssetRow
                  key={asset.name}
                  asset={asset}
                  currentDirectory={currentDirectory}
                  isSelected={selection.selected.has(asset.name)}
                  toggleSelectedAsset={selection.toggle}
                  removeSelectedAsset={selection.remove}
                  invalidateAssets={invalidateAssets}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AdminContentContainer>
  );
}
