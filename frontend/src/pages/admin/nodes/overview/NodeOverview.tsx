import {
  faChartBar,
  faChartPie,
  faCircleInfo,
  faCircleUp,
  faHardDrive,
  faMemory,
  faMicrochip,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Text } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import getNodeCapacity from '@/api/admin/nodes/getNodeCapacity.ts';
import getNodeSystemOverview from '@/api/admin/nodes/system/getNodeSystemOverview.ts';
import getNodeSystemStats from '@/api/admin/nodes/system/getNodeSystemStats.ts';
import AllocationBar, {
  allocationTotalsSchema,
  groupAllocationSegments,
  noAllocationTotals,
} from '@/elements/admin/AllocationBar.tsx';
import CapacityCard from '@/elements/admin/CapacityCard.tsx';
import InfoRow from '@/elements/admin/InfoRow.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import RedactedText from '@/elements/typography/RedactedText.tsx';
import { bytesToMb, bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeCapacitySchema, adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useUserSettingMapEntry } from '@/lib/userSettings.ts';
import { useNodeOnlineWait } from '@/plugins/nodes/useNodeOnlineWait.ts';
import { useNodeUpgradeStatus } from '@/plugins/nodes/useNodeVersion.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useUpgradeRestart } from '@/plugins/useUpgradeRestart.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeUpgradeModal from '../modals/NodeUpgradeModal.tsx';

type Node = z.infer<typeof adminNodeSchema>;
type CapacityServer = z.infer<typeof adminNodeCapacitySchema>['servers'][number];

