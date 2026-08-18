import { faArrowUp, faFolderPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import debounce from 'debounce';
import { Dispatch, Ref, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { createSearchParams, useSearchParams } from 'react-router';
import { z } from 'zod';
import getAssets from '@/api/admin/assets/getAssets.ts';
import searchAssets from '@/api/admin/assets/searchAssets.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Card from '@/elements/Card.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Table from '@/elements/Table.tsx';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/coreQuickActions.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { storageAssetSchema } from '@/lib/schemas/admin/assets.ts';
import { assetTableColumns } from '@/lib/tableColumns.ts';
import AssetUpload from '@/pages/admin/assets/AssetUpload.tsx';
import AssetUploadProgress from '@/pages/admin/assets/AssetUploadProgress.tsx';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useQuickActions } from '@/plugins/useQuickActions.ts';
import { useSelectionArea } from '@/plugins/useSelectionArea.ts';
import { useUploader } from '@/plugins/useUploader.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { UploadDestination } from '@/stores/uploads.ts';
import AssetActionBar from './AssetActionBar.tsx';
import AssetBreadcrumbs from './AssetBreadcrumbs.tsx';
import AssetRow from './AssetRow.tsx';
import NewDirectoryModal from './NewDirectoryModal.tsx';

interface AssetsQueryData {
  assets: z.infer<typeof storageAssetSchema>[];
  pagination?: Pagination<z.infer<typeof storageAssetSchema>>;
}

export default function AdminAssets() {
  const { t } = useTranslations();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentDirectory = searchParams.get('directory') ?? '';
  const page = Number(searchParams.get('page')) || 1;

  const [selectedAssets, setSelectedAssets] = useState(
    new ObjectSet<z.infer<typeof storageAssetSchema>, 'name'>('name'),
  );
  const [openModal, setOpenModal] = useState<'newDirectory' | null>(null);
  const [search, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const updateDebouncedSearch = useCallback(
    debounce((value: string) => setDebouncedSearch(value), 150),
    [],
  );

  useEffect(() => {
    if (!search) {
      updateDebouncedSearch.clear();
      setDebouncedSearch('');
    } else {
      updateDebouncedSearch(search);
    }
  }, [search]);

  const { data, isFetching } = useQuery({
    queryKey: [...queryKeys.admin.assets.all(), { page, currentDirectory, search: debouncedSearch }],
    queryFn: (): Promise<AssetsQueryData> =>
      debouncedSearch
        ? searchAssets(currentDirectory, debouncedSearch).then((assets) => ({ assets }))
        : getAssets(page, currentDirectory).then((pagination) => ({ assets: pagination.data, pagination })),
    placeholderData: keepPreviousData,
  });

  const assets = data?.assets;

  const invalidateAssets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.assets.all() }).catch((e) => console.error(e));
  }, [queryClient]);

  const currentDirectoryRef = useRef(currentDirectory);
  currentDirectoryRef.current = currentDirectory;

  const getDestination = useCallback(
    (): UploadDestination => ({ type: 'adminAsset', directory: currentDirectoryRef.current }),
    [],
  );
  const { uploadingFiles, handleFileSelect, totalUploadProgress, cancelFileUpload, uploadFiles } = useUploader(
    'adminAsset',
    getDestination,
  );

  const navigateToDirectory = useCallback(
    (dir: string) => {
      setSearchParams(createSearchParams({ directory: dir }));
      setSelectedAssets(new ObjectSet('name'));
      setSearchValue('');
    },
    [setSearchParams],
  );

  const onPageSelect = (p: number) =>
    setSearchParams(createSearchParams({ directory: currentDirectory, page: p.toString() }));

  const setSearch: Dispatch<SetStateAction<string>> = (value) => {
    setSearchValue(value);

    if (page !== 1) {
      setSearchParams(createSearchParams({ directory: currentDirectory }));
    }
  };

  useEffect(() => {
    setSelectedAssets(new ObjectSet('name'));
  }, [currentDirectory]);

  const { onSelectedStart, onSelected } = useSelectionArea({
    identify: (asset) => asset.name,
    getSelected: () => selectedAssets.values(),
    setSelected: (assets) =>
      setSelectedAssets(
        new ObjectSet(
          'name',
          assets.filter((asset) => !asset.isDirectory),
        ),
      ),
  });

  const addSelectedAsset = (asset: z.infer<typeof storageAssetSchema>) =>
    setSelectedAssets((prev) => prev.clone().add(asset));

  const removeSelectedAsset = (asset: z.infer<typeof storageAssetSchema>) =>
    setSelectedAssets((prev) => {
      const next = prev.clone();
      next.delete(asset);
      return next;
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
      perform: () => navigateToDirectory(currentDirectory.split('/').filter(Boolean).slice(0, -1).join('/')),
    },
  ]);

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: () =>
          setSelectedAssets(
            new ObjectSet(
              'name',
              assets?.filter((a) => !a.isDirectory),
            ),
          ),
      },
      {
        key: 'Escape',
        callback: () => setSelectedAssets(new ObjectSet('name')),
      },
    ],
    deps: [data],
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
        existingEntries={assets ?? []}
        onNavigate={navigateToDirectory}
      />

      <Card mb='sm'>
        <AssetBreadcrumbs directory={currentDirectory} />
      </Card>

      <AssetActionBar
        selectedAssets={selectedAssets}
        invalidateAssets={() => {
          setSelectedAssets(new ObjectSet('name'));
          invalidateAssets();
        }}
      />

      <SelectionArea onSelectedStart={onSelectedStart} onSelected={onSelected}>
        <Table
          columns={assetTableColumns()}
          loading={isFetching}
          pagination={data?.pagination}
          onPageSelect={onPageSelect}
          allowSelect={false}
        >
          {assets?.map((asset) => (
            <SelectionArea.Selectable key={asset.name} item={asset}>
              {(innerRef: Ref<HTMLElement>) => (
                <AssetRow
                  key={asset.name}
                  asset={asset}
                  currentDirectory={currentDirectory}
                  isSelected={selectedAssets.has(asset.name)}
                  addSelectedAsset={addSelectedAsset}
                  removeSelectedAsset={removeSelectedAsset}
                  invalidateAssets={invalidateAssets}
                  onDirectoryClick={navigateToDirectory}
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
