import { faFolderPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MouseEvent as ReactMouseEvent, Ref, useCallback, useEffect, useRef, useState } from 'react';
import { createSearchParams, useSearchParams } from 'react-router';
import { z } from 'zod';
import getAssets from '@/api/admin/assets/getAssets.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Card from '@/elements/Card.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Table from '@/elements/Table.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { storageAssetSchema } from '@/lib/schemas/admin/assets.ts';
import { assetTableColumns } from '@/lib/tableColumns.ts';
import AssetUpload from '@/pages/admin/assets/AssetUpload.tsx';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import AssetActionBar from './AssetActionBar.tsx';
import AssetBreadcrumbs from './AssetBreadcrumbs.tsx';
import AssetRow from './AssetRow.tsx';
import NewDirectoryModal from './NewDirectoryModal.tsx';

export default function AdminAssets() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentDirectory = searchParams.get('directory') ?? '';
  const page = Number(searchParams.get('page')) || 1;

  const selectedAssetsPreviousRef = useRef<z.infer<typeof storageAssetSchema>[]>([]);
  const [selectedAssets, setSelectedAssets] = useState(
    new ObjectSet<z.infer<typeof storageAssetSchema>, 'name'>('name'),
  );
  const [openModal, setOpenModal] = useState<'newDirectory' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.admin.assets.all(), { page, currentDirectory }],
    queryFn: () => getAssets(page, currentDirectory),
  });

  const invalidateAssets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'assets'] }).catch((e) => console.error(e));
  }, [queryClient]);

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

  const onSelectedStart = useCallback(
    (event: ReactMouseEvent | MouseEvent) => {
      selectedAssetsPreviousRef.current = event.shiftKey ? selectedAssets.values() : [];
    },
    [selectedAssets],
  );

  const onSelected = useCallback((selected: z.infer<typeof storageAssetSchema>[]) => {
    setSelectedAssets(
      new ObjectSet('name', [...selectedAssetsPreviousRef.current, ...selected.filter((a) => !a.isDirectory)]),
    );
  }, []);

  const addSelectedAsset = (asset: z.infer<typeof storageAssetSchema>) =>
    setSelectedAssets((prev) => {
      const next = new ObjectSet('name', prev.values());
      next.add(asset);
      return next;
    });

  const removeSelectedAsset = (asset: z.infer<typeof storageAssetSchema>) =>
    setSelectedAssets((prev) => {
      const next = new ObjectSet('name', prev.values());
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
      title='Assets'
      contentRight={
        <AdminCan action='assets.upload'>
          <Button
            color='gray'
            variant='default'
            onClick={() => setOpenModal('newDirectory')}
            leftSection={<FontAwesomeIcon icon={faFolderPlus} />}
          >
            New Directory
          </Button>
          <AssetUpload invalidateAssets={invalidateAssets} currentDirectory={currentDirectory} />
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

      {!data || isLoading ? (
        <Spinner.Centered />
      ) : (
        <SelectionArea onSelectedStart={onSelectedStart} onSelected={onSelected}>
          <ContextMenuProvider>
            <Table
              columns={assetTableColumns}
              loading={isLoading}
              pagination={data}
              onPageSelect={onPageSelect}
              allowSelect={false}
            >
              {data.data.map((asset) => (
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
          </ContextMenuProvider>
        </SelectionArea>
      )}
    </AdminContentContainer>
  );
}