export default function NodeOverview({ node }: { node: Node }) {
  const { t, tItem } = useTranslations();

  const [allocationTotals, setAllocationTotals] = useUserSettingMapEntry(
    'admin::node_allocation_totals',
    node.uuid,
    allocationTotalsSchema,
    noAllocationTotals,
  );

  const { data: systemStats } = useResource({
    queryKey: queryKeys.admin.nodes.systemStats(node.uuid),
    queryFn: () => getNodeSystemStats(node.uuid),
    enabled: Object.values(allocationTotals).some((total) => total?.mode === 'live'),
    silent: true,
  });

  const serverSegments = (servers: CapacityServer[], value: (server: CapacityServer) => number) =>
    groupAllocationSegments(
      servers,
      value,
      (server) => ({
        key: server.uuid,
        label: server.name,
        to: `/admin/servers/${server.uuid}`,
        striped: server.suspended,
        hint: server.suspended ? t('pages.admin.nodes.tabs.capacity.page.label.suspended', {}) : undefined,
      }),
      (count) => t('pages.admin.nodes.tabs.capacity.page.label.other', { servers: tItem('server', count) }),
    );

  const unlimitedServers = (servers: CapacityServer[], value: (server: CapacityServer) => number) => {
    const count = servers.filter((server) => value(server) === 0).length;

    return count > 0 ? (
      <Text size='xs' c='dimmed'>
        {t('pages.admin.nodes.tabs.capacity.page.label.unlimitedServers', { servers: tItem('server', count) })}
      </Text>
    ) : undefined;
  };

  const capacityResource = useResource({
    queryKey: queryKeys.admin.nodes.capacity(node.uuid),
    queryFn: () => getNodeCapacity(node.uuid),
    silent: true,
  });

  const { data: overview, error } = useResource({
    queryKey: queryKeys.admin.nodes.systemOverview(node.uuid),
    queryFn: () => getNodeSystemOverview(node.uuid),
    silent: true,
  });

  const { availability: upgradeAvailability } = useNodeUpgradeStatus(node.uuid);

  const [openModal, setOpenModal] = useState<'upgrade' | null>(null);
  const onlineWait = useNodeOnlineWait();
  const upgradeRestart = useUpgradeRestart(onlineWait, [
    queryKeys.admin.nodes.systemOverview(node.uuid),
    queryKeys.admin.nodes.systemDirect(node.uuid),
    queryKeys.admin.nodes.upgradeStatus(node.uuid),
    queryKeys.admin.updates.nodes(),
  ]);

  return (
    <AdminSubContentContainer title={t('pages.admin.nodes.tabs.overview.page.title', {})} titleOrder={2}>
      {overview?.upgrade && (
        <NodeUpgradeModal
          node={node}
          onScheduled={(previousVersion) => upgradeRestart.start(node.uuid, previousVersion)}
          opened={openModal === 'upgrade'}
          onClose={() => setOpenModal(null)}
        />
      )}

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
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
          <TitleCard title={t('pages.admin.nodes.tabs.overview.page.card.nodeDetails', {})} icon={faServer}>
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
                  <RedactedText value={node.url} />
                </Text>
              </InfoRow>
              <InfoRow label={t('common.form.publicUrl', {})}>
                <Text size='sm' ff='monospace' className='break-all'>
                  {node.publicUrl ? (
                    <RedactedText value={node.publicUrl} />
                  ) : (
                    <Text span c='dimmed' size='sm'>
                      {t('common.na', {})}
                    </Text>
                  )}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.sftpAddress', {})}>
                <Text size='sm' ff='monospace'>
                  <RedactedText value={node.sftpHost ?? new URL(node.url).hostname} suffix={`:${node.sftpPort}`} />
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

          <TitleCard title={t('pages.admin.nodes.tabs.overview.page.card.systemInfo', {})} icon={faCircleInfo}>
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
                    {upgradeAvailability === 'available' && (
                      <Badge color='yellow' variant='light' size='sm'>
                        {t('pages.admin.nodes.tabs.overview.page.badge.updateAvailable', {})}
                      </Badge>
                    )}
                    {upgradeAvailability === 'unknown' && (
                      <Badge color='gray' variant='light' size='sm'>
                        {t('pages.admin.nodes.tabs.overview.page.badge.latestVersionUnknown', {})}
                      </Badge>
                    )}
                    {upgradeRestart.restarting ? (
                      <Badge variant='light' size='sm' loading>
                        {t('common.badge.restarting', {})}
                      </Badge>
                    ) : (
                      overview.upgrade && (
                        <AdminCan action='nodes.upgrade'>
                          <Button
                            size='xs'
                            variant='light'
                            leftSection={<FontAwesomeIcon icon={faCircleUp} />}
                            onClick={() => setOpenModal('upgrade')}
                          >
                            {t('common.button.upgrade', {})}
                          </Button>
                        </AdminCan>
                      )
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
        </div>

        <TitleCard
          title={t('pages.admin.nodes.tabs.capacity.page.card.resources', {})}
          icon={faChartPie}
          rightSection={
            <Badge color='gray' variant='light' ml='auto' loading={!capacityResource.data && !capacityResource.error}>
              <FontAwesomeIcon icon={faServer} className='mr-1.5' />
              {t('pages.admin.nodes.tabs.capacity.page.label.servers', {})}: {capacityResource.data?.allocated.servers}
            </Badge>
          }
        >
          <ResourceView resource={capacityResource}>
            {(capacity) => (
              <div className='grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4'>
                <CapacityCard
                  label={t('pages.admin.nodes.tabs.capacity.page.label.memory', {})}
                  icon={faMemory}
                  allocated={capacity.allocated.memory}
                  limit={capacity.limits.memory}
                  noLimitLabel={t('pages.admin.nodes.tabs.capacity.page.label.noLimit', {})}
                  footer={
                    capacity.limits.memory === 0 ? (
                      capacity.allocated.memoryOverhead > 0 ? (
                        <p className='text-xs text-(--mantine-color-dimmed)'>
                          {t('pages.admin.nodes.tabs.capacity.page.label.overhead', {
                            size: bytesToString(mbToBytes(capacity.allocated.memoryOverhead)),
                          })}
                        </p>
                      ) : undefined
                    ) : (
                      <p className='text-xs text-(--mantine-color-dimmed)'>
                        {t('pages.admin.nodes.tabs.capacity.page.label.free', {
                          size: bytesToString(
                            mbToBytes(Math.max(capacity.limits.memory - capacity.allocated.memory, 0)),
                          ),
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
                  icon={faHardDrive}
                  allocated={capacity.allocated.disk}
                  limit={capacity.limits.disk}
                  noLimitLabel={t('pages.admin.nodes.tabs.capacity.page.label.noLimit', {})}
                  footer={
                    capacity.limits.disk === 0 ? undefined : (
                      <p className='text-xs text-(--mantine-color-dimmed)'>
                        {t('pages.admin.nodes.tabs.capacity.page.label.free', {
                          size: bytesToString(mbToBytes(Math.max(capacity.limits.disk - capacity.allocated.disk, 0))),
                        })}
                      </p>
                    )
                  }
                />
                <CapacityCard
                  label={t('common.stat.cpu', {})}
                  icon={faMicrochip}
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
                    window.extensionContext.extensionRegistry.pages.admin.nodes.view.overview.resources
                      .appendedComponents
                  }
                  name='resources-ext'
                  props={{ node }}
                />
              </div>
            )}
          </ResourceView>
        </TitleCard>

        <TitleCard title={t('pages.admin.nodes.tabs.capacity.page.card.breakdown', {})} icon={faChartBar}>
          <ResourceView resource={capacityResource}>
            {(capacity) => {
              const formatSize = (value: number) => bytesToString(mbToBytes(value));
              const emptyLabel = t('pages.admin.nodes.tabs.capacity.page.label.noAllocations', {});
              const overallocatedLabel = (size: string) =>
                t('pages.admin.nodes.tabs.capacity.page.label.overallocated', { size });

              return (
                <Stack gap='lg'>
                  <AllocationBar
                    label={t('pages.admin.nodes.tabs.capacity.page.label.memory', {})}
                    icon={faMemory}
                    segments={[
                      ...serverSegments(capacity.servers, (server) => server.memory),
                      ...(capacity.allocated.memoryOverhead > 0
                        ? [
                            {
                              key: 'overhead',
                              label: t('pages.admin.nodes.tabs.capacity.page.label.memoryOverhead', {}),
                              value: capacity.allocated.memoryOverhead,
                              color: 'dark.3',
                            },
                          ]
                        : []),
                    ]}
                    limit={capacity.limits.memory}
                    formatValue={formatSize}
                    emptyLabel={emptyLabel}
                    overallocatedLabel={overallocatedLabel}
                    details={unlimitedServers(capacity.servers, (server) => server.memory)}
                    totalSource={{
                      unit: 'mb',
                      value: allocationTotals.memory,
                      onChange: (memory) => setAllocationTotals({ ...allocationTotals, memory }),
                      liveTotal: systemStats ? bytesToMb(systemStats.memory.total) : null,
                    }}
                  />
                  <AllocationBar
                    label={t('pages.admin.nodes.tabs.capacity.page.label.disk', {})}
                    icon={faHardDrive}
                    segments={serverSegments(capacity.servers, (server) => server.disk)}
                    limit={capacity.limits.disk}
                    formatValue={formatSize}
                    emptyLabel={emptyLabel}
                    overallocatedLabel={overallocatedLabel}
                    details={unlimitedServers(capacity.servers, (server) => server.disk)}
                    totalSource={{
                      unit: 'mb',
                      value: allocationTotals.disk,
                      onChange: (disk) => setAllocationTotals({ ...allocationTotals, disk }),
                      liveTotal: systemStats ? bytesToMb(systemStats.disk.total) : null,
                    }}
                  />
                  <AllocationBar
                    label={t('common.stat.cpu', {})}
                    icon={faMicrochip}
                    segments={serverSegments(capacity.servers, (server) => server.cpu)}
                    limit={0}
                    formatValue={(value) => `${value}%`}
                    emptyLabel={emptyLabel}
                    overallocatedLabel={overallocatedLabel}
                    details={unlimitedServers(capacity.servers, (server) => server.cpu)}
                    totalSource={{
                      unit: 'percent',
                      value: allocationTotals.cpu,
                      onChange: (cpu) => setAllocationTotals({ ...allocationTotals, cpu }),
                      liveTotal: systemStats ? systemStats.cpu.threads * 100 : null,
                    }}
                  />
                </Stack>
              );
            }}
          </ResourceView>
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
