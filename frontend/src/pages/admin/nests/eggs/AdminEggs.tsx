import { faPlus, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import jsYaml from 'js-yaml';
import { ChangeEvent, MouseEvent as ReactMouseEvent, Ref, useCallback, useEffect, useRef, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { z } from 'zod';
import getEggs from '@/api/admin/nests/eggs/getEggs.ts';
import importEgg from '@/api/admin/nests/eggs/importEgg.ts';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Table from '@/elements/Table.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { eggTableColumns } from '@/lib/tableColumns.ts';
import EggView from '@/pages/admin/nests/eggs/EggView.tsx';
import { useImportDragAndDrop } from '@/plugins/useImportDragAndDrop.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import EggActionBar from './EggActionBar.tsx';
import EggCreateOrUpdate from './EggCreateOrUpdate.tsx';
import EggImportOverlay from './EggImportOverlay.tsx';
import EggRow from './EggRow.tsx';

function EggsContainer({ contextNest }: { contextNest: z.infer<typeof adminNestSchema> }) {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const selectedEggsPreviousRef = useRef<z.infer<typeof adminEggSchema>[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedEggs, setSelectedEggs] = useState(new ObjectSet<z.infer<typeof adminEggSchema>, 'uuid'>('uuid'));

  const { data, loading, refetch, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nests.eggs(contextNest.uuid),
    fetcher: (page, search) => getEggs(contextNest.uuid, page, search),
  });

  const eggs = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  const handleImport = async (file: File) => {
    const text = await file.text().then((t) => t.trim());
    let data: object;
    try {
      if (text.startsWith('{')) {
        data = JSON.parse(text);
      } else {
        data = jsYaml.load(text) as object;
      }
    } catch (err) {
      addToast(`Failed to parse egg: ${err}`, 'error');
      return;
    }

    importEgg(contextNest.uuid, data)
      .then((data) => {
        refetch();
        addToast('Egg imported.', 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const { isDragging } = useImportDragAndDrop({
    onDrop: (files) => Promise.all(files.map(handleImport)),
  });

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';

    handleImport(file);
  };

  const onSelectedStart = useCallback(
    (event: ReactMouseEvent | MouseEvent) => {
      selectedEggsPreviousRef.current = event.shiftKey ? selectedEggs.values() : [];
    },
    [selectedEggs],
  );

  const onSelected = useCallback((selected: z.infer<typeof adminEggSchema>[]) => {
    setSelectedEggs(new ObjectSet('uuid', [...selectedEggsPreviousRef.current, ...selected]));
  }, []);

  useEffect(() => {
    setSelectedEggs(new ObjectSet('uuid'));
  }, []);

  const addSelectedEgg = (egg: z.infer<typeof adminEggSchema>) =>
    setSelectedEggs((prev) => {
      const next = new ObjectSet('uuid', prev.values());
      next.add(egg);
      return next;
    });

  const removeSelectedEgg = (egg: z.infer<typeof adminEggSchema>) =>
    setSelectedEggs((prev) => {
      const next = new ObjectSet('uuid', prev.values());
      next.delete(egg);
      return next;
    });

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: () => setSelectedEggs(new ObjectSet('uuid', eggs?.data)),
      },
      {
        key: 'Escape',
        callback: () => setSelectedEggs(new ObjectSet('uuid')),
      },
    ],
    deps: [eggs],
  });

  const columns = ['', ...eggTableColumns];

  return (
    <AdminSubContentContainer
      title='Eggs'
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='eggs.create'>
          <Button onClick={() => fileInputRef.current?.click()} color='blue'>
            <FontAwesomeIcon icon={faUpload} className='mr-2' />
            Import
          </Button>
          <Button
            onClick={() => navigate(`/admin/nests/${contextNest.uuid}/eggs/new`)}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            Create
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
      <EggActionBar
        nest={contextNest}
        selectedEggs={selectedEggs}
        invalidateEggs={() => {
          setSelectedEggs(new ObjectSet('uuid'));
          refetch();
        }}
      />
      <EggImportOverlay visible={isDragging} />

      <SelectionArea onSelectedStart={onSelectedStart} onSelected={onSelected}>
        <Table columns={columns} loading={loading} pagination={eggs} onPageSelect={setPage} allowSelect={false}>
          {eggs.data.map((egg) => (
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
