import { faFolderPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ref, useCallback, useEffect, useState } from 'react';
import { createSearchParams, useSearchParams } from 'react-router';
import { z } from 'zod';
import getAssets from '@/api/admin/assets/getAssets.ts';
import uploadAssets from '@/api/admin/assets/uploadAssets.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Card from '@/elements/Card.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Table from '@/elements/Table.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { storageAssetSchema } from '@/lib/schemas/admin/assets.ts';
import { assetTableColumns } from '@/lib/tableColumns.ts';
import AssetUpload from '@/pages/admin/assets/AssetUpload.tsx';
import AssetUploadProgress from '@/pages/admin/assets/AssetUploadProgress.tsx';
import { useFileUpload } from '@/plugins/useFileUpload.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useSelectionArea } from '@/plugins/useSelectionArea.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AssetActionBar from './AssetActionBar.tsx';
import AssetBreadcrumbs from './AssetBreadcrumbs.tsx';
import AssetRow from './AssetRow.tsx';
import NewDirectoryModal from './NewDirectoryModal.tsx';

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

  const { data, isFetching } = useQuery({
    queryKey: [...queryKeys.admin.assets.all(), { page, currentDirectory }],
    queryFn: () => getAssets(page, currentDirectory),
    placeholderData: keepPreviousData,
  });

  const invalidateAssets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'assets'] }).catch((e) => console.error(e));
  }, [queryClient]);

  const { uploadingFiles, handleFileSelect, totalUploadProgress, cancelFileUpload, uploadFiles } = useFileUpload(
    (form, config) =>
      uploadAssets(form, config, currentDirectory).then(() => {
        invalidateAssets();
        return { url: '', continuationToken: null };
      }),
    () => null,
  );

  const navigateToDirectory = useCallback(
    (dir: string) => {
      setSearchParams(createSearchParams({ directory: dir }));
      setSelectedAssets(new ObjectSet('name'));
    },
    [setSearchParams],
  );

  const onPageSelect = (p: number) =>
    setSearchParams(createSearchParams({ directory: currentDirectory, page: p.toString() }));

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

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: () =>
          setSelectedAssets(
            new ObjectSet(
              'name',
              data?.data.filter((a) => !a.isDirectory),
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
        existingEntries={data?.data ?? []}
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
          pagination={data}
          onPageSelect={onPageSelect}
          allowSelect={false}
        >
          {data?.data.map((asset) => (
            <SelectionArea.Selectable key={asset.name} item={asset}>
              {(innerRef: Ref<HTMLElement>) => (
                <AssetRow
                  key={asset.name}
                  asset={asset}
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
