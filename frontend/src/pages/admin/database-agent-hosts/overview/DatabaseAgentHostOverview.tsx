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
import { useState } from 'react';
import { z } from 'zod';
import getDatabaseAgentHostCapacity from '@/api/admin/database-agent-hosts/getDatabaseAgentHostCapacity.ts';
import getDatabaseAgentHostSystemOverview from '@/api/admin/database-agent-hosts/getDatabaseAgentHostSystemOverview.ts';
import getDatabaseAgentHostSystemStats from '@/api/admin/database-agent-hosts/getDatabaseAgentHostSystemStats.ts';
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
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import Text from '@/elements/typography/Text.tsx';
import { bytesToMb, bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminDatabaseAgentHostCapacitySchema,
  adminDatabaseAgentHostSchema,
} from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { useUserSettingMapEntry } from '@/lib/userSettings.ts';
import { useDatabaseAgentHostOnlineWait } from '@/plugins/database-agent-hosts/useDatabaseAgentHostOnlineWait.ts';
import { useDatabaseAgentHostUpgradeStatus } from '@/plugins/database-agent-hosts/useDatabaseAgentHostVersion.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useUpgradeRestart } from '@/plugins/useUpgradeRestart.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseAgentHostUpgradeModal from '../modals/DatabaseAgentHostUpgradeModal.tsx';

type DatabaseAgentHost = z.infer<typeof adminDatabaseAgentHostSchema>;
type CapacityInstance = z.infer<typeof adminDatabaseAgentHostCapacitySchema>['instances'][number];

