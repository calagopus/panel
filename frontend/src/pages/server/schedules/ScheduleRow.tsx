import { faClone, faFileDownload, faPlay, faPlayCircle, faShareAlt, faTrash } from '@fortawesome/free-solid-svg-icons';
import jsYaml from 'js-yaml';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteSchedule from '@/api/server/schedules/deleteSchedule.ts';
import exportSchedule from '@/api/server/schedules/exportSchedule.ts';
import triggerSchedule from '@/api/server/schedules/triggerSchedule.ts';
import Badge from '@/elements/Badge.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { serverScheduleSchema } from '@/lib/schemas/server/schedules.ts';
import ScheduleDuplicateModal from '@/pages/server/schedules/modals/ScheduleDuplicateModal.tsx';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function ScheduleRow({ schedule }: { schedule: z.infer<typeof serverScheduleSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { server, removeSchedule } = useServerStore();
  const navigateUrl = `/server/${server.uuidShort}/schedules/${schedule.uuid}`;

  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);

  const doDelete = async () => {
    await deleteSchedule(server.uuid, schedule.uuid)
      .then(() => {
        addToast(t('pages.server.schedules.toast.deleted', {}), 'success');
        setOpenModal(null);
        removeSchedule(schedule);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doExport = (format: 'json' | 'yaml') => {
    exportSchedule(server.uuid, schedule.uuid)
      .then((data) => {
        addToast(t('pages.server.schedules.toast.exported', {}), 'success');

        if (format === 'json') {
          const jsonData = JSON.stringify(data, undefined, 2);
          const fileURL = URL.createObjectURL(new Blob([jsonData], { type: 'text/plain' }));
          const downloadLink = document.createElement('a');
          downloadLink.href = fileURL;
          downloadLink.download = `schedule-${schedule.uuid}.json`;
          document.body.appendChild(downloadLink);
          downloadLink.click();

          URL.revokeObjectURL(fileURL);
          downloadLink.remove();
        } else {
          const yamlData = jsYaml.dump(data, { flowLevel: -1, forceQuotes: true });
          const fileURL = URL.createObjectURL(new Blob([yamlData], { type: 'text/plain' }));
          const downloadLink = document.createElement('a');
          downloadLink.href = fileURL;
          downloadLink.download = `schedule-${schedule.uuid}.yml`;
          document.body.appendChild(downloadLink);
          downloadLink.click();

          URL.revokeObjectURL(fileURL);
          downloadLink.remove();
        }
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doTriggerSchedule = (skipCondition: boolean) => {
    triggerSchedule(server.uuid, schedule.uuid, skipCondition).then(() => {
      addToast(t('pages.server.schedules.toast.triggered', {}), 'success');
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.server.schedules.modal.deleteSchedule.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.server.schedules.modal.deleteSchedule.content', { name: schedule.name })}
      </ConfirmationModal>

      <ScheduleDuplicateModal
        schedule={schedule}
        opened={openModal === 'duplicate'}
        onClose={() => setOpenModal(null)}
      />

      <ContextMenu
        items={[
          {
            icon: faPlay,
            label: t('pages.server.schedules.button.trigger', {}),
            items: [
              {
                icon: faPlayCircle,
                label: t('pages.server.schedules.button.triggerWithCondition', {}),
                onClick: () => doTriggerSchedule(false),
                color: 'gray',
              },
              {
                icon: faPlay,
                label: t('pages.server.schedules.button.triggerSkipCondition', {}),
                onClick: () => doTriggerSchedule(true),
                color: 'gray',
              },
            ],
            canAccess: useServerCan('schedules.update'),
          },
          {
            icon: faShareAlt,
            label: t('common.button.export', {}),
            items: [
              {
                icon: faFileDownload,
                label: t('common.button.exportAs', { format: 'JSON' }),
                onClick: () => doExport('json'),
                color: 'gray',
              },
              {
                icon: faFileDownload,
                label: t('common.button.exportAs', { format: 'YAML' }),
                onClick: () => doExport('yaml'),
                color: 'gray',
              },
            ],
            canAccess: useServerCan('schedules.read'),
          },
          {
            icon: faClone,
            label: t('common.button.duplicate', {}),
            onClick: () => setOpenModal('duplicate'),
            color: 'gray',
            canAccess: useServerCan('schedules.create'),
          },
          {
            icon: faTrash,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: useServerCan('schedules.delete'),
          },
        ]}
      >
        {({ items, openMenu }) => (
          <TableRow
            className='cursor-pointer'
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
            onClick={() => navigate(navigateUrl)}
          >
            <TableData>{schedule.name}</TableData>

            <TableData>
              {schedule.lastRun ? <FormattedTimestamp timestamp={schedule.lastRun} /> : t('common.na', {})}
            </TableData>

            <TableData>
              {schedule.lastFailure ? <FormattedTimestamp timestamp={schedule.lastFailure} /> : t('common.na', {})}
            </TableData>

            <TableData>
              <Badge color={schedule.enabled ? 'green' : 'red'}>
                {schedule.enabled ? t('common.badge.active', {}) : t('common.badge.inactive', {})}
              </Badge>
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={schedule.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
