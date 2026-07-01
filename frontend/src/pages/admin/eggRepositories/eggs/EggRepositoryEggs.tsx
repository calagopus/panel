import { Ref, useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import getEggRepositoryEggs from '@/api/admin/egg-repositories/eggs/getEggRepositoryEggs.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Table from '@/elements/Table.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositoryEggSchema, adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { eggRepositoryEggTableColumns } from '@/lib/tableColumns.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggRepositoryEggDrawer from './drawers/EggRepositoryEggDrawer.tsx';
import EggActionBar from './EggActionBar.tsx';
import EggRepositoryEggRow from './EggRepositoryEggRow.tsx';

export default function EggRepositoryEggs({
  contextEggRepository,
}: {
  contextEggRepository: z.infer<typeof adminEggRepositorySchema>;
}) {
  const { t } = useTranslations();
  const [selectedEggs, setSelectedEggs] = useState(
    new ObjectSet<z.infer<typeof adminEggRepositoryEggSchema>, 'uuid'>('uuid'),
  );
  const selectedEggsPreviousRef = useRef<z.infer<typeof adminEggRepositoryEggSchema>[]>([]);
  const [drawerEgg, setDrawerEgg] = useState<z.infer<typeof adminEggRepositoryEggSchema> | null>(null);

  useEffect(() => {
    setSelectedEggs(new ObjectSet('uuid'));
  }, []);

  const onSelectedStart = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      selectedEggsPreviousRef.current = event.shiftKey ? selectedEggs.values() : [];
    },
    [selectedEggs],
  );

  const onSelected = useCallback((selected: z.infer<typeof adminEggRepositoryEggSchema>[]) => {
    setSelectedEggs(new ObjectSet('uuid', [...selectedEggsPreviousRef.current, ...selected.values()]));
  }, []);

  const handleEggSelectionChange = useCallback(
    (egg: z.infer<typeof adminEggRepositoryEggSchema>, selected: boolean) => {
      setSelectedEggs((prev) => {
        const newSet = new ObjectSet('uuid', prev.values());
        if (selected) {
          newSet.add(egg);
        } else {
          newSet.delete(egg);
        }
        return newSet;
      });
    },
    [],
  );

  const {
    data: eggRepositoryEggs,
    loading,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.eggRepositories.eggs(contextEggRepository.uuid),
    fetcher: (page, search) => getEggRepositoryEggs(contextEggRepository.uuid, page, search),
  });

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: () => setSelectedEggs(new ObjectSet('uuid', eggRepositoryEggs?.data)),
      },
      {
        key: 'Escape',
        callback: () => setSelectedEggs(new ObjectSet('uuid')),
      },
    ],
    deps: [eggRepositoryEggs?.data],
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.eggRepositories.tabs.eggs.page.title', {})}
      search={search}
      setSearch={setSearch}
      titleOrder={2}
    >
      <EggActionBar
        eggRepository={contextEggRepository}
        selectedEggs={selectedEggs}
        setSelectedEggs={setSelectedEggs}
      />

      <EggRepositoryEggDrawer
        eggRepository={contextEggRepository}
        egg={drawerEgg}
        opened={drawerEgg !== null}
        onClose={() => setDrawerEgg(null)}
      />

      <SelectionArea onSelectedStart={onSelectedStart} onSelected={onSelected} disabled={drawerEgg !== null}>
        <Table
          columns={eggRepositoryEggTableColumns()}
          loading={loading}
          pagination={eggRepositoryEggs}
          onPageSelect={setPage}
          allowSelect={false}
        >
          {eggRepositoryEggs?.data.map((eggRepositoryEgg) => (
            <SelectionArea.Selectable key={eggRepositoryEgg.uuid} item={eggRepositoryEgg}>
              {(innerRef: Ref<HTMLElement>) => (
                <EggRepositoryEggRow
                  key={eggRepositoryEgg.uuid}
                  egg={eggRepositoryEgg}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedEggs.has(eggRepositoryEgg.uuid)}
                  onSelectionChange={(selected) => handleEggSelectionChange(eggRepositoryEgg, selected)}
                  onOpen={() => setDrawerEgg(eggRepositoryEgg)}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AdminSubContentContainer>
  );
}