export default function DatabaseAgentHostOverview({ databaseAgentHost }: { databaseAgentHost: DatabaseAgentHost }) {
  const { t, tItem } = useTranslations();

  const [allocationTotals, setAllocationTotals] = useUserSettingMapEntry(
    'admin::database_agent_host_allocation_totals',
    databaseAgentHost.uuid,
    allocationTotalsSchema,
    noAllocationTotals,
  );

  const { data: systemStats } = useResource({
    queryKey: queryKeys.admin.databaseAgentHosts.systemStats(databaseAgentHost.uuid),
    queryFn: () => getDatabaseAgentHostSystemStats(databaseAgentHost.uuid),
    enabled: Object.values(allocationTotals).some((total) => total?.mode === 'live'),
    silent: true,
  });

  const capacityResource = useResource({
    queryKey: queryKeys.admin.databaseAgentHosts.capacity(databaseAgentHost.uuid),
    queryFn: () => getDatabaseAgentHostCapacity(databaseAgentHost.uuid),
    silent: true,
  });

  const { data: overview, error } = useResource({
    queryKey: queryKeys.admin.databaseAgentHosts.systemOverview(databaseAgentHost.uuid),
    queryFn: () => getDatabaseAgentHostSystemOverview(databaseAgentHost.uuid),
    silent: true,
  });

  const instanceSegments = (instances: CapacityInstance[], value: (instance: CapacityInstance) => number) =>
    groupAllocationSegments(
      instances,
      value,
      (instance) => ({
        key: instance.uuid,
        label: instance.name,
        to: `/admin/servers/${instance.serverUuid}`,
        hint: instance.serverName,
      }),
      (count) =>
        t('pages.admin.databaseAgentHosts.tabs.overview.page.label.other', { instances: tItem('instance', count) }),
    );

  const unlimitedInstances = (instances: CapacityInstance[], value: (instance: CapacityInstance) => number) => {
    const count = instances.filter((instance) => value(instance) === 0).length;

    return count > 0 ? (
      <Text size='xs' c='dimmed'>
        {t('pages.admin.databaseAgentHosts.tabs.overview.page.label.unlimitedInstances', {
          instances: tItem('instance', count),
        })}
      </Text>
    ) : undefined;
  };

  const { availability: upgradeAvailability } = useDatabaseAgentHostUpgradeStatus(databaseAgentHost.uuid);

  const [openModal, setOpenModal] = useState<'upgrade' | null>(null);
  const onlineWait = useDatabaseAgentHostOnlineWait();
  const upgradeRestart = useUpgradeRestart(onlineWait, [
    queryKeys.admin.databaseAgentHosts.systemOverview(databaseAgentHost.uuid),
    queryKeys.admin.databaseAgentHosts.upgradeStatus(databaseAgentHost.uuid),
    queryKeys.admin.updates.databaseAgentHosts(),
  ]);

  return (
    <AdminSubContentContainer
      title={t('pages.admin.databaseAgentHosts.tabs.overview.page.title', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.databaseAgentHosts.view.overview.subContainer}
      registryProps={{ databaseAgentHost }}
    >
      {overview?.upgrade && (
        <DatabaseAgentHostUpgradeModal
          databaseAgentHost={databaseAgentHost}
          onScheduled={(previousVersion) => upgradeRestart.start(databaseAgentHost.uuid, previousVersion)}
          opened={openModal === 'upgrade'}
          onClose={() => setOpenModal(null)}
        />
      )}

      <Group mb='md' gap='xs'>
        <Badge color={databaseAgentHost.deploymentEnabled ? 'green' : 'red'} variant='light'>
          {databaseAgentHost.deploymentEnabled
            ? t('common.badge.deploymentEnabled', {})
            : t('common.badge.deploymentDisabled', {})}
        </Badge>
        <Badge color={databaseAgentHost.maintenanceEnabled ? 'red' : 'gray'} variant='light'>
          {databaseAgentHost.maintenanceEnabled
            ? t('common.badge.maintenanceEnabled', {})
            : t('common.badge.maintenanceDisabled', {})}
        </Badge>
      </Group>

      <Stack gap='md'>
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
          <TitleCard
            title={t('pages.admin.databaseAgentHosts.tabs.overview.page.card.hostDetails', {})}
            icon={faServer}
          >
            <Stack gap={0}>
              <InfoRow label={t('common.form.url', {})}>
                <Text size='sm' ff='monospace' className='break-all'>
                  {databaseAgentHost.url}
                </Text>
              </InfoRow>
              <InfoRow label={t('common.form.memory', {})}>
                <Text size='sm'>
                  {databaseAgentHost.memory === 0
                    ? t('pages.admin.databaseAgentHosts.tabs.overview.page.label.noLimit', {})
                    : bytesToString(mbToBytes(databaseAgentHost.memory))}
                </Text>
              </InfoRow>
              <InfoRow label={t('common.form.disk', {})}>
                <Text size='sm'>
                  {databaseAgentHost.disk === 0
                    ? t('pages.admin.databaseAgentHosts.tabs.overview.page.label.noLimit', {})
                    : bytesToString(mbToBytes(databaseAgentHost.disk))}
                </Text>
              </InfoRow>
              {databaseAgentHost.description && (
                <InfoRow label={t('common.form.description', {})}>
                  <Text size='sm'>{databaseAgentHost.description}</Text>
                </InfoRow>
              )}
              <InfoRow label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.createdAt', {})}>
                <Text size='sm'>{formatDateTime(databaseAgentHost.created)}</Text>
              </InfoRow>
            </Stack>
          </TitleCard>

          <TitleCard
            title={t('pages.admin.databaseAgentHosts.tabs.overview.page.card.systemInfo', {})}
            icon={faCircleInfo}
          >
            {error ? (
              <Stack gap={0}>
                <InfoRow label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.version', {})}>
                  <Text size='sm' c='dimmed'>
                    {t('pages.admin.databaseAgentHosts.tabs.overview.page.label.unavailable', {})}
                  </Text>
                </InfoRow>
              </Stack>
            ) : !overview ? (
              <Spinner.Centered />
            ) : (
              <Stack gap={0}>
                <InfoRow label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.version', {})}>
                  <Group gap='xs' justify='flex-end'>
                    <Text size='sm' ff='monospace'>
                      {overview.version}
                    </Text>
                    {upgradeAvailability === 'available' && (
                      <Badge color='yellow' variant='light' size='sm'>
                        {t('common.badge.updateAvailable', {})}
                      </Badge>
                    )}
                    {upgradeAvailability === 'unknown' && (
                      <Badge color='gray' variant='light' size='sm'>
                        {t('pages.admin.databaseAgentHosts.tabs.overview.page.badge.latestVersionUnknown', {})}
                      </Badge>
                    )}
                    {upgradeRestart.restarting ? (
                      <Badge variant='light' size='sm' loading>
                        {t('common.badge.restarting', {})}
                      </Badge>
                    ) : (
                      overview.upgrade &&
                      upgradeAvailability === 'available' && (
                        <AdminCan action='database-agent-hosts.upgrade'>
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
                <InfoRow label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.memory', {})}>
                  <Text size='sm'>{bytesToString(overview.memory.totalBytes)}</Text>
                </InfoRow>
                <InfoRow label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.instances', {})}>
                  <Text size='sm'>
                    {overview.instances.online} / {overview.instances.total}
                  </Text>
                </InfoRow>
                <InfoRow label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.kernelVersion', {})}>
                  <Text size='sm' ff='monospace'>
                    {overview.kernelVersion}
                  </Text>
                </InfoRow>
                <InfoRow label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.architecture', {})}>
                  <Text size='sm' ff='monospace'>
                    {overview.architecture}
                  </Text>
                </InfoRow>
              </Stack>
            )}
          </TitleCard>
        </div>

        <TitleCard
          title={t('pages.admin.databaseAgentHosts.tabs.overview.page.card.resources', {})}
          icon={faChartPie}
          rightSection={
            <Badge color='gray' variant='light' ml='auto' loading={!capacityResource.data && !capacityResource.error}>
              <FontAwesomeIcon icon={faServer} className='mr-1.5' />
              {t('pages.admin.databaseAgentHosts.tabs.overview.page.label.instances', {})}:{' '}
              {capacityResource.data?.allocated.instances}
            </Badge>
          }
        >
          <ResourceView resource={capacityResource}>
            {(capacity) => (
              <div className='grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4'>
                <CapacityCard
                  label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.memory', {})}
                  icon={faMemory}
                  allocated={capacity.allocated.memory}
                  limit={capacity.limits.memory}
                  noLimitLabel={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.noLimit', {})}
                  footer={
                    capacity.limits.memory === 0 ? undefined : (
                      <p className='text-xs text-(--mantine-color-dimmed)'>
                        {t('pages.admin.databaseAgentHosts.tabs.overview.page.label.free', {
                          size: bytesToString(
                            mbToBytes(Math.max(capacity.limits.memory - capacity.allocated.memory, 0)),
                          ),
                        })}
                      </p>
                    )
                  }
                />
                <CapacityCard
                  label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.disk', {})}
                  icon={faHardDrive}
                  allocated={capacity.allocated.disk}
                  limit={capacity.limits.disk}
                  noLimitLabel={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.noLimit', {})}
                  footer={
                    capacity.limits.disk === 0 ? undefined : (
                      <p className='text-xs text-(--mantine-color-dimmed)'>
                        {t('pages.admin.databaseAgentHosts.tabs.overview.page.label.free', {
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
                  noLimitLabel={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.noLimit', {})}
                  formatValue={(value) => `${value}%`}
                  footer={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.cores', {
                    cores: (capacity.allocated.cpu / 100).toFixed(2),
                  })}
                />
              </div>
            )}
          </ResourceView>
        </TitleCard>

        <TitleCard title={t('pages.admin.databaseAgentHosts.tabs.overview.page.card.breakdown', {})} icon={faChartBar}>
          <ResourceView resource={capacityResource}>
            {(capacity) => {
              const formatSize = (value: number) => bytesToString(mbToBytes(value));
              const emptyLabel = t('pages.admin.databaseAgentHosts.tabs.overview.page.label.noAllocations', {});
              const overallocatedLabel = (size: string) =>
                t('pages.admin.databaseAgentHosts.tabs.overview.page.label.overallocated', { size });

              return (
                <Stack gap='lg'>
                  <AllocationBar
                    label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.memory', {})}
                    icon={faMemory}
                    segments={instanceSegments(capacity.instances, (instance) => instance.memory)}
                    limit={capacity.limits.memory}
                    formatValue={formatSize}
                    emptyLabel={emptyLabel}
                    overallocatedLabel={overallocatedLabel}
                    details={unlimitedInstances(capacity.instances, (instance) => instance.memory)}
                    totalSource={{
                      unit: 'mb',
                      value: allocationTotals.memory,
                      onChange: (memory) => setAllocationTotals({ ...allocationTotals, memory }),
                      liveTotal: systemStats ? bytesToMb(systemStats.memory.total) : null,
                    }}
                  />
                  <AllocationBar
                    label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.disk', {})}
                    icon={faHardDrive}
                    segments={instanceSegments(capacity.instances, (instance) => instance.disk)}
                    limit={capacity.limits.disk}
                    formatValue={formatSize}
                    emptyLabel={emptyLabel}
                    overallocatedLabel={overallocatedLabel}
                    details={unlimitedInstances(capacity.instances, (instance) => instance.disk)}
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
                    segments={instanceSegments(capacity.instances, (instance) => instance.cpu)}
                    limit={0}
                    formatValue={(value) => `${value}%`}
                    emptyLabel={emptyLabel}
                    overallocatedLabel={overallocatedLabel}
                    details={unlimitedInstances(capacity.instances, (instance) => instance.cpu)}
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
      </Stack>
    </AdminSubContentContainer>
  );
}
