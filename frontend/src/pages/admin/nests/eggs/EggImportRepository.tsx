import { faArrowLeft, faDownload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { Ref, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getEggRepositoryEggs from '@/api/admin/egg-repositories/eggs/getEggRepositoryEggs.ts';
import installEggs from '@/api/admin/egg-repositories/eggs/installEggs.ts';
import getEggRepositories from '@/api/admin/egg-repositories/getEggRepositories.ts';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import Select from '@/elements/input/Select.tsx';
import ScrollArea from '@/elements/layout/ScrollArea.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Drawer from '@/elements/overlays/Drawer.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositoryEggSchema, adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { eggRepositoryEggTableColumns } from '@/lib/tableColumns.ts';
import EggRepositoryEggRow from '@/pages/admin/egg-repositories/eggs/EggRepositoryEggRow.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggImportRepository({
  contextNest,
}: {
  contextNest: z.infer<typeof adminNestSchema>;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedRepositoryUuid, setSelectedRepositoryUuid] = useState<string | null>(null);
  const [drawerEgg, setDrawerEgg] = useState<z.infer<typeof adminEggRepositoryEggSchema> | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installingDrawerEgg, setInstallingDrawerEgg] = useState(false);

  // Load available egg repositories
  const eggRepositories = useSearchableResource<z.infer<typeof adminEggRepositorySchema>>({
    queryKey: queryKeys.admin.eggRepositories.all(),
    fetcher: (search) => getEggRepositories(1, search),
  });

  // Load eggs for the selected egg repository
  const {
    data: eggRepositoryEggs,
    loading: eggsLoading,
    error: eggsError,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: selectedRepositoryUuid
      ? queryKeys.admin.eggRepositories.eggs(selectedRepositoryUuid)
      : queryKeys.admin.eggRepositories.eggsUnscoped(),
    fetcher: (page, search) =>
      selectedRepositoryUuid
        ? getEggRepositoryEggs(selectedRepositoryUuid, page, search)
        : Promise.resolve(getEmptyPaginationSet()),
  });

  const { selected, add, remove, clear, selectAll, allSelected, selectionAreaProps } = useTableSelection({
    items: eggRepositoryEggs?.data,
  });

  const handleRepositoryChange = (newUuid: string | null) => {
    setSelectedRepositoryUuid(newUuid);
    clear();
  };

  const doInstallSelected = () => {
    if (!selectedRepositoryUuid || selected.size === 0) return;

    setInstalling(true);
    installEggs(
      selectedRepositoryUuid,
      Array.from(selected.values()).map((egg) => egg.uuid),
      contextNest.uuid,
    )
      .then((installed) => {
        addToast(
          t('pages.admin.eggRepositories.tabs.eggs.page.toast.installed', { eggs: tItem('egg', installed) }),
          'success',
        );
        clear();
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.nests.eggs(contextNest.uuid) });
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setInstalling(false));
  };

  const doInstallDrawerEgg = (egg: z.infer<typeof adminEggRepositoryEggSchema>) => {
    if (!selectedRepositoryUuid) return;

    setInstallingDrawerEgg(true);
    installEggs(selectedRepositoryUuid, [egg.uuid], contextNest.uuid)
      .then(() => {
        addToast(t('pages.admin.nests.tabs.eggs.page.toast.imported', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.nests.eggs(contextNest.uuid) });
        setDrawerEgg(null);
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setInstallingDrawerEgg(false));
  };

  const columns = [
    tableSelectionHeader({
      checked: allSelected,
      indeterminate: selected.size > 0 && !allSelected,
      onChange: (checked) => (checked ? selectAll() : clear()),
    }),
    ...eggRepositoryEggTableColumns().slice(1),
  ];

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nests.tabs.eggs.page.importRepository.title', {})}
      subtitle={t('pages.admin.nests.tabs.eggs.page.importRepository.subtitle', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Button
          variant='default'
          leftSection={<FontAwesomeIcon icon={faArrowLeft} />}
          onClick={() => navigate(`/admin/nests/${contextNest.uuid}/eggs`)}
        >
          {t('common.button.back', {})}
        </Button>
      }
    >
      <div className='flex flex-wrap items-center justify-between gap-4 mb-4'>
        <div className='flex items-center gap-3'>
          <span className='text-sm font-medium'>
            {t('pages.admin.nests.tabs.eggs.page.importRepository.selectRepository', {})}:
          </span>
          <Select
            className='w-64 sm:w-80'
            placeholder={t('pages.admin.nests.tabs.eggs.page.importRepository.selectPlaceholder', {})}
            data={eggRepositories.items.map((repo) => ({
              label: repo.name,
              value: repo.uuid,
            }))}
            value={selectedRepositoryUuid}
            onChange={handleRepositoryChange}
            searchable
            searchValue={eggRepositories.search}
            onSearchChange={eggRepositories.setSearch}
            loading={eggRepositories.loading}
          />
        </div>
      </div>

      {!eggRepositories.loading && eggRepositories.items.length === 0 ? (
        <div className='flex flex-col items-center justify-center p-12 text-center border border-(--mantine-color-default-border) rounded-md'>
          <FontAwesomeIcon icon={faDownload} className='text-4xl text-(--mantine-color-dimmed) mb-3' />
          <p className='text-(--mantine-color-dimmed) mb-4'>
            {t('pages.admin.nests.tabs.eggs.page.importRepository.noRepositories', {})}
          </p>
          <Button onClick={() => navigate('/admin/egg-repositories/new')} color='blue'>
            {t('pages.admin.nests.tabs.eggs.page.importRepository.goToRepositories', {})}
          </Button>
        </div>
      ) : (
        <>
          <Drawer
            position='right'
            offset={8}
            radius='md'
            opened={drawerEgg !== null}
            onClose={() => setDrawerEgg(null)}
            title={drawerEgg?.exportedEgg.name}
            size='lg'
          >
            {drawerEgg && (
              <Stack gap='md' className='h-full'>
                <AdminCan action='eggs.create'>
                  <Button
                    leftSection={<FontAwesomeIcon icon={faDownload} />}
                    onClick={() => doInstallDrawerEgg(drawerEgg)}
                    loading={installingDrawerEgg}
                  >
                    {t('pages.admin.nests.tabs.eggs.page.importRepository.importThisEgg', {})}
                  </Button>
                </AdminCan>

                <ScrollArea className='flex-1' offsetScrollbars>
                  {drawerEgg.readme ? (
                    <div className='text-sm wrap-break-word'>{drawerEgg.readme.md({ html: true })}</div>
                  ) : (
                    <div className='flex items-center justify-center py-12 text-(--mantine-color-dimmed)'>
                      {t('pages.admin.eggRepositories.tabs.eggs.page.drawer.noReadme', {})}
                    </div>
                  )}
                </ScrollArea>
              </Stack>
            )}
          </Drawer>

          <AdminCan action='eggs.create'>
            <ActionBar opened={selected.size > 0}>
              <Button onClick={doInstallSelected} loading={installing} className='col-span-full'>
                <FontAwesomeIcon icon={faDownload} className='mr-2' />
                {t('pages.admin.nests.tabs.eggs.page.importRepository.importButton', { count: selected.size })}
              </Button>
            </ActionBar>
          </AdminCan>

          <SelectionArea {...selectionAreaProps} disabled={drawerEgg !== null}>
            <Table
              columns={columns}
              loading={eggsLoading}
              error={eggsError}
              pagination={eggRepositoryEggs}
              onPageSelect={setPage}
            >
              {eggRepositoryEggs?.data.map((eggRepositoryEgg) => (
                <SelectionArea.Selectable key={eggRepositoryEgg.uuid} item={eggRepositoryEgg}>
                  {(innerRef: Ref<HTMLElement>) => (
                    <EggRepositoryEggRow
                      key={eggRepositoryEgg.uuid}
                      egg={eggRepositoryEgg}
                      ref={innerRef as Ref<HTMLTableRowElement>}
                      isSelected={selected.has(eggRepositoryEgg.uuid)}
                      onSelectionChange={(isSelected) =>
                        isSelected ? add(eggRepositoryEgg) : remove(eggRepositoryEgg)
                      }
                      onOpen={() => setDrawerEgg(eggRepositoryEgg)}
                    />
                  )}
                </SelectionArea.Selectable>
              ))}
            </Table>
          </SelectionArea>
        </>
      )}
    </AdminSubContentContainer>
  );
}
