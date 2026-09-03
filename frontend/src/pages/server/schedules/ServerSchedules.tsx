import { faCalendarDays, faPlus, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { load } from 'js-yaml';
import { ChangeEvent, useRef, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import getSchedules from '@/api/server/schedules/getSchedules.ts';
import importSchedule from '@/api/server/schedules/importSchedule.ts';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import ImportOverlay from '@/elements/ImportOverlay.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useImportDragAndDrop } from '@/plugins/import/useImportDragAndDrop.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import ScheduleCalendarModal from './modals/ScheduleCalendarModal.tsx';
import ScheduleCreateOrUpdateModal from './modals/ScheduleCreateOrUpdateModal.tsx';
import ScheduleRow from './ScheduleRow.tsx';

export default function ServerSchedules() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();

  const canCreate = useServerCan('schedules.create');

  const [openModal, setOpenModal] = useState<'create' | 'calendar' | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: schedules,
    loading,
    error,
    search,
    setSearch,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).schedules.all(),
    fetcher: (page, search) => getSchedules(server.uuid, page, search),
  });

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

    importSchedule(server.uuid, data)
      .then(() => {
        refetch();
        addToast(t('pages.server.schedules.toast.imported', {}), 'success');
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

  return (
    <ServerContentContainer
      title={t('pages.server.schedules.title', {})}
      subtitle={t('pages.server.schedules.subtitle', {
        current: schedules?.total ?? 0,
        max: server.featureLimits.schedules,
      })}
      search={search}
      setSearch={setSearch}
      contentRight={
        <>
          <ServerCan action='schedules.read'>
            <Button variant='default' onClick={() => setOpenModal('calendar')}>
              <FontAwesomeIcon icon={faCalendarDays} className='mr-2' />
              {t('pages.server.schedules.button.viewCalendar', {})}
            </Button>
          </ServerCan>

          <ServerCan action='schedules.create'>
            <ConditionalTooltip
              enabled={(schedules?.total ?? 0) >= server.featureLimits.schedules}
              label={t('pages.server.schedules.tooltip.limitReached', { max: server.featureLimits.schedules })}
            >
              <Button
                onClick={() => fileInputRef.current?.click()}
                color='blue'
                disabled={(schedules?.total ?? 0) >= server.featureLimits.schedules}
              >
                <FontAwesomeIcon icon={faUpload} className='mr-2' />
                {t('common.button.import', {})}
              </Button>
            </ConditionalTooltip>
            <ConditionalTooltip
              enabled={(schedules?.total ?? 0) >= server.featureLimits.schedules}
              label={t('pages.server.schedules.tooltip.limitReached', { max: server.featureLimits.schedules })}
            >
              <Button
                disabled={(schedules?.total ?? 0) >= server.featureLimits.schedules}
                onClick={() => setOpenModal('create')}
                color='blue'
                leftSection={<FontAwesomeIcon icon={faPlus} />}
              >
                {t('common.button.create', {})}
              </Button>
            </ConditionalTooltip>
          </ServerCan>

          <input
            type='file'
            accept='.json,.yml,.yaml'
            ref={fileInputRef}
            className='hidden'
            onChange={handleFileUpload}
          />
        </>
      }
    >
      <ScheduleCreateOrUpdateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />
      <ScheduleCalendarModal opened={openModal === 'calendar'} onClose={() => setOpenModal(null)} />
      <ImportOverlay
        visible={canCreate && isDragging}
        title={t('pages.server.schedules.dropzone.title', {})}
        subtitle={t('pages.server.schedules.dropzone.subtitle', {})}
      />

      <Table
        columns={[
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
      >
        {schedules?.data.map((schedule) => (
          <ScheduleRow key={schedule.uuid} schedule={schedule} />
        ))}
      </Table>
    </ServerContentContainer>
  );
}
