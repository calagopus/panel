import {
  faArchive,
  faClock,
  faDatabase,
  faHardDrive,
  faLayerGroup,
  faMemory,
  faMicrochip,
  faNetworkWired,
  faServer,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SimpleGrid, Text } from '@mantine/core';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { serverStatusInfo } from '@/lib/domain/server.ts';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Server = AdminServer;

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

function StatBox({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <Card className='flex flex-col gap-1'>
      <Group gap='xs'>
        <Text size='xs' c='dimmed'>
          {icon}
        </Text>
        <Text size='xs' c='dimmed' tt='uppercase' fw={600}>
          {label}
        </Text>
      </Group>
      <Text component='div' size='lg' fw={700}>
        {value}
      </Text>
    </Card>
  );
}

function LimitBytesValue({
  value,
  unlimitedValue = 0,
  disabledValue,
  unlimitedLabel,
  disabledLabel,
}: {
  value: number;
  unlimitedValue?: number;
  disabledValue?: number;
  unlimitedLabel: string;
  disabledLabel?: string;
}) {
  if (value === unlimitedValue) {
    return (
      <Badge color='gray' variant='light'>
        {unlimitedLabel}
      </Badge>
    );
  }

  if (disabledValue !== undefined && value === disabledValue && disabledLabel) {
    return (
      <Badge color='gray' variant='light'>
        {disabledLabel}
      </Badge>
    );
  }

  return <>{bytesToString(mbToBytes(value))}</>;
}

