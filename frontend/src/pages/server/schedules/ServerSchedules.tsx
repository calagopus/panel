import { faCalendarDays, faPlus, faStopwatch, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { load } from 'js-yaml';
import { ChangeEvent, lazy, Ref, Suspense, useRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getSchedules from '@/api/server/schedules/getSchedules.ts';
import importSchedule from '@/api/server/schedules/importSchedule.ts';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ImportOverlay from '@/elements/ImportOverlay.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverScheduleSchema } from '@/lib/schemas/server/schedules.ts';
import { useImportDragAndDrop } from '@/plugins/import/useImportDragAndDrop.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';
import { applyScheduleCompletion } from '@/stores/slices/server/schedules.ts';
import ScheduleCreateOrUpdateModal from './modals/ScheduleCreateOrUpdateModal.tsx';
import ScheduleActionBar from './ScheduleActionBar.tsx';
import ScheduleRow from './ScheduleRow.tsx';

const ScheduleCalendarModal = lazy(() => import('./modals/ScheduleCalendarModal.tsx'));

export default function ServerSchedules() {
  const { t } = useTranslations();
  const { addToast, addPendingToast } = useToast();
  const server = useServerStore((state) => state.server);
  const serverStoreApi = useServerStoreApi();

  const canCreate = useServerCan('schedules.create');
  const canSelect = useServerCan(['schedules.update', 'schedules.delete']);

  const [openModal, setOpenModal] = useState<'create' | 'calendar' | null>(null);
  const [calendarMounted, setCalendarMounted] = useState(false);
  if (openModal === 'calendar' && !calendarMounted) setCalendarMounted(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: schedules,
    loading,
    error,
    search,
    debouncedSearch,
    setSearch,
    setPage,
    setPerPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).schedules.all(),
    fetcher: (page, search, perPage) =>
      getSchedules(server.uuid, page, search, perPage).then((schedules) => ({
        ...schedules,
        data: schedules.data.map((schedule) =>
          applyScheduleCompletion(schedule, serverStoreApi.getState().scheduleCompletions),
        ),
      })),
  });

  const {
    selected: selectedSchedules,
    toggle: toggleSchedule,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({ items: schedules?.data, shortcuts: canSelect });

  const handleScheduleClick = (schedule: z.infer<typeof serverScheduleSchema>, event: React.MouseEvent) => {
    if (canSelect && (event.ctrlKey || event.metaKey || event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      toggleSchedule(schedule, !selectedSchedules.has(schedule.uuid), event.shiftKey);
    }
  };

  const handleImport = async (file: File) => {
    const text = await file.text().then((t) => t.trim());
    let data: object;
    try {
      if (text.startsWith('{')) {
        data = JSON.parse(text);
      } else {
        data = load(text) as object;
      }
    } catch (err) {
      addToast(t('pages.server.schedules.toast.parseError', { error: String(err) }), 'error');
      return;
    }

    const pendingToast = addPendingToast(t('common.toast.importing', { file: file.name }));

    importSchedule(server.uuid, data)
      .then(() => {
        refetch();
        pendingToast.settle(t('pages.server.schedules.toast.imported', {}), 'success');
      })
      .catch((msg) => {
        pendingToast.settle(httpErrorToHuman(msg), 'error');
      });
  };

  const { isDragging } = useImportDragAndDrop({
    onDrop: (files) => Promise.all(files.map(handleImport)),
    enabled: canCreate,
  });

  const atLimit = (schedules?.total ?? 0) >= server.featureLimits.schedules;
  const isEmpty = !loading && !error && !debouncedSearch && schedules?.total === 0;

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';

    handleImport(file);
  };

  return (
    <ServerContentContainer
      title={t('pages.server.schedules.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.server.schedules.container}
      subtitle={t('pages.server.schedules.subtitle', {
        current: schedules?.total ?? '…',
        max: server.featureLimits.schedules,
      })}
      search={search}
      setSearch={isEmpty ? undefined : setSearch}
      contentRight={
        isEmpty ? undefined : (
          <>
            <ServerCan action='schedules.read'>
              <Button variant='default' onClick={() => setOpenModal('calendar')}>
                <FontAwesomeIcon icon={faCalendarDays} className='mr-2' />
                {t('pages.server.schedules.button.viewCalendar', {})}
              </Button>
            </ServerCan>

            <ServerCan action='schedules.create'>
              <ConditionalTooltip
                enabled={atLimit}
                label={t('pages.server.schedules.tooltip.limitReached', { max: server.featureLimits.schedules })}
              >
                <Button onClick={() => fileInputRef.current?.click()} color='blue' disabled={!schedules || atLimit}>
                  <FontAwesomeIcon icon={faUpload} className='mr-2' />
                  {t('common.button.import', {})}
                </Button>
              </ConditionalTooltip>
              <ConditionalTooltip
                enabled={atLimit}
                label={t('pages.server.schedules.tooltip.limitReached', { max: server.featureLimits.schedules })}
              >
                <Button
                  disabled={!schedules || atLimit}
                  onClick={() => setOpenModal('create')}
                  color='blue'
                  leftSection={<FontAwesomeIcon icon={faPlus} />}
                >
                  {t('common.button.create', {})}
                </Button>
              </ConditionalTooltip>
            </ServerCan>
          </>
        )
      }
    >
      <input type='file' accept='.json,.yml,.yaml' ref={fileInputRef} className='hidden' onChange={handleFileUpload} />

      <ScheduleCreateOrUpdateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />
      {calendarMounted && (
        <Suspense fallback={null}>
          <ScheduleCalendarModal opened={openModal === 'calendar'} onClose={() => setOpenModal(null)} />
        </Suspense>
      )}
      <ImportOverlay
        visible={canCreate && isDragging}
        title={t('pages.server.schedules.dropzone.title', {})}
        subtitle={t('pages.server.schedules.dropzone.subtitle', {})}
      />

      <ScheduleActionBar selectedSchedules={selectedSchedules} clearSelection={clearSelection} onFinished={refetch} />

      <SelectionArea {...selectionAreaProps} disabled={!canSelect}>
        <Table
          columns={[
            ...(canSelect
              ? [
                  tableSelectionHeader({
                    checked: allSelected,
                    indeterminate: selectedSchedules.size > 0 && !allSelected,
                    onChange: (checked) => (checked ? selectAll() : clearSelection()),
                  }),
                ]
              : []),
            t('common.table.columns.name', {}),
            t('pages.server.schedules.table.columns.lastRun', {}),
            t('pages.server.schedules.table.columns.lastFailure', {}),
            t('common.table.columns.status', {}),
            t('common.table.columns.created', {}),
            '',
          ]}
          loading={loading}
          error={error}
          pagination={schedules}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
          empty={
            debouncedSearch ? undefined : (
              <EmptyState
                flush
                icon={faStopwatch}
                title={t('pages.server.schedules.empty.title', {})}
                description={
                  canCreate
                    ? t('pages.server.schedules.empty.description', {})
                    : t('pages.server.schedules.empty.descriptionReadOnly', {})
                }
              >
                <ServerCan action='schedules.create'>
                  <Group justify='center'>
                    <ConditionalTooltip
                      enabled={atLimit}
                      label={t('pages.server.schedules.tooltip.limitReached', { max: server.featureLimits.schedules })}
                    >
                      <Button
                        variant='default'
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!schedules || atLimit}
                        leftSection={<FontAwesomeIcon icon={faUpload} />}
                      >
                        {t('common.button.import', {})}
                      </Button>
                    </ConditionalTooltip>
                    <ConditionalTooltip
                      enabled={atLimit}
                      label={t('pages.server.schedules.tooltip.limitReached', { max: server.featureLimits.schedules })}
                    >
                      <Button
                        disabled={!schedules || atLimit}
                        onClick={() => setOpenModal('create')}
                        color='blue'
                        leftSection={<FontAwesomeIcon icon={faPlus} />}
                      >
                        {t('pages.server.schedules.button.createFirstSchedule', {})}
                      </Button>
                    </ConditionalTooltip>
                  </Group>
                </ServerCan>
              </EmptyState>
            )
          }
        >
          {schedules?.data.map((schedule) => (
            <SelectionArea.Selectable key={schedule.uuid} item={schedule}>
              {(innerRef: Ref<HTMLElement>) => (
                <ScheduleRow
                  schedule={schedule}
                  atLimit={atLimit}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedSchedules.has(schedule.uuid)}
                  onSelectionChange={
                    canSelect ? (selected, range) => toggleSchedule(schedule, selected, range) : undefined
                  }
                  onClick={(e) => handleScheduleClick(schedule, e)}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </ServerContentContainer>
  );
}
