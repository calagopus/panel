import { faPlus, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import jsYaml from 'js-yaml';
import { ChangeEvent, useRef, useState } from 'react';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import getSchedules from '@/api/server/schedules/getSchedules.ts';
import importSchedule from '@/api/server/schedules/importSchedule.ts';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useImportDragAndDrop } from '@/plugins/useImportDragAndDrop.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import ScheduleCreateOrUpdateModal from './modals/ScheduleCreateOrUpdateModal.tsx';
import ScheduleImportOverlay from './ScheduleImportOverlay.tsx';
import ScheduleRow from './ScheduleRow.tsx';

export default function ServerSchedules() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data, loading, search, setSearch, setPage, refetch } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).schedules.all(),
    fetcher: (page, search) => getSchedules(server.uuid, page, search),
  });

  const schedules = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

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
      subtitle={t('pages.server.schedules.subtitle', { current: schedules.total, max: server.featureLimits.schedules })}
      search={search}
      setSearch={setSearch}
      contentRight={
        <>
          <ServerCan action='schedules.create'>
            <Button onClick={() => fileInputRef.current?.click()} color='blue'>
              <FontAwesomeIcon icon={faUpload} className='mr-2' />
              {t('pages.server.schedules.button.import', {})}
            </Button>
            <ConditionalTooltip
              enabled={schedules.total >= server.featureLimits.schedules}
              label={t('pages.server.schedules.tooltip.limitReached', { max: server.featureLimits.schedules })}
            >
              <Button
                disabled={schedules.total >= server.featureLimits.schedules}
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
      <ScheduleImportOverlay visible={isDragging} />

      <ContextMenuProvider>
        <Table
          columns={[
            t('common.table.columns.name', {}),
            t('pages.server.schedules.table.columns.lastRun', {}),
            t('pages.server.schedules.table.columns.lastFailure', {}),
            t('pages.server.schedules.table.columns.status', {}),
            t('common.table.columns.created', {}),
            '',
          ]}
          loading={loading}
          pagination={schedules}
          onPageSelect={setPage}
        >
          {schedules.data.map((schedule) => (
            <ScheduleRow key={schedule.uuid} schedule={schedule} />
          ))}
        </Table>
      </ContextMenuProvider>
    </ServerContentContainer>
  );
}