export default function ServerOverview({ server }: { server: Server }) {
  const { t } = useTranslations();

  const statusBadges: React.ReactNode[] = [];
  if (server.isSuspended) {
    statusBadges.push(
      <Badge key='suspended' color='red' variant='light'>
        {t('pages.admin.servers.tabs.overview.page.badge.suspended', {})}
      </Badge>,
    );
  }
  if (server.isTransferring) {
    statusBadges.push(
      <Badge key='transferring' color='yellow' variant='light'>
        {t('pages.admin.servers.tabs.overview.page.badge.transferring', {})}
      </Badge>,
    );
  }
  if (server.status) {
    statusBadges.push(
      <Badge key={server.status} color={serverStatusInfo[server.status].badgeColor} variant='light'>
        {serverStatusInfo[server.status].label()}
      </Badge>,
    );
  }

  const allocation = server.allocation;
  const allocationLabel = allocation
    ? `${allocation.ipAlias ?? allocation.ip}:${allocation.port}`
    : t('pages.admin.servers.tabs.overview.page.label.none', {});

  const unlimitedLabel = t('pages.admin.servers.tabs.overview.page.label.unlimited', {});

  return (
    <AdminSubContentContainer title={t('pages.admin.servers.tabs.overview.page.title', {})} titleOrder={2}>
      {statusBadges.length > 0 && (
        <Group mb='md' gap='xs'>
          {statusBadges}
        </Group>
      )}

      <Stack gap='md'>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing='md'>
          <TitleCard
            title={t('pages.admin.servers.tabs.overview.page.card.owner', {})}
            icon={<FontAwesomeIcon icon={faUser} />}
            rightSection={
              server.owner.admin ? (
                <Badge color='blue' variant='light' size='sm' ml='auto'>
                  {t('pages.admin.servers.tabs.overview.page.badge.admin', {})}
                </Badge>
              ) : null
            }
          >
            <Stack gap={0}>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.user', {})}>
                <TableLink to={`/admin/users/${server.owner.uuid}`}>
                  {server.owner.nameFirst || server.owner.nameLast
                    ? `${[server.owner.nameFirst, server.owner.nameLast].filter(Boolean).join(' ')} (${server.owner.username})`
                    : server.owner.username}
                </TableLink>
              </InfoRow>
              <InfoRow label={t('common.form.language', {})}>
                <Text size='sm'>{server.owner.language}</Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.createdAt', {})}>
                <Text size='sm'>{formatDateTime(server.owner.created)}</Text>
              </InfoRow>
              <ExtensionSlot
                components={
                  window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.owner.appendedComponents
                }
                name='owner-ext'
                props={{ server }}
              />
            </Stack>
          </TitleCard>

          <TitleCard
            title={t('pages.admin.servers.tabs.overview.page.card.nodeAndLocation', {})}
            icon={<FontAwesomeIcon icon={faNetworkWired} />}
          >
            <Stack gap={0}>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.node', {})}>
                <TableLink to={`/admin/nodes/${server.node.uuid}`}>{server.node.name}</TableLink>
              </InfoRow>
              <InfoRow label={t('common.form.location', {})}>
                <TableLink to={`/admin/locations/${server.node.location.uuid}`} className='inline-flex items-center'>
                  {server.node.location.flag && (
                    <img
                      src={`/flags/${server.node.location.flag}.svg`}
                      alt={server.node.location.name}
                      className='w-5 h-5 mr-1 rounded-md shrink-0 my-auto'
                    />
                  )}
                  {server.node.location.name}
                </TableLink>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.sftpAddress', {})}>
                <Text size='sm' ff='monospace'>
                  {server.node.sftpHost ?? new URL(server.node.url).hostname}:{server.node.sftpPort}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.memoryLimit', {})}>
                <Text size='sm'>
                  {server.node.memory === 0 ? unlimitedLabel : bytesToString(mbToBytes(server.node.memory))}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.diskLimit', {})}>
                <Text size='sm'>
                  {server.node.disk === 0 ? unlimitedLabel : bytesToString(mbToBytes(server.node.disk))}
                </Text>
              </InfoRow>
              <ExtensionSlot
                components={
                  window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.nodeAndLocation
                    .appendedComponents
                }
                name='node-location-ext'
                props={{ server }}
              />
            </Stack>
          </TitleCard>
        </SimpleGrid>

        <TitleCard
          title={t('pages.admin.servers.tabs.overview.page.card.serverDetails', {})}
          icon={<FontAwesomeIcon icon={faServer} />}
        >
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={0}>
            <Stack gap={0} className='md:pr-4 md:border-r md:border-(--mantine-color-default-border)'>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.uuid', {})}>
                <Text size='sm' ff='monospace'>
                  {server.uuid}
                </Text>
              </InfoRow>
              <InfoRow label={t('common.form.externalId', {})}>
                <Text size='sm' ff='monospace'>
                  {server.externalId ?? (
                    <Text span c='dimmed' size='sm'>
                      {t('common.na', {})}
                    </Text>
                  )}
                </Text>
              </InfoRow>
              <InfoRow label={t('common.form.primaryAllocation', {})}>
                <Text size='sm' ff='monospace'>
                  {allocationLabel}
                </Text>
              </InfoRow>
              <InfoRow label={t('common.form.nest', {})}>
                <TableLink to={`/admin/nests/${server.nest.uuid}`}>{server.nest.name}</TableLink>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.egg', {})}>
                <TableLink to={`/admin/nests/${server.nest.uuid}/eggs/${server.egg.uuid}`}>{server.egg.name}</TableLink>
              </InfoRow>
            </Stack>
            <Stack gap={0} className='md:pl-4'>
              <InfoRow label={t('common.form.dockerImage', {})}>
                <Text size='sm' ff='monospace' className='break-all'>
                  {server.image}
                </Text>
              </InfoRow>
              <InfoRow label={t('common.form.timezone', {})}>
                <Text size='sm'>
                  {server.timezone ?? (
                    <Text span c='dimmed' size='sm'>
                      {t('common.na', {})}
                    </Text>
                  )}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.autoKill', {})}>
                <Text size='sm'>
                  {server.autoKill.enabled
                    ? t('pages.admin.servers.tabs.overview.page.label.autoKillSeconds', {
                        seconds: server.autoKill.seconds,
                      })
                    : t('pages.admin.servers.tabs.overview.page.label.autoKillDisabled', {})}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.createdAt', {})}>
                <Text size='sm'>{formatDateTime(server.created)}</Text>
              </InfoRow>
            </Stack>
          </SimpleGrid>
          <ExtensionSlot
            components={
              window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.serverDetails
                .appendedComponents
            }
            name='server-details-ext'
            props={{ server }}
          />
        </TitleCard>

        <TitleCard
          title={t('pages.admin.servers.tabs.overview.page.card.resourceLimits', {})}
          icon={<FontAwesomeIcon icon={faMicrochip} />}
        >
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing='sm'>
            <StatBox
              label={t('common.stat.cpu', {})}
              icon={<FontAwesomeIcon icon={faMicrochip} />}
              value={
                server.limits.cpu === 0 ? (
                  <Badge color='gray' variant='light'>
                    {unlimitedLabel}
                  </Badge>
                ) : (
                  `${server.limits.cpu}%`
                )
              }
            />
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.memory', {})}
              icon={<FontAwesomeIcon icon={faMemory} />}
              value={<LimitBytesValue value={server.limits.memory} unlimitedLabel={unlimitedLabel} />}
            />
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.disk', {})}
              icon={<FontAwesomeIcon icon={faHardDrive} />}
              value={<LimitBytesValue value={server.limits.disk} unlimitedLabel={unlimitedLabel} />}
            />
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.swap', {})}
              icon={<FontAwesomeIcon icon={faServer} />}
              value={
                <LimitBytesValue
                  value={server.limits.swap}
                  unlimitedValue={-1}
                  disabledValue={0}
                  unlimitedLabel={unlimitedLabel}
                  disabledLabel={t('common.form.disabled', {})}
                />
              }
            />
            <ExtensionSlot
              components={
                window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.resourceLimits
                  .appendedComponents
              }
              name='resource-limits-ext'
              props={{ server }}
            />
          </SimpleGrid>
        </TitleCard>

        <TitleCard
          title={t('pages.admin.servers.tabs.overview.page.card.featureLimits', {})}
          icon={<FontAwesomeIcon icon={faLayerGroup} />}
        >
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing='sm'>
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.allocations', {})}
              icon={<FontAwesomeIcon icon={faNetworkWired} />}
              value={server.featureLimits.allocations}
            />
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.databases', {})}
              icon={<FontAwesomeIcon icon={faDatabase} />}
              value={server.featureLimits.databases}
            />
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.backups', {})}
              icon={<FontAwesomeIcon icon={faArchive} />}
              value={server.featureLimits.backups}
            />
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.schedules', {})}
              icon={<FontAwesomeIcon icon={faClock} />}
              value={server.featureLimits.schedules}
            />
            <ExtensionSlot
              components={
                window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.featureLimits
                  .appendedComponents
              }
              name='feature-limit-ext'
              props={{ server }}
            />
          </SimpleGrid>
        </TitleCard>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.appendedCards.appendedComponents
          }
          name='overview-card-ext'
          props={{ server }}
        />
      </Stack>
    </AdminSubContentContainer>
  );
}
