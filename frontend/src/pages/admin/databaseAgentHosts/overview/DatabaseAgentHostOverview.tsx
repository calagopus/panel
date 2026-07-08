import { faCircleInfo, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SimpleGrid, Text } from '@mantine/core';
import { z } from 'zod';
import getDatabaseAgentHostSystemOverview from '@/api/admin/database-agent-hosts/getDatabaseAgentHostSystemOverview.ts';
import Badge from '@/elements/Badge.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { bytesToString, mbToBytes } from '@/lib/size.ts';
import { formatDateTime } from '@/lib/time.ts';
import { parseVersion } from '@/lib/version.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

type DatabaseAgentHost = z.infer<typeof adminDatabaseAgentHostSchema>;

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex items-start justify-between gap-4 py-1.5 border-b border-(--mantine-color-default-border) last:border-b-0'>
      <Text size='sm' c='dimmed' className='shrink-0'>
        {label}
      </Text>
      <div className='text-right text-sm'>{children}</div>
    </div>
  );
}

export default function DatabaseAgentHostOverview({ databaseAgentHost }: { databaseAgentHost: DatabaseAgentHost }) {
  const { t } = useTranslations();
  const { updateInformation } = useAdminStore();

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
    <AdminSubContentContainer title={t('pages.admin.databaseAgentHosts.tabs.overview.page.title', {})} titleOrder={2}>
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

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing='md'>
        <TitleCard
          title={t('pages.admin.databaseAgentHosts.tabs.overview.page.card.hostDetails', {})}
          icon={<FontAwesomeIcon icon={faServer} />}
        >
          <Stack gap={0}>
            <InfoRow label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.url', {})}>
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
              <InfoRow label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.description', {})}>
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
              <InfoRow label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.cpu', {})}>
                <Text size='sm'>
                  {overview.cpu.brand} ({overview.cpu.cpuCount})
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.memory', {})}>
                <Text size='sm'>{bytesToString(overview.memory.totalBytes)}</Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.databaseAgentHosts.tabs.overview.page.label.databases', {})}>
                <Text size='sm'>
                  {overview.databases.online} / {overview.databases.total}
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
    </AdminSubContentContainer>
  );
}
