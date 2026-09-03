import {
  faChartPie,
  faCircleInfo,
  faHardDrive,
  faMemory,
  faMicrochip,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SimpleGrid } from '@mantine/core';
import { z } from 'zod';
import getDatabaseAgentHostCapacity from '@/api/admin/database-agent-hosts/getDatabaseAgentHostCapacity.ts';
import getDatabaseAgentHostSystemOverview from '@/api/admin/database-agent-hosts/getDatabaseAgentHostSystemOverview.ts';
import CapacityCard from '@/elements/admin/CapacityCard.tsx';
import InfoRow from '@/elements/admin/InfoRow.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { parseVersion } from '@/lib/version.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

type DatabaseAgentHost = z.infer<typeof adminDatabaseAgentHostSchema>;

export default function DatabaseAgentHostOverview({ databaseAgentHost }: { databaseAgentHost: DatabaseAgentHost }) {
  const { t } = useTranslations();
  const { updateInformation } = useAdminStore();

  const { data: capacity } = useResource({
    queryKey: queryKeys.admin.databaseAgentHosts.capacity(databaseAgentHost.uuid),
    queryFn: () => getDatabaseAgentHostCapacity(databaseAgentHost.uuid),
    silent: true,
  });

  const { data: overview, error } = useResource({
    queryKey: queryKeys.admin.databaseAgentHosts.systemOverview(databaseAgentHost.uuid),
    queryFn: () => getDatabaseAgentHostSystemOverview(databaseAgentHost.uuid),
    silent: true,
  });

  const hasUpdate =
    overview && updateInformation
      ? parseVersion(updateInformation.latestDbAgentVersion).isNewerThan(overview.version)
      : false;

  return (
    <AdminSubContentContainer
      title={t('pages.admin.databaseAgentHosts.tabs.overview.page.title', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.databaseAgentHosts.view.overview.subContainer}
      registryProps={{ databaseAgentHost }}
    >
      <Group mb='md' gap='xs'>
        <Badge color={databaseAgentHost.deploymentEnabled ? 'green' : 'red'} variant='light'>
          {databaseAgentHost.deploymentEnabled
            ? t('pages.admin.databaseAgentHosts.tabs.overview.page.status.deploymentEnabled', {})
            : t('pages.admin.databaseAgentHosts.tabs.overview.page.status.deploymentDisabled', {})}
        </Badge>
        <Badge color={databaseAgentHost.maintenanceEnabled ? 'red' : 'gray'} variant='light'>
          {databaseAgentHost.maintenanceEnabled
            ? t('pages.admin.databaseAgentHosts.tabs.overview.page.status.maintenanceEnabled', {})
            : t('pages.admin.databaseAgentHosts.tabs.overview.page.status.maintenanceDisabled', {})}
        </Badge>
      </Group>

      <Stack gap='md'>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing='md'>
          <TitleCard
            title={t('pages.admin.databaseAgentHosts.tabs.overview.page.card.hostDetails', {})}
            icon={<FontAwesomeIcon icon={faServer} />}
          >
            <Stack gap={0}>
              <InfoRow label={t('common.form.url', {})}>
                <Text size='sm' ff='monospace' className='break-all'>
                  {databaseAgentHost.url}
                </Text>
              </InfoRow>
              <InfoRow label={t('common.form.memory', {})}>
                <Text size='sm'>{bytesToString(mbToBytes(databaseAgentHost.memory))}</Text>
              </InfoRow>
              <InfoRow label={t('common.form.disk', {})}>
                <Text size='sm'>{bytesToString(mbToBytes(databaseAgentHost.disk))}</Text>
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
            icon={<FontAwesomeIcon icon={faCircleInfo} />}
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
                    {hasUpdate && (
                      <Badge color='yellow' variant='light' size='sm'>
                        {t('pages.admin.databaseAgentHosts.tabs.overview.page.badge.updateAvailable', {})}
                      </Badge>
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
        </SimpleGrid>

        <TitleCard
          title={t('pages.admin.databaseAgentHosts.tabs.overview.page.card.resources', {})}
          icon={<FontAwesomeIcon icon={faChartPie} />}
          rightSection={
            capacity ? (
              <Badge color='gray' variant='light' ml='auto'>
                <FontAwesomeIcon icon={faServer} className='mr-1.5' />
                {t('pages.admin.databaseAgentHosts.tabs.overview.page.label.instances', {})}:{' '}
                {capacity.allocated.instances}
              </Badge>
            ) : null
          }
        >
          {!capacity ? (
            <Spinner.Centered />
          ) : (
            <div className='grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4'>
              <CapacityCard
                label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.memory', {})}
                icon={<FontAwesomeIcon icon={faMemory} />}
                allocated={capacity.allocated.memory}
                limit={capacity.limits.memory}
                noLimitLabel={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.noLimit', {})}
                footer={
                  <p className='text-xs'>
                    {t('pages.admin.databaseAgentHosts.tabs.overview.page.label.free', {
                      size: bytesToString(mbToBytes(Math.max(capacity.limits.memory - capacity.allocated.memory, 0))),
                    })}
                  </p>
                }
              />
              <CapacityCard
                label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.disk', {})}
                icon={<FontAwesomeIcon icon={faHardDrive} />}
                allocated={capacity.allocated.disk}
                limit={capacity.limits.disk}
                noLimitLabel={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.noLimit', {})}
                footer={
                  <p className='text-xs'>
                    {t('pages.admin.databaseAgentHosts.tabs.overview.page.label.free', {
                      size: bytesToString(mbToBytes(Math.max(capacity.limits.disk - capacity.allocated.disk, 0))),
                    })}
                  </p>
                }
              />
              <CapacityCard
                label={t('common.stat.cpu', {})}
                icon={<FontAwesomeIcon icon={faMicrochip} />}
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
        </TitleCard>
      </Stack>
    </AdminSubContentContainer>
  );
}
