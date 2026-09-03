import { faChevronDown, faLink, faPlus, faUpload } from '@fortawesome/free-solid-svg-icons';
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
import Table from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import ImportOverlay from '@/elements/ImportOverlay.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import { parseStructuredDocument } from '@/lib/parseStructuredDocument.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { eggTableColumns } from '@/lib/tableColumns.ts';
import EggView from '@/pages/admin/nests/eggs/EggView.tsx';
import { useImportDragAndDrop } from '@/plugins/import/useImportDragAndDrop.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useObjectSetSelection } from '@/plugins/selection/useObjectSetSelection.ts';
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
  const { addToast } = useToast();
  const { t } = useTranslations();

  const canCreate = useAdminCan('eggs.create');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importUrlOpen, setImportUrlOpen] = useState(false);

  const {
    data: eggs,
    loading,
    error,
    refetch,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nests.eggs(contextNest.uuid),
    fetcher: (page, search) => getEggs(contextNest.uuid, page, search),
  });

  const {
    selected: selectedEggs,
    add: addSelectedEgg,
    remove: removeSelectedEgg,
    clear: clearSelectedEggs,
    selectionAreaProps,
  } = useObjectSetSelection(eggs?.data);

  const handleImport = async (file: File) => {
    let data: object;
    try {
      data = parseStructuredDocument(await file.text()) as object;
    } catch (err) {
      addToast(t('pages.admin.nests.tabs.eggs.page.toast.parseFailed', { error: String(err) }), 'error');
      return;
    }

    importEgg(contextNest.uuid, data)
      .then(() => {
        refetch();
        addToast(t('pages.admin.nests.tabs.eggs.page.toast.imported', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
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

  const columns = ['', ...eggTableColumns()];

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
          allowSelect={false}
          error={error}
        >
          {eggs?.data.map((egg) => (
            <SelectionArea.Selectable key={egg.uuid} item={egg}>
              {(innerRef: Ref<HTMLElement>) => (
                <EggRow
                  key={egg.uuid}
                  nest={contextNest}
                  egg={egg}
                  showSelection
                  isSelected={selectedEggs.has(egg.uuid)}
                  onSelectionChange={(selected) => (selected ? addSelectedEgg(egg) : removeSelectedEgg(egg))}
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
