import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import deleteCrash from '@/api/admin/servers/logs/deleteCrash.ts';
import getCrashes from '@/api/admin/servers/logs/getCrashes.ts';
import getCrashLog from '@/api/admin/servers/logs/getCrashLog.ts';
import getInstallLogs from '@/api/admin/servers/logs/getInstallLogs.ts';
import getLogs from '@/api/admin/servers/logs/getLogs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import MonacoEditor from '@/elements/editors/MonacoEditor.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { stripAnsi } from '@/lib/format/ansi.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type LogType = 'console' | 'install' | 'crash';

export default function AdminServerLogs({ server }: { server: AdminServer }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [logType, setLogType] = useState<LogType>('install');
  const [lines, setLines] = useState(1000);
  const [crashId, setCrashId] = useState<number | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    data: crashes,
    loading: crashesLoading,
    error: crashesError,
  } = useResource({
    queryKey: queryKeys.admin.servers.crashes(server.uuid),
    queryFn: () => getCrashes(server.uuid),
    enabled: logType === 'crash',
    silent: true,
  });
  const crashesUnavailable =
    isAxiosError(crashesError) && (crashesError.response?.status === 404 || crashesError.response?.status === 417);
  const selectedCrash = crashes?.find((crash) => crash.id === crashId);

  const doView = () => {
    if (logType === 'crash' && !selectedCrash) return;

    setLoading(true);

    (logType === 'crash'
      ? getCrashLog(server.uuid, selectedCrash!.id)
      : logType === 'console'
        ? getLogs(server.uuid, lines)
        : getInstallLogs(server.uuid, lines)
    )
      .then((data) => {
        setContent(stripAnsi(data));
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const doDelete = async () => {
    if (!selectedCrash) return;

    await deleteCrash(server.uuid, selectedCrash.id)
      .then(() => {
        setDeleting(false);
        setCrashId(null);
        setContent(null);
        addToast(t('pages.admin.servers.tabs.logs.page.toast.crashDeleted', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.crashes(server.uuid) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <AdminSubContentContainer
      title={t('pages.admin.servers.tabs.logs.page.title', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.logs.subContainer}
      registryProps={{ server }}
    >
      {selectedCrash && (
        <ConfirmationModal
          opened={deleting}
          onClose={() => setDeleting(false)}
          title={t('pages.admin.servers.tabs.logs.page.modal.deleteCrash.title', {})}
          confirm={t('common.button.delete', {})}
          onConfirmed={doDelete}
        >
          {t('pages.admin.servers.tabs.logs.page.modal.deleteCrash.content', {
            timestamp: formatDateTime(selectedCrash.timestamp),
          }).md()}
        </ConfirmationModal>
      )}

      <div className='flex flex-col'>
        <div className='grid md:grid-cols-3 grid-cols-2 grid-rows-1 gap-2'>
          <div className='flex flex-row space-x-2 col-span-2'>
            <Select
              withAsterisk
              label={t('pages.admin.servers.tabs.logs.page.form.logType', {})}
              value={logType}
              className='w-full'
              onChange={(value) => setLogType(value as LogType)}
              data={[
                { label: t('pages.admin.servers.tabs.logs.page.enum.logType.console', {}), value: 'console' },
                { label: t('pages.admin.servers.tabs.logs.page.enum.logType.install', {}), value: 'install' },
                { label: t('pages.admin.servers.tabs.logs.page.enum.logType.crash', {}), value: 'crash' },
              ]}
            />
            {logType === 'crash' ? (
              <Select
                withAsterisk
                label={t('pages.admin.servers.tabs.logs.page.form.crash', {})}
                className='w-full'
                disabled={crashesLoading || crashesUnavailable || !crashes?.length}
                placeholder={
                  crashesUnavailable
                    ? t('pages.admin.servers.tabs.logs.page.crashesUnavailable', {})
                    : crashes && crashes.length === 0
                      ? t('pages.admin.servers.tabs.logs.page.noCrashes', {})
                      : undefined
                }
                error={crashesError && !crashesUnavailable ? httpErrorToHuman(crashesError) : undefined}
                value={selectedCrash ? String(selectedCrash.id) : null}
                onChange={(value) => setCrashId(value ? Number(value) : null)}
                data={(crashes ?? []).map((crash) => ({
                  value: String(crash.id),
                  label: crash.oomKilled
                    ? t('pages.admin.servers.tabs.logs.page.crashOptionOom', {
                        timestamp: formatDateTime(crash.timestamp),
                        exitCode: crash.exitCode,
                      })
                    : t('pages.admin.servers.tabs.logs.page.crashOption', {
                        timestamp: formatDateTime(crash.timestamp),
                        exitCode: crash.exitCode,
                      }),
                }))}
              />
            ) : (
              <NumberInput
                withAsterisk
                label={t('common.form.lines', {})}
                value={lines}
                min={1}
                className='w-full'
                onChange={(value) => {
                  const parsed = Number(value);
                  setLines(Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1);
                }}
              />
            )}
          </div>

          <div className='flex flex-row items-end gap-2'>
            <Button
              onClick={doView}
              variant='outline'
              loading={loading}
              disabled={logType === 'crash' && !selectedCrash}
            >
              {t('common.button.loadLogs', {})}
            </Button>
            {logType === 'crash' && selectedCrash && (
              <AdminCan action='servers.update'>
                <Button color='red' variant='outline' onClick={() => setDeleting(true)}>
                  {t('common.button.delete', {})}
                </Button>
              </AdminCan>
            )}
          </div>
        </div>

        <div className='mt-4 rounded-md overflow-hidden'>
          <MonacoEditor
            height='65vh'
            theme='vs-dark'
            value={content || ''}
            defaultLanguage='text'
            options={{
              readOnly: true,
              stickyScroll: { enabled: false },
              minimap: { enabled: false },
              codeLens: false,
              scrollBeyondLastLine: false,
              smoothScrolling: false,
              inertialScroll: true,
            }}
          />
        </div>
      </div>
    </AdminSubContentContainer>
  );
}
