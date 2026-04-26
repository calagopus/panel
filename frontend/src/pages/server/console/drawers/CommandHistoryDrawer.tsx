import { faArrowLeft, faClipboard, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Divider, DrawerProps, Group, ScrollArea, Stack, Title } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import getServerActivity from '@/api/server/getServerActivity.ts';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import Code from '@/elements/Code.tsx';
import Drawer from '@/elements/Drawer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { Pagination } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { handleCopyToClipboard } from '@/lib/copy.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverActivitySchema } from '@/lib/schemas/server/activity.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

interface CommandDetail {
  command: string;
  user?: string;
  isSchedule?: boolean;
  avatar?: string | null;
  created: Date;
}

export default function CommandHistoryDrawer({ opened, onClose, ...props }: DrawerProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const state = useServerStore((state) => state.state);
  const socketInstance = useServerStore((state) => state.socketInstance);

  const [selectedCommand, setSelectedCommand] = useState<CommandDetail | null>(null);

  const { data, loading, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).activity.all(),
    fetcher: (page) => getServerActivity(server.uuid, page, 'server:console.command'),
    modifyParams: false,
    deps: [server.uuid],
  });

  const activities = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  const handleRowClick = (activity: z.infer<typeof serverActivitySchema>) => {
    const data = activity.data as { command?: string } | null;
    if (data?.command) {
      setSelectedCommand({
        command: data.command,
        user: activity.user?.username,
        isSchedule: activity.isSchedule,
        avatar: activity.user?.avatar,
        created: activity.created,
      });
    }
  };

  const handleSendCommand = () => {
    if (selectedCommand && socketInstance && state === 'running') {
      socketInstance.send('send command', selectedCommand.command);
      addToast(t('pages.server.console.drawer.commandHistory.commandSent', {}), 'success');
      setSelectedCommand(null);
    }
  };

  return (
    <Drawer
      position='right'
      offset={8}
      radius='md'
      opened={opened}
      onClose={onClose}
      title={t('pages.server.console.drawer.commandHistory.title', {})}
      size='sm'
      {...props}
    >
      <Stack gap='md' className='h-full'>
        {selectedCommand ? (
          <Stack gap='md' className='flex-1 overflow-hidden'>
            <div className='flex items-center justify-between'>
              <Title order={4} className='text-white'>
                {t('pages.server.console.drawer.commandHistory.detailTitle', {})}
              </Title>
              <Button
                variant='subtle'
                size='xs'
                onClick={() => setSelectedCommand(null)}
                leftSection={<FontAwesomeIcon icon={faArrowLeft} />}
              >
                {t('common.button.back', {})}
              </Button>
            </div>

            <Group gap='xs' className='text-sm text-gray-400'>
              <img
                src={selectedCommand.avatar ?? '/icon.svg'}
                alt={selectedCommand.user ?? 'System'}
                className='size-5 rounded-full'
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/icon.svg';
                }}
              />
              <span>
                {selectedCommand.user ??
                  (selectedCommand.isSchedule ? t('common.schedule', {}) : t('common.system', {}))}
              </span>
              <span>•</span>
              <FormattedTimestamp timestamp={selectedCommand.created} />
            </Group>

            <ScrollArea className='flex-1' offsetScrollbars>
              <Code block className='whitespace-pre-wrap break-all p-4 text-sm'>
                {selectedCommand.command}
              </Code>
            </ScrollArea>

            <Group gap='sm'>
              <Button
                onClick={handleSendCommand}
                disabled={state === 'offline' || !socketInstance}
                leftSection={<FontAwesomeIcon icon={faPaperPlane} />}
                className='flex-1'
              >
                {t('pages.server.console.drawer.commandHistory.sendButton', {})}
              </Button>
              <Button
                onClick={handleCopyToClipboard(selectedCommand.command, addToast)}
                leftSection={<FontAwesomeIcon icon={faClipboard} />}
                variant='outline'
                className='flex-1'
              >
                {t('pages.server.console.drawer.commandHistory.copyButton', {})}
              </Button>
            </Group>
          </Stack>
        ) : (
          <ScrollArea className='flex-1' offsetScrollbars>
            {activities.total > activities.perPage && (
              <>
                <Pagination data={activities} onPageSelect={setPage} />
                <Divider my='md' />
              </>
            )}

            {loading && activities.data.length === 0 ? (
              <Spinner.Centered />
            ) : activities.data.length === 0 ? (
              <div className='flex items-center justify-center py-12 text-gray-400'>
                {t('pages.server.console.drawer.commandHistory.noCommands', {})}
              </div>
            ) : (
              <Stack gap='xs'>
                {activities.data.map((activity, index) => {
                  const data = activity.data as { command?: string } | null;
                  if (!data?.command) return null;

                  return (
                    <Card
                      key={`${activity.created}-${index}`}
                      onClick={() => handleRowClick(activity)}
                      className='p-3 rounded-md border cursor-pointer transition-all border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                      hoverable
                    >
                      <div className='flex items-start gap-3'>
                        <img
                          src={activity.user?.avatar ?? '/icon.svg'}
                          alt={activity.user?.username ?? 'System'}
                          className='size-6 rounded-full shrink-0 mt-0.5'
                        />
                        <div className='flex-1 min-w-0'>
                          <Code className='block mb-1.5 text-xs wrap-break-word'>{data.command}</Code>
                          <div className='flex items-center gap-2 text-xs text-gray-400'>
                            <span>
                              {activity.user?.username ??
                                (activity.isSchedule ? t('common.schedule', {}) : t('common.system', {}))}
                            </span>
                            <span>•</span>
                            <FormattedTimestamp timestamp={activity.created} />
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </Stack>
            )}

            {activities.total > activities.perPage && (
              <>
                <Divider my='md' />
                <Pagination data={activities} onPageSelect={setPage} />
              </>
            )}
          </ScrollArea>
        )}
      </Stack>
    </Drawer>
  );
}
