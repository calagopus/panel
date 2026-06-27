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
import { z } from 'zod';
import Badge from '@/elements/Badge.tsx';
import Card from '@/elements/Card.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import Stack from '@/elements/Stack.tsx';
import TableLink from '@/elements/TableLink.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { bytesToString, mbToBytes } from '@/lib/size.ts';
import { formatDateTime } from '@/lib/time.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Server = z.infer<typeof adminServerSchema>;

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
      <Text size='lg' fw={700}>
        {value}
      </Text>
    </Card>
  );
}

function countLabel(value: number, unlimited: string): React.ReactNode {
  return value === 0 ? (
    <Badge color='gray' variant='light'>
      {unlimited}
    </Badge>
  ) : (
    value
  );
}

function locationFlag(flag: string | null): string {
  if (!flag || flag.length !== 2) return '';
  const codePoints = [...flag.toUpperCase()].map((c) => 0x1f1e0 - 0x41 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints) + ' ';
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
  if (server.status === 'installing') {
    statusBadges.push(
      <Badge key='installing' color='blue' variant='light'>
        {t('pages.admin.servers.tabs.overview.page.badge.installing', {})}
      </Badge>,
    );
  }
  if (server.status === 'install_failed') {
    statusBadges.push(
      <Badge key='install_failed' color='red' variant='light'>
        {t('pages.admin.servers.tabs.overview.page.badge.installFailed', {})}
      </Badge>,
    );
  }
  if (server.status === 'restoring_backup') {
    statusBadges.push(
      <Badge key='restoring' color='orange' variant='light'>
        {t('pages.admin.servers.tabs.overview.page.badge.restoringBackup', {})}
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
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.email', {})}>
                <TableLink to={`/admin/users/${server.owner.uuid}`}>
                  {server.owner.nameFirst} {server.owner.nameLast} ({server.owner.username})
                </TableLink>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.language', {})}>
                <Text size='sm'>{server.owner.language}</Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.createdAt', {})}>
                <Text size='sm'>{formatDateTime(server.owner.created)}</Text>
              </InfoRow>
              {window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.owner.appendedComponents.map(
                (Component, index) => (
                  <Component key={`owner-ext-${index}`} server={server} />
                ),
              )}
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
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.location', {})}>
                <Text size='sm'>
                  {locationFlag(server.node.location.flag)}
                  {server.node.location.name}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.sftpAddress', {})}>
                <Text size='sm' ff='monospace'>
                  {server.node.sftpHost ?? new URL(server.node.url).hostname}:{server.node.sftpPort}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.memoryLimit', {})}>
                <Text size='sm'>{bytesToString(mbToBytes(server.node.memory))}</Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.diskLimit', {})}>
                <Text size='sm'>{bytesToString(mbToBytes(server.node.disk))}</Text>
              </InfoRow>
              {window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.nodeAndLocation.appendedComponents.map(
                (Component, index) => (
                  <Component key={`node-location-ext-${index}`} server={server} />
                ),
              )}
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
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.externalId', {})}>
                <Text size='sm' ff='monospace'>
                  {server.externalId ?? (
                    <Text span c='dimmed' size='sm'>
                      —
                    </Text>
                  )}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.primaryAllocation', {})}>
                <Text size='sm' ff='monospace'>
                  {allocationLabel}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.nest', {})}>
                <TableLink to={`/admin/nests/${server.nest.uuid}`}>{server.nest.name}</TableLink>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.egg', {})}>
                <TableLink to={`/admin/nests/${server.nest.uuid}/eggs/${server.egg.uuid}`}>{server.egg.name}</TableLink>
              </InfoRow>
            </Stack>
            <Stack gap={0} className='md:pl-4'>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.dockerImage', {})}>
                <Text size='sm' ff='monospace' className='break-all'>
                  {server.image}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.timezone', {})}>
                <Text size='sm'>
                  {server.timezone ?? (
                    <Text span c='dimmed' size='sm'>
                      —
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
                <Text size='sm'>{server.created.toLocaleString()}</Text>
              </InfoRow>
            </Stack>
          </SimpleGrid>
          {window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.serverDetails.appendedComponents.map(
            (Component, index) => (
              <Component key={`server-details-ext-${index}`} server={server} />
            ),
          )}
        </TitleCard>

        <TitleCard
          title={t('pages.admin.servers.tabs.overview.page.card.resourceLimits', {})}
          icon={<FontAwesomeIcon icon={faMicrochip} />}
        >
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing='sm'>
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.cpu', {})}
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
              value={
                server.limits.memory === 0 ? (
                  <Badge color='gray' variant='light'>
                    {unlimitedLabel}
                  </Badge>
                ) : (
                  bytesToString(mbToBytes(server.limits.memory))
                )
              }
            />
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.disk', {})}
              icon={<FontAwesomeIcon icon={faHardDrive} />}
              value={
                server.limits.disk === 0 ? (
                  <Badge color='gray' variant='light'>
                    {unlimitedLabel}
                  </Badge>
                ) : (
                  bytesToString(mbToBytes(server.limits.disk))
                )
              }
            />
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.swap', {})}
              icon={<FontAwesomeIcon icon={faServer} />}
              value={
                server.limits.swap === -1 ? (
                  <Badge color='gray' variant='light'>
                    {unlimitedLabel}
                  </Badge>
                ) : server.limits.swap === 0 ? (
                  <Badge color='gray' variant='light'>
                    0
                  </Badge>
                ) : (
                  bytesToString(mbToBytes(server.limits.swap))
                )
              }
            />
            {window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.resourceLimits.appendedComponents.map(
              (Component, index) => (
                <Component key={`resource-limits-ext-${index}`} server={server} />
              ),
            )}
          </SimpleGrid>
        </TitleCard>

        <TitleCard
          title={t('pages.admin.servers.tabs.overview.page.card.featureLimits', {})}
          icon={<FontAwesomeIcon icon={faLayerGroup} />}
        >
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing='sm'>
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.allocations', {})}
              icon={<FontAwesomeIcon icon={faNetworkWired} />}
              value={countLabel(server.featureLimits.allocations, unlimitedLabel)}
            />
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.databases', {})}
              icon={<FontAwesomeIcon icon={faDatabase} />}
              value={countLabel(server.featureLimits.databases, unlimitedLabel)}
            />
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.backups', {})}
              icon={<FontAwesomeIcon icon={faArchive} />}
              value={countLabel(server.featureLimits.backups, unlimitedLabel)}
            />
            <StatBox
              label={t('pages.admin.servers.tabs.overview.page.label.schedules', {})}
              icon={<FontAwesomeIcon icon={faClock} />}
              value={countLabel(server.featureLimits.schedules, unlimitedLabel)}
            />
            {window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.featureLimits.appendedComponents.map(
              (Component, index) => (
                <Component key={`feature-limit-ext-${index}`} server={server} />
              ),
            )}
          </SimpleGrid>
        </TitleCard>
        {window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.appendedCards.appendedComponents.map(
          (Component, index) => (
            <Component key={`overview-card-ext-${index}`} server={server} />
          ),
        )}
      </Stack>
    </AdminSubContentContainer>
  );
}
