import {
  faChartBar,
  faCircleInfo,
  faDatabase,
  faExclamationTriangle,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { z } from 'zod';
import getDatabaseHostDatabaseSizes from '@/api/admin/database-hosts/getDatabaseHostDatabaseSizes.ts';
import getDatabaseHostVersion from '@/api/admin/database-hosts/getDatabaseHostVersion.ts';
import AllocationBar, { groupAllocationSegments } from '@/elements/admin/AllocationBar.tsx';
import InfoRow from '@/elements/admin/InfoRow.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Table, { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import Code from '@/elements/typography/Code.tsx';
import RedactedText from '@/elements/typography/RedactedText.tsx';
import Text from '@/elements/typography/Text.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type DatabaseHost = z.infer<typeof adminDatabaseHostSchema>;

function credentialsAddress(credentials: DatabaseHost['credentials']): string | null {
  if (credentials.type === 'details') {
    return `${credentials.host}:${credentials.port}`;
  }

  try {
    const url = new URL(credentials.connectionString);
    return url.port ? `${url.hostname}:${url.port}` : url.hostname;
  } catch {
    return null;
  }
}

export default function DatabaseHostOverview({ databaseHost }: { databaseHost: DatabaseHost }) {
  const { t, tItem } = useTranslations();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const { data: version, error: versionError } = useResource({
    queryKey: queryKeys.admin.databaseHosts.version(databaseHost.uuid),
    queryFn: () => getDatabaseHostVersion(databaseHost.uuid),
    silent: true,
  });

  const sizesResource = useResource({
    queryKey: queryKeys.admin.databaseHosts.databaseSizes(databaseHost.uuid),
    queryFn: () => getDatabaseHostDatabaseSizes(databaseHost.uuid),
    enabled: !databaseHost.maintenanceEnabled,
    silent: true,
  });

  const address = credentialsAddress(databaseHost.credentials);
  const totalSize = sizesResource.data?.reduce((sum, database) => sum + database.size, 0);

  return (
    <AdminSubContentContainer
      title={t('pages.admin.databaseHosts.tabs.overview.page.title', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.databaseHosts.view.overview.subContainer}
      registryProps={{ databaseHost }}
    >
      <Group mb='md' gap='xs'>
        <Badge color={databaseHost.deploymentEnabled ? 'green' : 'red'} variant='light'>
          {databaseHost.deploymentEnabled
            ? t('common.badge.deploymentEnabled', {})
            : t('common.badge.deploymentDisabled', {})}
        </Badge>
        <Badge color={databaseHost.maintenanceEnabled ? 'red' : 'gray'} variant='light'>
          {databaseHost.maintenanceEnabled
            ? t('common.badge.maintenanceEnabled', {})
            : t('common.badge.maintenanceDisabled', {})}
        </Badge>
      </Group>

      <Stack gap='md'>
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
          <TitleCard title={t('pages.admin.databaseHosts.tabs.overview.page.card.hostDetails', {})} icon={faServer}>
            <Stack gap={0}>
              <InfoRow label={t('common.form.type', {})}>
                <Text size='sm'>{databaseTypeLabelMapping[databaseHost.type]}</Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.databaseHosts.tabs.overview.page.label.address', {})}>
                <Text size='sm' ff='monospace' className='break-all'>
                  {address ? (
                    <RedactedText value={address} />
                  ) : (
                    <Text span c='dimmed' size='sm'>
                      {t('common.na', {})}
                    </Text>
                  )}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.databaseHosts.tabs.overview.page.label.publicAddress', {})}>
                <Text size='sm' ff='monospace' className='break-all'>
                  {databaseHost.publicHost || databaseHost.publicPort ? (
                    <RedactedText
                      value={databaseHost.publicHost ?? address?.replace(/:\d+$/, '') ?? ''}
                      suffix={databaseHost.publicPort ? `:${databaseHost.publicPort}` : undefined}
                    />
                  ) : (
                    <Text span c='dimmed' size='sm'>
                      {t('common.na', {})}
                    </Text>
                  )}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.databaseHosts.tabs.overview.page.label.createdAt', {})}>
                <Text size='sm'>{formatDateTime(databaseHost.created)}</Text>
              </InfoRow>
            </Stack>
          </TitleCard>

          <TitleCard title={t('pages.admin.databaseHosts.tabs.overview.page.card.systemInfo', {})} icon={faCircleInfo}>
            <Stack gap={0}>
              <InfoRow label={t('pages.admin.databaseHosts.tabs.overview.page.label.version', {})}>
                {versionError ? (
                  <Text size='sm' c='dimmed'>
                    {t('pages.admin.databaseHosts.tabs.overview.page.label.unavailable', {})}
                  </Text>
                ) : version === undefined ? (
                  <Spinner size={16} />
                ) : (
                  <Text size='sm' ff='monospace' className='break-all'>
                    {version}
                  </Text>
                )}
              </InfoRow>
              <InfoRow label={t('pages.admin.databaseHosts.tabs.overview.page.label.databases', {})}>
                {sizesResource.data ? (
                  <Text size='sm'>{sizesResource.data.length}</Text>
                ) : sizesResource.error || databaseHost.maintenanceEnabled ? (
                  <Text size='sm' c='dimmed'>
                    {t('pages.admin.databaseHosts.tabs.overview.page.label.unavailable', {})}
                  </Text>
                ) : (
                  <Spinner size={16} />
                )}
              </InfoRow>
              <InfoRow label={t('pages.admin.databaseHosts.tabs.overview.page.label.totalSize', {})}>
                {totalSize !== undefined ? (
                  <Text size='sm'>{bytesToString(totalSize)}</Text>
                ) : sizesResource.error || databaseHost.maintenanceEnabled ? (
                  <Text size='sm' c='dimmed'>
                    {t('pages.admin.databaseHosts.tabs.overview.page.label.unavailable', {})}
                  </Text>
                ) : (
                  <Spinner size={16} />
                )}
              </InfoRow>
            </Stack>
          </TitleCard>
        </div>

        <TitleCard title={t('pages.admin.databaseHosts.tabs.overview.page.card.sizes', {})} icon={faChartBar}>
          {databaseHost.maintenanceEnabled ? (
            <Alert color='yellow' icon={faExclamationTriangle}>
              {t('pages.admin.databaseHosts.tabs.overview.page.alert.maintenance', {})}
            </Alert>
          ) : (
            <ResourceView resource={sizesResource}>
              {(databases) => (
                <Stack gap='md'>
                  <AllocationBar
                    label={t('pages.admin.databaseHosts.tabs.overview.page.label.totalSize', {})}
                    icon={faDatabase}
                    segments={groupAllocationSegments(
                      databases,
                      (database) => database.size,
                      (database) => ({
                        key: database.uuid,
                        label: database.name,
                        to: `/admin/servers/${database.server.uuid}/databases`,
                        hint: database.server.name,
                      }),
                      (count) =>
                        t('pages.admin.databaseHosts.tabs.overview.page.label.other', {
                          databases: tItem('database', count),
                        }),
                    )}
                    limit={0}
                    formatValue={bytesToString}
                    emptyLabel={t('pages.admin.databaseHosts.tabs.overview.page.label.noDatabases', {})}
                    overallocatedLabel={() => null}
                  />

                  <Table
                    columns={[
                      '#',
                      t('common.table.columns.name', {}),
                      t('common.table.columns.server', {}),
                      t('common.table.columns.size', {}),
                      t('pages.admin.databaseHosts.tabs.overview.page.label.share', {}),
                    ]}
                    pagination={{
                      total: databases.length,
                      page,
                      perPage,
                      data: databases,
                    }}
                    onPageSelect={setPage}
                    onPerPageSelect={(perPage) => {
                      setPerPage(perPage);
                      setPage(1);
                    }}
                  >
                    {databases.slice((page - 1) * perPage, page * perPage).map((database, index) => (
                      <TableRow key={database.uuid}>
                        <TableData>{(page - 1) * perPage + index + 1}</TableData>
                        <TableData>{database.name}</TableData>
                        <TableData>
                          <TableLink to={`/admin/servers/${database.server.uuid}`}>
                            <Code>{database.server.name}</Code>
                          </TableLink>
                        </TableData>
                        <TableData>{bytesToString(database.size)}</TableData>
                        <TableData className='min-w-40'>
                          <Progress value={totalSize ? (database.size / totalSize) * 100 : 0} hourglass={false} />
                        </TableData>
                      </TableRow>
                    ))}
                  </Table>
                </Stack>
              )}
            </ResourceView>
          )}
        </TitleCard>
      </Stack>
    </AdminSubContentContainer>
  );
}
