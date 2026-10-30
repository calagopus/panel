import { faChevronDown, faDownload, faLink, faPlus, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ChangeEvent, Ref, useRef, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { z } from 'zod';
import getEggs from '@/api/admin/nests/eggs/getEggs.ts';
import importEgg from '@/api/admin/nests/eggs/importEgg.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import ImportOverlay from '@/elements/ImportOverlay.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import { parseStructuredDocument } from '@/lib/parseStructuredDocument.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { eggTableColumns } from '@/lib/tableColumns.ts';
import EggRepositoryCatalogModal from '@/pages/admin/egg-repositories/eggs/modals/EggRepositoryCatalogModal.tsx';
import EggView from '@/pages/admin/nests/eggs/EggView.tsx';
import { useImportDragAndDrop } from '@/plugins/import/useImportDragAndDrop.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import EggActionBar from './EggActionBar.tsx';
import EggCreateOrUpdate from './EggCreateOrUpdate.tsx';
import EggRow from './EggRow.tsx';
import EggImportUrlModal from './modals/EggImportUrlModal.tsx';

function EggsContainer({ contextNest }: { contextNest: z.infer<typeof adminNestSchema> }) {
  const navigate = useNavigate();
  const { addToast, addPendingToast } = useToast();
  const { t } = useTranslations();

  const canCreate = useAdminCan('eggs.create');
  const canReadEggRepositories = useAdminCan('egg-repositories.read');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importUrlOpen, setImportUrlOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const {
    data: eggs,
    loading,
    error,
    refetch,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nests.eggs(contextNest.uuid),
    fetcher: (page, search, perPage) => getEggs(contextNest.uuid, page, search, perPage),
  });

  const {
    selected: selectedEggs,
    toggle: toggleEgg,
    clear: clearSelectedEggs,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({ items: eggs?.data });

  const handleImport = async (file: File) => {
    let data: object;
    try {
      data = parseStructuredDocument(await file.text()) as object;
    } catch (err) {
      addToast(t('pages.admin.nests.tabs.eggs.page.toast.parseFailed', { error: String(err) }), 'error');
      return;
    }

    const pendingToast = addPendingToast(t('common.toast.importing', { file: file.name }));

    importEgg(contextNest.uuid, data)
      .then(() => {
        refetch();
        pendingToast.settle(t('pages.admin.nests.tabs.eggs.page.toast.imported', {}), 'success');
      })
      .catch((msg) => {
        pendingToast.settle(httpErrorToHuman(msg), 'error');
      });
  };

  const { isDragging } = useImportDragAndDrop({
    onDrop: (files) => Promise.all(files.map(handleImport)),
    enabled: canCreate,
  });

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';

    handleImport(file);
  };

  const columns = [
    tableSelectionHeader({
      checked: allSelected,
      indeterminate: selectedEggs.size > 0 && !allSelected,
      onChange: (checked) => (checked ? selectAll() : clearSelectedEggs()),
    }),
    ...eggTableColumns(),
  ];

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nests.tabs.eggs.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='eggs.create'>
          <ContextMenu
            items={[
              {
                type: 'action',
                icon: faUpload,
                label: t('pages.admin.nests.tabs.eggs.page.button.fromFile', {}),
                onClick: () => fileInputRef.current?.click(),
                color: 'gray',
              },
              {
                type: 'action',
                icon: faLink,
                label: t('pages.admin.nests.tabs.eggs.page.button.fromUrl', {}),
                onClick: () => setImportUrlOpen(true),
                color: 'gray',
              },
              {
                type: 'action',
                icon: faDownload,
                label: t('pages.admin.nests.tabs.eggs.page.button.fromRepository', {}),
                onClick: () => setCatalogOpen(true),
                disabled: !canReadEggRepositories,
                color: 'gray',
              },
            ]}
          >
            {({ openMenu }) => (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  openMenu(rect.left, rect.bottom);
                }}
                color='blue'
                rightSection={<FontAwesomeIcon icon={faChevronDown} />}
              >
                {t('common.button.import', {})}
              </Button>
            )}
          </ContextMenu>
          <Button
            onClick={() => navigate(`/admin/nests/${contextNest.uuid}/eggs/new`)}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('common.button.create', {})}
          </Button>

          <input
            type='file'
            accept='.json,.yml,.yaml'
            ref={fileInputRef}
            className='hidden'
            onChange={handleFileUpload}
          />
        </AdminCan>
      }
    >
      <EggImportUrlModal
        nest={contextNest}
        opened={importUrlOpen}
        onClose={() => setImportUrlOpen(false)}
        onImported={refetch}
      />

      <EggRepositoryCatalogModal
        nest={contextNest}
        opened={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onInstalled={refetch}
      />

      <EggActionBar
        nest={contextNest}
        selectedEggs={selectedEggs}
        invalidateEggs={() => {
          clearSelectedEggs();
          refetch();
        }}
      />
      <ImportOverlay
        visible={canCreate && isDragging}
        title={t('pages.admin.nests.tabs.eggs.page.dropzone.title', {})}
        subtitle={t('pages.admin.nests.tabs.eggs.page.dropzone.subtitle', {})}
      />

      <SelectionArea {...selectionAreaProps}>
        <Table
          columns={columns}
          loading={loading}
          pagination={eggs}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
          error={error}
        >
          {eggs?.data.map((egg) => (
            <SelectionArea.Selectable key={egg.uuid} item={egg}>
              {(innerRef: Ref<HTMLElement>) => (
                <EggRow
                  key={egg.uuid}
                  nest={contextNest}
                  egg={egg}
                  isSelected={selectedEggs.has(egg.uuid)}
                  onSelectionChange={(selected, range) => toggleEgg(egg, selected, range)}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AdminSubContentContainer>
  );
}

export default function AdminEggs({ contextNest }: { contextNest: z.infer<typeof adminNestSchema> }) {
  return (
    <Routes>
      <Route path='/' element={<EggsContainer contextNest={contextNest} />} />
      <Route path='/:eggId/*' element={<EggView contextNest={contextNest} />} />
      <Route element={<AdminPermissionGuard permission='eggs.create' />}>
        <Route path='/new' element={<EggCreateOrUpdate contextNest={contextNest} />} />
      </Route>
    </Routes>
  );
}
