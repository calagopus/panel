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
import { Text } from '@mantine/core';
import InfoRow from '@/elements/admin/InfoRow.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import StatCard from '@/elements/data-display/StatCard.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import RedactedText from '@/elements/typography/RedactedText.tsx';
import { formatTrashSettings, serverStatusInfo } from '@/lib/domain/server.ts';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Server = AdminServer;

function limitBytesLabel(
  value: number,
  unlimitedLabel: string,
  {
    unlimitedValue = 0,
    disabledValue,
    disabledLabel,
  }: { unlimitedValue?: number; disabledValue?: number; disabledLabel?: string } = {},
) {
  if (value === unlimitedValue) return unlimitedLabel;
  if (disabledValue !== undefined && value === disabledValue && disabledLabel) return disabledLabel;
  return bytesToString(mbToBytes(value));
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
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
          <TitleCard
            title={t('pages.admin.servers.tabs.overview.page.card.owner', {})}
            icon={faUser}
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

          <TitleCard title={t('pages.admin.servers.tabs.overview.page.card.nodeAndLocation', {})} icon={faNetworkWired}>
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
                  <RedactedText
                    value={server.node.sftpHost ?? new URL(server.node.url).hostname}
                    suffix={`:${server.node.sftpPort}`}
                  />
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
        </div>

        <TitleCard title={t('pages.admin.servers.tabs.overview.page.card.serverDetails', {})} icon={faServer}>
          <div className='grid grid-cols-1 md:grid-cols-2'>
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
                  {allocation ? <RedactedText value={allocationLabel} /> : allocationLabel}
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
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.trash', {})}>
                <Text size='sm'>
                  {server.trash === null ? (
                    <Text span c='dimmed' size='sm'>
                      {t('common.elements.trashSettings.default', {
                        summary: formatTrashSettings(server.trashDefaults),
                      })}
                    </Text>
                  ) : (
                    formatTrashSettings(server.trash)
                  )}
                </Text>
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.labels', {})}>
                {Object.keys(server.labels).length > 0 ? (
                  <Group gap={4} justify='flex-end'>
                    {Object.entries(server.labels).map(([key, value]) => (
                      <Badge key={key} color='gray' variant='light' className='normal-case!'>
                        {key}={value}
                      </Badge>
                    ))}
                  </Group>
                ) : (
                  <Text size='sm' c='dimmed'>
                    {t('common.na', {})}
                  </Text>
                )}
              </InfoRow>
              <InfoRow label={t('pages.admin.servers.tabs.overview.page.label.createdAt', {})}>
                <Text size='sm'>{formatDateTime(server.created)}</Text>
              </InfoRow>
            </Stack>
          </div>
          <ExtensionSlot
            components={
              window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.serverDetails
                .appendedComponents
            }
            name='server-details-ext'
            props={{ server }}
          />
        </TitleCard>

        <TitleCard title={t('pages.admin.servers.tabs.overview.page.card.resourceLimits', {})} icon={faMicrochip}>
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3'>
            <StatCard
              label={t('common.stat.cpu', {})}
              icon={faMicrochip}
              value={server.limits.cpu === 0 ? unlimitedLabel : `${server.limits.cpu}%`}
            />
            <StatCard
              label={t('pages.admin.servers.tabs.overview.page.label.memory', {})}
              icon={faMemory}
              value={limitBytesLabel(server.limits.memory, unlimitedLabel)}
            />
            <StatCard
              label={t('pages.admin.servers.tabs.overview.page.label.disk', {})}
              icon={faHardDrive}
              value={limitBytesLabel(server.limits.disk, unlimitedLabel)}
            />
            <StatCard
              label={t('pages.admin.servers.tabs.overview.page.label.swap', {})}
              icon={faServer}
              value={limitBytesLabel(server.limits.swap, unlimitedLabel, {
                unlimitedValue: -1,
                disabledValue: 0,
                disabledLabel: t('common.form.disabled', {}),
              })}
            />
            <ExtensionSlot
              components={
                window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.resourceLimits
                  .appendedComponents
              }
              name='resource-limits-ext'
              props={{ server }}
            />
          </div>
        </TitleCard>

        <TitleCard title={t('pages.admin.servers.tabs.overview.page.card.featureLimits', {})} icon={faLayerGroup}>
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3'>
            <StatCard
              label={t('pages.admin.servers.tabs.overview.page.label.allocations', {})}
              icon={faNetworkWired}
              value={String(server.featureLimits.allocations)}
            />
            <StatCard
              label={t('pages.admin.servers.tabs.overview.page.label.databases', {})}
              icon={faDatabase}
              value={String(server.featureLimits.databases)}
            />
            <StatCard
              label={t('pages.admin.servers.tabs.overview.page.label.backups', {})}
              icon={faArchive}
              value={String(server.featureLimits.backups)}
            />
            <StatCard
              label={t('pages.admin.servers.tabs.overview.page.label.schedules', {})}
              icon={faClock}
              value={String(server.featureLimits.schedules)}
            />
            <ExtensionSlot
              components={
                window.extensionContext.extensionRegistry.pages.admin.servers.view.overview.featureLimits
                  .appendedComponents
              }
              name='feature-limit-ext'
              props={{ server }}
            />
          </div>
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
