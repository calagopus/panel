import {
  faChartPie,
  faCircleInfo,
  faHardDrive,
  faMemory,
  faMicrochip,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SimpleGrid, Text } from '@mantine/core';
import { z } from 'zod';
import getNodeCapacity from '@/api/admin/nodes/getNodeCapacity.ts';
import getNodeSystemOverview from '@/api/admin/nodes/system/getNodeSystemOverview.ts';
import CapacityCard from '@/elements/admin/CapacityCard.tsx';
import InfoRow from '@/elements/admin/InfoRow.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useNodeUpdateAvailable } from '@/plugins/nodes/useNodeVersion.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Node = z.infer<typeof adminNodeSchema>;

export default function NodeOverview({ node }: { node: Node }) {
  const { t } = useTranslations();

  const { data: capacity } = useResource({
    queryKey: queryKeys.admin.nodes.capacity(node.uuid),
    queryFn: () => getNodeCapacity(node.uuid),
    silent: true,
  });

  const { data: overview, error } = useResource({
    queryKey: queryKeys.admin.nodes.systemOverview(node.uuid),
    queryFn: () => getNodeSystemOverview(node.uuid),
    silent: true,
  });

  const hasUpdate = useNodeUpdateAvailable(overview?.version);

  return (
    <AdminSubContentContainer title={t('pages.admin.nodes.tabs.overview.page.title', {})} titleOrder={2}>
      <Group mb='md' gap='xs'>
        <Badge color={node.deploymentEnabled ? 'green' : 'red'} variant='light'>
          {node.deploymentEnabled
            ? t('pages.admin.nodes.tabs.capacity.page.status.deploymentEnabled', {})
            : t('pages.admin.nodes.tabs.capacity.page.status.deploymentDisabled', {})}
        </Badge>
        <Badge color={node.maintenanceEnabled ? 'red' : 'gray'} variant='light'>
          {node.maintenanceEnabled
            ? t('pages.admin.nodes.tabs.capacity.page.status.maintenanceEnabled', {})
            : t('pages.admin.nodes.tabs.capacity.page.status.maintenanceDisabled', {})}
        </Badge>
      </Group>

      <Stack gap='md'>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing='md'>
          <TitleCard
            title={t('pages.admin.nodes.tabs.overview.page.card.nodeDetails', {})}
            icon={<FontAwesomeIcon icon={faServer} />}
          >
            <Stack gap={0}>
              <InfoRow label={t('common.form.location', {})}>
                <TableLink to={`/admin/locations/${node.location.uuid}`} className='inline-flex items-center'>
                  {node.location.flag && (
                    <img
                      src={`/flags/${node.location.flag}.svg`}
                      alt={node.location.name}
                      className='w-5 h-5 mr-1 rounded-md shrink-0 my-auto'
                    />
                  )}
                  {node.location.name}
                </TableLink>
              </InfoRow>
              <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.url', {})}>
                <Text size='sm' ff='monospace' className='break-all'>
                  {node.url}
                </Text>
              </InfoRow>
              <InfoRow label={t('common.form.publicUrl', {})}>
                <Text size='sm' ff='monospace' className='break-all'>
                  {node.publicUrl ?? (
                    <Text span c='dimmed' size='sm'>
                      {t('common.na', {})}
                    </Text>
                  )}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.sftpAddress', {})}>
                <Text size='sm' ff='monospace'>
                  {node.sftpHost ?? new URL(node.url).hostname}:{node.sftpPort}
                </Text>
              </InfoRow>
              <InfoRow label={t('common.form.backupConfiguration', {})}>
                {node.backupConfiguration ? (
                  <TableLink to={`/admin/backup-configurations/${node.backupConfiguration.uuid}`}>
                    {node.backupConfiguration.name}
                  </TableLink>
                ) : (
                  <Text size='sm' c='dimmed'>
                    {t('pages.admin.nodes.tabs.overview.page.label.inheritedFromLocation', {})}
                  </Text>
                )}
              </InfoRow>
              {node.description && (
                <InfoRow label={t('common.form.description', {})}>
                  <Text size='sm'>{node.description}</Text>
                </InfoRow>
              )}
              <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.createdAt', {})}>
                <Text size='sm'>{formatDateTime(node.created)}</Text>
              </InfoRow>
              <ExtensionSlot
                components={
                  window.extensionContext.extensionRegistry.pages.admin.nodes.view.overview.nodeDetails
                    .appendedComponents
                }
                name='node-details-ext'
                props={{ node }}
              />
            </Stack>
          </TitleCard>

          <TitleCard
            title={t('pages.admin.nodes.tabs.overview.page.card.systemInfo', {})}
            icon={<FontAwesomeIcon icon={faCircleInfo} />}
          >
            {error ? (
              <Stack gap={0}>
                <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.wingsVersion', {})}>
                  <Text size='sm' c='dimmed'>
                    {t('pages.admin.nodes.tabs.overview.page.label.unavailable', {})}
                  </Text>
                </InfoRow>
              </Stack>
            ) : !overview ? (
              <Spinner.Centered />
            ) : (
              <Stack gap={0}>
                <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.wingsVersion', {})}>
                  <Group gap='xs' justify='flex-end'>
                    <Text size='sm' ff='monospace'>
                      {overview.version}
                    </Text>
                    {hasUpdate && (
                      <Badge color='yellow' variant='light' size='sm'>
                        {t('pages.admin.nodes.tabs.overview.page.badge.updateAvailable', {})}
                      </Badge>
                    )}
                  </Group>
                </InfoRow>
                <InfoRow label={t('common.stat.cpu', {})}>
                  <Text size='sm'>
                    {overview.cpu.brand} ({overview.cpu.cpuCount})
                  </Text>
                </InfoRow>
                <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.memory', {})}>
                  <Text size='sm'>{bytesToString(overview.memory.totalBytes)}</Text>
                </InfoRow>
                <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.servers', {})}>
                  <Text size='sm'>
                    {overview.servers.online} / {overview.servers.total}
                  </Text>
                </InfoRow>
                <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.kernelVersion', {})}>
                  <Text size='sm' ff='monospace'>
                    {overview.kernelVersion}
                  </Text>
                </InfoRow>
                <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.architecture', {})}>
                  <Text size='sm' ff='monospace'>
                    {overview.architecture}
                  </Text>
                </InfoRow>
              </Stack>
            )}
            <ExtensionSlot
              components={
                window.extensionContext.extensionRegistry.pages.admin.nodes.view.overview.systemInfo.appendedComponents
              }
              name='system-info-ext'
              props={{ node }}
            />
          </TitleCard>
        </SimpleGrid>

        <TitleCard
          title={t('pages.admin.nodes.tabs.capacity.page.card.resources', {})}
          icon={<FontAwesomeIcon icon={faChartPie} />}
          rightSection={
            capacity ? (
              <Badge color='gray' variant='light' ml='auto'>
                <FontAwesomeIcon icon={faServer} className='mr-1.5' />
                {t('pages.admin.nodes.tabs.capacity.page.label.servers', {})}: {capacity.allocated.servers}
              </Badge>
            ) : null
          }
        >
          {!capacity ? (
            <Spinner.Centered />
          ) : (
            <div className='grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4'>
              <CapacityCard
                label={t('pages.admin.nodes.tabs.capacity.page.label.memory', {})}
                icon={<FontAwesomeIcon icon={faMemory} />}
                allocated={capacity.allocated.memory}
                limit={capacity.limits.memory}
                noLimitLabel={t('pages.admin.nodes.tabs.capacity.page.label.noLimit', {})}
                footer={
                  capacity.limits.memory === 0 ? (
                    capacity.allocated.memoryOverhead > 0 ? (
                      <p className='text-xs'>
                        {t('pages.admin.nodes.tabs.capacity.page.label.overhead', {
                          size: bytesToString(mbToBytes(capacity.allocated.memoryOverhead)),
                        })}
                      </p>
                    ) : undefined
                  ) : (
                    <p className='text-xs'>
                      {t('pages.admin.nodes.tabs.capacity.page.label.free', {
                        size: bytesToString(mbToBytes(Math.max(capacity.limits.memory - capacity.allocated.memory, 0))),
                      })}
                      {capacity.allocated.memoryOverhead > 0 &&
                        ` ${t('pages.admin.nodes.tabs.capacity.page.label.overhead', {
                          size: bytesToString(mbToBytes(capacity.allocated.memoryOverhead)),
                        })}`}
                    </p>
                  )
                }
              />
              <CapacityCard
                label={t('pages.admin.nodes.tabs.capacity.page.label.disk', {})}
                icon={<FontAwesomeIcon icon={faHardDrive} />}
                allocated={capacity.allocated.disk}
                limit={capacity.limits.disk}
                noLimitLabel={t('pages.admin.nodes.tabs.capacity.page.label.noLimit', {})}
                footer={
                  capacity.limits.disk === 0 ? undefined : (
                    <p className='text-xs'>
                      {t('pages.admin.nodes.tabs.capacity.page.label.free', {
                        size: bytesToString(mbToBytes(Math.max(capacity.limits.disk - capacity.allocated.disk, 0))),
                      })}
                    </p>
                  )
                }
              />
              <CapacityCard
                label={t('common.stat.cpu', {})}
                icon={<FontAwesomeIcon icon={faMicrochip} />}
                allocated={capacity.allocated.cpu}
                limit={0}
                noLimitLabel={t('pages.admin.nodes.tabs.capacity.page.label.noLimit', {})}
                formatValue={(value) => `${value}%`}
                footer={t('pages.admin.nodes.tabs.capacity.page.label.cores', {
                  cores: (capacity.allocated.cpu / 100).toFixed(2),
                })}
              />
              <ExtensionSlot
                components={
                  window.extensionContext.extensionRegistry.pages.admin.nodes.view.overview.resources.appendedComponents
                }
                name='resources-ext'
                props={{ node }}
              />
            </div>
          )}
        </TitleCard>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.admin.nodes.view.overview.appendedCards.appendedComponents
          }
          name='overview-card-ext'
          props={{ node }}
        />
      </Stack>
    </AdminSubContentContainer>
  );
}
