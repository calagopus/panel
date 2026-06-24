import { faChartPie, faHardDrive, faMemory, faMicrochip, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SimpleGrid, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import getNodeCapacity from '@/api/admin/nodes/getNodeCapacity.ts';
import Badge from '@/elements/Badge.tsx';
import Card from '@/elements/Card.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import SemiCircleProgress from '@/elements/SemiCircleProgress.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import TableLink from '@/elements/TableLink.tsx';
import Title from '@/elements/Title.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { bytesToString, mbToBytes } from '@/lib/size.ts';
import { formatDateTime } from '@/lib/time.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Node = z.infer<typeof adminNodeSchema>;

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

function locationFlag(flag: string | null): string {
  if (!flag || flag.length !== 2) return '';
  const codePoints = [...flag.toUpperCase()].map((c) => 0x1f1e0 - 0x41 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints) + ' ';
}

function CapacityResource({
  label,
  icon,
  allocated,
  limit,
  footer,
}: {
  label: string;
  icon: React.ReactNode;
  allocated: number;
  limit: number;
  footer?: React.ReactNode;
}) {
  const { t } = useTranslations();
  const percent = limit > 0 ? (allocated / limit) * 100 : 0;

  if (limit === 0) {
    return (
      <Card>
        <Group grow>
          <div className='flex justify-center'>
            <SemiCircleProgress value={100} label='--' filledSegmentColor='gray' />
          </div>
          <div className='flex flex-col text-right flex-1'>
            <Title order={2}>
              {icon} {label}
            </Title>
            <h2>{bytesToString(mbToBytes(allocated))}</h2>
            <p className='text-xs'>{footer ?? t('pages.admin.nodes.tabs.capacity.page.label.noLimit', {})}</p>
          </div>
        </Group>
      </Card>
    );
  }

  return (
    <Card>
      <Group grow>
        <div className='flex justify-center'>
          <SemiCircleProgress
            value={Math.min(percent, 100)}
            label={<>{percent.toFixed(1)}%</>}
            filledSegmentColor={percent >= 90 ? 'red' : undefined}
          />
        </div>
        <div className='flex flex-col text-right flex-1'>
          <Title order={2}>
            {icon} {label}
          </Title>
          <h2>
            {bytesToString(mbToBytes(allocated))} / {bytesToString(mbToBytes(limit))}
          </h2>
          {footer}
        </div>
      </Group>
    </Card>
  );
}

export default function NodeOverview({ node }: { node: Node }) {
  const { t } = useTranslations();

  const { data: capacity } = useQuery({
    queryKey: queryKeys.admin.nodes.capacity(node.uuid),
    queryFn: () => getNodeCapacity(node.uuid),
  });

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
        <TitleCard
          title={t('pages.admin.nodes.tabs.overview.page.card.nodeDetails', {})}
          icon={<FontAwesomeIcon icon={faServer} />}
        >
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={0}>
            <Stack gap={0} className='md:pr-4 md:border-r md:border-(--mantine-color-default-border)'>
              <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.location', {})}>
                <TableLink to={`/admin/locations/${node.location.uuid}`}>
                  {locationFlag(node.location.flag)}
                  {node.location.name}
                </TableLink>
              </InfoRow>
              <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.url', {})}>
                <Text size='sm' ff='monospace' className='break-all'>
                  {node.url}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.publicUrl', {})}>
                <Text size='sm' ff='monospace' className='break-all'>
                  {node.publicUrl ?? (
                    <Text span c='dimmed' size='sm'>
                      —
                    </Text>
                  )}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.sftpAddress', {})}>
                <Text size='sm' ff='monospace'>
                  {node.sftpHost ?? new URL(node.url).hostname}:{node.sftpPort}
                </Text>
              </InfoRow>
            </Stack>
            <Stack gap={0} className='md:pl-4'>
              <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.backupConfiguration', {})}>
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
                <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.description', {})}>
                  <Text size='sm'>{node.description}</Text>
                </InfoRow>
              )}
              <InfoRow label={t('pages.admin.nodes.tabs.overview.page.label.createdAt', {})}>
                <Text size='sm'>{formatDateTime(node.created)}</Text>
              </InfoRow>
            </Stack>
          </SimpleGrid>
        </TitleCard>

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
              <CapacityResource
                label={t('pages.admin.nodes.tabs.capacity.page.label.memory', {})}
                icon={<FontAwesomeIcon icon={faMemory} />}
                allocated={capacity.allocated.memory}
                limit={capacity.limits.memory}
                footer={
                  <p className='text-xs'>
                    {t('pages.admin.nodes.tabs.capacity.page.label.free', {
                      size: bytesToString(mbToBytes(Math.max(capacity.limits.memory - capacity.allocated.memory, 0))),
                    })}
                    {capacity.allocated.memoryOverhead > 0 &&
                      ` ${t('pages.admin.nodes.tabs.capacity.page.label.overhead', {
                        size: bytesToString(mbToBytes(capacity.allocated.memoryOverhead)),
                      })}`}
                  </p>
                }
              />
              <CapacityResource
                label={t('pages.admin.nodes.tabs.capacity.page.label.disk', {})}
                icon={<FontAwesomeIcon icon={faHardDrive} />}
                allocated={capacity.allocated.disk}
                limit={capacity.limits.disk}
                footer={
                  <p className='text-xs'>
                    {t('pages.admin.nodes.tabs.capacity.page.label.free', {
                      size: bytesToString(mbToBytes(Math.max(capacity.limits.disk - capacity.allocated.disk, 0))),
                    })}
                  </p>
                }
              />
              <CapacityResource
                label={t('pages.admin.nodes.tabs.capacity.page.label.cpu', {})}
                icon={<FontAwesomeIcon icon={faMicrochip} />}
                allocated={capacity.allocated.cpu}
                limit={0}
                footer={t('pages.admin.nodes.tabs.capacity.page.label.cores', {
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
