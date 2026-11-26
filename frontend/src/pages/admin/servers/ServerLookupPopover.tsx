import { faFingerprint, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type ReactNode, useState } from 'react';
import getServerByExternalId from '@/api/admin/servers/getServerByExternalId.ts';
import getServerDatabaseByName from '@/api/admin/servers/getServerDatabaseByName.ts';
import getServerDatabaseInstance from '@/api/admin/servers/getServerDatabaseInstance.ts';
import Button from '@/elements/buttons/Button.tsx';
import Group from '@/elements/layout/Group.tsx';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import ResourceLookup from '@/elements/ResourceLookup.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type LookupMode = 'externalId' | 'database' | 'databaseInstance';

export default function ServerLookupPopover() {
  const { t } = useTranslations();
  const tr = 'pages.admin.servers.lookup';
  const canReadServers = useAdminCan('servers.read');
  const canReadDatabaseHosts = useAdminCan('database-hosts.read');
  const canReadDatabaseAgentHosts = useAdminCan('database-agent-hosts.read');

  const [opened, setOpened] = useState(false);
  const [mode, setMode] = useState<LookupMode>('externalId');

  if (!canReadServers) return null;

  const modes: LookupMode[] = [
    'externalId',
    ...(canReadDatabaseHosts ? (['database'] as const) : []),
    ...(canReadDatabaseAgentHosts ? (['databaseInstance'] as const) : []),
  ];

  const close = () => setOpened(false);
  const renderActions = (viewButton: ReactNode) => viewButton && <Group justify='flex-end'>{viewButton}</Group>;

  const sharedLabels = {
    search: t(`${tr}.form.search`, {}),
    resultTitle: t(`${tr}.result.title`, {}),
    viewResult: t(`${tr}.result.viewServer`, {}),
  };

  return (
    <Popover opened={opened} onChange={setOpened} width={400} position='bottom-end' shadow='md' withinPortal>
      <Popover.Target>
        <Button
          onClick={() => setOpened((o) => !o)}
          variant='default'
          leftSection={<FontAwesomeIcon icon={faFingerprint} />}
        >
          {t(`${tr}.button`, {})}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap='sm'>
          {modes.length > 1 && (
            <SegmentedControl
              fullWidth
              value={mode}
              onChange={(value) => setMode(value as LookupMode)}
              data={modes.map((m) => ({ value: m, label: t(`${tr}.mode.${m}`, {}) }))}
            />
          )}

          {mode === 'externalId' && (
            <ResourceLookup
              key='externalId'
              labels={{
                ...sharedLabels,
                inputLabel: t('common.form.externalId', {}),
                inputPlaceholder: t(`${tr}.form.externalIdPlaceholder`, {}),
                notFound: t(`${tr}.notFound.externalId`, {}),
              }}
              resultIcon={faServer}
              lookup={(externalId) => getServerByExternalId(externalId)}
              fields={(server) => [
                { label: t(`${tr}.result.name`, {}), value: server.name },
                { label: t(`${tr}.result.owner`, {}), value: server.owner.username },
                { label: t(`${tr}.result.node`, {}), value: server.node.name },
              ]}
              href={(server) => `/admin/servers/${server.uuid}`}
              onNavigate={close}
              renderActions={renderActions}
            />
          )}

          {mode === 'database' && (
            <ResourceLookup
              key='database'
              labels={{
                ...sharedLabels,
                inputLabel: t(`${tr}.form.database`, {}),
                inputPlaceholder: t(`${tr}.form.databasePlaceholder`, {}),
                notFound: t(`${tr}.notFound.database`, {}),
              }}
              resultIcon={faServer}
              lookup={(database) => getServerDatabaseByName(database)}
              fields={(database) => [
                { label: t(`${tr}.result.name`, {}), value: database.server.name },
                { label: t(`${tr}.result.owner`, {}), value: database.server.owner.username },
                { label: t(`${tr}.result.database`, {}), value: database.name },
              ]}
              href={(database) => `/admin/servers/${database.server.uuid}/databases`}
              onNavigate={close}
              renderActions={renderActions}
            />
          )}

          {mode === 'databaseInstance' && (
            <ResourceLookup
              key='databaseInstance'
              labels={{
                ...sharedLabels,
                inputLabel: t(`${tr}.form.databaseInstance`, {}),
                inputPlaceholder: t(`${tr}.form.databaseInstancePlaceholder`, {}),
                notFound: t(`${tr}.notFound.databaseInstance`, {}),
              }}
              resultIcon={faServer}
              lookup={(instanceUuid) => getServerDatabaseInstance(instanceUuid)}
              fields={(instance) => [
                { label: t(`${tr}.result.name`, {}), value: instance.server.name },
                { label: t(`${tr}.result.owner`, {}), value: instance.server.owner.username },
                { label: t(`${tr}.result.databaseInstance`, {}), value: instance.name },
              ]}
              href={(instance) => `/admin/servers/${instance.server.uuid}/databases`}
              onNavigate={close}
              renderActions={renderActions}
            />
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
